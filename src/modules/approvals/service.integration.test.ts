// @vitest-environment node
import { PrismaClient } from "@prisma/client";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ApprovalService } from "./service";
import { RulePolicyEngine } from "../policy";
import { MockCustomerContextProvider } from "../customer-context";
import { MockRefundTool } from "../tools/mock-refund-tool";
import { OrderQueryTool } from "../tools";
import { ConversationService } from "../conversations";
import { PrismaConversationRepository } from "../conversations/prisma-repository";
import { CustomerServiceRuntime, RuleIntentProvider } from "../agent-runtime";
import { PrismaExecutionStore } from "../agent-runtime/prisma-execution-store";

const directory = mkdtempSync(join(tmpdir(), "refund-test-"));
const url = `file:${join(directory, "test.db").replaceAll("\\", "/")}`;
const client = new PrismaClient({ datasourceUrl: url });
const context = new MockCustomerContextProvider();
const tool = new MockRefundTool(context);
const policy = new RulePolicyEngine();
const approvals = new ApprovalService(client, context, policy, tool);
const conversations = new ConversationService(new PrismaConversationRepository(client));
const runtime = new CustomerServiceRuntime(conversations, new RuleIntentProvider(), { orderQuery: new OrderQueryTool(context) }, new PrismaExecutionStore(client), approvals);

beforeAll(() => {
  writeFileSync(join(directory, "test.db"), "");
  execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], { env: { ...process.env, DATABASE_URL: url }, stdio: "pipe" });
}, 30000);
beforeEach(async () => {
  vi.restoreAllMocks();
  await client.mockRefund.deleteMany();
  await client.conversation.deleteMany();
});
afterAll(async () => { await client.$disconnect(); rmSync(directory, { recursive: true, force: true }); });

async function request(message = "帮我退款 order-1001", customerId = "customer-1") {
  const conversation = await conversations.create({ customerId, initialMessage: message });
  const result = await runtime.run(conversation.id);
  const list = await approvals.list(conversation.id, customerId);
  return { conversation, result, approval: list[0] };
}

it("requires Policy approval, persists a pending request without execution, then refunds once", async () => {
  const evaluate = vi.spyOn(policy, "evaluate");
  const execute = vi.spyOn(tool, "execute");
  const { conversation, result, approval } = await request();
  expect(evaluate).toHaveBeenCalledWith("refund");
  expect(result.status).toBe("waiting_approval");
  expect(approval).toMatchObject({ status: "pending", customerId: "customer-1", orderId: "order-1001" });
  expect(execute).not.toHaveBeenCalled();
  await approvals.decide(conversation.id, approval.id, "approve");
  expect((await conversations.get(conversation.id)).status).toBe("resolved");
  expect(await client.mockRefund.count()).toBe(1);
  expect((await approvals.list(conversation.id, "customer-1"))[0].result).toContain('"ok":true');
  await expect(approvals.decide(conversation.id, approval.id, "approve")).rejects.toThrow();
  await expect(approvals.decide(conversation.id, approval.id, "reject")).rejects.toThrow();
  expect(execute).toHaveBeenCalledTimes(1);
  expect((await request()).result.status).toBe("human_handoff");
  expect(await client.mockRefund.count()).toBe(1);
});

it("rejects without calling the refund tool", async () => {
  const execute = vi.spyOn(tool, "execute");
  const { conversation, approval } = await request();
  await approvals.decide(conversation.id, approval.id, "reject");
  expect(execute).not.toHaveBeenCalled();
  expect((await conversations.get(conversation.id)).status).toBe("human_handoff");
  expect((await approvals.list(conversation.id, "customer-1"))[0].status).toBe("rejected");
});

