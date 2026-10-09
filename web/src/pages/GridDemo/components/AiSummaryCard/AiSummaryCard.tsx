import type { ReactNode } from "react";
import type { AiSummaryContent } from "../../types";

export function AiSummaryCard({
  id,
  content,
  children,
}: {
  id: string;
  content: AiSummaryContent;
  children?: ReactNode;
}) {
  return (
    <div className="card-body" data-id={id} data-name={content.name} data-type={content.componentType}>
      <p className="card-text card-ai-summary">{content.value}</p>
      {children}
    </div>
  );
}
