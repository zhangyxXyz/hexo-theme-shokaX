// Canvas charts cannot inherit CSS colors automatically; resolve a complete theme per render.
export function chartPalette(dark: boolean) {
  return dark ? {
    text: '#dce5ee', axis: '#7f94a7', grid: '#394856', surface: '#283440',
    border: '#53687a', line: '#60c9df', average: '#54d9ca',
    areaTop: 'rgba(96,201,223,.38)', areaBottom: 'rgba(96,201,223,.03)',
    barTop: '#80ffa5', barBottom: '#01bfec', calendar: ['#344553', '#529cbc', '#8ed8e4'],
    series: ['#6cbde5', '#6dd5cc', '#a3cf9a', '#e7cb83', '#e8a985', '#df98b1', '#bf9bd7', '#97a9e0', '#87bdba', '#c2b6a2'],
  } : {
    text: '#46586a', axis: '#9aaebf', grid: '#e3ebf1', surface: '#ffffff',
    border: '#d3dfe8', line: '#2799bb', average: '#20cbbf',
    areaTop: 'rgba(39,153,187,.28)', areaBottom: 'rgba(39,153,187,.02)',
    barTop: '#80ffa5', barBottom: '#01bfec', calendar: ['#edf3f7', '#94c9da', '#318eac'],
    series: ['#459fc9', '#55bdb4', '#92bd85', '#dcba62', '#db9673', '#d782a0', '#ae8bc8', '#8498cf', '#78aaa6', '#b1a28d'],
  }
}
