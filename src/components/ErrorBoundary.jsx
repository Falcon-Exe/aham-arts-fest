import React from "react";

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError() {
        // Update state so the next render will show the fallback UI.
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        // You can also log the error to an error reporting service like Sentry here
        console.error("ErrorBoundary caught an error:", error, errorInfo);
        this.setState({ error, errorInfo });
    }

    render() {
        if (this.state.hasError) {
            // You can render any custom fallback UI
            return (
                <div style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', 
                    justifyContent: 'center', height: '100vh', background: 'var(--bg-main)', color: 'var(--text-main)',
                    fontFamily: 'system-ui, sans-serif', padding: '20px', textAlign: 'center'
                }}>
                    <h1 style={{ color: '#e63946', fontSize: '2.5rem', marginBottom: '10px' }}>Something went wrong.</h1>
                    <p style={{ color: '#aaa', maxWidth: '600px', lineHeight: '1.6' }}>
                        An unexpected error occurred in the application. Our team has been notified. 
                        Please try refreshing the page or contact support if the issue persists.
                    </p>
                    <button 
                        onClick={() => window.location.reload()} 
                        style={{
                            marginTop: '20px', padding: '12px 24px', background: '#e63946', 
                            color: 'var(--text-main)', border: 'none', borderRadius: '8px', cursor: 'pointer',
                            fontSize: '1rem', fontWeight: 'bold'
                        }}
                    >
                        Refresh Application
                    </button>
                    {process.env.NODE_ENV === 'development' && (
                        <details style={{ whiteSpace: 'pre-wrap', marginTop: '30px', textAlign: 'left', background: '#111', padding: '15px', borderRadius: '8px', color: '#ff8a8a', overflowX: 'auto', width: '100%', maxWidth: '800px' }}>
                            <summary style={{ cursor: 'pointer', fontWeight: 'bold', marginBottom: '10px' }}>Error Details (Dev Only)</summary>
                            {this.state.error && this.state.error.toString()}
                            <br />
                            {this.state.errorInfo && this.state.errorInfo.componentStack}
                        </details>
                    )}
                </div>
            );
        }

        return this.props.children; 
    }
}

export default ErrorBoundary;
