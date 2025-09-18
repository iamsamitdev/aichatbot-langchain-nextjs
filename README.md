# AI Chatbot ด้วย LangChain & Next.js

แอปพลิเคชัน AI Chatbot ที่สร้างด้วย [Next.js 15](https://nextjs.org), [LangChain](https://langchain.com) และ [Supabase](https://supabase.com) มีฟีเจอร์การตอบสนองแบบ real-time streaming, ระบบ authentication และใช้ React patterns ที่ทันสมัย

## 🚀 ฟีเจอร์หลัก

- **หน้าต่างแชทแบบ Real-time**: สร้างด้วย AI SDK React hooks เพื่อประสบการณ์ผู้ใช้ที่ลื่นไหล
- **การตอบสนองแบบ Streaming**: AI ตอบกลับแบบ real-time เพื่อ UX ที่ดีขึ้น
- **การรวม LangChain**: ใช้ LangChain สำหรับการจัดการการสนทนา AI ขั้นสูง
- **Multi-Provider Support**: รองรับ OpenAI, Google AI, Azure, OpenRouter, Ollama, vLLM และ Gradient AI
- **Supabase Authentication**: ระบบ login/register/password reset ที่สมบูรณ์แบบ
- **Chat History & Sessions**: ระบบจัดเก็บและแสดงประวัติการสนทนาแบบเรียลไทม์
- **Optimistic Session Management**: การจัดการ session แบบ optimistic เพื่อ UX ที่ดีขึ้น
- **Smart Message Summarization**: ระบบสรุปข้อความอัตโนมัติเพื่อประหยัด token
- **Token Management**: การจัดการและนับ token อย่างมีประสิทธิภาพ
- **Model Selector**: เลือก AI model ที่ต้องการใช้งาน
- **Math/LaTeX Rendering**: แสดงสูตรทางคณิตศาสตร์ด้วย KaTeX
- **Chat Sidebar**: ประวัติการสนทนาและการจัดการ chat sessions
- **UI ที่ทันสมัย**: อินเทอร์เฟซแชทที่สวยงามด้วย Shadcn/UI และ Tailwind CSS v4
- **Next.js 15 App Router**: ใช้ฟีเจอร์ล่าสุดของ Next.js และ file-based routing
- **Protected Routes**: การป้องกันหน้าที่ต้องเข้าสู่ระบบด้วย middleware
- **Modular API Design**: API endpoints แบ่งตาม functionality และมี tutorial endpoints
- **Settings System**: ระบบการตั้งค่าต่างๆ สำหรับผู้ใช้
- **Tool Calling & Function Calling**: รองรับการเรียกใช้ tools และ functions ขั้นสูง
- **PostgreSQL Integration**: การรวมกับ PostgreSQL สำหรับ tool calling
- **RAG (Retrieval Augmented Generation)**: ระบบค้นหาและใช้เอกสาร PDF/CSV เพื่อให้คำตอบที่แม่นยำ
- **Document Processing**: รองรับการประมวลผลไฟล์ PDF และ CSV
- **pgvector Integration**: ใช้ pgvector สำหรับ vector embeddings และ semantic search
- **Responsive Design**: ใช้งานได้ทั้งเดสก์ท็อปและมือถือ

## 🛠️ เทคโนโลยีที่ใช้

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS v4, Shadcn/UI
- **AI/ML**: LangChain, OpenAI API, Google Generative AI, AI SDK, Tool Calling, Function Calling
- **Database & Auth**: Supabase (PostgreSQL, Authentication, Real-time), pgvector
- **Backend**: Next.js API Routes (Edge Runtime)
- **Document Processing**: PDF parsing, CSV processing, Vector embeddings
- **RAG**: LangChain Document Loaders, pgvector, Semantic Search
- **Styling**: Tailwind CSS v4, Radix UI Components, KaTeX
- **Development**: TypeScript, ESLint, tw-animate-css
- **Version Control**: Git, GitHub

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
สร้างไฟล์ `.env` ในโฟลเดอร์หลัก (ดูตัวอย่างใน `.env.example`):
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

#### 🏗️ สถาปัตยกรรมระบบ

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Question                            │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                   AI Agent (LangChain)                          │
│                                                                 │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐    │
│  │ search_documents│ │ get_product_info│ │ get_sales_data  │    │
│  │                 │ │                 │ │                 │    │
│  │ Vector Search   │ │ Structured DB   │ │ Sales History   │    │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘    │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Data Sources                                 │
│                                                                 │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐    │
│  │ documents  │ │ products table  │ │ sales table     │    │
│  │                 │ │                 │ │                 │    │
│  │ pgvector        │ │ PostgreSQL      │ │ PostgreSQL      │    │
│  │ (embeddings)    │ │ (structured)    │ │ (structured)    │    │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

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
│   │   │   ├── chat_05_history/
│   │   │   │   └── route.ts          # Step 5: Chat history management
│   │   │   ├── chat_06_history_optimistic/
│   │   │   │   ├── route.ts          # Step 6.1: Advanced optimistic history
│   │   │   │   └── session/
│   │   │   │       └── route.ts      # Session management endpoints
│   │   │   ├── chat_06_history_optimize/
│   │   │   │   ├── route.ts          # Step 6.2: History optimization & summarization
│   │   │   │   └── session/
│   │   │   │       └── route.ts      # Optimized session endpoints
│   │   │   ├── chat_07_tool_calling_postgres/
│   │   │   │   ├── route.ts          # Step 7.1: Tool calling with PostgreSQL
│   │   │   │   └── session/
│   │   │   │       └── route.ts      # Session management with tools
│   │   │   ├── chat_07_tool_calling_sample/
│   │   │   │   ├── route.ts          # Step 7.2: Sample tool calling
│   │   │   │   └── session/
│   │   │   │       └── route.ts      # Sample session endpoints
│   │   │   ├── chat_08_rag/
│   │   │   │   ├── route.ts          # Step 8: RAG (Retrieval Augmented Generation)
│   │   │   │   └── session/
│   │   │   │       └── route.ts      # RAG session management
│   │   │   ├── chat_09_rag_tool_calling/
│   │   │   │   ├── route.ts          # Step 9: RAG + Tool Calling Integration
│   │   │   │   └── session/
│   │   │   │       └── route.ts      # RAG + Tool calling session management
│   │   │   ├── document_loader_embeding_pgvector/
│   │   │   │   ├── text_csv/
│   │   │   │   │   └── route.ts      # CSV document processing & embeddings
│   │   │   │   └── text_csv_pdf/
│   │   │   │       └── route.ts      # PDF + CSV document processing & embeddings
│   │   │   └── route.ts              # Base API routes (GET, POST, PUT, DELETE)
│   │   ├── chat/
│   │   │   ├── layout.tsx            # Chat layout (protected)
│   │   │   ├── page.tsx              # Chat interface (authenticated users only)
│   │   │   └── [id]/
│   │   │       └── page.tsx          # Individual chat conversation page
│   │   ├── favicon.ico               # App favicon
│   │   ├── globals.css               # Global styles with Tailwind v4 + KaTeX CSS
│   │   ├── layout.tsx                # Root layout
│   │   └── page.tsx                  # Landing/home page
│   ├── components/
│   │   ├── ui/
│   │   │   ├── alert-dialog.tsx      # Alert dialog component (Shadcn/UI)
│   │   │   ├── avatar.tsx            # Avatar component (Shadcn/UI)
│   │   │   ├── button.tsx            # Button component (Shadcn/UI)
│   │   │   ├── card.tsx              # Card component (Shadcn/UI)
│   │   │   ├── chat-container.tsx    # Chat container component
│   │   │   ├── code-block.tsx        # Code syntax highlighting component
│   │   │   ├── dropdown-menu.tsx     # Dropdown menu component (Shadcn/UI)
│   │   │   ├── input.tsx             # Input component (Shadcn/UI)
│   │   │   ├── label.tsx             # Label component (Shadcn/UI)
│   │   │   ├── markdown.tsx          # Markdown + LaTeX rendering component
│   │   │   ├── message.tsx           # Chat message component
│   │   │   ├── popover.tsx           # Popover component (Shadcn/UI)
│   │   │   ├── prompt-input.tsx      # Enhanced prompt input component
│   │   │   ├── scroll-button.tsx     # Scroll to bottom button
│   │   │   ├── separator.tsx         # Separator component (Shadcn/UI)
│   │   │   ├── sheet.tsx             # Sheet component (Shadcn/UI)
│   │   │   ├── sidebar.tsx           # Sidebar component
│   │   │   ├── skeleton.tsx          # Loading skeleton component
│   │   │   ├── table.tsx             # Table component (Shadcn/UI)
│   │   │   ├── textarea.tsx          # Textarea component (Shadcn/UI)
│   │   │   ├── theme-toggle.tsx      # Dark/Light mode toggle
│   │   │   └── tooltip.tsx           # Tooltip component (Shadcn/UI)
│   │   ├── settings/
│   │   │   ├── account-tab.tsx       # Account settings tab
│   │   │   ├── connectors-tab.tsx    # API connectors settings
│   │   │   ├── data-controls-tab.tsx # Data control settings
│   │   │   ├── general-tab.tsx       # General settings tab
│   │   │   ├── index.ts              # Settings components exports
│   │   │   ├── notifications-tab.tsx # Notifications settings
│   │   │   ├── personalization-tab.tsx # UI personalization settings
│   │   │   ├── schedules-tab.tsx     # Schedules settings
│   │   │   └── security-tab.tsx      # Security settings tab
│   │   ├── chat-history.tsx          # Chat history management component
│   │   ├── chat-sidebar.tsx          # Chat sidebar with conversation history
│   │   ├── forgot-password-form.tsx  # Forgot password form (Supabase UI)
│   │   ├── login-form.tsx            # Login form component (Supabase UI)
│   │   ├── logout-button.tsx         # Logout button component (Supabase UI)
│   │   ├── model-selector.tsx        # AI model selection component
│   │   ├── new-chat-simple.tsx       # Simple new chat button
│   │   ├── new-chat.tsx              # Advanced new chat component
│   │   ├── sign-up-form.tsx          # Registration form (Supabase UI)
│   │   └── update-password-form.tsx  # Update password form (Supabase UI)
│   ├── constants/
│   │   ├── api.ts                    # API endpoints constants and URL builders
│   │   └── models.ts                 # AI model constants and configurations
│   ├── contexts/
│   │   └── chat-context.tsx          # Chat context provider for state management
│   ├── hooks/
│   │   ├── use-chat-history.ts       # Custom hook for chat history management
│   │   ├── use-chat-sessions.ts      # Custom hook for session management
│   │   └── use-mobile.ts             # Custom hook for mobile detection
│   ├── lib/
│   │   ├── client.ts                 # Supabase client configurations
│   │   ├── custom-chat-transport.ts  # Custom chat transport layer
│   │   ├── database.ts               # PostgreSQL connection pool utilities
│   │   ├── middleware.ts             # Authentication middlewares
│   │   ├── server.ts                 # Server-side Supabase utilities
│   │   ├── theme-provider.tsx        # Theme provider for dark/light mode
│   │   └── utils.ts                  # Utility functions (Tailwind merge, etc.)
│   └── middleware.ts                 # Next.js middleware for auth protection
├── data/                             # Data files for RAG
│   ├── pdf/
│   │   └── product.pdf               # Sample PDF document for RAG testing
│   └── text_csv/
│       ├── information.txt           # Sample text file
│       └── product.csv               # Sample CSV file for structured data
├── public/                           # Static assets
│   ├── file.svg
│   ├── globe.svg
│   ├── next.svg
│   ├── vercel.svg
│   └── window.svg
├── .env                              # Environment variables (สร้างไฟล์นี้)
├── .env.example                      # Template สำหรับ environment variables
├── .gitignore                        # Git ignore rules
├── components.json                   # Shadcn/UI configuration
├── Day1_Note.md                      # บันทึกการอบรม Day 1
├── Day2_Note.md                      # บันทึกการอบรม Day 2
├── Day3_Note.md                      # บันทึกการอบรม Day 3
├── Day4_Note.md                      # บันทึกการอบรม Day 4
├── Day5_Note.md                      # บันทึกการอบรม Day 5
├── Day6_Note.md                      # บันทึกการอบรม Day 6
├── Day7_Note.md                      # บันทึกการอบรม Day 7
├── Day8_Note.md                      # บันทึกการอบรม Day 8
├── eslint.config.mjs                 # ESLint configuration
├── next-env.d.ts                     # Next.js TypeScript declarations
├── next.config.ts                    # Next.js configuration
├── package.json                      # Dependencies และ scripts
├── postcss.config.mjs                # PostCSS configuration
├── RAG_TROUBLESHOOTING.md            # RAG troubleshooting guide
├── tsconfig.json                     # TypeScript configuration
└── README.md                         # Documentation (ไฟล์นี้)
```

### 📝 คำอธิบายโครงสร้าง

#### 🔐 **Authentication System (ระบบยืนยันตัวตน)**
- **`/auth/login`**: หน้าเข้าสู่ระบบด้วย Supabase Auth
- **`/auth/sign-up`**: หน้าสมัครสมาชิคพร้อม email confirmation
- **`/auth/forgot-password`**: หน้ารีเซ็ตรหัสผ่าน
- **`/auth/update-password`**: หน้าอัปเดตรหัสผ่านใหม่
- **`/auth/confirm`**: Endpoint สำหรับยืนยันอีเมล
- **`/auth/error`**: หน้าแสดงข้อผิดพลาดในการยืนยันตัวตน
- **`/chat`**: หน้าแชทหลัก (Protected Route - ต้องเข้าสู่ระบบ)

#### 🤖 **API Endpoints**
- **`/api/route.ts`**: API endpoints พื้นฐาน (GET, POST, PUT, DELETE)
- **`/api/chat/route.ts`**: Chat API หลักสำหรับ production
- **`/api/chat_01_start/`**: ขั้นตอนที่ 1 - การตั้งค่า chat พื้นฐาน
- **`/api/chat_02_request/`**: ขั้นตอนที่ 2 - การจัดการ HTTP requests
- **`/api/chat_03_template/`**: ขั้นตอนที่ 3 - การใช้ Prompt templates
- **`/api/chat_04_stream/`**: ขั้นตอนที่ 4 - การตอบสนองแบบ streaming
- **`/api/chat_05_history/`**: ขั้นตอนที่ 5 - การจัดการประวัติการสนทนา
- **`/api/chat_06_history_optimistic/`**: ขั้นตอนที่ 6.1 - ประวัติแชทแบบ optimistic ขั้นสูง
- **`/api/chat_06_history_optimize/`**: ขั้นตอนที่ 6.2 - การปรับปรุงประสิทธิภาพประวัติ
- **`/api/chat_07_tool_calling_postgres/`**: ขั้นตอนที่ 7.1 - Tool calling พร้อม PostgreSQL integration
- **`/api/chat_07_tool_calling_sample/`**: ขั้นตอนที่ 7.2 - ตัวอย่าง Tool calling และ Function calling
- **`/api/chat_08_rag/`**: ขั้นตอนที่ 8 - RAG (Retrieval Augmented Generation)
- **`/api/chat_09_rag_tool_calling/`**: ขั้นตอนที่ 9 - RAG + Tool Calling Integration
- **`/api/document_loader_embeding_pgvector/text_csv/`**: CSV document processing และ vector embeddings
- **`/api/document_loader_embeding_pgvector/text_csv_pdf/`**: PDF + CSV document processing และ vector embeddings

#### 🎨 **UI Components**
- **`/components/ui/`**: 
  - **Shadcn/UI Components**: Button, Card, Input, Label, Avatar, Tooltip, Dropdown-menu, Table, Theme-toggle
  - **Chat Components**: Message, Chat-container, Markdown (with LaTeX support), Code-block
  - **Layout Components**: Sidebar, Sheet, Popover, Separator
  - **Form Components**: Textarea, Prompt-input
  - **Utility Components**: Skeleton (loading), Scroll-button
- **`/components/`**: 
  - **Authentication Forms**: Login, Sign-up, Forgot-password, Update-password
  - **Chat Features**: Chat-sidebar, Chat-history, New-chat (simple & advanced), Model-selector
  - **User Actions**: Logout-button
- **`/components/settings/`**: 
  - **Account Management**: Account-tab สำหรับจัดการบัญชีผู้ใช้
  - **API Configuration**: Connectors-tab สำหรับตั้งค่า API providers
  - **Data Controls**: Data-controls-tab สำหรับจัดการข้อมูล
  - **General Settings**: General-tab สำหรับการตั้งค่าทั่วไป
  - **Notifications**: Notifications-tab สำหรับการแจ้งเตือน
  - **Personalization**: Personalization-tab สำหรับปรับแต่ง UI
  - **Schedules**: Schedules-tab สำหรับจัดการตารางเวลา
  - **Security**: Security-tab สำหรับการตั้งค่าความปลอดภัย

#### 🧩 **Context & State Management**
- **`/contexts/chat-context.tsx`**: React Context สำหรับจัดการ state ของการแชท
  - Chat messages history
  - Current conversation state
  - Chat settings และ preferences

#### 🎣 **Custom Hooks**
- **`/hooks/use-mobile.ts`**: Custom hook สำหรับตรวจจับอุปกรณ์มือถือ
  - Responsive design utilities
  - Mobile-specific UI behaviors
- **`/hooks/use-chat-history.ts`**: Custom hook สำหรับจัดการประวัติการแชท
  - Chat history state management
  - History loading และ caching
- **`/hooks/use-chat-sessions.ts`**: Custom hook สำหรับจัดการ chat sessions
  - Session creation และ management
  - Session switching และ navigation

#### 📦 **Constants & Configuration**
- **`/constants/api.ts`**: ค่าคงที่และ utilities สำหรับ API endpoints
  - API base URLs และ endpoints configuration
  - URL builder functions สำหรับ dynamic parameters
  - Tool calling API endpoints management
- **`/constants/models.ts`**: ค่าคงที่และการตั้งค่าสำหรับ AI models
  - Model configurations
  - Provider settings

- **`/lib/`**: 
  - **Supabase**: Client configurations, server utilities
  - **Authentication**: Middleware functions
  - **Database**: PostgreSQL connection pool และ utilities
  - **Theme Provider**: Dark/light mode management
  - **Chat Transport**: Custom chat transport layer
  - **Utilities**: Tailwind merge, helper functions

#### 🛡️ **Middleware & Protection**
- **`/middlewares.ts`**: Next.js middleware สำหรับป้องกัน protected routes
- **`/lib/middlewares.ts`**: Authentication helper functions
- **Route Protection**: Chat routes ต้องผ่านการยืนยันตัวตนก่อน

## 🎯 Dependencies สำคัญ

### 🤖 AI/ML Framework
```json
{
  "langchain": "เฟรมเวิร์กสำหรับแอป AI ขั้นสูง",
  "@langchain/core": "ฟังก์ชันหลักและ abstractions ของ LangChain",
  "@langchain/openai": "การรวม OpenAI API สำหรับ LangChain",
  "@langchain/google-genai": "การรวม Google Generative AI",
  "@langchain/community": "Community integrations และ document loaders",
  "@ai-sdk/langchain": "ตัวเชื่อมต่อ LangChain สำหรับ AI SDK",
  "@ai-sdk/react": "React hooks สำหรับแอป AI (useChat, useAssistant)",
  "ai": "AI SDK สำหรับ streaming และการจัดการข้อความ"
}
```

### ⚛️ Frontend Framework & UI
```json
{
  "next": "React framework สำหรับ production (v15.5.2)",
  "react": "Library สำหรับสร้าง user interfaces (v19.1.0)",
  "react-dom": "React DOM renderer (v19.1.0)",
  "typescript": "Type-safe JavaScript",
  "@radix-ui/react-*": "Radix UI components สำหรับ accessibility",
  "tailwindcss": "Utility-first CSS framework (v4)",
  "class-variance-authority": "สำหรับจัดการ CSS classes แบบ type-safe",
  "tailwind-merge": "สำหรับรวม Tailwind CSS classes อย่างฉลาด",
  "clsx": "Utility สำหรับสร้าง className strings แบบมีเงื่อนไข",
  "lucide-react": "Icon library ที่ทันสมัยและสวยงาม"
}
```

### 🔐 Authentication & Database
```json
{
  "@supabase/supabase-js": "Supabase JavaScript client",
  "@supabase/ssr": "Supabase Server-Side Rendering helpers",
  "pg": "PostgreSQL client สำหรับ Node.js",
  "@types/pg": "TypeScript definitions สำหรับ pg"
}
```

### 📐 Document Processing & RAG
```json
{
  "pdf-parse": "PDF document parsing และ text extraction",
  "d3-dsv": "CSV และ TSV file parsing และ processing",
  "zod": "Schema validation และ type-safe data parsing"
}
```

### � Markdown & Math Rendering
```json
{
  "react-markdown": "React component สำหรับ render Markdown",
  "remark-gfm": "GitHub Flavored Markdown support",
  "remark-breaks": "Support line breaks ใน Markdown",
  "remark-math": "Support LaTeX math notation ใน Markdown",
  "rehype-katex": "Render LaTeX math เป็น HTML ด้วย KaTeX",
  "katex": "Fast math typesetting library",
  "marked": "Markdown parser และ compiler",
  "shiki": "Syntax highlighter สำหรับ code blocks"
}
```

### ⚡ Performance & Utilities
```json
{
  "use-stick-to-bottom": "Auto-scroll utilities สำหรับ chat interface",
  "tw-animate-css": "Tailwind CSS animations utilities"
}
```

### 🛠️ Development Tools
```json
{
  "eslint": "Linting tool สำหรับ JavaScript/TypeScript",
  "eslint-config-next": "Next.js specific ESLint configuration",
  "@eslint/eslintrc": "ESLint configuration utilities",
  "@tailwindcss/postcss": "PostCSS plugin สำหรับ Tailwind CSS v4",
  "@types/*": "TypeScript type definitions"
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
- **POST `/api/chat_05_history`**: ทดสอบการจัดการประวัติการสนทนา
- **POST `/api/chat_06_history_optimistic`**: ระบบประวัติแชทแบบ optimistic ขั้นสูง
- **POST `/api/chat_06_history_optimize`**: ระบบปรับปรุงประสิทธิภาพและ token management
- **POST `/api/chat_07_tool_calling_postgres`**: Tool calling พร้อม PostgreSQL integration
- **POST `/api/chat_07_tool_calling_sample`**: ตัวอย่าง Tool calling และ Function calling
- **POST `/api/chat_08_rag`**: RAG (Retrieval Augmented Generation) implementation
- **POST `/api/chat_09_rag_tool_calling`**: RAG พร้อม Tool Calling integration

### Document & RAG Endpoints
- **POST `/api/document_loader_embeding_pgvector/text_csv`**: CSV document processing และ vector embeddings
- **POST `/api/document_loader_embeding_pgvector/text_csv_pdf`**: PDF + CSV document processing และ vector embeddings

### Session Management Endpoints
- **POST `/api/chat_06_history_optimistic/session`**: จัดการ session แบบ optimistic
- **POST `/api/chat_06_history_optimize/session`**: จัดการ session พร้อม optimization
- **POST `/api/chat_07_tool_calling_postgres/session`**: จัดการ session พร้อม tool calling
- **POST `/api/chat_07_tool_calling_sample/session`**: จัดการ session สำหรับ sample tools
- **POST `/api/chat_08_rag/session`**: จัดการ session สำหรับ RAG
- **POST `/api/chat_09_rag_tool_calling/session`**: จัดการ session สำหรับ RAG + Tool Calling

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

## 🎨 UI Components & Features

อินเทอร์เฟซแชทประกอบด้วย:

### 🔐 **Authentication System**
- **Login Form**: ฟอร์มเข้าสู่ระบบพร้อม validation และ error handling
- **Registration Form**: ฟอร์มสมัครสมาชิกพร้อมยืนยันอีเมล
- **Password Reset**: ฟอร์มรีเซ็ตและอัปเดตรหัสผ่าน
- **Email Confirmation**: ระบบยืนยันอีเมลผ่าน Supabase Auth
- **Protected Routes**: การป้องกันหน้าที่ต้องเข้าสู่ระบบด้วย middleware
- **Session Management**: การจัดการ session และ automatic logout

### 💬 **Chat Interface**
- **Chat Layout**: Layout หลักสำหรับหน้าแชท (authenticated users only)
- **Chat Sidebar**: แถบข้างพร้อมประวัติการสนทนา
- **Chat History**: ระบบจัดเก็บและแสดงประวัติการสนทนาแบบเรียลไทม์
- **Optimistic Session Management**: การจัดการ session แบบ optimistic เพื่อประสบการณ์ที่รวดเร็ว
- **Smart Message Summarization**: ระบบสรุปข้อความอัตโนมัติเพื่อประหยัด token
- **Token Management**: การนับและจัดการ token ด้วย tiktoken
- **Model Selector**: เลือก AI model ที่ต้องการใช้งาน (OpenAI, Google AI, etc.)
- **Individual Chat Pages**: หน้าแสดงการสนทนาแต่ละเรื่องแบบแยกหน้า
- **Message Components**: 
  - ฟองข้อความของผู้ใช้และ AI แยกจากกัน
  - Markdown rendering สำหรับข้อความที่มีการจัดรูปแบบ
  - **LaTeX/Math Support**: แสดงสูตรทางคณิตศาสตร์ด้วย KaTeX
    - รองรับ inline math: `\( สูตร \)` → $สูตร$
    - รองรับ display math: `\[ สูตร \]` → $$สูตร$$
    - แปลงอัตโนมัติจาก AI response format
  - Code block component พร้อม syntax highlighting
- **Prompt Input**: Input component ขั้นสูงพร้อม auto-resize
- **New Chat Features**: 
  - ปุ่มเริ่มแชทใหม่ (simple และ advanced)
  - การจัดการ chat sessions
- **Scroll Features**: ปุ่ม scroll to bottom และ auto-scroll
- **Loading States**: Skeleton components สำหรับการโหลด

### 🎨 **Design System (Shadcn/UI)**
- **Base Components**: Button, Card, Input, Label, Textarea
- **Layout Components**: Sheet, Sidebar, Separator, Popover
- **Feedback Components**: Tooltip, Avatar, Skeleton
- **Consistent Styling**: การใช้ Tailwind CSS และ CVA (Class Variance Authority)
- **Dark/Light Mode Support**: รองรับ theme switching
- **Accessibility**: รองรับ screen readers และ keyboard navigation
- **Responsive Design**: ใช้งานได้ทั้งเดสก์ท็อปและมือถือ

### ⚙️ **Settings & Configuration**
- **Settings Tabs System**: แบ่งการตั้งค่าเป็น tabs สำหรับการจัดการที่ง่าย
  - **Account Tab**: จัดการข้อมูลบัญชีผู้ใช้
  - **Connectors Tab**: ตั้งค่า AI providers และ API connections
  - **Data Controls Tab**: จัดการข้อมูลและความเป็นส่วนตัว
  - **General Tab**: การตั้งค่าทั่วไปของแอปพลิเคชัน
  - **Notifications Tab**: การตั้งค่าการแจ้งเตือน
  - **Personalization Tab**: ปรับแต่งธีมและ UI preferences
  - **Schedules Tab**: การจัดการตารางเวลาและ automation
  - **Security Tab**: การตั้งค่าความปลอดภัยและ authentication
- **User Preferences**: การจัดการ preferences ของผู้ใช้
- **Theme Management**: การเปลี่ยน theme และ appearance

### 🧩 **State Management & Hooks**
- **Chat Context**: Global state management สำหรับการแชท
  - Message history และ conversation state
  - Chat settings และ user preferences
  - Real-time updates และ synchronization
- **Custom Hooks**: 
  - **useMobile**: Hook สำหรับตรวจจับและจัดการ responsive design
  - **useChatHistory**: Hook สำหรับจัดการประวัติการแชท
  - **useChatSessions**: Hook สำหรับจัดการ chat sessions
  - **Auto-responsive**: การปรับ UI ตามขนาดหน้าจอโดยอัตโนมัติ
- **Context Providers**: Centralized state management pattern

### 🚀 **Performance & Optimization Features**
- **Optimistic UI Updates**: การอัปเดต UI แบบ optimistic เพื่อประสบการณ์ที่รวดเร็ว
- **Token Counting & Management**: การนับและจัดการ token อย่างมีประสิทธิภาพ
- **Message Trimming**: การตัดข้อความเก่าเพื่อไม่ให้เกิน token limit
- **Smart Summarization**: การสรุปข้อความอัตโนมัติเพื่อประหยัด token
- **Database Connection Pooling**: การจัดการ database connection อย่างมีประสิทธิภาพ
- **Background Task Processing**: การประมวลผล task ในเบื้องหลังโดยไม่กระทบ UX
- **Stream Processing**: การประมวลผล streaming response แบบ real-time
- **Vector Search Optimization**: การปรับปรุงการค้นหา vector embeddings ด้วย pgvector
- **Document Caching**: การ cache เอกสารที่ประมวลผลแล้วเพื่อประสิทธิภาพที่ดีขึ้น

### 🔧 **Developer Features**
- **Modular API Design**: API endpoints แยกตาม functionality
- **Tutorial Endpoints**: Step-by-step learning endpoints (chat_01 ถึง chat_09)
- **Progressive Learning Path**: เรียนรู้จากพื้นฐานไปสู่ขั้นสูง
  - Basic chat → Request handling → Templates → Streaming → History → Optimization → Tool Calling → RAG
- **Error Handling**: Comprehensive error handling และ user feedback
- **Type Safety**: TypeScript ทั่วทั้งโปรเจ็กต์
- **Context Pattern**: React Context API สำหรับ global state management
- **Custom Hooks**: Reusable hooks สำหรับ common functionalities
- **Responsive Design**: Built-in mobile detection และ adaptive UI
- **Component Architecture**: Modular และ reusable component design
- **Database Schema**: Well-structured PostgreSQL schema สำหรับ chat และ session management
- **Performance Monitoring**: Built-in logging และ performance tracking
- **RAG Pipeline**: Complete RAG implementation พร้อม document processing
- **Vector Database**: pgvector integration สำหรับ semantic search

## 🔐 Environment Variables

สร้างไฟล์ `.env` ในไดเรกทอรีหลักและเพิ่มตัวแปรต่อไปนี้:

| ตัวแปร | คำอธิบาย | จำเป็น |
|--------|----------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL ของ Supabase project | ✅ ใช่ |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY` | Supabase Anon/Public key | ✅ ใช่ |
| `PG_HOST` | โฮสต์ของ PostgreSQL (ถ้าใช้ RAG + pgvector) | ✅ ใช่ |
| `PG_PORT` | พอร์ตของ PostgreSQL (default: 6543) | | ไม่ |
| `PG_USER` | ชื่อผู้ใช้ PostgreSQL | ✅ ใช่ |
| `PG_PASSWORD` | รหัสผ่าน PostgreSQL | ✅ ใช่ |
| `PG_DATABASE` | ชื่อฐานข้อมูล PostgreSQL | ไม่ |
| `OPENAI_API_KEY` | OpenAI API key ของคุณ | ✅ ใช่ |
| `OPENAI_MODEL_NAME` | ชื่อโมเดล OpenAI ที่ใช้ | ไม่ (default: gpt-4o-mini) |
| `OPENAI_EMBEDDING_MODEL_NAME` | ชื่อโมเดล embedding ของ OpenAI | ไม่ (default: text-embedding-3-small) |
| `GOOGLE_API_KEY` | Google AI API key (สำหรับ Gemini) | ไม่ |
| `GOOGLE_MODEL_NAME` | ชื่อโมเดล Google ที่ใช้ | ไม่ (default: gemini-2.0-flash-exp) |
| `AZURE_OPENAI_API_KEY` | Azure OpenAI API key | ไม่ |
| `AZURE_OPENAI_API_INSTANCE_NAME` | Azure OpenAI instance name | ไม่ |
| `AZURE_OPENAI_API_DEPLOYMENT_NAME` | Azure OpenAI deployment name | ไม่ |
| `AZURE_OPENAI_API_VERSION` | Azure OpenAI API version | ไม่ |
| `OPENROUTER_API_KEY` | OpenRouter API key | ไม่ |
| `OPENROUTER_MODEL_NAME` | ชื่อโมเดลใน OpenRouter | ไม่ |
| `OLLAMA_BASE_URL` | Ollama server URL | ไม่ (default: http://localhost:11434) |
| `OLLAMA_MODEL_NAME` | ชื่อโมเดลใน Ollama | ไม่ |
| `VLLM_BASE_URL` | vLLM server URL | ไม่ |
| `VLLM_MODEL_NAME` | ชื่อโมเดลใน vLLM | ไม่ |
| `GRADIENT_ACCESS_TOKEN` | Gradient AI access token | ไม่ |
| `GRADIENT_WORKSPACE_ID` | Gradient AI workspace ID | ไม่ |
| `GRADIENT_MODEL_ID` | Gradient AI model ID | ไม่ |

### ตัวอย่างไฟล์ .env
```env
# === Supabase config (จำเป็น) =====
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY=your-anon-key

# ===  postgres config =====
# การใช้กับ RAG + LangChain + pgvector แนะนำเป็นแบบ Transaction pooler (Shared Pooler)
PG_HOST=your-postgres-host
PG_PORT=6543
PG_USER=your-postgres-user
PG_PASSWORD=your-postgres-password
PG_DATABASE=postgres

# === OPENAI (ChatGPT) - จำเป็น =====
OPENAI_API_KEY=sk-your-openai-api-key
OPENAI_MODEL_NAME="gpt-4o-mini"
OPENAI_EMBEDDING_MODEL_NAME="text-embedding-3-small"

# === GOOGLE (Gemini) - ไม่บังคับ =====
GOOGLE_API_KEY=your-google-api-key
GOOGLE_MODEL_NAME="gemini-2.0-flash-exp"

# === AZURE OPENAI - ไม่บังคับ =====
AZURE_OPENAI_API_KEY=your-azure-api-key
AZURE_OPENAI_API_INSTANCE_NAME=your-instance-name
AZURE_OPENAI_API_DEPLOYMENT_NAME=your-deployment-name
AZURE_OPENAI_API_VERSION="2024-02-15-preview"

# === OPENROUTER - ไม่บังคับ =====
OPENROUTER_API_KEY=sk-or-v1-your-api-key
OPENROUTER_MODEL_NAME="meta-llama/llama-3.2-3b-instruct:free"

# === OLLAMA (Local) - ไม่บังคับ =====
OLLAMA_BASE_URL="http://localhost:11434"
OLLAMA_MODEL_NAME="llama3.2"

# === vLLM (Self-hosted) - ไม่บังคับ =====
VLLM_BASE_URL="http://localhost:8000"
VLLM_MODEL_NAME="microsoft/DialoGPT-medium"

# === GRADIENT AI - ไม่บังคับ =====
GRADIENT_ACCESS_TOKEN=your-gradient-access-token
GRADIENT_WORKSPACE_ID=your-workspace-id
GRADIENT_MODEL_ID=your-model-id

# === PostgreSQL (Local) - ไม่บังคับ =====
PG_HOST=localhost
PG_PORT=5432
PG_USER=your-postgres-user
PG_PASSWORD=your-postgres-password
PG_DATABASE=aichatbot_db
```

**หมายเหตุ**: 
- คุณสามารถใช้ provider เดียวหรือหลาย providers พร้อมกันได้ โดยระบบจะเลือกใช้ provider แรกที่มี environment variables ครบ
- สำหรับ PostgreSQL: หากไม่ได้กำหนด จะใช้ Supabase PostgreSQL โดยอัตโนมัติ
- สำหรับการพัฒนาขั้นสูง: สามารถตั้งค่า PostgreSQL แยกต่างหากเพื่อ performance ที่ดีขึ้น

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

สำหรับคำถามและการสนับสนุน โปรดดูเอกสารการอบรมใน:
- `Day1_Note.md` - พื้นฐาน Next.js และการตั้งค่าโปรเจ็กต์
- `Day2_Note.md` - การตั้งค่า Supabase และ Authentication
- `Day3_Note.md` - การสร้าง Chat Interface และ UI Components
- `Day4_Note.md` - การรวม LangChain และ AI APIs
- `Day5_Note.md` - การจัดการ Chat History และ Sessions
- `Day6_Note.md` - การปรับปรุงประสิทธิภาพและ Advanced Features
- `Day7_Note.md` - Tool Calling, Function Calling และ PostgreSQL Integration
- `Day8_Note.md` - RAG (Retrieval Augmented Generation) และ Document Processing
- `RAG_TROUBLESHOOTING.md` - คู่มือแก้ไขปัญหา RAG

หรือสร้าง issue ใน repository
