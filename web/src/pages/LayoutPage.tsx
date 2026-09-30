import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearch } from '@tanstack/react-router'
import {
  bindDocumentSpecStyle,
  fetchDocument,
  fetchMessages,
  fetchNamedDetail,
  fetchSpecs,
  fetchStyles,
  requestAgentRender,
  updateNamed,
} from '../api'

const MAX_IMAGES = 4

type NamedKind = 'specs' | 'styles'

interface ChatMessage {
  role: 'user' | 'assistant'
  text: string
  images?: string[]
  isError?: boolean
}

const GREETING: ChatMessage = {
  role: 'assistant',
  text: '你好！用自然语言告诉我想要的版式（如“标题居中、整体深蓝色调、表格隔行变色”），我会据此生成布局，右侧实时预览。',
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function NamedViewModal({ kind, id, onClose }: { kind: NamedKind; id: number; onClose: () => void }) {
  const queryClient = useQueryClient()
  const detailQuery = useQuery({
    queryKey: [kind, id],
    queryFn: () => fetchNamedDetail(kind, id),
  })
  const [content, setContent] = useState<string | null>(null)
  const saveMutation = useMutation({
    mutationFn: () => updateNamed(kind, id, { content: content ?? '' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [kind] }),
  })

  const detail = detailQuery.data
  const shown = content ?? detail?.content ?? ''
  const dirty = content !== null && content !== detail?.content

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <h3>{detail?.name ?? '加载中…'}</h3>
        <textarea
          className="modal-content"
          value={shown}
          rows={14}
          disabled={!detail}
          onChange={e => setContent(e.target.value)}
        />
        <div className="modal-actions">
          <button
            type="button"
            className="btn-plain"
            disabled={!detail || saveMutation.isPending || !dirty}
            onClick={() => saveMutation.mutate()}
          >
            {saveMutation.isPending ? '保存中…' : !dirty && saveMutation.isSuccess ? '已保存' : '保存修改'}
          </button>
          <button type="button" className="btn-strong" onClick={onClose}>关闭</button>
        </div>
      </div>
    </div>
  )
}

