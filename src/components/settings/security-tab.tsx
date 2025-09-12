"use client"

import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { useState } from "react"

export function SecurityTab() {
  const [multiFactorAuth, setMultiFactorAuth] = useState(true)

  return (
    <div className="space-y-6">
      {/* Multi-factor authentication */}
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm font-medium text-gray-900 dark:text-white">
            Multi-factor authentication
          </Label>
          <p className="text-xs text-blue-600 hover:text-blue-700 cursor-pointer">
            Learn more
          </p>
        </div>
        <button
          onClick={() => setMultiFactorAuth(!multiFactorAuth)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            multiFactorAuth ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              multiFactorAuth ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* Log out of this device */}
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium text-gray-900 dark:text-white">
          Log out of this device
        </Label>
        <Button variant="outline" size="sm">
          Log out
        </Button>
      </div>

      {/* Log out of all devices */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label className="text-sm font-medium text-gray-900 dark:text-white">
            Log out of all devices
          </Label>
          <Button variant="destructive" size="sm">
            Log out all
          </Button>
        </div>
        <p className="text-xs text-gray-600 dark:text-gray-400">
          Log out of all active sessions across all devices, including your current session. 
          It may take up to 30 minutes for other devices to be logged out.
        </p>
      </div>

      {/* Secure sign in with Genius AI */}
      <div>
        <Label className="text-lg font-medium text-gray-900 dark:text-white mb-2 block">
          Secure sign in with Genius AI
        </Label>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Sign in to websites and apps across the internet with the trusted security of Genius AI.{" "}
          <button className="text-blue-600 hover:text-blue-700 underline">
            Learn more
          </button>
        </p>

        <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
            You haven&apos;t used Genius AI to sign into any websites or apps yet. Once you do, they&apos;ll show up here.
          </p>
        </div>
      </div>
    </div>
  )
}
