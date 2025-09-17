/**
 * ===============================================
 * Chat History Page Component
 * ===============================================
 * 
 * Purpose: หน้าแสดงประวัติการสนทนาสำหรับ session เฉพาะ
 * 
 * Features:
 * - แสดงประวัติการสนทนาของ session ที่ระบุ
 * - ตรวจสอบ authentication ของผู้ใช้
 * - ตรวจสอบความถูกต้องของ session
 * - รองรับการสร้าง session ใหม่
 * - Redirect ไปหน้า login หากไม่ได้ login
 * 
 * Route: /chat/[id]
 * - id: session ID หรือ 'new' สำหรับสร้าง session ใหม่
 * 
 * Database Operations:
 * - ดึงข้อมูล session จากตาราง chat_sessions
 * - ตรวจสอบสิทธิ์การเข้าถึง session (user ownership)
 * 
 * Authentication: ใช้ Supabase Authentication
 * Authorization: ตรวจสอบว่า user เป็นเจ้าของ session
 */

import { createClient } from "@/lib/server"
import { redirect } from "next/navigation"
import { ChatHistory } from "@/components/chat-history"
import { getDatabase } from '@/lib/database'

// ===============================================
// ใช้ centralized database utility
// ===============================================
const pool = getDatabase()

// ===============================================
// TypeScript Interface Definitions - กำหนด Type Definitions
// ===============================================

/**
 * Interface สำหรับ props ของ ChatPage component
 * 
 * Structure:
 * - params: Promise object ที่มี dynamic route parameters
 *   - id: string - session ID จาก URL path
 */
interface ChatPageProps {
  params: Promise<{
    id: string                                                              // session ID จาก dynamic route [id]
  }>
}

// ===============================================
// Main Page Component: History Chat Page
// ===============================================

/**
 * HistoryChatPage Component: หน้าแสดงประวัติการสนทนา
 * 
 * Purpose:
 * - แสดงประวัติการสนทนาของ session ที่ระบุ
 * - ตรวจสอบ authentication และ authorization
 * - จัดการกรณี session ไม่มีอยู่
 * - ส่งข้อมูลไปยัง ChatHistory component
 * 
 * Process Flow:
 * 1. ตรวจสอบ authentication ผ่าน Supabase
 * 2. ดึงข้อมูล session จาก database
 * 3. ตรวจสอบสิทธิ์การเข้าถึง session
 * 4. แสดง ChatHistory component พร้อมข้อมูล
 * 
 * @param params - Object ที่มี session ID จาก dynamic route
 * @returns JSX Element หรือ redirect
 */
