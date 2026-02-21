import { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  retryCount: number;
}

const MAX_AUTO_RETRIES = 3;

export class ErrorBoundary extends Component<Props, State> {
  public state: State = { hasError: false, error: null, retryCount: 0 };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);

    // Auto-recover from transient React hook errors (duplicate React, HMR glitches)
    const isTransient =
      error.message?.includes("useEffect") ||
      error.message?.includes("Invalid hook call") ||
      error.message?.includes("Cannot read properties of null") ||
      error.message?.includes("useNavigate") ||
      error.message?.includes("<Router>") ||
      error.message?.includes("useLocation");

    if (isTransient && this.state.retryCount < MAX_AUTO_RETRIES) {
      console.log(`Auto-retrying (${this.state.retryCount + 1}/${MAX_AUTO_RETRIES})...`);
      setTimeout(() => {
        this.setState((prev) => ({
          hasError: false,
          error: null,
          retryCount: prev.retryCount + 1,
        }));
      }, 500);
    }
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background px-4">
          <div className="text-center max-w-md space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-destructive" />
            </div>
            <h2 className="text-xl font-bold text-foreground font-myanmar">
              တစ်ခုခု မှားသွားပါသည်
            </h2>
            <p className="text-sm text-muted-foreground font-myanmar">
              App တွင် ပြဿနာတစ်ခု ဖြစ်ပွားနေပါသည်။ Page ကို ပြန်လည် refresh လုပ်ပါ။
            </p>
            <Button onClick={this.handleReload} className="gap-2">
              <RefreshCw className="w-4 h-4" />
              <span className="font-myanmar">Refresh လုပ်မည်</span>
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
