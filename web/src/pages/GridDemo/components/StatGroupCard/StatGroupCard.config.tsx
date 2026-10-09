import { useState } from 'react'
import type { StatGroupContent, StatGroupItem } from '../../types'

const LAYOUTS = [
  { value: 'tb', label: '上下' },
  { value: 'lr', label: '左右' },
  { value: 'bt', label: '下上' },
  { value: 'rl', label: '右左' },
] as const

export function StatGroupCardConfig({ content, onChange }: { content: StatGroupContent; onChange: (next: StatGroupContent) => void }) {
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [armed, setArmed] = useState(false)
  const items = content.value ?? []

  const move = (from: number, to: number) => {
    if (from === to) return
    const next = [...items]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    onChange({ ...content, value: next })
  }

  const setItem = (i: number, patch: Partial<StatGroupItem>) =>
    onChange({
      ...content,
      value: items.map((v, j) => (j === i ? { ...v, ...patch } : v)),
    })

  return (
    // 标题由 BaseCardConfig 统一渲染，这里只管统计卡片组专属配置
    <div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <strong>统计项</strong>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#888' }}>
          对齐
          <select
            value={content.align ?? 'center'}
            onChange={(e) =>
              onChange({ ...content, align: e.target.value as StatGroupContent['align'] })
            }
          >
            <option value="left">左</option>
            <option value="center">中</option>
            <option value="right">右</option>
          </select>
        </label>
      </div>
      {items.map((item, i) => (
        <div
          key={i}
          draggable={armed}
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = 'move'
            setDragIndex(i)
          }}
          onDragEnd={() => {
            setDragIndex(null)
            setArmed(false)
          }}
          onDragOver={(e) => {
            e.preventDefault()
            if (dragIndex != null && dragIndex !== i) {
              move(dragIndex, i)
              setDragIndex(i)
            }
          }}
          style={{
            border: '1px solid #eee',
            borderRadius: 6,
            padding: 8,
            marginTop: 4,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            opacity: dragIndex === i ? 0.4 : 1,
          }}
        >
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <span
              style={{ cursor: 'grab', color: '#aaa', userSelect: 'none' }}
              title="按住拖拽排序"
              onMouseDown={() => setArmed(true)}
              onMouseUp={() => setArmed(false)}
            >
              ⠿
            </span>
            <input
              style={{ flex: 1, minWidth: 0 }}
              value={item.label}
              placeholder="label"
              onChange={(e) => setItem(i, { label: e.target.value })}
            />
            <input
              style={{ flex: 1, minWidth: 0 }}
              value={item.value}
              placeholder="value"
              onChange={(e) => setItem(i, { value: e.target.value })}
            />
            <button onClick={() => onChange({ ...content, value: items.filter((_, j) => j !== i) })}>
              ×
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#888' }}>
              布局
              <select
                value={item.layout ?? 'tb'}
                onChange={(e) =>
                  setItem(i, { layout: e.target.value as StatGroupItem['layout'] })
                }
              >
                {LAYOUTS.map((l) => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
              </select>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#888' }}>
              分隔符号
              <input
                style={{ width: 56 }}
                value={item.separator ?? ''}
                placeholder="留空无"
                onChange={(e) => setItem(i, { separator: e.target.value })}
              />
            </label>
          </div>
        </div>
      ))}
      <button
        style={{ marginTop: 4 }}
        onClick={() =>
          onChange({ ...content, value: [...items, { label: `项${items.length + 1}`, value: '0' }] })
        }
      >
        添加统计项
      </button>
    </div>
  )
}
