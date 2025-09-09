# AI Chatbot with LangChain & Next.js - Day 1

## โปรแกรม (Tool and Editor) ที่ใช้อบรม

### แนะนำ หลักสูตรนี้ใช้ Node.JS เวอร์ชั่น 20 ขึ้นไป

1. **Node.js 22.x**
2. **Visual Studio Code**
3. **Git**
4. **Ollama (Optional) - ไม่บังคับ**

### แนะนำ Ollama เป็นเครื่องมือรัน AI model แบบ Local เหมาะสำหรับเครื่องที่ VGA แรง
และคอมพิวเตอร์ที่มี Spec สูงพอควร ไม่จำเป็น และไม่บังคับให้ต้องติดตั้งหากเครื่องไม่พร้อม

---

## การตรวจสอบความเรียบร้อยของเครื่องมือที่ติดตั้งบน Windows / Mac OS / Linux

เปิด Command Prompt บน Windows หรือ Terminal บน Mac ขึ้นมาป้อนคำสั่งดังนี้

### Visual Studio Code
```bash
code --version
```

### Git
```bash
git version
```

### Node JS
```bash
node -v
npm -v
npx -v
```

### Ollama
```bash
ollama -v
```

---

## New Project Next.JS 15 with App Router

### เวอร์ชั่นล่าสุด
```bash
npx create-next-app@latest
```

### ระบุเวอร์ชั่นที่ต้องการ
```bash
npx create-next-app@15.5.2
```

### เปลี่ยน path เข้าไปเจ็ดกำ
```bash
cd aichatbot-langchain-nextjs
```

### สั่ง run โปรเจ็กต์แบบ Development mode
```bash
npm run dev
```

### สั่ง build โปรเจ็กต์
```bash
npm run build
```

### สั่ง run โปรเจ็กต์แบบ Production mode
```bash
npm start
```

---

## 3. ตั้งค่า Environment Variables

สร้างไฟล์ `.env.local` และเพิ่ม:

```env
OPENAI_API_KEY=your_openai_api_key_here
```

---

## 4. เริ่มใช้งาน Development Server

```bash
npm run dev
```

เปิดเบราว์เซอร์ไปที่ http://localhost:3000

---

## 📜 Available Scripts

```bash
npm run dev      # เริ่ม development server
npm run build    # สร้าง production build
npm run start    # เริ่ม production server
npm run lint     # ตรวจสอบ code ด้วย ESLint
```

---

## 🎯 API Endpoints พื้นฐาน

### 1. Base API Route (/api/route.ts)

สร้างไฟล์ `src/app/api/route.ts` สำหรับ API endpoints พื้นฐาน:

```typescript
import { NextResponse } from "next/server";

// Example API route with GET, POST, PUT, DELETE methods
export async function GET() {
  return NextResponse.json({ message: "API Running with GET" });
}

export async function POST() {
  return NextResponse.json({ message: "API Running with POST" });
}

export async function PUT() {
  return NextResponse.json({ message: "API Running with PUT" });
}

export async function DELETE() {
  return NextResponse.json({ message: "Delete request received" });
}
```

**การทดสอบ:**
- GET: `http://localhost:3000/api`
- POST: `http://localhost:3000/api`
- PUT: `http://localhost:3000/api`
- DELETE: `http://localhost:3000/api`

---

### 2. Test API Route (/api/test/route.ts)

สร้างไฟล์ `src/app/api/test/route.ts` สำหรับทดสอบการรับและส่งข้อมูล:

```typescript
import { NextRequest, NextResponse } from "next/server";

// GET Method Example
// URL: /api/test?name=John
// URL: /api/test หรือ http://localhost:3000/api/test?name=John
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name") || "World";
  
  return NextResponse.json({
    message: `Hello, ${name}!`
  });
}

// POST Method Example
// URL: /api/test
// Body: { "name": "John" }
// Content-Type: application/json
// Headers: { "Content-Type": "application/json" }
// curl -X POST http://localhost:3000/api/test -d '{"name":"Jane"}'
export async function POST(request: NextRequest) {
  const data = await request.json();
  const name = data.name || "World";
  
  return NextResponse.json({
    message: `Hello, ${name}!`
  });
}

// PUT Method Example
// URL: /api/test
// Body: { "name": "Jane" }
// Content-Type: application/json
// Headers: { "Content-Type": "application/json" }
// curl -X PUT http://localhost:3000/api/test -d '{"name":"Jane"}'
export async function PUT(request: NextRequest) {
  const data = await request.json();
  const name = data.name || "World";
  
  return NextResponse.json({
    message: `Hello, ${name}!`
  });
}

// DELETE Method Example
// URL: /api/test
// curl -X DELETE http://localhost:3000/api/test
export async function DELETE() {
  return NextResponse.json({
    message: "Delete request received"
  });
}
```

