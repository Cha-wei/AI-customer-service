import assert from 'node:assert/strict';
import { randomBytes, createHash, createHmac, X509Certificate } from 'node:crypto';
import { mkdtemp, rm, readdir, readFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, relative, isAbsolute } from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:net';
import { createServer as createHttpsServer, request as httpsRequest } from 'node:https';
import { request as httpRequest } from 'node:http';
import { PrismaClient } from '@prisma/client';
import { chromium, expect } from '@playwright/test';

// Isolated production server, real browser interactions and real approval HTTP forms.
const directory = await mkdtemp(join(tmpdir(), 'web-chat-'));
const secret = () => randomBytes(32).toString('hex');
const token = secret();
const password = secret();
const customerPassword = secret();
const resetPassword = secret();
const env = { ...process.env, DATABASE_URL: `file:${join(directory, 'test.db').replaceAll('\\', '/')}`,
  WEB_CHAT_SESSION_SECRET: secret(), ADMIN_UI_SESSION_SECRET: secret(), ADMIN_UI_PASSWORD: password,
  INTERNAL_API_TOKENS: JSON.stringify([{ token, role: 'operator' }]), INTENT_PROVIDER: 'rule',
  OPENAI_API_KEY: '', DEEPSEEK_API_KEY: '', NODE_ENV: 'production' };
