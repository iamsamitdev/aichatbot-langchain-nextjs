/**
 * ===============================================
 * Chat Sidebar Component - แถบด้านข้างสำหรับการนำทาง
 * ===============================================
 * 
 * Purpose: แถบด้านข้างสำหรับนำทางและจัดการประวัติการสนทนา
 * 
 * Features:
 * - แสดงรายการประวัติการสนทนาจัดกลุ่มตามวันที่
 * - สร้างการสนทนาใหม่
 * - ลบประวัติการสนทนา
 * - เปิด/ปิด sidebar (collapsible)
 * - การตั้งค่าผู้ใช้และแอปพลิเคชัน
 * - User profile และ logout
 * - Theme toggle (สลับธีม)
 * - Responsive design สำหรับ mobile/desktop
 * 
 * Components:
 * - SettingsDialog: dialog สำหรับการตั้งค่าต่างๆ
 * - ChatSidebar: sidebar หลัก
 * 
 * Data Management:
 * - useChatSessions hook สำหรับจัดการข้อมูล sessions
 * - useChatContext สำหรับ state management
 * 
 * Authentication: ต้องมี userId เพื่อเข้าถึงข้อมูล
 * Navigation: ใช้ Next.js router สำหรับการนำทาง
 */

"use client"

// ============================================================================
// IMPORTS - การนำเข้า Components และ Libraries ที่จำเป็น
// ============================================================================
import { Button } from "@/components/ui/button"                             // Component ปุ่มพื้นฐาน
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
} from "@/components/ui/sidebar"                                             // Sidebar components และ hooks
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"                                             // Popover สำหรับ user menu
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"                                        // Alert dialog สำหรับยืนยันการลบ
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
  UserCircle,
  Trash2
} from "lucide-react"                                                        // Icons จาก Lucide React
import { LogoutButton } from "@/components/logout-button"                   // Component สำหรับ logout
import Link from "next/link"                                                 // Next.js Link สำหรับ navigation
import { usePathname, useRouter } from "next/navigation"                     // Next.js hooks สำหรับ routing
import { useState, useEffect, useRef } from "react"                          // React hooks
import { createPortal } from "react-dom"                                     // Portal สำหรับ modal rendering
import { useChatContext } from "@/contexts/chat-context"                     // Context สำหรับ chat state
import { useChatSessions } from "@/hooks/use-chat-sessions"                  // Custom hook สำหรับ chat sessions
import { groupSessionsByDate } from "@/lib/utils"                            // Utility สำหรับจัดกลุ่มตามวันที่
import {
  GeneralTab,
  NotificationsTab,
  PersonalizationTab,
  ConnectorsTab,
  SchedulesTab,
  DataControlsTab,
  SecurityTab,
  AccountTab
} from "@/components/settings"                                               // Settings tab components
import { ThemeToggle } from "@/components/ui/theme-toggle"                   // Theme toggle component

// ============================================================================
// TypeScript Interface Definitions - กำหนด Type Definitions
// ============================================================================

/**
 * Interface สำหรับ Props ของ ChatSidebar component
 * 
 * Structure:
 * - display_name: string - ชื่อแสดงผลของผู้ใช้
 * - email: string - อีเมลของผู้ใช้
 * - userId: string (optional) - ID ของผู้ใช้สำหรับ authentication
 */
interface ChatSidebarProps {
  display_name: string                                                       // ชื่อแสดงผลของผู้ใช้
  email: string                                                              // อีเมลของผู้ใช้
  userId?: string                                                            // ID ของผู้ใช้ (optional สำหรับ authentication)
}

// ============================================================================
// SETTINGS DIALOG COMPONENT - Component สำหรับ Settings Dialog
// ============================================================================

/**
 * SettingsDialog Component: Dialog สำหรับการตั้งค่าแอปพลิเคชัน
 * 
 * Purpose:
 * - แสดง settings ในรูปแบบ modal dialog
 * - รองรับ multiple tabs สำหรับหมวดหมู่ต่างๆ
 * - Responsive design สำหรับ mobile/desktop
 * - Portal rendering เพื่อแสดงนอก DOM tree
 * 
 * Features:
 * - Tab navigation สำหรับหมวดหมู่ settings
 * - Horizontal scroll สำหรับ mobile tabs
 * - Backdrop click เพื่อปิด dialog
 * - Keyboard navigation support
 * 
 * @param isOpen - สถานะการเปิด/ปิด dialog
 * @param onClose - callback เมื่อปิด dialog
 * @returns JSX Element หรือ null
 */
