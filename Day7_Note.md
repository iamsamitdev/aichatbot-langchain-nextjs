## AI Chatbot with LangChain & Next.js - Day 7

### Login Form Fix
แก้ไขไฟล์ `src/components/login-form.tsx` แก้ไข tabindex ให้ถูกต้อง และ Auto Fill

> แก้ไข tabindex ให้เรียงลำดับถูกต้อง (1, 2, 3) และเพิ่มคุณสมบัติ autoComplete เพื่อช่วยให้เบราว์เซอร์สามารถเติมข้อมูลอัตโนมัติได้
```typescript {.line-numbers}
<input
  type="text"
  name="email"
  id="email"
  autoComplete="email" // เพิ่ม autoComplete
  tabIndex={1}         // แก้ไข tabindex
  ...
/>
<input
  type="password"
  name="password"
  id="password"
  autoComplete="current-password" // เพิ่ม autoComplete
  tabIndex={2}                    // แก้ไข tabindex
  ...
/>
<button
  type="submit"
  tabIndex={3} // แก้ไข tabindex
  ...
>Login</button>
```

```typescript {.line-numbers}
// เพิ่มการจัดการ autoComplete ใน handleSubmit
const handleFillDemo = () => {
  setEmail('samit@email.com')
  setPassword('123456')
}
...
<CardHeader>
  <CardTitle className="text-2xl">Login</CardTitle>
  <CardDescription>Enter your email below to login to your account</CardDescription>
  <div className="mt-2 px-4 bg-yellow-300 p-2 rounded-lg">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-gray-800">Email: samit@email.com</p>
        <p className="text-sm text-gray-800">Password: 123456</p>
      </div>
      <Button 
        type="button" 
        variant="outline" 
        size="sm"
        onClick={handleFillDemo}
        className="ml-2 bg-white hover:bg-gray-50"
      >
        Auto Fill
      </Button>
    </div>
  </div>
</CardHeader>
```

### Chat History Optimistic fix

#### 1. ลบ library สำหรับ uuid ออก
```bash {.line-numbers}
npm uninstall uuid @types/uuid
```
> เดิมทีเราใช้ uuidv4 เพื่อสร้าง ID ชั่วคราว (Temporary ID) บนฝั่งเซิร์ฟเวอร์สำหรับ Session ที่เพิ่งสร้างใหม่ แต่แนวทางนั้นมีปัญหาเรื่องข้อมูลไม่ตรงกัน (ID Desync) ตามที่เราได้แก้ไขไป ในโค้ดเวอร์ชันล่าสุด เราได้เปลี่ยนไปใช้วิธีให้ ฐานข้อมูล (PostgreSQL) เป็นผู้สร้าง ID จริง (Permanent ID) ขึ้นมาทันที ผ่านฟังก์ชัน createNewSession ด้วยคำสั่ง INSERT ... RETURNING id

#### 2. สร้างไฟล์ database.ts
สร้างไฟล์ `src/lib/database.ts`
> ไฟล์นี้เป็น utility สำหรับจัดการ PostgreSQL connection pool แบบ centralized โดยใช้ Singleton pattern เพื่อให้แน่ใจว่าแอปพลิเคชันมี connection pool เดียวที่ใช้ร่วมกัน

```typescript {.line-numbers}
/**
 * ===============================================
 * Database Connection Pool Utility
 * ===============================================
 * 
 * Purpose: จัดการ PostgreSQL connection pool แบบ centralized
 * 
 * Features:
 * - Singleton pattern สำหรับ connection pool
 * - Configuration management
 * - Error handling และ logging
 * - Type safety
 * 
 * Benefits:
 * - ลดการสร้าง connection pool ซ้ำๆ
 * - จัดการ configuration ในที่เดียว
 * - ง่ายต่อการ maintain และ debug
 * - รองรับ connection pooling อย่างมีประสิทธิภาพ
 */

import { Pool, PoolConfig } from 'pg'

// ===============================================
// Database Configuration Interface
// ===============================================

/**
 * Interface สำหรับ database configuration
 * ใช้สำหรับ type checking และ documentation
 */
interface DatabaseConfig {
  host: string
  port: number
  user: string
  password: string
  database: string
  ssl: boolean | { rejectUnauthorized: boolean }
}

// ===============================================
// Configuration Setup
// ===============================================
function getDatabaseConfig(): DatabaseConfig {
  // ตรวจสอบ required environment variables
  const requiredEnvVars = ['PG_HOST', 'PG_PORT', 'PG_USER', 'PG_PASSWORD', 'PG_DATABASE']
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName])
  
  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`)
  }

  return {
    host: process.env.PG_HOST!,
    port: Number(process.env.PG_PORT!),
    user: process.env.PG_USER!,
    password: process.env.PG_PASSWORD!,
    database: process.env.PG_DATABASE!,
    ssl: process.env.NODE_ENV === 'production' 
      ? { rejectUnauthorized: false } 
      : false,
  }
}

// ===============================================
// Database Pool Singleton
// ===============================================
let globalPool: Pool | null = null

export function getDatabase(): Pool {
  // หาก pool ยังไม่ถูกสร้าง ให้สร้างใหม่
  if (!globalPool) {
    try {
      const config = getDatabaseConfig()
      
      // สร้าง pool configuration
      const poolConfig: PoolConfig = {
        ...config,
        // Pool-specific configurations
        max: 20,                      // จำนวน connection สูงสุด
        idleTimeoutMillis: 30000,     // timeout สำหรับ idle connections
        connectionTimeoutMillis: 2000, // timeout สำหรับการเชื่อมต่อ
      }
      
      globalPool = new Pool(poolConfig)
      
    // ตั้งค่า event listeners สำหรับ monitoring
    //   globalPool.on('connect', () => {
    //     console.log('🐘 PostgreSQL: New client connected')
    //   })
      
      globalPool.on('error', (err) => {
        console.error('🚨 PostgreSQL: Unexpected error on idle client', err)
      })
      
    //   console.log('✅ PostgreSQL: Connection pool initialized successfully')
      
    } catch (error) {
      console.error('❌ PostgreSQL: Failed to initialize connection pool:', error)
      throw new Error(`Database connection pool initialization failed: ${error}`)
    }
  }
  
  return globalPool
}

