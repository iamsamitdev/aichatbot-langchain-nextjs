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