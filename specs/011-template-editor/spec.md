# 规格：自定义 PDF 模板编辑器（Puck 拖拽编辑页）

- 状态：已实现
- 创建日期：2026-09-18

## 用户场景

运营要为定制化要求高的团体报告做模板。AI 对话生成满足不了"像素级自定义"的场景，需要一个可视化编辑器：把组件（标题、统计卡片、环形图、表格等）直接拖进 A4 画布，实时看到效果，完成后导出静态 HTML 文件。导出的 HTML 之后要喂给大模型，让 agent 转成带数据占位的 Jinja 模板——因此每个组件必须带 `data-*` 语义标注说明数据从哪儿来。

demo 阶段不接入数据库：编辑内容存 localStorage，产物就是导出的 .html 文件。

## 功能需求

- FR-1：新路由 `/editor`，使用 Puck（@puckeditor/core，MIT）实现拖拽编辑器，嵌入现有 React 应用；导航栏加入口。
- FR-2：A4 画布：编辑区内容宽度固定 210mm，与线上渲染契约一致。
- FR-3：自定义组件集（每个组件 = React 渲染 + Puck 字段配置 + data-\* 标注）：
  - 标题、文本、统计卡片、环形图、柱状图、表格、间距
  - 图表组件用 ECharts SSR 模式渲染 SVG（`renderer:'svg', ssr:true` + `renderToSVGString`），编辑预览与导出同一份 SVG，无 canvas/script 依赖
  - 环形图 label 遵循 specs 表默认规范：formatter 显示 名字+换行+值/总数(百分比)，无 tooltip 无 legend，关闭动画
- FR-4：每个组件外层容器带 `data-component`（组件类型）、`data-source`（数据来源路径）、`data-map`（中文聚合/计算说明）三个自定义属性，值来自 Puck 字段，运营可编辑。
- FR-5：编辑内容自动持久化到 localStorage（demo 阶段唯一存储），刷新不丢。
- FR-6：导出 HTML 按钮：用 `renderToStaticMarkup(<Render/>)` 生成真标签静态 HTML（非 SPA 壳），拼上内联 A4 基础样式，图表为内联 SVG，整文件无 JS 依赖，Blob 下载为 .html。
- FR-7：demo 数据：组件字段自带默认示例值（死值），与 fake-data 结构呼应（完成率、班级统计等）。

## 验收标准

- AC-1：`/editor` 打开 Puck 编辑器，组件面板可拖拽组件进画布并实时渲染。（手动验证，对应 FR-1/2/3）
- AC-2：导出按钮下载 .html，直接双击打开可见完整排版与图表；查看源码无 React 运行时、无 echarts 脚本引用、图表为 `<svg>`。（对应 FR-6）
- AC-3：导出 HTML 源码中每个组件容器含 `data-component`/`data-source`/`data-map` 属性。（grep 验证，对应 FR-4）
- AC-4：刷新页面编辑内容保持（localStorage）。（对应 FR-5）
- AC-5：`pnpm -C web build && pnpm -C web lint` 通过。

## 非目标（Out of Scope）

- 不接数据库、不接 fake-oss、不做多模板管理。
- 不做"导出的 HTML → Jinja 模板"的 agent 转换（后续规格）。
- 不做图片上传/素材库。
- 不做绝对定位自由画布（Puck 区块流式布局即可）。
- 不改动现有 /layout 对话页与 agent。

## 变更记录

