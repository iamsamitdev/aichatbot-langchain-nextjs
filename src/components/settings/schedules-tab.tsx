"use client"

import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { HelpCircle } from "lucide-react"

export function SchedulesTab() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <Label className="text-lg font-medium text-gray-900 dark:text-white">
          Schedules
        </Label>
        <HelpCircle className="h-4 w-4 text-gray-400" />
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-400">
        Genius AI can be scheduled to run again after it completes a task. Choose{" "}
        <strong>Schedule from the ⋯ menu in a conversation to set up future runs.</strong>
      </p>

      <Button variant="outline" size="sm">
        Manage
      </Button>
    </div>
  )
}
