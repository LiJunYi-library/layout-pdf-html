// ECharts CDN 加载器 + option 构建（不装 npm 包，编辑态动态插 <script>，导出 HTML 在 head 引 CDN）
import type { ChartContent, PieContent } from "../../types";

export const ECHARTS_CDN =
  "https://cdn.jsdelivr.net/npm/echarts@5.6.0/dist/echarts.min.js";

// 只声明用到的最小 API 面
export interface EChartsInstance {
  setOption(option: unknown, notMerge?: boolean): void;
  resize(): void;
  dispose(): void;
}
export interface EChartsStatic {
  init(
    el: HTMLElement,
    theme?: string | null,
    opts?: { renderer?: "canvas" | "svg" },
  ): EChartsInstance;
}

declare global {
  interface Window {
    echarts?: EChartsStatic;
  }
}

let loading: Promise<EChartsStatic> | null = null;

// 编辑态加载：全局只插一次 CDN script
export function loadECharts(): Promise<EChartsStatic> {
  if (window.echarts) return Promise.resolve(window.echarts);
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = ECHARTS_CDN;
    s.onload = () =>
      window.echarts
        ? resolve(window.echarts)
        : reject(new Error("echarts 加载失败"));
    s.onerror = () => {
      loading = null;
      reject(new Error("echarts CDN 加载失败"));
    };
    document.head.appendChild(s);
  });
  return loading;
}

// value 轴上限：最大值 + 最大值/分隔段数（即多留出一格刻度），避免顶部标签溢出/顶到 legend
function valueAxisMax(values: number[], splitNumber: number): number {
  const dataMax = Math.max(0, ...values);
  return Math.ceil(dataMax + dataMax / splitNumber);
}

// 由 content 构建 echarts option（导出 HTML 时序列化进内联 script）
export function buildChartOption(content: ChartContent) {
  const horizontal = content.categoryAxis === "y";
  // 类目轴在 y 轴（横向条形图）时 inverse：第一个类目显示在最上方，从上到下排
  const categoryAxis = {
    type: "category",
    data: content.categoryData ?? [],
    ...(horizontal ? { inverse: true } : {}),
  };
  // max 要直接算成数值（option 会 JSON 序列化进导出 HTML，函数会被丢掉）
  // 有堆叠时按「堆叠组每类目的合计」取最大值，否则堆叠柱总高会超出轴上限
  const catCount = content.categoryData?.length ?? 0;
  const totals: number[] = [];
  const stackSums = new Map<string, number[]>();
  for (const s of content.series ?? []) {
    if (s.stack) {
      const sums = stackSums.get(s.stack) ?? Array(catCount).fill(0);
      s.data.forEach((v, i) => {
        sums[i] = (sums[i] ?? 0) + v;
      });
      stackSums.set(s.stack, sums);
    } else {
      totals.push(...s.data);
    }
  }
  totals.push(...[...stackSums.values()].flat());
  const splitNumber = Math.max(1, content.splitNumber ?? 5);
  const valueAxis = {
    type: "value",
    max: valueAxisMax(totals, splitNumber),
    splitNumber,
  };
  // 柱值标签默认显示；位置默认柱子中间，顶部/底部在横向时映射为右端/左端
  // 底部用 insideBottom/insideLeft：从柱子自身的底部算，而不是贴到坐标轴上
  const POSITION_MAP = {
    top: horizontal ? "right" : "top",
    middle: "inside",
    bottom: horizontal ? "insideLeft" : "insideBottom",
  } as const;
  const label = {
    show: content.showLabel ?? true,
    position: POSITION_MAP[content.labelPosition ?? "middle"],
  };
  // 单位/百分比标签：在构建时逐点算好写死（formatter 函数无法 JSON 序列化进导出 HTML）
  // 百分比 = 该值占同类目所有系列合计的比例
  const unit = content.unit ?? "";
  const showPercent = content.showPercent ?? false;
  const catTotals = Array(catCount).fill(0) as number[];
  if (showPercent) {
    for (const s of content.series ?? []) {
      s.data.forEach((v, i) => {
        catTotals[i] = (catTotals[i] ?? 0) + v;
      });
    }
  }
  const formatPoint = (v: number, i: number) => {
    const segs = [`${v}${unit}`];
    if (showPercent) {
      const total = catTotals[i] ?? 0;
      segs.push(`(${total ? ((v / total) * 100).toFixed(1) : "0"}%)`);
    }
    return segs.join(" ");
  };
  const withPointLabels = showPercent || unit !== "";
  const series = (content.series ?? []).map((s) => ({
    name: s.name,
    type: s.type ?? "bar",
    data: withPointLabels
      ? s.data.map((v, i) => ({ value: v, label: { formatter: formatPoint(v, i) } }))
      : s.data,
    label,
    // 柱子宽度：像素值或百分比字符串，默认 40%；清空走 echarts 默认均分（line 系列会忽略此项）
    ...(s.barWidth ? { barWidth: String(s.barWidth) } : { barWidth: "40%" }),
    // 单独配置的颜色；不设置则走默认调色板
    ...(s.color ? { color: s.color } : {}),
    // 堆叠组名：同名系列堆叠，不设置则不堆叠
    ...(s.stack ? { stack: s.stack } : {}),
  }));
  const hasTitle = (content.showTitle ?? true) && !!content.title;
  return {
    // 最终产物是 PDF（静态），关闭动画
    animation: false,
    title: {
      show: hasTitle,
      text: content.title ?? "",
      left: content.titlePosition ?? "left",
      top: 0,
      // 小字号报告风标题，配合 grid 顶部让位避免遮挡坐标轴刻度
      textStyle: { fontSize: 14, fontWeight: 600 },
    },
    // 收紧默认留白：containLabel 让坐标轴标签算进 grid；顶部按标题/legend 让位
    grid: {
      left: 4,
      right: 12,
      top: Math.max(8, (hasTitle ? 32 : 0) + (series.length > 1 ? 26 : 0)) + 10,
      bottom: 4,
      containLabel: true,
    },
    xAxis: horizontal ? valueAxis : categoryAxis,
    yAxis: horizontal ? categoryAxis : valueAxis,
    series,
    ...(series.length > 1 ? { legend: { show: true } } : {}),
  };
}

