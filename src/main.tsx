import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Unfocus non-text controls (buttons, tabs, switches, sliders, links) after mouse/touch
// clicks so subsequent keyboard shortcuts (Esc, arrows, Cmd, etc.) never trigger a stale
// :focus-visible outline on the last clicked button, while preserving Tab navigation.
if (typeof window !== 'undefined') {
  const NON_TEXT_FOCUSABLE =
    'button, a, summary, [role="button"], [role="tab"], [role="switch"], [role="checkbox"], [role="radio"], [role="slider"]'

  const blurActiveNonTextControl = () => {
    const active = document.activeElement
    if (active instanceof HTMLElement && active.matches(NON_TEXT_FOCUSABLE)) {
      active.blur()
    }
  }

  window.addEventListener('click', (e) => {
    if (e.detail > 0) blurActiveNonTextControl()
  })

  window.addEventListener(
    'pointerup',
    (e) => {
      if (e.pointerType === 'mouse' || e.pointerType === 'touch' || e.pointerType === 'pen') {
        queueMicrotask(blurActiveNonTextControl)
      }
    },
    true,
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
