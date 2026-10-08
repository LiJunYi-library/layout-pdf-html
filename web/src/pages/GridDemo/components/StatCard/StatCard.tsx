import type { ReactNode } from "react";
import type { StatContent } from "../../types";

export function StatCard({
  id,
  content,
  children,
}: {
  id: string;
  content: StatContent;
  children?: ReactNode;
}) {
  return (
    <div className="card-body" data-id={id} data-name={content.name} data-type={content.componentType}>
      <div className="stat-value" style={{ color: content.color }}>
        {content.value}
      </div>
      {children}
    </div>
  );
}
