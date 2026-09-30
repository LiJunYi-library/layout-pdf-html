// 组件字段面板里"计算说明"下方的数据脚本字段：「生成数据脚本」（调 agent-bind +
// 浏览器冒烟校验重试）与「查看脚本」弹窗
import { useContext, useState } from 'react'
import { useGetPuck } from '@puckeditor/core'
import { requestAgentBind } from '../api'
import { EditorDocContext, smokeTest } from './bindRuntime'

const MAX_BIND_ROUNDS = 3

// 从预览 iframe 的 DOM 取组件渲染 HTML（含计算后真实值），LLM 看 HTML 一目了然
function getComponentHtml(id: string): string {
  const frame = document.querySelector<HTMLIFrameElement>('iframe#preview-frame')
  const node = frame?.contentDocument?.querySelector(`[data-puck-component="${id}"]`)
  const block = node?.querySelector('.tpl-block') ?? node
  return block?.outerHTML ?? ''
}

export function BindStyleField({ value, onChange }: {
  value?: string
  onChange: (v: string) => void
}) {
  const getPuck = useGetPuck()
  const ctx = useContext(EditorDocContext)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [viewing, setViewing] = useState(false)

  async function generate() {
    if (!ctx || busy)
      return
    const { selectedItem } = getPuck()
    if (!selectedItem) {
      setStatus('未选中组件')
      return
    }
    const { id, bindScript: _s, bindStyle: _st, ...fieldProps } = selectedItem.props as Record<string, unknown>
    const component = {
      id: String(id),
      type: selectedItem.type,
      props: fieldProps,
      html: getComponentHtml(String(id)),
    }
    setBusy(true)
    setStatus(null)
    let feedback: string | undefined
    try {
      for (let round = 1; round <= MAX_BIND_ROUNDS; round++) {
        const result = await requestAgentBind({
          documentId: ctx.documentId,
          components: [component],
          instruction: `为组件 ${component.id}（${component.type}）编写组件级样式`,
          feedback,
          mode: 'style',
        })
        const css = result.styles?.[component.id]
        if (!result.ok || !css) {
          setStatus(result.reply || 'LLM 未返回该组件的样式')
          return
        }
        // 校验：选择器必须 scoped 到本组件块
        if (!css.includes(`[data-bid="${component.id}"]`)) {
          feedback = `组件 ${component.id}：CSS 选择器未以 [data-bid="${component.id}"] 开头限定作用域`
          continue
        }
        onChange(css)
        setStatus(round > 1 ? `已生成并通过校验（第 ${round} 轮）` : '已生成并通过校验')
        return
      }
      setStatus(`样式未通过校验（${MAX_BIND_ROUNDS} 轮），未应用`)
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="bind-field">
      <div className="bind-actions">
        <button type="button" className="btn-plain" disabled={busy} onClick={() => void generate()}>
          {busy ? '生成中…' : '生成样式'}
        </button>
        <button type="button" className="btn-plain" disabled={!value} onClick={() => setViewing(true)}>
          查看样式
        </button>
      </div>
      {status && <div className="bind-status">{status}</div>}
      {viewing && (
        <div className="modal-mask" onClick={() => setViewing(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h3>组件样式（bindStyle）</h3>
            <textarea className="modal-content bind-code" value={value ?? ''} rows={14} readOnly />
            <div className="modal-actions">
              <button type="button" className="btn-strong" onClick={() => setViewing(false)}>关闭</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function BindScriptField({ value, onChange }: {
  value?: string
  onChange: (v: string) => void
}) {
  const getPuck = useGetPuck()
  const ctx = useContext(EditorDocContext)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [viewing, setViewing] = useState(false)

  async function generate() {
    if (!ctx || busy)
      return
    const { selectedItem } = getPuck()
    if (!selectedItem) {
      setStatus('未选中组件')
      return
    }
    const { id, bindScript: _old, ...fieldProps } = selectedItem.props as Record<string, unknown>
    const component = {
      id: String(id),
      type: selectedItem.type,
      props: fieldProps,
      html: getComponentHtml(String(id)),
    }
    setBusy(true)
    setStatus(null)
    let feedback: string | undefined
    try {
      for (let round = 1; round <= MAX_BIND_ROUNDS; round++) {
        const result = await requestAgentBind({
          documentId: ctx.documentId,
          components: [component],
          instruction: `为组件 ${component.id}（${component.type}）生成数据脚本`,
          feedback,
        })
        const script = result.scripts[component.id]
        if (!result.ok || !script) {
          setStatus(result.reply || 'LLM 未返回该组件的脚本')
          return
        }
        const err = smokeTest(component.id, script)
        if (!err) {
          onChange(script)
          setStatus(round > 1 ? `已生成并通过校验（第 ${round} 轮）` : '已生成并通过校验')
          return
        }
        feedback = err
      }
      setStatus(`脚本执行未通过（${MAX_BIND_ROUNDS} 轮），未应用`)
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="bind-field">
      <div className="bind-actions">
        <button type="button" className="btn-plain" disabled={busy} onClick={() => void generate()}>
          {busy ? '生成中…' : '生成数据脚本'}
        </button>
        <button type="button" className="btn-plain" disabled={!value} onClick={() => setViewing(true)}>
          查看脚本
        </button>
      </div>
      {status && <div className="bind-status">{status}</div>}
      {viewing && (
        <div className="modal-mask" onClick={() => setViewing(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h3>数据脚本（bindScript）</h3>
            <textarea className="modal-content bind-code" value={value ?? ''} rows={14} readOnly />
            <div className="modal-actions">
              <button type="button" className="btn-strong" onClick={() => setViewing(false)}>关闭</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
