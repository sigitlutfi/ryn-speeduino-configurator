import React from 'react';

class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] Uncaught error:', error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen bg-gray-950 text-white gap-6 p-8">
          <div className="text-neon-red text-4xl font-bold font-orbitron tracking-widest uppercase">
            Error
          </div>
          <div className="text-gray-400 text-sm text-center max-w-lg font-mono">
            {this.state.error?.message || 'An unexpected error occurred.'}
          </div>
          <button
            onClick={this.handleReset}
            className="px-6 py-2 border border-neon-cyan/40 text-neon-cyan text-xs font-bold uppercase tracking-widest rounded-lg hover:bg-neon-cyan/10 transition-all"
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
