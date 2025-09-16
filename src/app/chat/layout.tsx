import { redirect } from 'next/navigation'
import { createClient } from '@/lib/server'
import { ChatSidebar } from '@/components/chat-sidebar'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { ChatProvider } from '@/contexts/chat-context'

export default async function ChatLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) {
    redirect('/auth/login')
  }

  const userInfo = {
    display_name: data.user.user_metadata?.display_name || data.user.email?.split('@')[0] || 'User',
    email: data.user.user_metadata?.email || data.user.email || '',
    userId: data.user.id, // เพิ่ม userId
  }

  return (
    <ChatProvider>
      <SidebarProvider>
        <ChatSidebar {...userInfo} />
        <SidebarInset>
          {children}
        </SidebarInset>
      </SidebarProvider>
    </ChatProvider>
  )
}