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

export function NewChat() {

  const [prompt, setPrompt] = useState("")
  const [isLoading, setIsLoading] = useState(false)
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