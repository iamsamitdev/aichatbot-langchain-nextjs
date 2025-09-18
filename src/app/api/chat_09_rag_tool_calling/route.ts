/**
 * ===============================================
 * API Route สำหรับ Chat (RAG + Agent with Tools Calling)
 * ===============================================
 *
 * ฟีเจอร์หลัก:
 * - 📚 RAG (Retrieval-Augmented Generation) with pgvector
 * - 🤖 Agent with Tool Calling (Supabase + Vector Search)
 * - 🗂️ เก็บประวัติการสนทนาใน PostgreSQL
 * - 🧠 ทำ Summary เพื่อประหยัด Token
 * - ✂️ Trim Messages เพื่อไม่ให้เกิน Token Limit
 * - 🌊 Streaming Response สำหรับ Real-time Chat
 * - 🔧 จัดการ Session ID อัตโนมัติ
 * 
 * Tools ที่มีให้ใช้งาน:
 * 1. search_documents - ค้นหาข้อมูลจากเอกสาร (PDF, CSV, TXT) ด้วย Vector Similarity
 * 2. get_product_info - ค้นหาข้อมูลสินค้าจากฐานข้อมูล
 * 3. get_sales_data - ดูประวัติการขาย
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
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { DynamicStructuredTool } from '@langchain/core/tools'
import { AgentExecutor, createOpenAIToolsAgent } from 'langchain/agents'

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

// เพิ่ม datetime tool หลังจาก getSalesDataTool
const getCurrentDateTimeTool = new DynamicStructuredTool({
  name: "get_current_datetime",
  description: "ดูวันที่และเวลาปัจจุบัน สามารถระบุรูปแบบการแสดงผลได้",
  schema: z.object({
    format: z.enum(["full", "date", "time", "iso"]).optional().describe("รูปแบบการแสดงผล: full=เต็ม, date=วันที่อย่างเดียว, time=เวลาอย่างเดียว, iso=รูปแบบ ISO")
  }),
  func: async ({ format = "full" }) => {
    console.log(`🔧 TOOL CALLED: get_current_datetime with format="${format}"`);
    try {
      const now = new Date()
      const thailandTime = new Intl.DateTimeFormat('th-TH', {
        timeZone: 'Asia/Bangkok',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        weekday: 'long'
      })

      switch (format) {
        case "date":
          return `วันที่ปัจจุบัน: ${thailandTime.format(now).split(' ').slice(0, 4).join(' ')}`
        case "time":
          const timeOnly = thailandTime.format(now).split(' ').slice(-1)[0]
          return `เวลาปัจจุบัน: ${timeOnly} น.`
        case "iso":
          return `วันที่และเวลาในรูปแบบ ISO: ${now.toISOString()}`
        case "full":
        default:
          return `วันที่และเวลาปัจจุบัน: ${thailandTime.format(now)} (เขตเวลาประเทศไทย)`
      }
    } catch (error) {
      console.error('Error getting datetime:', error)
      return `เกิดข้อผิดพลาดในการดึงข้อมูลวันที่และเวลา: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
})

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
// ✨ NEW: สร้าง Tools สำหรับคุยกับ Supabase และ Vector Search
// ===============================================

// สร้าง Tool สำหรับค้นหาเอกสารจาก Vector Store
const searchDocumentsTool = new DynamicStructuredTool({
    name: "search_documents",
    description: "ค้นหาข้อมูลจากเอกสารที่เก็บไว้ในระบบ เช่น ข้อมูลร้าน, สินค้า, การขาย, หรือข้อมูลอื่นๆ ที่อัปโหลดไว้ในรูปแบบ PDF, CSV, TXT",
    schema: z.object({
      query: z.string().describe("คำค้นหาสำหรับค้นหาข้อมูลในเอกสาร เช่น 'ข้อมูลร้าน', 'สินค้า', 'ราคา', 'การขาย' เป็นต้น"),
      limit: z.number().optional().default(200).describe("จำนวนผลลัพธ์ที่ต้องการ (ค่าเริ่มต้น 200)")
    }),
    func: async ({ query, limit = 200 }) => {
      console.log(`🔧 TOOL CALLED: search_documents with query="${query}", limit=${limit}`);
      try {
        // สร้าง vector store
        const vectorStore = await createVectorStore();
        
        // ค้นหาเอกสารที่เกี่ยวข้อง
        const results = await vectorStore.similaritySearchWithScore(query, limit);
        
        if (!results || results.length === 0) {
          return `ไม่พบเอกสารที่เกี่ยวข้องกับ "${query}" ในระบบ`;
        }
        
        console.log(`✅ พบเอกสารที่เกี่ยวข้อง: ${results.length} รายการ`);
        
        // จัดรูปแบบผลลัพธ์
        if (results.length === 1) {
          const [doc, score] = results[0];
          const filename = doc.metadata?.filename || 'ไม่ทราบชื่อไฟล์';
          const type = doc.metadata?.type || 'ไม่ทราบประเภท';
          
          return `พบข้อมูลที่เกี่ยวข้องกับ "${query}":

**ไฟล์:** ${filename} (${type.toUpperCase()})
**เนื้อหา:** ${doc.pageContent}
**ความเกี่ยวข้อง:** ${(score * 100).toFixed(1)}%`;
        } else {
          // หลายผลลัพธ์ - แสดงเป็นรายการ
          const resultList = results.map(([doc, score], index) => {
            const filename = doc.metadata?.filename || 'ไม่ทราบชื่อไฟล์';
            const type = doc.metadata?.type || 'ไม่ทราบประเภท';
            const preview = doc.pageContent.length > 200 ? 
              doc.pageContent.substring(0, 200) + '...' : 
              doc.pageContent;
            
            return `**${index + 1}. ${filename}** (${type.toUpperCase()}) - ความเกี่ยวข้อง: ${(score * 100).toFixed(1)}%
${preview}`;
          }).join('\n\n');
          
          return `พบข้อมูลที่เกี่ยวข้องกับ "${query}" จำนวน ${results.length} รายการ:

${resultList}`;
        }
      } catch (e: unknown) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        console.log('❌ Tool error:', errorMessage);
        
        if (errorMessage.includes('connection') || 
            errorMessage.includes('network') || 
            errorMessage.includes('timeout')) {
          return `ขออภัยครับ ไม่สามารถเข้าถึงระบบค้นหาเอกสารได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง`;
        }
        
        return `เกิดข้อผิดพลาดในการค้นหาเอกสาร: ${errorMessage}`;
      }
    },
})

// สร้าง Tool สำหรับค้นหาข้อมูลสินค้า (เดิม)
const getProductInfoTool = new DynamicStructuredTool({
    name: "get_product_info",
    description: "ค้นหาข้อมูลสินค้าจากฐานข้อมูล รวมถึงราคาและจำนวนคงคลัง (stock) โดยรับชื่อสินค้าเป็น input",
    schema: z.object({
      productName: z.string().describe("ชื่อของสินค้าที่ต้องการค้นหา เช่น 'MacBook Pro M3', 'iPhone', 'iPad' เป็นต้น"),
    }),
    func: async ({ productName }) => {
      console.log(`🔧 TOOL CALLED: get_product_info with productName="${productName}"`);
      try {
        // ตรวจสอบการเชื่อมต่อฐานข้อมูล
        const { data, error } = await supabase
          .from("products")
          .select("name, price, stock, description")
          .ilike("name", `%${productName}%`)
          .limit(5); // จำกัดผลลัพธ์ไม่เกิน 5 รายการ
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

const tools = [searchDocumentsTool, getProductInfoTool, getSalesDataTool,getCurrentDateTimeTool];

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
      
      คุณมี tools ที่สามารถใช้ได้ ได้แก่:
      1. **search_documents** - สำหรับค้นหาข้อมูลจากเอกสารที่อัปโหลดไว้ในระบบ (PDF, CSV, TXT)
      2. **get_product_info** - สำหรับค้นหาข้อมูลสินค้า ราคา และจำนวนในสต็อกจากฐานข้อมูล
      3. **get_sales_data** - สำหรับดูประวัติการขาย
      4. **get_current_datetime** - สำหรับดูวันที่และเวลาปัจจุบัน
      
      **กฎการใช้ tools:**
      
      **สำหรับคำถามเกี่ยวกับข้อมูลทั่วไป เช่น:**
      - ข้อมูลร้าน (ที่อยู่, เบอร์โทร, เวลาเปิด-ปิด)
      - ข้อมูลบริษัท
      - นโยบาย การบริการ
      - ข้อมูลที่อัปโหลดไว้ในรูปแบบเอกสาร
      **→ ใช้ search_documents**
      
      **สำหรับคำถามเกี่ยวกับสินค้าเฉพาะ เช่น:**
      - "Gaming Mouse ราคาเท่าไหร่?"
      - "iPhone มีในสต็อกไหม?"
      - สินค้าที่ระบุชื่อชัดเจน
      **→ ใช้ get_product_info**
      
      **สำหรับคำถามเกี่ยวกับการขาย เช่น:**
      - "Gaming Mouse ขายไปแล้วกี่ชิ้น?"
      - ประวัติการขาย
      **→ ใช้ get_sales_data**
      
      **หลักการตอบคำถาม:**
      - หากไม่แน่ใจว่าควรใช้ tool ไหน ให้ลองใช้ search_documents ก่อน
      - ถ้าผู้ใช้ถามแบบทั่วๆ เช่น "บอกข้อมูลร้าน" ให้ใช้ search_documents
      - ถ้าผู้ใช้ถามสินค้าเฉพาะ ให้ใช้ get_product_info
      - ห้ามเดาหรือสร้างข้อมูลขึ้นมาเอง ให้ใช้ข้อมูลจาก tools เท่านั้น
      
      สำหรับการค้นหาสินค้า:
      - หากผู้ใช้ใช้คำที่อาจมีความหมายคล้าย ให้ลองค้นหาด้วยคำที่เกี่ยวข้อง
      - เช่น "เมาส์" ลองค้นหาด้วย "mouse", "gaming mouse", "เมาส์เกม"
      - เช่น "แมคบุ๊ค" ลองค้นหาด้วย "MacBook", "Mac"
      - เช่น "กาแฟ" ลองค้นหาด้วย "coffee", "espresso"

      สำหรับวันที่และเวลา:
      - เมื่อผู้ใช้ถามเกี่ยวกับเวลา วันที่ ให้ใช้ tool get_current_datetime
      - สามารถระบุ format ได้: full, date, time, iso
      - ตัวอย่างคำถาม: "วันนี้วันที่เท่าไหร่", "ตอนนี้กี่โมงแล้ว", "เวลาปัจจุบัน"
      
      หากเกิด DATABASE_CONNECTION_ERROR ให้ตอบว่า "ขออภัยครับ ขณะนี้ไม่สามารถเข้าถึงฐานข้อมูลได้ กรุณาลองใหม่อีกครั้งในภายหลัง"
      
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