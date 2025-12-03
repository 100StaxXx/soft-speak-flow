import React, { Component, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AlertTriangle, Home, RefreshCw } from "lucide-react";
import { logger } from "@/utils/logger";

interface Props {
  children: ReactNode;
  routeName: string;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

/**
 * Route-specific error boundary
 * 
 * Catches errors in specific routes/features without crashing entire app.
 * Logs errors for debugging and provides user-friendly recovery options.
 */
export class RouteErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null,
      errorInfo: null 
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log to console and any error tracking service
    logger.error(`Error in ${this.props.routeName} route:`, {
      error: error.toString(),
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      route: this.props.routeName,
    });

    // Store error info for display
    this.setState({ errorInfo });

    // TODO: Send to error tracking service (Sentry, LogRocket, etc.)
    // if (window.errorTracker) {
    //   window.errorTracker.captureException(error, {
    //     tags: { route: this.props.routeName },
    //     extra: { errorInfo }
    //   });
    // }
  }

  handleRetry = () => {
    // Reset error state and try to re-render
    this.setState({ 
      hasError: false, 
      error: null,
      errorInfo: null 
    });
  };

  handleGoHome = () => {
    // Navigate to home page
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <Card className="max-w-lg w-full p-8">
            <div className="text-center mb-6">
              <AlertTriangle className="h-16 w-16 text-destructive mx-auto mb-4" />
              <h1 className="text-2xl font-heading font-bold text-foreground mb-2">
                {this.props.routeName} Error
              </h1>
              <p className="text-muted-foreground">
                Something went wrong with this feature. Don't worry, your data is safe.
              </p>
            </div>

            {/* Error details (collapsible, for debugging) */}
            {this.state.error && (
              <details className="mb-6 text-left">
                <summary className="cursor-pointer text-sm text-muted-foreground mb-2 hover:text-foreground">
                  Technical details (click to expand)
                </summary>
                <div className="text-xs bg-muted p-4 rounded space-y-2 overflow-auto max-h-48">
                  <div>
                    <strong className="text-foreground">Error:</strong>
                    <pre className="mt-1 whitespace-pre-wrap break-words">
                      {this.state.error.message}
                    </pre>
                  </div>
                  {this.state.error.stack && (
                    <div>
                      <strong className="text-foreground">Stack trace:</strong>
                      <pre className="mt-1 whitespace-pre-wrap break-words text-xs">
                        {this.state.error.stack.substring(0, 500)}
                        {this.state.error.stack.length > 500 && '...'}
                      </pre>
                    </div>
                  )}
                </div>
              </details>
            )}

            {/* Recovery actions */}
            <div className="space-y-3">
              <Button 
                onClick={this.handleRetry} 
                className="w-full"
                variant="default"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Try Again
              </Button>
              <Button 
                onClick={this.handleGoHome} 
                className="w-full"
                variant="outline"
              >
                <Home className="mr-2 h-4 w-4" />
                Go to Home
              </Button>
            </div>

            {/* Help text */}
            <p className="text-xs text-muted-foreground text-center mt-6">
              If this problem persists, please contact support or try refreshing the app.
            </p>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Helper component to wrap routes with error boundaries
 * 
 * Usage:
 * <ErrorBoundaryRoute name="Tasks">
 *   <Tasks />
 * </ErrorBoundaryRoute>
 */
export const ErrorBoundaryRoute = ({ 
  name, 
  children 
}: { 
  name: string; 
  children: ReactNode;
}) => {
  return (
    <RouteErrorBoundary routeName={name}>
      {children}
    </RouteErrorBoundary>
  );
};
