import { useRef } from "react";
import type { TableContent } from "../../types";

// 组件 A：可编辑表格，列边界可拖拽调整宽度，结果写回 colWidths（编辑器用）
export function TableCardEdit({
  id,
  content,
  onColWidthsChange,
}: {
  id: string;
  content: TableContent;
  onColWidthsChange: (next: number[]) => void;
}) {
  const tableRef = useRef<HTMLTableElement>(null);
  const { columns, rows, colWidths } = content;

  const startDrag = (ci: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation(); // 阻止冒泡，避免触发 RGL 的卡片拖拽
    const tableWidth = tableRef.current?.getBoundingClientRect().width ?? 1;
    const startX = e.clientX;
    const startWidths = [...colWidths];
    const onMove = (ev: MouseEvent) => {
      const deltaPct = ((ev.clientX - startX) / tableWidth) * 100;
      const left = startWidths[ci] + deltaPct;
      const right = startWidths[ci + 1] - deltaPct;
      if (left < 5 || right < 5) return; // 每列至少 5%
      const next = [...startWidths];
      next[ci] = left;
      next[ci + 1] = right;
      onColWidthsChange(next);
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return (
    <div className="card-body" data-id={id} data-name={content.name} data-type={content.componentType}>
      <table className="card-table" ref={tableRef}>
        <colgroup>
          {colWidths.map((w, ci) => (
            <col key={ci} style={{ width: `${w}%` }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {columns.map((col, ci) => (
              <th key={ci}>
                {col}
                {ci < columns.length - 1 && (
                  <span
                    className="col-resizer"
                    onMouseDown={(e) => startDrag(ci, e)}
                  />
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri}>
              {columns.map((_, ci) => (
                <td key={ci}>{row[ci] ?? ""}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
