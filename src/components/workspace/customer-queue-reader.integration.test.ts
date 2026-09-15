// @vitest-environment node
import { PrismaClient } from "@prisma/client";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve, isAbsolute } from "node:path";
import { readCustomerQueue, readCustomerConsultations } from "./customer-queue-reader";

const directory = mkdtempSync(join(tmpdir(), "customer-queue-"));
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
const queue = (query = "", status: "" | "resolved" | "human_handoff" = "", page = 1) => readCustomerQueue(client, { query, status, page, pageSize: 20 });
const create = (customerId: string, status: string, content: string, updatedAt = new Date()) => client.conversation.create({ data: { customerId, status, updatedAt, messages: { create: { role: "customer", content } } } });

it("groups before pagination and keeps the older pending approval visible beside the latest message", async () => {
  const pending = await create("customer-1", "waiting_approval", "旧退款", new Date(1000));
  await client.approval.create({ data: { conversationId: pending.id, customerId: "customer-1", executionId: "test-execution", orderId: "order-1001", reason: "模拟", status: "pending" } });
  for (let i = 0; i < 25; i++) await create("customer-1", "resolved", `历史 ${i}`);
  await create("customer-1", "human_handoff", "请人工处理");
  await create("customer-2", "open", "另一客户");
  const result = await queue();
  expect(result.total).toBe(2);
  expect(result.conversations).toHaveLength(2);
  expect(result.conversations.find(c => c.customerId === "customer-1")).toMatchObject({ id: pending.id, pendingApprovals: 1, activeCount: 2, humanCount: 1, consultationCount: 27, latest: { latestMessage: { content: "请人工处理" } } });
  expect((await queue("历史 2", "resolved")).conversations[0]).toMatchObject({ customerId: "customer-1", status: "resolved", pendingApprovals: 1 });
  expect((await queue("另一客户", "human_handoff")).total).toBe(0);
});
it("uses distinct customer pages with stable ties and clamps out-of-range pages", async () => {
  for (let i = 0; i < 23; i++) await create(`customer-${String(i).padStart(2, "0")}`, "open", "查询", new Date(1000));
  const first = await queue();
  const second = await queue("", "", 99);
  expect(first.conversations).toHaveLength(20);
  expect(second).toMatchObject({ total: 23, page: 2 });
  expect(second.conversations).toHaveLength(3);
  expect(new Set([...first.conversations, ...second.conversations].map(c => c.customerId)).size).toBe(23);
});
it("pages active and historical consultations within the selected customer only", async () => {
  for (let i = 0; i < 12; i++) await create("owner", "resolved", `history ${i}`);
  await create("owner", "human_handoff", "active");
  await create("foreign", "resolved", "private");
  const first = await readCustomerConsultations(client, "owner", true, 1);
  const second = await readCustomerConsultations(client, "owner", true, 2);
  expect(first).toMatchObject({ total: 12, page: 1 });
  expect(first.conversations).toHaveLength(10);
  expect(second.conversations).toHaveLength(2);
  expect([...first.conversations, ...second.conversations].every(c => c.customerId === "owner" && c.status === "resolved")).toBe(true);
  expect((await readCustomerConsultations(client, "owner", false, 1)).conversations).toHaveLength(1);
});
