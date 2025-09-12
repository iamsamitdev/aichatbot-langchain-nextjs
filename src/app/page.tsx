import { Button } from "@/components/ui/button"
import Link from "next/link"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Home | Genius AI Chatbot",
  description: "A chatbot powered by AI and built with Langchain.js and Next.js",
}

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* Fixed Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 w-full px-4 py-4 sm:px-6 lg:px-8 bg-white/80 backdrop-blur-md border-b border-slate-200/50 dark:bg-slate-900/80 dark:border-slate-700/50">
        <div className="mx-auto max-w-7xl flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">AI</span>
            </div>
            <span className="text-xl font-bold text-slate-900 dark:text-white">Genius</span>
          </div>
          <div className="flex items-center space-x-4">
            <Button variant="ghost" asChild className="hidden sm:inline-flex">
              <Link href="/auth/login">เข้าสู่ระบบ</Link>
            </Button>
            <Button asChild>
              <Link href="/auth/sign-up">ลงทะเบียน</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="px-4 pt-24 pb-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="text-center">
            {/* Badge */}
            <div className="inline-flex items-center rounded-full border border-slate-200 bg-white/50 px-3 py-1 text-sm text-slate-600 backdrop-blur-sm dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300 mb-8">
              <span className="h-2 w-2 rounded-full bg-green-500 mr-2"></span>
              ขับเคลื่อนด้วย AI, RAG, และ Document Loader
            </div>

            {/* Main Heading */}
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-5xl md:text-6xl lg:text-7xl">
              <span className="block">Genius AI</span>
              <span className="block bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Chatbot
              </span>
            </h1>

            {/* Description */}
            <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600 dark:text-slate-300 sm:text-xl">
              สุดยอดแชทบอทอัจฉริยะที่รวมพลัง AI, RAG (Retrieval-Augmented Generation), Document Loader & Vector Embeddings และ Tool Calling
              <br />
              <span className="font-semibold text-blue-700 dark:text-blue-300">ค้นหาข้อมูลจากเอกสาร, ฐานข้อมูล, และตอบคำถามได้แม่นยำแบบเรียลไทม์</span>
              <br />
              สร้างด้วย LangChain.js, Next.js, Supabase และ OpenAI GPT-4o-mini เพื่อประสบการณ์สนทนาที่ล้ำสมัย ปลอดภัย และรวดเร็ว
            </p>

            {/* CTA Buttons */}
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-6">
              <Button 
                size="lg" 
                asChild 
                className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold px-8 py-3 text-lg rounded-lg shadow-lg hover:shadow-xl transition-all duration-200"
              >
                <Link href="/chat">เริ่มต้นใช้งาน</Link>
              </Button>
              <Button 
                variant="outline" 
                size="lg" 
                asChild 
                className="w-full sm:w-auto border-2 border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 px-8 py-3 text-lg rounded-lg transition-all duration-200"
              >
                <Link href="/auth/login">เข้าสู่ระบบ</Link>
              </Button>
            </div>
          </div>

          {/* Features Section */}
          <div className="mt-24 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {/* Feature 1 */}
            <div className="group rounded-2xl bg-white/60 backdrop-blur-sm border border-slate-200 p-8 shadow-sm hover:shadow-md transition-all duration-200 dark:bg-slate-800/60 dark:border-slate-700">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-center mb-6">
                <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h1 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">RAG & Document Search</h1>
              <p className="text-slate-600 dark:text-slate-300">
                ผสานการค้นหาข้อมูลจากเอกสาร, ฐานข้อมูล และ AI agent<br />
                <span className="text-blue-700 dark:text-blue-300">Vector Search + Structured Data</span>
              </p>
            </div>

            {/* Feature 2 */}
            <div className="group rounded-2xl bg-white/60 backdrop-blur-sm border border-slate-200 p-8 shadow-sm hover:shadow-md transition-all duration-200 dark:bg-slate-800/60 dark:border-slate-700">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-r from-purple-500 to-purple-600 flex items-center justify-center mb-6">
                <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <h1 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">Tool Calling & Smart Query</h1>
              <p className="text-slate-600 dark:text-slate-300">
                ค้นหาข้อมูลสินค้า, ยอดขาย, และข้อมูลสำคัญจากฐานข้อมูล Supabase<br />
                <span className="text-purple-700 dark:text-purple-300">รองรับภาษาไทย-อังกฤษ, Partial Matching</span>
              </p>
            </div>

            {/* Feature 3 */}
            <div className="group rounded-2xl bg-white/60 backdrop-blur-sm border border-slate-200 p-8 shadow-sm hover:shadow-md transition-all duration-200 dark:bg-slate-800/60 dark:border-slate-700 sm:col-span-2 lg:col-span-1">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-r from-green-500 to-green-600 flex items-center justify-center mb-6">
                <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h1 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">Security & Modern UI</h1>
              <p className="text-slate-600 dark:text-slate-300">
                ปลอดภัยด้วย Supabase Auth, RLS และ UI สวยงามทันสมัย<br />
                <span className="text-green-700 dark:text-green-300">Responsive, TypeScript, Edge Runtime</span>
              </p>
            </div>

            {/* Feature 4 */}
            <div className="group rounded-2xl bg-white/60 backdrop-blur-sm border border-slate-200 p-8 shadow-sm hover:shadow-md transition-all duration-200 dark:bg-slate-800/60 dark:border-slate-700">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-r from-yellow-400 to-yellow-500 flex items-center justify-center mb-6">
                <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 17l4 4 4-4m-4-5v9" />
                </svg>
              </div>
              <h1 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">Chat History System</h1>
              <p className="text-slate-600 dark:text-slate-300">
                บันทึกและจัดการประวัติการสนทนาแบบแยก session<br />
                <span className="text-yellow-700 dark:text-yellow-300">Auto-title, Real-time, ลบ/จัดกลุ่มง่าย</span>
              </p>
            </div>

            {/* Feature 5 */}
            <div className="group rounded-2xl bg-white/60 backdrop-blur-sm border border-slate-200 p-8 shadow-sm hover:shadow-md transition-all duration-200 dark:bg-slate-800/60 dark:border-slate-700">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-r from-pink-400 to-pink-500 flex items-center justify-center mb-6">
                <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a5 5 0 00-10 0v2a5 5 0 0010 0zM12 17v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                </svg>
              </div>
              <h1 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">Advanced Memory Management</h1>
              <p className="text-slate-600 dark:text-slate-300">
                บีบอัดและสรุปประวัติการสนทนาอัตโนมัติ<br />
                <span className="text-pink-700 dark:text-pink-300">Context Window, Token Counting, Smart Summarization</span>
              </p>
            </div>

            {/* Feature 6 */}
            <div className="group rounded-2xl bg-white/60 backdrop-blur-sm border border-slate-200 p-8 shadow-sm hover:shadow-md transition-all duration-200 dark:bg-slate-800/60 dark:border-slate-700">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-r from-indigo-400 to-indigo-500 flex items-center justify-center mb-6">
                <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <h1 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">Modern UI & Responsive Design</h1>
              <p className="text-slate-600 dark:text-slate-300">
                UI สวยงาม ทันสมัย รองรับทุกอุปกรณ์<br />
                <span className="text-indigo-700 dark:text-indigo-300">shadcn/ui, Tailwind CSS, Mobile Friendly</span>
              </p>
            </div>
          </div>

          {/* Stats Section */}
          <div className="mt-24 rounded-3xl bg-gradient-to-r from-blue-600 to-purple-600 p-8 text-center text-white sm:p-12">
            <h2 className="text-3xl font-bold mb-8 sm:text-4xl">จุดเด่นที่ผู้ใช้ไว้วางใจ</h2>
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
              <div>
                <div className="text-4xl font-bold sm:text-5xl">10K+</div>
                <div className="mt-2 text-blue-100">ผู้ใช้งานจริง</div>
              </div>
              <div>
                <div className="text-4xl font-bold sm:text-5xl">99.9%</div>
                <div className="mt-2 text-blue-100">Uptime & Reliability</div>
              </div>
              <div>
                <div className="text-4xl font-bold sm:text-5xl">5+</div>
                <div className="mt-2 text-blue-100">ระบบอัจฉริยะ (RAG, Tool Calling, Document Loader, Security, UI)</div>
              </div>
            </div>
            <div className="mt-8 text-lg text-blue-100">
              <span className="font-semibold">พร้อมให้บริการ 24/7 | รองรับภาษาไทย-อังกฤษ | ปลอดภัยและทันสมัย</span>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-24 border-t border-slate-200 bg-white/50 backdrop-blur-sm dark:border-slate-700 dark:bg-slate-800/50">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="flex items-center justify-center space-x-2 mb-4">
              <div className="h-6 w-6 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                <span className="text-white font-bold text-xs">AI</span>
              </div>
              <span className="text-lg font-bold text-slate-900 dark:text-white">Genius AI Chatbot</span>
            </div>
            <p className="text-slate-600 dark:text-slate-300">
              © 2025 Genius AI Chatbot. สร้างด้วย ❤️ และ AI
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}