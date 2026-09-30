// 本地文件读写测试页（File System Access API）
// 验证目标：编辑自动落本地文件（断电不丢），手动/自动写，刷新后恢复文件句柄继续编辑
// 默认文件夹：showDirectoryPicker 选一次后句柄持久化，之后保存直接写入该文件夹不再弹窗
// （浏览器限制：startIn 只接受 'desktop'/'downloads' 等预置名，不能硬编码绝对路径；
//   且句柄只暴露文件夹名，拿不到完整路径）
import { useCallback, useEffect, useRef, useState } from 'react'

// ---- 最小类型声明（WICG File System Access，避免引入额外 @types 依赖） ----
interface FilePickerAcceptType { description?: string; accept: Record<string, string[]> }
interface SaveFilePickerOptions { suggestedName?: string; types?: FilePickerAcceptType[]; startIn?: unknown }
interface OpenFilePickerOptions { multiple?: boolean; types?: FilePickerAcceptType[]; startIn?: unknown }
interface FileSystemWritableLike { write: (data: string) => Promise<void>; close: () => Promise<void> }
interface PermissionCapable {
  queryPermission: (desc: { mode: 'read' | 'readwrite' }) => Promise<PermissionState>
  requestPermission: (desc: { mode: 'read' | 'readwrite' }) => Promise<PermissionState>
}
interface FileHandleLike extends PermissionCapable {
  name: string
  getFile: () => Promise<File>
  createWritable: () => Promise<FileSystemWritableLike>
}
interface DirHandleLike extends PermissionCapable {
  name: string
  getFileHandle: (name: string, opts?: { create?: boolean }) => Promise<FileHandleLike>
  getDirectoryHandle: (name: string, opts?: { create?: boolean }) => Promise<DirHandleLike>
}
declare global {
  interface Window {
    showSaveFilePicker?: (opts?: SaveFilePickerOptions) => Promise<FileHandleLike>
    showOpenFilePicker?: (opts?: OpenFilePickerOptions) => Promise<FileHandleLike[]>
    showDirectoryPicker?: () => Promise<DirHandleLike>
  }
}

// ---- IndexedDB 存文件句柄（Chrome 支持结构化克隆句柄，刷新后恢复） ----
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('file-test', 1)
    req.onupgradeneeded = () => req.result.createObjectStore('kv')
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}
async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('kv', 'readwrite')
    tx.objectStore('kv').put(value, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}
async function idbGet<T>(key: string): Promise<T | null> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const req = db.transaction('kv', 'readonly').objectStore('kv').get(key)
    req.onsuccess = () => resolve((req.result as T | undefined) ?? null)
    req.onerror = () => reject(req.error)
  })
}

const HANDLE_KEY = 'last-file-handle'
const DIR_KEY = 'last-dir-handle'

