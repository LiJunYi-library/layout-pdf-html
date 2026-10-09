import type { StatContent } from '../../types'

export function StatCardConfig({ content, onChange }: { content: StatContent; onChange: (next: StatContent) => void }) {
  return (
    // 标题由 BaseCardConfig 统一渲染，这里只管统计卡片专属配置
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        标题:
        <input
          style={{ flex: 1, minWidth: 0 }}
          value={content.title ?? ''}
          onChange={(e) => onChange({ ...content, title: e.target.value })}
        />
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        数值:
        <input
          style={{ flex: 1, minWidth: 0 }}
          value={content.value}
          onChange={(e) => onChange({ ...content, value: e.target.value })}
        />
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        颜色:
        <input
          type="color"
          value={content.color}
          onChange={(e) => onChange({ ...content, color: e.target.value })}
        />
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        对齐:
        <select
          value={content.align ?? 'left'}
          onChange={(e) =>
            onChange({ ...content, align: e.target.value as StatContent['align'] })
          }
        >
          <option value="left">左</option>
          <option value="center">中</option>
          <option value="right">右</option>
        </select>
      </label>
    </div>
  )
}
