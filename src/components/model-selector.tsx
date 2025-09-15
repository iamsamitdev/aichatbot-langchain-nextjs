"use client"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ChevronDown } from "lucide-react"
import { AVAILABLE_MODELS, type ModelOption } from "@/constants/models"

interface ModelSelectorProps {
  selectedModel: string
  onModelChange: (model: string) => void
  className?: string
}

export function ModelSelector({ 
  selectedModel, 
  onModelChange, 
  className 
}: ModelSelectorProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          className={cn("flex items-center gap-2 h-8 text-sm", className)}
        >
          {selectedModel}
          <ChevronDown size={16} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        {AVAILABLE_MODELS.map((model: ModelOption) => (
          <DropdownMenuItem
            key={model.name}
            onClick={() => onModelChange(model.name)}
            className={cn(
              "flex flex-col items-start gap-1 p-3 cursor-pointer",
              selectedModel === model.name && "bg-accent"
            )}
          >
            <div className="flex items-center justify-between w-full">
              <span className="font-medium">{model.name}</span>
              {selectedModel === model.name && (
                <div className="h-2 w-2 rounded-full bg-blue-500" />
              )}
            </div>
            <span className="text-xs text-muted-foreground">
              {model.description}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}