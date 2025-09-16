/**
 * ===============================================
 * Chat API Route Handler - API สำหรับการสนทนาพร้อมประวัติ
 * ===============================================
 * 
 * คำอธิบาย:
 * API Route Handler สำหรับจัดการการสนทนาแบบ streaming และเก็บประวัติ
 * รองรับการสร้าง chat sessions และจัดเก็บข้อความใน PostgreSQL
 * 
 * ฟีเจอร์หลัก:
 * - รับส่งข้อความแบบ real-time streaming
 * - เก็บประวัติการสนทนาใน database
 * - จัดการ chat sessions อัตโนมัติ
 * - ดึงประวัติการสนทนาจาก session ID
 * - รองรับ authentication และ authorization
 * 
 * HTTP Methods:
 * - POST: ส่งข้อความและรับคำตอบแบบ streaming
 * - GET: ดึงประวัติข้อความของ session
*/
import { NextRequest } from "next/server"
import { ChatOpenAI } from "@langchain/openai"
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts"
import { toUIMessageStream } from "@ai-sdk/langchain"
import { createUIMessageStreamResponse, UIMessage, UIMessageChunk } from "ai"
import { RunnableWithMessageHistory } from '@langchain/core/runnables'
import { PostgresChatMessageHistory } from "@langchain/community/stores/message/postgres"
import { Pool } from 'pg'
import { v4 as uuidv4 } from 'uuid'; // 👈 1. Import library สำหรับสร้าง ID ชั่วคราว

// ===============================================
// Route Configuration - การตั้งค่า Route
// ===============================================

/**
 * Runtime Configuration
 * กำหนดให้ API นี้ทำงานแบบ Node.js Runtime เพื่อรองรับ PostgreSQL
 * หมายเหตุ: ปิดการใช้ Edge Runtime เพราะ pg library ต้องการ Node.js APIs
 */
// export const runtime = "edge" // ปิดการใช้งาน

/**
 * Dynamic Configuration
 * export const dynamic = 'force-dynamic' เป็น Next.js Route Segment Config ที่ใช้เพื่อ
 * 1. บังคับให้ Route Handler ทำงานแบบ Dynamic - ไม่ให้ Next.js cache response
 * 2. ป้องกัน Static Generation - บังคับให้ render ใหม่ทุกครั้งที่มี request
 * 3. จำเป็นสำหรับ Streaming API - เพื่อให้ response streaming ทำงานได้ถูกต้อง
 */
export const dynamic = 'force-dynamic' // เปิดใช้งาน

/**
 * Maximum Duration Configuration
 * กำหนดเวลาสูงสุดที่ API จะทำงานได้ (30 วินาที)
 * ถ้าใช้เวลานานกว่านี้ จะถูกยกเลิกเพื่อป้องกัน timeout
 */
export const maxDuration = 30 // วินาที

// ===============================================
// Database Connection Setup - การตั้งค่าฐานข้อมูล
// ===============================================

/**
 * PostgreSQL Connection Pool
 * สร้าง connection pool สำหรับจัดการการเชื่อมต่อ database อย่างมีประสิทธิภาพ
 * 
 * Configuration:
 * - host: ที่อยู่ของ database server
 * - port: พอร์ตของ database
 * - user/password: ข้อมูลการเข้าถึง
 * - database: ชื่อฐานข้อมูล
 * - ssl: การตั้งค่า SSL สำหรับ production
*/
/**
 * PostgreSQL Connection Pool
 * ✅ สร้าง pool เพียงครั้งเดียวที่ Global Scope
 * เพื่อให้ทุก request สามารถใช้ connection pool นี้ร่วมกันได้
 */
const pool = new Pool({
  host: process.env.PG_HOST,
  port: Number(process.env.PG_PORT),
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  database: process.env.PG_DATABASE,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});


// ===============================================
// POST Handler - จัดการการส่งข้อความและตอบกลับ
// ===============================================

