import { NextResponse } from "next/server"

// Method GET
// http://localhost:3000/api
export async function GET() {
    return NextResponse.json({message:"API Running with GET"})
}

// Method POST
// http://localhost:3000/api
export async function POST() {
  return NextResponse.json({ message: "API Running with POST" })
}

// Method PUT
// http://localhost:3000/api
export async function PUT() {
  return NextResponse.json({ message: "API Running with PUT" })
}

// Method DELETE
// http://localhost:3000/api
export async function DELETE() {
  return NextResponse.json({ message: "API Running with DELETE" })
}