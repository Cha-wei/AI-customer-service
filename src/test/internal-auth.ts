export const testToken = "test-operator-token-not-for-production";
export const authHeaders = { Authorization: `Bearer ${testToken}` };
export function configureTestAuth() {
  beforeEach(() => { vi.stubEnv("INTERNAL_API_TOKENS", JSON.stringify([{ role: "operator", token: testToken }])); });
  afterEach(() => { vi.unstubAllEnvs(); });
}
