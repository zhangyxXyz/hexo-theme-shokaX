import { cardActive } from '../page/common'
import { resizeHandle, syncViewportState } from '../globals/handles'
import {
  CONFIG, LOCAL_HASH,
  setLocalHash, setLocalUrl, setOriginTitle, siteNav,
} from '../globals/globalVars'
import { createScrollRestoration, scrollDestination } from './scroll-restoration'
import { menuActive, sideBarTab, sidebarTOC } from '../components/sidebar'
import { Loader } from '../globals/thirdparty'
import { refreshArticleInfo } from '../components/article-info'
import { refreshChangelog } from '../components/changelog'
import { tabFormat } from '../page/tab'
import { refreshHitokoto } from '../components/hitokoto'
import { refreshTocCurve } from '../components/toc-curve'
import { refreshTocTooltip } from '../components/toc-tooltip'
import { refreshFooter } from '../components/footer'
import { refreshReadingTools } from '../components/reading-tools'
import { refreshVisitors } from '../components/visitors'
import { refreshFestival } from '../components/festival'
import { refreshTagCloud } from '../components/tagcloud'
import { refreshCategoryDirectory } from '../components/category-directory'
import { refreshBookmarks } from '../components/bookmarks'
import { refreshArchive } from '../components/archive'
import { refreshSummarySwitch } from '../components/summary-switch'
import { postBeauty } from '../page/post'
import { refreshArticleRelock } from '../components/article-relock'
import { refreshStatistics } from '../components/statistics'
import { refreshIconPreview } from '../components/icon-preview'
import { refreshTooltips } from '../components/tooltip'
import { refreshSidebarMenu } from '../components/sidebar-menu'
import { refreshCommentPanel } from '../components/comment-panel'
import { playPageEntry } from '../components/page-entry'

// A mobile visit can become a desktop view without a PJAX navigation.
matchMedia('(min-width: 768px)').addEventListener('change', event => {
  if (!event.matches) return
  if (__shokax_waline__) void import('../components/comments').then(module => module.walineRecentComments())
  if (__shokax_twikoo__) void import('../components/tcomments').then(module => module.twikooRecentComments())
})

// The encrypted body (including its private cards) can arrive after page setup,
// either through password entry or the encryption plugin's saved-key flow.
window.addEventListener('hexo-blog-decrypt', () => {
  refreshArticleRelock()
  void postBeauty()
  if (__shokax_tabs__) tabFormat()
  const toc = document.querySelector<HTMLTemplateElement>('template[data-private-toc]')
  const panel = document.querySelector('.contents.panel')
  if (toc && panel) {
    panel.replaceChildren(toc.content.cloneNode(true))
    toc.remove()
    sideBarTab()
    sidebarTOC()
    refreshTocCurve()
    refreshTocTooltip()
  }
  refreshSummarySwitch()
  refreshArticleInfo()
  refreshChangelog()
  refreshTooltips()
})

let scrollRestoration: ReturnType<typeof createScrollRestoration> | undefined
let lazyBackgrounds: IntersectionObserver | undefined
// Reuse the fulfilled promise instead of scheduling a fresh dynamic import per visit.
const copyTexReady = import('katex/dist/contrib/copy-tex.mjs')
export const siteRefresh = async (reload, restoredPosition?: [number, number], isCurrent = () => true) => {
  scrollRestoration?.cancel()
  let savedTop = 0
  if (CONFIG.auto_scroll) {
    try { savedTop = Number.parseFloat(localStorage.getItem(location.href) || '0') } catch { /* Storage may be disabled. */ }
  }
  const destination = scrollDestination(location.hash, restoredPosition, savedTop)
  const page = document.getElementById('main')
  scrollRestoration = page && destination ? createScrollRestoration({
    page, destination,
    // Archive year navigation already owns its initial anchor animation.
    isCurrent: () => isCurrent() && (Boolean(restoredPosition) || !LOCAL_HASH),
    offset: () => siteNav.getBoundingClientRect().height,
    onScroll: syncViewportState
  }) : undefined
  const restore = scrollRestoration
  lazyBackgrounds?.disconnect()
  // Full loads settle the existing viewport; PJAX batches its DOM writes first.
  if (reload) syncViewportState()
  if (__shokax_antiFakeWebsite__) {
    if (window.location.origin !== CONFIG.hostname && window.location.origin !== "http://localhost:4000") {
      window.location.href = CONFIG.hostname
      /*! 我知道你正在试图去除这段代码，虽然我无法阻止你，但我劝你好自为之 */
      alert('检测到非法仿冒网站，已自动跳转回正确首页;\nWe have detected a fake website, and you have been redirected to the correct homepage.')
    }
  }

  setLocalHash(0)
  const commentButton = document.querySelector<HTMLElement>('#tool .chat')
  if (commentButton) {
    commentButton.hidden = !document.getElementById('comments') || !(__shokax_waline__ || __shokax_twikoo__)
    commentButton.setAttribute('aria-label', document.querySelector<HTMLElement>('[data-comment-layout]')?.dataset.title || '')
  }
  refreshFooter()
  refreshReadingTools()
  refreshFestival()
  refreshTagCloud()
  refreshCategoryDirectory()
  refreshBookmarks()
  refreshArchive()
  refreshStatistics()
  refreshIconPreview()
  refreshSummarySwitch()
  refreshArticleInfo()
  refreshChangelog()
  setLocalUrl(window.location.href)
  refreshArticleRelock()
  void refreshHitokoto()

  await copyTexReady

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
  lazyBackgrounds = lazyBg
  document.querySelectorAll('[data-background-image]').forEach(el => {
    lazyBg.observe(el)
  })

  setOriginTitle(document.title)

  menuActive()
  refreshSidebarMenu()

  sideBarTab()
  sidebarTOC()
  refreshTocCurve()
  refreshTocTooltip()

  await postBeauty()

  const cpel = document.getElementById('comments')
  if (cpel && __shokax_waline__) {
    refreshCommentPanel(async () => {
      const { walinePageview, walineComment } = await import('../components/comments')
      if (!cpel.isConnected) return
      walinePageview()
      walineComment()
    })
  }
  if (cpel && !__shokax_waline__) {
    const comment = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          if (!cpel.isConnected) { comment.disconnect(); return }
          if (__shokax_waline__) {
            import('../components/comments').then(({walinePageview, walineComment}) => {
              if (!cpel.isConnected) return
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

  if (isCurrent()) {
    resizeHandle()
    restore?.restore()
    syncViewportState()
  } else restore?.cancel()

  cardActive()
  refreshTooltips()

  if (isCurrent()) refreshVisitors()
  if (reload && isCurrent()) Loader.hide(undefined, () => playPageEntry(!location.hash))

}
