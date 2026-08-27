import { Component, type ErrorInfo, type ReactNode } from "react";
import { Hammer } from "lucide-react";

interface Props {
  children: ReactNode;
  /** Optional route-specific fallback label */
  label?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[ErrorBoundary${this.props.label ? `:${this.props.label}` : ""}]`, error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[50vh] flex-col items-center justify-center px-6 text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-red-50 text-red-600">
            <Hammer size={22} />
          </div>
          <h2 className="mt-5 font-display text-xl font-semibold text-ink">
            Something went wrong
          </h2>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">
            {this.state.error?.message || "An unexpected error occurred."}
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.href = "/";
            }}
            className="mt-6 inline-flex h-10 items-center gap-2 rounded-full bg-ink px-5 text-sm font-medium text-paper transition hover:bg-clay-700"
          >
            Back to home
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
