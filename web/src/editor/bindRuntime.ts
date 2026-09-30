// bindScript 运行时（非组件模块）：上下文、脚本执行、冒烟校验
import { createContext } from 'react'

export const EditorDocContext = createContext<{ documentId: number } | null>(null)

// 模板渲染模式：存为模板时 data-script 组件的 __DATA__ 注入写 Jinja 表达式而非静态 JSON
let templateMode = false

export function setTemplateMode(value: boolean): void {
  templateMode = value
}

export function isTemplateMode(): boolean {
  return templateMode
}

declare global {
  interface Window {
    __DATA__?: unknown
  }
}

// 有 bindScript 就执行（new Function('data', script)），返回对象合并覆盖 props；异常回退死值。
// 字段家族规范：label/note/icon 由人控制（配置），value/value_xxx 由 AI 控制（脚本）。
// stat-card / stat-group 严格执行该规范（只取脚本返回的 value 家族），其余组件整体合并。
export function resolveBind<T extends { bindScript?: string }>(props: T, componentType?: string): T {
  const script = props.bindScript
  if (!script || typeof window === 'undefined' || window.__DATA__ === undefined)
    return props
  try {
    const fn = new Function('data', script) as (data: unknown) => unknown
    const out = fn(window.__DATA__)
    if (out && typeof out === 'object') {
      const patch = { ...(out as Record<string, unknown>) }
      if (componentType === 'StatGroup' || componentType === 'RowTable') {
        // 对象组件：AI 返回 value_map{label: 值}，label 为键（人控），换序/改名天然对齐
        return mergeValueMapByLabel(props, componentType === 'StatGroup' ? 'items' : 'rows', patch.value_map)
      }
      if (componentType === 'MatrixTable') {
        // 动态列表格：行与列均人控，AI 返回 value_map{行label: {列label: 值}}，按配置行列序展开成 rowsJson
        const cfgRows = (props as Record<string, unknown>).rows
        const cfgCols = (props as Record<string, unknown>).columns
        const valueMap = patch.value_map
        if (Array.isArray(cfgRows) && Array.isArray(cfgCols) && valueMap && typeof valueMap === 'object') {
          const vm = valueMap as Record<string, unknown>
          const cells = cfgRows.map((r) => {
            const rowMap = vm[String((r as Record<string, unknown>).label ?? '')]
            return cfgCols.map((c) => {
              const v = rowMap && typeof rowMap === 'object'
                ? (rowMap as Record<string, unknown>)[String((c as Record<string, unknown>).label ?? '')]
                : undefined
              return v === undefined || v === null ? '' : String(v)
            })
          })
          return { ...props, rowsJson: JSON.stringify(cells) }
        }
        return props
      }
      if (componentType === 'ColumnTable') {
        // 列表格：AI 返回列方向 value_map{列label: [每行的值]}，按人控列序转置成行写回 rowsJson
        const cfgCols = (props as Record<string, unknown>).columns
        const valueMap = patch.value_map
        if (Array.isArray(cfgCols) && valueMap && typeof valueMap === 'object') {
          const colArrays = cfgCols.map((cfg) => {
            const v = (valueMap as Record<string, unknown>)[String((cfg as Record<string, unknown>).label ?? '')]
            return Array.isArray(v) ? v.map(String) : []
          })
          const rowCount = Math.max(0, ...colArrays.map(a => a.length))
          const rows = Array.from({ length: rowCount }, (_, r) => colArrays.map(a => a[r] ?? ''))
          return { ...props, rowsJson: JSON.stringify(rows) }
        }
        // 兼容旧契约 {headers, rowsJson}
        if (typeof patch.rowsJson === 'string')
          return { ...props, rowsJson: patch.rowsJson }
        return props
      }
      if (componentType === 'StatCard')
        return { ...props, ...pickValueFamily(patch) }
      return { ...props, ...patch }
    }
  } catch {
    // 脚本异常：保留字段死值，页面不崩
  }
  return props
}

// 只保留 value 家族字段（value / value_xxx），其余（label/note/icon…）以人配置为准
function pickValueFamily(patch: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(patch).filter(([key]) => key === 'value' || key.startsWith('value_')),
  )
}

// 对象组件通用合并：value_map{label: 值} 按 label 回填列表项的 value，键缺失保留配置值
function mergeValueMapByLabel<T>(props: T, listKey: string, valueMap: unknown): T {
  const cfgItems = (props as Record<string, unknown>)[listKey]
  if (!Array.isArray(cfgItems) || !valueMap || typeof valueMap !== 'object')
    return props
  return {
    ...props,
    [listKey]: cfgItems.map((cfg) => {
      const item = { ...(cfg as Record<string, unknown>) }
      const mapped = (valueMap as Record<string, unknown>)[String(item.label ?? '')]
      if (mapped !== undefined)
        item.value = mapped
      return item
    }),
  }
}

// 冒烟执行：返回 null 表示通过，否则返回错误描述（作为 feedback 喂回 LLM）
export function smokeTest(id: string, script: string): string | null {
  try {
    const fn = new Function('data', script) as (data: unknown) => unknown
    const out = fn(window.__DATA__)
    if (!out || typeof out !== 'object')
      return `组件 ${id}：脚本未返回对象（得到 ${typeof out}）`
    return null
  } catch (err) {
    return `组件 ${id}：${err instanceof Error ? err.message : String(err)}`
  }
}
