/**
 * ===============================================
 * Chat Context Provider
 * ===============================================
 * 
 * Purpose: จัดการ state ของการสนทนาในระดับ global
 * 
 * Features:
 * - จัดการรายการข้อความในการสนทนา
 * - ควบคุมการแสดงข้อความต้อนรับ
 * - ฟังก์ชัน reset การสนทนา
 * - แชร์ state ระหว่าง components ต่างๆ
 * 
 * Pattern: React Context API
 * - ใช้ createContext สำหรับสร้าง context
 * - ใช้ Provider สำหรับแชร์ state
 * - ใช้ custom hook สำหรับเข้าถึง context
 * 
 * State Management:
 * - chatMessages: รายการข้อความทั้งหมดในการสนทนา
 * - showWelcome: สถานะการแสดงหน้าต้อนรับ
 * - resetChat: ฟังก์ชันรีเซ็ตการสนทนา
 */

"use client"

import React, { createContext, useContext, useState, useCallback } from 'react'

// ===============================================
// TypeScript Interface Definitions - กำหนด Type Definitions
// ===============================================

/**
 * Interface สำหรับ Chat Context Type
 * 
 * Properties:
 * - chatMessages: array ของข้อความในการสนทนา
 * - setChatMessages: ฟังก์ชันสำหรับอัปเดตรายการข้อความ
 * - showWelcome: สถานะการแสดงหน้าต้อนรับ
 * - setShowWelcome: ฟังก์ชันสำหรับเปลี่ยนสถานะหน้าต้อนรับ
 * - resetChat: ฟังก์ชันรีเซ็ตการสนทนา
 */
interface ChatContextType {
  chatMessages: Array<{
    id: number                                                              // ID เฉพาะของข้อความ
    role: string                                                            // บทบาทของผู้ส่ง (user/assistant)
    content: string                                                         // เนื้อหาข้อความ
  }>
  setChatMessages: React.Dispatch<React.SetStateAction<Array<{
    id: number                                                              // ID เฉพาะของข้อความ
    role: string                                                            // บทบาทของผู้ส่ง (user/assistant)
    content: string                                                         // เนื้อหาข้อความ
  }>>>
  showWelcome: boolean                                                      // สถานะการแสดงหน้าต้อนรับ
  setShowWelcome: React.Dispatch<React.SetStateAction<boolean>>            // ฟังก์ชันเปลี่ยนสถานะหน้าต้อนรับ
  resetChat: () => void                                                     // ฟังก์ชันรีเซ็ตการสนทนา
}

// ===============================================
// Context Creation - สร้าง React Context
// ===============================================

/**
 * สร้าง Chat Context สำหรับแชร์ state ระหว่าง components
 * 
 * Initial Value: undefined
 * - เพื่อบังคับให้ใช้ context ผ่าน Provider เท่านั้น
 * - ป้องกันการใช้ context นอก Provider
 */
const ChatContext = createContext<ChatContextType | undefined>(undefined)

// ===============================================
// Chat Provider Component - ตัวจัดการ State หลัก
// ===============================================

/**
 * ChatProvider Component: จัดการ state ของการสนทนาทั้งหมด
 * 
 * Purpose:
 * - เป็น wrapper component ที่แชร์ chat state
 * - จัดการ state ของข้อความและการแสดงผล
 * - ให้ context ให้กับ child components ทั้งหมด
 * 
 * State Management:
 * - ใช้ useState สำหรับจัดการ local state
 * - ใช้ useCallback สำหรับ optimize performance
 * 
 * @param children - Child components ที่จะได้รับ context
 * @returns JSX.Element ที่ wrap children ด้วย Context Provider
 */
