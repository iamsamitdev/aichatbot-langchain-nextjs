# AI Chatbot with LangChain & Next.js - Day 2

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

### 3. Chat API Route (/api/chat/route.ts)

**การทดสอบ Chat API:**
Endpoint สำหรับส่งข้อความไปให้ AI และรับการตอบกลับแบบ streaming

ขอแนะนำให้ใช้ Postman หรือ curl สำหรับการทดสอบ
- POST: `http://localhost:3000/api/chat`

**Request Body:**
```json
{
  "messages": [
    {
      "id": "chat-id-001",
      "role": "user",
      "parts": [
        {
          "type": "text",
          "text": "สวัสดีครับ"
        }
      ]
    }
  ]
}
```

**Response:**
- การตอบกลับจะเป็นแบบ streaming ตัวอย่างเช่น:
```
data: {"type":"text","text":"สวัสดีครับ! มีอะไรให้ช่วยเหลือไหม?"}
data: [DONE]
```
---
## 📁 โครงสร้างโปรเจ็กต์

```
my-langchain-chatbot/
├── src/
│   └── app/
│       ├── api/
│       │   ├── chat/
│       │   │   └── route.ts          # Chat API endpoint
│       │   ├── chat_01_start/
│       │   │   └── route.ts          # Step 1: Basic chat setup
│       │   ├── chat_02_request/
│       │   │   └── route.ts          # Step 2: Request handling
│       │   ├── chat_03_template/
│       │   │   └── route.ts          # Step 3: Prompt templates
│       │   ├── chat_04_stream/
│       │   │   └── route.ts          # Step 4: Streaming responses
│       │   ├── test/
│       │   │   └── route.ts          # Test API endpoint
│       │   └── route.ts              # Base API routes (GET, POST, PUT, DELETE)
│       ├── globals.css               # Global styles
│       ├── layout.tsx                # Root layout
│       └── page.tsx                  # Main chat interface
├── public/                           # Static assets
├── eslint.config.mjs                 # ESLint configuration
├── next.config.ts                    # Next.js configuration
├── package.json                      # Dependencies และ scripts
├── postcss.config.mjs                # PostCSS configuration
├── tailwind.config.ts                # Tailwind CSS configuration
├── tsconfig.json                     # TypeScript configuration
└── README.md                         # Documentation
```
## 🎯 LangChain Tutorial Endpoints

เรียนรู้การสร้าง AI Chat API แบบขั้นตอน:

#### Step 1: Basic Setup (`/api/chat_01_start`)
- การเริ่มต้นใช้งาน LangChain
- Basic OpenAI integration
- Simple response handling

สร้างไฟล์ `src/app/api/chat_01_start/route.ts` สำหรับขั้นตอนที่ 1

