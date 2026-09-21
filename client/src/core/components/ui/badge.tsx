import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/core/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive: "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

// Variantes tipo "pill con punto" (estado real: asistencia, cuotas, evaluación
// borrador/publicada) — mismo patrón visual que .status del prototipo de diseño.
const STATUS_CLASS: Record<"success" | "warning" | "danger" | "neutral", string> = {
  success: "paid",
  warning: "pending",
  danger: "overdue",
  neutral: "",
};

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]> | "success" | "warning" | "danger" | "neutral";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: BadgeVariant;
}

function Badge({ className, variant, ...props }: BadgeProps) {
  if (variant === "success" || variant === "warning" || variant === "danger" || variant === "neutral") {
    return <div className={cn("status", STATUS_CLASS[variant], className)} {...props} />;
  }
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
