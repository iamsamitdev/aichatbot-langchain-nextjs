/**
 * ===============================================
 * API Route สำหรับ Chat (Agent with Tools Version)
 * ===============================================
 *
 * ฟีเจอร์หลัก:
 * - Agent with Tool Calling (Supabase)
 * - เก็บประวัติการสนทนาใน PostgreSQL
 * - ทำ Summary เพื่อประหยัด Token
 * - Trim Messages เพื่อไม่ให้เกิน Token Limit
 * - Streaming Response สำหรับ Real-time Chat
 * - จัดการ Session ID อัตโนมัติ
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

// ✨ NEW: Imports for Agent and Tools
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { DynamicStructuredTool } from '@langchain/core/tools'
import { AgentExecutor, createOpenAIToolsAgent } from 'langchain/agents'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

// ===============================================
// ใช้ centralized database utility
// ===============================================
const pool = getDatabase()

// ✨ NEW: Supabase Client (สำหรับ Tools)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY!
)

// ===============================================
// ✨ NEW: สร้าง Tools สำหรับคุยกับ Supabase
// ===============================================

// สร้าง Tool สำหรับค้นหาข้อมูลสินค้า
const getProductInfoTool = new DynamicStructuredTool({
    name: "get_product_info",
    description: "ค้นหาข้อมูลสินค้าจากฐานข้อมูล รวมถึงราคาและจำนวนคงคลัง (stock) โดยรับชื่อสินค้าเป็น input",
    schema: z.object({
      productName: z.string().describe("ชื่อของสินค้าที่ต้องการค้นหา เช่น 'Running Shoes', 'Earbuds', 'Keyboard' เป็นต้น"),
    }),
    func: async ({ productName }) => {
      console.log(`🔧 TOOL CALLED: get_product_info with productName="${productName}"`);
      try {
        // ตรวจสอบการเชื่อมต่อฐานข้อมูล
        const { data, error } = await supabase
          .from("products")
          .select("name, price, stock, description")
          .ilike("name", `%${productName}%`)
          .limit(10); // จำกัดผลลัพธ์ไม่เกิน 10 รายการ
          // .single(); // .single() จะคืนค่า object เดียว หรือ error ถ้าเจอหลายรายการ/ไม่เจอ
        
        if (error) {
          console.log('❌ Supabase error:', error.message);
          // ตรวจสอบว่าเป็น connection error หรือไม่
          if (error.message.includes('connection') || error.message.includes('network') || error.message.includes('timeout')) {
            throw new Error('DATABASE_CONNECTION_ERROR');
          }
          throw new Error(error.message);
        }
        
        if (!data || data.length === 0) {
          console.log(`❌ ไม่พบสินค้าที่ชื่อ '${productName}'`);
          return `ไม่พบสินค้าที่ชื่อ '${productName}' ในฐานข้อมูล`;
        }
        
        console.log('✅ พบข้อมูลสินค้า:', data);
        
        // หากพบหลายสินค้า ให้แสดงรายการทั้งหมด
        if (data.length === 1) {
          const product = data[0];
          return `ข้อมูลสินค้า "${product.name}":
- ราคา: ${product.price} บาท
- จำนวนในสต็อก: ${product.stock} ชิ้น
- รายละเอียด: ${product.description}`;
        } else {
          // แสดงรายการสินค้าทั้งหมดที่พบในรูปแบบตาราง Markdown
          const tableHeader = `| ชื่อสินค้า | ราคา (บาท) | สต็อก (ชิ้น) | รายละเอียด |
|----------|------------|-------------|------------|`;
          
          const tableRows = data.map(product => 
            `| ${product.name} | ${product.price.toLocaleString()} | ${product.stock} | ${product.description} |`
          ).join('\n');
          
          return `พบสินค้าที่ตรงกับคำค้นหา "${productName}" ทั้งหมด ${data.length} รายการ:

${tableHeader}
${tableRows}`;
        }
      } catch (e: unknown) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        console.log('❌ Tool error:', errorMessage);
        
        // ตรวจสอบว่าเป็น database connection error หรือไม่
        if (errorMessage === 'DATABASE_CONNECTION_ERROR' || 
            errorMessage.includes('connection') || 
            errorMessage.includes('network') || 
            errorMessage.includes('timeout')) {
          throw new Error('DATABASE_CONNECTION_ERROR');
        }
        
        return `เกิดข้อผิดพลาดในการดึงข้อมูลสินค้า: ${errorMessage}`;
      }
    },
})

// สร้าง Tool สำหรับดูข้อมูลการขาย
const getSalesDataTool = new DynamicStructuredTool({
    name: "get_sales_data",
    description: "ใช้ tool นี้เพื่อดูประวัติการขายของสินค้า. รับ input เป็นชื่อสินค้า.",
    schema: z.object({
      productName: z.string().describe("ชื่อของสินค้าที่ต้องการดูข้อมูลการขาย"),
    }),
    func: async ({ productName }) => {
      console.log(`TOOL CALLED: get_sales_data with productName=${productName}`);
      try {
        // ขั้นตอนที่ 1: ค้นหา product_id จากชื่อสินค้า
        const { data: product, error: productError } = await supabase
          .from("products").select("id").ilike("name", `%${productName}%`).single();
        if (productError) {
          // ตรวจสอบว่าเป็น connection error หรือไม่
          if (productError.message.includes('connection') || productError.message.includes('network') || productError.message.includes('timeout')) {
            throw new Error('DATABASE_CONNECTION_ERROR');
          }
          throw new Error(productError.message);
        }
        if (!product) return `ไม่พบสินค้าที่ชื่อ '${productName}'`;
        
        // ขั้นตอนที่ 2: ดึงข้อมูลการขายจาก sales table โดยใช้ product_id
        const { data: sales, error: salesError } = await supabase
          .from("sales").select("sale_date, quantity_sold, total_price").eq("product_id", product.id);
        if (salesError) {
          // ตรวจสอบว่าเป็น connection error หรือไม่
          if (salesError.message.includes('connection') || salesError.message.includes('network') || salesError.message.includes('timeout')) {
            throw new Error('DATABASE_CONNECTION_ERROR');
          }
          throw new Error(salesError.message);
        }
        if (!sales || sales.length === 0) return `ยังไม่มีข้อมูลการขายสำหรับสินค้า '${productName}'`;
        
        // หากมีรายการเดียว แสดงแบบง่าย
        if (sales.length === 1) {
          const sale = sales[0];
          return `ประวัติการขายของสินค้า "${productName}":
                  - วันที่ขาย: ${new Date(sale.sale_date).toLocaleDateString('th-TH')}
                  - จำนวนที่ขาย: ${sale.quantity_sold} ชิ้น
                  - ยอดขาย: ${sale.total_price.toLocaleString()} บาท`;
        } else {
          // หากมีหลายรายการ แสดงเป็นตาราง Markdown
          const tableHeader = `| วันที่ขาย | จำนวนที่ขาย (ชิ้น) | ยอดขาย (บาท) |
|-----------|-------------------|---------------|`;
          
          const tableRows = sales.map(sale => 
            `| ${new Date(sale.sale_date).toLocaleDateString('th-TH')} | ${sale.quantity_sold} | ${sale.total_price.toLocaleString()} |`
          ).join('\n');
          
          const totalQuantity = sales.reduce((sum, sale) => sum + sale.quantity_sold, 0);
          const totalSales = sales.reduce((sum, sale) => sum + parseFloat(sale.total_price), 0);
          
          return `ประวัติการขายของสินค้า "${productName}" ทั้งหมด ${sales.length} รายการ:

${tableHeader}
${tableRows}

**สรุป:**
- ขายรวม: ${totalQuantity} ชิ้น
- ยอดขายรวม: ${totalSales.toLocaleString()} บาท`;
        }
      } catch (e: unknown) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        
        // ตรวจสอบว่าเป็น database connection error หรือไม่
        if (errorMessage === 'DATABASE_CONNECTION_ERROR' || 
            errorMessage.includes('connection') || 
            errorMessage.includes('network') || 
            errorMessage.includes('timeout')) {
          throw new Error('DATABASE_CONNECTION_ERROR');
        }
        
        return `เกิดข้อผิดพลาดในการดึงข้อมูลการขาย: ${errorMessage}`;
      }
    },
})

const tools = [getProductInfoTool, getSalesDataTool];

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
      model: process.env.OPENAI_API_MODEL ?? 'gpt-4o-mini',
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
    // 🔄 MODIFIED Step 8: สร้าง Agent แทน Chain เดิม
    // ===============================================
    const agentPrompt = ChatPromptTemplate.fromMessages([
      ['system', `คุณคือผู้ช่วย AI อัจฉริยะที่ตอบเป็นภาษาไทย 
      
      คุณมี tools ที่สามารถใช้ค้นหาข้อมูลสินค้าและการขายได้ ได้แก่:
      1. get_product_info - สำหรับค้นหาข้อมูลสินค้า ราคา และจำนวนในสต็อก
      2. get_sales_data - สำหรับดูประวัติการขาย
      
      เมื่อผู้ใช้ถามเกี่ยวกับสินค้าใดๆ ให้ใช้ tool get_product_info เพื่อค้นหาข้อมูลจากฐานข้อมูลก่อนตอบ
      ห้ามเดาหรือสร้างข้อมูลขึ้นมาเอง ให้ใช้ข้อมูลจาก tool เท่านั้น
      
      สำหรับการค้นหาสินค้า:
      - หากผู้ใช้ใช้คำที่อาจมีความหมายคล้าย ให้ลองค้นหาด้วยคำที่เกี่ยวข้อง
      - เช่น "เมาส์" ลองค้นหาด้วย "mouse", "gaming mouse", "เมาส์เกม"
      - เช่น "แมคบุ๊ค" ลองค้นหาด้วย "MacBook", "Mac"
      - เช่น "กาแฟ" ลองค้นหาด้วย "coffee", "espresso"
      
      หากเกิด DATABASE_CONNECTION_ERROR ให้ตอบว่า "ขออภัยครับ ขณะนี้ไม่สามารถเข้าถึงฐานข้อมูลได้ กรุณาลองใหม่อีกครั้งในภายหลัง"
      หากมีสินค้าหลายรายการที่ตรงกับคำค้น ให้แสดงรายการทั้งหมดในรูปแบบตาราง Markdown
      หากไม่มีข้อมูลสินค้า ให้ตอบว่า "ไม่พบสินค้าที่ชื่อ 'xxx' ในฐานข้อมูล"
      
      บริบทการสนทนาก่อนหน้านี้โดยสรุปคือ: {summary}`],
      new MessagesPlaceholder('chat_history'), // ประวัติการสนทนาก่อนหน้านี้
      ['human', '{input}'],
      new MessagesPlaceholder('agent_scratchpad'), // พื้นที่ให้ Agent จดบันทึกการใช้ tool
    ])

    // สร้าง Agent โดยใช้ Tools ที่เตรียมไว้
    const agent = await createOpenAIToolsAgent({
      llm: model,
      tools,
      prompt: agentPrompt,
    })

    const agentExecutor = new AgentExecutor({
      agent,
      tools,
      verbose: false, // true เปิด verbose mode เพื่อดู debug logs
      maxIterations: 5, // จำกัดจำนวนรอบการทำงาน
      returnIntermediateSteps: false, // ไม่ต้องแสดงขั้นตอนกลาง
    })

    // ===============================================
    // 🔄 MODIFIED Step 9: สร้าง Stream จาก Agent
    // ===============================================
    // รวม summary เข้าไปเป็น system message เพื่อให้ agent รับรู้บริบท
    const chatHistoryForAgent = [...recentWindowWithoutCurrentInput];
    if (summaryForThisTurn) {
        // หากมี summary ให้ใส่ไว้เป็นข้อความแรกสุดเพื่อให้ agent เห็นเป็นบริบทสำคัญ
        chatHistoryForAgent.unshift(new SystemMessage(summaryForThisTurn));
    }

    // สร้าง Stream จาก Agent
    const stream = await agentExecutor.stream({
        input: input,
        chat_history: chatHistoryForAgent,
        summary: summaryForThisTurn // เพิ่ม summary เข้าไปใน prompt
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
    // 🔄 MODIFIED Step 11: จัดการ Stream จาก Agent และบันทึกผลลัพธ์
    // ===============================================
    let assistantText = ''
    let hasDatabaseError = false // ตัวแปรเช็คว่ามี database error หรือไม่
    
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            // Agent stream จะส่ง object ที่มี key ต่างๆ ออกมา
            // เราสนใจเฉพาะ key 'output' ซึ่งเป็นคำตอบสุดท้าย
            if (chunk.output) {
              assistantText += chunk.output;
              
              // ตรวจสอบว่ามี database connection error หรือไม่
              if (chunk.output.includes('ไม่สามารถเข้าถึงฐานข้อมูลได้') || 
                  assistantText.includes('DATABASE_CONNECTION_ERROR')) {
                hasDatabaseError = true;
                // แทนที่ error message ด้วยข้อความที่เป็นมิตร
                const friendlyMessage = 'ขออภัยครับ ขณะนี้ไม่สามารถเข้าถึงฐานข้อมูลได้ กรุณาลองใหม่อีกครั้งในภายหลัง';
                controller.enqueue(friendlyMessage);
                assistantText = friendlyMessage;
              } else {
                controller.enqueue(chunk.output);
              }
            }
          }
          
          // ===============================================
          // Step 12: บันทึกคำตอบของ AI ลงฐานข้อมูล (เฉพาะเมื่อไม่มี database error และเชื่อมต่อได้)
          // ===============================================
          if (assistantText && !hasDatabaseError && canSaveToDatabase) {
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
          } else if (hasDatabaseError || !canSaveToDatabase) {
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