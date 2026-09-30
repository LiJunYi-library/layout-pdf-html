# 规格：编辑器接真实数据 + 数据绑定 agent（agent-bind）

- 状态：已实现
- 创建日期：2026-09-18

## 用户场景

运营在文档列表点「去编辑」进入某文档的模板编辑页。编辑器不再用 localStorage，数据按文档存 fake-oss；页面加载该文档的 config（指标规范）与 fake_data（假数据），假数据挂全局 `window.__DATA__`。运营在编辑器里和**新的数据绑定 agent** 对话（如"把组件数据绑定一下"），agent 按每个组件的 data-source/data-map 标注生成**组件级数据脚本**（bindScript），浏览器冒烟校验后写回组件 props——组件即刻用真实数据渲染。预览与正式渲染共用同一套 JS 数据逻辑，LLM 不碰 Jinja。

原 agent（agent-render，生成整份 Jinja 模板）**保留不动**；新 agent 独立端点、独立对话表。

## 功能需求

- FR-1：`documents` 表加 `editor_url TEXT NULL`；编辑器数据存 fake-oss `report/data_id_{dataId}/document_id_{docId}/editor.json`。
- FR-2：路由 `/editor` 改为 `/document/editor/$documentId`；文档列表每行加「去编辑」按钮；导航栏「模板编辑」入口移除（从文档进入）。
- FR-3：新表 `dialogue(id, document_id→documents ON DELETE CASCADE, role, text, created_at)`，存新 agent 的对话。
- FR-4：后端端点：
  - `GET /api/documents/{id}/editor` → `{data: <puck json>|null}`；`PUT /api/documents/{id}/editor`（体为 puck json）→ 写 fake-oss + 回写 editor_url
  - `GET /api/documents/{id}/dialogue` → 对话历史
  - `POST /api/agent-bind`：入参 `{documentId, components:[{id,type,dataSource,dataMap}], instruction, feedback?}` → 查库取 config/fake_data → LLM 生成 `{scripts:{id: js函数体}}` → 对话落 dialogue 表 → 返回 scripts。脚本契约：`data` 形参=fake_data 全文，返回该组件字段覆盖对象（如 StatCard→`{value,note}`、DonutChart→`{dataJson}`、StatGroup→`{items}`、DataTable→`{rowsJson}`、Text→`{content}`），纯 JS 同步无 async
- FR-5：编辑器加载文档上下文（config_url/fake_data_url 的 JSON 拉下，fake_data 挂 `window.__DATA__`）；组件渲染统一经 `resolveBind(props)` 包装：有 bindScript 就 `new Function('data', script)(__DATA__)` 执行并把返回对象合并覆盖 props，异常回退死值
- FR-6：组件字段面板"计算说明"下方加自定义字段「数据脚本」：「生成数据脚本」按钮调 /api/agent-bind（仅当前组件）→ 浏览器冒烟执行 → 有错带 feedback 重试（≤3 轮）→ 通过才写入该组件 props.bindScript；「查看脚本」按钮弹窗展示脚本代码（只读 + 显眼关闭按钮）。对话记录仍落 dialogue 表（每次生成 = 一条 user + 一条 assistant）
- FR-7：编辑器数据迁移：服务端无 editor.json 而 localStorage 有旧数据时，用 localStorage 初始化并立即上传服务端（之后 localStorage 仅作缓存）
- FR-8：导出 HTML 暂不嵌脚本（静态死值/已计算值），正式模板的脚本注入归后续规格

## 验收标准

- AC-1：文档列表出现「去编辑」，点击进入 `/document/editor/1`，编辑器正常加载；保存后刷新内容仍在（curl GET editor 端点验证，对应 FR-1/2/7）
- AC-2：发一条"绑定数据"指令，agent 返回 scripts，对话写入 dialogue 表（curl 验证，对应 FR-3/4）
- AC-3：浏览器校验失败时会带 feedback 重试；通过后组件显示 fake_data 算出的真实值（如参与人数=50）（手动验证，对应 FR-5/6）
- AC-4：原 agent-render 端点与 /layout 页行为不变（回归验证）
- AC-5：`pnpm -C web build && pnpm -C web lint` 通过；后端 import 检查通过

## 非目标（Out of Scope）

