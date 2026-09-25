import { refreshSummaryPickers } from './summary-picker'
const preferenceKey = 'shokax.summary.article-model.v1'
let applyingPreference = false
function restorePreference(select: HTMLSelectElement, preference: string | null) {
  const option = Array.from(select.options).find(option => option.dataset.preference === preference)
  if (!option) return
  select.value = option.value
  applyingPreference = true
  try { select.dispatchEvent(new Event('change', { bubbles: true })) }
  finally { applyingPreference = false }
}
// Bind once per card; detached PJAX nodes and their handlers are collected together.
export function refreshSummarySwitch() {
  document.querySelectorAll<HTMLElement>('.summary-switch').forEach(group => {
    if (group.dataset.bound) return
    group.dataset.bound = 'true'
    group.addEventListener('click', event => {
      const button = (event.target as Element).closest<HTMLButtonElement>('button[data-summary-choice]')
      if (!button || !group.contains(button)) return
      event.preventDefault()
      event.stopPropagation()
      const card = group.closest('article')
      if (!card) return
      group.querySelectorAll<HTMLButtonElement>('button[data-summary-choice]').forEach(control => {
        control.setAttribute('aria-pressed', String(control === button))
      })
      card.querySelectorAll<HTMLElement>('[data-summary-panel]').forEach(panel => {
        const selected = group.querySelector<HTMLSelectElement>('select')?.value || '0'
        panel.hidden = panel.dataset.summaryPanel !== button.dataset.summaryChoice || (panel.dataset.summaryPanel === 'ai' && panel.dataset.summaryVersion !== selected)
      })
    })
  })
  document.querySelectorAll<HTMLSelectElement>('[data-summary-select]').forEach(select => {
    if (select.dataset.bound) return
    select.dataset.bound = 'true'
    select.addEventListener('click', event => event.stopPropagation())
    select.addEventListener('change', () => {
      const articleSummary = select.closest('.ai-summary, .article-preview-content')
      const root = articleSummary || select.closest('article')
      if (!root) return
      root.querySelectorAll<HTMLElement>('[data-summary-version]').forEach(panel => {
        panel.hidden = panel.dataset.summaryVersion !== select.value
      })
      const option = select.selectedOptions[0]
      const icon = articleSummary ? select.parentElement?.querySelector('.ic') : select.closest('.summary-switch')?.querySelector('[data-summary-choice="ai"] .ic, .summary-fixed .ic')
      if (icon && option.dataset.icon) icon.className = 'ic ' + option.dataset.icon
      if (!articleSummary) {
        root.querySelectorAll<HTMLElement>('[data-summary-panel="original"]').forEach(panel => { panel.hidden = select.value !== 'original' })
        root.querySelectorAll<HTMLButtonElement>('[data-summary-choice]').forEach(button => {
          button.setAttribute('aria-pressed', String(button.dataset.summaryChoice === 'ai'))
          if (button.dataset.summaryChoice === 'ai') button.title = option.dataset.tooltip || option.text
        })
        const fixed = root.querySelector<HTMLElement>('.summary-fixed')
        if (fixed) fixed.title = option.dataset.tooltip || option.text
      }
      if (articleSummary && !applyingPreference && option.dataset.preference) {
        try { localStorage.setItem(preferenceKey, option.dataset.preference) } catch { /* Storage may be disabled. */ }
        document.querySelectorAll<HTMLSelectElement>('.ai-summary [data-summary-select], .article-preview-content [data-summary-select]').forEach(other => {
          if (other !== select) restorePreference(other, option.dataset.preference!)
        })
      }
    })
  })
  let preference: string | null = null
  try { preference = localStorage.getItem(preferenceKey) } catch { /* Keep server defaults. */ }
  if (preference) document.querySelectorAll<HTMLSelectElement>('.ai-summary [data-summary-select], .article-preview-content [data-summary-select]').forEach(select => restorePreference(select, preference))
  refreshSummaryPickers()
  // PJAX may insert markup without executing its parser-time inline script.
  document.querySelectorAll<HTMLElement>('.ai-summary[data-summary-pending]').forEach(card => {
    card.style.removeProperty('visibility')
    card.removeAttribute('data-summary-pending')
  })
}