```typescript
import { NextResponse } from "next/server"
import { ChatOpenAI } from "@langchain/openai"

// Example
// const llm = new ChatOpenAI({
//     model: "gpt-4o-mini", // ชื่อโมเดล
//     temperature: 0, // ความสร้างสรรค์ของคำตอบ มีระดับ 0-1
//     maxTokens: undefined, // จำนวนคำตอบสูงสุดที่ต้องการ
//     timeout: undefined, // ระยะเวลาในการรอคำตอบ
//     maxRetries: 2, // จำนวนครั้งสูงสุดในการลองใหม่
//     apiKey: "...",  // API Key ของคุณ
//     baseUrl: "...", // URL ของ API
//     organization: "...", // ชื่อองค์กรของคุณ
//     other params... // พารามิเตอร์อื่น ๆ
// })

// กำหนดข้อความที่ต้องการแปล
// const input = `Translate "I love programming" into Thai.`

// Model จะทำการแปลข้อความ
// invoke คือ การเรียกใช้งานโมเดล
// const result = await llm.invoke(input)

// แสดงผลลัพธ์
// console.log(result)

export async function POST() {

  // สร้าง instance ของ ChatOpenAI
  const model = new ChatOpenAI({
    model: "gpt-4o-mini",
    temperature: 0, // ความสร้างสรรค์ของคำตอบ มีระดับ 0-1 // 0 คือ ตอบตรง ๆ // 1 คือ ตอบแบบสร้างสรรค์
    maxTokens: 300, // จำนวนคำตอบสูงสุดที่ต้องการ 300 token
  })

  // สร้าง instance ของ ChatOpenAI (OpenRouter)
  // ...

  // สร้าง instance ของ Ollama (Local) - ใช้ ChatOpenAI กับ baseURL ของ Ollama
  // ...

  // กำหนดข้อความที่ต้องการแปล
  const input = `Translate "I love programming" into Thai.`

  // Model จะทำการแปลข้อความ
  const response = await model.invoke(input)

  // แสดงผลลัพธ์
  console.log(response) // ผลลัพธ์: ฉันรักการเขียนโปรแกรม

  // try...catch เช็ค error 
  try {
    const response = await model.invoke([
        {
            role: "system",
            content:
            "คุณเป็นจัดการฝ่ายการเงินของบริษัท คุญตอบคำถามให้พนักงานในบริษัทในเรื่องการเงิน",
        },
        {
            role: "human", // "human" เป็น alias ของ "user"
            content: "สวัสดีครับ งบประมาณปีนี้เป็นอย่างไรบ้าง?",
        },
    ])

    // เอกสารฝั่ง LangChain JS ชี้ว่าข้อความมี “role” เช่น "user", "assistant" และ LangChain จะดูแลการแมปให้เข้ากับผู้ให้บริการเมื่อเรียกใช้โมเดล (จึงยอมรับทั้งสไตล์ LangChain "human" และสไตล์ผู้ให้บริการ "user") 

    // ข้อแนะนำการใช้งาน

    // ถ้าจะให้ทีมอ่านง่ายและสอดคล้องกับเอกสารผู้ให้บริการหลายเจ้า แนะนำใช้ "user"/"assistant"/"system" เป็นหลัก ส่วน "human"/"ai" ถือเป็น alias ของ LangChain เท่านั้น (ผลเท่ากัน)

    // เมื่อส่ง “ประวัติแชต” ย้อนหลัง อย่าลืมใช้ assistant (หรือ ai) สำหรับข้อความตอบกลับก่อนหน้า และ system สำหรับคำสั่งตั้งต้น (system prompt) เพื่อให้โมเดลตีความบริบทถูกต้อง

    // ดึงชื่อโมเดลจริงจาก metadata (บาง provider ใส่ model หรือ model_name)
    const meta = response.response_metadata || {}
    const usedModel = meta.model || meta.model_name || "unknown"

    // ส่งกลับทั้งคำตอบและชื่อโมเดล (จะได้เห็นชัดว่า “ตอบจากโมเดลอะไร”)
    return NextResponse.json({
        content: response.content,
        usedModel,
    })

  } catch (error) {
        // Handle error
        console.error("Error:", error)
        return NextResponse.json({ error: "An error occurred" })
  }
}
```
Note: อย่าลืมตั้งค่า `OPENAI_API_KEY` ใน environment variables ของคุณ

**การทดสอบ:**
- POST: `http://localhost:3000/api/chat_01_start`
**Response:**
```json
{
  "content": "ฉันรักการเขียนโปรแกรม",
  "usedModel": "gpt-4o-mini"
}
```

#### Step 2: Request Processing (`/api/chat_02_request`)  
- การจัดการ HTTP requests
- Message parsing และ validation
- Error handling basics

สร้างไฟล์ `src/app/api/chat_02_request/route.ts` สำหรับขั้นตอนที่ 2

```typescript
import {NextRequest, NextResponse } from "next/server"
import { ChatOpenAI } from "@langchain/openai"

export async function POST(req: NextRequest) {

  // Example Payload
  // {
  //   "message": [
  //       {
  //           "role": "system",
  //           "content": "คุณเป็นจัดการฝ่ายการเงินของบริษัท คุญตอบคำถามให้พนักงานในบริษัทในเรื่องการเงิน"
  //       },
  //       {
  //           "role": "user",
  //           "content": "สวัสดีครับ ปกติบริษัทเราแบ่งงบการตลาดเป็นกี่เปอร์เซ็นต์ครับ"
  //       }
  //   ]
  // }

  // สร้างตัวแปรรับข้อมูลจาก client
  const body = await req.json()

  // ดึงข้อความจาก body 
  const message: [] = body.message ?? []

  // สร้าง instance ของ ChatOpenAI (Model ChatGPT)
    const model = new ChatOpenAI({
      model: "gpt-4o-mini",
      temperature: 0, // ความสร้างสรรค์ของคำตอบ มีระดับ 0-1 // 0 คือ ตอบตรง ๆ // 1 คือ ตอบแบบสร้างสรรค์
      maxTokens: 300, // จำนวนคำตอบสูงสุดที่ต้องการ 300 token
    })

  // try...catch เช็ค error 
  try {
    const response = await model.invoke(message)

    // ดึงชื่อโมเดลจริงจาก metadata (บาง provider ใส่ model หรือ model_name)
    const meta = response.response_metadata || {}
    const usedModel = meta.model || meta.model_name || "unknown"

    // ส่งกลับทั้งคำตอบและชื่อโมเดล (จะได้เห็นชัดว่า “ตอบจากโมเดลอะไร”)
    return NextResponse.json({
        content: response.content,
        usedModel,
    })

    } catch (error) {
        // Handle error
        console.error("Error:", error)
        return NextResponse.json({ error: "An error occurred" })
    }
}
```
**การทดสอบ:**
- POST: `http://localhost:3000/api/chat_02_request`
**Request Body:**
```json
{
  "message": [
      {
          "role": "system",
          "content": "คุณเป็นจัดการฝ่ายการเงินของบริษัท คุญตอบคำถามให้พนักงานในบริษัทในเรื่องการเงิน"
      },
      {
          "role": "user",
          "content": "สวัสดีครับ ปกติบริษัทเราแบ่งงบการตลาดเป็นกี่เปอร์เซ็นต์ครับ"
      }
  ]
}
```
**Response:**
```json
{
  "content": "ปกติแล้วบริษัทเราจะแบ่งงบการตลาดประมาณ 10-15% ของรายได้รวมของบริษัท แต่เปอร์เซ็นต์นี้อาจเปลี่ยนแปลงได้ขึ้นอยู่กับสถานการณ์ทางธุรกิจและเป้าหมายการตลาดในแต่ละปี",
  "usedModel": "gpt-4o-mini"
}
```

