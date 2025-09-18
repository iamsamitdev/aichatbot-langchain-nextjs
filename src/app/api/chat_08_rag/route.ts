/**
 * ===============================================
 * API Route สำหรับ Chat (RAG - Document Search Only)
 * ===============================================
 *
 * ฟีเจอร์หลัก:
 * - 📚 RAG (Retrieval-Augmented Generation) with pgvector
 * - 🔍 Document Search จากเอกสาร (PDF, CSV, TXT) ใน documents table
 * - 🗂️ เก็บประวัติการสนทนาใน PostgreSQL
 * - 🧠 ทำ Summary เพื่อประหยัด Token
 * - ✂️ Trim Messages เพื่อไม่ให้เกิน Token Limit
 * - 🌊 Streaming Response สำหรับ Real-time Chat
 * - 🔧 จัดการ Session ID อัตโนมัติ
 * 
 * การทำงาน:
 * 1. รับคำถามจากผู้ใช้
 * 2. ค้นหาเอกสารที่เกี่ยวข้องจาก Vector Store
 * 3. ใช้ข้อมูลจากเอกสารมาตอบคำถาม
 * 4. ส่งผลลัพธ์แบบ Streaming
*/

import { NextRequest } from 'next/server'
import { getDatabase } from '@/lib/database'

// LangChain & AI SDK Imports
import { ChatOpenAI } from '@langchain/openai'
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts'
import { toUIMessageStream } from '@ai-sdk/langchain'
import { createUIMessageStreamResponse, UIMessage } from 'ai'
import { PostgresChatMessageHistory } from '@langchain/community/stores/message/postgres'
import { BaseMessage, AIMessage, HumanMessage, SystemMessage, MessageContent } from '@langchain/core/messages'
import { trimMessages } from '@langchain/core/messages'
import { StringOutputParser } from '@langchain/core/output_parsers'
import { encodingForModel } from '@langchain/core/utils/tiktoken'
import { createClient } from '@supabase/supabase-js'

// ✨ NEW: Imports for Vector Search (Document RAG)
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase"
import { OpenAIEmbeddings } from "@langchain/openai"
import { CacheBackedEmbeddings } from "langchain/embeddings/cache_backed"
import { InMemoryStore } from "@langchain/core/stores"

export const dynamic = 'force-dynamic'
export const maxDuration = 30

// ===============================================
// ใช้ centralized database utility แทน pool ที่สร้างเอง
// ===============================================
const pool = getDatabase()

// สร้าง Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY!
)

// ===============================================
// ✨ NEW: สร้าง Vector Store สำหรับ Document Search
// ===============================================
async function createVectorStore() {
  const baseEmbeddings = new OpenAIEmbeddings({ 
    model: process.env.OPENAI_EMBEDDING_MODEL_NAME || "text-embedding-3-small",
    dimensions: 1536
  });

  // สร้าง Cache-backed embeddings เพื่อลดต้นทุนและเพิ่มความเร็ว
  const cacheStore = new InMemoryStore();
  const embeddings = CacheBackedEmbeddings.fromBytesStore(
    baseEmbeddings,
    cacheStore,
    {
      namespace: "rag_embeddings" // namespace สำหรับ RAG
    }
  );

  return new SupabaseVectorStore(embeddings, {
    client: supabase,
    tableName: 'documents',
    queryName: 'match_documents'
  });
}

