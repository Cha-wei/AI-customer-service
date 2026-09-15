# UI Guidelines

## 人工首次回复提示（2026-09-15）

队列对尚无人工回复的人工接管会话显示“待人工首次回复”。新增持久化的接管时间作为“等待人工”的唯一计时依据，悬停提示明确写“进入人工接管”。时长仍截至列表更新，并复用既有每分钟刷新和跨窗口同步。

首次人工回复后恢复“人工跟进”；客户再次留言沿用“待人工回复 / 客户等待”。历史会话无接管时间时仅显示首次回复待办，不从通知文案、会话更新时间或最近客户消息推算人工等待。该规则补充下文原有队列提示，保留排序、筛选和业务状态。

## 产品定位

企业级 AI 客服工作台。默认中文，服务于长时间、高频率的客服操作。

## 设计目标

- 简洁、专业、高信息密度，易于快速操作，长时间使用不疲劳。
- 保持明显的 AI 产品特征，但避免过度“AI SaaS 化”。
- AI 状态、工具结果与知识来源必须有真实数据依据，不虚构能力或处理过程。

## UI 组件

- 优先复用现有组件；新基础组件优先使用 shadcn/ui。
- 基础组件放在 `src/components/ui`，业务组件放在 `src/components/workspace`。
- 图标统一优先使用 `lucide-react` 的具名导入；现有 `WorkspaceIcon` 保留兼容，后续按需迁移，不另装图标库。
- 不重复实现已有通用组件，不同时引入功能重叠的 UI 库。
- 当前只引入 Button 所需的 Radix Slot，不预装 Dialog、Dropdown、Tabs、Sidebar 或表格库。
- Button 支持 variant、size、asChild；表单明确设置 type。图标按钮提供中文 aria-label，装饰图标 aria-hidden。
- `asChild` 用于 Link 等单个元素；disabled 链接不能仅依靠视觉状态，需在调用侧处理导航与键盘行为。

## 布局

- 左侧主导航支持折叠；复用现有 WorkspaceLayout 的布局偏好存储。
- 充分利用桌面空间，避免过大的无意义留白，保持内容层级清晰。
- 对话、客户资料、Agent 状态等核心信息保持较高可见性。
- 保留 1440、1280、1024px 和窄屏检查；折叠面板应释放中央阅读空间。

## 视觉

避免过度圆角、大面积渐变、大量玻璃拟态、每个区域都使用卡片、过大的标题、过度留白，以及为“好看”牺牲信息密度。

优先清晰边界、稳定间距、一致圆角、一致状态颜色、易扫描的信息层级，以及明确的 hover / active / selected / disabled / focus-visible 状态。状态不能仅用颜色表达。

工作台继续复用 `workspace.css` 中的 `--ws-*`：4px 间距基准、5/8px 圆角、14px 正文和18px页面标题。`ui-theme.css` 将新组件语义颜色映射到工作台主题。默认浅色，不提前加入暗色切换。

## 样式组织

- `globals.css`：Tailwind 4 入口、登录/客户聊天等既有样式。
- `workspace.css`：管理工作台样式与现有设计变量。
- 既有规则位于 Tailwind `components` 层，新的 utility 类可以覆盖它们；不要新增无层级的全局元素样式。
- 旧 button 元素规则排除 `data-slot="button"`，避免 ghost/link/icon 等变体继承旧背景与内边距；不要删除这一兼容边界。
- 新组件使用 `cn()` 合并类名；不要把旧 `.secondary-button` 等业务样式类混入新组件。
- 新增组件后检查其元素是否被旧页面后代选择器命中；尤其检查 button/input/textarea、hover、focus 和 disabled。
- 新增带 Portal 的组件时，检查挂载在 body 下的主题、层级与焦点行为。
- 添加组件前先预览：`pnpm dlx shadcn@4.21.0 add <name> --view`。只添加当前任务实际需要的组件。
- 当前 Button 基于官方 new-york 源码，适配本地 `cn` 与独立 Radix Slot；CLI 新版可能推荐 `cn` 和 `radix-ui` 聚合包，先检查依赖，不能重复安装两套 helper/primitive。

## 开发原则

