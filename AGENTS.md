# AGENTS.md

本文件定义 Codex 在本仓库中的工作方式。

## Project Goal
本项目用于实现 AI Customer Service Workbench 的 MVP。

系统应保持：
- 模块化
- 简单
- 可测试
- 可替换
- 易于扩展

MVP 阶段不要引入不必要的企业级复杂度。

## 文档读取规则
不要在每个小任务中重复读取全部项目文档。

### 新的大型任务开始时
读取：
1. PRD.md
2. ARCHITECTURE.md
3. DEVELOPMENT_RULES.md

然后只检查与当前任务相关的代码和测试。

### 小型实现任务
优先读取：
- AGENTS.md
- 当前相关模块
- nearby tests
- existing interfaces

不需要重复读取完整 PRD。

### 修改产品行为时
读取：

PRD.md

例如：
- 增加新的客服流程
- 修改审批行为
- 修改 Conversation 生命周期
- 增加 MVP 功能

### 修改系统架构时
读取：

ARCHITECTURE.md

例如：
- 引入新模块
- 修改模块边界
- 修改 Runtime 编排
- 增加 Adapter / Provider Interface

### 大型实现、重构、测试或 Git 决策时
读取：

DEVELOPMENT_RULES.md

## 开发流程
每个任务按照以下流程执行：

1. 理解当前目标
2. 检查相关代码
3. 按需读取项目文档
4. 实现最小完整方案
5. 运行相关测试
6. 修复此次修改引入的问题
7. 检查 Git diff
8. 完成一个有意义阶段后创建 Git Commit
9. 将 Commit Push 到当前 GitHub 远程分支

## Git & GitHub
每完成一个有意义的开发阶段，应执行：

```text
git status
git diff
运行相关测试
git add
git commit
git push