// ===============================================
// ฟังก์ชันสำหรับ RAG (Vector Search)
// ===============================================
async function searchDocuments(query: string, limit: number = 5) {
  try {
    console.log(`🔧 Searching documents with query="${query}", limit=${limit}`);
    
    // สร้าง vector store
    const vectorStore = await createVectorStore();
    
    // ค้นหาเอกสารที่เกี่ยวข้อง
    const results = await vectorStore.similaritySearchWithScore(query, limit);
    
    if (!results || results.length === 0) {
      return `ไม่พบเอกสารที่เกี่ยวข้องกับ "${query}" ในระบบ`;
    }
    
    console.log(`✅ พบเอกสารที่เกี่ยวข้อง: ${results.length} รายการ`);
    
    // จัดรูปแบบผลลัพธ์เป็นข้อความสำหรับใส่ใน prompt
    const documents = results.map(([doc, score]) => {
      const filename = doc.metadata?.filename || 'ไม่ทราบชื่อไฟล์';
      const type = doc.metadata?.type || 'ไม่ทราบประเภท';
      return `ไฟล์: ${filename} (${type.toUpperCase()})
เนื้อหา: ${doc.pageContent}
ความเกี่ยวข้อง: ${(score * 100).toFixed(1)}%`;
    }).join('\n\n---\n\n');
    
    return documents;
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    console.log('❌ Search error:', errorMessage);
    
    if (errorMessage.includes('connection') || 
        errorMessage.includes('network') || 
        errorMessage.includes('timeout')) {
      throw new Error('ไม่สามารถเข้าถึงระบบค้นหาเอกสารได้ในขณะนี้');
    }
    
    throw new Error(`เกิดข้อผิดพลาดในการค้นหาเอกสาร: ${errorMessage}`);
  }
}

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
      model: process.env.OPENAI_MODEL_NAME || "gpt-4o-mini",
      temperature: 0.1, // ลด temperature ให้ต่ำมากเพื่อให้ติดตาม instruction เข้มงวด
      maxTokens: 1000,
      streaming: true
    })

    // ===============================================
    // Step 5: โหลดประวัติการสนทนาและสร้าง Message History
    // ===============================================
    const messageHistory = new PostgresChatMessageHistory({
      sessionId: currentSessionId!,
      tableName: 'chat_messages',
      pool: pool
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
    // 🔄 MODIFIED Step 8: สร้าง RAG Chain แทน Agent
    // ===============================================
    const ragPrompt = ChatPromptTemplate.fromMessages([
      ['system', `คุณคือผู้ช่วย AI อัจฉริยะที่ตอบเป็นภาษาไทย 
      
      คุณมีข้อมูลจากเอกสารที่อัปโหลดไว้ในระบบ (PDF, CSV, TXT) เพื่อใช้ตอบคำถาม
      
      **หลักการตอบคำถาม:**
      - ใช้ข้อมูลจากเอกสารที่ให้มาในการตอบคำถาม
      - หากไม่มีข้อมูลที่เกี่ยวข้อง ให้บอกว่าไม่พบข้อมูลที่เกี่ยวข้อง
      - ห้ามเดาหรือสร้างข้อมูลขึ้นมาเอง ให้ใช้ข้อมูลจากเอกสารเท่านั้น
      - ตอบด้วยข้อมูลที่ถูกต้องและครบถ้วน
      
      บริบทการสนทนาก่อนหน้านี้โดยสรุปคือ: {summary}
      
      ข้อมูลจากเอกสารที่เกี่ยวข้อง:
      {context}`],
      new MessagesPlaceholder('chat_history'), // ประวัติการสนทนาก่อนหน้านี้
      ['human', '{input}']
    ])

    // สร้าง Chain โดยใช้ RAG
    const ragChain = ragPrompt.pipe(model).pipe(new StringOutputParser())

    // ===============================================
    // 🔄 MODIFIED Step 9: ค้นหาข้อมูลจากเอกสารและสร้าง Stream
    // ===============================================
    // ค้นหาเอกสารที่เกี่ยวข้องก่อน
    let documentContext = '';
    try {
      documentContext = await searchDocuments(input, 3); // ค้นหา 3 เอกสารที่เกี่ยวข้องที่สุด
    } catch (error) {
      console.warn('⚠️ ไม่สามารถค้นหาเอกสารได้:', error instanceof Error ? error.message : String(error));
      documentContext = 'ไม่สามารถเข้าถึงระบบค้นหาเอกสารได้ในขณะนี้';
    }

    // รวม summary เข้าไปเป็น chat history
    const chatHistoryForChain = [...recentWindowWithoutCurrentInput];
    if (summaryForThisTurn) {
        chatHistoryForChain.unshift(new SystemMessage(summaryForThisTurn));
    }

    // สร้าง Stream จาก Chain
    const stream = await ragChain.stream({
        input: input,
        chat_history: chatHistoryForChain,
        summary: summaryForThisTurn,
        context: documentContext
    });

    // ===============================================
    // Step 10: บันทึกข้อความของ User ลงฐานข้อมูล (เฉพาะเมื่อเชื่อมต่อได้)
    // ===============================================
    let canSaveToDatabase = true
    try {
      await messageHistory.addUserMessage(input)
    } catch (e) {
      console.warn('⚠️ ไม่สามารถบันทึกข้อความ user ลงฐานข้อมูลได้:', e instanceof Error ? e.message : String(e))
      canSaveToDatabase = false
    }
    
    // ===============================================
    // 🔄 MODIFIED Step 11: จัดการ Stream จาก Chain และบันทึกผลลัพธ์
    // ===============================================
    let assistantText = ''
    let hasSearchError = false // ตัวแปรเช็คว่ามี search error หรือไม่
    
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            // Chain stream จะส่ง string chunks ออกมา
            if (typeof chunk === 'string') {
              assistantText += chunk;
              
              // ตรวจสอบว่ามี search error หรือไม่
              if (chunk.includes('ไม่สามารถเข้าถึงระบบค้นหาเอกสารได้') || 
                  assistantText.includes('ไม่สามารถเข้าถึงระบบค้นหาเอกสารได้')) {
                hasSearchError = true;
                // แทนที่ error message ด้วยข้อความที่เป็นมิตร
                const friendlyMessage = 'ขออภัยครับ ขณะนี้ไม่สามารถเข้าถึงระบบค้นหาเอกสารได้ กรุณาลองใหม่อีกครั้งในภายหลัง';
                controller.enqueue(friendlyMessage);
                assistantText = friendlyMessage;
              } else {
                controller.enqueue(chunk);
              }
            }
          }
          
          // ===============================================
          // Step 12: บันทึกคำตอบของ AI ลงฐานข้อมูล (เฉพาะเมื่อไม่มี search error และเชื่อมต่อได้)
          // ===============================================
          if (assistantText && !hasSearchError && canSaveToDatabase) {
            try {
              await messageHistory.addMessage(new AIMessage(assistantText))
              
              // ===============================================
              // Step 13: อัปเดต Summary ถาวรในฐานข้อมูล
              // ===============================================
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
          } else if (hasSearchError || !canSaveToDatabase) {
            console.warn('🚫 ข้ามการบันทึกประวัติเนื่องจากมีปัญหาการเชื่อมต่อฐานข้อมูล')
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