"use client"

import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { useState } from "react"
import { HelpCircle } from "lucide-react"

export function PersonalizationTab() {
  const [savedMemories, setSavedMemories] = useState(true)
  const [chatHistory, setChatHistory] = useState(true)
  const [recordHistory, setRecordHistory] = useState(true)

  return (
    <div className="space-y-6">
      {/* Custom instructions */}
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium text-gray-900 dark:text-white">
          Custom instructions
        </Label>
        <span className="text-sm text-gray-600 dark:text-gray-400">On ▶</span>
      </div>

      {/* Memory Section */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Label className="text-lg font-medium text-gray-900 dark:text-white">
            Memory
          </Label>
          <HelpCircle className="h-4 w-4 text-gray-400" />
        </div>

        <div className="space-y-4">
          {/* Reference saved memories */}
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium text-gray-900 dark:text-white">
              Reference saved memories
            </Label>
            <button
              onClick={() => setSavedMemories(!savedMemories)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                savedMemories ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  savedMemories ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Let Genius AI save and use memories when responding.
          </p>

          {/* Reference chat history */}
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium text-gray-900 dark:text-white">
              Reference chat history
            </Label>
            <button
              onClick={() => setChatHistory(!chatHistory)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                chatHistory ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  chatHistory ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Let Genius AI reference all previous conversations when responding.
          </p>

          {/* Manage memories */}
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium text-gray-900 dark:text-white">
              Manage memories
            </Label>
            <Button variant="outline" size="sm">
              Manage
            </Button>
          </div>

          <p className="text-sm text-gray-600 dark:text-gray-400">
            Genius AI may use Memory to personalize queries to search providers, such as Bing.{" "}
            <button className="text-blue-600 hover:text-blue-700 underline">
              Learn more
            </button>
          </p>
        </div>
      </div>

      {/* Record mode Section */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Label className="text-lg font-medium text-gray-900 dark:text-white">
            Record mode
          </Label>
          <HelpCircle className="h-4 w-4 text-gray-400" />
        </div>

        <div className="space-y-4">
          {/* Reference record history */}
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium text-gray-900 dark:text-white">
              Reference record history
            </Label>
            <button
              onClick={() => setRecordHistory(!recordHistory)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                recordHistory ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  recordHistory ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Let Genius AI reference all previous recording transcripts and notes when responding.
          </p>
        </div>
      </div>
    </div>
  )
}
