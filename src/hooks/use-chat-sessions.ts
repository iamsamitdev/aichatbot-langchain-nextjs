/**
 * ===============================================
 * Chat Sessions Management Hook
 * ===============================================
 * 
 * Purpose: จัดการ CRUD operations สำหรับ chat sessions
 * 
 * Features:
 * - ดึงรายการ chat sessions ทั้งหมด
 * - สร้าง session ใหม่
 * - อัปเดต title ของ session
 * - ลบ session และข้อมูลที่เกี่ยวข้อง
 * - จัดการ loading states และ errors
 * 
 * Hook Pattern: Custom React Hook
 * - ใช้ useState สำหรับ state management
 * - ใช้ useEffect สำหรับ data fetching
 * - ส่งคืน object ที่มี state และ functions
 * 
 * API Integration:
 * - เชื่อมต่อกับ session API endpoints
 * - รองรับ GET, POST, PUT, DELETE methods
 * - จัดการ authentication ด้วย userId
 */

"use client"

import { useState, useEffect } from 'react'
import { API_BASE_SESSION, buildApiUrl } from '@/constants/api'

// ===============================================
// TypeScript Interface Definitions - กำหนด Type Definitions
// ===============================================

/**
 * Interface สำหรับ Chat Session object
 * 
 * Properties:
 * - id: ID เฉพาะของ session
 * - title: ชื่อของ session
 * - created_at: เวลาที่สร้าง session
 * - message_count: จำนวนข้อความใน session
 */
export interface ChatSession {
  id: string                                                                // ID เฉพาะของ session
  title: string                                                             // ชื่อของ session
  created_at: string                                                        // เวลาที่สร้าง (ISO string)
  message_count: number                                                     // จำนวนข้อความใน session
}

// ===============================================
// Main Custom Hook: useChatSessions
// ===============================================

/**
 * useChatSessions Hook: จัดการ CRUD operations สำหรับ chat sessions
 * 
 * Purpose:
 * - จัดการรายการ chat sessions ของผู้ใช้
 * - ให้ functions สำหรับ create, read, update, delete sessions
 * - จัดการ loading states และ error handling
 * - อัปเดต local state เมื่อมีการเปลี่ยนแปลง
 * 
 * Parameters:
 * - userId: ID ของผู้ใช้สำหรับกรองข้อมูล (optional)
 * 
 * @param userId - User ID สำหรับ authentication และ filtering
 * @returns Object ที่มี state และ functions สำหรับจัดการ sessions
 */