// ===============================================
// Connection Testing Utility
// ===============================================
export async function testDatabaseConnection(): Promise<boolean> {
  try {
    const pool = getDatabase()
    const client = await pool.connect()
    
    try {
      // ทดสอบด้วย simple query
      await client.query('SELECT 1')
      console.log('✅ PostgreSQL: Connection test successful')
      return true
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('❌ PostgreSQL: Connection test failed:', error)
    return false
  }
}

// ===============================================
// Cleanup Utilities
// ===============================================
export async function closeDatabasePool(): Promise<void> {
  if (globalPool) {
    try {
      await globalPool.end()
      globalPool = null
      console.log('🔒 PostgreSQL: Connection pool closed successfully')
    } catch (error) {
      console.error('❌ PostgreSQL: Error closing connection pool:', error)
      throw error
    }
  }
}

// ===============================================
// Health Check Function
// ===============================================
export async function getDatabaseHealth() {
  try {
    const pool = getDatabase()
    const client = await pool.connect()
    
    try {
      const startTime = Date.now()
      await client.query('SELECT version()')
      const responseTime = Date.now() - startTime
      
      return {
        status: 'healthy',
        responseTime: `${responseTime}ms`,
        totalConnections: pool.totalCount,
        idleConnections: pool.idleCount,
        waitingConnections: pool.waitingCount,
        timestamp: new Date().toISOString()
      }
    } finally {
      client.release()
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }
  }
}

// ===============================================
// Export Default Database Instance
// ===============================================
export default getDatabase
```

#### 3. แก้ไขไฟล์ route.ts เหล่านี้ เพื่อใช้ database.ts แทนการสร้าง pool ใหม่
- `src/app/api/chat_05_history/route.ts`
- `src/app/api/chat_05_history/session/route.ts`
- `src/app/api/chat_06_history_optimize/route.ts`
- `src/app/api/chat_06_history_optimize/session/route.ts`
- `src/app/api/chat_06_history_optimistic/route.ts`
- `src/app/api/chat_06_history_optimistic/session/route.ts`
โดยแก้ไขส่วนที่เกี่ยวข้องกับการสร้างและใช้ connection pool ดังนี้

```typescript {.line-numbers}
import { getDatabase } from '@/lib/database'
```

```typescript {.line-numbers}
// const pool = new Pool({ ... })  // ลบโค้ดนี้ออก
const pool = getDatabase()
```

```typescript {.line-numbers}
const client = await getDatabase().connect()  // แก้ไขตรงนี้
// const client = await pool.connect()         // ลบโค้ดนี้ออก
```

#### 4. แก้ไขไฟล์ page.tsx เพื่อใช้ database.ts แทนการสร้าง pool ใหม่
- `src/app/chat/[id]/page.tsx`
โดยแก้ไขส่วนที่เกี่ยวข้องกับการสร้างและใช้ connection pool ดังนี้

```typescript {.line-numbers}
import { getDatabase } from '@/lib/database'
```

```typescript {.line-numbers}
// const pool = new Pool({ ... })  // ลบโค้ดนี้ออก
```

```typescript {.line-numbers}
const client = await getDatabase().connect()  // แก้ไขตรงนี้
// const client = await pool.connect()         // ลบโค้ดนี้ออก
```

#### 5. สร้างไฟล์ api.ts
- สร้างไฟล์ `src/constants/api.ts`
> ไฟล์นี้เป็นการจัดการ API endpoint URLs และฟังก์ชันช่วยเหลือสำหรับการสร้าง URL พร้อม query parameters

```typescript {.line-numbers}
export const API_BASE = '/api/chat_06_history_optimistic'

export const API_BASE_SESSION = '/api/chat_06_history_optimistic/session'

export function buildApiUrl(endpoint: string, params?: Record<string, string | number | boolean>): string {
  if (!params || Object.keys(params).length === 0) {
    return endpoint
  }
  
  const searchParams = new URLSearchParams()
  
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.append(key, String(value))
    }
  })
  
  const queryString = searchParams.toString()
  return queryString ? `${endpoint}?${queryString}` : endpoint
}
```

#### 6. แก้ไขไฟล์ use-chat-session.ts
- `src/hooks/use-chat-session.ts`
โดยแก้ไขส่วนที่เกี่ยวข้องกับการเรียก API endpoint ดังนี้

```typescript {.line-numbers}
import { API_BASE, API_BASE_SESSION, buildApiUrl } from '@/constants/api'

const apiUrl = buildApiUrl(API_BASE_SESSION, { userId })
const response = await fetch(apiUrl)
```

#### 7. แก้ไขไฟล์ use-chat-history.ts
- `src/hooks/use-chat-history.ts`
โดยแก้ไขส่วนที่เกี่ยวข้องกับการเรียก API endpoint ดังนี้

```typescript {.line-numbers}
import { API_BASE } from '@/constants/api'

const response = await fetch(API_BASE, { method: 'POST', ... })
```

```typescript {.line-numbers}
const apiUrl = `${API_BASE}?sessionId=${sessionId}`
const response = await fetch(apiUrl)
```

#### 8. แก้ไขไฟล์ new-chat.tsx
- `src/components/new-chat.tsx`
โดยแก้ไขส่วนที่เกี่ยวข้องกับการเรียก API endpoint ดังนี้

```typescript {.line-numbers}
import { API_BASE, buildApiUrl } from "@/constants/api" 

const apiUrl = buildApiUrl(API_BASE, { sessionId: sessionIdToLoad })
const response = await fetch(apiUrl)

const apiUrl = buildApiUrl(API_BASE, { sessionId: sessionIdToLoad })
const response = await fetch(apiUrl)
```

<br />
*** Note: แยก branch ใหม่สำหรับ tool calling ใน LangChain ต่อจาก branch นี้ ***

#### สร้าง Branch ใหม่
```bash
git add .
git commit -m "Finish chat history optimistic fix"
git checkout -b 07-tool-calling
```

### Tool calling ใน LangChain
#### แนวคิดหลัก (Key concepts)
- **Tool**: ฟังก์ชันหรือ API ที่สามารถเรียกใช้ได้จาก LangChain
- **Tool calling**: วิธีการที่ LangChain ใช้ในการเรียกใช้งาน Tool เหล่านี้
- **Agent**: ตัวแทนที่สามารถตัดสินใจได้ว่าจะเรียก Tool ใดเมื่อใด
- **Prompt**: ข้อความที่ส่งไปยัง Tool เพื่อขอข้อมูลหรือการดำเนินการ

#### ขั้นตอนการทำงาน (Workflow)
1. การสร้าง Tool (Tool Creation):
   - กำหนดฟังก์ชันหรือ API ที่ต้องการใช้เป็น Tool
   - ตัวอย่างเช่น ฟังก์ชันสำหรับค้นหาข้อมูล, การคำนวณ, หรือการเรียก API ภายนอก
2. การผูก Tool เข้ากับโมเดล (Tool Binding):
   - ใช้ LangChain เพื่อผูก Tool ที่สร้างขึ้นกับโมเดลภาษาที่ต้องการใช้
   - กำหนดวิธีการที่โมเดลจะเรียกใช้ Tool เหล่านี้
3. การเรียกใช้ Tool (Tool Calling):
   - เมื่อโมเดลได้รับคำถามหรือคำสั่ง มันจะตัดสินใจว่าจะเรียกใช้ Tool ใด
   - ส่ง Prompt ที่เหมาะสมไปยัง Tool เพื่อขอข้อมูลหรือการดำเนินการ
4. การประมวลผล Tool (Tool Execution):
   - Tool จะประมวลผลคำขอและส่งผลลัพธ์กลับไปยังโมเดล

#### ตัวอย่างการใช้งาน (Example Usage)
1. สร้าง Tool สำหรับการดึงข้อมูลสภาพอากาศ  (Tool Creation)
```typescript {.line-numbers}
import { tool } from "@langchain/core/tools"
import { z } from "zod"

