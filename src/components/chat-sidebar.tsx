"use client"

import { Button } from "@/components/ui/button"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { 
  PlusIcon, 
  Search, 
  Settings, 
  User, 
  X, 
  Bell,
  Palette,
  Plug,
  Calendar,
  Database,
  Shield,
  UserCircle
} from "lucide-react"
import { LogoutButton } from "@/components/logout-button"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useState, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { useChatContext } from "@/contexts/chat-context"
import {
  GeneralTab,
  NotificationsTab,
  PersonalizationTab,
  ConnectorsTab,
  SchedulesTab,
  DataControlsTab,
  SecurityTab,
  AccountTab
} from "@/components/settings"

// Initial conversation history
const conversationHistory = [
  {
    period: "Today",
    conversations: [
      {
        id: "t1",
        title: "Project roadmap discussion",
        lastMessage:
          "Let's prioritize the authentication features for the next sprint.",
        timestamp: new Date().setHours(new Date().getHours() - 2),
        href: "/chat/project-roadmap-discussion",
      },
      {
        id: "t2",
        title: "API Documentation Review",
        lastMessage:
          "The endpoint descriptions need more detail about rate limiting.",
        timestamp: new Date().setHours(new Date().getHours() - 5),
        href: "/chat/api-documentation-review",
      },
      {
        id: "t3",
        title: "Frontend Bug Analysis",
        lastMessage:
          "I found the issue - we need to handle the null state in the user profile component.",
        timestamp: new Date().setHours(new Date().getHours() - 8),
        href: "/chat/frontend-bug-analysis",
      },
    ],
  },
  {
    period: "Yesterday",
    conversations: [
      {
        id: "y1",
        title: "Database Schema Design",
        lastMessage:
          "Let's add indexes to improve query performance on these tables.",
        timestamp: new Date().setDate(new Date().getDate() - 1),
        href: "/chat/database-schema-design",
      },
      {
        id: "y2",
        title: "Performance Optimization",
        lastMessage:
          "The lazy loading implementation reduced initial load time by 40%.",
        timestamp: new Date().setDate(new Date().getDate() - 1),
        href: "/chat/performance-optimization",
      },
    ],
  },
  {
    period: "Last 7 days",
    conversations: [
      {
        id: "w1",
        title: "Authentication Flow",
        lastMessage: "We should implement the OAuth2 flow with refresh tokens.",
        timestamp: new Date().setDate(new Date().getDate() - 3),
        href: "/chat/authentication-flow",
      },
      {
        id: "w2",
        title: "Component Library",
        lastMessage:
          "These new UI components follow the design system guidelines perfectly.",
        timestamp: new Date().setDate(new Date().getDate() - 5),
        href: "/chat/component-library",
      },
    ],
  },
  {
    period: "Last month",
    conversations: [
      {
        id: "m1",
        title: "Initial Project Setup",
        lastMessage:
          "All the development environments are now configured consistently.",
        timestamp: new Date().setDate(new Date().getDate() - 15),
        href: "/chat/initial-project-setup",
      },
    ],
  },
]

interface ChatSidebarProps {
  display_name: string
  email: string
}

