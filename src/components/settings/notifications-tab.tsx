"use client"

import { Label } from "@/components/ui/label"
import { useState } from "react"

export function NotificationsTab() {
  const [pushTasks, setPushTasks] = useState(true)
  const [emailTasks, setEmailTasks] = useState(true)

  return (
    <div className="space-y-6">
      {/* Responses */}
      <div>
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm font-medium text-gray-900 dark:text-white">
              Responses
            </Label>
            <div className="relative">
              <select 
                className="mt-1 px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none shadow-sm text-sm"
                style={{ WebkitAppearance: 'none', MozAppearance: 'none', appearance: 'none' }}
              >
                <option value="Push">Push</option>
                <option value="Email">Email</option>
                <option value="Both">Both</option>
                <option value="None">None</option>
              </select>
              <span className="pointer-events-none absolute top-1/2 right-3 transform -translate-y-1/2 text-gray-400 dark:text-gray-300">
                ▼
              </span>
            </div>
          </div>
        </div>
        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
          Get notified when Genius AI responds to requests that take time, like research or image generation.
        </p>
      </div>

      {/* Tasks */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label className="text-sm font-medium text-gray-900 dark:text-white">
            Tasks
          </Label>
          <div className="relative">
            <select 
              className="px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none shadow-sm text-sm"
              style={{ WebkitAppearance: 'none', MozAppearance: 'none', appearance: 'none' }}
            >
              <option value="Push, Email">Push, Email</option>
              <option value="Push">Push</option>
              <option value="Email">Email</option>
              <option value="None">None</option>
            </select>
            <span className="pointer-events-none absolute top-1/2 right-3 transform -translate-y-1/2 text-gray-400 dark:text-gray-300">
              ▼
            </span>
          </div>
        </div>
        
        <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
          Get notified when tasks you&apos;ve created have updates.{" "}
          <button className="text-blue-600 hover:text-blue-700 underline">
            Manage tasks
          </button>
        </p>

        {/* Task notification options */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm text-gray-900 dark:text-white">
              Push
            </Label>
            <button
              onClick={() => setPushTasks(!pushTasks)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                pushTasks ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  pushTasks ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-sm text-gray-900 dark:text-white">
              Email
            </Label>
            <button
              onClick={() => setEmailTasks(!emailTasks)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                emailTasks ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  emailTasks ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
