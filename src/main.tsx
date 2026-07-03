import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './App.css'
import App from './App'

// 主题初始化：render 前设好 data-theme，避免浅色用户看到一帧深色闪烁
const savedTheme = localStorage.getItem('summertimes_theme')
if (savedTheme === 'light') {
  document.documentElement.dataset.theme = 'light'
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#f7f2ea')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
