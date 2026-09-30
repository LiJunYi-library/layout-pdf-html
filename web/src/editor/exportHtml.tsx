import { Render } from '@puckeditor/core'
import { renderToStaticMarkup } from 'react-dom/server'
import { editorConfig } from './config'
import type { Data } from '@puckeditor/core'

// 与线上渲染契约一致的 A4 基础样式：页面组件宽 210mm、高 297mm、白底，打印时一页一张纸
const A4_CSS = `
  * { box-sizing: border-box; }
  body { margin: 0; background: #f3f4f6; font-family: "PingFang SC", "Microsoft YaHei", sans-serif; }
  .tpl-page { position: relative; width: 210mm; min-height: 297mm; margin: 16px auto; background: #ffffff; padding: 12mm; box-shadow: 0 1px 8px rgba(0,0,0,.15); }
  .tpl-page-tag { display: none; }
  @media print {
    body { background: #ffffff; }
    .tpl-page { margin: 0; box-shadow: none; page-break-after: always; }
  }
  .tpl-block { margin-bottom: 16px; }
  .tpl-text { margin: 0; line-height: 1.8; white-space: pre-wrap; }
  .tpl-card { border: 1px solid #e5e7eb; border-radius: 8px; background: #ffffff; padding: 12px; }
  .tpl-card-title { text-align: center; font-size: 14px; font-weight: bold; color: #2563eb; }
  .tpl-chart svg { display: block; margin: 0 auto; max-width: 100%; }
  .tpl-stat-card { border: 1px solid #e5e7eb; border-radius: 8px; background: #ffffff; padding: 16px; text-align: center; }
  .tpl-stat-title { font-size: 13px; color: #6b7280; }
  .tpl-stat-value { font-size: 32px; font-weight: bold; color: #2563eb; margin: 6px 0; }
  .tpl-stat-note { font-size: 11px; color: #6b7280; }
  .tpl-table { width: 100%; border-collapse: collapse; font-size: 12px; }
  .tpl-table th, .tpl-table td { border: 1px solid #e5e7eb; padding: 6px 10px; text-align: center; }
  .tpl-table th { background: #eff6ff; color: #1e3a5f; }
  .tpl-stat-row { display: flex; gap: 12px; }
  .tpl-stat-row .tpl-stat-card { flex: 1; min-width: 0; }
  .tpl-info-line { display: flex; align-items: center; gap: 10px; }
  .tpl-info-icon { width: 36px; height: 36px; flex-shrink: 0; border-radius: 50%; background: #eff6ff; display: flex; align-items: center; justify-content: center; font-size: 18px; }
  .tpl-info-label { font-weight: bold; color: #1e3a5f; font-size: 14px; }
  .tpl-info-value { color: #374151; font-size: 14px; }
  .tpl-stat-icon { width: 40px; height: 40px; margin: 0 auto 6px; border-radius: 50%; background: #eff6ff; display: flex; align-items: center; justify-content: center; font-size: 20px; }
  .tpl-cols { display: flex; align-items: stretch; }
  .tpl-cols > div { min-width: 0; }
  .tpl-spacer-tag { display: none; }
  .tpl-data-script-tag { display: none; }
`