#### Step 3: Prompt Templates (`/api/chat_03_template`)
- การใช้ ChatPromptTemplate
- System prompt configuration
- Message history handling

สร้างไฟล์ `src/app/api/chat_03_template/route.ts` สำหรับขั้นตอนที่ 3

```typescript
import {NextRequest, NextResponse } from "next/server"
import { ChatOpenAI } from "@langchain/openai"
import { ChatPromptTemplate } from "@langchain/core/prompts"
import { StringOutputParser } from "@langchain/core/output_parsers"

export async function POST(req: NextRequest) {

  // Example Payload
  // {
  //   "message": [
  //       {
  //           "role": "user",
  //           "content": "สวัสดีครับ บริษัทเรามีงบด้านการวิจัย R & D หรือไม่ครับ"
  //       }
  //   ]
  // }

  // สร้างตัวแปรรับข้อมูลจาก client
  const body = await req.json()

  // ดึงข้อความจาก body - กำหนด type ให้ชัดเจน
  const messages: Array<{ role: string; content: string }> = body.message ?? []

  // กำหนดตัวแปร prompt template
  const prompt = ChatPromptTemplate.fromMessages([
    ['system', 'คุณเป็นจัดการฝ่ายการเงินของบริษัท คุญตอบคำถามให้พนักงานในบริษัทในเรื่องการเงิน'],
    ['user', '{question}']
  ])

  // สร้าง instance ของ ChatOpenAI (Model ChatGPT)
  const model = new ChatOpenAI({
    model: "gpt-4o-mini",
    temperature: 0, // ความสร้างสรรค์ของคำตอบ มีระดับ 0-1 // 0 คือ ตอบตรง ๆ // 1 คือ ตอบแบบสร้างสรรค์
    maxTokens: 300, // จำนวนคำตอบสูงสุดที่ต้องการ 300 token
  })

  // การสร้าง chain (prompt + model + output parser) 
  const chain = prompt.pipe(model).pipe(new StringOutputParser())

  // try...catch เช็ค error 
  try {
    const response = await chain.invoke({
      question: messages[0].content ?? "" // ดึงข้อความจากบทสนทนา (สมมติเอาข้อความจาก user เท่านั้น)
    })
    // ส่งกลับทั้งคำตอบและชื่อโมเดล (จะได้เห็นชัดว่า “ตอบจากโมเดลอะไร”)
    return NextResponse.json({
        content: response,
    })

    } catch (error) {
        // Handle error
        console.error("Error:", error)
        return NextResponse.json({ error: "An error occurred" })
    }
}
```
**การทดสอบ:**
- POST: `http://localhost:3000/api/chat_03_template`
**Request Body:**
```json
{
  "message": [
      {
          "role": "user",
          "content": "สวัสดีครับ บริษัทเรามีงบด้านการวิจัย R & D หรือไม่ครับ"
      }
  ]
}
```
**Response:**
```json
{
  "content": "ใช่ครับ บริษัทเรามีงบประมาณสำหรับการวิจัยและพัฒนา (R & D) เพื่อสนับสนุนการสร้างนวัตกรรมและปรับปรุงผลิตภัณฑ์ของเราอย่างต่อเนื่อง"
}
```

#### Step 4: Streaming Responses (`/api/chat_04_stream`)
- Real-time streaming implementation
- AI SDK integration
- Production-ready chat endpoint

สร้างไฟล์ `src/app/api/chat_04_stream/route.ts` สำหรับขั้นตอนที่ 4

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
**การทดสอบ:**
- POST: `http://localhost:3000/api/chat_04_stream`

**Request Body สำหรับ chat endpoints:**
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
**Response:**
```
data: {"type":"text","text":"Hello! How can I assist you today?"}
data: [DONE]
```

