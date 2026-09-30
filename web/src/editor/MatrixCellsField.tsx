// 动态列表格（MatrixTable）的行内单元格说明字段：
// 列只配 label；每个行配置里跟随列配置动态生成 N 个输入格，
// 每格写该单元格「取数说明」（写给 AI 的语义），存为 {列label: 说明}
import { createUsePuck } from '@puckeditor/core'

const usePuck = createUsePuck()

export function MatrixCellsField({ value, onChange }: {
  value?: Record<string, string>
  onChange: (v: Record<string, string>) => void
}) {
  const selectedItem = usePuck(s => s.selectedItem)
  const columns = (selectedItem?.props as { columns?: { label: string }[] } | undefined)?.columns ?? []
  const cells = value ?? {}
  if (columns.length === 0)
    return <div className="bind-status">请先在组件字段里配置列</div>
  return (
    <div className="matrix-cells">
      {columns.map((col, i) => (
        <label key={i} className="matrix-cell-field">
          <span className="matrix-cell-label">{col.label || `列 ${i + 1}`}</span>
          <textarea
            rows={1}
            value={cells[col.label] ?? ''}
            onChange={e => onChange({ ...cells, [col.label]: e.target.value })}
          />
        </label>
      ))}
    </div>
  )
}
