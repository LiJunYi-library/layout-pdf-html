// 生成静态 HTML：每页一个 .page 容器，打印时按页分页
// dataLocal（data.local.json 内容）内联到 <head>，供导出页面里的脚本读取
import { renderToStaticMarkup } from "react-dom/server";
import type { LayoutItem } from "react-grid-layout";
import type { PageData } from "./types";
import { COLS, MARGIN, ROW_HEIGHT } from "./grid";
import { renderStaticContent } from "./renderContent";
import { cardCss } from "./cardCss";
import { ECHARTS_CDN } from "./components/ChartCard/echarts";

// A4 @96dpi 兜底宽度（页面尚未测量到宽度时用它）
const PAGE_WIDTH_FALLBACK = 794;

// 与 RGL 内部 calcGridItemPosition 一致的坐标换算
function itemToPixels(item: LayoutItem, containerWidth: number) {
  const colWidth = (containerWidth - MARGIN * (COLS - 1) - MARGIN * 2) / COLS;
  const left = Math.round((colWidth + MARGIN) * item.x + MARGIN);
  const top = Math.round((ROW_HEIGHT + MARGIN) * item.y + MARGIN);
  let width = Math.round(colWidth * item.w + Math.max(0, item.w - 1) * MARGIN);
  let height = Math.round(
    ROW_HEIGHT * item.h + Math.max(0, item.h - 1) * MARGIN,
  );
  width +=
    Math.round((colWidth + MARGIN) * (item.x + item.w) + MARGIN) -
    left -
    width -
    MARGIN;
  height +=
    Math.round((ROW_HEIGHT + MARGIN) * (item.y + item.h) + MARGIN) -
    top -
    height -
    MARGIN;
  return { left, top, width, height };
}

export function saveHtml(
  pages: PageData[],
  widthOf: (pageId: string) => number,
  dataLocal: unknown,
): string {
  const pagesHtml = pages.map((page) => {
    const containerWidth = widthOf(page.id);
    const items = page.layout.map((item) => {
      const { left, top, width, height } = itemToPixels(item, containerWidth);
      const inner = renderToStaticMarkup(
        renderStaticContent(item.i, page.contents[item.i]),
      );
      return `      <div class="grid-item" style="left:${left}px;top:${top}px;width:${width}px;height:${height}px">${inner}</div>`;
    });
    const containerHeight = page.layout.length
      ? Math.max(
          ...page.layout.map((item) => {
            const { top, height } = itemToPixels(item, containerWidth);
            return top + height;
          }),
        ) + MARGIN
      : 0;
    const bgStyle = [
      page.config?.backgroundColor
        ? `background-color:${page.config.backgroundColor}`
        : "",
      page.config?.backgroundImage
        ? `background-image:url('${page.config.backgroundImage}');background-size:cover`
        : "",
    ]
      .filter(Boolean)
      .join(";");
    return `  <div class="page" style="${bgStyle}">
    <div class="grid-layout" style="width:${containerWidth}px;height:${containerHeight}px">
${items.join("\n")}
    </div>
  </div>`;
  });
  const pageCss = `
  .page { width: 210mm; min-height: 297mm; margin: 0 auto 16px; background: #fff;
    box-shadow: 0 1px 4px rgba(0,0,0,0.15); box-sizing: border-box; }
  @media print { .page { page-break-after: always; margin: 0; box-shadow: none; } }
`;
  // 有图表组件时才引 echarts CDN（同步加载，保证卡片内联 script 执行时 window.echarts 已就绪）
  const hasChart = pages.some((page) =>
    Object.values(page.contents).some(
      (c) => c.componentType === "chart" || c.componentType === "pie",
    ),
  );
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>导出的布局</title>
<script>window.__DATA = ${JSON.stringify(dataLocal ?? null)};</script>
${hasChart ? `<script src="${ECHARTS_CDN}"></script>` : ""}
<style>${cardCss}${pageCss}</style>
</head>
<body>
${pagesHtml.join("\n")}
</body>
</html>`;
}

export { PAGE_WIDTH_FALLBACK };