it("isolates approval reads, decision IDs and order ownership", async () => {
  const { conversation, approval } = await request();
  expect(await approvals.list(conversation.id, "customer-2")).toEqual([]);
  const foreign = await request("退款 order-1001", "customer-2");
  expect(foreign.approval).toBeUndefined();
  await expect(approvals.decide(foreign.conversation.id, approval.id, "approve")).rejects.toThrow();
  expect(await client.mockRefund.count()).toBe(0);
  expect((await tool.execute({ callId: "foreign", arguments: { customer_id: "customer-2", order_id: "order-1001" } })).ok).toBe(false);
});

it("asks for an order when ambiguous and hands off unknown orders/customers", async () => {
  expect((await request("帮我退款")).result.status).toBe("open");
  expect((await request("退款 order-9999")).approval).toBeUndefined();
  expect((await request("退款 order-1001", "missing")).result.status).toBe("human_handoff");
  expect(await client.approval.count()).toBe(0);
});

it("does not bypass Policy even when it returns allow", async () => {
  vi.spyOn(policy, "evaluate").mockReturnValue({ decision: "allow", reason: "unexpected rule" });
  expect((await request()).result.status).toBe("human_handoff");
  expect(await client.approval.count()).toBe(0);
});

it.each(["throw", "failure"])("records %s failure and never retries a decided approval", async mode => {
  const { conversation, approval } = await request();
  const execute = vi.spyOn(tool, "execute");
  if (mode === "throw") execute.mockRejectedValue(new Error("private details"));
  else execute.mockResolvedValue({ ok: false, callId: approval.id, toolName: "refund", error: { code: "PROVIDER_ERROR", message: "unavailable", retryable: false } });
  await approvals.decide(conversation.id, approval.id, "approve");
  const stored = (await approvals.list(conversation.id, "customer-1"))[0];
  expect(stored.status).toBe("failed");
  expect(stored.result).not.toContain("private details");
  expect((await conversations.get(conversation.id)).status).toBe("human_handoff");
  await expect(approvals.decide(conversation.id, approval.id, "approve")).rejects.toThrow();
  expect(execute).toHaveBeenCalledTimes(1);
  expect(await client.mockRefund.count()).toBe(0);
});

it("serializes concurrent approvals across service instances", async () => {
  const { conversation, approval } = await request();
  const execute = vi.spyOn(tool, "execute");
  const other = new ApprovalService(client, context, policy, tool);
  const results = await Promise.allSettled([approvals.decide(conversation.id, approval.id, "approve"), other.decide(conversation.id, approval.id, "approve")]);
  expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
  expect(execute).toHaveBeenCalledTimes(1);
  expect(await client.mockRefund.count()).toBe(1);
});

it("rolls back approval and Mock ledger if reply persistence fails", async () => {
  const { conversation, approval } = await request();
  await client.$executeRawUnsafe(`CREATE TRIGGER fail_refund_reply BEFORE INSERT ON Message WHEN NEW.content LIKE '%Mock%' BEGIN SELECT RAISE(ABORT, 'test failure'); END`);
  try {
    await expect(approvals.decide(conversation.id, approval.id, "approve")).rejects.toThrow();
    expect(await client.mockRefund.count()).toBe(0);
    expect((await approvals.list(conversation.id, "customer-1"))[0].status).toBe("pending");
    expect((await conversations.get(conversation.id)).status).toBe("waiting_approval");
  } finally { await client.$executeRawUnsafe("DROP TRIGGER fail_refund_reply"); }
});

it("does not create an approval after execution expiry or provider failure", async () => {
  vi.spyOn(context, "listOrders").mockRejectedValueOnce(new Error("private provider detail"));
  expect((await request()).result.status).toBe("human_handoff");
  const conversation = await conversations.create({ customerId: "customer-1", initialMessage: "退款 order-1001" });
  const store = new PrismaExecutionStore(client);
  const id = await store.begin(conversation.id, conversation.messages[0].id);
  await store.recoverExpired(new Date(Date.now() + 1000));
  await expect(approvals.request(id, "退款 order-1001")).rejects.toThrow();
  expect(await client.approval.count()).toBe(0);
});
