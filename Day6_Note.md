## AI Chatbot with LangChain & Next.js - Day 6

### Chat History with PostgreSQL (Continued)

#### LaTeX/Math Support in Messages
- ใช้ KaTeX สำหรับแสดงสูตรคณิตศาสตร์ในข้อความ
- รองรับ inline math: `\( สูตร \)` → $สูตร$
- รองรับ display math: `\[ สูตร \]` → $$สูตร$$
- แปลงอัตโนมัติจาก AI response format
- ติดตั้ง library: `katex`, `rehype-katex`, `remark-math`

#### ตัวอย่าง
$$\int_{-\infty}^\infty e^{-x^2} = \sqrt{\pi}$$

#### 1. เพิ่ม library สำหรับ LaTeX/Math
```bash {.line-numbers}
npm install katex rehype-katex remark-math
npm install @types/katex --save-dev
```

#### 2. อัพเดทไฟล์ route.ts 
แก้ไขไฟล์ `src/app/api/chat_05_history/route.ts`

```typescript {.line-numbers}
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
import { createUIMessageStreamResponse, UIMessage } from "ai"
import { RunnableWithMessageHistory } from '@langchain/core/runnables'
import { PostgresChatMessageHistory } from "@langchain/community/stores/message/postgres"
import { Pool } from 'pg'

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
const pool = new Pool({
  host: process.env.PG_HOST,                                        // ที่อยู่ database server
  port: Number(process.env.PG_PORT),                               // พอร์ต database (แปลงเป็น number)
  user: process.env.PG_USER,                                       // username สำหรับเข้าถึง database
  password: process.env.PG_PASSWORD,                               // password สำหรับเข้าถึง database
  database: process.env.PG_DATABASE,                               // ชื่อ database ที่ต้องการเชื่อมต่อ
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,  // SSL config สำหรับ production
})

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
    // Step 2: Session Management - จัดการ Session
    // ===============================================
    /**
     * ตัวแปรเก็บ session ID ปัจจุบัน
     * จะใช้ sessionId ที่มีอยู่หรือสร้างใหม่ถ้ายังไม่มี
     */
    let currentSessionId = sessionId

    /**
     * ตรวจสอบและสร้าง session ใหม่ถ้าจำเป็น
     */
    if (!currentSessionId) {
      // Step 2.1: เชื่อมต่อ database
      const client = await pool.connect()
      try {
        // Step 2.2: สร้าง title จากข้อความแรกของผู้ใช้
        const firstMessage = messages.find(m => m.role === 'user');
        let title = 'New Chat';                // title เริ่มต้น

        /**
         * ดึง title จากข้อความแรกของผู้ใช้
         * จำกัดความยาวไม่เกิน 50 ตัวอักษร
         */
        if (firstMessage && Array.isArray(firstMessage.parts) && firstMessage.parts.length > 0) {
          const textPart = firstMessage.parts.find(part => part.type === 'text');
          if (textPart && typeof textPart.text === 'string') {
            title = textPart.text.slice(0, 50) + (textPart.text.length > 50 ? '...' : '') // ตัดข้อความให้ไม่เกิน 50 ตัวอักษร
          }
        }

        // Step 2.3: ตรวจสอบ userId
        if (!userId) {
          throw new Error("User ID is required")
        }
        
        // Step 2.4: บันทึก session ใหม่ลง database
        const result = await client.query(`
          INSERT INTO chat_sessions (title, user_id)
          VALUES ($1, $2)
          RETURNING id
        `, [title, userId])
        
        // Step 2.5: เก็บ session ID ที่ได้จาก database
        currentSessionId = result.rows[0].id

      } finally {
        // Step 2.6: ปิดการเชื่อมต่อ database
        client.release()
      }
    }

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
    const messageHistory = new PostgresChatMessageHistory({
      sessionId: currentSessionId,                                  // ID ของ session ปัจจุบัน
      tableName: "chat_messages",                                   // ชื่อตารางในฐานข้อมูล
      pool: new Pool({                                              // สร้าง pool ใหม่สำหรับ message history
        host: process.env.PG_HOST,
        port: Number(process.env.PG_PORT),
        user: process.env.PG_USER,
        password: process.env.PG_PASSWORD,
        database: process.env.PG_DATABASE,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      }),
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
      {
        input: input,                                                       // ข้อความจากผู้ใช้
      },
      {
        configurable: {
          sessionId: currentSessionId,                                      // ID ของ session สำหรับดึงประวัติ
        },
      }
    )

    // ===============================================
    // Step 8: Return UI Message Stream Response - ส่งผลลัพธ์กลับในรูปแบบ UI Stream
    // ===============================================
    /**
     * สร้าง UI Message Stream Response สำหรับส่งกลับไปยัง Frontend
     * 
     * Features:
     * - แปลง stream เป็นรูปแบบที่ UI เข้าใจได้
     * - ส่ง session ID ผ่าน header
     * - รองรับ streaming response
     */
    const response = createUIMessageStreamResponse({
      stream: toUIMessageStream(stream),                                    // แปลง stream เป็น UI format
      headers: currentSessionId ? {
        'x-session-id': currentSessionId,                                   // ส่ง session ID ผ่าน header
      } : undefined,
    })

    return response                                                         // ส่ง response กลับไปยัง client

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
     * Expected URL format: /api/chat_05_history?sessionId=xxx
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
```
#### 3. อัพเดทไฟล์ custom-chat-transport.ts
แก้ไขไฟล์ `src/lib/custom-chat-transport.ts`
```typescript {.line-numbers}
import { DefaultChatTransport } from 'ai'

type CustomChatTransportOptions = {
  api?: string
  headers?: Record<string, string> | Headers
  credentials?: RequestCredentials
  fetch?: typeof fetch
  // เพิ่ม callback ของเราเอง
  onResponse: (response: Response) => void
}

export const createCustomChatTransport = ({
  onResponse,
  ...options
}: CustomChatTransportOptions) => {
  const originalFetch = options.fetch ?? fetch;

  const customFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const response = await originalFetch(input, init);
    
    // เรียก callback ของเราพร้อมกับ response ที่ได้
    onResponse(response.clone()) // ใช้ .clone() เพื่อให้ stream ยังอ่านต่อได้

    return response;
  };

  return new DefaultChatTransport({
    ...options,
    fetch: customFetch,
  })
}
```

#### 4. อัพเดทไฟล์ message.tsx
แก้ไขไฟล์ `src/components/ui/message.tsx`
```typescript {.line-numbers}
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { Markdown } from "./markdown"

export type MessageProps = {
  children: React.ReactNode
  className?: string
  isAssistant?: boolean
  bubbleStyle?: boolean
} & React.HTMLProps<HTMLDivElement>

const Message = ({ children, className, isAssistant = false, bubbleStyle = false, ...props }: MessageProps) => {
  if (bubbleStyle) {
    if (isAssistant) {
      // AI messages: เต็มความกว้าง, ไม่ต้องใช้ flex-col
      return (
        <div 
          className={cn(
            "group w-full",
            className
          )} 
          {...props}
        >
          {children}
        </div>
      )
    } else {
      // User messages: แบบ bubble ด้านขวา
      return (
        <div 
          className={cn(
            "group flex flex-col items-end",
            className
          )} 
          {...props}
        >
          {children}
        </div>
      )
    }
  }
  
  return (
    <div className={cn("flex gap-3", className)} {...props}>
      {children}
    </div>
  )
}

export type MessageAvatarProps = {
  src: string
  alt: string
  fallback?: string
  delayMs?: number
  className?: string
}

const MessageAvatar = ({
  src,
  alt,
  fallback,
  delayMs,
  className,
}: MessageAvatarProps) => {
  return (
    <Avatar className={cn("h-8 w-8 shrink-0", className)}>
      <AvatarImage src={src} alt={alt} />
      {fallback && (
        <AvatarFallback delayMs={delayMs}>{fallback}</AvatarFallback>
      )}
    </Avatar>
  )
}

export type MessageContentProps = {
  children: React.ReactNode
  markdown?: boolean
  className?: string
  isAssistant?: boolean
  bubbleStyle?: boolean
} & React.ComponentProps<typeof Markdown> &
  React.HTMLProps<HTMLDivElement>

const MessageContent = ({
  children,
  markdown = false,
  className,
  isAssistant = false,
  bubbleStyle = false,
  ...props
}: MessageContentProps) => {
  let classNames
  
  if (bubbleStyle) {
    if (isAssistant) {
      // AI messages: เต็มความกว้าง
      classNames = cn(
        "w-full px-4 py-3 mb-1 dark:bg-transparent text-gray-800 dark:text-gray-100",
        "[&_ul]:space-y-0 [&_ol]:space-y-0 [&_li]:my-0 [&_li]:py-0.5",
        "prose prose-li:my-0 prose-ul:my-2 prose-ol:my-2 prose-p:my-2",
        "dark:prose-invert dark:prose-headings:text-gray-100 dark:prose-p:text-gray-100 dark:prose-li:text-gray-100",
        className
      )
    } else {
      // User messages: แบบ bubble
      classNames = cn(
        "user-message bg-[#e5f3ff] text-primary max-w-[75%] rounded-3xl px-5 py-2.5 break-words whitespace-pre-wrap",
        className
      )
    }
  } else {
    classNames = cn(
      "rounded-lg p-2 text-foreground bg-secondary prose break-words whitespace-normal",
      className
    )
  }

  return markdown ? (
    <Markdown className={classNames} {...props}>
      {children as string}
    </Markdown>
  ) : (
    <div className={classNames} {...props}>
      {children}
    </div>
  )
}

export type MessageActionsProps = {
  children: React.ReactNode
  className?: string
  isAssistant?: boolean
  bubbleStyle?: boolean
} & React.HTMLProps<HTMLDivElement>

const MessageActions = ({
  children,
  className,
  isAssistant = false,
  bubbleStyle = false,
  ...props
}: MessageActionsProps) => {
  let classNames
  
  if (bubbleStyle) {
    if (isAssistant) {
      // AI messages: ชิดซ้าย
      classNames = cn(
        "flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity mb-2 justify-start ml-2",
        className
      )
    } else {
      // User messages: ชิดขวา
      classNames = cn(
        "flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity mb-2 justify-end mr-2",
        className
      )
    }
  } else {
    classNames = cn("text-muted-foreground flex items-center gap-2", className)
  }
  
  return (
    <div className={classNames} {...props}>
      {children}
    </div>
  )
}

export type MessageActionProps = {
  className?: string
  tooltip: React.ReactNode
  children: React.ReactNode
  side?: "top" | "bottom" | "left" | "right"
  bubbleStyle?: boolean
} & React.ComponentProps<typeof Tooltip>

const MessageAction = ({
  tooltip,
  children,
  className,
  side = "top",
  bubbleStyle = false,
  ...props
}: MessageActionProps) => {
  const buttonClassName = bubbleStyle 
    ? "h-7 w-7 p-0 text-gray-500 hover:text-gray-700 rounded-full"
    : ""

  return (
    <TooltipProvider>
      <Tooltip {...props}>
        <TooltipTrigger asChild>
          <div className={cn(buttonClassName, className)}>
            {children}
          </div>
        </TooltipTrigger>
        <TooltipContent side={side}>
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export { Message, MessageAvatar, MessageContent, MessageActions, MessageAction }
```
#### 5. อัพเดทไฟล์ markdown.tsx
แก้ไขไฟล์ `src/components/ui/markdown.tsx`
```typescript {.line-numbers}
import { cn } from "@/lib/utils"
import { marked } from "marked"
import { memo, useId, useMemo } from "react"
import ReactMarkdown, { Components } from "react-markdown"
import remarkBreaks from "remark-breaks"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"
import { CodeBlock, CodeBlockCode } from "./code-block"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./table"

export type MarkdownProps = {
  children: string
  id?: string
  className?: string
  components?: Partial<Components>
}

function parseMarkdownIntoBlocks(markdown: string): string[] {
  const tokens = marked.lexer(markdown)
  return tokens.map((token) => token.raw)
}

// Convert AI supplied LaTeX delimiters \( ... \) and \[ ... \] to
// remark-math compatible $...$ and $$...$$ while skipping code fences.
function normalizeLatexDelimiters(markdown: string): string {
  const segments = markdown.split(/(```[\s\S]*?```)/g)
  return segments
    .map((segment) => {
      if (segment.startsWith("```")) return segment // skip code blocks
      return segment
        .replace(/\\\[((?:.|\n)+?)\\\]/g, (_, expr: string) => `\n\n$$${expr.trim()}$$\n\n`)
        .replace(/\\\((.+?)\\\)/g, (_, expr: string) => `$${expr.trim()}$`)
    })
    .join("")
}

function extractLanguage(className?: string): string {
  if (!className) return "plaintext"
  const match = className.match(/language-(\w+)/)
  return match ? match[1] : "plaintext"
}

const INITIAL_COMPONENTS: Partial<Components> = {
  code: function CodeComponent({ className, children, ...props }) {
    const isInline =
      !props.node?.position?.start.line ||
      props.node?.position?.start.line === props.node?.position?.end.line

    if (isInline) {
      return (
        <span
          className={cn(
            "bg-primary-foreground rounded-sm px-1 font-mono text-sm",
            className
          )}
          {...props}
        >
          {children}
        </span>
      )
    }

    const language = extractLanguage(className)

    return (
      <CodeBlock className={className}>
        <CodeBlockCode code={children as string} language={language} />
      </CodeBlock>
    )
  },
  pre: function PreComponent({ children }) {
    return <>{children}</>
  },
  table: function TableComponent({ children }) {
    return (
      <div className="my-4 overflow-x-auto">
        <Table>
          {children}
        </Table>
      </div>
    )
  },
  thead: function TableHeaderComponent({ children }) {
    return <TableHeader>{children}</TableHeader>
  },
  tbody: function TableBodyComponent({ children }) {
    return <TableBody>{children}</TableBody>
  },
  tr: function TableRowComponent({ children }) {
    return <TableRow>{children}</TableRow>
  },
  th: function TableHeadComponent({ children }) {
    return <TableHead>{children}</TableHead>
  },
  td: function TableCellComponent({ children }) {
    return <TableCell>{children}</TableCell>
  },
  ol: function OrderedListComponent({ children }) {
    return <ol className="list-decimal list-outside space-y-1 my-4 ml-6">{children}</ol>
  },
  ul: function UnorderedListComponent({ children }) {
    return <ul className="list-disc list-outside space-y-1 my-4 ml-6">{children}</ul>
  },
  li: function ListItemComponent({ children }) {
    return <li className="pl-2">{children}</li>
  },
}

