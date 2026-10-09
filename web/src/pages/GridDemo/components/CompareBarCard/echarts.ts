// 对比条形图 option 构建（导出 HTML 时序列化进内联 script，全部预算成字面量，不含函数）
import type { CompareBarContent, CompareBarItem } from "../../types";
import { valueAxisMax } from "../ChartCard/echarts";

export function buildCompareOption(content: CompareBarContent) {
  const items: CompareBarItem[] = content.value ?? [];
  const unit = content.unit ?? "%";
  const nameA = content.name_a ?? "本班关注率";
  const nameB = content.name_b ?? "同年级关注率";
  const showSub = content.showSub ?? true;
  const showDiff = content.showDiff ?? true;
  const colorA = content.color_a ?? "#2f6bff";
  const colorB = content.color_b ?? "#a3c0f5";
  const colorUp = content.colorUp ?? "#f5222d";
  const colorDown = content.colorDown ?? "#8c8c8c";
  const barWidth = content.barWidth ? String(content.barWidth) : "14";

  // 类目副行（重点关注率）：拼富文本字面量，样式由 yAxis.axisLabel.rich 提供
  const hasSub =
    showSub &&
    items.some((it) => it.value_a_sub != null || it.value_b_sub != null);
  const categories = items.map((it) =>
    hasSub
      ? `{a|${it.name}}\n{b|重点关注率：本班${it.value_a_sub ?? "-"}${unit}｜同年级${it.value_b_sub ?? "-"}${unit}}`
      : it.name,
  );

  const max = valueAxisMax(
    items.flatMap((it) => [it.value_a, it.value_b]),
    5,
  );

  // 差异列：透明系列 stack 成 0→max 的隐形柱（不占类目槽位），逐点 label 写死差异文本和正负配色
  const diffOf = (it: CompareBarItem) => it.value_a - it.value_b;
  const diffText = (it: CompareBarItem) =>
    it.diff ?? `${diffOf(it) >= 0 ? "+" : ""}${diffOf(it).toFixed(1)}pct`;

  const hasTitle = (content.showTitle ?? true) && !!content.title;
  return {
    // 最终产物是 PDF（静态），关闭动画
    animation: false,
    title: [
      {
        show: hasTitle,
        text: content.title ?? "",
        left: content.titlePosition ?? "left",
        top: 0,
        textStyle: { fontSize: 14, fontWeight: 600 },
      },
      // 差异列标题定位在右上角（grid 右侧留白区）
      ...(showDiff
        ? [
            {
              text: content.diffTitle ?? "与同年级差异\n（百分点）",
              right: 8,
              top: 0,
              textStyle: { fontSize: 12, fontWeight: 600, color: "#666" },
            },
          ]
        : []),
    ],
    legend: { top: hasTitle ? 24 : 0, left: 0, data: [nameA, nameB] },
    grid: {
      left: 4,
      // 右侧留白给差异列标签（透明柱 label 会画在 grid 外）
      right: showDiff ? 80 : 12,
      top: (hasTitle ? 26 : 0) + 26 + 8,
      bottom: 4,
      containLabel: true,
    },
    xAxis: {
      type: "value",
      max,
      axisLabel: { formatter: `{value}${unit}` },
    },
    yAxis: {
      type: "category",
      data: categories,
      // 第一个类目显示在最上方，从上到下排
      inverse: true,
      axisLabel: {
        align: "right",
        margin: 12,
        ...(hasSub
          ? {
              rich: {
                a: {
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#333",
                  lineHeight: 18,
                  align: "right",
                },
                b: {
                  fontSize: 11,
                  color: "#999",
                  lineHeight: 14,
                  align: "right",
                },
              },
            }
          : {}),
      },
    },
    series: [
      {
        name: nameA,
        type: "bar",
        data: items.map((it) => it.value_a),
        color: colorA,
        barWidth,
        label: { show: true, position: "right", formatter: `{c}${unit}` },
      },
      {
        name: nameB,
        type: "bar",
        data: items.map((it) => it.value_b),
        color: colorB,
        barWidth,
        label: { show: true, position: "right", formatter: `{c}${unit}` },
      },
      ...(showDiff
        ? [
            {
              name: "__diff__",
              type: "bar",
              stack: "__diff__",
              silent: true,
              barWidth,
              data: items.map((it) => ({
                value: max,
                itemStyle: { color: "transparent" },
                label: {
                  show: true,
                  position: "right",
                  formatter: diffText(it),
                  color: diffOf(it) >= 0 ? colorUp : colorDown,
                  fontWeight: 600,
                },
              })),
            },
          ]
        : []),
    ],
  };
}