## เสริมความรู้เรื่อง Edge Runtime

## 🔧 Edge Runtime คืออะไร

Edge Runtime เป็น JavaScript runtime ที่เบาและรวดเร็ว ซึ่งใช้ Web APIs แทน Node.js APIs เพื่อให้สามารถทำงานได้ในสภาพแวดล้อม edge computing

## ⚡ ข้อแตกต่างหลัก

### 1. **Runtime Environment**
- **Edge Runtime**: ใช้ Web APIs (เช่น fetch, Headers, Response)
- **Node.js Runtime**: ใช้ Node.js APIs (เช่น fs, path, buffer)

### 2. **เวลาในการเริ่มต้น (Cold Start)**
- **Edge Runtime**: เร็วมาก (~0ms)
- **Node.js Runtime**: ช้ากว่า (~100-500ms)

### 3. **ขนาดและหน่วยความจำ**
- **Edge Runtime**: เบาและใช้หน่วยความจำน้อย
- **Node.js Runtime**: หนักกว่าและใช้หน่วยความจำมาก

## 🚀 ข้อดีของ Edge Runtime

1. **ประสิทธิภาพสูง**: Cold start ที่เร็วมาก
2. **ค่าใช้จ่ายต่ำ**: ใช้ทรัพยากรน้อยกว่า
3. **การกระจาย**: ทำงานใกล้ผู้ใช้มากขึ้น
4. **ความปลอดภัย**: สภาพแวดล้อมที่ปลอดภัยกว่า

## ⚠️ ข้อจำกัดของ Edge Runtime

### 1. **Node.js APIs ไม่รองรับ**
```javascript
// ❌ ไม่สามารถใช้ได้ใน Edge Runtime
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

// ✅ สามารถใช้ได้ใน Edge Runtime
const response = await fetch('https://api.example.com')
const data = await response.json()
```

### 2. **การจำกัดขนาดและเวลา**
- **ขนาดโค้ด**: จำกัดอยู่ที่ประมาณ 1MB
- **เวลาทำงาน**: จำกัดเวลาการทำงาน (เช่น 30 วินาที)
- **หน่วยความจำ**: จำกัดการใช้หน่วยความจำ

### 3. **ไลบรารีบางตัวใช้ไม่ได้**
```javascript
// ❌ ไลบรารีที่ใช้ Node.js APIs
import bcrypt from 'bcryptjs'
import sharp from 'sharp'

// ✅ ไลบรารีที่รองรับ Edge Runtime
import { nanoid } from 'nanoid'
import { encode, decode } from 'base64-arraybuffer'
```

## 📋 การใช้งานใน Next.js API Routes

### กำหนดให้ใช้ Edge Runtime
```typescript
// src/app/api/chat/route.ts
export const runtime = "edge" // กำหนดให้ใช้ Edge Runtime
export const maxDuration = 30 // จำกัดเวลาการทำงาน (วินาที)

export async function POST(req: NextRequest) {
  // API logic ที่รองรับ Edge Runtime
}
```

### ตัวอย่างการเปรียบเทียบ
```typescript
// ❌ Node.js Runtime - ช้าในการเริ่มต้น
export async function POST(req: NextRequest) {
  const fs = require('fs')
  const data = fs.readFileSync('./data.json')
  return NextResponse.json({ data })
}

// ✅ Edge Runtime - เร็วในการเริ่มต้น
export const runtime = "edge"
export async function POST(req: NextRequest) {
  const response = await fetch('https://api.example.com/data')
  const data = await response.json()
  return NextResponse.json({ data })
}
```

## 🎯 เหมาะสำหรับงานประเภทไหน

### ✅ **เหมาะสำหรับ:**
- AI/ML APIs ที่ใช้ streaming
- APIs ที่ต้องการความเร็วสูง
- การประมวลผลข้อมูลเบาๆ
- Middleware และ authentication
- การเรียก external APIs

### ❌ **ไม่เหมาะสำหรับ:**
- การจัดการไฟล์และ file system
- การเชื่อมต่อฐานข้อมูลที่ซับซ้อน
- การประมวลผลข้อมูลหนักๆ
- การใช้ Node.js libraries เก่า

## 💡 **สรุป**

Edge Runtime เป็นทางเลือกที่ยอดเยี่ยมสำหรับ AI chatbot APIs เพราะให้ประสิทธิภาพที่สูงและการตอบสนองที่รวดเร็ว แต่ต้องระวังข้อจำกัดในการใช้ Node.js APIs

**ข้อแนะนำ:**
- ใช้ Edge Runtime สำหรับ APIs ที่ต้องการความเร็ว
- ใช้ Node.js Runtime สำหรับงานที่ต้องการ Node.js APIs
- ทดสอบให้แน่ใจว่าไลบรารีที่ใช้รองรับ Edge Runtime