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
  const justify =
    content.valign === 'middle' ? 'center' : content.valign === 'bottom' ? 'flex-end' : 'flex-start';
  return (
    <div
      className="card-body"
      data-id={id}
      data-name={content.name}
      data-type={content.componentType}
      style={{
        ...(content.align ? { textAlign: content.align } : null),
        ...(content.valign ? { display: 'flex', flexDirection: 'column', justifyContent: justify } : null),
      }}
    >
      <p
        className="card-text"
        style={{
          ...(content.fontSize ? { fontSize: content.fontSize } : null),
          ...(content.fontWeight ? { fontWeight: content.fontWeight } : null),
        }}
      >
        {content.text}
      </p>
      {children}
    </div>
  );
}
