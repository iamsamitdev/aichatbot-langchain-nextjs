/**
 * ===============================================
 * Chat Session Management API Routes
 * ===============================================
 * 
 * Purpose: จัดการ CRUD operations สำหรับ chat sessions
 * 
 * Features:
 * - GET: ดึงรายการ sessions หรือ session เดียว
 * - POST: สร้าง session ใหม่
 * - PUT: อัปเดต title ของ session
 * - DELETE: ลบ session และข้อความทั้งหมด
 * 
 * Database Tables:
 * - chat_sessions: เก็บข้อมูล session
 * - chat_messages: เก็บข้อความในแต่ละ session
 * 
 * Authentication: ใช้ userId ในการกรองข้อมูล
 * Transaction: ใช้ transaction สำหรับการลบข้อมูล
 */

import { NextRequest, NextResponse } from "next/server"
import { getDatabase } from '@/lib/database'

// ===============================================
// Configuration Setup - การตั้งค่า API
// ===============================================

/**
 * กำหนดให้ API นี้ทำงานแบบ Node.js Runtime เพื่อรองรับ PostgreSQL
 * 
 * Why Node.js Runtime:
 * - pg library ต้องการ Node.js APIs
 * - Edge Runtime ไม่รองรับ native database connections
 * - force-dynamic เพื่อให้ response เป็น dynamic เสมอ
 */
// export const runtime = "edge" // ปิดการใช้ Edge Runtime เพราะ pg ต้องการ Node.js APIs
export const dynamic = 'force-dynamic'                                     // บังคับให้ response เป็น dynamic

// ===============================================
// ใช้ centralized database utility
// ===============================================
const pool = getDatabase()

// ===============================================
// GET Method: ดึงรายการ Chat Sessions
// ===============================================

/**
 * GET Handler: ดึงรายการ chat sessions ทั้งหมด หรือ session เดียว
 * 
 * Purpose:
 * - ดึงรายการ sessions ทั้งหมดของผู้ใช้
 * - ดึงข้อมูล session เดียวโดยใช้ sessionId
 * - นับจำนวนข้อความในแต่ละ session
 * 
 * Query Parameters:
 * - userId: ID ของผู้ใช้ (required)
 * - sessionId: ID ของ session เฉพาะ (optional)
 * 
 * @param req NextRequest object ที่มี query parameters
 * @returns Response object พร้อมข้อมูล sessions
 */
