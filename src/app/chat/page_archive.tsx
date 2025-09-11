// rfce
'use client'

import { useState } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'

function Chat() {

  // ใช้ useChat hook เพื่อจัดการสถานะการสนทนา
  const { messages, sendMessage, status  } = useChat({
    transport: new DefaultChatTransport({
        api: "/api/chat_04_stream", // เปลี่ยนเป็น API ที่ต้องการใช้
    })
  })

  // ตัวอย่างการใช้ useState เพื่อเก็บข้อความในช่อง input
  const [input, setInput] = useState("")

  console.log("Input:", input)

  return (
    <div className="max-w-3xl mx-auto w-full mt-20">

        {/* แสดง Form Input chat message */}
        <form onSubmit={e => {
            e.preventDefault() // ป้องกันการรีเฟรชหน้า
            sendMessage({ text: input }) // ส่งข้อความไปยัง AI
            setInput("") // ล้างช่อง input หลังส่งข้อความ
        }}>
          <input type="text" value={input} onChange={e => setInput(e.target.value)} />
          <button type="submit">Send</button>
        </form>

        {/* แสดงสถานะการพิมพ์ของ AI */}
        {
            (status === 'submitted' || status === 'streaming') && 
            <div>AI กำลังคิด...</div>
        }

        {/* แสดง Messages */}
        {messages.map(m => (
           <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div>
                    {m.parts.map((part, index) => 
                        part.type === 'text' ? (
                            <div key={index} className="whitespace-pre-wrap">{part.text}</div>
                        ) : null
                    )}
                </div>
           </div> 
        ))}
    </div>
  )
}

export default Chat