import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from "react-error-boundary";
import "@github/spark/spark"
import '@xyflow/react/dist/style.css'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-quartz.css'

import App from './App.tsx'
import { ErrorFallback } from './ErrorFallback.tsx'

import "./main.css"
import "./styles/theme.css"
import "./index.css"

const resizeObserverErrorHandler = (e: ErrorEvent) => {
  if (e.message === 'ResizeObserver loop completed with undelivered notifications.' ||
      e.message.includes('ResizeObserver loop')) {
    e.stopImmediatePropagation()
    e.preventDefault()
    return false
  }
  return true
}

window.addEventListener('error', resizeObserverErrorHandler)

const originalConsoleError = console.error
console.error = (...args: any[]) => {
  const errorMessage = args[0]?.toString() || ''
  if (errorMessage.includes('ResizeObserver loop')) {
    return
  }
  originalConsoleError.apply(console, args)
}

const resizeObserverLoopErrRe = /^[^(ResizeObserver loop limit exceeded)]/
window.addEventListener('error', (e: ErrorEvent) => {
  if (!resizeObserverLoopErrRe.test(e.message)) {
    e.stopImmediatePropagation()
    e.preventDefault()
  }
})

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary FallbackComponent={ErrorFallback}>
    <App />
   </ErrorBoundary>
)
