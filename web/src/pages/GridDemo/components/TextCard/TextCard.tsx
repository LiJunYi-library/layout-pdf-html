import type { ReactNode } from "react";
import type { TextContent } from "../../types";

export function TextCard({
  id,
  content,
  children,
}: {
  id: string;
  content: TextContent;
  children?: ReactNode;
}) {
  return (
    <div className="card-body" data-id={id} data-name={content.name} data-type={content.componentType}>
      <p className="card-text">{content.text}</p>
      {children}
    </div>
  );
}
