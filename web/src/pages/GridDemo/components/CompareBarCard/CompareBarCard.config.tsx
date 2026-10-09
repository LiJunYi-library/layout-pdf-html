import { useState } from 'react'
import type { CompareBarContent, CompareBarItem } from '../../types'

// 单个指标卡片：名称 + 本班/同年级值 + 重点关注率副行 + 差异覆盖，按住 ⠿ 手柄拖拽排序
function ItemCard({
  item,
  unit,
  dragging,
  armed,
  onChange,
  onRemove,
  onDragStart,
  onDragEnd,
  onDragOver,
  onArm,
  onDisarm,
}: {
  item: CompareBarItem
  unit: string
  dragging: boolean
  armed: boolean
  onChange: (patch: Partial<CompareBarItem>) => void
  onRemove: () => void
  onDragStart: () => void
  onDragEnd: () => void
  onDragOver: () => void
  onArm: () => void
  onDisarm: () => void
}) {
  const numInput = (
    label: string,
    field: 'value_a' | 'value_b' | 'value_a_sub' | 'value_b_sub',
  ) => (
    <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#888' }}>
      {label}
      <input
        type="number"
        step="0.1"
        style={{ width: 64 }}
        value={item[field] ?? ''}
        onChange={(e) => {
          const v = e.target.value
          onChange({ [field]: v === '' ? undefined : Number(v) })
        }}
      />
    </label>
  )

  return (
    <div
      draggable={armed}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move'
        onDragStart()
      }}
      onDragEnd={onDragEnd}
      onDragOver={(e) => {
        e.preventDefault()
        onDragOver()
      }}
      style={{
        border: '1px solid #eee',
        borderRadius: 6,
        padding: 8,
        marginTop: 4,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        opacity: dragging ? 0.4 : 1,
      }}
    >
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <span
          style={{ cursor: 'grab', color: '#aaa', userSelect: 'none' }}
          title="按住拖拽排序"
          onMouseDown={onArm}
          onMouseUp={onDisarm}
        >
          ⠿
        </span>
        <input
          style={{ flex: 1, minWidth: 0 }}
          value={item.name}
          placeholder="指标名"
          onChange={(e) => onChange({ name: e.target.value })}
        />
        <button onClick={onRemove}>×</button>
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        {numInput('本班', 'value_a')}
        {numInput('同年级', 'value_b')}
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        {numInput(`重点本班${unit}`, 'value_a_sub')}
        {numInput(`重点同年级${unit}`, 'value_b_sub')}
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#888' }}>
        差异覆盖
        <input
          style={{ width: 96 }}
          value={item.diff ?? ''}
          placeholder="自动"
          title="留空按 本班-同年级 自动计算（如 +7.0pct）"
          onChange={(e) => onChange({ diff: e.target.value || undefined })}
        />
      </label>
    </div>
  )
}

export function CompareBarCardConfig({ content, onChange }: { content: CompareBarContent; onChange: (next: CompareBarContent) => void }) {
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [armed, setArmed] = useState(false)

  const setItem = (i: number, patch: Partial<CompareBarItem>) =>
    onChange({
      ...content,
      value: content.value.map((it, j) => (j === i ? { ...it, ...patch } : it)),
    })

  const addItem = () =>
    onChange({
      ...content,
      value: [...content.value, { name: `指标${content.value.length + 1}`, value_a: 25, value_b: 20 }],
    })

  const removeItem = (i: number) =>
    onChange({ ...content, value: content.value.filter((_, j) => j !== i) })

  const moveItem = (from: number, to: number) => {
    const next = [...content.value]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    onChange({ ...content, value: next })
  }

  const colorInput = (label: string, field: 'color_a' | 'color_b' | 'colorUp' | 'colorDown', fallback: string) => (
    <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#888' }}>
      {label}
      <input
        type="color"
        value={content[field] ?? fallback}
        onChange={(e) => onChange({ ...content, [field]: e.target.value })}
        style={{ width: 28, height: 28, padding: 0, border: '1px solid #ddd', borderRadius: 4, cursor: 'pointer' }}
      />
    </label>
  )

  return (
    // 标题由 BaseCardConfig 统一渲染，这里只管对比条形图专属配置
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
          value={content.titlePosition ?? 'left'}
          onChange={(e) =>
            onChange({ ...content, titlePosition: e.target.value as CompareBarContent['titlePosition'] })
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
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#888' }}>
          系列A
          <input
            style={{ width: 88 }}
            value={content.name_a ?? ''}
            placeholder="本班关注率"
            onChange={(e) => onChange({ ...content, name_a: e.target.value || undefined })}
          />
        </label>
        {colorInput('颜色', 'color_a', '#2f6bff')}
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#888' }}>
          系列B
          <input
            style={{ width: 88 }}
            value={content.name_b ?? ''}
            placeholder="同年级关注率"
            onChange={(e) => onChange({ ...content, name_b: e.target.value || undefined })}
          />
        </label>
        {colorInput('颜色', 'color_b', '#a3c0f5')}
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#888' }}>
          单位
          <input
            style={{ width: 48 }}
            value={content.unit ?? ''}
            placeholder="%"
            onChange={(e) => onChange({ ...content, unit: e.target.value || undefined })}
          />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#888' }}>
          柱宽
          <input
            style={{ width: 56 }}
            value={content.barWidth ?? ''}
            placeholder="14"
            onChange={(e) => onChange({ ...content, barWidth: e.target.value || undefined })}
          />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <input
            type="checkbox"
            checked={content.showSub ?? true}
            onChange={(e) => onChange({ ...content, showSub: e.target.checked })}
          />
          副行（重点关注率）
        </label>
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <input
            type="checkbox"
            checked={content.showDiff ?? true}
            onChange={(e) => onChange({ ...content, showDiff: e.target.checked })}
          />
          差异列
        </label>
        {(content.showDiff ?? true) && (
          <>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, minWidth: 0, fontSize: 12, color: '#888' }}>
              差异标题
              <input
                style={{ flex: 1, minWidth: 0 }}
                value={content.diffTitle ?? ''}
                placeholder="与同年级差异\n（百分点）"
                onChange={(e) => onChange({ ...content, diffTitle: e.target.value || undefined })}
              />
            </label>
            {colorInput('正值', 'colorUp', '#f5222d')}
            {colorInput('负值', 'colorDown', '#8c8c8c')}
          </>
        )}
      </div>
      <div>
        <strong>指标</strong>
        {content.value.map((it, i) => (
          <ItemCard
            key={i}
            item={it}
            unit={content.unit ?? '%'}
            dragging={dragIndex === i}
            armed={armed}
            onChange={(patch) => setItem(i, patch)}
            onRemove={() => removeItem(i)}
            onDragStart={() => setDragIndex(i)}
            onDragEnd={() => {
              setDragIndex(null)
              setArmed(false)
            }}
            onDragOver={() => {
              if (dragIndex != null && dragIndex !== i) {
                moveItem(dragIndex, i)
                setDragIndex(i)
              }
            }}
            onArm={() => setArmed(true)}
            onDisarm={() => setArmed(false)}
          />
        ))}
        <button style={{ marginTop: 4 }} onClick={addItem}>添加指标</button>
      </div>
    </div>
  )
}
