// 组件栏条目定义：默认 layout + 默认 content，来自各组件的 .default.config
import type { LayoutItem } from "react-grid-layout";
import type { Content } from "./types";
import { statCardDefault } from "./components/StatCard/StatCard.default.config";
import { chartCardDefault } from "./components/ChartCard/ChartCard.default.config";
import { pieCardDefault } from "./components/PieCard/PieCard.default.config";
import { statGroupCardDefault } from "./components/StatGroupCard/StatGroupCard.default.config";
import { textCardDefault } from "./components/TextCard/TextCard.default.config";
import { tableCardDefault } from "./components/TableCard/TableCard.default.config";
import { aiSummaryCardDefault } from "./components/AiSummaryCard/AiSummaryCard.default.config";
import { compareBarCardDefault } from "./components/CompareBarCard/CompareBarCard.default.config";

export interface PaletteDef {
  layout: Omit<LayoutItem, "i" | "x" | "y">;
  content: Content;
}

export const paletteDefs: PaletteDef[] = [
  statCardDefault,
  statGroupCardDefault,
  chartCardDefault,
  compareBarCardDefault,
  pieCardDefault,
  textCardDefault,
  tableCardDefault,
  aiSummaryCardDefault,
];

// 按 componentCategory 分组为两级树：分类 → 组件
export const paletteTree: Array<[string, PaletteDef[]]> = [];
for (const def of paletteDefs) {
  const group = paletteTree.find(
    ([category]) => category === def.content.componentCategory,
  );
  if (group) group[1].push(def);
  else paletteTree.push([def.content.componentCategory, [def]]);
}
