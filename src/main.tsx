import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AirStreamProvider } from './context/AirStreamContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AirStreamProvider>
      <App />
    </AirStreamProvider>
  </StrictMode>,
)
