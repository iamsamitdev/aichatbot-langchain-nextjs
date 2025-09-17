/**
 * ===============================================
 * New Chat Component - หน้าสำหรับสนทนาใหม่
 * ===============================================
 * 
 * Purpose: หน้าหลักสำหรับเริ่มการสนทนาใหม่และจัดการประวัติการสนทนา
 * 
 * Features:
 * - แสดงหน้า Welcome สำหรับการสนทนาใหม่
 * - โหลดประวัติการสนทนาจาก session ID
 * - ส่งข้อความไปยัง AI และรับการตอบกลับ
 * - จัดการ authentication และ session
 * - รองรับการสร้าง chat session ใหม่
 * - แสดงสถานะการโหลดและการพิมพ์
 * 
 * Authentication: ใช้ Supabase Authentication
 * State Management: ใช้ React Context และ Local State
 * Chat Transport: ใช้ AI SDK สำหรับจัดการ streaming
 */

"use client"

// ============================================================================
// IMPORTS - การนำเข้า Components และ Libraries ที่จำเป็น
// ============================================================================
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
} from "@/components/ui/prompt-input"                                       // Components สำหรับรับ input จากผู้ใช้
import { ScrollButton } from "@/components/ui/scroll-button"                // ปุ่มสำหรับ scroll ไปข้างล่าง
import { Button } from "@/components/ui/button"                             // Component ปุ่มพื้นฐาน
import { SidebarTrigger } from "@/components/ui/sidebar"                    // ปุ่มสำหรับเปิด/ปิด sidebar
import { ModelSelector } from "@/components/model-selector"                 // Dropdown สำหรับเลือกโมเดล AI
import { cn } from "@/lib/utils"                                            // Utility สำหรับจัดการ CSS classes
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
import { useRef, useState, useEffect } from "react"                          // React Hooks
import { useChatContext } from "@/contexts/chat-context"                     // Context สำหรับจัดการสถานะ chat
import { useChat } from '@ai-sdk/react'                                      // Hook สำหรับจัดการ AI chat
import { createCustomChatTransport } from '@/lib/custom-chat-transport';     // Custom transport สำหรับส่งข้อมูล
import { createClient } from '@/lib/client'                                  // Supabase client
import { DEFAULT_MODEL } from "@/constants/models"                           // โมเดล AI เริ่มต้น
import { API_BASE, buildApiUrl } from "@/constants/api"   // API endpoints constants

/**
 * Interface สำหรับ Message Object
 * 
 * Structure:
 * - id: string - ID ของข้อความ
 * - role: string - บทบาท ('user' หรือ 'assistant')
 * - parts: Array - ส่วนประกอบของข้อความ
 */
interface MessageType {
  id: string;                                                                // ID ของข้อความ
  role: string;                                                              // บทบาทของผู้ส่ง (user/assistant)
  parts: Array<{ type: string; text: string }>;                            // เนื้อหาข้อความแบบ parts
}

// Sample Prompt Interface
interface SamplePrompt {
  title: string;
  prompt: string;
  icon: string;
}

// Sample Prompt Data
const samplePrompts: SamplePrompt[] = [
    {
      title: 'สรุปข้อมูลจากบทความ',
      prompt: 'สามารถช่วยสรุปสาระสำคัญจากบทความที่ฉันให้มาได้ไหม?',
      icon: '📋'
    },
    {
      title: 'เขียนโค้ดให้ทำงาน',
      prompt: 'ช่วยเขียนโค้ด Python สำหรับการอ่านไฟล์ CSV และแสดงข้อมูลเป็นกราฟ',
      icon: '💻'
    },
    {
      title: 'แปลภาษา',
      prompt: 'ช่วยแปลข้อความนี้จากภาษาไทยเป็นภาษาอังกฤษ',
      icon: '🌐'
    },
    {
      title: 'วิเคราะห์ข้อมูล',
      prompt: 'ช่วยวิเคราะห์ข้อมูลการขายของบริษัทในไตรมาสที่ผ่านมา',
      icon: '📊'
    },
    {
      title: 'เขียนอีเมล์',
      prompt: 'ช่วยเขียนอีเมล์สำหรับขอนัดหมายประชุมกับลูกค้า',
      icon: '✉️'
    },
    {
      title: 'แก้ไขข้อผิดพลาด',
      prompt: 'โค้ดของฉันมีข้อผิดพลาด สามารถช่วยหาและแก้ไขได้ไหม?',
      icon: '🐛'
    }
]

