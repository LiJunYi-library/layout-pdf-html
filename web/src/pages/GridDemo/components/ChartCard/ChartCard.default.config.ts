import type { ChartContent } from '../../types'

// 拖入/新增图表时的默认配置
export const chartCardDefault = {
  layout: { w: 6, h: 4 },
  content: {
    componentType: 'chart',
    componentCategory: '数据',
    componentName: '柱状图表',
    name: '',
    categoryData: ['一月', '二月', '三月', '四月', '五月'],
    series: [{ name: '数量', type: 'bar', data: [5, 9, 7, 12, 8] }],
    categoryAxis: 'x',
  } satisfies ChartContent,
}