const MemoizedMarkdownBlock = memo(
  function MarkdownBlock({
    content,
    components = INITIAL_COMPONENTS,
  }: {
    content: string
    components?: Partial<Components>
  }) {
    return (
      <ReactMarkdown
  remarkPlugins={[remarkGfm, remarkBreaks, remarkMath]}
  rehypePlugins={[rehypeKatex]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    )
  },
  function propsAreEqual(prevProps, nextProps) {
    return prevProps.content === nextProps.content
  }
)

MemoizedMarkdownBlock.displayName = "MemoizedMarkdownBlock"

function MarkdownComponent({
  children,
  id,
  className,
  components = INITIAL_COMPONENTS,
}: MarkdownProps) {
  const generatedId = useId()
  const blockId = id ?? generatedId
  const normalized = useMemo(() => normalizeLatexDelimiters(children), [children])
  const blocks = useMemo(() => parseMarkdownIntoBlocks(normalized), [normalized])

  return (
    <div className={className}>
      {blocks.map((block, index) => (
        <MemoizedMarkdownBlock
          key={`${blockId}-block-${index}`}
          content={block}
          components={components}
        />
      ))}
    </div>
  )
}

const Markdown = memo(MarkdownComponent)
Markdown.displayName = "Markdown"

export { Markdown }
```

#### 6. อัพเดทไฟล์ layout.tsx
แก้ไขไฟล์ `src/app/layout.tsx`
```typescript {.line-numbers}
...
import "katex/dist/katex.min.css"
...
```

#### 7. อัพเดทไฟล์ new-chat.tsx
แก้ไขไฟล์ `src/components/new-chat.tsx`
```typescript {.line-numbers}
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
```

#### 8. เพิ่ม Chat Session Management API Routes
สร้างไฟล์ `app/api/chat_05_history/session/route.ts` เพื่อจัดการการสร้างและลบ chat sessions

```typescript {.line-numbers}
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
import { Pool } from 'pg'

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
// Database Connection Pool Setup - ตั้งค่าการเชื่อมต่อฐานข้อมูล
// ===============================================

/**
 * สร้าง PostgreSQL connection pool สำหรับจัดการการเชื่อมต่อฐานข้อมูล
 * 
 * Connection Pool Benefits:
 * - ประหยัด memory และ CPU
 * - จัดการ connection อย่างมีประสิทธิภาพ
 * - รองรับ concurrent requests
 * - ป้องกัน connection leaks
 * 
 * Configuration:
 * - host: ที่อยู่ server ฐานข้อมูล
 * - port: port ของ PostgreSQL (default 5432)
 * - user: ชื่อผู้ใช้ฐานข้อมูล
 * - password: รหัสผ่านฐานข้อมูล
 * - database: ชื่อฐานข้อมูล
 * - ssl: การตั้งค่า SSL สำหรับ production
 */
const pool = new Pool({
  host: process.env.PG_HOST,                                                // ที่อยู่ PostgreSQL server
  port: Number(process.env.PG_PORT),                                       // port ของ PostgreSQL
  user: process.env.PG_USER,                                               // username สำหรับเชื่อมต่อ
  password: process.env.PG_PASSWORD,                                       // password สำหรับเชื่อมต่อ
  database: process.env.PG_DATABASE,                                       // ชื่อฐานข้อมูล
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false, // SSL config สำหรับ production
})

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
```

#### 9. เพิ่ม utility การ generateId และการจัดกลุ่มตามวันที่
แก้ไขไฟล์ `src/lib/utils.ts` เพื่อเพิ่มฟังก์ชันช่วยเหลือในการสร้าง ID และจัดกลุ่มข้อความ

```typescript {.line-numbers}
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

// CSS CLASS UTILITIES - ยูทิลิตี้สำหรับ CSS Classes
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ID GENERATION UTILITIES - ยูทิลิตี้สำหรับสร้าง ID
export function generateUniqueId(prefix: string = ''): string {
  const timestamp = Date.now()                                              // เวลาปัจจุบันเป็น milliseconds
  
  const random = Math.random().toString(36).substr(2, 9)                    // สุ่ม string 9 ตัวอักษร (base36)
  
  // รวม prefix, timestamp และ random string
  return prefix ? `${prefix}-${timestamp}-${random}` : `${timestamp}-${random}`
}

// DATE GROUPING INTERFACES - Interface สำหรับจัดกลุ่มตามวันที่
export interface GroupedSessions {
  period: string                                                            // ชื่อช่วงเวลา เช่น "Today", "Yesterday"
  sessions: ChatSession[]                                                   // Array ของ sessions ในช่วงเวลานั้น
}

interface ChatSession {
  id: string;                                                               // รหัสประจำตัว session
  title: string;                                                            // หัวข้อของ chat session
  created_at: string;                                                       // วันที่สร้าง (ISO string format)
  message_count?: number;                                                   // จำนวนข้อความใน session (optional)
  user_id?: string;                                                         // รหัสผู้ใช้เจ้าของ session (optional)
}

// DATE GROUPING FUNCTION - ฟังก์ชันจัดกลุ่ม Sessions ตามวันที่
export function groupSessionsByDate(sessions: ChatSession[]): GroupedSessions[] {
  
  const now = new Date()                                                      // วันเวลาปัจจุบัน
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())    // วันนี้ (00:00:00)
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)           // เมื่อวาน (00:00:00)
  const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)    // 7 วันที่แล้ว
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)  // 30 วันที่แล้ว

  const groups: { [key: string]: ChatSession[] } = {
    today: [],                                                              // sessions ของวันนี้
    yesterday: [],                                                          // sessions ของเมื่อวาน
    last7days: [],                                                          // sessions ของ 7 วันที่แล้ว
    lastMonth: [],                                                          // sessions ของเดือนที่แล้ว
    older: []                                                               // sessions ที่เก่ากว่า 30 วัน
  }

  sessions.forEach(session => {
    // แปลง created_at string เป็น Date object
    const sessionDate = new Date(session.created_at)                       // วันที่สร้าง session
    const sessionDateOnly = new Date(sessionDate.getFullYear(), sessionDate.getMonth(), sessionDate.getDate()) // วันที่เท่านั้น (ไม่รวมเวลา)

    // เปรียบเทียบและใส่ลงกลุ่มที่เหมาะสม
    if (sessionDateOnly.getTime() === today.getTime()) {
      groups.today.push(session)                                            // วันนี้
    } else if (sessionDateOnly.getTime() === yesterday.getTime()) {
      groups.yesterday.push(session)                                        // เมื่อวาน
    } else if (sessionDate >= sevenDaysAgo) {
      groups.last7days.push(session)                                        // 7 วันที่แล้ว
    } else if (sessionDate >= thirtyDaysAgo) {
      groups.lastMonth.push(session)                                        // เดือนที่แล้ว
    } else {
      groups.older.push(session)                                            // เก่ากว่า 30 วัน
    }
  })

  const result: GroupedSessions[] = []

  // เช็คและเพิ่มกลุ่ม "Today"
  if (groups.today.length > 0) {
    result.push({ period: 'Today', sessions: groups.today })
  }
  
  // เช็คและเพิ่มกลุ่ม "Yesterday"  
  if (groups.yesterday.length > 0) {
    result.push({ period: 'Yesterday', sessions: groups.yesterday })
  }

  // เช็คและเพิ่มกลุ่ม "Last 7 days"
  if (groups.last7days.length > 0) {
    result.push({ period: 'Last 7 days', sessions: groups.last7days })
  }

  //  เช็คและเพิ่มกลุ่ม "Last month"
  if (groups.lastMonth.length > 0) {
    result.push({ period: 'Last month', sessions: groups.lastMonth })
  }
  
  //  เช็คและเพิ่มกลุ่ม "Older"
  if (groups.older.length > 0) {
    result.push({ period: 'Older', sessions: groups.older })
  }

  // ส่งคืน result ที่จัดเรียงเรียบร้อยแล้ว
  return result
}
```

#### 10. สร้าง hooks ไฟล์ use-chat-sessions.ts เพื่อจัดการ chat sessions
สร้างไฟล์ `app/hooks/use-chat-sessions.ts` เพื่อจัดการการดึง สร้าง อัพเดท และลบ chat sessions

```typescript {.line-numbers}
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
 * - เชื่อมต่อกับ /api/chat_05_history/session
 * - รองรับ GET, POST, PUT, DELETE methods
 * - จัดการ authentication ด้วย userId
 */

"use client"

