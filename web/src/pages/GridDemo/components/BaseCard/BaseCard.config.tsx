import type { ReactNode } from 'react'

// 所有卡片的公共配置；类型专属配置通过 children 组合进来
// componentName / id 只读展示，name 可编辑（不渲染到页面）
export function BaseCardConfig({ componentName, id, name, onNameChange, children }: {
  componentName: string
  id: string
  name: string
  onNameChange: (name: string) => void
  children?: ReactNode
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <strong>配置 — {componentName}</strong>
      </div>
      <div style={{ fontSize: 12, color: '#888', wordBreak: 'break-all' }}>id: {id}</div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        name:
        <input
          style={{ flex: 1, minWidth: 0 }}
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
        />
      </label>
      {children}
    </div>
  )
}
