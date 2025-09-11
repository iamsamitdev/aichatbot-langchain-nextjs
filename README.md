# AI Chatbot ด้วย LangChain & Next.js

แอปพลิเคชัน AI Chatbot ที่สร้างด้วย [Next.js 15](https://nextjs.org), [LangChain](https://langchain.com) และ [Supabase](https://supabase.com) มีฟีเจอร์การตอบสนองแบบ real-time streaming, ระบบ authentication และใช้ React patterns ที่ทันสมัย

## 🚀 ฟีเจอร์หลัก

- **หน้าต่างแชทแบบ Real-time**: สร้างด้วย AI SDK React hooks เพื่อประสบการณ์ผู้ใช้ที่ลื่นไหล
- **การตอบสนองแบบ Streaming**: AI ตอบกลับแบบ real-time เพื่อ UX ที่ดีขึ้น
- **การรวม LangChain**: ใช้ LangChain สำหรับการจัดการการสนทนา AI ขั้นสูง
- **OpenAI GPT-4**: ขับเคลื่อนด้วยโมเดล GPT-4o-mini ของ OpenAI
- **Supabase Authentication**: ระบบ login/register ที่สมบูรณ์แบบ
- **UI ที่ทันสมัย**: อินเทอร์เฟซแชทที่สวยงามด้วย Shadcn/UI และ Tailwind CSS
- **Next.js 15 App Router**: ใช้ฟีเจอร์ล่าสุดของ Next.js และ file-based routing
- **Protected Routes**: การป้องกันหน้าที่ต้องเข้าสู่ระบบ

## 🛠️ เทคโนโลยีที่ใช้

- **Frontend**: Next.js 15, React, TypeScript, Tailwind CSS, Shadcn/UI
- **AI/ML**: LangChain, OpenAI API, AI SDK
- **Database & Auth**: Supabase (PostgreSQL, Authentication, Real-time)
- **Backend**: Next.js API Routes (Edge Runtime)
- **Styling**: Tailwind CSS, Radix UI Components

## 📋 สิ่งที่ต้องเตรียมก่อนเริ่ม

ก่อนเริ่มต้น ตรวจสอบให้แน่ใจว่าคุณได้ติดตั้งสิ่งต่อไปนี้แล้ว:

- **Node.js 20 ขึ้นไป**
- **npm** หรือ **yarn**
- **Git**
- **OpenAI API Key**
- **Supabase Account** (สมัครฟรีที่ [supabase.com](https://supabase.com))

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

3. **สร้าง Supabase Project**
   - ไปที่ [https://supabase.com](https://supabase.com) และสร้างโปรเจ็กต์ใหม่
   - เลือก region ที่ใกล้ที่สุด (แนะนำ Southeast Asia - Singapore)
   - คัดลอก Project URL และ API Key

4. **ตั้งค่า environment variables**
สร้างไฟล์ `.env.local` ในโฟลเดอร์หลัก (ดูตัวอย่างใน `.env.example`):
```env
# === Supabase config =====
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url-here
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY=your-supabase-anon-key-here

# === OPENAI (ChatGPT) =====
OPENAI_API_KEY=your-openai-api-key
OPENAI_MODEL_NAME="gpt-4o-mini"
```

5. **ติดตั้ง UI Components (ถ้ายังไม่ได้ทำ)**
```bash
# ติดตั้ง Shadcn/UI
npx shadcn@latest init

# ติดตั้ง Supabase Authentication UI
npx shadcn@latest add https://supabase.com/ui/r/password-based-auth-nextjs.json
```

6. **รัน development server**
```bash
npm run dev
```

7. **เปิดเบราว์เซอร์**
ไปที่ [http://localhost:3000](http://localhost:3000) เพื่อดูแอปพลิเคชัน

## 📁 โครงสร้างโปรเจ็กต์

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
│   │   │   │   └── route.ts          # Chat API endpoint (production)
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
│   │   │   └── route.ts              # Base API routes (GET, POST, PUT, DELETE)
│   │   ├── chat/
│   │   │   ├── layout.tsx            # Chat layout (protected)
│   │   │   └── page.tsx              # Chat interface (authenticated users only)
│   │   ├── globals.css               # Global styles with Tailwind
│   │   ├── layout.tsx                # Root layout
│   │   └── page.tsx                  # Landing/home page
│   ├── components/
│   │   ├── ui/
│   │   │   ├── button.tsx            # Button component (Shadcn/UI)
│   │   │   ├── card.tsx              # Card component (Shadcn/UI)
│   │   │   ├── input.tsx             # Input component (Shadcn/UI)
│   │   │   └── label.tsx             # Label component (Shadcn/UI)
│   │   ├── forgot-password-form.tsx  # Forgot password form (Supabase UI)
│   │   ├── login-form.tsx            # Login form component (Supabase UI)
│   │   ├── logout-button.tsx         # Logout button component (Supabase UI)
│   │   ├── sign-up-form.tsx          # Registration form (Supabase UI)
│   │   └── update-password-form.tsx  # Update password form (Supabase UI)
│   ├── lib/
│   │   ├── clients.ts                # Supabase client configurations
│   │   ├── middlewares.ts            # Authentication middlewares
│   │   ├── server.ts                 # Server-side Supabase utilities
│   │   └── utils.ts                  # Utility functions (Tailwind merge, etc.)
│   └── middlewares.ts                # Next.js middleware for auth protection
├── public/                           # Static assets
│   ├── file.svg
│   ├── globe.svg
│   ├── next.svg
│   ├── vercel.svg
│   └── window.svg
├── .env.local                        # Environment variables (สร้างไฟล์นี้)
├── .env.example                      # Template สำหรับ environment variables
├── components.json                   # Shadcn/UI configuration
├── Day1_Note.md                      # บันทึกการอบรม Day 1
├── Day2_Note.md                      # บันทึกการอบรม Day 2
├── Day3_Note.md                      # บันทึกการอบรม Day 3
├── eslint.config.mjs                 # ESLint configuration
├── next.config.ts                    # Next.js configuration
├── package.json                      # Dependencies และ scripts
├── postcss.config.mjs                # PostCSS configuration
├── tailwind.config.ts                # Tailwind CSS configuration
├── tsconfig.json                     # TypeScript configuration
└── README.md                         # Documentation (ไฟล์นี้)
```

### 📝 คำอธิบายโครงสร้าง

#### 🔐 **Authentication Routes**
- **`/auth/login`**: หน้าเข้าสู่ระบบ
- **`/auth/sign-up`**: หน้าสมัครสมาชิค
- **`/auth/forgot-password`**: หน้ารีเซ็ตรหัสผ่าน
- **`/auth/confirm`**: Endpoint สำหรับยืนยันอีเมล
- **`/chat`**: หน้าแชทหลัก (ต้องเข้าสู่ระบบ)

#### 🤖 **API Endpoints**
- **`/api/route.ts`**: API endpoints พื้นฐาน (GET, POST, PUT, DELETE)
- **`/api/test/route.ts`**: API ทดสอบการรับส่งข้อมูล
- **`/api/chat/route.ts`**: Chat API หลักสำหรับ production
- **`/api/chat_01_start/`**: ขั้นตอนที่ 1 - การตั้งค่า chat พื้นฐาน
- **`/api/chat_02_request/`**: ขั้นตอนที่ 2 - การจัดการ HTTP requests
- **`/api/chat_03_template/`**: ขั้นตอนที่ 3 - การใช้ Prompt templates
- **`/api/chat_04_stream/`**: ขั้นตอนที่ 4 - การตอบสนองแบบ streaming

#### 🎨 **UI Components**
- **`/components/ui/`**: Shadcn/UI components (Button, Card, Input, Label)
- **`/components/*-form.tsx`**: Supabase UI authentication forms
- **`/lib/`**: Utility functions, Supabase clients และ middlewares

## 🎯 Dependencies สำคัญ

```json
{
  "langchain": "เฟรมเวิร์กสำหรับแอป AI ขั้นสูง",
  "@ai-sdk/langchain": "ตัวเชื่อมต่อ LangChain สำหรับ AI SDK",
  "@ai-sdk/react": "React hooks สำหรับแอป AI",
  "@langchain/core": "ฟังก์ชันหลักของ LangChain",
  "@langchain/openai": "การรวม OpenAI สำหรับ LangChain",
  "ai": "AI SDK สำหรับ streaming และการจัดการข้อความ",
  "@supabase/supabase-js": "Supabase JavaScript client",
  "@supabase/ssr": "Supabase Server-Side Rendering helpers",
  "@radix-ui/react-*": "Radix UI components สำหรับ accessibility",
  "class-variance-authority": "สำหรับจัดการ CSS classes แบบ type-safe",
  "tailwind-merge": "สำหรับรวม Tailwind CSS classes อย่างฉลาด",
  "lucide-react": "Icon library ที่ทันสมัย"
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

### Authentication Endpoints
- **GET/POST `/auth/login`**: หน้าเข้าสู่ระบบ
- **GET/POST `/auth/sign-up`**: หน้าสมัครสมาชิก
- **GET/POST `/auth/forgot-password`**: หน้ารีเซ็ตรหัสผ่าน
- **GET `/auth/confirm`**: ยืนยันอีเมลผู้ใช้

### Chat API Endpoints
- **POST `/api/chat`**: Chat API หลักสำหรับ production
- **POST `/api/chat_01_start`**: ทดสอบการเชื่อมต่อ AI model พื้นฐาน
- **POST `/api/chat_02_request`**: ทดสอบการจัดการ request/response
- **POST `/api/chat_03_template`**: ทดสอบ prompt templates
- **POST `/api/chat_04_stream`**: ทดสอบ streaming responses

### POST /api/chat (Production)
Endpoint หลักสำหรับจัดการการสนทนากับ AI

**ฟีเจอร์:**
- การตอบสนองแบบ streaming
- LangChain prompt templates
- การจัดการ error
- Edge runtime สำหรับประสิทธิภาพที่ดีกว่า
- Session management ผ่าน Supabase

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
      "role": "user",
      "parts": [{"type": "text", "text": "สวัสดี AI!"}]
    }
  ]
}
```

## 🎨 UI Components

อินเทอร์เฟซแชทประกอบด้วย:

### 🔐 **Authentication UI**
- **Login Form**: ฟอร์มเข้าสู่ระบบพร้อม validation
- **Registration Form**: ฟอร์มสมัครสมาชิกพร้อมยืนยันอีเมล
- **Password Reset**: ฟอร์มรีเซ็ตรหัสผ่าน
- **Protected Routes**: การป้องกันหน้าที่ต้องเข้าสู่ระบบ

### 💬 **Chat Interface**
- **Header**: ชื่อแอปพลิเคชันและปุ่ม logout
- **Message Area**: ประวัติแชทที่เลื่อนได้พร้อมฟองข้อความของผู้ใช้/AI
- **Input Area**: ช่องป้อนข้อความพร้อมปุ่มส่งและตัวบ่งชี้การพิมพ์
- **Responsive Design**: ใช้งานได้ทั้งเดสก์ท็อปและมือถือ

### 🎨 **Design System**
- **Shadcn/UI Components**: Button, Card, Input, Label ที่สวยงาม
- **Consistent Styling**: การใช้ Tailwind CSS อย่างสม่ำเสมอ
- **Dark/Light Mode**: รองรับทั้งโหมดสว่างและมืด (จาก Shadcn/UI)
- **Accessibility**: รองรับ screen readers และ keyboard navigation

## 🔐 Environment Variables

| ตัวแปร | คำอธิบาย | จำเป็น |
|--------|----------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL ของ Supabase project | ใช่ |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY` | Supabase Anon/Public key | ใช่ |
| `OPENAI_API_KEY` | OpenAI API key ของคุณ | ใช่ |
| `OPENAI_MODEL_NAME` | ชื่อโมเดล OpenAI ที่ใช้ | ไม่ (default: gpt-4o-mini) |
| `GOOGLE_API_KEY` | Google AI API key (สำหรับ Gemini) | ไม่ |
| `GOOGLE_MODEL_NAME` | ชื่อโมเดล Google ที่ใช้ | ไม่ |

### ตัวอย่างไฟล์ .env.local
```env
# === Supabase config =====
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY=your-anon-key

# === OPENAI (ChatGPT) =====
OPENAI_API_KEY=sk-your-openai-api-key
OPENAI_MODEL_NAME="gpt-4o-mini"

# === GOOGLE (Gemini) - Optional =====
GOOGLE_API_KEY=your-google-api-key
GOOGLE_MODEL_NAME="gemini-2.5-flash"
```

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
