# AI Chatbot with LangChain & Next.js - Day 3
## 📚 สารบัญ
- [การติดตั้งและตั้งค่า](#-การติดตั้งและตั้งค่า)
- [โครงสร้างโปรเจ็กต์](#-โครงสร้างโปรเจ็กต์)
- [LangChain Tutorial Endpoints (Continue)](#-langchain-tutorial-endpoints-continue)
- [เสริมความรู้เรื่อง Edge Runtime](#-เสริมความรู้เรื่อง-edge-runtime)
- [สรุป](#-สรุป)

## 🛠️ การติดตั้งและตั้งค่า
1. **Clone โปรเจ็กต์:**
   ```bash
  git clone <repository-url>
  cd aichatbot-langchain-nextjs
  ```
2. **ติดตั้ง dependencies:**
    ```bash
    npm install
    ```
3. **ตั้งค่า environment variables:**
   สร้างไฟล์ `.env` ในโฟลเดอร์หลัก:
   ```env
    OPENAI_API_KEY=your_openai_api_key_here
    ```
4. **รัน development server:**
    ```bash
    npm run dev
    ```
5. **เปิดเบราว์เซอร์:**
   ไปที่ [http://localhost:3000](http://localhost:3000) เพื่อดูแอปพลิเคชัน

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

## 🏁 สรุป
ในวันนี้เราได้เรียนรู้เกี่ยวกับการสร้าง API endpoints สำหรับ AI chatbot โดยใช้ LangChain และ Next.js รวมถึงการใช้งาน Edge Runtime เพื่อเพิ่มประสิทธิภาพของแอปพลิเคชัน
- เราได้สร้าง API endpoints ที่รองรับการสนทนาแบบ streaming
- เราได้เรียนรู้ข้อดีและข้อจำกัดของ Edge Runtime
- เราได้เห็นตัวอย่างการใช้งาน Edge Runtime ใน Next.js API routes
- เราได้เข้าใจว่า Edge Runtime เหมาะสำหรับงานประเภทไหนบ้าง
หวังว่าคุณจะสามารถนำความรู้ที่ได้ไปพัฒนา AI chatbot ของคุณ

## 🤝 การมีส่วนร่วม
หากคุณมีข้อเสนอแนะหรืออยากมีส่วนร่วมในการพัฒนาโปรเจ็กต์นี้ โปรดเปิด issue หรือส่ง pull request บน GitHub repository ของเรา!
เรายินดีต้อนรับทุกคนที่สนใจในการพัฒนา AI chatbot ร่วมกับเรา!

## 🧠 เสริมความรู้เรื่อง AIMessage จาก LangChain

AIMessage เป็นโครงสร้างข้อมูลที่ LangChain ใช้ในการเก็บการตอบสนองจาก AI models ซึ่งมีข้อมูลครบถ้วนทั้งเนื้อหาคำตอบและ metadata ต่างๆ

### 🔧 ตัวอย่างการใช้งาน AzureChatOpenAI

```typescript
import { AzureChatOpenAI } from "@langchain/openai"

// สร้าง instance ของ AzureChatOpenAI
const model = new AzureChatOpenAI({
    model: "gpt-5-mini",
    maxTokens: 1024,
    maxRetries: 2,
    azureOpenAIApiKey: process.env.AZURE_OPENAI_API_KEY,
    azureOpenAIApiInstanceName: process.env.AZURE_OPENAI_API_INSTANCE_NAME,
    azureOpenAIApiDeploymentName: process.env.AZURE_OPENAI_API_DEPLOYMENT_NAME,
    azureOpenAIApiVersion: process.env.AZURE_OPENAI_API_VERSION,
})

// กำหนดข้อความที่ต้องการแปล
const input = `Translate "I love programming" into Thai.`

// Model จะทำการแปลข้อความ
const response = await model.invoke(input)

// แสดงผลลัพธ์
console.log(response) // ผลลัพธ์: ฉันรักการเขียนโปรแกรม
```

### 📊 โครงสร้าง AIMessage Response

เมื่อเรียกใช้ model.invoke() จะได้ AIMessage object กลับมาดังนี้:

```typescript
AIMessage {
  "id": "chatcmpl-CELK14G3uApbfFaG8pgtc2jtFTE4F",
  "content": "\"ฉันรักการเขียนโปรแกรม\"\n\n(If a male speaker prefers: \"ผมรักการเขียนโปรแกรม\")  \nPronunciation (approx.): chan rak gaan kian pro-gram",
  "additional_kwargs": {},
  "response_metadata": {
    "tokenUsage": {
      "promptTokens": 15,
      "completionTokens": 499,
      "totalTokens": 514
    },
    "finish_reason": "stop",
    "model_name": "gpt-5-mini-2025-08-07"
  },
  "tool_calls": [],
  "invalid_tool_calls": [],
  "usage_metadata": {
    "output_tokens": 499,
    "input_tokens": 15,
    "total_tokens": 514,
    "input_token_details": {
      "audio": 0,
      "cache_read": 0
    },
    "output_token_details": {
      "audio": 0,
      "reasoning": 448
    }
  }
}
```

## 🔍 อธิบายแต่ละส่วนของ AIMessage

### ส่วนหลัก (Top-Level Fields) 🎯

#### `id: "chatcmpl-CELK14G3uApbfFaG8pgtc2jtFTE4F"`
เป็น **ID เฉพาะ** ของการสนทนานี้ ใช้สำหรับอ้างอิงหรือติดตามปัญหาในระบบหลังบ้านของ Azure

#### `content: "ฉันรักการเขียนโปรแกรม"...`
นี่คือส่วนที่**สำคัญที่สุด** เป็น **คำตอบที่เป็นข้อความ** ที่ AI สร้างขึ้นเพื่อตอบคำถามของคุณโดยตรง

#### `additional_kwargs: {}`
เป็นที่สำหรับเก็บ**ข้อมูลเพิ่มเติม**ที่ไม่ได้อยู่ในมาตรฐานทั่วไป ในกรณีนี้คือว่างเปล่า

#### `tool_calls` และ `invalid_tool_calls: []`
หาก AI ตัดสินใจว่าต้องเรียกใช้ **"เครื่องมือ"** หรือ **"ฟังก์ชัน"** ที่เรากำหนดไว้ ข้อมูลการเรียกใช้นั้นจะมาอยู่ในส่วนนี้ แต่ในกรณีนี้ AI แค่ตอบเป็นข้อความธรรมดา ส่วนนี้จึงว่างเปล่า

### response_metadata (ข้อมูลจาก API โดยตรง) 📊

ส่วนนี้คือ**ข้อมูลดิบ**ที่ Azure OpenAI API ส่งกลับมาโดยตรง LangChain นำมาใส่ไว้ในส่วนนี้

#### `tokenUsage:`
- **`promptTokens: 15`** → คำถามของคุณ ("Translate 'I love programming' into Thai.") ถูกแปลงเป็น Token ได้ 15 ชิ้น
- **`completionTokens: 499`** → คำตอบที่ AI สร้างขึ้น ใช้ไป 499 Tokens
- **`totalTokens: 514`** → รวม Token ที่ใช้ไปทั้งหมดในการเรียก API ครั้งนี้ (15 + 499) ซึ่งเป็นตัวเลขที่ใช้ในการคิดค่าบริการ

#### `finish_reason: "stop"`
นี่คือ**สถานะการจบการทำงาน**ที่สมบูรณ์ หมายความว่า AI สร้างคำตอบเสร็จสิ้นแล้ว และหยุดทำงานเอง (ไม่เหมือนกับ "length" ที่แปลว่าถูกตัดจบเพราะชนเพดาน maxTokens)

#### `model_name: "gpt-5-mini-2025-08-07"`
**ชื่อและเวอร์ชัน**ของโมเดลที่ใช้ในการประมวลผลคำขอของคุณ

### usage_metadata (ข้อมูลการใช้งานโดย LangChain) 📈

ส่วนนี้เป็นการสรุปข้อมูลการใช้งานในรูปแบบของ LangChain ซึ่งมักจะคล้ายกับ tokenUsage แต่บางครั้งอาจมีรายละเอียดเพิ่มเติม

#### `output_tokens, input_tokens, total_tokens:`
เป็นการสรุป**จำนวน Token ที่ใช้** เหมือนกับ tokenUsage ด้านบน

#### `input_token_details` และ `output_token_details:`
เป็นการ**แยกแยะประเภท**ของ Token ที่ใช้ ในกรณีนี้ `output_token_details` บอกว่า `reasoning: 448` หมายถึงใน 499 โทเค็นที่สร้างขึ้นมา ส่วนใหญ่ถูกใช้ไปในกระบวนการ **"คิดวิเคราะห์"** (reasoning) เพื่อให้ได้คำตอบที่ถูกต้องออกมา

## 💡 การใช้งาน AIMessage ในแอปพลิเคชัน

### 1. **การดึงข้อความออกมาใช้**
```typescript
const response = await model.invoke(input)
const textContent = response.content // ได้ข้อความตอบกลับ
```

### 2. **การตรวจสอบการใช้ Token**
```typescript
const response = await model.invoke(input)
const totalTokens = response.response_metadata.tokenUsage.totalTokens
console.log(`ใช้ Token ทั้งหมด: ${totalTokens}`)
```

### 3. **การตรวจสอบสถานะการจบงาน**
```typescript
const response = await model.invoke(input)
if (response.response_metadata.finish_reason === "stop") {
  console.log("AI ตอบครบถ้วนแล้ว")
} else if (response.response_metadata.finish_reason === "length") {
  console.log("AI ตอบไม่เสร็จเพราะถึงขีดจำกัด Token")
}
```

### 4. **การตรวจสอบ Tool Calls**
```typescript
const response = await model.invoke(input)
if (response.tool_calls.length > 0) {
  console.log("AI ต้องการเรียกใช้ฟังก์ชัน:", response.tool_calls)
}
```

## 🔧 Environment Variables สำหรับ Azure OpenAI

```env
# Azure OpenAI Configuration
AZURE_OPENAI_API_KEY=your_azure_api_key
AZURE_OPENAI_API_INSTANCE_NAME=your_instance_name
AZURE_OPENAI_API_DEPLOYMENT_NAME=your_deployment_name
AZURE_OPENAI_API_VERSION=2024-02-15-preview
```

## ⚡ ข้อแตกต่างระหว่าง OpenAI และ Azure OpenAI

| ฟีเจอร์ | OpenAI | Azure OpenAI |
|---------|---------|--------------|
| **การรักษาความปลอดภัย** | มาตรฐาน | Enterprise-grade security |
| **การควบคุมข้อมูล** | ข้อมูลอาจถูกใช้ในการฝึก | ข้อมูลไม่ถูกใช้ในการฝึก |
| **SLA** | ไม่มี SLA รับประกัน | มี SLA 99.9% |
| **การจัดการ** | API keys | Azure AD authentication |
| **ราคา** | Pay-per-use | Managed pricing |

## 🎯 Best Practices

1. **ตรวจสอบ Token Usage เสมอ** เพื่อควบคุมค่าใช้จ่าย
2. **Handle Error Cases** สำหรับ finish_reason ที่ไม่ใช่ "stop"
3. **Log Request ID** สำหรับการ debug และ troubleshooting
4. **ใช้ Environment Variables** สำหรับ sensitive data
5. **Monitor Performance** ด้วย response metadata

---

## 🔐 การตั้งค่า Supabase Authentication

### 1. สร้าง Supabase Project

#### ขั้นตอนการสร้างโปรเจ็กต์ใหม่:
1. **เข้าไปที่** [https://supabase.com](https://supabase.com)
2. **สร้างโปรเจ็กต์ใหม่** โดยกรอกข้อมูล:
   - **Organization**: เลือก organization ของคุณ
   - **Project name**: `ai-chatbot-langchain-nextjs`
   - **Database password**: สร้างรหัสผ่านที่แข็งแรง (ระบบจะสร้างให้อัตโนมัติ)
   - **Region**: เลือก `Southeast Asia (Singapore)` เพื่อความเร็วที่ดีที่สุด
3. **กดปุ่ม** "Create new project"
4. **รอให้โปรเจ็กต์สร้างเสร็จ** (ประมาณ 2-3 นาที)

#### การตั้งค่า Environment Variables:
หลังจากสร้างโปรเจ็กต์เสร็จ ให้คัดลอกข้อมูลต่อไปนี้มาใส่ในไฟล์ `.env.local`:

```env
# === Supabase config =====
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url-here
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY=your-supabase-publishable-or-anon-key-here
```

### 2. การตั้งค่า Shadcn/UI

#### ติดตั้ง Shadcn/UI สำหรับ Next.js:
```bash
# ติดตั้ง Shadcn/UI ในโปรเจ็กต์
npx shadcn@latest init
```

#### การตั้งค่าเริ่มต้น:
- **TypeScript**: Yes
- **Style**: Default
- **Color**: Slate
- **CSS file**: src/app/globals.css
- **Tailwind config**: tailwind.config.ts
- **Components**: src/components
- **Utils**: src/lib/utils

### 3. การติดตั้ง Supabase UI Library

#### ติดตั้งแพ็คเกจ Authentication จาก Supabase UI:
```bash
# ติดตั้ง Password-based Authentication components
npx shadcn@latest add https://supabase.com/ui/r/password-based-auth-nextjs.json
```

#### แพ็คเกจที่ติดตั้งเพิ่มเติม:
```json
{
  "@supabase/ssr": "^0.7.0",
  "@supabase/supabase-js": "^2.56.0",
  "@radix-ui/react-label": "^2.1.7",
  "@radix-ui/react-slot": "^1.2.3",
  "class-variance-authority": "^0.7.1",
  "clsx": "^2.1.1",
  "lucide-react": "^0.541.0",
  "tailwind-merge": "^3.3.1"
}
```

### 4. โครงสร้างโปรเจ็กต์หลังจากติดตั้งเสร็จ

```
aichatbot-langchain-nextjs/
├── src/
│   ├── app/
│   │   ├── auth/
│   │   │   ├── confirm/
│   │   │   │   └── route.ts          # Email confirmation endpoint
│   │   │   ├── error/
│   │   │   │   └── page.tsx          # Authentication error page
│   │   │   ├── forgot-password/
│   │   │   │   └── page.tsx          # Forgot password page
│   │   │   ├── login/
│   │   │   │   └── page.tsx          # Login page
│   │   │   ├── sign-up/
│   │   │   │   └── page.tsx          # Registration page
│   │   │   ├── sign-up-success/
│   │   │   │   └── page.tsx          # Registration success page
│   │   │   └── update-password/
│   │   │       └── page.tsx          # Update password page
│   │   ├── api/
│   │   │   ├── chat/
│   │   │   │   └── route.ts          # Chat API endpoint
│   │   │   ├── chat_01_start/
│   │   │   │   └── route.ts          # Step 1: Basic chat setup
│   │   │   ├── chat_02_request/
│   │   │   │   └── route.ts          # Step 2: Request handling
│   │   │   ├── chat_03_template/
│   │   │   │   └── route.ts          # Step 3: Prompt templates
│   │   │   ├── chat_04_stream/
│   │   │   │   └── route.ts          # Step 4: Streaming responses
│   │   │   ├── test/
│   │   │   │   └── route.ts          # Test API endpoint
│   │   │   └── route.ts              # Base API routes
│   │   ├── chat/
│   │   │   ├── layout.tsx            # Chat layout (protected)
│   │   │   └── page.tsx              # Chat interface (authenticated)
│   │   ├── globals.css               # Global styles with Tailwind
│   │   ├── layout.tsx                # Root layout
│   │   └── page.tsx                  # Landing/home page
│   ├── components/
│   │   ├── ui/
│   │   │   ├── button.tsx            # Button component
│   │   │   ├── card.tsx              # Card component
│   │   │   ├── input.tsx             # Input component
│   │   │   └── label.tsx             # Label component
│   │   ├── forgot-password-form.tsx  # Forgot password form
│   │   ├── login-form.tsx            # Login form component
│   │   ├── logout-button.tsx         # Logout button component
│   │   ├── sign-up-form.tsx          # Registration form component
│   │   └── update-password-form.tsx  # Update password form
│   ├── lib/
│   │   ├── clients.ts                # Supabase client configurations
│   │   ├── middlewares.ts            # Authentication middlewares
│   │   ├── server.ts                 # Server-side Supabase utilities
│   │   └── utils.ts                  # Utility functions
│   └── middlewares.ts                # Next.js middleware for auth
├── public/                           # Static assets
├── .env.local                        # Environment variables (สร้างไฟล์นี้)
├── .env.example                      # Template สำหรับ environment variables
├── components.json                   # Shadcn/UI configuration
├── Day1_Note.md                      # บันทึกการอบรม Day 1
├── Day2_Note.md                      # บันทึกการอบรม Day 2
├── Day3_Note.md                      # บันทึกการอบรม Day 3 (ไฟล์นี้)
├── eslint.config.mjs                 # ESLint configuration
├── next.config.ts                    # Next.js configuration
├── package.json                      # Dependencies และ scripts
├── postcss.config.mjs                # PostCSS configuration
├── tailwind.config.ts                # Tailwind CSS configuration
├── tsconfig.json                     # TypeScript configuration
└── README.md                         # Documentation
```

### 5. ไฟล์ Environment Variables ที่สมบูรณ์

สร้างไฟล์ `.env.local` จากตัวอย่างใน `.env.example`:

```env
# === Supabase config =====
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY=your-anon-key

# === OPENAI (ChatGPT) =====
OPENAI_API_KEY=your-openai-api-key
OPENAI_MODEL_NAME="gpt-4o-mini"

# === GOOGLE (Gemini) =====
GOOGLE_API_KEY=your-google-api-key
GOOGLE_MODEL_NAME="gemini-2.5-flash"

# === MS AZURE =====
AZURE_OPENAI_API_KEY=your-azure-openai-api-key
AZURE_OPENAI_API_INSTANCE_NAME=your-azure-openai-instance-name
AZURE_OPENAI_API_DEPLOYMENT_NAME=gpt-5-mini-2
AZURE_OPENAI_API_VERSION=2024-04-01-preview
AZURE_OPENAI_API_MODEL_NAME="gpt-5-mini"
```

### 6. คุณสมบัติที่ได้จากการติดตั้ง

#### 🔐 **Authentication Features:**
- **User Registration** - การสมัครสมาชิกด้วย email/password
- **User Login** - การเข้าสู่ระบบ
- **Password Reset** - การรีเซ็ตรหัสผ่าน
- **Email Confirmation** - การยืนยันอีเมล
- **Protected Routes** - การป้องกันหน้าที่ต้องเข้าสู่ระบบ
- **Session Management** - การจัดการ session อัตโนมัติ

#### 🎨 **UI Components:**
- **Modern Design** - UI components ที่สวยงามและทันสมัย
- **Responsive** - ใช้งานได้ทั้งเดสก์ท็อปและมือถือ
- **Accessible** - รองรับ screen readers และ keyboard navigation
- **Customizable** - สามารถปรับแต่งสีและรูปแบบได้ง่าย

#### ⚡ **Performance Benefits:**
- **Server-Side Rendering** - ความเร็วในการโหลดหน้าเว็บ
- **Edge Runtime** - ประสิทธิภาพสูงสำหรับ API
- **Automatic Code Splitting** - โหลดเฉพาะโค้ดที่จำเป็น
- **TypeScript Support** - การพัฒนาที่ปลอดภัยและรวดเร็ว

### 7. ขั้นตอนต่อไป

1. **ตั้งค่า Supabase Database** - สร้างตารางสำหรับ chat history
2. **เชื่อมต่อ Authentication** - ผูกระบบ auth เข้ากับ chat interface
3. **สร้าง User Profile** - เก็บข้อมูลผู้ใช้เพิ่มเติม
4. **Chat History** - บันทึกประวัติการสนทนา
5. **Real-time Features** - การแชทแบบ real-time

---

## 🎉 สรุป Day 3

ในวันนี้เราได้เรียนรู้และติดตั้ง:

✅ **Supabase Project** - ฐานข้อมูลและ authentication ในระบบคลาวด์  
✅ **Shadcn/UI** - UI component library ที่ทันสมัย  
✅ **Supabase UI Library** - Authentication components ที่พร้อมใช้งาน  
✅ **Environment Configuration** - การตั้งค่าตัวแปรสิ่งแวดล้อม  
✅ **Project Structure** - โครงสร้างโปรเจ็กต์ที่เป็นระเบียบ  

ตอนนี้โปรเจ็กต์พร้อมสำหรับการพัฒนา AI Chatbot ที่มีระบบ authentication แล้ว! day 3 done 🚀