export default async function HistoryChatPage({ params }: ChatPageProps) {
    
  // ===============================================
  // Step 1: Authentication Check - ตรวจสอบการ Login
  // ===============================================
  
  /**
   * สร้าง Supabase client และตรวจสอบ authentication
   * 
   * Process:
   * 1. สร้าง server-side Supabase client
   * 2. ดึง session ID จาก route parameters
   * 3. ตรวจสอบว่าผู้ใช้ login หรือไม่
   * 4. Redirect ไป login page หากยังไม่ login
   */
  const supabase = await createClient()                                     // สร้าง Supabase client
  const { id } = await params                                               // ดึง session ID จาก route parameters

  /**
   * ตรวจสอบ authentication status ของผู้ใช้
   * 
   * Returns:
   * - user: user object หากมีการ login
   * - error: error object หากเกิดปัญหา
   */
  const {
    data: { user },                                                         // ข้อมูลผู้ใช้ที่ login
    error,                                                                  // error object (ถ้ามี)
  } = await supabase.auth.getUser()

  /**
   * หากไม่มีการ login หรือเกิด error ให้ redirect ไป login page
   * 
   * Conditions for redirect:
   * - error มีค่า (เกิดปัญหาในการตรวจสอบ auth)
   * - user เป็น null/undefined (ไม่ได้ login)
   */
  if (error || !user) {
    redirect("/auth/login")                                                 // redirect ไปหน้า login
  }

  // ===============================================
  // Step 2: Initialize Session Variables - กำหนดตัวแปรเริ่มต้น
  // ===============================================
  
  /**
   * ตัวแปรเก็บข้อมูล session
   * 
   * Variables:
   * - chatTitle: ชื่อของ chat session
   * - sessionExists: สถานะการมีอยู่ของ session
   */
  let chatTitle = "Chat Conversation"                                       // ชื่อ chat เริ่มต้น
  let sessionExists = false                                                 // สถานะการมีอยู่ของ session
  
  // ===============================================
  // Step 3: Database Query for Session - ดึงข้อมูล Session จากฐานข้อมูล
  // ===============================================
  
  try {
    /**
     * เชื่อมต่อฐานข้อมูลและดึงข้อมูล session
     * 
     * Query Purpose:
     * - ตรวจสอบว่า session มีอยู่จริง
     * - ตรวจสอบว่า user เป็นเจ้าของ session
     * - ดึงข้อมูล title ของ session
     */
    const client = await pool.connect()                                     // เชื่อมต่อ database
    try {
      /**
       * Query ข้อมูล chat session
       * 
       * SQL Query Details:
       * - SELECT: ดึงข้อมูลพื้นฐานของ session
       * - WHERE: กรองด้วย session ID และ user ID
       * - เพื่อให้แน่ใจว่า user มีสิทธิ์เข้าถึง session นี้
       */
      const result = await client.query(`
        SELECT 
          id,                                                               
          title,                                                            
          created_at,                                                       
          user_id                                                           
        FROM chat_sessions 
        WHERE id = $1 AND user_id = $2
      `, [id, user.id])                                                     // parameters: [sessionId, userId]

      /**
       * ตรวจสอบผลลัพธ์จาก query
       * 
       * Process:
       * 1. หากพบ session ให้อัปเดตตัวแปร
       * 2. ตั้งค่า chatTitle จาก database
       * 3. เปลี่ยน sessionExists เป็น true
       */
      if (result.rows.length > 0) {
        chatTitle = result.rows[0].title || "Chat Conversation"            // ใช้ title จาก DB หรือ default
        sessionExists = true                                                // ยืนยันว่า session มีอยู่
      }
    } finally {
      // ===============================================
      // Step 4: Database Cleanup - ปิดการเชื่อมต่อฐานข้อมูล
      // ===============================================
      
      /**
       * ปิดการเชื่อมต่อ database
       * ใช้ finally block เพื่อให้แน่ใจว่าจะปิดการเชื่อมต่อเสมอ
       */
      client.release()                                                      // คืน connection กลับไปยัง pool
    }
  } catch (error) {
    // ===============================================
    // Database Error Handling - จัดการข้อผิดพลาดฐานข้อมูล
    // ===============================================
    
    /**
     * จัดการข้อผิดพลาดที่เกิดขึ้นระหว่างการดึงข้อมูล
     * 
     * Error Recovery:
     * 1. แสดง error ใน console
     * 2. ใช้ default values
     * 3. ดำเนินการต่อโดยไม่หยุดทำงาน
     */
    console.error('Error fetching chat session:', error)                   // แสดง error ใน console
    // ใช้ default title ถ้าเกิดข้อผิดพลาด (chatTitle และ sessionExists ยังคงเป็นค่าเริ่มต้น)
  }

  // ===============================================
  // Step 5: Session Validation - ตรวจสอบความถูกต้องของ Session
  // ===============================================
  
  /**
   * ตรวจสอบว่า session มีอยู่หรือไม่
   * 
   * Validation Logic:
   * - หาก session ไม่มีอยู่ และ id ไม่ใช่ 'new'
   * - ให้ redirect ไปหน้า chat หลัก
   * - เพื่อป้องกันการเข้าถึง session ที่ไม่มีอยู่
   * 
   * Special Case:
   * - id = 'new' ใช้สำหรับสร้าง session ใหม่
   */
  if (!sessionExists && id !== 'new') {
    redirect('/chat')                                                       // redirect ไปหน้า chat หลัก
  }

  // ===============================================
  // Step 6: Render Component - แสดงผล Component
  // ===============================================
  
  /**
   * ส่งคืน ChatHistory component พร้อมข้อมูลที่จำเป็น
   * 
   * Props:
   * - sessionId: ID ของ session (หรือ 'new' สำหรับ session ใหม่)
   * - title: ชื่อของ chat session
   * - userId: ID ของผู้ใช้ที่ login
   * 
   * Component Responsibility:
   * - ChatHistory จะจัดการการแสดงประวัติการสนทนา
   * - รองรับทั้งการดูประวัติและสร้างการสนทนาใหม่
   */
  return <ChatHistory sessionId={id} title={chatTitle} userId={user.id} />
}