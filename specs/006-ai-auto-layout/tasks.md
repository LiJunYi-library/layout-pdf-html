# 任务拆分：AI 自动布局（006）

- [x] T1 供应商化 echarts：`server/static/echarts.min.js`（FR-3）— 验证：文件存在且非空
- [x] T2 `db.py`：`templates` 表自动建表 + 8 种基础模板幂等 seed + 存取函数（FR-1）— 验证：重复 init_db 后模板数恒为 seed 数
- [x] T3 `ai_layout/rules.py` + `mapper.py`：形状分析、规则 Harness、LLM 生成校验入库、回退（FR-2/FR-4/FR-5/FR-8）— 验证：AC-2/AC-4/AC-5
- [x] T4 `ai_layout/composer.py`：24 列 skyline 装箱 + 高度模型 + 降级链 + warnings（FR-3）— 验证：AC-2/AC-3
- [x] T5 `ai_layout/renderer.py` + `llm.py`：sandbox 渲染分页 HTML、Moonshot 客户端 ≤30s 超时（FR-3/FR-8）— 验证：AC-2/AC-3
- [x] T6 `main.py`：`POST /api/ai-layout`、`GET /api/render`、`/static/` 托管（FR-3/FR-4）— 验证：AC-2/AC-4
- [x] T7 前端 `api.ts` + `LayoutPage`：toggle + mutation 按钮 + sandboxed iframe（FR-6）— 验证：`pnpm -C web build && pnpm -C web lint`
- [x] T8 验收与文档：AC-1~AC-5 逐条执行、更新 domain.md 与 specs/README.md、spec 状态→已实现（FR-7 回归含在 AC-1/G5）— 验证：本文件记录的证据
- [x] T9 `ai_layout/graph.py`：LLM 路径 LangGraph 化（生成→校验→修复循环，硬上限 10 轮，`recursion_limit` 兜底），mapper 接入、trace 加 `llmIterations`（FR-9）— 验证：AC-7 两个 mock 场景（always-invalid 恰 10 轮停止/调用计数==10/llm-fallback；第 3 轮修复成功 llmIterations=3 且模板入库），零真实 LLM 调用
- [x] T10 端点配置泛化：`LLM_BASE_URL`/`LLM_API_KEY`/`LLM_MODEL` 优先于 `MOONSHOT_*`，README 与 domain.md 注明可切 Kimi Code 会员端点或本地模型 — 验证：AC-1/AC-4 回归通过（无 key 首轮短路回退）
- [x] T11 documents 关联 template_id（FR-10）：init_db 增量迁移加列（幂等）、`insert_template` 区分真正插入、`run_ai_layout` 结束时统一回写最新模板 id、文档接口返回 template_id — 验证：AC-8 三场景 mock（新模板回写/缓存命中不变/仅 dataId 不动文档），迁移幂等 ×2，`PUT /api/documents/{id}` 回归，零真实 LLM 调用
- [x] T12 修订 FR-10 回写时机：mapper 跟踪本轮 `usedTemplateIds`（规则/缓存/新写入全覆盖），`run_ai_layout` 每次运行结束都回写（新模板优先，否则最后使用的模板 id）— 验证：mock 三场景（新模板回写/缓存命中也回写/仅 dataId 不动文档），零真实 LLM 调用
