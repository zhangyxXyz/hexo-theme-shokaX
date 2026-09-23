export type Point = { name: string; value: number; breakdown?: number[] }
export type Labels = Record<string, string>
export type SiteChart = 'posts' | 'tags' | 'categories' | 'clock'
export type BaiduChart = 'calendar' | 'trends' | 'sources'
export type ChartKey = SiteChart | BaiduChart | 'map' | 'content' | 'comment-map' | 'comment-trend' | 'comment-ranking'
export type ContentItem = { title: string; url: string; kind: 'article' | 'page' }
export type MapMode = 'china' | 'world'
export type BaiduSettings = { api?: string; endpoints?: string[]; start_date?: string; timeout?: number }
export type Settings = {
  comments?: { api?: string }
  baidu?: BaiduSettings
  assets?: { echarts?: string; maps?: Partial<Record<MapMode, string>> }
  labels: Labels
  data: Partial<Record<SiteChart, Point[]>> & { content?: ContentItem[] }
}
export type RegisterChart = (chart: any, body: HTMLElement, render: () => void) => void

export const siteCharts: SiteChart[] = ['posts', 'tags', 'categories', 'clock']
export const baiduCharts: BaiduChart[] = ['calendar', 'trends', 'sources']
export const chartKeys: ChartKey[] = [...siteCharts, ...baiduCharts, 'map', 'content', 'comment-map', 'comment-trend', 'comment-ranking']
