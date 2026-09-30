# 规格：AI 自动布局（双 agent + 模板 Harness + 服务端渲染）

- 状态：已实现
- 创建日期：2026-08-21

## 用户场景

用户在 `/layout` 页点击「AI 自动布局」：数据映射 agent 根据数据结构特征选择或生成布局模板（Jinja2，存数据库、越攒越多），组件组装 agent 以 24 列网格做俄罗斯方块式二维装箱，服务端把「模板 + 数据 + 坐标」渲染成分页 HTML，前端用 iframe 展示。每页内容不溢出到下一页；图表用 ECharts 渲染；后续 PDF 走 Playwright 打印同一份 HTML。

## 已确认的决策（讨论结论）

| 决策点 | 结论 |
|--------|------|
| 决策引擎 | 规则 Harness 为主、kimi-k3 兜底；无 key/LLM 失败自动回退纯规则 |
| 布局算法 | 24 列网格俄罗斯方块装箱（skyline），非一维堆叠 |
| 布局输出 | Jinja2 模板（**拒绝 eval**），模板存 `templates` 表，LLM 生成经校验后**自动入库**复用 |
| 渲染方式 | 服务端渲染 HTML，前端 `/layout` 用 sandboxed iframe 展示 |
| 溢出策略 | 重排：放不下按降级链（图表→表格→显式分页），不截断不静默溢出 |
| 调试信息 | 只在 API 响应带 `trace`/`warnings`，页面不显示 |
| 组件库 | 标题、段落、键值对、列表、表格、柱状图、饼图、雷达图（8 种） |
| ECharts | 全量引入，服务端静态托管 `echarts.min.js` 供模板引用 |
| PDF | P2 换 Playwright print-to-pdf（接受 ~100MB 浏览器二进制）；本期旧 `/api/pdf`（ReportLab）保持不动 |
| 旧代码 | `layout_agent.py` 本期保留，P2 接入 Playwright 后删除 |
| LLM 端点 | 默认 `https://api.moonshot.cn/v1`，模型 `kimi-k3`，key 走 `server/.env`（gitignored）；端点/key/模型均为环境变量，可切到任何 OpenAI 兼容端点（含 Kimi Code 会员端点、本地模型） |
| agent 框架 | LangGraph：mapper 的 LLM 路径为「生成→校验→修复」循环图，**循环硬上限 10 轮**，超限按 `llm-fallback` 回退（成本约束：用户要求） |

## 架构

```
GET /api/render?dataId=N | documentId=N        （iframe 直接指向，返回 HTML）
POST /api/ai-layout {dataId|documentId}        （按钮触发，返回 {renderUrl, warnings, trace}）
  → mapper（数据映射 agent）
      数据形状分析 → 规则 Harness 匹配 templates 表已有模板
      未命中 → kimi-k3 生成 Jinja2 模板 → 校验（语法+sandbox+冒烟渲染）→ 自动入库
      LLM 不可用 → 默认规则模板回退
  → composer（组件组装 agent）
      组件声明 w（24 列档位）× h（高度估算 ×1.1 余量）
      skyline 二维装箱 → 放不下按降级链重排 → 每页 placements: [{blockId, templateId, sourcePath, x, y, w, h}]
  → renderer
      每页一个 595×842 容器，block 绝对定位落位
      Jinja2(sandbox) 渲染：context = { data(该 block 的子数据), chart(图表 props), placement }
      图表 block 内嵌 echarts 初始化脚本（引用 /static/echarts.min.js）
```

- 模板命中后是确定性的：同一份数据重复 render 结果稳定（LLM 只在首次生成模板时介入）。
- 前端 `/layout`：两态 toggle（规则布局｜AI 布局）；「AI 自动布局」按钮 `useMutation` 调 `/api/ai-layout`（**不进页面自动调，LLM 按量计费**），成功后 `<iframe sandbox="allow-scripts" src={renderUrl}>`。

## 数据库

