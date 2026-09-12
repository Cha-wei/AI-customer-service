// @vitest-environment node
import { loadEnvFile } from "node:process";
import { DeepSeekIntentProvider } from "./deepseek-intent-provider";

// Opt-in only: uses local credentials and sends one synthetic question to DeepSeek.
describe.skipIf(process.env.RUN_DEEPSEEK_LIVE !== "1")("DeepSeek live smoke test", () => {
  it("classifies a synthetic order query", async () => {
    loadEnvFile();
    const provider = new DeepSeekIntentProvider({
      apiKey: process.env.DEEPSEEK_API_KEY ?? "",
      model: process.env.DEEPSEEK_MODEL ?? "",
      baseUrl: process.env.DEEPSEEK_BASE_URL,
      timeoutMs: 30_000,
    });
    await expect(provider.classify("请帮我查询我的订单物流状态。")).resolves.toBe("order_query");
  }, 35_000);
});
