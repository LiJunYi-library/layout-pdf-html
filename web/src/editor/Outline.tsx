// 自定义大纲树：替代 Puck 默认 outline（其标签只支持组件级静态配置），
// 每行显示组件的 name 字段（人起的名称，便于在树里选中组件），点击选中并联动字段面板
import { createUsePuck } from '@puckeditor/core'
import { editorConfig } from './config'

const usePuck = createUsePuck()

const ROOT_ZONE = 'root:default-zone'
// 容器组件的插槽字段（决定树的层级下钻）
const SLOT_KEYS = new Set(['content', 'left', 'right', 'colA', 'colB', 'colC'])

interface TreeRow {
  id: string
  name: string
  depth: number
  index: number
  zone: string
}

function isComponentItem(value: unknown): value is { type: string; props: Record<string, unknown> } {
  return typeof value === 'object' && value !== null
    && 'type' in value && 'props' in value
    && typeof (value as { props: unknown }).props === 'object' && (value as { props: unknown }).props !== null
}

function collect(items: unknown, zone: string, depth: number, rows: TreeRow[]): void {
  if (!Array.isArray(items))
    return
  items.forEach((item, index) => {
    if (!isComponentItem(item))
      return
    const id = String(item.props.id ?? `${zone}:${index}`)
    const customName = typeof item.props.name === 'string' ? item.props.name.trim() : ''
    const typeLabel = (editorConfig.components as Record<string, { label?: string }>)[item.type]?.label ?? item.type
    rows.push({
      id,
      name: customName ? `${customName}（${typeLabel}）` : typeLabel,
      depth,
      index,
      zone,
    })
    for (const [key, value] of Object.entries(item.props)) {
      if (SLOT_KEYS.has(key))
        collect(value, `${id}:${key}`, depth + 1, rows)
    }
  })
}

export function CustomOutline() {
  const data = usePuck(s => s.appState.data)
  const itemSelector = usePuck(s => s.appState.ui.itemSelector)
  const dispatch = usePuck(s => s.dispatch)

  const rows: TreeRow[] = []
  collect(data.content, ROOT_ZONE, 0, rows)

  return (
    <div className="custom-outline">
      {rows.length === 0 && <p className="custom-outline-empty">暂无组件</p>}
      {rows.map(row => (
        <button
          key={`${row.zone}:${row.index}`}
          type="button"
          className={`custom-outline-row${
            itemSelector && itemSelector.index === row.index && (itemSelector.zone ?? ROOT_ZONE) === row.zone
              ? ' is-selected'
              : ''
          }`}
          style={{ paddingLeft: 10 + row.depth * 16 }}
          onClick={() => dispatch({
            type: 'setUi',
            ui: { itemSelector: { index: row.index, zone: row.zone } },
          })}
        >
          {row.name}
        </button>
      ))}
    </div>
  )
}
