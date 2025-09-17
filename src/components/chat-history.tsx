/**
 * ===============================================
 * Chat History Component - หน้าแสดงประวัติการสนทนา
 * ===============================================
 * 
 * Purpose: แสดงประวัติการสนทนาจาก session ที่ระบุและรองรับการต่อการสนทนา
 * 
 * Features:
 * - แสดงประวัติข้อความจาก session เฉพาะ
 * - รองรับการต่อการสนทนาในหน้าเดียวกัน
 * - จัดการ loading states และ error handling
 * - ตรวจสอบ authentication ก่อนแสดงเนื้อหา
 * - แสดง UI states: loading, error, empty, content
 * - รองรับ markdown rendering และ message actions
 * 
 * Dependencies:
 * - useChatHistory hook สำหรับจัดการข้อมูลและ API calls
 * - UI components สำหรับแสดงผล
 * 
 * Authentication: ต้องมี userId เพื่อเข้าถึงข้อมูล
 * Data Source: PostgreSQL database ผ่าน API endpoints
 */

"use client"

// ============================================================================
// IMPORTS - การนำเข้า Components และ Libraries ที่จำเป็น
// ============================================================================
import {useState, useRef, useEffect } from "react"                                    // React hooks สำหรับ DOM และ lifecycle
import {
  ChatContainerContent,
  ChatContainerRoot,
} from "@/components/ui/chat-container"                                      // Container สำหรับแสดงข้อความ chat
import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
} from "@/components/ui/message"                                             // Components สำหรับแสดงข้อความ
import {
  PromptInput,
  PromptInputAction,
  PromptInputActions,
  PromptInputTextarea,
} from "@/components/ui/prompt-input"                                        // Components สำหรับรับ input จากผู้ใช้
import { ScrollButton } from "@/components/ui/scroll-button"                 // ปุ่มสำหรับ scroll ไปข้างล่าง
import { Button } from "@/components/ui/button"                             // Component ปุ่มพื้นฐาน
import { SidebarTrigger } from "@/components/ui/sidebar"                    // ปุ่มสำหรับเปิด/ปิด sidebar
import { ModelSelector } from "@/components/model-selector"                 // Dropdown สำหรับเลือกโมเดล AI
import { useChatHistory } from "@/hooks/use-chat-history"                   // Custom hook สำหรับจัดการประวัติ chat
import {
  ArrowUp,
  Check,
  Copy,
  Globe,
  Mic,
  MoreHorizontal,
  Plus,
  Square,
} from "lucide-react"                                                        // Icons จาก Lucide React
import { DEFAULT_MODEL } from "@/constants/models"                           // โมเดล AI เริ่มต้น

// ============================================================================
// TypeScript Interface Definitions - กำหนด Type Definitions
// ============================================================================

/**
 * Interface สำหรับ Props ของ ChatHistory component
 * 
 * Structure:
 * - sessionId: string - ID ของ session ที่ต้องการแสดงประวัติ
 * - title: string - ชื่อที่แสดงใน header
 * - userId: string (optional) - ID ของผู้ใช้สำหรับ authentication
 */
interface ChatHistoryProps {
  sessionId: string                                                          // ID ของ session ที่ต้องการแสดง
  title: string                                                              // ชื่อที่แสดงใน header
  userId?: string                                                            // ID ของผู้ใช้ (optional สำหรับ authentication)
}

// ============================================================================
// MAIN COMPONENT - หน้าหลักสำหรับแสดงประวัติการสนทนา
// ============================================================================

/**
 * ChatHistory Component: แสดงประวัติการสนทนาและรองรับการต่อสนทนา
 * 
 * Purpose:
 * - แสดงประวัติข้อความจาก session ที่ระบุ
 * - รองรับการส่งข้อความใหม่เพื่อต่อการสนทนา
 * - จัดการ authentication และ authorization
 * - แสดง loading states และ error handling
 * - รองรับ markdown rendering และ message actions
 * 
 * Process Flow:
 * 1. ตรวจสอบ authentication (userId)
 * 2. โหลดประวัติการสนทนาจาก sessionId
 * 3. แสดงข้อความและรองรับการส่งข้อความใหม่
 * 4. จัดการ states: loading, error, empty, content
 * 
 * @param sessionId - ID ของ session ที่ต้องการแสดง
 * @param title - ชื่อที่แสดงใน header
 * @param userId - ID ของผู้ใช้สำหรับ authentication
 * @returns JSX Element หรือหน้า authentication prompt
 */
