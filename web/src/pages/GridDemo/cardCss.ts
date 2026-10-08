// 卡片样式：页面 <style> 注入与导出 HTML 共用同一份
export const cardCss = `
  body { margin: 0; font-family: system-ui, sans-serif; }
  .react-grid-layout, .grid-layout { position: relative; margin: 0 auto; }
  .react-grid-item, .grid-item { position: absolute; box-sizing: border-box; background: #fff;
    border: 1px solid #ddd; border-radius: 6px; overflow: hidden; }
  .react-grid-item.is-static, .grid-item.is-static { background: #d9d9d9; }
  .card-body { padding: 8px; height: 100%; box-sizing: border-box; overflow: auto; }
  .stat-value { font-size: 32px; font-weight: 700; margin-top: 8px; }
  .card-text { font-size: 13px; color: #333; margin: 0; }
  .card-table { width: 100%; table-layout: fixed; border-collapse: collapse; font-size: 13px; margin-top: 4px; }
  .card-table th, .card-table td { border: 1px solid #e0e0e0; padding: 4px 8px; text-align: left;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .card-table th { background: #f0f0f0; position: relative; }
  .col-resizer { position: absolute; right: -4px; top: 0; width: 8px; height: 100%;
    cursor: col-resize; z-index: 1; }
  .col-resizer:hover { background: #5470c6; opacity: 0.4; }
`
