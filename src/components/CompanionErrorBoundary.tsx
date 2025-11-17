import { Component, ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw, Home } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class CompanionErrorBoundaryClass extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error("Companion Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || <CompanionErrorFallback error={this.state.error} />;
    }

    return this.props.children;
  }
}

const CompanionErrorFallback = ({ error }: { error: Error | null }) => {
  const navigate = useNavigate();
  
  return (
    <Card className="p-8 text-center bg-gradient-to-br from-destructive/5 to-destructive/10 border-destructive/30">
      <div className="flex flex-col items-center gap-4 max-w-md mx-auto">
        <div className="h-16 w-16 rounded-full bg-destructive/20 flex items-center justify-center">
          <AlertCircle className="h-8 w-8 text-destructive" />
        </div>
        
        <div className="space-y-2">
          <h3 className="text-xl font-heading font-bold text-foreground">
            Companion Unavailable
          </h3>
          <p className="text-sm text-muted-foreground">
            Your companion is taking a quick nap. Let's try waking them up!
          </p>
        </div>

        <div className="flex gap-3 mt-4">
          <Button
            onClick={() => window.location.reload()}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate("/")}
            className="gap-2"
          >
            <Home className="h-4 w-4" />
            Go Home
          </Button>
        </div>

        {error && (
          <details className="mt-4 text-xs text-muted-foreground max-w-full">
            <summary className="cursor-pointer hover:text-foreground">
              Technical Details
            </summary>
            <pre className="mt-2 p-3 bg-background/50 rounded text-left overflow-auto max-h-32">
              {error.message}
            </pre>
          </details>
        )}
      </div>
    </Card>
  );
};

export const CompanionErrorBoundary = CompanionErrorBoundaryClass;
