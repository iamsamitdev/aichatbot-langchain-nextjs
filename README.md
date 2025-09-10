# AI Chatbot ด้วย LangChain & Next.js

แอปพลิเคชัน AI Chatbot ที่สร้างด้วย [Next.js 15](https://nextjs.org) และ [LangChain](https://langchain.com) มีฟีเจอร์การตอบสนองแบบ real-time streaming และใช้ React patterns ที่ทันสมัย

## 🚀 ฟีเจอร์หลัก

- **หน้าต่างแชทแบบ Real-time**: สร้างด้วย AI SDK React hooks เพื่อประสบการณ์ผู้ใช้ที่ลื่นไหล
- **การตอบสนองแบบ Streaming**: AI ตอบกลับแบบ real-time เพื่อ UX ที่ดีขึ้น
- **การรวม LangChain**: ใช้ LangChain สำหรับการจัดการการสนทนา AI ขั้นสูง
- **OpenAI GPT-4**: ขับเคลื่อนด้วยโมเดล GPT-4o-mini ของ OpenAI
- **UI ที่ทันสมัย**: อินเทอร์เฟซแชทที่สะอาดและ responsive ด้วย Tailwind CSS
- **Next.js 15 App Router**: ใช้ฟีเจอร์ล่าสุดของ Next.js และ file-based routing

## 🛠️ เทคโนโลยีที่ใช้

- **Frontend**: Next.js 15, React, TypeScript, Tailwind CSS
- **AI/ML**: LangChain, OpenAI API, AI SDK
- **Backend**: Next.js API Routes (Edge Runtime)
- **Styling**: Tailwind CSS

## 📋 สิ่งที่ต้องเตรียมก่อนเริ่ม

ก่อนเริ่มต้น ตรวจสอบให้แน่ใจว่าคุณได้ติดตั้งสิ่งต่อไปนี้แล้ว:

- **Node.js 20 ขึ้นไป**
- **npm** หรือ **yarn**
- **Git**
- **OpenAI API Key**

### ตรวจสอบการติดตั้ง
```bash
# ตรวจสอบเวอร์ชัน Node.js
node -v
npm -v

# ตรวจสอบ Git
git version

# ตรวจสอบ VS Code (เสริม)
code --version
```

## 🔧 การติดตั้งและตั้งค่า

1. **โคลน repository**
```bash
git clone <repository-url>
cd aichatbot-langchain-nextjs
```

2. **ติดตั้ง dependencies**
```bash
npm install
```

3. **ตั้งค่า environment variables**
สร้างไฟล์ `.env.local` ในโฟลเดอร์หลัก:
```env
OPENAI_API_KEY=your_openai_api_key_here
```

4. **รัน development server**
```bash
npm run dev
```

5. **เปิดเบราว์เซอร์**
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

### 📝 คำอธิบายโครงสร้าง API

- **`/api/route.ts`**: API endpoints พื้นฐาน (GET, POST, PUT, DELETE) สำหรับทดสอบ
- **`/api/test/route.ts`**: API สำหรับทดสอบการรับและส่งข้อมูล พร้อม query parameters
- **`/api/chat/route.ts`**: Chat API หลักที่ใช้ในการผลิต (production)
- **`/api/chat_01_start/`**: ขั้นตอนที่ 1 - การตั้งค่า chat พื้นฐาน
- **`/api/chat_02_request/`**: ขั้นตอนที่ 2 - การจัดการ HTTP requests

## 🎯 Dependencies สำคัญ

```json
{
  "langchain": "เฟรมเวิร์กสำหรับแอป AI ขั้นสูง",
  "@ai-sdk/langchain": "ตัวเชื่อมต่อ LangChain สำหรับ AI SDK",
  "@ai-sdk/react": "React hooks สำหรับแอป AI",
  "@langchain/core": "ฟังก์ชันหลักของ LangChain",
  "@langchain/openai": "การรวม OpenAI สำหรับ LangChain",
  "ai": "AI SDK สำหรับ streaming และการจัดการข้อความ"
}
```

## 📜 Scripts ที่มีให้ใช้

```bash
npm run dev      # เริ่ม development server
npm run build    # สร้าง production build
npm run start    # เริ่ม production server
npm run lint     # รัน ESLint
```

## 🔌 API Endpoints

### POST /api/chat
Endpoint หลักสำหรับจัดการการสนทนากับ AI

**ฟีเจอร์:**
- การตอบสนองแบบ streaming
- LangChain prompt templates
- การจัดการ error
- Edge runtime สำหรับประสิทธิภาพที่ดีกว่า

**Request Body:**
```json
{
  "messages": [
    {
      "id": "message-id",
      "role": "user",
      "parts": [{"type": "text", "text": "สวัสดี AI!"}]
    }
  ]
}
```

## 🎨 UI Components

อินเทอร์เฟซแชทประกอบด้วย:
- **Header**: ชื่อแอปพลิเคชันและแบรนด์
- **พื้นที่ข้อความ**: ประวัติแชทที่เลื่อนได้พร้อมฟองข้อความของผู้ใช้/AI
- **พื้นที่ Input**: ช่องป้อนข้อความพร้อมปุ่มส่งและตัวบ่งชี้การพิมพ์
- **Responsive Design**: ใช้งานได้ทั้งเดสก์ท็อปและมือถือ

## 🔐 Environment Variables

| ตัวแปร | คำอธิบาย | จำเป็น |
|--------|----------|--------|
| `OPENAI_API_KEY` | OpenAI API key ของคุณ | ใช่ |

## 🚀 การ Deploy

### Vercel (แนะนำ)
1. Push โค้ดของคุณไปยัง GitHub
2. เชื่อมต่อ repository ของคุณกับ [Vercel](https://vercel.com)
3. เพิ่ม environment variables ใน Vercel dashboard
4. Deploy!

### แพลตฟอร์มอื่นๆ
แอปพลิเคชัน Next.js นี้สามารถ deploy ได้บนแพลตฟอร์มใดก็ได้ที่รองรับ Node.js applications

## 📚 แหล่งเรียนรู้

- [เอกสาร Next.js](https://nextjs.org/docs)
- [เอกสาร LangChain](https://langchain.com/docs)
- [เอกสาร AI SDK](https://sdk.vercel.ai)
- [เอกสาร OpenAI API](https://platform.openai.com/docs)

## 🤝 การมีส่วนร่วม

1. Fork repository
2. สร้าง feature branch
3. ทำการเปลี่ยนแปลงของคุณ
4. ทดสอบอย่างละเอียด
5. ส่ง pull request

## 📄 License

โปรเจ็กต์นี้เป็น open source และใช้ได้ภายใต้ [MIT License](LICENSE)

## 📞 การสนับสนุน

สำหรับคำถามและการสนับสนุน โปรดดูเอกสารการอบรมใน `Day1_Note.md` หรือสร้าง issue ใน repository
