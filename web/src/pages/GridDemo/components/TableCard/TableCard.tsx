import type { TableContent } from "../../types";
const str = "var a = 5; console.log(a)"
// 组件 B：静态表格，只按 colWidths 渲染，不可拖拽（导出 HTML 用）
export function TableCard({ id, content }: { id: string; content: TableContent }) {
  return (
    <div className="card-body" data-id={id} data-name={content.name} data-type={content.componentType}>
      <table className="card-table">
        <colgroup>
          {content.colWidths.map((w, ci) => (
            <col key={ci} style={{ width: `${w}%` }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {content.columns.map((col, ci) => (
              <th key={ci}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {content.rows.map((row, ri) => (
            <tr key={ri}>
              {content.columns.map((_, ci) => (
                <td key={ci}>{row[ci] ?? ""}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
       <script>{str}</script>
    </div>
  );
}
