import type { ReactNode } from "react";
import type { StatGroupContent } from "../../types";

const DIRECTION = {
  tb: "column",
  lr: "row",
  bt: "column-reverse",
  rl: "row-reverse",
} as const;

const JUSTIFY = {
  left: "flex-start",
  center: "center",
  right: "flex-end",
} as const;

// 统计卡片组：统计项从上到下排，单项内 label/value 的位置由 itemLayout 决定
// 无卡片内交互，编辑态/导出态共用
export function StatGroupCard({
  id,
  content,
  children,
}: {
  id: string;
  content: StatGroupContent;
  children?: ReactNode;
}) {
  const items = content.value ?? [];
  const align = content.align ?? "center";
  const justify = JUSTIFY[align];
  return (
    <div className="card-body" data-id={id} data-name={content.name} data-type={content.componentType}>
      <div className="stat-group">
        {items.map((item, i) => {
          const direction = DIRECTION[item.layout ?? "tb"];
          const isColumn = direction === "column" || direction === "column-reverse";
          return (
            <div
              key={i}
              className="stat-group-item"
              style={{
                flexDirection: direction,
                justifyContent: justify,
                // 纵向排列时水平对齐走 alignItems（横向时保持 CSS 的 baseline 对齐）
                ...(isColumn ? { alignItems: justify } : {}),
              }}
            >
              <span className="stat-group-label">{item.label}</span>
              {item.separator ? (
                <span className="stat-group-sep">{item.separator}</span>
              ) : null}
              <span className="stat-group-value">{item.value}</span>
            </div>
          );
        })}
      </div>
      {children}
    </div>
  );
}
