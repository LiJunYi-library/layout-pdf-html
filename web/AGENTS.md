# web/ AGENTS.md — 前端局部规范

根目录 [AGENTS.md](../AGENTS.md) 的治理规则仍然适用，本文件只补充前端代码的局部约定。

## 页面结构

页面默认单文件放在 `src/pages/XxxPage.tsx`；当页面沉淀出自有组件时，升级为独立文件夹，组件放进页面私有的 `components/`，不提到全局 `src/components/`：

```
src/pages/XxxPage/
├── XxxPage.tsx        # 页面主体：状态、数据流、布局
├── types.ts           # 页面共享类型（可选）
└── components/        # 页面私有组件，每个组件一个文件夹
    └── XxxCard/
        ├── XxxCard.tsx
        ├── XxxCard.edit.tsx
        └── XxxCard.config.tsx
```

## 组件命名规范

每个组件一个同名文件夹，同一数据模型的组件按「角色后缀」拆分，文件名用点分隔，组件名用驼峰拼接：

| 文件 | 组件名 | 角色 |
|------|--------|------|
| `XxxCard.tsx` | `XxxCard` | 静态渲染（导出 HTML / 只读展示用，无任何编辑交互） |
| `XxxCard.edit.tsx` | `XxxCardEdit` | 编辑变体（拖拽、输入等交互，把编辑结果写回数据） |
| `XxxCard.config.tsx` | `XxxCardConfig` | 右侧配置面板（编辑该组件的数据配置） |
| `XxxCard.default.config.ts` | —（纯数据，非组件） | 组件默认配置：拖入/新增时的初始 `layout` 与 `content`，供组件栏使用 |
| `BaseCard.config.tsx` | `BaseCardConfig` | 公共配置（组件名称 `componentName` 等所有卡片共有项），通过 children 组合各 `XxxCardConfig` |

原则：

- **编辑与静态分离**：交互逻辑只存在于 `.edit` 组件；静态组件必须是纯渲染，保证 `renderToStaticMarkup` 可序列化导出。
- **数据即配置**：组件不私有持有业务数据，全部通过 props 传入；编辑结果通过回调写回上层 state（如 GridDemo 的 `contents`）。
- **统一 props 签名**：卡片组件接收 `{ id, content }` 两个 prop——`id` 是布局条目 id（layout 里的 `i`），`content` 是该条目的完整内容对象，组件内部自行取用字段；另接受可选 `children`（`content.script` / `content.style` 的注入点），必须渲染在 `.card-body` 内部末尾。
- **根节点挂数据属性**：每个卡片组件的根节点（`.card-body`）必须挂 `data-id={id}`、`data-name={content.name}` 和 `data-type={content.componentType}`。渲染和导出共用同一套组件，导出的 HTML 里凭 `[data-id]` 即可定位任意组件实例、`[data-type]` 可区分组件类型，供后续注入数据/后处理使用。
- 参考实现：`src/pages/GridDemo/`。

## 组件字段命名规范

`content` 上的字段按用途统一命名：

- **值字段**：组件的**业务数据**统一用 `value` 或 `value_xxx` 命名（如统计卡片的 `value`、多值场景用 `value_total` / `value_rate`）。与业务数据无关的字段不受此约束：外观/样式类配置（`color`、`title` 等）、纯文本内容（`text`）等维持自有命名。
- **提示词字段**：给 LLM 的提示词统一用 `prompt` 或 `prompt_xxx` 命名（如公共的 `prompt`、分用途的 `prompt_script` / `prompt_style`）。