function SettingsDialog({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  // ============================================================================
  // STEP 1: STATE DECLARATIONS - การประกาศตัวแปร State
  // ============================================================================
  
  /**
   * สถานะของ Settings Dialog
   * 
   * Variables:
   * - activeTab: tab ที่เลือกในปัจจุบัน
   * - mounted: สถานะการ mount ของ component
   * - tabsContainerRef: reference สำหรับ tabs container
   */
  const [activeTab, setActiveTab] = useState("general")                      // tab ที่เลือกในปัจจุบัน (เริ่มต้นที่ "general")
  const [mounted, setMounted] = useState(false)                             // สถานะการ mount ของ component
  const tabsContainerRef = useRef<HTMLDivElement>(null)                     // ref สำหรับ tabs container (สำหรับ scroll)

  // ============================================================================
  // STEP 2: EFFECTS - การจัดการ Side Effects
  // ============================================================================

  /**
   * Effect สำหรับตั้งค่า mounted state
   * 
   * Purpose:
   * - ป้องกัน hydration mismatch ใน SSR
   * - ให้แน่ใจว่า component mount เสร็จแล้วก่อนแสดงผล
   */
  useEffect(() => {
    setMounted(true)                                                         // ตั้งค่า mounted เป็น true เมื่อ component mount
  }, [])

  /**
   * Effect สำหรับจัดการ horizontal scroll ใน mobile tabs
   * 
   * Purpose:
   * - รองรับการ scroll ด้วย mouse wheel ใน tabs container
   * - ปรับปรุง UX สำหรับ mobile devices
   * - ใช้ native event listener สำหรับควบคุมที่ดีกว่า
   * 
   * Dependencies: [mounted]
   */
  useEffect(() => {
    const container = tabsContainerRef.current
    if (!container || !mounted) return

    /**
     * Handler สำหรับ wheel event
     * 
     * Purpose:
     * - แปลง vertical scroll เป็น horizontal scroll
     * - ป้องกัน default behavior ของ wheel event
     * 
     * @param e - WheelEvent object
     */
    const handleWheel = (e: WheelEvent) => {
      if (e.deltaY !== 0) {
        e.preventDefault()                                                   // ป้องกัน default scroll behavior
        container.scrollLeft += e.deltaY > 0 ? 50 : -50                     // scroll ไปซ้าย/ขวา 50px
      }
    }

    // เพิ่ม event listener แบบ non-passive
    container.addEventListener('wheel', handleWheel, { passive: false })

    /**
     * Cleanup function
     * ลบ event listener เมื่อ component unmount
     */
    return () => {
      container.removeEventListener('wheel', handleWheel)
    }
  }, [mounted])

  // ============================================================================
  // STEP 3: EVENT HANDLER FUNCTIONS - ฟังก์ชันจัดการ Events
  // ============================================================================

  /**
   * ฟังก์ชันสำหรับจัดการการเลือก tab และ scrolling
   * 
   * Purpose:
   * - เปลี่ยน active tab
   * - scroll ให้ tab ที่เลือกอยู่ในมุมมองที่เห็นได้
   * - ปรับปรุง UX สำหรับ mobile navigation
   * 
   * Process:
   * 1. ตั้งค่า active tab
   * 2. รอให้ DOM update
   * 3. scroll ไปยัง tab ที่เลือก
   * 
   * @param tabId - ID ของ tab ที่ต้องการเลือก
   */
  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId)                                                      // ตั้งค่า active tab
    
    // ให้แน่ใจว่า tab ที่คลิกจะอยู่ในมุมมองที่เห็นได้
    setTimeout(() => {
      if (tabsContainerRef.current) {
        // หา button element ของ tab ที่เลือก
        const activeButton = tabsContainerRef.current.querySelector(`[data-tab-id="${tabId}"]`) as HTMLElement
        if (activeButton) {
          // scroll ไปยัง tab ที่เลือกด้วย smooth animation
          activeButton.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'nearest', 
            inline: 'center' 
          })
        }
      }
    }, 50)                                                                   // รอ 50ms ให้ DOM update
  }

  // ============================================================================
  // STEP 4: RENDER GUARD - การตรวจสอบสถานะก่อนแสดงผล
  // ============================================================================

  /**
   * ตรวจสอบสถานะก่อนแสดงผล dialog
   * 
   * Conditions:
   * - ไม่แสดงถ้า isOpen = false
   * - ไม่แสดงถ้า component ยังไม่ mount (ป้องกัน SSR issues)
   */
  if (!isOpen || !mounted) return null

  // ============================================================================
  // STEP 5: TABS CONFIGURATION - การกำหนดค่า Tabs
  // ============================================================================

  /**
   * การกำหนดค่า tabs สำหรับ Settings Dialog
   * 
   * Structure:
   * - id: unique identifier สำหรับ tab
   * - label: ข้อความแสดงผล
   * - icon: component icon จาก Lucide React
   */
  const tabs = [
    { id: "general", label: "General", icon: Settings },                     // การตั้งค่าทั่วไป
    { id: "notifications", label: "Notifications", icon: Bell },             // การแจ้งเตือน
    { id: "personalization", label: "Personalization", icon: Palette },      // การปรับแต่งส่วนบุคคล
    { id: "connectors", label: "Connectors", icon: Plug },                   // การเชื่อมต่อ
    { id: "schedules", label: "Schedules", icon: Calendar },                 // ตารางเวลา
    { id: "data-controls", label: "Data controls", icon: Database },         // การควบคุมข้อมูล
    { id: "security", label: "Security", icon: Shield },                     // ความปลอดภัย
    { id: "account", label: "Account", icon: UserCircle },                   // บัญชีผู้ใช้
  ]

  // ============================================================================
  // STEP 6: TAB CONTENT RENDERER - ฟังก์ชันแสดงเนื้อหา Tab
  // ============================================================================

  /**
   * ฟังก์ชันสำหรับแสดงเนื้อหาของ tab ที่เลือก
   * 
   * Purpose:
   * - แสดง component ที่เหมาะสมตาม active tab
   * - จัดการ routing ภายใน settings dialog
   * 
   * @returns JSX Element ของ tab content
   */
  const renderTabContent = () => {
    switch (activeTab) {
      case "general":
        return <GeneralTab />                                                // แสดง General settings
      case "notifications":
        return <NotificationsTab />                                          // แสดง Notifications settings
      case "personalization":
        return <PersonalizationTab />                                        // แสดง Personalization settings
      case "connectors":
        return <ConnectorsTab />                                             // แสดง Connectors settings
      case "schedules":
        return <SchedulesTab />                                              // แสดง Schedules settings
      case "data-controls":
        return <DataControlsTab />                                           // แสดง Data controls settings
      case "security":
        return <SecurityTab />                                               // แสดง Security settings
      case "account":
        return <AccountTab />                                                // แสดง Account settings
      default:
        return <GeneralTab />                                                // แสดง General เป็นค่าเริ่มต้น
    }
  }

  // ============================================================================
  // STEP 7: DIALOG CONTENT STRUCTURE - โครงสร้างเนื้อหา Dialog
  // ============================================================================

  /**
   * โครงสร้างเนื้อหาของ Settings Dialog
   * 
   * Structure:
   * 1. Backdrop - พื้นหลังสำหรับปิด dialog
   * 2. Dialog Container - container หลักของ dialog
   * 3. Mobile/Desktop Tab Navigation
   * 4. Main Content Area
   * 
   * Features:
   * - Responsive layout (mobile/desktop)
   * - Portal rendering
   * - Backdrop click เพื่อปิด
   * - Keyboard navigation
   */
  const dialogContent = (
    <>
      {/* ============================================================================ */}
      {/* BACKDROP - พื้นหลังสำหรับปิด Dialog */}
      {/* ============================================================================ */}
      
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 z-50"                          
        onClick={onClose}                                                    // คลิก backdrop เพื่อปิด dialog
      />
      
      {/* ============================================================================ */}
      {/* DIALOG CONTAINER - Container หลักของ Dialog */}
      {/* ============================================================================ */}
      
      {/* Dialog */}
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none">
        <div className="relative bg-white dark:bg-gray-900 rounded-lg shadow-2xl w-full max-w-4xl h-[80vh] sm:h-[80vh] overflow-hidden border border-gray-200 dark:border-gray-700 pointer-events-auto">
          <div className="flex h-full min-h-0 flex-col sm:flex-row mobile-dialog-layout">
            
            {/* ============================================================================ */}
            {/* MOBILE TAB NAVIGATION - แถบ Tab สำหรับ Mobile */}
            {/* ============================================================================ */}
            
            {/* Mobile Tab Navigation */}
            <div 
              ref={tabsContainerRef}                                         // ref สำหรับ scroll handling
              className="flex sm:hidden mobile-tabs-scroll bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-2 py-2"
            >
              <div className="flex gap-1" style={{ minWidth: 'max-content' }}>
                {tabs.map((tab) => {
                  const IconComponent = tab.icon                             // ดึง icon component
                  return (
                    <button
                      key={tab.id}
                      data-tab-id={tab.id}                                  // attribute สำหรับ scroll targeting
                      onClick={() => handleTabClick(tab.id)}               // เรียกฟังก์ชันเลือก tab
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-xs whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
                        activeTab === tab.id
                          ? 'bg-gray-400 dark:bg-gray-700 text-white font-medium'  // style สำหรับ active tab
                          : 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'  // style สำหรับ inactive tab
                      }`}
                      role="tab"                                             // accessibility role
                      tabIndex={0}                                           // keyboard navigation
                    >
                      <IconComponent className="h-3 w-3" />                 {/* แสดง icon */}
                      {tab.label}                                            {/* แสดงข้อความ */}
                    </button>
                  )
                })}
              </div>
            </div>
            
            {/* ============================================================================ */}
            {/* DESKTOP SIDEBAR - แถบด้านข้างสำหรับ Desktop */}
            {/* ============================================================================ */}
            
            {/* Desktop Sidebar */}
            <div className="hidden sm:block w-64 bg-gray-50 dark:bg-gray-800 p-4 border-r border-gray-200 dark:border-gray-700">
              <div className="space-y-1">
                {tabs.map((tab) => {
                  const IconComponent = tab.icon                             // ดึง icon component
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}                   // เลือก tab (desktop ไม่ต้องใช้ scroll)
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm ${
                        activeTab === tab.id
                          ? 'bg-gray-400 dark:bg-gray-700 text-white font-medium'  // style สำหรับ active tab
                          : 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'  // style สำหรับ inactive tab
                      }`}
                    >
                      <IconComponent className="h-4 w-4" />                 {/* แสดง icon */}
                      {tab.label}                                            {/* แสดงข้อความ */}
                    </button>
                  )
                })}
              </div>
            </div>
            
            {/* ============================================================================ */}
            {/* MAIN CONTENT AREA - พื้นที่เนื้อหาหลัก */}
            {/* ============================================================================ */}
            
            {/* Main Content */}
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden sm:overflow-visible">
              
              {/* ============================================================================ */}
              {/* HEADER - ส่วนหัวของ Content Area */}
              {/* ============================================================================ */}
              
              {/* Header */}
              <div className="flex-shrink-0 flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
                {/* Title - แสดงชื่อ tab ปัจจุบัน */}
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white capitalize">
                  {tabs.find(tab => tab.id === activeTab)?.label || "General"}  {/* หาชื่อ tab จาก ID */}
                </h2>
                
                {/* Close Button - ปุ่มปิด dialog */}
                <button 
                  onClick={onClose}                                          // ปิด dialog
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                >
                  <X className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                </button>
              </div>
              
              {/* ============================================================================ */}
              {/* SETTINGS CONTENT - เนื้อหา Settings */}
              {/* ============================================================================ */}
              
              {/* Settings Content */}
              <div className="flex-1 mobile-content-area sm:dialog-content-scroll sm:overflow-y-auto">
                <div className="p-4 sm:p-6">
                  {renderTabContent()}                                      {/* แสดงเนื้อหาตาม active tab */}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )

  // ============================================================================
  // STEP 8: PORTAL RENDERING - การแสดงผลผ่าน Portal
  // ============================================================================

  /**
   * แสดงผล dialog ผ่าน createPortal
   * 
   * Purpose:
   * - แสดง dialog นอก DOM tree ของ component
   * - ป้องกัน z-index และ overflow issues
   * - รองรับ SSR โดยตรวจสอบ mounted state
   * 
   * Conditions:
   * - แสดงเฉพาะเมื่อ mounted = true
   * - ใช้ document.body เป็น target
   */
  return mounted ? createPortal(dialogContent, document.body) : null
}

