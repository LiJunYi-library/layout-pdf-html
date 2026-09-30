// 按 componentType 分发渲染：编辑态用 .edit 组件，导出态用静态组件
import type { Content, TableContent } from "./types";
import { StatCard } from "./components/StatCard/StatCard";
import { ChartCard } from "./components/ChartCard/ChartCard";
import { TextCard } from "./components/TextCard/TextCard";
import { TableCard } from "./components/TableCard/TableCard";
import { TableCardEdit } from "./components/TableCard/TableCard.edit";

// 编辑器渲染：表格用组件 A（可拖拽列宽）
export function renderEditorContent(
  id: string,
  content: Content,
  onTableChange: (next: TableContent) => void,
) {
  switch (content.componentType) {
    case "stat":
      return <StatCard id={id} content={content} />;
    case "chart":
      return <ChartCard id={id} content={content} />;
    case "text":
      return <TextCard id={id} content={content} />;
    case "table":
      return (
        <TableCardEdit
          id={id}
          content={content}
          onColWidthsChange={(colWidths) =>
            onTableChange({ ...content, colWidths })
          }
        />
      );
  }
}

// 导出渲染：表格用组件 B（静态，只读 colWidths）
export function renderStaticContent(id: string, content: Content) {
  switch (content.componentType) {
    case "stat":
      return <StatCard id={id} content={content} />;
    case "chart":
      return <ChartCard id={id} content={content} />;
    case "text":
      return <TextCard id={id} content={content} />;
    case "table":
      return <TableCard id={id} content={content} />;
  }
}