/**
 * POST Request Handler
 * 
 * ฟังก์ชันสำหรับรับข้อความจากผู้ใช้และส่งคำตอบกลับแบบ streaming
 * พร้อมเก็บประวัติการสนทนาใน database
 * 
 * Flow การทำงาน:
 * 1. ดึงข้อมูลจาก request body
 * 2. จัดการ session (สร้างใหม่หรือใช้ที่มีอยู่)
 * 3. ตั้งค่า AI model และ prompt
 * 4. สร้าง message history
 * 5. ประมวลผลและส่ง streaming response
 * 
 * @param req - NextRequest object
 * @returns Response แบบ streaming หรือ error response
 */
export async function POST(req: NextRequest) {
  try {

    // ===============================================
    // Step 1: Request Data Processing - ประมวลผลข้อมูล Request
    // ===============================================
    /**
     * ดึงข้อมูลจาก request body ที่ส่งมาจาก useChat hook
     * 
     * ข้อมูลที่ได้รับ:
     * - messages: รายการข้อความในการสนทนา
     * - sessionId: ID ของ session (optional)
     * - userId: ID ของผู้ใช้สำหรับ authentication
     */
    const { messages, sessionId, userId }: { 
      messages: UIMessage[];                    // รายการข้อความทั้งหมดในการสนทนา
      sessionId?: string;                       // ID ของ session ปัจจุบัน (optional)
      userId?: string;                          // ID ของผู้ใช้ที่ส่งข้อความ
    } = await req.json()

    // ===============================================
    // Step 2: Optimistic Session Management - จัดการ Session แบบใหม่
    // ===============================================
    const isNewSession = !sessionId;
    
    /**
     * ✅ Optimistic Approach:
     * 1. ถ้าเป็น session ใหม่ (ยังไม่มี sessionId) ให้สร้าง ID ชั่วคราว (UUID) ขึ้นมาทันที
     * 2. ถ้าเป็น session เดิม ก็ใช้ ID เดิมต่อไป
     * 3. เราจะไม่รอการสร้าง session ในฐานข้อมูล แต่จะเรียก AI ทันที
     */
    const currentSessionId = sessionId || uuidv4() // 👈 2. สร้าง ID ชั่วคราวถ้าไม่มี sessionId

    // ===============================================
    // Step 3: Session Validation - ตรวจสอบความถูกต้องของ Session
    // ===============================================
    /**
     * ตรวจสอบว่า currentSessionId มีค่าแน่นอน
     * ถ้าไม่มีให้ throw error
    */
    if (!currentSessionId) {
      throw new Error("Failed to get or create session ID")
    }

    // ===============================================
    // Step 4: AI Model Setup - ตั้งค่า AI Model และ Prompt
    // ===============================================
    /**
     * สร้าง Prompt Template เพื่อกำหนดบทบาทและรูปแบบการตอบของ AI
     * 
     * Structure:
     * 1. System message: กำหนดบทบาทและภาษาที่ใช้ตอบ
     * 2. Chat history: ประวัติการสนทนาที่ผ่านมา
     * 3. Human input: ข้อความใหม่จากผู้ใช้
     */
    const prompt = ChatPromptTemplate.fromMessages([
      ["system", "You are a helpful and friendly AI assistant. Answer in Thai language when user asks in Thai."],
      new MessagesPlaceholder("chat_history"),                      // placeholder สำหรับประวัติการสนทนา
      ["human", "{input}"],                                         // placeholder สำหรับ input ของผู้ใช้
    ])

    /**
     * สร้างและตั้งค่า OpenAI model
     * 
     * Configuration:
     * - model: รุ่นของ AI model ที่ใช้
     * - temperature: ความสร้างสรรค์ของคำตอบ (0-1)
     * - maxTokens: จำนวน token สูงสุดในการตอบ
     * - streaming: เปิดใช้ streaming response
     */
    const model = new ChatOpenAI({
      model: "gpt-4o-mini",                                         // ระบุรุ่น AI model ที่ใช้
      temperature: 0.7,                                             // ความสร้างสรรค์
      maxTokens: 1000,                                              // จำนวน token สูงสุดสำหรับคำตอบ
      streaming: true,                                              // เปิดใช้ streaming response
    })

    /**
     * สร้าง Chain โดยการเชื่อมต่อ Prompt กับ Model เข้าด้วยกัน
     * Chain คือ pipeline ที่ประมวลผล input ผ่าน prompt แล้วส่งไป model
     */
    const chain = prompt.pipe(model)

    // ===============================================
    // Step 5: Message History Setup - ตั้งค่าประวัติข้อความ
    // ===============================================
    /**
     * สร้าง Message History สำหรับ session นี้
     * ใช้ PostgresChatMessageHistory เพื่อเก็บและดึงประวัติจาก database
     * 
     * Configuration:
     * - sessionId: ID ของ session ปัจจุบัน
     * - tableName: ชื่อตารางที่เก็บข้อความ
     * - pool: connection pool สำหรับ database
    */
    /**
     * ✅ แก้ไข: ใช้ pool ที่สร้างไว้แล้ว ไม่สร้างใหม่
     * นำ instance ของ pool ที่สร้างไว้ด้านบนมาใช้โดยตรง
     * ซึ่งจะช่วยลด overhead ในการสร้าง connection ใหม่ทุกครั้ง
    */
    const messageHistory = new PostgresChatMessageHistory({
      sessionId: currentSessionId,                                  // 👈 ใช้ ID ปัจจุบัน (อาจจะเป็น ID ชั่วคราว)
      tableName: "chat_messages",                                   // ชื่อตารางในฐานข้อมูล
      pool: pool, // <-- ใช้ตัวแปร pool ที่สร้างไว้ด้านนอก
    })

    /**
     * สร้าง Chain with Message History
     * เชื่อมต่อ chain กับ message history เพื่อให้ AI จำบริบทการสนทนาได้
     * 
     * Configuration:
     * - runnable: chain ที่จะประมวลผล
     * - getMessageHistory: ฟังก์ชันดึงประวัติข้อความ
     * - inputMessagesKey: key สำหรับ input message
     * - historyMessagesKey: key สำหรับประวัติข้อความ
     */
    const chainWithHistory = new RunnableWithMessageHistory({
      runnable: chain,                                             // chain ที่จะใช้ประมวลผล
      getMessageHistory: () => messageHistory,                     // ฟังก์ชันดึงประวัติข้อความ
      inputMessagesKey: "input",                                   // key สำหรับข้อความ input
      historyMessagesKey: "chat_history",                          // key สำหรับประวัติการสนทนา
    })

    // ===============================================
    // Step 6: Extract User Input - ดึงข้อความจากผู้ใช้
    // ===============================================
    /**
     * ดึง input จากข้อความล่าสุดของผู้ใช้
     * 
     * Process:
     * 1. หาข้อความล่าสุดที่มี role เป็น 'user'
     * 2. ตรวจสอบและดึงข้อความจาก parts array
     * 3. ตรวจสอบความถูกต้องก่อนส่งต่อ
     */
    const lastUserMessage = messages.filter(m => m.role === 'user').pop();  // หาข้อความล่าสุดของ user
    let input = ""

    /**
     * ตรวจสอบและดึงข้อความจาก message parts
     * - ตรวจสอบว่ามี parts array ที่ไม่ว่าง
     * - หา part ที่เป็นประเภท 'text'
     * - ดึงข้อความออกมา
     */
    if (lastUserMessage && Array.isArray(lastUserMessage.parts) && lastUserMessage.parts.length > 0) {
      // หา part แรกที่เป็นประเภท text
      const textPart = lastUserMessage.parts.find(part => part.type === 'text');
      if (textPart) {
        input = textPart.text;                                              // ดึงข้อความออกมา
      }
    }

    /**
     * ตรวจสอบความถูกต้องของ input
     * หาก input เป็นค่าว่าง ให้ส่ง error response กลับ
     */
    if (!input) {
      console.warn("Could not extract user input from the message parts."); // แสดงคำเตือนใน console
      return new Response("No valid user input found.", { status: 400 });   // ส่ง error response กลับ
    }

    // ===============================================
    // Step 7: Stream Response Generation - สร้างการตอบกลับแบบ Streaming
    // ✅ เรียก AI ทันทีโดยไม่ต้องรอฐานข้อมูล
    // ===============================================
    /**
     * เรียกใช้ Chain เพื่อประมวลผลและสร้างคำตอบแบบ streaming
     * 
     * Process Flow:
     * 1. ส่ง input และ session config ไป chain
     * 2. Chain จะดึงประวัติการสนทนาจาก database
     * 3. รวม input กับประวัติเป็น prompt
     * 4. ส่ง prompt ไป OpenAI model
     * 5. รับ streaming response กลับมา
     * 
     * Parameters:
     * - input: ข้อความจากผู้ใช้
     * - configurable: การตั้งค่า session
     */
    const stream = await chainWithHistory.stream(
      { input: input },
      { configurable: { sessionId: currentSessionId } }
    )

    // ===============================================
    // Step 8: สร้าง Stream Wrapper เพื่อบันทึกข้อมูลทีหลัง
    // ===============================================
    /**
     * ✅ สร้าง ReadableStream ที่ครอบ original stream
     * และจัดการการบันทึกข้อมูลในเบื้องหลัง
     */
    const wrappedStream = new ReadableStream<UIMessageChunk>({
      async start(controller) {
        try {
          // แปลง ReadableStream เป็น async iterable
          const uiStream = toUIMessageStream(stream);
          const reader = uiStream.getReader();
          
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) {
                controller.close();
                break;
              }
              
              // ส่งต่อ chunk ไปยัง client
              controller.enqueue(value);
            }
          } finally {
            reader.releaseLock();
          }
        } catch (error) {
          controller.error(error);
        } finally {
          // ---- บล็อคนี้จะทำงานหลังจากที่ stream ถูกส่งไปให้ client จนครบแล้ว ----
          if (isNewSession) {
            console.log("Stream finished. Saving new session to database...");
            // เรียกใช้ฟังก์ชันบันทึกข้อมูล แต่ไม่ต้องรอ (fire-and-forget)
            // เพื่อไม่ให้การเชื่อมต่อของ client ค้างรอ
            saveNewSessionAndUpdateMessages(currentSessionId, userId, messages).catch(err => {
              console.error("Error saving new session in background:", err);
            })
          }
        }
      }
    });

    return createUIMessageStreamResponse({
      stream: wrappedStream, // 👈 ใช้ ReadableStream ที่เราสร้างขึ้น
      headers: {
        'x-session-id': currentSessionId,
      },
    })

  } catch (error) {
    // ===============================================
    // Error Handling - จัดการข้อผิดพลาด
    // ===============================================
    
    /**
     * จัดการข้อผิดพลาดที่เกิดขึ้นระหว่างการประมวลผล
     * 
     * Process:
     * 1. แสดง error ใน console เพื่อ debugging
     * 2. ส่ง error response กลับไปยัง client
     * 3. รวมรายละเอียด error เพื่อช่วยในการแก้ไข
     */
    console.error("API Error:", error)

    /**
     * ส่ง error response กลับไปยัง client
     * 
     * Response Structure:
     * - error: ข้อความ error หลัก
     * - details: รายละเอียด error เพิ่มเติม
     * - status: HTTP status code 500 (Internal Server Error)
     * - headers: กำหนด content type เป็น JSON
     */
    return new Response(
      JSON.stringify({
        error: "An error occurred while processing your request",          // ข้อความ error หลัก
        details: error instanceof Error ? error.message : 'Unknown error'  // รายละเอียด error
      }),
      {
        status: 500,                                                        // HTTP status 500 = Internal Server Error
        headers: { "Content-Type": "application/json" },                   // กำหนด content type เป็น JSON
      }
    )
  }
}

