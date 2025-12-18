import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const inputVariants = cva(
  "flex h-10 w-full rounded-lg bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 md:text-sm transition-all duration-300",
  {
    variants: {
      variant: {
        default: "border border-input focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        gradient: "border-0 bg-card shadow-sm focus-visible:outline-none focus-visible:ring-0 [background:linear-gradient(var(--background),var(--background))_padding-box,linear-gradient(to_right,hsl(var(--lumi-orange-1)),hsl(var(--lumi-pink-1)),hsl(var(--lumi-purple-1)))_border-box] border border-transparent focus:[background:linear-gradient(var(--background),var(--background))_padding-box,linear-gradient(to_right,hsl(var(--lumi-pink-1)),hsl(var(--lumi-purple-1)),hsl(var(--lumi-blue-1)))_border-box]",
        glow: "border border-input focus-visible:outline-none focus-visible:border-primary focus-visible:shadow-glow focus-visible:ring-0",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

interface InputProps extends React.ComponentProps<"input">, VariantProps<typeof inputVariants> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, variant, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(inputVariants({ variant }), className)}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input, inputVariants };
