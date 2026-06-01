import { Link } from "react-router-dom";

export function DashboardFooter() {
  return (
    <footer className="border-t bg-card/30 py-4 px-6 text-center">
      <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
        <span>© {new Date().getFullYear()} LUMI by After Organic</span>
        <span className="hidden sm:inline">·</span>
        <Link
          to="/cancellation-policy"
          className="hover:text-foreground transition-colors underline underline-offset-2"
        >
          Cancellation Policy
        </Link>
        <span className="hidden sm:inline">·</span>
        <Link
          to="/office-hours"
          className="hover:text-foreground transition-colors underline underline-offset-2"
        >
          Office Hours
        </Link>
        <span className="hidden sm:inline">·</span>
        <a
          href="mailto:support@adsbylumi.com"
          className="hover:text-foreground transition-colors underline underline-offset-2"
        >
          Support
        </a>
      </div>
    </footer>
  );
}
