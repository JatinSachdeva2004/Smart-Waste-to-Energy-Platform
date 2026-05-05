import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground",
        outline: "text-foreground",
        success:
          "border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400",
        warning:
          "border-yellow-500/30 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
        danger:
          "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400",
        info: "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}