export function NewChat() {
  
  // ============================================================================
  // STEP 1: STATE DECLARATIONS - การประกาศตัวแปร State
  // ============================================================================

  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL)               // โมเดล AI ที่เลือก (ค่าเริ่มต้นจาก constants)
  
  /**
   * ข้อความที่ผู้ใช้พิมพ์ในช่อง input
   * ใช้สำหรับเก็บข้อความที่จะส่งไปยัง AI
   */
  const [prompt, setPrompt] = useState("")
  
  /**
   * สถานะการแสดงหน้า Welcome และฟังก์ชันสำหรับเปลี่ยนสถานะ
   * มาจาก ChatContext ที่ใช้ร่วมกันในทั้งแอปพลิเคชัน
   */
  const { showWelcome, setShowWelcome } = useChatContext()
  
  /**
   * Reference สำหรับ DOM elements ที่ต้องการ access โดยตรง
   * ใช้สำหรับการ scroll และ focus
   */
  const chatContainerRef = useRef<HTMLDivElement>(null)                      // Container สำหรับข้อความ chat
  const textareaRef = useRef<HTMLTextAreaElement>(null)                      // Textarea สำหรับพิมพ์ข้อความ
  
  /**
   * State สำหรับติดตาม copy status ของแต่ละข้อความ
   * key: message id, value: boolean (true = เพิ่งกด copy)
   */
  const [copiedMessages, setCopiedMessages] = useState<Record<string, boolean>>({})
  
  /**
   * ID ของผู้ใช้ที่ล็อกอินอยู่ในปัจจุบัน
   * ใช้สำหรับการระบุตัวตนและบันทึกข้อมูล
   */
  const [userId, setUserId] = useState<string>('')

  /**
   * ID ของ session การสนทนาปัจจุบัน
   * ใช้สำหรับเก็บประวัติการสนทนาและความต่อเนื่อง
   */
  const [sessionId, setSessionId] = useState<string | undefined>(undefined)
  
  /**
   * สถานะการโหลดประวัติการสนทนา
   * แสดงข้อความ loading เมื่อกำลังดึงข้อมูลจาก database
   */
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  
  /**
   * ข้อความที่โหลดมาจากประวัติการสนทนาใน database
   * เก็บข้อความที่ดึงมาจาก session เก่าเพื่อแสดงต่อจากที่เหลือ
   */
  const [loadedMessages, setLoadedMessages] = useState<MessageType[]>([])    // เก็บข้อความที่โหลดจากประวัติ

  // ============================================================================
  // STEP 2: FUNCTION DEFINITIONS - การประกาศฟังก์ชัน
  // ============================================================================

  const loadChatHistory = async (sessionIdToLoad: string) => {
    // ตรวจสอบว่ามี sessionId หรือไม่
    if (!sessionIdToLoad) return

    // เริ่มแสดงสถานะ loading
    setIsLoadingHistory(true)
    
    try {
      // เรียก API เพื่อดึงประวัติการสนทนา
      const apiUrl = buildApiUrl(API_BASE, { sessionId: sessionIdToLoad })
      const response = await fetch(apiUrl)
      
      // ตรวจสอบว่า API response สำเร็จหรือไม่
      if (!response.ok) {
        throw new Error('Failed to load chat history')
      }
      
      // แยกข้อมูล JSON จาก response
      const data = await response.json()
      const loadedMessagesData = data.messages || []
      
      /**
       * แปลงข้อความจาก database format เป็น UI format
       * 
       * Database Format: { id, role, content/text }
       * UI Format: { id, role, parts: [{ type: 'text', text }] }
       */
      const formattedMessages = loadedMessagesData.map((msg: { 
        id?: string; 
        role?: string; 
        content?: string; 
        text?: string 
      }, index: number) => ({
        id: msg.id || `loaded-${index}`,                                     // ใช้ ID จาก DB หรือสร้างใหม่
        role: msg.role || 'user',                                            // ใช้ role ที่ได้จาก API โดยตรง
        parts: [{ type: 'text', text: msg.content || msg.text || '' }]       // แปลงเป็น parts format
      }))
      
      // เก็บข้อความที่โหลดไว้ใน state
      setLoadedMessages(formattedMessages)
      console.log('Loaded messages:', formattedMessages)
      
    } catch (error) {
      // จัดการข้อผิดพลาดที่เกิดขึ้น
      console.error('Error loading chat history:', error)
    } finally {
      // หยุดแสดงสถานะ loading (ทำงานไม่ว่าจะสำเร็จหรือไม่)
      setIsLoadingHistory(false)
    }
  }

  // ============================================================================
  // STEP 3: CHAT HOOK INITIALIZATION - การตั้งค่า useChat Hook
  // ============================================================================
  const { messages, sendMessage, status, setMessages, stop } = useChat({

    transport: createCustomChatTransport({
      api: API_BASE,                                                        // API endpoint สำหรับส่งข้อความ
      
      onResponse: (response: Response) => {
        const newSessionId = response.headers.get('x-session-id');           // ดึง session ID จาก header
        if (newSessionId) {
          console.log('Received new session ID:', newSessionId);
          setSessionId(newSessionId);                                        // อัปเดต session ID ใน state
          localStorage.setItem('currentSessionId', newSessionId);            // บันทึก sessionId ล่าสุดไว้ใน localStorage
        }
      },
    }),
  })

  // ============================================================================
  // STEP 4: AUTHENTICATION EFFECT - การตรวจสอบและจัดการ Authentication
  // ============================================================================

  useEffect(() => {
    const supabase = createClient()                                          // สร้าง Supabase client
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()              // ดึงข้อมูล user
      if (user) {
        setUserId(user.id)                                                   // เก็บ user ID

        const savedSessionId = localStorage.getItem('currentSessionId')
        if (savedSessionId && showWelcome) {
          setSessionId(savedSessionId)                                       // ตั้งค่า session ID
          setShowWelcome(false)                                              // ซ่อน welcome เพื่อแสดงประวัติ
        }
      }
    }

    getUser()                                                                // เรียกใช้ฟังก์ชัน

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setUserId(session.user.id)                                           // เก็บ user ID
      } else {
        setUserId('')                                                        // ล้าง user ID
      }
    })

    /**
     * Cleanup function
     * ยกเลิก subscription เมื่อ component unmount
     */
    return () => subscription.unsubscribe()
  }, [setShowWelcome, showWelcome])

  // ============================================================================
  // STEP 5: UI FOCUS EFFECT - การจัดการ Focus ของ UI
  // ============================================================================

  useEffect(() => {
    if (showWelcome) {
      setTimeout(() => {
        textareaRef.current?.focus()                                         // Focus textarea หลังจาก 100ms
      }, 100)
    }
  }, [showWelcome])

  // ============================================================================
  // STEP 6: CHAT RESET EFFECT - การจัดการการรีเซ็ต Chat
  // ============================================================================

  useEffect(() => {
    // เมื่อกด New Chat (showWelcome = true จาก context)
    if (showWelcome) {
      // เคลียร์ sessionId และ messages ทันที
      setSessionId(undefined)                                                // ล้าง session ID
      setMessages([])                                                        // ล้างข้อความจาก useChat
      setLoadedMessages([])                                                  // ล้างข้อความที่โหลดจากประวัติ
    }
  }, [showWelcome, setMessages])

  // ============================================================================
  // STEP 7: HISTORY LOADING EFFECT - การโหลดประวัติการสนทนา
  // ============================================================================
  useEffect(() => {
    // โหลดประวัติเฉพาะเมื่อไม่ใช่ welcome state และมี sessionId
    if (sessionId && userId && !showWelcome) {
      loadChatHistory(sessionId)                                             // เรียกฟังก์ชันโหลดประวัติ
    }
  }, [sessionId, userId, showWelcome])

  // ============================================================================
  // STEP 8: EVENT HANDLER FUNCTIONS - ฟังก์ชันจัดการ Events
  // ============================================================================
  const handleSubmit = () => {
    // ตรวจสอบ userId และข้อความว่าง
    if (!prompt.trim() || !userId) return

    const messageToSend = {
      role: 'user' as const,
      parts: [{ type: 'text' as const, text: prompt.trim() }],
    }

    sendMessage(messageToSend, {
      body: {
        userId: userId,                                                      // ส่ง user ID สำหรับการระบุตัวตน
        sessionId: sessionId,                                               // ส่ง session ID สำหรับความต่อเนื่อง
      },
    })

    // รีเซ็ต UI state
    setPrompt("")                                                            // ล้างข้อความใน input
    setShowWelcome(false)                                                    // ซ่อนหน้า welcome
  }

  const handleSamplePrompt = (samplePrompt: string) => {
    setPrompt(samplePrompt)                                                  // ตั้งค่าข้อความใน input
  }

  const handleStop = () => {
    stop()                                                                   // หยุดการส่งข้อความ
  }

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

  // ============================================================================
  // STEP 9: AUTHENTICATION GUARD - การตรวจสอบสิทธิ์การเข้าถึง
  // ============================================================================
  if (!userId) {
    return (
      <main className="flex h-screen flex-col overflow-hidden">
        {/* Header Section - ส่วนหัวของหน้า */}
        <header className="bg-background z-10 flex h-16 w-full shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />                              {/* ปุ่มเปิด/ปิด sidebar */}
          <div className="text-foreground flex-1">New Chat</div>            {/* ชื่อหน้า */}
        </header>
        
        {/* Content Section - ส่วนเนื้อหาหลัก */}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-gray-700 mb-2">กรุณาเข้าสู่ระบบ</h2>
            <p className="text-gray-500">คุณต้องเข้าสู่ระบบก่อนเพื่อใช้งาน Chat</p>
          </div>
        </div>
      </main>
    )
  }

  // ============================================================================
  // STEP 10: MAIN RENDER - การแสดงผลหน้าหลัก
  // ============================================================================
  return (
    <main className="flex h-screen flex-col overflow-hidden">
      
      {/* ============================================================================ */}
      {/* HEADER SECTION - ส่วนหัวของหน้า */}
      {/* ============================================================================ */}
      
      <header className="bg-background z-10 flex h-16 w-full shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />                                {/* ปุ่มเปิด/ปิด sidebar */}
        <div className="text-foreground flex-1">New Chat</div>              {/* ชื่อหน้า */}
        
        {/* Model Selector */}
        <ModelSelector
          selectedModel={selectedModel}
          onModelChange={setSelectedModel}
        />
      </header>

      {/* ============================================================================ */}
      {/* CHAT CONTAINER SECTION - ส่วนแสดงข้อความการสนทนา */}
      {/* ============================================================================ */}
      
      <div ref={chatContainerRef} className="relative flex-1 overflow-hidden">
        <ChatContainerRoot className="h-full">
          <ChatContainerContent
            className={cn(
              "p-4",
              // แสดง welcome screen ตรงกลางเมื่อไม่มีข้อความ
              (showWelcome && messages.length === 0 && loadedMessages.length === 0) 
                ? "flex items-center justify-center h-full" 
                : ""
            )}
          >
            {/* ============================================================================ */}
            {/* CONDITIONAL CONTENT - เนื้อหาที่แสดงตามสถานะ */}
            {/* ============================================================================ */}
            
            {/* Welcome Screen - หน้าต้อนรับสำหรับการสนทนาใหม่ */}
            {(showWelcome && messages.length === 0 && loadedMessages.length === 0) ? (
              /**
               * Welcome Screen Layout
               * 
               * Components:
               * 1. AI Avatar และ Welcome Message
               * 2. Sample Prompts Grid
               * 3. Interactive Buttons สำหรับ quick start
               */
              <div className="text-center max-w-3xl mx-auto">
                
                {/* AI Avatar และ Welcome Message */}
                <div className="mb-8">
                  <div className="h-20 w-20 mx-auto mb-6 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                    <span className="text-white font-bold text-2xl">AI</span>
                  </div>
                  <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-4">
                    Welcome to Genius AI
                  </h1>
                  <p className="text-lg text-slate-600 dark:text-slate-400 mb-8">
                    ยินดีต้อนรับสู่ AI Chatbot ที่ขับเคลื่อนด้วย LangChain และ OpenAI
          ฉันพร้อมช่วยคุณในหลากหลายงาน เริ่มต้นด้วยตัวอย่างด้านล่างหรือพิมพ์คำถามของคุณเลย
                  </p>
                </div>

                {/* Sample Prompts Grid - ตัวอย่างคำถามสำหรับ quick start */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {samplePrompts.map((sample, index) => (
                    <button 
                      key={index}
                      onClick={() => handleSamplePrompt(sample.prompt)}          // ใส่ prompt เมื่อคลิก
                      className="bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-lg p-4 text-left transition"
                    >
                      <div className="text-3xl mb-2">{sample.icon}</div>          {/* ไอคอน */}
                      <h3 className="font-semibold text-lg mb-1">{sample.title}</h3> {/* ชื่อ prompt */}
                      <p className="text-sm text-gray-600 dark:text-gray-400">{sample.prompt}</p> {/* คำอธิบาย */}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              // ============================================================================
              // CHAT MESSAGES DISPLAY - การแสดงข้อความการสนทนา
              // ============================================================================
              <div className="space-y-3 max-w-3xl mx-auto w-full">
                {/* รวม loadedMessages และ messages จาก useChat โดยกรองข้อความซ้ำ */}
                {(() => {
                  // สำหรับ New Chat ใช้เฉพาะ messages จาก useChat
                  if (!sessionId || loadedMessages.length === 0) {
                    return messages
                  }
                  
                  // สำหรับ chat ที่มีประวัติ ให้รวมกันโดยกรองซ้ำ
                  const allMessages = [...loadedMessages, ...messages]
                  const uniqueMessages = []
                  const seenContent = new Set()
                  
                  for (const message of allMessages) {
                    const content = typeof message === 'object' && 'parts' in message && message.parts
                      ? message.parts.map((part) => 'text' in part ? part.text : '').join('')
                      : String(message)
                    
                    const key = `${message.role}-${content}`
                    if (!seenContent.has(key)) {
                      seenContent.add(key)
                      uniqueMessages.push(message)
                    }
                  }
                  
                  return uniqueMessages
                })().map((message, index) => {
                  const isAssistant = message.role === "assistant"
                  
                  // คำนวณ content สำหรับใช้ใน copy function
                  const messageContent = typeof message === 'object' && 'parts' in message && message.parts
                    ? message.parts.map((part) => 'text' in part ? part.text : '').join('')
                    : String(message)
                  
                  return (
                    <Message
                      key={`${message.id}-${index}`}
                      isAssistant={isAssistant}
                      bubbleStyle={true}
                    >
                      <MessageContent
                        isAssistant={isAssistant}
                        bubbleStyle={true}
                        markdown={isAssistant} // แสดง markdown เฉพาะ assistant เท่านั้น
                      >
                        {messageContent}
                      </MessageContent>
                      
                      <MessageActions
                        isAssistant={isAssistant}
                        bubbleStyle={true}
                      >
                        <MessageAction tooltip="Copy" bubbleStyle={true}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-gray-500 hover:text-gray-700 rounded-full"
                            onClick={() => handleCopyMessage(messageContent, message.id)}
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
          </ChatContainerContent>
          
          {/* ============================================================================ */}
          {/* SCROLL BUTTON - ปุ่มสำหรับ scroll ไปข้างล่าง */}
          {/* ============================================================================ */}
          
          {/* แสดง scroll button เฉพาะเมื่อไม่ใช่ welcome screen */}
          {!(showWelcome && messages.length === 0 && loadedMessages.length === 0) && (
            <div className="absolute bottom-4 left-1/2 flex w-full max-w-3xl -translate-x-1/2 justify-end px-5">
              <ScrollButton className="shadow-sm" />                        {/* ปุ่ม scroll to bottom */}
            </div>
          )}
        </ChatContainerRoot>
      </div>

      {/* ============================================================================ */}
      {/* INPUT SECTION - ส่วนรับ input จากผู้ใช้ */}
      {/* ============================================================================ */}
      
      <div className="bg-background z-[5] shrink-0 px-3 pb-3 md:px-5 md:pb-5">
        <div className="mx-auto max-w-3xl">
          
          {/* ============================================================================ */}
          {/* STATUS INDICATORS - แสดงสถานะต่างๆ */}
          {/* ============================================================================ */}
          
          {/* แสดงสถานะการพิมพ์ของ AI */}
          {(status === 'submitted' || status === 'streaming') && 
            <div className="text-gray-500 italic mb-2 text-sm">🤔 AI กำลังคิด...</div>
          }
          
          {/* แสดงสถานะการโหลดประวัติ */}
          {isLoadingHistory && 
            <div className="text-blue-500 italic mb-2 text-sm">📚 กำลังโหลดประวัติการสนทนา...</div>
          }
          
          {/* ============================================================================ */}
          {/* PROMPT INPUT COMPONENT - ส่วน input หลัก */}
          {/* ============================================================================ */}
          <PromptInput
            isLoading={status !== 'ready'}
            value={prompt}
            onValueChange={setPrompt}
            onSubmit={handleSubmit}
            className="border-input bg-popover relative z-10 w-full rounded-3xl border p-0 pt-1 shadow-xs"
          >
            <div className="flex flex-col">
              
              {/* ============================================================================ */}
              {/* TEXTAREA INPUT - ช่องพิมพ์ข้อความ */}
              {/* ============================================================================ */}
              
              <PromptInputTextarea
                ref={textareaRef}
                placeholder="Ask anything to start a new chat..."
                className="min-h-[44px] pt-3 pl-4 text-base leading-[1.3] sm:text-base md:text-base"
              />

              {/* ============================================================================ */}
              {/* INPUT ACTIONS - ปุ่มต่างๆ ใน input area */}
              {/* ============================================================================ */}

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
                  <Button
                    size="icon"
                    disabled={
                      (status === 'ready' && (!prompt.trim() || !userId)) ||
                      (status !== 'ready' && status !== 'streaming' && status !== 'submitted')
                    }
                    onClick={
                      status === 'ready' ? handleSubmit : handleStop
                    }
                    className="size-9 rounded-full"
                    variant={status === 'ready' ? 'default' : 'destructive'}
                  >
                    {/* แสดง icon ตาม status */}
                    {status === 'ready' ? (
                      /* แสดงลูกศรเมื่อพร้อม */
                      <ArrowUp size={18} />
                    ) : status === 'streaming' || status === 'submitted' ? (
                      /* แสดงปุ่ม stop เมื่อกำลังส่ง */
                      <Square size={18} fill="currentColor" />
                    ) : (
                      /* แสดง loading indicator สำหรับ status อื่นๆ */
                      <span className="size-3 rounded-xs bg-white" />
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