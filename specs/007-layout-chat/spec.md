# 规格：布局页 AI 对话交互

- 状态：已实现
- 创建日期：2026-09-15

## 用户场景

用户在布局页不再面对"规则布局 / AI 布局"按钮，而是像聊天一样用自然语言告诉 AI 想要什么样的版式（如"标题居中、整体用深蓝色调"），AI 据此生成/重新生成布局，右侧实时预览，可连续多轮对话迭代调整。

## 功能需求

- FR-1：布局页改为对话界面：左侧消息列表（用户/AI 气泡）+ 底部输入框，右侧布局预览 iframe。
- FR-2：文档维度：用户每发送一条消息，LLM 生成/修复**整份文档的 Jinja2 模板**（数据全文 + 指令 + 历史要求 + 参考图进 prompt），校验（语法 + sandbox 冒烟渲染）通过后 **upsert 进 templates 表**（命名 `doc-<documentId>`，直接修改或插入）并把 `documents.template_id` 指向它。
- FR-3：文档渲染 = `documents.template_id` 的模板 + `documents.data_id` 的数据直接组合（sandbox 渲染成 A4 分页 HTML）；**未绑定模板的文档显示"暂未设置 PDF 布局"占位页**。模板校验/LLM 失败时不改动已绑定模板。（FR-3 原"指令性模板不入库"的缓存保护仅适用于块级管线，文档级模板按用户要求直接落库。）
- FR-4：每轮 AI 回复以气泡形式给出生成摘要（LLM 调用次数、警告条数及内容），失败时气泡展示错误。
- FR-5：保留既有来源逻辑：documentId 直接布局；无 documentId（编辑器内存数据）时先保存 datas 再布局。
- FR-6：仅用户发消息时触发 LLM 调用，进页面不自动调用（LLM 按量计费）。
- FR-7：右侧预览只用一个 iframe，直接加载服务端渲染的 AI 布局 HTML（`GET /api/render`），不做客户端/浏览器侧 PDF 转换。
- FR-8：对话支持上传最多 4 张参考图片（前端读为 data URL），随消息以多模态（text + image_url）形式发给 LLM 作为版式参考；携带图片同样不读缓存、不回写 templates 表；后端校验只接受 `data:image/` 开头。
- FR-9：会话按 documentId 持久化到 `messages` 表（用户消息含图片、AI 摘要回复）；`GET /api/documents/{id}/messages` 返回历史，前端进页面自动加载。无 documentId（编辑器内存数据）的会话不持久化。
- FR-10：多轮上下文：携带 documentId 发消息时，后端把该文档历史用户要求按序合并进 prompt（"此前要求保留 + 本轮重点"），重新生成时历史要求依然生效；历史图片不进 prompt（只发当轮图片，控制 token）。
- FR-11：文档布局完全由 `documents.template_id` + `documents.data_id` 决定：模板内容持久化在 templates 表，`/api/render?documentId=N` 只负责"取模板 + 取数据 + 渲染"，不依赖内存缓存、不重跑布局管线，服务重启后布局原样保留。（此前的 documents.plan 计划持久化方案已被本方案取代并移除。）

## 验收标准

- AC-1：`pnpm -C web build` 与 `pnpm -C web lint` 通过；布局页渲染出消息列表、输入框与预览 iframe。（对应 FR-1）
- AC-2：`POST /api/ai-layout` 携带 `{"documentId": 1, "instruction": "..."}` 返回 200 且 renderUrl 可用；instruction 出现在模板生成 prompt 中。（对应 FR-2）
- AC-3：携带 instruction 的布局运行不产生新的 `llm-<签名>` 模板行。（对应 FR-3）
- AC-4：发送消息后界面出现用户气泡与 AI 摘要气泡；LLM 不可用时气泡显示失败原因。（对应 FR-4、FR-6）
- AC-5：无 documentId 时首轮消息先创建 datas 行再布局。（对应 FR-5）
- AC-6：右侧仅一个 iframe，`src` 为 `/api/render?...`，返回 200 的分页 HTML。（对应 FR-7）
- AC-7：携带 `images` 的请求返回 200，且 chat_fn 收到的消息为 text+image_url 多模态结构；非 `data:image/` 开头或超过 4 张返回 422。（对应 FR-8）
- AC-8：发送两条消息后 `GET /api/documents/1/messages` 返回 4 条（用户/AI 交替）；刷新页面历史气泡仍在。（对应 FR-9）
- AC-9：第二轮请求的 prompt 中包含第一轮的用户要求文本。（对应 FR-10）
- AC-10：跑过 `/api/ai-layout` 的文档，templates 表存在/更新 `doc-<id>` 行且 `documents.template_id` 指向它；未跑过的文档渲染显示"暂未设置 PDF 布局"；服务重启后渲染结果不变。（对应 FR-2、FR-3、FR-11）

## 非目标（Out of Scope）

- 不支持流式输出。
- 不做会话分支/编辑/删除单条消息。
- 编辑器内存数据（无 documentId）的会话不做持久化。

## 变更记录

| 日期 | 变更 | 原因 |
|------|------|------|
| 2026-09-15 | 初版 | 用户要求布局页改为 AI 对话形式 |
| 2026-09-15 | 右侧预览改为真实 PDF（后撤销） | 用户要求右侧展示 PDF 布局 |
| 2026-09-15 | 对话支持上传参考图片（FR-8） | 用户要求可以上传图片 |
| 2026-09-15 | 预览改为单 iframe 服务端渲染（修订 FR-7），移除 /api/ai-pdf 与 html_pdf.py | 用户要求只用一个 iframe 服务端渲染 |
| 2026-09-15 | 会话持久化 + 多轮上下文（FR-9、FR-10），移除非目标中的相关条目 | 用户指出刷新后会话与上下文丢失 |
| 2026-09-15 | 布局计划持久化到 documents.plan，/api/render 改数据库驱动（后撤销） | 用户要求渲染先查 data 与 template 再渲染 |
| 2026-09-15 | 改为整文档单模板架构：template_id + data_id 直接组合渲染，对话直接 upsert templates，无模板显示占位页（修订 FR-2/FR-3/FR-11），移除 documents.plan | 用户明确渲染模型：template + data 直接组合 |
| 2026-09-17 | 移除全部 agent 生成逻辑：删除 `app/ai_layout/` 包（mapper/composer/renderer/rules/base_templates/graph）、`doc_layout.run_document_template` 生成循环、`POST /api/ai-layout`、`_AI_PLANS` 内存缓存与 dataId 渲染路径、langgraph 依赖；`app/llm.py`（LLM 客户端）与渲染（render_document/render_placeholder/validate_template）保留。FR-2/FR-4~FR-6/FR-8/FR-10 及对应 AC 暂停生效，待新 agent 规格取代 | 用户要求重写 agent，新逻辑与旧设计差异很大 |
| 2026-09-17 | 右侧预览 iframe 固定宽度 794px → 600px | 用户要求预览固定 600 宽 |
| 2026-09-17 | 预览 iframe 宽度 600px → 210mm（A4 纸宽，≈794px） | 用户要求预览用 A4 纸宽度 |
