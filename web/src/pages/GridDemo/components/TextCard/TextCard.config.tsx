import type { TextContent } from '../../types'

export function TextCardConfig({ content, onChange }: { content: TextContent; onChange: (next: TextContent) => void }) {
  return (
    // 标题由 BaseCardConfig 统一渲染，这里只管文本专属配置
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        文本:
        <textarea
          style={{ width: '100%', boxSizing: 'border-box' }}
          rows={5}
          value={content.text}
          onChange={(e) => onChange({ ...content, text: e.target.value })}
        />
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        字号:
        <input
          type="number"
          min={1}
          style={{ width: 64 }}
          value={content.fontSize ?? ''}
          placeholder="13"
          onChange={(e) =>
            onChange({ ...content, fontSize: Number(e.target.value) || undefined })
          }
        />
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        字重:
        <input
          type="number"
          min={100}
          max={900}
          step={100}
          style={{ width: 64 }}
          value={content.fontWeight ?? ''}
          placeholder="400"
          onChange={(e) =>
            onChange({ ...content, fontWeight: Number(e.target.value) || undefined })
          }
        />
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        左右对齐:
        <select
          value={content.align ?? ''}
          onChange={(e) =>
            onChange({ ...content, align: (e.target.value || undefined) as TextContent['align'] })
          }
        >
          <option value="">无</option>
          <option value="left">左</option>
          <option value="center">中</option>
          <option value="right">右</option>
        </select>
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        上下对齐:
        <select
          value={content.valign ?? ''}
          onChange={(e) =>
            onChange({ ...content, valign: (e.target.value || undefined) as TextContent['valign'] })
          }
        >
          <option value="">无</option>
          <option value="top">上</option>
          <option value="middle">中</option>
          <option value="bottom">下</option>
        </select>
      </label>
    </div>
  )
}
