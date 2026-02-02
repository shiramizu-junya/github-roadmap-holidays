import type { PlasmoCSConfig } from "plasmo"
import { useEffect, useRef } from "react"
import { holidayManager, getDayType, type DayType } from "~lib/holidays"

export const config: PlasmoCSConfig = {
  matches: ["https://github.com/*"],
  run_at: "document_idle"
}

const PROCESSED_ATTR = "data-grh-processed"
const STRIPE_CLASS = "grh-stripe"

// 日付ヘッダーのスタイル
const styles = `
  /* 日曜日 - 赤系 */
  .grh-sunday {
    color: #cf222e !important;
    font-weight: 700 !important;
  }

  /* 土曜日 - 青系 */
  .grh-saturday {
    color: #0969da !important;
    font-weight: 700 !important;
  }

  /* 祝日 - 緑系 */
  .grh-holiday {
    color: #1a7f37 !important;
    font-weight: 700 !important;
  }

  /* ダークモード対応 */
  [data-color-mode="dark"] .grh-sunday {
    color: #ff7b72 !important;
  }
  [data-color-mode="dark"] .grh-saturday {
    color: #79c0ff !important;
  }
  [data-color-mode="dark"] .grh-holiday {
    color: #7ee787 !important;
  }

  @media (prefers-color-scheme: dark) {
    :root:not([data-color-mode="light"]) .grh-sunday {
      color: #ff7b72 !important;
    }
    :root:not([data-color-mode="light"]) .grh-saturday {
      color: #79c0ff !important;
    }
    :root:not([data-color-mode="light"]) .grh-holiday {
      color: #7ee787 !important;
    }
  }

  /* 縦ストライプ */
  .${STRIPE_CLASS} {
    position: absolute;
    pointer-events: none;
    z-index: 0;
  }

  .${STRIPE_CLASS}-sunday {
    background-color: rgba(207, 34, 46, 0.06);
  }
  .${STRIPE_CLASS}-saturday {
    background-color: rgba(9, 105, 218, 0.06);
  }
  .${STRIPE_CLASS}-holiday {
    background-color: rgba(26, 127, 55, 0.08);
  }

  [data-color-mode="dark"] .${STRIPE_CLASS}-sunday {
    background-color: rgba(255, 123, 114, 0.08);
  }
  [data-color-mode="dark"] .${STRIPE_CLASS}-saturday {
    background-color: rgba(121, 192, 255, 0.08);
  }
  [data-color-mode="dark"] .${STRIPE_CLASS}-holiday {
    background-color: rgba(126, 231, 135, 0.1);
  }
`

function clearStripes() {
  document.querySelectorAll(`.${STRIPE_CLASS}`).forEach(el => el.remove())
}

function highlightRoadmapDates() {
  const grid = document.querySelector('[role="grid"]')
  if (!grid) return

  const rowgroup = grid.querySelector('[role="rowgroup"]')
  if (!rowgroup) return

  const rows = rowgroup.querySelectorAll(':scope > [role="row"]')
  if (rows.length < 2) return

  const dateRow = rows[1]
  const timeElements = dateRow.querySelectorAll('time[datetime]')

  if (timeElements.length === 0) return

  const wasProcessed = dateRow.hasAttribute(PROCESSED_ATTR)
  dateRow.setAttribute(PROCESSED_ATTR, "true")

  // time要素の親を取得（ストライプを挿入するコンテナ）
  const firstTimeEl = timeElements[0] as HTMLElement
  const stripeContainer = firstTimeEl.parentElement
  if (!stripeContainer) return

  // コンテナの高さを計算
  const gridRect = grid.getBoundingClientRect()
  const dateRowRect = dateRow.getBoundingClientRect()
  const stripeHeight = gridRect.bottom - dateRowRect.bottom

  // 既存のストライプを削除（更新時）
  if (wasProcessed) {
    clearStripes()
  }

  timeElements.forEach((timeEl) => {
    const datetime = timeEl.getAttribute("datetime")
    if (!datetime) return

    const date = new Date(datetime)
    if (isNaN(date.getTime())) return

    const dayType = getDayType(date)

    if (!wasProcessed && dayType) {
      timeEl.classList.add(`grh-${dayType}`)
    }

    if (dayType) {
      const htmlEl = timeEl as HTMLElement
      // time要素のstyle.leftとstyle.widthをそのまま使用
      const left = htmlEl.style.left
      const width = htmlEl.style.width || "48px"

      // 既存のストライプがあればスキップ
      if (stripeContainer.querySelector(`.${STRIPE_CLASS}[data-date="${datetime}"]`)) {
        return
      }

      // time要素と同じ親にストライプを挿入（同じleft値を使用）
      const stripe = document.createElement("div")
      stripe.className = `${STRIPE_CLASS} ${STRIPE_CLASS}-${dayType}`
      stripe.setAttribute("data-date", datetime)
      stripe.style.left = left
      stripe.style.width = width
      stripe.style.top = `${dateRowRect.height}px`
      stripe.style.height = `${stripeHeight}px`

      stripeContainer.appendChild(stripe)
    }
  })

  if (!wasProcessed) {
    console.log("[GRH] Highlighted columns (no-lag mode)")
  }
}

function resetHighlights() {
  document.querySelectorAll(`[${PROCESSED_ATTR}]`).forEach((el) => {
    el.removeAttribute(PROCESSED_ATTR)
  })

  document.querySelectorAll('.grh-sunday, .grh-saturday, .grh-holiday').forEach((el) => {
    el.classList.remove("grh-sunday", "grh-saturday", "grh-holiday")
  })

  clearStripes()
}

function GitHubRoadmapHighlighter() {
  const lastUrlRef = useRef(location.href)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const styleEl = document.createElement("style")
    styleEl.id = "grh-styles"
    styleEl.textContent = styles
    document.head.appendChild(styleEl)

    const runHighlight = () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
      debounceTimerRef.current = setTimeout(() => {
        if (window.location.href.includes("/projects/")) {
          highlightRoadmapDates()
        }
      }, 50)
    }

    holidayManager.load().then(() => {
      runHighlight()
    })

    // DOM変更を監視
    const observer = new MutationObserver(() => {
      runHighlight()
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true
    })

    // リサイズ時に更新
    window.addEventListener("resize", runHighlight)

    const urlObserver = new MutationObserver(() => {
      if (location.href !== lastUrlRef.current) {
        lastUrlRef.current = location.href
        setTimeout(() => {
          resetHighlights()
          runHighlight()
        }, 500)
      }
    })
    urlObserver.observe(document, { subtree: true, childList: true })

    console.log("[GRH] GitHub Roadmap Weekend & Holiday Highlighter loaded")

    return () => {
      observer.disconnect()
      urlObserver.disconnect()
      window.removeEventListener("resize", runHighlight)
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
      styleEl.remove()
      clearStripes()
    }
  }, [])

  return null
}

export default GitHubRoadmapHighlighter