// ============================================================================
// MAIN CHAT SIDEBAR COMPONENT - Component หลักของ Chat Sidebar
// ============================================================================

/**
 * ChatSidebar Component: แถบด้านข้างสำหรับการนำทางและจัดการประวัติการสนทนา
 * 
 * Purpose:
 * - แสดงรายการประวัติการสนทนาจัดกลุ่มตามวันที่
 * - สร้างการสนทนาใหม่
 * - ลบประวัติการสนทนา
 * - จัดการ user profile และ settings
 * - รองรับ responsive design
 * 
 * Features:
 * - Collapsible sidebar
 * - Chat sessions grouped by date
 * - Delete confirmation
 * - Settings dialog
 * - User profile popover
 * - Theme toggle
 * 
 * @param display_name - ชื่อแสดงผลของผู้ใช้
 * @param email - อีเมลของผู้ใช้
 * @param userId - ID ของผู้ใช้สำหรับ authentication
 * @returns JSX Element
 */
export function ChatSidebar({ display_name, email, userId }: ChatSidebarProps) {
  
  // ============================================================================
  // STEP 1: HOOKS AND STATE DECLARATIONS - การประกาศ Hooks และ State
  // ============================================================================
  
  /**
   * React และ Next.js Hooks
   * 
   * Variables:
   * - state: สถานะของ sidebar (collapsed/expanded)
   * - pathname: path ปัจจุบันของ URL
   * - router: router object สำหรับ navigation
   * - resetChat: ฟังก์ชันรีเซ็ต chat state จาก context
   */
  const { state } = useSidebar()                                             // สถานะของ sidebar จาก UI component
  const pathname = usePathname()                                             // path ปัจจุบันของ URL
  const router = useRouter()                                                 // router สำหรับการนำทาง
  const { resetChat } = useChatContext()                                     // ฟังก์ชันรีเซ็ต chat จาก context
  
  /**
   * Local State Variables
   * 
   * Variables:
   * - isSettingsOpen: สถานะการเปิด/ปิด settings dialog
   * - deleteDialogOpen: สถานะการเปิด/ปิด delete confirmation dialog
   * - sessionToDelete: ID ของ session ที่จะลบ
   */
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)               // สถานะการเปิด/ปิด settings dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)           // สถานะการเปิด/ปิด delete confirmation dialog
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null) // ID ของ session ที่จะลบ
  
  /**
   * Custom Hook สำหรับจัดการ Chat Sessions
   * 
   * Returns:
   * - sessions: array ของ chat sessions
   * - loading: สถานะการโหลดข้อมูล
   * - fetchSessions: ฟังก์ชันดึงข้อมูล sessions
   * - deleteSession: ฟังก์ชันลบ session
   */
  const { sessions, loading, fetchSessions, deleteSession } = useChatSessions(userId)
  
  /**
   * จัดกลุ่ม sessions ตามวันที่
   * 
   * Purpose:
   * - จัดระเบียบการแสดงผลให้ดูง่าย
   * - กลุ่มตามช่วงเวลา (Today, Yesterday, Last 7 days, etc.)
   */
  const groupedSessions = groupSessionsByDate(sessions)                      // จัดกลุ่ม sessions ตามวันที่

  // ============================================================================
  // STEP 2: EFFECTS - การจัดการ Side Effects
  // ============================================================================

  /**
   * Effect สำหรับดึงข้อมูล sessions เมื่อ component mount หรือ userId เปลี่ยน
   * 
   * Purpose:
   * - โหลดรายการ chat sessions ของผู้ใช้
   * - รีเฟรชข้อมูลเมื่อมีการเปลี่ยน userId
   * - ป้องกันการเรียก API เมื่อไม่มี userId
   * 
   * Dependencies: [userId]
   * Note: ปิด eslint rule เพราะ fetchSessions มาจาก hook และไม่จำเป็นต้องใส่ใน dependency
   */
  useEffect(() => {
    if (userId) {
      fetchSessions()                                                        // ดึงข้อมูล sessions เฉพาะเมื่อมี userId
    }
  }, [userId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ============================================================================
  // STEP 3: EVENT HANDLER FUNCTIONS - ฟังก์ชันจัดการ Events
  // ============================================================================

  /**
   * ฟังก์ชันสำหรับจัดการปุ่ม New Chat
   * 
   * Purpose:
   * - รีเซ็ต chat state เพื่อเริ่มการสนทนาใหม่
   * - เคลียร์ sessionId จาก localStorage
   * - นำทางไปหน้า welcome screen
   * - จัดการ error handling
   * 
   * Process:
   * 1. ตรวจสอบ userId
   * 2. รีเซ็ต chat state
   * 3. เคลียร์ localStorage
   * 4. นำทางไปหน้า chat
   */
  const handleNewChat = async () => {
    if (!userId) return                                                      // ป้องกันการทำงานเมื่อไม่มี userId
    
    try {
      // รีเซ็ต chat state
      resetChat()                                                            // เรียกฟังก์ชันรีเซ็ตจาก context
      
      // เคลียร์ sessionId จาก localStorage
      localStorage.removeItem('currentSessionId')                           // ลบ session ID ที่เก็บไว้
      
      // ไปหน้า New Chat (Welcome screen) โดยไม่สร้าง session ใหม่ทันที
      router.push("/chat")                                                   // นำทางไปหน้า chat
      
    } catch (error) {
      console.error('Error navigating to new chat:', error)
      // ถ้ามีข้อผิดพลาด ไปหน้า chat ปกติ
      router.push("/chat")                                                   // fallback navigation
    }
  }

  /**
   * ฟังก์ชันสำหรับจัดการการลบ Session
   * 
   * Purpose:
   * - เปิด confirmation dialog สำหรับการลบ
   * - ป้องกัน navigation เมื่อคลิกปุ่มลบ
   * - ตั้งค่า session ที่จะลบ
   * 
   * Process:
   * 1. ป้องกัน event propagation
   * 2. ตรวจสอบ userId
   * 3. เก็บ sessionId ที่จะลบ
   * 4. เปิด confirmation dialog
   * 
   * @param sessionId - ID ของ session ที่จะลบ
   * @param e - React Mouse Event
   */
  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.preventDefault()                                                       // ป้องกันการนำทางไป Link
    e.stopPropagation()                                                      // ป้องกัน event bubbling
    
    if (!userId) return                                                      // ป้องกันการทำงานเมื่อไม่มี userId
    
    // เปิด Alert Dialog
    setSessionToDelete(sessionId)                                            // เก็บ ID ของ session ที่จะลบ
    setDeleteDialogOpen(true)                                                // เปิด confirmation dialog
  }

  /**
   * ฟังก์ชันสำหรับยืนยันการลบ Session
   * 
   * Purpose:
   * - ลบ session จาก database
   * - จัดการการนำทางถ้าลบ session ปัจจุบัน
   * - รีเฟรชรายการ sessions
   * - ปิด dialog และเคลียร์ state
   * 
   * Process:
   * 1. ตรวจสอบ sessionToDelete
   * 2. เรียก API ลบ session
   * 3. ตรวจสอบว่าเป็น session ปัจจุบันหรือไม่
   * 4. นำทางและรีเฟรชข้อมูล
   * 5. ปิด dialog
   */
  const confirmDeleteSession = async () => {
    if (!sessionToDelete) return                                             // ป้องกันการทำงานเมื่อไม่มี sessionToDelete
    
    try {
      const success = await deleteSession(sessionToDelete)                   // เรียก API ลบ session
      if (success) {
        // ถ้าเป็น session ปัจจุบันที่ถูกลบ ให้ไปหน้า new chat
        if (pathname === `/chat/${sessionToDelete}`) {
          resetChat()                                                        // รีเซ็ต chat state
          localStorage.removeItem('currentSessionId')                       // ลบจาก localStorage
          router.push("/chat")                                               // นำทางไปหน้า chat ใหม่
        }
        // รีเฟรช sessions list
        fetchSessions()                                                      // โหลดรายการ sessions ใหม่
      }
    } catch (error) {
      console.error('Error deleting session:', error)                       // แสดง error ใน console
    } finally {
      // ปิด dialog และเคลียร์ state
      setDeleteDialogOpen(false)                                             // ปิด confirmation dialog
      setSessionToDelete(null)                                               // เคลียร์ session ที่จะลบ
    }
  }

  // ============================================================================
  // STEP 4: MAIN RENDER - การแสดงผลหลัก
  // ============================================================================

  /**
   * Main render section - ส่วนแสดงผลหลักของ ChatSidebar
   * 
   * Structure:
   * 1. Sidebar Header - ส่วนหัวพร้อม logo และ controls
   * 2. Sidebar Content - เนื้อหาหลักและรายการ sessions
   * 3. Sidebar Footer - ส่วนท้ายพร้อม user profile
   * 4. Dialogs - Settings dialog และ delete confirmation
   */
  return (
    <Sidebar collapsible="icon">                                            {/* Sidebar component ที่ collapsible ได้ */}
      
      {/* ============================================================================ */}
      {/* SIDEBAR HEADER - ส่วนหัวของ Sidebar */}
      {/* ============================================================================ */}
      
      <SidebarHeader className="flex flex-row items-center justify-between gap-2 px-2 py-4">
        
        {/* Logo และ App Name */}
        <div className="flex flex-row items-center gap-2 px-2 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:justify-center">
          {/* AI Logo */}
          <div className="h-8 w-8 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
            <span className="text-white font-bold text-sm">AI</span>
          </div>
          
          {/* App Name - ซ่อนเมื่อ sidebar collapsed */}
          <div className="text-md font-bold text-slate-900 dark:text-white tracking-tight group-data-[collapsible=icon]:hidden">
            Genius AI
          </div>
        </div>
        
        {/* Control Buttons - ซ่อนเมื่อ sidebar collapsed */}
        <div className="flex items-center gap-1 group-data-[collapsible=icon]:hidden">

          {/* Theme Toggle Button - ปุ่มสลับธีม */}
          <ThemeToggle />

          {/* Search Button - ปุ่มค้นหา */}
          <Button
            variant="ghost"
            className="size-8"
          >
            <Search className="size-4" />
          </Button>
        </div>
      </SidebarHeader>

      {/* ============================================================================ */}
      {/* SIDEBAR CONTENT - เนื้อหาหลักของ Sidebar */}
      {/* ============================================================================ */}
      
      <SidebarContent className="pt-4">
        
        {/* ============================================================================ */}
        {/* NEW CHAT BUTTON - ปุ่มสร้างการสนทนาใหม่ */}
        {/* ============================================================================ */}
        
        <div className="px-4 group-data-[collapsible=icon]:px-2">
          <Button
            variant="outline"
            className="mb-4 flex w-full items-center gap-2 group-data-[collapsible=icon]:size-8 cursor-pointer group-data-[collapsible=icon]:p-0"
            title={state === "collapsed" ? "New Chat" : undefined}          // tooltip เมื่อ collapsed
            onClick={handleNewChat}                                          // เรียกฟังก์ชันสร้าง chat ใหม่
          >
            <PlusIcon className="size-4" />
            <span className="group-data-[collapsible=icon]:hidden cursor-pointer">
              New Chat
            </span>
          </Button>
        </div>

        {/* ============================================================================ */}
        {/* LOADING STATE - สถานะการโหลด */}
        {/* ============================================================================ */}
        
        {/* Loading state */}
        {loading && (
          <SidebarGroup className="group-data-[collapsible=icon]:hidden">
            <SidebarGroupLabel>Loading...</SidebarGroupLabel>
          </SidebarGroup>
        )}

        {/* ============================================================================ */}
        {/* CHAT SESSIONS LIST - รายการประวัติการสนทนา */}
        {/* ============================================================================ */}
        
        {/* Chat sessions grouped by date */}
        {!loading && groupedSessions.map((group) => (
          <SidebarGroup
            key={group.period}                                              // unique key สำหรับ group
            className="group-data-[collapsible=icon]:hidden"               // ซ่อนเมื่อ collapsed
          >
            <SidebarGroupLabel>{group.period}</SidebarGroupLabel>           {/* แสดงชื่อกลุ่ม เช่น "Today", "Yesterday" */}
            <SidebarMenu>
              {group.sessions.map((session) => (
                <div key={session.id} className="relative group/item">
                  {/* Session Link */}
                  <Link href={`/chat/${session.id}`}>
                    <SidebarMenuButton
                      isActive={pathname === `/chat/${session.id}`}
                      tooltip={
                        state === "collapsed" ? session.title : undefined
                      }
                      className="cursor-pointer pr-8"
                    >
                      <span className="group-data-[collapsible=icon]:hidden truncate">
                        {session.title}
                      </span>
                    </SidebarMenuButton>
                  </Link>
                  
                  {/* Delete Button - ปุ่มลบ session */}
                  <button
                    onClick={(e) => handleDeleteSession(session.id, e)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover/item:opacity-100 transition-opacity duration-200 p-1 hover:bg-red-100 dark:hover:bg-red-900/20 rounded text-red-500 hover:text-red-700 dark:hover:text-red-400"
                    title="ลบประวัติการแชท"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        ))}

        {/* ============================================================================ */}
        {/* EMPTY STATE - สถานะเมื่อไม่มีข้อมูล */}
        {/* ============================================================================ */}
        
        {/* Empty state */}
        {!loading && groupedSessions.length === 0 && (
          <SidebarGroup className="group-data-[collapsible=icon]:hidden">
            <div className="px-4 py-6 text-center text-gray-500 dark:text-gray-400 text-sm">
              No chat history yet.<br />
              Start a new conversation!
            </div>
          </SidebarGroup>
        )}
      </SidebarContent>

      {/* ============================================================================ */}
      {/* SIDEBAR FOOTER - ส่วนท้ายพร้อม User Profile */}
      {/* ============================================================================ */}
      
      {/* User Profile Footer */}
      <SidebarFooter className="p-4 border-t border-slate-200 dark:border-slate-700 group-data-[collapsible=icon]:p-2">
        <Popover>
          <PopoverTrigger asChild>
            
            {/* User Profile Button */}
            <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-1data-[state=open]:bg-slate-100 dark:data-[state=open]:bg-slate-800">
              
              {/* User Avatar */}
              <div className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:w-8">
                <span className="text-white font-semibold text-sm group-data-[collapsible=icon]:text-xs">
                  {/* แสดงตัวอักษรแรกของ display_name หรือ email */}
                  {display_name
                    ? display_name.charAt(0).toUpperCase()
                    : email.charAt(0).toUpperCase()}
                </span>
              </div>
              
              {/* User Info - ซ่อนเมื่อ collapsed */}
              <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                  {display_name || email.split("@")[0]}                     {/* แสดง display_name หรือ username */}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {email}                                                    {/* แสดงอีเมล */}
                </p>
              </div>
            </div>
          </PopoverTrigger>
          
          {/* ============================================================================ */}
          {/* USER PROFILE POPOVER - เมนูผู้ใช้ */}
          {/* ============================================================================ */}
          
          <PopoverContent side="top" align="start" className="w-80 p-0">
            <div className="space-y-0">
              
              {/* User Info Header */}
              <div className="flex items-center gap-3 p-4 border-b border-slate-200 dark:border-slate-700">
                {/* User Avatar */}
                <div className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                  <span className="text-white font-semibold text-sm">
                    {display_name
                      ? display_name.charAt(0).toUpperCase()
                      : email.charAt(0).toUpperCase()}
                  </span>
                </div>
                
                {/* User Details */}
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
                
                {/* Upgrade Plan Button */}
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-3 h-10 text-left px-3"
                >
                  <User className="h-4 w-4" />
                  Upgrade plan
                </Button>

                {/* Customize Genius AI Button */}
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-3 h-10 text-left px-3"
                >
                  <Settings className="h-4 w-4" />
                  Customize Genius AI
                </Button>

                {/* Settings Button */}
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-3 h-10 text-left px-3"
                  onClick={() => setIsSettingsOpen(true)}                    // เปิด settings dialog
                >
                  <Settings className="h-4 w-4" />
                  Settings
                </Button>

                <hr className="my-2 border-slate-200 dark:border-slate-700" />

                {/* Logout Button */}
                <div className="px-1">
                  <LogoutButton />                                            {/* Component สำหรับ logout */}
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </SidebarFooter>

      {/* ============================================================================ */}
      {/* DIALOGS - Settings Dialog และ Delete Confirmation */}
      {/* ============================================================================ */}
      
      {/* Settings Dialog */}
      <SettingsDialog 
        isOpen={isSettingsOpen}                                             // สถานะการเปิด/ปิด
        onClose={() => setIsSettingsOpen(false)}                           // callback สำหรับปิด dialog
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ลบประวัติการแชท</AlertDialogTitle>
            <AlertDialogDescription>
              คุณแน่ใจหรือไม่ว่าต้องการลบประวัติการแชทนี้? การดำเนินการนี้ไม่สามารถย้อนกลับได้
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            {/* Cancel Button */}
            <AlertDialogCancel onClick={() => {
              setDeleteDialogOpen(false)                                     // ปิด dialog
              setSessionToDelete(null)                                       // เคลียร์ session ที่จะลบ
            }}>
              ยกเลิก
            </AlertDialogCancel>
            
            {/* Confirm Delete Button */}
            <AlertDialogAction 
              onClick={confirmDeleteSession}                                 // เรียกฟังก์ชันยืนยันการลบ
              className="bg-red-600 hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700"
            >
              ลบ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sidebar>
  )
}