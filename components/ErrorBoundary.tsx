'use client'
import { Component, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }
      return (
        <div className="fixed inset-0 flex items-center justify-center p-6" style={{ background: '#060d0e' }}>
          <div
            className="w-full max-w-xl rounded-xl p-6 text-center"
            style={{
              background: 'rgba(10, 26, 27, 0.96)',
              border: '1px solid rgba(0,201,201,0.18)',
              boxShadow: '0 24px 80px rgba(0,0,0,0.45)',
            }}
          >
            <h2
              className="mb-3"
              style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 30, letterSpacing: 2, color: '#ff4444' }}
            >
              Something Went Wrong
            </h2>
            <p className="mb-5" style={{ color: 'rgba(232,245,245,0.78)', lineHeight: 1.6 }}>
              An unexpected error occurred. Please try refreshing the page.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded transition-all"
              style={{
                background: 'rgba(0,201,201,0.12)',
                border: '1px solid rgba(0,201,201,0.28)',
                color: '#00c9c9',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 11,
                letterSpacing: 1,
                textTransform: 'uppercase',
              }}
            >
              Refresh Page
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
