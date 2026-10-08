// 单页编辑器：一页一个 RGL，负责该页的布局编辑、组件拖入、卡片选中/删除
import { useEffect } from "react";
import ReactGridLayout, {
  useContainerWidth,
  type Layout,
} from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import type { Content, PageData } from "./types";
import { COLS, ROW_HEIGHT } from "./grid";
import { paletteDefs } from "./palette";
import { renderEditorContent } from "./renderContent";

export function PageEditor({
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
              onClick={(e) => {
                e.stopPropagation(); // 阻止冒泡到 .page，避免组件选中后立即被页面点击清空
                onSelectItem(item.i);
              }}
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
              )}              <button
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
