import { Component, type ReactNode } from 'react'
import { en } from '@/i18n/en'

// Outside the i18n provider on purpose: it must work even if the app itself failed.
export class ErrorBoundary extends Component<{ children: ReactNode }, { error?: Error }> {
  state: { error?: Error } = {}

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error) {
    console.error(error)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="grid min-h-dvh place-items-center px-8 text-center">
        <div>
          <p className="text-lg font-semibold">{en['error.title']}</p>
          <p className="mt-2 text-sm text-muted">{en['error.text']}</p>
          <p className="mt-3 font-mono text-xs text-muted">{this.state.error.message}</p>
          <button
            type="button"
            className="mt-6 h-11 rounded-2xl bg-accent px-5 font-semibold text-accent-fg"
            onClick={() => window.location.reload()}
          >
            {en['error.reload']}
          </button>
        </div>
      </div>
    )
  }
}
