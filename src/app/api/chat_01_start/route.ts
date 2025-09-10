import { NextResponse } from "next/server"
import { ChatOpenAI, AzureChatOpenAI } from "@langchain/openai"

// Example
// const llm = new ChatOpenAI({
//     model: "gpt-4o-mini", // ชื่อโมเดล
//     temperature: 0.7, // ความสร้างสรรค์ของคำตอบ มีระดับ 0-1
//     maxTokens: 100, // จำนวนคำตอบสูงสุดที่ต้องการ
//     timeout: 60, // ระยะเวลาในการรอคำตอบ
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
        temperature: 0.7, // ความสร้างสรรค์ของคำตอบ มีระดับ 0-1 // 0 คือ ตอบตรง ๆ // 1 คือ ตอบแบบสร้างสรรค์
        maxTokens: 300, // จำนวนคำตอบสูงสุดที่ต้องการ 300 token
    })

    // สร้าง instance ของ ChatOpenAI (OpenRouter)
    // const model = new ChatOpenAI({
    //     apiKey: process.env.OPENROUTER_API_KEY,
    //     model: process.env.OPENAI_MODEL_NAME, // ชื่อโมเดลที่ต้องการใช้
    //     cache: false, // ปิดใช้งาน cache
    //     temperature: 0.7, // ความสร้างสรรค์ของคำตอบ มีระดับ 0-1 // 0 คือ ตอบตรง ๆ // 1 คือ ตอบแบบสร้างสรรค์
    //     maxTokens: 1000, // จำนวนคำตอบสูงสุดที่ต้องการ 1000 token
    //         configuration: {
    //         baseURL: process.env.OPENROUTER_API_BASE,
    //     },
           // ถ้า provider ไม่รองรับ stream usage ให้ปิดได้ (บาง proxy ต้องการ)
    //     streamUsage: false,
    // })

    // สร้าง instance ของ Ollama (Local) - ใช้ ChatOpenAI กับ baseURL ของ Ollama
    // const model = new ChatOpenAI({
    //     model: process.env.OPENAI_MODEL_NAME || "gemma:2b", // ชื่อโมเดลที่ต้องการใช้
    //     temperature: 0.7,
    //     maxTokens: 1000,
    //     configuration: {
    //         baseURL: process.env.OLLAMA_API_BASE || "http://localhost:11434/v1", // URL ของ Ollama API
    //     },
    //     apiKey: "ollama", // Ollama ไม่ต้องการ API key จริง แต่ต้องใส่ค่าอะไรก็ได้
    // })


    // สร้าง instance ของ Ollama (Local) - ใช้ ChatOpenAI กับ baseURL ของ Ollama
    // const model = new AzureChatOpenAI({
    //     model: "gpt-5-mini",
    //     temperature: 0.7,
    //     maxTokens: 300,
    //     maxRetries: 2,
    //     azureOpenAIApiKey: process.env.AZURE_OPENAI_API_KEY,
    //     azureOpenAIApiInstanceName: process.env.AZURE_OPENAI_API_INSTANCE_NAME,
    //     azureOpenAIApiDeploymentName: process.env.AZURE_OPENAI_API_DEPLOYMENT_NAME,
    //     azureOpenAIApiVersion: process.env.AZURE_OPENAI_API_VERSION,
    // })

    // กำหนดข้อความที่ต้องการแปล
    // const input = `Translate "I love programming" into Thai.`

    // Model จะทำการแปลข้อความ
    // const response = await model.invoke(input)

    // แสดงผลลัพธ์
    // console.log(response) // ผลลัพธ์: ฉันรักการเขียนโปรแกรม

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