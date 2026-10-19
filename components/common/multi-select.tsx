"use client"

import { useState } from "react"
import { Check, ChevronsUpDown, X } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export type MultiSelectOption = {
  value: string
  label: string
}

type MultiSelectProps = {
  label: string
  values: string[]
  options: MultiSelectOption[]
  emptyText: string
  searchPlaceholder: string
  allText: string
  disabled?: boolean
  onValuesChange: (values: string[]) => void
}

export function MultiSelect({
  label,
  values,
  options,
  emptyText,
  searchPlaceholder,
  allText,
  disabled = false,
  onValuesChange,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false)
  const selectedOptions = options.filter((option) =>
    values.includes(option.value)
  )
  const triggerText =
    selectedOptions.length === 0
      ? allText
      : selectedOptions.length === 1
        ? selectedOptions[0].label
        : `${selectedOptions.length} selected`

  function toggleValue(value: string) {
    if (values.includes(value)) {
      onValuesChange(values.filter((selectedValue) => selectedValue !== value))
      return
    }

    onValuesChange([...values, value])
  }

  return (
    <div className="grid gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className="w-full justify-between"
          >
            <span className="truncate">{triggerText}</span>
            <ChevronsUpDown className="size-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-(--radix-popover-trigger-width) p-0">
          <Command>
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList>
              <CommandEmpty>{emptyText}</CommandEmpty>
              <CommandGroup>
                <CommandItem value={allText} onSelect={() => onValuesChange([])}>
                  <Check
                    className={cn(
                      "size-4",
                      values.length === 0 ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {allText}
                </CommandItem>
                <CommandSeparator />
                {options.map((option) => {
                  const isSelected = values.includes(option.value)

                  return (
                    <CommandItem
                      key={option.value}
                      value={option.label}
                      onSelect={() => toggleValue(option.value)}
                    >
                      <Check
                        className={cn(
                          "size-4",
                          isSelected ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <span className="truncate">{option.label}</span>
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selectedOptions.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {selectedOptions.map((option) => (
            <Badge key={option.value} variant="outline" className="gap-1">
              {label}: {option.label}
              <button
                type="button"
                aria-label={`Remove ${option.label}`}
                disabled={disabled}
                onClick={() => toggleValue(option.value)}
                className="rounded-full text-muted-foreground hover:text-foreground"
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  )
}