- UI 调整尽量不要改变业务逻辑；认证、轮询、审批与 Runtime 保持原边界。
- 页面级组件与基础组件分离，相同交互只实现一次。
- 修改公共组件前搜索调用点确定影响范围，再检查受影响用法与附近测试；不要为参考命名而强行重构。
- 验证与结果复用遵循 DEVELOPMENT_RULES.md 第 3–4 节。局部样式修改检查受影响页面的截图、交互及控制台；共享布局、响应式或关键交互变更运行对应浏览器验收，影响跨页面核心流程时运行现有完整 HTTPS 验收。布局变化保留相关桌面宽度与窄屏检查，不因微小文案修改重跑全部尺寸。
- 只提交本次文件，不提交本地凭证、数据库或他人未提交修改。

## 当前结构与渐进拆分建议

| 区域 | 当前实现 | 建议 |
| --- | --- | --- |
| 主导航与布局 | WorkspaceLayout | 已支持折叠；导航增长时再拆 AppSidebar/MainNavigation |
| 会话列表 | ConversationList | 已独立；条目交互复杂后再拆 ConversationListItem |
| 对话区 | 详情页、MessageHistory、ConversationHeader | 保留服务端读取与客户端轮询边界，无需立刻增加 ConversationPanel |
| 消息和输入 | MessageBubble、MessageComposer、QuickReplies | 直接复用，避免另建同名功能 |
| 客户资料与订单 | ContextPanel | 第一优先逐步提取 CustomerProfile 和订单呈现子组件 |
| AI 状态与记录 | AIStatus、AIActivity | 复用已有组件，不另建 AgentStatus |
| 审批 | 详情页中的审批表单 | 后续提取 ApprovalPanel，保留原 action、字段和权限检查 |
| 工单与知识 | 会话状态、知识来源占位 | 尚无独立工单/真实引用数据，不创建空 TicketStatus/KnowledgeReference |

## MCP 与设计协作

以下为 2026-09-14 的本机环境记录，不保证其它会话或机器仍处于同一状态。仅在任务实际使用对应服务时核验工具、登录与文件权限，不把安装或登录检查作为普通开发前置步骤。后文带日期的检查、额度及验收结果也仅代表记录当时的状态。

shadcn MCP 使用官方 stdio 方式，当前机器在 Codex 用户配置中启用，启动参数为 `npx -y shadcn@4.21.0 mcp`。固定已验证版本，升级单独评估。重启 Codex 后加载工具；项目 `components.json` 供 registry 查询使用，官方 registry 无需额外地址。配置属于开发环境，不进入业务运行时。

其他开发者可使用 `codex mcp add shadcn -- npx -y shadcn@4.21.0 mcp`，然后重启 Codex。不要把个人认证或全局配置复制进仓库。

当前 Codex 已提供 Figma 插件，并通过 whoami 验证登录；无需额外安装第二个 Figma MCP。后续提供有访问权限的设计文件链接，再读取组件与变量，将设计映射到现有组件。当前未做文件级读取/写入验证，未建立 Code Connect，不预建 Figma 文件或修改业务架构。

