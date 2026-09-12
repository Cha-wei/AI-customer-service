# Development Rules

本文档规定 Codex 在本项目中的开发协作方式。

目标：
- 方便代码追踪
- 方便回滚
- 避免无关修改
- 保持代码可维护
- 降低后续理解和修改成本

## 1. 开发原则
- 优先完成当前任务。
- 不主动扩大任务范围。
- 不为了未来可能使用的功能提前实现复杂架构。
- 不在没有必要的情况下重构正常工作的模块。
- 优先实现最小、完整、可验证的方案。

## 2. 分阶段开发
较大的任务应拆成多个有意义的阶段。

每个阶段应该：
1. 有明确目标
2. 完成后可以运行或验证
3. 不留下明显半完成状态
4. 尽量对应一个独立 Git Commit

## 3. Git Commit 与 GitHub Push
每完成一个有意义的阶段性目标后：

1. 检查当前修改
2. 运行相关测试
3. 创建 Git Commit
4. Push 到当前 GitHub 远程分支

Commit 示例：

```text
feat: add conversation model
feat: implement mock order tool
feat: add policy approval flow
test: add tool execution tests
fix: handle failed approval execution
```

一个 Commit 应对应一个清晰功能或修改。

不要：
- 把大量无关修改放进同一个 Commit
- 为极小的机械修改创建大量无意义 Commit
- 在测试失败或代码明显不可运行时直接提交

如果当前环境无法 Push、没有远程仓库、没有权限、认证失败或 Push 存在风险，应明确报告原因，不要假装已经 Push 成功。

## 4. Commit / Push 前检查
至少确认：
- 当前代码可以运行
- 相关测试通过
- 没有明显错误
- 没有意外修改无关文件
- 不包含 secret、token、密码或本地敏感配置

完成检查后再执行：

```text
git add
git commit
git push
```

## 5. 修改范围
优先只修改当前任务相关文件。

如果需要修改其他模块：
- 判断是否属于当前任务必要修改
- 如果不是必要修改，不要顺手重构

## 6. 代码注释
不要给每行代码写注释。

以下情况应考虑添加注释：
- 复杂逻辑
- 架构边界
- 非明显设计决策
- 重要编排逻辑
- MVP 临时实现
- 兼容或限制条件

注释优先解释 WHY，而不是重复代码已经表达的 WHAT。

例如：

```text
// MVP currently assumes one active order per customer.
// Keep this lookup isolated so it can later be replaced by CRM integration.
```

## 7. 文件与模块结构
模块应保持职责明确。

如果单个文件明显承担多个独立职责，可以拆分。

不要为了形式整洁而过度拆文件。

## 8. 接口优先
未来可能替换的模块优先定义稳定接口，例如：
- Knowledge Provider
- Customer Repository
- Tool
- Policy Engine

Mock 和真实实现应尽量通过相同接口切换。

## 9. 测试
测试重点覆盖：
- 核心业务流程
- 模块接口
- Policy 判断
- Tool 调用
- Approval 流程
- 错误处理

不要为了覆盖率数字编写大量没有实际价值的测试。

## 10. Bug 修复
修复 Bug 时：
1. 定位问题
2. 找到根因
3. 修改最小必要范围
4. 添加或修改对应测试
5. 避免顺手进行无关重构

## 11. Codex 执行原则
需求足够明确时直接执行。

不要因为微小实现选择频繁询问。

优先根据以下内容自行判断：
1. AGENTS.md
2. PRD.md
3. ARCHITECTURE.md
4. DEVELOPMENT_RULES.md
5. 当前代码和测试

只有以下情况才需要暂停或说明：
- 需求之间明显冲突
- 涉及重大架构变化
- 可能造成不可逆数据修改
- 可能泄露敏感信息
- Git Push 目标或操作存在明显风险
- 无法继续执行当前任务

## 12.阶段结束行为

当 Codex 判断当前任务目标已经完成时：

1. 确认代码可以运行
2. 运行相关测试
3. 更新必要文档
4. 创建 git commit
5. 推送到 GitHub
6. 简要总结本阶段完成内容
7. 判断下一阶段是否建议新建 Codex Task

如果建议新建任务，需要同时给出下一任务建议的启动 Prompt。
