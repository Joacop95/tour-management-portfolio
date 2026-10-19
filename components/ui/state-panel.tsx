import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

type StatePanelProps = {
  title: string
  description?: string
  icon?: LucideIcon
  children?: React.ReactNode
  compact?: boolean
  className?: string
}

export function StatePanel({
  title,
  description,
  icon: Icon,
  children,
  compact = false,
  className,
}: StatePanelProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 text-center",
        compact ? "gap-1.5 px-4 py-4" : "gap-2 px-5 py-7",
        className
      )}
    >
      {Icon ? (
        <span className="flex size-8 items-center justify-center rounded-lg border bg-background text-muted-foreground shadow-xs">
          <Icon className="size-4" aria-hidden="true" />
        </span>
      ) : null}
      <p className="font-medium text-foreground">{title}</p>
      {description ? (
        <p className="max-w-lg text-sm text-muted-foreground">{description}</p>
      ) : null}
      {children ? <div className="mt-1 flex flex-wrap justify-center gap-2">{children}</div> : null}
    </div>
  )
}

