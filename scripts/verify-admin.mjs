import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';

// Production HTTP acceptance with disposable credentials and an isolated database.
const directory = await mkdtemp(join(tmpdir(), 'workbench-admin-'));
const password = randomBytes(24).toString('hex');
const token = randomBytes(32).toString('hex');
const port = 3197;
const origin = `http://127.0.0.1:${port}`;
const env = { ...process.env, DATABASE_URL: `file:${join(directory, 'acceptance.db').replaceAll('\\', '/')}`,
  ADMIN_UI_PASSWORD: password, ADMIN_UI_SESSION_SECRET: randomBytes(32).toString('hex'),
  INTERNAL_API_TOKENS: JSON.stringify([{ token, role: 'operator' }]), INTENT_PROVIDER: 'rule',
  OPENAI_API_KEY: '', DEEPSEEK_API_KEY: '', NODE_ENV: 'production' };
let server;
try {
  const client = new PrismaClient({ datasources: { db: { url: env.DATABASE_URL } } });
  try { await client.$executeRawUnsafe('PRAGMA user_version = 0'); }
  finally { await client.$disconnect(); }
  const migration = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], { env, stdio: 'pipe' });
  if (migration.status !== 0) console.error(String(migration.stderr).replaceAll(password, '[hidden]').replaceAll(token, '[hidden]').replaceAll(env.ADMIN_UI_SESSION_SECRET, '[hidden]'));
  assert.equal(migration.status, 0, 'isolated migrations failed');
  server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-H', '127.0.0.1', '-p', String(port)], { env, stdio: 'ignore', windowsHide: true });
  let ready = false;
  for (let i = 0; i < 60; i++) {
    if (server.exitCode !== null) throw new Error('Acceptance server exited');
    try { ready = (await fetch(`${origin}/api/health`)).ok; } catch {}
    if (ready) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  assert(ready, 'server readiness timeout');
  const request = (path, options = {}) => fetch(origin + path, { redirect: 'manual', signal: AbortSignal.timeout(10_000), ...options });
  const anonymous = await request('/');
  const anonymousHtml = await anonymous.text();
  assert(anonymous.status === 307 || (anonymousHtml.includes('/login') && !anonymousHtml.includes('customer-1')));
  const login = await request('/api/admin/session', { method: 'POST', headers: { origin }, body: new URLSearchParams({ password }) });
  assert.equal(login.status, 303, 'login failed');
  assert.equal(login.headers.get('location'), origin + '/');
  const setCookie = login.headers.get('set-cookie');
  assert(setCookie.includes('HttpOnly') && setCookie.includes('Secure'));
  const cookie = setCookie.split(';')[0];
  assert((await (await request('/', { headers: { cookie } })).text()).includes('暂无会话'));
  const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
  const created = await request('/api/internal/conversations', { method: 'POST', headers, body: JSON.stringify({ customerId: 'customer-1', initialMessage: '我的订单什么时候到？' }) });
  assert.equal(created.status, 201);
  const id = (await created.json()).data.id;
  assert.equal((await request(`/api/internal/conversations/${id}/run`, { method: 'POST', headers })).status, 200);
  const detail = await (await request(`/conversations/${id}`, { headers: { cookie } })).text();
  assert(detail.includes('MOCK1001') && detail.includes('标记已解决'));
  for (const secret of [password, token, env.ADMIN_UI_SESSION_SECRET]) assert(!detail.includes(secret));
  const path = `/api/admin/conversations/${id}/status`;
  assert.equal((await request(path, { method: 'POST', headers: { cookie, origin: 'https://foreign.example' } })).status, 403);
  assert.equal((await request(path, { method: 'POST', headers: { cookie, origin }, body: new URLSearchParams({ status: 'resolved' }) })).status, 303);
  const updated = (await (await request(`/api/internal/conversations/${id}`, { headers })).json()).data;
  assert.equal(updated.status, 'resolved');
  assert(updated.messages.some((m) => m.role === 'system'));
  const logout = await request('/api/admin/logout', { method: 'POST', headers: { cookie, origin } });
  assert.equal(logout.status, 303);
  assert(logout.headers.get('set-cookie').includes('1970'));
  const signedOut = await request('/');
  const signedOutHtml = await signedOut.text();
  assert(signedOut.status === 307 || (signedOutHtml.includes('/login') && !signedOutHtml.includes('customer-1')));
  for (let i = 0; i < 6; i++) {
    const denied = await request('/api/admin/session', { method: 'POST', headers: { origin }, body: new URLSearchParams({ password: 'invalid' }) });
    assert.equal(denied.status, i === 5 ? 429 : 303);
  }
  console.log('PASS: production login, cookies, page protection, mock orders, status update, logout, throttling; no credentials rendered.');
} finally {
  if (server && server.exitCode === null) {
    server.kill();
    await new Promise((r) => server.once('exit', r));
  }
  assert(resolve(directory).startsWith(resolve(tmpdir()) + '\\') || resolve(directory).startsWith(resolve(tmpdir()) + '/'));
  await rm(directory, { recursive: true, force: true });
}