export async function GET(req: NextRequest) {
  try {
    // ===============================================
    // Step 1: Extract Query Parameters - ดึง Parameters จาก URL
    // ===============================================
    
    /**
     * ดึง query parameters จาก URL
     * 
     * Expected URL formats:
     * - /api/session?userId=123 (ดึงทุก sessions ของ user)
     * - /api/session?userId=123&sessionId=456 (ดึง session เดียว)
     */
    const { searchParams } = new URL(req.url)                               // ดึง query parameters จาก URL
    const userId = searchParams.get('userId')                              // ID ของผู้ใช้
    const sessionId = searchParams.get('sessionId')                        // ID ของ session เฉพาะ (optional)
    
    // ===============================================
    // Step 2: Database Connection - เชื่อมต่อฐานข้อมูล
    // ===============================================
    
    /**
     * เชื่อมต่อกับ PostgreSQL database
     * ใช้ connection pool เพื่อจัดการ connection อย่างมีประสิทธิภาพ
     */
    const client = await pool.connect()                                     // เชื่อมต่อ database
    
    try {
      // ===============================================
      // Step 3: Handle Single Session Query - จัดการ Query Session เดียว
      // ===============================================
      
      /**
       * ถ้ามี sessionId ให้ดึงข้อมูล session เดียว
       * 
       * Query Details:
       * - ดึงข้อมูลพื้นฐานของ session
       * - นับจำนวนข้อความใน session
       * - ใช้ subquery เพื่อนับข้อความจาก chat_messages
       */
      if (sessionId) {
        const result = await client.query(`
          SELECT 
            id,                                                             
            title,                                                          
            created_at,                                                     
            user_id,                                                        
            (
              SELECT COUNT(*) 
              FROM chat_messages
              WHERE session_id = chat_sessions.id::text
            ) as message_count                                              
          FROM chat_sessions 
          WHERE id = $1
        `, [sessionId])

        /**
         * ตรวจสอบว่าพบ session หรือไม่
         * หากไม่พบ ให้ส่ง 404 error กลับ
         */
        if (result.rows.length === 0) {
          return NextResponse.json(
            { error: "Session not found" },                                // ข้อความ error
            { status: 404 }                                                // HTTP 404 = Not Found
          )
        }

        /**
         * ส่งข้อมูล session เดียวกลับ
         * 
         * Response Structure:
         * - session: object ที่มีข้อมูล session
         */
        return NextResponse.json({
          session: result.rows[0]                                          // ข้อมูล session ที่พบ
        })
      }

      // ===============================================
      // Step 4: Handle Multiple Sessions Query - จัดการ Query Sessions ทั้งหมด
      // ===============================================
      
      /**
       * สร้าง SQL query สำหรับดึง sessions ทั้งหมด
       * 
       * Query Features:
       * - ดึงข้อมูลพื้นฐานของ sessions
       * - นับจำนวนข้อความในแต่ละ session
       * - เรียงลำดับตาม created_at (ใหม่ไปเก่า)
       * - จำกัดผลลัพธ์ไม่เกิน 50 records
       */
      let query = `
        SELECT 
          id,                                                               
          title,                                                            
          created_at,                                                       
          user_id,                                                          
          (
            SELECT COUNT(*) 
            FROM chat_messages
            WHERE session_id = chat_sessions.id::text
          ) as message_count                                                
        FROM chat_sessions 
      `
      
      /**
       * ตัวแปรเก็บ parameters สำหรับ prepared statement
       * ป้องกัน SQL injection
       */
      const params: (string | number)[] = []                               // array เก็บ parameters
      
      /**
       * ตรวจสอบว่ามี userId หรือไม่
       * userId เป็น required parameter
       */
      if (!userId) {
        return Response.json({ error: 'User ID is required' }, { status: 400 })
      }
      
      /**
       * เพิ่ม WHERE clause สำหรับกรองตาม userId
       * ใช้ parameterized query เพื่อป้องกัน SQL injection
       */
      query += ` WHERE user_id = $1 `                                      // เพิ่ม WHERE clause
      params.push(userId)                                                   // เพิ่ม userId เป็น parameter แรก
      
      /**
       * เพิ่ม ORDER BY และ LIMIT clause
       * - เรียงตาม created_at แบบ DESC (ใหม่ไปเก่า)
       * - จำกัดผลลัพธ์ไม่เกิน 50 records
       */
      query += ` ORDER BY created_at DESC LIMIT 50`                        // เรียงลำดับและจำกัดจำนวน
      
      /**
       * Execute query กับ parameters
       */
      const result = await client.query(query, params)                     // Execute prepared statement

      // ===============================================
      // Step 5: Return Multiple Sessions Response - ส่งผลลัพธ์ Sessions กลับ
      // ===============================================
      
      /**
       * ส่งรายการ sessions กลับไปยัง client
       * 
       * Response Structure:
       * - sessions: array ของ session objects
       */
      return NextResponse.json({
        sessions: result.rows                                               // รายการ sessions ทั้งหมด
      })
    } finally {
      // ===============================================
      // Step 6: Cleanup - ปิดการเชื่อมต่อฐานข้อมูล
      // ===============================================
      
      /**
       * ปิดการเชื่อมต่อ database
       * ใช้ finally block เพื่อให้แน่ใจว่าจะปิดการเชื่อมต่อเสมอ
       */
      client.release()                                                      // คืน connection กลับไปยัง pool
    }
  } catch (error) {
    // ===============================================
    // Error Handling - จัดการข้อผิดพลาด
    // ===============================================
    
    /**
     * จัดการข้อผิดพลาดที่เกิดขึ้นระหว่างการดึงข้อมูล
     * 
     * Process:
     * 1. แสดง error ใน console
     * 2. ส่ง error response กลับไปยัง client
     */
    console.error("Error fetching chat sessions:", error)                  // แสดง error ใน console
    return NextResponse.json(
      { error: "Failed to fetch chat sessions" },                          // ข้อความ error
      { status: 500 }                                                      // HTTP 500 = Internal Server Error
    )
  }
}

