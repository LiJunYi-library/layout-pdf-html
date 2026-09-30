# 规格库（specs/）

SDD 的主干：每个功能一个目录 `NNN-feature-name/`，内含：

- `spec.md` — 规格（必须有），从 `TEMPLATE.md` 复制
- `plan.md` — 技术计划（SDD ②阶段产出）
- `tasks.md` — 任务拆分（SDD ③阶段产出）

工作流见 [../harness/workflows/sdd.md](../harness/workflows/sdd.md)。

## 现有规格

| 序号 | 规格 | 状态 |
|------|------|------|
| 001 | [JSON 数据编辑器](001-json-data-editor/spec.md) | 已实现 |
| 002 | [PDF 布局适配 agent 服务](002-pdf-layout-agent/spec.md) | 已实现 |
| 003 | [数据文档持久化（PostgreSQL）](003-document-persistence/spec.md) | 已实现 |
| 004 | [前端路由与布局预览页](004-frontend-router/spec.md) | 已实现 |
| 005 | [首页文档列表与编辑器路由调整](005-home-documents/spec.md) | 已实现 |
| 006 | [AI 自动布局](006-ai-auto-layout/spec.md) | 已实现 |
| 007 | [布局页对话改造](007-layout-chat/spec.md) | 已变更（agent 逻辑已移除） |
| 008 | [本地假 OSS 服务](008-fake-oss/spec.md) | 已实现 |
| 009 | [对话式模板生成 agent（重写版）](009-agent-render/spec.md) | 已实现 |
| 010 | [图表规范与视觉样式](010-specs-and-styles/spec.md) | 已实现 |
| 011 | [自定义 PDF 模板编辑器](011-template-editor/spec.md) | 已实现 |
| 012 | [编辑器接真实数据 + 数据绑定 agent](012-editor-data-binding/spec.md) | 已实现 |
| 013 | [编辑器本地文件同步（File System Access API）](013-local-file-sync/spec.md) | spike（/file-test 测试页） |
