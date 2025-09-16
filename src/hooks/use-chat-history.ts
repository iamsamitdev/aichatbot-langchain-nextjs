/**
 * ===============================================
 * Chat History Custom Hook
 * ===============================================
 * 
 * Purpose: จัดการประวัติการสนทนาและการส่งข้อความ
 * 
 * Features:
 * - ส่งข้อความแบบ streaming response
 * - จัดการประวัติการสนทนา
 * - โหลดข้อความจาก session ต่างๆ
 * - สลับระหว่าง sessions
 * - จัดการ loading states และ errors
 * 
 * Hook Pattern: Custom React Hook
 * - ใช้ useState สำหรับ state management
 * - ใช้ useCallback สำหรับ performance optimization
 * - ส่งคืน object ที่มี state และ functions
 * 
 * API Integration:
 * - เชื่อมต่อกับ /api/chat_06_summary
 * - รองรับ streaming responses
 * - จัดการ session management
 */

"use client"

import { useState, useCallback } from 'react'
import { generateUniqueId } from '@/lib/utils'

// ===============================================
// TypeScript Interface Definitions - กำหนด Type Definitions
// ===============================================

/**
 * Interface สำหรับข้อความในการสนทนา
 * 
 * Properties:
 * - id: ID เฉพาะของข้อความ
 * - role: บทบาทของผู้ส่ง (user/assistant/system)
 * - content: เนื้อหาข้อความ
 * - createdAt: เวลาที่สร้างข้อความ (optional)
 */
export interface ChatMessage {
  id: string                                                                // ID เฉพาะของข้อความ
  role: 'user' | 'assistant' | 'system'                                    // บทบาทของผู้ส่ง
  content: string                                                           // เนื้อหาข้อความ
  createdAt?: string                                                        // เวลาที่สร้าง (ISO string)
}

// ===============================================
// Main Custom Hook: useChatHistory
// ===============================================

/**
 * useChatHistory Hook: จัดการประวัติการสนทนาและการส่งข้อความ
 * 
 * Purpose:
 * - จัดการ state ของการสนทนา
 * - ส่งข้อความไปยัง AI และรับ response
 * - โหลดและจัดการประวัติการสนทนา
 * - สลับระหว่าง chat sessions
 * 
 * Parameters:
 * - initialSessionId: session ID เริ่มต้น (optional)
 * - userId: ID ของผู้ใช้ (optional)
 * 
 * @param initialSessionId - Session ID เริ่มต้น
 * @param userId - User ID สำหรับ authentication
 * @returns Object ที่มี state และ functions สำหรับจัดการ chat
 */