// ===============================================
// POST Method: สร้าง Chat Session ใหม่
// ===============================================

/**
 * POST Handler: สร้าง chat session ใหม่
 * 
 * Purpose:
 * - สร้าง session ใหม่สำหรับผู้ใช้
 * - กำหนด title ของ session
 * - คืน session object ที่สร้างใหม่
 * 
 * Request Body:
 * - title: ชื่อของ session (optional, default: 'New Chat')
 * - userId: ID ของผู้ใช้ (required)
 * 
 * @param req NextRequest object ที่มี request body
 * @returns Response object พร้อมข้อมูล session ที่สร้างใหม่
 */
export async function POST(req: NextRequest) {
  try {
    // ===============================================
    // Step 1: Parse Request Body - แปลง Request Body
    // ===============================================
    
    /**
     * ดึงข้อมูลจาก request body
     * 
     * Expected Body Structure:
     * {
     *   "title": "Session Title", // optional
     *   "userId": "user123"       // required
     * }
     */
    const { title, userId } = await req.json()                             // แปลง JSON body เป็น object
    
    // ===============================================
    // Step 2: Validate Required Fields - ตรวจสอบข้อมูลที่จำเป็น
    // ===============================================
    
    /**
     * ตรวจสอบว่ามี userId หรือไม่
     * userId เป็นข้อมูลที่จำเป็นสำหรับสร้าง session
     */
    if (!userId) {
      return Response.json({ error: 'User ID is required' }, { status: 400 })
    }
    
    // ===============================================
    // Step 3: Database Connection - เชื่อมต่อฐานข้อมูล
    // ===============================================
    
    /**
     * เชื่อมต่อกับ PostgreSQL database
     * ใช้ connection pool เพื่อจัดการ connection อย่างมีประสิทธิภาพ
     */
    const client = await pool.connect()                                     // เชื่อมต่อ database
    
    try {
      // ===============================================
      // Step 4: Create New Session - สร้าง Session ใหม่
      // ===============================================
      
      /**
       * สร้าง chat session ใหม่ในฐานข้อมูล
       * 
       * Insert Query:
       * - title: ใช้ title ที่ส่งมา หรือ 'New Chat' เป็นค่าเริ่มต้น
       * - user_id: ID ของผู้ใช้
       * - created_at: จะถูกตั้งค่าอัตโนมัติโดย database
       * 
       * RETURNING clause: คืนค่าข้อมูลที่เพิ่งสร้าง
       */
      const result = await client.query(`
        INSERT INTO chat_sessions (title, user_id)
        VALUES ($1, $2)
        RETURNING id, title, created_at
      `, [title || 'New Chat', userId])                                     // ใช้ 'New Chat' ถ้าไม่มี title

      /**
       * ดึงข้อมูล session ที่เพิ่งสร้างจาก query result
       */
      const newSession = result.rows[0]                                     // session object ที่เพิ่งสร้าง

      // ===============================================
      // Step 5: Return Success Response - ส่งผลลัพธ์กลับ
      // ===============================================
      
      /**
       * ส่ง session ที่สร้างใหม่กลับไปยัง client
       * 
       * Response Structure:
       * - session: object ที่มีข้อมูล session ใหม่
       *   - id: ID ของ session
       *   - title: ชื่อของ session
       *   - created_at: เวลาที่สร้าง
       *   - message_count: จำนวนข้อความ (0 สำหรับ session ใหม่)
       */
      return NextResponse.json({
        session: {
          id: newSession.id,                                                // ID ของ session ใหม่
          title: newSession.title,                                          // ชื่อของ session
          created_at: newSession.created_at,                                // เวลาที่สร้าง
          message_count: 0                                                  // จำนวนข้อความเริ่มต้น (0)
        }
      })
    } finally {
      // ===============================================
      // Step 6: Cleanup - ปิดการเชื่อมต่อฐานข้อมูล
      // ===============================================
      
      /**
       * ปิดการเชื่อมต่อ database
       * ใช้ finally block เพื่อให้แน่ใจว่าจะปิดการเชื่อมต่อเสมอ
       */
      client.release()                                                      // คืน connection กลับไปยัง pool
    }
  } catch (error) {
    // ===============================================
    // Error Handling - จัดการข้อผิดพลาด
    // ===============================================
    
    /**
     * จัดการข้อผิดพลาดที่เกิดขึ้นระหว่างการสร้าง session
     * 
     * Process:
     * 1. แสดง error ใน console
     * 2. ส่ง error response กลับไปยัง client
     */
    console.error("Error creating chat session:", error)                   // แสดง error ใน console
    return NextResponse.json(
      { error: "Failed to create chat session" },                          // ข้อความ error
      { status: 500 }                                                      // HTTP 500 = Internal Server Error
    )
  }
}

