# 领域上下文（Domain Context）

## 项目是什么

`layout-pdf-agent`：一个「结构化数据 → 自适应 PDF 版式」的 agent 系统。
用户在前端以可视化方式编辑 JSON 数据（字符串 / 对象 / 数组，可任意嵌套），后端 agent 根据数据的**结构特征**自动推导 PDF 版式并生成 PDF。

## 架构

```
web/  (Vite + React 19 + TS, pnpm)
  └─ 路由：`/` 文档列表、`/data` JSON 编辑器、`/layout` 布局预览
     vite dev 代理 /api → http://localhost:3688

server/ (Python ≥3.10 + FastAPI + ReportLab + psycopg, uv 管理)
  └─ POST /api/layout          输入 JSON 数据，输出布局规格（DocumentSpec）
     POST /api/pdf             输入 JSON 数据，输出 application/pdf
     POST /api/ai-layout       {dataId|documentId} → {renderUrl, warnings, trace}（AI 自动布局）
     GET  /api/render          ?dataId=|documentId= → 分页 HTML（iframe 直接用，无缓存计划时禁用 LLM 现算）
     POST /api/data            新增 JSON 数据；GET /api/data 列表；GET/PUT/DELETE /api/data/{id}
     POST /api/documents       创建文档（{title?, data_id}，关联 datas 表）
     PUT  /api/documents/{id}  绑定数据（{data_id}）
     GET  /api/documents       文档列表（不含 data 正文）
     GET  /api/documents/{id}  取回单个文档（含关联 data）
     GET  /api/health          健康检查
     /static/echarts.min.js    供应商化的 ECharts 5 全量包（AI 布局 HTML 引用）

PostgreSQL 17（Homebrew，本地实例，端口 5433，库 layout_pdf_agent）
  └─ datas（JSON 数据，含 name 列）
     + documents（data_id 外键 → datas.id；template_id 可空外键 → templates.id ON DELETE SET NULL）
     + templates（布局模板：id/name/html/created_at，init_db 自动建表 + 幂等 seed 8 种基础模板），
     启动时自动建表/迁移（增量幂等，information_schema 检查列）
```

> 注意：本机 5432 被另一个项目（deep_assess_dev_platform）的 PostgreSQL 16 占用，
> 因此本项目的实例固定用 5433，不要改回 5432。

## 核心领域规则：数据结构 → 版式映射

由 `server/app/layout_agent.py` 实现，任何修改必须保持以下语义（变更需先改对应规格）：

| 数据结构 | 版式 |
|----------|------|
| 对象的字符串字段 | 键值对段落（`键：值`） |
| 同构扁平对象数组（所有元素为字段值全为字符串的对象） | 表格（列为字段并集，保持出现顺序） |
| 字符串数组 | 编号列表 |
| 嵌套对象 / 混合数组 | 递归分节，字段名作为小节标题（最多两级） |

- 中文字体：ReportLab 内置 CID 字体 `STSong-Light`，无需外部字体文件。
- PDF 页面：A4，边距 20mm，表格跨页重复表头。

## AI 自动布局（spec 006，`server/app/ai_layout/`）

- 管线：`mapper`（数据映射，规则 Harness `rules.py` 为主、LLM 兜底，LLM 模板校验后自动入 `templates` 表复用）→ `composer`（24 列网格 skyline 装箱，可用区 481×728pt，放不下按图表→表格降级链重排再显式翻页）→ `renderer`（Jinja2 `SandboxedEnvironment` 渲染分页 HTML，严禁 eval；图表内嵌 echarts 初始化脚本）。
- LLM 路径（`graph.py`）：LangGraph StateGraph「生成 → 校验（沿用 renderer 的 parse+sandbox+冒烟）→ 失败带错误反馈修复重试」循环；硬上限 10 轮（state 显式计数器 + 条件边控制，`recursion_limit` 兜底），第 11 次 LLM 调用不会发生，超限按 `llm-fallback` 回退；迭代次数写入 `trace.llmIterations`。无 key / 传输失败首轮即短路回退，不空转。
- 前端 `/layout`：两态 toggle（规则布局｜AI 布局，默认规则），「AI 自动布局」按钮 mutation 触发（不自动调，LLM 按量计费），成功后 `<iframe sandbox="allow-scripts" src={renderUrl}>` 展示。
- `templates` 表：`llm-<shape签名>` 命名的 LLM 模板命中后走纯规则路径，同形状数据重复渲染结果确定。
- documents 回写（FR-10，`run_ai_layout`）：携带 `documentId` 的 AI 布局运行，本轮每有一个新模板真正写入 `templates` 表（`insert_template` 返回新行 id，收集在 `trace.newTemplateIds`），结束时统一把 `documents.template_id` 覆盖为最新写入的模板 id；本轮无新模板写入（全部命中缓存/规则）则不改；仅 `dataId` 的运行不触碰任何文档。`GET /api/render` 禁用 LLM，不产生新模板，无需回写。文档列表/详情接口返回 `template_id`。

