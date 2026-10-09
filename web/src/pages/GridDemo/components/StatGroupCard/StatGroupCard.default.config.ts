import type { StatGroupContent } from '../../types'

// 拖入/新增统计卡片组时的默认配置
export const statGroupCardDefault = {
  layout: { w: 3, h: 3 },
  content: {
    componentType: 'statGroup',
    componentCategory: '数据',
    componentName: '统计卡片组',
    name: '',
    value: [
      { label: '高等级预警率', value: '8.5%' },
      { label: '有效人数', value: '4人 / 有效N=47' },
    ],
  } satisfies StatGroupContent,
}
