import { Component, type ErrorInfo, type ReactNode } from 'react'
import { RefreshCw } from 'lucide-react'

type Props = {
  children: ReactNode
  onRetry: () => void
}

type State = {
  hasError: boolean
}

export class ChartErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error('Unable to render chart for this selection.', error, info)
    }
  }

  componentDidUpdate(previousProps: Props) {
    if (previousProps.children !== this.props.children && this.state.hasError) {
      this.setState({ hasError: false })
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="chart-view chart-error-view">
        <div className="chart-empty-state chart-error-state">
          <strong>Unable to render chart for this selection.</strong>
          <span>Try refreshing the workspace or choose a different filter.</span>
          <button className="button secondary" onClick={this.props.onRetry}>
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>
      </div>
    )
  }
}