// สร้าง Tool สำหรับการดึงข้อมูลสภาพอากาศ
const getWeather = tool(
  // ฟังก์ชันจริงที่จะทำงาน
  async ({ city }: { city: string }) => {
    if (city.toLowerCase().includes("bangkok")) {
      return `The weather in Bangkok is 32°C and sunny.`;
    }
    return `Sorry, I don't have weather information for ${city}.`;
  },
  // ข้อมูลสำหรับให้ AI ทำความเข้าใจ
  {
    name: "get_weather",
    description: "Get the current weather for a specific city.",
    schema: z.object({
      city: z.string().describe("The name of the city to get the weather for."),
    }),
  }
)
```
2. ผูก Tool เข้ากับโมเดล  (Tool Binding)
```typescript {.line-numbers}
import { ChatOpenAI } from "@langchain/openai"

// 1. สร้าง Instance ของโมเดล
const model = new ChatOpenAI({
  model: process.env.OPENAI_MODEL || "gpt-4o-mini",
  temperature: 0,
});

// 2. ผูก Tool เข้ากับโมเดล
const modelWithTools = model.bind({
  tools: [getWeather], // สามารถใส่หลาย Tool ได้ใน Array นี้
})
```
3. เรียกใช้ Tool ผ่านโมเดล  (Tool Calling)
```typescript {.line-numbers}
// ส่งคำสั่งที่น่าจะกระตุ้นให้โมเดลใช้ Tool
const prompt = "What is the weather like in Bangkok right now?"

// เรียกใช้งานโมเดลที่ผูก Tool ไว้
const modelResponse = await modelWithTools.invoke(prompt)

console.log(modelResponse)
/*
ผลลัพธ์ที่ได้จะไม่ใช่ประโยคคำตอบ แต่เป็น AIMessage ที่มีคำสั่ง tool_calls:

AIMessage {
  content: '',
  tool_calls: [
    {
      name: 'get_weather',
      args: { city: 'Bangkok' },
      id: 'call_abc123'
    }
  ]
}
*/
```
4. ประมวลผล Tool และส่งผลลัพธ์กลับ (Tool Execution)
```typescript {.line-numbers}
// สมมติว่า modelResponse คือผลลัพธ์จากขั้นตอนที่ 3
const toolCall = modelResponse.tool_calls[0]

if (toolCall.name === "get_weather") {
  // นำ arguments ที่โมเดลให้มา ไปใช้เรียกฟังก์ชันจริง
  const observation = await getWeather.invoke(toolCall.args)

  console.log(observation);
  // ผลลัพธ์: "The weather in Bangkok is 32°C and sunny."
}
```
> โดยทั่วไปหลังจากได้ observation แล้ว เราจะส่งผลลัพธ์นี้กลับเข้าไปในโมเดลอีกครั้งเพื่อให้ AI สรุปเป็นภาษาที่สวยงามให้ผู้ใช้ เช่น "ตอนนี้ที่กรุงเทพฯ อากาศดีครับ อุณหภูมิ 32°C และแดดจ้าครับ"

#### ตัวอย่างการสร้างใน tool calling ใน next.js

#### 1. ติดตั้ง dependencies ที่จำเป็น
```bash {.line-numbers}
npm install zod@3
```

#### 2. สร้างไฟล์ route.ts
สร้างไฟล์ `src/app/api/chat_07_tool_calling_sample/route.ts`
```typescript {.line-numbers}
// /app/api/chat/route.ts

import { NextRequest } from "next/server"
import { ChatOpenAI } from "@langchain/openai"
import { ChatPromptTemplate } from "@langchain/core/prompts"
import { tool } from "@langchain/core/tools"
import { ToolMessage } from "@langchain/core/messages"
import { toUIMessageStream } from "@ai-sdk/langchain"
import {
  createUIMessageStreamResponse,
  UIMessage,
  convertToModelMessages,
} from "ai"
import { z } from "zod"

export const runtime = "edge"
export const maxDuration = 30

// ===============================================
// Step 1: การสร้าง Tool (Tool Creation)
// ===============================================
/**
 * สร้างเครื่องมือสำหรับเช็คสภาพอากาศ
 * - `name`: ชื่อที่ AI จะใช้เรียก tool นี้
 * - `description`: คำอธิบายให้ AI เข้าใจว่า tool นี้ทำอะไร
 * - `schema`: โครงสร้างข้อมูล (arguments) ที่ tool ต้องการ
 * - function: โค้ดจริงที่จะทำงานเมื่อ tool ถูกเรียก
 */
const getWeatherTool = tool(
  async ({ city }: { city: string }) => {
    // ในชีวิตจริง ส่วนนี้อาจจะ fetch API ของกรมอุตุฯ
    // แต่ในตัวอย่างนี้ เราจะจำลองข้อมูลขึ้นมา
    if (city.toLowerCase().includes("bangkok")) {
      return `The weather in Bangkok is 32°C and sunny.`
    } else if (city.toLowerCase().includes("chiang mai")) {
      return `The weather in Chiang Mai is 24°C and cloudy.`
    }
    return `Sorry, I don't have weather information for ${city}.`
  },
  {
    name: "get_weather",
    description: "Get the current weather for a specific city in Thailand.",
    schema: z.object({
      city: z
        .string()
        .describe(
          "The name of the city, should be in English (e.g., Bangkok, Chiang Mai)."
        ),
    }),
  }
)