export function LayoutPage() {
  const { documentId } = useSearch({ from: '/layout' })
  const [appended, setAppended] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [renderUrl, setRenderUrl] = useState<string | null>(
    documentId !== undefined ? `/api/render?documentId=${documentId}` : null,
  )
  const listRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()
  const [viewing, setViewing] = useState<{ kind: NamedKind; id: number } | null>(null)

  const docQuery = useQuery({
    queryKey: ['document', documentId],
    queryFn: () => fetchDocument(documentId as number),
    enabled: documentId !== undefined,
  })
  const specsQuery = useQuery({ queryKey: ['specs'], queryFn: fetchSpecs })
  const stylesQuery = useQuery({ queryKey: ['styles'], queryFn: fetchStyles })

  const bindMutation = useMutation({
    mutationFn: (patch: { spec_id?: number; style_id?: number }) =>
      bindDocumentSpecStyle(documentId as number, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['document', documentId] }),
  })

  const doc = docQuery.data
  const specs = specsQuery.data ?? []
  const styles = stylesQuery.data ?? []
  // 文档未绑定时展示默认行（与 agent 回退一致：id 最小者），选择后才真正落库
  const specId = doc?.spec_id ?? specs[0]?.id
  const styleId = doc?.style_id ?? styles[0]?.id

  // 会话持久化在服务端（按 documentId）：进页面加载历史，无历史时显示欢迎语；
  // 本次会话新发的消息放在 appended 里，与历史拼接渲染，不做 effect 同步
  const historyQuery = useQuery({
    queryKey: ['layout-messages', documentId],
    queryFn: () => fetchMessages(documentId as number),
    enabled: documentId !== undefined,
  })

  const history = historyQuery.data ?? []
  const messages: ChatMessage[] = [
    ...(history.length > 0
      ? history.map(m => ({ role: m.role, text: m.text, images: m.images ?? undefined }))
      : [GREETING]),
    ...appended,
  ]

  // 仅发消息触发（LLM 按量计费，不进页面自动调）
  const aiMutation = useMutation({
    mutationFn: async (payload: { instruction: string }) => {
      if (documentId === undefined)
        throw new Error('缺少 documentId，请从首页选择文档进入')
      return requestAgentRender({ documentId, instruction: payload.instruction })
    },
    onSuccess: (result) => {
      setRenderUrl(`${result.renderUrl}&_t=${Date.now()}`)
      setAppended(prev => [...prev, { role: 'assistant', text: result.reply }])
    },
    onError: (error) => {
      setAppended(prev => [
        ...prev,
        { role: 'assistant', text: `生成失败：${error.message}`, isError: true },
      ])
    },
  })

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [messages.length, aiMutation.isPending])

  async function pickImages(files: FileList | null) {
    if (!files) return
    const room = MAX_IMAGES - images.length
    const picked = Array.from(files).filter(f => f.type.startsWith('image/')).slice(0, room)
    const urls = await Promise.all(picked.map(readAsDataUrl))
    setImages(prev => [...prev, ...urls].slice(0, MAX_IMAGES))
  }

  function send() {
    const text = input.trim()
    if ((!text && images.length === 0) || aiMutation.isPending) return
    const instruction = text || '请参考上传图片的版式生成布局'
    setAppended(prev => [...prev, { role: 'user', text: instruction, images: images.length > 0 ? images : undefined }])
    setInput('')
    setImages([])
    aiMutation.mutate({ instruction })
  }

  return (
    <main className="layout-main chat-layout">
      <section className="panel chat-panel">
        <div className="output-header">
          <h2>AI 布局对话</h2>
        </div>
        {doc && (
          <div className="chat-toolbar">
            <label>
              规范
              <select
                value={specId ?? ''}
                disabled={specs.length === 0 || bindMutation.isPending}
                onChange={e => bindMutation.mutate({ spec_id: Number(e.target.value) })}
              >
                {specs.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
            <button
              type="button"
              className="btn-plain"
              disabled={specId === undefined}
              onClick={() => specId !== undefined && setViewing({ kind: 'specs', id: specId })}
            >
              查看
            </button>
            <label>
              样式
              <select
                value={styleId ?? ''}
                disabled={styles.length === 0 || bindMutation.isPending}
                onChange={e => bindMutation.mutate({ style_id: Number(e.target.value) })}
              >
                {styles.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
            <button
              type="button"
              className="btn-plain"
              disabled={styleId === undefined}
              onClick={() => styleId !== undefined && setViewing({ kind: 'styles', id: styleId })}
            >
              查看
            </button>
          </div>
        )}
        <div className="chat-messages" ref={listRef}>
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`chat-bubble chat-${msg.role}${msg.isError ? ' chat-error' : ''}`}
            >
              {msg.images && (
                <div className="chat-thumbs">
                  {msg.images.map((src, j) => <img key={j} src={src} alt={`参考图 ${j + 1}`} />)}
                </div>
              )}
              {msg.text}
            </div>
          ))}
          {aiMutation.isPending && (
            <div className="chat-bubble chat-assistant">正在生成布局，可能需要几十秒…</div>
          )}
        </div>
        {images.length > 0 && (
          <div className="chat-attach">
            {images.map((src, i) => (
              <span className="chat-attach-item" key={i}>
                <img src={src} alt={`待发送 ${i + 1}`} />
                <button
                  type="button"
                  aria-label="移除图片"
                  onClick={() => setImages(prev => prev.filter((_, j) => j !== i))}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="chat-input-row">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={e => {
              void pickImages(e.target.files)
              e.target.value = ''
            }}
          />
          <button
            type="button"
            className="btn-attach"
            title="上传参考图片（最多 4 张）"
            disabled={aiMutation.isPending || images.length >= MAX_IMAGES}
            onClick={() => fileRef.current?.click()}
          >
            图片
          </button>
          <textarea
            className="chat-input"
            value={input}
            placeholder="描述你想要的版式，Enter 发送（Shift+Enter 换行）"
            rows={2}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send()
              }
            }}
          />
          <button onClick={send} disabled={aiMutation.isPending || (!input.trim() && images.length === 0)}>
            {aiMutation.isPending ? '生成中…' : '发送'}
          </button>
        </div>
        {documentId === undefined && (
          <p className="doc-p doc-source">编辑器数据将先保存再布局</p>
        )}
      </section>
      <section className="panel preview-panel">
        <div className="output-header">
          <h2>布局预览</h2>
        </div>
        {renderUrl
          ? <iframe className="ai-frame" sandbox="allow-scripts" src={renderUrl} title="布局预览" />
          : <p className="doc-p doc-loading">发送一条消息生成布局后，这里会显示预览。</p>}
      </section>
      {viewing && (
        <NamedViewModal kind={viewing.kind} id={viewing.id} onClose={() => setViewing(null)} />
      )}
    </main>
  )
}
