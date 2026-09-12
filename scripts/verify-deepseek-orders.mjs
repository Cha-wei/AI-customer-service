import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve, dirname, relative, isAbsolute } from "node:path";
import { loadEnvFile } from "node:process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { randomBytes } from "node:crypto";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
let directory;
let server;
let serverExited;

async function run() {
  loadEnvFile(join(root, ".env"));
  if (!process.env.DEEPSEEK_API_KEY?.trim() || !process.env.DEEPSEEK_MODEL?.trim()) {
    throw new Error("Configure DEEPSEEK_API_KEY and DEEPSEEK_MODEL in local .env first.");
  }
  directory = mkdtempSync(join(tmpdir(), "customer-service-acceptance-"));
  const databaseUrl = "file:" + join(directory, "acceptance.db").replaceAll("\\", "/");
  const token = randomBytes(32).toString("hex");
  const otherToken = randomBytes(32).toString("hex");
  const env = { ...process.env, DATABASE_URL: databaseUrl, INTENT_PROVIDER: "deepseek", DEEPSEEK_TIMEOUT_MS: "30000", NEXT_TELEMETRY_DISABLED: "1",
    INTERNAL_API_TOKENS: JSON.stringify([
      { token, role: "customer", customerId: "customer-1" },
      { token: otherToken, role: "customer", customerId: "customer-2" },
    ]),
  };
  const apiFetch = (url, options = {}) => fetch(url, { ...options, headers: { Authorization: `Bearer ${token}`, ...options.headers } });
  const client = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  try { await client.$executeRawUnsafe("PRAGMA user_version = 0"); }
  finally { await client.$disconnect(); }
  try {
    execFileSync(process.execPath, [require.resolve("prisma/build/index.js"), "migrate", "deploy"], {
      cwd: root, env, stdio: "pipe", timeout: 30_000, windowsHide: true,
    });
  } catch { throw new Error("Acceptance database migration failed."); }

  const probe = createServer();
  await new Promise((resolve, reject) => { probe.once("error", reject); probe.listen(0, "127.0.0.1", resolve); });
  const port = probe.address().port;
  await new Promise((resolve, reject) => probe.close((error) => error ? reject(error) : resolve()));
  server = spawn(process.execPath, [require.resolve("next/dist/bin/next"), "start", "-H", "127.0.0.1", "-p", String(port)], {
    cwd: root, env, stdio: "ignore", windowsHide: true,
  });
  serverExited = new Promise((resolve) => { server.once("exit", resolve); server.once("error", resolve); });
  const base = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (server.exitCode !== null) break;
    try { ready = (await fetch(base + "/api/health", { signal: AbortSignal.timeout(1000) })).ok; } catch { /* Startup is bounded below. */ }
    if (ready) break;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  assert(ready, "Built application did not start. Run pnpm build first.");

  assert.equal((await fetch(base + "/api/internal/conversations", { signal: AbortSignal.timeout(5000) })).status, 401);
  const impersonation = await apiFetch(base + "/api/internal/conversations", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customerId: "customer-2", initialMessage: "test" }), signal: AbortSignal.timeout(5000),
  });
  assert.equal(impersonation.status, 403);
  const created = await apiFetch(base + "/api/internal/conversations", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ customerId: "customer-1", initialMessage: "请查询我的订单物流状态。" }),
    signal: AbortSignal.timeout(5000),
  });
  assert.equal(created.status, 201, "Conversation creation failed.");
  const { data: conversation } = await created.json();
  const path = base + "/api/internal/conversations/" + encodeURIComponent(conversation.id);
  for (const [suffix, method] of [["", "GET"], ["/executions", "GET"], ["/run", "POST"], ["/messages", "POST"]]) {
    const denied = await apiFetch(path + suffix, { method, headers: { Authorization: `Bearer ${otherToken}`, "Content-Type": "application/json" }, ...(method === "POST" ? { body: JSON.stringify({ role: "customer", content: "test" }) } : {}), signal: AbortSignal.timeout(5000) });
    assert.equal(denied.status, 404, "Cross-customer access was not denied.");
  }
  assert.equal((await apiFetch(path + "/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role: "agent", content: "fake reply" }), signal: AbortSignal.timeout(5000) })).status, 403);
  assert.equal((await apiFetch(base + "/api/internal/runtime/recover", { method: "POST", signal: AbortSignal.timeout(5000) })).status, 403);
  const otherList = await apiFetch(base + "/api/internal/conversations", { headers: { Authorization: `Bearer ${otherToken}` }, signal: AbortSignal.timeout(5000) });
  assert.equal((await otherList.json()).data.length, 0);
  const response = await apiFetch(path + "/run", { method: "POST", signal: AbortSignal.timeout(40_000) });
  assert.equal(response.status, 200, "Runtime request failed.");
  const result = await response.json();
  assert.equal(result.status, "open", "Runtime did not complete the order query.");
  assert.equal(result.toolResult?.ok, true, "Order tool was not successful.");
  assert.equal(result.toolResult.data.customer.id, "customer-1");
  assert(result.reply.content.includes("运输中"), "Reply does not contain mock logistics status.");

  const loadedResponse = await apiFetch(path, { signal: AbortSignal.timeout(5000) });
  assert.equal(loadedResponse.status, 200);
  const loaded = await loadedResponse.json();
  assert.equal(loaded.data.messages.length, 2);
  assert.equal(loaded.data.messages.at(-1).content, result.reply.content);
  const historyResponse = await apiFetch(path + "/executions", { signal: AbortSignal.timeout(5000) });
  assert.equal(historyResponse.status, 200);
  const history = await historyResponse.json();
  assert.equal(history.executions.length, 1);
  assert.equal(history.executions[0].status, "completed");
  assert.equal(history.executions[0].toolResult.ok, true);
  const duplicate = await apiFetch(path + "/run", { method: "POST", signal: AbortSignal.timeout(5000) });
  assert.equal(duplicate.status, 409, "Duplicate run was not rejected.");
  console.log("PASS: authentication and customer isolation -> HTTP conversation creation -> live DeepSeek -> mock orders -> persisted reply and execution -> duplicate rejected.");
}

try { await run(); }
catch (error) {
  // Do not print upstream responses, environment values, or assertion operands.
  console.error("FAIL: Live order acceptance did not complete. Check local configuration, API availability and build.");
  if (error instanceof Error && error.message.startsWith("Configure ")) console.error(error.message);
  process.exitCode = 1;
} finally {
  if (server && server.exitCode === null) server.kill();
  if (serverExited) await serverExited;
  if (directory) {
    const withinTemp = relative(resolve(tmpdir()), resolve(directory));
    if (withinTemp && !withinTemp.startsWith("..") && !isAbsolute(withinTemp)) rmSync(directory, { recursive: true, force: true });
  }
}
