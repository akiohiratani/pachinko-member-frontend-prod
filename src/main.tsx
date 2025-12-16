/**
 * React アプリのエントリーポイント。
 * Layered Architecture の Composition Root として `App` をマウントする。
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './presentation/App.tsx'
import { initRuntimeConfig } from './runtimeConfig'

await initRuntimeConfig()
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
