// @vitest-environment node
import { PrismaClient } from "@prisma/client";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve, isAbsolute } from "node:path";
import { replyFromHuman } from "./human-reply";
import { transitionFromAdmin } from "./admin-transition";
import { PrismaExecutionStore } from "../agent-runtime/prisma-execution-store";
import { PrismaConversationRepository } from "./prisma-repository";

const directory = mkdtempSync(join(tmpdir(), "human-test-"));
const url = `file:${join(directory, "test.db").replaceAll("\\", "/")}`;
const client = new PrismaClient({ datasourceUrl: url });
beforeAll(() => {
  writeFileSync(join(directory, "test.db"), "");
  execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], { env: { ...process.env, DATABASE_URL: url }, stdio: "pipe", windowsHide: true });
}, 30000);
beforeEach(async () => { await client.conversation.deleteMany(); });
afterAll(async () => {
  await client.$disconnect();
  const within = relative(resolve(tmpdir()), resolve(directory));
  if (within && !within.startsWith("..") && !isAbsolute(within)) rmSync(directory, { recursive: true, force: true });
});
async function fixture(status = "human_handoff") {
  const conversation = await client.conversation.create({ data: { customerId: "customer-1", status } });
  const message = await client.message.create({ data: { conversationId: conversation.id, role: "customer", content: "请人工处理" } });
  return { id: conversation.id, messageId: message.id };
}
it("replies as a human, rejects replay, blocks AI and closes the conversation", async () => {
  const { id, messageId } = await fixture();
  const reply = await replyFromHuman(client, id, "已为您核查", messageId);
  expect(reply.role).toBe("human");
  await expect(replyFromHuman(client, id, "已为您核查", messageId)).rejects.toThrow();
  await expect(new PrismaExecutionStore(client).begin(id, messageId)).rejects.toThrow();
  expect(await client.runtimeExecution.count()).toBe(0);
  await transitionFromAdmin(client, id, "resolved");
  await expect(replyFromHuman(client, id, "迟到回复", reply.id)).rejects.toThrow();
  expect(await client.message.count({ where: { role: "human" } })).toBe(1);
});
it("requires explicit handoff and forbids active AI execution", async () => {
  for (const status of ["open", "processing", "waiting_approval", "resolved"]) {
    const { id, messageId } = await fixture(status);
    await expect(replyFromHuman(client, id, "回复", messageId)).rejects.toThrow();
  }
  const { id, messageId } = await fixture();
  await client.runtimeExecution.create({ data: { conversationId: id, messageId, status: "running" } });
  await expect(replyFromHuman(client, id, "回复", messageId)).rejects.toThrow();
  expect(await client.message.count({ where: { role: "human" } })).toBe(0);
});
it("concurrent replies against one snapshot commit at most once", async () => {
  const { id, messageId } = await fixture();
  const outcomes = await Promise.allSettled([replyFromHuman(client, id, "first", messageId), replyFromHuman(client, id, "second", messageId)]);
  expect(outcomes.filter(result => result.status === "fulfilled")).toHaveLength(1);
  expect(await client.message.count({ where: { role: "human" } })).toBe(1);
});
it("rejects stale snapshots and malformed messages without writing", async () => {
  const { id, messageId } = await fixture();
  await client.message.create({ data: { conversationId: id, role: "system", content: "new information", createdAt: new Date(Date.now() + 100) } });
  await expect(replyFromHuman(client, id, "reply", messageId)).rejects.toThrow();
  await expect(replyFromHuman(client, id, " ", messageId)).rejects.toThrow();
  await expect(replyFromHuman(client, id, "x".repeat(10001), messageId)).rejects.toThrow();
  expect(await client.message.count({ where: { role: "human" } })).toBe(0);
});

it("manual takeover uses the same state lock as AI claiming", async () => {
  const { id, messageId } = await fixture("open");
  await transitionFromAdmin(client, id, "human_handoff");
  const latest = await client.message.findFirstOrThrow({ where: { conversationId: id }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
  await expect(new PrismaExecutionStore(client).begin(id, messageId)).rejects.toThrow();
  expect((await replyFromHuman(client, id, "人工已接手", latest.id)).role).toBe("human");
});

it("keeps handoff time through notifications and failed replies, then records first human reply across history", async () => {
  const { id } = await fixture("open");
  const before = Date.now();
  await transitionFromAdmin(client, id, "human_handoff");
  const repository = new PrismaConversationRepository(client);
  const summary = async () => (await repository.list({ page: 1, pageSize: 20, query: "", status: "" })).conversations.find(c => c.id === id)!;
  const initial = await summary();
  expect(initial.hasHumanReply).toBe(false);
  expect(initial.humanHandoffAt!.getTime()).toBeGreaterThanOrEqual(before);
  await repository.appendMessage({ conversationId: id, role: "customer", content: "请尽快处理" });
  await expect(replyFromHuman(client, id, "过期回复", "stale")).rejects.toThrow();
  expect(await summary()).toMatchObject({ humanHandoffAt: initial.humanHandoffAt, hasHumanReply: false });
  const latest = (await summary()).latestMessage!;
  await replyFromHuman(client, id, "已接手", latest.id);
  await repository.appendMessage({ conversationId: id, role: "customer", content: "后续问题" });
  expect(await summary()).toMatchObject({ humanHandoffAt: initial.humanHandoffAt, hasHumanReply: true, latestMessage: { role: "customer" } });
  await transitionFromAdmin(client, id, "resolved");
  expect(await summary()).toMatchObject({ humanHandoffAt: initial.humanHandoffAt, status: "resolved" });
});

it.each(["complete", "fail", "recover"] as const)("records handoff time through runtime %s without resetting it on retry", async mode => {
  const { id, messageId } = await fixture("open");
  const store = new PrismaExecutionStore(client);
  const executionId = await store.begin(id, messageId);
  const before = Date.now();
  if (mode === "complete") await store.complete(executionId, "转人工", "human_handoff", null);
  else if (mode === "fail") await store.fail(executionId);
  else await store.recoverExpired(new Date(Date.now() + 1000));
  const record = await client.conversation.findUniqueOrThrow({ where: { id } });
  expect(record.humanHandoffAt!.getTime()).toBeGreaterThanOrEqual(before);
  await store.fail(executionId);
  await store.recoverExpired(new Date(Date.now() + 1000));
  expect((await client.conversation.findUniqueOrThrow({ where: { id } })).humanHandoffAt).toEqual(record.humanHandoffAt);
});
