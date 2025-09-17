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