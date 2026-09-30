import type { TableContent } from '../../types'

export  function TableCardConfig({ content, onChange }: { content: TableContent; onChange: (next: TableContent) => void }) {
  const setColumn = (ci: number, value: string) =>
    onChange({ ...content, columns: content.columns.map((c, i) => (i === ci ? value : c)) })

  const addColumn = () => {
    const share = 100 / (content.columns.length + 1)
    onChange({
      ...content,
      columns: [...content.columns, `列${content.columns.length + 1}`],
      colWidths: [...content.colWidths.map((w) => (w * (100 - share)) / 100), share],
    })
  }

  const removeColumn = (ci: number) => {
    const widths = content.colWidths.filter((_, i) => i !== ci)
    const total = widths.reduce((s, w) => s + w, 0)
    onChange({
      ...content,
      columns: content.columns.filter((_, i) => i !== ci),
      colWidths: widths.map((w) => (w / total) * 100),
      rows: content.rows.map((row) => row.filter((_, i) => i !== ci)),
    })
  }

  const setCell = (ri: number, ci: number, value: string) =>
    onChange({
      ...content,
      rows: content.rows.map((row, i) => (i === ri ? row.map((c, j) => (j === ci ? value : c)) : row)),
    })

  const addRow = () => onChange({ ...content, rows: [...content.rows, content.columns.map(() => '')] })

  const removeRow = (ri: number) => onChange({ ...content, rows: content.rows.filter((_, i) => i !== ri) })

  return (
    // 标题由 BaseCardConfig 统一渲染，这里只管表格专属配置
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <strong>列</strong>
        {content.columns.map((col, ci) => (
          <div key={ci} style={{ display: 'flex', gap: 4, marginTop: 4, alignItems: 'center' }}>
            <input style={{ flex: 1, minWidth: 0 }} value={col} onChange={(e) => setColumn(ci, e.target.value)} />
            <small style={{ width: 44, color: '#888' }}>{content.colWidths[ci]?.toFixed(0)}%</small>
            <button onClick={() => removeColumn(ci)}>×</button>
          </div>
        ))}
        <button style={{ marginTop: 4 }} onClick={addColumn}>添加列</button>
        <div style={{ marginTop: 4, color: '#888', fontSize: 12 }}>拖拽表格列边界调整宽度</div>
      </div>
      <div>
        <strong>行</strong>
        {content.rows.map((row, ri) => (
          <div key={ri} style={{ display: 'flex', gap: 4, marginTop: 4 }}>
            {content.columns.map((_, ci) => (
              <input
                key={ci}
                style={{ flex: 1, minWidth: 0 }}
                value={row[ci] ?? ''}
                onChange={(e) => setCell(ri, ci, e.target.value)}
              />
            ))}
            <button onClick={() => removeRow(ri)}>×</button>
          </div>
        ))}
        <button style={{ marginTop: 4 }} onClick={addRow}>添加行</button>
      </div>
    </div>
  )
}
