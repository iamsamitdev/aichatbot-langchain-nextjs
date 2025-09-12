"use client"

import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"

export function DataControlsTab() {
  return (
    <div className="space-y-6">
      {/* Improve the model for everyone */}
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium text-gray-900 dark:text-white">
          Improve the model for everyone
        </Label>
        <span className="text-sm text-gray-600 dark:text-gray-400">Off ▶</span>
      </div>

      {/* Remote browser data */}
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium text-gray-900 dark:text-white">
          Remote browser data
        </Label>
        <Button variant="destructive" size="sm">
          Delete all
        </Button>
      </div>

      {/* Shared links */}
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium text-gray-900 dark:text-white">
          Shared links
        </Label>
        <Button variant="outline" size="sm">
          Manage
        </Button>
      </div>

      {/* Archived chats */}
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium text-gray-900 dark:text-white">
          Archived chats
        </Label>
        <Button variant="outline" size="sm">
          Manage
        </Button>
      </div>

      {/* Archive all chats */}
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium text-gray-900 dark:text-white">
          Archive all chats
        </Label>
        <Button variant="outline" size="sm">
          Archive all
        </Button>
      </div>

      {/* Delete all chats */}
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium text-gray-900 dark:text-white">
          Delete all chats
        </Label>
        <Button variant="destructive" size="sm">
          Delete all
        </Button>
      </div>

      {/* Export data */}
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium text-gray-900 dark:text-white">
          Export data
        </Label>
        <Button variant="outline" size="sm">
          Export
        </Button>
      </div>
    </div>
  )
}