export async function POST(req: NextRequest) {
  try {
    const { messages }: { messages: UIMessage[] } = await req.json()

    // แปลง UIMessage จาก Vercel AI SDK ให้เป็นรูปแบบที่ LangChain Core เข้าใจ
    const coreMessages = convertToModelMessages(messages)

    const prompt = ChatPromptTemplate.fromMessages([
      [
        "system",
        "You are a helpful and friendly AI assistant who speaks Thai.",
      ],
      ...coreMessages,
    ])

    const model = new ChatOpenAI({
      model: process.env.OPENAI_MODEL_NAME || "gpt-4o-mini",
      temperature: 0.7,
      maxTokens: 300,
      streaming: true,
    })

    // ===============================================
    // Step 2: การผูก Tool เข้ากับโมเดล (Tool Binding)
    // ===============================================
    const tools = [getWeatherTool]
    const modelWithTools = model.withConfig({
      tools: tools,
    })

    const chain = prompt.pipe(modelWithTools)

    // ===============================================
    // Step 3: การเรียกใช้ Tool และจัดการผลลัพธ์ (Tool Calling)
    // ===============================================
    // เราจะใช้ .invoke() แทน .stream() ก่อน เพื่อดูว่า AI จะเรียก Tool หรือไม่
    const aiResponse = await chain.invoke({})

    // ถ้า aiResponse ไม่มี tool_calls หมายความว่า AI ตอบกลับเป็นข้อความธรรมดา
    if (!aiResponse.tool_calls || aiResponse.tool_calls.length === 0) {
      // สามารถ Stream คำตอบกลับไปได้เลย
      const stream = await chain.stream({})
      return createUIMessageStreamResponse({
        stream: toUIMessageStream(stream),
      })
    }

    // ===============================================
    // Step 4: การประมวลผล Tool (Tool Execution)
    // ===============================================
    const toolObservations: ToolMessage[] = []

    for (const toolCall of aiResponse.tool_calls) {
      // หา tool ที่ตรงกับชื่อที่ AI เรียก
      const selectedTool = tools.find((t) => t.name === toolCall.name)

      if (selectedTool) {
        // สั่งให้ tool ทำงานพร้อมกับ arguments ที่ AI ส่งมา
        // Cast toolCall.args ให้เป็น type ที่ถูกต้อง
        const observation = await selectedTool.invoke(
          toolCall.args as { city: string }
        )

        // สร้าง ToolMessage เพื่อเก็บผลลัพธ์จากการรัน tool
        toolObservations.push(
          new ToolMessage({
            content:
              typeof observation === "string"
                ? observation
                : JSON.stringify(observation),
            tool_call_id: toolCall.id!,
          })
        )
      }
    }

    // -- ปิดลูป: ส่งผลลัพธ์กลับไปให้ AI สรุปเป็นคำพูด --
    // เรียก AI อีกครั้ง โดยเพิ่ม `aiResponse` (คำสั่งเรียก tool) และ `toolObservations` (ผลลัพธ์) เข้าไปในประวัติ
    const finalStream = await modelWithTools.stream([
      ...coreMessages,
      aiResponse,
      ...toolObservations,
    ])

    return createUIMessageStreamResponse({
      stream: toUIMessageStream(finalStream),
    })
  } catch (error) {
    console.error("API Error:", error)
    return new Response(JSON.stringify({ error: "An error occurred" }), {
      status: 500,
    })
  }
}
```

#### 3. ทดสอบ API ด้วย Postman หรือ curl
> ตัวอย่างที่ 1: ถามถึงกรุงเทพฯ (คาดหวังให้ Tool ทำงาน)
> Payload นี้มีข้อความที่ชัดเจนว่าต้องการทราบ "อากาศ" ของ "กรุงเทพ" ซึ่งจะกระตุ้นให้โมเดลเรียกใช้ get_weather tool พร้อมส่ง city: 'Bangkok' เป็น argument
```bash {.line-numbers}
curl -X POST http://localhost:3000/api/chat_07_tool_calling_sample \
-H "Content-Type: application/json" \
-d '{
  "messages": [
    {
      "id": "tool-test-001",
      "role": "user",
      "parts": [
        {
          "type": "text",
          "text": "กรุงเทพตอนนี้อากาศเป็นยังไงบ้าง"
        }
      ]
    }
  ]
}'
```

> ตัวอย่างที่ 2: ถามถึงเชียงใหม่ (ทดสอบ Argument อื่น)
> Payload นี้มีข้อความที่ชัดเจนว่าต้องการทราบ "อากาศ" ของ "เชียงใหม่" ซึ่งจะกระตุ้นให้โมเดลเรียกใช้ get_weather tool พร้อมส่ง city: 'Chiang Mai' เป็น argument
```bash {.line-numbers}
{
  "messages": [
    {
      "id": "tool-test-002",
      "role": "user",
      "parts": [
        {
          "type": "text",
          "text": "อยากรู้อุณหภูมิที่เชียงใหม่ครับ"
        }
      ]
    }
  ]
}
```
> ตัวอย่างที่ 3: ถามคำถามทั่วไป (คาดหวังว่า Tool จะไม่ทำงาน)
> Payload นี้เป็นคำถามทั่วไปที่ไม่เกี่ยวข้องกับสภาพอากาศ โมเดลควรจะตอบกลับเป็นข้อความธรรมดาโดยไม่เรียกใช้ Tool
```bash {.line-numbers}
{
  "messages": [
    {
      "id": "general-q-001",
      "role": "user",
      "parts": [
        {
          "type": "text",
          "text": "ช่วยแนะนำกาแฟอร่อยๆ ให้หน่อย"
        }
      ]
    }
  ]
}
```
#### 4. แก้ไขไฟล์ api.ts เพื่อเพิ่ม API endpoint ใหม่
- แก้ไขไฟล์ `src/constants/api.ts`
```typescript {.line-numbers}
export const API_BASE = '/api/chat_07_tool_calling_sample'
```

#### 5. แก้ไขไฟล์ new-chat-simple.tsx เพื่อทดสอบ Tool calling
- แก้ไขไฟล์ `src/components/new-chat-simple.tsx`
```typescript {.line-numbers}
import { API_BASE } from "@/constants/api"

// ใช้ useChat hook เพื่อจัดการสถานะการสนทนา
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: API_BASE,
    })
  })
```

#### 6. แก้ไขไฟล์ page.tsx เพื่อใช้ new-chat-simple.tsx
- แก้ไขไฟล์ `src/app/chat/page.tsx`
```typescript {.line-numbers}
import NewChatSimple from '@/components/new-chat-simple'
// import { NewChat } from '@/components/new-chat'

