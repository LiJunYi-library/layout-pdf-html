import type { StatContent } from '../../types'

// 拖入/新增统计卡片时的默认配置
export const statCardDefault = {
  layout: { w: 4, h: 3 },
  content: {
    componentType: 'stat',
    componentCategory: '数据',
    componentName: '统计卡片',
    name: '',
    value: '0',
    color: '#5470c6',
  } satisfies StatContent,
}