export function useChatSessions(userId?: string) {
  // ===============================================
  // Step 1: State Management - จัดการ State ต่างๆ
  // ===============================================
  
  /**
   * State สำหรับเก็บรายการ chat sessions
   * 
   * Usage:
   * - เก็บ sessions ทั้งหมดของผู้ใช้
   * - แสดงใน sidebar หรือ session list
   * - อัปเดตเมื่อมีการเปลี่ยนแปลง
   */
  const [sessions, setSessions] = useState<ChatSession[]>([])              // รายการ chat sessions
  
  /**
   * State สำหรับสถานะการโหลดข้อมูล
   * 
   * Usage:
   * - true: กำลังโหลดข้อมูล (แสดง loading indicator)
   * - false: โหลดเสร็จแล้วหรือยังไม่ได้โหลด
   */
  const [loading, setLoading] = useState(false)                            // สถานะการโหลด
  
  /**
   * State สำหรับข้อผิดพลาด
   * 
   * Usage:
   * - null: ไม่มีข้อผิดพลาด
   * - string: ข้อความ error ที่เกิดขึ้น
   */
  const [error, setError] = useState<string | null>(null)                  // ข้อผิดพลาด

  // ===============================================
  // Step 2: Fetch Sessions Function - ฟังก์ชันดึงรายการ Sessions
  // ===============================================
  
  /**
   * ฟังก์ชันดึงรายการ chat sessions จาก server
   * 
   * Purpose:
   * - ดึงข้อมูล sessions ทั้งหมดของผู้ใช้
   * - อัปเดต sessions state ด้วยข้อมูลที่ได้
   * - จัดการ loading state และ errors
   * 
   * Process Flow:
   * 1. ตรวจสอบ userId
   * 2. ตั้งค่า loading state
   * 3. ส่ง GET request ไปยัง API
   * 4. ประมวลผล response data
   * 5. อัปเดต state ด้วยข้อมูลที่ได้
   * 6. จัดการ errors หากเกิดขึ้น
   */
  const fetchSessions = async () => {
    // ===============================================
    // Step 2.1: User ID Validation - ตรวจสอบ User ID
    // ===============================================
    
    /**
     * ตรวจสอบว่ามี userId หรือไม่
     * 
     * Validation:
     * - userId เป็น required parameter
     * - หากไม่มี userId ให้ออกจากฟังก์ชัน
     */
    if (!userId) return                                                     // ออกจากฟังก์ชันหากไม่มี userId
    
    // ===============================================
    // Step 2.2: Set Loading State - ตั้งค่าสถานะ Loading
    // ===============================================
    
    /**
     * ตั้งค่า loading state และ reset error
     * 
     * Purpose:
     * - แสดง loading indicator ใน UI
     * - ล้าง error ก่อนหน้า
     * - ป้องกันการเรียกใช้ซ้ำ
     */
    setLoading(true)                                                        // เริ่ม loading
    setError(null)                                                          // ล้าง error
    
    try {
      // ===============================================
      // Step 2.3: API Request - ส่ง Request ไปยัง API
      // ===============================================
      
      /**
       * ส่ง GET request ไปยัง session API
       * 
       * API Endpoint: SESSION API
       * Query Parameter: userId (encoded สำหรับความปลอดภัย)
       * 
       * Expected Response:
       * - sessions: array ของ ChatSession objects
       */
      const apiUrl = buildApiUrl(API_BASE_SESSION, { userId })
      const response = await fetch(apiUrl)
      
      /**
       * ตรวจสอบ HTTP response status
       * 
       * Error Handling:
       * - ถ้า response ไม่ ok ให้ throw error
       */
      if (!response.ok) {
        throw new Error('Failed to fetch sessions')                        // ข้อผิดพลาดการดึงข้อมูล
      }
      
      // ===============================================
      // Step 2.4: Process Response Data - ประมวลผลข้อมูล Response
      // ===============================================
      
      /**
       * แปลง response เป็น JSON และดึงข้อมูล sessions
       * 
       * Data Structure:
       * - data.sessions: array ของ sessions
       * - หาก sessions ไม่มี ให้ใช้ empty array
       */
      const data = await response.json()                                    // แปลง response เป็น JSON
      setSessions(data.sessions || [])                                      // อัปเดต sessions state
    } catch (err) {
      // ===============================================
      // Step 2.5: Error Handling - จัดการข้อผิดพลาด
      // ===============================================
      
      /**
       * จัดการข้อผิดพลาดที่เกิดขึ้นระหว่างการดึงข้อมูล
       * 
       * Error Recovery:
       * - ตั้งค่า error message สำหรับแสดงให้ผู้ใช้
       * - ให้ผู้ใช้ลองดึงข้อมูลใหม่ได้
       */
      setError(err instanceof Error ? err.message : 'Unknown error')       // ตั้งค่า error message
    } finally {
      // ===============================================
      // Step 2.6: Cleanup - ล้างสถานะ Loading
      // ===============================================
      
      /**
       * ล้างสถานะ loading เมื่อเสร็จสิ้น
       * 
       * Purpose:
       * - ซ่อน loading indicator
       * - รันไม่ว่าจะสำเร็จหรือเกิด error
       */
      setLoading(false)                                                     // หยุด loading
    }
  }

  // ===============================================
  // Step 3: Create Session Function - ฟังก์ชันสร้าง Session ใหม่
  // ===============================================
  
  /**
   * ฟังก์ชันสร้าง chat session ใหม่
   * 
   * Purpose:
   * - สร้าง session ใหม่สำหรับผู้ใช้
   * - อัปเดต local sessions list
   * - คืนค่า session object ที่สร้างใหม่
   * 
   * Process Flow:
   * 1. ตรวจสอบ userId
   * 2. ส่ง POST request ไปยัง API
   * 3. ประมวลผล response data
   * 4. อัปเดต sessions state
   * 5. คืนค่า session ใหม่
   * 
   * @param title - ชื่อของ session (optional)
   * @returns ChatSession object หรือ null หากเกิด error
   */
  const createSession = async (title?: string) => {
    // ===============================================
    // Step 3.1: User ID Validation - ตรวจสอบ User ID
    // ===============================================
    
    /**
     * ตรวจสอบว่ามี userId หรือไม่
     * 
     * Validation:
     * - userId เป็น required parameter สำหรับสร้าง session
     * - หากไม่มี userId ให้คืนค่า null
     */
    if (!userId) return null                                                // คืนค่า null หากไม่มี userId
    
    // ===============================================
    // Step 3.2: Reset Error State - รีเซ็ต Error State
    // ===============================================
    
    /**
     * ล้าง error state ก่อนเริ่มการสร้าง session
     * 
     * Purpose:
     * - ล้าง error ก่อนหน้า
     * - เตรียมพร้อมสำหรับ operation ใหม่
     */
    setError(null)                                                          // ล้าง error
    
    try {
      // ===============================================
      // Step 3.3: API Request - ส่ง Request ไปยัง API
      // ===============================================
      
      /**
       * ส่ง POST request ไปยัง session API
       * 
       * API Endpoint: SESSION API
       * Method: POST
       * Body: { title, userId }
       * 
       * Expected Response:
       * - session: ChatSession object ที่สร้างใหม่
       */
      const response = await fetch(API_BASE_SESSION, {
        method: 'POST',                                                     // HTTP POST method
        headers: {
          'Content-Type': 'application/json',                              // กำหนด content type
        },
        body: JSON.stringify({ title, userId }),                           // ข้อมูลสำหรับสร้าง session
      })
      
      /**
       * ตรวจสอบ HTTP response status
       * 
       * Error Handling:
       * - ถ้า response ไม่ ok ให้ throw error
       */
      if (!response.ok) {
        throw new Error('Failed to create session')                        // ข้อผิดพลาดการสร้าง session
      }
      
      // ===============================================
      // Step 3.4: Process Response Data - ประมวลผลข้อมูล Response
      // ===============================================
      
      /**
       * แปลง response เป็น JSON และดึงข้อมูล session ใหม่
       * 
       * Data Structure:
       * - data.session: ChatSession object ที่เพิ่งสร้าง
       */
      const data = await response.json()                                    // แปลง response เป็น JSON
      const newSession = data.session                                       // ดึง session object
      
      // ===============================================
      // Step 3.5: Update Local State - อัปเดต Local State
      // ===============================================
      
      /**
       * เพิ่ม session ใหม่ที่ด้านบนของรายการ
       * 
       * Strategy:
       * - ใส่ session ใหม่ไว้ด้านบน (เรียงตาม created_at ใหม่ไปเก่า)
       * - ใช้ spread operator เพื่อรักษา immutability
       */
      setSessions(prev => [newSession, ...prev])                           // เพิ่ม session ใหม่ด้านบน
      
      // ===============================================
      // Step 3.6: Return New Session - คืนค่า Session ใหม่
      // ===============================================
      
      /**
       * คืนค่า session object ที่สร้างใหม่
       * 
       * Return Value:
       * - ChatSession object สำหรับใช้งานต่อ
       * - เช่น redirect ไปยัง session ใหม่
       */
      return newSession                                                     // คืนค่า session ใหม่
    } catch (err) {
      // ===============================================
      // Step 3.7: Error Handling - จัดการข้อผิดพลาด
      // ===============================================
      
      /**
       * จัดการข้อผิดพลาดที่เกิดขึ้นระหว่างการสร้าง session
       * 
       * Error Recovery:
       * - ตั้งค่า error message
       * - คืนค่า null เพื่อบอกว่าสร้างไม่สำเร็จ
       */
      setError(err instanceof Error ? err.message : 'Unknown error')       // ตั้งค่า error message
      return null                                                           // คืนค่า null หาก error
    }
  }

  // ===============================================
  // Step 4: Update Session Title Function - ฟังก์ชันอัปเดต Title ของ Session
  // ===============================================
  
  /**
   * ฟังก์ชันอัปเดต title ของ session
   * 
   * Purpose:
   * - แก้ไขชื่อของ session ที่มีอยู่
   * - อัปเดต local sessions list
   * - คืนค่า session object ที่อัปเดตแล้ว
   * 
   * Process Flow:
   * 1. ส่ง PUT request ไปยัง API
   * 2. ประมวลผล response data
   * 3. อัปเดต sessions state
   * 4. คืนค่า session ที่อัปเดต
   * 
   * @param sessionId - ID ของ session ที่จะอัปเดต
   * @param title - ชื่อใหม่ของ session
   * @returns ChatSession object หรือ null หากเกิด error
   */
  const updateSessionTitle = async (sessionId: string, title: string) => {
    // ===============================================
    // Step 4.1: Reset Error State - รีเซ็ต Error State
    // ===============================================
    
    /**
     * ล้าง error state ก่อนเริ่มการอัปเดต
     * 
     * Purpose:
     * - ล้าง error ก่อนหน้า
     * - เตรียมพร้อมสำหรับ operation ใหม่
     */
    setError(null)                                                          // ล้าง error
    
    try {
      // ===============================================
      // Step 4.2: API Request - ส่ง Request ไปยัง API
      // ===============================================
      
      /**
       * ส่ง PUT request ไปยัง session API
       * 
       * API Endpoint: SESSION API
       * Method: PUT
       * Body: { sessionId, title }
       * 
       * Expected Response:
       * - session: ChatSession object ที่อัปเดตแล้ว
       */
      const response = await fetch(API_BASE_SESSION, {
        method: 'PUT',                                                      // HTTP PUT method
        headers: {
          'Content-Type': 'application/json',                              // กำหนด content type
        },
        body: JSON.stringify({ sessionId, title }),                        // ข้อมูลสำหรับอัปเดต
      })
      
      /**
       * ตรวจสอบ HTTP response status
       * 
       * Error Handling:
       * - ถ้า response ไม่ ok ให้ throw error
       */
      if (!response.ok) {
        throw new Error('Failed to update session')                        // ข้อผิดพลาดการอัปเดต session
      }
      
      // ===============================================
      // Step 4.3: Process Response Data - ประมวลผลข้อมูล Response
      // ===============================================
      
      /**
       * แปลง response เป็น JSON และดึงข้อมูล session ที่อัปเดต
       * 
       * Data Structure:
       * - data.session: ChatSession object ที่อัปเดตแล้ว
       */
      const data = await response.json()                                    // แปลง response เป็น JSON
      const updatedSession = data.session                                   // ดึง session object ที่อัปเดต
      
      // ===============================================
      // Step 4.4: Update Local State - อัปเดต Local State
      // ===============================================
      
      /**
       * อัปเดต session ในรายการ local state
       * 
       * Strategy:
       * - ใช้ map เพื่อหา session ที่ต้องอัปเดต
       * - อัปเดตเฉพาะ title ของ session นั้น
       * - รักษา sessions อื่นไว้เหมือนเดิม
       */
      setSessions(prev => prev.map(session => 
        session.id === sessionId 
          ? { ...session, title: updatedSession.title }                    // อัปเดต title ของ session นี้
          : session                                                         // รักษา session อื่นไว้เหมือนเดิม
      ))
      
      // ===============================================
      // Step 4.5: Return Updated Session - คืนค่า Session ที่อัปเดต
      // ===============================================
      
      /**
       * คืนค่า session object ที่อัปเดตแล้ว
       * 
       * Return Value:
       * - ChatSession object สำหรับใช้งานต่อ
       * - เช่น แสดงข้อความยืนยันการอัปเดต
       */
      return updatedSession                                                 // คืนค่า session ที่อัปเดต
    } catch (err) {
      // ===============================================
      // Step 4.6: Error Handling - จัดการข้อผิดพลาด
      // ===============================================
      
      /**
       * จัดการข้อผิดพลาดที่เกิดขึ้นระหว่างการอัปเดต session
       * 
       * Error Recovery:
       * - ตั้งค่า error message
       * - คืนค่า null เพื่อบอกว่าอัปเดตไม่สำเร็จ
       */
      setError(err instanceof Error ? err.message : 'Unknown error')       // ตั้งค่า error message
      return null                                                           // คืนค่า null หาก error
    }
  }

  // ลบ session
  const deleteSession = async (sessionId: string) => {
    setError(null)
    
    try {
      const apiUrl = buildApiUrl(API_BASE_SESSION, { sessionId })
      const response = await fetch(apiUrl, {
        method: 'DELETE',
      })
      
      if (!response.ok) {
        throw new Error('Failed to delete session')
      }
      
      // ลบ session จากรายการ
      setSessions(prev => prev.filter(session => session.id !== sessionId))
      
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      return false
    }
  }

  // ดึงข้อมูลเมื่อมี userId
  useEffect(() => {
    if (userId) {
      fetchSessions()
    }
  }, [userId]) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    sessions,
    loading,
    error,
    fetchSessions,
    createSession,
    updateSessionTitle,
    deleteSession,
  }
}