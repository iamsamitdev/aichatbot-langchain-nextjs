## AI Chatbot with LangChain & Next.js - Day 5

## 📚 สารบัญ
- [เพิ่ม UI Feature: Chat History](#เพิ่ม-ui-feature-chat-history)
- [1. ติดตั้ง shadcn/ui Dropdown Menu และ table](#1-ติดตั้ง-shadcnui-dropdown-menu-และ-table)
- [2. สร้าง models constants](#2-สร้าง-models-constants)
- [3. สร้าง Component ModelSelector](#3-สร้าง-component-modelselector)
- [4. สร้าง Component ChatHistory](#4-สร้าง-component-chathistory)
- [5. ปรับปรุงหน้า ChatPage](#5-ปรับปรุงหน้า-chatpage)
- [6. ปรับปรุง API Route](#6-ปรับปรุง-api-route)

### เพิ่ม UI Feature: Chat History
#### 1. ติดตั้ง shadcn/ui Dropdown Menu และ table
```bash
npx shadcn@latest add dropdown-menu
npx shadcn@latest add table
```

#### 2. สร้าง models constants
สร้างไฟล์ `src/constants/models.ts`
```ts
export interface ModelOption {
  name: string
  description: string
  provider: 'OpenAI' | 'Google' | 'Azure' | 'OpenRouter' | 'Ollama' | 'vLLM' | 'Gradient'
}

export const AVAILABLE_MODELS: ModelOption[] = [
  {
    name: "gpt-4o-mini",
    description: "OpenAI GPT-4o Mini - Fast and efficient",
    provider: "OpenAI"
  },
  {
    name: "gemini-2.5-flash",
    description: "Google Gemini 2.5 Flash - Quick responses",
    provider: "Google"
  },
  {
    name: "gpt-5-mini",
    description: "Azure OpenAI GPT-5 Mini - Microsoft Azure",
    provider: "Azure"
  },
  {
    name: "qwen/qwen3-235b-a22b-2507",
    description: "OpenRouter Qwen 3 235B - Large model",
    provider: "OpenRouter"
  },
  {
    name: "qwen/qwen3-8b:free",
    description: "OpenRouter Qwen 3 8B - Free tier",
    provider: "OpenRouter"
  },
  {
    name: "gemma:2b",
    description: "Ollama Gemma 2B - Local lightweight model",
    provider: "Ollama"
  },
  {
    name: "meta-llama/llama-3.3-70b-instruct",
    description: "vLLM Llama 3.3 70B - Self-hosted",
    provider: "vLLM"
  },
  {
    name: "openai-gpt-oss-120b",
    description: "Gradient AI GPT OSS 120B - DigitalOcean",
    provider: "Gradient"
  }
]

export const DEFAULT_MODEL = AVAILABLE_MODELS[0].name
```

#### 3. สร้าง Component ModelSelector
สร้างไฟล์ `components/model-selector.tsx`
```tsx
"use client"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ChevronDown } from "lucide-react"
import { AVAILABLE_MODELS, type ModelOption } from "@/constants/models"

interface ModelSelectorProps {
  selectedModel: string
  onModelChange: (model: string) => void
  className?: string
}

export function ModelSelector({ 
  selectedModel, 
  onModelChange, 
  className 
}: ModelSelectorProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          className={cn("flex items-center gap-2 h-8 text-sm", className)}
        >
          {selectedModel}
          <ChevronDown size={16} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        {AVAILABLE_MODELS.map((model: ModelOption) => (
          <DropdownMenuItem
            key={model.name}
            onClick={() => onModelChange(model.name)}
            className={cn(
              "flex flex-col items-start gap-1 p-3 cursor-pointer",
              selectedModel === model.name && "bg-accent"
            )}
          >
            <div className="flex items-center justify-between w-full">
              <span className="font-medium">{model.name}</span>
              {selectedModel === model.name && (
                <div className="h-2 w-2 rounded-full bg-blue-500" />
              )}
            </div>
            <span className="text-xs text-muted-foreground">
              {model.description}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

#### 4. สร้าง Component ChatHistory
สร้างไฟล์ `components/chat-history.tsx`
```tsx
"use client"

import {
  ChatContainerContent,
  ChatContainerRoot,
} from "@/components/ui/chat-container"
import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
} from "@/components/ui/message"
import {
  PromptInput,
  PromptInputAction,
  PromptInputActions,
  PromptInputTextarea,
} from "@/components/ui/prompt-input"
import { ScrollButton } from "@/components/ui/scroll-button"
import { Button } from "@/components/ui/button"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { ModelSelector } from "@/components/model-selector"
import { cn } from "@/lib/utils"
import {
  ArrowUp,
  Copy,
  Globe,
  Mic,
  MoreHorizontal,
  Pencil,
  Plus,
  ThumbsDown,
  ThumbsUp,
  Trash,
} from "lucide-react"
import { useRef, useState } from "react"
import { DEFAULT_MODEL } from "@/constants/models"

// Initial chat messages
const initialMessages = [
  {
    id: 1,
    role: "user",
    content: "Hello! Can you help me with a coding question?",
  },
  {
    id: 2,
    role: "assistant",
    content:
      "Of course! I'd be happy to help with your coding question. What would you like to know?",
  },
  {
    id: 3,
    role: "user",
    content: "How do I create a responsive layout with CSS Grid?",
  },
  {
    id: 4,
    role: "assistant",
    content:
      "Creating a responsive layout with CSS Grid is straightforward. Here's a basic example:\n\n```tsx\n// src/app/page.tsx\nimport { Button } from '@/components/ui/button'\n\nexport default function Page() {\n  return (\n    <main className='p-6'>\n      <h1 className='text-2xl font-semibold'>Hello shadcn/ui</h1>\n      <Button className='mt-4'>Press me</Button>\n    </main>\n  )\n}\n```\n\nThis creates a grid where:\n- Columns automatically fit as many as possible\n- Each column is at least 250px wide\n- Columns expand to fill available space\n- There's a 1rem gap between items\n\nWould you like me to explain more about how this works?",
  },
  {
    id: 5,
    role: "user",
    content: "List  top 5 frontend frameworks show in table",
  },
  {
    id: 6,
    role: "assistant",
    content: `
| Framework      | Description                                      |
|----------------|--------------------------------------------------|
| React          | A JavaScript library for building user interfaces.|
| Vue.js         | A progressive framework for building UIs.       |
| Angular        | A platform for building mobile and desktop web applications.|
| Svelte         | A radical new approach to building user interfaces.|
| Ember.js      | A framework for creating ambitious web applications.|
`
  }
]

interface ChatHistoryProps {
  sessionId: string
  title: string
}

export function ChatHistory({ sessionId, title }: ChatHistoryProps) {

  const [prompt, setPrompt] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [chatMessages, setChatMessages] = useState(initialMessages)
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL)
  const chatContainerRef = useRef<HTMLDivElement>(null)

  const handleSubmit = () => {

    console.log("Session ID:", sessionId) // Log session ID for reference

    if (!prompt.trim()) return

    setPrompt("")
    setIsLoading(true)

    // Add user message immediately
    const newUserMessage = {
      id: chatMessages.length + 1,
      role: "user",
      content: prompt.trim(),
    }

    setChatMessages([...chatMessages, newUserMessage])

    // Simulate API response
    setTimeout(() => {
      const assistantResponse = {
        id: chatMessages.length + 2,
        role: "assistant",
        content: `This is a response to: "${prompt.trim()}"`,
      }

      setChatMessages((prev) => [...prev, assistantResponse])
      setIsLoading(false)
    }, 1500)
  }

  return (
    <main className="flex h-screen flex-col overflow-hidden">
      <header className="bg-background z-10 flex h-16 w-full shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <div className="text-foreground flex-1">{title}</div>
        
        {/* Model Selector */}
        <ModelSelector
          selectedModel={selectedModel}
          onModelChange={setSelectedModel}
        />
      </header>

      <div ref={chatContainerRef} className="relative flex-1 overflow-y-auto">
        <ChatContainerRoot className="h-full">
          <ChatContainerContent className="space-y-0 px-5 py-12">
            {chatMessages.map((message, index) => {
              const isAssistant = message.role === "assistant"
              const isLastMessage = index === chatMessages.length - 1

              return (
                <Message
                  key={message.id}
                  className={cn(
                    "mx-auto flex w-full max-w-3xl flex-col gap-2 px-6",
                    isAssistant ? "items-start" : "items-end"
                  )}
                >
                  {isAssistant ? (
                    <div className="group flex w-full flex-col gap-0">
                      <MessageContent
                        className="text-foreground prose flex-1 rounded-lg bg-transparent p-0"
                        markdown
                      >
                        {message.content}
                      </MessageContent>
                      <MessageActions
                        className={cn(
                          "-ml-2.5 flex gap-0 opacity-0 transition-opacity duration-150 group-hover:opacity-100",
                          isLastMessage && "opacity-100"
                        )}
                      >
                        <MessageAction tooltip="Copy" delayDuration={100}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="rounded-full"
                          >
                            <Copy />
                          </Button>
                        </MessageAction>
                        <MessageAction tooltip="Upvote" delayDuration={100}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="rounded-full"
                          >
                            <ThumbsUp />
                          </Button>
                        </MessageAction>
                        <MessageAction tooltip="Downvote" delayDuration={100}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="rounded-full"
                          >
                            <ThumbsDown />
                          </Button>
                        </MessageAction>
                      </MessageActions>
                    </div>
                  ) : (
                    <div className="group w-full flex flex-col items-end gap-1">
                      <MessageContent className="user-message bg-[#e5f3ff] text-primary max-w-[75%] rounded-3xl px-5 py-2.5 break-words whitespace-pre-wrap">
                        {message.content}
                      </MessageContent>
                      <MessageActions
                        className={cn(
                          "flex gap-0 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                        )}
                      >
                        <MessageAction tooltip="Edit" delayDuration={100}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="rounded-full"
                          >
                            <Pencil />
                          </Button>
                        </MessageAction>
                        <MessageAction tooltip="Delete" delayDuration={100}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="rounded-full"
                          >
                            <Trash />
                          </Button>
                        </MessageAction>
                        <MessageAction tooltip="Copy" delayDuration={100}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="rounded-full"
                          >
                            <Copy />
                          </Button>
                        </MessageAction>
                      </MessageActions>
                    </div>
                  )}
                </Message>
              )
            })}
          </ChatContainerContent>
          <div className="absolute bottom-4 left-1/2 flex w-full max-w-3xl -translate-x-1/2 justify-end px-5">
            <ScrollButton className="shadow-sm" />
          </div>
        </ChatContainerRoot>
      </div>

      <div className="bg-background z-10 shrink-0 px-3 pb-3 md:px-5 md:pb-5">
        <div className="mx-auto max-w-3xl">
          <PromptInput
            isLoading={isLoading}
            value={prompt}
            onValueChange={setPrompt}
            onSubmit={handleSubmit}
            className="border-input bg-popover relative z-10 w-full rounded-3xl border p-0 pt-1 shadow-xs"
          >
            <div className="flex flex-col">
              <PromptInputTextarea
                placeholder="Ask anything"
                className="min-h-[44px] pt-3 pl-4 text-base leading-[1.3] sm:text-base md:text-base"
              />

              <PromptInputActions className="mt-5 flex w-full items-center justify-between gap-2 px-3 pb-3">
                <div className="flex items-center gap-2">
                  <PromptInputAction tooltip="Add a new action">
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-9 rounded-full"
                    >
                      <Plus size={18} />
                    </Button>
                  </PromptInputAction>

                  <PromptInputAction tooltip="Search">
                    <Button variant="outline" className="rounded-full">
                      <Globe size={18} />
                      Search
                    </Button>
                  </PromptInputAction>

                  <PromptInputAction tooltip="More actions">
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-9 rounded-full"
                    >
                      <MoreHorizontal size={18} />
                    </Button>
                  </PromptInputAction>
                </div>
                <div className="flex items-center gap-2">
                  <PromptInputAction tooltip="Voice input">
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-9 rounded-full"
                    >
                      <Mic size={18} />
                    </Button>
                  </PromptInputAction>

                  <Button
                    size="icon"
                    disabled={!prompt.trim() || isLoading}
                    onClick={handleSubmit}
                    className="size-9 rounded-full"
                  >
                    {!isLoading ? (
                      <ArrowUp size={18} />
                    ) : (
                      <span className="size-3 rounded-xs bg-white" />
                    )}
                  </Button>
                </div>
              </PromptInputActions>
            </div>
          </PromptInput>
        </div>
      </div>
    </main>
  )
}
```

#### 5. สร้าง Dynamic Page สำหรับ Chat Session
สร้างไฟล์ `app/chat/[id]/page.tsx`
```tsx
import { createClient } from "@/lib/server"
import { redirect } from "next/navigation"
import { ChatHistory } from "@/components/chat-history"

interface ChatPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function HistoryChatPage({ params }: ChatPageProps) {
    
  const supabase = await createClient()
  const { id } = await params

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    redirect("/auth/login")
  }

  // ในอนาคตสามารถดึงข้อมูล chat จาก database ได้
  // const { data: chat } = await supabase
  //   .from('chats')
  //   .select('*')
  //   .eq('id', id)
  //   .single()

  // Mock data ตาม chat ID
  const getChatTitle = (id: string) => {
    switch (id) {
      case "project-roadmap-discussion":
        return "Project roadmap discussion"
      case "api-documentation-review":
        return "API Documentation Review"
      case "frontend-bug-analysis":
        return "Frontend Bug Analysis"
      case "database-schema-design":
        return "Database Schema Design"
      case "performance-optimization":
        return "Performance Optimization"
      case "authentication-flow":
        return "Authentication Flow"
      case "component-library":
        return "Component Library"
      case "initial-project-setup":
        return "Initial Project Setup"
      default:
        return "Chat Conversation"
    }
  }

  return <ChatHistory sessionId={id} title={getChatTitle(id)} />
}
```

#### 6. แก้ไข Component NewChat
แก้ไขไฟล์ `components/new-chat.tsx` เพื่อเพิ่ม model selector
```tsx
"use client"

import {
  ChatContainerContent,
  ChatContainerRoot,
} from "@/components/ui/chat-container"
import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
} from "@/components/ui/message"
import {
  PromptInput,
  PromptInputAction,
  PromptInputActions,
  PromptInputTextarea,
} from "@/components/ui/prompt-input"
import { ScrollButton } from "@/components/ui/scroll-button"
import { Button } from "@/components/ui/button"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { ModelSelector } from "@/components/model-selector"
import { cn } from "@/lib/utils"
import {
  ArrowUp,
  Copy,
  Globe,
  Mic,
  MoreHorizontal,
  Pencil,
  Plus,
  ThumbsDown,
  ThumbsUp,
  Trash,
} from "lucide-react"
import { useRef, useState, useEffect } from "react"
import { useChatContext } from "@/contexts/chat-context"
import { DEFAULT_MODEL } from "@/constants/models"

export function NewChat() {

  const [prompt, setPrompt] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL)
  const { chatMessages, setChatMessages, showWelcome, setShowWelcome } = useChatContext()
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Focus textarea on component mount when on welcome screen
  useEffect(() => {
    if (showWelcome) {
      setTimeout(() => {
        textareaRef.current?.focus()
      }, 100)
    }
  }, [showWelcome])

  const handleSubmit = () => {

    if (!prompt.trim()) return

    setPrompt("")
    setIsLoading(true)
    setShowWelcome(false)

    // Add user message immediately
    const newUserMessage = {
      id: chatMessages.length + 1,
      role: "user",
      content: prompt.trim(),
    }

    setChatMessages([...chatMessages, newUserMessage])

    // Simulate API response
    setTimeout(() => {
      const assistantResponse = {
        id: chatMessages.length + 2,
        role: "assistant",
        content: `นี่คือการตอบกลับสำหรับคำถาม: "${prompt.trim()}"\n\nขอบคุณที่ถามคำถาม! ฉันพร้อมช่วยเหลือคุณในเรื่องต่างๆ`,
      }

      setChatMessages((prev) => [...prev, assistantResponse])
      setIsLoading(false)
    }, 1500)
  }

  const handleSamplePrompt = (samplePrompt: string) => {
    setPrompt(samplePrompt)
  }

  return (
    <main className="flex h-screen flex-col overflow-hidden">
      <header className="bg-background z-10 flex h-16 w-full shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <div className="text-foreground flex-1">New Chat</div>
        
        {/* Model Selector */}
        <ModelSelector
          selectedModel={selectedModel}
          onModelChange={setSelectedModel}
        />
      </header>

      <div ref={chatContainerRef} className="relative flex-1 overflow-y-auto">
        <ChatContainerRoot className="h-full">
          <ChatContainerContent
            className={cn(
              "px-5 py-12",
              showWelcome ? "flex items-center justify-center h-full" : "space-y-0"
            )}
          >
            {showWelcome ? (
              <div className="text-center max-w-2xl mx-auto">
                <div className="mb-8">
                  <div className="h-20 w-20 mx-auto mb-6 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                    <span className="text-white font-bold text-2xl">AI</span>
                  </div>
                  <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-4">
                    Welcome to Genius AI
                  </h1>
                  <p className="text-lg text-slate-600 dark:text-slate-400 mb-8">
                    Ask me anything, and I&aposll help you with coding,
                    problem-solving, and creative tasks.
                  </p>
                </div>

                {/* Sample prompts */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                  <button
                    onClick={() =>
                      handleSamplePrompt(
                        "How do I create a responsive layout with CSS Grid?"
                      )
                    }
                    className="p-4 text-left rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <div className="font-medium text-slate-900 dark:text-white mb-1">
                      CSS Grid Layout
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-400">
                      Learn how to create responsive layouts
                    </div>
                  </button>

                  <button
                    onClick={() =>
                      handleSamplePrompt(
                        "Explain React hooks and when to use them"
                      )
                    }
                    className="p-4 text-left rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <div className="font-medium text-slate-900 dark:text-white mb-1">
                      React Hooks
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-400">
                      Understanding hooks and their use cases
                    </div>
                  </button>

                  <button
                    onClick={() =>
                      handleSamplePrompt(
                        "What are the best practices for API design?"
                      )
                    }
                    className="p-4 text-left rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <div className="font-medium text-slate-900 dark:text-white mb-1">
                      API Design
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-400">
                      Best practices for building APIs
                    </div>
                  </button>

                  <button
                    onClick={() =>
                      handleSamplePrompt("Help me debug this JavaScript error")
                    }
                    className="p-4 text-left rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <div className="font-medium text-slate-900 dark:text-white mb-1">
                      Debug JavaScript
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-400">
                      Get help with debugging code issues
                    </div>
                  </button>
                </div>
              </div>
            ) : (
              // Chat messages display
              <>
                {chatMessages.map((message, index) => {
                  const isAssistant = message.role === "assistant"
                  const isLastMessage = index === chatMessages.length - 1

                  return (
                    <Message
                      key={message.id}
                      className={cn(
                        "mx-auto flex w-full max-w-3xl flex-col gap-2 px-6",
                        isAssistant ? "items-start" : "items-end"
                      )}
                    >
                      {isAssistant ? (
                        <div className="group flex w-full flex-col gap-0">
                          <MessageContent
                            className="text-foreground prose flex-1 rounded-lg bg-transparent p-0"
                            markdown
                          >
                            {message.content}
                          </MessageContent>
                          <MessageActions
                            className={cn(
                              "-ml-2.5 flex gap-0 opacity-0 transition-opacity duration-150 group-hover:opacity-100",
                              isLastMessage && "opacity-100"
                            )}
                          >
                            <MessageAction tooltip="Copy" delayDuration={100}>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="rounded-full"
                              >
                                <Copy />
                              </Button>
                            </MessageAction>
                            <MessageAction tooltip="Upvote" delayDuration={100}>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="rounded-full"
                              >
                                <ThumbsUp />
                              </Button>
                            </MessageAction>
                            <MessageAction
                              tooltip="Downvote"
                              delayDuration={100}
                            >
                              <Button
                                variant="ghost"
                                size="icon"
                                className="rounded-full"
                              >
                                <ThumbsDown />
                              </Button>
                            </MessageAction>
                          </MessageActions>
                        </div>
                      ) : (
                        <div className="group w-full flex flex-col items-end gap-1">
                          <MessageContent className="user-message bg-[#e5f3ff] text-primary max-w-[75%] rounded-3xl px-5 py-2.5 break-words whitespace-pre-wrap">
                            {message.content}
                          </MessageContent>
                          <MessageActions
                            className={cn(
                              "flex gap-0 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                            )}
                          >
                            <MessageAction tooltip="Edit" delayDuration={100}>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="rounded-full"
                              >
                                <Pencil />
                              </Button>
                            </MessageAction>
                            <MessageAction tooltip="Delete" delayDuration={100}>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="rounded-full"
                              >
                                <Trash />
                              </Button>
                            </MessageAction>
                            <MessageAction tooltip="Copy" delayDuration={100}>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="rounded-full"
                              >
                                <Copy />
                              </Button>
                            </MessageAction>
                          </MessageActions>
                        </div>
                      )}
                    </Message>
                  )
                })}
              </>
            )}
          </ChatContainerContent>
          {!showWelcome && (
            <div className="absolute bottom-4 left-1/2 flex w-full max-w-3xl -translate-x-1/2 justify-end px-5">
              <ScrollButton className="shadow-sm" />
            </div>
          )}
        </ChatContainerRoot>
      </div>

      <div className="bg-background z-10 shrink-0 px-3 pb-3 md:px-5 md:pb-5">
        <div className="mx-auto max-w-3xl">
          <PromptInput
            isLoading={isLoading}
            value={prompt}
            onValueChange={setPrompt}
            onSubmit={handleSubmit}
            className="border-input bg-popover relative z-10 w-full rounded-3xl border p-0 pt-1 shadow-xs"
          >
            <div className="flex flex-col">
              <PromptInputTextarea
                ref={textareaRef}
                placeholder="Ask anything to start a new chat..."
                className="min-h-[44px] pt-3 pl-4 text-base leading-[1.3] sm:text-base md:text-base"
              />

              <PromptInputActions className="mt-5 flex w-full items-center justify-between gap-2 px-3 pb-3">
                <div className="flex items-center gap-2">
                  <PromptInputAction tooltip="Add a new action">
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-9 rounded-full"
                    >
                      <Plus size={18} />
                    </Button>
                  </PromptInputAction>

                  <PromptInputAction tooltip="Search">
                    <Button variant="outline" className="rounded-full">
                      <Globe size={18} />
                      Search
                    </Button>
                  </PromptInputAction>

                  <PromptInputAction tooltip="More actions">
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-9 rounded-full"
                    >
                      <MoreHorizontal size={18} />
                    </Button>
                  </PromptInputAction>
                </div>
                <div className="flex items-center gap-2">
                  <PromptInputAction tooltip="Voice input">
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-9 rounded-full"
                    >
                      <Mic size={18} />
                    </Button>
                  </PromptInputAction>

                  <Button
                    size="icon"
                    disabled={!prompt.trim() || isLoading}
                    onClick={handleSubmit}
                    className="size-9 rounded-full"
                  >
                    {!isLoading ? (
                      <ArrowUp size={18} />
                    ) : (
                      <span className="size-3 rounded-xs bg-white" />
                    )}
                  </Button>
                </div>
              </PromptInputActions>
            </div>
          </PromptInput>
        </div>
      </div>
    </main>
  )
}
```
#### 7. แก้ไข code-block ใน Message component
แก้ไขไฟล์ `components/ui/code-block.tsx` เพื่อเพิ่มการรองรับ markdown
```tsx
"use client"

import { cn } from "@/lib/utils"
import React, { useEffect, useState } from "react"
import { codeToHtml } from "shiki"
import { Copy, Check, Download } from "lucide-react"
import { Button } from "./button"

export type CodeBlockProps = {
  children?: React.ReactNode
  className?: string
  title?: string
  language?: string
  filename?: string
} & React.HTMLProps<HTMLDivElement>

function CodeBlock({ 
  children, 
  className, 
  title, 
  language, 
  filename,
  ...props 
}: CodeBlockProps) {
  return (
    <div
      className={cn(
        "not-prose flex w-full flex-col overflow-clip border my-4",
        "border-border bg-zinc-950 text-zinc-100 rounded-xl shadow-lg",
        "dark:bg-zinc-900 dark:border-zinc-800",
        className
      )}
      {...props}
    >
      {(title || filename || language) && (
        <CodeBlockHeader 
          title={title || filename} 
          language={language}
        />
      )}
      {children}
    </div>
  )
}

type CodeBlockHeaderProps = {
  title?: string
  language?: string
}

function CodeBlockHeader({ title, language }: CodeBlockHeaderProps) {
  return (
    <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-zinc-900/50">
      <div className="flex items-center gap-2">
        {/* Traffic light dots */}
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <div className="w-3 h-3 rounded-full bg-yellow-500" />
          <div className="w-3 h-3 rounded-full bg-green-500" />
        </div>
        {title && (
          <span className="text-sm text-zinc-400 ml-2">{title}</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {language && (
          <span className="text-xs text-zinc-500 uppercase font-mono">
            {language}
          </span>
        )}
      </div>
    </div>
  )
}

export type CodeBlockCodeProps = {
  code: string
  language?: string
  theme?: string
  className?: string
  showLineNumbers?: boolean
  allowCopy?: boolean
  allowDownload?: boolean
  filename?: string
} & React.HTMLProps<HTMLDivElement>

function CodeBlockCode({
  code,
  language = "tsx",
  theme = "github-dark-dimmed",
  className,
  showLineNumbers = false,
  allowCopy = true,
  allowDownload = false,
  filename,
  ...props
}: CodeBlockCodeProps) {
  const [highlightedHtml, setHighlightedHtml] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    async function highlight() {
      if (!code) {
        setHighlightedHtml("<pre><code></code></pre>")
        return
      }

      const html = await codeToHtml(code, { 
        lang: language, 
        theme,
        transformers: showLineNumbers ? [{
          pre(node) {
            node.properties.style = `${node.properties.style || ''}; counter-reset: line;`
          },
          line(node) {
            node.children.unshift({
              type: 'element',
              tagName: 'span',
              properties: {
                className: ['line-number'],
                style: 'counter-increment: line; display: inline-block; width: 1rem; margin-right: 1rem; color: #6b7280; text-align: right;'
              },
              children: []
            })
          }
        }] : []
      })
      setHighlightedHtml(html)
    }
    highlight()
  }, [code, language, theme, showLineNumbers])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const handleDownload = () => {
    const blob = new Blob([code], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename || `code.${language}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const classNames = cn(
    "relative w-full overflow-x-auto text-[13px] bg-zinc-950",
    "[&>pre]:px-4 [&>pre]:py-4 [&>pre]:bg-transparent",
    "[&>pre>code]:bg-transparent [&>pre>code]:p-0",
    showLineNumbers && "[&>pre>code]:grid [&>pre>code]:gap-0",
    className
  )

  // SSR fallback: render plain code if not hydrated yet
  return (
    <div className="relative group">
      {/* Action buttons */}
      {(allowCopy || allowDownload) && (
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
          <div className="flex items-center gap-1">
            {allowCopy && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className="h-8 w-8 p-0 bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-300 hover:text-zinc-100"
              >
                {copied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            )}
            {allowDownload && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDownload}
                className="h-8 w-8 p-0 bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-300 hover:text-zinc-100"
              >
                <Download className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      )}

      {highlightedHtml ? (
        <div
          className={classNames}
          dangerouslySetInnerHTML={{ __html: highlightedHtml }}
          {...props}
        />
      ) : (
        <div className={classNames} {...props}>
          <pre className="px-4 py-4">
            <code>{code}</code>
          </pre>
        </div>
      )}
    </div>
  )
}

export type CodeBlockGroupProps = React.HTMLAttributes<HTMLDivElement>

function CodeBlockGroup({
  children,
  className,
  ...props
}: CodeBlockGroupProps) {
  return (
    <div
      className={cn("flex items-center justify-between gap-2", className)}
      {...props}
    >
      {children}
    </div>
  )
}

// Convenience wrapper for common use case
export type SimpleCodeBlockProps = {
  code: string
  language?: string
  title?: string
  filename?: string
  showLineNumbers?: boolean
  allowCopy?: boolean
  allowDownload?: boolean
  className?: string
}

function SimpleCodeBlock({
  code,
  language = "tsx",
  title,
  filename,
  showLineNumbers = false,
  allowCopy = true,
  allowDownload = false,
  className
}: SimpleCodeBlockProps) {
  return (
    <CodeBlock 
      className={className} 
      title={title} 
      filename={filename} 
      language={language}
    >
      <CodeBlockCode
        code={code}
        language={language}
        showLineNumbers={showLineNumbers}
        allowCopy={allowCopy}
        allowDownload={allowDownload}
        filename={filename}
      />
    </CodeBlock>
  )
}

export { CodeBlockGroup, CodeBlockCode, CodeBlock, SimpleCodeBlock }
```

#### 8. แก้ไข markdown prop ใน MessageContent
แก้ไขไฟล์ `components/ui/markdown.tsx`
```tsx
import { cn } from "@/lib/utils"
import { marked } from "marked"
import { memo, useId, useMemo } from "react"
import ReactMarkdown, { Components } from "react-markdown"
import remarkBreaks from "remark-breaks"
import remarkGfm from "remark-gfm"
import { CodeBlock, CodeBlockCode } from "./code-block"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./table"

export type MarkdownProps = {
  children: string
  id?: string
  className?: string
  components?: Partial<Components>
}

function parseMarkdownIntoBlocks(markdown: string): string[] {
  const tokens = marked.lexer(markdown)
  return tokens.map((token) => token.raw)
}

function extractLanguage(className?: string): string {
  if (!className) return "plaintext"
  const match = className.match(/language-(\w+)/)
  return match ? match[1] : "plaintext"
}

const INITIAL_COMPONENTS: Partial<Components> = {
  code: function CodeComponent({ className, children, ...props }) {
    const isInline =
      !props.node?.position?.start.line ||
      props.node?.position?.start.line === props.node?.position?.end.line

    if (isInline) {
      return (
        <span
          className={cn(
            "bg-primary-foreground rounded-sm px-1 font-mono text-sm",
            className
          )}
          {...props}
        >
          {children}
        </span>
      )
    }

    const language = extractLanguage(className)

    return (
      <CodeBlock className={className}>
        <CodeBlockCode code={children as string} language={language} />
      </CodeBlock>
    )
  },
  pre: function PreComponent({ children }) {
    return <>{children}</>
  },
  table: function TableComponent({ children }) {
    return (
      <div className="my-4 overflow-x-auto">
        <Table>
          {children}
        </Table>
      </div>
    )
  },
  thead: function TableHeaderComponent({ children }) {
    return <TableHeader>{children}</TableHeader>
  },
  tbody: function TableBodyComponent({ children }) {
    return <TableBody>{children}</TableBody>
  },
  tr: function TableRowComponent({ children }) {
    return <TableRow>{children}</TableRow>
  },
  th: function TableHeadComponent({ children }) {
    return <TableHead>{children}</TableHead>
  },
  td: function TableCellComponent({ children }) {
    return <TableCell>{children}</TableCell>
  },
}

const MemoizedMarkdownBlock = memo(
  function MarkdownBlock({
    content,
    components = INITIAL_COMPONENTS,
  }: {
    content: string
    components?: Partial<Components>
  }) {
    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    )
  },
  function propsAreEqual(prevProps, nextProps) {
    return prevProps.content === nextProps.content
  }
)

MemoizedMarkdownBlock.displayName = "MemoizedMarkdownBlock"

function MarkdownComponent({
  children,
  id,
  className,
  components = INITIAL_COMPONENTS,
}: MarkdownProps) {
  const generatedId = useId()
  const blockId = id ?? generatedId
  const blocks = useMemo(() => parseMarkdownIntoBlocks(children), [children])

  return (
    <div className={className}>
      {blocks.map((block, index) => (
        <MemoizedMarkdownBlock
          key={`${blockId}-block-${index}`}
          content={block}
          components={components}
        />
      ))}
    </div>
  )
}

const Markdown = memo(MarkdownComponent)
Markdown.displayName = "Markdown"

export { Markdown }
```
<br />
*** Note: แยก branch ใหม่สำหรับเพิ่ม Dark Mode Feature

#### สร้าง Branch ใหม่
```bash
git add .
git commit -m "Finish chat history and new chat pages"
git checkout -b 05-dark-theme-ui
```

### เพิ่ม Dark Mode Feature

#### 1. สร้าง ThemeProvider
สร้างไฟล์ `lib/theme-provider.tsx`
```tsx
/**
 * ============================================================================
 * THEME PROVIDER - ระบบจัดการ Theme สำหรับ Light/Dark Mode
 * ============================================================================
 * 
 * Provider นี้จัดการ theme ของทั้งแอปพลิเคชัน รองรับ:
 * - Light Mode: โหมดสว่าง
 * - Dark Mode: โหมดมืด  
 * - System Mode: ปรับตาม system preference
 * 
 * Features:
 * - เก็บ theme preference ใน localStorage
 * - รองรับ system preference detection
 * - มี force override สำหรับ light/dark mode
 * - ใช้ CSS classes และ data attributes
 */

"use client"

import React, { createContext, useContext, useEffect, useState } from "react"

// ประเภท theme ที่รองรับ
type Theme = "light" | "dark" | "system"

// Props สำหรับ ThemeProvider component
type ThemeProviderProps = {
  children: React.ReactNode           // Component ลูกที่จะถูก wrap
  defaultTheme?: Theme               // Theme เริ่มต้น (default: "system")
  storageKey?: string                // Key สำหรับเก็บใน localStorage (default: "ui-theme")
}

// State และ methods ที่จะส่งผ่าน Context
type ThemeProviderState = {
  theme: Theme                       // Theme ปัจจุบัน
  setTheme: (theme: Theme) => void   // ฟังก์ชันเปลี่ยน theme
}

// ค่าเริ่มต้นของ Context
const initialState: ThemeProviderState = {
  theme: "system",
  setTheme: () => null,
}

// สร้าง Context สำหรับแชร์ theme state
const ThemeProviderContext = createContext<ThemeProviderState>(initialState)

// Export Context เพื่อให้ components อื่นสามารถใช้ได้
export { ThemeProviderContext }

/**
 * ThemeProvider Component - จัดการ theme ของทั้งแอปพลิเคชัน
 * 
 * รับผิดชอบ:
 * - เก็บ theme state ปัจจุบัน
 * - โหลด theme จาก localStorage
 * - ปรับ CSS classes และ attributes ตาม theme
 * - Listen การเปลี่ยนแปลง system preference
 */
export function ThemeProvider({
  children,
  defaultTheme = "system",     // Theme เริ่มต้น
  storageKey = "ui-theme",     // Key สำหรับ localStorage
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(defaultTheme)  // Theme ปัจจุบัน
  const [mounted, setMounted] = useState(false)           // สถานะการ mount ของ component

  /**
   * Effect แรก: โหลด theme จาก localStorage เมื่อ component mount
   */
  useEffect(() => {
    setMounted(true)                                               // ตั้งสถานะ mounted เป็น true
    const storedTheme = localStorage?.getItem(storageKey) as Theme // ดึง theme จาก localStorage
    if (storedTheme) {
      setTheme(storedTheme)                                        // ใช้ theme จาก localStorage
    }
  }, [storageKey])

  /**
   * Effect หลัก: ปรับ CSS classes และ attributes ตาม theme
   * ทำงานเมื่อ theme หรือ mounted state เปลี่ยน
   */
  useEffect(() => {
    if (!mounted) return                                           // รอให้ component mount เสร็จก่อน

    const root = window.document.documentElement                   // ดึง root element (<html>)

    // ลบ class และ attribute เดิมออกก่อน
    root.classList.remove("light", "dark", "force-light", "force-dark")
    root.removeAttribute("data-theme")

    if (theme === "system") {
      // สำหรับ system mode: ปรับตาม system preference
      const applySystemTheme = () => {
        const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches  // เช็ค system preference
        
        root.classList.remove("light", "dark")                    // ลบ theme class เดิม
        if (systemPrefersDark) {
          root.classList.add("dark")                              // เพิ่ม dark class
        } else {
          root.classList.add("light")                             // เพิ่ม light class
        }
      }

      applySystemTheme()                                           // ปรับ theme ทันที
      
      root.setAttribute("data-theme", "system")                   // เพิ่ม data-theme="system"

      // Listen การเปลี่ยนแปลง system preference
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
      mediaQuery.addEventListener("change", applySystemTheme)
      
      // Cleanup listener เมื่อ component unmount หรือ theme เปลี่ยน
      return () => {
        mediaQuery.removeEventListener("change", applySystemTheme)
      }
    }

    // สำหรับ force theme (light หรือ dark)
    root.setAttribute("data-theme", theme)                         // เพิ่ม data-theme attribute
    root.classList.add(theme)                                      // เพิ่ม theme class (backward compatibility)
    
    // เพิ่ม force class เพื่อ override media query
    if (theme === "light") {
      root.classList.add("force-light")                           // บังคับใช้ light mode
    } else if (theme === "dark") {
      root.classList.add("force-dark")                            // บังคับใช้ dark mode
    }
  }, [theme, mounted])

  // สร้าง value object สำหรับ Context Provider
  const value = {
    theme,                                                         // Theme ปัจจุบัน
    setTheme: (theme: Theme) => {                                  // ฟังก์ชันเปลี่ยน theme
      localStorage?.setItem(storageKey, theme)                     // เก็บ theme ลง localStorage
      setTheme(theme)                                              // อัพเดท theme state
    },
  }

  // Render Provider พร้อม value
  return (
    <ThemeProviderContext.Provider value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

/**
 * Custom Hook สำหรับใช้งาน Theme Context
 * 
 * ใช้สำหรับ:
 * - ดึง theme ปัจจุบัน
 * - เปลี่ยน theme ผ่านฟังก์ชัน setTheme
 * 
 * ต้องใช้ภายใน ThemeProvider เท่านั้น
 */
export const useTheme = () => {
  const context = useContext(ThemeProviderContext)                 // ดึง context

  // ตรวจสอบว่าใช้ใน ThemeProvider หรือไม่
  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider")

  return context                                                   // ส่งคืน theme state และ methods
}
```

#### 2. สร้างไฟล์ ThemeToggle
สร้างไฟล์ `components/ui/theme-toggle.tsx`
```tsx
"use client"

import * as React from "react"
import { Moon, Sun, Monitor } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useTheme } from "@/lib/theme-provider"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  const themes = [
    {
      value: "light",
      label: "Light",
      icon: Sun,
    },
    {
      value: "dark", 
      label: "Dark",
      icon: Moon,
    },
    {
      value: "system",
      label: "System",
      icon: Monitor,
    },
  ]

  const currentTheme = themes.find(t => t.value === theme) || themes[2]
  const CurrentIcon = currentTheme.icon

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon">
          <CurrentIcon className="h-[1.2rem] w-[1.2rem]" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-40" align="end">
        <div className="space-y-1">
          {themes.map((themeOption) => {
            const Icon = themeOption.icon
            return (
              <Button
                key={themeOption.value}
                variant={theme === themeOption.value ? "default" : "ghost"}
                className="w-full justify-start"
                onClick={() => setTheme(themeOption.value as "light" | "dark" | "system")}
              >
                <Icon className="mr-2 h-4 w-4" />
                {themeOption.label}
              </Button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
```

#### 3. เพิ่ม ThemeToggle ใน Chat Sidebar
แก้ไขไฟล์ `components/chat-sidebar.tsx`

```tsx
import { ThemeToggle } from "@/components/ui/theme-toggle"

{/* Place button Theme toggle here */}
<ThemeToggle />
```

#### 4. เพิ่ม ThemeProvider ใน Root Layout
แก้ไขไฟล์ `app/layout.tsx`
```tsx
import type { Metadata } from "next"
import { Anuphan, Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/lib/theme-provider"

const anuphan = Anuphan({
  variable: "--font-anuphan",
  subsets: ["latin"],
})

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "AI Chatbot with Langchain and Next.js",
  description: "A simple AI chatbot application built with Langchain and Next.js.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
     <html lang="en">
      <body className={`${anuphan.variable} ${inter.variable}`}>
        <ThemeProvider
          defaultTheme="system"
          storageKey="ai-chatbot-theme"
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
```

### 5. แก้ไข Settings ใน General Settings
แก้ไขไฟล์ `components/settings/general-tab.tsx`
```tsx
import { useTheme } from "@/lib/theme-provider"

export function GeneralTab() {
  const { theme, setTheme } = useTheme()

 return (
  ...
  <select 
            value={theme}
            onChange={(e) => setTheme(e.target.value as "light" | "dark" | "system")}
            className="w-full px-3 py-2.5 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none shadow-sm text-sm"
            style={{ WebkitAppearance: 'none', MozAppearance: 'none', appearance: 'none' }}
          >
            {themeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
 )
 ...
}
```

###### 6. แก้ไข global.css
แก้ไขไฟล์ `styles/globals.css`
```css
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
  --color-sidebar-ring: var(--sidebar-ring);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar: var(--sidebar);
  --color-chart-5: var(--chart-5);
  --color-chart-4: var(--chart-4);
  --color-chart-3: var(--chart-3);
  --color-chart-2: var(--chart-2);
  --color-chart-1: var(--chart-1);
  --color-ring: var(--ring);
  --color-input: var(--input);
  --color-border: var(--border);
  --color-destructive: var(--destructive);
  --color-accent-foreground: var(--accent-foreground);
  --color-accent: var(--accent);
  --color-muted-foreground: var(--muted-foreground);
  --color-muted: var(--muted);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-secondary: var(--secondary);
  --color-primary-foreground: var(--primary-foreground);
  --color-primary: var(--primary);
  --color-popover-foreground: var(--popover-foreground);
  --color-popover: var(--popover);
  --color-card-foreground: var(--card-foreground);
  --color-card: var(--card);
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
}

:root {
  --radius: 0.625rem;
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0 0);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.97 0 0);
  --secondary-foreground: oklch(0.205 0 0);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.97 0 0);
  --accent-foreground: oklch(0.205 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);
  --chart-1: oklch(0.646 0.222 41.116);
  --chart-2: oklch(0.6 0.118 184.704);
  --chart-3: oklch(0.398 0.07 227.392);
  --chart-4: oklch(0.828 0.189 84.429);
  --chart-5: oklch(0.769 0.188 70.08);
  --sidebar: oklch(0.985 0 0);
  --sidebar-foreground: oklch(0.145 0 0);
  --sidebar-primary: oklch(0.205 0 0);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.97 0 0);
  --sidebar-accent-foreground: oklch(0.205 0 0);
  --sidebar-border: oklch(0.922 0 0);
  --sidebar-ring: oklch(0.708 0 0);
}

.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  --card: oklch(0.205 0 0);
  --card-foreground: oklch(0.985 0 0);
  --popover: oklch(0.205 0 0);
  --popover-foreground: oklch(0.985 0 0);
  --primary: oklch(0.922 0 0);
  --primary-foreground: oklch(0.205 0 0);
  --secondary: oklch(0.269 0 0);
  --secondary-foreground: oklch(0.985 0 0);
  --muted: oklch(0.269 0 0);
  --muted-foreground: oklch(0.708 0 0);
  --accent: oklch(0.269 0 0);
  --accent-foreground: oklch(0.985 0 0);
  --destructive: oklch(0.704 0.191 22.216);
  --border: oklch(1 0 0 / 10%);
  --input: oklch(1 0 0 / 15%);
  --ring: oklch(0.556 0 0);
  --chart-1: oklch(0.488 0.243 264.376);
  --chart-2: oklch(0.696 0.17 162.48);
  --chart-3: oklch(0.769 0.188 70.08);
  --chart-4: oklch(0.627 0.265 303.9);
  --chart-5: oklch(0.645 0.246 16.439);
  --sidebar: oklch(0.205 0 0);
  --sidebar-foreground: oklch(0.985 0 0);
  --sidebar-primary: oklch(0.488 0.243 264.376);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.269 0 0);
  --sidebar-accent-foreground: oklch(0.985 0 0);
  --sidebar-border: oklch(1 0 0 / 10%);
  --sidebar-ring: oklch(0.556 0 0);
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
    font-family: "Inter","Anuphan", sans-serif;
    @apply bg-background text-foreground;
  }
}

/* User message styling for dark mode */
.dark .user-message {
  background: linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 100%) !important;
  color: white !important;
}

.user-message {
  transition: background-color 0.2s ease;
}

/* Custom Scrollbar Styles */
* {
  scrollbar-width: thin;
  scrollbar-color: rgb(156 163 175) transparent;
}

*::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

*::-webkit-scrollbar-track {
  background: transparent;
}

*::-webkit-scrollbar-thumb {
  background-color: rgb(156 163 175);
  border-radius: 3px;
  transition: background-color 0.2s ease;
}

*::-webkit-scrollbar-thumb:hover {
  background-color: rgb(107 114 128);
}

*::-webkit-scrollbar-corner {
  background: transparent;
}

/* Dark mode scrollbar */
.dark * {
  scrollbar-color: rgb(75 85 99) rgb(31 41 55);
}

.dark *::-webkit-scrollbar-track {
  background: rgb(31 41 55);
}

.dark *::-webkit-scrollbar-thumb {
  background-color: rgb(75 85 99);
}

.dark *::-webkit-scrollbar-thumb:hover {
  background-color: rgb(107 114 128);
}

.dark *::-webkit-scrollbar-corner {
  background: rgb(31 41 55);
}
```

#### 7. แก้ไข code-block styles
แก้ไขไฟล์ `components/ui/code-block.tsx`
```tsx
"use client"

import { cn } from "@/lib/utils"
import React, { useEffect, useState } from "react"
import { codeToHtml } from "shiki"
import { Copy, Check, Download } from "lucide-react"
import { Button } from "./button"

export type CodeBlockProps = {
  children?: React.ReactNode
  className?: string
  title?: string
  language?: string
  filename?: string
} & React.HTMLProps<HTMLDivElement>

function CodeBlock({ 
  children, 
  className, 
  title, 
  language, 
  filename,
  ...props 
}: CodeBlockProps) {
  return (
    <div
      className={cn(
        "not-prose flex w-full flex-col overflow-clip my-6 rounded-lg",
        "bg-background",
        className
      )}
      {...props}
    >
      {(title || filename || language) && (
        <CodeBlockHeader 
          title={title || filename} 
          language={language}
        />
      )}
      {children}
    </div>
  )
}

type CodeBlockHeaderProps = {
  title?: string
  language?: string
}

function CodeBlockHeader({ title, language }: CodeBlockHeaderProps) {
  return (
    <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/50">
      <div className="flex items-center gap-2">
        {/* Traffic light dots */}
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <div className="w-3 h-3 rounded-full bg-yellow-500" />
          <div className="w-3 h-3 rounded-full bg-green-500" />
        </div>
        {title && (
          <span className="text-sm text-muted-foreground ml-2">{title}</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {language && (
          <span className="text-xs text-muted-foreground uppercase font-mono">
            {language}
          </span>
        )}
      </div>
    </div>
  )
}

export type CodeBlockCodeProps = {
  code: string
  language?: string
  theme?: string
  className?: string
  showLineNumbers?: boolean
  allowCopy?: boolean
  allowDownload?: boolean
  filename?: string
} & React.HTMLProps<HTMLDivElement>

function CodeBlockCode({
  code,
  language = "tsx",
  theme,
  className,
  showLineNumbers = false,
  allowCopy = true,
  allowDownload = false,
  filename,
  ...props
}: CodeBlockCodeProps) {
  const [highlightedHtml, setHighlightedHtml] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    async function highlight() {
      if (!code) {
        setHighlightedHtml("<pre><code></code></pre>")
        return
      }

      try {
        // List of commonly supported languages
        const supportedLanguages = [
          'javascript', 'typescript', 'jsx', 'tsx', 'python', 'java', 'c', 'cpp',
          'csharp', 'php', 'ruby', 'go', 'rust', 'swift', 'kotlin', 'scala',
          'html', 'css', 'scss', 'sass', 'less', 'xml', 'json', 'yaml', 'toml',
          'markdown', 'sql', 'bash', 'shell', 'powershell', 'dockerfile', 'nginx',
          'apache', 'lua', 'perl', 'r', 'julia', 'matlab', 'octave', 'fortran',
          'cobol', 'ada', 'pascal', 'delphi', 'vb', 'vbnet', 'fsharp', 'ocaml',
          'haskell', 'elm', 'clojure', 'erlang', 'elixir', 'dart', 'groovy',
          'makefile', 'cmake', 'gradle', 'ant', 'maven', 'sbt', 'bazel',
          'terraform', 'hcl', 'graphql', 'proto', 'thrift', 'avro'
        ]

        // Use the language if supported, otherwise fall back to 'text'
        const safeLanguage = supportedLanguages.includes(language.toLowerCase()) 
          ? language 
          : 'text'

        // Auto detect theme based on system preference if not provided
        const autoTheme = theme || (
          typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
            ? 'github-dark-dimmed'
            : 'github-light'
        )

        const html = await codeToHtml(code, { 
          lang: safeLanguage, 
          theme: autoTheme,
          transformers: [
            // Always remove background from pre tag
            {
              pre(node) {
                // Remove background style but keep other styles, remove padding override
                const existingStyle = (node.properties.style || '') as string
                node.properties.style = existingStyle.replace(/background[^;]*;?/gi, '').replace(/padding[^;]*;?/gi, '') + ' background: transparent !important;'
                if (showLineNumbers) {
                  node.properties.style += ' counter-reset: line;'
                }
              }
            },
            // Add line numbers if needed
            ...(showLineNumbers ? [{
              line(node: { children: unknown[] }) {
                node.children.unshift({
                  type: 'element',
                  tagName: 'span',
                  properties: {
                    className: ['line-number'],
                    style: 'counter-increment: line; display: inline-block; width: 1rem; margin-right: 1rem; color: #6b7280; text-align: right;'
                  },
                  children: []
                })
              }
            }] : [])
          ]
        })
        setHighlightedHtml(html)
      } catch (error) {
        console.warn(`Language '${language}' not supported, falling back to plain text:`, error)
        // Fallback to plain text if language is not supported
        const fallbackHtml = `<pre style="background: transparent; color: inherit; padding: 2.5rem; margin: 0; border-radius: 0.5rem; overflow-x: auto; font-family: ui-monospace, SFMono-Regular, monospace;"><code>${code.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>`
        setHighlightedHtml(fallbackHtml)
      }
    }
    highlight()
  }, [code, language, theme, showLineNumbers])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const handleDownload = () => {
    const blob = new Blob([code], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename || `code.${language}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const classNames = cn(
    "relative w-full overflow-x-auto text-sm leading-relaxed",
    "bg-muted/30 text-foreground rounded-lg",
    "dark:bg-slate-900/80 dark:text-slate-100",
    "[&>pre]:px-6 [&>pre]:py-6 [&>pre]:bg-transparent [&>pre]:m-0",
    "[&>pre>code]:bg-transparent [&>pre>code]:p-0 [&>pre>code]:font-mono",
    showLineNumbers && "[&>pre>code]:grid [&>pre>code]:gap-0",
    className
  )

  // SSR fallback: render plain code if not hydrated yet
  return (
    <div className="relative code-block-container group/code">
      {/* Language label */}
      {language && (
        <div className="mb-2">
          <span className="text-xs text-muted-foreground font-mono uppercase bg-muted/50 px-2 py-1 rounded">
            {language}
          </span>
        </div>
      )}

      {/* Action buttons */}
      {(allowCopy || allowDownload) && (
        <div className="absolute top-2 right-2 opacity-0 group-hover/code:opacity-100 transition-opacity duration-200 z-10">
          <div className="flex items-center gap-1">
            {allowCopy && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className="h-8 w-8 p-0 bg-background/80 hover:bg-muted/80 text-muted-foreground hover:text-foreground border border-border/50"
              >
                {copied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            )}
            {allowDownload && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDownload}
                className="h-8 w-8 p-0 bg-background/80 hover:bg-muted/80 text-muted-foreground hover:text-foreground border border-border/50"
              >
                <Download className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      )}

      {highlightedHtml ? (
        <div
          className={classNames}
          dangerouslySetInnerHTML={{ __html: highlightedHtml }}
          {...props}
        />
      ) : (
        <div className={classNames} {...props}>
          <pre className="px-6 py-6 font-mono">
            <code>{code}</code>
          </pre>
        </div>
      )}
    </div>
  )
}

export type CodeBlockGroupProps = React.HTMLAttributes<HTMLDivElement>

function CodeBlockGroup({
  children,
  className,
  ...props
}: CodeBlockGroupProps) {
  return (
    <div
      className={cn("flex items-center justify-between gap-2", className)}
      {...props}
    >
      {children}
    </div>
  )
}

// Convenience wrapper for common use case
export type SimpleCodeBlockProps = {
  code: string
  language?: string
  title?: string
  filename?: string
  showLineNumbers?: boolean
  allowCopy?: boolean
  allowDownload?: boolean
  className?: string
}

function SimpleCodeBlock({
  code,
  language = "tsx",
  title,
  filename,
  showLineNumbers = false,
  allowCopy = true,
  allowDownload = false,
  className
}: SimpleCodeBlockProps) {
  return (
    <CodeBlock 
      className={className} 
      title={title} 
      filename={filename} 
      language={language}
    >
      <CodeBlockCode
        code={code}
        language={language}
        showLineNumbers={showLineNumbers}
        allowCopy={allowCopy}
        allowDownload={allowDownload}
        filename={filename}
      />
    </CodeBlock>
  )
}

export { CodeBlockGroup, CodeBlockCode, CodeBlock, SimpleCodeBlock }
```

#### 8. แก้ไข component "logout-button.tsx"
แก้ไขไฟล์ `components/logout-button.tsx`
```tsx
/**
 * ============================================================================
 * LOGOUT BUTTON COMPONENT - ปุ่ม Logout สำหรับออกจากระบบ
 * ============================================================================
 * 
 * Component นี้ใช้สำหรับ:
 * - แสดงปุ่ม logout พร้อม icon และ styling
 * - จัดการกระบวนการ logout ผ่าน Supabase
 * - เคลียร์ localStorage และ navigate ไปหน้า login
 * 
 * Features:
 * - Logout ผ่าน Supabase auth
 * - เคลียร์ session data จาก localStorage
 * - Redirect ไปหน้า login หลัง logout
 * - Responsive design และ hover effects
 */

"use client"

import { createClient } from "@/lib/client"       // Supabase client
import { Button } from "@/components/ui/button"   // UI Button component
import { useRouter } from "next/navigation"       // Next.js router hook
import { LogOut } from "lucide-react"             // Logout icon

/**
 * LogoutButton Component - ปุ่มสำหรับออกจากระบบ
 * 
 * รับผิดชอบ:
 * - แสดงปุ่ม logout พร้อม icon และ text
 * - จัดการกระบวนการ logout เมื่อถูกคลิก
 * - เคลียร์ข้อมูล session และ navigate ไปหน้า login
 */
export function LogoutButton() {
  const router = useRouter()                      // Next.js router สำหรับ navigation

  /**
   * ฟังก์ชันจัดการการ logout
   * 
   * ขั้นตอนการทำงาน:
   * 1. สร้าง Supabase client
   * 2. เคลียร์ currentSessionId จาก localStorage
   * 3. เรียก signOut จาก Supabase auth
   * 4. Navigate ไปหน้า login
   */
  const logout = async () => {
    const supabase = createClient()               // สร้าง Supabase client

    // เคลียร์ currentSessionId จาก localStorage เพื่อลบข้อมูล session ปัจจุบัน
    localStorage.removeItem('currentSessionId')

    // ออกจากระบบผ่าน Supabase authentication
    await supabase.auth.signOut()
    
    // นำทางไปยังหน้า login หลังจาก logout สำเร็จ
    router.push("/auth/login")
  }

  // Render ปุ่ม logout พร้อม styling และ event handler
  return (
    <Button
      onClick={logout}                            // เรียกฟังก์ชัน logout เมื่อคลิก
      variant="ghost"                             // ใช้ ghost variant (โปร่งใส)
      className="w-full justify-start gap-3 h-12 text-left hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
      // Styling: เต็มความกว้าง, จัดซ้าย, ช่องว่างระหว่าง icon กับ text, 
      // สูง 12, hover effects สีแดงสำหรับ light/dark mode
    >
      <LogOut className="h-4 w-4" />             {/* Logout icon ขนาด 4x4 */}
      Log out                                    {/* ข้อความปุ่ม */}
    </Button>
  )
}
```

<br />
*** Note: แยก branch ใหม่สำหรับเพิ่ม Chat History

#### สร้าง Branch ใหม่
```bash
git add .
git commit -m "Finish dark mode feature"
git checkout -b 06-chat-history
```
#### 1. Database Schema (PostgreSQL/Supabase)
```sql
-- ตารางสำหรับเก็บข้อมูลของแต่ละห้องแชท (สำหรับ Sidebar)
CREATE TABLE public.chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), -- ID ของห้องแชท
    user_id UUID REFERENCES auth.users(id), -- ID ผู้ใช้ (ถ้ามีระบบ Login)
    title TEXT NOT NULL DEFAULT 'New Chat', -- ชื่อห้องแชท
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ตารางสำหรับเก็บข้อความ (ตาม Format ของ LangChain)
-- ชื่อตารางสามารถเปลี่ยนได้ แต่ต้องตรงกับในโค้ด
CREATE TABLE public.chat_messages (
    id SERIAL PRIMARY KEY,
    session_id TEXT NOT NULL, -- session_id นี้จะใช้ UUID จาก Frontend
    message JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- สร้าง Index เพื่อเพิ่มความเร็วในการดึงข้อมูล
CREATE INDEX ON public.chat_messages (session_id);
CREATE INDEX ON public.chat_sessions (user_id, created_at DESC);


-- (แนะนำ) เปิดใช้งาน Row Level Security เพื่อความปลอดภัย
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- สร้าง Policy ให้เจ้าของข้อมูลเท่านั้นที่เข้าถึงได้ (ต้องมีระบบ auth.users)
CREATE POLICY "Allow own access" ON public.chat_sessions
    FOR ALL USING (auth.uid() = user_id);

-- สำหรับ chat_messages จะซับซ้อนขึ้นเล็กน้อย อาจจะต้องเช็ค session_id ว่าเป็นของผู้ใช้หรือไม่
-- หรือสร้าง function ขึ้นมาช่วยในการตรวจสอบ
-- ตัวอย่างเบื้องต้น:
CREATE POLICY "Allow access based on session" ON public.chat_messages
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM chat_sessions
            WHERE chat_sessions.id::text = chat_messages.session_id
            AND chat_sessions.user_id = auth.uid()
        )
    );
```

#### 2. กำหนด Postgres Connection String ที่ไฟล์ .env
```env
# ===  postgres config =====
# การใช้กับ RAG + LangChain + pgvector แนะนำเป็นแบบ Transaction pooler (Shared Pooler)
PG_HOST=your-postgres-host-here
PG_PORT=6543
PG_USER=your-postgres-username-here
PG_PASSWORD=your-postgres-password-here
PG_DATABASE=postgres
```

#### 3. ติดตั้ง dependencies
```bash
npm install pg @langchain/community
npm install -D @types/pg
```

#### 4. สร้าง API Routes
สร้างไฟล์ `app/api/chat_05_history/route.ts`
```ts
/**
 * ===============================================
 * Chat API Route Handler - API สำหรับการสนทนาพร้อมประวัติ
 * ===============================================
 * 
 * คำอธิบาย:
 * API Route Handler สำหรับจัดการการสนทนาแบบ streaming และเก็บประวัติ
 * รองรับการสร้าง chat sessions และจัดเก็บข้อความใน PostgreSQL
 * 
 * ฟีเจอร์หลัก:
 * - รับส่งข้อความแบบ real-time streaming
 * - เก็บประวัติการสนทนาใน database
 * - จัดการ chat sessions อัตโนมัติ
 * - ดึงประวัติการสนทนาจาก session ID
 * - รองรับ authentication และ authorization
 * 
 * HTTP Methods:
 * - POST: ส่งข้อความและรับคำตอบแบบ streaming
 * - GET: ดึงประวัติข้อความของ session
*/
import { NextRequest } from "next/server"
import { ChatOpenAI } from "@langchain/openai"
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts"
import { toUIMessageStream } from "@ai-sdk/langchain"
import { createUIMessageStreamResponse, UIMessage } from "ai"
import { RunnableWithMessageHistory } from '@langchain/core/runnables'
import { PostgresChatMessageHistory } from "@langchain/community/stores/message/postgres"
import { Pool } from 'pg'

// ===============================================
// Route Configuration - การตั้งค่า Route
// ===============================================

/**
 * Runtime Configuration
 * กำหนดให้ API นี้ทำงานแบบ Node.js Runtime เพื่อรองรับ PostgreSQL
 * หมายเหตุ: ปิดการใช้ Edge Runtime เพราะ pg library ต้องการ Node.js APIs
 */
// export const runtime = "edge" // ปิดการใช้งาน

/**
 * Dynamic Configuration
 * export const dynamic = 'force-dynamic' เป็น Next.js Route Segment Config ที่ใช้เพื่อ
 * 1. บังคับให้ Route Handler ทำงานแบบ Dynamic - ไม่ให้ Next.js cache response
 * 2. ป้องกัน Static Generation - บังคับให้ render ใหม่ทุกครั้งที่มี request
 * 3. จำเป็นสำหรับ Streaming API - เพื่อให้ response streaming ทำงานได้ถูกต้อง
 */
export const dynamic = 'force-dynamic' // เปิดใช้งาน

/**
 * Maximum Duration Configuration
 * กำหนดเวลาสูงสุดที่ API จะทำงานได้ (30 วินาที)
 * ถ้าใช้เวลานานกว่านี้ จะถูกยกเลิกเพื่อป้องกัน timeout
 */
export const maxDuration = 30 // วินาที

// ===============================================
// Database Connection Setup - การตั้งค่าฐานข้อมูล
// ===============================================

/**
 * PostgreSQL Connection Pool
 * สร้าง connection pool สำหรับจัดการการเชื่อมต่อ database อย่างมีประสิทธิภาพ
 * 
 * Configuration:
 * - host: ที่อยู่ของ database server
 * - port: พอร์ตของ database
 * - user/password: ข้อมูลการเข้าถึง
 * - database: ชื่อฐานข้อมูล
 * - ssl: การตั้งค่า SSL สำหรับ production
*/
const pool = new Pool({
  host: process.env.PG_HOST,                                        // ที่อยู่ database server
  port: Number(process.env.PG_PORT),                               // พอร์ต database (แปลงเป็น number)
  user: process.env.PG_USER,                                       // username สำหรับเข้าถึง database
  password: process.env.PG_PASSWORD,                               // password สำหรับเข้าถึง database
  database: process.env.PG_DATABASE,                               // ชื่อ database ที่ต้องการเชื่อมต่อ
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,  // SSL config สำหรับ production
})

// ===============================================
// POST Handler - จัดการการส่งข้อความและตอบกลับ
// ===============================================

/**
 * POST Request Handler
 * 
 * ฟังก์ชันสำหรับรับข้อความจากผู้ใช้และส่งคำตอบกลับแบบ streaming
 * พร้อมเก็บประวัติการสนทนาใน database
 * 
 * Flow การทำงาน:
 * 1. ดึงข้อมูลจาก request body
 * 2. จัดการ session (สร้างใหม่หรือใช้ที่มีอยู่)
 * 3. ตั้งค่า AI model และ prompt
 * 4. สร้าง message history
 * 5. ประมวลผลและส่ง streaming response
 * 
 * @param req - NextRequest object
 * @returns Response แบบ streaming หรือ error response
 */
export async function POST(req: NextRequest) {
  try {

    // ===============================================
    // Step 1: Request Data Processing - ประมวลผลข้อมูล Request
    // ===============================================
    /**
     * ดึงข้อมูลจาก request body ที่ส่งมาจาก useChat hook
     * 
     * ข้อมูลที่ได้รับ:
     * - messages: รายการข้อความในการสนทนา
     * - sessionId: ID ของ session (optional)
     * - userId: ID ของผู้ใช้สำหรับ authentication
     */
    const { messages, sessionId, userId }: { 
      messages: UIMessage[];                    // รายการข้อความทั้งหมดในการสนทนา
      sessionId?: string;                       // ID ของ session ปัจจุบัน (optional)
      userId?: string;                          // ID ของผู้ใช้ที่ส่งข้อความ
    } = await req.json()

    // ===============================================
    // Step 2: Session Management - จัดการ Session
    // ===============================================
    /**
     * ตัวแปรเก็บ session ID ปัจจุบัน
     * จะใช้ sessionId ที่มีอยู่หรือสร้างใหม่ถ้ายังไม่มี
     */
    let currentSessionId = sessionId

    /**
     * ตรวจสอบและสร้าง session ใหม่ถ้าจำเป็น
     */
    if (!currentSessionId) {
      // Step 2.1: เชื่อมต่อ database
      const client = await pool.connect()
      try {
        // Step 2.2: สร้าง title จากข้อความแรกของผู้ใช้
        const firstMessage = messages.find(m => m.role === 'user');
        let title = 'New Chat';                // title เริ่มต้น

        /**
         * ดึง title จากข้อความแรกของผู้ใช้
         * จำกัดความยาวไม่เกิน 50 ตัวอักษร
         */
        if (firstMessage && Array.isArray(firstMessage.parts) && firstMessage.parts.length > 0) {
          const textPart = firstMessage.parts.find(part => part.type === 'text');
          if (textPart && typeof textPart.text === 'string') {
            title = textPart.text.slice(0, 50) + (textPart.text.length > 50 ? '...' : '') // ตัดข้อความให้ไม่เกิน 50 ตัวอักษร
          }
        }

        // Step 2.3: ตรวจสอบ userId
        if (!userId) {
          throw new Error("User ID is required")
        }
        
        // Step 2.4: บันทึก session ใหม่ลง database
        const result = await client.query(`
          INSERT INTO chat_sessions (title, user_id)
          VALUES ($1, $2)
          RETURNING id
        `, [title, userId])
        
        // Step 2.5: เก็บ session ID ที่ได้จาก database
        currentSessionId = result.rows[0].id

      } finally {
        // Step 2.6: ปิดการเชื่อมต่อ database
        client.release()
      }
    }

    // ===============================================
    // Step 3: Session Validation - ตรวจสอบความถูกต้องของ Session
    // ===============================================
    /**
     * ตรวจสอบว่า currentSessionId มีค่าแน่นอน
     * ถ้าไม่มีให้ throw error
    */
    if (!currentSessionId) {
      throw new Error("Failed to get or create session ID")
    }

    // ===============================================
    // Step 4: AI Model Setup - ตั้งค่า AI Model และ Prompt
    // ===============================================
    /**
     * สร้าง Prompt Template เพื่อกำหนดบทบาทและรูปแบบการตอบของ AI
     * 
     * Structure:
     * 1. System message: กำหนดบทบาทและภาษาที่ใช้ตอบ
     * 2. Chat history: ประวัติการสนทนาที่ผ่านมา
     * 3. Human input: ข้อความใหม่จากผู้ใช้
     */
    const prompt = ChatPromptTemplate.fromMessages([
      ["system", "You are a helpful and friendly AI assistant. Answer in Thai language when user asks in Thai."],
      new MessagesPlaceholder("chat_history"),                      // placeholder สำหรับประวัติการสนทนา
      ["human", "{input}"],                                         // placeholder สำหรับ input ของผู้ใช้
    ])

    /**
     * สร้างและตั้งค่า OpenAI model
     * 
     * Configuration:
     * - model: รุ่นของ AI model ที่ใช้
     * - temperature: ความสร้างสรรค์ของคำตอบ (0-1)
     * - maxTokens: จำนวน token สูงสุดในการตอบ
     * - streaming: เปิดใช้ streaming response
     */
    const model = new ChatOpenAI({
      model: "gpt-4o-mini",                                         // ระบุรุ่น AI model ที่ใช้
      temperature: 0.7,                                             // ความสร้างสรรค์
      maxTokens: 1000,                                              // จำนวน token สูงสุดสำหรับคำตอบ
      streaming: true,                                              // เปิดใช้ streaming response
    })

    /**
     * สร้าง Chain โดยการเชื่อมต่อ Prompt กับ Model เข้าด้วยกัน
     * Chain คือ pipeline ที่ประมวลผล input ผ่าน prompt แล้วส่งไป model
     */
    const chain = prompt.pipe(model)

    // ===============================================
    // Step 5: Message History Setup - ตั้งค่าประวัติข้อความ
    // ===============================================
    /**
     * สร้าง Message History สำหรับ session นี้
     * ใช้ PostgresChatMessageHistory เพื่อเก็บและดึงประวัติจาก database
     * 
     * Configuration:
     * - sessionId: ID ของ session ปัจจุบัน
     * - tableName: ชื่อตารางที่เก็บข้อความ
     * - pool: connection pool สำหรับ database
    */
    const messageHistory = new PostgresChatMessageHistory({
      sessionId: currentSessionId,                                  // ID ของ session ปัจจุบัน
      tableName: "chat_messages",                                   // ชื่อตารางในฐานข้อมูล
      pool: new Pool({                                              // สร้าง pool ใหม่สำหรับ message history
        host: process.env.PG_HOST,
        port: Number(process.env.PG_PORT),
        user: process.env.PG_USER,
        password: process.env.PG_PASSWORD,
        database: process.env.PG_DATABASE,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      }),
    })

    /**
     * สร้าง Chain with Message History
     * เชื่อมต่อ chain กับ message history เพื่อให้ AI จำบริบทการสนทนาได้
     * 
     * Configuration:
     * - runnable: chain ที่จะประมวลผล
     * - getMessageHistory: ฟังก์ชันดึงประวัติข้อความ
     * - inputMessagesKey: key สำหรับ input message
     * - historyMessagesKey: key สำหรับประวัติข้อความ
     */
    const chainWithHistory = new RunnableWithMessageHistory({
      runnable: chain,                                             // chain ที่จะใช้ประมวลผล
      getMessageHistory: () => messageHistory,                     // ฟังก์ชันดึงประวัติข้อความ
      inputMessagesKey: "input",                                   // key สำหรับข้อความ input
      historyMessagesKey: "chat_history",                          // key สำหรับประวัติการสนทนา
    })

    // ===============================================
    // Step 6: Extract User Input - ดึงข้อความจากผู้ใช้
    // ===============================================
    /**
     * ดึง input จากข้อความล่าสุดของผู้ใช้
     * 
     * Process:
     * 1. หาข้อความล่าสุดที่มี role เป็น 'user'
     * 2. ตรวจสอบและดึงข้อความจาก parts array
     * 3. ตรวจสอบความถูกต้องก่อนส่งต่อ
     */
    const lastUserMessage = messages.filter(m => m.role === 'user').pop();  // หาข้อความล่าสุดของ user
    let input = ""

    /**
     * ตรวจสอบและดึงข้อความจาก message parts
     * - ตรวจสอบว่ามี parts array ที่ไม่ว่าง
     * - หา part ที่เป็นประเภท 'text'
     * - ดึงข้อความออกมา
     */
    if (lastUserMessage && Array.isArray(lastUserMessage.parts) && lastUserMessage.parts.length > 0) {
      // หา part แรกที่เป็นประเภท text
      const textPart = lastUserMessage.parts.find(part => part.type === 'text');
      if (textPart) {
        input = textPart.text;                                              // ดึงข้อความออกมา
      }
    }

    /**
     * ตรวจสอบความถูกต้องของ input
     * หาก input เป็นค่าว่าง ให้ส่ง error response กลับ
     */
    if (!input) {
      console.warn("Could not extract user input from the message parts."); // แสดงคำเตือนใน console
      return new Response("No valid user input found.", { status: 400 });   // ส่ง error response กลับ
    }

    // ===============================================
    // Step 7: Stream Response Generation - สร้างการตอบกลับแบบ Streaming
    // ===============================================
    /**
     * เรียกใช้ Chain เพื่อประมวลผลและสร้างคำตอบแบบ streaming
     * 
     * Process Flow:
     * 1. ส่ง input และ session config ไป chain
     * 2. Chain จะดึงประวัติการสนทนาจาก database
     * 3. รวม input กับประวัติเป็น prompt
     * 4. ส่ง prompt ไป OpenAI model
     * 5. รับ streaming response กลับมา
     * 
     * Parameters:
     * - input: ข้อความจากผู้ใช้
     * - configurable: การตั้งค่า session
     */
    const stream = await chainWithHistory.stream(
      {
        input: input,                                                       // ข้อความจากผู้ใช้
      },
      {
        configurable: {
          sessionId: currentSessionId,                                      // ID ของ session สำหรับดึงประวัติ
        },
      }
    )

    // ===============================================
    // Step 8: Return UI Message Stream Response - ส่งผลลัพธ์กลับในรูปแบบ UI Stream
    // ===============================================
    /**
     * สร้าง UI Message Stream Response สำหรับส่งกลับไปยัง Frontend
     * 
     * Features:
     * - แปลง stream เป็นรูปแบบที่ UI เข้าใจได้
     * - ส่ง session ID ผ่าน header
     * - รองรับ streaming response
     */
    const response = createUIMessageStreamResponse({
      stream: toUIMessageStream(stream),                                    // แปลง stream เป็น UI format
      headers: currentSessionId ? {
        'x-session-id': currentSessionId,                                   // ส่ง session ID ผ่าน header
      } : undefined,
    })

    return response                                                         // ส่ง response กลับไปยัง client

  } catch (error) {
    // ===============================================
    // Error Handling - จัดการข้อผิดพลาด
    // ===============================================
    
    /**
     * จัดการข้อผิดพลาดที่เกิดขึ้นระหว่างการประมวลผล
     * 
     * Process:
     * 1. แสดง error ใน console เพื่อ debugging
     * 2. ส่ง error response กลับไปยัง client
     * 3. รวมรายละเอียด error เพื่อช่วยในการแก้ไข
     */
    console.error("API Error:", error)

    /**
     * ส่ง error response กลับไปยัง client
     * 
     * Response Structure:
     * - error: ข้อความ error หลัก
     * - details: รายละเอียด error เพิ่มเติม
     * - status: HTTP status code 500 (Internal Server Error)
     * - headers: กำหนด content type เป็น JSON
     */
    return new Response(
      JSON.stringify({
        error: "An error occurred while processing your request",          // ข้อความ error หลัก
        details: error instanceof Error ? error.message : 'Unknown error'  // รายละเอียด error
      }),
      {
        status: 500,                                                        // HTTP status 500 = Internal Server Error
        headers: { "Content-Type": "application/json" },                   // กำหนด content type เป็น JSON
      }
    )
  }
}

// ===============================================
// GET Method: ดึงประวัติข้อความของ Session
// ===============================================
/**
 * GET Handler: ดึงประวัติข้อความของ session ที่ระบุ
 * 
 * Purpose:
 * - ดึงข้อความทั้งหมดของ session จาก database
 * - แปลงข้อมูลให้อยู่ในรูปแบบที่ Frontend เข้าใจ
 * - ส่งผลลัพธ์กลับในรูปแบบ JSON
 * 
 * @param req NextRequest object ที่มี query parameters
 * @returns Response object พร้อมข้อมูลข้อความ
 */
export async function GET(req: NextRequest) {
  try {
    // ===============================================
    // Step 1: Extract and Validate Parameters - ดึงและตรวจสอบ Parameters
    // ===============================================
    
    /**
     * ดึง sessionId จาก URL query parameters
     * 
     * Expected URL format: /api/chat_05_history?sessionId=xxx
     */
    const { searchParams } = new URL(req.url)                               // ดึง query parameters จาก URL
    const sessionId = searchParams.get('sessionId')                         // ดึง sessionId parameter

    /**
     * ตรวจสอบว่ามี sessionId หรือไม่
     * หากไม่มี ให้ส่ง error response กลับ
     */
    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: "Session ID is required" }),               // ข้อความ error
        { status: 400, headers: { "Content-Type": "application/json" } }   // HTTP 400 = Bad Request
      )
    }

    // ===============================================
    // Step 2: Database Connection - เชื่อมต่อฐานข้อมูล
    // ===============================================
    
    /**
     * เชื่อมต่อกับ PostgreSQL database
     * ใช้ connection pool เพื่อจัดการ connection อย่างมีประสิทธิภาพ
     */
    const client = await pool.connect()                                     // เชื่อมต่อ database
    
    try {
      // ===============================================
      // Step 3: Query Messages - ดึงข้อความจากฐานข้อมูล
      // ===============================================
      
      /**
       * ดึงข้อความทั้งหมดของ session นี้จากตาราง chat_messages
       * 
       * Query Details:
       * - ดึงฟิลด์ message (JSON), message type, และ created_at
       * - กรองด้วย session_id
       * - เรียงลำดับตาม created_at (เก่าไปใหม่)
       */
      const result = await client.query(`
        SELECT message, message->>'type' as message_type, created_at
        FROM chat_messages 
        WHERE session_id = $1 
        ORDER BY created_at ASC
      `, [sessionId])

      // ===============================================
      // Step 4: Transform Data - แปลงข้อมูลให้เหมาะกับ Frontend
      // ===============================================
      
      /**
       * แปลงข้อมูลจาก database ให้อยู่ในรูปแบบที่ Frontend ต้องการ
       * 
       * Transformation Process:
       * 1. วนลูปผ่านทุก row ที่ได้จาก query
       * 2. กำหนด role ตาม message type
       * 3. ดึง content จาก JSON message field
       * 4. สร้าง object ในรูปแบบที่ UI เข้าใจ
       */
      const messages = result.rows.map((row, index) => {
        const messageData = row.message                                     // ข้อมูล message ในรูปแบบ JSON
        
        /**
         * กำหนด role ตาม type ที่ดึงจาก JSON field
         * - 'ai' → 'assistant' (ข้อความจาก AI)
         * - 'human' → 'user' (ข้อความจากผู้ใช้)
         * - default → 'user' (ค่าเริ่มต้น)
         */
        let role = 'user'                                                   // ค่าเริ่มต้น
        if (row.message_type === 'ai') {
          role = 'assistant'                                                // ข้อความจาก AI
        } else if (row.message_type === 'human') {
          role = 'user'                                                     // ข้อความจากผู้ใช้
        }
        
        /**
         * สร้าง message object ในรูปแบบที่ Frontend ต้องการ
         * 
         * Object Structure:
         * - id: unique identifier สำหรับ message
         * - role: บทบาทของผู้ส่ง (user/assistant)
         * - content: เนื้อหาข้อความ
         * - createdAt: เวลาที่สร้างข้อความ
         */
        return {
          id: `history-${index}`,                                                        // unique ID สำหรับ message
          role: role,                                                                    // บทบาทของผู้ส่ง
          content: messageData.content || messageData.text || messageData.message || '', // เนื้อหาข้อความ
          createdAt: row.created_at                                                      // เวลาที่สร้าง
        }
      })

      // ===============================================
      // Step 5: Return Success Response - ส่งผลลัพธ์กลับ
      // ===============================================
      
      /**
       * ส่ง success response กลับไปยัง client
       * 
       * Response Structure:
       * - messages: array ของข้อความที่แปลงแล้ว
       * - status: 200 (OK)
       * - headers: กำหนด content type เป็น JSON
       */
      return new Response(
        JSON.stringify({ messages }),                                       // ข้อมูลข้อความในรูปแบบ JSON
        { 
          status: 200,                                                      // HTTP 200 = OK
          headers: { "Content-Type": "application/json" }                  // กำหนด content type
        }
      )
    } finally {
      // ===============================================
      // Step 6: Cleanup - ปิดการเชื่อมต่อฐานข้อมูล
      // ===============================================
      
      /**
       * ปิดการเชื่อมต่อ database
       * ใช้ finally block เพื่อให้แน่ใจว่าจะปิดการเชื่อมต่อเสมอ
       * ไม่ว่าจะเกิด error หรือไม่
       */
      client.release()                                                      // คืน connection กลับไปยัง pool
    }
  } catch (error) {
    // ===============================================
    // Error Handling - จัดการข้อผิดพลาด
    // ===============================================
    
    /**
     * จัดการข้อผิดพลาดที่เกิดขึ้นระหว่างการดึงข้อความ
     * 
     * Process:
     * 1. แสดง error ใน console
     * 2. ส่ง error response กลับไปยัง client
     */
    console.error("Error fetching messages:", error)                        // แสดง error ใน console
    
    return new Response(
      JSON.stringify({
        error: "Failed to fetch messages",                                  // ข้อความ error หลัก
        details: error instanceof Error ? error.message : 'Unknown error'  // รายละเอียด error
      }),
      {
        status: 500,                                                        // HTTP 500 = Internal Server Error
        headers: { "Content-Type": "application/json" }                    // กำหนด content type
      }
    )
  }
}

```

#### 5. สร้าง custom-chat-transport.ts
สร้างไฟล์ `lib/custom-chat-transport.ts`

```ts
import { DefaultChatTransport } from 'ai'

type CustomChatTransportOptions = {
  api?: string
  headers?: Record<string, string> | Headers
  credentials?: RequestCredentials
  fetch?: typeof fetch
  // เพิ่ม callback ของเราเอง
  onResponse: (response: Response) => void
}

export const createCustomChatTransport = ({
  onResponse,
  ...options
}: CustomChatTransportOptions) => {
  const originalFetch = options.fetch ?? fetch;

  const customFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const response = await originalFetch(input, init);
    
    // เรียก callback ของเราพร้อมกับ response ที่ได้
    onResponse(response.clone()) // ใช้ .clone() เพื่อให้ stream ยังอ่านต่อได้

    return response;
  };

  return new DefaultChatTransport({
    ...options,
    fetch: customFetch,
  })
}
```
#### 6. แก้ไข component "message.tsx"
แก้ไขไฟล์ `components/ui/message.tsx`
```tsx
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { Markdown } from "./markdown"

export type MessageProps = {
  children: React.ReactNode
  className?: string
  isAssistant?: boolean
  bubbleStyle?: boolean
} & React.HTMLProps<HTMLDivElement>

const Message = ({ children, className, isAssistant = false, bubbleStyle = false, ...props }: MessageProps) => {
  if (bubbleStyle) {
    if (isAssistant) {
      // AI messages: เต็มความกว้าง, ไม่ต้องใช้ flex-col
      return (
        <div 
          className={cn(
            "group w-full",
            className
          )} 
          {...props}
        >
          {children}
        </div>
      )
    } else {
      // User messages: แบบ bubble ด้านขวา
      return (
        <div 
          className={cn(
            "group flex flex-col items-end",
            className
          )} 
          {...props}
        >
          {children}
        </div>
      )
    }
  }
  
  return (
    <div className={cn("flex gap-3", className)} {...props}>
      {children}
    </div>
  )
}

export type MessageAvatarProps = {
  src: string
  alt: string
  fallback?: string
  delayMs?: number
  className?: string
}

const MessageAvatar = ({
  src,
  alt,
  fallback,
  delayMs,
  className,
}: MessageAvatarProps) => {
  return (
    <Avatar className={cn("h-8 w-8 shrink-0", className)}>
      <AvatarImage src={src} alt={alt} />
      {fallback && (
        <AvatarFallback delayMs={delayMs}>{fallback}</AvatarFallback>
      )}
    </Avatar>
  )
}

export type MessageContentProps = {
  children: React.ReactNode
  markdown?: boolean
  className?: string
  isAssistant?: boolean
  bubbleStyle?: boolean
} & React.ComponentProps<typeof Markdown> &
  React.HTMLProps<HTMLDivElement>

const MessageContent = ({
  children,
  markdown = false,
  className,
  isAssistant = false,
  bubbleStyle = false,
  ...props
}: MessageContentProps) => {
  let classNames
  
  if (bubbleStyle) {
    if (isAssistant) {
      // AI messages: เต็มความกว้าง
      classNames = cn(
        "w-full px-4 py-3 mb-1 dark:bg-transparent text-gray-800 dark:text-gray-100",
        "[&_ul]:space-y-0 [&_ol]:space-y-0 [&_li]:my-0 [&_li]:py-0.5",
        "prose prose-li:my-0 prose-ul:my-2 prose-ol:my-2 prose-p:my-2",
        "dark:prose-invert dark:prose-headings:text-gray-100 dark:prose-p:text-gray-100 dark:prose-li:text-gray-100",
        className
      )
    } else {
      // User messages: แบบ bubble
      classNames = cn(
        "user-message bg-[#e5f3ff] text-primary max-w-[75%] rounded-3xl px-5 py-2.5 break-words whitespace-pre-wrap",
        className
      )
    }
  } else {
    classNames = cn(
      "rounded-lg p-2 text-foreground bg-secondary prose break-words whitespace-normal",
      className
    )
  }

  return markdown ? (
    <Markdown className={classNames} {...props}>
      {children as string}
    </Markdown>
  ) : (
    <div className={classNames} {...props}>
      {children}
    </div>
  )
}

export type MessageActionsProps = {
  children: React.ReactNode
  className?: string
  isAssistant?: boolean
  bubbleStyle?: boolean
} & React.HTMLProps<HTMLDivElement>

const MessageActions = ({
  children,
  className,
  isAssistant = false,
  bubbleStyle = false,
  ...props
}: MessageActionsProps) => {
  let classNames
  
  if (bubbleStyle) {
    if (isAssistant) {
      // AI messages: ชิดซ้าย
      classNames = cn(
        "flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity mb-2 justify-start ml-2",
        className
      )
    } else {
      // User messages: ชิดขวา
      classNames = cn(
        "flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity mb-2 justify-end mr-2",
        className
      )
    }
  } else {
    classNames = cn("text-muted-foreground flex items-center gap-2", className)
  }
  
  return (
    <div className={classNames} {...props}>
      {children}
    </div>
  )
}

export type MessageActionProps = {
  className?: string
  tooltip: React.ReactNode
  children: React.ReactNode
  side?: "top" | "bottom" | "left" | "right"
  bubbleStyle?: boolean
} & React.ComponentProps<typeof Tooltip>

const MessageAction = ({
  tooltip,
  children,
  className,
  side = "top",
  bubbleStyle = false,
  ...props
}: MessageActionProps) => {
  const buttonClassName = bubbleStyle 
    ? "h-7 w-7 p-0 text-gray-500 hover:text-gray-700 rounded-full"
    : ""

  return (
    <TooltipProvider>
      <Tooltip {...props}>
        <TooltipTrigger asChild>
          <div className={cn(buttonClassName, className)}>
            {children}
          </div>
        </TooltipTrigger>
        <TooltipContent side={side}>
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export { Message, MessageAvatar, MessageContent, MessageActions, MessageAction }
```

#### 7. แก้ไข component "new-chat.tsx"
แก้ไขไฟล์ `components/new-chat.tsx`
```tsx
/**
 * ===============================================
 * New Chat Component - หน้าสำหรับสนทนาใหม่
 * ===============================================
 * 
 * Purpose: หน้าหลักสำหรับเริ่มการสนทนาใหม่และจัดการประวัติการสนทนา
 * 
 * Features:
 * - แสดงหน้า Welcome สำหรับการสนทนาใหม่
 * - โหลดประวัติการสนทนาจาก session ID
 * - ส่งข้อความไปยัง AI และรับการตอบกลับ
 * - จัดการ authentication และ session
 * - รองรับการสร้าง chat session ใหม่
 * - แสดงสถานะการโหลดและการพิมพ์
 * 
 * Authentication: ใช้ Supabase Authentication
 * State Management: ใช้ React Context และ Local State
 * Chat Transport: ใช้ AI SDK สำหรับจัดการ streaming
 */

"use client"

// ============================================================================
// IMPORTS - การนำเข้า Components และ Libraries ที่จำเป็น
// ============================================================================
import {
  ChatContainerContent,
  ChatContainerRoot,
} from "@/components/ui/chat-container"                                      // Container สำหรับแสดงข้อความ chat
import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
} from "@/components/ui/message"                                             // Components สำหรับแสดงข้อความ
import {
  PromptInput,
  PromptInputAction,
  PromptInputActions,
  PromptInputTextarea,
} from "@/components/ui/prompt-input"                                       // Components สำหรับรับ input จากผู้ใช้
import { ScrollButton } from "@/components/ui/scroll-button"                // ปุ่มสำหรับ scroll ไปข้างล่าง
import { Button } from "@/components/ui/button"                             // Component ปุ่มพื้นฐาน
import { SidebarTrigger } from "@/components/ui/sidebar"                    // ปุ่มสำหรับเปิด/ปิด sidebar
import { ModelSelector } from "@/components/model-selector"                 // Dropdown สำหรับเลือกโมเดล AI
import { cn } from "@/lib/utils"                                            // Utility สำหรับจัดการ CSS classes
import {
  ArrowUp,
  Copy,
  Globe,
  Mic,
  MoreHorizontal,
  Pencil,
  Plus,
  ThumbsDown,
  ThumbsUp,
  Trash,
} from "lucide-react"                                                        // Icons จาก Lucide React
import { useRef, useState, useEffect } from "react"                          // React Hooks
import { useChatContext } from "@/contexts/chat-context"                     // Context สำหรับจัดการสถานะ chat
import { useChat } from '@ai-sdk/react'                                      // Hook สำหรับจัดการ AI chat
import { createCustomChatTransport } from '@/lib/custom-chat-transport';     // Custom transport สำหรับส่งข้อมูล
import { createClient } from '@/lib/client'                                  // Supabase client
import { DEFAULT_MODEL } from "@/constants/models"                           // โมเดล AI เริ่มต้น

/**
 * Interface สำหรับ Message Object
 * 
 * Structure:
 * - id: string - ID ของข้อความ
 * - role: string - บทบาท ('user' หรือ 'assistant')
 * - parts: Array - ส่วนประกอบของข้อความ
 */
interface MessageType {
  id: string;                                                                // ID ของข้อความ
  role: string;                                                              // บทบาทของผู้ส่ง (user/assistant)
  parts: Array<{ type: string; text: string }>;                            // เนื้อหาข้อความแบบ parts
}

export function NewChat() {
  
  // ============================================================================
  // STEP 1: STATE DECLARATIONS - การประกาศตัวแปร State
  // ============================================================================

  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL)               // โมเดล AI ที่เลือก (ค่าเริ่มต้นจาก constants)
  
  /**
   * ข้อความที่ผู้ใช้พิมพ์ในช่อง input
   * ใช้สำหรับเก็บข้อความที่จะส่งไปยัง AI
   */
  const [prompt, setPrompt] = useState("")
  
  /**
   * สถานะการแสดงหน้า Welcome และฟังก์ชันสำหรับเปลี่ยนสถานะ
   * มาจาก ChatContext ที่ใช้ร่วมกันในทั้งแอปพลิเคชัน
   */
  const { showWelcome, setShowWelcome } = useChatContext()
  
  /**
   * Reference สำหรับ DOM elements ที่ต้องการ access โดยตรง
   * ใช้สำหรับการ scroll และ focus
   */
  const chatContainerRef = useRef<HTMLDivElement>(null)                      // Container สำหรับข้อความ chat
  const textareaRef = useRef<HTMLTextAreaElement>(null)                      // Textarea สำหรับพิมพ์ข้อความ
  
  /**
   * ID ของผู้ใช้ที่ล็อกอินอยู่ในปัจจุบัน
   * ใช้สำหรับการระบุตัวตนและบันทึกข้อมูล
   */
  const [userId, setUserId] = useState<string>('')

  /**
   * ID ของ session การสนทนาปัจจุบัน
   * ใช้สำหรับเก็บประวัติการสนทนาและความต่อเนื่อง
   */
  const [sessionId, setSessionId] = useState<string | undefined>(undefined)
  
  /**
   * สถานะการโหลดประวัติการสนทนา
   * แสดงข้อความ loading เมื่อกำลังดึงข้อมูลจาก database
   */
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  
  /**
   * ข้อความที่โหลดมาจากประวัติการสนทนาใน database
   * เก็บข้อความที่ดึงมาจาก session เก่าเพื่อแสดงต่อจากที่เหลือ
   */
  const [loadedMessages, setLoadedMessages] = useState<MessageType[]>([])    // เก็บข้อความที่โหลดจากประวัติ

  // ============================================================================
  // STEP 2: FUNCTION DEFINITIONS - การประกาศฟังก์ชัน
  // ============================================================================

  /**
   * ฟังก์ชันสำหรับโหลดประวัติข้อความจาก sessionId
   * 
   * Purpose:
   * - ดึงข้อมูลประวัติการสนทนาจาก API
   * - แปลงข้อมูลจาก database format เป็น UI format
   * - จัดการ error และ loading state
   * 
   * Process:
   * 1. ตรวจสอบว่ามี sessionId หรือไม่
   * 2. เรียก API เพื่อดึงข้อมูล
   * 3. แปลงข้อมูลเป็น format ที่ UI ใช้ได้
   * 4. อัปเดต state ด้วยข้อมูลที่ได้
   * 
   * @param sessionIdToLoad - ID ของ session ที่ต้องการโหลด
   */
  const loadChatHistory = async (sessionIdToLoad: string) => {
    // ตรวจสอบว่ามี sessionId หรือไม่
    if (!sessionIdToLoad) return

    // เริ่มแสดงสถานะ loading
    setIsLoadingHistory(true)
    
    try {
      // เรียก API เพื่อดึงประวัติการสนทนา
      const response = await fetch(`/api/chat_05_history?sessionId=${sessionIdToLoad}`)
      
      // ตรวจสอบว่า API response สำเร็จหรือไม่
      if (!response.ok) {
        throw new Error('Failed to load chat history')
      }
      
      // แยกข้อมูล JSON จาก response
      const data = await response.json()
      const loadedMessagesData = data.messages || []
      
      /**
       * แปลงข้อความจาก database format เป็น UI format
       * 
       * Database Format: { id, role, content/text }
       * UI Format: { id, role, parts: [{ type: 'text', text }] }
       */
      const formattedMessages = loadedMessagesData.map((msg: { 
        id?: string; 
        role?: string; 
        content?: string; 
        text?: string 
      }, index: number) => ({
        id: msg.id || `loaded-${index}`,                                     // ใช้ ID จาก DB หรือสร้างใหม่
        role: msg.role || 'user',                                            // ใช้ role ที่ได้จาก API โดยตรง
        parts: [{ type: 'text', text: msg.content || msg.text || '' }]       // แปลงเป็น parts format
      }))
      
      // เก็บข้อความที่โหลดไว้ใน state
      setLoadedMessages(formattedMessages)
      console.log('Loaded messages:', formattedMessages)
      
    } catch (error) {
      // จัดการข้อผิดพลาดที่เกิดขึ้น
      console.error('Error loading chat history:', error)
    } finally {
      // หยุดแสดงสถานะ loading (ทำงานไม่ว่าจะสำเร็จหรือไม่)
      setIsLoadingHistory(false)
    }
  }

  // ============================================================================
  // STEP 3: CHAT HOOK INITIALIZATION - การตั้งค่า useChat Hook
  // ============================================================================

  /**
   * ใช้ useChat hook เพื่อจัดการสถานะการสนทนา
   * 
   * Purpose:
   * - จัดการข้อความที่ส่งและรับ
   * - จัดการสถานะการส่งข้อความ (loading, streaming)
   * - ตั้งค่า custom transport สำหรับส่งข้อมูล
   * - รับ session ID ใหม่จาก response header
   * 
   * Features:
   * - messages: array ของข้อความในการสนทนาปัจจุบัน
   * - sendMessage: ฟังก์ชันสำหรับส่งข้อความ
   * - status: สถานะปัจจุบัน ('ready', 'submitted', 'streaming')
   * - setMessages: ฟังก์ชันสำหรับตั้งค่าข้อความ
   */
  const { messages, sendMessage, status, setMessages } = useChat({
    /**
     * Custom transport configuration
     * 
     * Purpose:
     * - กำหนด API endpoint ที่จะส่งข้อมูลไป
     * - จัดการ response และดึง session ID
     * - บันทึก session ID ไว้ใน localStorage
     */
    transport: createCustomChatTransport({
      api: '/api/chat_05_history',                                           // API endpoint สำหรับส่งข้อความ
      
      /**
       * Callback function ที่ทำงานเมื่อได้รับ response
       * 
       * Purpose:
       * - ดึง session ID จาก response header
       * - บันทึก session ID ใน state และ localStorage
       * - ใช้สำหรับความต่อเนื่องของการสนทนา
       * 
       * @param response - Response object จาก API
       */
      onResponse: (response: Response) => {
        const newSessionId = response.headers.get('x-session-id');           // ดึง session ID จาก header
        if (newSessionId) {
          console.log('Received new session ID:', newSessionId);
          setSessionId(newSessionId);                                        // อัปเดต session ID ใน state
          localStorage.setItem('currentSessionId', newSessionId);            // บันทึก sessionId ล่าสุดไว้ใน localStorage
        }
      },
    }),
  })

  // ============================================================================
  // STEP 4: AUTHENTICATION EFFECT - การตรวจสอบและจัดการ Authentication
  // ============================================================================

  /**
   * Effect สำหรับดึงข้อมูล user และจัดการ authentication
   * 
   * Purpose:
   * - ตรวจสอบสถานะการ login ของผู้ใช้
   * - ดึง user ID สำหรับการบันทึกข้อมูล
   * - โหลด session ID จาก localStorage (เฉพาะเมื่อ page reload)
   * - ติดตาม authentication state changes
   * 
   * Process:
   * 1. สร้าง Supabase client
   * 2. ดึงข้อมูล user ปัจจุบัน
   * 3. โหลด saved session (ถ้ามี)
   * 4. ตั้งค่า auth state listener
   * 
   * Dependencies: [setShowWelcome, showWelcome]
   */
  useEffect(() => {
    const supabase = createClient()                                          // สร้าง Supabase client
    
    /**
     * ฟังก์ชันสำหรับดึงข้อมูล user ปัจจุบัน
     * 
     * Purpose:
     * - ตรวจสอบว่าผู้ใช้ login หรือไม่
     * - เก็บ user ID สำหรับการใช้งาน
     * - โหลด session ที่บันทึกไว้ (เฉพาะกรณี page reload)
     */
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()              // ดึงข้อมูล user
      if (user) {
        setUserId(user.id)                                                   // เก็บ user ID
        
        /**
         * โหลด sessionId จาก localStorage เฉพาะเมื่อ page reload
         * (ไม่ใช่จาก New Chat button)
         * 
         * Logic:
         * - ถ้ามี saved session และ showWelcome = true (page reload)
         * - โหลด session และซ่อน welcome screen
         */
        const savedSessionId = localStorage.getItem('currentSessionId')
        if (savedSessionId && showWelcome) {
          setSessionId(savedSessionId)                                       // ตั้งค่า session ID
          setShowWelcome(false)                                              // ซ่อน welcome เพื่อแสดงประวัติ
        }
      }
    }

    getUser()                                                                // เรียกใช้ฟังก์ชัน

    /**
     * ตั้งค่า listener สำหรับการเปลี่ยนแปลง auth state
     * 
     * Purpose:
     * - ติดตามการ login/logout ของผู้ใช้
     * - อัปเดต user ID เมื่อมีการเปลี่ยนแปลง
     * - จัดการ cleanup เมื่อ logout
     */
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setUserId(session.user.id)                                           // เก็บ user ID
      } else {
        setUserId('')                                                        // ล้าง user ID
      }
    })

    /**
     * Cleanup function
     * ยกเลิก subscription เมื่อ component unmount
     */
    return () => subscription.unsubscribe()
  }, [setShowWelcome, showWelcome])

  // ============================================================================
  // STEP 5: UI FOCUS EFFECT - การจัดการ Focus ของ UI
  // ============================================================================

  /**
   * Effect สำหรับ focus textarea เมื่อแสดงหน้า welcome
   * 
   * Purpose:
   * - ปรับปรุง user experience โดย focus ช่อง input อัตโนมัติ
   * - ช่วยให้ผู้ใช้เริ่มพิมพ์ได้ทันทีเมื่อเข้าหน้า
   * 
   * Logic:
   * - เฉพาะเมื่อ showWelcome = true
   * - ใช้ setTimeout เพื่อให้ DOM render เสร็จก่อน
   * 
   * Dependencies: [showWelcome]
   */
  useEffect(() => {
    if (showWelcome) {
      setTimeout(() => {
        textareaRef.current?.focus()                                         // Focus textarea หลังจาก 100ms
      }, 100)
    }
  }, [showWelcome])

  // ============================================================================
  // STEP 6: CHAT RESET EFFECT - การจัดการการรีเซ็ต Chat
  // ============================================================================

  /**
   * Effect สำหรับจัดการเมื่อ resetChat ถูกเรียก (เริ่ม chat ใหม่จาก sidebar)
   * 
   * Purpose:
   * - เคลียร์ข้อมูลการสนทนาเมื่อผู้ใช้กด "New Chat"
   * - รีเซ็ต state กลับสู่สถานะเริ่มต้น
   * - เตรียมพร้อมสำหรับการสนทนาใหม่
   * 
   * Process:
   * 1. ตรวจสอบว่า showWelcome = true (จาก context)
   * 2. เคลียร์ sessionId, messages, และ loadedMessages
   * 3. เตรียมพร้อมสำหรับการสนทนาใหม่
   * 
   * Dependencies: [showWelcome, setMessages]
   */
  useEffect(() => {
    // เมื่อกด New Chat (showWelcome = true จาก context)
    if (showWelcome) {
      // เคลียร์ sessionId และ messages ทันที
      setSessionId(undefined)                                                // ล้าง session ID
      setMessages([])                                                        // ล้างข้อความจาก useChat
      setLoadedMessages([])                                                  // ล้างข้อความที่โหลดจากประวัติ
    }
  }, [showWelcome, setMessages])

  // ============================================================================
  // STEP 7: HISTORY LOADING EFFECT - การโหลดประวัติการสนทนา
  // ============================================================================

  /**
   * Effect สำหรับโหลดประวัติเมื่อมี sessionId และไม่ใช่ welcome state
   * 
   * Purpose:
   * - โหลดประวัติการสนทนาเมื่อมี session ID
   * - แสดงข้อความต่อจากที่เหลือไว้
   * - รองรับการกลับมาดูประวัติการสนทนา
   * 
   * Conditions:
   * - มี sessionId
   * - มี userId (ผู้ใช้ login แล้ว)
   * - ไม่ใช่ welcome state (showWelcome = false)
   * 
   * Dependencies: [sessionId, userId, showWelcome]
   */
  useEffect(() => {
    // โหลดประวัติเฉพาะเมื่อไม่ใช่ welcome state และมี sessionId
    if (sessionId && userId && !showWelcome) {
      loadChatHistory(sessionId)                                             // เรียกฟังก์ชันโหลดประวัติ
    }
  }, [sessionId, userId, showWelcome])

  // ============================================================================
  // STEP 8: EVENT HANDLER FUNCTIONS - ฟังก์ชันจัดการ Events
  // ============================================================================

  /**
   * ฟังก์ชันสำหรับจัดการการส่งข้อความ
   * 
   * Purpose:
   * - ตรวจสอบความถูกต้องของข้อมูล
   * - สร้าง message object ในรูปแบบที่ถูกต้อง
   * - ส่งข้อความไปยัง AI พร้อมข้อมูล context
   * - อัปเดต UI state
   * 
   * Validation:
   * - ข้อความต้องไม่ว่าง (trim)
   * - ต้องมี userId (ผู้ใช้ login แล้ว)
   * 
   * Process:
   * 1. ตรวจสอบข้อมูล input
   * 2. สร้าง message object
   * 3. ส่งข้อความพร้อม context
   * 4. รีเซ็ต input และซ่อน welcome
   */
  const handleSubmit = () => {
    // ตรวจสอบ userId และข้อความว่าง
    if (!prompt.trim() || !userId) return

    /**
     * สร้าง object message ด้วยโครงสร้าง `parts` ที่ถูกต้อง
     * 
     * Structure:
     * - role: 'user' - ระบุว่าเป็นข้อความจากผู้ใช้
     * - parts: array ของส่วนประกอบข้อความ
     *   - type: 'text' - ประเภทของเนื้อหา
     *   - text: เนื้อหาข้อความจริง
     */
    const messageToSend = {
      role: 'user' as const,
      parts: [{ type: 'text' as const, text: prompt.trim() }],
    };

    /**
     * เรียกใช้ sendMessage พร้อมส่ง body ที่มี context ข้อมูล
     * 
     * Body Parameters:
     * - userId: ID ของผู้ใช้สำหรับการระบุตัวตน
     * - sessionId: ID ของ session สำหรับความต่อเนื่อง
     */
    sendMessage(messageToSend, {
      body: {
        userId: userId,                                                      // ส่ง user ID สำหรับการระบุตัวตน
        sessionId: sessionId,                                               // ส่ง session ID สำหรับความต่อเนื่อง
      },
    })

    // รีเซ็ต UI state
    setPrompt("")                                                            // ล้างข้อความใน input
    setShowWelcome(false)                                                    // ซ่อนหน้า welcome
  }

  /**
   * ฟังก์ชันสำหรับจัดการ sample prompts
   * 
   * Purpose:
   * - ใส่ข้อความตัวอย่างใน input field
   * - ช่วยให้ผู้ใช้เริ่มต้นการสนทนาได้ง่าย
   * - ปรับปรุง user experience
   * 
   * @param samplePrompt - ข้อความตัวอย่างที่จะใส่ใน input
   */
  const handleSamplePrompt = (samplePrompt: string) => {
    setPrompt(samplePrompt)                                                  // ตั้งค่าข้อความใน input
  }

  /**
   * ฟังก์ชันสำหรับเริ่มแชทใหม่
   * 
   * Purpose:
   * - เคลียร์ข้อมูลการสนทนาปัจจุบัน
   * - รีเซ็ต state กลับสู่สถานะเริ่มต้น
   * - เตรียมพร้อมสำหรับการสนทนาใหม่
   * 
   * Process:
   * 1. ล้าง session ID
   * 2. ล้างข้อความที่โหลดจากประวัติ
   * 3. ลบ session ID จาก localStorage
   * 4. Context จะจัดการ showWelcome ให้
   */
  const startNewChat = () => {
    setSessionId(undefined)                                                  // ล้าง session ID
    setLoadedMessages([])                                                    // ล้างข้อความที่โหลด
    localStorage.removeItem('currentSessionId')                             // ลบจาก localStorage
    // ไม่ต้องเซ็ต setShowWelcome(true) เพราะ context จะจัดการให้
  }

  // ============================================================================
  // STEP 9: AUTHENTICATION GUARD - การตรวจสอบสิทธิ์การเข้าถึง
  // ============================================================================

  /**
   * แสดงข้อความเมื่อไม่มี userId (ผู้ใช้ยังไม่ได้ login)
   * 
   * Purpose:
   * - ป้องกันการใช้งานโดยผู้ที่ไม่ได้ login
   * - แสดงข้อความแนะนำให้ผู้ใช้เข้าสู่ระบบ
   * - ปรับปรุง security และ user experience
   * 
   * UI Components:
   * - Header พร้อม sidebar trigger
   * - ข้อความแจ้งให้ login
   * - Layout ที่สอดคล้องกับหน้าหลัก
   */
  if (!userId) {
    return (
      <main className="flex h-screen flex-col overflow-hidden">
        {/* Header Section - ส่วนหัวของหน้า */}
        <header className="bg-background z-10 flex h-16 w-full shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />                              {/* ปุ่มเปิด/ปิด sidebar */}
          <div className="text-foreground flex-1">New Chat</div>            {/* ชื่อหน้า */}
        </header>
        
        {/* Content Section - ส่วนเนื้อหาหลัก */}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-gray-700 mb-2">กรุณาเข้าสู่ระบบ</h2>
            <p className="text-gray-500">คุณต้องเข้าสู่ระบบก่อนเพื่อใช้งาน Chat</p>
          </div>
        </div>
      </main>
    )
  }

  // ============================================================================
  // STEP 10: MAIN RENDER - การแสดงผลหน้าหลัก
  // ============================================================================

  /**
   * Main render section - ส่วนแสดงผลหลักของ component
   * 
   * Structure:
   * 1. Header - ส่วนหัวพร้อม navigation
   * 2. Chat Container - ส่วนแสดงข้อความ
   * 3. Input Section - ส่วนรับ input จากผู้ใช้
   * 
   * Conditional Rendering:
   * - Welcome Screen: เมื่อเริ่มการสนทนาใหม่
   * - Chat History: เมื่อมีข้อความในการสนทนา
   */
  return (
    <main className="flex h-screen flex-col overflow-hidden">
      
      {/* ============================================================================ */}
      {/* HEADER SECTION - ส่วนหัวของหน้า */}
      {/* ============================================================================ */}
      
      <header className="bg-background z-10 flex h-16 w-full shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />                                {/* ปุ่มเปิด/ปิด sidebar */}
        <div className="text-foreground flex-1">New Chat</div>              {/* ชื่อหน้า */}
        
        {/* Model Selector */}
        <ModelSelector
          selectedModel={selectedModel}
          onModelChange={setSelectedModel}
        />
      </header>

      {/* ============================================================================ */}
      {/* CHAT CONTAINER SECTION - ส่วนแสดงข้อความการสนทนา */}
      {/* ============================================================================ */}
      
      <div ref={chatContainerRef} className="relative flex-1 overflow-hidden">
        <ChatContainerRoot className="h-full">
          <ChatContainerContent
            className={cn(
              "p-4",
              // แสดง welcome screen ตรงกลางเมื่อไม่มีข้อความ
              (showWelcome && messages.length === 0 && loadedMessages.length === 0) 
                ? "flex items-center justify-center h-full" 
                : ""
            )}
          >
            {/* ============================================================================ */}
            {/* CONDITIONAL CONTENT - เนื้อหาที่แสดงตามสถานะ */}
            {/* ============================================================================ */}
            
            {/* Welcome Screen - หน้าต้อนรับสำหรับการสนทนาใหม่ */}
            {(showWelcome && messages.length === 0 && loadedMessages.length === 0) ? (
              /**
               * Welcome Screen Layout
               * 
               * Components:
               * 1. AI Avatar และ Welcome Message
               * 2. Sample Prompts Grid
               * 3. Interactive Buttons สำหรับ quick start
               */
              <div className="text-center max-w-2xl mx-auto">
                
                {/* AI Avatar และ Welcome Message */}
                <div className="mb-8">
                  <div className="h-20 w-20 mx-auto mb-6 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                    <span className="text-white font-bold text-2xl">AI</span>
                  </div>
                  <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-4">
                    Welcome to Genius AI
                  </h1>
                  <p className="text-lg text-slate-600 dark:text-slate-400 mb-8">
                    Ask me anything, and I&aposll help you with coding,
                    problem-solving, and creative tasks.
                  </p>
                </div>

                {/* Sample Prompts Grid - ตัวอย่างคำถามสำหรับ quick start */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                  
                  {/* Sample Prompt 1: CSS Grid Layout */}
                  <button
                    onClick={() =>
                      handleSamplePrompt(
                        "How do I create a responsive layout with CSS Grid?"
                      )
                    }
                    className="p-4 text-left rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <div className="font-medium text-slate-900 dark:text-white mb-1">
                      CSS Grid Layout
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-400">
                      Learn how to create responsive layouts
                    </div>
                  </button>

                  {/* Sample Prompt 2: React Hooks */}
                  <button
                    onClick={() =>
                      handleSamplePrompt(
                        "Explain React hooks and when to use them"
                      )
                    }
                    className="p-4 text-left rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <div className="font-medium text-slate-900 dark:text-white mb-1">
                      React Hooks
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-400">
                      Understanding hooks and their use cases
                    </div>
                  </button>

                  {/* Sample Prompt 3: API Design */}
                  <button
                    onClick={() =>
                      handleSamplePrompt(
                        "What are the best practices for API design?"
                      )
                    }
                    className="p-4 text-left rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <div className="font-medium text-slate-900 dark:text-white mb-1">
                      API Design
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-400">
                      Best practices for building APIs
                    </div>
                  </button>

                  {/* Sample Prompt 4: JavaScript Debugging */}
                  <button
                    onClick={() =>
                      handleSamplePrompt("Help me debug this JavaScript error")
                    }
                    className="p-4 text-left rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <div className="font-medium text-slate-900 dark:text-white mb-1">
                      Debug JavaScript
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-400">
                      Get help with debugging code issues
                    </div>
                  </button>
                </div>
              </div>
            ) : (
              // ============================================================================
              // CHAT MESSAGES DISPLAY - การแสดงข้อความการสนทนา
              // ============================================================================
              
              /**
               * Chat Messages Section
               * 
               * Purpose:
               * - แสดงข้อความจากประวัติ (loadedMessages)
               * - แสดงข้อความใหม่ (messages จาก useChat)
               * - รองรับทั้ง user และ assistant messages
               * - แสดง message actions (copy, like, edit, etc.)
               */
              <div className="space-y-3 max-w-3xl mx-auto w-full">
                
                {/* รวม loadedMessages และ messages จาก useChat */}
                {[...loadedMessages, ...messages].map((message, index) => {
                  const isAssistant = message.role === "assistant"            // ตรวจสอบว่าเป็นข้อความจาก AI หรือไม่
                  
                  return (
                    /**
                     * Message Component
                     * 
                     * Props:
                     * - key: unique identifier สำหรับ React rendering
                     * - isAssistant: boolean สำหรับแยกประเภทข้อความ
                     * - bubbleStyle: ใช้ bubble style สำหรับแสดงผล
                     */
                    <Message
                      key={`${message.id}-${index}`}                         // unique key สำหรับ React
                      isAssistant={isAssistant}                              // ระบุประเภทข้อความ
                      bubbleStyle={true}                                     // ใช้ bubble style
                    >
                      
                      {/* Message Content - เนื้อหาข้อความ */}
                      <MessageContent
                        isAssistant={isAssistant}
                        bubbleStyle={true}
                        markdown                                             // แสดงเป็น markdown format
                      >
                        {/* แปลงข้อความจาก parts structure เป็น string */}
                        {typeof message === 'object' && 'parts' in message && message.parts
                          ? message.parts.map((part) => 
                              'text' in part ? part.text : ''
                            ).join('')
                          : String(message)}
                      </MessageContent>
                      
                      {/* Message Actions - ปุ่มสำหรับจัดการข้อความ */}
                      <MessageActions
                        isAssistant={isAssistant}
                        bubbleStyle={true}
                      >
                        
                        {/* Copy Button - ปุ่มสำหรับ copy ข้อความ */}
                        <MessageAction tooltip="Copy" bubbleStyle={true}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-gray-500 hover:text-gray-700 rounded-full"
                          >
                            <Copy size={14} />
                          </Button>
                        </MessageAction>
                        
                        {/* Assistant Message Actions - ปุ่มสำหรับข้อความจาก AI */}
                        {isAssistant && (
                          <>
                            {/* Upvote Button */}
                            <MessageAction tooltip="Upvote" bubbleStyle={true}>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-gray-500 hover:text-gray-700 rounded-full"
                              >
                                <ThumbsUp size={14} />
                              </Button>
                            </MessageAction>
                            
                            {/* Downvote Button */}
                            <MessageAction tooltip="Downvote" bubbleStyle={true}>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-gray-500 hover:text-gray-700 rounded-full"
                              >
                                <ThumbsDown size={14} />
                              </Button>
                            </MessageAction>
                          </>
                        )}
                        
                        {/* User Message Actions - ปุ่มสำหรับข้อความจากผู้ใช้ */}
                        {!isAssistant && (
                          <>
                            {/* Edit Button */}
                            <MessageAction tooltip="Edit" bubbleStyle={true}>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-gray-500 hover:text-gray-700 rounded-full"
                              >
                                <Pencil size={14} />
                              </Button>
                            </MessageAction>
                            
                            {/* Delete Button */}
                            <MessageAction tooltip="Delete" bubbleStyle={true}>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-gray-500 hover:text-gray-700 rounded-full"
                              >
                                <Trash size={14} />
                              </Button>
                            </MessageAction>
                          </>
                        )}
                      </MessageActions>
                    </Message>
                  )
                })}
              </div>
            )}
          </ChatContainerContent>
          
          {/* ============================================================================ */}
          {/* SCROLL BUTTON - ปุ่มสำหรับ scroll ไปข้างล่าง */}
          {/* ============================================================================ */}
          
          {/* แสดง scroll button เฉพาะเมื่อไม่ใช่ welcome screen */}
          {!(showWelcome && messages.length === 0 && loadedMessages.length === 0) && (
            <div className="absolute bottom-4 left-1/2 flex w-full max-w-3xl -translate-x-1/2 justify-end px-5">
              <ScrollButton className="shadow-sm" />                        {/* ปุ่ม scroll to bottom */}
            </div>
          )}
        </ChatContainerRoot>
      </div>

      {/* ============================================================================ */}
      {/* INPUT SECTION - ส่วนรับ input จากผู้ใช้ */}
      {/* ============================================================================ */}
      
      <div className="bg-background z-10 shrink-0 px-3 pb-3 md:px-5 md:pb-5">
        <div className="mx-auto max-w-3xl">
          
          {/* ============================================================================ */}
          {/* STATUS INDICATORS - แสดงสถานะต่างๆ */}
          {/* ============================================================================ */}
          
          {/* แสดงสถานะการพิมพ์ของ AI */}
          {(status === 'submitted' || status === 'streaming') && 
            <div className="text-gray-500 italic mb-2 text-sm">🤔 AI กำลังคิด...</div>
          }
          
          {/* แสดงสถานะการโหลดประวัติ */}
          {isLoadingHistory && 
            <div className="text-blue-500 italic mb-2 text-sm">📚 กำลังโหลดประวัติการสนทนา...</div>
          }
          
          {/* ============================================================================ */}
          {/* PROMPT INPUT COMPONENT - ส่วน input หลัก */}
          {/* ============================================================================ */}
          
          {/*
           * PromptInput Component
           * 
           * Purpose:
           * - รับข้อความจากผู้ใช้
           * - จัดการ loading state
           * - ส่งข้อความเมื่อกด Enter หรือคลิกปุ่ม
           * 
           * Props:
           * - isLoading: สถานะการโหลด
           * - value: ข้อความในปัจจุบัน
           * - onValueChange: callback เมื่อข้อความเปลี่ยน
           * - onSubmit: callback เมื่อส่งข้อความ
           */}
          <PromptInput
            isLoading={status !== 'ready'}
            value={prompt}
            onValueChange={setPrompt}
            onSubmit={handleSubmit}
            className="border-input bg-popover relative z-10 w-full rounded-3xl border p-0 pt-1 shadow-xs"
          >
            <div className="flex flex-col">
              
              {/* ============================================================================ */}
              {/* TEXTAREA INPUT - ช่องพิมพ์ข้อความ */}
              {/* ============================================================================ */}
              
              {/*
               * PromptInputTextarea Component
               * 
               * Purpose:
               * - รับข้อความจากผู้ใช้
               * - รองรับ multiline input
               * - Auto-focus เมื่อเข้าหน้า welcome
               * 
               * Features:
               * - Auto-resize ตามเนื้อหา
               * - Placeholder text
               * - Keyboard shortcuts
               */}
              <PromptInputTextarea
                ref={textareaRef}
                placeholder="Ask anything to start a new chat..."
                className="min-h-[44px] pt-3 pl-4 text-base leading-[1.3] sm:text-base md:text-base"
              />

              {/* ============================================================================ */}
              {/* INPUT ACTIONS - ปุ่มต่างๆ ใน input area */}
              {/* ============================================================================ */}
              
              {/*
               * PromptInputActions Component
               * 
               * Purpose:
               * - จัดกลุ่มปุ่มต่างๆ ใน input area
               * - แยกเป็นกลุ่มซ้ายและขวา
               * - รองรับ action ต่างๆ เช่น search, voice, send
               */}
              <PromptInputActions className="mt-5 flex w-full items-center justify-between gap-2 px-3 pb-3">
                
                {/* Left Actions Group - กลุ่มปุ่มด้านซ้าย */}
                <div className="flex items-center gap-2">
                  
                  {/* Add Action Button - ปุ่มเพิ่ม action */}
                  <PromptInputAction tooltip="Add a new action">
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-9 rounded-full"
                    >
                      <Plus size={18} />
                    </Button>
                  </PromptInputAction>

                  {/* Search Button - ปุ่มค้นหา */}
                  <PromptInputAction tooltip="Search">
                    <Button variant="outline" className="rounded-full">
                      <Globe size={18} />
                      Search
                    </Button>
                  </PromptInputAction>

                  {/* More Actions Button - ปุ่ม action เพิ่มเติม */}
                  <PromptInputAction tooltip="More actions">
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-9 rounded-full"
                    >
                      <MoreHorizontal size={18} />
                    </Button>
                  </PromptInputAction>
                </div>
                
                {/* Right Actions Group - กลุ่มปุ่มด้านขวา */}
                <div className="flex items-center gap-2">
                  
                  {/* Voice Input Button - ปุ่ม voice input */}
                  <PromptInputAction tooltip="Voice input">
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-9 rounded-full"
                    >
                      <Mic size={18} />
                    </Button>
                  </PromptInputAction>

                  {/* Send Button - ปุ่มส่งข้อความ */}
                  {/*
                   * Send Button
                   * 
                   * Purpose:
                   * - ส่งข้อความไปยัง AI
                   * - แสดง loading state
                   * - ตรวจสอบความพร้อมก่อนส่ง
                   * 
                   * Disabled Conditions:
                   * - ข้อความว่าง (!prompt.trim())
                   * - ไม่ ready (status !== &apos;ready&apos;)
                   * - ไม่มี userId
                   */}
                  <Button
                    size="icon"
                    disabled={!prompt.trim() || status !== 'ready' || !userId}
                    onClick={handleSubmit}
                    className="size-9 rounded-full"
                  >
                    {/* แสดง icon ตาม status */}
                    {status === 'ready' ? (
                      /* แสดงลูกศรเมื่อพร้อม */
                      <ArrowUp size={18} />
                    ) : (
                      /* แสดง loading indicator */
                      <span className="size-3 rounded-xs bg-white" />
                    )}
                  </Button>
                </div>
              </PromptInputActions>
            </div>
          </PromptInput>
        </div>
      </div>
    </main>
  )
}
```