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