新增 `templates` 表（init_db 自动建表 + 幂等 seed 8 种基础模板）：

| 列 | 说明 |
|----|------|
| `id` | 主键 |
| `name` | 模板名（如 `bar-chart`、`kv`） |
| `html` | Jinja2 模板字符串 |
| `created_at` | 时间戳 |

## 约束 Harness（rules.py，改规则不改 agent 代码）

```python
{
  "match": {"type": "array", "item_shape": {"label": "string", "value": "number"}},
  "template": "bar-chart",      # templates 表中的模板名
  "fallback": "table",          # 空间不足降级
  "width": 24,                  # 24 列网格占位宽度
  "min_height": 220,            # pt
}
```

- 必覆盖：`[{label, value}]` → 柱状图（空间不足→表格）；dict:维度→数值分 → 雷达图；占比类数组 → 饼图。
- 旧语义并入默认规则：对象字符串字段→kv；同构扁平对象数组→table；字符串数组→list；嵌套→递归分节。

## 高度模型与装箱

- A4 595×842pt，边距 20mm（≈57pt），可用区 481×728pt；估算 ×1.1 余量。
- 图表固定画布（精确）；表格 行数×行高；文本类 按字符数估行×行高。
- skyline 装箱：组件按优先级排序后在 24 列网格中找最低可放位置；当前页放不下→按 fallback 降级→仍放不下→显式翻页；单组件超整页→降到最终形态并记 warning `oversize`。
- warnings：`downgrade` / `repaginate` / `oversize` / `empty` / `llm-fallback`，含 blockId 与原因。

## 安全

- Jinja2 使用 `sandbox.SandboxedEnvironment`；LLM 模板入库前校验：语法 parse + sandbox 白名单 + 用样例数据冒烟渲染一次。
- iframe `sandbox="allow-scripts"`（不同源、无 same-origin 权限）。

## 功能需求

- FR-1：`templates` 表自动建表 + 8 种基础模板幂等 seed。
- FR-2：规则 Harness 覆盖上述场景，新增规则不改 agent 代码。
- FR-3：`POST /api/ai-layout` 返回 `{ renderUrl, warnings, trace }`；`GET /api/render` 返回分页 HTML：每页 595×842 容器、block 绝对定位、每页内容不超出容器。
- FR-4：无 `MOONSHOT_API_KEY` 或 LLM 失败时回退规则模板，服务不报错；trace.engine 标记 `rule`/`llm`/`fallback`。
- FR-5：LLM 生成模板经校验后自动写入 `templates` 表，同形状数据二次渲染命中缓存不再调 LLM。
- FR-6：前端 `/layout` 两态 toggle + 「AI 自动布局」按钮（mutation 触发）。携带 `documentId` 时切到 AI 布局直接以 iframe 展示 `/api/render?documentId=…`：命中服务端计划缓存即上次 AI 布局结果；无缓存（未跑过/服务重启）则禁用 LLM 现算复现（规则 + templates 表缓存模板），不触发计费；点按钮重新生成并刷新 iframe。仅编辑器内存数据（无 documentId）时保持按钮成功后才展示。有加载/错误状态。
- FR-7：`/api/layout`、`/api/pdf` 旧契约本期不变。
- FR-8：LLM 调用 ≤30s 超时，输出非法按回退处理并记 warning `llm-fallback`。
- FR-9：mapper 的 LLM 路径用 LangGraph 实现为状态图：生成模板 → 校验 → 失败则携带错误信息修复重试的循环；**循环硬上限 10 轮**（含首轮生成），超限立即按 `llm-fallback` 回退，不得继续调用 LLM。每轮迭代的次数计入 `trace`（如 `llmIterations`）。
- FR-10：`documents` 表增加 `template_id`（可空外键 → `templates.id`，模板删除时 SET NULL）。AI 布局运行携带 `documentId` 时，**每次运行结束都覆盖回写**该文档的 `template_id`：优先取本轮最新写入 `templates` 表的模板 id；本轮无新写入（缓存命中/纯规则）则取本轮实际使用的最后一个模板 id；本轮一个模板都没用到（空数据）则不改动。文档接口（列表/详情）返回 `template_id`。

