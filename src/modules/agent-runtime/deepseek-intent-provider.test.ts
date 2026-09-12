import { DeepSeekIntentProvider } from "./deepseek-intent-provider";
import { createIntentProvider } from "./intent-composition";

function output(content = '{"intent":"order_query"}', finish_reason = "stop") {
  return { choices: [{ finish_reason, message: { role: "assistant", content } }] };
}
function setup(data: unknown = output(), status = 200) {
  const request = vi.fn<typeof fetch>(async () => new Response(JSON.stringify(data), { status }));
  const provider = new DeepSeekIntentProvider({ apiKey: "test-only", model: "test-model", timeoutMs: 100 }, request);
  return { provider, request };
}

describe("DeepSeek intent adapter", () => {
  afterEach(() => { vi.useRealTimers(); });
  it("sends JSON mode chat completions to DeepSeek with thinking disabled", async () => {
    const { provider, request } = setup();
    expect(await provider.classify("我的包裹在哪里？")).toBe("order_query");
    const [url, options] = request.mock.calls[0];
    expect(url).toBe("https://api.deepseek.com/chat/completions");
    const body = JSON.parse(options!.body as string);
    expect(body).toMatchObject({ response_format: { type: "json_object" }, thinking: { type: "disabled" }, stream: false });
    expect(body.messages[1]).toEqual({ role: "user", content: "我的包裹在哪里？" });
    expect(body).not.toHaveProperty("tools");
  });
  it("accepts a handoff decision", async () => {
    expect(await setup(output('{"intent":"handoff"}')).provider.classify("Hello")).toBe("handoff");
  });
  it("keeps explicit human requests offline", async () => {
    const { provider, request } = setup();
    expect(await provider.classify("人工查订单")).toBe("handoff");
    expect(request).not.toHaveBeenCalled();
  });
  it.each([null, { choices: [] }, output(""), output("not JSON"), output('{"intent":"refund"}'), output('{"intent":"order_query","customer_id":"other"}'), output('{"intent":"order_query"}', "length")])("rejects invalid or truncated output", async (data) => {
    await expect(setup(data).provider.classify("查订单")).rejects.toMatchObject({ code: "MODEL_INVALID_OUTPUT" });
  });
  it("maps content filtering to refusal", async () => {
    await expect(setup(output("", "content_filter")).provider.classify("问题")).rejects.toMatchObject({ code: "MODEL_REFUSED" });
  });
  it.each([401, 429, 500])("sanitizes HTTP %s without retrying", async (status) => {
    const { provider, request } = setup({ detail: "private details" }, status);
    await expect(provider.classify("问题")).rejects.toMatchObject({ code: "MODEL_UNAVAILABLE", message: "Intent classification failed." });
    expect(request).toHaveBeenCalledTimes(1);
  });
  it.each([false, true])("times out stalled requests and bodies (body=%s)", async (body) => {
    vi.useFakeTimers();
    const { provider, request } = setup();
    if (body) {
      const response = new Response("{}");
      vi.spyOn(response, "json").mockImplementation(() => new Promise(() => {}));
      request.mockResolvedValue(response);
    } else request.mockImplementation(() => new Promise(() => {}));
    const result = expect(provider.classify("问题")).rejects.toMatchObject({ code: "MODEL_TIMEOUT" });
    await vi.advanceTimersByTimeAsync(100);
    await result;
    expect(request.mock.calls[0][1]?.signal?.aborted).toBe(true);
  });
  it("supports the configured DeepSeek mode", () => {
    expect(createIntentProvider({ INTENT_PROVIDER: "deepseek", DEEPSEEK_API_KEY: "test-only", DEEPSEEK_MODEL: "test-model" })).toBeInstanceOf(DeepSeekIntentProvider);
  });
  it.each([
    { apiKey: "", model: "test-model" },
    { apiKey: "test-only", model: "" },
    { apiKey: "test-only", model: "test-model", timeoutMs: 0 },
    { apiKey: "test-only", model: "test-model", baseUrl: "https://example.com" },
  ])("rejects invalid configuration before transmission", (options) => {
    expect(() => new DeepSeekIntentProvider(options)).toThrow();
  });
});