// 由 content 构建饼图 option（导出 HTML 时序列化进内联 script）
// 百分比/单位标签在构建时算好写死：formatter 函数无法 JSON 序列化
export function buildPieOption(content: PieContent) {
  const items = content.value ?? [];
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const showValue = content.showValue ?? true;
  const showPercent = content.showPercent ?? true;
  const unit = content.unit ?? "";
  return {
    // 最终产物是 PDF（静态），关闭动画
    animation: false,
    legend: { bottom: 0 },
    title: {
      show: (content.showTitle ?? true) && !!content.title,
      text: content.title ?? "",
      left: content.titlePosition ?? "center",
      top: 0,
      textStyle: { fontSize: 14, fontWeight: 600 },
    },
    series: [
      {
        type: "pie",
        // 外圈/内圈半径：内圈 >0 时即为环形图
        radius: [
          `${Math.min(content.innerRadius ?? 0, content.outerRadius ?? 74)}%`,
          `${content.outerRadius ?? 74}%`,
        ],
        center: ["50%", "48%"],
        // 标签在饼图内部时不画引线
        labelLine: { show: (content.labelPosition ?? "outside") === "outside" },
        data: items.map((item) => {
          const segs: string[] = [];
          if (showValue) segs.push(`${item.value}${unit}`);
          if (showPercent) {
            const pct = total ? ((item.value / total) * 100).toFixed(1) : "0";
            segs.push(`(${pct}%)`);
          }
          return {
            name: item.name,
            value: item.value,
            ...(item.color ? { itemStyle: { color: item.color } } : {}),
            label: {
              show: true,
              position: content.labelPosition ?? "outside",
              formatter: segs.length
                ? `${item.name}: ${segs.join(" ")}`
                : item.name,
            },
          };
        }),
      },
    ],
  };
}
