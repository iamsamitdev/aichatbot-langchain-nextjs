import { NextRequest, NextResponse } from "next/server"

// GET Method Example
// URL: /api/test?name=John
// URL: /api/test หรือ http://localhost:3000/api/test?name=John
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const name = searchParams.get("name") || "World"

    return NextResponse.json({
        message: `Hello, ${name}`
    })
}

// POST Method Example
// URL: /api/test
// Body: { "name": "John" }
// Content-Type: application/json
// Headers: { "Content-Type": "application/json" }
// curl -X POST http://localhost:3000/api/test -d '{"name":"Jane"}'
export async function POST(request: NextRequest) {
  const data = await request.json()
  const name = data.name || "World"
  
  return NextResponse.json({
    message: `Hello, ${name}!`
  })
}

// PUT Method Example
// URL: /api/test
// Body: { "name": "Jane" }
// Content-Type: application/json
// Headers: { "Content-Type": "application/json" }
// curl -X PUT http://localhost:3000/api/test -d '{"name":"Jane"}'
export async function PUT(request: NextRequest) {
  const data = await request.json()
  const name = data.name || "World"
  
  return NextResponse.json({
    message: `Hello, ${name}!`
  })
}

// DELETE Method Example
// URL: /api/test
// curl -X DELETE http://localhost:3000/api/test
export async function DELETE() {
  return NextResponse.json({
    message: "Delete request received"
  })
}