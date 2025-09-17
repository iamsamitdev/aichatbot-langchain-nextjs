/**
 * ===============================================
 * useChatHistory Hook - Custom Hook สำหรับจัดการประวัติการสนทนา
 * ===============================================
 * 
 * คำอธิบาย:
 * Custom Hook สำหรับจัดการประวัติการสนทนาแบบครบวงจร
 * รองรับการส่งข้อความแบบ streaming, โหลดประวัติ, และจัดการ sessions
 * 
 * ฟีเจอร์หลัก:
 * - ส่งข้อความและรับคำตอบแบบ real-time streaming
 * - โหลดประวัติการสนทนาจาก session ID
 * - จัดการ session state และ error handling
 * - รองรับการสร้าง chat ใหม่และสลับ session
 * - ส่งข้อความผ่าน form submission
 */

"use client"

import { useState, useCallback } from 'react'
import { generateUniqueId } from '@/lib/utils'
import { API_BASE } from '@/constants/api'

// ===============================================
// Interface Definitions - กำหนดโครงสร้างข้อมูล
// ===============================================

/**
 * Interface สำหรับ Chat Message
 * 
 * @param id - ID เฉพาะของข้อความ
 * @param role - บทบาทของผู้ส่ง (user, assistant, system)
 * @param content - เนื้อหาข้อความ
 * @param createdAt - เวลาที่สร้างข้อความ (optional)
 */
export interface ChatMessage {
  id: string                                    // ID เฉพาะของข้อความ
  role: 'user' | 'assistant' | 'system'        // บทบาทของผู้ส่งข้อความ
  content: string                               // เนื้อหาข้อความ
  createdAt?: string                            // เวลาที่สร้างข้อความ (ISO string)
}

// ===============================================
// Main Hook Function - ฟังก์ชันหลักของ Custom Hook
// ===============================================

/**
 * useChatHistory Hook
 * 
 * Hook สำหรับจัดการประวัติการสนทนาและ real-time messaging
 * 
 * @param initialSessionId - Session ID เริ่มต้น (optional)
 * @param userId - ID ของผู้ใช้สำหรับ authentication (optional)
 * 
 * @returns Object ที่ประกอบด้วย states, actions และ functions ต่างๆ
 */
