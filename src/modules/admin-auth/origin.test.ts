import { isSameOrigin } from './origin';
it('uses the incoming host when Next normalizes the internal URL', () => {
  expect(isSameOrigin(new Request('http://localhost:3197/login', { headers: { host: '127.0.0.1:3197', origin: 'http://127.0.0.1:3197' } }))).toBe(true);
  expect(isSameOrigin(new Request('http://localhost:3197/login', { headers: { host: '127.0.0.1:3197', origin: 'https://foreign.example' } }))).toBe(false);
  expect(isSameOrigin(new Request('http://localhost/login'))).toBe(false);
});