export function ChatProvider({ children }: { children: React.ReactNode }) {
  // ===============================================
  // Step 1: State Initialization - กำหนด State เริ่มต้น
  // ===============================================
  
  /**
   * State สำหรับเก็บรายการข้อความในการสนทนา
   * 
   * Initial Value: [] (array ว่าง)
   * 
   * Message Structure:
   * - id: number - ID เฉพาะของข้อความ
   * - role: string - บทบาท ('user' หรือ 'assistant')
   * - content: string - เนื้อหาข้อความ
   */
  const [chatMessages, setChatMessages] = useState<Array<{
    id: number                                                              // ID เฉพาะของข้อความ
    role: string                                                            // บทบาทของผู้ส่ง
    content: string                                                         // เนื้อหาข้อความ
  }>>([])                                                                   // เริ่มต้นด้วย array ว่าง

  /**
   * State สำหรับควบคุมการแสดงหน้าต้อนรับ
   * 
   * Initial Value: true
   * 
   * Usage:
   * - true: แสดงหน้าต้อนรับ (เมื่อยังไม่มีการสนทนา)
   * - false: ซ่อนหน้าต้อนรับ (เมื่อมีการสนทนาแล้ว)
   */
  const [showWelcome, setShowWelcome] = useState(true)                      // แสดงหน้าต้อนรับเริ่มต้น

  // ===============================================
  // Step 2: Callback Functions - ฟังก์ชันสำหรับจัดการ State
  // ===============================================
  
  /**
   * ฟังก์ชันรีเซ็ตการสนทนา
   * 
   * Purpose:
   * - ล้างข้อความทั้งหมดในการสนทนา
   * - แสดงหน้าต้อนรับใหม่
   * - กลับไปสู่สถานะเริ่มต้น
   * 
   * Performance Optimization:
   * - ใช้ useCallback เพื่อป้องกัน unnecessary re-renders
   * - dependency array ว่าง [] เพราะไม่ depend on external values
   * 
   * Usage:
   * - เรียกใช้เมื่อต้องการเริ่มการสนทนาใหม่
   * - เรียกใช้เมื่อต้องการล้างประวัติการสนทนา
   */
  const resetChat = useCallback(() => {
    setChatMessages([])                                                     // ล้างรายการข้อความ
    setShowWelcome(true)                                                    // แสดงหน้าต้อนรับ
  }, [])                                                                    // ไม่มี dependencies

  // ===============================================
  // Step 3: Context Provider - จัดเตรียม Context Values
  // ===============================================
  
  /**
   * ส่งคืน Context Provider พร้อมกับ values ทั้งหมด
   * 
   * Provider Values:
   * - chatMessages: รายการข้อความปัจจุบัน
   * - setChatMessages: ฟังก์ชันอัปเดตข้อความ
   * - showWelcome: สถานะการแสดงหน้าต้อนรับ
   * - setShowWelcome: ฟังก์ชันเปลี่ยนสถานะหน้าต้อนรับ
   * - resetChat: ฟังก์ชันรีเซ็ตการสนทนา
   * 
   * Child Components:
   * - ทุก component ที่อยู่ภายใต้ Provider นี้
   * - สามารถเข้าถึง context values ผ่าน useChatContext hook
   */
  return (
    <ChatContext.Provider value={{
      chatMessages,                                                         // รายการข้อความ
      setChatMessages,                                                      // ฟังก์ชันอัปเดตข้อความ
      showWelcome,                                                          // สถานะหน้าต้อนรับ
      setShowWelcome,                                                       // ฟังก์ชันเปลี่ยนสถานะหน้าต้อนรับ
      resetChat                                                             // ฟังก์ชันรีเซ็ตการสนทนา
    }}>
      {children}
    </ChatContext.Provider>
  )
}

// ===============================================
// Custom Hook: useChatContext - Hook สำหรับเข้าถึง Chat Context
// ===============================================

/**
 * useChatContext Hook: Custom hook สำหรับเข้าถึง Chat Context
 * 
 * Purpose:
 * - ให้ interface ที่ง่ายสำหรับเข้าถึง chat context
 * - ตรวจสอบว่า hook ถูกใช้ภายใต้ Provider หรือไม่
 * - ป้องกัน runtime errors จากการใช้ context ผิดที่
 * 
 * Usage Pattern:
 * ```tsx
 * function MyComponent() {
 *   const { chatMessages, setChatMessages, resetChat } = useChatContext()
 *   // ใช้งาน context values ได้เลย
 * }
 * ```
 * 
 * Error Handling:
 * - ถ้าใช้นอก ChatProvider จะ throw error
 * - ช่วยให้ developer รู้ทันทีว่าใช้ผิดที่
 * 
 * @returns ChatContextType object ที่มี state และ functions ทั้งหมด
 * @throws Error หากใช้นอก ChatProvider
 */
export function useChatContext() {
  // ===============================================
  // Step 1: Get Context Value - ดึงค่า Context
  // ===============================================
  
  /**
   * ดึงค่า context จาก ChatContext
   * 
   * Return Value:
   * - ChatContextType object หากอยู่ภายใต้ Provider
   * - undefined หากไม่ได้อยู่ภายใต้ Provider
   */
  const context = useContext(ChatContext)                                   // ดึงค่า context
  
  // ===============================================
  // Step 2: Validation Check - ตรวจสอบความถูกต้อง
  // ===============================================
  
  /**
   * ตรวจสอบว่า context มีค่าหรือไม่
   * 
   * Validation Logic:
   * - หาก context เป็น undefined แสดงว่าไม่ได้ใช้ภายใต้ Provider
   * - ให้ throw error เพื่อแจ้งให้ developer ทราบ
   * 
   * Error Message:
   * - อธิบายปัญหาและวิธีแก้ไขอย่างชัดเจน
   */
  if (context === undefined) {
    throw new Error('useChatContext must be used within a ChatProvider')   // Error สำหรับการใช้งานผิดที่
  }
  
  // ===============================================
  // Step 3: Return Context Value - ส่งคืนค่า Context
  // ===============================================
  
  /**
   * ส่งคืน context object ที่มี values ทั้งหมด
   * 
   * Available Values:
   * - chatMessages: รายการข้อความ
   * - setChatMessages: ฟังก์ชันอัปเดตข้อความ
   * - showWelcome: สถานะหน้าต้อนรับ
   * - setShowWelcome: ฟังก์ชันเปลี่ยนสถานะหน้าต้อนรับ
   * - resetChat: ฟังก์ชันรีเซ็ตการสนทนา
   */
  return context                                                            // ส่งคืน context values
}