import type { TextContent } from "../../types";

export function TextCard({ id, content }: { id: string; content: TextContent }) {
  return (
    <div className="card-body" data-id={id} data-name={content.name} data-type={content.componentType}>
      <p className="card-text">{content.text}</p>
    </div>
  );
}
