import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import '@fontsource-variable/inter'
import './index.css'
import { db } from '@/data/db'
import { ensureSeeded } from '@/data/defaults'
import { App, Splash } from '@/app/App'
import { ErrorBoundary } from '@/app/ErrorBoundary'

const root = createRoot(document.getElementById('root')!)
root.render(<Splash />)

async function start() {
  await ensureSeeded(db)
  // Ask the browser not to evict our data (granted automatically for installed PWAs on most platforms)
  void navigator.storage?.persist?.()
  root.render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  )
}

start().catch((err) => {
  console.error(err)
  root.render(
    <ErrorBoundary>
      <ThrowError error={err} />
    </ErrorBoundary>,
  )
})

function ThrowError({ error }: { error: unknown }): never {
  throw error instanceof Error ? error : new Error(String(error))
}

registerSW({ immediate: true })
