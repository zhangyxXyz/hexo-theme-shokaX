import { closeSelectPicker, enhanceSelect } from './select-picker'

export function refreshSummaryPickers() {
  closeSelectPicker()
  document.querySelectorAll<HTMLSelectElement>('[data-summary-select]').forEach(select => {
    const compact = !!select.closest('.summary-switch')
    enhanceSelect(select, {
      variant: 'summary',
      showArrow: !compact,
      renderTrigger(option, label, icon) {
        icon.className = 'ic ' + (compact ? select.dataset.genericIcon || 'i-align-left' : option?.dataset.icon || 'i-robot')
        if (compact) label.textContent = select.value === 'original' ? select.dataset.actionOriginal || '' : select.dataset.actionAi || ''
      },
    })
  })
}