// ===============================================
// 🚀 ฟังก์ชันใหม่: สำหรับบันทึก Session และอัปเดตข้อความ
// ===============================================
/**
 * บันทึก session ใหม่และอัปเดต ID ของข้อความที่ถูกบันทึกด้วย ID ชั่วคราว
 * @param tempSessionId ID ชั่วคราว (UUID) ที่ใช้ระหว่างการ stream
 * @param userId ID ของผู้ใช้
 * @param messages รายการข้อความเพื่อใช้สร้าง title
 */
async function saveNewSessionAndUpdateMessages(tempSessionId: string, userId: string | undefined, messages: UIMessage[]) {
  if (!userId) {
    console.error("Cannot save session without a User ID.");
    return;
  }

  const client = await pool.connect();
  try {
    // 1. สร้าง Title จากข้อความแรก
    const firstMessage = messages.find(m => m.role === 'user');
    let title = 'New Chat';
    if (firstMessage && Array.isArray(firstMessage.parts) && firstMessage.parts.length > 0) {
      const textPart = firstMessage.parts.find(part => part.type === 'text');
      if (textPart && typeof textPart.text === 'string') {
        title = textPart.text.slice(0, 50) + (textPart.text.length > 50 ? '...' : '');
      }
    }
    
    // 2. บันทึก session ใหม่ลงในตาราง chat_sessions และดึง ID จริง (permanent ID) กลับมา
    const sessionResult = await client.query(`
      INSERT INTO chat_sessions (title, user_id)
      VALUES ($1, $2)
      RETURNING id
    `, [title, userId]);
    
    const permanentSessionId = sessionResult.rows[0].id;
    console.log(`Created new session with permanent ID: ${permanentSessionId}`);

    // 3. อัปเดตข้อความในตาราง chat_messages ที่ถูกบันทึกด้วย ID ชั่วคราว
    //    ให้เปลี่ยนไปใช้ ID จริงที่เพิ่งได้มา
    const updateResult = await client.query(`
      UPDATE chat_messages
      SET session_id = $1
      WHERE session_id = $2
    `, [permanentSessionId, tempSessionId]);

    console.log(`Updated ${updateResult.rowCount} messages from temp ID ${tempSessionId} to permanent ID ${permanentSessionId}.`);

  } catch (error) {
    console.error("Failed to save session and update messages:", error);
  } finally {
    client.release(); // คืน connection กลับสู่ pool เสมอ
  }
}