// ===============================================
// PUT Method: อัปเดต Title ของ Chat Session
// ===============================================

/**
 * PUT Handler: อัปเดต title ของ chat session
 * 
 * Purpose:
 * - แก้ไขชื่อของ session ที่มีอยู่
 * - ตรวจสอบการมีอยู่ของ session
 * - คืน session object ที่อัปเดตแล้ว
 * 
 * Request Body:
 * - sessionId: ID ของ session ที่จะอัปเดต (required)
 * - title: ชื่อใหม่ของ session (required)
 * 
 * @param req NextRequest object ที่มี request body
 * @returns Response object พร้อมข้อมูล session ที่อัปเดต
 */
export async function PUT(req: NextRequest) {
  try {
    // ===============================================
    // Step 1: Parse Request Body - แปลง Request Body
    // ===============================================
    
    /**
     * ดึงข้อมูลจาก request body
     * 
     * Expected Body Structure:
     * {
     *   "sessionId": "session123", // required
     *   "title": "New Title"       // required
     * }
     */
    const { sessionId, title } = await req.json()                          // แปลง JSON body เป็น object
    
    // ===============================================
    // Step 2: Validate Required Fields - ตรวจสอบข้อมูลที่จำเป็น
    // ===============================================
    
    /**
     * ตรวจสอบว่ามี sessionId และ title หรือไม่
     * ทั้งสองข้อมูลเป็นข้อมูลที่จำเป็นสำหรับการอัปเดต
     */
    if (!sessionId || !title) {
      return NextResponse.json(
        { error: "Session ID and title are required" },                    // ข้อความ error
        { status: 400 }                                                    // HTTP 400 = Bad Request
      )
    }

    // ===============================================
    // Step 3: Database Connection - เชื่อมต่อฐานข้อมูล
    // ===============================================
    
    /**
     * เชื่อมต่อกับ PostgreSQL database
     * ใช้ connection pool เพื่อจัดการ connection อย่างมีประสิทธิภาพ
     */
    const client = await pool.connect()                                     // เชื่อมต่อ database
    
    try {
      // ===============================================
      // Step 4: Update Session Title - อัปเดต Title ของ Session
      // ===============================================
      
      /**
       * อัปเดต title ของ session ในฐานข้อมูล
       * 
       * Update Query:
       * - SET title = $1: ตั้งค่า title ใหม่
       * - WHERE id = $2: กรองด้วย session ID
       * - RETURNING: คืนค่าข้อมูลที่อัปเดตแล้ว
       */
      const result = await client.query(`
        UPDATE chat_sessions 
        SET title = $1 
        WHERE id = $2
        RETURNING id, title, created_at
      `, [title, sessionId])                                               // parameters: [title, sessionId]

      // ===============================================
      // Step 5: Check Update Result - ตรวจสอบผลลัพธ์การอัปเดต
      // ===============================================
      
      /**
       * ตรวจสอบว่าพบและอัปเดต session หรือไม่
       * หากไม่พบ session ให้ส่ง 404 error กลับ
       */
      if (result.rows.length === 0) {
        return NextResponse.json(
          { error: "Session not found" },                                  // ข้อความ error
          { status: 404 }                                                  // HTTP 404 = Not Found
        )
      }

      // ===============================================
      // Step 6: Return Success Response - ส่งผลลัพธ์กลับ
      // ===============================================
      
      /**
       * ส่ง session ที่อัปเดตแล้วกลับไปยัง client
       * 
       * Response Structure:
       * - session: object ที่มีข้อมูล session ที่อัปเดต
       */
      return NextResponse.json({
        session: result.rows[0]                                            // ข้อมูล session ที่อัปเดตแล้ว
      })
    } finally {
      // ===============================================
      // Step 7: Cleanup - ปิดการเชื่อมต่อฐานข้อมูล
      // ===============================================
      
      /**
       * ปิดการเชื่อมต่อ database
       * ใช้ finally block เพื่อให้แน่ใจว่าจะปิดการเชื่อมต่อเสมอ
       */
      client.release()                                                      // คืน connection กลับไปยัง pool
    }
  } catch (error) {
    // ===============================================
    // Error Handling - จัดการข้อผิดพลาด
    // ===============================================
    
    /**
     * จัดการข้อผิดพลาดที่เกิดขึ้นระหว่างการอัปเดต session
     * 
     * Process:
     * 1. แสดง error ใน console
     * 2. ส่ง error response กลับไปยัง client
     */
    console.error("Error updating chat session:", error)                   // แสดง error ใน console
    return NextResponse.json(
      { error: "Failed to update chat session" },                          // ข้อความ error
      { status: 500 }                                                      // HTTP 500 = Internal Server Error
    )
  }
}

