import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ChartProvider } from './state/ChartContext'
import App from './App'
import './styles/globals.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode><ChartProvider><App /></ChartProvider></StrictMode>,
)