// ===============================================
// GET Method: ดึงประวัติข้อความของ Session
// ===============================================
/**
 * GET Handler: ดึงประวัติข้อความของ session ที่ระบุ
 * 
 * Purpose:
 * - ดึงข้อความทั้งหมดของ session จาก database
 * - แปลงข้อมูลให้อยู่ในรูปแบบที่ Frontend เข้าใจ
 * - ส่งผลลัพธ์กลับในรูปแบบ JSON
 * 
 * @param req NextRequest object ที่มี query parameters
 * @returns Response object พร้อมข้อมูลข้อความ
 */
export async function GET(req: NextRequest) {
  try {
    // ===============================================
    // Step 1: Extract and Validate Parameters - ดึงและตรวจสอบ Parameters
    // ===============================================
    
    /**
     * ดึง sessionId จาก URL query parameters
     * 
     * Expected URL format: /api/chat_05_optimistic?sessionId=xxx
     */
    const { searchParams } = new URL(req.url)                               // ดึง query parameters จาก URL
    const sessionId = searchParams.get('sessionId')                         // ดึง sessionId parameter

    /**
     * ตรวจสอบว่ามี sessionId หรือไม่
     * หากไม่มี ให้ส่ง error response กลับ
     */
    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: "Session ID is required" }),               // ข้อความ error
        { status: 400, headers: { "Content-Type": "application/json" } }   // HTTP 400 = Bad Request
      )
    }

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
      // Step 3: Query Messages - ดึงข้อความจากฐานข้อมูล
      // ===============================================
      
      /**
       * ดึงข้อความทั้งหมดของ session นี้จากตาราง chat_messages
       * 
       * Query Details:
       * - ดึงฟิลด์ message (JSON), message type, และ created_at
       * - กรองด้วย session_id
       * - เรียงลำดับตาม created_at (เก่าไปใหม่)
       */
      const result = await client.query(`
        SELECT message, message->>'type' as message_type, created_at
        FROM chat_messages 
        WHERE session_id = $1 
        ORDER BY created_at ASC
      `, [sessionId])

      // ===============================================
      // Step 4: Transform Data - แปลงข้อมูลให้เหมาะกับ Frontend
      // ===============================================
      
      /**
       * แปลงข้อมูลจาก database ให้อยู่ในรูปแบบที่ Frontend ต้องการ
       * 
       * Transformation Process:
       * 1. วนลูปผ่านทุก row ที่ได้จาก query
       * 2. กำหนด role ตาม message type
       * 3. ดึง content จาก JSON message field
       * 4. สร้าง object ในรูปแบบที่ UI เข้าใจ
       */
      const messages = result.rows.map((row, index) => {
        const messageData = row.message                                     // ข้อมูล message ในรูปแบบ JSON
        
        /**
         * กำหนด role ตาม type ที่ดึงจาก JSON field
         * - 'ai' → 'assistant' (ข้อความจาก AI)
         * - 'human' → 'user' (ข้อความจากผู้ใช้)
         * - default → 'user' (ค่าเริ่มต้น)
         */
        let role = 'user'                                                   // ค่าเริ่มต้น
        if (row.message_type === 'ai') {
          role = 'assistant'                                                // ข้อความจาก AI
        } else if (row.message_type === 'human') {
          role = 'user'                                                     // ข้อความจากผู้ใช้
        }
        
        /**
         * สร้าง message object ในรูปแบบที่ Frontend ต้องการ
         * 
         * Object Structure:
         * - id: unique identifier สำหรับ message
         * - role: บทบาทของผู้ส่ง (user/assistant)
         * - content: เนื้อหาข้อความ
         * - createdAt: เวลาที่สร้างข้อความ
         */
        return {
          id: `history-${index}`,                                                        // unique ID สำหรับ message
          role: role,                                                                    // บทบาทของผู้ส่ง
          content: messageData.content || messageData.text || messageData.message || '', // เนื้อหาข้อความ
          createdAt: row.created_at                                                      // เวลาที่สร้าง
        }
      })

      // ===============================================
      // Step 5: Return Success Response - ส่งผลลัพธ์กลับ
      // ===============================================
      
      /**
       * ส่ง success response กลับไปยัง client
       * 
       * Response Structure:
       * - messages: array ของข้อความที่แปลงแล้ว
       * - status: 200 (OK)
       * - headers: กำหนด content type เป็น JSON
       */
      return new Response(
        JSON.stringify({ messages }),                                       // ข้อมูลข้อความในรูปแบบ JSON
        { 
          status: 200,                                                      // HTTP 200 = OK
          headers: { "Content-Type": "application/json" }                  // กำหนด content type
        }
      )
    } finally {
      // ===============================================
      // Step 6: Cleanup - ปิดการเชื่อมต่อฐานข้อมูล
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
     * จัดการข้อผิดพลาดที่เกิดขึ้นระหว่างการดึงข้อความ
     * 
     * Process:
     * 1. แสดง error ใน console
     * 2. ส่ง error response กลับไปยัง client
     */
    console.error("Error fetching messages:", error)                        // แสดง error ใน console
    
    return new Response(
      JSON.stringify({
        error: "Failed to fetch messages",                                  // ข้อความ error หลัก
        details: error instanceof Error ? error.message : 'Unknown error'  // รายละเอียด error
      }),
      {
        status: 500,                                                        // HTTP 500 = Internal Server Error
        headers: { "Content-Type": "application/json" }                    // กำหนด content type
      }
    )
  }
}