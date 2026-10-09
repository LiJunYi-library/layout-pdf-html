import type { ReactNode } from "react";
import type { CompareBarContent } from "../../types";
import { buildCompareOption } from "./echarts";

// 静态对比条形图（导出 HTML 用）：渲染宿主 div + 内联初始化 script
// echarts 全局由导出 HTML <head> 里的 CDN script 提供；SVG 渲染，打印/转 PDF 矢量清晰
export function CompareBarCard({
  id,
  content,
  children,
}: {
  id: string;
  content: CompareBarContent;
  children?: ReactNode;
}) {
  const option = JSON.stringify(buildCompareOption(content));
  return (
    <div className="card-body" data-id={id} data-name={content.name} data-type={content.componentType}>
      <div className="chart-host" />
      <script
        dangerouslySetInnerHTML={{
          __html: `{
  const host = document.currentScript.previousElementSibling;
  if (window.echarts && host) {
    echarts.init(host, null, { renderer: 'svg' }).setOption(${option});
  }
}`,
        }}
      />
      {children}
    </div>
  );
}