export default function ChatPage() {
  // return <NewChat />
  return <NewChatSimple />
}
```
#### การใช้ Tool calling กับฐานข้อมูลจริง (PostgreSQL)
#### 1. สร้างตารางในฐานข้อมูล
เข้าไปที่ Supabase Dashboard → SQL Editor และรันคำสั่งต่อไปนี้:
```sql {.line-numbers}
-- 1. สร้างตารางเก็บข้อมูลสินค้า (products)
CREATE TABLE products (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  pid TEXT UNIQUE NOT NULL,
  name TEXT,
  description TEXT,
  price NUMERIC(10, 2) NOT NULL,
  stock INTEGER,
  category TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. สร้างตารางเก็บข้อมูลการขาย (sales)
CREATE TABLE sales (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  product_id BIGINT REFERENCES products(id), -- เชื่อมความสัมพันธ์กับตาราง products
  sale_date DATE NOT NULL,
  quantity_sold INT NOT NULL,
  total_price NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. ใส่ข้อมูลสินค้าตัวอย่าง
INSERT INTO products (pid, name, description, price, stock, category, image_url) VALUES
('P001', 'Running Shoes', 'รองเท้าวิ่งน้ำหนักเบา รองรับแรงกระแทก เหมาะกับการวิ่งระยะไกล', 2590.00, 156, 'Sports', '/images/p1.png'),
('P002', 'Training Shoes', 'รองเท้าฝึกซ้อมในยิม พื้นยึดเกาะดี ระบายอากาศ', 2390.00, 89, 'Sports', '/images/p2.png'),
('P003', 'Football Boots', 'รองเท้าสตั๊ดสำหรับสนามหญ้า เกาะพื้นดี ยิงแม่นยำ', 3290.00, 34, 'Sports', '/images/p3.png'),
('P004', 'Yoga Mat', 'แผ่นโยคะกันลื่น หนา พกพาง่าย เหมาะโยคะ/พิลาทิส', 990.00, 78, 'Fitness', '/images/p4.png'),
('P005', 'Smartwatch Series A', 'นาฬิกาอัจฉริยะ ติดตามสุขภาพ นับก้าว แจ้งเตือนสาย', 4990.00, 123, 'Electronics', '/images/p5.png'),
('P006', 'Wireless Earbuds', 'หูฟังไร้สาย เสียงชัด แบตอึด กันน้ำระดับ IPX4', 2190.00, 67, 'Electronics', '/images/p6.png'),
('P007', '4K Action Camera', 'กล้องแอคชัน 4K กันสั่น กันน้ำ เหมาะเที่ยวผจญภัย', 5990.00, 45, 'Electronics', '/images/p7.png'),
('P008', 'Office Chair', 'เก้าอี้สำนักงานรองรับสรีระ ปรับระดับได้ นั่งสบาย', 3990.00, 29, 'Furniture', '/images/p8.png'),
('P009', 'Gaming Mouse', 'เมาส์เกมมิง DPI สูง ปรับน้ำหนัก ปุ่มลัดครบ', 1290.00, 134, 'Electronics', '/images/p9.png'),
('P010', 'Mechanical Keyboard', 'คีย์บอร์ดแมคคานิค ปุ่มสัมผัสดี ไฟ RGB', 1890.00, 91, 'Electronics', '/images/p10.png'),
('P011', 'Laptop Sleeve 14"', 'ซองใส่แล็ปท็อป กันรอย ขนาดพอดีเครื่อง 14 นิ้ว', 690.00, 156, 'Electronics', '/images/p11.png'),
('P012', 'USB-C Hub 6-in-1', 'ฮับเพิ่มพอร์ต HDMI/USB/SD รองรับชาร์จผ่าน', 1190.00, 73, 'Electronics', '/images/p12.png'),
('P013', 'Portable SSD 1TB', 'SSD พกพาโอนถ่ายข้อมูลรวดเร็ว ทนทาน', 3290.00, 12, 'Electronics', '/images/p13.png'),
('P014', 'HDMI Cable 2m', 'สาย HDMI รองรับ 4K 60Hz คุณภาพสัญญาณคมชัด', 250.00, 189, 'Electronics', '/images/p14.png'),
('P015', 'Monitor 27" 2K IPS', 'จอภาพ 27 นิ้ว คมชัด มุมมองกว้าง เหมาะทำงาน/แต่งภาพ', 6990.00, 34, 'Electronics', '/images/p15.png'),
('P016', 'Desk Lamp LED', 'โคมไฟตั้งโต๊ะ ปรับระดับแสง ถนอมสายตา', 590.00, 167, 'Home', '/images/p16.png'),
('P017', 'Standing Desk', 'โต๊ะทำงานปรับสูง-ต่ำ ลดอาการเมื่อยล้า', 8990.00, 56, 'Furniture', '/images/p17.png'),
('P018', 'Coffee Maker', 'เครื่องชงกาแฟ ใช้งานง่าย ทำเอสเปรสโซ/ลาเต้', 3490.00, 98, 'Home', '/images/p18.png'),
('P019', 'Air Fryer 4L', 'หม้อทอดไร้น้ำมัน ทำอาหารกรอบนอกนุ่มใน', 2190.00, 145, 'Kitchen', '/images/p19.png'),
('P020', 'Blender 600W', 'เครื่องปั่นสมูทตี้ กำลังสูง โถทนทาน', 1290.00, 23, 'Kitchen', '/images/p20.png'),
('P021', 'Water Bottle 1L', 'ขวดน้ำกีฬา 1 ลิตร ปลอดสาร BPA', 390.00, 178, 'Outdoors', '/images/p21.png'),
('P022', 'Camping Tent 2P', 'เต็นท์ 2 คน กันน้ำ ระบายอากาศดี ตั้งง่าย', 2490.00, 67, 'Outdoors', '/images/p22.png'),
('P023', 'Trekking Backpack 35L', 'กระเป๋าเป้เดินป่า 35 ลิตร รองรับหลัง ระบายอากาศดี', 1890.00, 134, 'Outdoors', '/images/p23.png'),
('P024', 'Rain Jacket', 'เสื้อกันฝน น้ำหนักเบา พับเก็บง่าย กันน้ำได้ดี', 1590.00, 45, 'Outdoors', '/images/p24.png'),
('P025', 'Sunscreen SPF50', 'ครีมกันแดด SPF50 กันน้ำ ไม่เหนอะหนะ', 290.00, 87, 'Beauty', '/images/p25.png'),
('P026', 'Yoga Blocks (Pair)', 'บล็อกโยคะ โฟมแน่น ช่วยทรงตัว ท่าที่ยาก', 390.00, 156, 'Fitness', '/images/p26.png'),
('P027', 'Resistance Bands Set', 'ยางยืดออกกำลังกาย หลายแรงต้าน พร้อมถุงผ้า', 450.00, 112, 'Fitness', '/images/p27.png'),
('P028', 'Foam Roller 45cm', 'โฟมโรลเลอร์ คลายกล้ามเนื้อ หลังออกกำลัง', 590.00, 29, 'Fitness', '/images/p28.png'),
('P029', 'Protein Shaker 700ml', 'เชคเกอร์โปรตีน ฝาปิดแน่น ไม่รั่วซึม', 250.00, 178, 'Fitness', '/images/p29.png'),
('P030', 'Smart Scale Bluetooth', 'ตาชั่งอัจฉริยะ วัดไขมัน กล้ามเนื้อ เชื่อมต่อแอป', 990.00, 67, 'Electronics', '/images/p30.png'),
('P031', 'Router WiFi 6', 'เราเตอร์ WiFi 6 สัญญาณแรง รองรับอุปกรณ์มาก', 2590.00, 134, 'Electronics', '/images/p31.png'),
('P032', 'Power Bank 20000mAh', 'เพาเวอร์แบงก์ ชาร์จเร็ว PD/QC พร้อมจอแสดงผล', 1290.00, 45, 'Electronics', '/images/p32.png'),
('P033', 'Electric Kettle 1.8L', 'กาต้มน้ำไฟฟ้า ตัดไฟอัตโนมัติ ฐานหมุน 360°', 690.00, 87, 'Kitchen', '/images/p33.png'),
('P034', 'Rice Cooker 1.8L', 'หม้อหุงข้าว อุ่นอัตโนมัติ หม้อหนาเคลือบ', 1190.00, 156, 'Kitchen', '/images/p34.png'),
('P035', 'Vacuum Cleaner 1400W', 'เครื่องดูดฝุ่น ไซโคลน ไส้กรอง HEPA', 2590.00, 12, 'Home', '/images/p35.png'),
('P036', 'Steam Iron', 'เตารีดไอน้ำ รีดลื่น ลดรอยยับ ร้อนเร็ว', 790.00, 189, 'Home', '/images/p36.png'),
('P037', 'Wall Clock Silent', 'นาฬิกาแขวน เสียงเงียบ ดีไซน์มินิมอล', 350.00, 78, 'Home', '/images/p37.png'),
('P038', 'Photo Frame A4', 'กรอบรูป A4 วัสดุคุณภาพ แขวน/วางได้', 150.00, 123, 'Home', '/images/p38.png'),
('P039', 'Notebook A5 100p', 'สมุดบันทึก A5 100 แผ่น กระดาษถนอมสายตา', 89.00, 67, 'Office', '/images/p39.png'),
('P040', 'Gel Pen 0.5mm', 'ปากกาเจล เขียนลื่น แห้งไว หมึกคมชัด', 15.00, 145, 'Office', '/images/p40.png'),
('P041', 'File Organizer', 'กล่องจัดระเบียบเอกสาร วางโต๊ะทำงาน', 250.00, 23, 'Office', '/images/p41.png'),
('P042', 'Mouse Pad XL', 'แผ่นรองเมาส์ขนาดใหญ่ พื้นผิวลื่น ฐานยางกันลื่น', 290.00, 178, 'Gaming', '/images/p42.png'),
('P043', 'Gaming Headset', 'หูฟังเกมมิง ไมค์ตัดเสียง รอบทิศทาง', 1490.00, 67, 'Gaming', '/images/p43.png'),
('P044', 'Webcam 1080p', 'เว็บแคม Full HD สำหรับประชุมออนไลน์', 1090.00, 134, 'Electronics', '/images/p44.png'),
('P045', 'Tripod Aluminum', 'ขาตั้งกล้อง อลูมิเนียม ปรับสูงต่ำได้', 490.00, 45, 'Electronics', '/images/p45.png'),
('P046', 'Smartphone Stand', 'แท่นวางมือถือ ปรับมุม มั่นคง', 120.00, 87, 'Electronics', '/images/p46.png'),
('P047', 'LED Strip 5m RGB', 'ไฟเส้น LED เปลี่ยนสี ควบคุมด้วยรีโมต', 390.00, 156, 'Home', '/images/p47.png'),
('P048', 'Portable Fan USB', 'พัดลมพกพา ต่อ USB เงียบ ประหยัดไฟ', 290.00, 12, 'Home', '/images/p48.png'),
('P049', 'Curtain Blackout', 'ผ้าม่านกันแสง หนาทึบ ลดความร้อน', 690.00, 189, 'Home', '/images/p49.png'),
('P050', 'Laundry Basket Foldable', 'ตะกร้าผ้า พับเก็บได้ น้ำหนักเบา', 250.00, 78, 'Home', '/images/p50.png'),
('P051', 'Smart TV 55" 4K', 'สมาร์ททีวี 55 นิ้ว ความละเอียด 4K รองรับแอปสตรีมมิง', 14990.00, 123, 'Electronics', '/images/p51.png'),
('P052', 'Soundbar 2.1', 'ซาวด์บาร์พร้อมซับวูฟเฟอร์ เสียงกระหึ่ม ดูหนังมันส์', 3990.00, 67, 'Electronics', '/images/p52.png'),
('P053', 'Drone 4K Camera', 'โดรนกล้อง 4K บินนิ่ง กันสั่น ถ่ายวิดีโอสวยคม', 7990.00, 145, 'Electronics', '/images/p53.png'),
('P054', 'E-book Reader 7"', 'เครื่องอ่านอีบุ๊ก หน้าจอ E‑Ink อ่านสบายตา', 4290.00, 23, 'Electronics', '/images/p54.png'),
('P055', 'Bluetooth Speaker', 'ลำโพงบลูทูธ พกพาง่าย กันน้ำระดับ IPX5', 1290.00, 178, 'Electronics', '/images/p55.png'),
('P056', 'ANC Headphones', 'หูฟังครอบหู ตัดเสียงรบกวน แบตอึด', 3490.00, 67, 'Electronics', '/images/p56.png'),
('P057', 'Fitness Tracker Band', 'สายรัดข้อมือวัดชีพจร ติดตามการนอน การออกกำลัง', 1390.00, 134, 'Electronics', '/images/p57.png'),
('P058', 'Smart Light Bulb RGB', 'หลอดไฟอัจฉริยะ เปลี่ยนสีได้ ควบคุมผ่านแอป/เสียง', 390.00, 45, 'Home', '/images/p58.png'),
('P059', 'Robot Vacuum', 'หุ่นยนต์ดูดฝุ่น กวาด-ถู ตั้งเวลาได้', 5990.00, 87, 'Home', '/images/p59.png'),
('P060', 'Air Purifier HEPA', 'เครื่องฟอกอากาศ ไส้กรอง HEPA ลดฝุ่นและกลิ่น', 3290.00, 156, 'Home', '/images/p60.png'),
('P061', 'Dehumidifier 2L', 'เครื่องลดความชื้น เหมาะห้องชื้น/ฤดูฝน', 2590.00, 12, 'Home', '/images/p61.png'),
('P062', 'Humidifier Ultrasonic', 'เครื่องเพิ่มความชื้น ละอองไอน้ำละเอียด เงียบ', 890.00, 189, 'Home', '/images/p62.png'),
('P063', 'Electric Toothbrush', 'แปรงสีฟันไฟฟ้า ระบบโซนิค ทำความสะอาดล้ำลึก', 1290.00, 78, 'Beauty', '/images/p63.png'),
('P064', 'Hair Dryer Ionic', 'ไดร์เป่าผมไอออนิค ลดชี้ฟู ปรับความร้อนหลายระดับ', 990.00, 123, 'Beauty', '/images/p64.png'),
('P065', 'Beard Trimmer', 'ปัตตาเลี่ยนแต่งหนวด เงียบ น้ำหนักเบา', 690.00, 67, 'Beauty', '/images/p65.png'),
('P066', 'Rice Storage 10kg', 'กล่องเก็บข้าวสาร 10 กก. กันชื้น มีสเกลตวง', 590.00, 145, 'Kitchen', '/images/p66.png'),
('P067', 'Knife Set 6pcs', 'มีดเชฟชุด 6 ชิ้น พร้อมแท่นวาง', 890.00, 23, 'Kitchen', '/images/p67.png'),
('P068', 'Non-stick Frying Pan 28cm', 'กระทะเคลือบ ไม่ติดกระทะ ล้างง่าย', 690.00, 178, 'Kitchen', '/images/p68.png'),
('P069', 'Cast Iron Skillet 26cm', 'กระทะเหล็กหล่อ เก็บความร้อนดี เหมาะสเต๊ก', 1290.00, 67, 'Kitchen', '/images/p69.png'),
('P070', 'Baking Tray Set', 'ถาดอบขนม ชุด 3 ขนาด เคลือบไม่ติด', 490.00, 134, 'Kitchen', '/images/p70.png'),
('P071', 'Pressure Cooker 6L', 'หม้อความดัน 6 ลิตร เร็ว ประหยัดเวลา', 1990.00, 45, 'Kitchen', '/images/p71.png'),
('P072', 'Slow Cooker 3.5L', 'หม้อสโลว์คุก ทําสตูว์นุ่มละมุน', 1490.00, 87, 'Kitchen', '/images/p72.png'),
('P073', 'Toaster 2-Slice', 'เครื่องปิ้งขนมปัง 2 แผ่น ปรับความกรอบได้', 690.00, 156, 'Kitchen', '/images/p73.png'),
('P074', 'Sandwich Maker', 'เครื่องทำแซนด์วิช แผ่นร้อนคู่ ไม่ติด', 690.00, 12, 'Kitchen', '/images/p74.png'),
('P075', 'Ice Maker Countertop', 'เครื่องทำน้ำแข็งตั้งโต๊ะ ทำก้อนได้รวดเร็ว', 3990.00, 189, 'Kitchen', '/images/p75.png'),
('P076', 'Water Filter Pitcher', 'เหยือกกรองน้ำ ดื่มสะอาด ลดคลอรีน', 790.00, 78, 'Kitchen', '/images/p76.png'),
('P077', 'Food Processor 800W', 'เครื่องเตรียมอาหาร สับ/บด/ผสม', 1990.00, 123, 'Kitchen', '/images/p77.png'),
('P078', 'Bread Maker Auto', 'เครื่องทำขนมปัง ตั้งเวลาล่วงหน้าได้', 2990.00, 67, 'Kitchen', '/images/p78.png'),
('P079', 'Waffle Maker', 'เครื่องทำวาฟเฟิล กรอบนอกนุ่มใน', 890.00, 145, 'Kitchen', '/images/p79.png'),
('P080', 'Coffee Grinder Burr', 'เครื่องบดกาแฟแบบเฟือง ปรับความละเอียดได้', 1490.00, 23, 'Kitchen', '/images/p80.png'),
('P081', 'DSLR Camera Body', 'กล้อง DSLR คุณภาพสูง เหมาะฝึกถ่ายภาพจริงจัง', 15990.00, 178, 'Electronics', '/images/p81.png'),
('P082', 'Lens 50mm F1.8', 'เลนส์ไพรม์ 50มม. ถ่ายคนหลังละลาย', 3990.00, 67, 'Electronics', '/images/p82.png'),
('P083', 'Photo Printer A4', 'เครื่องพิมพ์ภาพ A4 สีสด รายละเอียดคม', 5490.00, 134, 'Electronics', '/images/p83.png'),
('P084', 'External Microphone USB', 'ไมค์ USB สำหรับพอดแคสต์/สตรีมมิง เสียงใส', 1890.00, 45, 'Electronics', '/images/p84.png'),
('P085', 'Ring Light 12"', 'ไฟวงแหวน ปรับอุณหภูมิสีได้ เหมาะถ่ายวิดีโอ', 690.00, 87, 'Electronics', '/images/p85.png'),
('P086', 'Green Screen Backdrop', 'ผ้าฉากสีเขียว ถ่ายวิดีโอ ตัดต่อ keying', 990.00, 156, 'Electronics', '/images/p86.png'),
('P087', 'Capture Card HDMI', 'อุปกรณ์จับภาพ HDMI สำหรับสตรีมเกม', 1990.00, 12, 'Electronics', '/images/p87.png'),
('P088', 'Streaming Webcam 4K', 'เว็บแคม 4K โฟกัสไว เหมาะสตรีม/ประชุม', 2490.00, 189, 'Electronics', '/images/p88.png'),
('P089', 'Tripod Mini', 'ขาตั้งกล้องขนาดเล็ก ตั้งโต๊ะ พกสะดวก', 290.00, 78, 'Electronics', '/images/p89.png'),
('P090', 'Camera Bag Sling', 'กระเป๋ากล้องแบบสลิง ช่องกันกระแทก', 890.00, 123, 'Electronics', '/images/p90.png'),
('P091', 'Smart Door Lock', 'กุญแจประตูอัจฉริยะ ปลดล็อกผ่านแอป/รหัส', 3990.00, 67, 'Home', '/images/p91.png'),
('P092', 'Video Doorbell', 'กริ่งประตูติดกล้อง แจ้งเตือนผ่านมือถือ', 2590.00, 145, 'Home', '/images/p92.png'),
('P093', 'Wi-Fi Security Camera', 'กล้องวงจรปิด Wi‑Fi หมุนได้ แจ้งเตือนตรวจจับการเคลื่อนไหว', 1190.00, 23, 'Home', '/images/p93.png'),
('P094', 'Smoke Detector', 'เครื่องตรวจจับควัน แจ้งเตือนทันทีเมื่อมีควันไฟ', 590.00, 178, 'Home', '/images/p94.png'),
('P095', 'Smart Plug Wi‑Fi', 'ปลั๊กอัจฉริยะ ตั้งเวลาปิด/เปิด ควบคุมผ่านแอป', 390.00, 67, 'Home', '/images/p95.png'),
('P096', 'Smart Thermometer Room', 'เครื่องวัดอุณหภูมิ/ความชื้น เชื่อมต่อแอป', 490.00, 134, 'Home', '/images/p96.png'),
('P097', 'Baby Monitor', 'อุปกรณ์ดูแลทารก มีกล้องและเสียงสองทาง', 2790.00, 45, 'Home', '/images/p97.png'),
('P098', 'Automatic Pet Feeder', 'เครื่องให้อาหารสัตว์อัตโนมัติ ตั้งเวลาได้', 2190.00, 87, 'Home', '/images/p98.png'),
('P099', 'Cat Litter Box Covered', 'กระบะทรายแมว แบบปิด กันกลิ่น กระเด็นน้อย', 1290.00, 156, 'Home', '/images/p99.png'),
('P100', 'Dog Leash Retractable', 'สายจูงสุนัข แบบปรับยาว-สั้นอัตโนมัติ', 390.00, 12, 'Outdoors', '/images/p100.png');

-- 4. ใส่ข้อมูลการขายตัวอย่าง
INSERT INTO sales (product_id, sale_date, quantity_sold, total_price) VALUES
(1, '2024-01-15', 2, 5180.00),
(2, '2024-01-16', 1, 2390.00),
(3, '2024-01-17', 3, 9870.00),
(4, '2024-01-18', 5, 4950.00),
(5, '2024-01-19', 1, 4990.00),
(6, '2024-01-20', 2, 4380.00),
(7, '2024-01-21', 1, 5990.00),
(8, '2024-01-22', 1, 3990.00),
(9, '2024-01-23', 3, 3870.00),
(10, '2024-01-24', 2, 3780.00),
(11, '2024-01-25', 4, 2760.00),
(12, '2024-01-26', 2, 2380.00),
(13, '2024-01-27', 1, 3290.00),
(14, '2024-01-28', 8, 2000.00),
(15, '2024-01-29', 1, 6990.00),
(16, '2024-01-30', 3, 1770.00),
(17, '2024-01-31', 1, 8990.00),
(18, '2024-02-01', 2, 6980.00),
(19, '2024-02-02', 3, 6570.00),
(20, '2024-02-03', 4, 5160.00),
(21, '2024-02-04', 6, 2340.00),
(22, '2024-02-05', 2, 4980.00),
(23, '2024-02-06', 3, 5670.00),
(24, '2024-02-07', 2, 3180.00),
(25, '2024-02-08', 5, 1450.00),
(26, '2024-02-09', 4, 1560.00),
(27, '2024-02-10', 6, 2700.00),
(28, '2024-02-11', 2, 1180.00),
(29, '2024-02-12', 8, 2000.00),
(30, '2024-02-13', 3, 2970.00),
(31, '2024-02-14', 2, 5180.00),
(32, '2024-02-15', 3, 3870.00),
(33, '2024-02-16', 4, 2760.00),
(34, '2024-02-17', 2, 2380.00),
(35, '2024-02-18', 1, 2590.00),
(36, '2024-02-19', 3, 2370.00),
(37, '2024-02-20', 5, 1750.00),
(38, '2024-02-21', 8, 1200.00),
(39, '2024-02-22', 12, 1068.00),
(40, '2024-02-23', 20, 300.00),
(41, '2024-02-24', 6, 1500.00),
(42, '2024-02-25', 4, 1160.00),
(43, '2024-02-26', 2, 2980.00),
(44, '2024-02-27', 3, 3270.00),
(45, '2024-02-28', 5, 2450.00),
(46, '2024-03-01', 10, 1200.00),
(47, '2024-03-02', 4, 1560.00),
(48, '2024-03-03', 6, 1740.00),
(49, '2024-03-04', 2, 1380.00),
(50, '2024-03-05', 7, 1750.00),
(51, '2024-03-06', 1, 14990.00),
(52, '2024-03-07', 2, 7980.00),
(53, '2024-03-08', 1, 7990.00),
(54, '2024-03-09', 2, 8580.00),
(55, '2024-03-10', 3, 3870.00),
(56, '2024-03-11', 1, 3490.00),
(57, '2024-03-12', 2, 2780.00),
(58, '2024-03-13', 6, 2340.00),
(59, '2024-03-14', 1, 5990.00),
(60, '2024-03-15', 2, 6580.00),
(61, '2024-03-16', 1, 2590.00),
(62, '2024-03-17', 3, 2670.00),
(63, '2024-03-18', 2, 2580.00),
(64, '2024-03-19', 3, 2970.00),
(65, '2024-03-20', 4, 2760.00),
(66, '2024-03-21', 2, 1180.00),
(67, '2024-03-22', 3, 2670.00),
(68, '2024-03-23', 4, 2760.00),
(69, '2024-03-24', 2, 2580.00),
(70, '2024-03-25', 5, 2450.00),
(71, '2024-03-26', 2, 3980.00),
(72, '2024-03-27', 3, 4470.00),
(73, '2024-03-28', 4, 2760.00),
(74, '2024-03-29', 3, 2070.00),
(75, '2024-03-30', 1, 3990.00),
(76, '2024-03-31', 5, 3950.00),
(77, '2024-04-01', 2, 3980.00),
(78, '2024-04-02', 1, 2990.00),
(79, '2024-04-03', 4, 3560.00),
(80, '2024-04-04', 3, 4470.00),
(81, '2024-04-05', 1, 15990.00),
(82, '2024-04-06', 2, 7980.00),
(83, '2024-04-07', 1, 5490.00),
(84, '2024-04-08', 2, 3780.00),
(85, '2024-04-09', 3, 2070.00),
(86, '2024-04-10', 2, 1980.00),
(87, '2024-04-11', 1, 1990.00),
(88, '2024-04-12', 2, 4980.00),
(89, '2024-04-13', 5, 1450.00),
(90, '2024-04-14', 3, 2670.00),
(91, '2024-04-15', 1, 3990.00),
(92, '2024-04-16', 2, 5180.00),
(93, '2024-04-17', 3, 3570.00),
(94, '2024-04-18', 4, 2360.00),
(95, '2024-04-19', 6, 2340.00),
(96, '2024-04-20', 5, 2450.00),
(97, '2024-04-21', 2, 5580.00),
(98, '2024-04-22', 3, 6570.00),
(99, '2024-04-23', 2, 2580.00),
(100, '2024-04-24', 8, 3120.00);

-- 5. เปิดใช้งาน RLS สำหรับความปลอดภัย
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;

-- 6. สร้าง Policy สำหรับอ่านข้อมูล (อนุญาตให้ทุกคนอ่านได้)
CREATE POLICY "Enable read access for all users" ON products FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON sales FOR SELECT USING (true);
```

#### 2. โครงสร้าง Tools
##### Tool 1: getProductInfoTool
**หน้าที่:** ค้นหาข้อมูลสินค้า (ชื่อ, ราคา, สต็อก, รายละเอียด)
```typescript {.line-numbers}
const getProductInfoTool = new DynamicStructuredTool({
  name: "get_product_info",
  description: "ค้นหาข้อมูลสินค้าจากฐานข้อมูล รวมถึงราคาและจำนวนคงคลัง (stock)",
  schema: z.object({
    productName: z.string().describe("ชื่อของสินค้าที่ต้องการค้นหา")
  }),
  func: async ({ productName }) => {
    // ค้นหาข้อมูลจาก Supabase
    // แสดงผลเป็นรายการหรือตารางตามจำนวนข้อมูล
  }
})
```
**ตัวอย่างการใช้งาน:**
- Gaming Mouse ราคาเท่าไหร่?
- Smartwatch มีในสต็อกไหม?
- ดูข้อมูลสินค้าที่มีคำว่า shoes ในชื่อ

##### Tool 2: getSalesDataTool
**หน้าที่:** ดูประวัติการขายของสินค้า
```typescript {.line-numbers}
const getSalesDataTool = new DynamicStructuredTool({
  name: "get_sales_data",
  description: "ดูประวัติการขายของสินค้า",
  schema: z.object({
    productName: z.string().describe("ชื่อของสินค้าที่ต้องการดูข้อมูลการขาย")
  }),
  func: async ({ productName }) => {
    // ค้นหาประวัติการขายจาก Supabase
    // แสดงผลเป็นรายการหรือตารางพร้อมสรุป
  }
})
```
**ตัวอย่างการใช้งาน:**
- ขาย Gaming Mouse ได้กี่ชิ้นในเดือนที่ผ่านมา?
- Smartwatch ขายไปแล้วกี่ชิ้น?
- สรุปยอดขายของสินค้า Mechanical Keyboard

#### 3. สร้าง api route สำหรับเรียกใช้ Tools กับฐานข้อมูล
สร้างไฟล์ `src/app/api/chat_07_tool_calling_postgres/route.ts` และใส่โค้ดดังนี้
```typescript {.line-numbers}
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
```

#### 4. แก้ไข api.ts สำหรับเชื่อมต่อกับ route ใหม่
ในไฟล์ `src/constants/api.ts` ให้แก้ไขเป็นดังนี้
```typescript {.line-numbers}
export const API_BASE = '/api/chat_07_tool_calling_postgres'
```

#### 5. ทดสอบการทำงานด้วย prompt ต่างๆ
##### Tool 1: getProductInfoTool - ดูข้อมูลสินค้า
- Gaming Mouse ราคาเท่าไหร่?
- Smartwatch มีในสต็อกไหม?
- ดูข้อมูลสินค้าที่มีคำว่า shoes ในชื่อ
- Earbuds มีรายละเอียดสินค้าอย่างไร?

##### Tool 2: getSalesDataTool - ดูประวัติการขาย
- ขาย Gaming Mouse ได้กี่ชิ้นในเดือนที่ผ่านมา?
- Smartwatch ขายไปแล้วกี่ชิ้น?
- สรุปยอดขายของสินค้า Mechanical Keyboard

##### เรียกทำงานพร้อมกันทั้ง 2 Tools
- สินค้า Running Shoes ราคาเท่าไหร่ และขายไปแล้วกี่ชิ้น?
- Gaming Mouse ขายไปได้กี่ชิ้นแล้ว และตอนนี้เหลือในสต็อกเท่าไหร่?
- Smartwatch มีรายละเอียดสินค้าอย่างไร และขายไปแล้วกี่ชิ้น?