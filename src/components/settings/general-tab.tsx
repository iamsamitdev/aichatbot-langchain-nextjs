"use client"

import { Label } from "@/components/ui/label"
import { useState } from "react"
import { useTheme } from "@/lib/theme-provider"

export function GeneralTab() {
  const { theme, setTheme } = useTheme()
  const [accentColor, setAccentColor] = useState("Blue")
  const [language, setLanguage] = useState("Auto-detect")
  const [spokenLanguage, setSpokenLanguage] = useState("Auto-detect")
  const [voice, setVoice] = useState("Ember")
  const [showAdditionalModels, setShowAdditionalModels] = useState(true)
  const [showFollowUpSuggestions, setShowFollowUpSuggestions] = useState(true)

  const themeOptions = [
    { value: "light", label: "Light" },
    { value: "dark", label: "Dark" },
    { value: "system", label: "Auto" },
  ]

  return (
    <div className="space-y-6">
      {/* Theme */}
      <div>
        <Label className="text-sm font-medium text-gray-900 dark:text-white mb-2 block">
          Theme
        </Label>
        <div className="relative">
           <select 
            value={theme}
            onChange={(e) => setTheme(e.target.value as "light" | "dark" | "system")}
            className="w-full px-3 py-2.5 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none shadow-sm text-sm"
            style={{ WebkitAppearance: 'none', MozAppearance: 'none', appearance: 'none' }}
          >
            {themeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute top-1/2 right-3 transform -translate-y-1/2 text-gray-400 dark:text-gray-300">
            ▼
          </span>
        </div>
      </div>

      {/* Accent Color */}
      <div>
        <Label className="text-sm font-medium text-gray-900 dark:text-white mb-2 block">
          Accent color
        </Label>
        <div className="relative">
          <select 
            value={accentColor}
            onChange={(e) => setAccentColor(e.target.value)}
            className="w-full px-3 py-2.5 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none shadow-sm text-sm"
            style={{ WebkitAppearance: 'none', MozAppearance: 'none', appearance: 'none' }}
          >
            <option value="Blue">🔵 Blue</option>
            <option value="Green">🟢 Green</option>
            <option value="Purple">🟣 Purple</option>
            <option value="Red">🔴 Red</option>
          </select>
          <span className="pointer-events-none absolute top-1/2 right-3 transform -translate-y-1/2 text-gray-400 dark:text-gray-300">
            ▼
          </span>
        </div>
      </div>

      {/* Language */}
      <div>
        <Label className="text-sm font-medium text-gray-900 dark:text-white mb-2 block">
          Language
        </Label>
        <div className="relative">
          <select 
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="w-full px-3 py-2.5 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none shadow-sm text-sm"
            style={{ WebkitAppearance: 'none', MozAppearance: 'none', appearance: 'none' }}
          >
            <option value="Auto-detect">Auto-detect</option>
            <option value="English">English</option>
            <option value="Thai">Thai</option>
            <option value="Japanese">Japanese</option>
          </select>
          <span className="pointer-events-none absolute top-1/2 right-3 transform -translate-y-1/2 text-gray-400 dark:text-gray-300">
            ▼
          </span>
        </div>
      </div>

      {/* Spoken Language */}
      <div>
        <Label className="text-sm font-medium text-gray-900 dark:text-white mb-2 block">
          Spoken language
        </Label>
        <div className="relative">
          <select 
            value={spokenLanguage}
            onChange={(e) => setSpokenLanguage(e.target.value)}
            className="w-full px-3 py-2.5 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none shadow-sm text-sm"
            style={{ WebkitAppearance: 'none', MozAppearance: 'none', appearance: 'none' }}
          >
            <option value="Auto-detect">Auto-detect</option>
            <option value="English">English</option>
            <option value="Thai">Thai</option>
          </select>
          <span className="pointer-events-none absolute top-1/2 right-3 transform -translate-y-1/2 text-gray-400 dark:text-gray-300">
            ▼
          </span>
        </div>
        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
          For best results, select the language you mainly speak. If it&apos;s not listed, 
          it may still be supported via auto-detection.
        </p>
      </div>

      {/* Voice */}
      <div>
        <Label className="text-sm font-medium text-gray-900 dark:text-white mb-2 block">
          Voice
        </Label>
        <div className="flex items-center gap-3">
          <button className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm">
            ▶ Play
          </button>
          <div className="relative flex-1">
            <select 
              value={voice}
              onChange={(e) => setVoice(e.target.value)}
              className="w-full px-3 py-2.5 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none shadow-sm text-sm"
              style={{ WebkitAppearance: 'none', MozAppearance: 'none', appearance: 'none' }}
            >
              <option value="Juniper">Juniper</option>
              <option value="Spruce">Spruce</option>
              <option value="Ember">Ember</option>
              <option value="Vale">Vale</option>
              <option value="Arbor">Arbor</option>
              <option value="Maple">Maple</option>
              <option value="Breeze">Breeze</option>
              <option value="Cove">Cove</option>
              <option value="Sol">Sol</option>
            </select>
            <span className="pointer-events-none absolute top-1/2 right-3 transform -translate-y-1/2 text-gray-400 dark:text-gray-300">
              ▼
            </span>
          </div>
        </div>
      </div>

      {/* Toggles */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium text-gray-900 dark:text-white">
            Show additional models
          </Label>
          <button
            onClick={() => setShowAdditionalModels(!showAdditionalModels)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              showAdditionalModels ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                showAdditionalModels ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium text-gray-900 dark:text-white">
            Show follow up suggestions in chats
          </Label>
          <button
            onClick={() => setShowFollowUpSuggestions(!showFollowUpSuggestions)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              showFollowUpSuggestions ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                showFollowUpSuggestions ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  )
}