## 关键文件

| 文件 | 职责 |
|------|------|
| `web/src/router.tsx` | TanStack Router 路由表（`/` 文档列表、`/data` 编辑器、`/layout` 布局预览） |
| `web/src/store.ts` + `components/JsonDataProvider.tsx` | 跨路由共享的编辑器数据（React Context） |
| `web/src/api.ts` + `queryClient.ts` | 服务端请求层（TanStack Query） |
| `web/src/pages/DocumentsPage.tsx` | 首页：documents 表文档列表（去布局 / 修改数据 / 绑定数据ID） |
| `web/src/pages/EditorPage.tsx` | 数据编辑器页（`/data`，支持 `?dataId=N` 加载详情、保存新建或更新） |
| `web/src/pages/LayoutPage.tsx` | 布局预览页（调 `/api/layout` 渲染 DocumentSpec；`?documentId=N` 时按文档详情渲染） |
| `web/src/components/NodeEditor.tsx` | 递归 JSON 节点编辑器（类型切换、增删、字段名编辑） |
| `web/src/utils/json.ts` | 节点树 ⇄ 纯 JSON 的转换 |
| `server/app/layout_agent.py` | 布局推导 agent（上面的映射规则） |
| `server/app/pdf_render.py` | 布局规格 → PDF（ReportLab） |
| `server/app/main.py` | FastAPI 入口与路由 |
| `server/app/db.py` | PostgreSQL 连接、datas/documents/templates 三表存取与自动迁移（psycopg） |
| `server/app/ai_layout/` | AI 自动布局：rules（约束 Harness）/ mapper / composer / renderer / llm（OpenAI 兼容客户端）/ graph（LangGraph 生成-校验-修复循环，上限 10 轮） |
| `server/static/echarts.min.js` | 供应商化 ECharts 5，AI 布局渲染的 HTML 引用 |

## 环境约定

- 包管理：前端 pnpm，后端 uv（不用 pip 全局安装，依赖只进 `server/.venv`）。
- 后端端口默认 3688（`PORT` 环境变量可改），前端默认 3699。
- 数据库：本地 PostgreSQL 17，连接串走 `DATABASE_URL`，默认 `postgresql://localhost:5433/layout_pdf_agent`（无密码，trust 认证）；启动数据库用 `brew services start postgresql@17`。
- 代理：vite dev 把 `/api` 和 `/static`（echarts 等静态资源）都转发到 3688；生产环境反代同样需要转发这两条路径。
- 不在仓库提交密钥和数据库凭据；`server/fonts/` 预留给将来的自定义字体。
- LLM：任意 OpenAI 兼容端点（按量计费）。`LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL` 优先，`MOONSHOT_BASE_URL` / `MOONSHOT_API_KEY` / `MOONSHOT_MODEL` 兜底，走 `server/.env`（已 gitignore，uv 启动用 `uv run --env-file .env server`）；可切到 Kimi Code 会员端点 `https://api.kimi.com/coding/v1`（模型 `k3`）或本地模型；无 key 时服务自动回退纯规则布局。
- agent 框架：mapper 的 LLM 路径用 LangGraph StateGraph 实现（`server/app/ai_layout/graph.py`）：生成模板 → 校验（parse+sandbox+冒烟）→ 失败带错误反馈修复重试的循环，**硬上限 10 轮**（条件边计数 + recursion_limit 兜底），超限按 `llm-fallback` 回退；迭代次数写入 `trace.llmIterations`。
