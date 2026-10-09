// GridDemo 共享类型
import type { LayoutItem } from "react-grid-layout";

export interface TableProps {
  columns: string[]
  /** 行数据（业务数据，统一 value_ 前缀命名） */
  value_rows: string[][]
  /** 列宽百分比，与 columns 等长，合计 100 */
  colWidths: number[]
}

interface BaseContent {
  /** 组件类型，开发用判别字段（决定渲染哪个组件、哪个配置面板） */
  componentType: string
  /** 组件分类，左侧组件栏按此字段分组（两级树的父节点） */
  componentCategory: string
  /** 组件名称，给用户看的固定标识（不可编辑） */
  componentName: string
  /** 自定义名，用户在配置面板可改，不渲染到页面上 */
  name: string
  /** LLM 生成的脚本代码：编辑态 new Function('root','data') 执行，导出态内联 <script>；
   *  root 均为本组件的 card-body（[data-id] 节点），data 编辑态取 data.json、导出态取 window.__DATA */
  script?: string
  /** LLM 生成的样式代码：编辑态/导出态都作为 <style> 内联在 card-body 内 */
  style?: string
  /** 给 LLM 的提示词：描述这个组件要展示什么、怎么生成 script/style */
  prompt?: string
  /** 配置面板里 prompt 输入框的高度（px），用户拖出来的，随 pages.json 持久化 */
  promptHeight?: number
}

/** 图表系列：type 默认 'bar'；color 不设置时走 echarts 默认调色板；stack 为堆叠组名，同名系列堆叠在一起 */
export interface ChartSeriesItem {
  name: string
  type?: string
  color?: string
  stack?: string
  /** 柱子宽度：像素值（'30'）或百分比（'40%'），默认 '40%'；空字符串走 echarts 默认均分 */
  barWidth?: string
  data: number[]
}

/** 饼图数据项；color 不设置时走 echarts 默认调色板 */
export interface PieDataItem {
  name: string
  value: number
  color?: string
}

/** 统计卡片组单项；layout 为 label 与 value 的相对位置，separator 为 label 与 value 之间的连接符 */
export interface StatGroupItem {
  label: string
  value: string
  /** label 与 value 的相对位置：'tb' 上下（默认）/ 'lr' 左右 / 'bt' 下上 / 'rl' 右左 */
  layout?: 'tb' | 'lr' | 'bt' | 'rl'
  /** 分隔符号，显示在 label 与 value 之间；未配置时不展示 */
  separator?: string
}

export type Content =
  | (BaseContent & {
      componentType: 'stat'
      /** 标题，显示在数值上方 */
      title: string
      value: string
      color: string
      /** 对齐方式，默认左 */
      align?: 'left' | 'center' | 'right'
    })
  | (BaseContent & {
      componentType: 'chart'
      /** 类目轴数据 */
      categoryData: string[]
      /** 系列列表 */
      series: ChartSeriesItem[]
      /** 类目轴方向：'x' 竖向柱状图；'y' 横向条形图 */
      categoryAxis: 'x' | 'y'
      /** 是否显示柱值标签，默认开 */
      showLabel?: boolean
      /** 柱值标签位置：'middle' 柱子中间（默认）；'top' 顶部（横向为右端）；'bottom' 底部（横向为左端） */
      labelPosition?: 'top' | 'middle' | 'bottom'
      /** value 轴分隔段数（也决定顶部余量 = 最大值/段数），默认 5 */
      splitNumber?: number
      /** 数值单位（如"人"），显示在柱值标签数值后 */
      unit?: string
      /** 柱值标签是否显示百分比（占同类目所有系列合计的比例），默认 false */
      showPercent?: boolean
      /** 标题文本 */
      title?: string
      /** 是否显示标题，默认 true（无标题文本时不显示） */
      showTitle?: boolean
      /** 标题位置，默认左 */
      titlePosition?: 'left' | 'center' | 'right'
    })
  | (BaseContent & {
      componentType: 'pie'
      /** 饼图数据：名称 + 数值 */
      value: PieDataItem[]
      /** 数值单位（如"人"），显示在标签数值后 */
      unit?: string
      /** 标签是否显示数值，默认 true */
      showValue?: boolean
      /** 标签是否显示百分比，默认 true */
      showPercent?: boolean
      /** 标签位置：'outside' 饼图外引线（默认）；'inside' 饼图内部 */
      labelPosition?: 'outside' | 'inside'
      /** 内圈半径（百分比 0~100，相对容器短边一半），>0 时成为环形图，默认 0 */
      innerRadius?: number
      /** 外圈半径（百分比 0~100，相对容器短边一半），默认 74 */
      outerRadius?: number
      /** 标题文本 */
      title?: string
      /** 是否显示标题，默认 true（无标题文本时不显示） */
      showTitle?: boolean
      /** 标题位置，默认居中 */
      titlePosition?: 'left' | 'center' | 'right'
    })
  | (BaseContent & {
      componentType: 'text'
      text: string
      /** 左右对齐，默认无（继承左对齐） */
      align?: 'left' | 'center' | 'right'
      /** 上下对齐，默认无（顶部） */
      valign?: 'top' | 'middle' | 'bottom'
      /** 字号（px），默认沿用卡片样式 13 */
      fontSize?: number
      /** 字重（100~900），默认沿用卡片样式 400 */
      fontWeight?: number
    })
  | (BaseContent & {
      componentType: 'statGroup'
      /** 统计项列表，从上到下排列；布局/分隔符号为单项配置 */
      value: StatGroupItem[]
      /** 整体对齐方式，默认居中 */
      align?: 'left' | 'center' | 'right'
    })
  | (BaseContent & TableProps & {
      componentType: 'table'
      /** 标题文本，显示在表格上方 */
      title?: string
      /** 是否显示标题，默认 true（无标题文本时不显示） */
      showTitle?: boolean
      /** 标题位置，默认居中 */
      titlePosition?: 'left' | 'center' | 'right'
    })
  | (BaseContent & {
      componentType: 'aiSummary'
      /** 总结文本（AI 生成结果，可编辑） */
      value: string
      /** 参与总结的已布局组件 id 列表（配置面板勾选） */
      refs?: string[]
    })

export type StatContent = Extract<Content, { componentType: 'stat' }>
export type ChartContent = Extract<Content, { componentType: 'chart' }>
export type PieContent = Extract<Content, { componentType: 'pie' }>
export type StatGroupContent = Extract<Content, { componentType: 'statGroup' }>
export type TextContent = Extract<Content, { componentType: 'text' }>
export type TableContent = Extract<Content, { componentType: 'table' }>
export type AiSummaryContent = Extract<Content, { componentType: 'aiSummary' }>

/** 页面级配置 */
export interface PageConfig {
  /** 页面背景色（CSS 颜色值） */
  backgroundColor?: string
  /** 页面背景图：本地文件夹内的相对路径，如 assets/xxx.png */
  backgroundImage?: string
}

/** 单页数据：一页一套 layout + contents + 页面配置 */
export interface PageData {
  id: string
  layout: LayoutItem[]
  contents: Record<string, Content>
  config?: PageConfig
}