export function FileTestPage() {
  const supported = typeof window !== 'undefined' && !!window.showSaveFilePicker
  const [dirHandle, setDirHandle] = useState<DirHandleLike | null>(null)
  const [handle, setHandle] = useState<FileHandleLike | null>(null)
  const [fileName, setFileName] = useState('editor-data.json')
  const [subDir, setSubDir] = useState('root')
  const [content, setContent] = useState('')
  const [autoSave, setAutoSave] = useState(true)
  const [dirty, setDirty] = useState(false)
  const [permission, setPermission] = useState<PermissionState | null>(null)
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null)
  const [needReauth, setNeedReauth] = useState(false)
  const [log, setLog] = useState<string[]>([])
  const [showDirExplainer, setShowDirExplainer] = useState(false)
  const savingRef = useRef(false)

  const addLog = useCallback((msg: string) => {
    setLog(prev => [`${new Date().toLocaleTimeString()} ${msg}`, ...prev].slice(0, 30))
  }, [])

  // 任一关联句柄权限不是 granted 就需要重新授权（用户手势触发）
  const refreshPermission = useCallback(async (h: FileHandleLike | null, d: DirHandleLike | null) => {
    const targets = [h, d].filter(Boolean) as PermissionCapable[]
    let worst: PermissionState = 'granted'
    for (const t of targets) {
      const p = await t.queryPermission({ mode: 'readwrite' })
      if (p !== 'granted')
        worst = p
    }
    setPermission(targets.length ? worst : null)
    setNeedReauth(targets.length > 0 && worst !== 'granted')
    return worst
  }, [])

  const save = useCallback(async (h: FileHandleLike, text: string) => {
    if (savingRef.current)
      return
    savingRef.current = true
    try {
      const writable = await h.createWritable()
      await writable.write(text)
      await writable.close()
      setDirty(false)
      setLastSavedAt(new Date().toLocaleTimeString())
      addLog(`已写入 ${h.name}（${text.length} 字符）`)
    } catch (err) {
      addLog(`写入失败：${err instanceof Error ? err.message : String(err)}`)
    } finally {
      savingRef.current = false
    }
  }, [addLog])

  const adoptHandle = useCallback(async (h: FileHandleLike, d: DirHandleLike | null) => {
    setHandle(h)
    await idbSet(HANDLE_KEY, h)
    await refreshPermission(h, d)
    addLog(`已关联文件：${h.name}`)
    const file = await h.getFile()
    const text = await file.text()
    setContent(text)
    setDirty(false)
    addLog(`已读取 ${h.name}（${text.length} 字符）`)
  }, [addLog, refreshPermission])

  // 挂载时恢复上次的文件夹/文件句柄（权限通常需要用户手势重新授权）
  useEffect(() => {
    if (!supported)
      return
    void (async () => {
      const d = await idbGet<DirHandleLike>(DIR_KEY).catch(() => null)
      const h = await idbGet<FileHandleLike>(HANDLE_KEY).catch(() => null)
      if (d) {
        setDirHandle(d)
        addLog(`恢复默认文件夹：${d.name}`)
      }
      if (h) {
        setHandle(h)
        addLog(`恢复上次文件：${h.name}`)
      }
      if (!d && !h)
        return
      const p = await refreshPermission(h, d)
      if (p !== 'granted')
        addLog('权限未授予，需点击下方「重新授权」按钮')
      else if (h) {
        const file = await h.getFile()
        setContent(await file.text())
      }
    })()
  }, [supported, addLog, refreshPermission])

  // 自动保存：内容变化后防抖 1s 落盘（已有关联文件时）
  useEffect(() => {
    if (!autoSave || !handle || !dirty || needReauth)
      return
    const timer = setTimeout(() => void save(handle, content), 1000)
    return () => clearTimeout(timer)
  }, [content, autoSave, handle, dirty, needReauth, save])

  async function pickDirectory() {
    if (!window.showDirectoryPicker)
      return
    try {
      const d = await window.showDirectoryPicker()
      await d.requestPermission({ mode: 'readwrite' })
      setDirHandle(d)
      await idbSet(DIR_KEY, d)
      await refreshPermission(handle, d)
      addLog(`已设置默认文件夹：${d.name}（之后保存直接写入此文件夹）`)
    } catch { /* 用户取消 */ }
  }

  // 在默认文件夹（及子目录，按 / 分层，不存在自动创建）里直接创建/覆盖文件，并关联为当前文件
  async function saveIntoDirectory() {
    if (!dirHandle || !fileName.trim())
      return
    try {
      let dir = dirHandle
      const segs = subDir.split('/').map(s => s.trim()).filter(Boolean)
      for (const seg of segs)
        dir = await dir.getDirectoryHandle(seg, { create: true })
      const h = await dir.getFileHandle(fileName.trim(), { create: true })
      setHandle(h)
      await idbSet(HANDLE_KEY, h)
      await save(h, content)
      await refreshPermission(h, dirHandle)
      addLog(`已保存到 ${[dirHandle.name, ...segs, h.name].join('/')}`)
    } catch (err) {
      addLog(`保存失败：${err instanceof Error ? err.message : String(err)}`)
    }
  }

  async function pickNew() {
    if (!window.showSaveFilePicker)
      return
    try {
      const h = await window.showSaveFilePicker({
        suggestedName: fileName,
        startIn: dirHandle ?? 'documents',
        types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }],
      })
      await h.requestPermission({ mode: 'readwrite' })
      await adoptHandle(h, dirHandle)
    } catch { /* 用户取消 */ }
  }

  async function pickExisting() {
    if (!window.showOpenFilePicker)
      return
    try {
      const [h] = await window.showOpenFilePicker({
        startIn: dirHandle ?? 'documents',
        types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }],
      })
      await h.requestPermission({ mode: 'readwrite' })
      await adoptHandle(h, dirHandle)
    } catch { /* 用户取消 */ }
  }

  async function reauth() {
    let granted = true
    for (const t of [handle, dirHandle].filter(Boolean) as PermissionCapable[]) {
      const p = await t.requestPermission({ mode: 'readwrite' })
      if (p !== 'granted')
        granted = false
    }
    await refreshPermission(handle, dirHandle)
    addLog(`重新授权结果：${granted ? 'granted' : '被拒绝'}`)
    if (granted && handle) {
      const file = await handle.getFile()
      setContent(await file.text())
    }
  }

  function detach() {
    setHandle(null)
    void idbSet(HANDLE_KEY, null)
    addLog('已断开文件关联（本地文件不受影响）')
    void refreshPermission(null, dirHandle)
  }

  function detachDir() {
    setDirHandle(null)
    void idbSet(DIR_KEY, null)
    addLog('已清除默认文件夹')
    void refreshPermission(handle, null)
  }

  const btn: React.CSSProperties = { padding: '6px 14px', cursor: 'pointer' }

  if (!supported) {
    return (
      <div style={{ padding: 24 }}>
        <h2>本地文件读写测试</h2>
        <p>当前浏览器不支持 File System Access API（showSaveFilePicker）。请用 Chrome / Edge 打开。</p>
      </div>
    )
  }

  return (
    <div style={{ padding: 24, maxWidth: 860 }}>
      <h2>本地文件读写测试</h2>
      <p style={{ color: '#57606a', fontSize: 13 }}>
        验证「编辑自动落本地文件，断电不丢」：先选默认文件夹（如 deep-assess-tenant），之后保存直接写入该文件夹不再弹窗；
        编辑内容 1 秒无操作自动写入；刷新/重启浏览器后自动恢复（需重新授权一次）。
      </p>

      <div style={{ fontSize: 13, marginBottom: 12, padding: '8px 12px', background: '#f6f8fa', borderRadius: 6, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <span>保存文件夹：<strong>{dirHandle ? dirHandle.name : '（未设置）'}</strong></span>
        <button type="button" style={btn} onClick={() => setShowDirExplainer(true)}>选择默认文件夹…</button>
        {dirHandle && <button type="button" style={btn} onClick={detachDir}>清除</button>}
        <span style={{ color: '#8c959f' }}>（浏览器不暴露完整路径，只显示文件夹名）</span>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
        {dirHandle && (
          <>
            <input
              style={{ padding: '5px 8px', width: 90 }}
              value={subDir}
              onChange={e => setSubDir(e.target.value)}
              placeholder="子目录"
              title="子目录，按 / 分层，不存在自动创建；留空则存到文件夹根"
            />
            <input
              style={{ padding: '5px 8px', width: 180 }}
              value={fileName}
              onChange={e => setFileName(e.target.value)}
              placeholder="文件名.json"
            />
            <button type="button" style={{ ...btn, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 4 }} onClick={() => void saveIntoDirectory()}>
              保存到 {dirHandle.name}/{subDir.trim() ? `${subDir.trim().replace(/^\/+|\/+$/g, '')}/` : ''}
            </button>
          </>
        )}
        <button type="button" style={btn} onClick={() => void pickNew()}>另存为…</button>
        <button type="button" style={btn} onClick={() => void pickExisting()}>打开本地文件…</button>
        {needReauth && (
          <button type="button" style={{ ...btn, background: '#fef3c7', border: '1px solid #f59e0b' }} onClick={() => void reauth()}>
            ⚠ 重新授权读写
          </button>
        )}
        {handle && !needReauth && (
          <button type="button" style={btn} disabled={!dirty} onClick={() => void save(handle, content)}>
            手动保存
          </button>
        )}
        {handle && <button type="button" style={btn} onClick={detach}>断开文件</button>}
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
          <input type="checkbox" checked={autoSave} onChange={e => setAutoSave(e.target.checked)} />
          自动保存（1s 防抖）
        </label>
      </div>

      <div style={{ fontSize: 13, marginBottom: 8, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <span>文件：<strong>{handle ? handle.name : '（未关联）'}</strong></span>
        <span>权限：{permission ?? '-'}</span>
        <span>状态：{dirty ? '● 有未保存修改' : '已保存'}</span>
        {lastSavedAt && <span>最后写入：{lastSavedAt}</span>}
      </div>

      <textarea
        style={{ width: '100%', height: 260, fontFamily: 'monospace', fontSize: 13, padding: 8, boxSizing: 'border-box' }}
        value={content}
        placeholder='在这里编辑内容（比如贴一段 JSON），观察自动保存与断电恢复'
        onChange={(e) => {
          setContent(e.target.value)
          setDirty(true)
        }}
      />

      <h3 style={{ fontSize: 14, marginTop: 16 }}>操作日志</h3>
      <div style={{ fontSize: 12, fontFamily: 'monospace', background: '#f6f8fa', padding: 12, borderRadius: 6, maxHeight: 200, overflow: 'auto' }}>
        {log.length === 0 ? '（暂无）' : log.map((line, i) => <div key={i}>{line}</div>)}
      </div>

      {showDirExplainer && (
        <div className="modal-mask" onClick={() => setShowDirExplainer(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h3>选择本地保存文件夹</h3>
            <div style={{ fontSize: 13, lineHeight: 1.9 }}>
              <p><strong>用途：</strong>你的编辑内容会<strong>自动保存</strong>到这个文件夹里的文件，
                即使没点保存、浏览器崩溃或电脑断电，内容也不会丢。只有在你主动「上传」时，内容才会同步到服务器。</p>
              <p><strong>接下来要做两件事：</strong></p>
              <ol style={{ margin: '4px 0', paddingLeft: 20 }}>
                <li>在系统弹出的文件夹选择器里，选中保存目录（如 <code>deep-assess-tenant</code>）</li>
                <li>授权弹窗里选择「<strong>每次访问都允许</strong>」——这样以后刷新、重开浏览器都不需要再授权</li>
              </ol>
              <p style={{ color: '#57606a' }}>浏览器只会把该文件夹的读写权限授予本站点，你可以随时在浏览器网站设置里撤销。</p>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn-plain" onClick={() => setShowDirExplainer(false)}>取消</button>
              <button
                type="button"
                className="btn-strong"
                onClick={() => {
                  setShowDirExplainer(false)
                  void pickDirectory()
                }}
              >
                继续，选择文件夹
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
