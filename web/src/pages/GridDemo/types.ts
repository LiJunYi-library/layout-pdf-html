// GridDemo 共享类型
import type { LayoutItem } from "react-grid-layout";

export interface TableProps {
  columns: string[]
  rows: string[][]
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
}

export type Content =
  | (BaseContent & { componentType: 'stat'; value: string; color: string })
  | (BaseContent & { componentType: 'chart'; data: number[] })
  | (BaseContent & { componentType: 'text'; text: string })
  | (BaseContent & TableProps & { componentType: 'table' })

export type StatContent = Extract<Content, { componentType: 'stat' }>
export type ChartContent = Extract<Content, { componentType: 'chart' }>
export type TextContent = Extract<Content, { componentType: 'text' }>
export type TableContent = Extract<Content, { componentType: 'table' }>

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
