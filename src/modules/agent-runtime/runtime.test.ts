import { ConversationService, type Conversation, type ConversationRepository } from "../conversations";
import { MockCustomerContextProvider, type CustomerContextProvider } from "../customer-context";
import { OrderQueryTool } from "../tools";
import { CustomerServiceRuntime, RuleIntentProvider } from "./runtime";

function setup(customerId = "customer-1", question = "我的订单什么时候到？", provider: CustomerContextProvider = new MockCustomerContextProvider()) {
  const state: Conversation = {
    id: "conversation-1", customerId, status: "open", createdAt: new Date(), updatedAt: new Date(),
    messages: [{ id: "message-1", conversationId: "conversation-1", role: "customer", content: question, createdAt: new Date() }],
  };
  const repository: ConversationRepository = {
    create: vi.fn(async () => state),
    findById: vi.fn(async () => state),
    list: vi.fn(async () => []),
    updateStatus: vi.fn(async (_id, status) => { state.status = status; return state; }),
    appendMessage: vi.fn(async (input) => {
      const message = { ...input, id: "reply-1", createdAt: new Date() };
      state.messages.push(message);
      return message;
    }),
  };
  const tool = new OrderQueryTool(provider);
  const execute = vi.spyOn(tool, "execute");
  const runtime = new CustomerServiceRuntime(new ConversationService(repository), new RuleIntentProvider(), { orderQuery: tool });
  return { runtime, state, execute, repository };
}

describe("Runtime with Conversation service and Order Tool", () => {
  it("queries the conversation customer and persists a logistics reply", async () => {
    const { runtime, state, execute } = setup();
    const result = await runtime.run(state.id);
    expect(result.status).toBe("open");
    expect(result.reply.content).toContain("运输中");
    expect(result.reply.content).toContain("2026-09-15");
    expect(state.messages.at(-1)).toEqual(result.reply);
    expect(execute).toHaveBeenCalledWith({ callId: "message-1", arguments: { customer_id: "customer-1" } });
    await expect(runtime.run(state.id)).rejects.toThrow("unanswered");
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("returns an honest empty-order reply", async () => {
    const { runtime, state } = setup("customer-2");
    expect((await runtime.run(state.id)).reply.content).toContain("没有查询到");
  });

  it("hands missing customers to human support", async () => {
    const { runtime, state } = setup("missing");
    const result = await runtime.run(state.id);
    expect(result.status).toBe("human_handoff");
    expect(result.reply.content).toContain("未找到客户资料");
    expect(state.status).toBe("human_handoff");
  });

  it("handles provider failures without exposing internal details", async () => {
    const provider: CustomerContextProvider = {
      getCustomer: async () => { throw new Error("private upstream details"); },
      listOrders: async () => [],
    };
    const { runtime, state } = setup("customer-1", "查订单", provider);
    const result = await runtime.run(state.id);
    expect(result.status).toBe("human_handoff");
    expect(JSON.stringify(result)).not.toContain("private upstream details");
  });

  it.each(["退款订单", "我要人工", "天气怎么样"])("does not query orders for %s", async (question) => {
    const { runtime, state, execute } = setup("customer-1", question);
    expect((await runtime.run(state.id)).status).toBe("human_handoff");
    expect(execute).not.toHaveBeenCalled();
  });

  it("rejects overlapping runs on the same runtime instance", async () => {
    const { runtime, state, execute } = setup();
    const first = runtime.run(state.id);
    await expect(runtime.run(state.id)).rejects.toThrow("already processing");
    await first;
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("moves to handoff when reply persistence fails", async () => {
    const { runtime, state, repository } = setup();
    vi.mocked(repository.appendMessage).mockRejectedValueOnce(new Error("database unavailable"));
    await expect(runtime.run(state.id)).rejects.toThrow("database unavailable");
    expect(state.status).toBe("human_handoff");
  });
});
