import { OpenAIIntentProvider } from "./openai-intent-provider";
import { RuleIntentProvider, type IntentProvider } from "./runtime";

export function createIntentProvider(env: Record<string, string | undefined> = process.env): IntentProvider {
  const mode = env.INTENT_PROVIDER ?? "rule";
  if (mode === "rule") return new RuleIntentProvider();
  if (mode !== "openai") throw new Error("INTENT_PROVIDER must be rule or openai.");
  return new OpenAIIntentProvider({
    apiKey: env.OPENAI_API_KEY ?? "",
    model: env.OPENAI_MODEL ?? "",
    timeoutMs: env.OPENAI_TIMEOUT_MS === undefined ? undefined : Number(env.OPENAI_TIMEOUT_MS),
  });
}