**การทดสอบ Test API:**
- GET: `http://localhost:3000/api/test?name=John`
- POST: ส่ง JSON `{"name": "Jane"}` ไปยัง `http://localhost:3000/api/test`
- PUT: ส่ง JSON `{"name": "Jane"}` ไปยัง `http://localhost:3000/api/test`
- DELETE: `http://localhost:3000/api/test`

---

## 🤖 AI Chat Endpoint

## การเชื่อมต่อกับ LangChain และ AI SDK

### ติดตั้ง Dependencies ที่จำเป็น

```bash
npm install langchain @ai-sdk/langchain @ai-sdk/react @langchain/core @langchain/openai ai
```

### การ Import และใช้งาน

```typescript
import { NextRequest } from "next/server";
import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { createMessageStreamResponse, toAIMessage, convertToAIMessages } from "ai";
```

### การตั้งค่า Model และ Streaming

```typescript
const model = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0.7,
  maxTokens: 300,
  streaming: true,
});
```

### 3. Test API Route (/api/chat/route.ts)

สร้างไฟล์ `src/app/api/chat/route.ts` สำหรับทดสอบการรับและส่งข้อมูล:

```typescript
import { NextRequest } from "next/server"
import { ChatOpenAI } from "@langchain/openai"
import { ChatPromptTemplate } from "@langchain/core/prompts"
import { toUIMessageStream } from "@ai-sdk/langchain"
import { createUIMessageStreamResponse, UIMessage, convertToModelMessages } from "ai"

// กำหนดให้ API นี้ทำงานแบบ Edge Runtime เพื่อประสิทธิภาพที่ดีกว่า
export const runtime = "edge"

// กำหนดเวลาสูงสุดที่ API จะทำงานได้ (เช่น 30 วินาที) 
// ถ้าใช้เวลานานกว่านี้ จะถูกยกเลิก
export const maxDuration = 30 // วินาที

export async function POST(req: NextRequest) {
  try {
    // ดึงข้อความจาก request body ที่ส่งมาจาก useChat hook
    const { messages }: { messages: UIMessage[] } = await req.json()

    // สร้าง Prompt Template เพื่อกำหนดบทบาทและรูปแบบการตอบของ AI
    const prompt = ChatPromptTemplate.fromMessages([
      ["system", "You are a helpful and friendly AI assistant."],
      // แปลง UIMessage ให้เป็นรูปแบบที่ LangChain เข้าใจ
      ...convertToModelMessages(messages),
    ])

    // เลือกรุ่นของโมเดล OpenAI ที่ต้องการใช้
    const model = new ChatOpenAI({
      model: "gpt-4o-mini", // ระบุรุ่น AI model ที่ใช้
      temperature: 0.7, // ความสร้างสรรค์ของคำตอบ (0 = เป็นระบบมาก, 1 = สร้างสรรค์มาก)
      maxTokens: 300, // จำนวน token สูงสุดที่สามารถตอบได้
      streaming: true, // เปิดใช้ streaming response
    })

    // สร้าง Chain โดยการเชื่อมต่อ Prompt กับ Model เข้าด้วยกัน
    const chain = prompt.pipe(model)

    // เรียกใช้งาน Chain พร้อมกับส่ง message ล่าสุดไป และรับผลลัพธ์แบบ stream
    const stream = await chain.stream({
      // LangChain ต้องการตัวแปรเปล่าๆ ใน input สำหรับ prompt ที่สร้างจาก message history
    })

    // ส่ง Response กลับไปให้ Frontend
    const response = createUIMessageStreamResponse({
      stream: toUIMessageStream(stream),
    })

    return response
  } catch (error) {
    // จัดการ error และ log รายละเอียดเพื่อ debug
    console.error("API Error:", error)
    // ส่ง error response กลับไปยัง client
    return new Response(
      JSON.stringify({
        error: "An error occurred while processing your request",
      }),
      {
        status: 500, // HTTP status code สำหรับ Internal Server Error
        headers: { "Content-Type": "application/json" }, // กำหนด content type เป็น JSON
      }
    )
  }
}
```

### POST /api/chat

Endpoint สำหรับส่งข้อความไปให้ AI และรับการตอบกลับแบบ streaming

**Request Body:**
```json
{
  "messages": [
    {
      "id": "message-id",
      "role": "user",
      "parts": [
        {
          "type": "text",
          "text": "Hello, AI!"
        }
      ]
    }
  ]
}
```

**Response:** Stream ของ AI messages

### 4. Create UI in React (/src/app/page.tsx)

สร้างไฟล์ `src/app/page.tsx` สำหรับสร้าง UI ของแอปพลิเคชัน:

```tsx
'use client'

import { useState } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'

export default function Chat() {

  // ใช้ useChat hook เพื่อจัดการสถานะการสนทนา
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat'
    })
  })

  // กำหนด state สำหรับ input text
  const [input, setInput] = useState('')

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      
      {/* Header */}
      <div className="bg-white shadow-sm p-4 border-b">
        <h1 className="text-xl font-semibold text-gray-800 text-center">AI Chatbot with LangChain.JS</h1>
      </div>

      {/* Chat Messages Area */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-3 max-w-3xl mx-auto w-full h-full">
          {messages.length === 0 && (
            <div className="flex flex-col justify-center items-center text-center text-gray-500 h-full">
              <div>
                <p className="text-lg">👋 สวัสดีครับ!</p>
                <p className="mt-2">เริ่มการสนทนาได้เลยครับ</p>
              </div>
            </div>
          )}

          {/* แสดง Messages */}
          {messages.map(m => (
            <div
              key={m.id}
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs sm:max-w-md lg:max-w-lg xl:max-w-xl px-4 py-3 mb-2 rounded-2xl shadow-sm ${
                  m.role === 'user'
                    ? 'bg-blue-500 text-white rounded-br-md'
                    : 'bg-white text-gray-800 rounded-bl-md'
                }`}
              >
                {m.parts.map((part, index) => 
                  part.type === 'text' ? (
                    <div key={index} className="whitespace-pre-wrap">{part.text}</div>
                  ) : null
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Input Area */}
      <div className="bg-white border-t p-4">
        <div className="max-w-3xl mx-auto w-full">
          {/* แสดงสถานะการพิมพ์ของ AI */}
          {(status === 'submitted' || status === 'streaming') && 
            <div className="text-gray-500 italic mb-2 text-sm">🤔 AI กำลังคิด...</div>
          }

          <form
            className="flex items-center space-x-2"
            onSubmit={e => {
            e.preventDefault() // ป้องกันหน้า refresh
            if (!input.trim()) return // ไม่ส่งถ้า input ว่าง

            // เรียกใช้ sendMessage ที่ได้จาก useChat โดยตรง
            sendMessage({
              text: input,
            })

            // ล้างช่อง input หลังจากส่ง
            setInput('')
          }}
        >
          <input
            className="flex-grow p-3 border border-gray-300 text-gray-700 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            value={input}
            placeholder="พิมพ์ข้อความที่นี่..."
            onChange={e => setInput(e.target.value)}
            disabled={status !== 'ready'}
          />
          <button
            type="submit"
            className="p-3 bg-blue-500 text-white font-semibold rounded-full hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors duration-200"
            disabled={status !== 'ready' || !input.trim()}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </form>
        </div>
      </div>
    </div>
  )
}
```

## Base API Routes - สรุป

ตัวอย่าง RESTful API endpoints ที่สร้างขึ้น:

### `/api` - Base API Route
- **GET** `/api` - ข้อความทดสอบ API พื้นฐาน
- **POST** `/api` - ทดสอบ POST method
- **PUT** `/api` - ทดสอบ PUT method  
- **DELETE** `/api` - ทดสอบ DELETE method

### `/api/test` - Test API Route พร้อมการรับส่งข้อมูล
- **GET** `/api/test?name=John` - รับข้อมูลผ่าน Query Parameters
- **POST** `/api/test` - รับข้อมูลผ่าน Request Body (JSON)
- **PUT** `/api/test` - อัปเดตข้อมูลผ่าน Request Body (JSON)
- **DELETE** `/api/test` - ลบข้อมูล

**Response Format:**
```json
{
  "message": "Hello, John!"
}
```

---

## โครงสร้างโปรเจ็กต์พื้นฐาน

```
aichatbot-langchain-nextjs/
├── src/
│   └── app/
│       ├── api/
│       │   ├── route.ts          # Base API routes
│       │   ├── chat/
│       │   │   └── route.ts      # Chat API endpoint
│       │   └── test/
│       │       └── route.ts      # Test API endpoint
│       ├── favicon.ico
│       ├── globals.css
│       ├── layout.tsx
│       └── page.tsx
├── public/
├── .env.local                    # Environment variables
├── next.config.ts
├── package.json
├── tsconfig.json
└── README.md
```
---

## สิ่งที่เรียนรู้ใน Day 1

✅ การติดตั้งและตรวจสอบเครื่องมือที่จำเป็น  
✅ การสร้างโปรเจ็กต์ Next.js 15 พร้อม App Router  
✅ การเขียน REST API endpoints พื้นฐาน  
✅ การเชื่อมต่อกับ LangChain และ AI SDK  
✅ การตั้งค่า Environment Variables  
✅ การทำ Streaming Response สำหรับ AI Chat  

---

## หมายเหตุ

- ใช้ Node.js เวอร์ชั่น 20 ขึ้นไป
- Ollama เป็น optional สำหรับการรัน AI model แบบ local
- ต้องมี OpenAI API Key สำหรับการใช้งาน
- การ Streaming ช่วยให้ผู้ใช้เห็น response แบบ real-time