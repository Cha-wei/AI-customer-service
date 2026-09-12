import { createIntentProvider } from "./intent-composition";
import { OpenAIIntentProvider } from "./openai-intent-provider";

function output(text = '{"intent":"order_query"}') {
  return { status: "completed", output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text }] }] };
}

function setup(data: unknown = output(), status = 200) {
  const request = vi.fn<typeof fetch>(async () => new Response(JSON.stringify(data), { status }));
  const provider = new OpenAIIntentProvider({ apiKey: "test-only", model: "test-model", timeoutMs: 100 }, request);
  return { request, provider };
}

describe("OpenAI intent adapter", () => {
  afterEach(() => { vi.useRealTimers(); });

  it("uses structured output without forwarding customer context", async () => {
    const { provider, request } = setup();
    await expect(provider.classify("我的包裹到哪里了？")).resolves.toBe("order_query");
    const [url, options] = request.mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/responses");
    const body = JSON.parse(options!.body as string);
    expect(body.store).toBe(false);
    expect(body.text.format).toMatchObject({ type: "json_schema", strict: true });
    expect(body.input).toEqual([{ role: "user", content: "我的包裹到哪里了？" }]);
    expect(body).not.toHaveProperty("tools");
    expect(body).not.toHaveProperty("customer_id");
  });

  it("accepts model handoff", async () => {
    await expect(setup(output('{"intent":"handoff"}')).provider.classify("Hello")).resolves.toBe("handoff");
  });

  it.each(["人工查订单", "帮我退款", "cancel my order"])("bypasses the model for %s", async (message) => {
    const { provider, request } = setup();
    expect(await provider.classify(message)).toBe("handoff");
    expect(request).not.toHaveBeenCalled();
  });

  it.each([
    output("not json"), output('{"intent":"refund"}'), output('{"intent":"order_query","customer_id":"other"}'),
    { ...output(), status: "incomplete" }, { status: "completed", output: [] }, null,
  ])("rejects malformed, incomplete, or unsupported output", async (data) => {
    await expect(setup(data).provider.classify("where is my order")).rejects.toMatchObject({ code: "MODEL_INVALID_OUTPUT" });
  });

  it("handles refusal content", async () => {
    const data = { status: "completed", output: [{ type: "message", role: "assistant", content: [{ type: "refusal", refusal: "No" }] }] };
    await expect(setup(data).provider.classify("question")).rejects.toMatchObject({ code: "MODEL_REFUSED" });
  });

  it.each([401, 429, 500])("sanitizes HTTP %s without retrying", async (status) => {
    const { provider, request } = setup({ detail: "private upstream details" }, status);
    await expect(provider.classify("question")).rejects.toMatchObject({ code: "MODEL_UNAVAILABLE", message: "Intent classification failed." });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("bounds a stalled response and aborts the request", async () => {
    vi.useFakeTimers();
    const { provider, request } = setup();
    request.mockImplementation(async () => new Promise<Response>(() => {}));
    const result = expect(provider.classify("question")).rejects.toMatchObject({ code: "MODEL_TIMEOUT" });
    await vi.advanceTimersByTimeAsync(100);
    await result;
    expect(request.mock.calls[0][1]?.signal?.aborted).toBe(true);
  });

  it("bounds reading the response body too", async () => {
    vi.useFakeTimers();
    const { provider, request } = setup();
    const response = new Response("{}");
    vi.spyOn(response, "json").mockImplementation(() => new Promise(() => {}));
    request.mockResolvedValue(response);
    const result = expect(provider.classify("question")).rejects.toMatchObject({ code: "MODEL_TIMEOUT" });
    await vi.advanceTimersByTimeAsync(100);
    await result;
  });

  it("sanitizes network errors", async () => {
    const { provider, request } = setup();
    request.mockRejectedValue(new Error("private upstream details"));
    await expect(provider.classify("question")).rejects.toMatchObject({ code: "MODEL_UNAVAILABLE", message: "Intent classification failed." });
  });
});

describe("intent configuration", () => {
  it("defaults to offline rules without a key", async () => {
    expect(await createIntentProvider({}).classify("查订单")).toBe("order_query");
  });
  it.each([
    { INTENT_PROVIDER: "typo" }, { INTENT_PROVIDER: "openai" },
    { INTENT_PROVIDER: "openai", OPENAI_API_KEY: "test-only" },
    { INTENT_PROVIDER: "openai", OPENAI_API_KEY: "test-only", OPENAI_MODEL: "test-model", OPENAI_TIMEOUT_MS: "NaN" },
  ])("fails closed on invalid configuration", (env) => {
    expect(() => createIntentProvider(env)).toThrow();
  });
});