## 验收标准

- AC-1：`cd server && uv sync && uv run python -c "from app.main import app"` 通过；`pnpm -C web build && pnpm -C web lint` 全绿。
- AC-2：`[{label,value}]` 数据渲染的 HTML 中含柱状图（echarts 初始化脚本）；构造高度不足场景降级为 table 且 `warnings` 含 `downgrade`。（对应 FR-2、FR-3）
- AC-3：多组样例数据渲染，断言每页 block 的 `y+h ≤ 728` 且不重叠（24 列网格无重叠）；超长数据产生多页。（对应 FR-3）
- AC-4：不设 `MOONSHOT_API_KEY` 启动，`/api/ai-layout` 正常返回且 `trace.engine` 为 `rule` 或 `fallback`。（对应 FR-4）
- AC-5：设 key 后对一种新形状数据渲染两次：首次 `trace.engine=llm` 且 templates 表新增一行；二次 `trace.engine=rule` 且 LLM 调用次数为 0。（对应 FR-5）
- AC-7：用始终返回非法模板的 mock LLM 客户端验证：循环在 10 轮处停止（`trace.llmIterations=10`），按 `llm-fallback` 回退，第 11 次调用不发生。（对应 FR-9，mock 验证、零费用）
- AC-8：携带 `documentId` 且 mock LLM 返回合法新模板时：`documents.template_id` 被覆盖为新模板 id；再次运行（模板已缓存、无新写入）`template_id` 仍被覆盖为本轮使用的模板 id（即每次运行都回写）；仅携带 `dataId` 运行时不改动任何文档。（对应 FR-10，mock 验证、零费用）
- AC-6：浏览器 `/layout` 点「AI 自动布局」，iframe 内显示分页布局与图表，翻页边界清晰，无内容溢出页框。（对应 FR-6，人工确认）

## 非目标（Out of Scope）

- PDF 链路切换 Playwright、`layout_agent.py`/`pdf_render.py` 删除（P2）。
- 场景素材库、折线图等更多图表、模板可视化管理界面、LLM 润色文案。

## 变更记录

| 日期 | 变更 | 原因 |
|------|------|------|
| 2026-08-21 | 初始规格（PageSpec + 前端渲染方案） | 用户要求 AI 自动布局 |
| 2026-08-21 | 整体重写：Jinja2 模板入库 + 服务端渲染 + iframe + 24 列俄罗斯方块 + Playwright(P2)；拒绝 eval | 用户补充布局形态、模板化与服务端渲染诉求 |
| 2026-08-21 | LLM 路径改 LangGraph 循环图（生成→校验→修复），硬上限 10 轮，超限回退；端点配置泛化为任意 OpenAI 兼容端点 | 用户要求 LangGraph + 10 轮上限 + 成本收敛 |
| 2026-08-21 | 新增 FR-10/AC-8：documents 增加 template_id 外键，AI 布局写入新模板时覆盖回写 | 用户要求 documents 关联 templateId |
| 2026-08-21 | 修订 FR-10/AC-8：每次 AI 布局运行结束都回写 template_id（无新写入时取本轮实际使用的最后一个模板 id），缓存命中/纯规则运行不再跳过 | 用户反馈 ai-layout 执行后 template_id 未更新 |
| 2026-08-21 | 修订 FR-6：携带 documentId 切到 AI 布局直接展示最近一次结果（/api/render 缓存或禁 LLM 现算复现），不再要求先点按钮 | 用户要求切换即显示之前 AI 布局结果 |
| 2026-09-15 | /api/render 的 documentId 路径改为数据库驱动：AI 布局计划持久化到 documents.plan，渲染直接读库；内存缓存只保留给无文档的 dataId 路径（详见 007 FR-11） | 用户要求渲染先查 data 与 template 再渲染 |
