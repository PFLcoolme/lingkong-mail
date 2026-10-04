/* 空灵邮箱官网：轻量交互，无任何外部依赖 */

// 滚动进入视口的渐显动画
const revealTargets = document.querySelectorAll('.reveal')
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible')
          observer.unobserve(entry.target)
        }
      })
    },
    { threshold: 0.12, rootMargin: '0px 0px -60px 0px' }
  )
  revealTargets.forEach((el) => observer.observe(el))
} else {
  revealTargets.forEach((el) => el.classList.add('is-visible'))
}

// 顶栏滚动态：加阴影与毛玻璃强度
const nav = document.getElementById('nav')
const onScroll = () => {
  if (!nav) return
  nav.classList.toggle('is-scrolled', window.scrollY > 12)
}
onScroll()
window.addEventListener('scroll', onScroll, { passive: true })

// 移动端菜单
const navToggle = document.getElementById('navToggle')
if (navToggle && nav) {
  navToggle.addEventListener('click', () => {
    const open = nav.classList.toggle('is-open')
    navToggle.setAttribute('aria-expanded', String(open))
  })
  nav.querySelectorAll('.nav-links a').forEach((link) => {
    link.addEventListener('click', () => {
      nav.classList.remove('is-open')
      navToggle.setAttribute('aria-expanded', 'false')
    })
  })
}

// 命令复制
document.querySelectorAll('.cmd').forEach((box) => {
  const button = box.querySelector('.copy')
  if (!button) return
  button.addEventListener('click', async () => {
    const text = box.getAttribute('data-copy') || box.querySelector('code')?.textContent || ''
    try {
      await navigator.clipboard.writeText(text.trim())
      button.textContent = '已复制'
    } catch {
      // 非安全上下文下 clipboard 不可用，退回选中文本
      const range = document.createRange()
      const code = box.querySelector('code')
      if (code) {
        range.selectNodeContents(code)
        const selection = window.getSelection()
        selection?.removeAllRanges()
        selection?.addRange(range)
      }
      button.textContent = '请手动复制'
    }
    setTimeout(() => {
      button.textContent = '复制'
    }, 1800)
  })
})

// 锚点平滑滚动（尊重用户的减少动效偏好）
const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
if (!prefersReduced) {
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (event) => {
      const id = link.getAttribute('href')
      if (!id || id === '#') return
      const target = document.querySelector(id)
      if (!target) return
      event.preventDefault()
      target.scrollIntoView({ behavior: 'smooth', block: 'start' })
      history.replaceState(null, '', id)
    })
  })
}

// 年份
const year = document.getElementById('year')
if (year) year.textContent = String(new Date().getFullYear())

// 深浅色切换（初始值已在 <head> 内联脚本中确定，避免闪屏）
const themeToggle = document.getElementById('themeToggle')
themeToggle?.addEventListener('click', () => {
  const root = document.documentElement
  const nextDark = root.dataset.theme !== 'dark'
  if (nextDark) {
    root.dataset.theme = 'dark'
  } else {
    delete root.dataset.theme
  }
  try {
    localStorage.setItem('kongling-site-theme', nextDark ? 'dark' : 'light')
  } catch {
    /* 忽略存储失败 */
  }
})
