import * as React from "react"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export type StatusTone =
  | "neutral"
  | "info"
  | "warning"
  | "success"
  | "destructive"

const toneStyles: Record<StatusTone, string> = {
  neutral: "border-slate-200 bg-slate-50 text-slate-700",
  info: "border-blue-200 bg-blue-50 text-blue-800",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  destructive: "border-rose-200 bg-rose-50 text-rose-800",
}

export function StatusBadge({
  tone = "neutral",
  className,
  ...props
}: React.ComponentProps<typeof Badge> & { tone?: StatusTone }) {
  return (
    <Badge
      variant="outline"
      className={cn(toneStyles[tone], className)}
      {...props}
    />
  )
}

