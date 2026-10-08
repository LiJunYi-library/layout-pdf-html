import type { ReactNode } from "react";
import type { ChartContent } from "../../types";

export function ChartCard({
  id,
  content,
  children,
}: {
  id: string;
  content: ChartContent;
  children?: ReactNode;
}) {
  const max = Math.max(...content.data);
  return (
    <div className="card-body" data-id={id} data-name={content.name} data-type={content.componentType}>
      <svg
        viewBox="0 0 100 40"
        preserveAspectRatio="none"
        style={{ width: "100%", height: "100%" }}
      >
        {content.data.map((v, idx) => (
          <rect
            key={idx}
            x={idx * (100 / content.data.length) + 1}
            y={40 - (v / max) * 36}
            width={100 / content.data.length - 2}
            height={(v / max) * 36}
            fill="#5470c6"
          />
        ))}
      </svg>
      {children}
    </div>
  );
}