// ===============================================
// DELETE Method: ลบ Chat Session และข้อความทั้งหมด
// ===============================================

/**
 * DELETE Handler: ลบ chat session และข้อความทั้งหมดในนั้น
 * 
 * Purpose:
 * - ลบ session และข้อมูลที่เกี่ยวข้องทั้งหมด
 * - ใช้ database transaction เพื่อความปลอดภัย
 * - ตรวจสอบการมีอยู่ของ session ก่อนลบ
 * 
 * Query Parameters:
 * - sessionId: ID ของ session ที่จะลบ (required)
 * 
 * Database Operations:
 * 1. ลบข้อความทั้งหมดใน session จากตาราง chat_messages
 * 2. ลบ session จากตาราง chat_sessions
 * 3. ใช้ transaction เพื่อให้แน่ใจว่าทั้งสองการลบสำเร็จ
 * 
 * @param req NextRequest object ที่มี query parameters
 * @returns Response object พร้อมสถานะการลบ
 */
export async function DELETE(req: NextRequest) {
  try {
    // ===============================================
    // Step 1: Extract Query Parameters - ดึง Parameters จาก URL
    // ===============================================
    
    /**
     * ดึง sessionId จาก URL query parameters
     * 
     * Expected URL format: /api/session?sessionId=xxx
     */
    const { searchParams } = new URL(req.url)                              // ดึง query parameters จาก URL
    const sessionId = searchParams.get('sessionId')                       // ดึง sessionId parameter
    
    // ===============================================
    // Step 2: Validate Required Parameters - ตรวจสอบ Parameters ที่จำเป็น
    // ===============================================
    
    /**
     * ตรวจสอบว่ามี sessionId หรือไม่
     * sessionId เป็นข้อมูลที่จำเป็นสำหรับการลบ
     */
    if (!sessionId) {
      return NextResponse.json(
        { error: "Session ID is required" },                               // ข้อความ error
        { status: 400 }                                                    // HTTP 400 = Bad Request
      )
    }

    // ===============================================
    // Step 3: Database Connection - เชื่อมต่อฐานข้อมูล
    // ===============================================
    
    /**
     * เชื่อมต่อกับ PostgreSQL database
     * ใช้ connection pool เพื่อจัดการ connection อย่างมีประสิทธิภาพ
     */
    const client = await pool.connect()                                     // เชื่อมต่อ database
    
    try {
      // ===============================================
      // Step 4: Start Database Transaction - เริ่ม Transaction
      // ===============================================
      
      /**
       * เริ่ม database transaction
       * 
       * Transaction Benefits:
       * - รับประกันว่าการลบทั้งหมดจะสำเร็จ หรือล้มเหลวไปด้วยกัน
       * - ป้องกันการเกิด orphaned data
       * - รองรับ rollback ถ้าเกิด error
       */
      await client.query('BEGIN')                                          // เริ่ม transaction
      
      // ===============================================
      // Step 5: Delete Messages - ลบข้อความทั้งหมดใน Session
      // ===============================================
      
      /**
       * ลบข้อความทั้งหมดในห้องแชทนี้ก่อน
       * 
       * Delete Order:
       * 1. ลบ chat_messages ก่อน (child table)
       * 2. ลบ chat_sessions ทีหลัง (parent table)
       * 
       * Reason: ป้องกัน foreign key constraint error
       */
      await client.query(`
        DELETE FROM chat_messages 
        WHERE session_id = $1
      `, [sessionId])                                                      // ลบข้อความทั้งหมดของ session นี้
      
      // ===============================================
      // Step 6: Delete Session - ลบ Chat Session
      // ===============================================
      
      /**
       * ลบ chat session จากฐานข้อมูล
       * 
       * Delete Query:
       * - WHERE id = $1: กรองด้วย session ID
       * - RETURNING id: คืนค่า ID ของ session ที่ลบ (เพื่อตรวจสอบว่าพบหรือไม่)
       */
      const result = await client.query(`
        DELETE FROM chat_sessions 
        WHERE id = $1
        RETURNING id
      `, [sessionId])                                                      // ลบ session และคืนค่า ID
      
      // ===============================================
      // Step 7: Check Delete Result - ตรวจสอบผลลัพธ์การลบ
      // ===============================================
      
      /**
       * ตรวจสอบว่าพบและลบ session หรือไม่
       * หากไม่พบ session ให้ rollback transaction และส่ง 404 error
       */
      if (result.rows.length === 0) {
        await client.query('ROLLBACK')                                     // ยกเลิก transaction
        return NextResponse.json(
          { error: "Session not found" },                                  // ข้อความ error
          { status: 404 }                                                  // HTTP 404 = Not Found
        )
      }
      
      // ===============================================
      // Step 8: Commit Transaction - ยืนยัน Transaction
      // ===============================================
      
      /**
       * commit transaction เมื่อการลบทั้งหมดสำเร็จ
       * 
       * Transaction Success:
       * - ข้อความทั้งหมดถูกลบแล้ว
       * - Session ถูกลบแล้ว
       * - ไม่เกิด error ใดๆ
       */
      await client.query('COMMIT')                                         // ยืนยัน transaction

      // ===============================================
      // Step 9: Return Success Response - ส่งผลลัพธ์กลับ
      // ===============================================
      
      /**
       * ส่งการยืนยันการลบกลับไปยัง client
       * 
       * Response Structure:
       * - message: ข้อความยืนยันการลบ
       * - sessionId: ID ของ session ที่ลบ
       */
      return NextResponse.json({
        message: "Session deleted successfully",                           // ข้อความยืนยัน
        sessionId: sessionId                                               // ID ของ session ที่ลบ
      })
    } catch (error) {
      // ===============================================
      // Transaction Error Handling - จัดการ Error ใน Transaction
      // ===============================================
      
      /**
       * จัดการ error ที่เกิดขึ้นระหว่าง transaction
       * 
       * Error Recovery:
       * 1. Rollback transaction เพื่อยกเลิกการเปลี่ยนแปลง
       * 2. Re-throw error เพื่อให้ outer catch handle ต่อ
       */
      await client.query('ROLLBACK')                                       // ยกเลิก transaction
      throw error                                                          // ส่ง error ต่อไปยัง outer catch
    } finally {
      // ===============================================
      // Step 10: Cleanup - ปิดการเชื่อมต่อฐานข้อมูล
      // ===============================================
      
      /**
       * ปิดการเชื่อมต่อ database
       * ใช้ finally block เพื่อให้แน่ใจว่าจะปิดการเชื่อมต่อเสมอ
       * ไม่ว่าจะเกิด error หรือไม่
       */
      client.release()                                                      // คืน connection กลับไปยัง pool
    }
  } catch (error) {
    // ===============================================
    // Error Handling - จัดการข้อผิดพลาด
    // ===============================================
    
    /**
     * จัดการข้อผิดพลาดที่เกิดขึ้นระหว่างการลบ session
     * 
     * Process:
     * 1. แสดง error ใน console
     * 2. ส่ง error response กลับไปยัง client
     */
    console.error("Error deleting chat session:", error)                   // แสดง error ใน console
    return NextResponse.json(
      { error: "Failed to delete chat session" },                          // ข้อความ error
      { status: 500 }                                                      // HTTP 500 = Internal Server Error
    )
  }
}