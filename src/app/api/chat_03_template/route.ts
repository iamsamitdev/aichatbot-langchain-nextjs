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
    ['system', 'คุณเป็นจัดการฝ่ายการเงินของบริษัท คุณตอบคำถามให้พนักงานในบริษัทในเรื่องการเงิน'],
    ['user', '{question}']
  ])

  // สร้าง instance ของ ChatOpenAI (Model ChatGPT)
  const model = new ChatOpenAI({
    model: process.env.OPENAI_MODEL_NAME || "gpt-4o-mini",
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