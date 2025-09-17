/**
 * ===============================================
 * API Constants - ค่าคงที่สำหรับ API Endpoints
 * ===============================================
 * 
 * Purpose: จัดการ API endpoints แบบ centralized และเรียบง่าย
 * 
 * Benefits:
 * - ป้องกันการพิมพ์ path ผิด
 * - ง่ายต่อการเปลี่ยนแปลง API version
 * - เรียบง่าย ไม่ซับซ้อน
 * - ลดการ duplicate code
 * 
 * Usage:
 * - import { API_BASE, API_BASE_SESSION } from '@/constants/api'
 * - fetch(API_BASE)
 * - fetch(API_BASE_SESSION)
 */

// ===============================================
// Main API Endpoints - API Endpoints หลัก
// ===============================================

/**
 * Base API endpoint สำหรับ Chat operations
 * เปลี่ยนค่านี้เมื่อต้องการใช้ chat API version อื่น
 * 
 * Available options:
 * - '/api/chat' - Chat API รุ่นพื้นฐาน
 * - '/api/chat_01_start' - Chat API รุ่น 1 เริ่มต้น
 * - '/api/chat_02_request' - Chat API รุ่น 2 จัดการ request/response
 * - '/api/chat_03_template' - Chat API รุ่น 3 รองรับ template
 * - '/api/chat_04_stream' - Chat API รุ่น 4 รองรับ streaming
 * - '/api/chat_05_history' - Chat API รุ่น 5 รองรับประวัติการสนทนา
 * - '/api/chat_06_history_optimize' - Chat API รุ่น 6 ประวัติแบบ optimize
 * - '/api/chat_06_history_optimistic' - Chat API รุ่น 6 ประวัติแบบ optimistic
 */
export const API_BASE = '/api/chat_07_tool_calling_sample'

/**
 * Base API endpoint สำหรับ Session operations
 * เปลี่ยนค่านี้เมื่อต้องการใช้ session API version อื่น
 * 
 * Available options:
 * - '/api/chat_05_history/session' - Session API สำหรับ chat_05_history
 * - '/api/chat_06_history_optimize/session' - Session API สำหรับ chat_06_history_optimize
 * - '/api/chat_06_history_optimistic/session' - Session API สำหรับ chat_06_history_optimistic
 */
export const API_BASE_SESSION = '/api/chat_06_history_optimistic/session'

// ===============================================
// Helper Functions - ฟังก์ชันช่วยเหลือ
// ===============================================

/**
 * ฟังก์ชันสำหรับสร้าง URL พร้อม query parameters
 * 
 * @param endpoint - API endpoint base URL
 * @param params - Object ของ query parameters
 * @returns URL string พร้อม query parameters
 * 
 * @example
 * buildApiUrl(API_BASE, { sessionId: '123', userId: 'user1' })
 */
export function buildApiUrl(endpoint: string, params?: Record<string, string | number | boolean>): string {
  if (!params || Object.keys(params).length === 0) {
    return endpoint
  }
  
  const searchParams = new URLSearchParams()
  
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.append(key, String(value))
    }
  })
  
  const queryString = searchParams.toString()
  return queryString ? `${endpoint}?${queryString}` : endpoint
}
