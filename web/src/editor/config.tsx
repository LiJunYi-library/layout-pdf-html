import type { Config, Slot } from '@puckeditor/core'
import * as echarts from 'echarts/core'
import { BarChart, PieChart } from 'echarts/charts'
import { GridComponent } from 'echarts/components'
import { SVGRenderer } from 'echarts/renderers'
import { Block } from './Block'
import { BindScriptField, BindStyleField } from './bind'
import { MatrixCellsField } from './MatrixCellsField'
import { isTemplateMode, resolveBind } from './bindRuntime'

echarts.use([PieChart, BarChart, GridComponent, SVGRenderer])

export const PALETTE = ['#2563eb', '#93c5fd', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444']

interface Slice {
  name: string
  value: number
}

function parseJson<T>(text: string, fallback: T): T {
  try {
    return JSON.parse(text) as T
  } catch {
    return fallback
  }
}

function renderChartSvg(option: echarts.EChartsCoreOption, width: number, height: number): string {
  const chart = echarts.init(null, null, { renderer: 'svg', ssr: true, width, height })
  chart.setOption(option)
  const svg = chart.renderToSVGString()
  chart.dispose()
  return svg
}

// 环形图规范（specs 表 id=1）：无 tooltip 无 legend，label=名字+换行+值/总数(百分比)，关动画
function donutOption(data: Slice[], centerText: string): echarts.EChartsCoreOption {
  const total = data.reduce((s, x) => s + (Number(x.value) || 0), 0)
  return {
    animation: false,
    color: PALETTE,
    series: [
      {
        type: 'pie',
        radius: ['42%', '68%'],
        center: ['50%', '50%'],
        label: {
          show: true,
          fontSize: 11,
          color: '#2563eb',
          formatter: (p: { name: string; value: number; percent: number }) =>
            `${p.name}\n${p.value}/${total}(${p.percent}%)`,
        },
        itemStyle: { borderColor: '#ffffff', borderWidth: 2 },
        data,
      },
      {
        type: 'pie',
        radius: ['0%', '30%'],
        center: ['50%', '50%'],
        silent: true,
        label: {
          show: true,
          position: 'center',
          formatter: centerText,
          fontSize: 14,
          fontWeight: 'bold',
          color: '#2563eb',
        },
        data: [{ value: 1, itemStyle: { color: 'transparent' } }],
      },
    ],
  }
}

function barOption(data: Slice[]): echarts.EChartsCoreOption {
  return {
    animation: false,
    color: PALETTE,
    grid: { left: 44, right: 16, top: 24, bottom: 28 },
    xAxis: { type: 'category', data: data.map(d => d.name), axisLabel: { fontSize: 11 } },
    yAxis: { type: 'value' },
    series: [{
      type: 'bar',
      barMaxWidth: 36,
      label: { show: true, position: 'top', fontSize: 11, color: '#2563eb' },
      data: data.map(d => d.value),
    }],
  }
}

// ---------- 全组件通用字段：数据标注（第 1、2 位）+ 间距（末尾） ----------

const annotationFields = {
  name: { type: 'text' as const, label: '名称（仅大纲中显示，便于选中）' },
  dataMap: { type: 'textarea' as const, label: '计算说明（可选，补充给 AI 参考）' },
  bindScript: {
    type: 'custom' as const,
    label: '数据脚本（agent-bind）',
    render: ({ value, onChange }: { value?: string; onChange: (v: string) => void }) => (
      <BindScriptField value={value} onChange={onChange} />
    ),
  },
  styleMap: { type: 'textarea' as const, label: '样式说明（可选，补充给 AI 参考）' },
  bindStyle: {
    type: 'custom' as const,
    label: '组件样式（agent-bind）',
    render: ({ value, onChange }: { value?: string; onChange: (v: string) => void }) => (
      <BindStyleField value={value} onChange={onChange} />
    ),
  },
}

// 数组项折叠摘要：跟随项的 label，而不是 Puck 默认的 "Item #N"
const itemSummaryByLabel = (item: { label?: string }) => item?.label || '（未命名）'

// 浏览器/系统自带字体族（不引入外部字体文件，保证打印与导出可用）
export const FONT_FAMILIES = [  { label: '黑体系（默认）', value: "'PingFang SC','Microsoft YaHei',sans-serif" },
  { label: '宋体系（衬线）', value: "'Songti SC','SimSun',serif" },
  { label: '楷体', value: "'Kaiti SC','KaiTi',serif" },
  { label: '等宽', value: "'Courier New',monospace" },
]
const DEFAULT_FONT = FONT_FAMILIES[0].value

interface AnnotationProps {
  name?: string
  dataSource?: string
  dataMap: string
  styleMap?: string
  bindScript?: string
  bindStyle?: string
}

type BaseProps = AnnotationProps

export interface TextProps {
  content: string
  fontSize: number
  fontWeight: string
  fontStyle: string
  fontFamily: string
  lineHeight: string
  align: string
  color: string
}

export interface EditorComponents {
  DataScript: BaseProps
  Page: { name: string; content: Slot } & BaseProps
  Text: TextProps & BaseProps
  // 标题 = 文本组件的预设变体：字段与渲染完全相同，仅默认值不同（大字号加粗居中）
  Heading: TextProps & BaseProps
  StatCard: { title: string; value: string; note: string } & BaseProps
  InfoLine: { icon: string; label: string; value: string } & BaseProps
  StatGroup: { items: { icon: string; label: string; value: string; note: string }[] } & BaseProps
  DonutChart: { title: string; centerText: string; height: number; dataJson: string } & BaseProps
  BarChart: { title: string; height: number; dataJson: string } & BaseProps
  // 列表格：columns 为人控列配置（label 表头 + value 列说明），rowsJson 为 AI 推导出的行数据（不在字段面板暴露）
  ColumnTable: { columns: { label: string; value: string }[]; rowsJson?: string } & BaseProps
  RowTable: { rows: { label: string; value: string }[] } & BaseProps
  // 动态列表格：列只配 label；行配 label + cells（跟随列动态生成的每列取数说明），rowsJson 为 AI 按 行label×列label 展开的单元格数据
  MatrixTable: { columns: { label: string }[]; rows: { label: string; cells?: Record<string, string> }[]; rowsJson?: string } & BaseProps
  Columns2: { ratio: string; gap: number; left: Slot; right: Slot } & BaseProps
  Columns3: { ratio: string; gap: number; colA: Slot; colB: Slot; colC: Slot } & BaseProps
  Spacer: { height: number } & BaseProps
}

// 比例字符串 "1:2" → flex-grow 数组，非法值回退等分
function parseRatio(ratio: string, count: number): number[] {
  const parts = ratio.split(':').map(s => Number(s.trim()))
  if (parts.length === count && parts.every(n => Number.isFinite(n) && n > 0))
    return parts
  return Array.from({ length: count }, () => 1)
}

// 文本类组件的共享字段与渲染（正文/标题只是默认值不同）
const textFields = {
  content: { type: 'textarea' as const, label: '内容' },
  fontSize: { type: 'number' as const, label: '字体大小（px）' },
  fontWeight: {
    type: 'select' as const,
    label: '字重',
    options: [
      { label: '常规', value: 'normal' },
      { label: '加粗', value: 'bold' },
    ],
  },
  fontStyle: {
    type: 'select' as const,
    label: '字形',
    options: [
      { label: '正常', value: 'normal' },
      { label: '斜体', value: 'italic' },
    ],
  },
  fontFamily: { type: 'select' as const, label: '字体', options: FONT_FAMILIES },
  lineHeight: { type: 'text' as const, label: '行高（normal / 倍数 / px）' },
  align: {
    type: 'select' as const,
    label: '对齐',
    options: [
      { label: '左对齐', value: 'left' },
      { label: '居中', value: 'center' },
      { label: '右对齐', value: 'right' },
    ],
  },
  color: { type: 'text' as const, label: '颜色' },
}

function renderText(props: TextProps & BaseProps) {
  const { content, fontSize, fontWeight, fontStyle, fontFamily, lineHeight, align, color, dataMap } = props
  return (
    <Block bid={(props as { id?: string }).id} component="text" map={dataMap} styleMap={props.styleMap} script={props.bindScript} css={props.bindStyle}>
      <p
        className="tpl-text"
        style={{
          fontSize: `${fontSize || 14}px`,
          fontWeight: fontWeight === 'bold' ? 'bold' : 'normal',
          fontStyle: fontStyle === 'italic' ? 'italic' : 'normal',
          fontFamily: fontFamily || DEFAULT_FONT,
          lineHeight: lineHeight || 'normal',
          textAlign: (align === 'center' || align === 'right' ? align : 'left') as 'left' | 'center' | 'right',
          color: color || '#374151',
        }}
      >
        {content}
      </p>
    </Block>
  )
}

export const editorConfig: Config<EditorComponents> = {
  root: {
    render: ({ children }) => <div className="page-canvas">{children}</div>,
  },
  categories: {
    text: { title: '文本', components: ['Heading', 'Text'] },
    data: { title: '数据', components: ['DataScript', 'StatCard', 'StatGroup', 'InfoLine'] },
    tables: { title: '表格', components: ['ColumnTable', 'RowTable', 'MatrixTable'] },
    charts: { title: '图表', components: ['DonutChart', 'BarChart'] },
    layout: { title: '布局', components: ['Page', 'Columns2', 'Columns3', 'Spacer'] },
  },
  components: {
    // 数据脚本：每个模板的固定第一个组件，携带 window.__DATA__ 注入脚本——
    // 编辑器/导出=静态 JSON（fake-data），存为模板=Jinja {{ data | tojson }}；
    // 脚本经 innerHTML 嵌入：编辑器内惰性（预览取值走 resolveBind），导出/渲染时作为文档源执行
    DataScript: {
      label: '数据脚本',
      fields: { ...annotationFields },
      defaultProps: {
        dataSource: 'fake-data.json 全文',
        dataMap: '渲染时注入 window.__DATA__ = 数据全文（模板态为 Jinja 表达式）',
      },
      render: ({ dataMap, ...rest }) => {
        const code = isTemplateMode()
          ? 'window.__DATA__ = {{ data | tojson }}'
          : `window.__DATA__ = ${
            typeof window === 'undefined'
              ? 'null'
              : JSON.stringify(window.__DATA__ ?? null).replace(/<\//g, '<\\/')
          }`
        return (
          <Block bid={(rest as { id?: string }).id} component="data-script" map={dataMap} styleMap={rest.styleMap}>
            <div className="tpl-data-script-tag">
              📦 数据脚本：window.__DATA__ = fake-data 全文（导出/渲染时生效）
            </div>
            <span
              className="tpl-bind"
              style={{ display: 'none' }}
              // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{ __html: `<script>${code}</script>` }}
            />
          </Block>
        )
      },
    },
    Page: {
      label: '页面',
      fields: {
        ...annotationFields,
        name: { type: 'text', label: '页面名称（仅编辑时显示，不打印）' },
        content: { type: 'slot', label: '页内容' },
      },
      defaultProps: {
        name: '第 1 页',
        content: [],
        dataSource: '无（页面容器）',
        dataMap: '一个 A4 页（210mm×297mm），打印时独占一页',
      },
      render: ({ name, content: Content, dataMap, ...rest }) => (
        <Block bid={(rest as { id?: string }).id} component="page" map={dataMap} styleMap={rest.styleMap} script={rest.bindScript} css={rest.bindStyle}>
          <div className="tpl-page">
            {name && <div className="tpl-page-tag">{name}</div>}
            <Content />
          </div>
        </Block>
      ),
    },
    Text: {
      label: '正文',
      fields: { ...annotationFields, ...textFields },
      defaultProps: {
        content: '本报告基于团体测评数据生成，仅供学校参考。',
        fontSize: 14,
        fontWeight: 'normal',
        fontStyle: 'normal',
        fontFamily: DEFAULT_FONT,
        lineHeight: 'normal',
        align: 'left',
        color: '#374151',
        dataSource: '无（固定文案）',
        dataMap: '直接展示，不加工',
      },
      render: renderText,
    },
    Heading: {
      label: '标题',
      fields: { ...annotationFields, ...textFields },
      defaultProps: {
        content: '标题',
        fontSize: 64,
        fontWeight: 'bold',
        fontStyle: 'normal',
        fontFamily: '\'Songti SC\',\'SimSun\',serif',
        lineHeight: 'normal',
        align: 'center',
        color: '#1e3a5f',
        dataSource: '组织名称',
        dataMap: "拼接：组织名称 + '团体心理报告'",
      },
      render: renderText,
    },
    StatCard: {
      label: '统计卡片',
      fields: {
        ...annotationFields,
        title: { type: 'text', label: '标题' },
        value: { type: 'textarea', label: '数值（占位显示，写给 AI 的说明）' },
        note: { type: 'text', label: '注释' },
      },
      defaultProps: {
        title: '参与人数',
        value: '参与测评的人员总数',
        note: '完成率 70.0%',
        dataSource: 'data（人员记录数组）',
        dataMap: '数值=data 记录条数；完成率=已完成数/总数，保留 1 位小数',
      },
      render: ({ title, value, note, dataMap, ...rest }) => (
        <Block bid={(rest as { id?: string }).id} component="stat-card" map={dataMap} styleMap={rest.styleMap} script={rest.bindScript} css={rest.bindStyle}>
          <div className="tpl-stat-card">
            <div className="tpl-stat-title">{title}</div>
            <div className="tpl-stat-value">{value}</div>
            <div className="tpl-stat-note">{note}</div>
          </div>
        </Block>
      ),
    },
    InfoLine: {
      label: '标签值行',
      fields: {
        ...annotationFields,
        icon: { type: 'text', label: '图标（emoji）' },
        label: { type: 'text', label: '标签' },
        value: { type: 'textarea', label: '值（占位显示，写给 AI 的说明）' },
      },
      defaultProps: {
        icon: '👤',
        label: '报告对象：',
        value: "组织名称 + '录入测评人员'",
        dataSource: '组织名称',
        dataMap: "值=组织名称+'录入测评人员'，与标签直接拼接展示",
      },
      render: ({ icon, label, value, dataMap, ...rest }) => (
        <Block bid={(rest as { id?: string }).id} component="info-line" map={dataMap} styleMap={rest.styleMap} script={rest.bindScript} css={rest.bindStyle}>
          <div className="tpl-info-line">
            {icon && <span className="tpl-info-icon">{icon}</span>}
            <span className="tpl-info-label">{label}</span>
            <span className="tpl-info-value">{value}</span>
          </div>
        </Block>
      ),
    },
    StatGroup: {
      label: '统计卡片组',
      fields: {
        ...annotationFields,
        items: {
          type: 'array',
          label: '卡片',
          getItemSummary: itemSummaryByLabel,
          arrayFields: {
            icon: { type: 'text', label: '图标（emoji）' },
            label: { type: 'text', label: '标签' },
            value: { type: 'textarea', label: '数值（占位显示，写给 AI 的说明）' },
            note: { type: 'text', label: '注释' },
          },
          defaultItemProps: { icon: '👥', label: '录入人数', value: 'data 记录总条数', note: '' },
        },
      },
      defaultProps: {
        items: [
          { icon: '👥', label: '录入人数', value: 'data 记录总条数', note: '' },
          { icon: '✅', label: '完成人数', value: "'是否完成'=true 的人数", note: '' },
          { icon: '📝', label: '未完成人数', value: "'是否完成'≠true 的人数", note: '' },
          { icon: '📈', label: '完成率', value: '完成人数/录入人数，保留 1 位小数加 %', note: '' },
          { icon: '❌', label: '未完成率', value: '未完成人数/录入人数，保留 1 位小数加 %', note: '' },
        ],
        dataSource: 'data（人员记录数组）',
        dataMap: '录入=data 记录条数；完成/未完成按\'是否完成\'计数；比率=对应人数/录入数，保留 1 位小数',
      },
      render: ({ items, dataMap, ...rest }) => (
        <Block bid={(rest as { id?: string }).id} component="stat-group" map={dataMap} styleMap={rest.styleMap} script={rest.bindScript} css={rest.bindStyle}>
          <div className="tpl-stat-row">
            {(items ?? []).map((item, i) => (
              <div className="tpl-stat-card" key={i}>
                {item.icon && <div className="tpl-stat-icon">{item.icon}</div>}
                <div className="tpl-stat-title">{item.label}</div>
                <div className="tpl-stat-value">{item.value}</div>
                {item.note && <div className="tpl-stat-note">{item.note}</div>}
              </div>
            ))}
          </div>
        </Block>
      ),
    },
    DonutChart: {
      label: '环形图',
      fields: {
        ...annotationFields,
        title: { type: 'text', label: '标题' },
        centerText: { type: 'text', label: '中心文字' },
        height: { type: 'number', label: '图表高度（px）' },
        dataJson: { type: 'textarea', label: '数据（JSON: [{"name":"已完成","value":35}]）' },
      },
      defaultProps: {
        title: '整体完成情况',
        centerText: '完成率',
        height: 260,
        dataJson: '[{"name":"已完成","value":35},{"name":"未完成","value":15}]',
        dataSource: 'data（人员记录数组）',
        dataMap: "按'是否完成'分组计数：已完成/未完成；完成率=已完成/总数，保留 1 位小数",
      },
      render: ({ title, centerText, height, dataJson, dataMap, ...rest }) => {
        const data = parseJson<Slice[]>(dataJson, [])
        return (
          <Block bid={(rest as { id?: string }).id} component="donut-chart" map={dataMap} styleMap={rest.styleMap} script={rest.bindScript} css={rest.bindStyle}>
            <div className="tpl-card">
              <div className="tpl-card-title">{title}</div>
              <div
                className="tpl-chart"
                // eslint-disable-next-line react/no-danger
                dangerouslySetInnerHTML={{ __html: renderChartSvg(donutOption(data, centerText), 480, height || 260) }}
              />
            </div>
          </Block>
        )
      },
    },
    BarChart: {
      label: '柱状图',
      fields: {
        ...annotationFields,
        title: { type: 'text', label: '标题' },
        height: { type: 'number', label: '图表高度（px）' },
        dataJson: { type: 'textarea', label: '数据（JSON: [{"name":"1班","value":12}]）' },
      },
      defaultProps: {
        title: '各班完成人数',
        height: 260,
        dataJson: '[{"name":"1班","value":10},{"name":"2班","value":12},{"name":"3班","value":8},{"name":"4班","value":5}]',
        dataSource: 'data（人员记录数组）',
        dataMap: "按'用户在组织中的路径'末级班级分组，统计'是否完成'=true 的人数",
      },
      render: ({ title, height, dataJson, dataMap, ...rest }) => {
        const data = parseJson<Slice[]>(dataJson, [])
        return (
          <Block bid={(rest as { id?: string }).id} component="bar-chart" map={dataMap} styleMap={rest.styleMap} script={rest.bindScript} css={rest.bindStyle}>
            <div className="tpl-card">
              <div className="tpl-card-title">{title}</div>
              <div
                className="tpl-chart"
                // eslint-disable-next-line react/no-danger
                dangerouslySetInnerHTML={{ __html: renderChartSvg(barOption(data), 480, height || 260) }}
              />
            </div>
          </Block>
        )
      },
    },
    // 列表格：人配列（label 表头 + value 列说明），AI 返回列方向 value_map 转置出行数据
    ColumnTable: {
      label: '列表格',
      fields: {
        ...annotationFields,
        columns: {
          type: 'array',
          label: '列',
          getItemSummary: itemSummaryByLabel,
          arrayFields: {
            label: { type: 'text', label: '表头' },
            value: { type: 'textarea', label: '列说明（写给 AI）' },
          },
          defaultItemProps: { label: '新列', value: '' },
        },
      },
      defaultProps: {
        columns: [
          { label: '班级', value: "'用户在组织中的路径'末级班级名" },
          { label: '总人数', value: '该班级记录条数' },
          { label: '已完成', value: "该班级'是否完成'=true 的人数" },
          { label: '完成率', value: '已完成/总人数，保留 1 位小数加 %' },
        ],
        rowsJson: '[["1班","12","10","83.3%"],["2班","13","12","92.3%"],["3班","13","8","61.5%"]]',
        dataSource: 'data（人员记录数组）',
        dataMap: "按末级班级分组：总人数=组内记录数，已完成=组内'是否完成'=true 数，完成率保留 1 位小数",
      },
      render: ({ columns, rowsJson, dataMap, ...rest }) => {
        const rows = parseJson<string[][]>(rowsJson ?? '[]', [])
        return (
          <Block bid={(rest as { id?: string }).id} component="column-table" map={dataMap} styleMap={rest.styleMap} script={rest.bindScript} css={rest.bindStyle}>
            <table className="tpl-table">
              <thead>
                <tr>{(columns ?? []).map((col, i) => <th key={i}>{col.label}</th>)}</tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i}>{(columns ?? []).map((_, j) => <td key={j}>{row[j] ?? ''}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </Block>
        )
      },
    },
    // 行表格：人配行（label 标签 + value 占位/说明），AI 按 value_map{行label: 值} 回填
    RowTable: {
      label: '行表格',
      fields: {
        ...annotationFields,
        rows: {
          type: 'array',
          label: '行',
          getItemSummary: itemSummaryByLabel,
          arrayFields: {
            label: { type: 'text', label: '标签' },
            value: { type: 'textarea', label: '值（占位显示，写给 AI 的说明）' },
          },
          defaultItemProps: { label: '新行', value: '' },
        },
      },
      defaultProps: {
        rows: [
          { label: '报告对象', value: '组织名称' },
          { label: '参与人数', value: 'data 记录总条数' },
          { label: '完成率', value: '完成人数/总人数，保留 1 位小数加 %' },
        ],
        dataSource: '组织信息 + data（人员记录数组）',
        dataMap: '每个标签行一个值，AI 按 value_map{行label: 值} 回填',
      },
      render: ({ rows, dataMap, ...rest }) => (
        <Block bid={(rest as { id?: string }).id} component="row-table" map={dataMap} styleMap={rest.styleMap} script={rest.bindScript} css={rest.bindStyle}>
          <table className="tpl-table">
            <tbody>
              {(rows ?? []).map((row, i) => (
                <tr key={i}><th>{row.label}</th><td>{row.value}</td></tr>
              ))}
            </tbody>
          </table>
        </Block>
      ),
    },
    // 动态列表格：列只配 label；行配 label + cells（跟随列动态生成的每列取数说明），
    // AI 按 value_map{行label: {列label: 值}} 逐格回填
    MatrixTable: {
      label: '动态列表格',
      fields: {
        ...annotationFields,
        columns: {
          type: 'array',
          label: '列',
          getItemSummary: itemSummaryByLabel,
          arrayFields: {
            label: { type: 'text', label: '列标签' },
          },
          defaultItemProps: { label: '新列' },
        },
        rows: {
          type: 'array',
          label: '行',
          getItemSummary: itemSummaryByLabel,
          arrayFields: {
            label: { type: 'text', label: '行标签' },
            cells: {
              type: 'custom',
              label: '各列取数说明（写给 AI）',
              render: ({ value, onChange }: { value?: Record<string, string>; onChange: (v: Record<string, string>) => void }) => (
                <MatrixCellsField value={value} onChange={onChange} />
              ),
            },
          },
          defaultItemProps: { label: '新指标', cells: {} },
        },
      },
      defaultProps: {
        columns: [
          { label: '有效N' },
          { label: '平均分' },
          { label: '关注人数' },
          { label: '关注率' },
          { label: '重点关注人数' },
          { label: '重点关注率' },
        ],
        rows: [
          {
            label: '学习压力',
            cells: {
              '有效N': "指标分数.'学习压力'>2 的有效人数",
              '平均分': '学习压力有效记录的平均分，保留 1 位小数',
              '关注人数': "学习压力预警等级为'关注'的人数",
              '关注率': '学习压力关注人数/有效N，保留 2 位小数加 %',
              '重点关注人数': "学习压力预警等级为'重点关注'的人数",
              '重点关注率': '学习压力重点关注人数/有效N，保留 2 位小数加 %',
            },
          },
          {
            label: '焦虑',
            cells: {
              '有效N': "指标分数.'焦虑'>2 的有效人数",
              '平均分': '焦虑有效记录的平均分，保留 1 位小数',
              '关注人数': "焦虑预警等级为'关注'的人数",
              '关注率': '焦虑关注人数/有效N，保留 2 位小数加 %',
              '重点关注人数': "焦虑预警等级为'重点关注'的人数",
              '重点关注率': '焦虑重点关注人数/有效N，保留 2 位小数加 %',
            },
          },
          {
            label: '情绪不稳定',
            cells: {
              '有效N': "指标分数.'情绪不稳定'>2 的有效人数",
              '平均分': '情绪不稳定有效记录的平均分，保留 1 位小数',
              '关注人数': "情绪不稳定预警等级为'关注'的人数",
              '关注率': '情绪不稳定关注人数/有效N，保留 2 位小数加 %',
              '重点关注人数': "情绪不稳定预警等级为'重点关注'的人数",
              '重点关注率': '情绪不稳定重点关注人数/有效N，保留 2 位小数加 %',
            },
          },
        ],
        rowsJson: '[["47","2.8","16","34.00%","7","14.90%"],["47","2.6","13","27.70%","5","10.60%"],["46","2.4","11","23.90%","4","8.70%"]]',
        dataSource: 'data（人员记录数组，报告内容.指标分数）',
        dataMap: '每个单元格=行指标×列统计；行列 label 人控，AI 按 value_map{行label:{列label:值}} 回填',
      },
      render: ({ columns, rows, rowsJson, dataMap, ...rest }) => {
        const cells = parseJson<string[][]>(rowsJson ?? '[]', [])
        return (
          <Block bid={(rest as { id?: string }).id} component="matrix-table" map={dataMap} styleMap={rest.styleMap} script={rest.bindScript} css={rest.bindStyle}>
            <table className="tpl-table">
              <thead>
                <tr><th></th>{(columns ?? []).map((col, i) => <th key={i}>{col.label}</th>)}</tr>
              </thead>
              <tbody>
                {(rows ?? []).map((row, i) => (
                  <tr key={i}>
                    <th>{row.label}</th>
                    {(columns ?? []).map((_, j) => <td key={j}>{cells[i]?.[j] ?? ''}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </Block>
        )
      },
    },
    Columns2: {
      label: '两栏布局',
      fields: {
        ...annotationFields,
        ratio: { type: 'text', label: '宽度比（如 1:1、1:2）' },
        gap: { type: 'number', label: '栏间距（px）' },
        left: { type: 'slot', label: '左栏' },
        right: { type: 'slot', label: '右栏' },
      },
      defaultProps: {
        ratio: '1:1',
        gap: 16,
        left: [],
        right: [],
        dataSource: '无（布局容器）',
        dataMap: '两栏 flex 布局，栏内组件纵向堆叠',
      },
      render: ({ ratio, gap, left: Left, right: Right, dataMap, ...rest }) => {
        const [a, b] = parseRatio(ratio, 2)
        return (
          <Block bid={(rest as { id?: string }).id} component="columns-2" map={dataMap} styleMap={rest.styleMap} script={rest.bindScript} css={rest.bindStyle}>
            <div className="tpl-cols" style={{ gap: `${gap}px` }}>
              <div style={{ flex: a }}><Left /></div>
              <div style={{ flex: b }}><Right /></div>
            </div>
          </Block>
        )
      },
    },
    Columns3: {
      label: '三栏布局',
      fields: {
        ...annotationFields,
        ratio: { type: 'text', label: '宽度比（如 1:1:1、2:1:1）' },
        gap: { type: 'number', label: '栏间距（px）' },
        colA: { type: 'slot', label: '第一栏' },
        colB: { type: 'slot', label: '第二栏' },
        colC: { type: 'slot', label: '第三栏' },
      },
      defaultProps: {
        ratio: '1:1:1',
        gap: 16,
        colA: [],
        colB: [],
        colC: [],
        dataSource: '无（布局容器）',
        dataMap: '三栏 flex 布局，栏内组件纵向堆叠',
      },
      render: ({ ratio, gap, colA: ColA, colB: ColB, colC: ColC, dataMap, ...rest }) => {
        const [a, b, c] = parseRatio(ratio, 3)
        return (
          <Block bid={(rest as { id?: string }).id} component="columns-3" map={dataMap} styleMap={rest.styleMap} script={rest.bindScript} css={rest.bindStyle}>
            <div className="tpl-cols" style={{ gap: `${gap}px` }}>
              <div style={{ flex: a }}><ColA /></div>
              <div style={{ flex: b }}><ColB /></div>
              <div style={{ flex: c }}><ColC /></div>
            </div>
          </Block>
        )
      },
    },
    Spacer: {
      label: '间距',
      fields: {
        ...annotationFields,
        height: { type: 'number', label: '高度（px）' },
      },
      defaultProps: { height: 24, dataSource: '无', dataMap: '无' },
      render: ({ height, dataMap, ...rest }) => (
        <Block bid={(rest as { id?: string }).id} component="spacer" map={dataMap} styleMap={rest.styleMap} script={rest.bindScript} css={rest.bindStyle}>
          <div className="tpl-spacer" style={{ height: `${height}px` }}>
            <span className="tpl-spacer-tag">间距 {height}px</span>
          </div>
        </Block>
      ),
    },
  },
}

// 统一包装：组件渲染前执行 bindScript（agent-bind 生成的数据脚本），
// 用 window.__DATA__ 算出的真实值覆盖展示字段，脚本缺失/异常时回退字段死值
type AnyRender = (props: { bindScript?: string } & Record<string, unknown>) => React.ReactNode
for (const [componentType, cfg] of Object.entries(editorConfig.components)) {
  const original = cfg.render as unknown as AnyRender
  cfg.render = ((props: { bindScript?: string } & Record<string, unknown>) =>
    original(resolveBind(props, componentType))) as typeof cfg.render
}
