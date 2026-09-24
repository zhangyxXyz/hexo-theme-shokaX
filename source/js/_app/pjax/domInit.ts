import { backToTopHandle, goToBottomHandle, goToCommentHandle, sideBarToggleHandle } from '../components/sidebar'
import {
  backToTop,
  goToComment,
  loadCat,
  menuToggle,
  quickBtn, setBackToTop, setGoToComment, setShowContents, setToolBtn,
  showContents,
  siteHeader,
  siteNav,
  toolBtn
} from '../globals/globalVars'
import { Loader } from '../globals/thirdparty'
import { createChild } from '../library/proto'
import { initAudioPlayer } from '../player'

export default async function domInit () {
  document.querySelectorAll('.overview .menu > .item').forEach((el) => {
    const entry = el.cloneNode(true) as HTMLElement
    // The top navigation keeps its existing links; disclosure buttons belong to the sidebar.
    entry.querySelectorAll<HTMLButtonElement>('.sidebar-menu-toggle').forEach(button => {
      if (button.classList.contains('sidebar-menu-chevron')) { button.remove(); return }
      const link = document.createElement('a')
      link.href = '#'
      link.onclick = () => false
      link.replaceChildren(...button.childNodes)
      button.replaceWith(link)
    })
    siteNav.querySelector('.menu').appendChild(entry)
  })

  loadCat.addEventListener('click', Loader.vanish)
  menuToggle.addEventListener('click', sideBarToggleHandle)
  document.querySelector('.dimmer').addEventListener('click', sideBarToggleHandle)

  quickBtn.querySelector('.down').addEventListener('click', goToBottomHandle)
  quickBtn.querySelector('.up').addEventListener('click', backToTopHandle)

  if (!toolBtn) {
    setToolBtn(createChild(siteHeader, 'div', {
      id: 'tool',
      innerHTML: `<div class="item player">
                    ${__shokax_player__ ? '<button type="button" class="play-pause btn" id="playBtn"></button><button type="button" class="music btn" id="showBtn" aria-controls="MusicPlayerRoot"></button>' : ''}
                  </div>
                  <div class="item contents">
                    <i class="ic i-list-ol"></i>
                  </div>
                  <div class="item chat" role="button" tabindex="0" hidden>
                    <i class="ic i-comments"></i>
                  </div>
                  <div class="item back-to-top">
                    <i class="ic i-arrow-up"></i>
                    <span>0%</span>
                  </div>`
    }))
  }

  setBackToTop(toolBtn.querySelector('.back-to-top'))
  setGoToComment(toolBtn.querySelector('.chat'))
  setShowContents(toolBtn.querySelector('.contents'))

  backToTop.addEventListener('click', backToTopHandle)
  goToComment.addEventListener('click', goToCommentHandle)
  goToComment.addEventListener('keydown', (event: KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); goToCommentHandle() }
  })
  showContents.addEventListener('click', sideBarToggleHandle)

  if (__shokax_player__) {
    await initAudioPlayer()
  }
  

  const createIntersectionObserver = () => {
    // waves在视口外时停止动画
    new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        document.querySelectorAll('.parallax>use').forEach(i => {
          i.classList.remove('stop-animation')
        })
        document.querySelectorAll('#imgs .item').forEach(i => {
          i.classList.remove('stop-animation')
        })
      } else {
        document.querySelectorAll('.parallax>use').forEach(i => {
          i.classList.add('stop-animation')
        })
        // waves不可见时imgs也应该不可见了
        document.querySelectorAll('#imgs .item').forEach(i => {
          i.classList.add('stop-animation')
        })
      }
    }, {
      root: null,
      threshold: 0.2
    }).observe(document.getElementById('waves'))

    // sakura在视口外时停止动画
    new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        document.querySelectorAll('.with-love>i').forEach(i => {
          i.classList.remove('stop-animation')
        })
      } else {
        document.querySelectorAll('.with-love>i').forEach(i => {
          i.classList.add('stop-animation')
        })
      }
    }, {
      root: null,
      threshold: 0.2
    }).observe(document.querySelector('.with-love'))
  }
  createIntersectionObserver()
}
