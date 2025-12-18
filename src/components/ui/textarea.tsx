import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const textareaVariants = cva(
  "flex min-h-[80px] w-full rounded-lg bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-300",
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

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement>, VariantProps<typeof textareaVariants> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, variant, ...props }, ref) => {
  return (
    <textarea
      className={cn(textareaVariants({ variant }), className)}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea, textareaVariants };
