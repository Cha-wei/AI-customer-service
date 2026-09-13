import { isSameOrigin } from './origin';
afterEach(() => vi.unstubAllEnvs());
it('uses a configured HTTPS origin behind TLS termination and ignores spoofed forwarding', () => {
  vi.stubEnv('APP_ORIGIN', 'https://chat.example');
  expect(isSameOrigin(new Request('http://localhost:3000/api/chat', { headers: { origin: 'https://chat.example' } }))).toBe(true);
  expect(isSameOrigin(new Request('http://localhost:3000/api/chat', { headers: { origin: 'https://evil.example', 'x-forwarded-host': 'evil.example', 'x-forwarded-proto': 'https' } }))).toBe(false);
  vi.stubEnv('APP_ORIGIN', 'https://chat.example/');
  expect(isSameOrigin(new Request('http://localhost:3000/api/chat', { headers: { origin: 'https://chat.example' } }))).toBe(false);
});
it('uses the incoming host when Next normalizes the internal URL', () => {
  expect(isSameOrigin(new Request('http://localhost:3197/login', { headers: { host: '127.0.0.1:3197', origin: 'http://127.0.0.1:3197' } }))).toBe(true);
  expect(isSameOrigin(new Request('http://localhost:3197/login', { headers: { host: '127.0.0.1:3197', origin: 'https://foreign.example' } }))).toBe(false);
  expect(isSameOrigin(new Request('http://localhost/login'))).toBe(false);
});
