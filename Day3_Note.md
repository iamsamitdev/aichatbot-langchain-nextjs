# AI Chatbot with LangChain & Next.js - Day 3

## 📁 โครงสร้างโปรเจ็กต์

```
aichatbot-langchain-nextjs/
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
├── .env                              # Environment variables
├── eslint.config.mjs                 # ESLint configuration
├── next.config.ts                    # Next.js configuration
├── package.json                      # Dependencies และ scripts
├── postcss.config.mjs                # PostCSS configuration
├── tailwind.config.ts                # Tailwind CSS configuration
├── tsconfig.json                     # TypeScript configuration
└── README.md                         # Documentation
```
## 🎯 LangChain Tutorial Endpoints (Continue)

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