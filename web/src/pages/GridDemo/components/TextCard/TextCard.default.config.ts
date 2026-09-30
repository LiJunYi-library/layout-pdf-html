import type { TextContent } from '../../types'

// 拖入/新增文本时的默认配置
export const textCardDefault = {
  layout: { w: 4, h: 3 },
  content: {
    componentType: 'text',
    componentCategory: '文本',
    componentName: '文本',
    name: '',
    text: '文本内容',
  } satisfies TextContent,
}
