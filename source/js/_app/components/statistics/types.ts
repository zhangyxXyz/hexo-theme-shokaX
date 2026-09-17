export type Point = { name: string; value: number }
export type Labels = Record<string, string>
export type SiteChart = 'posts' | 'tags' | 'categories'
export type BaiduChart = 'calendar' | 'trends' | 'sources'
export type ChartKey = SiteChart | BaiduChart | 'map'
export type MapMode = 'china' | 'world'
export type BaiduSettings = { api?: string; site_id?: string; start_date?: string; timeout?: number }
export type Settings = {
  baidu?: BaiduSettings
  assets?: { echarts?: string; maps?: Partial<Record<MapMode, string>> }
  labels: Labels
  data: Partial<Record<SiteChart, Point[]>>
}
export type RegisterChart = (chart: any, body: HTMLElement, render: () => void) => void

export const siteCharts: SiteChart[] = ['posts', 'tags', 'categories']
export const baiduCharts: BaiduChart[] = ['calendar', 'trends', 'sources']
export const chartKeys: ChartKey[] = [...siteCharts, ...baiduCharts, 'map']
