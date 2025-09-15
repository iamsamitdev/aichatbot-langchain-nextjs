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
  Copy,
  Globe,
  Mic,
  MoreHorizontal,
  Pencil,
  Plus,
  ThumbsDown,
  ThumbsUp,
  Trash,
} from "lucide-react"                                                        // Icons จาก Lucide React
import { useRef, useState, useEffect } from "react"                          // React Hooks
import { useChatContext } from "@/contexts/chat-context"                     // Context สำหรับจัดการสถานะ chat
import { useChat } from '@ai-sdk/react'                                      // Hook สำหรับจัดการ AI chat
import { createCustomChatTransport } from '@/lib/custom-chat-transport';     // Custom transport สำหรับส่งข้อมูล
import { createClient } from '@/lib/client'                                  // Supabase client
import { DEFAULT_MODEL } from "@/constants/models"                           // โมเดล AI เริ่มต้น

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

  /**
   * ฟังก์ชันสำหรับโหลดประวัติข้อความจาก sessionId
   * 
   * Purpose:
   * - ดึงข้อมูลประวัติการสนทนาจาก API
   * - แปลงข้อมูลจาก database format เป็น UI format
   * - จัดการ error และ loading state
   * 
   * Process:
   * 1. ตรวจสอบว่ามี sessionId หรือไม่
   * 2. เรียก API เพื่อดึงข้อมูล
   * 3. แปลงข้อมูลเป็น format ที่ UI ใช้ได้
   * 4. อัปเดต state ด้วยข้อมูลที่ได้
   * 
   * @param sessionIdToLoad - ID ของ session ที่ต้องการโหลด
   */
  const loadChatHistory = async (sessionIdToLoad: string) => {
    // ตรวจสอบว่ามี sessionId หรือไม่
    if (!sessionIdToLoad) return

    // เริ่มแสดงสถานะ loading
    setIsLoadingHistory(true)
    
    try {
      // เรียก API เพื่อดึงประวัติการสนทนา
      const response = await fetch(`/api/chat_05_history?sessionId=${sessionIdToLoad}`)
      
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

  /**
   * ใช้ useChat hook เพื่อจัดการสถานะการสนทนา
   * 
   * Purpose:
   * - จัดการข้อความที่ส่งและรับ
   * - จัดการสถานะการส่งข้อความ (loading, streaming)
   * - ตั้งค่า custom transport สำหรับส่งข้อมูล
   * - รับ session ID ใหม่จาก response header
   * 
   * Features:
   * - messages: array ของข้อความในการสนทนาปัจจุบัน
   * - sendMessage: ฟังก์ชันสำหรับส่งข้อความ
   * - status: สถานะปัจจุบัน ('ready', 'submitted', 'streaming')
   * - setMessages: ฟังก์ชันสำหรับตั้งค่าข้อความ
   */
  const { messages, sendMessage, status, setMessages } = useChat({
    /**
     * Custom transport configuration
     * 
     * Purpose:
     * - กำหนด API endpoint ที่จะส่งข้อมูลไป
     * - จัดการ response และดึง session ID
     * - บันทึก session ID ไว้ใน localStorage
     */
    transport: createCustomChatTransport({
      api: '/api/chat_05_history',                                           // API endpoint สำหรับส่งข้อความ
      
      /**
       * Callback function ที่ทำงานเมื่อได้รับ response
       * 
       * Purpose:
       * - ดึง session ID จาก response header
       * - บันทึก session ID ใน state และ localStorage
       * - ใช้สำหรับความต่อเนื่องของการสนทนา
       * 
       * @param response - Response object จาก API
       */
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

  /**
   * Effect สำหรับดึงข้อมูล user และจัดการ authentication
   * 
   * Purpose:
   * - ตรวจสอบสถานะการ login ของผู้ใช้
   * - ดึง user ID สำหรับการบันทึกข้อมูล
   * - โหลด session ID จาก localStorage (เฉพาะเมื่อ page reload)
   * - ติดตาม authentication state changes
   * 
   * Process:
   * 1. สร้าง Supabase client
   * 2. ดึงข้อมูล user ปัจจุบัน
   * 3. โหลด saved session (ถ้ามี)
   * 4. ตั้งค่า auth state listener
   * 
   * Dependencies: [setShowWelcome, showWelcome]
   */
  useEffect(() => {
    const supabase = createClient()                                          // สร้าง Supabase client
    
    /**
     * ฟังก์ชันสำหรับดึงข้อมูล user ปัจจุบัน
     * 
     * Purpose:
     * - ตรวจสอบว่าผู้ใช้ login หรือไม่
     * - เก็บ user ID สำหรับการใช้งาน
     * - โหลด session ที่บันทึกไว้ (เฉพาะกรณี page reload)
     */
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()              // ดึงข้อมูล user
      if (user) {
        setUserId(user.id)                                                   // เก็บ user ID
        
        /**
         * โหลด sessionId จาก localStorage เฉพาะเมื่อ page reload
         * (ไม่ใช่จาก New Chat button)
         * 
         * Logic:
         * - ถ้ามี saved session และ showWelcome = true (page reload)
         * - โหลด session และซ่อน welcome screen
         */
        const savedSessionId = localStorage.getItem('currentSessionId')
        if (savedSessionId && showWelcome) {
          setSessionId(savedSessionId)                                       // ตั้งค่า session ID
          setShowWelcome(false)                                              // ซ่อน welcome เพื่อแสดงประวัติ
        }
      }
    }

    getUser()                                                                // เรียกใช้ฟังก์ชัน

    /**
     * ตั้งค่า listener สำหรับการเปลี่ยนแปลง auth state
     * 
     * Purpose:
     * - ติดตามการ login/logout ของผู้ใช้
     * - อัปเดต user ID เมื่อมีการเปลี่ยนแปลง
     * - จัดการ cleanup เมื่อ logout
     */
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

  /**
   * Effect สำหรับ focus textarea เมื่อแสดงหน้า welcome
   * 
   * Purpose:
   * - ปรับปรุง user experience โดย focus ช่อง input อัตโนมัติ
   * - ช่วยให้ผู้ใช้เริ่มพิมพ์ได้ทันทีเมื่อเข้าหน้า
   * 
   * Logic:
   * - เฉพาะเมื่อ showWelcome = true
   * - ใช้ setTimeout เพื่อให้ DOM render เสร็จก่อน
   * 
   * Dependencies: [showWelcome]
   */
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

  /**
   * Effect สำหรับจัดการเมื่อ resetChat ถูกเรียก (เริ่ม chat ใหม่จาก sidebar)
   * 
   * Purpose:
   * - เคลียร์ข้อมูลการสนทนาเมื่อผู้ใช้กด "New Chat"
   * - รีเซ็ต state กลับสู่สถานะเริ่มต้น
   * - เตรียมพร้อมสำหรับการสนทนาใหม่
   * 
   * Process:
   * 1. ตรวจสอบว่า showWelcome = true (จาก context)
   * 2. เคลียร์ sessionId, messages, และ loadedMessages
   * 3. เตรียมพร้อมสำหรับการสนทนาใหม่
   * 
   * Dependencies: [showWelcome, setMessages]
   */
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

  /**
   * Effect สำหรับโหลดประวัติเมื่อมี sessionId และไม่ใช่ welcome state
   * 
   * Purpose:
   * - โหลดประวัติการสนทนาเมื่อมี session ID
   * - แสดงข้อความต่อจากที่เหลือไว้
   * - รองรับการกลับมาดูประวัติการสนทนา
   * 
   * Conditions:
   * - มี sessionId
   * - มี userId (ผู้ใช้ login แล้ว)
   * - ไม่ใช่ welcome state (showWelcome = false)
   * 
   * Dependencies: [sessionId, userId, showWelcome]
   */
  useEffect(() => {
    // โหลดประวัติเฉพาะเมื่อไม่ใช่ welcome state และมี sessionId
    if (sessionId && userId && !showWelcome) {
      loadChatHistory(sessionId)                                             // เรียกฟังก์ชันโหลดประวัติ
    }
  }, [sessionId, userId, showWelcome])

  // ============================================================================
  // STEP 8: EVENT HANDLER FUNCTIONS - ฟังก์ชันจัดการ Events
  // ============================================================================

  /**
   * ฟังก์ชันสำหรับจัดการการส่งข้อความ
   * 
   * Purpose:
   * - ตรวจสอบความถูกต้องของข้อมูล
   * - สร้าง message object ในรูปแบบที่ถูกต้อง
   * - ส่งข้อความไปยัง AI พร้อมข้อมูล context
   * - อัปเดต UI state
   * 
   * Validation:
   * - ข้อความต้องไม่ว่าง (trim)
   * - ต้องมี userId (ผู้ใช้ login แล้ว)
   * 
   * Process:
   * 1. ตรวจสอบข้อมูล input
   * 2. สร้าง message object
   * 3. ส่งข้อความพร้อม context
   * 4. รีเซ็ต input และซ่อน welcome
   */
  const handleSubmit = () => {
    // ตรวจสอบ userId และข้อความว่าง
    if (!prompt.trim() || !userId) return

    /**
     * สร้าง object message ด้วยโครงสร้าง `parts` ที่ถูกต้อง
     * 
     * Structure:
     * - role: 'user' - ระบุว่าเป็นข้อความจากผู้ใช้
     * - parts: array ของส่วนประกอบข้อความ
     *   - type: 'text' - ประเภทของเนื้อหา
     *   - text: เนื้อหาข้อความจริง
     */
    const messageToSend = {
      role: 'user' as const,
      parts: [{ type: 'text' as const, text: prompt.trim() }],
    };

    /**
     * เรียกใช้ sendMessage พร้อมส่ง body ที่มี context ข้อมูล
     * 
     * Body Parameters:
     * - userId: ID ของผู้ใช้สำหรับการระบุตัวตน
     * - sessionId: ID ของ session สำหรับความต่อเนื่อง
     */
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

  /**
   * ฟังก์ชันสำหรับจัดการ sample prompts
   * 
   * Purpose:
   * - ใส่ข้อความตัวอย่างใน input field
   * - ช่วยให้ผู้ใช้เริ่มต้นการสนทนาได้ง่าย
   * - ปรับปรุง user experience
   * 
   * @param samplePrompt - ข้อความตัวอย่างที่จะใส่ใน input
   */
  const handleSamplePrompt = (samplePrompt: string) => {
    setPrompt(samplePrompt)                                                  // ตั้งค่าข้อความใน input
  }

  /**
   * ฟังก์ชันสำหรับเริ่มแชทใหม่
   * 
   * Purpose:
   * - เคลียร์ข้อมูลการสนทนาปัจจุบัน
   * - รีเซ็ต state กลับสู่สถานะเริ่มต้น
   * - เตรียมพร้อมสำหรับการสนทนาใหม่
   * 
   * Process:
   * 1. ล้าง session ID
   * 2. ล้างข้อความที่โหลดจากประวัติ
   * 3. ลบ session ID จาก localStorage
   * 4. Context จะจัดการ showWelcome ให้
   */
  const startNewChat = () => {
    setSessionId(undefined)                                                  // ล้าง session ID
    setLoadedMessages([])                                                    // ล้างข้อความที่โหลด
    localStorage.removeItem('currentSessionId')                             // ลบจาก localStorage
    // ไม่ต้องเซ็ต setShowWelcome(true) เพราะ context จะจัดการให้
  }

  // ============================================================================
  // STEP 9: AUTHENTICATION GUARD - การตรวจสอบสิทธิ์การเข้าถึง
  // ============================================================================

  /**
   * แสดงข้อความเมื่อไม่มี userId (ผู้ใช้ยังไม่ได้ login)
   * 
   * Purpose:
   * - ป้องกันการใช้งานโดยผู้ที่ไม่ได้ login
   * - แสดงข้อความแนะนำให้ผู้ใช้เข้าสู่ระบบ
   * - ปรับปรุง security และ user experience
   * 
   * UI Components:
   * - Header พร้อม sidebar trigger
   * - ข้อความแจ้งให้ login
   * - Layout ที่สอดคล้องกับหน้าหลัก
   */
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

  /**
   * Main render section - ส่วนแสดงผลหลักของ component
   * 
   * Structure:
   * 1. Header - ส่วนหัวพร้อม navigation
   * 2. Chat Container - ส่วนแสดงข้อความ
   * 3. Input Section - ส่วนรับ input จากผู้ใช้
   * 
   * Conditional Rendering:
   * - Welcome Screen: เมื่อเริ่มการสนทนาใหม่
   * - Chat History: เมื่อมีข้อความในการสนทนา
   */
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
              <div className="text-center max-w-2xl mx-auto">
                
                {/* AI Avatar และ Welcome Message */}
                <div className="mb-8">
                  <div className="h-20 w-20 mx-auto mb-6 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                    <span className="text-white font-bold text-2xl">AI</span>
                  </div>
                  <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-4">
                    Welcome to Genius AI
                  </h1>
                  <p className="text-lg text-slate-600 dark:text-slate-400 mb-8">
                    Ask me anything, and I&aposll help you with coding,
                    problem-solving, and creative tasks.
                  </p>
                </div>

                {/* Sample Prompts Grid - ตัวอย่างคำถามสำหรับ quick start */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                  
                  {/* Sample Prompt 1: CSS Grid Layout */}
                  <button
                    onClick={() =>
                      handleSamplePrompt(
                        "How do I create a responsive layout with CSS Grid?"
                      )
                    }
                    className="p-4 text-left rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <div className="font-medium text-slate-900 dark:text-white mb-1">
                      CSS Grid Layout
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-400">
                      Learn how to create responsive layouts
                    </div>
                  </button>

                  {/* Sample Prompt 2: React Hooks */}
                  <button
                    onClick={() =>
                      handleSamplePrompt(
                        "Explain React hooks and when to use them"
                      )
                    }
                    className="p-4 text-left rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <div className="font-medium text-slate-900 dark:text-white mb-1">
                      React Hooks
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-400">
                      Understanding hooks and their use cases
                    </div>
                  </button>

                  {/* Sample Prompt 3: API Design */}
                  <button
                    onClick={() =>
                      handleSamplePrompt(
                        "What are the best practices for API design?"
                      )
                    }
                    className="p-4 text-left rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <div className="font-medium text-slate-900 dark:text-white mb-1">
                      API Design
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-400">
                      Best practices for building APIs
                    </div>
                  </button>

                  {/* Sample Prompt 4: JavaScript Debugging */}
                  <button
                    onClick={() =>
                      handleSamplePrompt("Help me debug this JavaScript error")
                    }
                    className="p-4 text-left rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <div className="font-medium text-slate-900 dark:text-white mb-1">
                      Debug JavaScript
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-400">
                      Get help with debugging code issues
                    </div>
                  </button>
                </div>
              </div>
            ) : (
              // ============================================================================
              // CHAT MESSAGES DISPLAY - การแสดงข้อความการสนทนา
              // ============================================================================
              
              /**
               * Chat Messages Section
               * 
               * Purpose:
               * - แสดงข้อความจากประวัติ (loadedMessages)
               * - แสดงข้อความใหม่ (messages จาก useChat)
               * - รองรับทั้ง user และ assistant messages
               * - แสดง message actions (copy, like, edit, etc.)
               */
              <div className="space-y-3 max-w-3xl mx-auto w-full">
                
                {/* รวม loadedMessages และ messages จาก useChat */}
                {[...loadedMessages, ...messages].map((message, index) => {
                  const isAssistant = message.role === "assistant"            // ตรวจสอบว่าเป็นข้อความจาก AI หรือไม่
                  
                  return (
                    /**
                     * Message Component
                     * 
                     * Props:
                     * - key: unique identifier สำหรับ React rendering
                     * - isAssistant: boolean สำหรับแยกประเภทข้อความ
                     * - bubbleStyle: ใช้ bubble style สำหรับแสดงผล
                     */
                    <Message
                      key={`${message.id}-${index}`}                         // unique key สำหรับ React
                      isAssistant={isAssistant}                              // ระบุประเภทข้อความ
                      bubbleStyle={true}                                     // ใช้ bubble style
                    >
                      
                      {/* Message Content - เนื้อหาข้อความ */}
                      <MessageContent
                        isAssistant={isAssistant}
                        bubbleStyle={true}
                        markdown                                             // แสดงเป็น markdown format
                      >
                        {/* แปลงข้อความจาก parts structure เป็น string */}
                        {typeof message === 'object' && 'parts' in message && message.parts
                          ? message.parts.map((part) => 
                              'text' in part ? part.text : ''
                            ).join('')
                          : String(message)}
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
                          >
                            <Copy size={14} />
                          </Button>
                        </MessageAction>
                        
                        {/* Assistant Message Actions - ปุ่มสำหรับข้อความจาก AI */}
                        {isAssistant && (
                          <>
                            {/* Upvote Button */}
                            <MessageAction tooltip="Upvote" bubbleStyle={true}>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-gray-500 hover:text-gray-700 rounded-full"
                              >
                                <ThumbsUp size={14} />
                              </Button>
                            </MessageAction>
                            
                            {/* Downvote Button */}
                            <MessageAction tooltip="Downvote" bubbleStyle={true}>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-gray-500 hover:text-gray-700 rounded-full"
                              >
                                <ThumbsDown size={14} />
                              </Button>
                            </MessageAction>
                          </>
                        )}
                        
                        {/* User Message Actions - ปุ่มสำหรับข้อความจากผู้ใช้ */}
                        {!isAssistant && (
                          <>
                            {/* Edit Button */}
                            <MessageAction tooltip="Edit" bubbleStyle={true}>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-gray-500 hover:text-gray-700 rounded-full"
                              >
                                <Pencil size={14} />
                              </Button>
                            </MessageAction>
                            
                            {/* Delete Button */}
                            <MessageAction tooltip="Delete" bubbleStyle={true}>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-gray-500 hover:text-gray-700 rounded-full"
                              >
                                <Trash size={14} />
                              </Button>
                            </MessageAction>
                          </>
                        )}
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
      
      <div className="bg-background z-10 shrink-0 px-3 pb-3 md:px-5 md:pb-5">
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
          
          {/*
           * PromptInput Component
           * 
           * Purpose:
           * - รับข้อความจากผู้ใช้
           * - จัดการ loading state
           * - ส่งข้อความเมื่อกด Enter หรือคลิกปุ่ม
           * 
           * Props:
           * - isLoading: สถานะการโหลด
           * - value: ข้อความในปัจจุบัน
           * - onValueChange: callback เมื่อข้อความเปลี่ยน
           * - onSubmit: callback เมื่อส่งข้อความ
           */}
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
              
              {/*
               * PromptInputTextarea Component
               * 
               * Purpose:
               * - รับข้อความจากผู้ใช้
               * - รองรับ multiline input
               * - Auto-focus เมื่อเข้าหน้า welcome
               * 
               * Features:
               * - Auto-resize ตามเนื้อหา
               * - Placeholder text
               * - Keyboard shortcuts
               */}
              <PromptInputTextarea
                ref={textareaRef}
                placeholder="Ask anything to start a new chat..."
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

                  {/* Send Button - ปุ่มส่งข้อความ */}
                  {/*
                   * Send Button
                   * 
                   * Purpose:
                   * - ส่งข้อความไปยัง AI
                   * - แสดง loading state
                   * - ตรวจสอบความพร้อมก่อนส่ง
                   * 
                   * Disabled Conditions:
                   * - ข้อความว่าง (!prompt.trim())
                   * - ไม่ ready (status !== &apos;ready&apos;)
                   * - ไม่มี userId
                   */}
                  <Button
                    size="icon"
                    disabled={!prompt.trim() || status !== 'ready' || !userId}
                    onClick={handleSubmit}
                    className="size-9 rounded-full"
                  >
                    {/* แสดง icon ตาม status */}
                    {status === 'ready' ? (
                      /* แสดงลูกศรเมื่อพร้อม */
                      <ArrowUp size={18} />
                    ) : (
                      /* แสดง loading indicator */
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
