"use client"

import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { useState } from "react"

export function AccountTab() {
  const [showName, setShowName] = useState(true)

  return (
    <div className="space-y-6">
      {/* Payment */}
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm font-medium text-gray-900 dark:text-white">
            Payment
          </Label>
          <p className="text-xs text-blue-600 hover:text-blue-700 cursor-pointer">
            Need help with billing?
          </p>
        </div>
        <Button variant="outline" size="sm">
          Manage
        </Button>
      </div>

      {/* Delete account */}
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium text-gray-900 dark:text-white">
          Delete account
        </Label>
        <Button variant="destructive" size="sm">
          Delete
        </Button>
      </div>

      {/* Genius AI builder profile */}
      <div>
        <Label className="text-lg font-medium text-gray-900 dark:text-white mb-4 block">
          Genius AI builder profile
        </Label>
        
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Personalize your builder profile to connect with users of your Genius AIs. These settings apply to publicly shared Genius AIs.
        </p>

        <div className="flex justify-end mb-4">
          <Button variant="outline" size="sm">
            Preview
          </Button>
        </div>

        {/* Profile Card */}
        <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-center mb-3">
            <div className="w-12 h-12 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center">
              <span className="text-gray-600 dark:text-gray-400">👤</span>
            </div>
          </div>
          <div className="text-center">
            <div className="font-medium text-gray-900 dark:text-white mb-1">
              PlaceholderGeniusAI
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">
              By บริษัท ไอทีจีเนียส เอ็นจิเนียริ่ง จำกัด
            </div>
          </div>
        </div>

        {/* Name setting */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Label className="text-sm font-medium text-gray-900 dark:text-white">
              Name
            </Label>
            <div className="w-4 h-4 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center">
              <span className="text-xs">?</span>
            </div>
          </div>
          <button
            onClick={() => setShowName(!showName)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              showName ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                showName ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        <div className="text-sm text-gray-900 dark:text-white mb-4">
          บริษัท ไอทีจีเนียส เอ็นจิเนียริ่ง จำกัด
        </div>

        {/* Links */}
        <div>
          <Label className="text-sm font-medium text-gray-900 dark:text-white mb-2 block">
            Links
          </Label>
          
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm">🌐</span>
              <div className="relative flex-1">
                <select 
                  className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none shadow-sm text-sm"
                  style={{ WebkitAppearance: 'none', MozAppearance: 'none', appearance: 'none' }}
                >
                  <option value="">Select a domain</option>
                  <option value="website">Website</option>
                  <option value="portfolio">Portfolio</option>
                </select>
                <span className="pointer-events-none absolute top-1/2 right-3 transform -translate-y-1/2 text-gray-400 dark:text-gray-300">
                  ▼
                </span>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-sm">💼</span>
              <span className="text-sm text-gray-900 dark:text-white">LinkedIn</span>
              <Button variant="outline" size="sm" className="ml-auto">
                Add
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
