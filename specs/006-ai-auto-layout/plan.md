# 计划：AI 自动布局（006）

## 方案

按 spec.md 架构执行，不改旧 `/api/layout`、`/api/pdf` 与 `layout_agent.py`。

### 后端

- 新增 `server/app/ai_layout/` 包：
  - `rules.py` — 约束 Harness：规则表（match/template/fallback/width/min_height）+ 数据形状分析（`shape_of`），覆盖 `[{label,value}]`→柱状图、占比类数组→饼图、dict 维度→数值分→雷达图，及旧语义默认规则（字符串字段→kv、同构扁平对象数组→table、字符串数组→list、嵌套递归分节）。
  - `mapper.py` — 数据映射 agent：遍历 JSON 产出组件声明（blockId/template/sourcePath/data/chart/w/estHeight）；形状先命中规则表，再查 `templates` 表 `llm-<shape签名>` 缓存，未命中走 LLM 生成→校验（语法 parse + sandbox 冒烟渲染）→自动入库；LLM 不可用回退默认模板并记 `llm-fallback`。
  - `composer.py` — 组件组装 agent：24 列 skyline 二维装箱（可用区 481×728pt，估算 ×1.1 余量），放不下按降级链（图表→表格）重排，再放不下显式翻页，单组件超整页记 `oversize`。
  - `renderer.py` — `SandboxedEnvironment` 渲染分页 HTML：每页 595×842 容器、block 绝对定位；图表 block 内嵌 echarts 初始化脚本（引用 `/static/echarts.min.js`）。
  - `llm.py` — Moonshot 客户端（OpenAI 兼容 `/chat/completions`，stdlib urllib，≤30s 超时），`MOONSHOT_BASE_URL`/`MOONSHOT_API_KEY`/`MOONSHOT_MODEL` 走环境变量，无 key 或失败返回 None。
- `db.py`：`templates` 表（id/name/html/created_at）自动建表 + 8 种基础模板幂等 seed（INSERT ... WHERE NOT EXISTS）；新增模板存取函数。
- `main.py`：`POST /api/ai-layout`（{dataId|documentId} → {renderUrl, warnings, trace}，缓存布局计划）、`GET /api/render`（返回分页 HTML，iframe 直接用；无缓存计划时以禁用 LLM 的方式现算，保证 iframe 加载不触发 LLM 计费）、`StaticFiles` 托管 `/static/`。
- `server/static/echarts.min.js`：从 jsdelivr 供应商化 echarts@5 全量包。

### 前端

- `api.ts` 增加 `requestAiLayout`。
- `LayoutPage`：两态 toggle（规则布局｜AI 布局，默认规则布局）；「AI 自动布局」按钮 useMutation 调 `/api/ai-layout`（不自动触发）；`?documentId=` 直接传 documentId，编辑器内存数据先 `POST /api/data` 保存再传 dataId；成功后 `<iframe sandbox="allow-scripts" src={renderUrl}>`，含加载/错误状态；trace/warnings 不上页面。

### 新增依赖

- `jinja2`（后端）：规格指定的模板引擎，沙箱渲染必需。
- echarts.min.js 为静态资源供应商化，不进 npm 依赖。

## 验证

- G4：`cd server && uv sync && uv run python -c "from app.main import app"`；`pnpm -C web build && pnpm -C web lint`。
- 按 spec.md AC-1 ~ AC-5 逐条真实执行（AC-6 人工）。
