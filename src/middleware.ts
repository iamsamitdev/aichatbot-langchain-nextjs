import { updateSession } from '@/lib/middleware'
import { type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images - .svg, .png, .jpg, .jpeg, .gif, .webp
     * Feel free to modify this pattern to include more paths.
     */

    /*
    การแยกโครงสร้าง Regex
    1. / … / 
      - หมายถึง regex pattern ครอบทั้งหมด (Next.js จะใช้ regex นี้เป็นตัวกรอง path)

    2. ((?! ... ).*) 
      - ?! ... คือ Negative Lookahead → แปลว่า "ต้องไม่ตรงกับสิ่งที่อยู่ในวงเล็บ"
      - .* คือ match ทุกตัวอักษรที่เหลือหลังจากตรวจสอบว่าไม่ตรงกับ pattern ใน ?!
      - ดังนั้นมันคือ "match path อะไรก็ได้ ยกเว้น สิ่งที่กำหนดในวงเล็บ"

    3. สิ่งที่ถูก exclude (ไม่ให้ middleware จับ)
      - _next/static → ไฟล์ static ของ Next.js
      - _next/image → ไฟล์ image optimization ของ Next.js
      - favicon.ico → ไฟล์ favicon
      - .*\.(?:svg|png|jpg|jpeg|gif|webp)$ → ไฟล์รูปภาพสกุลต่าง ๆ (svg, png, jpg, jpeg, gif, webp)

    สรุปความหมาย
    Middleware ตัวนี้จะ ทำงานกับทุก request path
    ยกเว้น
      - ไฟล์ static ที่อยู่ใน _next/static
      - รูปภาพ optimization _next/image
      - ไฟล์ favicon ที่ชื่อว่า favicon.ico
      - ไฟล์รูปภาพที่มีนามสกุล .svg, .png, .jpg, .jpeg, .gif, .webp
    */

    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$|).*)',
  ],
}