- 不改原 agent-render、不动 messages 表、不动 /layout 页
- 导出 HTML 不嵌 window.__DATA__/bindScript（后续规格做正式模板注入）
- 不做 bindScript 的面板可视化编辑（只由 agent 写）
- 不做多文档间复制模板

## 变更记录

| 日期 | 变更 | 原因 |
|------|------|------|
| 2026-09-18 | 初版 | 用户决策：editor.json 存 fake-oss（url 方案）；编辑器按文档隔离；新 agent 生成组件级数据脚本，对话存 dialogue；旧 agent 保留 |
| 2026-09-18 | 已实现并验证：editor GET/PUT 端点 + editor_url 回写；dialogue 表落库；/api/agent-bind 真实 LLM 一次通过（StatCard 脚本算出 45/50=90.0%）；路由 /document/editor/$id + 文档列表「去编辑」；bindScript 由"对话面板"改为组件字段内按钮（生成+查看弹窗），校验循环在浏览器；localStorage→服务端迁移；render 回归 200。门禁 build+lint 通过 | AC-1/2/4/5 curl 验证；AC-3 需浏览器手动确认 |
| 2026-09-18 | __DATA__ 异步到达后强制重渲染一次（setData 浅拷贝），修复首屏已绑定组件停留死值的缝隙；确认导出 HTML 与预览同渲染路径（resolveBind 包装对 Render 同样生效，导出即真实计算值静态烤入） | 用户问预览实时性与导出路径 |
| 2026-09-18 | **导出 HTML 块内嵌脚本（原 FR-8 非目标转为实现）**：Block 通过 dangerouslySetInnerHTML 在块内嵌 `<script>window.__runBind(closest('.tpl-block'), script)</script>`（绕开 React 19 script 提升；编辑器内 innerHTML 注入不执行，导出文件作为文档源解析时执行）；head 注入 window.__DATA__（导出时的 fake_data）+ __runBind 回填助手（text/heading→content、stat-card→value/note、info-line→value、stat-group→重建卡片行、data-table→重建表头表体；图表 SVG 已烘焙不客户端重算）；resolveBind 加 window 环境守卫（Node/SSR 不崩）；Node 实测导出产物含注入与块内脚本且位置正确 | 用户要求导出 HTML 组件块内有 script |
| 2026-09-18 | **"导出即模板"闭环**：exportTemplateFragment（不包文档壳，数据注入点 = `window.__DATA__ = {{ data \| tojson }}`）；新端点 PUT /api/documents/{id}/template（validate_template 用 fake_data 冒烟后写 pdf.html 回写 template_url）；编辑器工具栏「存为模板」按钮（成功后新标签打开 renderUrl）；curl 全链路验证：render 输出 `window.__DATA__ = [{性别:男…}]`（Jinja 已注入真数据）+ 块内脚本 + __runBind + shell echarts + 静态兜底值齐全。注意：doc 1 的 pdf.html 已被片段模板覆盖（旧 agent 模板被替换，agent 代码未动） | 用户决策：预览页结构 = 数据注入 + 组件带脚本，存库只把注入点换 Jinja |
| 2026-09-20 | 修复编辑器预览与 render 页不一致：fake_data 改走 useQuery，画布等 fake-data 就绪后才挂载（Puck data prop 变更不驱动预览重算，之前的"到达后强制重渲染"对 Puck 无效）；拉取失败放行显示死值兜底 | 用户反馈两页长得不一样：预览应等 fake-data.json 加载完毕 |
| 2026-09-20 | 模板片段加 `<!--head-->` 标记段（样式 + __DATA__ 注入 + __runBind），doc_layout.render_document 渲染后把标记段挪进 iframe 文档 `<head>`——devtools 里可直接看到 head 中的 `<script>window.__DATA__ = [真数据]</script>`；在进程内验证 head/body 分派正确，未动用户模板 | 用户要求预览 iframe 的 head 里可见 __DATA__ 注入 |
| 2026-09-20 | **__DATA__ 注入组件化（data-script）**：新组件 DataScript 固定为模板第一个组件（任何来源数据加载后缺失自动 unshift 补齐）；渲染 `<script>window.__DATA__ = …</script>` 经 innerHTML 嵌入块内——编辑器/导出=静态 fake-data JSON，存为模板=Jinja `{{ data \| tojson }}`（templateMode 标志切换，存 bindRuntime 避免循环依赖）；编辑器画布显示占位卡片（导出/打印隐藏）；导出 head 的 __DATA__ 注入移除（组件接管），__runBind 仍在 head；删除 iframe 轮询注入 hack。Node 实测：head 无赋值、body 首个块内带 Jinja 注入 | 用户方案：data-script 组件固定首位，比 DOM 注入 hack 可靠（随组件树渲染进 iframe，devtools 可见） |
| 2026-09-20 | 降低运营门槛（StatGroup 实验）：「数据来源」输入框移除（字段面板与 Block 的 data-source 属性一并去掉，props 里的残留变可选惰性元数据）；「计算说明」改为可选（为空时 LLM 根据组件 HTML 展示值+数据样例自行推断）；生成载荷改为组件全部字段配置 + 预览 iframe DOM 里取的真实渲染 HTML（含计算后数值）；agent-bind 提示词契约同步。真实 LLM 验证：StatGroup 空 dataMap 一轮通过，对真数据执行得 50/45/90.0%/19，与预期完全一致（预警人数路径 报告内容.指标分数.*.预警等级 也被正确推断） | 用户反馈：data-source 运营看不懂，data-map 可空，发 HTML+全配置给 LLM 更直观 |
| 2026-09-20 | 架构定稿：组件脚本为纯函数（__DATA__ 进、展示字段出），组件间无共享/无事件/无状态——不做 IIFE、不做命名空间共享、不做页面级脚本组件；同口径计算在多组件重复出现由 LLM 重写承担，改口径即重新生成 | 用户决策：纯导出 PDF 场景，组件无关联，数据全走 __DATA__ |
| 2026-09-20 | 计算说明语义修正：从"为空才推断/非空严格执行"改为"始终以 HTML 展示值+数据样例推断为主，计算说明作为补充参考（尤其格式约定）"；字段标签同步为"可选，补充给 AI 参考" | 用户修正：推断是主路径，说明是补充 |
| 2026-09-20 | 组件结构规范统一为 `<div class="tpl-block"><div>渲染</div><script/><style/></div>`：Block 新增 bindStyle 槽位（与 bindScript 对称），LLM 组件级样式经 innerHTML `<style>` 注入即生效（编辑器预览同样可见）；全部 12 个组件接线（css={rest.bindStyle}）；Node 实测块结构三件套齐全。样式生成功能（agent 写 bindStyle）留待后续 | 用户提议：组件规范预留 style 槽位 |
| 2026-09-20 | 新增「样式说明」字段（styleMap，与计算说明对称）：字段面板位于计算说明与数据脚本之间，Block 渲染 data-style-map 属性；生成载荷自动携带（props 全量发送），供将来样式生成参考 | 用户需求：样式说明补充给 AI |
| 2026-09-20 | **样式生成落地**：Block 加 data-bid 唯一锚点（样式作用域选择器前缀，组件间不串样式）；agent-bind 加 mode='style'（STYLE_SYSTEM_PROMPT：输出 {"styles":{id:css}}，选择器必须 [data-bid] 开头，禁 position 固定/外部资源，输入=视觉样式规范+组件全配置+渲染 HTML）；字段面板新增「组件样式」区（生成样式/查看样式弹窗），校验=CSS 必须含本组件 [data-bid] 选择器，失败带 feedback 重试 ≤3；真实 LLM 验证：StatGroup 带"浅绿渐变+深绿加粗数值"styleMap 一轮通过，输出全部 scoped | 用户需求：样式说明驱动 LLM 写组件样式 |
| 2026-09-20 | 字段面板顺序调整：计算说明→生成数据脚本、样式说明→生成样式；随后**全组件间距（8 个内外边距）配置整体下线**——字段、渲染、默认值全部移除，旧数据迁移改为删除残留 spacing 键，块间距恢复 CSS 固定 margin-bottom:16px；组件级边距需求由 bindStyle（LLM 样式）承接 | 用户决策：间距配置不要了，简化面板 |
| 2026-09-20 | StatGroup 修正：AI 只改数据——stat-group 契约改为脚本只返回 {items:[{value,note}]}（张数一致，禁止返回 title/icon），resolveBind 对 items 按位合并（title/icon 取配置），导出 __runBind 从整行重建改为按位 textContent 回填；真实 LLM 验证只返回 value/note，合并测试 title/icon 保留 value/note 更新 | 用户反馈 bug：标题应由人控制 |
| 2026-09-20 | 组件名称字段 + 自定义大纲树：所有组件加 name 字段（"名称（仅大纲中显示）"）；Puck 默认 outline 标签只支持静态配置，用 overrides.outline 整体替换为 CustomOutline——usePuck(createUsePuck) 递归组件树（root:default-zone + 容器插槽下钻），行显示 名称（类型），点击 dispatch setUi itemSelector 选中并联动字段面板，选中行高亮。代价：大纲内拖拽排序暂失（画布拖拽不受影响） | 用户需求：outline 显示名称便于选中 |
| 2026-09-20 | 尝试自定义 viewports=[100%] 让预览不缩小，引发 Puck 缩放控件 `Cannot read properties of undefined (reading 'value')`（zoom 档位查找失败），已回滚恢复默认视口列表；预览缩放维持 Puck 默认行为 | 试错记录：Puck 0.23 单视口配置与缩放控件不兼容 |
| 2026-09-20 | **字段家族规范定稿**：label/note/icon 家族=写死由人控制，value/value_xxx 家族=数据由 AI 控制。StatGroup items 的 title 改名 label（字段/渲染/演示/迁移 title→label）；resolveBind 按组件类型收窄（StatGroup 按下标只取 value、StatCard 只取 value 家族，其余组件整体合并）；__runBind stat-card/stat-group 只回填 value；agent 契约同步（stat-card→{value}、stat-group→{items:[{value}]}）。验证：旧脚本残留 title/note 不再覆盖配置（单测全过）；真实 LLM 按配置换序后的顺序返回纯 value 数组 | 用户反馈：改配置不生效（旧脚本 title 覆盖配置）+ 字段家族规范提议 |
| 2026-09-20 | **StatGroup 改对象组件 value_map**：AI 返回 `{value_map:{"卡片label":值}}` 取代按下标的 items 数组——label 为键，换序/改名天然对齐，键缺失保留配置死值；resolveBind 以 label 查表合并，__runBind 以卡片上烘焙的 label 文本查表回填；agent 契约同步。单测（换序对齐/人控保留/缺键回退）与真实 LLM（返回 {'完成':45,'总数':50,'完成率':'90.0%'}）全部通过 | 用户决策：组件分数组/对象两类，StatGroup 属对象组件，键控优于下标 |
| 2026-09-20 | 修复 fake-data 加载 404：Vite proxy 缺 /oss 前缀，相对路径请求落到 SPA index.html 兜底（返回 HTML → r.json() 静默失败 → 组件死值）；vite.config.ts 补 `'/oss': 'http://localhost:3688'` 并重启 dev server，curl 验证返回 application/json | 用户发现 /oss/files/.../fake-data.json 返回不对 |
| 2026-09-20 | **表格组件绑定契约 + value 语义说明**：column-table → `{value_map:{"列label":[每行的值]}}`（列方向数组，resolveBind 按人控列序转置写回 rowsJson，__runBind 以表头文本为键转置重建 tbody；兼容旧 {headers, rowsJson} 契约）；row-table → `{value_map:{"行label":"值"}}`（与 StatGroup 共用 mergeValueMapByLabel，__runBind 以行首 th 文本为键回填 td）；契约新增"配置里 value 家族内容 = 占位显示 + 写给 AI 的语义说明，须返回按真实数据算出的展示值" | 用户需求：表格拆分绑定 + value 作为 AI 语义说明 |
| 2026-09-20 | **matrix-table 绑定契约**：AI 返回 `{value_map:{"行label":{"列label":"值"}}}`（嵌套 map，行列 label 均人控为键）；resolveBind 按配置行列序展开成 rowsJson（缺键补空串），__runBind 以表头/行首 th 文本为键逐格回填 td。行配置 cells 按列 label 携带每格取数说明，随 props 全量进提示词 | 用户需求：行列都指定的表格；行内逐格取数说明 |
