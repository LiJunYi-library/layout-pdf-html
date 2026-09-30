import type { ChartContent } from '../../types'

// 拖入/新增图表时的默认配置
export const chartCardDefault = {
  layout: { w: 6, h: 4 },
  content: {
    componentType: 'chart',
    componentCategory: '数据',
    componentName: '图表',
    name: '',
    data: [5, 9, 7, 12, 8],
  } satisfies ChartContent,
}
