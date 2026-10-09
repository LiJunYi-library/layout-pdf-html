import type { AiSummaryContent } from '../../types'

// 拖入/新增 AI 总结时的默认配置
export const aiSummaryCardDefault = {
  layout: { w: 6, h: 3 },
  content: {
    componentType: 'aiSummary',
    componentCategory: 'AI',
    componentName: 'AI总结',
    name: '',
    value: 'AI 总结内容',
  } satisfies AiSummaryContent,
}
