"use client"

import React, { createContext, useContext, useState, useCallback } from 'react'

interface ChatContextType {
  chatMessages: Array<{
    id: number
    role: string
    content: string
  }>
  setChatMessages: React.Dispatch<React.SetStateAction<Array<{
    id: number
    role: string
    content: string
  }>>>
  showWelcome: boolean
  setShowWelcome: React.Dispatch<React.SetStateAction<boolean>>
  resetChat: () => void
}

const ChatContext = createContext<ChatContextType | undefined>(undefined)

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [chatMessages, setChatMessages] = useState<Array<{
    id: number
    role: string
    content: string
  }>>([])
  const [showWelcome, setShowWelcome] = useState(true)

  const resetChat = useCallback(() => {
    setChatMessages([])
    setShowWelcome(true)
  }, [])

  return (
    <ChatContext.Provider value={{
      chatMessages,
      setChatMessages,
      showWelcome,
      setShowWelcome,
      resetChat
    }}>
      {children}
    </ChatContext.Provider>
  )
}

export function useChatContext() {
  const context = useContext(ChatContext)
  if (context === undefined) {
    throw new Error('useChatContext must be used within a ChatProvider')
  }
  return context
}