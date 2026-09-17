import { cardActive } from '../page/common'
import { resizeHandle, syncViewportState } from '../globals/handles'
import {
  CONFIG,
  setLocalHash, setLocalUrl, setOriginTitle,
} from '../globals/globalVars'
import { positionInit } from '../globals/tools'
import { menuActive, sideBarTab, sidebarTOC } from '../components/sidebar'
import { Loader } from '../globals/thirdparty'
import { refreshArticleInfo } from '../components/article-info'
import { tabFormat } from '../page/tab'
import { refreshHitokoto } from '../components/hitokoto'
import { refreshTocCurve } from '../components/toc-curve'
import { refreshTocTooltip } from '../components/toc-tooltip'
import { refreshFooter } from '../components/footer'
import { refreshFestival } from '../components/festival'
import { refreshTagCloud } from '../components/tagcloud'
import { refreshSummarySwitch } from '../components/summary-switch'

export const siteRefresh = async (reload) => {
  // Update restored viewport state before any asynchronous page setup.
  syncViewportState()
  if (__shokax_antiFakeWebsite__) {
    if (window.location.origin !== CONFIG.hostname && window.location.origin !== "http://localhost:4000") {
      window.location.href = CONFIG.hostname
      /*! 我知道你正在试图去除这段代码，虽然我无法阻止你，但我劝你好自为之 */
      alert('检测到非法仿冒网站，已自动跳转回正确首页;\nWe have detected a fake website, and you have been redirected to the correct homepage.')
    }
  }

  setLocalHash(0)
  refreshFooter()
  refreshFestival()
  refreshTagCloud()
  refreshSummarySwitch()
  refreshArticleInfo()
  setLocalUrl(window.location.href)
  void refreshHitokoto()

  await import('katex/dist/contrib/copy-tex.mjs')

  // 懒加载背景图
  const lazyBg = new IntersectionObserver(function (entries, observer) {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target as HTMLElement
        el.style.backgroundImage = `url("${el.getAttribute('data-background-image')}")`
        el.removeAttribute('data-background-image')
        observer.unobserve(el)
      }
    })
  }, {
    root: null,
    threshold: 0.2
  })
  document.querySelectorAll('[data-background-image]').forEach(el => {
    lazyBg.observe(el)
  })

  setOriginTitle(document.title)

  resizeHandle()
  syncViewportState()

  menuActive()

  sideBarTab()
  sidebarTOC()
  refreshTocCurve()
  refreshTocTooltip()

  const pagePost = await import('../page/post')
  await pagePost.postBeauty()

  const cpel = document.getElementById('copyright')
  if (cpel) {
    const comment = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          if (__shokax_waline__) {
            import('../components/comments').then(({walinePageview, walineComment}) => {
              walinePageview()
              walineComment()
            })
          }
          if (__shokax_twikoo__) {
            import('../components/tcomments').then(({twikooComment}) => {
              twikooComment()
            })
          }
          comment.disconnect()
        }
      })
    }, {
      root: null,
      threshold: 0.2
    })

    comment.observe(cpel)
  }

  if (__shokax_waline__) {
    import('../components/comments').then(async ({walineRecentComments}) => {
      await walineRecentComments()
    })
  }

  if (__shokax_twikoo__) {
    import('../components/tcomments').then(async ({twikooRecentComments}) => {
      await twikooRecentComments()
    })
  }

  if (__shokax_tabs__) {
    tabFormat()
  }

  if (sessionStorage.getItem('loaded') === 'true') {
    Loader.hide(30)
  } else {
    sessionStorage.setItem('loaded', 'true')
    Loader.hide(500)
  }

  setTimeout(() => {
    positionInit()
    syncViewportState()
  }, 500)

  cardActive()

}
