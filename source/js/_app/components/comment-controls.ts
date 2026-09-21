const svgNS = 'http://www.w3.org/2000/svg'

function privacyIcon(locked: boolean) {
  const svg = document.createElementNS(svgNS, 'svg')
  svg.setAttribute('class', `shokax-private-icon ${locked ? 'is-locked' : 'is-unlocked'}`)
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('width', '24')
  svg.setAttribute('height', '24')
  svg.setAttribute('fill', 'none')
  svg.setAttribute('stroke', 'currentColor')
  svg.setAttribute('stroke-width', '1.7')
  svg.setAttribute('stroke-linecap', 'round')
  svg.setAttribute('stroke-linejoin', 'round')
  svg.setAttribute('aria-hidden', 'true')
  const body = document.createElementNS(svgNS, 'rect')
  for (const [key, value] of Object.entries({ x: '5.5', y: '10.5', width: '13', height: '10', rx: '2' })) body.setAttribute(key, value)
  const shackle = document.createElementNS(svgNS, 'path')
  shackle.setAttribute('d', locked ? 'M8 10.5V7.5a4 4 0 0 1 8 0v3' : 'M8 10.5V7.5a4 4 0 0 1 8 0')
  const keyhole = document.createElementNS(svgNS, 'path')
  keyhole.setAttribute('d', 'M12 14.5v2.5')
  svg.append(body, shackle, keyhole)
  return svg
}

// Keep Waline's native inputs and handlers; only group and decorate their DOM.
export function syncCommentControls(container: HTMLElement) {
  const privateLabel = container.dataset.privateLabel || 'Private'
  container.querySelectorAll<HTMLElement>('.wl-panel').forEach(panel => {
    const actions = panel.querySelector<HTMLElement>('.wl-actions')
    if (!actions) return
    const preview = actions.querySelector<HTMLButtonElement>('.shokax-comment-controls > button') ||
      actions.querySelector<HTMLButtonElement>(':scope > button:last-child')
    if (!preview || !panel.querySelector('.wl-preview')) return

    const previewHeading = panel.querySelector<HTMLElement>('.wl-preview > h4')
    if (previewHeading) {
      const label = previewHeading.textContent?.replace(/[:：]\s*$/, '') || ''
      if (previewHeading.textContent !== label) previewHeading.textContent = label
    }

    let group = actions.querySelector<HTMLElement>('.shokax-comment-controls')
    if (!group) {
      group = document.createElement('div')
      group.className = 'shokax-comment-controls'
      actions.append(group)
    }
    const markdown = panel.querySelector<HTMLAnchorElement>('.shokax-markdown-guide') || actions.querySelector<HTMLAnchorElement>('a[href]')
    if (markdown) {
      markdown.classList.add('shokax-markdown-guide')
      let tools = panel.querySelector<HTMLElement>('.shokax-editor-tools')
      if (!tools) {
        tools = document.createElement('div')
        tools.className = 'shokax-editor-tools'
        panel.insertBefore(tools, panel.querySelector('.wl-editor'))
      }
      if (markdown.parentElement !== tools) tools.append(markdown)
    }
    const privacy = panel.querySelector<HTMLElement>('.wl-private-reply')
    if (privacy) {
      privacy.dataset.themeTooltip = privacy.dataset.visibilityReason || [privateLabel, container.dataset.privateHint].filter(Boolean).join(' · ')
      privacy.removeAttribute('title')
      const input = privacy.querySelector('input')
      input?.setAttribute('role', 'switch')
      input?.setAttribute('aria-label', privateLabel)
      if (!privacy.querySelector('.shokax-private-icon')) {
        privacy.append(privacyIcon(false), privacyIcon(true))
      }
    }
    preview.classList.add('shokax-preview-switch')
    preview.setAttribute('role', 'switch')
    preview.setAttribute('aria-label', preview.getAttribute('title') || preview.dataset.themeTooltip || preview.getAttribute('aria-label') || '')
    preview.setAttribute('aria-checked', String(preview.classList.contains('active')))
    // Avoid moving already grouped controls on every native render (and losing focus).
    for (const control of [privacy, preview]) {
      if (!control || control.parentElement === group) continue
      const before = control !== preview && preview.parentElement === group ? preview : null
      group.insertBefore(control, before)
    }
    // Use the theme's delegated tooltip, including after Waline restores titles.
    panel.querySelectorAll<HTMLElement>('.wl-action').forEach(control => {
      const title = control.getAttribute('title')
      if (title) {
        control.dataset.themeTooltip = title
        if (!control.hasAttribute('aria-label')) control.setAttribute('aria-label', title)
        control.removeAttribute('title')
      }
    })
  })
}