const client = new PrismaClient({ datasourceUrl: env.DATABASE_URL });
let server, browser, proxy;
const useHttps = process.argv.includes('--https');
try {
  await client.$executeRawUnsafe('PRAGMA user_version = 0');
  execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], { env, stdio: 'pipe', windowsHide: true });
  for (const [name, customerId] of [['alice', 'customer-1'], ['bob', 'customer-2']]) {
    execFileSync(process.execPath, ['scripts/customer-account.mjs', 'create', name, customerId], { env: { ...env, CUSTOMER_ACCOUNT_PASSWORD: customerPassword }, stdio: 'pipe', windowsHide: true });
  }
  const probe = createServer();
  await new Promise(r => probe.listen(0, '127.0.0.1', r));
  const port = probe.address().port;
  await new Promise(r => probe.close(r));
  let origin = `http://localhost:${port}`;
  let certificate, spki;
  if (useHttps) {
    // Ephemeral loopback certificate, never added to the machine trust store.
    execFileSync('pwsh', ['-NoProfile', '-File', 'scripts/create-test-certificate.ps1', directory], { stdio: 'pipe', windowsHide: true });
    certificate = await readFile(join(directory, 'cert.pem'), 'utf8');
    const key = await readFile(join(directory, 'key.pem'), 'utf8');
    spki = createHash('sha256').update(new X509Certificate(certificate).publicKey.export({ type: 'spki', format: 'der' })).digest('base64');
    proxy = createHttpsServer({ key, cert: certificate }, (req, res) => {
      const upstream = httpRequest({ hostname: '127.0.0.1', port, path: req.url, method: req.method, headers: req.headers }, incoming => {
        res.writeHead(incoming.statusCode, incoming.headers);
        incoming.pipe(res);
      });
      upstream.on('error', () => { res.writeHead(502); res.end(); });
      req.pipe(upstream);
    });
    await new Promise(r => proxy.listen(0, '127.0.0.1', r));
    origin = `https://localhost:${proxy.address().port}`;
    env.APP_ORIGIN = origin;
  }
  server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-H', '127.0.0.1', '-p', String(port)], { env, stdio: 'ignore', windowsHide: true });
  const request = (path, options = {}) => useHttps ? new Promise((resolve, reject) => {
    const req = httpsRequest(origin + path, { method: options.method ?? 'GET', headers: { ...(options.body instanceof URLSearchParams ? { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' } : {}), ...options.headers }, ca: certificate, signal: AbortSignal.timeout(10000) }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const headers = new Headers();
        for (let i = 0; i < res.rawHeaders.length; i += 2) headers.append(res.rawHeaders[i], res.rawHeaders[i + 1]);
        resolve(new Response(Buffer.concat(chunks), { status: res.statusCode, headers }));
      });
      res.on('error', reject);
    });
    req.on('error', reject);
    if (options.body) req.write(String(options.body));
    req.end();
  }) : fetch(origin + path, { redirect: 'manual', signal: AbortSignal.timeout(10000), ...options });
  let ready = false;
  for (let i = 0; i < 60; i++) {
    if (server.exitCode !== null) throw new Error('server exited');
    try { ready = (await request('/api/health')).ok; } catch {}
    if (ready) break;
    await new Promise(r => setTimeout(r, 500));
  }
  assert(ready, 'server startup');
  browser = await chromium.launch({ ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}), headless: true, ...(spki ? { args: [`--ignore-certificate-errors-spki-list=${spki}`] } : {}) });
  const context = await browser.newContext();
  const page = await context.newPage();
  const browserErrors = [];
  context.on('page', tab => tab.on('pageerror', error => browserErrors.push(error.message)));
  page.on('pageerror', error => browserErrors.push(error.message));
  context.on('request', req => {
    assert(!req.headers().authorization, 'browser must not send internal credentials');
    assert(!req.url().includes('/api/internal/'), 'browser must use the customer boundary');
  });
  const loginAs = async (tab, loginName, activePassword = customerPassword) => {
    await tab.goto(origin + '/chat/login');
    await tab.getByLabel('账号', { exact: true }).fill(loginName);
    await tab.getByLabel('密码', { exact: true }).fill(activePassword);
    await tab.getByRole('button', { name: '登录', exact: true }).click();
    await expect(tab).toHaveURL(origin + '/chat');
    const session = (await tab.context().cookies()).find(c => c.name === 'customer_session');
    assert(session.httpOnly && session.secure && session.sameSite === 'Strict');
    return `customer_session=${session.value}`;
  };
  // Both customers authenticate through the visible form; no cookie injection.
  const otherContext = await browser.newContext();
  const otherPage = await otherContext.newPage();
  const otherCookie = await loginAs(otherPage, 'bob');
  let cookie = await loginAs(page, 'alice');
  const customerApproval = await request('/api/admin/conversations/foreign/approvals', { method: 'POST', headers: { origin, cookie }, body: new URLSearchParams({ approvalId: 'foreign', decision: 'approve' }) });
  assert.equal(customerApproval.status, 307);
  assert(customerApproval.headers.get('location').endsWith('/login'));
  const expiredData = JSON.parse(Buffer.from(cookie.split('=')[1].split('.')[0], 'base64url').toString());
  expiredData.expires = Date.now() - 1000;
  const expiredPayload = Buffer.from(JSON.stringify(expiredData)).toString('base64url');
  const expiredCookie = `customer_session=${expiredPayload}.${createHmac('sha256', env.WEB_CHAT_SESSION_SECRET).update(expiredPayload).digest('base64url')}`;
  assert.equal((await request('/api/chat', { headers: { cookie: expiredCookie } })).status, 401, 'expired authenticated session rejected');
  assert.equal((await request('/api/chat')).status, 401);
  assert.equal((await request('/api/chat', { headers: { cookie: cookie + 'x' } })).status, 401);
  assert.equal((await request('/api/internal/web-chat/session', { method: 'POST' })).status, 401);
  const post = (body, activeCookie = cookie, activeOrigin = origin) => request('/api/chat', { method: 'POST', headers: { cookie: activeCookie, origin: activeOrigin, 'x-chat-account': createHash('sha256').update(activeCookie === otherCookie ? 'customer-2' : 'customer-1').digest('hex'), 'content-type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal((await post({ content: '订单', customerId: 'customer-2' })).status, 400);
  assert.equal((await post({ content: '订单', role: 'agent' })).status, 400);
  assert.equal((await post({ content: '退款' })).status, 400);
  assert.equal((await post({ content: '退款', orderId: 'order-1001' }, otherCookie)).status, 400);
  assert.equal((await post({ content: '订单' }, cookie, 'https://evil.example')).status, 403);
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
  const staffContext = await browser.newContext();
  const staff = await staffContext.newPage();
  staff.on('pageerror', error => browserErrors.push(error.message));
  await staff.goto(origin + '/login');
  await staff.getByLabel('管理密码').fill(password);
  await staff.getByRole('button', { name: '登录', exact: true }).click();
  await expect(staff).toHaveURL(origin + '/');
  await staff.getByRole('searchbox').fill('陈雨');
  await staff.getByRole('button', { name: '搜索会话', exact: true }).click();
  await expect(staff.locator('.conversation-row')).toHaveCount(1);
  await expect(staff.locator('.conversation-row')).toContainText('陈雨');
  await staff.getByRole('searchbox').fill('不存在的会话关键词');
  await staff.getByRole('button', { name: '搜索会话', exact: true }).click();
  await expect(staff.getByText('没有匹配的会话')).toBeVisible();
  await staff.getByRole('link', { name: '清除', exact: true }).click();
  await expect(staff.getByRole('searchbox')).toHaveValue('');
  await staff.locator('.conversation-row').first().click();
  await expect(staff.locator('.ai-activity')).toContainText('查询订单');
  await mkdir('.next/acceptance', { recursive: true });
  await staff.setViewportSize({ width: 1440, height: 900 });
  await staff.screenshot({ path: '.next/acceptance/workspace-v2-order.png', animations: 'disabled', fullPage: true });


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
    if (decision === 'reject') await staff.goto(`${origin}/conversations/${approval.conversationId}`);
    // The first approval appears on the already-open workspace without navigation.
    await staff.bringToFront();
    await expect(staff.locator('.context-next-action')).toContainText('核对对话底部的退款申请', { timeout: 15000 });
    await expect(staff.locator('.ai-activity').filter({ hasText: '提交退款审批' })).toHaveCount(1);
    await staff.getByRole('button', { name: decision === 'approve' ? '批准退款' : '拒绝退款', exact: true }).click();
    await expect(staff.getByRole('button', { name: '批准退款', exact: true })).toHaveCount(0);
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
  // Human handoff: customer request, staff browser reply, customer follow-up, close.
  await page.getByRole('button', { name: '新建会话' }).click();
  await page.getByLabel('消息', { exact: true }).fill('请转人工客服');
  await page.getByRole('button', { name: '发送消息', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('等待人工客服回复');
  const handoff = await client.conversation.findFirstOrThrow({ where: { customerId: 'customer-1', status: 'human_handoff' }, orderBy: { updatedAt: 'desc' } });
  const executionCount = await client.runtimeExecution.count({ where: { conversationId: handoff.id } });
  // Populate a long history to verify actual viewport visibility, not just DOM text.
  await client.message.createMany({ data: Array.from({ length: 14 }, (_, i) => ({ conversationId: handoff.id, role: 'system', content: i === 13 ? "长文本校验：" + "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".repeat(40) : `演示历史 ${i + 1}：这是用于检查滚动位置的历史消息。`, createdAt: new Date(handoff.createdAt.getTime() - 15000 + i * 100) })) });
  await page.reload();
  await page.locator('.chat-conversation').first().click();
  await expect(page.getByRole('status')).toContainText('等待人工客服回复');
  const atBottom = locator => locator.evaluate(element => element.scrollHeight - element.scrollTop - element.clientHeight < 8);
  await expect.poll(() => atBottom(page.getByLabel('消息历史'))).toBe(true);
  await staff.goto(origin + '/');
  await staff.getByRole('navigation', { name: '会话状态筛选' }).getByRole('link', { name: '人工接管', exact: true }).click();
  await staff.locator(`a[href^="/conversations/${handoff.id}"]`).click();
  await expect(staff.getByLabel('人工回复', { exact: true })).toBeEnabled();
  const beforeReply = await client.message.findFirstOrThrow({ where: { conversationId: handoff.id }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
  await staff.getByLabel('人工回复', { exact: true }).fill('您好，人工客服已接手，请说明问题。');
  await staff.route(`**/api/admin/conversations/${handoff.id}/messages`, route => route.request().method() === 'POST' ? route.abort() : route.continue());
  await staff.getByRole('button', { name: '发送人工回复' }).click();
  await expect(staff.locator('.form-error')).toBeVisible();
  await expect(staff.getByLabel('人工回复', { exact: true })).toHaveValue('您好，人工客服已接手，请说明问题。');
  await staff.unroute(`**/api/admin/conversations/${handoff.id}/messages`);
  await staff.getByRole('button', { name: '发送人工回复' }).click();
  await expect(page.getByLabel('消息历史')).toContainText('人工客服已接手');
  await expect.poll(() => atBottom(page.getByLabel('消息历史'))).toBe(true);
  const humanPost = (activeCookie, activeOrigin = origin) => request(`/api/admin/conversations/${handoff.id}/messages`, { method: 'POST', headers: { cookie: activeCookie, origin: activeOrigin, 'content-type': 'application/json' }, body: JSON.stringify({ content: 'duplicate', lastMessageId: beforeReply.id }) });
  assert.equal((await humanPost(adminCookie)).status, 409, 'repeated reply denied');
  assert.equal((await humanPost(cookie)).status, 307, 'customer cannot send staff reply');
  assert.equal((await humanPost(adminCookie, 'https://evil.example')).status, 403);
  assert.equal((await post({ conversationId: handoff.id, content: 'foreign reply' }, otherCookie)).status, 404);
  await page.getByLabel('消息', { exact: true }).fill('退款原因是包装损坏，请人工确认。');
  await expect(page.getByLabel('请选择退款订单（必选）')).toHaveCount(0);
  await page.getByRole('button', { name: '发送消息', exact: true }).click();
  await expect(staff.locator('.message-list')).toContainText('退款原因是包装损坏');
  await expect.poll(() => atBottom(staff.locator('.message-list'))).toBe(true);
  assert.equal((await post({ conversationId: handoff.id, content: '重复留言' })).status, 409);
  assert.equal(await client.runtimeExecution.count({ where: { conversationId: handoff.id } }), executionCount, 'no AI in human mode');
  assert.equal(await client.approval.count({ where: { conversationId: handoff.id } }), 0, 'human text creates no refund approval');
  // Reading old history must not be interrupted by an incoming reply.
  await page.getByLabel('消息历史').evaluate(element => { element.scrollTop = 0; element.dispatchEvent(new Event('scroll')); });
  await staff.getByLabel('人工回复', { exact: true }).fill('已记录您的问题，本次咨询处理完成。');
  await staff.getByRole('button', { name: '发送人工回复' }).click();
  await expect(page.getByLabel('消息历史')).toContainText('本次咨询处理完成');
  assert.equal(await page.getByLabel('消息历史').evaluate(element => element.scrollTop), 0, 'reading position retained');
  await page.getByRole('button', { name: '查看最新消息', exact: true }).click();
  await expect.poll(() => atBottom(page.getByLabel('消息历史'))).toBe(true);

  // Workspace v2: every collapse combination must release space to the conversation.
  await mkdir('.next/acceptance', { recursive: true });
  const uiConsoleErrors = [];
  const collectUiConsole = message => { if (message.type() === 'error') uiConsoleErrors.push(message.text()); };
  staff.on('console', collectUiConsole);
  const panelNames = ['功能导航', '会话列表', '上下文面板'];
  for (const width of [1440, 1280, 1024]) {
    await staff.setViewportSize({ width, height: 900 });
    const centerWidths = [];
    for (let mask = 0; mask < 8; mask++) {
      for (let bit = 0; bit < 3; bit++) {
        const closed = Boolean(mask & (1 << bit));
        const action = closed ? '收起' : '展开';
        const toggle = staff.getByRole('button', { name: action + panelNames[bit], exact: true });
        if (await toggle.count()) await toggle.click();
      }
      const center = await staff.getByRole('region', { name: '当前会话', exact: true }).boundingBox();
      assert(center && center.width >= 300, 'central workspace minimum width');
      centerWidths[mask] = center.width;
      assert(await staff.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'workspace page overflow');
      assert(await staff.locator('.message-list').evaluate(el => el.scrollWidth <= el.clientWidth + 1), 'message content overflow');
      const composer = await staff.getByLabel('人工回复', { exact: true }).boundingBox();
      assert(composer && composer.y + composer.height <= 900, 'composer visible');
      await expect(staff.getByLabel('人工回复', { exact: true })).toBeEnabled();
      if (mask === 0 || mask === 7) await staff.screenshot({ path: '.next/acceptance/workspace-v2-' + width + '-' + mask + '.png', animations: 'disabled', fullPage: true });
    }
    for (let mask = 0; mask < 8; mask++) for (let bit = 0; bit < 3; bit++) {
      if (mask & (1 << bit)) assert(centerWidths[mask] > centerWidths[mask ^ (1 << bit)], 'each collapsed panel must expand the center');
    }
    await staff.reload();
    for (const name of panelNames) await expect(staff.getByRole('button', { name: '展开' + name, exact: true })).toBeVisible();
  }
  // Restore a useful review layout; a long unbroken draft must not cause overflow.
  await staff.setViewportSize({ width: 1440, height: 900 });
  for (const name of panelNames) await staff.getByRole('button', { name: '展开' + name, exact: true }).click();
  await staff.getByLabel('人工回复', { exact: true }).fill('长文本'.repeat(800));
  assert(await staff.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'long draft overflow');
  staff.off('console', collectUiConsole);
  assert.deepEqual(uiConsoleErrors, [], 'workspace console errors');
  await staff.getByRole('button', { name: '您好，我来为您处理。', exact: true }).click();
  await expect(staff.getByLabel('人工回复', { exact: true })).toHaveValue('您好，我来为您处理。');
  await staff.getByLabel('人工回复', { exact: true }).fill('');
  await staff.getByRole('button', { name: '标记已解决' }).click();
  await expect(page.getByRole('status')).toContainText('会话已解决');
  await expect(page.getByLabel('消息', { exact: true })).toBeDisabled();
  assert.equal((await post({ conversationId: handoff.id, content: 'late customer reply' })).status, 409);
  assert.equal((await humanPost(adminCookie)).status, 409);
  await mkdir('.next/acceptance', { recursive: true });
  await page.screenshot({ path: '.next/acceptance/customer.png', fullPage: true });
  await staff.screenshot({ path: '.next/acceptance/admin.png', fullPage: true });
  await staffContext.close();
  await page.setViewportSize({ width: 390, height: 844 });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'mobile overflow');
  // A second tab logs in as another customer while the first retains an old draft.
  await page.getByRole('button', { name: '新建会话' }).click();
  await page.getByLabel('消息', { exact: true }).fill('private previous account draft');
  const switchTab = await context.newPage();
  await loginAs(switchTab, 'bob');
  assert.equal((await request('/api/chat', { headers: { cookie } })).status, 401, 'account switch revokes old cookie');
  await expect(page.locator('.form-error')).toContainText('账号已切换', { timeout: 10000 });
  await expect(page.getByLabel('消息', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('消息历史')).not.toContainText('MOCK1001');
  await expect(page.getByRole('button', { name: '发送消息', exact: true })).toBeDisabled();
  await switchTab.close();
  cookie = await loginAs(page, 'alice');
  await expect(page.getByRole('button', { name: '查询订单', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '退出登录', exact: true }).click();
  await expect(page).toHaveURL(origin + '/chat/login');
  assert.equal((await request('/api/chat', { headers: { cookie } })).status, 401, 'revoked cookie replay');
  execFileSync(process.execPath, ['scripts/customer-account.mjs', 'disable', 'bob'], { env, stdio: 'pipe', windowsHide: true });
  assert.equal((await request('/api/chat', { headers: { cookie: otherCookie } })).status, 401, 'disabled account loses existing session');
  const invalidLogin = body => request('/api/chat/session', { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const disabled = await invalidLogin({ loginName: 'bob', password: customerPassword });
  const unknown = await invalidLogin({ loginName: 'unknown', password: customerPassword });
  assert.equal(disabled.status, 401);
  assert.equal(await disabled.text(), await unknown.text(), 'no account enumeration');
  for (let i = 0; i < 4; i++) assert.equal((await invalidLogin({ loginName: 'unknown', password: 'wrong' })).status, 401);
  assert.equal((await invalidLogin({ loginName: 'unknown', password: 'wrong' })).status, 429);
  execFileSync(process.execPath, ['scripts/customer-account.mjs', 'enable', 'bob'], { env, stdio: 'pipe', windowsHide: true });
  assert.equal((await request('/api/chat', { headers: { cookie: otherCookie } })).status, 401, 'reenabling never revives old sessions');
  const beforeReset = await loginAs(otherPage, 'bob');
  execFileSync(process.execPath, ['scripts/customer-account.mjs', 'reset-password', 'bob'], { env: { ...env, CUSTOMER_ACCOUNT_PASSWORD: resetPassword }, stdio: 'pipe', windowsHide: true });
  assert.equal((await request('/api/chat', { headers: { cookie: beforeReset } })).status, 401, 'password reset revokes sessions');
  assert.equal((await invalidLogin({ loginName: 'bob', password: customerPassword })).status, 401, 'old password rejected');
  await loginAs(otherPage, 'bob', resetPassword);
  await page.goto(origin + '/chat');
  await expect(page.locator('.form-error')).toContainText('客户登录已失效');
  await expect(page.getByRole('link', { name: '重新登录', exact: true })).toBeVisible();
  assert.deepEqual(browserErrors, []);
  for (const entry of await readdir('.next/static', { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.js')) continue;
    const contents = await readFile(join(entry.parentPath, entry.name), 'utf8');
    for (const value of [token, password, customerPassword, resetPassword, env.WEB_CHAT_SESSION_SECRET, env.ADMIN_UI_SESSION_SECRET, 'INTERNAL_API_TOKENS', 'WEB_CHAT_SESSION_SECRET']) assert(!contents.includes(value), 'client bundle credential leakage');
  }
  console.log(`${useHttps ? 'HTTPS loopback TLS proxy' : 'HTTP loopback'}; ` + 'PASS: real customer login, account switch, disable/enable, throttle, logout replay; human handoff/staff reply/customer follow-up/close with no AI execution; real browser order query, reload/history, explicit refund selection, automatic approve/reject updates, failure draft/retry, mobile layout, expired session; HTTP identity isolation/CSRF/state guards; client bundle secret scan.');
} finally {
  await browser?.close();
  if (server && server.exitCode === null) { server.kill(); await new Promise(r => server.once('exit', r)); }
  if (proxy) await new Promise(r => proxy.close(r));
  await client.$disconnect();
  const within = relative(resolve(tmpdir()), resolve(directory));
  assert(within && !within.startsWith('..') && !isAbsolute(within));
  await rm(directory, { recursive: true, force: true });
}
