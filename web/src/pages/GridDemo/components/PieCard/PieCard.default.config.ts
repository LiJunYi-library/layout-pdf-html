import type { PieContent } from '../../types'

// 拖入/新增饼图时的默认配置
export const pieCardDefault = {
  layout: { w: 4, h: 4 },
  content: {
    componentType: 'pie',
    componentCategory: '数据',
    componentName: '饼图',
    name: '',
    value: [
      { name: '良好', value: 404 },
      { name: '轻微', value: 137 },
      { name: '中度', value: 166 },
    ],
  } satisfies PieContent,
}
