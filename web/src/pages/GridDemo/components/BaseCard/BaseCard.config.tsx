import { useEffect, useRef, type ReactNode } from 'react'

// 所有卡片的公共配置；类型专属配置通过 children 组合进来
// componentName / id 只读展示，name / prompt 可编辑（不渲染到页面）
export function BaseCardConfig({ componentName, id, name, onNameChange, prompt, onPromptChange, promptHeight, onPromptHeightChange, children }: {
  componentName: string
  id: string
  name: string
  onNameChange: (name: string) => void
  prompt?: string
  onPromptChange?: (prompt: string) => void
  /** prompt 输入框高度（px），用户可拖拽调整，持久化到 pages.json */
  promptHeight?: number
  onPromptHeightChange?: (height: number) => void
  children?: ReactNode
}) {
  const promptRef = useRef<HTMLTextAreaElement>(null)

  // 监听用户拖拽 textarea 右下角改高，回写持久化；与 prop 一致时不回写避免循环
  useEffect(() => {
    const el = promptRef.current
    if (!el || !onPromptHeightChange) return
    const ro = new ResizeObserver(() => {
      const h = Math.round(el.offsetHeight)
      if (h > 0 && h !== promptHeight) onPromptHeightChange(h)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [onPromptHeightChange, promptHeight])

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
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        prompt:
        <textarea
          ref={promptRef}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            resize: 'vertical',
            ...(promptHeight ? { height: promptHeight } : null),
          }}
          rows={3}
          placeholder="给 LLM 的提示词：描述这个组件要展示什么"
          value={prompt ?? ''}
          onChange={(e) => onPromptChange?.(e.target.value)}
        />
      </label>
      {children}
    </div>
  )
}
