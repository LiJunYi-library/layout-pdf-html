import { useState } from 'react'
import type { PieContent } from '../../types'

export function PieCardConfig({ content, onChange }: { content: PieContent; onChange: (next: PieContent) => void }) {
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

  return (
    // 标题由 BaseCardConfig 统一渲染，这里只管饼图专属配置
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
              titlePosition: e.target.value as PieContent['titlePosition'],
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
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          单位:
          <input
            style={{ width: 56 }}
            value={content.unit ?? ''}
            placeholder="如:人"
            onChange={(e) => onChange({ ...content, unit: e.target.value })}
          />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <input
            type="checkbox"
            checked={content.showValue ?? true}
            onChange={(e) => onChange({ ...content, showValue: e.target.checked })}
          />
          显示数值
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <input
            type="checkbox"
            checked={content.showPercent ?? true}
            onChange={(e) => onChange({ ...content, showPercent: e.target.checked })}
          />
          显示百分比
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          数值位置
          <select
            value={content.labelPosition ?? 'outside'}
            onChange={(e) =>
              onChange({
                ...content,
                labelPosition: e.target.value as PieContent['labelPosition'],
              })
            }
          >
            <option value="outside">线</option>
            <option value="inside">饼图内部</option>
          </select>
        </label>
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          内圈半径
          <input
            type="number"
            min={0}
            max={100}
            style={{ width: 56 }}
            value={content.innerRadius ?? 0}
            onChange={(e) =>
              onChange({ ...content, innerRadius: Math.max(0, Math.min(100, Number(e.target.value))) })
            }
          />
          %
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          外圈半径
          <input
            type="number"
            min={0}
            max={100}
            style={{ width: 56 }}
            value={content.outerRadius ?? 74}
            onChange={(e) =>
              onChange({ ...content, outerRadius: Math.max(0, Math.min(100, Number(e.target.value))) })
            }
          />
          %
        </label>
        <span style={{ fontSize: 12, color: '#888' }}>内圈 &gt; 0 时为环形图</span>
      </div>
      <div>
        <strong>数据</strong>
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
              display: 'flex',
              gap: 4,
              marginTop: 4,
              alignItems: 'center',
              opacity: dragIndex === i ? 0.4 : 1,
            }}
          >
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
              value={item.name}
              placeholder="名称"
              onChange={(e) =>
                onChange({
                  ...content,
                  value: items.map((v, j) => (j === i ? { ...v, name: e.target.value } : v)),
                })
              }
            />
            <input
              type="number"
              style={{ width: 72 }}
              value={item.value}
              onChange={(e) =>
                onChange({
                  ...content,
                  value: items.map((v, j) => (j === i ? { ...v, value: Number(e.target.value) } : v)),
                })
              }
            />
            <input
              type="color"
              title="扇区颜色"
              value={item.color ?? '#5470c6'}
              onChange={(e) =>
                onChange({
                  ...content,
                  value: items.map((v, j) => (j === i ? { ...v, color: e.target.value } : v)),
                })
              }
              style={{ width: 28, height: 28, padding: 0, border: '1px solid #ddd', borderRadius: 4, cursor: 'pointer' }}
            />
            <button onClick={() => onChange({ ...content, value: items.filter((_, j) => j !== i) })}>
              ×
            </button>
          </div>
        ))}
        <button
          style={{ marginTop: 4 }}
          onClick={() =>
            onChange({ ...content, value: [...items, { name: `项${items.length + 1}`, value: 1 }] })
          }
        >
          添加数据项
        </button>
      </div>
    </div>
  )
}
