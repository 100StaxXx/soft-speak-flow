import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";

interface ErrorFallbackProps {
  error?: Error;
  resetError?: () => void;
  title?: string;
  description?: string;
}

export const ErrorFallback = ({ 
  error, 
  resetError, 
  title = "Something went wrong",
  description = "We encountered an error loading this component." 
}: ErrorFallbackProps) => {
  return (
    <Card className="p-6 border-destructive/50 bg-destructive/5">
      <div className="flex flex-col items-center text-center space-y-4">
        <div className="rounded-full bg-destructive/10 p-3">
          <AlertCircle className="h-6 w-6 text-destructive" />
        </div>
        
        <div className="space-y-2">
          <h3 className="font-semibold text-lg">{title}</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            {description}
          </p>
          
          {error && (
            <details className="text-xs text-left mt-4">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                Technical details
              </summary>
              <pre className="mt-2 p-2 bg-muted rounded text-left overflow-auto max-w-md">
                {error.message}
              </pre>
            </details>
          )}
        </div>

        <div className="flex gap-2">
          {resetError && (
            <Button onClick={resetError} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          )}
          
          <Button 
            onClick={() => window.location.reload()} 
            variant="default" 
            size="sm"
          >
            Reload Page
          </Button>
        </div>
      </div>
    </Card>
  );
};

export const MissionErrorFallback = ({ error, resetError }: ErrorFallbackProps) => (
  <ErrorFallback
    error={error}
    resetError={resetError}
    title="Missions Unavailable"
    description="We couldn't load your daily missions. Don't worry, your progress is safe."
  />
);

export const EvolutionErrorFallback = ({ 
  error, 
  onClose 
}: { 
  error?: Error; 
  onClose?: () => void;
}) => (
  <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/95 backdrop-blur-sm">
    <Card className="p-8 max-w-md mx-4 border-destructive/50 bg-card">
      <div className="flex flex-col items-center text-center space-y-4">
        <div className="rounded-full bg-destructive/10 p-4">
          <AlertCircle className="h-8 w-8 text-destructive" />
        </div>
        
        <div className="space-y-2">
          <h3 className="font-bold text-xl">Evolution Error</h3>
          <p className="text-sm text-muted-foreground">
            We encountered an issue during evolution. Your companion's progress has been saved.
          </p>
          
          {error && (
            <details className="text-xs text-left mt-4">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                Technical details
              </summary>
              <pre className="mt-2 p-2 bg-muted rounded text-left overflow-auto">
                {error.message}
              </pre>
            </details>
          )}
        </div>

        <Button onClick={onClose || (() => window.location.reload())} size="lg" className="w-full">
          Close
        </Button>
      </div>
    </Card>
  </div>
);

export const CheckInErrorFallback = ({ error, resetError }: ErrorFallbackProps) => (
  <ErrorFallback
    error={error}
    resetError={resetError}
    title="Check-in Unavailable"
    description="We couldn't load the check-in form. Please try again in a moment."
  />
);
