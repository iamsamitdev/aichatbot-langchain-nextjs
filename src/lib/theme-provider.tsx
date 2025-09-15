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