export function useChatHistory(initialSessionId?: string, userId?: string) {
  // ===============================================
  // Step 1: State Management - จัดการ State ต่างๆ
  // ===============================================
  
  /**
   * State สำหรับ session ID ปัจจุบัน
   * 
   * Usage:
   * - เก็บ ID ของ session ที่กำลังใช้งาน
   * - undefined หมายถึงยังไม่มี session (จะสร้างใหม่)
   */
  const [currentSessionId, setCurrentSessionId] = useState<string | undefined>(initialSessionId)
  
  /**
   * State สำหรับรายการข้อความในการสนทนา
   * 
   * Usage:
   * - เก็บข้อความทั้งหมดในการสนทนาปัจจุบัน
   * - แสดงใน UI เป็น chat messages
   */
  const [messages, setMessages] = useState<ChatMessage[]>([])              // รายการข้อความ
  
  /**
   * State สำหรับสถานะการส่งข้อความ
   * 
   * Usage:
   * - true: กำลังส่งข้อความ (แสดง loading indicator)
   * - false: พร้อมส่งข้อความใหม่
   */
  const [loading, setLoading] = useState(false)                            // สถานะการส่งข้อความ
  
  /**
   * State สำหรับสถานะการโหลดประวัติ
   * 
   * Usage:
   * - true: กำลังโหลดประวัติจาก server
   * - false: โหลดเสร็จแล้วหรือยังไม่ได้โหลด
   */
  const [loadingHistory, setLoadingHistory] = useState(false)              // สถานะการโหลดประวัติ
  
  /**
   * State สำหรับข้อผิดพลาดของประวัติ
   * 
   * Usage:
   * - null: ไม่มีข้อผิดพลาด
   * - string: ข้อความ error ที่เกิดขึ้น
   */
  const [historyError, setHistoryError] = useState<string | null>(null)    // ข้อผิดพลาดของประวัติ
  
  /**
   * State สำหรับข้อความที่กำลังพิมพ์
   * 
   * Usage:
   * - เก็บข้อความใน input field
   * - ใช้สำหรับ controlled input
   */
  const [input, setInput] = useState('')                                   // ข้อความที่กำลังพิมพ์

  // ===============================================
  // Step 2: Send Message Function - ฟังก์ชันส่งข้อความ
  // ===============================================
  
  /**
   * ฟังก์ชันส่งข้อความไปยัง AI และรับ response แบบ streaming
   * 
   * Purpose:
   * - ส่งข้อความของผู้ใช้ไปยัง API
   * - รับ response จาก AI แบบ streaming
   * - อัปเดต UI แบบ real-time
   * - จัดการ session และ error
   * 
   * Process Flow:
   * 1. Validate input และ loading state
   * 2. เพิ่มข้อความผู้ใช้ลง messages
   * 3. ส่ง request ไปยัง API
   * 4. อ่าน streaming response
   * 5. อัปเดตข้อความ AI แบบ real-time
   * 
   * @param message - ข้อความที่จะส่ง
   */
  const sendMessage = useCallback(async (message: string) => {
    // ===============================================
    // Step 2.1: Input Validation - ตรวจสอบ Input
    // ===============================================
    
    /**
     * ตรวจสอบความถูกต้องของ input
     * 
     * Conditions:
     * - message ต้องไม่เป็นค่าว่าง (หลัง trim)
     * - ต้องไม่อยู่ในสถานะ loading
     */
    if (!message.trim() || loading) return                                 // ออกจากฟังก์ชันหาก input ไม่ถูกต้อง

    // ===============================================
    // Step 2.2: Set Loading State - ตั้งค่าสถานะ Loading
    // ===============================================
    
    /**
     * ตั้งค่า loading state และ reset error
     * 
     * Purpose:
     * - แสดง loading indicator ใน UI
     * - ป้องกันการส่งข้อความซ้ำ
     * - ล้าง error ก่อนหน้า
     */
    setLoading(true)                                                        // เริ่ม loading
    setHistoryError(null)                                                   // ล้าง error

    // ===============================================
    // Step 2.3: Create User Message - สร้างข้อความผู้ใช้
    // ===============================================
    
    /**
     * สร้างข้อความของผู้ใช้สำหรับแสดงใน UI
     * 
     * Message Structure:
     * - id: temporary ID สำหรับ UI
     * - role: 'user' (ข้อความจากผู้ใช้)
     * - content: เนื้อหาข้อความ
     * - createdAt: timestamp ปัจจุบัน
     */
    const userMessage: ChatMessage = {
      id: generateUniqueId('temp-user'),                                    // สร้าง temporary ID
      role: 'user',                                                         // บทบาทผู้ใช้
      content: message,                                                     // เนื้อหาข้อความ
      createdAt: new Date().toISOString(),                                 // timestamp ปัจจุบัน
    }

    /**
     * อัปเดตรายการข้อความด้วยข้อความใหม่ของผู้ใช้
     * 
     * Purpose:
     * - แสดงข้อความผู้ใช้ใน UI ทันที
     * - เตรียมข้อมูลสำหรับส่งไป API
     */
    const updatedMessages = [...messages, userMessage]                     // เพิ่มข้อความใหม่
    setMessages(updatedMessages)                                            // อัปเดต state
    setInput('')                                                            // ล้าง input field

    // ===============================================
    // Step 2.4: Prepare API Request - เตรียมข้อมูลสำหรับ API
    // ===============================================
    
    /**
     * แปลงข้อความให้เป็นรูปแบบที่ API รองรับ (AI SDK format)
     * 
     * Format Conversion:
     * - ChatMessage → AI SDK Message format
     * - เพิ่ม parts array สำหรับ text content
     */
    const apiMessages = updatedMessages.map(msg => ({
      id: msg.id,                                                           // ID ข้อความ
      role: msg.role,                                                       // บทบาท
      parts: [{ type: 'text', text: msg.content }]                         // เนื้อหาในรูปแบบ parts
    }))

    try {
      // ===============================================
      // Step 2.5: Send API Request - ส่ง Request ไปยัง API
      // ===============================================
      
      /**
       * ส่ง HTTP POST request ไปยัง chat API
       * 
       * Request Data:
       * - messages: ข้อความทั้งหมดในรูปแบบ AI SDK
       * - sessionId: ID ของ session ปัจจุบัน
       * - userId: ID ของผู้ใช้สำหรับ authentication
       */
      const response = await fetch('/api/chat_06_summary', {
        method: 'POST',                                                     // HTTP POST method
        headers: {
          'Content-Type': 'application/json',                              // กำหนด content type
        },
        body: JSON.stringify({
          messages: apiMessages,                                            // ข้อความทั้งหมด
          sessionId: currentSessionId,                                      // session ID ปัจจุบัน
          userId: userId,                                                   // user ID สำหรับ auth
        }),
      })

      /**
       * ตรวจสอบ HTTP response status
       * 
       * Error Handling:
       * - ถ้า response ไม่ ok ให้ throw error
       */
      if (!response.ok) {
        throw new Error('Failed to send message')                          // ข้อผิดพลาดการส่งข้อความ
      }

      // ===============================================
      // Step 2.6: Handle Session ID - จัดการ Session ID
      // ===============================================
      
      /**
       * ดึง sessionId จาก response header
       * 
       * Purpose:
       * - สำหรับ session ใหม่ที่ server สร้างให้
       * - อัปเดต currentSessionId สำหรับการใช้งานต่อไป
       */
      const sessionId = response.headers.get('x-session-id')               // ดึง session ID จาก header
      if (sessionId && !currentSessionId) {
        setCurrentSessionId(sessionId)                                      // อัปเดต session ID
      }

      // ===============================================
      // Step 2.7: Setup Streaming Response - ตั้งค่าการรับ Streaming
      // ===============================================
      
      /**
       * เตรียมการอ่าน streaming response
       * 
       * Streaming Benefits:
       * - แสดงข้อความ AI แบบ real-time
       * - ผู้ใช้เห็นการตอบกลับทันที
       * - ประสบการณ์การใช้งานที่ดีกว่า
       */
      const reader = response.body?.getReader()                            // สร้าง stream reader
      if (!reader) throw new Error('No response body')                     // ตรวจสอบ response body

      /**
       * สร้างข้อความเริ่มต้นสำหรับ AI response
       * 
       * Initial Message:
       * - เริ่มต้นด้วย content ว่าง
       * - จะอัปเดต content ขณะรับ streaming data
       */
      const assistantMessage: ChatMessage = {
        id: generateUniqueId('temp-assistant'),                            // สร้าง temporary ID
        role: 'assistant',                                                  // บทบาท AI assistant
        content: '',                                                        // เริ่มต้นด้วยข้อความว่าง
        createdAt: new Date().toISOString(),                               // timestamp ปัจจุบัน
      }

      /**
       * เพิ่มข้อความ AI เริ่มต้นลงใน messages
       * 
       * Purpose:
       * - แสดง placeholder สำหรับข้อความ AI
       * - เตรียมไว้สำหรับอัปเดต content
       */
      setMessages(prev => [...prev, assistantMessage])                     // เพิ่มข้อความ AI

      // ===============================================
      // Step 2.8: Process Streaming Data - ประมวลผล Streaming Data
      // ===============================================
      
      /**
       * ตัวแปรสำหรับเก็บข้อมูล streaming
       * 
       * Variables:
       * - decoder: แปลง bytes เป็น text
       * - accumulatedContent: เก็บเนื้อหาที่สะสม
       */
      const decoder = new TextDecoder()                                     // สร้าง text decoder
      let accumulatedContent = ''                                           // เนื้อหาที่สะสม

      /**
       * วนลูปอ่าน streaming data จนเสร็จสิ้น
       * 
       * Process:
       * 1. อ่าน chunk ข้อมูลจาก stream
       * 2. แปลง bytes เป็น text
       * 3. ประมวลผล text และอัปเดต UI
       * 4. ทำซ้ำจนถึง end of stream
       */
      while (true) {
        const { done, value } = await reader.read()                        // อ่าน chunk ข้อมูล
        if (done) break                                                     // ออกจากลูปเมื่อเสร็จสิ้น

        const chunk = decoder.decode(value, { stream: true })              // แปลง bytes เป็น text
        
        /**
         * แยกบรรทัดใน chunk
         * 
         * Reason:
         * - Server-Sent Events format ใช้ newline แยกข้อมูล
         * - แต่ละบรรทัดอาจมีข้อมูล JSON
         */
        const lines = chunk.split('\n')                                     // แยกบรรทัด
        
        /**
         * ประมวลผลแต่ละบรรทัดใน chunk
         * 
         * Process:
         * 1. ตรวจสอบ format ของบรรทัด
         * 2. แปลง JSON data
         * 3. อัปเดตเนื้อหาข้อความ
         */
        for (const line of lines) {
          if (line.startsWith('data: ')) {                                  // ตรวจสอบ SSE format
            try {
              const jsonStr = line.slice(6)                                 // ตัด "data: " ออก
              if (jsonStr === '[DONE]') break                               // สิ้นสุด streaming
              
              const data = JSON.parse(jsonStr)                              // แปลง JSON
              
              /**
               * ตรวจสอบรูปแบบข้อมูลจาก AI SDK
               * 
               * Expected Format:
               * - type: 'text-delta' (ข้อมูลข้อความใหม่)
               * - delta: เนื้อหาที่เพิ่มเข้ามา
               */
              if (data.type === 'text-delta' && data.delta) {
                accumulatedContent += data.delta                            // สะสมเนื้อหา
                
                /**
                 * อัปเดทเนื้อหาข้อความของ AI ใน UI
                 * 
                 * Process:
                 * - หาข้อความ AI ด้วย ID
                 * - อัปเดต content ด้วยเนื้อหาที่สะสม
                 */
                setMessages(prev => prev.map(msg => 
                  msg.id === assistantMessage.id 
                    ? { ...msg, content: accumulatedContent }              // อัปเดตเนื้อหา
                    : msg
                ))
              }
            } catch (e) {
              /**
               * จัดการ error ในการ parse JSON
               * 
               * Error Recovery:
               * - แสดง warning ใน console
               * - ข้ามบรรทัดที่ parse ไม่ได้
               * - ดำเนินการต่อ
               */
              console.warn('Failed to parse streaming data:', line)        // แสดง warning
              console.error(e)                                              // แสดง error details
            }
          }
        }
      }
    } catch (error) {
      // ===============================================
      // Step 2.9: Error Handling - จัดการข้อผิดพลาด
      // ===============================================
      
      /**
       * จัดการข้อผิดพลาดที่เกิดขึ้นระหว่างการส่งข้อความ
       * 
       * Error Recovery:
       * 1. ตั้งค่า error message
       * 2. แสดง error ใน console
       * 3. ให้ผู้ใช้ลองใหม่ได้
       */
      setHistoryError(error instanceof Error ? error.message : 'Unknown error') // ตั้งค่า error message
      console.error('Send message error:', error)                          // แสดง error ใน console
    } finally {
      // ===============================================
      // Step 2.10: Cleanup - ล้างสถานะ Loading
      // ===============================================
      
      /**
       * ล้างสถานะ loading เมื่อเสร็จสิ้น
       * 
       * Purpose:
       * - ซ่อน loading indicator
       * - เปิดให้ส่งข้อความใหม่ได้
       * - รันไม่ว่าจะสำเร็จหรือเกิด error
       */
      setLoading(false)                                                     // หยุด loading
    }
  }, [messages, currentSessionId, loading]) // eslint-disable-line react-hooks/exhaustive-deps

  // ===============================================
  // Step 3: Load Chat History Function - ฟังก์ชันโหลดประวัติการสนทนา
  // ===============================================
  
  /**
   * ฟังก์ชันโหลดประวัติข้อความจาก session ที่ระบุ
   * 
   * Purpose:
   * - ดึงข้อความทั้งหมดของ session จาก server
   * - อัปเดต messages state ด้วยข้อมูลที่ได้
   * - ตั้งค่า currentSessionId
   * - จัดการ loading state และ errors
   * 
   * Process Flow:
   * 1. ตั้งค่า loading state
   * 2. ส่ง GET request ไปยัง API
   * 3. ประมวลผล response data
   * 4. อัปเดต state ด้วยข้อมูลที่ได้
   * 5. จัดการ errors หากเกิดขึ้น
   * 
   * @param sessionId - ID ของ session ที่จะโหลด
   */
  const loadChatHistory = async (sessionId: string) => {
    // ===============================================
    // Step 3.1: Set Loading State - ตั้งค่าสถานะ Loading
    // ===============================================
    
    /**
     * ตั้งค่า loading state และ reset error
     * 
     * Purpose:
     * - แสดง loading indicator ขณะโหลดประวัติ
     * - ล้าง error ก่อนหน้า
     * - ป้องกันการโหลดซ้ำ
     */
    setLoadingHistory(true)                                                 // เริ่ม loading ประวัติ
    setHistoryError(null)                                                   // ล้าง error
    
    try {
      // ===============================================
      // Step 3.2: Fetch History Data - ดึงข้อมูลประวัติ
      // ===============================================
      
      /**
       * ส่ง GET request ไปยัง chat history API
       * 
       * API Endpoint: /api/chat_06_summary
       * Query Parameter: sessionId
       * 
       * Expected Response:
       * - messages: array ของ ChatMessage objects
       */
      const response = await fetch(`/api/chat_06_summary?sessionId=${sessionId}`)
      
      /**
       * ตรวจสอบ HTTP response status
       * 
       * Error Handling:
       * - ถ้า response ไม่ ok ให้ throw error
       */
      if (!response.ok) {
        throw new Error('Failed to load chat history')                     // ข้อผิดพลาดการโหลดประวัติ
      }
      
      // ===============================================
      // Step 3.3: Process Response Data - ประมวลผลข้อมูล Response
      // ===============================================
      
      /**
       * แปลง response เป็น JSON และดึงข้อมูลข้อความ
       * 
       * Data Structure:
       * - data.messages: array ของข้อความ
       * - หาก messages ไม่มี ให้ใช้ empty array
       */
      const data = await response.json()                                    // แปลง response เป็น JSON
      const loadedMessages: ChatMessage[] = data.messages || []             // ดึงข้อความหรือใช้ array ว่าง
      
      // ===============================================
      // Step 3.4: Update State - อัปเดต State
      // ===============================================
      
      /**
       * อัปเดต state ด้วยข้อมูลที่โหลดได้
       * 
       * Updates:
       * - messages: ข้อความทั้งหมดของ session
       * - currentSessionId: session ปัจจุบัน
       */
      setMessages(loadedMessages)                                           // อัปเดตรายการข้อความ
      setCurrentSessionId(sessionId)                                        // ตั้งค่า session ปัจจุบัน
      
    } catch (err) {
      // ===============================================
      // Step 3.5: Error Handling - จัดการข้อผิดพลาด
      // ===============================================
      
      /**
       * จัดการข้อผิดพลาดที่เกิดขึ้นระหว่างการโหลดประวัติ
       * 
       * Error Recovery:
       * - ตั้งค่า error message สำหรับแสดงให้ผู้ใช้
       * - ให้ผู้ใช้ลองโหลดใหม่ได้
       */
      setHistoryError(err instanceof Error ? err.message : 'Unknown error') // ตั้งค่า error message
    } finally {
      // ===============================================
      // Step 3.6: Cleanup - ล้างสถานะ Loading
      // ===============================================
      
      /**
       * ล้างสถานะ loading เมื่อเสร็จสิ้น
       * 
       * Purpose:
       * - ซ่อน loading indicator
       * - รันไม่ว่าจะสำเร็จหรือเกิด error
       */
      setLoadingHistory(false)                                              // หยุด loading ประวัติ
    }
  }

  // ===============================================
  // Step 4: New Chat Function - ฟังก์ชันเริ่มการสนทนาใหม่
  // ===============================================
  
  /**
   * ฟังก์ชันเริ่ม chat session ใหม่
   * 
   * Purpose:
   * - ล้างข้อมูลการสนทนาปัจจุบัน
   * - รีเซ็ต state กลับสู่สถานะเริ่มต้น
   * - เตรียมพร้อมสำหรับการสนทนาใหม่
   * 
   * State Resets:
   * - currentSessionId: เป็น undefined (จะสร้างใหม่)
   * - messages: array ว่าง
   * - historyError: null
   * - input: string ว่าง
   */
  const startNewChat = () => {
    setCurrentSessionId(undefined)                                          // ล้าง session ID
    setMessages([])                                                         // ล้างรายการข้อความ
    setHistoryError(null)                                                   // ล้าง error
    setInput('')                                                            // ล้าง input field
  }

  // ===============================================
  // Step 5: Switch Session Function - ฟังก์ชันสลับ Session
  // ===============================================
  
  /**
   * ฟังก์ชันสลับไปยัง session อื่น
   * 
   * Purpose:
   * - เปลี่ยนจาก session ปัจจุบันไปยัง session ใหม่
   * - โหลดประวัติของ session ใหม่
   * - ป้องกันการสลับไปยัง session เดิม
   * 
   * Process:
   * 1. ตรวจสอบว่าเป็น session เดิมหรือไม่
   * 2. หากเป็น session ใหม่ ให้โหลดประวัติ
   * 
   * @param sessionId - ID ของ session ที่จะสลับไป
   */
  const switchToSession = async (sessionId: string) => {
    /**
     * ตรวจสอบว่าเป็น session เดิมหรือไม่
     * 
     * Performance Optimization:
     * - หากเป็น session เดิม ไม่ต้องโหลดใหม่
     * - ประหยัด network request
     */
    if (sessionId === currentSessionId) return                             // ไม่ทำอะไรหาก session เดิม
    
    /**
     * โหลดประวัติของ session ใหม่
     * 
     * Process:
     * - เรียกใช้ loadChatHistory function
     * - อัปเดต state ด้วยข้อมูลใหม่
     */
    await loadChatHistory(sessionId)                                        // โหลดประวัติ session ใหม่
  }

  // ===============================================
  // Step 6: Form Submit Handler - ตัวจัดการ Form Submit
  // ===============================================
  
  /**
   * ฟังก์ชันจัดการการ submit form
   * 
   * Purpose:
   * - จัดการเมื่อผู้ใช้กด Enter หรือ Submit button
   * - ป้องกัน page refresh (preventDefault)
   * - ส่งข้อความหาก input ไม่ว่าง
   * 
   * @param e - React FormEvent object
   */
  const handleSubmit = (e: React.FormEvent) => {
    /**
     * ป้องกัน default form submission behavior
     * 
     * Reason:
     * - ป้องกัน page refresh
     * - ให้ JavaScript จัดการการส่งข้อความ
     */
    e.preventDefault()                                                      // ป้องกัน page refresh
    
    /**
     * ส่งข้อความหาก input มีเนื้อหา
     * 
     * Validation:
     * - ตรวจสอบว่า input ไม่ว่าง (หลัง trim)
     * - เรียกใช้ sendMessage function
     */
    if (input.trim()) {
      sendMessage(input)                                                    // ส่งข้อความ
    }
  }

  // ===============================================
  // Step 7: Return Hook Values - ส่งคืนค่าของ Hook
  // ===============================================
  
  /**
   * ส่งคืน object ที่มี state และ functions ทั้งหมด
   * 
   * Return Object Structure:
   * - Messages and State: ข้อมูลข้อความและสถานะ
   * - Actions: ฟังก์ชันสำหรับจัดการการสนทนา
   * - Session Management: ฟังก์ชันจัดการ sessions
   * - Loading States: สถานะ loading และ errors
   * 
   * Usage Pattern:
   * ```tsx
   * const {
   *   messages,
   *   loading,
   *   sendMessage,
   *   loadChatHistory
   * } = useChatHistory(sessionId, userId)
   * ```
   */
  return {
    // ===============================================
    // Messages and State - ข้อมูลข้อความและสถานะ
    // ===============================================
    
    /**
     * รายการข้อความทั้งหมดในการสนทนาปัจจุบัน
     * 
     * Type: ChatMessage[]
     * Usage: แสดงใน chat UI
     */
    messages,                                                               // รายการข้อความ
    
    /**
     * สถานะการส่งข้อความ
     * 
     * Type: boolean
     * Usage: แสดง loading indicator, disable submit button
     */
    loading,                                                                // สถานะการส่งข้อความ
    
    /**
     * ข้อความที่กำลังพิมพ์ใน input field
     * 
     * Type: string
     * Usage: controlled input value
     */
    input,                                                                  // ข้อความใน input
    
    /**
     * ฟังก์ชันสำหรับอัปเดตข้อความใน input
     * 
     * Type: React.Dispatch<React.SetStateAction<string>>
     * Usage: onChange handler สำหรับ input field
     */
    setInput,                                                               // ฟังก์ชันอัปเดต input
    
    // ===============================================
    // Actions - ฟังก์ชันสำหรับจัดการการสนทนา
    // ===============================================
    
    /**
     * ฟังก์ชันส่งข้อความไปยัง AI
     * 
     * Type: (message: string) => Promise<void>
     * Usage: เรียกใช้เมื่อต้องการส่งข้อความ
     */
    sendMessage,                                                            // ฟังก์ชันส่งข้อความ
    
    /**
     * ฟังก์ชันจัดการ form submission
     * 
     * Type: (e: React.FormEvent) => void
     * Usage: onSubmit handler สำหรับ form element
     */
    handleSubmit,                                                           // ฟังก์ชันจัดการ form submit
    
    // ===============================================
    // Session Management - ฟังก์ชันจัดการ Sessions
    // ===============================================
    
    /**
     * Session ID ปัจจุบัน
     * 
     * Type: string | undefined
     * Usage: ระบุ session ที่กำลังใช้งาน, undefined = session ใหม่
     */
    currentSessionId,                                                       // session ID ปัจจุบัน
    
    /**
     * ฟังก์ชันตั้งค่า session ID
     * 
     * Type: React.Dispatch<React.SetStateAction<string | undefined>>
     * Usage: อัปเดต session ID manually
     */
    setCurrentSessionId,                                                    // ฟังก์ชันตั้งค่า session ID
    
    /**
     * ฟังก์ชันโหลดประวัติการสนทนาจาก session
     * 
     * Type: (sessionId: string) => Promise<void>
     * Usage: โหลดข้อความจาก session ที่มีอยู่
     */
    loadChatHistory,                                                        // ฟังก์ชันโหลดประวัติ
    
    /**
     * ฟังก์ชันเริ่มการสนทนาใหม่
     * 
     * Type: () => void
     * Usage: รีเซ็ต state และเริ่มต้นใหม่
     */
    startNewChat,                                                           // ฟังก์ชันเริ่มการสนทนาใหม่
    
    /**
     * ฟังก์ชันสลับไปยัง session อื่น
     * 
     * Type: (sessionId: string) => Promise<void>
     * Usage: เปลี่ยนจาก session ปัจจุบันไปยัง session ใหม่
     */
    switchToSession,                                                        // ฟังก์ชันสลับ session
    
    // ===============================================
    // Loading States - สถานะ Loading และ Errors
    // ===============================================
    
    /**
     * สถานะการโหลดประวัติการสนทนา
     * 
     * Type: boolean
     * Usage: แสดง loading indicator ขณะโหลดประวัติ
     */
    loadingHistory,                                                         // สถานะการโหลดประวัติ
    
    /**
     * ข้อผิดพลาดที่เกิดขึ้นกับประวัติการสนทนา
     * 
     * Type: string | null
     * Usage: แสดงข้อความ error ให้ผู้ใช้, null = ไม่มี error
     */
    historyError,                                                           // ข้อผิดพลาดของประวัติ
  }
}
