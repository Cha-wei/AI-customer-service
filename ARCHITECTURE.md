# Architecture

## 1. 总体原则
本项目采用模块化架构。

目标：
- 模块职责清晰
- 模块之间低耦合
- 可以独立替换
- 业务逻辑尽量不侵入核心 Runtime
- MVP 优先简单实现

## 2. 核心流程

```text
Channels
   ↓
Channel Adapter
   ↓
Conversation / Ticket
   ↓
Agent Runtime
   ↓
Knowledge / Context / Tools
   ↓
Policy Engine
   ↓
Auto Execute / Approval
   ↓
Human Handoff（必要时）
```

## 3. 模块关系

```text
              ┌───────────────┐
              │   Channels    │
              │ Web / API     │
              └──────┬────────┘
                     │
             Channel Adapter
                     │
                     ▼
          ┌─────────────────────┐
          │ Conversation/Ticket │
          └──────────┬──────────┘
                     │
              ┌──────▼───────┐
              │ Agent Runtime│
              └──────┬───────┘
                     │
      ┌──────────────┼──────────────┐
      ▼              ▼              ▼
  Knowledge       Context         Tools
      │              │              │
   FAQ/RAG        Customer       Business
                   Data           APIs
      └──────────────┬──────────────┘
                     │
                Policy Engine
                     │
              ┌──────┴───────┐
              ▼              ▼
         Auto Execute      Approval
                              │
                              ▼
                      Human / Execute
```

## 4. Agent Runtime 定位
Agent Runtime 是系统调度中心，但不承担所有业务逻辑。

负责：
- 理解用户意图
- 决定调用哪些能力
- 编排模块
- 整理结果
- 输出回复

尽量不要直接包含：
- 具体数据库实现
- 具体外部 API 实现
- 企业审批规则
- 渠道特殊逻辑

## 5. 模块接口原则
模块之间通过清晰接口交互，例如：

```text
Knowledge.search(query)

Context.get_customer(customer_id)

Tool.execute(tool_name, params)

Policy.evaluate(action, context)

Approval.create(action)
```

Agent Runtime 应依赖接口，而不是依赖具体实现。

## 6. Mock 与真实服务
MVP 优先使用：

```text
Interface / Adapter
        ↓
Mock Implementation
```

未来替换为：

```text
Interface / Adapter
        ↓
Real Implementation
```

接入真实 CRM、ERP、数据库或知识库时，应尽量避免重写 Agent Runtime。

## 7. 多 Agent
MVP 不强制使用多 Agent。

优先采用：

```text
Agent Runtime
    +
Knowledge
    +
Context
    +
Tools
    +
Policy
    +
Approval
```

只有出现明确职责边界后，再考虑拆分：
- Router Agent
- Support Agent
- Knowledge Agent
- Action Agent
- Review Agent

不要为了形式提前增加复杂度。

## 8. Web Chat 渠道边界

`/chat` 客户端通过同源 `/api/chat` 访问服务。独立的 `web-chat/session`
从签名 HttpOnly Cookie 解析客户身份；会话只能由已认证的宿主服务端通过
operator 保护的 Internal API 签发，浏览器不能自行指定客户身份。
`web-chat/service` 校验会话和退款订单归属、串行追加客户消息，再调用现有
Conversation Service / Agent Runtime。退款继续经过现有 Policy / Approval，
不复制业务逻辑。客户端轮询客户范围内的消息接口读取审批结果，不读取内部执行诊断。

## 9. 设计决策优先级
出现多个方案时，优先级为：

1. 简单
2. 清晰
3. 可测试
4. 可替换
5. 可扩展
6. 性能优化

除非已经出现实际问题，否则不要提前进行复杂优化。
