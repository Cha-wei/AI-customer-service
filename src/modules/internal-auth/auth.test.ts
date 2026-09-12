import { authenticate, assertCustomer, assertConversation, AccessError } from "./index";
import { ConversationNotFoundError } from "../conversations";

const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("../conversations/composition-root", () => ({ getConversationService: () => ({ get }) }));
const token = "test-customer-credential-not-for-production";
const operatorToken = "test-operator-credential-not-for-production";
const request = (value = `Bearer ${token}`) => new Request("http://localhost", { headers: { Authorization: value } });

describe("internal API credentials", () => {
  beforeEach(() => {
    get.mockReset();
    vi.stubEnv("INTERNAL_API_TOKENS", JSON.stringify([{ token, role: "customer", customerId: "customer-1" }, { token: operatorToken, role: "operator" }]));
  });
  afterEach(() => { vi.unstubAllEnvs(); });
  it("binds customer identity to credentials", () => {
    expect(authenticate(request())).toEqual({ role: "customer", customerId: "customer-1" });
    expect(() => assertCustomer(authenticate(request()), "customer-2")).toThrow(AccessError);
    expect(authenticate(request(`Bearer ${operatorToken}`))).toEqual({ role: "operator" });
  });
  it.each(["", "Basic test", "Bearer unknown", `Bearer ${token} extra`])("rejects invalid credentials", (header) => {
    expect(() => authenticate(request(header))).toThrow(AccessError);
  });
  it.each(["", "{}", "[]", "not json", '[{"token":"short","role":"operator"}]'])("fails closed for invalid configuration", (config) => {
    vi.stubEnv("INTERNAL_API_TOKENS", config);
    try { authenticate(request()); throw new Error("expected denial"); }
    catch (error) { expect(error).toMatchObject({ status: 503, code: "auth_unconfigured" }); }
  });
  it("allows only owned conversations and hides foreign IDs", async () => {
    const principal = authenticate(request());
    get.mockResolvedValue({ customerId: "customer-1" });
    await expect(assertConversation(principal, "own")).resolves.toBeUndefined();
    get.mockResolvedValue({ customerId: "customer-2" });
    await expect(assertConversation(principal, "other")).rejects.toBeInstanceOf(ConversationNotFoundError);
    get.mockRejectedValue(new ConversationNotFoundError("missing"));
    await expect(assertConversation(principal, "missing")).rejects.toBeInstanceOf(ConversationNotFoundError);
  });
});
