import { cn } from "@/lib/utils"

type StackedTableHeaderProps = {
  top: string
  bottom: string
  align?: "left" | "center" | "right"
}

export function StackedTableHeader({
  top,
  bottom,
  align = "center",
}: StackedTableHeaderProps) {
  return (
    <span
      className={cn(
        "flex flex-col gap-0.5 leading-tight",
        align === "left" && "items-start text-left",
        align === "center" && "items-center text-center",
        align === "right" && "items-end text-right"
      )}
    >
      <span>{top}</span>
      <span>{bottom}</span>
    </span>
  )
}
