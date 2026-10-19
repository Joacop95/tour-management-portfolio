"use client"

import { useState } from "react"
import { Check, ChevronsUpDown, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export type SearchableSelectOption = {
  value: string
  label: string
  searchValue?: string
  description?: string
  disabled?: boolean
}

type SearchableSelectProps = {
  value: string
  options: SearchableSelectOption[]
  placeholder: string
  searchPlaceholder: string
  emptyText: string
  onValueChange: (value: string) => void
  clearValue?: string
  clearLabel?: string
  disabled?: boolean
  "aria-label"?: string
  "aria-invalid"?: boolean
}

export function SearchableSelect({
  value,
  options,
  placeholder,
  searchPlaceholder,
  emptyText,
  onValueChange,
  clearValue,
  clearLabel = "Clear selection",
  disabled,
  "aria-label": ariaLabel,
  "aria-invalid": ariaInvalid,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false)
  const selectedOption = options.find((option) => option.value === value)
  const triggerText = selectedOption?.label ?? placeholder

  function selectValue(nextValue: string) {
    onValueChange(nextValue)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={ariaLabel}
          aria-invalid={ariaInvalid}
          disabled={disabled}
          className="w-full justify-between"
        >
          <span
            className={cn(
              "truncate",
              !selectedOption && "text-muted-foreground"
            )}
          >
            {triggerText}
          </span>
          <ChevronsUpDown className="size-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        portalled={false}
        className="w-(--radix-popover-trigger-width) overflow-hidden p-0"
      >
        <Command className="max-h-[min(22rem,var(--radix-popover-content-available-height))]">
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList
            className="max-h-72 touch-pan-y overscroll-contain [scrollbar-width:thin]"
            onWheel={(event) => {
              event.stopPropagation()
              event.currentTarget.scrollTop += event.deltaY
            }}
          >
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {clearValue ? (
                <CommandItem
                  value={clearLabel}
                  onSelect={() => selectValue(clearValue)}
                >
                  <X className="size-4" />
                  {clearLabel}
                </CommandItem>
              ) : null}
              {options.map((option) => {
                const isSelected = option.value === value

                return (
                  <CommandItem
                    key={option.value}
                    value={option.searchValue ?? option.label}
                    disabled={option.disabled}
                    onSelect={() => {
                      if (!option.disabled) {
                        selectValue(option.value)
                      }
                    }}
                  >
                    <Check
                      className={cn(
                        "size-4",
                        isSelected ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="min-w-0">
                      <span className="block truncate">{option.label}</span>
                      {option.description ? (
                        <span className="block truncate text-xs text-muted-foreground">
                          {option.description}
                        </span>
                      ) : null}
                    </span>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
