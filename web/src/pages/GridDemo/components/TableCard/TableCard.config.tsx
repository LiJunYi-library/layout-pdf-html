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
      value_rows: content.value_rows.map((row) => row.filter((_, i) => i !== ci)),
    })
  }

  const setCell = (ri: number, ci: number, value: string) =>
    onChange({
      ...content,
      // 按列数对齐补齐：行内格子可能少于列数，map 遍历不到的下标要能写入
      value_rows: content.value_rows.map((row, i) =>
        i === ri
          ? content.columns.map((_, j) => (j === ci ? value : (row[j] ?? '')))
          : row,
      ),
    })

  const addRow = () => onChange({ ...content, value_rows: [...content.value_rows, content.columns.map(() => '')] })

  const removeRow = (ri: number) => onChange({ ...content, value_rows: content.value_rows.filter((_, i) => i !== ri) })

  return (
    // 标题由 BaseCardConfig 统一渲染，这里只管表格专属配置
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, minWidth: 0 }}>
          标题
          <input
            style={{ flex: 1, minWidth: 0 }}
            value={content.title ?? ''}
            onChange={(e) => onChange({ ...content, title: e.target.value })}
          />
        </label>
        <select
          value={content.titlePosition ?? 'center'}
          onChange={(e) =>
            onChange({
              ...content,
              titlePosition: e.target.value as TableContent['titlePosition'],
            })
          }
        >
          <option value="left">左</option>
          <option value="center">中</option>
          <option value="right">右</option>
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <input
            type="checkbox"
            checked={content.showTitle ?? true}
            onChange={(e) => onChange({ ...content, showTitle: e.target.checked })}
          />
          展示
        </label>
      </div>
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
        {content.value_rows.map((row, ri) => (
          <div
            key={ri}
            style={{
              border: '1px solid #eee',
              borderRadius: 6,
              padding: 8,
              marginTop: 4,
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: '#888' }}>行 {ri + 1}</span>
              <button onClick={() => removeRow(ri)}>×</button>
            </div>
            {content.columns.map((col, ci) => (
              <label
                key={ci}
                style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#888' }}
              >
                <span
                  title={col}
                  style={{ width: 64, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {col || `列${ci + 1}`}
                </span>
                <input
                  style={{ flex: 1, minWidth: 0 }}
                  value={row[ci] ?? ''}
                  onChange={(e) => setCell(ri, ci, e.target.value)}
                />
              </label>
            ))}
          </div>
        ))}
        <button style={{ marginTop: 4 }} onClick={addRow}>添加行</button>
      </div>
    </div>
  )
}