import { useState, useEffect } from 'react'

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
       * API Endpoint: /api/chat_05_history/session
       * Query Parameter: userId (encoded สำหรับความปลอดภัย)
       * 
       * Expected Response:
       * - sessions: array ของ ChatSession objects
       */
      const response = await fetch(`/api/chat_05_history/session?userId=${encodeURIComponent(userId)}`)
      
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
       * API Endpoint: /api/chat_05_history/session
       * Method: POST
       * Body: { title, userId }
       * 
       * Expected Response:
       * - session: ChatSession object ที่สร้างใหม่
       */
      const response = await fetch('/api/chat_05_history/session', {
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
       * API Endpoint: /api/chat_05_history/session
       * Method: PUT
       * Body: { sessionId, title }
       * 
       * Expected Response:
       * - session: ChatSession object ที่อัปเดตแล้ว
       */
      const response = await fetch('/api/chat_05_history/session', {
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
      const response = await fetch(`/api/chat_05_history/session?sessionId=${sessionId}`, {
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

```

#### 11. สร้าง hooks ไฟล์ use-chat-history.ts เพื่อจัดการ chat messages
สร้างไฟล์ `app/hooks/use-chat-history.ts` เพื่อจัดการการดึงและส่งข้อความใน chat session

```typescript {.line-numbers}
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
      const response = await fetch('/api/chat_05_history', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: apiMessages,                // ข้อความทั้งหมดในการสนทนา
          sessionId: currentSessionId,          // Session ID ปัจจุบัน
          userId: userId,                       // ID ของผู้ใช้จาก auth system
        }),
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
      setHistoryError(error instanceof Error ? error.message : 'Unknown error')
      console.error('Send message error:', error)
    } finally {
      // Step 9: จบกระบวนการ - ปิด loading
      setLoading(false)
    }
  }, [messages, currentSessionId, loading]) // eslint-disable-line react-hooks/exhaustive-deps

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
      const response = await fetch(`/api/chat_05_history?sessionId=${sessionId}`)
      
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

```

#### 12. อัพเดตไฟล์ chat-sidebar.tsx เพื่อเชื่อมต่อกับ API ใหม่
แก้ไขไฟล์ `app/components/chat-sidebar.tsx` เพื่อเชื่อมต่อกับ API ใหม่ที่สร้างขึ้น

```typescript {.line-numbers}
/**
 * ===============================================
 * Chat Sidebar Component - แถบด้านข้างสำหรับการนำทาง
 * ===============================================
 * 
 * Purpose: แถบด้านข้างสำหรับนำทางและจัดการประวัติการสนทนา
 * 
 * Features:
 * - แสดงรายการประวัติการสนทนาจัดกลุ่มตามวันที่
 * - สร้างการสนทนาใหม่
 * - ลบประวัติการสนทนา
 * - เปิด/ปิด sidebar (collapsible)
 * - การตั้งค่าผู้ใช้และแอปพลิเคชัน
 * - User profile และ logout
 * - Theme toggle (สลับธีม)
 * - Responsive design สำหรับ mobile/desktop
 * 
 * Components:
 * - SettingsDialog: dialog สำหรับการตั้งค่าต่างๆ
 * - ChatSidebar: sidebar หลัก
 * 
 * Data Management:
 * - useChatSessions hook สำหรับจัดการข้อมูล sessions
 * - useChatContext สำหรับ state management
 * 
 * Authentication: ต้องมี userId เพื่อเข้าถึงข้อมูล
 * Navigation: ใช้ Next.js router สำหรับการนำทาง
 */

"use client"

// ============================================================================
// IMPORTS - การนำเข้า Components และ Libraries ที่จำเป็น
// ============================================================================
import { Button } from "@/components/ui/button"                             // Component ปุ่มพื้นฐาน
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  useSidebar,
} from "@/components/ui/sidebar"                                             // Sidebar components และ hooks
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"                                             // Popover สำหรับ user menu
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"                                        // Alert dialog สำหรับยืนยันการลบ
import { 
  PlusIcon, 
  Search, 
  Settings, 
  User, 
  X, 
  Bell,
  Palette,
  Plug,
  Calendar,
  Database,
  Shield,
  UserCircle,
  Trash2
} from "lucide-react"                                                        // Icons จาก Lucide React
import { LogoutButton } from "@/components/logout-button"                   // Component สำหรับ logout
import Link from "next/link"                                                 // Next.js Link สำหรับ navigation
import { usePathname, useRouter } from "next/navigation"                     // Next.js hooks สำหรับ routing
import { useState, useEffect, useRef } from "react"                          // React hooks
import { createPortal } from "react-dom"                                     // Portal สำหรับ modal rendering
import { useChatContext } from "@/contexts/chat-context"                     // Context สำหรับ chat state
import { useChatSessions } from "@/hooks/use-chat-sessions"                  // Custom hook สำหรับ chat sessions
import { groupSessionsByDate } from "@/lib/utils"                            // Utility สำหรับจัดกลุ่มตามวันที่
import {
  GeneralTab,
  NotificationsTab,
  PersonalizationTab,
  ConnectorsTab,
  SchedulesTab,
  DataControlsTab,
  SecurityTab,
  AccountTab
} from "@/components/settings"                                               // Settings tab components
import { ThemeToggle } from "@/components/ui/theme-toggle"                   // Theme toggle component

// ============================================================================
// TypeScript Interface Definitions - กำหนด Type Definitions
// ============================================================================

/**
 * Interface สำหรับ Props ของ ChatSidebar component
 * 
 * Structure:
 * - display_name: string - ชื่อแสดงผลของผู้ใช้
 * - email: string - อีเมลของผู้ใช้
 * - userId: string (optional) - ID ของผู้ใช้สำหรับ authentication
 */
interface ChatSidebarProps {
  display_name: string                                                       // ชื่อแสดงผลของผู้ใช้
  email: string                                                              // อีเมลของผู้ใช้
  userId?: string                                                            // ID ของผู้ใช้ (optional สำหรับ authentication)
}

// ============================================================================
// SETTINGS DIALOG COMPONENT - Component สำหรับ Settings Dialog
// ============================================================================

/**
 * SettingsDialog Component: Dialog สำหรับการตั้งค่าแอปพลิเคชัน
 * 
 * Purpose:
 * - แสดง settings ในรูปแบบ modal dialog
 * - รองรับ multiple tabs สำหรับหมวดหมู่ต่างๆ
 * - Responsive design สำหรับ mobile/desktop
 * - Portal rendering เพื่อแสดงนอก DOM tree
 * 
 * Features:
 * - Tab navigation สำหรับหมวดหมู่ settings
 * - Horizontal scroll สำหรับ mobile tabs
 * - Backdrop click เพื่อปิด dialog
 * - Keyboard navigation support
 * 
 * @param isOpen - สถานะการเปิด/ปิด dialog
 * @param onClose - callback เมื่อปิด dialog
 * @returns JSX Element หรือ null
 */
function SettingsDialog({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  // ============================================================================
  // STEP 1: STATE DECLARATIONS - การประกาศตัวแปร State
  // ============================================================================
  
  /**
   * สถานะของ Settings Dialog
   * 
   * Variables:
   * - activeTab: tab ที่เลือกในปัจจุบัน
   * - mounted: สถานะการ mount ของ component
   * - tabsContainerRef: reference สำหรับ tabs container
   */
  const [activeTab, setActiveTab] = useState("general")                      // tab ที่เลือกในปัจจุบัน (เริ่มต้นที่ "general")
  const [mounted, setMounted] = useState(false)                             // สถานะการ mount ของ component
  const tabsContainerRef = useRef<HTMLDivElement>(null)                     // ref สำหรับ tabs container (สำหรับ scroll)

  // ============================================================================
  // STEP 2: EFFECTS - การจัดการ Side Effects
  // ============================================================================

  /**
   * Effect สำหรับตั้งค่า mounted state
   * 
   * Purpose:
   * - ป้องกัน hydration mismatch ใน SSR
   * - ให้แน่ใจว่า component mount เสร็จแล้วก่อนแสดงผล
   */
  useEffect(() => {
    setMounted(true)                                                         // ตั้งค่า mounted เป็น true เมื่อ component mount
  }, [])

  /**
   * Effect สำหรับจัดการ horizontal scroll ใน mobile tabs
   * 
   * Purpose:
   * - รองรับการ scroll ด้วย mouse wheel ใน tabs container
   * - ปรับปรุง UX สำหรับ mobile devices
   * - ใช้ native event listener สำหรับควบคุมที่ดีกว่า
   * 
   * Dependencies: [mounted]
   */
  useEffect(() => {
    const container = tabsContainerRef.current
    if (!container || !mounted) return

    /**
     * Handler สำหรับ wheel event
     * 
     * Purpose:
     * - แปลง vertical scroll เป็น horizontal scroll
     * - ป้องกัน default behavior ของ wheel event
     * 
     * @param e - WheelEvent object
     */
    const handleWheel = (e: WheelEvent) => {
      if (e.deltaY !== 0) {
        e.preventDefault()                                                   // ป้องกัน default scroll behavior
        container.scrollLeft += e.deltaY > 0 ? 50 : -50                     // scroll ไปซ้าย/ขวา 50px
      }
    }

    // เพิ่ม event listener แบบ non-passive
    container.addEventListener('wheel', handleWheel, { passive: false })

    /**
     * Cleanup function
     * ลบ event listener เมื่อ component unmount
     */
    return () => {
      container.removeEventListener('wheel', handleWheel)
    }
  }, [mounted])

  // ============================================================================
  // STEP 3: EVENT HANDLER FUNCTIONS - ฟังก์ชันจัดการ Events
  // ============================================================================

  /**
   * ฟังก์ชันสำหรับจัดการการเลือก tab และ scrolling
   * 
   * Purpose:
   * - เปลี่ยน active tab
   * - scroll ให้ tab ที่เลือกอยู่ในมุมมองที่เห็นได้
   * - ปรับปรุง UX สำหรับ mobile navigation
   * 
   * Process:
   * 1. ตั้งค่า active tab
   * 2. รอให้ DOM update
   * 3. scroll ไปยัง tab ที่เลือก
   * 
   * @param tabId - ID ของ tab ที่ต้องการเลือก
   */
  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId)                                                      // ตั้งค่า active tab
    
    // ให้แน่ใจว่า tab ที่คลิกจะอยู่ในมุมมองที่เห็นได้
    setTimeout(() => {
      if (tabsContainerRef.current) {
        // หา button element ของ tab ที่เลือก
        const activeButton = tabsContainerRef.current.querySelector(`[data-tab-id="${tabId}"]`) as HTMLElement
        if (activeButton) {
          // scroll ไปยัง tab ที่เลือกด้วย smooth animation
          activeButton.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'nearest', 
            inline: 'center' 
          })
        }
      }
    }, 50)                                                                   // รอ 50ms ให้ DOM update
  }

  // ============================================================================
  // STEP 4: RENDER GUARD - การตรวจสอบสถานะก่อนแสดงผล
  // ============================================================================

  /**
   * ตรวจสอบสถานะก่อนแสดงผล dialog
   * 
   * Conditions:
   * - ไม่แสดงถ้า isOpen = false
   * - ไม่แสดงถ้า component ยังไม่ mount (ป้องกัน SSR issues)
   */
  if (!isOpen || !mounted) return null

  // ============================================================================
  // STEP 5: TABS CONFIGURATION - การกำหนดค่า Tabs
  // ============================================================================

  /**
   * การกำหนดค่า tabs สำหรับ Settings Dialog
   * 
   * Structure:
   * - id: unique identifier สำหรับ tab
   * - label: ข้อความแสดงผล
   * - icon: component icon จาก Lucide React
   */
  const tabs = [
    { id: "general", label: "General", icon: Settings },                     // การตั้งค่าทั่วไป
    { id: "notifications", label: "Notifications", icon: Bell },             // การแจ้งเตือน
    { id: "personalization", label: "Personalization", icon: Palette },      // การปรับแต่งส่วนบุคคล
    { id: "connectors", label: "Connectors", icon: Plug },                   // การเชื่อมต่อ
    { id: "schedules", label: "Schedules", icon: Calendar },                 // ตารางเวลา
    { id: "data-controls", label: "Data controls", icon: Database },         // การควบคุมข้อมูล
    { id: "security", label: "Security", icon: Shield },                     // ความปลอดภัย
    { id: "account", label: "Account", icon: UserCircle },                   // บัญชีผู้ใช้
  ]

  // ============================================================================
  // STEP 6: TAB CONTENT RENDERER - ฟังก์ชันแสดงเนื้อหา Tab
  // ============================================================================

  /**
   * ฟังก์ชันสำหรับแสดงเนื้อหาของ tab ที่เลือก
   * 
   * Purpose:
   * - แสดง component ที่เหมาะสมตาม active tab
   * - จัดการ routing ภายใน settings dialog
   * 
   * @returns JSX Element ของ tab content
   */
  const renderTabContent = () => {
    switch (activeTab) {
      case "general":
        return <GeneralTab />                                                // แสดง General settings
      case "notifications":
        return <NotificationsTab />                                          // แสดง Notifications settings
      case "personalization":
        return <PersonalizationTab />                                        // แสดง Personalization settings
      case "connectors":
        return <ConnectorsTab />                                             // แสดง Connectors settings
      case "schedules":
        return <SchedulesTab />                                              // แสดง Schedules settings
      case "data-controls":
        return <DataControlsTab />                                           // แสดง Data controls settings
      case "security":
        return <SecurityTab />                                               // แสดง Security settings
      case "account":
        return <AccountTab />                                                // แสดง Account settings
      default:
        return <GeneralTab />                                                // แสดง General เป็นค่าเริ่มต้น
    }
  }

  // ============================================================================
  // STEP 7: DIALOG CONTENT STRUCTURE - โครงสร้างเนื้อหา Dialog
  // ============================================================================

  /**
   * โครงสร้างเนื้อหาของ Settings Dialog
   * 
   * Structure:
   * 1. Backdrop - พื้นหลังสำหรับปิด dialog
   * 2. Dialog Container - container หลักของ dialog
   * 3. Mobile/Desktop Tab Navigation
   * 4. Main Content Area
   * 
   * Features:
   * - Responsive layout (mobile/desktop)
   * - Portal rendering
   * - Backdrop click เพื่อปิด
   * - Keyboard navigation
   */
  const dialogContent = (
    <>
      {/* ============================================================================ */}
      {/* BACKDROP - พื้นหลังสำหรับปิด Dialog */}
      {/* ============================================================================ */}
      
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 z-50"                          
        onClick={onClose}                                                    // คลิก backdrop เพื่อปิด dialog
      />
      
      {/* ============================================================================ */}
      {/* DIALOG CONTAINER - Container หลักของ Dialog */}
      {/* ============================================================================ */}
      
      {/* Dialog */}
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none">
        <div className="relative bg-white dark:bg-gray-900 rounded-lg shadow-2xl w-full max-w-4xl h-[80vh] sm:h-[80vh] overflow-hidden border border-gray-200 dark:border-gray-700 pointer-events-auto">
          <div className="flex h-full min-h-0 flex-col sm:flex-row mobile-dialog-layout">
            
            {/* ============================================================================ */}
            {/* MOBILE TAB NAVIGATION - แถบ Tab สำหรับ Mobile */}
            {/* ============================================================================ */}
            
            {/* Mobile Tab Navigation */}
            <div 
              ref={tabsContainerRef}                                         // ref สำหรับ scroll handling
              className="flex sm:hidden mobile-tabs-scroll bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-2 py-2"
            >
              <div className="flex gap-1" style={{ minWidth: 'max-content' }}>
                {tabs.map((tab) => {
                  const IconComponent = tab.icon                             // ดึง icon component
                  return (
                    <button
                      key={tab.id}
                      data-tab-id={tab.id}                                  // attribute สำหรับ scroll targeting
                      onClick={() => handleTabClick(tab.id)}               // เรียกฟังก์ชันเลือก tab
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-xs whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
                        activeTab === tab.id
                          ? 'bg-gray-400 dark:bg-gray-700 text-white font-medium'  // style สำหรับ active tab
                          : 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'  // style สำหรับ inactive tab
                      }`}
                      role="tab"                                             // accessibility role
                      tabIndex={0}                                           // keyboard navigation
                    >
                      <IconComponent className="h-3 w-3" />                 {/* แสดง icon */}
                      {tab.label}                                            {/* แสดงข้อความ */}
                    </button>
                  )
                })}
              </div>
            </div>
            
            {/* ============================================================================ */}
            {/* DESKTOP SIDEBAR - แถบด้านข้างสำหรับ Desktop */}
            {/* ============================================================================ */}
            
            {/* Desktop Sidebar */}
            <div className="hidden sm:block w-64 bg-gray-50 dark:bg-gray-800 p-4 border-r border-gray-200 dark:border-gray-700">
              <div className="space-y-1">
                {tabs.map((tab) => {
                  const IconComponent = tab.icon                             // ดึง icon component
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}                   // เลือก tab (desktop ไม่ต้องใช้ scroll)
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm ${
                        activeTab === tab.id
                          ? 'bg-gray-400 dark:bg-gray-700 text-white font-medium'  // style สำหรับ active tab
                          : 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'  // style สำหรับ inactive tab
                      }`}
                    >
                      <IconComponent className="h-4 w-4" />                 {/* แสดง icon */}
                      {tab.label}                                            {/* แสดงข้อความ */}
                    </button>
                  )
                })}
              </div>
            </div>
            
            {/* ============================================================================ */}
            {/* MAIN CONTENT AREA - พื้นที่เนื้อหาหลัก */}
            {/* ============================================================================ */}
            
            {/* Main Content */}
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden sm:overflow-visible">
              
              {/* ============================================================================ */}
              {/* HEADER - ส่วนหัวของ Content Area */}
              {/* ============================================================================ */}
              
              {/* Header */}
              <div className="flex-shrink-0 flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
                {/* Title - แสดงชื่อ tab ปัจจุบัน */}
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white capitalize">
                  {tabs.find(tab => tab.id === activeTab)?.label || "General"}  {/* หาชื่อ tab จาก ID */}
                </h2>
                
                {/* Close Button - ปุ่มปิด dialog */}
                <button 
                  onClick={onClose}                                          // ปิด dialog
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                >
                  <X className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                </button>
              </div>
              
              {/* ============================================================================ */}
              {/* SETTINGS CONTENT - เนื้อหา Settings */}
              {/* ============================================================================ */}
              
              {/* Settings Content */}
              <div className="flex-1 mobile-content-area sm:dialog-content-scroll sm:overflow-y-auto">
                <div className="p-4 sm:p-6">
                  {renderTabContent()}                                      {/* แสดงเนื้อหาตาม active tab */}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )

  // ============================================================================
  // STEP 8: PORTAL RENDERING - การแสดงผลผ่าน Portal
  // ============================================================================

  /**
   * แสดงผล dialog ผ่าน createPortal
   * 
   * Purpose:
   * - แสดง dialog นอก DOM tree ของ component
   * - ป้องกัน z-index และ overflow issues
   * - รองรับ SSR โดยตรวจสอบ mounted state
   * 
   * Conditions:
   * - แสดงเฉพาะเมื่อ mounted = true
   * - ใช้ document.body เป็น target
   */
  return mounted ? createPortal(dialogContent, document.body) : null
}