export function ChatHistory({ sessionId, title, userId }: ChatHistoryProps) {

  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL)               // โมเดล AI ที่เลือก (ค่าเริ่มต้นจาก constants)
  
  /**
   * State สำหรับติดตาม copy status ของแต่ละข้อความ
   * key: message id, value: boolean (true = เพิ่งกด copy)
   */
  const [copiedMessages, setCopiedMessages] = useState<Record<string, boolean>>({})
  
  // ============================================================================
  // STEP 1: REF AND HOOK DECLARATIONS - การประกาศ Refs และ Hooks
  // ============================================================================
  
  /**
   * Reference สำหรับ chat container
   * ใช้สำหรับการ scroll และการจัดการ DOM
   */
  const chatContainerRef = useRef<HTMLDivElement>(null)
  
  /**
   * Custom hook สำหรับจัดการประวัติการสนทนา
   * 
   * Returns:
   * - messages: array ของข้อความในการสนทนา
   * - loading: สถานะการส่งข้อความ
   * - input: ข้อความที่ผู้ใช้พิมพ์
   * - setInput: ฟังก์ชันสำหรับตั้งค่า input
   * - sendMessage: ฟังก์ชันสำหรับส่งข้อความ
   * - loadChatHistory: ฟังก์ชันสำหรับโหลดประวัติ
   * - loadingHistory: สถานะการโหลดประวัติ
   * - historyError: ข้อผิดพลาดในการโหลดประวัติ
   */
  const {
    messages,                                                                // array ของข้อความในการสนทนา
    loading,                                                                 // สถานะการส่งข้อความ
    input,                                                                   // ข้อความที่ผู้ใช้พิมพ์ปัจจุบัน
    setInput,                                                                // ฟังก์ชันสำหรับตั้งค่า input
    sendMessage,                                                             // ฟังก์ชันสำหรับส่งข้อความ
    stopMessage,                                                             // ฟังก์ชันสำหรับหยุดการส่งข้อความ
    loadChatHistory,                                                         // ฟังก์ชันสำหรับโหลดประวัติ
    loadingHistory,                                                          // สถานะการโหลดประวัติ
    historyError,                                                            // ข้อผิดพลาดในการโหลดประวัติ
  } = useChatHistory(sessionId, userId)                                      // เรียกใช้ custom hook

  // ============================================================================
  // STEP 2: EFFECTS - การจัดการ Side Effects
  // ============================================================================

  /**
   * Effect สำหรับโหลดประวัติแชทเมื่อ sessionId เปลี่ยน
   * 
   * Purpose:
   * - โหลดประวัติการสนทนาเมื่อมีการเปลี่ยน sessionId
   * - ตรวจสอบว่า sessionId ไม่ใช่ 'new' (สำหรับสร้างใหม่)
   * - เรียกฟังก์ชันโหลดประวัติจาก custom hook
   * 
   * Conditions:
   * - sessionId ต้องมีค่า
   * - sessionId ต้องไม่เท่ากับ 'new'
   * 
   * Dependencies: [sessionId]
   * Note: ปิด eslint rule เพราะ loadChatHistory มาจาก hook และไม่จำเป็นต้องใส่ใน dependency
   */
  useEffect(() => {
    if (sessionId && sessionId !== 'new') {
      loadChatHistory(sessionId)                                             // โหลดประวัติจาก sessionId
    }
  }, [sessionId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ============================================================================
  // STEP 3: EVENT HANDLER FUNCTIONS - ฟังก์ชันจัดการ Events
  // ============================================================================

  const handleCopyMessage = async (content: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(content)
      
      // แสดง check icon
      setCopiedMessages(prev => ({ ...prev, [messageId]: true }))
      
      // กลับไปเป็น copy icon หลังจาก 2 วินาที
      setTimeout(() => {
        setCopiedMessages(prev => ({ ...prev, [messageId]: false }))
      }, 2000)
      
      console.log('Message copied to clipboard')
    } catch (error) {
      console.error('Failed to copy message:', error)
    }
  }

  /**
   * ฟังก์ชันสำหรับจัดการการส่งข้อความ
   * 
   * Purpose:
   * - ตรวจสอบความถูกต้องของข้อมูลก่อนส่ง
   * - ส่งข้อความไปยัง API เพื่อต่อการสนทนา
   * - ป้องกันการส่งข้อความซ้ำขณะที่กำลัง loading
   * 
   * Validation:
   * - input ต้องไม่ว่าง (trim)
   * - ไม่อยู่ในสถานะ loading
   * - ต้องมี userId (ผู้ใช้ login แล้ว)
   * 
   * Process:
   * 1. ตรวจสอบเงื่อนไข
   * 2. เรียก sendMessage จาก hook
   * 3. Hook จะจัดการการส่งและอัปเดต state
   */
  const onSubmit = () => {
    // ตรวจสอบเงื่อนไขก่อนส่งข้อความ
    if (!input.trim() || loading || !userId) return
    
    // ส่งข้อความผ่าน hook
    sendMessage(input)                                                       // ฟังก์ชันจาก useChatHistory hook
  }

  const handleStop = () => {
    stopMessage()                                                            // หยุดการส่งข้อความ
  }

  // ============================================================================
  // STEP 4: AUTHENTICATION GUARD - การตรวจสอบสิทธิ์การเข้าถึง
  // ============================================================================

  /**
   * แสดงหน้า authentication prompt เมื่อไม่มี userId
   * 
   * Purpose:
   * - ป้องกันการเข้าถึงข้อมูลโดยผู้ที่ไม่ได้ login
   * - แสดงข้อความแนะนำให้ผู้ใช้เข้าสู่ระบบ
   * - รักษาความปลอดภัยของข้อมูลการสนทนา
   * 
   * UI Components:
   * - Header พร้อม title และ sidebar trigger
   * - Icon แสดงสถานะ lock
   * - ข้อความแจ้งให้ login
   * - Layout ที่สอดคล้องกับหน้าหลัก
   */
  if (!userId) {
    return (
      <main className="flex h-screen flex-col overflow-hidden">
        {/* Header Section - ส่วนหัวของหน้า */}
        <header className="bg-background z-10 flex h-16 w-full shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />                              {/* ปุ่มเปิด/ปิด sidebar */}
          <div className="text-foreground flex-1">{title}</div>             {/* ชื่อหน้าจาก props */}
        </header>
        
        {/* Content Section - ส่วนเนื้อหาหลัก */}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            {/* Lock Icon - ไอคอนแสดงสถานะ lock */}
            <div className="h-16 w-16 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center">
              <span className="text-red-500 text-xl">🔒</span>
            </div>
            
            {/* Authentication Message - ข้อความแจ้งให้ login */}
            <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">กรุณาเข้าสู่ระบบ</h2>
            <p className="text-gray-500">คุณต้องเข้าสู่ระบบก่อนเพื่อดูประวัติการสนทนา</p>
          </div>
        </div>
      </main>
    )
  }

  // ============================================================================
  // STEP 5: MAIN RENDER - การแสดงผลหน้าหลัก
  // ============================================================================

  /**
   * Main render section - ส่วนแสดงผลหลักของ component
   * 
   * Structure:
   * 1. Header - ส่วนหัวพร้อม title
   * 2. Chat Container - ส่วนแสดงข้อความและ states
   * 3. Input Section - ส่วนรับ input สำหรับต่อการสนทนา
   * 
   * States Handled:
   * - Loading History: แสดงสถานะการโหลดประวัติ
   * - Error: แสดงข้อผิดพลาดและปุ่มลองใหม่
   * - Empty: แสดงเมื่อไม่มีข้อความในการสนทนา
   * - Content: แสดงรายการข้อความ
   */
  return (
    <main className="flex h-screen flex-col overflow-hidden">
      
      {/* ============================================================================ */}
      {/* HEADER SECTION - ส่วนหัวของหน้า */}
      {/* ============================================================================ */}
      
      <header className="bg-background z-10 flex h-16 w-full shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />                                {/* ปุ่มเปิด/ปิด sidebar */}
        <div className="text-foreground flex-1">{title}</div>               {/* ชื่อหน้าจาก props */}
        {/* Model Selector */}
        <ModelSelector
          selectedModel={selectedModel}
          onModelChange={setSelectedModel}
        />
      </header>

      {/* ============================================================================ */}
      {/* CHAT CONTAINER SECTION - ส่วนแสดงข้อความและ States */}
      {/* ============================================================================ */}
      
      <div ref={chatContainerRef} className="relative flex-1 overflow-hidden">
        <ChatContainerRoot className="h-full">
          <ChatContainerContent className="p-4">
            
            {/* ============================================================================ */}
            {/* STATE: LOADING HISTORY - สถานะการโหลดประวัติ */}
            {/* ============================================================================ */}
            
            {/* แสดงเมื่อกำลังโหลดประวัติการสนทนา */}
            {loadingHistory && (
              <div className="flex justify-center items-center py-8">
                <div className="text-center">
                  {/* Loading Spinner - แสดงสถานะการโหลด */}
                  <div className="h-12 w-12 mx-auto mb-4 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                    <div className="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                  </div>
                  
                  {/* Loading Message - ข้อความแสดงสถานะ */}
                  <div className="text-blue-600 dark:text-blue-400 font-medium">กำลังโหลดประวัติการสนทนา...</div>
                  <div className="text-sm text-gray-500 mt-1">กรุณารอสักครู่</div>
                </div>
              </div>
            )}
            
            {/* ============================================================================ */}
            {/* STATE: ERROR - สถานะข้อผิดพลาด */}
            {/* ============================================================================ */}
            
            {/* แสดงเมื่อเกิดข้อผิดพลาดในการโหลดประวัติ */}
            {historyError && (
              <div className="flex justify-center items-center py-8">
                <div className="text-center max-w-md mx-auto">
                  {/* Error Icon - ไอคอนแสดงข้อผิดพลาด */}
                  <div className="h-12 w-12 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center">
                    <span className="text-red-500 text-xl">⚠️</span>
                  </div>
                  
                  {/* Error Message - ข้อความแสดงข้อผิดพลาด */}
                  <h3 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-2">
                    เกิดข้อผิดพลาด
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    {historyError}                                           {/* แสดงข้อความ error จาก hook */}
                  </p>
                  
                  {/* Retry Button - ปุ่มลองใหม่ */}
                  <Button 
                    onClick={() => loadChatHistory(sessionId)}               
                    variant="outline" 
                    size="sm" 
                    className="mt-4"
                  >
                    ลองใหม่
                  </Button>
                </div>
              </div>
            )}
            
            {/* ============================================================================ */}
            {/* STATE: MESSAGES CONTENT - แสดงรายการข้อความ */}
            {/* ============================================================================ */}
            
            {/* แสดงรายการข้อความเมื่อไม่มี loading หรือ error */}
            {!loadingHistory && !historyError && (
              <div className="space-y-3 max-w-3xl mx-auto w-full">
                {messages.map((message) => {
                  const isAssistant = message.role === "assistant"          // ตรวจสอบว่าเป็นข้อความจาก AI หรือไม่
                  
                  return (
                    /**
                     * Message Component
                     * 
                     * Props:
                     * - key: unique identifier จาก message.id
                     * - isAssistant: boolean สำหรับแยกประเภทข้อความ
                     * - bubbleStyle: ใช้ bubble style สำหรับแสดงผล
                     */
                    <Message
                      key={message.id}                                       // unique key จาก message ID
                      isAssistant={isAssistant}                              // ระบุประเภทข้อความ
                      bubbleStyle={true}                                     // ใช้ bubble style
                    >
                      
                      {/* Message Content - เนื้อหาข้อความ */}
                      <MessageContent
                        isAssistant={isAssistant}
                        bubbleStyle={true}
                        markdown={isAssistant}                               // แสดง markdown เฉพาะ assistant เท่านั้น
                      >
                        {/* เนื้อหาข้อความจาก database */}
                        {message.content}                                    
                      </MessageContent>
                      
                      {/* Message Actions - ปุ่มสำหรับจัดการข้อความ */}
                      <MessageActions
                        isAssistant={isAssistant}
                        bubbleStyle={true}
                      >
                        
                        {/* Copy Button - ปุ่มสำหรับ copy ข้อความ */}
                        <MessageAction tooltip="Copy" bubbleStyle={true}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-gray-500 hover:text-gray-700 rounded-full"
                            onClick={() => handleCopyMessage(message.content, message.id)}
                          >
                            {copiedMessages[message.id] ? (
                              <Check size={14} className="text-green-600" />
                            ) : (
                              <Copy size={14} />
                            )}
                          </Button>
                        </MessageAction>
                        
                      </MessageActions>
                    </Message>
                  )
                })}
              </div>
            )}
            
            {/* ============================================================================ */}
            {/* STATE: EMPTY - สถานะเมื่อไม่มีข้อความ */}
            {/* ============================================================================ */}
            
            {/* แสดงเมื่อไม่มี loading, error และไม่มีข้อความ */}
            {!loadingHistory && !historyError && messages.length === 0 && (
              <div className="flex justify-center items-center py-8">
                <div className="text-center max-w-md mx-auto">
                  {/* Chat Icon - ไอคอนแสดงการสนทนา */}
                  <div className="h-16 w-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                    <span className="text-white font-bold text-lg">💬</span>
                  </div>
                  
                  {/* Empty State Message - ข้อความเมื่อไม่มีข้อความ */}
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">
                    Continue Your Conversation
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 mb-4">
                    Type a message below to continue this chat session
                  </p>
                  
                  {/* Session Info - แสดงข้อมูล session */}
                  <div className="text-sm text-gray-400">
                    Session ID: {sessionId}
                  </div>
                </div>
              </div>
            )}
          </ChatContainerContent>
          
          {/* ============================================================================ */}
          {/* SCROLL BUTTON - ปุ่มสำหรับ scroll ไปข้างล่าง */}
          {/* ============================================================================ */}
          
          {/* แสดง scroll button เฉพาะเมื่อมีข้อความ */}
          {messages.length > 0 && (
            <div className="absolute bottom-4 left-1/2 flex w-full max-w-3xl -translate-x-1/2 justify-end px-5">
              <ScrollButton className="shadow-sm" />                        {/* ปุ่ม scroll to bottom */}
            </div>
          )}
        </ChatContainerRoot>
      </div>

      {/* ============================================================================ */}
      {/* INPUT SECTION - ส่วนรับ input สำหรับต่อการสนทนา */}
      {/* ============================================================================ */}
      
      <div className="bg-background z-[5] shrink-0 px-3 pb-3 md:px-5 md:pb-5">
        <div className="mx-auto max-w-3xl">
          
          {/* ============================================================================ */}
          {/* STATUS INDICATORS - แสดงสถานะต่างๆ */}
          {/* ============================================================================ */}
          
          {/* แสดงสถานะการส่งข้อความ (AI กำลังตอบ) */}
          {loading && 
            <div className="flex items-center gap-2 text-gray-500 italic mb-2 text-sm">
              {/* Animated Dots - จุดเคลื่อนไหวแสดงการรอ */}
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
              </div>
              <span>AI กำลังคิด...</span>
            </div>
          }
          
          {/* แสดงสถานะการโหลดประวัติ */}
          {loadingHistory && 
            <div className="text-blue-500 italic mb-2 text-sm flex items-center gap-2">
              {/* Loading Spinner - แสดงสถานะการโหลด */}
              <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
              <span>กำลังโหลดประวัติการสนทนา...</span>
            </div>
          }
          
          {/* ============================================================================ */}
          {/* PROMPT INPUT COMPONENT - ส่วน input หลัก */}
          {/* ============================================================================ */}
          
          {/*
           * PromptInput Component
           * 
           * Purpose:
           * - รับข้อความจากผู้ใช้เพื่อต่อการสนทนา
           * - จัดการ loading state
           * - ส่งข้อความเมื่อกด Enter หรือคลิกปุ่ม
           * 
           * Props:
           * - isLoading: สถานะการโหลด (จากการส่งข้อความ)
           * - value: ข้อความในปัจจุบัน
           * - onValueChange: callback เมื่อข้อความเปลี่ยน
           * - onSubmit: callback เมื่อส่งข้อความ
           */}

          {/* แสดง loading เมื่อกำลังส่งข้อความ */}
          <PromptInput
            isLoading={loading}
            value={input}                                                    // ข้อความปัจจุบันใน input
            onValueChange={setInput}                                         // callback สำหรับเปลี่ยนข้อความ
            onSubmit={onSubmit}                                              // callback สำหรับส่งข้อความ
            className="border-input bg-popover relative z-10 w-full rounded-3xl border p-0 pt-1 shadow-xs"
          >
            <div className="flex flex-col">
              
              {/* ============================================================================ */}
              {/* TEXTAREA INPUT - ช่องพิมพ์ข้อความ */}
              {/* ============================================================================ */}
              
              {/*
               * PromptInputTextarea Component
               * 
               * Purpose:
               * - รับข้อความจากผู้ใช้เพื่อต่อการสนทนา
               * - รองรับ multiline input
               * - แสดง placeholder เพื่อให้ผู้ใช้เข้าใจวัตถุประสงค์
               * 
               * Features:
               * - Auto-resize ตามเนื้อหา
               * - Placeholder สำหรับการต่อการสนทนา
               * - Keyboard shortcuts สำหรับส่งข้อความ
               */}
              {/* ข้อความ placeholder */}
              <PromptInputTextarea
                placeholder="Continue the conversation..."
                className="min-h-[44px] pt-3 pl-4 text-base leading-[1.3] sm:text-base md:text-base"
              />

              {/* ============================================================================ */}
              {/* INPUT ACTIONS - ปุ่มต่างๆ ใน input area */}
              {/* ============================================================================ */}
              
              {/*
               * PromptInputActions Component
               * 
               * Purpose:
               * - จัดกลุ่มปุ่มต่างๆ ใน input area
               * - แยกเป็นกลุ่มซ้ายและขวา
               * - รองรับ action ต่างๆ เช่น search, voice, send
               */}
              {/* กลุ่มปุ่มต่างๆ ใน input area */}
              <PromptInputActions className="mt-5 flex w-full items-center justify-between gap-2 px-3 pb-3">
                
                {/* Left Actions Group - กลุ่มปุ่มด้านซ้าย */}
                <div className="flex items-center gap-2">
                  
                  {/* Add Action Button - ปุ่มเพิ่ม action */}
                  <PromptInputAction tooltip="Add a new action">
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-9 rounded-full"
                    >
                      <Plus size={18} />
                    </Button>
                  </PromptInputAction>

                  {/* Search Button - ปุ่มค้นหา */}
                  <PromptInputAction tooltip="Search">
                    <Button variant="outline" className="rounded-full">
                      <Globe size={18} />
                      Search
                    </Button>
                  </PromptInputAction>

                  {/* More Actions Button - ปุ่ม action เพิ่มเติม */}
                  <PromptInputAction tooltip="More actions">
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-9 rounded-full"
                    >
                      <MoreHorizontal size={18} />
                    </Button>
                  </PromptInputAction>
                </div>
                
                {/* Right Actions Group - กลุ่มปุ่มด้านขวา */}
                <div className="flex items-center gap-2">
                  
                  {/* Voice Input Button - ปุ่ม voice input */}
                  <PromptInputAction tooltip="Voice input">
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-9 rounded-full"
                    >
                      <Mic size={18} />
                    </Button>
                  </PromptInputAction>

                  {/* Send/Stop Button - ปุ่มส่งข้อความหรือหยุด */}
                  {/*
                   * Send/Stop Button
                   * 
                   * Purpose:
                   * - ส่งข้อความเพื่อต่อการสนทนา เมื่อไม่กำลัง loading
                   * - หยุดการส่งข้อความ เมื่อกำลัง loading
                   * - แสดง loading state เมื่อกำลังส่ง
                   * - ตรวจสอบความพร้อมก่อนส่ง
                   * 
                   * Disabled Conditions:
                   * - ข้อความว่าง (!input.trim()) และไม่กำลัง loading
                   * - ไม่มี userId (ไม่ได้ login)
                   */}
                  <Button
                    size="icon"
                    disabled={(!loading && (!input.trim() || !userId))}
                    onClick={loading ? handleStop : onSubmit}
                    className="size-9 rounded-full"
                    variant={loading ? 'destructive' : 'default'}
                  >
                    {/* แสดง icon ตาม loading state */}
                    {!loading ? (
                      /* แสดงลูกศรเมื่อพร้อม */
                      <ArrowUp size={18} />
                    ) : (
                      /* แสดงปุ่ม stop เมื่อกำลังส่ง */
                      <Square size={18} fill="currentColor" />
                    )}
                  </Button>
                </div>
              </PromptInputActions>
            </div>
          </PromptInput>
        </div>
      </div>
    </main>
  )
}