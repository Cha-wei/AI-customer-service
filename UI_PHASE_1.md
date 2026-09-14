# MVP UI 第一阶段 — Core Workspace UI

本文记录第一阶段历史版本；当前界面与边界参见 `UI_V2.md`。

## 范围

在现有 Next.js 项目中改造管理端 `/` 和 `/conversations/:id`。
保留客户侧 `/chat`、认证、Runtime、Policy、Approval 和所有 API 行为。
本阶段完成后等待视觉验收，不开展第二阶段数据接入。

## 界面

- 浅色工作台：克制的左侧导航、可筛选和分页的会话列表、主聊天区域。
- 会话切换保留列表筛选条件，选中项有明确视觉状态。
- 客户消息、AI 回复、人工回复与系统消息分别呈现。
- AI Status 直接映射现有会话状态，不展示虚构进度或内部推理。
- 人工接管时显示快捷回复和输入框；快捷回复只填充草稿。
- 退款审批保持可见，实际执行仍通过现有审批接口。
- 客户信息 Drawer 默认关闭，支持按钮打开、Escape 关闭及焦点恢复；执行记录放入 Drawer。
- 执行记录翻页后重新打开 Drawer，保留诊断的可访问性。
- 桌面优先适配 1440px / 1280px，支持减少动态效果的系统偏好。

## 组件与样式

`src/components/workspace/` 包含 WorkspaceLayout、WorkspaceEmpty、ConversationList、
ConversationHeader、MessageBubble、AIStatus、MessageComposer、QuickReplies、CustomerDrawer。
现有 MessageHistory 保持消息请求、草稿、并发保护和滚动状态管理。

`src/app/workspace.css` 在 `.workspace` 范围内集中定义颜色、字体、间距、圆角、
边框、阴影与过渡 Tokens，避免影响客户聊天页面。无新增运行时依赖。
Aira 是本阶段的临时界面品牌文案，并非新增业务模块。

## 数据来源

- 会话列表、客户 ID、状态、时间、消息：现有数据库和 Conversation Service。
- 审批、退款结果与执行记录：现有 Approval Service / Execution Reader。
- 无新增 UI Mock 数据；没有伪造未读、客户画像、情绪、置信度或知识库内容。
- 原系统的 Mock Customer / Order / Refund 保持原状，集中在原有业务模块。
- 快捷回复为集中在 QuickReplies 的界面文案，不表示业务事实。
- 浏览器验收数据由既有隔离测试脚本创建，不进入日常数据库。

## 运行与验收

已有本地 `.env` 和数据库的情况下运行 `pnpm dev`，访问
`http://localhost:3000`，使用已有管理员密码登录，然后选择左侧会话。

检查：`pnpm test`、`pnpm lint`、`pnpm build`。
生产浏览器验收：`PLAYWRIGHT_CHANNEL=msedge pnpm test:e2e:chat:https`
（PowerShell 使用 `$env:PLAYWRIGHT_CHANNEL='msedge'` 设置环境变量）。
验收脚本覆盖订单、退款审批、人工接管、草稿失败重试、聊天隔离，以及
1440px / 1280px 横向溢出、输入区可见性、Drawer 关闭与焦点恢复、快捷回复。
检查工作台 Console error 和全流程 pageerror。
截图保存在忽略目录 `.next/acceptance/workspace-*.png`。

## 后续建议（本阶段不实现）

视觉验收后再确定客户姓名/资料、订单摘要、知识来源、可靠 AI 执行状态的接入。
未读状态必须先确定已读语义和服务端数据；不能仅凭列表位置猜测。
