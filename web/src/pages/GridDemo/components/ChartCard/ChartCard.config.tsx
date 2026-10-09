import { useState } from 'react'
import type { ChartContent, ChartSeriesItem } from '../../types'
import { ListEditor } from '../ListEditor/ListEditor'

const SERIES_TYPES = ['bar', 'line']

// 新系列/新类目的默认值：20~30 随机整数
const randomValue = () => 20 + Math.floor(Math.random() * 11)

// 数组 from 移到 to（类目排序时同步系列数据用）
function moveItem<T>(arr: T[], from: number, to: number): T[] {
  const next = [...arr]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}

// 单个系列卡片：名称/type/删除 + 数据区可展开收缩
function SeriesCard({
  series,
  categoryData,
  stackOptions,
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
  series: ChartSeriesItem
  categoryData: string[]
  stackOptions: string[]
  dragging: boolean
  armed: boolean
  onChange: (patch: Partial<ChartSeriesItem>) => void
  onRemove: () => void
  onDragStart: () => void
  onDragEnd: () => void
  onDragOver: () => void
  onArm: () => void
  onDisarm: () => void
}) {
  const [expanded, setExpanded] = useState(false)

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
          value={series.name}
          placeholder="系列名"
          onChange={(e) => onChange({ name: e.target.value })}
        />
        <select
          value={series.type ?? 'bar'}
          onChange={(e) => onChange({ type: e.target.value })}
        >
          {SERIES_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <input
          type="color"
          title="系列颜色"
          value={series.color ?? '#5470c6'}
          onChange={(e) => onChange({ color: e.target.value })}
          style={{ width: 28, height: 28, padding: 0, border: '1px solid #ddd', borderRadius: 4, cursor: 'pointer' }}
        />
        <button onClick={onRemove}>×</button>
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#888' }}>
          堆叠
          <select
            value={series.stack ?? ''}
            onChange={(e) => {
              const v = e.target.value
              if (v === '__new__') {
                // 生成未被占用的组名
                let n = stackOptions.length + 1
                while (stackOptions.includes(`堆叠${n}`)) n++
                onChange({ stack: `堆叠${n}` })
              } else {
                onChange({ stack: v || undefined })
              }
            }}
          >
            <option value="">不堆叠</option>
            {stackOptions.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
            <option value="__new__">+ 新建堆叠组</option>
          </select>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#888' }}>
          柱宽
          <input
            style={{ width: 64 }}
            value={series.barWidth ?? '40%'}
            placeholder="如 30 或 60%"
            title="像素值（30）或百分比（60%），留空走图表默认均分"
            onChange={(e) => onChange({ barWidth: e.target.value || undefined })}
          />
        </label>
      </div>
      <div>
        <button
          style={{ padding: 0, border: 'none', background: 'none', color: '#888', fontSize: 12, cursor: 'pointer' }}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? '▾' : '▸'} 数据（{series.data.length}）
        </button>
        {expanded ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
            {categoryData.map((cat, ci) => (
              <input
                key={ci}
                type="number"
                title={cat}
                style={{ width: 56 }}
                value={series.data[ci] ?? 0}
                onChange={(e) =>
                  onChange({
                    data: series.data.map((v, j) => (j === ci ? Number(e.target.value) : v)),
                  })
                }
              />
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: '#888', marginTop: 2, wordBreak: 'break-all' }}>
            {series.data.join(', ')}
          </div>
        )}
      </div>
    </div>
  )
}

