// 编辑态图表：动态加载 echarts CDN，SVG 渲染；卡片尺寸变化（RGL 拖拽）时 resize
import { useEffect, useRef, type ReactNode } from "react";
import type { ChartContent } from "../../types";
import {
  buildChartOption,
  loadECharts,
  type EChartsInstance,
} from "./echarts";

export function ChartCardEdit({
  id,
  content,
  children,
}: {
  id: string;
  content: ChartContent;
  children?: ReactNode;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<EChartsInstance | null>(null);

  // 挂载：加载 CDN、初始化、监听尺寸
  useEffect(() => {
    let disposed = false;
    let ro: ResizeObserver | null = null;
    loadECharts()
      .then((echarts) => {
        if (disposed || !hostRef.current) return;
        const chart = echarts.init(hostRef.current, null, { renderer: "svg" });
        chart.setOption(buildChartOption(content));
        chartRef.current = chart;
        ro = new ResizeObserver(() => chart.resize());
        ro.observe(hostRef.current);
      })
      .catch((err) => console.error("[chart] echarts 加载失败", err));
    return () => {
      disposed = true;
      ro?.disconnect();
      chartRef.current?.dispose();
      chartRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 配置变更：只更新 option
  useEffect(() => {
    chartRef.current?.setOption(buildChartOption(content), true);
  }, [content]);

  return (
    <div className="card-body" data-id={id} data-name={content.name} data-type={content.componentType}>
      <div className="chart-host" ref={hostRef} />
      {children}
    </div>
  );
}
