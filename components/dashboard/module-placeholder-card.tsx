import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { ModulePage } from "@/lib/types/modules"

type ModulePlaceholderCardProps = {
  module: ModulePage
}

export function ModulePlaceholderCard({ module }: ModulePlaceholderCardProps) {
  const Icon = module.icon

  return (
    <Card>
      <CardHeader className="border-b">
        <div>
          <CardTitle>{module.cardTitle}</CardTitle>
          <CardDescription>{module.description}</CardDescription>
        </div>
        <CardAction>
          <Button size="sm">
            <Icon className="size-4" />
            {module.actionLabel}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="flex min-h-64 flex-col justify-center gap-3 rounded-lg border border-dashed bg-muted/30 p-6">
          <div className="flex size-10 items-center justify-center rounded-lg bg-background ring-1 ring-border">
            <Icon className="size-5 text-muted-foreground" />
          </div>
          <div className="max-w-2xl">
            <h2 className="text-lg font-semibold">{module.title}</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {module.cardDescription}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
