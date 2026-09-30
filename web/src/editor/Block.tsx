// 每个组件外层容器的统一结构（组件规范）：
// <div class="tpl-block"><div>渲染</div><script>数据脚本</script><style>组件样式</style></div>
// - data-component 类型 + data-map 计算说明（可为空）是语义标注
// - script（bindScript）为 LLM 写的数据逻辑：编辑器里 innerHTML 注入不执行，导出文档源解析时执行
// - css（bindStyle）为 LLM 写的组件级样式：<style> 经 innerHTML 注入即生效（含编辑器预览）
export function Block({ component, bid, map, styleMap, script, css, children }: {
  component: string
  bid?: string
  map: string
  styleMap?: string
  script?: string
  css?: string
  children: React.ReactNode
}) {
  const call = script
    ? `<script>window.__runBind&&window.__runBind(document.currentScript.closest('.tpl-block'),${
      JSON.stringify(script).replace(/<\//g, '<\\/')
    })</script>`
    : null
  return (
    <div className="tpl-block" data-component={component} data-bid={bid} data-map={map} data-style-map={styleMap ?? ''}>
      <div>
        {children}
      </div>
      {call && (
        <span
          className="tpl-bind"
          style={{ display: 'none' }}
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: call }}
        />
      )}
      {css && (
        <span
          className="tpl-style"
          style={{ display: 'none' }}
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: `<style>${css}</style>` }}
        />
      )}
    </div>
  )
}
