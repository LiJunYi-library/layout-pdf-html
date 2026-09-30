import type { TableContent } from '../../types'

// 拖入/新增表格时的默认配置
export const tableCardDefault = {
  layout: { w: 6, h: 5 },
  content: {
    componentType: 'table',
    componentCategory: '表格',
    componentName: '表格',
    name: '',
    columns: ['列1', '列2'],
    colWidths: [50, 50],
    rows: [['', '']],
  } satisfies TableContent,
}