export function useChatHistory(initialSessionId?: string, userId?: string) {
  
  // ===============================================
  // State Management - การจัดการ State ต่างๆ
  // ===============================================
  
  /**
   * Session ID ปัจจุบันที่กำลังใช้งาน
   * undefined หมายถึงยังไม่มี session หรือ session ใหม่
   */
  const [currentSessionId, setCurrentSessionId] = useState<string | undefined>(initialSessionId)
  
  /**
   * รายการข้อความในการสนทนาปัจจุบัน
   * Array ของ ChatMessage objects
   */
  const [messages, setMessages] = useState<ChatMessage[]>([])
  
  /**
   * สถานะการส่งข้อความ
   * true = กำลังส่งข้อความและรอคำตอบ
   */
  const [loading, setLoading] = useState(false)
  
  /**
   * สถานะการโหลดประวัติการสนทนา
   * true = กำลังโหลดประวัติจาก database
   */
  const [loadingHistory, setLoadingHistory] = useState(false)
  
  /**
   * ข้อผิดพลาดที่เกิดขึ้นในการทำงาน
   * null หมายถึงไม่มีข้อผิดพลาด
   */
  const [historyError, setHistoryError] = useState<string | null>(null)
  
  /**
   * ข้อความที่ผู้ใช้พิมพ์ใน input field
   */
  const [input, setInput] = useState('')

  /**
   * AbortController สำหรับยกเลิกการส่งข้อความ
   */
  const [abortController, setAbortController] = useState<AbortController | null>(null)

  // ===============================================
  // Main Functions - ฟังก์ชันหลักของ Hook
  // ===============================================
  
  /**
   * ฟังก์ชันส่งข้อความและรับคำตอบแบบ streaming
   * 
   * Flow การทำงาน:
   * 1. ตรวจสอบเงื่อนไข (ข้อความไม่ว่าง, ไม่กำลัง loading)
   * 2. เพิ่มข้อความของผู้ใช้ลง UI
   * 3. แปลงข้อความเป็นรูปแบบ AI SDK
   * 4. ส่ง request ไป API
   * 5. อ่าน response แบบ streaming
   * 6. อัพเดท UI แบบ real-time
   * 7. จัดการ error หากมี
   * 
   * @param message - ข้อความที่ต้องการส่ง
   * @returns Promise<void>
   */
  const sendMessage = useCallback(async (message: string) => {
    // Step 1: ตรวจสอบเงื่อนไขเบื้องต้น
    if (!message.trim() || loading) return

    // เริ่มสถานะ loading และเคลียร์ error
    setLoading(true)
    setHistoryError(null)

    // สร้าง AbortController สำหรับยกเลิกการส่ง
    const controller = new AbortController()
    setAbortController(controller)

    // Step 2: สร้างข้อความของผู้ใช้พร้อม temporary ID
    const userMessage: ChatMessage = {
      id: generateUniqueId('temp-user'),       // ID ชั่วคราวสำหรับ UI
      role: 'user',                            // ระบุว่าเป็นข้อความจากผู้ใช้
      content: message,                        // เนื้อหาข้อความ
      createdAt: new Date().toISOString(),     // เวลาปัจจุบัน
    }

    // เพิ่มข้อความผู้ใช้ลง state และ clear input
    const updatedMessages = [...messages, userMessage]
    setMessages(updatedMessages)
    setInput('')

    // Step 3: แปลงข้อความให้เป็นรูปแบบที่ API รองรับ (AI SDK format)
    const apiMessages = updatedMessages.map(msg => ({
      id: msg.id,
      role: msg.role,
      parts: [{ type: 'text', text: msg.content }]
    }))

    try {
      // Step 4: ส่ง request ไปยัง API
      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: apiMessages,                // ข้อความทั้งหมดในการสนทนา
          sessionId: currentSessionId,          // Session ID ปัจจุบัน
          userId: userId,                       // ID ของผู้ใช้จาก auth system
        }),
        signal: controller.signal,              // เพิ่ม AbortSignal
      })

      if (!response.ok) {
        throw new Error('Failed to send message')
      }

      // Step 5: ดึง sessionId จาก response header
      const sessionId = response.headers.get('x-session-id')
      if (sessionId && !currentSessionId) {
        setCurrentSessionId(sessionId)
      }

      // Step 6: เตรียมอ่าน response stream
      const reader = response.body?.getReader()
      if (!reader) throw new Error('No response body')

      // สร้างข้อความ AI เปล่าๆ สำหรับแสดงใน UI
      const assistantMessage: ChatMessage = {
        id: generateUniqueId('temp-assistant'), // ID ชั่วคราวสำหรับ AI
        role: 'assistant',                      // ระบุว่าเป็นข้อความจาก AI
        content: '',                            // เริ่มต้นด้วยเนื้อหาว่าง
        createdAt: new Date().toISOString(),
      }

      // เพิ่มข้อความ AI ลง UI
      setMessages(prev => [...prev, assistantMessage])

      // Step 7: อ่านและประมวลผล streaming response
      const decoder = new TextDecoder()
      let accumulatedContent = ''              // เก็บเนื้อหาที่ได้รับทั้งหมด

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        
        // แยกบรรทัดใน chunk (SSE format)
        const lines = chunk.split('\n')
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const jsonStr = line.slice(6)     // ตัด "data: " ออก
              if (jsonStr === '[DONE]') break
              
              const data = JSON.parse(jsonStr)
              
              // ตรวจสอบรูปแบบข้อมูลจาก AI SDK
              if (data.type === 'text-delta' && data.delta) {
                accumulatedContent += data.delta
                
                // อัพเดทเนื้อหาข้อความของ AI แบบ real-time
                setMessages(prev => prev.map(msg => 
                  msg.id === assistantMessage.id 
                    ? { ...msg, content: accumulatedContent }
                    : msg
                ))
              }
            } catch (e) {
              // ถ้า parse JSON ไม่ได้ ข้ามไปไม่ต้อง error
              console.warn('Failed to parse streaming data:', line)
              console.error(e)
            }
          }
        }
      }
    } catch (error) {
      // Step 8: จัดการ error
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Request was aborted')
      } else {
        setHistoryError(error instanceof Error ? error.message : 'Unknown error')
        console.error('Send message error:', error)
      }
    } finally {
      // Step 9: จบกระบวนการ - ปิด loading และเคลียร์ controller
      setLoading(false)
      setAbortController(null)
    }
  }, [messages, currentSessionId, loading]) // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * ฟังก์ชันหยุดการส่งข้อความ
   */
  const stopMessage = useCallback(() => {
    if (abortController) {
      abortController.abort()
      setAbortController(null)
      setLoading(false)
    }
  }, [abortController])

  // ===============================================
  // History Management Functions - ฟังก์ชันจัดการประวัติ
  // ===============================================
  
  /**
   * ฟังก์ชันโหลดประวัติข้อความจาก session
   * 
   * Flow การทำงาน:
   * 1. เริ่มสถานะ loading และเคลียร์ error
   * 2. ส่ง GET request ไป API พร้อม sessionId
   * 3. ดึงข้อมูลข้อความจาก response
   * 4. อัพเดท messages state
   * 5. จัดการ error หากมี
   * 
   * @param sessionId - ID ของ session ที่ต้องการโหลดประวัติ
   * @returns Promise<void>
   */
  const loadChatHistory = async (sessionId: string) => {
    // Step 1: เริ่มสถานะ loading
    setLoadingHistory(true)
    setHistoryError(null)
    
    try {
      // Step 2: ส่ง request ไป API สำหรับดึงประวัติ
      const apiUrl = `${API_BASE}?sessionId=${sessionId}`
      const response = await fetch(apiUrl)
      
      if (!response.ok) {
        throw new Error('Failed to load chat history')
      }
      
      // Step 3: ดึงข้อมูลจาก response
      const data = await response.json()
      const loadedMessages: ChatMessage[] = data.messages || []
      
      // Step 4: อัพเดท state
      setMessages(loadedMessages)              // ตั้งค่าข้อความที่โหลดมา
      setCurrentSessionId(sessionId)          // ตั้งค่า session ID ปัจจุบัน
      
    } catch (err) {
      // Step 5: จัดการ error
      setHistoryError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      // Step 6: ปิด loading state
      setLoadingHistory(false)
    }
  }

  // ===============================================
  // Session Management Functions - ฟังก์ชันจัดการ Session
  // ===============================================
  
  /**
   * ฟังก์ชันเริ่ม chat session ใหม่
   * 
   * การทำงาน:
   * - เคลียร์ session ID ปัจจุบัน
   * - เคลียร์ข้อความทั้งหมด
   * - เคลียร์ error state
   * - เคลียร์ input field
   */
  const startNewChat = () => {
    setCurrentSessionId(undefined)           // ไม่มี session ID (session ใหม่)
    setMessages([])                          // เคลียร์ข้อความทั้งหมด
    setHistoryError(null)                    // เคลียร์ error
    setInput('')                             // เคลียร์ input field
  }

  /**
   * ฟังก์ชันสลับไปยัง session อื่น
   * 
   * การทำงาน:
   * 1. ตรวจสอบว่าเป็น session เดียวกันหรือไม่
   * 2. ถ้าไม่ใช่ ให้โหลดประวัติของ session ใหม่
   * 
   * @param sessionId - ID ของ session ที่ต้องการสลับไป
   * @returns Promise<void>
   */
  const switchToSession = async (sessionId: string) => {
    // Step 1: ตรวจสอบว่าเป็น session เดียวกันหรือไม่
    if (sessionId === currentSessionId) return
    
    // Step 2: โหลดประวัติของ session ใหม่
    await loadChatHistory(sessionId)
  }

  // ===============================================
  // Form Handling Functions - ฟังก์ชันจัดการ Form
  // ===============================================
  
  /**
   * ฟังก์ชันจัดการการ submit form
   * 
   * การทำงาน:
   * 1. ป้องกัน default form submission
   * 2. ตรวจสอบว่ามีข้อความใน input หรือไม่
   * 3. เรียก sendMessage ถ้ามีข้อความ
   * 
   * @param e - React Form Event
   */
  const handleSubmit = (e: React.FormEvent) => {
    // Step 1: ป้องกัน page reload
    e.preventDefault()
    
    // Step 2 & 3: ตรวจสอบและส่งข้อความ
    if (input.trim()) {
      sendMessage(input)
    }
  }

  // ===============================================
  // Return Object - การส่งคืนค่าจาก Hook
  // ===============================================
  
  /**
   * ส่งคืน object ที่ประกอบด้วย states และ functions
   * แบ่งเป็นกลุ่มตามการใช้งาน:
   * 
   * 1. Messages and State - ข้อมูลข้อความและสถานะ
   * 2. Actions - การกระทำต่างๆ
   * 3. Session Management - การจัดการ session
   * 4. Loading States - สถานะการโหลดต่างๆ
   */
  return {
    // ===============================================
    // Messages and State - ข้อมูลข้อความและสถานะ
    // ===============================================
    messages,           // รายการข้อความในการสนทนาปัจจุบัน
    loading,            // สถานะการส่งข้อความ (true = กำลังส่ง)
    input,              // ข้อความที่ผู้ใช้พิมพ์ใน input field
    setInput,           // ฟังก์ชันตั้งค่าข้อความใน input field
    
    // ===============================================
    // Actions - การกระทำต่างๆ
    // ===============================================
    sendMessage,        // ฟังก์ชันส่งข้อความ (รับ string parameter)
    stopMessage,        // ฟังก์ชันหยุดการส่งข้อความ
    handleSubmit,       // ฟังก์ชันจัดการ form submission
    
    // ===============================================
    // Session Management - การจัดการ session
    // ===============================================
    currentSessionId,   // Session ID ปัจจุบัน (undefined = session ใหม่)
    setCurrentSessionId, // ฟังก์ชันตั้งค่า session ID
    loadChatHistory,    // ฟังก์ชันโหลดประวัติจาก session ID
    startNewChat,       // ฟังก์ชันเริ่ม chat ใหม่ (เคลียร์ทุกอย่าง)
    switchToSession,    // ฟังก์ชันสลับไป session อื่น
    
    // ===============================================
    // Loading States - สถานะการโหลดต่างๆ
    // ===============================================
    loadingHistory,     // สถานะการโหลดประวัติ (true = กำลังโหลด)
    historyError,       // ข้อผิดพลาดที่เกิดขึ้น (null = ไม่มี error)
  }
}