// 块内嵌脚本调用的回填助手：按 data-component 类型把脚本返回值写回 DOM。
// 图表（donut/bar）不在客户端重算——导出时 SVG 已按真实数据烘焙
const BIND_RUNTIME = `
window.__runBind = function (block, code) {
  if (!block || window.__DATA__ === undefined) return
  var out
  try { out = new Function('data', code)(window.__DATA__) } catch (e) { return }
  if (!out || typeof out !== 'object') return
  var type = block.getAttribute('data-component')
  function q(sel) { return block.querySelector(sel) }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
    })
  }
  if ((type === 'text' || type === 'heading') && out.content != null) {
    var t = q('.tpl-text'); if (t) t.textContent = out.content
  } else if (type === 'stat-card') {
    // value 家族由 AI 控制；label/note 人控（已烘焙在静态卡片里），不回填
    if (out.value != null) { var v = q('.tpl-stat-value'); if (v) v.textContent = out.value }
  } else if (type === 'info-line' && out.value != null) {
    var iv = q('.tpl-info-value'); if (iv) iv.textContent = out.value
  } else if (type === 'stat-group') {
    // 对象组件：value_map{label: 值}，以卡片上烘焙的 label 文本为键回填
    var valueMap = out.value_map
    if (valueMap && typeof valueMap === 'object') {
      var cards = block.querySelectorAll('.tpl-stat-card')
      cards.forEach(function (card) {
        var labelEl = card.querySelector('.tpl-stat-title')
        var v = card.querySelector('.tpl-stat-value')
        if (!labelEl || !v) return
        var mapped = valueMap[labelEl.textContent.trim()]
        if (mapped !== undefined) v.textContent = mapped
      })
    }
  } else if (type === 'matrix-table') {
    // 动态列表格：value_map{行label: {列label: 值}}，以表头/行首 th 文本为键逐格回填
    var mt = q('.tpl-table')
    var mvm = out.value_map
    if (mt && mvm && typeof mvm === 'object') {
      var colLabels = []
      mt.querySelectorAll('thead th').forEach(function (th, idx) {
        if (idx > 0) colLabels.push(th.textContent.trim())
      })
      mt.querySelectorAll('tbody tr').forEach(function (tr) {
        var rowTh = tr.querySelector('th')
        if (!rowTh) return
        var rowMap = mvm[rowTh.textContent.trim()]
        if (!rowMap || typeof rowMap !== 'object') return
        tr.querySelectorAll('td').forEach(function (td, j) {
          var v = rowMap[colLabels[j]]
          if (v !== undefined && v !== null) td.textContent = v
        })
      })
    }
  } else if (type === 'column-table') {
    // 列表格：列方向 value_map{列label: [每行的值]}，以表头文本为键转置重建 tbody
    var ct = q('.tpl-table')
    var cvm = out.value_map
    if (ct && cvm && typeof cvm === 'object') {
      var cols = []
      ct.querySelectorAll('thead th').forEach(function (th) {
        var arr = cvm[th.textContent.trim()]
        cols.push(Array.isArray(arr) ? arr : [])
      })
      var rc = 0
      cols.forEach(function (a) { rc = Math.max(rc, a.length) })
      var chtml = ''
      for (var ri = 0; ri < rc; ri++) {
        chtml += '<tr>' + cols.map(function (a) { return '<td>' + esc(a[ri] != null ? a[ri] : '') + '</td>' }).join('') + '</tr>'
      }
      ct.querySelector('tbody').innerHTML = chtml
    } else if (ct && out.rowsJson) {
      // 兼容旧契约 {headers, rowsJson}
      try {
        var crows = JSON.parse(out.rowsJson)
        if (Array.isArray(crows)) {
          ct.querySelector('tbody').innerHTML = crows.map(function (r) {
            return '<tr>' + r.map(function (c) { return '<td>' + esc(c) + '</td>' }).join('') + '</tr>'
          }).join('')
        }
      } catch (e) { /* rowsJson 非法时保留静态表 */ }
    }
  } else if (type === 'row-table') {
    // 对象组件：value_map{行label: 值}，以行首 th 文本为键回填 td
    var rvm = out.value_map
    if (rvm && typeof rvm === 'object') {
      block.querySelectorAll('.tpl-table tbody tr').forEach(function (tr) {
        var th = tr.querySelector('th')
        var td = tr.querySelector('td')
        if (!th || !td) return
        var mapped = rvm[th.textContent.trim()]
        if (mapped !== undefined) td.textContent = mapped
      })
    }
  } else if (type === 'data-table') {
    var table = q('.tpl-table')
    if (table) {
      try {
        var heads = out.headers ? String(out.headers).split(/[,，]/).map(function (h) { return h.trim() }).filter(Boolean) : null
        var rows = out.rowsJson ? JSON.parse(out.rowsJson) : null
        if (heads) {
          table.querySelector('thead').innerHTML = '<tr>' + heads.map(function (h) { return '<th>' + esc(h) + '</th>' }).join('') + '</tr>'
        }
        if (Array.isArray(rows)) {
          table.querySelector('tbody').innerHTML = rows.map(function (r) {
            return '<tr>' + r.map(function (c) { return '<td>' + esc(c) + '</td>' }).join('') + '</tr>'
          }).join('')
        }
      } catch (e) { /* rowsJson 非法时保留静态表 */ }
    }
  }
}
`

// 导出真标签静态 HTML：非 SPA 壳，图表为内联 SVG；带 bindScript 的组件块内嵌
// 自执行脚本，文件打开时对 window.__DATA__ 重算并回填（图表除外，SVG 已烘焙）；
// window.__DATA__ 由首个 data-script 组件注入
export function exportHtml(data: Data, title: string): string {
  const body = renderToStaticMarkup(<Render config={editorConfig} data={data} />)
  return `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>${A4_CSS}</style>
<script>${BIND_RUNTIME}</script>
</head>
<body>
${body}
</body>
</html>
`
}

// 存为模板的片段：不包文档壳（/api/render 的 _shell 会包）。
// <!--head--> 标记段会被渲染管线挪进 iframe 文档的 <head>；
// 数据注入不再由这里负责——首个组件 data-script 携带
// （编辑器/导出=静态 JSON，模板=Jinja {{ data | tojson }}）
import { setTemplateMode } from './bindRuntime'

export function exportTemplateFragment(data: Data): string {
  setTemplateMode(true)
  try {
    const body = renderToStaticMarkup(<Render config={editorConfig} data={data} />)
    return `<!--head-->
<style>${A4_CSS}</style>
<script>${BIND_RUNTIME}</script>
<!--/head-->
${body}
`
  } finally {
    setTemplateMode(false)
  }
}

export function downloadHtml(data: Data, title: string): void {
  const blob = new Blob([exportHtml(data, title)], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${title}.html`
  a.click()
  URL.revokeObjectURL(url)
}