// ============================================================================
// MAIN CHAT SIDEBAR COMPONENT - Component หลักของ Chat Sidebar
// ============================================================================

/**
 * ChatSidebar Component: แถบด้านข้างสำหรับการนำทางและจัดการประวัติการสนทนา
 * 
 * Purpose:
 * - แสดงรายการประวัติการสนทนาจัดกลุ่มตามวันที่
 * - สร้างการสนทนาใหม่
 * - ลบประวัติการสนทนา
 * - จัดการ user profile และ settings
 * - รองรับ responsive design
 * 
 * Features:
 * - Collapsible sidebar
 * - Chat sessions grouped by date
 * - Delete confirmation
 * - Settings dialog
 * - User profile popover
 * - Theme toggle
 * 
 * @param display_name - ชื่อแสดงผลของผู้ใช้
 * @param email - อีเมลของผู้ใช้
 * @param userId - ID ของผู้ใช้สำหรับ authentication
 * @returns JSX Element
 */
export function ChatSidebar({ display_name, email, userId }: ChatSidebarProps) {
  
  // ============================================================================
  // STEP 1: HOOKS AND STATE DECLARATIONS - การประกาศ Hooks และ State
  // ============================================================================
  
  /**
   * React และ Next.js Hooks
   * 
   * Variables:
   * - state: สถานะของ sidebar (collapsed/expanded)
   * - pathname: path ปัจจุบันของ URL
   * - router: router object สำหรับ navigation
   * - resetChat: ฟังก์ชันรีเซ็ต chat state จาก context
   */
  const { state } = useSidebar()                                             // สถานะของ sidebar จาก UI component
  const pathname = usePathname()                                             // path ปัจจุบันของ URL
  const router = useRouter()                                                 // router สำหรับการนำทาง
  const { resetChat } = useChatContext()                                     // ฟังก์ชันรีเซ็ต chat จาก context
  
  /**
   * Local State Variables
   * 
   * Variables:
   * - isSettingsOpen: สถานะการเปิด/ปิด settings dialog
   * - deleteDialogOpen: สถานะการเปิด/ปิด delete confirmation dialog
   * - sessionToDelete: ID ของ session ที่จะลบ
   */
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)               // สถานะการเปิด/ปิด settings dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)           // สถานะการเปิด/ปิด delete confirmation dialog
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null) // ID ของ session ที่จะลบ
  
  /**
   * Custom Hook สำหรับจัดการ Chat Sessions
   * 
   * Returns:
   * - sessions: array ของ chat sessions
   * - loading: สถานะการโหลดข้อมูล
   * - fetchSessions: ฟังก์ชันดึงข้อมูล sessions
   * - deleteSession: ฟังก์ชันลบ session
   */
  const { sessions, loading, fetchSessions, deleteSession } = useChatSessions(userId)
  
  /**
   * จัดกลุ่ม sessions ตามวันที่
   * 
   * Purpose:
   * - จัดระเบียบการแสดงผลให้ดูง่าย
   * - กลุ่มตามช่วงเวลา (Today, Yesterday, Last 7 days, etc.)
   */
  const groupedSessions = groupSessionsByDate(sessions)                      // จัดกลุ่ม sessions ตามวันที่

  // ============================================================================
  // STEP 2: EFFECTS - การจัดการ Side Effects
  // ============================================================================

  /**
   * Effect สำหรับดึงข้อมูล sessions เมื่อ component mount หรือ userId เปลี่ยน
   * 
   * Purpose:
   * - โหลดรายการ chat sessions ของผู้ใช้
   * - รีเฟรชข้อมูลเมื่อมีการเปลี่ยน userId
   * - ป้องกันการเรียก API เมื่อไม่มี userId
   * 
   * Dependencies: [userId]
   * Note: ปิด eslint rule เพราะ fetchSessions มาจาก hook และไม่จำเป็นต้องใส่ใน dependency
   */
  useEffect(() => {
    if (userId) {
      fetchSessions()                                                        // ดึงข้อมูล sessions เฉพาะเมื่อมี userId
    }
  }, [userId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ============================================================================
  // STEP 3: EVENT HANDLER FUNCTIONS - ฟังก์ชันจัดการ Events
  // ============================================================================

  /**
   * ฟังก์ชันสำหรับจัดการปุ่ม New Chat
   * 
   * Purpose:
   * - รีเซ็ต chat state เพื่อเริ่มการสนทนาใหม่
   * - เคลียร์ sessionId จาก localStorage
   * - นำทางไปหน้า welcome screen
   * - จัดการ error handling
   * 
   * Process:
   * 1. ตรวจสอบ userId
   * 2. รีเซ็ต chat state
   * 3. เคลียร์ localStorage
   * 4. นำทางไปหน้า chat
   */
  const handleNewChat = async () => {
    if (!userId) return                                                      // ป้องกันการทำงานเมื่อไม่มี userId
    
    try {
      // รีเซ็ต chat state
      resetChat()                                                            // เรียกฟังก์ชันรีเซ็ตจาก context
      
      // เคลียร์ sessionId จาก localStorage
      localStorage.removeItem('currentSessionId')                           // ลบ session ID ที่เก็บไว้
      
      // ไปหน้า New Chat (Welcome screen) โดยไม่สร้าง session ใหม่ทันที
      router.push("/chat")                                                   // นำทางไปหน้า chat
      
    } catch (error) {
      console.error('Error navigating to new chat:', error)
      // ถ้ามีข้อผิดพลาด ไปหน้า chat ปกติ
      router.push("/chat")                                                   // fallback navigation
    }
  }

  /**
   * ฟังก์ชันสำหรับจัดการการลบ Session
   * 
   * Purpose:
   * - เปิด confirmation dialog สำหรับการลบ
   * - ป้องกัน navigation เมื่อคลิกปุ่มลบ
   * - ตั้งค่า session ที่จะลบ
   * 
   * Process:
   * 1. ป้องกัน event propagation
   * 2. ตรวจสอบ userId
   * 3. เก็บ sessionId ที่จะลบ
   * 4. เปิด confirmation dialog
   * 
   * @param sessionId - ID ของ session ที่จะลบ
   * @param e - React Mouse Event
   */
  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.preventDefault()                                                       // ป้องกันการนำทางไป Link
    e.stopPropagation()                                                      // ป้องกัน event bubbling
    
    if (!userId) return                                                      // ป้องกันการทำงานเมื่อไม่มี userId
    
    // เปิด Alert Dialog
    setSessionToDelete(sessionId)                                            // เก็บ ID ของ session ที่จะลบ
    setDeleteDialogOpen(true)                                                // เปิด confirmation dialog
  }

  /**
   * ฟังก์ชันสำหรับยืนยันการลบ Session
   * 
   * Purpose:
   * - ลบ session จาก database
   * - จัดการการนำทางถ้าลบ session ปัจจุบัน
   * - รีเฟรชรายการ sessions
   * - ปิด dialog และเคลียร์ state
   * 
   * Process:
   * 1. ตรวจสอบ sessionToDelete
   * 2. เรียก API ลบ session
   * 3. ตรวจสอบว่าเป็น session ปัจจุบันหรือไม่
   * 4. นำทางและรีเฟรชข้อมูล
   * 5. ปิด dialog
   */
  const confirmDeleteSession = async () => {
    if (!sessionToDelete) return                                             // ป้องกันการทำงานเมื่อไม่มี sessionToDelete
    
    try {
      const success = await deleteSession(sessionToDelete)                   // เรียก API ลบ session
      if (success) {
        // ถ้าเป็น session ปัจจุบันที่ถูกลบ ให้ไปหน้า new chat
        if (pathname === `/chat/${sessionToDelete}`) {
          resetChat()                                                        // รีเซ็ต chat state
          localStorage.removeItem('currentSessionId')                       // ลบจาก localStorage
          router.push("/chat")                                               // นำทางไปหน้า chat ใหม่
        }
        // รีเฟรช sessions list
        fetchSessions()                                                      // โหลดรายการ sessions ใหม่
      }
    } catch (error) {
      console.error('Error deleting session:', error)                       // แสดง error ใน console
    } finally {
      // ปิด dialog และเคลียร์ state
      setDeleteDialogOpen(false)                                             // ปิด confirmation dialog
      setSessionToDelete(null)                                               // เคลียร์ session ที่จะลบ
    }
  }

  // ============================================================================
  // STEP 4: MAIN RENDER - การแสดงผลหลัก
  // ============================================================================

  /**
   * Main render section - ส่วนแสดงผลหลักของ ChatSidebar
   * 
   * Structure:
   * 1. Sidebar Header - ส่วนหัวพร้อม logo และ controls
   * 2. Sidebar Content - เนื้อหาหลักและรายการ sessions
   * 3. Sidebar Footer - ส่วนท้ายพร้อม user profile
   * 4. Dialogs - Settings dialog และ delete confirmation
   */
  return (
    <Sidebar collapsible="icon">                                            {/* Sidebar component ที่ collapsible ได้ */}
      
      {/* ============================================================================ */}
      {/* SIDEBAR HEADER - ส่วนหัวของ Sidebar */}
      {/* ============================================================================ */}
      
      <SidebarHeader className="flex flex-row items-center justify-between gap-2 px-2 py-4">
        
        {/* Logo และ App Name */}
        <div className="flex flex-row items-center gap-2 px-2 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:justify-center">
          {/* AI Logo */}
          <div className="h-8 w-8 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
            <span className="text-white font-bold text-sm">AI</span>
          </div>
          
          {/* App Name - ซ่อนเมื่อ sidebar collapsed */}
          <div className="text-md font-bold text-slate-900 dark:text-white tracking-tight group-data-[collapsible=icon]:hidden">
            Genius AI
          </div>
        </div>
        
        {/* Control Buttons - ซ่อนเมื่อ sidebar collapsed */}
        <div className="flex items-center gap-1 group-data-[collapsible=icon]:hidden">

          {/* Theme Toggle Button - ปุ่มสลับธีม */}
          <ThemeToggle />

          {/* Search Button - ปุ่มค้นหา */}
          <Button
            variant="ghost"
            className="size-8"
          >
            <Search className="size-4" />
          </Button>
        </div>
      </SidebarHeader>

      {/* ============================================================================ */}
      {/* SIDEBAR CONTENT - เนื้อหาหลักของ Sidebar */}
      {/* ============================================================================ */}
      
      <SidebarContent className="pt-4">
        
        {/* ============================================================================ */}
        {/* NEW CHAT BUTTON - ปุ่มสร้างการสนทนาใหม่ */}
        {/* ============================================================================ */}
        
        <div className="px-4 group-data-[collapsible=icon]:px-2">
          <Button
            variant="outline"
            className="mb-4 flex w-full items-center gap-2 group-data-[collapsible=icon]:size-8 cursor-pointer group-data-[collapsible=icon]:p-0"
            title={state === "collapsed" ? "New Chat" : undefined}          // tooltip เมื่อ collapsed
            onClick={handleNewChat}                                          // เรียกฟังก์ชันสร้าง chat ใหม่
          >
            <PlusIcon className="size-4" />
            <span className="group-data-[collapsible=icon]:hidden cursor-pointer">
              New Chat
            </span>
          </Button>
        </div>

        {/* ============================================================================ */}
        {/* LOADING STATE - สถานะการโหลด */}
        {/* ============================================================================ */}
        
        {/* Loading state */}
        {loading && (
          <SidebarGroup className="group-data-[collapsible=icon]:hidden">
            <SidebarGroupLabel>Loading...</SidebarGroupLabel>
          </SidebarGroup>
        )}

        {/* ============================================================================ */}
        {/* CHAT SESSIONS LIST - รายการประวัติการสนทนา */}
        {/* ============================================================================ */}
        
        {/* Chat sessions grouped by date */}
        {!loading && groupedSessions.map((group) => (
          <SidebarGroup
            key={group.period}                                              // unique key สำหรับ group
            className="group-data-[collapsible=icon]:hidden"               // ซ่อนเมื่อ collapsed
          >
            <SidebarGroupLabel>{group.period}</SidebarGroupLabel>           {/* แสดงชื่อกลุ่ม เช่น "Today", "Yesterday" */}
            <SidebarMenu>
              {group.sessions.map((session) => (
                <div key={session.id} className="relative group/item">
                  {/* Session Link */}
                  <Link href={`/chat/${session.id}`}>
                    <SidebarMenuButton
                      isActive={pathname === `/chat/${session.id}`}
                      tooltip={
                        state === "collapsed" ? session.title : undefined
                      }
                      className="cursor-pointer pr-8"
                    >
                      <span className="group-data-[collapsible=icon]:hidden truncate">
                        {session.title}
                      </span>
                    </SidebarMenuButton>
                  </Link>
                  
                  {/* Delete Button - ปุ่มลบ session */}
                  <button
                    onClick={(e) => handleDeleteSession(session.id, e)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover/item:opacity-100 transition-opacity duration-200 p-1 hover:bg-red-100 dark:hover:bg-red-900/20 rounded text-red-500 hover:text-red-700 dark:hover:text-red-400"
                    title="ลบประวัติการแชท"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        ))}

        {/* ============================================================================ */}
        {/* EMPTY STATE - สถานะเมื่อไม่มีข้อมูล */}
        {/* ============================================================================ */}
        
        {/* Empty state */}
        {!loading && groupedSessions.length === 0 && (
          <SidebarGroup className="group-data-[collapsible=icon]:hidden">
            <div className="px-4 py-6 text-center text-gray-500 dark:text-gray-400 text-sm">
              No chat history yet.<br />
              Start a new conversation!
            </div>
          </SidebarGroup>
        )}
      </SidebarContent>

      {/* ============================================================================ */}
      {/* SIDEBAR FOOTER - ส่วนท้ายพร้อม User Profile */}
      {/* ============================================================================ */}
      
      {/* User Profile Footer */}
      <SidebarFooter className="p-4 border-t border-slate-200 dark:border-slate-700 group-data-[collapsible=icon]:p-2">
        <Popover>
          <PopoverTrigger asChild>
            
            {/* User Profile Button */}
            <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-1data-[state=open]:bg-slate-100 dark:data-[state=open]:bg-slate-800">
              
              {/* User Avatar */}
              <div className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:w-8">
                <span className="text-white font-semibold text-sm group-data-[collapsible=icon]:text-xs">
                  {/* แสดงตัวอักษรแรกของ display_name หรือ email */}
                  {display_name
                    ? display_name.charAt(0).toUpperCase()
                    : email.charAt(0).toUpperCase()}
                </span>
              </div>
              
              {/* User Info - ซ่อนเมื่อ collapsed */}
              <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                  {display_name || email.split("@")[0]}                     {/* แสดง display_name หรือ username */}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {email}                                                    {/* แสดงอีเมล */}
                </p>
              </div>
            </div>
          </PopoverTrigger>
          
          {/* ============================================================================ */}
          {/* USER PROFILE POPOVER - เมนูผู้ใช้ */}
          {/* ============================================================================ */}
          
          <PopoverContent side="top" align="start" className="w-80 p-0">
            <div className="space-y-0">
              
              {/* User Info Header */}
              <div className="flex items-center gap-3 p-4 border-b border-slate-200 dark:border-slate-700">
                {/* User Avatar */}
                <div className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                  <span className="text-white font-semibold text-sm">
                    {display_name
                      ? display_name.charAt(0).toUpperCase()
                      : email.charAt(0).toUpperCase()}
                  </span>
                </div>
                
                {/* User Details */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                    {display_name || email.split("@")[0]}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {email}
                  </p>
                </div>
              </div>

              {/* Menu Items */}
              <div className="p-2 space-y-1">
                
                {/* Upgrade Plan Button */}
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-3 h-10 text-left px-3"
                >
                  <User className="h-4 w-4" />
                  Upgrade plan
                </Button>

                {/* Customize Genius AI Button */}
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-3 h-10 text-left px-3"
                >
                  <Settings className="h-4 w-4" />
                  Customize Genius AI
                </Button>

                {/* Settings Button */}
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-3 h-10 text-left px-3"
                  onClick={() => setIsSettingsOpen(true)}                    // เปิด settings dialog
                >
                  <Settings className="h-4 w-4" />
                  Settings
                </Button>

                <hr className="my-2 border-slate-200 dark:border-slate-700" />

                {/* Logout Button */}
                <div className="px-1">
                  <LogoutButton />                                            {/* Component สำหรับ logout */}
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </SidebarFooter>

      {/* ============================================================================ */}
      {/* DIALOGS - Settings Dialog และ Delete Confirmation */}
      {/* ============================================================================ */}
      
      {/* Settings Dialog */}
      <SettingsDialog 
        isOpen={isSettingsOpen}                                             // สถานะการเปิด/ปิด
        onClose={() => setIsSettingsOpen(false)}                           // callback สำหรับปิด dialog
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ลบประวัติการแชท</AlertDialogTitle>
            <AlertDialogDescription>
              คุณแน่ใจหรือไม่ว่าต้องการลบประวัติการแชทนี้? การดำเนินการนี้ไม่สามารถย้อนกลับได้
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            {/* Cancel Button */}
            <AlertDialogCancel onClick={() => {
              setDeleteDialogOpen(false)                                     // ปิด dialog
              setSessionToDelete(null)                                       // เคลียร์ session ที่จะลบ
            }}>
              ยกเลิก
            </AlertDialogCancel>
            
            {/* Confirm Delete Button */}
            <AlertDialogAction 
              onClick={confirmDeleteSession}                                 // เรียกฟังก์ชันยืนยันการลบ
              className="bg-red-600 hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700"
            >
              ลบ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sidebar>
  )
}
```

#### 13. ติดตั้ง alert-dialog component จาก shadcn/ui
```bash {.line-numbers}
npx shadcn@latest add alert-dialog
```

#### 14. อัพเดตไฟล์ chat-history.tsx เพื่อเชื่อมต่อกับ API ใหม่
แก้ไขไฟล์ `app/components/chat-history.tsx` เพื่อเชื่อมต่อกับ API ใหม่ที่สร้างขึ้น

```typescript {.line-numbers}
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
                        markdown                                             // แสดงเป็น markdown format
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
      
      <div className="bg-background z-10 shrink-0 px-3 pb-3 md:px-5 md:pb-5">
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

                  {/* Send Button - ปุ่มส่งข้อความ */}
                  {/*
                   * Send Button
                   * 
                   * Purpose:
                   * - ส่งข้อความเพื่อต่อการสนทนา
                   * - แสดง loading state เมื่อกำลังส่ง
                   * - ตรวจสอบความพร้อมก่อนส่ง
                   * 
                   * Disabled Conditions:
                   * - ข้อความว่าง (!input.trim())
                   * - กำลัง loading
                   * - ไม่มี userId (ไม่ได้ login)
                   */}
                  <Button
                    size="icon"
                    disabled={!input.trim() || loading || !userId}
                    onClick={onSubmit}
                    className="size-9 rounded-full"
                  >
                    {/* แสดง icon ตาม loading state */}
                    {!loading ? (
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
```

#### 15. แก้ไขไฟล์ `app/chat/[id]/page.tsx` เพื่อส่ง userId ไปยัง ChatHistory component
```typescript {.line-numbers}
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
import { Pool } from 'pg'

// ===============================================
// Database Connection Pool Setup - ตั้งค่าการเชื่อมต่อฐานข้อมูล
// ===============================================

/**
 * สร้าง PostgreSQL connection pool สำหรับจัดการการเชื่อมต่อฐานข้อมูล
 * 
 * Connection Pool Benefits:
 * - ประหยัด memory และ CPU
 * - จัดการ connection อย่างมีประสิทธิภาพ
 * - รองรับ concurrent requests
 * - ป้องกัน connection leaks
 * 
 * Configuration:
 * - host: ที่อยู่ server ฐานข้อมูล
 * - port: port ของ PostgreSQL (default 5432)
 * - user: ชื่อผู้ใช้ฐานข้อมูล
 * - password: รหัสผ่านฐานข้อมูล
 * - database: ชื่อฐานข้อมูล
 * - ssl: การตั้งค่า SSL สำหรับ production
 */
const pool = new Pool({
  host: process.env.PG_HOST,                                                // ที่อยู่ PostgreSQL server
  port: Number(process.env.PG_PORT),                                       // port ของ PostgreSQL
  user: process.env.PG_USER,                                               // username สำหรับเชื่อมต่อ
  password: process.env.PG_PASSWORD,                                       // password สำหรับเชื่อมต่อ
  database: process.env.PG_DATABASE,                                       // ชื่อฐานข้อมูล
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false, // SSL config สำหรับ production
})

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
```

#### 16. แก้ไขไฟล์ chat-context.tsx เพื่อรับ userId เป็น props
```typescript {.line-numbers}
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
```

#### 17. แก้ไขไฟล์ layout.tsx เพื่อเพิ่ม userId
แก้ไขไฟล์ `src/app/chat/layout.tsx` เพื่อเพิ่ม ChatProvider
```typescript {.line-numbers}
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/server'
import { ChatSidebar } from '@/components/chat-sidebar'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { ChatProvider } from '@/contexts/chat-context'

export default async function ChatLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) {
    redirect('/auth/login')
  }

  const userInfo = {
    display_name: data.user.user_metadata?.display_name || data.user.email?.split('@')[0] || 'User',
    email: data.user.user_metadata?.email || data.user.email || '',
    userId: data.user.id, // เพิ่ม userId
  }

  return (
    <ChatProvider>
      <SidebarProvider>
        <ChatSidebar {...userInfo} />
        <SidebarInset>
          {children}
        </SidebarInset>
      </SidebarProvider>
    </ChatProvider>
  )
}
```

#### 18. แก้ไข logout ทำการเคลียร์ localStorage
แก้ไขไฟล์ `src/components/logout-button.tsx` เพื่อเพิ่มการเคลียร์ localStorage
```typescript {.line-numbers}
"use client"

import { createClient } from "@/lib/client"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { LogOut } from "lucide-react"

export function LogoutButton() {
  const router = useRouter()

  const logout = async () => {
    const supabase = createClient()

    // เคลียร์ currentSessionId จาก localStorage
    localStorage.removeItem('currentSessionId')

    await supabase.auth.signOut()
    router.push("/auth/login")
  }

  return (
    <Button
      onClick={logout}
      variant="ghost"
      className="w-full justify-start gap-3 h-12 text-left hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
    >
      <LogOut className="h-4 w-4" />
      Log out
    </Button>
  )
}
```

#### 19. ทดสอบระบบด้วย prompt ต่างๆ
- ทดสอบการสร้าง session ใหม่
- ทดสอบการโหลดประวัติการสนทนา
- ทดสอบการส่งข้อความและรับการตอบกลับ
- ทดสอบการจัดการ error และ loading states
- ทดสอบ UI responsiveness และการใช้งานบนอุปกรณ์ต่างๆ
- ทดสอบการ logout และการเคลียร์ localStorage

#### ตัวอย่าง prompt ที่ใช้ทดสอบ
```text
ขอรายชื่อจังหวัดในภาคใต้ของไทย
ถ้าภาคเหนือหล่ะ
ภาคใดมีประชากรน้อยที่สุด
จังหวัดใดมีรายได้ต่อหัวน้อยที่สุด
แสดงข้อมูลรายได้ต่อหัว 10 จังหวัดที่มากที่สุดในตาราง
เขียน Code การ Hello World ในภาษา Java
เขียนสูตรการคำนวณหาความเร่ง
สูตรการการหาปริมาตรทรงกลมหล่ะ
```

<br />
*** Note: แยก branch ใหม่สำหรับ chat history Optimize

#### สร้าง Branch ใหม่
```bash
git add .
git commit -m "Finish chat history component with full features"
git checkout -b 06-chat-history-optimize
```

### Chat History Optimization Summary
 - เก็บประวัติการสนทนาใน PostgreSQL
 - ทำ Summary เพื่อประหยัด Token
 - Trim Messages เพื่อไม่ให้เกิน Token Limit
 - Streaming Response สำหรับ Real-time Chat
 - จัดการ Session ID อัตโนมัติ

#### 1. Migration command สำหรับเพิ่มคอลัมน์ summary
```sql
ALTER TABLE public.chat_sessions
ADD COLUMN IF NOT EXISTS summary text NOT NULL DEFAULT '';
```

#### 2. สร้าง api endpoint ใหม่สำหรับจัดการ chat history optimization
สร้างไฟล์ `app/api/chat_06_history_optimize/route.ts` และเพิ่มโค้ดดังนี้
```typescript {.line-numbers}
/**
 * ===============================================
 * API Route สำหรับ Chat ที่มีการเก็บประวัติและ Optimize
 * ===============================================
 * 
 * ฟีเจอร์หลัก:
 * - เก็บประวัติการสนทนาใน PostgreSQL
 * - ทำ Summary เพื่อประหยัด Token
 * - Trim Messages เพื่อไม่ให้เกิน Token Limit
 * - Streaming Response สำหรับ Real-time Chat
 * - จัดการ Session ID อัตโนมัติ
 */

import { NextRequest } from 'next/server'
import { ChatOpenAI } from '@langchain/openai'
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts'
import { toUIMessageStream } from '@ai-sdk/langchain'
import { createUIMessageStreamResponse, UIMessage } from 'ai'
import { PostgresChatMessageHistory } from '@langchain/community/stores/message/postgres'
import { Pool } from 'pg'

import { BaseMessage, AIMessage, HumanMessage, SystemMessage, MessageContent } from '@langchain/core/messages'
import { trimMessages } from '@langchain/core/messages'
import { StringOutputParser } from '@langchain/core/output_parsers'
import { encodingForModel } from '@langchain/core/utils/tiktoken'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

// ===============================================
// การตั้งค่า PostgreSQL Connection Pool
// ===============================================
/**
 * สร้าง Connection Pool สำหรับเชื่อมต่อฐานข้อมูล PostgreSQL
 * ใช้ Pool เพื่อจัดการ Connection ได้อย่างมีประสิทธิภาพ
 */
const pool = new Pool({
  host: process.env.PG_HOST,
  port: Number(process.env.PG_PORT),
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  database: process.env.PG_DATABASE,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
})

// ===============================================
// ฟังก์ชันสำหรับนับ Token (Tiktoken)
// ===============================================

/**
 * Type สำหรับ Encoder ที่ใช้นับ Token
 */
type Encoding = {
  encode: (text: string) => number[]
  free?: () => void
}

let encPromise: Promise<Encoding> | undefined

/**
 * ฟังก์ชันสำหรับขอ Encoder
 * Step 1: พยายามใช้ gpt-4o-mini ก่อน
 * Step 2: ถ้าไม่ได้ให้ fallback เป็น gpt-4
 * Step 3: Cache Encoder เพื่อไม่ต้องสร้างใหม่
 */
async function getEncoder(): Promise<Encoding> {
  if (!encPromise) {
    encPromise = encodingForModel("gpt-4o-mini").catch(() =>
      encodingForModel("gpt-4")
    )
  }
  return encPromise
}

/**
 * ฟังก์ชันนับ Token ของข้อความแต่ละอัน
 * Step 1: ตรวจสอบประเภทของ content (string, array, หรืออื่นๆ)
 * Step 2: แปลงเป็น string และนับ token
 * Step 3: คืนค่าจำนวน token
 */
async function strTokenCounter(content: MessageContent): Promise<number> {
  const enc = await getEncoder()
  if (typeof content === 'string') return enc.encode(content).length
  if (Array.isArray(content)) {
    return enc.encode(
      content.map(p => (p.type === 'text' ? p.text : JSON.stringify(p))).join(' ')
    ).length
  }
  return enc.encode(String(content ?? '')).length
}

/**
 * ฟังก์ชันนับ Token ทั้งหมดในอาเรย์ของข้อความ
 * Step 1: วนลูปผ่านข้อความทั้งหมด
 * Step 2: ระบุ role ของแต่ละข้อความ (user, assistant, system)
 * Step 3: นับ token ของ role และ content แล้วรวมกัน
 * Step 4: คืนค่าจำนวน token ทั้งหมด
 * 
 * หมายเหตุ: ไม่ export ฟังก์ชันนี้เพื่อหลีกเลี่ยง Next.js type error
 */
async function tiktokenCounter(messages: BaseMessage[]): Promise<number> {
  let total = 0
  for (const m of messages) {
    const role =
      m instanceof HumanMessage
        ? 'user'
        : m instanceof AIMessage
        ? 'assistant'
        : m instanceof SystemMessage
        ? 'system'
        : 'unknown'
    total += await strTokenCounter(role)
    total += await strTokenCounter(m.content)
  }
  return total
}

// ===============================================
// POST API: ส่งข้อความและรับการตอบกลับแบบ Stream
// ===============================================
/**
 * ฟังก์ชันหลักสำหรับจัดการ Chat
 * 
 * Flow การทำงาน:
 * 1. สร้าง/ใช้ Session ID
 * 2. โหลด Summary เดิมจากฐานข้อมูล
 * 3. ตั้งค่า AI Model
 * 4. โหลดและ Trim ประวัติการสนทนา
 * 5. สร้าง Prompt Template
 * 6. สร้าง Stream Response
 * 7. บันทึกข้อความลงฐานข้อมูล
 * 8. อัปเดต Summary
 * 9. ส่ง Response กลับ
 */
export async function POST(req: NextRequest) {
  try {
    // ===============================================
    // Step 1: รับข้อมูลจาก Request และเตรียม Session
    // ===============================================
    const { messages, sessionId, userId }: {
      messages: UIMessage[]
      sessionId?: string
      userId?: string
    } = await req.json()

    // ===============================================
    // Step 2: สร้าง Session ใหม่ถ้ายังไม่มี
    // ===============================================
    let currentSessionId = sessionId
    if (!currentSessionId) {
      const client = await pool.connect()
      try {
        // สร้างชื่อ session จากข้อความแรกของ user
        const firstMessage = messages.find(m => m.role === 'user')
        let title = 'New Chat'
        if (firstMessage && Array.isArray(firstMessage.parts) && firstMessage.parts.length > 0) {
          const textPart = firstMessage.parts.find(p => p.type === 'text')
          if (textPart && typeof textPart.text === 'string') {
            title = textPart.text.slice(0, 50) + (textPart.text.length > 50 ? '...' : '')
          }
        }
        
        // บันทึก session ใหม่ลงฐานข้อมูล
        if (!userId) throw new Error('User ID is required')
        const result = await client.query(
          'INSERT INTO chat_sessions (title, user_id) VALUES ($1, $2) RETURNING id',
          [title, userId]
        )
        currentSessionId = result.rows[0].id
      } finally {
        client.release()
      }
    }

    // ===============================================
    // Step 3: โหลด Summary เดิมจากฐานข้อมูล
    // ===============================================
    const clientForSummary = await pool.connect()
    let persistedSummary = ''
    try {
      const r = await clientForSummary.query(
        'SELECT summary FROM chat_sessions WHERE id = $1 LIMIT 1',
        [currentSessionId]
      )
      persistedSummary = r.rows?.[0]?.summary ?? ''
    } finally {
      clientForSummary.release()
    }

    // ===============================================
    // Step 4: ตั้งค่า AI Model (OpenAI GPT-4o-mini)
    // ===============================================
    const model = new ChatOpenAI({
      model: 'gpt-4o-mini',
      temperature: 0.7,
      maxTokens: 1000,
      streaming: true
    })

    // ===============================================
    // Step 5: โหลดประวัติการสนทนาและสร้าง Message History
    // ===============================================
    const messageHistory = new PostgresChatMessageHistory({
      sessionId: currentSessionId!,
      tableName: 'chat_messages',
      pool: new Pool({
        host: process.env.PG_HOST,
        port: Number(process.env.PG_PORT),
        user: process.env.PG_USER,
        password: process.env.PG_PASSWORD,
        database: process.env.PG_DATABASE,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
      })
    })

    const fullHistory = await messageHistory.getMessages()
    
    // ===============================================
    // Step 6: ดึงข้อความล่าสุดจาก User
    // ===============================================
    const lastUserMessage = messages.filter(m => m.role === 'user').pop()
    let input = ''
    if (lastUserMessage && Array.isArray(lastUserMessage.parts) && lastUserMessage.parts.length > 0) {
      const textPart = lastUserMessage.parts.find(p => p.type === 'text')
      if (textPart) input = textPart.text
    }
    if (!input) return new Response('No valid user input found.', { status: 400 })

    // ===============================================
    // Step 7: จัดการ Message History และ Token Optimization
    // ===============================================
    /**
     * สำหรับ New Chat: ใช้ประวัติจากฐานข้อมูลเท่านั้น
     * สำหรับ Chat เดิม: ทำ trim และสร้าง summary สำหรับข้อความที่เกิน limit
     */
    let recentWindowWithoutCurrentInput: BaseMessage[] = []
    let overflowSummary = ''
    
    if (sessionId && fullHistory.length > 0) {
      // มี session เดิม - ทำ trim messages เพื่อประหยัด token
      const trimmedWindow = await trimMessages(fullHistory, {
        maxTokens: 1500,
        strategy: 'last',
        tokenCounter: tiktokenCounter
      })

      // กรองข้อความล่าสุดของ user ออกเพื่อไม่ให้ซ้ำ
      recentWindowWithoutCurrentInput = trimmedWindow.filter(msg => {
        if (msg instanceof HumanMessage && msg.content === input) {
          return false
        }
        return true
      })

      // สร้าง summary สำหรับข้อความที่ถูก trim ออกไป (overflow)
      const windowSet = new Set(trimmedWindow)
      const overflow = fullHistory.filter(m => !windowSet.has(m))
      if (overflow.length > 0) {
        const summarizerPrompt = ChatPromptTemplate.fromMessages([
          ['system', 'สรุปบทสนทนาให้สั้นที่สุด เป็นภาษาไทย เก็บเฉพาะสาระสำคัญ'],
          ['human', 'สรุปข้อความต่อไปนี้:\n\n{history}']
        ])
        const summarizer = summarizerPrompt.pipe(model).pipe(new StringOutputParser())
        const historyText = overflow
          .map(m => {
            if (m instanceof HumanMessage) return `ผู้ใช้: ${m.content}`
            if (m instanceof AIMessage) return `ผู้ช่วย: ${m.content}`
            return `ระบบ: ${String(m.content)}`
          })
          .join('\n')
        try {
          overflowSummary = await summarizer.invoke({ history: historyText })
        } catch (e) {
          console.warn('overflow summary failed', e)
        }
      }
    }

    // รวม summary เดิมกับ summary ของ overflow
    const summaryForThisTurn = [persistedSummary, overflowSummary].filter(Boolean).join('\n')

    // ===============================================
    // Step 8: สร้าง Prompt Template และ Chain
    // ===============================================
    const prompt = ChatPromptTemplate.fromMessages([
      ['system', 'คุณคือผู้ช่วยที่ตอบชัดเจน และตอบเป็นภาษาไทยเมื่อผู้ใช้ถามเป็นไทย'],
      ['system', `สรุปย่อบริบทก่อนหน้า (สั้นที่สุด): {summary}`],
      new MessagesPlaceholder('recent_window'),
      ['human', '{input}']
    ])

    const chain = prompt.pipe(model).pipe(new StringOutputParser())

    // ===============================================
    // Step 9: สร้าง Stream สำหรับ Real-time Response
    // ===============================================
    const stream = await chain.stream(
      { input, summary: summaryForThisTurn, recent_window: recentWindowWithoutCurrentInput }
    )

    // ===============================================
    // Step 10: บันทึกข้อความของ User ลงฐานข้อมูล
    // ===============================================
    await messageHistory.addUserMessage(input)
    
    // ===============================================
    // Step 11: สร้าง Readable Stream สำหรับ UI
    // ===============================================
    let assistantText = ''
    const readable = new ReadableStream({
      async start(controller) {
        try {
          // อ่าน stream chunks และส่งไปยัง UI
          for await (const chunk of stream) {
            assistantText += chunk
            controller.enqueue(chunk)
          }
          
          // ===============================================
          // Step 12: บันทึกคำตอบของ AI ลงฐานข้อมูล
          // ===============================================
          if (assistantText) {
            await messageHistory.addMessage(new AIMessage(assistantText))
            
            // ===============================================
            // Step 13: อัปเดต Summary ถาวรในฐานข้อมูล
            // ===============================================
            try {
              const summarizerPrompt2 = ChatPromptTemplate.fromMessages([
                ['system', 'รวมสาระสำคัญให้สั้นที่สุด ภาษาไทย กระชับ'],
                ['human', 'นี่คือสรุปเดิม:\n{old}\n\nนี่คือข้อความใหม่:\n{delta}\n\nช่วยอัปเดตให้สั้นและครบถ้วน']
              ])
              const summarizer2 = summarizerPrompt2.pipe(model).pipe(new StringOutputParser())
              const updatedSummary = await summarizer2.invoke({
                old: persistedSummary || 'ไม่มีประวัติก่อนหน้า',
                delta: [overflowSummary, `ผู้ใช้: ${input}`, `ผู้ช่วย: ${assistantText}`].filter(Boolean).join('\n')
              })
              const clientUpdate = await pool.connect()
              try {
                await clientUpdate.query(
                  'UPDATE chat_sessions SET summary = $1 WHERE id = $2',
                  [updatedSummary, currentSessionId]
                )
              } finally {
                clientUpdate.release()
              }
            } catch (e) {
              console.warn('update summary failed', e)
            }
          }
          
          controller.close()
        } catch (error) {
          controller.error(error)
        }
      }
    })

    // ===============================================
    // Step 14: ส่ง Response กลับไปยัง Client
    // ===============================================
    return createUIMessageStreamResponse({
      stream: toUIMessageStream(readable),
      headers: currentSessionId ? { 'x-session-id': currentSessionId } : undefined
    })
  } catch (error) {
    console.error('API Error:', error)
    return new Response(
      JSON.stringify({
        error: 'An error occurred while processing your request',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

// ===============================================
// GET API: ดึงประวัติการสนทนาจาก Session ID
// ===============================================
/**
 * ฟังก์ชันสำหรับดึงประวัติการสนทนาทั้งหมดของ Session
 * 
 * Flow การทำงาน:
 * 1. ตรวจสอบ Session ID
 * 2. Query ข้อมูลจากฐานข้อมูล
 * 3. แปลงข้อมูลให้อยู่ในรูปแบบที่ UI ต้องการ
 * 4. ส่งข้อมูลกลับ
 */
export async function GET(req: NextRequest) {
  try {
    // ===============================================
    // Step 1: ตรวจสอบ Session ID จาก URL Parameters
    // ===============================================
    const { searchParams } = new URL(req.url)
    const sessionId = searchParams.get('sessionId')
    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: 'Session ID is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // ===============================================
    // Step 2: Query ข้อมูลประวัติการสนทนาจากฐานข้อมูล
    // ===============================================
    const client = await pool.connect()
    try {
      const result = await client.query(
        `SELECT message, message->>'type' as message_type, created_at
         FROM chat_messages 
         WHERE session_id = $1 
         ORDER BY created_at ASC`,
        [sessionId]
      )
      
      // ===============================================
      // Step 3: แปลงข้อมูลให้อยู่ในรูปแบบที่ UI ต้องการ
      // ===============================================
      const messages = result.rows.map((row, i) => {
        const data = row.message
        let role = 'user'
        if (row.message_type === 'ai') role = 'assistant'
        else if (row.message_type === 'human') role = 'user'
        return {
          id: `history-${i}`,
          role,
          content: data.content || data.text || data.message || '',
          createdAt: row.created_at
        }
      })
      
      // ===============================================
      // Step 4: ส่งข้อมูลกลับ
      // ===============================================
      return new Response(JSON.stringify({ messages }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error fetching messages:', error)
    return new Response(
      JSON.stringify({
        error: 'Failed to fetch messages',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
```

#### 3. สร้างไฟล์ API Route สำหรับจัดการ Chat Sessions
สร้างไฟล์ `app/api/chat_06_history_optimize/session/route.ts` และเพิ่มโค้ดดังนี้
```typescript {.line-numbers}
/**
 * ===============================================
 * API Route สำหรับจัดการ Chat Sessions
 * ===============================================
 * 
 * ฟีเจอร์หลัก:
 * - ดึงรายการ Chat Sessions ทั้งหมดของ User
 * - สร้าง Chat Session ใหม่
 * - อัปเดต Title ของ Chat Session
 * - ลบ Chat Session และข้อความทั้งหมด
 * - รองรับ Transaction เพื่อความปลอดภัยของข้อมูล
 */

import { NextRequest, NextResponse } from "next/server"
import { Pool } from 'pg'

// ===============================================
// การตั้งค่า Runtime และ Configuration
// ===============================================
/**
 * กำหนดให้ API ทำงานแบบ Dynamic เพื่อรองรับการเชื่อมต่อฐานข้อมูล
 * ไม่ใช้ Edge Runtime เพราะ PostgreSQL ต้องการ Node.js APIs
 */
export const dynamic = 'force-dynamic'

// ===============================================
// การตั้งค่า PostgreSQL Connection Pool
// ===============================================
/**
 * สร้าง Connection Pool สำหรับเชื่อมต่อฐานข้อมูล PostgreSQL
 * ใช้ Pool เพื่อจัดการ Connection ได้อย่างมีประสิทธิภาพ
 * รองรับทั้ง Development และ Production Environment
 */
const pool = new Pool({
  host: process.env.PG_HOST,        // ที่อยู่เซิร์ฟเวอร์ฐานข้อมูล
  port: Number(process.env.PG_PORT), // พอร์ตการเชื่อมต่อ
  user: process.env.PG_USER,        // ชื่อผู้ใช้ฐานข้อมูล
  password: process.env.PG_PASSWORD, // รหัสผ่านฐานข้อมูล
  database: process.env.PG_DATABASE, // ชื่อฐานข้อมูล
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false, // การตั้งค่า SSL
})

// ===============================================
// GET API: ดึงรายการ Chat Sessions
// ===============================================
/**
 * ฟังก์ชันสำหรับดึงข้อมูล Chat Sessions
 * 
 * รองรับ 2 โหมด:
 * 1. ดึง Session เดียว (ส่ง sessionId)
 * 2. ดึงรายการ Sessions ทั้งหมดของ User (ส่ง userId)
 * 
 * Parameters:
 * - userId: ID ของผู้ใช้ (จำเป็น)
 * - sessionId: ID ของ Session (ไม่จำเป็น)
 */
export async function GET(req: NextRequest) {
  try {
    // ===============================================
    // Step 1: ดึง Parameters จาก URL
    // ===============================================
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId')       // ID ของผู้ใช้
    const sessionId = searchParams.get('sessionId') // ID ของ Session (ไม่จำเป็น)
    
    // ===============================================
    // Step 2: เชื่อมต่อฐานข้อมูล
    // ===============================================
    const client = await pool.connect()
    
    try {
      // ===============================================
      // Step 3: ตรวจสอบว่าต้องการ Session เดียวหรือหลาย Session
      // ===============================================
      if (sessionId) {
        // โหมด: ดึง Session เดียว
        const result = await client.query(`
          SELECT 
            id,                    -- ID ของ Session
            title,                 -- ชื่อ Session
            created_at,            -- วันที่สร้าง
            user_id,               -- ID ของผู้ใช้
            (
              SELECT COUNT(*) 
              FROM chat_messages
              WHERE session_id = chat_sessions.id::text
            ) as message_count      -- จำนวนข้อความใน Session
          FROM chat_sessions 
          WHERE id = $1
        `, [sessionId])

        // ตรวจสอบว่าพบ Session หรือไม่
        if (result.rows.length === 0) {
          return NextResponse.json(
            { error: "Session not found" },
            { status: 404 }
          )
        }

        return NextResponse.json({
          session: result.rows[0]
        })
      }

      // ===============================================
      // Step 4: โหมดดึงรายการ Sessions ทั้งหมด
      // ===============================================
      
      // สร้าง Base Query สำหรับดึงรายการ Sessions
      let query = `
        SELECT 
          id,                    -- ID ของ Session
          title,                 -- ชื่อ Session
          created_at,            -- วันที่สร้าง
          user_id,               -- ID ของผู้ใช้
          (
            SELECT COUNT(*) 
            FROM chat_messages
            WHERE session_id = chat_sessions.id::text
          ) as message_count      -- จำนวนข้อความใน Session
        FROM chat_sessions 
      `
      
      const params: (string | number)[] = [] // อาเรย์สำหรับเก็บ Parameters
      
      // ===============================================
      // Step 5: ตรวจสอบและเพิ่มเงื่อนไข User ID
      // ===============================================
      if (!userId) {
        return Response.json({ error: 'User ID is required' }, { status: 400 })
      }
      
      query += ` WHERE user_id = $1 `  // เพิ่มเงื่อนไข User ID
      params.push(userId)
      
      // เรียงลำดับตามวันที่สร้างล่าสุด และจำกัดจำนวน 50 รายการ
      query += ` ORDER BY created_at DESC LIMIT 50`
      
      // ===============================================
      // Step 6: Execute Query และส่งผลลัพธ์กลับ
      // ===============================================
      const result = await client.query(query, params)

      return NextResponse.json({
        sessions: result.rows
      })
    } finally {
      // ===============================================
      // Step 7: ปิดการเชื่อมต่อฐานข้อมูล
      // ===============================================
      client.release()
    }
  } catch (error) {
    console.error("Error fetching chat sessions:", error)
    return NextResponse.json(
      { error: "Failed to fetch chat sessions" },
      { status: 500 }
    )
  }
}

// ===============================================
// POST API: สร้าง Chat Session ใหม่
// ===============================================
/**
 * ฟังก์ชันสำหรับสร้าง Chat Session ใหม่
 * 
 * Input Parameters:
 * - title: ชื่อของ Session (ไม่จำเป็น, ถ้าไม่ส่งจะใช้ "New Chat")
 * - userId: ID ของผู้ใช้ (จำเป็น)
 * 
 * Output:
 * - session: ข้อมูล Session ที่สร้างใหม่
 */
export async function POST(req: NextRequest) {
  try {
    // ===============================================
    // Step 1: ดึงข้อมูลจาก Request Body
    // ===============================================
    const { title, userId } = await req.json()
    
    // ===============================================
    // Step 2: ตรวจสอบ User ID (จำเป็น)
    // ===============================================
    if (!userId) {
      return Response.json({ error: 'User ID is required' }, { status: 400 })
    }
    
    // ===============================================
    // Step 3: เชื่อมต่อฐานข้อมูล
    // ===============================================
    const client = await pool.connect()
    
    try {
      // ===============================================
      // Step 4: สร้าง Session ใหม่ในฐานข้อมูล
      // ===============================================
      const result = await client.query(`
        INSERT INTO chat_sessions (title, user_id)
        VALUES ($1, $2)
        RETURNING id, title, created_at
      `, [title || 'New Chat', userId]) // ใช้ "New Chat" เป็นค่าเริ่มต้นถ้าไม่มี title

      const newSession = result.rows[0] // ข้อมูล Session ที่สร้างใหม่

      // ===============================================
      // Step 5: ส่งข้อมูล Session ใหม่กลับ
      // ===============================================
      return NextResponse.json({
        session: {
          id: newSession.id,
          title: newSession.title,
          created_at: newSession.created_at,
          message_count: 0 // Session ใหม่ยังไม่มีข้อความ
        }
      })
    } finally {
      // ===============================================
      // Step 6: ปิดการเชื่อมต่อฐานข้อมูล
      // ===============================================
      client.release()
    }
  } catch (error) {
    console.error("Error creating chat session:", error)
    return NextResponse.json(
      { error: "Failed to create chat session" },
      { status: 500 }
    )
  }
}

// ===============================================
// PUT API: อัปเดต Title ของ Chat Session
// ===============================================
/**
 * ฟังก์ชันสำหรับแก้ไขชื่อของ Chat Session
 * 
 * Input Parameters:
 * - sessionId: ID ของ Session ที่ต้องการแก้ไข (จำเป็น)
 * - title: ชื่อใหม่ของ Session (จำเป็น)
 * 
 * Output:
 * - session: ข้อมูล Session ที่อัปเดตแล้ว
 */
export async function PUT(req: NextRequest) {
  try {
    // ===============================================
    // Step 1: ดึงข้อมูลจาก Request Body
    // ===============================================
    const { sessionId, title } = await req.json()
    
    // ===============================================
    // Step 2: ตรวจสอบ Parameters ที่จำเป็น
    // ===============================================
    if (!sessionId || !title) {
      return NextResponse.json(
        { error: "Session ID and title are required" },
        { status: 400 }
      )
    }

    // ===============================================
    // Step 3: เชื่อมต่อฐานข้อมูล
    // ===============================================
    const client = await pool.connect()
    
    try {
      // ===============================================
      // Step 4: อัปเดต Title ในฐานข้อมูล
      // ===============================================
      const result = await client.query(`
        UPDATE chat_sessions 
        SET title = $1 
        WHERE id = $2
        RETURNING id, title, created_at
      `, [title, sessionId])

      // ===============================================
      // Step 5: ตรวจสอบว่าพบ Session หรือไม่
      // ===============================================
      if (result.rows.length === 0) {
        return NextResponse.json(
          { error: "Session not found" },
          { status: 404 }
        )
      }

      // ===============================================
      // Step 6: ส่งข้อมูล Session ที่อัปเดตแล้วกลับ
      // ===============================================
      return NextResponse.json({
        session: result.rows[0]
      })
    } finally {
      // ===============================================
      // Step 7: ปิดการเชื่อมต่อฐานข้อมูล
      // ===============================================
      client.release()
    }
  } catch (error) {
    console.error("Error updating chat session:", error)
    return NextResponse.json(
      { error: "Failed to update chat session" },
      { status: 500 }
    )
  }
}

// ===============================================
// DELETE API: ลบ Chat Session และข้อความทั้งหมด
// ===============================================
/**
 * ฟังก์ชันสำหรับลบ Chat Session และข้อความที่เกี่ยวข้องทั้งหมด
 * ใช้ Database Transaction เพื่อความปลอดภัยของข้อมูล
 * 
 * Input Parameters:
 * - sessionId: ID ของ Session ที่ต้องการลบ (ส่งผ่าน URL Parameter)
 * 
 * Output:
 * - message: ข้อความยืนยันการลบ
 * - sessionId: ID ของ Session ที่ถูกลบ
 */
export async function DELETE(req: NextRequest) {
  try {
    // ===============================================
    // Step 1: ดึง Session ID จาก URL Parameters
    // ===============================================
    const { searchParams } = new URL(req.url)
    const sessionId = searchParams.get('sessionId')
    
    // ===============================================
    // Step 2: ตรวจสอบ Session ID
    // ===============================================
    if (!sessionId) {
      return NextResponse.json(
        { error: "Session ID is required" },
        { status: 400 }
      )
    }

    // ===============================================
    // Step 3: เชื่อมต่อฐานข้อมูล
    // ===============================================
    const client = await pool.connect()
    
    try {
      // ===============================================
      // Step 4: เริ่มต้น Database Transaction
      // ===============================================
      await client.query('BEGIN')
      
      // ===============================================
      // Step 5: ลบข้อความทั้งหมดใน Session นี้ก่อน
      // ===============================================
      await client.query(`
        DELETE FROM chat_messages 
        WHERE session_id = $1
      `, [sessionId])
      
      // ===============================================
      // Step 6: ลบ Chat Session
      // ===============================================
      const result = await client.query(`
        DELETE FROM chat_sessions 
        WHERE id = $1
        RETURNING id
      `, [sessionId])
      
      // ===============================================
      // Step 7: ตรวจสอบว่าพบ Session หรือไม่
      // ===============================================
      if (result.rows.length === 0) {
        await client.query('ROLLBACK') // ยกเลิก Transaction
        return NextResponse.json(
          { error: "Session not found" },
          { status: 404 }
        )
      }
      
      // ===============================================
      // Step 8: Commit Transaction (บันทึกการเปลี่ยนแปลง)
      // ===============================================
      await client.query('COMMIT')

      // ===============================================
      // Step 9: ส่งข้อความยืนยันการลบกลับ
      // ===============================================
      return NextResponse.json({
        message: "Session deleted successfully",
        sessionId: sessionId
      })
    } catch (error) {
      // ===============================================
      // Step 10: Rollback Transaction หากเกิดข้อผิดพลาด
      // ===============================================
      await client.query('ROLLBACK')
      throw error
    } finally {
      // ===============================================
      // Step 11: ปิดการเชื่อมต่อฐานข้อมูล
      // ===============================================
      client.release()
    }
  } catch (error) {
    console.error("Error deleting chat session:", error)
    return NextResponse.json(
      { error: "Failed to delete chat session" },
      { status: 500 }
    )
  }
}
```

#### 4. สร้างไฟล์ API Route สำหรับจัดการ Chat ให้ทำงานได้เร็วขึ้นลดกระเบวนการติดต่อกับฐานข้อมูล
สร้างไฟล์ `app/api/chat_06_history_optimistic/route.ts` และเพิ่มโค้ดดังนี้
```typescript {.line-numbers}
/**
 * ===============================================
 * API Route สำหรับ Chat ที่มีการเก็บประวัติและ Optimize
 * ===============================================
 * 
 * ฟีเจอร์หลัก:
 * - เก็บประวัติการสนทนาใน PostgreSQL
 * - ทำ Summary เพื่อประหยัด Token
 * - Trim Messages เพื่อไม่ให้เกิน Token Limit
 * - Streaming Response สำหรับ Real-time Chat
 * - จัดการ Session ID อัตโนมัติ
 */

import { NextRequest } from 'next/server'
import { ChatOpenAI } from '@langchain/openai'
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts'
import { toUIMessageStream } from '@ai-sdk/langchain'
import { createUIMessageStreamResponse, UIMessage } from 'ai'
import { PostgresChatMessageHistory } from '@langchain/community/stores/message/postgres'
import { Pool } from 'pg'
import { v4 as uuidv4 } from 'uuid' // 👈 1. Import UUID

import { BaseMessage, AIMessage, HumanMessage, SystemMessage, MessageContent } from '@langchain/core/messages'
import { trimMessages } from '@langchain/core/messages'
import { StringOutputParser } from '@langchain/core/output_parsers'
import { encodingForModel } from '@langchain/core/utils/tiktoken'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

// ===============================================
// การตั้งค่า PostgreSQL Connection Pool
// ===============================================
/**
 * สร้าง Connection Pool สำหรับเชื่อมต่อฐานข้อมูล PostgreSQL
 * ใช้ Pool เพื่อจัดการ Connection ได้อย่างมีประสิทธิภาพ
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
})

// ===============================================
// ฟังก์ชันสำหรับนับ Token (Tiktoken)
// ===============================================

/**
 * Type สำหรับ Encoder ที่ใช้นับ Token
 */
type Encoding = {
  encode: (text: string) => number[]
  free?: () => void
}

let encPromise: Promise<Encoding> | undefined

/**
 * ฟังก์ชันสำหรับขอ Encoder
 * Step 1: พยายามใช้ gpt-4o-mini ก่อน
 * Step 2: ถ้าไม่ได้ให้ fallback เป็น gpt-4
 * Step 3: Cache Encoder เพื่อไม่ต้องสร้างใหม่
 */
async function getEncoder(): Promise<Encoding> {
  if (!encPromise) {
    encPromise = encodingForModel("gpt-4o-mini").catch(() =>
      encodingForModel("gpt-4")
    )
  }
  return encPromise
}

/**
 * ฟังก์ชันนับ Token ของข้อความแต่ละอัน
 * Step 1: ตรวจสอบประเภทของ content (string, array, หรืออื่นๆ)
 * Step 2: แปลงเป็น string และนับ token
 * Step 3: คืนค่าจำนวน token
 */
async function strTokenCounter(content: MessageContent): Promise<number> {
  const enc = await getEncoder()
  if (typeof content === 'string') return enc.encode(content).length
  if (Array.isArray(content)) {
    return enc.encode(
      content.map(p => (p.type === 'text' ? p.text : JSON.stringify(p))).join(' ')
    ).length
  }
  return enc.encode(String(content ?? '')).length
}

/**
 * ฟังก์ชันนับ Token ทั้งหมดในอาเรย์ของข้อความ
 * Step 1: วนลูปผ่านข้อความทั้งหมด
 * Step 2: ระบุ role ของแต่ละข้อความ (user, assistant, system)
 * Step 3: นับ token ของ role และ content แล้วรวมกัน
 * Step 4: คืนค่าจำนวน token ทั้งหมด
 * 
 * หมายเหตุ: ไม่ export ฟังก์ชันนี้เพื่อหลีกเลี่ยง Next.js type error
 */
async function tiktokenCounter(messages: BaseMessage[]): Promise<number> {
  let total = 0
  for (const m of messages) {
    const role =
      m instanceof HumanMessage
        ? 'user'
        : m instanceof AIMessage
        ? 'assistant'
        : m instanceof SystemMessage
        ? 'system'
        : 'unknown'
    total += await strTokenCounter(role)
    total += await strTokenCounter(m.content)
  }
  return total
}

// ===============================================
// POST API: ส่งข้อความและรับการตอบกลับแบบ Stream
// ===============================================
/**
 * ฟังก์ชันหลักสำหรับจัดการ Chat
 * 
 * Flow การทำงาน:
 * 1. สร้าง/ใช้ Session ID
 * 2. โหลด Summary เดิมจากฐานข้อมูล
 * 3. ตั้งค่า AI Model
 * 4. โหลดและ Trim ประวัติการสนทนา
 * 5. สร้าง Prompt Template
 * 6. สร้าง Stream Response
 * 7. บันทึกข้อความลงฐานข้อมูล
 * 8. อัปเดต Summary
 * 9. ส่ง Response กลับ
 */
export async function POST(req: NextRequest) {
  try {

    const { messages, sessionId, userId }: {
      messages: UIMessage[]
      sessionId?: string
      userId?: string
    } = await req.json()

    // ===============================================
    // Step 1: Optimistic Session Management
    // สร้าง ID ชั่วคราวสำหรับ session ใหม่ทันที ไม่ต้องรอ DB
    // ===============================================
    const isNewSession = !sessionId
    const currentSessionId = sessionId || uuidv4()

    // ===============================================
    // Step 2: ดึงข้อมูลที่จำเป็นล่วงหน้า (ทำพร้อมกัน)
    // ===============================================
    let persistedSummary = ''
    let fullHistory: BaseMessage[] = []

    if (!isNewSession) {
      // ถ้าเป็น session เดิม ให้ดึง summary และ history พร้อมกันเพื่อลดเวลา
      const [summaryResult, historyResult] = await Promise.all([
        pool.query('SELECT summary FROM chat_sessions WHERE id = $1 LIMIT 1', [currentSessionId]),
        new PostgresChatMessageHistory({ sessionId: currentSessionId, tableName: 'chat_messages', pool }).getMessages()
      ])
      persistedSummary = summaryResult.rows?.[0]?.summary ?? ''
      fullHistory = historyResult
    }

    // ===============================================
    // Step 3: ตั้งค่า AI Model และดึง Input จาก User
    // ===============================================
    const model = new ChatOpenAI({
      model: 'gpt-4o-mini',
      temperature: 0.7,
      maxTokens: 1000,
      streaming: true
    })

    const lastUserMessage = messages.filter(m => m.role === 'user').pop()
    const input = lastUserMessage?.parts?.find(p => p.type === 'text')?.text ?? ''
    if (!input) return new Response('No valid user input found.', { status: 400 })

    // ===============================================
    // Step 4: Trim ประวัติแชท (ถ้ามี)
    // ✅ ยกเลิกการสร้าง overflowSummary ที่เรียก AI ล่วงหน้า
    // ===============================================
    const recentWindow = fullHistory.length > 0
      ? await trimMessages(fullHistory, { maxTokens: 1500, strategy: 'last', tokenCounter: tiktokenCounter })
      : []

    // ===============================================
    // Step 5: สร้าง Prompt และ Chain
    // ===============================================
    const prompt = ChatPromptTemplate.fromMessages([
      ['system', 'คุณคือผู้ช่วยที่ตอบชัดเจน และตอบเป็นภาษาไทยเมื่อผู้ใช้ถามเป็นไทย'],
      ['system', 'สรุปย่อบริบทก่อนหน้า (สั้นที่สุด): {summary}'],
      new MessagesPlaceholder('recent_window'),
      ['human', '{input}']
    ])
    const chain = prompt.pipe(model).pipe(new StringOutputParser())

    // ===============================================
    // Step 6: สร้าง Stream และบันทึกข้อมูลแบบ Pipeline
    // ===============================================
    let assistantText = ''
    const messageHistory = new PostgresChatMessageHistory({
      sessionId: currentSessionId,
      tableName: 'chat_messages',
      pool: pool,
    })

    // 1. บันทึกข้อความ User ก่อนเริ่ม stream
    await messageHistory.addUserMessage(input)

    // 2. สร้าง Stream พร้อมเก็บ Response
    const stream = await chain.stream({ 
      input, 
      summary: persistedSummary, 
      recent_window: recentWindow 
    })

    // 3. สร้าง ReadableStream ที่เก็บข้อมูลและประมวลผลพร้อมกัน
    const responseStream = new ReadableStream<string>({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            assistantText += chunk
            controller.enqueue(chunk)
          }
          controller.close()
          
          // 4. บันทึกข้อมูลหลังจาก Stream จบ
          if (assistantText) {
            try {
              // บันทึกคำตอบของ AI
              await messageHistory.addMessage(new AIMessage(assistantText))

              // แยกการทำงานสำหรับ Session ใหม่ และ Session เก่า
              if (isNewSession) {
                await createSessionAndUpdateMessages(currentSessionId, userId, messages)
              } else {
                const newHistoryForSummary = [
                  ...recentWindow.map(m => formatMessageForSummary(m)),
                  `ผู้ใช้: ${input}`,
                  `ผู้ช่วย: ${assistantText}`
                ].join('\n')
                await updateSessionSummary(currentSessionId, persistedSummary, newHistoryForSummary)
              }
            } catch (bgError) {
              console.error("❌ Background task error:", bgError)
            }
          }
        } catch (error) {
          console.error("❌ Stream error:", error)
          controller.error(error)
        }
      }
    })

    return createUIMessageStreamResponse({
      stream: toUIMessageStream(responseStream),
      headers: { 'x-session-id': currentSessionId },
    })
  } catch (error) {
    console.error('API Error:', error)
    return new Response(
      JSON.stringify({
        error: 'An error occurred while processing your request',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

// ===============================================
// 🚀 Helper Functions: แยก Logic เพื่อความสะอาด
// ===============================================

/**
 * สร้าง Session ใหม่และอัปเดตข้อความที่ถูกบันทึกด้วย Temp ID
 */
async function createSessionAndUpdateMessages(tempSessionId: string, userId: string | undefined, messages: UIMessage[]) {
  if (!userId) {
    console.error("❌ Cannot save session without a User ID.")
    return
  }

  const client = await pool.connect()
  try {
    const firstMessage = messages.find(m => m.role === 'user')
    let title = 'New Chat'
    if (firstMessage?.parts?.[0]?.type === 'text') {
      title = firstMessage.parts[0].text.slice(0, 50)
    }

    const sessionResult = await client.query(
      'INSERT INTO chat_sessions (title, user_id) VALUES ($1, $2) RETURNING id',
      [title, userId]
    )
    const permanentSessionId = sessionResult.rows[0].id

    const updateResult = await client.query(
      'UPDATE chat_messages SET session_id = $1 WHERE session_id = $2',
      [permanentSessionId, tempSessionId]
    )
  } catch (error) {
    console.error("❌ Error in createSessionAndUpdateMessages:", error)
    throw error // Re-throw เพื่อให้เห็น error
  } finally {
    client.release()
  }
}

/**
 * อัปเดต Summary สำหรับ Session ที่มีอยู่แล้ว
 */
async function updateSessionSummary(sessionId: string, oldSummary: string, delta: string) {
  
  try {
    const model = new ChatOpenAI({ model: 'gpt-4o-mini' })
    const summarizerPrompt = ChatPromptTemplate.fromMessages([
      ['system', 'รวมสาระสำคัญให้สั้นที่สุด ภาษาไทย กระชับ'],
      ['human', 'นี่คือสรุปเดิม:\n{old}\n\nนี่คือข้อความใหม่:\n{delta}\n\nช่วยอัปเดตให้สั้นและครบถ้วน']
    ])
    const summarizer = summarizerPrompt.pipe(model).pipe(new StringOutputParser())
    const updatedSummary = await summarizer.invoke({
      old: oldSummary || 'ไม่มีประวัติก่อนหน้า',
      delta: delta,
    })
    
    const result = await pool.query(
      'UPDATE chat_sessions SET summary = $1 WHERE id = $2 RETURNING id',
      [updatedSummary, sessionId]
    )

  } catch (e) {
    console.error(`❌ Failed to update summary for session ${sessionId}:`, e)
    throw e // Re-throw เพื่อให้เห็น error
  }
}

/**
 * ฟังก์ชันช่วยแปลง Message Object เป็น String สำหรับทำ Summary
 */
function formatMessageForSummary(m: BaseMessage): string {
    if (m instanceof HumanMessage) return `ผู้ใช้: ${m.content}`
    if (m instanceof AIMessage) return `ผู้ช่วย: ${m.content}`
    return `ระบบ: ${String(m.content)}`
}


// ===============================================
// GET API: ดึงประวัติการสนทนาจาก Session ID
// ===============================================
/**
 * ฟังก์ชันสำหรับดึงประวัติการสนทนาทั้งหมดของ Session
 * 
 * Flow การทำงาน:
 * 1. ตรวจสอบ Session ID
 * 2. Query ข้อมูลจากฐานข้อมูล
 * 3. แปลงข้อมูลให้อยู่ในรูปแบบที่ UI ต้องการ
 * 4. ส่งข้อมูลกลับ
 */
export async function GET(req: NextRequest) {
  try {
    // ===============================================
    // Step 1: ตรวจสอบ Session ID จาก URL Parameters
    // ===============================================
    const { searchParams } = new URL(req.url)
    const sessionId = searchParams.get('sessionId')
    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: 'Session ID is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // ===============================================
    // Step 2: Query ข้อมูลประวัติการสนทนาจากฐานข้อมูล
    // ===============================================
    const client = await pool.connect()
    try {
      const result = await client.query(
        `SELECT message, message->>'type' as message_type, created_at
         FROM chat_messages 
         WHERE session_id = $1 
         ORDER BY created_at ASC`,
        [sessionId]
      )
      
      // ===============================================
      // Step 3: แปลงข้อมูลให้อยู่ในรูปแบบที่ UI ต้องการ
      // ===============================================
      const messages = result.rows.map((row, i) => {
        const data = row.message
        let role = 'user'
        if (row.message_type === 'ai') role = 'assistant'
        else if (row.message_type === 'human') role = 'user'
        return {
          id: `history-${i}`,
          role,
          content: data.content || data.text || data.message || '',
          createdAt: row.created_at
        }
      })
      
      // ===============================================
      // Step 4: ส่งข้อมูลกลับ
      // ===============================================
      return new Response(JSON.stringify({ messages }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error fetching messages:', error)
    return new Response(
      JSON.stringify({
        error: 'Failed to fetch messages',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
```