参考：[shadcn MCP](https://ui.shadcn.com/docs/mcp)、[shadcn 手动安装](https://ui.shadcn.com/docs/installation/manual)、[Codex MCP](https://developers.openai.com/codex/mcp)。

## 本次检查记录（2026-09-14）

原技术栈为 Next.js 16 App Router、React 19、TypeScript、Tailwind CSS 4 和自定义 CSS/SVG。已有 Tailwind PostCSS 插件和 `@/*` 路径别名，无需重装或改框架。原先没有 shadcn、Radix、Lucide、`components/ui` 或项目 MCP 配置；Codex 环境已有 Figma 插件。

重复主要表现为多处原生按钮及全局/工作台两套按钮样式，客户侧与管理侧各有消息、输入和面板呈现；这些业务边界不应直接合并。没有发现多套自建 Dialog、Dropdown、Tabs 或 Table 组件；当前筛选为链接、展开记录使用原生 details。工作台 Sidebar 已支持折叠，不替换为 shadcn Sidebar。

本次增加 components.json、Button、cn、语义主题及最小依赖，未迁移业务页面，未安装额外完整 UI 库、动画库或 Figma Code Connect。图标库已就绪，旧 SVG 组件保留。后续按实际任务添加基础组件。

验证：生产构建、类型检查、lint、219 项测试通过（1 项外部服务 live 测试跳过）；HTTPS 浏览器验收覆盖登录、会话、审批、人工回复、布局折叠与控制台检查。另在浏览器用实际编译 CSS 验证新 Button 的背景、描边及图标尺寸。shadcn MCP 的 initialize、tools/list 和官方 registry 搜索通过；可运行 `node scripts/verify-shadcn-mcp.mjs` 复验。Figma whoami 登录验证通过，未验证具体设计文件权限。


## 第一轮设计落地（2026-09-15）

采用 A 的 Professional SaaS 四栏布局、蓝灰配色、紧凑会话队列及左右消息层级，结合 B 的 AI 执行状态步骤。导航、列表与上下文仍独立折叠；审批操作位于消息之后、输入区之前。ApprovalPanel 保留原表单接口，关键按钮使用已有 shadcn Button，导航图标统一使用 Lucide。

ActivityTimeline 与 activitySteps 复用真实执行记录；审批单独区分待审批、拒绝、成功退款及执行失败。不展示模拟进度、置信度或未记录的知识引用。右侧明确标注“本页最近执行”和快照时间，不把分页历史当作实时执行状态。业务流程、权限与 API 不变。

设计参考：[A / B / C 探索文件](https://www.figma.com/design/blHaCD4q7lekdYkRL3s0Qo)。本轮 Figma MCP 读取达到 Starter 额度，依据前一轮已生成并核验的设计参数落地；后续额度恢复后可继续对照设计节点。


## 工作台状态同步

管理员详情页每 3 秒检查会话版本，仅在消息、状态、最近执行或审批发生变化时更新服务端页面。后台标签暂停检查，回到页面立即检查；连接失败显示过期提示并退避重试（最长 30 秒）。不引入 WebSocket 或额外依赖。

右侧“最近执行”独立于历史分页，显示当前需要人工处理的事项。自动刷新不重建消息组件，保留草稿、历史消息和布局；会话结束后未发送草稿仍可查看，但不能发送。同步接口复用管理员身份检查，不返回客户资料或工具结果。


## 客户订单与退款上下文

CustomerOrders 统一呈现订单、物流和本会话退款审批。待审批订单优先展示；最近执行中的明确审批关联、成功查询返回的本客户订单均注明来源。查询结果不代表客户已选定订单，不从关键词或列表顺序猜测目标。

其他客户订单默认折叠。没有明确关联时提示展开核对；订单服务失败或订单缺失时仍保留审批结果。退款状态与订单/物流状态分别显示，不因审批通过而改写订单状态。此次只调整呈现，不增加依赖或修改业务接口。


## 会话队列提示

摘要标明最近消息发送方（客户 / AI / 人工 / 系统）。待审批明确提示；人工接管中最近一条为客户消息时显示“待人工回复”，其他情况为“人工跟进”。

仅在 open、processing、human_handoff 状态且最近一条为客户消息时，根据该消息时间计算等待时长。时长明确标注截至本次列表更新，不使用会话更新时间推算、不显示猜测的审批等待或未读状态。排序和筛选规则不变。


## 队列自动同步

队列首页和详情页侧栏复用 WorkspaceSync，每 3 秒检查当前筛选、搜索条件及页码对应的版本，有变化才更新。等待时长每分钟刷新一次。后台暂停，连接失败提示并退避重试；同步接口只返回版本摘要，仍需管理员认证。

渲染和同步接口共用 readQueuePage，保持原有排序、筛选与分页规则。QueueViewport 在更新时保留滚动偏移（列表缩短时受可滚动范围限制）；搜索输入保持未提交内容。不会因新增会话自动跳转详情页，也不重建人工回复草稿。


## 稳定性验收（2026-09-15）

通过生产构建、Lint、240 项测试（1 项外部服务测试跳过）及 HTTPS 浏览器验收。验收覆盖队列新增/筛选移出、分页与滚动保留、未提交搜索、跨窗口批准/拒绝审批、跨窗口关闭与草稿保留、关闭后禁止发送、真实离线恢复，以及管理员登录过期后在另一窗口重新登录并恢复同步。

修复：管理员认证过期不再混同网络中断，明确显示登录失效并提供新窗口登录入口，避免自动离开当前页面。网络中断仍按原机制提示过期并退避重试。浏览器人为断网阶段的预期请求错误与正常运行的控制台检查分开处理。
