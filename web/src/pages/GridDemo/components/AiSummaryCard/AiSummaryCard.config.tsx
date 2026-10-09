import type { AiSummaryContent, Content } from '../../types'

export function AiSummaryCardConfig({
  content,
  contents,
  selfId,
  onChange,
}: {
  content: AiSummaryContent
  /** 当前页全部组件（用于勾选参与总结的组件） */
  contents: Record<string, Content>
  selfId: string
  onChange: (next: AiSummaryContent) => void
}) {
  const refs = content.refs ?? []
  const toggleRef = (id: string, checked: boolean) =>
    onChange({
      ...content,
      refs: checked ? [...refs, id] : refs.filter((r) => r !== id),
    })

  return (
    // 标题由 BaseCardConfig 统一渲染，这里只管 AI 总结专属配置
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        总结文本:
        <textarea
          style={{ width: '100%', boxSizing: 'border-box' }}
          rows={6}
          value={content.value}
          onChange={(e) => onChange({ ...content, value: e.target.value })}
        />
      </label>
      <div>
        <strong>参与总结的组件</strong>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
          {Object.entries(contents)
            .filter(([id]) => id !== selfId)
            .map(([id, c]) => (
              <label key={id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <input
                  type="checkbox"
                  checked={refs.includes(id)}
                  onChange={(e) => toggleRef(id, e.target.checked)}
                />
                {c.name || c.componentName}
                <span style={{ fontSize: 12, color: '#888' }}>({c.componentName})</span>
              </label>
            ))}
          {Object.keys(contents).length <= 1 && (
            <div style={{ fontSize: 12, color: '#888' }}>页面上还没有其他组件</div>
          )}
        </div>
      </div>
    </div>
  )
}