// Settings Dialog Component
function SettingsDialog({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState("general")
  const [mounted, setMounted] = useState(false)
  const tabsContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Handle horizontal scroll for mobile tabs using native event listener
  useEffect(() => {
    const container = tabsContainerRef.current
    if (!container || !mounted) return

    const handleWheel = (e: WheelEvent) => {
      if (e.deltaY !== 0) {
        e.preventDefault()
        container.scrollLeft += e.deltaY > 0 ? 50 : -50
      }
    }

    // Add non-passive event listener
    container.addEventListener('wheel', handleWheel, { passive: false })

    return () => {
      container.removeEventListener('wheel', handleWheel)
    }
  }, [mounted])

  // Handle tab selection and scrolling
  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId)
    
    // Ensure the clicked tab is visible in the scroll container
    setTimeout(() => {
      if (tabsContainerRef.current) {
        const activeButton = tabsContainerRef.current.querySelector(`[data-tab-id="${tabId}"]`) as HTMLElement
        if (activeButton) {
          activeButton.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
        }
      }
    }, 50)
  }

  if (!isOpen || !mounted) return null

  const tabs = [
    { id: "general", label: "General", icon: Settings },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "personalization", label: "Personalization", icon: Palette },
    { id: "connectors", label: "Connectors", icon: Plug },
    { id: "schedules", label: "Schedules", icon: Calendar },
    { id: "data-controls", label: "Data controls", icon: Database },
    { id: "security", label: "Security", icon: Shield },
    { id: "account", label: "Account", icon: UserCircle },
  ]

  const renderTabContent = () => {
    switch (activeTab) {
      case "general":
        return <GeneralTab />
      case "notifications":
        return <NotificationsTab />
      case "personalization":
        return <PersonalizationTab />
      case "connectors":
        return <ConnectorsTab />
      case "schedules":
        return <SchedulesTab />
      case "data-controls":
        return <DataControlsTab />
      case "security":
        return <SecurityTab />
      case "account":
        return <AccountTab />
      default:
        return <GeneralTab />
    }
  }

  const dialogContent = (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 z-50" 
        onClick={onClose}
      />
      {/* Dialog */}
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none">
        <div className="relative bg-white dark:bg-gray-900 rounded-lg shadow-2xl w-full max-w-4xl h-[80vh] sm:h-[80vh] overflow-hidden border border-gray-200 dark:border-gray-700 pointer-events-auto">
          <div className="flex h-full min-h-0 flex-col sm:flex-row mobile-dialog-layout">
            {/* Mobile Tab Navigation */}
            <div 
              ref={tabsContainerRef}
              className="flex sm:hidden mobile-tabs-scroll bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-2 py-2"
            >
              <div className="flex gap-1" style={{ minWidth: 'max-content' }}>
                {tabs.map((tab) => {
                  const IconComponent = tab.icon
                  return (
                    <button
                      key={tab.id}
                      data-tab-id={tab.id}
                      onClick={() => handleTabClick(tab.id)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-xs whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
                        activeTab === tab.id
                          ? 'bg-gray-400 dark:bg-gray-700 text-white font-medium'
                          : 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                      }`}
                      role="tab"
                      tabIndex={0}
                    >
                      <IconComponent className="h-3 w-3" />
                      {tab.label}
                    </button>
                  )
                })}
              </div>
            </div>
            
            {/* Desktop Sidebar */}
            <div className="hidden sm:block w-64 bg-gray-50 dark:bg-gray-800 p-4 border-r border-gray-200 dark:border-gray-700">
              <div className="space-y-1">
                {tabs.map((tab) => {
                  const IconComponent = tab.icon
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm ${
                        activeTab === tab.id
                          ? 'bg-gray-400 dark:bg-gray-700 text-white font-medium'
                          : 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      <IconComponent className="h-4 w-4" />
                      {tab.label}
                    </button>
                  )
                })}
              </div>
            </div>
            
            {/* Main Content */}
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden sm:overflow-visible">
              {/* Header */}
              <div className="flex-shrink-0 flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white capitalize">
                  {tabs.find(tab => tab.id === activeTab)?.label || "General"}
                </h2>
                <button 
                  onClick={onClose}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                >
                  <X className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                </button>
              </div>
              {/* Settings Content */}
              <div className="flex-1 mobile-content-area sm:dialog-content-scroll sm:overflow-y-auto">
                <div className="p-4 sm:p-6">
                  {renderTabContent()}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )

  return mounted ? createPortal(dialogContent, document.body) : null
}

export function ChatSidebar({ display_name, email }: ChatSidebarProps) {
  const { state } = useSidebar()
  const pathname = usePathname()
  const router = useRouter()
  const { resetChat } = useChatContext()
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="flex flex-row items-center justify-between gap-2 px-2 py-4">
        <div className="flex flex-row items-center gap-2 px-2 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:justify-center">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
            <span className="text-white font-bold text-sm">AI</span>
          </div>
          <div className="text-md font-bold text-slate-900 dark:text-white tracking-tight group-data-[collapsible=icon]:hidden">
            Genius AI
          </div>
        </div>
        <div className="flex items-center gap-1 group-data-[collapsible=icon]:hidden">

          {/* Place button Theme toggle here */}

          <Button
            variant="ghost"
            className="size-8"
          >
            <Search className="size-4" />
          </Button>
        </div>
      </SidebarHeader>

      <SidebarContent className="pt-4">
        <div className="px-4 group-data-[collapsible=icon]:px-2">
          <Button
            variant="outline"
            className="mb-4 flex w-full items-center gap-2 group-data-[collapsible=icon]:size-8 cursor-pointer group-data-[collapsible=icon]:p-0"
            title={state === "collapsed" ? "New Chat" : undefined}
            onClick={() => {
              // Reset chat state and navigate to /chat
              resetChat()
              router.push("/chat")
            }}
          >
            <PlusIcon className="size-4" />
            <span className="group-data-[collapsible=icon]:hidden cursor-pointer">
              New Chat
            </span>
          </Button>
        </div>

        {conversationHistory.map((group) => (
          <SidebarGroup
            key={group.period}
            className="group-data-[collapsible=icon]:hidden"
          >
            <SidebarGroupLabel>{group.period}</SidebarGroupLabel>
            <SidebarMenu>
              {group.conversations.map((conversation) => (
                <Link key={conversation.id} href={conversation.href}>
                  <SidebarMenuButton
                    isActive={pathname === conversation.href}
                    tooltip={
                      state === "collapsed" ? conversation.title : undefined
                    }
                    className="cursor-pointer"
                  >
                    <span className="group-data-[collapsible=icon]:hidden">
                      {conversation.title}
                    </span>
                  </SidebarMenuButton>
                </Link>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>

      {/* User Profile Footer */}
      <SidebarFooter className="p-4 border-t border-slate-200 dark:border-slate-700 group-data-[collapsible=icon]:p-2">
        <Popover>
          <PopoverTrigger asChild>
            <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-1data-[state=open]:bg-slate-100 dark:data-[state=open]:bg-slate-800">
              <div className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:w-8">
                <span className="text-white font-semibold text-sm group-data-[collapsible=icon]:text-xs">
                  {display_name
                    ? display_name.charAt(0).toUpperCase()
                    : email.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                  {display_name || email.split("@")[0]}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {email}
                </p>
              </div>
            </div>
          </PopoverTrigger>
          <PopoverContent side="top" align="start" className="w-80 p-0">
            <div className="space-y-0">
              {/* User Info */}
              <div className="flex items-center gap-3 p-4 border-b border-slate-200 dark:border-slate-700">
                <div className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                  <span className="text-white font-semibold text-sm">
                    {display_name
                      ? display_name.charAt(0).toUpperCase()
                      : email.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                    {display_name || email.split("@")[0]}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {email}
                  </p>
                </div>
              </div>

              {/* Menu Items */}
              <div className="p-2 space-y-1">
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-3 h-10 text-left px-3"
                >
                  <User className="h-4 w-4" />
                  Upgrade plan
                </Button>

                <Button
                  variant="ghost"
                  className="w-full justify-start gap-3 h-10 text-left px-3"
                >
                  <Settings className="h-4 w-4" />
                  Customize Genius AI
                </Button>

                <Button
                  variant="ghost"
                  className="w-full justify-start gap-3 h-10 text-left px-3"
                  onClick={() => setIsSettingsOpen(true)}
                >
                  <Settings className="h-4 w-4" />
                  Settings
                </Button>

                <hr className="my-2 border-slate-200 dark:border-slate-700" />

                <div className="px-1">
                  <LogoutButton />
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </SidebarFooter>

      {/* Settings Dialog */}
      <SettingsDialog 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
      />
    </Sidebar>
  )
}