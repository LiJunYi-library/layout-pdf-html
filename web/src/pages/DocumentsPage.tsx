import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import type { DocumentRecord } from '../types'
import { bindDocumentData, fetchDocuments } from '../api'

export function DocumentsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: documents, error, isPending } = useQuery({
    queryKey: ['documents'],
    queryFn: fetchDocuments,
  })

  const bindData = useMutation({
    mutationFn: ({ id, dataId }: { id: number, dataId: number }) => bindDocumentData(id, dataId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['documents'] }),
    onError: err => alert(`绑定失败：${err.message}`),
  })

  function handleBind(doc: DocumentRecord) {
    const input = window.prompt('输入要绑定的数据 ID', String(doc.data_id))
    if (input === null)
      return
    const dataId = Number(input)
    if (!Number.isInteger(dataId) || dataId <= 0) {
      alert('请输入正整数的数据 ID')
      return
    }
    bindData.mutate({ id: doc.id, dataId })
  }

  return (
    <main className="layout-main">
      <section className="panel">
        <div className="output-header">
          <h2>文档列表</h2>
        </div>
        {error && <p className="doc-error">获取文档列表失败：{error.message}（请确认后端已启动）</p>}
        {!error && isPending && <p className="doc-loading">加载中…</p>}
        {documents && documents.length === 0 && <p className="doc-p">（暂无文档）</p>}
        {documents && documents.length > 0 && (
          <table className="doc-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>标题</th>
                <th>数据 ID</th>
                <th>创建时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {documents.map(doc => (
                <tr key={doc.id}>
                  <td>{doc.id}</td>
                  <td>{doc.title}</td>
                  <td>{doc.data_id}</td>
                  <td>{new Date(doc.created_at).toLocaleString()}</td>
                  <td>
                    <div className="row-actions">
                      <button onClick={() => navigate({ to: '/layout', search: { documentId: doc.id } })}>
                        去布局
                      </button>
                      <button
                        onClick={() => handleBind(doc)}
                        disabled={bindData.isPending}
                      >
                        绑定数据ID
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  )
}
