// 卡片样式：页面 <style> 注入与导出 HTML 共用同一份
export const cardCss = `
  body { margin: 0; font-family: system-ui, sans-serif; }
  .react-grid-layout, .grid-layout { position: relative; margin: 0 auto; }
  .react-grid-item, .grid-item { position: absolute; box-sizing: border-box; background: #fff;
    border: 1px solid #ddd; border-radius: 6px; overflow: hidden; }
  .react-grid-item.is-static, .grid-item.is-static { background: #d9d9d9; }
  .card-body { padding: 8px; height: 100%; box-sizing: border-box; overflow: auto; }
  .stat-value { font-size: 28px; font-weight: 600; margin-top: 4px; }
  .stat-title { font-size: 18px; font-weight: 700; color: #333; }
  .stat-group { display: flex; flex-direction: column; justify-content: center; height: 100%; gap: 4px; }
  .stat-group-item { display: flex; align-items: baseline; justify-content: center; gap: 8px; }
  .stat-group-label { font-size: 13px; color: #888; }
  .stat-group-value { font-size: 18px; font-weight: 600; color: #333; white-space: pre-line; }
  .stat-group-sep { text-align: center; color: #ccc; font-size: 12px; line-height: 1; }
  .card-text { font-size: 13px; color: #333; margin: 0; }
  .card-ai-summary { white-space: pre-line; }
  .card-table { width: 100%; table-layout: fixed; border-collapse: collapse; font-size: 13px; margin-top: 4px; }
  .card-table th, .card-table td { border: 1px solid #e0e0e0; padding: 4px 8px; text-align: left;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .card-table th { background: #f0f0f0; position: relative; }
  .card-table-title { font-size: 14px; font-weight: 600; color: #333; margin-bottom: 4px; }
  .chart-host { width: 100%; height: 100%; }
  .col-resizer { position: absolute; right: -4px; top: 0; width: 8px; height: 100%;
    cursor: col-resize; z-index: 1; }
  .col-resizer:hover { background: #5470c6; opacity: 0.4; }
`
