import { Component } from 'react'

/**
 * Global error boundary — catches render errors and shows a recovery UI
 * instead of a white screen. See code review finding MEDIUM-09.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <div className="error-boundary-card">
            <div className="error-boundary-icon">⚠️</div>
            <h2>Something went wrong</h2>
            <p>An unexpected error occurred. Please try again.</p>
            <button
              className="error-boundary-btn"
              onClick={this.handleReset}
            >
              Try Again
            </button>
            <button
              className="error-boundary-btn error-boundary-btn--secondary"
              onClick={() => window.location.reload()}
            >
              Reload Page
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
