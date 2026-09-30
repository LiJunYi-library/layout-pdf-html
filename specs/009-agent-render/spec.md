# 009-agent-render — 对话式模板生成 agent（重写版）

## 背景

旧 agent（JSON 解析管线 + 整文档模板生成循环）已整体移除（见 specs/007 变更记录）。
本规格定义新 agent：用户在布局页对话 → LLM 生成/修改整文档 Jinja2 模板 HTML →
写入 fake-oss 文件 → 回写 `documents.template_url` → 前端 iframe 刷新预览。

数据与模板均已文件化（specs/003、008）：

- 指标规范：`datas.config_url`（如 `/oss/files/report/data_id_1/config.json`）
- 测评数据：`datas.fake_data_url`（如 `.../fake-data.json`，人员记录列表）
- 模板输出：`documents.template_url`，路径约定
  `/oss/files/report/data_id_<datas.id>/document_id_<documents.id>/pdf.html`
  （`oss.template_url_for()` 统一生成；同一份数据可有多个 document，各自样式独立）

## 功能需求

- FR-1：新增 `POST /api/agent-render`，请求体 `{"documentId": int, "instruction": str}`；
  返回 `{"reply": str, "renderUrl": "/api/render?documentId=N"}`。文档不存在 404，
  instruction 为空 422。
- FR-2（全局提示词 / prompt 组装）：每次调用先查库——`get_document(documentId)`
  取出 `datas.config_url`、`datas.fake_data_url`、`documents.template_url` 三个地址，
  然后按序组装——
  1. **系统提示**：角色（PDF 报表布局设计师）+ 输出契约（只输出完整 Jinja2 HTML；
     每页一个 `.page`（595×842pt，样式内置）；内联样式；图表用全局 echarts；
     禁止外部资源，只允许引用 `/oss/files/...` 与 `/static/...`）。
  2. **指标规范**：`config_url` 文件全文（结果定义/分组/取值标签/分数方向）。
  3. **数据样例**：`fake_data_url` 文件的前 3 条记录 + 总条数（控制 token，
     全量数据生成阶段不给）。
  4. **当前模板**：以 `documents.template_url` 为准检查文件——**存在则把全文附上
     供修改；不存在则不附带任何模板内容，但必须告知 LLM 该路径**（"你的输出将被
     写入 `<template_url>`"），让 LLM 知道自己在新建还是修改。template_url 为 NULL
     （新文档）时用 `oss.template_url_for(data_id, document_id)` 算出约定路径告知 LLM，
     生成成功后服务端写入该路径并回写数据库。
  5. **用户指令**：当轮 instruction。
- FR-3：生成-校验-修复循环 ≤3 轮。校验 = `doc_layout.validate_template`，
  冒烟渲染的上下文为**真实 fake-data 全文**（`{"data": ..., "title": ...}`），
  确保模板对真实数据可渲染。
- FR-4：校验通过 → `oss.write_text` 写约定路径 + `db.update_document_template_url`
  回写；失败则不改动现有模板文件，回复中说明原因。
- FR-5：会话持久化 messages 表：用户消息 + AI 摘要回复（含 LLM 调用轮数/失败原因）。
- FR-6：成本约束：单次调用 `max_tokens=8000`；重试 ≤3 轮；数据只给抽样；
  历史消息不进 prompt（每轮独立生成完整模板，当前模板文件即上下文）。

## 验收标准

- AC-1：对 documentId=1 发 instruction，返回 200；`fake-oss/report/data_id_1/document_id_1/pdf.html`
  被更新；`documents.template_url` 指向它；`GET /api/render?documentId=1` 渲染出新内容。
- AC-2：删掉 pdf.html 后发消息，agent 重新新建模板（prompt 中只有路径、无模板全文），
  render 恢复 200 非占位页。
- AC-3：LLM 不可用（拔 key）时返回 200 且 reply 说明失败，pdf.html 内容不变。
- AC-4：两轮对话后 `GET /api/documents/1/messages` 有 4 条记录。

## 非目标（Out of Scope）

- 组件库/主题系统（后续规格）；本期仍是"LLM 直接写整份 HTML"。
- 流式输出、模板版本历史、多模板并存切换。
- 素材上传（fake-oss 已就绪，agent 引用素材的交互后续定）。

## 变更记录

| 日期 | 变更 | 原因 |
|------|------|------|
| 2026-09-17 | 初版 | 用户确认重写 agent：模板文件化，prompt 规则（文件存在才附模板、始终告知路径） |
| 2026-09-17 | 渲染壳 .page 与 body 固定 595px 宽（842px 高，A4 等比），pt 改 px；系统提示输出契约同步改 px | 用户要求模板 html body 固定 595 宽度 |
| 2026-09-17 | llm.chat 超时可传参（agent 用 120s，原 30s 对修改模式大 prompt 会超时）；失败时打印真实原因（HTTP 状态+响应体）到服务端日志 | 用户遇到"LLM 调用失败"无法定位，实测为 30s 超时 |
| 2026-09-17 | 渲染壳与输出契约改为 A4 物理尺寸：.page 210mm×297mm，body 宽 210mm（595px 方案废止） | 用户要求模板 html body 用 A4 纸宽度 |
