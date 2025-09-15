'use client'

import { createClient } from '@/lib/client'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import { LogOut } from "lucide-react"

export function LogoutButton() {
  const router = useRouter()

  const logout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

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
