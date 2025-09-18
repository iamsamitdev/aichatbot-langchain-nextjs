# 🔧 RAG Troubleshooting Guide

## 📋 ปัญหาที่พบ
**ปัญหา:** RAG (Retrieval-Augmented Generation) ไม่สามารถค้นหาเอกสารได้ แต่ Tool Calling อื่นๆ ทำงานได้ปกติ

## 🔍 การตรวจสอบที่ได้ทำแล้ว

### ✅ 1. ปรับปรุง Error Handling
- เพิ่มการตรวจสอบ environment variables
- เพิ่มการตรวจสอบการเชื่อมต่อ Supabase
- เพิ่มการตรวจสอบจำนวน documents ในตาราง
- เพิ่ม detailed error messages สำหรับ debug

### ✅ 2. ปรับปรุง search_documents Tool
- เพิ่ม logging สำหรับ debug
- ปรับ error handling ให้ชัดเจนขึ้น
- เพิ่มการตรวจสอบขั้นตอนการทำงาน

### ✅ 3. ปรับปรุง createVectorStore Function
- เพิ่ม logging สำหรับ debug
- เพิ่ม try-catch สำหรับ error handling

## 🚨 ขั้นตอนการแก้ไขปัญหา

### Step 1: ตรวจสอบ Environment Variables
```bash
# ตรวจสอบว่ามี .env.local หรือไม่
# ต้องมี:
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY=your-supabase-anon-key
OPENAI_API_KEY=your-openai-api-key
OPENAI_EMBEDDING_MODEL_NAME=text-embedding-3-small
```

### Step 2: ตรวจสอบ Database Schema
ต้องมี table `documents` ใน Supabase พร้อมกับ:
- pgvector extension
- match_documents function

### Step 3: ตรวจสอบ Documents ในฐานข้อมูล
- ต้องมีเอกสารถูก embed และเก็บไว้แล้ว
- ใช้ API `/api/document_loader_embeding_pgvector/text_csv_pdf` เพื่อ load documents

### Step 4: ทดสอบการทำงาน
- ทดสอบ search_documents tool ผ่าน chat
- ตรวจสอบ console logs สำหรับ error messages

## 📝 Error Messages ที่อาจพบ

1. **"ระบบยังไม่ได้ตั้งค่าการเชื่อมต่อกับฐานข้อมูลเอกสาร"**
   - ไม่มี environment variables

2. **"ไม่สามารถเชื่อมต่อฐานข้อมูลเอกสารได้"**
   - Supabase connection error

3. **"ยังไม่มีเอกสารใดๆ ถูกอัปโหลดในระบบ"**
   - ตาราง documents ว่าง

4. **"ตารางเอกสารยังไม่ถูกสร้างในฐานข้อมูล"**
   - Table documents ไม่มี

5. **"ฟังก์ชันค้นหาเอกสารยังไม่ถูกสร้างในฐานข้อมูล"**
   - Function match_documents ไม่มี

6. **"เกิดปัญหาในการสร้าง embedding สำหรับค้นหา"**
   - OpenAI API key ผิด

## 🛠️ วิธีแก้ไข

### สร้าง .env.local
```env
NODE_ENV=development

# Supabase
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY=your-supabase-anon-key

# OpenAI
OPENAI_API_KEY=your-openai-api-key
OPENAI_EMBEDDING_MODEL_NAME=text-embedding-3-small
```

### สร้าง Database Schema (ทำใน Supabase SQL Editor)
```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create documents table
CREATE TABLE documents (
  id BIGSERIAL PRIMARY KEY,
  content TEXT,
  metadata JSONB,
  embedding VECTOR(1536)
);

-- Create index for vector similarity search
CREATE INDEX ON documents USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Create function for similarity search
CREATE OR REPLACE FUNCTION match_documents (
  query_embedding VECTOR(1536),
  match_threshold FLOAT DEFAULT 0.78,
  match_count INT DEFAULT 10
)
RETURNS TABLE (
  id BIGINT,
  content TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    documents.id,
    documents.content,
    documents.metadata,
    1 - (documents.embedding <=> query_embedding) AS similarity
  FROM documents
  WHERE 1 - (documents.embedding <=> query_embedding) > match_threshold
  ORDER BY documents.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

### โหลดเอกสาร
1. ใส่ไฟล์ใน folder `data/` (PDF, TXT, CSV)
2. เรียก GET `/api/document_loader_embeding_pgvector/text_csv_pdf`

## 🧪 การทดสอบ

### ทดสอบ Environment
```javascript
console.log('SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log('OPENAI_KEY exists:', !!process.env.OPENAI_API_KEY);
```

### ทดสอบ Database
```javascript
const { data, error } = await supabase.from('documents').select('count', { count: 'exact' });
```

### ทดสอบ Search
ใน chat ลองถาม: "ค้นหาข้อมูลร้าน" หรือ "บอกข้อมูลสินค้า"

## 📊 Status
- ✅ Error handling improved
- ✅ Logging added
- ⏳ ต้องตรวจสอบ environment variables
- ⏳ ต้องตรวจสอบ database schema  
- ⏳ ต้องตรวจสอบ documents ในฐานข้อมูล