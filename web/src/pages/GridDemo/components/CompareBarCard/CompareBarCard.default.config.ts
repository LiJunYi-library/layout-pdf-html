import type { CompareBarContent } from '../../types'

// 拖入/新增对比条形图时的默认配置
export const compareBarCardDefault = {
  layout: { w: 8, h: 4 },
  content: {
    componentType: 'compareBar',
    componentCategory: '图表',
    componentName: '对比条形图',
    name: '',
    value: [
      { name: '指标1', value_a: 24, value_b: 20, value_a_sub: 14.9, value_b_sub: 10.2 },
      { name: '指标2', value_a: 22, value_b: 25, value_a_sub: 8.7, value_b_sub: 9.2 },
    ],
  } satisfies CompareBarContent,
}
