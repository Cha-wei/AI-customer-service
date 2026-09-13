import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtemp, rm, readdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, relative, isAbsolute } from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:net';
import { PrismaClient } from '@prisma/client';
import { chromium, expect } from '@playwright/test';

// Isolated production server, real browser interactions and real approval HTTP forms.
const directory = await mkdtemp(join(tmpdir(), 'web-chat-'));
const secret = () => randomBytes(32).toString('hex');
const token = secret();
const password = secret();
const env = { ...process.env, DATABASE_URL: `file:${join(directory, 'test.db').replaceAll('\\', '/')}`,
  WEB_CHAT_SESSION_SECRET: secret(), ADMIN_UI_SESSION_SECRET: secret(), ADMIN_UI_PASSWORD: password,
  INTERNAL_API_TOKENS: JSON.stringify([{ token, role: 'operator' }]), INTENT_PROVIDER: 'rule',
  OPENAI_API_KEY: '', DEEPSEEK_API_KEY: '', NODE_ENV: 'production' };
const client = new PrismaClient({ datasourceUrl: env.DATABASE_URL });
let server, browser;
try {
  await client.$executeRawUnsafe('PRAGMA user_version = 0');
  execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], { env, stdio: 'pipe', windowsHide: true });
  const probe = createServer();
  await new Promise(r => probe.listen(0, '127.0.0.1', r));
  const port = probe.address().port;
  await new Promise(r => probe.close(r));
  const origin = `http://localhost:${port}`;
  server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-H', '127.0.0.1', '-p', String(port)], { env, stdio: 'ignore', windowsHide: true });
  const request = (path, options = {}) => fetch(origin + path, { redirect: 'manual', signal: AbortSignal.timeout(10000), ...options });
  let ready = false;
  for (let i = 0; i < 60; i++) {
    if (server.exitCode !== null) throw new Error('server exited');
    try { ready = (await request('/api/health')).ok; } catch {}
    if (ready) break;
    await new Promise(r => setTimeout(r, 500));
  }
  assert(ready, 'server startup');
  const operator = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
  const session = async customerId => {
    const res = await request('/api/internal/web-chat/session', { method: 'POST', headers: operator, body: JSON.stringify({ customerId }) });
    assert.equal(res.status, 200);
    const header = res.headers.get('set-cookie');
    assert(header.includes('HttpOnly') && header.includes('Secure') && header.includes('SameSite=strict'));
    return header.split(';')[0];
  };
  const cookie = await session('customer-1');
  const otherCookie = await session('customer-2');
  assert.equal((await request('/api/chat')).status, 401);
  assert.equal((await request('/api/chat', { headers: { cookie: cookie + 'x' } })).status, 401);
  assert.equal((await request('/api/internal/web-chat/session', { method: 'POST' })).status, 401);
  const post = (body, activeCookie = cookie, activeOrigin = origin) => request('/api/chat', { method: 'POST', headers: { cookie: activeCookie, origin: activeOrigin, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal((await post({ content: '订单', customerId: 'customer-2' })).status, 400);
  assert.equal((await post({ content: '订单', role: 'agent' })).status, 400);
  assert.equal((await post({ content: '退款' })).status, 400);
  assert.equal((await post({ content: '退款', orderId: 'order-1001' }, otherCookie)).status, 400);
  assert.equal((await post({ content: '订单' }, cookie, 'https://evil.example')).status, 403);
  browser = await chromium.launch({ ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}), headless: true });
  const context = await browser.newContext();
  await context.addCookies([{ name: 'customer_session', value: cookie.slice('customer_session='.length), url: origin, httpOnly: true, secure: true, sameSite: 'Strict' }]);
  const page = await context.newPage();
  const browserErrors = [];
  page.on('pageerror', error => browserErrors.push(error.message));
  page.on('request', req => {
    assert(!req.headers().authorization, 'browser must not send internal credentials');
    assert(!req.url().includes('/api/internal/'), 'browser must use the customer boundary');
  });
  await page.goto(origin + '/chat');
  await expect(page.getByRole('button', { name: '查询订单', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '查询订单', exact: true }).click();
  await page.getByRole('button', { name: '发送消息', exact: true }).click();
  await expect(page.getByLabel('消息历史')).toContainText('MOCK1001');
  const list = await (await request('/api/chat', { headers: { cookie } })).json();
  const id = list.conversations[0].id;
  assert.equal((await request(`/api/chat?id=${id}`, { headers: { cookie: otherCookie } })).status, 404);
  assert.equal((await post({ content: '订单', conversationId: id }, otherCookie)).status, 404);
  assert.equal((await (await request('/api/chat', { headers: { cookie: otherCookie } })).json()).conversations.length, 0);
  // Reload and select persisted history.
  await page.reload();
  await page.locator('.chat-conversation').first().click();
  await expect(page.getByLabel('消息历史')).toContainText('MOCK1001');
  const login = await request('/api/admin/session', { method: 'POST', headers: { origin }, body: new URLSearchParams({ password }) });
  const adminCookie = login.headers.get('set-cookie').split(';')[0];
  for (const [orderId, decision, expectedText] of [['order-1001', 'approve', '已完成 Mock 退款'], ['order-1002', 'reject', '未执行退款']]) {
    if (decision === 'reject') await page.getByRole('button', { name: '新建会话' }).click();
    await page.getByRole('button', { name: '申请退款', exact: true }).click();
    await expect(page.getByRole('button', { name: '发送消息', exact: true })).toBeDisabled();
    await page.getByLabel('请选择退款订单（必选）').selectOption(orderId);
    await page.getByRole('button', { name: '发送消息', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('等待人工审批');
    const approval = await client.approval.findFirstOrThrow({ where: { orderId, status: 'pending' } });
    assert.equal(await client.mockRefund.count({ where: { orderId } }), 0);
    assert.equal((await post({ content: '订单', conversationId: approval.conversationId })).status, 409);
    const res = await request(`/api/admin/conversations/${approval.conversationId}/approvals`, { method: 'POST', headers: { origin, cookie: adminCookie }, body: new URLSearchParams({ approvalId: approval.id, decision }) });
    assert.equal(res.status, 303);
    await expect(page.getByLabel('消息历史')).toContainText(expectedText, { timeout: 10000 });
    await expect(page.getByRole('button', { name: '发送消息', exact: true })).toBeDisabled();
  }
  // A failed send preserves the draft, and a later successful send still works.
  await page.getByRole('button', { name: '新建会话' }).click();
  await page.getByLabel('消息', { exact: true }).fill('订单物流');
  await page.route('**/api/chat', route => route.request().method() === 'POST' ? route.abort() : route.continue());
  await page.getByRole('button', { name: '发送消息', exact: true }).click();
  await expect(page.locator('.form-error')).toBeVisible();
  await expect(page.getByLabel('消息', { exact: true })).toHaveValue('订单物流');
  await page.unroute('**/api/chat');
  await page.getByRole('button', { name: '发送消息', exact: true }).click();
  await expect(page.getByLabel('消息历史')).toContainText('MOCK1001');
  await page.setViewportSize({ width: 390, height: 844 });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'mobile overflow');
  await context.clearCookies();
  await page.reload();
  await expect(page.locator('.form-error')).toContainText('客户登录已失效');
  await expect(page.getByRole('button', { name: '发送消息', exact: true })).toBeDisabled();
  assert.deepEqual(browserErrors, []);
  for (const entry of await readdir('.next/static', { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.js')) continue;
    const contents = await readFile(join(entry.parentPath, entry.name), 'utf8');
    for (const value of [token, password, env.WEB_CHAT_SESSION_SECRET, env.ADMIN_UI_SESSION_SECRET, 'INTERNAL_API_TOKENS', 'WEB_CHAT_SESSION_SECRET']) assert(!contents.includes(value), 'client bundle credential leakage');
  }
  console.log('PASS: real browser order query, reload/history, explicit refund selection, automatic approve/reject updates, failure draft/retry, mobile layout, expired session; HTTP identity isolation/CSRF/state guards; client bundle secret scan.');
} finally {
  await browser?.close();
  if (server && server.exitCode === null) { server.kill(); await new Promise(r => server.once('exit', r)); }
  await client.$disconnect();
  const within = relative(resolve(tmpdir()), resolve(directory));
  assert(within && !within.startsWith('..') && !isAbsolute(within));
  await rm(directory, { recursive: true, force: true });
}
