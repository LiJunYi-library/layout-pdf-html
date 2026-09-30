import type { DocumentRecord } from './types'

async function postJson<T>(url: string, body: unknown, method = 'POST'): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const errBody = await res.json().catch(() => null) as { detail?: string } | null
    throw new Error(errBody?.detail ?? `服务器返回 ${res.status}`)
  }
  return res.json() as Promise<T>
}

export interface AgentRenderResult {
  renderUrl: string
  reply: string
}

export interface ChatMessageRecord {
  id: number
  role: 'user' | 'assistant'
  text: string
  images: string[] | null
  created_at: string
}

export async function fetchMessages(documentId: number): Promise<ChatMessageRecord[]> {
  const res = await fetch(`/api/documents/${documentId}/messages`)
  if (!res.ok)
    throw new Error(`服务器返回 ${res.status}`)
  const body = await res.json() as { messages: ChatMessageRecord[] }
  return body.messages
}

export function requestAgentRender(params: {
  documentId: number
  instruction: string
}): Promise<AgentRenderResult> {
  return postJson<AgentRenderResult>('/api/agent-render', params)
}

export async function fetchDocuments(): Promise<DocumentRecord[]> {
  const res = await fetch('/api/documents')
  if (!res.ok)
    throw new Error(`服务器返回 ${res.status}`)
  const body = await res.json() as { documents: DocumentRecord[] }
  return body.documents
}

export async function bindDocumentData(id: number, dataId: number): Promise<void> {
  await postJson(`/api/documents/${id}`, { data_id: dataId }, 'PUT')
}

export interface DocumentDetail extends DocumentRecord {
  template_url: string | null
  spec_id: number | null
  style_id: number | null
  config_url: string | null
  fake_data_url: string | null
}

export async function fetchDocument(id: number): Promise<DocumentDetail> {
  const res = await fetch(`/api/documents/${id}`)
  if (!res.ok)
    throw new Error(`服务器返回 ${res.status}`)
  return res.json() as Promise<DocumentDetail>
}

export function bindDocumentSpecStyle(
  id: number,
  patch: { spec_id?: number | null; style_id?: number | null },
): Promise<void> {
  return postJson(`/api/documents/${id}`, patch, 'PUT')
}

export interface NamedRecord {
  id: number
  name: string
}

export interface NamedDetail extends NamedRecord {
  content: string
}

async function fetchNamedList(kind: 'specs' | 'styles'): Promise<NamedRecord[]> {
  const res = await fetch(`/api/${kind}`)
  if (!res.ok)
    throw new Error(`服务器返回 ${res.status}`)
  const body = await res.json() as Record<string, NamedRecord[]>
  return body[kind]
}

export function fetchSpecs(): Promise<NamedRecord[]> {
  return fetchNamedList('specs')
}

export function fetchStyles(): Promise<NamedRecord[]> {
  return fetchNamedList('styles')
}

export async function fetchNamedDetail(kind: 'specs' | 'styles', id: number): Promise<NamedDetail> {
  const res = await fetch(`/api/${kind}/${id}`)
  if (!res.ok)
    throw new Error(`服务器返回 ${res.status}`)
  return res.json() as Promise<NamedDetail>
}

export function updateNamed(
  kind: 'specs' | 'styles',
  id: number,
  payload: { name?: string; content?: string },
): Promise<void> {
  return postJson(`/api/${kind}/${id}`, payload, 'PUT')
}

// ---------- 编辑器数据（Puck JSON） ----------

export async function fetchEditorData(documentId: number): Promise<unknown | null> {
  const res = await fetch(`/api/documents/${documentId}/editor`)
  if (!res.ok)
    throw new Error(`服务器返回 ${res.status}`)
  const body = await res.json() as { data: unknown | null }
  return body.data
}

export function saveEditorData(documentId: number, data: unknown): Promise<void> {
  return postJson(`/api/documents/${documentId}/editor`, data, 'PUT')
}

export interface SaveTemplateResult {
  template_url: string
  renderUrl: string
}

export function saveTemplateHtml(documentId: number, html: string): Promise<SaveTemplateResult> {
  return postJson(`/api/documents/${documentId}/template`, { html }, 'PUT')
}

// ---------- 数据绑定 agent ----------

export interface DialogueRecord {
  id: number
  role: 'user' | 'assistant'
  text: string
  created_at: string
}

export async function fetchDialogue(documentId: number): Promise<DialogueRecord[]> {
  const res = await fetch(`/api/documents/${documentId}/dialogue`)
  if (!res.ok)
    throw new Error(`服务器返回 ${res.status}`)
  const body = await res.json() as { messages: DialogueRecord[] }
  return body.messages
}

export interface BindComponent {
  id: string
  type: string
  props: Record<string, unknown>
  html: string
}

export interface AgentBindResult {
  ok: boolean
  scripts: Record<string, string>
  styles: Record<string, string>
  reply: string
}

export function requestAgentBind(params: {
  documentId: number
  components: BindComponent[]
  instruction: string
  feedback?: string
  mode?: 'data' | 'style'
}): Promise<AgentBindResult> {
  return postJson<AgentBindResult>('/api/agent-bind', params)
}

