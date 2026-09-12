import { OpenAIIntentProvider } from "./openai-intent-provider";
import { DeepSeekIntentProvider } from "./deepseek-intent-provider";
import { RuleIntentProvider, type IntentProvider } from "./runtime";

export function createIntentProvider(env: Record<string, string | undefined> = process.env): IntentProvider {
  const mode = env.INTENT_PROVIDER ?? "rule";
  if (mode === "rule") return new RuleIntentProvider();
  if (mode === "deepseek") return new DeepSeekIntentProvider({
    apiKey: env.DEEPSEEK_API_KEY ?? "",
    model: env.DEEPSEEK_MODEL ?? "",
    baseUrl: env.DEEPSEEK_BASE_URL,
    timeoutMs: env.DEEPSEEK_TIMEOUT_MS === undefined ? undefined : Number(env.DEEPSEEK_TIMEOUT_MS),
  });
  if (mode !== "openai") throw new Error("INTENT_PROVIDER must be rule, openai or deepseek.");
  return new OpenAIIntentProvider({
    apiKey: env.OPENAI_API_KEY ?? "",
    model: env.OPENAI_MODEL ?? "",
    timeoutMs: env.OPENAI_TIMEOUT_MS === undefined ? undefined : Number(env.OPENAI_TIMEOUT_MS),
  });
}
