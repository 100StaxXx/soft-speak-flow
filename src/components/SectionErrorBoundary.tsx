import React, { Component, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AlertTriangle, RefreshCw, LucideIcon } from "lucide-react";
import { logger } from "@/utils/logger";

/**
 * SectionErrorBoundary
 * 
 * A lightweight error boundary for wrapping individual sections/features within a page.
 * Unlike the full-page ErrorBoundary, this one:
 * - Shows inline error states that don't disrupt the whole page
 * - Supports retry functionality
 * - Can be customized per section with different icons and messages
 * - Automatically logs errors for debugging
 * 
 * Usage:
 *   <SectionErrorBoundary section="companion-display">
 *     <CompanionDisplay />
 *   </SectionErrorBoundary>
 * 
 *   // With custom fallback
 *   <SectionErrorBoundary 
 *     section="horoscope"
 *     title="Horoscope unavailable"
 *     description="Unable to load your daily horoscope"
 *     onRetry={() => refetch()}
 *   >
 *     <HoroscopeContent />
 *   </SectionErrorBoundary>
 */

interface SectionErrorBoundaryProps {
  children: ReactNode;
  /** Identifier for logging and debugging */
  section: string;
  /** Custom title for error state */
  title?: string;
  /** Custom description for error state */
  description?: string;
  /** Custom icon for error state */
  icon?: LucideIcon;
  /** Callback when user clicks retry - if not provided, uses component reset */
  onRetry?: () => void;
  /** Custom fallback component - overrides default error UI */
  fallback?: ReactNode;
  /** Whether to show the retry button */
  showRetry?: boolean;
  /** Compact mode for smaller sections */
  compact?: boolean;
  /** Additional className for the error container */
  className?: string;
}

interface SectionErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorCount: number;
}

export class SectionErrorBoundary extends Component<
  SectionErrorBoundaryProps,
  SectionErrorBoundaryState
> {
  constructor(props: SectionErrorBoundaryProps) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null,
      errorCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<SectionErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const { section } = this.props;
    
    // Log error with section context
    logger.error(`SectionErrorBoundary [${section}] caught error`, {
      section,
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });

    // Increment error count for retry limiting
    this.setState(prev => ({ errorCount: prev.errorCount + 1 }));
  }

  handleRetry = () => {
    const { onRetry, section } = this.props;
    
    logger.info(`Retrying section: ${section}`);
    
    // Reset error state
    this.setState({ hasError: false, error: null });
    
    // Call custom retry handler if provided
    if (onRetry) {
      onRetry();
    }
  };

  render() {
    const { hasError, error, errorCount } = this.state;
    const {
      children,
      section,
      title = "Something went wrong",
      description = "This section couldn't load properly",
      icon: Icon = AlertTriangle,
      fallback,
      showRetry = true,
      compact = false,
      className = "",
    } = this.props;

    if (!hasError) {
      return children;
    }

    // Use custom fallback if provided
    if (fallback) {
      return fallback;
    }

    // Limit retries to prevent infinite loops
    const maxRetries = 3;
    const canRetry = showRetry && errorCount < maxRetries;

    if (compact) {
      return (
        <div className={`flex items-center gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20 ${className}`}>
          <Icon className="h-5 w-5 text-destructive flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-destructive truncate">{title}</p>
          </div>
          {canRetry && (
            <Button
              variant="ghost"
              size="sm"
              onClick={this.handleRetry}
              className="flex-shrink-0"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          )}
        </div>
      );
    }

    return (
      <Card className={`p-6 text-center ${className}`}>
        <Icon className="h-12 w-12 text-destructive mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground mb-4">{description}</p>
        
        {/* Show error details in development */}
        {import.meta.env.DEV && error && (
          <details className="mb-4 text-left">
            <summary className="cursor-pointer text-xs text-muted-foreground mb-2">
              Debug info ({section})
            </summary>
            <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-24">
              {error.message}
            </pre>
          </details>
        )}
        
        {canRetry ? (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={this.handleRetry}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Try Again
          </Button>
        ) : errorCount >= maxRetries ? (
          <p className="text-xs text-muted-foreground">
            Please refresh the page or try again later
          </p>
        ) : null}
      </Card>
    );
  }
}

/**
 * Hook-based error boundary wrapper for functional components
 * Provides a simpler API for common use cases
 */
export function withSectionErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  options: Omit<SectionErrorBoundaryProps, 'children'>
) {
  const displayName = WrappedComponent.displayName || WrappedComponent.name || 'Component';
  
  const WithErrorBoundary = (props: P) => (
    <SectionErrorBoundary {...options}>
      <WrappedComponent {...props} />
    </SectionErrorBoundary>
  );
  
  WithErrorBoundary.displayName = `withSectionErrorBoundary(${displayName})`;
  
  return WithErrorBoundary;
}

/**
 * Pre-configured error boundaries for common sections
 */
export const CompanionErrorBoundary = ({ children }: { children: ReactNode }) => (
  <SectionErrorBoundary
    section="companion"
    title="Companion unavailable"
    description="Unable to load your companion. Your data is safe!"
  >
    {children}
  </SectionErrorBoundary>
);

export const QuestsErrorBoundary = ({ children }: { children: ReactNode }) => (
  <SectionErrorBoundary
    section="quests"
    title="Quests unavailable"
    description="Unable to load your quests right now"
  >
    {children}
  </SectionErrorBoundary>
);

export const HoroscopeErrorBoundary = ({ children }: { children: ReactNode }) => (
  <SectionErrorBoundary
    section="horoscope"
    title="Horoscope unavailable"
    description="Unable to load Cosmiq insights right now"
  >
    {children}
  </SectionErrorBoundary>
);

export const MentorErrorBoundary = ({ children }: { children: ReactNode }) => (
  <SectionErrorBoundary
    section="mentor"
    title="Mentor unavailable"
    description="Unable to connect with your mentor"
  >
    {children}
  </SectionErrorBoundary>
);
