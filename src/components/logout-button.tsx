"use client"

import { createClient } from "@/lib/client"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { LogOut } from "lucide-react"

export function LogoutButton() {
  const router = useRouter()

  const logout = async () => {
    const supabase = createClient()

    // เคลียร์ currentSessionId จาก localStorage
    localStorage.removeItem('currentSessionId')

    await supabase.auth.signOut()
    router.push("/auth/login")
  }

  return (
    <Button
      onClick={logout}
      variant="ghost"
      className="w-full justify-start gap-3 h-12 text-left hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
    >
      <LogOut className="h-4 w-4" />
      Log out
    </Button>
  )
}