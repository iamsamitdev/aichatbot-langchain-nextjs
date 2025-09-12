"use client"

import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"

const connectors = [
  {
    name: "GitHub",
    description: "Deep research, Agent mode",
    icon: "🐙",
    enabled: true,
    hasSettings: false
  },
  {
    name: "Google Drive", 
    description: "Chat, Deep research, Agent mode, File uploads",
    icon: "📁",
    enabled: false,
    hasSettings: true,
    settingsText: "Add chat, deep research"
  }
]

const availableConnectors = [
  { name: "Box", icon: "📦" },
  { name: "Canva", icon: "🎨" },
  { name: "Dropbox", icon: "📁" },
  { name: "Gmail", icon: "✉️" },
  { name: "Google Calendar", icon: "📅" },
  { name: "Google Contacts", icon: "👥" },
  { name: "HubSpot", icon: "🔶" },
  { name: "Linear", icon: "📐" },
  { name: "Notion", icon: "📝" },
  { name: "Microsoft Outlook", icon: "📧" },
  { name: "Microsoft Teams", icon: "💬" },
  { name: "Codeium", icon: "💻" }
]

export function ConnectorsTab() {
  return (
    <div className="space-y-6">
      {/* Enabled connectors */}
      <div>
        <Label className="text-sm font-medium text-gray-900 dark:text-white mb-4 block">
          Enabled connectors
        </Label>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Genius AI can access information from connected apps. Your permissions are always respected.{" "}
          <button className="text-blue-600 hover:text-blue-700 underline">
            Learn more
          </button>
        </p>

        <div className="space-y-3">
          {connectors.map((connector) => (
            <div key={connector.name} className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
              <div className="flex items-center gap-3">
                <span className="text-lg">{connector.icon}</span>
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    {connector.name}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    {connector.description}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {connector.hasSettings && (
                  <Button variant="outline" size="sm">
                    {connector.settingsText}
                  </Button>
                )}
                <Button variant="ghost" size="sm">
                  ▶
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Browse connectors */}
      <div>
        <Label className="text-sm font-medium text-gray-900 dark:text-white mb-4 block">
          Browse connectors
        </Label>
        
        <div className="grid grid-cols-3 gap-3">
          {availableConnectors.map((connector) => (
            <button
              key={connector.name}
              className="flex flex-col items-center justify-center p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <span className="text-2xl mb-2">{connector.icon}</span>
              <span className="text-xs text-gray-900 dark:text-white text-center">
                {connector.name}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
