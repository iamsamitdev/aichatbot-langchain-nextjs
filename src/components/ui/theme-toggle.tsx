"use client"

import * as React from "react"
import { Moon, Sun, Monitor } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useTheme } from "@/lib/theme-provider"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  const themes = [
    {
      value: "light",
      label: "Light",
      icon: Sun,
    },
    {
      value: "dark", 
      label: "Dark",
      icon: Moon,
    },
    {
      value: "system",
      label: "System",
      icon: Monitor,
    },
  ]

  const currentTheme = themes.find(t => t.value === theme) || themes[2]
  const CurrentIcon = currentTheme.icon

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon">
          <CurrentIcon className="h-[1.2rem] w-[1.2rem]" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-40" align="end">
        <div className="space-y-1">
          {themes.map((themeOption) => {
            const Icon = themeOption.icon
            return (
              <Button
                key={themeOption.value}
                variant={theme === themeOption.value ? "default" : "ghost"}
                className="w-full justify-start"
                onClick={() => setTheme(themeOption.value as "light" | "dark" | "system")}
              >
                <Icon className="mr-2 h-4 w-4" />
                {themeOption.label}
              </Button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}