export function ChartCardConfig({ content, onChange }: { content: ChartContent; onChange: (next: ChartContent) => void }) {
  // 系列卡片拖拽排序状态
  const [seriesDragIndex, setSeriesDragIndex] = useState<number | null>(null)
  const [seriesArmed, setSeriesArmed] = useState(false)

  const setSeries = (si: number, patch: Partial<ChartSeriesItem>) =>
    onChange({
      ...content,
      series: content.series.map((s, i) => (i === si ? { ...s, ...patch } : s)),
    })

  // 新系列数据随机生成 20~30，数量跟随类目
  const addSeries = () =>
    onChange({
      ...content,
      series: [
        ...content.series,
        { name: `系列${content.series.length + 1}`, type: 'bar', data: content.categoryData.map(randomValue) },
      ],
    })

  const removeSeries = (si: number) =>
    onChange({ ...content, series: content.series.filter((_, i) => i !== si) })

  const moveSeries = (from: number, to: number) =>
    onChange({ ...content, series: moveItem(content.series, from, to) })

  // 类目结构变更时，系列数据同步增删/换位，保持一一对应
  const addCategory = () =>
    onChange({
      ...content,
      categoryData: [...content.categoryData, `类目${content.categoryData.length + 1}`],
      series: content.series.map((s) => ({ ...s, data: [...s.data, randomValue()] })),
    })

  const removeCategory = (ci: number) =>
    onChange({
      ...content,
      categoryData: content.categoryData.filter((_, i) => i !== ci),
      series: content.series.map((s) => ({ ...s, data: s.data.filter((_, i) => i !== ci) })),
    })

  const moveCategory = (from: number, to: number) =>
    onChange({
      ...content,
      categoryData: moveItem(content.categoryData, from, to),
      series: content.series.map((s) => ({ ...s, data: moveItem(s.data, from, to) })),
    })

  return (
    // 标题由 BaseCardConfig 统一渲染，这里只管图表专属配置
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
            onChange({
              ...content,
              titlePosition: e.target.value as ChartContent['titlePosition'],
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
        <strong>类目数据</strong>
        <ListEditor
          items={content.categoryData}
          onChange={(categoryData) => onChange({ ...content, categoryData })}
          onMove={moveCategory}
          onRemove={removeCategory}
          onAdd={addCategory}
          addLabel="添加类目"
        />
      </div>
      <div>
        <strong>类目轴</strong>
        <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
          <label>
            <input
              type="radio"
              checked={content.categoryAxis !== 'y'}
              onChange={() => onChange({ ...content, categoryAxis: 'x' })}
            />
            X 轴（竖向柱状图）
          </label>
          <label>
            <input
              type="radio"
              checked={content.categoryAxis === 'y'}
              onChange={() => onChange({ ...content, categoryAxis: 'y' })}
            />
            Y 轴（横向条形图）
          </label>
        </div>
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <input
          type="checkbox"
          checked={content.showLabel ?? true}
          onChange={(e) => onChange({ ...content, showLabel: e.target.checked })}
        />
        显示数值
      </label>
      {(content.showLabel ?? true) && (
        <>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            单位
            <input
              style={{ width: 64 }}
              value={content.unit ?? ''}
              placeholder="如 人"
              onChange={(e) => onChange({ ...content, unit: e.target.value || undefined })}
            />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input
              type="checkbox"
              checked={content.showPercent ?? false}
              onChange={(e) => onChange({ ...content, showPercent: e.target.checked })}
            />
            显示百分比
          </label>
        </>
      )}
      <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        数值分隔线
        <input
          type="number"
          min={1}
          style={{ width: 56 }}
          value={content.splitNumber ?? 5}
          onChange={(e) => {
            const n = Math.max(1, Math.floor(Number(e.target.value)) || 1)
            onChange({ ...content, splitNumber: n })
          }}
        />
      </label>
      {(content.showLabel ?? true) && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          数值位置
          <select
            value={content.labelPosition ?? 'middle'}
            onChange={(e) =>
              onChange({
                ...content,
                labelPosition: e.target.value as ChartContent['labelPosition'],
              })
            }
          >
            <option value="top">顶部</option>
            <option value="middle">中间</option>
            <option value="bottom">底部</option>
          </select>
        </label>
      )}
      <div>
        <strong>系列</strong>
        {content.series.map((s, si) => (
          <SeriesCard
            key={si}
            series={s}
            categoryData={content.categoryData}
            stackOptions={[...new Set(content.series.map((x) => x.stack).filter((x): x is string => !!x))]}
            dragging={seriesDragIndex === si}
            armed={seriesArmed}
            onChange={(patch) => setSeries(si, patch)}
            onRemove={() => removeSeries(si)}
            onDragStart={() => setSeriesDragIndex(si)}
            onDragEnd={() => {
              setSeriesDragIndex(null)
              setSeriesArmed(false)
            }}
            onDragOver={() => {
              if (seriesDragIndex != null && seriesDragIndex !== si) {
                moveSeries(seriesDragIndex, si)
                setSeriesDragIndex(si)
              }
            }}
            onArm={() => setSeriesArmed(true)}
            onDisarm={() => setSeriesArmed(false)}
          />
        ))}
        <button style={{ marginTop: 4 }} onClick={addSeries}>添加系列</button>
      </div>
    </div>
  )
}