| 日期 | 变更 | 原因 |
|------|------|------|
| 2026-09-18 | 初版 | 用户讨论结论：Puck 拖拽编辑 + data-\* 语义标注 + 静态 HTML 导出（SVG 图表），demo 阶段 localStorage |
| 2026-09-18 | 已实现：/editor 路由 + Puck 0.23（@puckeditor/core/puck.css 新导出路径）；7 个组件（标题/文本/统计卡片/环形图/柱状图/表格/间距）全部带 data-component/data-source/data-map 标注；图表走 ECharts 6 SSR SVG（Node 实测 renderToSVGString 正常、label 含 值/总数(百分比)）；导出 = renderToStaticMarkup + 内联 A4 样式，无 JS 依赖；localStorage 持久化 + 重置按钮；门禁 build+lint 通过（Block 拆独立文件消 fast-refresh warning） | AC-5 已验；AC-1/2/3/4 需浏览器手动确认 |
| 2026-09-18 | 编辑器放开 .app 最大宽度撑满视口；新增布局能力：两栏/三栏容器组件（Slot 嵌套拖放、比例可调、栏内纵向堆叠）、统计卡片组组件（array 字段一行 N 卡、emoji 图标）、环形图/柱状图加高度字段（宽度由栏比例控制） | 复杂报告布局需要嵌套容器（右栏上下堆叠平顶铺做不到） |
| 2026-09-18 | 新增页编辑：「页面」容器组件（Slot 拖放区 + 页面名称字段，名称仅编辑时显示导出隐藏），一页 = 一张 210mm×297mm A4；导出 HTML 每页一个 .tpl-page 并带 @media print 分页规则（page-break-after: always）；画布从单页 A4 改为灰底多页堆叠；示例数据重组为 页面→卡片组→两栏(环图|柱图+表格) | PDF 打印按页组织，页模型与线上渲染契约 .page 对齐 |
| 2026-09-18 | 标题组件并入文本组件（标题=大字号加粗居中的文本默认值）：文本组件新增字体大小/字重/对齐/颜色字段；localStorage 迁移：旧 Heading 自动转 Text（32px 加粗居中 #1e3a5f），旧 Text 补默认样式字段，旧数据补 height 默认 260 | 用户反馈：标题与文本是相同功能，只是默认值不同 |
| 2026-09-18 | 文本组件再加字段：行高（倍数，默认 1.8）、字体下拉（黑体系/宋体系/楷体/等宽，均为浏览器与系统自带字体栈，不引外部字体文件）、字形（正常/斜体） | 用户反馈：文本需要行高、font-family、font-style 控制 |
| 2026-09-18 | 组件面板改为 categories 分组（文本/数据/图表/布局）；「标题」作为文本组件的预设变体回归：textFields/renderText 完全复用，仅 defaultProps 为 32px 加粗居中 #1e3a5f；迁移逻辑区分新旧 Heading 结构（props.text 旧结构→Text，props.content 新结构不动） | 用户反馈：树形分组 + 标题属于文本的预设，运营免调参 |
| 2026-09-18 | 行高从倍数改为像素：默认正文 25px、标题 40px；迁移：旧倍数（<10）按 fontSize×倍数 换算成像素 | 用户反馈：行高用像素更直观 |
| 2026-09-18 | 行高改为自由字符串（默认 normal，可填 倍数/px 等任意 CSS 值）；迁移：数字统一转 'Npx' 字符串 | 用户反馈：行高不限定为数字 |
| 2026-09-18 | 间距组件编辑器内可见化（虚线框+「间距 Npx」提示，导出/打印隐藏辅助样式只留高度）——修复"刷新后间距没了"实为白底不可见；Puck 头部注入显式「保存」按钮（useGetPuck 读实时状态写 localStorage，onChange 自动保存之外的第二道保险） | 用户反馈 bug + 要求显式保存 |
| 2026-09-18 | **修复"刷新后全部编辑丢失回退演示数据"重大 bug**：migrateItems 对 StatGroup.items（无 props 的普通对象数组）递归时 Object.values(undefined) 抛 TypeError，loadData catch 静默回退 initialData——数据从未丢失（localStorage 完好），是读取时迁移抛错回退。修复：迁移只处理含 type+props 的组件元素（isComponentItem 守卫），普通数据数组跳过。Puck 预览 iframe 曾短暂关闭排查，确认无关后已恢复默认（iframe 渲染 + 视口切换可用） | 用户现场数据 + jsdom 复现定位；用户"默认数据覆盖"的怀疑方向正确 |
| 2026-09-18 | 新增「标签值行」组件（info-line）：emoji 图标 + 标签 + 值均可配置，值的数据来源/计算说明走 data-source/data-map 标注（默认：组织名称+'录入测评人员'）；归入"数据"分组 | 用户需求：报告对象行可配置 |
| 2026-09-18 | 全组件统一加 8 个间距字段（上/下/左/右 × 外/内边距，默认 0/0/16/0 + 全 0，保持原 .tpl-block 观感）；字段面板顺序重排：数据来源、计算说明固定第 1、2 位，组件字段居中，间距字段末尾；间距走 Block 内联 style，.tpl-block 的固定 margin-bottom 从两处 CSS 移除；旧数据迁移补默认间距，initialData 也过迁移 | 用户需求：组件间距可调 + 标注字段前置 |
| 2026-09-20 | **表格拆分为列表格/行表格 + value 字段语义化**：DataTable 组件拆为 ColumnTable（列表格：columns 列配置，每项 label 表头 + value 列说明）与 RowTable（行表格：rows 行配置，每项 label 标签 + value 说明）；同时 StatCard/StatGroup/InfoLine 的 value 字段全部改为文本域（textarea），语义从"死值占位"升级为"占位显示 + 写给 AI 的语义说明"（描述该值应算什么）；旧数据迁移 DataTable→ColumnTable（headers 逗号拆分转 columns，rowsJson 保留为占位行数据） | 用户需求：表格分两类组件；value 是给 AI 理解的说明（如"学习压力异常的人数，指标分数>2 算异常"） |
| 2026-09-20 | 组件面板新增「表格」分组：列表格/行表格从「数据」移入（Puck 未归入任何分组的组件会落到 OTHER）；DataTable 组件定义已随拆分删除（截图中残留为 HMR 旧模块，刷新即消失）；后续嵌套表格/树形表格归入此分组 | 用户需求：表格独立分组，不叫 Other |
| 2026-09-20 | 数组字段折叠摘要跟随 label：全部 5 个数组字段（StatGroup.items、列表格.columns、行表格.rows、动态列表格.columns/.rows）加 `getItemSummary`，面板里折叠项显示 label（空则"（未命名）"），不再是 "Item #N" | 用户反馈：不要叫 Item #0 |
| 2026-09-20 | 新增「动态列表格」组件（MatrixTable）：列只配 label；行配 label + cells——自定义字段 MatrixCellsField 跟随列配置动态生成 N 个输入格，每格写该单元格的取数说明（存 {列label: 说明}）；rowsJson 为 AI 展开结果（字段面板不暴露）；默认示例为指标统计表（学习压力/焦虑/情绪不稳定 × 有效N/平均分/关注人数/关注率/重点关注人数/重点关注率）。初名「行列表格」，同日更名「动态列表格」（仅显示名，类型标识 MatrixTable 不变） | 用户需求：行列都指定的表格；行内按列逐格写取数说明 |
