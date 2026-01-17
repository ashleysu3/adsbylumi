import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { SparkleIcon } from "./SparkleIcon";
import { Loader2 } from "lucide-react";

const lumiButtonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-lumi text-white shadow-glow hover:shadow-[0_0_25px_rgba(234,88,12,0.4)] hover:scale-[1.02] active:scale-[0.98]",
        outline:
          "border-2 border-lumi-orange-1 text-lumi-orange-1 hover:bg-lumi-orange-1/10",
        ghost:
          "text-lumi-orange-1 hover:bg-lumi-orange-1/10",
        soft:
          "bg-gradient-to-br from-lumi-orange-1/10 to-lumi-pink-1/10 text-lumi-orange-1 hover:from-lumi-orange-1/20 hover:to-lumi-pink-1/20",
      },
      size: {
        sm: "h-9 px-4 text-xs",
        default: "h-11 px-6",
        lg: "h-12 px-8 text-base",
        xl: "h-14 px-10 text-lg",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface LumiButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof lumiButtonVariants> {
  asChild?: boolean;
  loading?: boolean;
  loadingText?: string;
  showLumiLoader?: boolean;
}

const LumiButton = React.forwardRef<HTMLButtonElement, LumiButtonProps>(
  ({ 
    className, 
    variant, 
    size, 
    asChild = false, 
    loading = false,
    loadingText,
    showLumiLoader = true,
    children,
    disabled,
    ...props 
  }, ref) => {
    const Comp = asChild ? Slot : "button";
    
    return (
      <Comp
        className={cn(lumiButtonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <>
            {showLumiLoader ? (
              <SparkleIcon size="xs" state="loading" />
            ) : (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
            {loadingText || children}
          </>
        ) : (
          children
        )}
      </Comp>
    );
  }
);
LumiButton.displayName = "LumiButton";

export { LumiButton, lumiButtonVariants };
