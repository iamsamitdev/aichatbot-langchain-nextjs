import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

// CSS CLASS UTILITIES - ยูทิลิตี้สำหรับ CSS Classes
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ID GENERATION UTILITIES - ยูทิลิตี้สำหรับสร้าง ID
export function generateUniqueId(prefix: string = ''): string {
  const timestamp = Date.now()                                              // เวลาปัจจุบันเป็น milliseconds
  
  const random = Math.random().toString(36).substr(2, 9)                    // สุ่ม string 9 ตัวอักษร (base36)
  
  // รวม prefix, timestamp และ random string
  return prefix ? `${prefix}-${timestamp}-${random}` : `${timestamp}-${random}`
}

// DATE GROUPING INTERFACES - Interface สำหรับจัดกลุ่มตามวันที่
export interface GroupedSessions {
  period: string                                                            // ชื่อช่วงเวลา เช่น "Today", "Yesterday"
  sessions: ChatSession[]                                                   // Array ของ sessions ในช่วงเวลานั้น
}

interface ChatSession {
  id: string;                                                               // รหัสประจำตัว session
  title: string;                                                            // หัวข้อของ chat session
  created_at: string;                                                       // วันที่สร้าง (ISO string format)
  message_count?: number;                                                   // จำนวนข้อความใน session (optional)
  user_id?: string;                                                         // รหัสผู้ใช้เจ้าของ session (optional)
}

// DATE GROUPING FUNCTION - ฟังก์ชันจัดกลุ่ม Sessions ตามวันที่
export function groupSessionsByDate(sessions: ChatSession[]): GroupedSessions[] {
  
  const now = new Date()                                                      // วันเวลาปัจจุบัน
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())    // วันนี้ (00:00:00)
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)           // เมื่อวาน (00:00:00)
  const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)    // 7 วันที่แล้ว
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)  // 30 วันที่แล้ว

  const groups: { [key: string]: ChatSession[] } = {
    today: [],                                                              // sessions ของวันนี้
    yesterday: [],                                                          // sessions ของเมื่อวาน
    last7days: [],                                                          // sessions ของ 7 วันที่แล้ว
    lastMonth: [],                                                          // sessions ของเดือนที่แล้ว
    older: []                                                               // sessions ที่เก่ากว่า 30 วัน
  }

  sessions.forEach(session => {
    // แปลง created_at string เป็น Date object
    const sessionDate = new Date(session.created_at)                       // วันที่สร้าง session
    const sessionDateOnly = new Date(sessionDate.getFullYear(), sessionDate.getMonth(), sessionDate.getDate()) // วันที่เท่านั้น (ไม่รวมเวลา)

    // เปรียบเทียบและใส่ลงกลุ่มที่เหมาะสม
    if (sessionDateOnly.getTime() === today.getTime()) {
      groups.today.push(session)                                            // วันนี้
    } else if (sessionDateOnly.getTime() === yesterday.getTime()) {
      groups.yesterday.push(session)                                        // เมื่อวาน
    } else if (sessionDate >= sevenDaysAgo) {
      groups.last7days.push(session)                                        // 7 วันที่แล้ว
    } else if (sessionDate >= thirtyDaysAgo) {
      groups.lastMonth.push(session)                                        // เดือนที่แล้ว
    } else {
      groups.older.push(session)                                            // เก่ากว่า 30 วัน
    }
  })

  const result: GroupedSessions[] = []

  // เช็คและเพิ่มกลุ่ม "Today"
  if (groups.today.length > 0) {
    result.push({ period: 'Today', sessions: groups.today })
  }
  
  // เช็คและเพิ่มกลุ่ม "Yesterday"  
  if (groups.yesterday.length > 0) {
    result.push({ period: 'Yesterday', sessions: groups.yesterday })
  }

  // เช็คและเพิ่มกลุ่ม "Last 7 days"
  if (groups.last7days.length > 0) {
    result.push({ period: 'Last 7 days', sessions: groups.last7days })
  }

  //  เช็คและเพิ่มกลุ่ม "Last month"
  if (groups.lastMonth.length > 0) {
    result.push({ period: 'Last month', sessions: groups.lastMonth })
  }
  
  //  เช็คและเพิ่มกลุ่ม "Older"
  if (groups.older.length > 0) {
    result.push({ period: 'Older', sessions: groups.older })
  }

  // ส่งคืน result ที่จัดเรียงเรียบร้อยแล้ว
  return result
}