import type { StatContent } from "../../types";

export function StatCard({ id, content }: { id: string; content: StatContent }) {
  return (
    <div className="card-body" data-id={id} data-name={content.name} data-type={content.componentType}>
      <div className="stat-value" style={{ color: content.color }}>
        {content.value}
      </div>
    </div>
  );
}
