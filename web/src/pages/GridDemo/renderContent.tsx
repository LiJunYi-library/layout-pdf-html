// 按 componentType 分发渲染：编辑态用 .edit 组件，导出态用静态组件
// content.script / content.style 通过卡片 children 注入到 card-body 内部：
// 编辑态由 EditExtras 处理；导出态两者都原样内联（dangerouslySetInnerHTML 避免 React 转义代码里的 < >）
import type { Content, TableContent } from "./types";
import { StatCard } from "./components/StatCard/StatCard";
import { StatGroupCard } from "./components/StatGroupCard/StatGroupCard";
import { ChartCard } from "./components/ChartCard/ChartCard";
import { ChartCardEdit } from "./components/ChartCard/ChartCard.edit";
import { PieCard } from "./components/PieCard/PieCard";
import { PieCardEdit } from "./components/PieCard/PieCard.edit";
import { TextCard } from "./components/TextCard/TextCard";
import { TableCard } from "./components/TableCard/TableCard";
import { TableCardEdit } from "./components/TableCard/TableCard.edit";
import { AiSummaryCard } from "./components/AiSummaryCard/AiSummaryCard";
import { EditExtras } from "./components/EditExtras/EditExtras";

// 导出态注入：script 包在块级作用域里，root 用 document.currentScript 向上找 [data-id]，
// data 取 <head> 注入的 window.__DATA（data.local.json 内容）
function staticExtras(content: Content) {
  return (
    <>
      {content.style && (
        <style dangerouslySetInnerHTML={{ __html: content.style }} />
      )}
      {content.script && (
        <script
          dangerouslySetInnerHTML={{
            __html: `{
  const root = document.currentScript.closest('[data-id]');
  const data = window.__DATA;
  ${content.script}
}`,
          }}
        />
      )}
    </>
  );
}

// 编辑器渲染：表格用组件 A（可拖拽列宽）；data 为 data.json 内容，传给 script
export function renderEditorContent(
  id: string,
  content: Content,
  onTableChange: (next: TableContent) => void,
  data: unknown,
) {
  const extras = <EditExtras content={content} data={data} />;
  switch (content.componentType) {
    case "stat":
      return (
        <StatCard id={id} content={content}>
          {extras}
        </StatCard>
      );
    case "statGroup":
      return (
        <StatGroupCard id={id} content={content}>
          {extras}
        </StatGroupCard>
      );
    case "chart":
      return (
        <ChartCardEdit id={id} content={content}>
          {extras}
        </ChartCardEdit>
      );
    case "pie":
      return (
        <PieCardEdit id={id} content={content}>
          {extras}
        </PieCardEdit>
      );
    case "text":
      return (
        <TextCard id={id} content={content}>
          {extras}
        </TextCard>
      );
    case "table":
      return (
        <TableCardEdit
          id={id}
          content={content}
          onColWidthsChange={(colWidths) =>
            onTableChange({ ...content, colWidths })
          }
        >
          {extras}
        </TableCardEdit>
      );
    case "aiSummary":
      return (
        <AiSummaryCard id={id} content={content}>
          {extras}
        </AiSummaryCard>
      );
  }
}

// 导出渲染：表格用组件 B（静态，只读 colWidths）
export function renderStaticContent(id: string, content: Content) {
  const extras = staticExtras(content);
  switch (content.componentType) {
    case "stat":
      return (
        <StatCard id={id} content={content}>
          {extras}
        </StatCard>
      );
    case "statGroup":
      return (
        <StatGroupCard id={id} content={content}>
          {extras}
        </StatGroupCard>
      );
    case "chart":
      return (
        <ChartCard id={id} content={content}>
          {extras}
        </ChartCard>
      );
    case "pie":
      return (
        <PieCard id={id} content={content}>
          {extras}
        </PieCard>
      );
    case "text":
      return (
        <TextCard id={id} content={content}>
          {extras}
        </TextCard>
      );
    case "table":
      return (
        <TableCard id={id} content={content}>
          {extras}
        </TableCard>
      );
    case "aiSummary":
      return (
        <AiSummaryCard id={id} content={content}>
          {extras}
        </AiSummaryCard>
      );
  }
}
