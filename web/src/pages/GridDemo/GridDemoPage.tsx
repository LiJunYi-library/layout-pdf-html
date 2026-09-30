// React-Grid-Layout 试验页（/grid-demo）：多页面 + 组件拖入 + 选中配置 + 导出静态 HTML
// 表格采用 A/B 双组件：编辑用 TableCardEdit（列宽可拖拽），导出用 TableCard（只读列宽数据）
import { useEffect, useRef, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ReactGridLayout, {
  useContainerWidth,
  type Layout,
  type LayoutItem,
} from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import { v7 as uuidV7 } from "uuid";
import type { Content, TableContent } from "./types";
import { cardCss } from "./cardCss";
import "./GridDemoPage.scss";
import { StatCard } from "./components/StatCard/StatCard";
import { ChartCard } from "./components/ChartCard/ChartCard";
import { TextCard } from "./components/TextCard/TextCard";
import { TableCard } from "./components/TableCard/TableCard";
import { TableCardEdit } from "./components/TableCard/TableCard.edit";
import { TableCardConfig } from "./components/TableCard/TableCard.config";
import { BaseCardConfig } from "./components/BaseCard/BaseCard.config";
import { statCardDefault } from "./components/StatCard/StatCard.default.config";
import { chartCardDefault } from "./components/ChartCard/ChartCard.default.config";
import { textCardDefault } from "./components/TextCard/TextCard.default.config";
import { tableCardDefault } from "./components/TableCard/TableCard.default.config";

// 组件栏条目：默认 layout + 默认 content，来自各组件的 .default.config
interface PaletteDef {
  layout: Omit<LayoutItem, "i" | "x" | "y">;
  content: Content;
}

const paletteDefs: PaletteDef[] = [
  statCardDefault,
  chartCardDefault,
  textCardDefault,
  tableCardDefault,
];

// 按 componentCategory 分组为两级树：分类 → 组件
const paletteTree: Array<[string, PaletteDef[]]> = [];
for (const def of paletteDefs) {
  const group = paletteTree.find(
    ([category]) => category === def.content.componentCategory,
  );
  if (group) group[1].push(def);
  else paletteTree.push([def.content.componentCategory, [def]]);
}

// 编辑器渲染：表格用组件 A（可拖拽列宽）
function renderEditorContent(
  id: string,
  content: Content,
  onTableChange: (next: TableContent) => void,
) {
  switch (content.componentType) {
    case "stat":
      return <StatCard id={id} content={content} />;
    case "chart":
      return <ChartCard id={id} content={content} />;
    case "text":
      return <TextCard id={id} content={content} />;
    case "table":
      return (
        <TableCardEdit
          id={id}
          content={content}
          onColWidthsChange={(colWidths) =>
            onTableChange({ ...content, colWidths })
          }
        />
      );
  }
}

// 导出渲染：表格用组件 B（静态，只读 colWidths）
function renderStaticContent(id: string, content: Content) {
  switch (content.componentType) {
    case "stat":
      return <StatCard id={id} content={content} />;
    case "chart":
      return <ChartCard id={id} content={content} />;
    case "text":
      return <TextCard id={id} content={content} />;
    case "table":
      return <TableCard id={id} content={content} />;
  }
}

// ---- 多页面数据模型 ----

interface PageData {
  id: string;
  layout: LayoutItem[];
  contents: Record<string, Content>;
}

// 初始条目：布局与内容成对定义，id 统一用 uuidV7 生成
const initialEntries: Array<{
  layout: Omit<LayoutItem, "i">;
  content: Content;
}> = [
  {
    layout: { x: 0, y: 0, w: 4, h: 3, minW: 2, maxW: 8 },
    content: {
      componentType: "stat",
      componentCategory: "数据",
      componentName: "统计卡片",
      name: "",
      value: "23",
      color: "#91cc75",
    },
  },
  {
    layout: { x: 0, y: 0, w: 4, h: 3 },
    content: {
      componentType: "stat",
      componentCategory: "数据",
      componentName: "统计卡片",
      name: "",
      value: "7",
      color: "#ee6666",
    },
  },
  {
    layout: { x: 0, y: 3, w: 6, h: 4 },
    content: {
      componentType: "chart",
      componentCategory: "数据",
      componentName: "图表",
      name: "",
      data: [12, 20, 15, 28, 22, 30, 26],
    },
  },
  {
    layout: { x: 6, y: 3, w: 6, h: 4 },
    content: {
      componentType: "text",
      componentCategory: "文本",
      componentName: "文本",
      name: "",
      text: "表格列边界可拖拽调宽；点击卡片选中后右侧编辑；「导出 HTML」生成静态页面。",
    },
  },
  {
    layout: { x: 0, y: 7, w: 12, h: 5 },
    content: {
      componentType: "table",
      componentCategory: "表格",
      componentName: "表格",
      name: "",
      columns: ["名称", "类型", "更新时间"],
      colWidths: [50, 20, 30],
      rows: [
        ["团体报告.pdf", "报告", "2026-09-20"],
        ["布局模板.json", "模板", "2026-09-25"],
      ],
    },
  },
];

function makeInitialPage(): PageData {
  const ids = initialEntries.map(() => uuidV7());
  return {
    id: uuidV7(),
    layout: initialEntries.map((e, idx) => ({ i: ids[idx], ...e.layout })),
    contents: Object.fromEntries(
      initialEntries.map((e, idx) => [ids[idx], e.content]),
    ),
  };
}

// 与 RGL 内部 calcGridItemPosition 一致的坐标换算
const COLS = 12;
const ROW_HEIGHT = 40;
const MARGIN = 10;
// A4 @96dpi 兜底宽度（导出时若页面尚未测量到宽度则用它）
const PAGE_WIDTH_FALLBACK = 794;

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

// 导出静态 HTML：每页一个 .page 容器，打印时按页分页
function exportHtml(pages: PageData[], widthOf: (pageId: string) => number) {
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
    return `  <div class="page">
    <div class="grid-container" style="width:${containerWidth}px;height:${containerHeight}px">
${items.join("\n")}
    </div>
  </div>`;
  });
  const pageCss = `
  .page { width: 210mm; min-height: 297mm; margin: 0 auto 16px; background: #fff;
    box-shadow: 0 1px 4px rgba(0,0,0,0.15); box-sizing: border-box; }
  @media print { .page { page-break-after: always; margin: 0; box-shadow: none; } }
`;
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>导出的布局</title>
<style>${cardCss}${pageCss}</style>
</head>
<body>
${pagesHtml.join("\n")}
</body>
</html>`;
}

function download(filename: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/html" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ---- 单页编辑器：一页一个 RGL ----

function PageEditor({
  page,
  selectedItemId,
  draggingType,
  setDraggingType,
  onLayoutChange,
  onDropComponent,
  onSelectItem,
  onRemoveItem,
  onContentChange,
  onWidthChange,
}: {
  page: PageData;
  selectedItemId: string | null;
  draggingType: string | null;
  setDraggingType: (t: string | null) => void;
  onLayoutChange: (layout: Layout) => void;
  onDropComponent: (type: string, position: { x: number; y: number }) => void;
  onSelectItem: (itemId: string) => void;
  onRemoveItem: (itemId: string) => void;
  onContentChange: (itemId: string, next: Content) => void;
  onWidthChange: (width: number) => void;
}) {
  const { width, containerRef, mounted } = useContainerWidth();

  useEffect(() => {
    if (mounted && width) onWidthChange(width);
  }, [mounted, width, onWidthChange]);

  return (
    <div ref={containerRef} className="canvas">
      {mounted && (
        <ReactGridLayout
          layout={page.layout}
          width={width}
          gridConfig={{ cols: COLS, rowHeight: ROW_HEIGHT }}
          dragConfig={{ enabled: true }}
          resizeConfig={{ enabled: true }}
          dropConfig={{
            enabled: true,
            defaultItem: { w: 3, h: 3 },
            onDragOver: () => {
              const def = paletteDefs.find(
                (d) => d.content.componentType === draggingType,
              );
              return def ? { w: def.layout.w, h: def.layout.h } : undefined;
            },
          }}
          onDrop={(_newLayout, item, e) => {
            const payload =
              (e as DragEvent).dataTransfer?.getData("text/plain") ?? "";
            const type = payload.startsWith("component:")
              ? payload.slice("component:".length)
              : draggingType;
            if (type && item) onDropComponent(type, { x: item.x, y: item.y });
            setDraggingType(null);
          }}
          onLayoutChange={onLayoutChange}
        >
          {page.layout.map((item) => (
            <div
              key={item.i}
              onClick={() => onSelectItem(item.i)}
              style={{
                background: item.static ? "#d9d9d9" : "#fff",
                border:
                  item.i === selectedItemId
                    ? "2px solid #5470c6"
                    : "1px solid #ddd",
                borderRadius: 6,
                overflow: "hidden",
              }}
            >
              {renderEditorContent(item.i, page.contents[item.i], (next) =>
                onContentChange(item.i, next),
              )}
              <button
                style={{
                  position: "absolute",
                  top: 0,
                  right: 0,
                  width: "18px",
                  height: "18px",
                  background: "#fd6666",
                  borderRadius: "50%",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  color: "white",
                  padding: 0,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveItem(item.i);
                }}
              >
                ×
              </button>
            </div>
          ))}
        </ReactGridLayout>
      )}
    </div>
  );
}

export function GridDemoPage() {
  const [pages, setPages] = useState<PageData[]>(() => [makeInitialPage()]);
  const [selected, setSelected] = useState<{
    pageId: string;
    itemId: string;
  } | null>(null);
  // 当前页：组件栏点击添加、导出兜底等行为都落在它身上
  const [activePageId, setActivePageId] = useState(pages[0].id);
  // 组件栏正在拖出的组件类型（dragover 阶段读不到 dataTransfer，用它传递）
  const [draggingType, setDraggingType] = useState<string | null>(null);
  // 页面排序拖拽中的页面 id
  const [draggingPageId, setDraggingPageId] = useState<string | null>(null);
  // 各页面测得的实际像素宽度，导出 HTML 用
  const pageWidths = useRef<Record<string, number>>({});

  const updatePage = (pageId: string, updater: (p: PageData) => PageData) =>
    setPages((prev) => prev.map((p) => (p.id === pageId ? updater(p) : p)));

  const addComponent = (
    def: PaletteDef,
    pageId: string,
    position?: { x: number; y: number },
  ) => {
    const id = uuidV7();
    updatePage(pageId, (p) => ({
      ...p,
      layout: [
        ...p.layout,
        {
          i: id,
          x: position?.x ?? 0,
          y: position?.y ?? Infinity,
          ...def.layout,
        },
      ],
      contents: { ...p.contents, [id]: structuredClone(def.content) },
    }));
    setSelected({ pageId, itemId: id });
    setActivePageId(pageId);
  };

  const removeItem = (pageId: string, itemId: string) => {
    updatePage(pageId, (p) => {
      const contents = { ...p.contents };
      delete contents[itemId];
      return {
        ...p,
        layout: p.layout.filter((item) => item.i !== itemId),
        contents,
      };
    });
    if (selected?.itemId === itemId) setSelected(null);
  };

  const addPage = () => {
    const page: PageData = { id: uuidV7(), layout: [], contents: {} };
    setPages((prev) => [...prev, page]);
    setActivePageId(page.id);
  };

  const removePage = (pageId: string) => {
    setPages((prev) => {
      if (prev.length <= 1) return prev; // 保底一页
      const next = prev.filter((p) => p.id !== pageId);
      if (activePageId === pageId) setActivePageId(next[0].id);
      if (selected?.pageId === pageId) setSelected(null);
      return next;
    });
  };

  // 把页面移动到目标下标（拖拽排序用）
  const movePage = (pageId: string, toIndex: number) => {
    setPages((prev) => {
      const from = prev.findIndex((p) => p.id === pageId);
      if (from < 0 || from === toIndex) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  };

  const selectedPage = pages.find((p) => p.id === selected?.pageId);
  const selectedContent = selected
    ? selectedPage?.contents[selected.itemId]
    : undefined;

  return (
    <div>
      <div className="grid-demo-page">
        <style>{cardCss}</style>
        <header className="grid-demo-page-header">
          <button
            onClick={() =>
              download(
                "grid-layout.html",
                exportHtml(
                  pages,
                  (pageId) => pageWidths.current[pageId] ?? PAGE_WIDTH_FALLBACK,
                ),
              )
            }
          >
            导出 HTML
          </button>
        </header>
        <main className="grid-demo-page-main">
          <aside className="palette">
            <strong>组件</strong>
            {paletteTree.map(([category, defs]) => (
              <details key={category} open>
                <summary>{category}</summary>
                {defs.map((def) => (
                  <div
                    key={def.content.componentType}
                    className="palette-item"
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData(
                        "text/plain",
                        `component:${def.content.componentType}`,
                      );
                      e.dataTransfer.effectAllowed = "copy";
                      setDraggingType(def.content.componentType);
                    }}
                    onDragEnd={() => setDraggingType(null)}
                    onClick={() => addComponent(def, activePageId)}
                    title="拖入布局或点击添加到当前页"
                  >
                    {def.content.componentName}
                  </div>
                ))}
              </details>
            ))}
          </aside>
          <div className="main-content">
            <div className="edit-pages">
              {pages.map((page, idx) => (
                <div
                  key={page.id}
                  className={[
                    "page-thumb",
                    page.id === activePageId ? "active" : "",
                    page.id === draggingPageId ? "dragging" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", `page:${page.id}`);
                    e.dataTransfer.effectAllowed = "move";
                    setDraggingPageId(page.id);
                  }}
                  onDragEnd={() => setDraggingPageId(null)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (draggingPageId && draggingPageId !== page.id)
                      movePage(draggingPageId, idx);
                  }}
                  onClick={() => setActivePageId(page.id)}
                  title="拖拽排序，点击设为当前页"
                >
                  {idx + 1}
                  {pages.length > 1 && (
                    <button
                      className="remove"
                      onClick={(e) => {
                        e.stopPropagation();
                        removePage(page.id);
                      }}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              <button className="add-page" onClick={addPage}>
                + 添加页面
              </button>
            </div>
            <div className="pages">
              {pages.map((page) => (
                <div
                  key={page.id}
                  className={`page${page.id === activePageId ? " active" : ""}`}
                  onClick={() => setActivePageId(page.id)}
                >
                  <PageEditor
                    page={page}
                    selectedItemId={
                      selected?.pageId === page.id ? selected.itemId : null
                    }
                    draggingType={draggingType}
                    setDraggingType={setDraggingType}
                    onLayoutChange={(layout) =>
                      updatePage(page.id, (p) => ({
                        ...p,
                        layout: [...layout],
                      }))
                    }
                    onDropComponent={(type, position) => {
                      const def = paletteDefs.find(
                        (d) => d.content.componentType === type,
                      );
                      if (def) addComponent(def, page.id, position);
                    }}
                    onSelectItem={(itemId) =>
                      setSelected({ pageId: page.id, itemId })
                    }
                    onRemoveItem={(itemId) => removeItem(page.id, itemId)}
                    onContentChange={(itemId, next) =>
                      updatePage(page.id, (p) => ({
                        ...p,
                        contents: { ...p.contents, [itemId]: next },
                      }))
                    }
                    onWidthChange={(w) => {
                      pageWidths.current[page.id] = w;
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          {selectedContent && selected && (
            <aside className="config">
              <button className="close" onClick={() => setSelected(null)}>
                ×
              </button>
              {(() => {
                const updateSelected = (updater: (c: Content) => Content) =>
                  updatePage(selected.pageId, (p) => ({
                    ...p,
                    contents: {
                      ...p.contents,
                      [selected.itemId]: updater(p.contents[selected.itemId]),
                    },
                  }));
                return (
                  <BaseCardConfig
                    componentName={selectedContent.componentName}
                    id={selected.itemId}
                    name={selectedContent.name}
                    onNameChange={(name) =>
                      updateSelected((c) => ({ ...c, name }))
                    }
                  >
                    {selectedContent.componentType === "table" ? (
                      <TableCardConfig
                        content={selectedContent}
                        onChange={(next) => updateSelected(() => next)}
                      />
                    ) : (
                      <p style={{ color: "#888" }}>
                        该组件（{selectedContent.componentType}
                        ）暂无专属配置项。
                      </p>
                    )}
                  </BaseCardConfig>
                );
              })()}
            </aside>
          )}
        </main>
      </div>
      <div style={{ display: "flex", gap: 16 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3>pages（页面数据）</h3>
          <pre
            style={{
              background: "#f0f0f0",
              padding: 12,
              borderRadius: 8,
              overflow: "auto",
            }}
          >
            {JSON.stringify(pages, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}
