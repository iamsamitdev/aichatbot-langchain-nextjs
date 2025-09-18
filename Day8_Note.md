## AI Chatbot with LangChain & Next.js - Day 8

### 📚 Document Loader, Embedding & PGVector Setup Guide

คู่มือการตั้งค่าระบบโหลดเอกสาร สร้าง Embeddings และใช้งาน PGVector ใน Supabase สำหรับ AI Chatbot

### 📋 สารบัญ

1. [ภาพรวมระบบ](#ภาพรวมระบบ)
2. [การเตรียม Environment](#การเตรียม-environment)
3. [การตั้งค่า Supabase Database](#การตั้งค่า-supabase-database)
4. [การเตรียมโครงสร้างโปรเจ็กต์](#การเตรียมโครงสร้างโปรเจ็กต์)
5. [การใช้งาน API](#การใช้งาน-api)
6. [การทดสอบระบบ](#การทดสอบระบบ)
7. [Performance Optimization: CacheBackedEmbeddings](#performance-optimization-cachebackedembeddings)
8. [การแก้ไขปัญหา](#การแก้ไขปัญหา)

### 🎯 ภาพรวมระบบ

ระบบนี้ช่วยให้ AI Chatbot สามารถ:
- โหลดเอกสารจากไฟล์ `.txt`, `.csv` และ `.pdf`
- แยกข้อความเป็นส่วนๆ (Chunking) เพื่อการประมวลผลที่มีประสิทธิภาพ
- แปลงข้อความเป็น Vector Embeddings ด้วย OpenAI
- ใช้ CacheBackedEmbeddings เพื่อเพิ่มประสิทธิภาพและลดต้นทุน
- เก็บข้อมูลใน Supabase โดยใช้ pgvector extension
- ค้นหาเอกสารที่เกี่ยวข้องด้วย Similarity Search

### 🏗️ สถาปัตยกรรมระบบ

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Documents     │───▶│   Text Splitter  │───▶│   OpenAI        │
│   (.txt, .csv)  │    │   (Chunking)     │    │   Embeddings    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
                                                         ▼
┌─────────────────┐                               ┌─────────────────┐
│  Cache Store    │◀──────────────────────────────│ CacheBackedEmb  │
│ (InMemoryStore) │                               │   (⚡ Caching)  │
└─────────────────┘                               └─────────────────┘
                                                         │
                                                         ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Vector Store  │◀───│   Supabase       │◀───│   Vector Data   │
│   (pgvector)    │    │   Database       │    │   (1536 dims)   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```
---

### 🔧 การเตรียม Environment

#### 1. ติดตั้ง Dependencies

```bash
npm install @langchain/community @langchain/openai langchain pdf-parse d3-dsv@2
```

**Dependencies สำคัญ:**
- `@langchain/community`: Document loaders และ vector stores
- `@langchain/openai`: OpenAI embeddings
- `langchain`: Core LangChain functionality
- `pdf-parse`: สำหรับการอ่านไฟล์ PDF
- `d3-dsv@2`: สำหรับการอ่านไฟล์ CSV (แก้ไข dsvFormat error)

#### 2. ตั้งค่า Environment Variables

เพิ่มใน `.env`:

```env {.line-numbers}
NODE_ENV=development

# === Supabase config =====
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY=your-supabase-anon-key

# ===  postgres config =====
# การใช้กับ RAG + LangChain + pgvector แนะนำเป็นแบบ Transaction pooler (Shared Pooler)
PG_HOST=your-postgres-host
PG_PORT=6543
PG_USER=your-postgres-user
PG_PASSWORD=your-postgres-password
PG_DATABASE=postgres

# === OPENAI (ChatGPT) =====
OPENAI_API_KEY=your-openai-api-key
OPENAI_MODEL_NAME="gpt-4o-mini"
OPENAI_EMBEDDING_MODEL_NAME="text-embedding-3-small"
```
---

### 🗄️ การตั้งค่า Supabase Database

> 💡 **สำคัญ**: ให้รัน SQL commands ทีละ step เพื่อตรวจสอบว่าแต่ละขั้นตอนสำเร็จก่อนดำเนินการต่อ

#### Step 1: เปิดใช้งาน pgvector Extension

เข้าไปที่ Supabase Dashboard > SQL Editor และรันคำสั่ง:

```sql {.line-numbers}
-- เปิดใช้งาน pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;
```

#### Step 2: สร้างตาราง documents

```sql {.line-numbers}
-- สร้างตารางสำหรับเก็บ documents และ embeddings
CREATE TABLE documents (
  id BIGSERIAL PRIMARY KEY,
  content TEXT NOT NULL,
  metadata JSONB,
  embedding VECTOR(1536) -- ขนาด 1536 dimensions สำหรับ OpenAI text-embedding-3-small
);
```

#### Step 3: สร้าง Index สำหรับการค้นหา

```sql {.line-numbers}
-- สร้าง index สำหรับการค้นหา vector แบบ cosine similarity
CREATE INDEX ON documents
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- สร้าง index สำหรับ metadata เพื่อการค้นหาที่เร็วขึ้น
CREATE INDEX idx_documents_metadata
ON documents USING GIN (metadata);

-- สร้าง index สำหรับ content search (ใช้ 'simple' แทน 'thai')
CREATE INDEX idx_documents_content
ON documents USING gin(to_tsvector('simple', content));
```
> ⚠️ **หมายเหตุ**: ใช้ `'simple'` แทน `'thai'` เพราะ Supabase ไม่รองรับ Thai text search configuration โดยค่าเริ่มต้น

#### Step 4: สร้าง RPC Function สำหรับการค้นหา
> RPC (Remote Procedure Call) function นี้จะช่วยให้เราสามารถค้นหาเอกสารที่มีความคล้ายคลึงกับ embedding ที่เราส่งเข้าไปได้

```sql {.line-numbers}
-- สร้าง function สำหรับ similarity search
CREATE OR REPLACE FUNCTION match_documents(
  filter jsonb,
  match_count int,
  query_embedding vector(1536)
)
RETURNS TABLE (
  id BIGINT,
  content TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE SQL STABLE
AS $$
  select
    d.id,
    d.content,
    d.metadata,
    1 - (d.embedding <=> query_embedding) as similarity  -- distance -> similarity
  from public.documents d
  where (filter is null or filter = '{}'::jsonb or d.metadata @> filter)
  order by d.embedding <=> query_embedding
  limit match_count;
$$;
```
> 💡 **หมายเหตุ**: ฟังก์ชันนี้ใช้ `@>` operator เพื่อกรองข้อมูลตาม metadata ที่ส่งเข้ามา

#### Step 5: ให้สิทธิ์เรียกใช้ RPC Function

```sql {.line-numbers}
-- ให้สิทธิ์เรียกใช้ RPC (สำคัญ)
grant execute on function public.match_documents(jsonb, int, vector) to anon, authenticated;
```

#### Step 6: ตั้งค่า Row Level Security (RLS)

```sql {.line-numbers}
-- เปิดใช้งาน RLS
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- สร้าง policy สำหรับการเข้าถึงข้อมูล
CREATE POLICY "Enable read access for all users" 
ON documents FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" 
ON documents FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable delete for authenticated users" 
ON documents FOR DELETE USING (true);
```

#### Step 7: ตั้งค่า Performance (Optional)

```sql {.line-numbers}
-- เพิ่มประสิทธิภาพ database
ALTER SYSTEM SET max_connections = 200;
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
```

---

#### สร้าง Branch ใหม่
```bash
git add .
git commit -m "Finish tool calling"
git checkout -b 08-document-loader-embedding-pgvector
```

### 📁 การเตรียมโครงสร้างโปรเจ็กต์
#### 1. สร้างโครงสร้างโฟลเดอร์

```
aichatbot-langchain-nextjs
├── data
│   ├── pdf
│   │   ├── product.pdf          # ข้อมูลสินค้า
│   ├── text_csv/
│   │   ├── information.txt      # ข้อมูลร้าน
│   │   ├── product.csv          # ข้อมูลสินค้า
│   └── (ไฟล์อื่นๆ)
├── src/app/api
│   └── document_loader_embeding_pgvector
│       └── text_csv
│           └── route.ts         # API สำหรับโหลด CSV/TXT/JSON
│       └── text_csv_pdf
│           └── route.ts         # API สำหรับโหลด PDF

```

#### 2. เตรียมข้อมูลตัวอย่าง

#### `data/text_csv/information.txt`
```
ชื่อร้าน: เทคโนโลยี สมาร์ท สโตร์
ที่อยู่: 123 ถนนเทคโนโลยี แขวงนวัตกรรม เขตดิจิทัล กรุงเทพมหานคร 10400
โทรศัพท์: 02-123-4567
...
```

#### `data/text_csv/product.csv`
```csv
id,pid,name,description,price,stock,category,image_url
1,P001,Running Shoes,รองเท้าวิ่งน้ำหนักเบา รองรับแรงกระแทก เหมาะกับการวิ่งระยะไกล,2590,156,Sports,/images/p1.png
2,P002,Training Shoes,รองเท้าฝึกซ้อมในยิม พื้นยึดเกาะดี ระบายอากาศ,2390,89,Sports,/images/p2.png
3,P003,Football Boots,รองเท้าสตั๊ดสำหรับสนามหญ้า เกาะพื้นดี ยิงแม่นยำ,3290,34,Sports,/images/p3.png
...
```

#### 3. สร้าง API สำหรับโหลดเอกสาร
#### สร้าง API สำหรับโหลดเอกสาร TXT และ CSV
สร้างไฟล์ `src/app/api/document_loader_embeding_pgvector/text_csv/route.ts` สำหรับโหลดไฟล์ TXT และ CSV

```typescript {.line-numbers}
/**
 * ===============================================
 * Document Loader, Embedding & PGVector API
 * ===============================================
 * 
 * ฟีเจอร์หลัก:
 * - โหลดและประมวลผลเอกสารจากโฟลเดอร์ data/
 * - แปลงเอกสารเป็น embeddings ด้วย OpenAI
 * - เก็บใน Supabase Vector Store (pgvector)
 * - รองรับไฟล์ .txt และ .csv
 * - Text splitting สำหรับ chunk ขนาดเหมาะสม
 * - ป้องกันข้อมูลซ้ำซ้อนด้วยการลบข้อมูลเก่าก่อนโหลดใหม่
 * 
 * API Endpoints:
 * - GET: โหลดเอกสารและสร้าง embeddings (ลบข้อมูลเก่าก่อนโหลดใหม่)
 * - POST: ค้นหาเอกสารที่คล้ายกันด้วย similarity search
 * - PUT: ดูสถิติข้อมูลใน vector store
 * - DELETE: ลบข้อมูลทั้งหมดใน vector store
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/server"

// LangChain & AI SDK Imports
import { DirectoryLoader } from "langchain/document_loaders/fs/directory"
import { TextLoader } from "langchain/document_loaders/fs/text"
import { CSVLoader } from "@langchain/community/document_loaders/fs/csv"
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters"
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase"
import { OpenAIEmbeddings } from "@langchain/openai"
import { CacheBackedEmbeddings } from "langchain/embeddings/cache_backed"
import { InMemoryStore } from "@langchain/core/stores"

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // เพิ่มเวลาสำหรับการประมวลผล

/**
 * GET API: โหลดเอกสาร สร้าง embeddings และเก็บใน vector store
 */
export async function GET() {
  try {
    console.log("🔄 เริ่มโหลดเอกสารจากโฟลเดอร์ data/...")
    
    // ===============================================
    // Step 0: ตรวจสอบและลบข้อมูลเก่า - Clean Existing Data
    // ===============================================
    const supabase = await createClient();
    
    // ตรวจสอบจำนวนข้อมูลเก่า
    const { count: existingCount } = await supabase
      .from('documents')
      .select('*', { count: 'exact', head: true });

    if (existingCount && existingCount > 0) {
      console.log(`🗑️ พบข้อมูลเก่า ${existingCount} records - ลบข้อมูลเก่าก่อน...`);
      
      const { error: deleteError } = await supabase
        .from('documents')
        .delete()
        .neq('id', 0); // ลบทุกแถว

      if (deleteError) {
        throw new Error(`ไม่สามารถลบข้อมูลเก่าได้: ${deleteError.message}`);
      }
      
      console.log(`✅ ลบข้อมูลเก่า ${existingCount} records สำเร็จ`);
    } else {
      console.log("📋 ไม่พบข้อมูลเก่า - เริ่มโหลดเอกสารใหม่");
    }
    
    // ===============================================
    // Step 1: โหลดเอกสารจากไดเร็กทอรี - Document Loading
    // ===============================================
    const rawDocs = await new DirectoryLoader("./data", {
        ".txt": (path) => new TextLoader(path),
        ".csv": (path) => new CSVLoader(path, {
          column: undefined, // โหลดทุกคอลัมน์
          separator: ",",    // ใช้ comma เป็นตัวแบ่ง
        }),
    }).load();

    console.log(`📄 โหลดเอกสารสำเร็จ: ${rawDocs.length} ไฟล์`)

    if (rawDocs.length === 0) {
      return NextResponse.json({ 
        error: "ไม่พบเอกสารในโฟลเดอร์ data/",
        message: "กรุณาเพิ่มไฟล์ .txt หรือ .csv ในโฟลเดอร์ data/" 
      }, { status: 400 })
    }

    // ===============================================
    // Step 2: แยกเอกสารเป็นชิ้นเล็กๆ (Text Splitting) - Chunking
    // ===============================================
    const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 500,    // เพิ่มขนาด chunk สำหรับข้อมูลที่ซับซ้อนมากขึ้น
        chunkOverlap: 100, // เพิ่ม overlap เพื่อรักษาบริบท
        separators: ["\n\n", "\n", ",", " "], // ตัวแบ่งหลายระดับ
    });

    const chunks = await splitter.splitDocuments(rawDocs);
    console.log(`✂️ แยกเอกสารเป็น ${chunks.length} ชิ้น`)

    // ===============================================
    // Step 3: เตรียม Embeddings และ Vector Store - Initialization
    // ===============================================
    const baseEmbeddings = new OpenAIEmbeddings({ 
      model: process.env.OPENAI_EMBEDDING_MODEL_NAME || 'text-embedding-3-small',
      dimensions: 1536 // กำหนดขนาด embedding คือ 1536 หมายถึงจำนวนมิติของเวกเตอร์
    });

    // สร้าง Cache-backed embeddings เพื่อลดต้นทุนและเพิ่มความเร็ว
    const cacheStore = new InMemoryStore();
    const embeddings = CacheBackedEmbeddings.fromBytesStore(
      baseEmbeddings,
      cacheStore,
      {
        namespace: "document_embeddings" // กำหนด namespace สำหรับ cache
      }
    );

    const vectorStore = new SupabaseVectorStore(embeddings, {
        client: supabase,
        tableName: 'documents',
        queryName: 'match_documents' // ชื่อ function ใน Supabase
    });

    // ===============================================
    // Step 4: เพิ่ม metadata ให้กับแต่ละ chunk - Metadata Enrichment
    // ===============================================
    const chunksWithMetadata = chunks.map((chunk, index) => {
      const source = chunk.metadata.source || 'unknown'
      const filename = source.split('/').pop() || source.split('\\').pop() || 'unknown'
      
      return {
        ...chunk,
        metadata: {
          ...chunk.metadata,
          filename,
          chunk_index: index,
          chunk_size: chunk.pageContent.length,
          timestamp: new Date().toISOString(),
          type: filename.endsWith('.csv') ? 'csv' : 'text'
        }
      }
    })

    // ===============================================
    // Step 5: สร้าง embeddings และเก็บใน vector store - Embeddings Creation
    // ===============================================
    console.log("🔮 สร้าง embeddings และเก็บใน vector store...")
    console.log("⚡ ใช้ CacheBackedEmbeddings เพื่อเพิ่มประสิทธิภาพ")
    
    await vectorStore.addDocuments(chunksWithMetadata);
    
    console.log("✅ สำเร็จ! เก็บข้อมูลใน vector store แล้ว")

    // ===============================================
    // Step 6: สร้างสถิติสำหรับ response - Statistics Creation
    // ===============================================
    // ตรวจสอบจำนวนข้อมูลใหม่ที่เก็บแล้ว
    const { count: newCount } = await supabase
      .from('documents')
      .select('*', { count: 'exact', head: true });

    const stats = {
      previous_records: existingCount || 0,
      new_records: newCount || 0,
      total_documents: rawDocs.length,
      total_chunks: chunks.length,
      files_processed: [...new Set(chunks.map(c => c.metadata.source))].map(source => {
        const filename = source.split('/').pop() || source.split('\\').pop()
        const fileChunks = chunks.filter(c => c.metadata.source === source)
        return {
          filename,
          chunks: fileChunks.length,
          total_chars: fileChunks.reduce((sum, c) => sum + c.pageContent.length, 0)
        }
      }),
      embedding_model: process.env.OPENAI_EMBEDDING_MODEL_NAME || 'text-embedding-3-small',
      vector_dimensions: 1536,
      timestamp: new Date().toISOString()
    }

    return NextResponse.json({ 
      message: `สำเร็จ! ${existingCount ? `ลบข้อมูลเก่า ${existingCount} records และ` : ''}สร้างและเก็บ ${chunks.length} chunks จาก ${rawDocs.length} เอกสาร`,
      stats,
      success: true
    })

  } catch (error) {
    console.error('❌ Error ในการประมวลผลเอกสาร:', error)
    
    return NextResponse.json({ 
      error: 'เกิดข้อผิดพลาดในการประมวลผลเอกสาร',
      details: error instanceof Error ? error.message : 'Unknown error',
      success: false
    }, { status: 500 })
  }
}

/**
 * POST API: ค้นหาเอกสารที่คล้ายกันใน vector store
 */
export async function POST(req: NextRequest) {
  try {
    const { query, limit = 5 } = await req.json()
    
    if (!query) {
      return NextResponse.json({ 
        error: "กรุณาระบุ query สำหรับการค้นหา" 
      }, { status: 400 })
    }

    console.log(`🔍 ค้นหา: "${query}"`)
    console.log("⚡ ใช้ CacheBackedEmbeddings สำหรับการค้นหา")

    // ===============================================
    // Setup Vector Store สำหรับการค้นหา
    // ===============================================
    const supabase = await createClient();
    
    const baseEmbeddings = new OpenAIEmbeddings({ 
      model: process.env.OPENAI_EMBEDDING_MODEL_NAME || 'text-embedding-3-small',
      dimensions: 1536
    });

    // สร้าง Cache-backed embeddings เพื่อลดต้นทุนในการค้นหา
    const cacheStore = new InMemoryStore();
    const embeddings = CacheBackedEmbeddings.fromBytesStore(
      baseEmbeddings,
      cacheStore,
      {
        namespace: "search_embeddings" // กำหนด namespace แยกสำหรับการค้นหา
      }
    );

    const vectorStore = new SupabaseVectorStore(embeddings, {
        client: supabase,
        tableName: 'documents',
        queryName: 'match_documents'
    });

    // ===============================================
    // ค้นหาเอกสารที่คล้ายกัน
    // ===============================================
    const results = await vectorStore.similaritySearchWithScore(query, limit)
    
    console.log(`📋 พบผลลัพธ์: ${results.length} รายการ`)

    // ===============================================
    // จัดรูปแบบผลลัพธ์
    // ===============================================
    const formattedResults = results.map(([doc, score], index) => ({
      rank: index + 1,
      content: doc.pageContent,
      metadata: doc.metadata,
      relevance_score: score
    }))

    return NextResponse.json({
      query,
      results_count: results.length,
      results: formattedResults,
      success: true
    })

  } catch (error) {
    console.error('❌ Error ในการค้นหา:', error)
    
    return NextResponse.json({ 
      error: 'เกิดข้อผิดพลาดในการค้นหา',
      details: error instanceof Error ? error.message : 'Unknown error',
      success: false
    }, { status: 500 })
  }
}

/**
 * DELETE API: ลบข้อมูลทั้งหมดใน vector store
 */
export async function DELETE() {
  try {
    const supabase = await createClient();
    
    // ตรวจสอบจำนวนข้อมูลก่อนลบ
    const { count: existingCount } = await supabase
      .from('documents')
      .select('*', { count: 'exact', head: true });

    if (!existingCount || existingCount === 0) {
      return NextResponse.json({ 
        message: "ไม่พบข้อมูลในฐานข้อมูล - ไม่มีอะไรให้ลบ",
        deleted_records: 0,
        success: true
      })
    }

    console.log(`🗑️ กำลังลบข้อมูล ${existingCount} records...`);
    
    // ลบข้อมูลทั้งหมดในตาราง documents
    const { error } = await supabase
      .from('documents')
      .delete()
      .neq('id', 0) // ลบทุกแถวที่ id ไม่เท่ากับ 0 (ซึ่งคือทุกแถว)

    if (error) {
      throw new Error(error.message)
    }

    console.log(`✅ ลบข้อมูล ${existingCount} records สำเร็จ`)

    return NextResponse.json({ 
      message: `ลบข้อมูลใน vector store สำเร็จ - ลบไป ${existingCount} records`,
      deleted_records: existingCount,
      timestamp: new Date().toISOString(),
      success: true
    })

  } catch (error) {
    console.error('❌ Error ในการลบข้อมูล:', error)
    
    return NextResponse.json({ 
      error: 'เกิดข้อผิดพลาดในการลบข้อมูล',
      details: error instanceof Error ? error.message : 'Unknown error',
      success: false
    }, { status: 500 })
  }
}

/**
 * PUT API: ดูสถิติข้อมูลใน vector store
 */
export async function PUT() {
  try {
    const supabase = await createClient();
    
    // ตรวจสอบจำนวนข้อมูลทั้งหมด
    const { count: totalCount } = await supabase
      .from('documents')
      .select('*', { count: 'exact', head: true });

    if (!totalCount || totalCount === 0) {
      return NextResponse.json({ 
        message: "ไม่พบข้อมูลในฐานข้อมูล",
        stats: {
          total_records: 0,
          files_breakdown: [],
          timestamp: new Date().toISOString()
        },
        success: true
      })
    }

    // ดึงข้อมูล metadata เพื่อสร้างสถิติ
    const { data: documents } = await supabase
      .from('documents')
      .select('metadata')
      .limit(1000); // จำกัดไม่ให้เยอะเกินไป

    
    // กำหนด interface สำหรับ file stats
    interface FileStats {
      filename: string;
      type: string;
      chunks: number;
      total_chars: number;
    }

    const fileStats = documents?.reduce((acc: Record<string, FileStats>, doc) => {
      const filename = doc.metadata?.filename || 'unknown';
      const type = doc.metadata?.type || 'unknown';
      
      if (!acc[filename]) {
        acc[filename] = {
          filename,
          type,
          chunks: 0,
          total_chars: 0
        };
      }
      
      acc[filename].chunks += 1;
      acc[filename].total_chars += doc.metadata?.chunk_size || 0;
      
      return acc;
    }, {}) || {};

    const stats = {
      total_records: totalCount,
      files_breakdown: Object.values(fileStats),
      files_count: Object.keys(fileStats).length,
      timestamp: new Date().toISOString()
    };

    console.log(`📊 สถิติข้อมูล: ${totalCount} records จาก ${Object.keys(fileStats).length} ไฟล์`);

    return NextResponse.json({ 
      message: `พบข้อมูล ${totalCount} records จาก ${Object.keys(fileStats).length} ไฟล์`,
      stats,
      success: true
    })

  } catch (error) {
    console.error('❌ Error ในการดูสถิติข้อมูล:', error)
    
    return NextResponse.json({ 
      error: 'เกิดข้อผิดพลาดในการดูสถิติข้อมูล',
      details: error instanceof Error ? error.message : 'Unknown error',
      success: false
    }, { status: 500 })
  }
}
```

#### สร้าง API สำหรับโหลดเอกสาร TXT, CSV และ PDF

สร้างไฟล์ `src/app/api/document_loader_embeding_pgvector/text_csv_pdf/route.ts` สำหรับโหลดไฟล์  TXT, CSV และ PDF

```typescript {.line-numbers}
/**
 * ===============================================
 * Document Loader, Embedding & PGVector API
 * ===============================================
 * 
 * ฟีเจอร์หลัก:
 * - โหลดและประมวลผลเอกสารจากโฟลเดอร์ data/
 * - แปลงเอกสารเป็น embeddings ด้วย OpenAI
 * - เก็บใน Supabase Vector Store (pgvector)
 * - รองรับไฟล์ .pdf, .txt และ .csv
 * - Text splitting สำหรับ chunk ขนาดเหมาะสม
 * - ป้องกันข้อมูลซ้ำซ้อนด้วยการลบข้อมูลเก่าก่อนโหลดใหม่
 * 
 * API Endpoints:
 * - GET: โหลดเอกสารและสร้าง embeddings (ลบข้อมูลเก่าก่อนโหลดใหม่)
 * - POST: ค้นหาเอกสารที่คล้ายกันด้วย similarity search
 * - PUT: ดูสถิติข้อมูลใน vector store
 * - DELETE: ลบข้อมูลทั้งหมดใน vector store
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/server"

// LangChain & AI SDK Imports
import { DirectoryLoader } from "langchain/document_loaders/fs/directory"
import { TextLoader } from "langchain/document_loaders/fs/text"
import { CSVLoader } from "@langchain/community/document_loaders/fs/csv"
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf"
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters"
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase"
import { OpenAIEmbeddings } from "@langchain/openai"
import { CacheBackedEmbeddings } from "langchain/embeddings/cache_backed"
import { InMemoryStore } from "@langchain/core/stores"

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // เพิ่มเวลาสำหรับการประมวลผล

/**
 * GET API: โหลดเอกสาร สร้าง embeddings และเก็บใน vector ญยstore
 */
export async function GET() {
  try {
    console.log("🔄 เริ่มโหลดเอกสารจากโฟลเดอร์ data/...")
    
    // ===============================================
    // Step 0: ตรวจสอบและลบข้อมูลเก่า - Clean Existing Data
    // ===============================================
    const supabase = await createClient();
    
    // ตรวจสอบจำนวนข้อมูลเก่า
    const { count: existingCount } = await supabase
      .from('documents')
      .select('*', { count: 'exact', head: true });

    if (existingCount && existingCount > 0) {
      console.log(`🗑️ พบข้อมูลเก่า ${existingCount} records - ลบข้อมูลเก่าก่อน...`);
      
      const { error: deleteError } = await supabase
        .from('documents')
        .delete()
        .neq('id', 0); // ลบทุกแถว

      if (deleteError) {
        throw new Error(`ไม่สามารถลบข้อมูลเก่าได้: ${deleteError.message}`);
      }
      
      console.log(`✅ ลบข้อมูลเก่า ${existingCount} records สำเร็จ`);
    } else {
      console.log("📋 ไม่พบข้อมูลเก่า - เริ่มโหลดเอกสารใหม่");
    }
    
    // ===============================================
    // Step 1: โหลดเอกสารจากไดเร็กทอรี - Document Loading
    // ===============================================
    const rawDocs = await new DirectoryLoader("./data", {
        ".txt": (path) => new TextLoader(path),
        ".csv": (path) => new CSVLoader(path, {
          column: undefined, // โหลดทุกคอลัมน์
          separator: ",",    // ใช้ comma เป็นตัวแบ่ง
        }),
        ".pdf": (path) => new PDFLoader(path, {
          splitPages: false, // ไม่แยกหน้า ให้เป็น document เดียว
          parsedItemSeparator: "\n" // ใช้ \n เป็นตัวแบ่งระหว่าง parsed items
        }),
    }).load();

    console.log(`📄 โหลดเอกสารสำเร็จ: ${rawDocs.length} ไฟล์`)
    
    // ===============================================
    // Thai Text Processing สำหรับไฟล์ PDF เท่านั้น - การทำความสะอาดข้อความไทยแบบง่าย
    // ===============================================
    const processedDocs = rawDocs.map(doc => {
      const source = doc.metadata.source || '';
      const isPdfFile = source.toLowerCase().endsWith('.pdf');
      
      // ใช้การทำความสะอาดข้อความไทยเฉพาะกับไฟล์ PDF
      if (isPdfFile) {
        console.log(`🔧 ทำความสะอาดข้อความภาษาไทยสำหรับ: ${source}`);
        
        // การทำความสะอาดข้อความไทยแบบง่าย
        let cleanedContent = doc.pageContent;
        
        // 1. รวมตัวอักษรไทยที่ถูกแยกด้วยช่องว่าง เช่น "แ ล็ ป ท็ อ ป" -> "แล็ปท็อป"
        cleanedContent = cleanedContent.replace(/([ก-๙])\s+([ก-๙])/g, '$1$2');
        
        // 2. รวมตัวเลขที่ถูกแยกด้วยช่องว่าง เช่น "7 9 9 0 0 1 5" -> "7990015"
        cleanedContent = cleanedContent.replace(/(\d)\s+(\d)/g, '$1$2');
        
        // 3. รวมตัวอักษรภาษาอังกฤษที่ถูกแยกด้วยช่องว่าง เช่น "C o m p u t e r" -> "Computer"
        cleanedContent = cleanedContent.replace(/([A-Za-z])\s+([A-Za-z])/g, '$1$2');
        
        // 4. ทำซ้ำอีกครั้งเพื่อจับคำที่ยาวๆ
        for (let i = 0; i < 3; i++) {
          cleanedContent = cleanedContent.replace(/([ก-๙])\s+([ก-๙])/g, '$1$2');
          cleanedContent = cleanedContent.replace(/(\d)\s+(\d)/g, '$1$2');
          cleanedContent = cleanedContent.replace(/([A-Za-z])\s+([A-Za-z])/g, '$1$2');
        }
        
        // 5. เพิ่มช่องว่างระหว่างคำที่ควรแยก
        // เพิ่มช่องว่างระหว่างตัวเลขกับตัวอักษร
        cleanedContent = cleanedContent.replace(/(\d)([A-Za-zก-๙])/g, '$1 $2');
        cleanedContent = cleanedContent.replace(/([A-Za-zก-๙])(\d)/g, '$1 $2');
        
        // เพิ่มช่องว่างระหว่างคำภาษาอังกฤษที่ติดกัน (uppercase letters)
        cleanedContent = cleanedContent.replace(/([a-z])([A-Z])/g, '$1 $2');
        
        // 6. ลบช่องว่างที่ซ้ำซ้อน
        cleanedContent = cleanedContent.replace(/\s+/g, ' ');
        
        // 7. ลบช่องว่างหน้าและหลังประโยค
        cleanedContent = cleanedContent.trim();
        
        return {
          ...doc,
          pageContent: cleanedContent
        };
      }
      
      // ไฟล์อื่นๆ ใช้ข้อความต้นฉบับ
      return doc;
    });
    
    // แสดงตัวอย่างข้อความหลังการแก้ไข
    if (processedDocs.length > 0) {
      const firstDoc = processedDocs[0];
      const preview = firstDoc.pageContent.substring(0, 200);
      const isPdf = (firstDoc.metadata.source || '').toLowerCase().endsWith('.pdf');
      console.log(`📋 ตัวอย่างข้อความ${isPdf ? 'หลังแก้ไข' : ''} (200 ตัวอักษรแรก): ${preview}`);
      console.log(`📁 ไฟล์: ${firstDoc.metadata.source}`);
    }

    if (rawDocs.length === 0) {
      return NextResponse.json({ 
        error: "ไม่พบเอกสารในโฟลเดอร์ data/",
        message: "กรุณาเพิ่มไฟล์ .txt, .csv หรือ .pdf ในโฟลเดอร์ data/" 
      }, { status: 400 })
    }

    // ===============================================
    // Step 2: แยกเอกสารเป็นชิ้นเล็กๆ (Text Splitting) - Chunking
    // ===============================================
    const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,   // เพิ่มขนาด chunk สำหรับ PDF ที่มีข้อความยาว
        chunkOverlap: 200, // เพิ่ม overlap เพื่อรักษาบริบทของ PDF
        separators: ["\n\n", "\n", ".", "!", "?", ",", " "], // ตัวแบ่งหลายระดับสำหรับ PDF
    });

    const chunks = await splitter.splitDocuments(processedDocs);
    console.log(`✂️ แยกเอกสารเป็น ${chunks.length} ชิ้น`)

    // ===============================================
    // Step 3: เตรียม Embeddings และ Vector Store - Initialization
    // ===============================================
    const baseEmbeddings = new OpenAIEmbeddings({ 
      model: process.env.OPENAI_EMBEDDING_MODEL_NAME || 'text-embedding-3-small',
      dimensions: 1536 // กำหนดขนาด embedding คือ 1536 หมายถึงจำนวนมิติของเวกเตอร์
    });

    // สร้าง Cache-backed embeddings เพื่อลดต้นทุนและเพิ่มความเร็ว
    const cacheStore = new InMemoryStore();
    const embeddings = CacheBackedEmbeddings.fromBytesStore(
      baseEmbeddings,
      cacheStore,
      {
        namespace: "document_embeddings" // กำหนด namespace สำหรับ cache
      }
    );

    const vectorStore = new SupabaseVectorStore(embeddings, {
        client: supabase,
        tableName: 'documents',
        queryName: 'match_documents' // ชื่อ function ใน Supabase
    });

    // ===============================================
    // Step 4: เพิ่ม metadata ให้กับแต่ละ chunk - Metadata Enrichment
    // ===============================================
    const chunksWithMetadata = chunks.map((chunk, index) => {
      const source = chunk.metadata.source || 'unknown'
      const filename = source.split('/').pop() || source.split('\\').pop() || 'unknown'
      
      // กำหนด type ตาม file extension
      let fileType = 'text';
      if (filename.endsWith('.csv')) {
        fileType = 'csv';
      } else if (filename.endsWith('.pdf')) {
        fileType = 'pdf';
      } else if (filename.endsWith('.txt')) {
        fileType = 'text';
      }
      
      return {
        ...chunk,
        metadata: {
          ...chunk.metadata,
          filename,
          chunk_index: index,
          chunk_size: chunk.pageContent.length,
          timestamp: new Date().toISOString(),
          type: fileType
        }
      }
    })

    // ===============================================
    // Step 5: สร้าง embeddings และเก็บใน vector store - Embeddings Creation
    // ===============================================
    console.log("🔮 สร้าง embeddings และเก็บใน vector store...")
    console.log("⚡ ใช้ CacheBackedEmbeddings เพื่อเพิ่มประสิทธิภาพ")
    
    await vectorStore.addDocuments(chunksWithMetadata);
    
    console.log("✅ สำเร็จ! เก็บข้อมูลใน vector store แล้ว")

    // ===============================================
    // Step 6: สร้างสถิติสำหรับ response - Statistics Creation
    // ===============================================
    // ตรวจสอบจำนวนข้อมูลใหม่ที่เก็บแล้ว
    const { count: newCount } = await supabase
      .from('documents')
      .select('*', { count: 'exact', head: true });

    const stats = {
      previous_records: existingCount || 0,
      new_records: newCount || 0,
      total_documents: rawDocs.length,
      total_chunks: chunks.length,
      files_processed: [...new Set(chunks.map(c => c.metadata.source))].map(source => {
        const filename = source.split('/').pop() || source.split('\\').pop()
        const fileChunks = chunks.filter(c => c.metadata.source === source)
        return {
          filename,
          chunks: fileChunks.length,
          total_chars: fileChunks.reduce((sum, c) => sum + c.pageContent.length, 0)
        }
      }),
      embedding_model: process.env.OPENAI_EMBEDDING_MODEL_NAME || 'text-embedding-3-small',
      vector_dimensions: 1536,
      timestamp: new Date().toISOString()
    }

    return NextResponse.json({ 
      message: `สำเร็จ! ${existingCount ? `ลบข้อมูลเก่า ${existingCount} records และ` : ''}สร้างและเก็บ ${chunks.length} chunks จาก ${rawDocs.length} เอกสาร`,
      stats,
      success: true
    })

  } catch (error) {
    console.error('❌ Error ในการประมวลผลเอกสาร:', error)
    
    return NextResponse.json({ 
      error: 'เกิดข้อผิดพลาดในการประมวลผลเอกสาร',
      details: error instanceof Error ? error.message : 'Unknown error',
      success: false
    }, { status: 500 })
  }
}

/**
 * POST API: ค้นหาเอกสารที่คล้ายกันใน vector store
 */
export async function POST(req: NextRequest) {
  try {
    const { query, limit = 5 } = await req.json()
    
    if (!query) {
      return NextResponse.json({ 
        error: "กรุณาระบุ query สำหรับการค้นหา" 
      }, { status: 400 })
    }

    console.log(`🔍 ค้นหา: "${query}"`)
    console.log("⚡ ใช้ CacheBackedEmbeddings สำหรับการค้นหา")

    // ===============================================
    // Setup Vector Store สำหรับการค้นหา
    // ===============================================
    const supabase = await createClient();
    
    const baseEmbeddings = new OpenAIEmbeddings({ 
      model: process.env.OPENAI_EMBEDDING_MODEL_NAME || 'text-embedding-3-small',
      dimensions: 1536
    });

    // สร้าง Cache-backed embeddings เพื่อลดต้นทุนในการค้นหา
    const cacheStore = new InMemoryStore();
    const embeddings = CacheBackedEmbeddings.fromBytesStore(
      baseEmbeddings,
      cacheStore,
      {
        namespace: "search_embeddings" // กำหนด namespace แยกสำหรับการค้นหา
      }
    );

    const vectorStore = new SupabaseVectorStore(embeddings, {
        client: supabase,
        tableName: 'documents',
        queryName: 'match_documents'
    });

    // ===============================================
    // ค้นหาเอกสารที่คล้ายกัน
    // ===============================================
    const results = await vectorStore.similaritySearchWithScore(query, limit)
    
    console.log(`📋 พบผลลัพธ์: ${results.length} รายการ`)

    // ===============================================
    // จัดรูปแบบผลลัพธ์
    // ===============================================
    const formattedResults = results.map(([doc, score], index) => ({
      rank: index + 1,
      content: doc.pageContent,
      metadata: doc.metadata,
      relevance_score: score
    }))

    return NextResponse.json({
      query,
      results_count: results.length,
      results: formattedResults,
      success: true
    })

  } catch (error) {
    console.error('❌ Error ในการค้นหา:', error)
    
    return NextResponse.json({ 
      error: 'เกิดข้อผิดพลาดในการค้นหา',
      details: error instanceof Error ? error.message : 'Unknown error',
      success: false
    }, { status: 500 })
  }
}

/**
 * DELETE API: ลบข้อมูลทั้งหมดใน vector store
 */
export async function DELETE() {
  try {
    const supabase = await createClient();
    
    // ตรวจสอบจำนวนข้อมูลก่อนลบ
    const { count: existingCount } = await supabase
      .from('documents')
      .select('*', { count: 'exact', head: true });

    if (!existingCount || existingCount === 0) {
      return NextResponse.json({ 
        message: "ไม่พบข้อมูลในฐานข้อมูล - ไม่มีอะไรให้ลบ",
        deleted_records: 0,
        success: true
      })
    }

    console.log(`🗑️ กำลังลบข้อมูล ${existingCount} records...`);
    
    // ลบข้อมูลทั้งหมดในตาราง documents
    const { error } = await supabase
      .from('documents')
      .delete()
      .neq('id', 0) // ลบทุกแถวที่ id ไม่เท่ากับ 0 (ซึ่งคือทุกแถว)

    if (error) {
      throw new Error(error.message)
    }

    console.log(`✅ ลบข้อมูล ${existingCount} records สำเร็จ`)

    return NextResponse.json({ 
      message: `ลบข้อมูลใน vector store สำเร็จ - ลบไป ${existingCount} records`,
      deleted_records: existingCount,
      timestamp: new Date().toISOString(),
      success: true
    })

  } catch (error) {
    console.error('❌ Error ในการลบข้อมูล:', error)
    
    return NextResponse.json({ 
      error: 'เกิดข้อผิดพลาดในการลบข้อมูล',
      details: error instanceof Error ? error.message : 'Unknown error',
      success: false
    }, { status: 500 })
  }
}

/**
 * PUT API: ดูสถิติข้อมูลใน vector store
 */
export async function PUT() {
  try {
    const supabase = await createClient();
    
    // ตรวจสอบจำนวนข้อมูลทั้งหมด
    const { count: totalCount } = await supabase
      .from('documents')
      .select('*', { count: 'exact', head: true });

    if (!totalCount || totalCount === 0) {
      return NextResponse.json({ 
        message: "ไม่พบข้อมูลในฐานข้อมูล",
        stats: {
          total_records: 0,
          files_breakdown: [],
          timestamp: new Date().toISOString()
        },
        success: true
      })
    }

    // ดึงข้อมูล metadata เพื่อสร้างสถิติ
    const { data: documents } = await supabase
      .from('documents')
      .select('metadata')
      .limit(1000); // จำกัดไม่ให้เยอะเกินไป

    
    // กำหนด interface สำหรับ file stats
    interface FileStats {
      filename: string;
      type: string;
      chunks: number;
      total_chars: number;
    }

    const fileStats = documents?.reduce((acc: Record<string, FileStats>, doc) => {
      const filename = doc.metadata?.filename || 'unknown';
      const type = doc.metadata?.type || 'unknown';
      
      if (!acc[filename]) {
        acc[filename] = {
          filename,
          type,
          chunks: 0,
          total_chars: 0
        };
      }
      
      acc[filename].chunks += 1;
      acc[filename].total_chars += doc.metadata?.chunk_size || 0;
      
      return acc;
    }, {}) || {};

    const stats = {
      total_records: totalCount,
      files_breakdown: Object.values(fileStats),
      files_count: Object.keys(fileStats).length,
      timestamp: new Date().toISOString()
    };

    console.log(`📊 สถิติข้อมูล: ${totalCount} records จาก ${Object.keys(fileStats).length} ไฟล์`);

    return NextResponse.json({ 
      message: `พบข้อมูล ${totalCount} records จาก ${Object.keys(fileStats).length} ไฟล์`,
      stats,
      success: true
    })

  } catch (error) {
    console.error('❌ Error ในการดูสถิติข้อมูล:', error)
    
    return NextResponse.json({ 
      error: 'เกิดข้อผิดพลาดในการดูสถิติข้อมูล',
      details: error instanceof Error ? error.message : 'Unknown error',
      success: false
    }, { status: 500 })
  }
}
```


### 🚀 การใช้งาน API

#### API Endpoints สำหรับ Text + CSV และ Text + CSV + PDF

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/document_loader_embeding_pgvector/text_csv` | โหลดเอกสารและสร้าง embeddings (ลบข้อมูลเก่าก่อนอัตโนมัติ) |
| GET | `/api/document_loader_embeding_pgvector/text_csv_pdf` | โหลดเอกสาร (รวม PDF) และสร้าง embeddings (ลบข้อมูลเก่าก่อนอัตโนมัติ) |
| POST | `/api/document_loader_embeding_pgvector/text_csv` | ค้นหาเอกสารที่คล้ายกัน |
| POST | `/api/document_loader_embeding_pgvector/text_csv_pdf` | ค้นหาเอกสารที่คล้ายกัน (รวม PDF) |
| PUT | `/api/document_loader_embeding_pgvector/text_csv` | ดูสถิติข้อมูลใน vector store |
| PUT | `/api/document_loader_embeding_pgvector/text_csv_pdf` | ดูสถิติข้อมูลใน vector store (รวม PDF) |
| DELETE | `/api/document_loader_embeding_pgvector/text_csv` | ลบข้อมูลทั้งหมด |
| DELETE | `/api/document_loader_embeding_pgvector/text_csv_pdf` | ลบข้อมูลทั้งหมด (รวม PDF) |

#### 1. โหลดเอกสารและสร้าง Embeddings (ป้องกันข้อมูลซ้ำ)

**Linux/macOS:**
```bash
# Text + CSV
curl -X GET http://localhost:3000/api/document_loader_embeding_pgvector/text_csv

# Text + CSV + PDF
curl -X GET http://localhost:3000/api/document_loader_embeding_pgvector/text_csv_pdf
```

**Windows PowerShell:**
```powershell
# Text + CSV
Invoke-RestMethod -Uri "http://localhost:3000/api/document_loader_embeding_pgvector/text_csv" -Method GET

# Text + CSV + PDF
Invoke-RestMethod -Uri "http://localhost:3000/api/document_loader_embeding_pgvector/text_csv_pdf" -Method GET
```

**ฟีเจอร์ป้องกันข้อมูลซ้ำ:**
- ✅ ตรวจสอบและลบข้อมูลเก่าอัตโนมัติก่อนโหลดใหม่
- ✅ แสดงจำนวนข้อมูลที่ลบและเพิ่มใหม่
- ✅ ป้องกันผลลัพธ์ซ้ำซ้อนในการค้นหา

**Response (ครั้งแรก):**
```json
{
  "message": "สำเร็จ! สร้างและเก็บ 45 chunks จาก 3 เอกสาร",
  "stats": {
    "previous_records": 0,
    "new_records": 45,
    "total_documents": 3,
    "total_chunks": 45,
    "files_processed": [
      {
        "filename": "information.txt",
        "chunks": 12,
        "total_chars": 2456
      },
      {
        "filename": "product.csv",
        "chunks": 18,
        "total_chars": 3210
      },
      {
        "filename": "sale.csv",
        "chunks": 15,
        "total_chars": 2890
      }
    ],
    "embedding_model": "text-embedding-3-small",
    "vector_dimensions": 1536,
    "timestamp": "2024-12-15T10:30:45.123Z"
  },
  "success": true
}
```

**Response (เรียกซ้ำ):**
```json
{
  "message": "สำเร็จ! ลบข้อมูลเก่า 45 records และสร้างและเก็บ 45 chunks จาก 3 เอกสาร",
  "stats": {
    "previous_records": 45,
    "new_records": 45,
    "total_documents": 3,
    "total_chunks": 45,
    "files_processed": [...]
  },
  "success": true
}
```
#### 2. ค้นหาเอกสารที่เกี่ยวข้อง

**Linux/macOS:**
```bash

# Text + CSV

curl -X POST http://localhost:3000/api/document_loader_embeding_pgvector/text_csv \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Gaming Mouse ราคา",
    "limit": 5
  }'

# Text + CSV + PDF
curl -X POST http://localhost:3000/api/document_loader_embeding_pgvector/text_csv_pdf \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Gaming Mouse ราคา",
    "limit": 5
  }'
```

**Windows PowerShell:**
```powershell

# Text + CSV

$body = @{
    query = "Gaming Mouse ราคา"
    limit = 5
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/document_loader_embeding_pgvector/text_csv" `
  -Method POST `
  -ContentType "application/json" `
  -Body $body

# Text + CSV + PDF

$body = @{
    query = "Gaming Mouse ราคา"
    limit = 5
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/document_loader_embeding_pgvector/text_csv_pdf" `
  -Method POST `
  -ContentType "application/json" `
  -Body $body
```

**Response:**
```json
{
  "query": "Gaming Mouse ราคา",
  "results_count": 3,
  "results": [
    {
      "rank": 1,
      "content": "2,Gaming Mouse,แล็ปท็อปสำหรับงานหนัก พร้อม M3 chip,89900,8,laptop",
      "metadata": {
        "filename": "product.csv",
        "type": "csv",
        "chunk_index": 5,
        "similarity": 0.89
      },
      "relevance_score": 0.89
    }
  ],
  "success": true
}
```

#### 3. ดูสถิติข้อมูลใน Vector Store (ใหม่!)

**Linux/macOS:**
```bash

# Text + CSV

curl -X PUT http://localhost:3000/api/document_loader_embeding_pgvector/text_csv

# Text + CSV + PDF
curl -X PUT http://localhost:3000/api/document_loader_embeding_pgvector/text_csv_pdf

```

**Windows PowerShell:**
```powershell
# Text + CSV

Invoke-RestMethod -Uri "http://localhost:3000/api/document_loader_embeding_pgvector/text_csv" -Method PUT

# Text + CSV + PDF
Invoke-RestMethod -Uri "http://localhost:3000/api/document_loader_embeding_pgvector/text_csv_pdf" -Method PUT

```

**Response:**
```json
{
  "message": "พบข้อมูล 45 records จาก 3 ไฟล์",
  "stats": {
    "total_records": 45,
    "files_breakdown": [
      {
        "filename": "information.txt",
        "type": "text",
        "chunks": 12,
        "total_chars": 2456
      },
      {
        "filename": "product.csv",
        "type": "csv",
        "chunks": 18,
        "total_chars": 3210
      },
      {
        "filename": "sale.csv",
        "type": "csv",
        "chunks": 15,
        "total_chars": 2890
      }
    ],
    "files_count": 3,
    "timestamp": "2024-12-15T10:35:20.789Z"
  },
  "success": true
}
```

#### 4. ลบข้อมูลทั้งหมด (ปรับปรุงแล้ว)

**Linux/macOS:**
```bash

# Text + CSV
curl -X DELETE http://localhost:3000/api/document_loader_embeding_pgvector/text_csv

# Text + CSV + PDF
curl -X DELETE http://localhost:3000/api/document_loader_embeding_pgvector/text_csv_pdf

```

**Windows PowerShell:**
```powershell
# Text + CSV
Invoke-RestMethod -Uri "http://localhost:3000/api/document_loader_embeding_pgvector/text_csv" -Method DELETE

# Text + CSV + PDF
Invoke-RestMethod -Uri "http://localhost:3000/api/document_loader_embeding_pgvector/text_csv_pdf" -Method DELETE
```

**Response (มีข้อมูล):**
```json
{
  "message": "ลบข้อมูลใน vector store สำเร็จ - ลบไป 45 records",
  "deleted_records": 45,
  "timestamp": "2024-12-15T10:40:15.123Z",
  "success": true
}
```

**Response (ไม่มีข้อมูล):**
```json
{
  "message": "ไม่พบข้อมูลในฐานข้อมูล - ไม่มีอะไรให้ลบ",
  "deleted_records": 0,
  "success": true
}
```

### 🎯 **ตัวอย่างสถานการณ์จริง:**

#### **สถานการณ์ที่ 1: อัปเดตราคาสินค้า**

**Linux/macOS:**
```bash
# 1. แก้ไข product.csv: Gaming Mouse จาก 89,900 → 79,900 บาท
# 2. เรียก GET API เพื่ออัปเดต embeddings
curl -X GET http://localhost:3000/api/document_loader_embeding_pgvector/text_csv

# 3. ทดสอบการค้นหา
curl -X POST http://localhost:3000/api/document_loader_embeding_pgvector/text_csv \
  -H "Content-Type: application/json" \
  -d '{"query": "Gaming Mouse ราคา", "limit": 3}'
```

**Windows PowerShell:**
```powershell
# 1. แก้ไข product.csv: Gaming Mouse จาก 89,900 → 79,900 บาท
# 2. เรียก GET API เพื่ออัปเดต embeddings
Invoke-RestMethod -Uri "http://localhost:3000/api/document_loader_embeding_pgvector/text_csv" -Method GET

# 3. ทดสอบการค้นหา
$body = @{ query = "Gaming Mouse ราคา"; limit = 3 } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:3000/api/document_loader_embeding_pgvector/text_csv" `
  -Method POST -ContentType "application/json" -Body $body
```

#### **สถานการณ์ที่ 2: เพิ่มสินค้าใหม่**

**Linux/macOS:**
```bash
# 1. เพิ่มสินค้าใหม่ใน product.csv
# 2. เรียก GET API เพื่อโหลดข้อมูลใหม่
curl -X GET http://localhost:3000/api/document_loader_embeding_pgvector/text_csv

# 3. ตรวจสอบสถิติ
curl -X PUT http://localhost:3000/api/document_loader_embeding_pgvector/text_csv
```

**Windows PowerShell:**
```powershell
# 1. เพิ่มสินค้าใหม่ใน product.csv
# 2. เรียก GET API เพื่อโหลดข้อมูลใหม่
Invoke-RestMethod -Uri "http://localhost:3000/api/document_loader_embeding_pgvector/text_csv" -Method GET

# 3. ตรวจสอบสถิติ
Invoke-RestMethod -Uri "http://localhost:3000/api/document_loader_embeding_pgvector/text_csv" -Method PUT
```

---

### 🧪 การทดสอบระบบ

#### 1. ตรวจสอบการโหลดเอกสาร

**Linux/macOS:**
```bash
# ตรวจสอบว่ามีไฟล์ในโฟลเดอร์ data/ หรือไม่
ls ./data/text_csv/

# ทดสอบ API โหลดเอกสาร
curl -X GET http://localhost:3000/api/document_loader_embeding_pgvector/text_csv
```

**Windows PowerShell:**
```powershell
# ตรวจสอบว่ามีไฟล์ในโฟลเดอร์ data/ หรือไม่
Get-ChildItem .\data\text_csv\

# ทดสอบ API โหลดเอกสาร
Invoke-RestMethod -Uri "http://localhost:3000/api/document_loader_embeding_pgvector/text_csv" -Method GET
```

#### 2. ทดสอบการค้นหา

**Linux/macOS:**
```bash
# ค้นหาข้อมูลสินค้า
curl -X POST http://localhost:3000/api/document_loader_embeding_pgvector/text_csv \
  -H "Content-Type: application/json" \
  -d '{"query": "Smartwatch ราคา", "limit": 3}'

# ค้นหาข้อมูลร้าน
curl -X POST http://localhost:3000/api/document_loader_embeding_pgvector/text_csv \
  -H "Content-Type: application/json" \
  -d '{"query": "ที่อยู่ร้าน เบอร์โทร", "limit": 2}'

# ค้นหาข้อมูลการขาย
curl -X POST http://localhost:3000/api/document_loader_embeding_pgvector/text_csv \
  -H "Content-Type: application/json" \
  -d '{"query": "ยอดขาย ธันวาคม", "limit": 5}'
```

**Windows PowerShell:**
```powershell
# ค้นหาข้อมูลสินค้า
$body1 = @{ query = "Smartwatch ราคา"; limit = 3 } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:3000/api/document_loader_embeding_pgvector/text_csv" `
  -Method POST -ContentType "application/json" -Body $body1

# ค้นหาข้อมูลร้าน
$body2 = @{ query = "ที่อยู่ร้าน เบอร์โทร"; limit = 2 } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:3000/api/document_loader_embeding_pgvector/text_csv" `
  -Method POST -ContentType "application/json" -Body $body2

# ค้นหาข้อมูลการขาย
$body3 = @{ query = "ยอดขาย ธันวาคม"; limit = 5 } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:3000/api/document_loader_embeding_pgvector/text_csv" `
  -Method POST -ContentType "application/json" -Body $body3
```

#### 3. ทดสอบการดูสถิติ

**Linux/macOS:**
```bash
# ดูสถิติข้อมูลปัจจุบัน
curl -X PUT http://localhost:3000/api/document_loader_embeding_pgvector/text_csv
```

**Windows PowerShell:**
```powershell
# ดูสถิติข้อมูลปัจจุบัน
Invoke-RestMethod -Uri "http://localhost:3000/api/document_loader_embeding_pgvector/text_csv" -Method PUT
```

#### 4. ทดสอบการลบข้อมูล

**Linux/macOS:**
```bash
# ลบข้อมูลทั้งหมด
curl -X DELETE http://localhost:3000/api/document_loader_embeding_pgvector/text_csv
```

**Windows PowerShell:**
```powershell
# ลบข้อมูลทั้งหมด
Invoke-RestMethod -Uri "http://localhost:3000/api/document_loader_embeding_pgvector/text_csv" -Method DELETE
```

#### 3. ตรวจสอบข้อมูลใน Database

เข้าไปที่ Supabase Dashboard > SQL Editor:

```sql
-- ดูจำนวน documents ที่เก็บไว้
SELECT COUNT(*) as total_documents FROM documents;

-- ดู metadata ของ documents
SELECT 
  metadata->>'filename' as filename,
  metadata->>'type' as type,
  COUNT(*) as chunks
FROM documents 
GROUP BY metadata->>'filename', metadata->>'type';

-- ดูตัวอย่าง content
SELECT 
  LEFT(content, 100) as preview,
  metadata->>'filename' as filename
FROM documents 
LIMIT 5;

-- ทดสอบ similarity search function
SELECT * FROM match_documents(
  (SELECT embedding FROM documents LIMIT 1),
  0.7,
  5
);

-- ตรวจสอบข้อมูลซ้ำ (ควรไม่มี)
SELECT 
  content,
  COUNT(*) as duplicate_count
FROM documents 
GROUP BY content 
HAVING COUNT(*) > 1;

-- ตรวจสอบ text search configurations ที่มี
SELECT cfgname FROM pg_ts_config;

-- ทดสอบ text search (ถ้าต้องการ)
SELECT 
  content,
  to_tsvector('simple', content) as searchable_text
FROM documents 
WHERE to_tsvector('simple', content) @@ plainto_tsquery('simple', 'Smartwatch')
LIMIT 5;
```

#### 4. ทดสอบสถานการณ์การเรียกซ้ำ

**Linux/macOS:**
```bash
# ทดสอบเรียก GET API หลายครั้ง
echo "=== เรียกครั้งที่ 1 ==="
curl -X GET http://localhost:3000/api/document_loader_embeding_pgvector/text_csv

echo "=== เรียกครั้งที่ 2 ==="
curl -X GET http://localhost:3000/api/document_loader_embeding_pgvector/text_csv

echo "=== ตรวจสอบสถิติ ==="
curl -X PUT http://localhost:3000/api/document_loader_embeding_pgvector/text_csv
```

**Windows PowerShell:**
```powershell
# ทดสอบเรียก GET API หลายครั้ง
Write-Host "=== เรียกครั้งที่ 1 ==="
Invoke-RestMethod -Uri "http://localhost:3000/api/document_loader_embeding_pgvector/text_csv" -Method GET

Write-Host "=== เรียกครั้งที่ 2 ==="
Invoke-RestMethod -Uri "http://localhost:3000/api/document_loader_embeding_pgvector/text_csv" -Method GET

Write-Host "=== ตรวจสอบสถิติ ==="
Invoke-RestMethod -Uri "http://localhost:3000/api/document_loader_embeding_pgvector/text_csv" -Method PUT
```

---

### ⚡ Performance Optimization: CacheBackedEmbeddings

#### 🎯 **Overview**

ระบบใช้ `CacheBackedEmbeddings` เพื่อเพิ่มประสิทธิภาพและลดต้นทุนในการสร้าง embeddings โดย:
- **เก็บ embeddings ไว้ใน cache** เมื่อเคยสร้างแล้ว
- **ลดการเรียก OpenAI API** สำหรับ query ที่เหมือนกัน
- **เพิ่มความเร็วในการตอบสนอง** อย่างมีนัยสำคัญ

#### 📊 **Performance Benchmark Results**

จากการทดสอบจริงด้วย query `"Gaming Mouse ราคา"`:

| ครั้งที่ | Response Time | การปรับปรุง | สถานะ Cache |
|---------|---------------|-------------|-------------|
| **1** | 5,881ms | Baseline | ❌ สร้าง embedding ใหม่ |
| **2** | 1,955ms | ⚡ **เร็วขึ้น 67%** | 🟡 ใช้ cache บางส่วน |
| **3** | 2,336ms | ⚡ **เร็วขึ้น 60%** | 🟡 ใช้ cache |
| **4** | 694ms | 🔥 **เร็วขึ้น 88%** | ✅ ใช้ cache เต็มที่ |

#### 🔧 **Implementation Details**

#### 1. Cache Setup ในการสร้าง Embeddings (GET API)
```typescript
// สร้าง base embeddings
const baseEmbeddings = new OpenAIEmbeddings({ 
  model: process.env.OPENAI_EMBEDDING_MODEL_NAME || 'text-embedding-3-small',
  dimensions: 1536
});

// สร้าง cache-backed embeddings
const cacheStore = new InMemoryStore();
const embeddings = CacheBackedEmbeddings.fromBytesStore(
  baseEmbeddings,
  cacheStore,
  {
    namespace: "document_embeddings" // กำหนด namespace สำหรับ cache
  }
);
```

#### 2. Cache Setup ในการค้นหา (POST API)
```typescript
// สร้าง cache-backed embeddings สำหรับการค้นหา
const cacheStore = new InMemoryStore();
const embeddings = CacheBackedEmbeddings.fromBytesStore(
  baseEmbeddings,
  cacheStore,
  {
    namespace: "search_embeddings" // namespace แยกสำหรับการค้นหา
  }
);
```

#### 🎯 **Benefits & Use Cases**

#### ✅ **Performance Benefits:**
- **ลดเวลาการตอบสนอง**: จาก ~6 วินาที เหลือ ~0.7 วินาที
- **ประหยัดต้นทุน**: ไม่ต้องเรียก OpenAI API ซ้ำสำหรับ query เดิม
- **เพิ่มประสิทธิภาพ**: User experience ดีขึ้นอย่างมาก
- **Scalability**: รองรับผู้ใช้หลายคนได้ดีขึ้น

#### 🧠 **How Cache Works:**
1. **ครั้งแรก**: สร้าง embedding ใหม่และเก็บใน cache
2. **ครั้งถัดไป**: ใช้ embedding จาก cache แทนการเรียก OpenAI API
3. **Memory Optimization**: ใช้ InMemoryStore สำหรับ session นี้
4. **Namespace Separation**: แยก cache ระหว่างการสร้าง document และการค้นหา

### 💡 **Advanced Optimizations**

#### 1. Persistent Cache (Production)
```typescript
// แทน InMemoryStore ใช้ Redis หรือ Database
import { RedisStore } from "@langchain/redis";

const cacheStore = new RedisStore({
  client: redisClient,
  ttl: 3600 // TTL 1 ชั่วโมง
});
```

#### 2. Smart Cache Invalidation
```typescript
// ล้าง cache เมื่อมีการอัปเดตเอกสาร
const clearCacheOnUpdate = async () => {
  await cacheStore.clear();
  console.log("🗑️ ล้าง embedding cache เนื่องจากมีการอัปเดตเอกสาร");
};
```

#### 3. Cache Warming Strategy
```typescript
// Pre-load common queries
const commonQueries = ["ราคา", "สินค้า", "การขาย"];
for (const query of commonQueries) {
  await embeddings.embedQuery(query);
}
```

#### 🧪 **Testing Cache Performance**

#### ทดสอบ Performance กับ Query เดิม:
```powershell
# ครั้งแรก (สร้าง cache)
$body = @{ query = "Smartwatch ราคา"; limit = 3 } | ConvertTo-Json
Measure-Command { 
  Invoke-RestMethod -Uri "http://localhost:3000/api/document_loader_embeding_pgvector/text_csv" `
    -Method POST -ContentType "application/json" -Body $body 
}

# ครั้งที่สอง (ใช้ cache)
Measure-Command { 
  Invoke-RestMethod -Uri "http://localhost:3000/api/document_loader_embeding_pgvector/text_csv" `
    -Method POST -ContentType "application/json" -Body $body 
}
```

#### ตัวอย่างผลลัพธ์:
```
🔍 ค้นหา: "Smartwatch ราคา"
⚡ ใช้ CacheBackedEmbeddings สำหรับการค้นหา
📋 พบผลลัพธ์: 3 รายการ
POST /api/document_loader_embeding_pgvector/text_csv 200 in 4200ms  # ครั้งแรก

🔍 ค้นหา: "Smartwatch ราคา"
⚡ ใช้ CacheBackedEmbeddings สำหรับการค้นหา
📋 พบผลลัพธ์: 3 รายการ
POST /api/document_loader_embeding_pgvector/text_csv 200 in 850ms   # ครั้งที่สอง (เร็วขึ้น 80%)
```

#### 🎯 **Production Recommendations**

1. **ใช้ Persistent Cache**: Redis หรือ Database สำหรับ production
2. **กำหนด TTL**: ตั้งเวลาหมดอายุของ cache ให้เหมาะสม
3. **Monitor Cache Hit Rate**: ติดตามอัตราการใช้ cache
4. **Implement Cache Warming**: Pre-load query ที่ใช้บ่อย
5. **Cache Invalidation Strategy**: ล้าง cache เมื่อมีการอัปเดตข้อมูล

---

### 🚨 การแก้ไขปัญหา

#### ปัญหาที่พบบ่อย

#### 1. ไม่พบไฟล์ในโฟลเดอร์ data/

**Error:**
```json
{
  "error": "ไม่พบเอกสารในโฟลเดอร์ data/",
  "message": "กรุณาเพิ่มไฟล์ .txt หรือ .csv ในโฟลเดอร์ data/"
}
```

**วิธีแก้:**
- ตรวจสอบว่ามีไฟล์ในโฟลเดอร์ `./data/text_csv/`
- ตรวจสอบ path ให้ถูกต้อง
- ตรวจสอบ file extension (.txt, .csv)

#### 2. OpenAI API Key ไม่ถูกต้อง

**Error:**
```json
{
  "error": "เกิดข้อผิดพลาดในการประมวลผลเอกสาร",
  "details": "Invalid API key provided"
}
```

**วิธีแก้:**
- ตรวจสอบ `OPENAI_API_KEY` ใน `.env.local`
- ตรวจสอบ quota และ billing ใน OpenAI account

#### 3. Supabase Connection Error

**Error:**
```json
{
  "error": "เกิดข้อผิดพลาดในการประมวลผลเอกสาร",
  "details": "Failed to connect to Supabase"
}
```

**วิธีแก้:**
- ตรวจสอบ Supabase URL และ Keys
- ตรวจสอบว่าได้สร้างตาราง `documents` แล้ว
- ตรวจสอบว่าได้เปิดใช้งาน pgvector extension แล้ว

#### 4. pgvector Extension ไม่พร้อมใช้งาน

**Error:**
```sql
ERROR: extension "vector" is not available
```

**วิธีแก้:**
- ไปที่ Supabase Dashboard > Database > Extensions
- เปิดใช้งาน "vector" extension
- หรือรันคำสั่ง: `CREATE EXTENSION IF NOT EXISTS vector;`

#### 6. CSV Loader Error: dsvFormat is not a function

**Error:**
```json
{
  "error": "เกิดข้อผิดพลาดในการประมวลผลเอกสาร",
  "details": "TypeError: dsvFormat is not a function"
}
```

**วิธีแก้:**
ติดตั้ง dependency ที่จำเป็นสำหรับ CSV parsing:

```bash
npm install d3-dsv@2
```

หรือตรวจสอบว่ามี d3-dsv ในโปรเจ็กต์แล้ว:
```bash
npm list d3-dsv
```

#### 5. Thai Text Search Configuration ไม่รองรับ

**Symptoms:**
- การค้นหาครั้งแรกช้า
- Cache ไม่ทำงาน

**วิธีแก้:**
1. **ตรวจสอบการตั้งค่า namespace**:
   ```typescript
   const embeddings = CacheBackedEmbeddings.fromBytesStore(
     baseEmbeddings,
     cacheStore,
     {
       namespace: "search_embeddings" // ต้องมี namespace
     }
   );
   ```

2. **ตรวจสอบ memory usage**:
   ```javascript
   console.log('Cache keys:', await cacheStore.yieldKeys());
   ```

3. **Monitor cache hit rate**:
   ```typescript
   console.log(`⚡ Cache hit for query: ${query}`);
   ```

**Error:**
```sql
ERROR: 42704: text search configuration "thai" does not exist
LINE 3: ON documents USING gin(to_tsvector('thai', content));
```

**วิธีแก้:**
ใช้ `'simple'` แทน `'thai'` ในการสร้าง index:

```sql
-- แทนที่
CREATE INDEX idx_documents_content 
ON documents USING gin(to_tsvector('thai', content));

-- ด้วย
CREATE INDEX idx_documents_content 
ON documents USING gin(to_tsvector('simple', content));
```

**ทางเลือกอื่นๆ:**

1. **ใช้ 'simple' (แนะนำ)**
   ```sql
   CREATE INDEX idx_documents_content 
   ON documents USING gin(to_tsvector('simple', content));
   ```
   - รองรับทุกภาษารวมถึงภาษาไทย
   - ไม่ทำ stemming หรือ stop words
   - เหมาะสำหรับข้อความผสมภาษา

2. **ใช้ 'english'**
   ```sql
   CREATE INDEX idx_documents_content 
   ON documents USING gin(to_tsvector('english', content));
   ```
   - รองรับภาษาอังกฤษเป็นหลัก
   - มี stemming และ stop words

3. **ตรวจสอบ configurations ที่มี**
   ```sql
   -- ดู text search configurations ที่มีในระบบ
   SELECT cfgname FROM pg_ts_config;
   ```

### การติดตาม Log

#### Server-side Logs
```javascript
// ใน route.ts
console.log("🔄 เริ่มโหลดเอกสาร...");
console.log(`📄 โหลดเอกสารสำเร็จ: ${rawDocs.length} ไฟล์`);
console.log(`✂️ แยกเอกสารเป็น ${chunks.length} ชิ้น`);
console.log("🔮 สร้าง embeddings...");
console.log("✅ สำเร็จ!");
```

#### Database Monitoring
```sql
-- ตรวจสอบ connection
SELECT count(*) FROM pg_stat_activity WHERE state = 'active';

-- ตรวจสอบขนาด table
SELECT 
  schemaname,
  tablename,
  attname,
  n_distinct,
  correlation 
FROM pg_stats 
WHERE tablename = 'documents';
```

---

### 📚 เพิ่มเติม

#### การ Optimize Performance

#### 1. เพิ่ม Connection Pooling
```javascript
// ใน lib/server.ts
export const createClient = () => {
  return createClientSupabase(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      db: {
        schema: 'public',
      },
      auth: {
        persistSession: false,
      },
    }
  )
}
```

#### 2. ปรับตั้งค่า Text Splitter
```javascript
const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,     // เพิ่มขนาดสำหรับเอกสารยาว
  chunkOverlap: 200,   // เพิ่ม overlap สำหรับความต่อเนื่อง
  separators: ["\n\n", "\n", ".", "!", "?", ",", " "],
});
```

#### 3. Batch Processing
```javascript
// ประมวลผล chunks ทีละ batch
const batchSize = 50;
for (let i = 0; i < chunksWithMetadata.length; i += batchSize) {
  const batch = chunksWithMetadata.slice(i, i + batchSize);
  await vectorStore.addDocuments(batch);
  console.log(`✅ ประมวลผล batch ${Math.floor(i/batchSize) + 1}`);
}
```

#### 4. การจัดการ Script อัตโนมัติ

**Linux/macOS (package.json):**
```json
{
  "scripts": {
    "update-docs": "curl -X GET http://localhost:3000/api/document_loader_embeding_pgvector/text_csv",
    "view-stats": "curl -X PUT http://localhost:3000/api/document_loader_embeding_pgvector/text_csv",
    "clear-docs": "curl -X DELETE http://localhost:3000/api/document_loader_embeding_pgvector/text_csv"
  }
}
```

**Windows PowerShell Scripts:**

สร้างไฟล์ `scripts/update-docs.ps1`:
```powershell
# update-docs.ps1
Write-Host "🔄 อัปเดตเอกสาร..." -ForegroundColor Yellow
$result = Invoke-RestMethod -Uri "http://localhost:3000/api/document_loader_embeding_pgvector/text_csv" -Method GET
$result | ConvertTo-Json -Depth 10
```

สร้างไฟล์ `scripts/view-stats.ps1`:
```powershell
# view-stats.ps1
Write-Host "📊 ดูสถิติข้อมูล..." -ForegroundColor Cyan
$result = Invoke-RestMethod -Uri "http://localhost:3000/api/document_loader_embeding_pgvector/text_csv" -Method PUT
$result | ConvertTo-Json -Depth 10
```

สร้างไฟล์ `scripts/clear-docs.ps1`:
```powershell
# clear-docs.ps1
Write-Host "🗑️ ลบข้อมูลทั้งหมด..." -ForegroundColor Red
$result = Invoke-RestMethod -Uri "http://localhost:3000/api/document_loader_embeding_pgvector/text_csv" -Method DELETE
$result | ConvertTo-Json -Depth 10
```

**การใช้งาน:**

**Linux/macOS:**
```bash
npm run update-docs  # อัปเดตเอกสาร
npm run view-stats   # ดูสถิติ
npm run clear-docs   # ลบข้อมูล
```

**Windows PowerShell:**
```powershell
.\scripts\update-docs.ps1  # อัปเดตเอกสาร
.\scripts\view-stats.ps1   # ดูสถิติ
.\scripts\clear-docs.ps1   # ลบข้อมูล
```

#### การตรวจสอบข้อมูลซ้ำ

#### 1. ตรวจสอบผ่าน SQL
```sql
-- หาข้อมูลซ้ำ
SELECT 
  content,
  metadata->>'filename' as filename,
  COUNT(*) as duplicate_count
FROM documents 
GROUP BY content, metadata->>'filename'
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- ตรวจสอบ timestamp การเพิ่มข้อมูล
SELECT 
  metadata->>'timestamp' as added_time,
  COUNT(*) as records_count
FROM documents 
GROUP BY metadata->>'timestamp'
ORDER BY added_time DESC;
```

#### 2. ตรวจสอบผ่าน API

**Linux/macOS:**
```bash
# ดูสถิติก่อนอัปเดต
curl -X PUT http://localhost:3000/api/document_loader_embeding_pgvector/text_csv

# อัปเดตข้อมูล
curl -X GET http://localhost:3000/api/document_loader_embeding_pgvector/text_csv

# ดูสถิติหลังอัปเดต
curl -X PUT http://localhost:3000/api/document_loader_embeding_pgvector/text_csv
```

**Windows PowerShell:**
```powershell
# ดูสถิติก่อนอัปเดต
Write-Host "📊 สถิติก่อนอัปเดต:" -ForegroundColor Cyan
Invoke-RestMethod -Uri "http://localhost:3000/api/document_loader_embeding_pgvector/text_csv" -Method PUT

# อัปเดตข้อมูล
Write-Host "🔄 อัปเดตข้อมูล:" -ForegroundColor Yellow
Invoke-RestMethod -Uri "http://localhost:3000/api/document_loader_embeding_pgvector/text_csv" -Method GET

# ดูสถิติหลังอัปเดต
Write-Host "📊 สถิติหลังอัปเดต:" -ForegroundColor Green
Invoke-RestMethod -Uri "http://localhost:3000/api/document_loader_embeding_pgvector/text_csv" -Method PUT
```

#### การใช้งานขั้นสูง

#### 1. Custom Metadata Filters
```javascript
// ค้นหาเฉพาะไฟล์ประเภท CSV
const results = await vectorStore.similaritySearch(query, limit, {
  type: 'csv'
});
```

#### 2. Hybrid Search
```javascript
// รวม vector search กับ text search
const hybridResults = await supabase
  .from('documents')
  .select('*')
  .textSearch('content', query)
  .limit(limit);
```

---

### 🎉 สรุป

ระบบ Document Loader, Embedding และ PGVector นี้ช่วยให้ AI Chatbot สามารถ:

- ✅ โหลดข้อมูลจากไฟล์ต่างๆ อัตโนมัติ
- ✅ สร้าง Vector Embeddings ที่มีประสิทธิภาพ
- ✅ ใช้ CacheBackedEmbeddings เพื่อเพิ่มความเร็วได้ถึง 88%
- ✅ ค้นหาข้อมูลที่เกี่ยวข้องด้วย AI
- ✅ ตอบคำถามลูกค้าได้อย่างแม่นยำ
- ✅ ป้องกันข้อมูลซ้ำซ้อนด้วยการลบข้อมูลเก่าอัตโนมัติ
- ✅ แสดงสถิติการใช้งานแบบ Real-time
- ✅ จัดการการอัปเดตข้อมูลได้อย่างปลอดภัย

#### 🚀 **ฟีเจอร์ใหม่ที่เพิ่มเข้ามา:**

| ฟีเจอร์ | คำอธิบาย | API Endpoint | Performance |
|---------|----------|--------------|-------------|
| **Auto Data Cleanup** | ลบข้อมูลเก่าก่อนโหลดใหม่อัตโนมัติ | `GET /api/...` | ✅ ป้องกันข้อมูลซ้ำ |
| **Statistics Viewer** | ดูสถิติข้อมูลใน vector store | `PUT /api/...` | ✅ Real-time monitoring |
| **Enhanced Deletion** | ลบข้อมูลพร้อมแสดงจำนวนที่ลบ | `DELETE /api/...` | ✅ Safe operations |
| **Duplicate Prevention** | ป้องกันข้อมูลซ้ำซ้อน 100% | ทุก API | ✅ Data integrity |
| **CacheBackedEmbeddings** | Cache embeddings เพื่อเพิ่มความเร็ว | `POST /api/...` | 🔥 **88% faster** |
| **Detailed Logging** | Log ที่ละเอียดและติดตามได้ | ทุก API | ✅ Better debugging |

#### 📋 **Best Practices:**

1. **เมื่อแก้ไขไฟล์เอกสาร** → เรียก `GET API` ทันที
2. **ก่อนแก้ไขข้อมูลมาก** → เรียก `PUT API` เพื่อดูสถิติ
3. **เมื่อต้องการเริ่มใหม่** → เรียก `DELETE API` แล้วค่อย `GET API`
4. **ทดสอบการค้นหา** → ใช้ `POST API` ด้วย query ที่หลากหลาย

**ขั้นตอนต่อไป:** นำ API นี้ไปผสานกับ Chatbot เพื่อให้สามารถตอบคำถามจากข้อมูลเอกสารได้แบบ Real-time! 🚀

---

#### 📊 **ตารางสรุป API Endpoints**

| Method | URL | Purpose | Use Case |
|--------|-----|---------|----------|
| `GET` | `/api/document_loader_embeding_pgvector/text_csv` | โหลดและสร้าง embeddings | เมื่อแก้ไขเอกสาร |
| `POST` | `/api/document_loader_embeding_pgvector/text_csv` | ค้นหา similarity | เมื่อต้องการค้นหาข้อมูล |
| `PUT` | `/api/document_loader_embeding_pgvector/text_csv` | ดูสถิติข้อมูล | เมื่อต้องการตรวจสอบสถานะ |
| `DELETE` | `/api/document_loader_embeding_pgvector/text_csv` | ลบข้อมูลทั้งหมด | เมื่อต้องการเริ่มต้นใหม่ |

---

#### 💻 **เทียบเคียง Commands: Linux/macOS vs Windows PowerShell**

| การดำเนินการ | Linux/macOS | Windows PowerShell |
|-------------|-------------|-------------------|
| **ดูไฟล์ในโฟลเดอร์** | `ls ./data/text_csv/` | `Get-ChildItem .\data\text_csv\` |
| **GET Request** | `curl -X GET [URL]` | `Invoke-RestMethod -Uri "[URL]" -Method GET` |
| **POST Request** | `curl -X POST [URL] -H "Content-Type: application/json" -d '{...}'` | `Invoke-RestMethod -Uri "[URL]" -Method POST -ContentType "application/json" -Body $body` |
| **PUT Request** | `curl -X PUT [URL]` | `Invoke-RestMethod -Uri "[URL]" -Method PUT` |
| **DELETE Request** | `curl -X DELETE [URL]` | `Invoke-RestMethod -Uri "[URL]" -Method DELETE` |
| **แสดงข้อความ** | `echo "message"` | `Write-Host "message"` |
| **JSON Body** | `-d '{"key": "value"}'` | `$body = @{ key = "value" } \| ConvertTo-Json` |

#### 🎯 **PowerShell Tips & Tricks:**

#### 1. สร้าง Function สำหรับ API Calls
```powershell
# เพิ่มใน PowerShell Profile
function Update-Documents {
    Write-Host "🔄 อัปเดตเอกสาร..." -ForegroundColor Yellow
    $result = Invoke-RestMethod -Uri "http://localhost:3000/api/document_loader_embeding_pgvector/text_csv" -Method GET
    $result | ConvertTo-Json -Depth 10
}

function Get-DocumentStats {
    Write-Host "📊 ดูสถิติข้อมูล..." -ForegroundColor Cyan
    $result = Invoke-RestMethod -Uri "http://localhost:3000/api/document_loader_embeding_pgvector/text_csv" -Method PUT
    $result | ConvertTo-Json -Depth 10
}

function Search-Documents {
    param([string]$Query, [int]$Limit = 5)
    Write-Host "🔍 ค้นหา: $Query" -ForegroundColor Green
    $body = @{ query = $Query; limit = $Limit } | ConvertTo-Json
    $result = Invoke-RestMethod -Uri "http://localhost:3000/api/document_loader_embeding_pgvector/text_csv" `
        -Method POST -ContentType "application/json" -Body $body
    $result | ConvertTo-Json -Depth 10
}

function Clear-Documents {
    Write-Host "🗑️ ลบข้อมูลทั้งหมด..." -ForegroundColor Red
    $result = Invoke-RestMethod -Uri "http://localhost:3000/api/document_loader_embeding_pgvector/text_csv" -Method DELETE
    $result | ConvertTo-Json -Depth 10
}
```

#### 2. การใช้งาน Functions
```powershell
# อัปเดตเอกสาร
Update-Documents

# ดูสถิติ
Get-DocumentStats

# ค้นหาข้อมูล
Search-Documents -Query "Smartwatch ราคา" -Limit 3

# ลบข้อมูล
Clear-Documents
```

#### 3. สร้าง Batch Script สำหรับการทดสอบ
```powershell
# test-api.ps1
Write-Host "🧪 เริ่มทดสอบ API ทั้งหมด..." -ForegroundColor Magenta

Write-Host "`n1. ดูสถิติเริ่มต้น" -ForegroundColor Yellow
Get-DocumentStats

Write-Host "`n2. อัปเดตเอกสาร" -ForegroundColor Yellow
Update-Documents

Write-Host "`n3. ทดสอบการค้นหา" -ForegroundColor Yellow
Search-Documents -Query "Gaming Mouse" -Limit 3

Write-Host "`n4. ดูสถิติหลังอัปเดต" -ForegroundColor Yellow
Get-DocumentStats

Write-Host "`n✅ ทดสอบเสร็จสิ้น!" -ForegroundColor Green
```

#### สร้าง Branch ใหม่
```bash
git add .
git commit -m "Finish document loader with embedding and pgvector"
git checkout -b 09-rag
```

### 🧠 RAG (Retrieval-Augmented Generation) with Supabase and PGVector

คู่มือการตั้งค่าระบบ RAG ที่รวม Tool Calling กับ Vector Search สำหรับ AI Chatbot

#### 📋 สารบัญ

1. [ภาพรวมระบบ RAG](#ภาพรวมระบบ-rag)
2. [สถาปัตยกรรมระบบ](#สถาปัตยกรรมระบบ)
3. [Tools ที่ใช้งาน](#tools-ที่ใช้งาน)
4. [การตั้งค่าระบบ](#การตั้งค่าระบบ)
5. [การใช้งาน RAG](#การใช้งาน-rag)
6. [ตัวอย่างการใช้งาน](#ตัวอย่างการใช้งาน)
7. [การแก้ไขปัญหา](#การแก้ไขปัญหา)

---

### 🎯 ภาพรวมระบบ RAG

ระบบ RAG (Retrieval-Augmented Generation) ช่วยให้ AI Chatbot สามารถ:

#### ✨ **ความสามารถหลัก**
- **ค้นหาข้อมูลจากเอกสาร**: ใช้ Vector Similarity Search จาก pgvector
- **ตอบคำถามจากข้อมูลจริง**: ไม่ใช่การเดาหรือสร้างข้อมูลขึ้นมา
- **รองรับหลายแหล่งข้อมูล**: เอกสาร + ฐานข้อมูล structured
- **Smart Tool Selection**: เลือกใช้ tool ที่เหมาะสมตามบริบท

#### 🔧 **Tools ที่รวมเข้ากัน**
1. **search_documents** - Vector Search จากเอกสาร
2. **get_product_info** - Structured data จากฐานข้อมูล
3. **get_sales_data** - ข้อมูลการขาย

---

#### 🏗️ สถาปัตยกรรมระบบ

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Question                            │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                   AI Agent (LangChain)                          │
│                                                                 │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐    │
│  │ search_documents│ │ get_product_info│ │ get_sales_data  │    │
│  │                 │ │                 │ │                 │    │
│  │ Vector Search   │ │ Structured DB   │ │ Sales History   │    │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘    │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Data Sources                                 │
│                                                                 │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐    │
│  │ documents  │ │ products table  │ │ sales table     │    │
│  │                 │ │                 │ │                 │    │
│  │ pgvector        │ │ PostgreSQL      │ │ PostgreSQL      │    │
│  │ (embeddings)    │ │ (structured)    │ │ (structured)    │    │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```
---

### 🛠️ Tools ที่ใช้งาน

#### 1. search_documents 🔍
**ใช้เมื่อไหร่:**
- คำถามเกี่ยวกับข้อมูลร้าน (ที่อยู่, เบอร์โทร)
- ข้อมูลบริษัท, นโยบาย, การบริการ
- ข้อมูลทั่วไปที่อัปโหลดไว้ในเอกสาร
- เมื่อไม่แน่ใจว่าควรใช้ tool ไหน

**ตัวอย่างคำถาม:**
```
"ร้านอยู่ที่ไหน?"
"เบอร์โทรศัพท์ร้าน"
"เวลาเปิด-ปิด"
"นโยบายการคืนสินค้า"
"ข้อมูลบริษัท"
```

**วิธีการทำงาน:**
- รับ query จากผู้ใช้
- แปลงเป็น embedding ด้วย OpenAI
- ค้นหาใน pgvector ด้วย cosine similarity
- ส่งกลับผลลัพธ์ที่เกี่ยวข้องที่สุด

#### 2. get_product_info 📦
**ใช้เมื่อไหร่:**
- คำถามเกี่ยวกับสินค้าเฉพาะ
- ต้องการราคา, สต็อก, รายละเอียดสินค้า

**ตัวอย่างคำถาม:**
```
"Gaming Mouse ราคาเท่าไหร่?"
"Coffee Maker มีในสต็อกไหม?"
"Wireless Earbuds ราคา"
```

#### 3. get_sales_data 📊
**ใช้เมื่อไหร่:**
- คำถามเกี่ยวกับการขาย
- ประวัติการขาย, ยอดขาย

**ตัวอย่างคำถาม:**
```
"Gaming Mouse ขายไปแล้วกี่ชิ้น?"
"ยอดขาย iPhone"
"ประวัติการขาย"
```
---

### ⚙️ การตั้งค่าระบบ

#### 1. Prerequisites
ต้องตั้งค่าระบบต่อไปนี้ก่อน:
- ✅ Document Loader & PGVector (ดู [DOCUMENT_LOADER_EMBEDDING_PGVECTOR.md](./DOCUMENT_LOADER_EMBEDDING_PGVECTOR.md))
- ✅ Tool Calling Setup (ดู [TOOL_CALLING_SETUP.md](./TOOL_CALLING_SETUP.md))

#### 2. Environment Variables
```env {.line-numbers}
NODE_ENV=development

# === Supabase config =====
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY=your-supabase-anon-key

# ===  postgres config =====
# การใช้กับ RAG + LangChain + pgvector แนะนำเป็นแบบ Transaction pooler (Shared Pooler)
PG_HOST=your-postgres-host
PG_PORT=6543
PG_USER=your-postgres-user
PG_PASSWORD=your-postgres-password
PG_DATABASE=postgres

# === OPENAI (ChatGPT) =====
OPENAI_API_KEY=your-openai-api-key
OPENAI_MODEL_NAME="gpt-4o-mini"
OPENAI_EMBEDDING_MODEL_NAME="text-embedding-3-small"
```

#### 3. Dependencies
```bash {.line-numbers}
npm install @langchain/community @langchain/openai langchain d3-dsv@2
```

#### 4. Database Tables
ต้องมีตารางต่อไปนี้:
- `documents` - สำหรับ vector embeddings
- `products` - สำหรับข้อมูลสินค้า
- `sales` - สำหรับข้อมูลการขาย
- `chat_sessions` - สำหรับ chat history
- `chat_messages` - สำหรับ messages

#### 6. สร้างไฟล์ api
สร้างไฟล์ `src/app/api/chat_08_rag/route.ts` ด้วยโค้ดดังนี้:
```typescript {.line-numbers}
/**
 * ===============================================
 * API Route สำหรับ Chat (RAG - Document Search Only)
 * ===============================================
 *
 * ฟีเจอร์หลัก:
 * - 📚 RAG (Retrieval-Augmented Generation) with pgvector
 * - 🔍 Document Search จากเอกสาร (PDF, CSV, TXT) ใน documents table
 * - 🗂️ เก็บประวัติการสนทนาใน PostgreSQL
 * - 🧠 ทำ Summary เพื่อประหยัด Token
 * - ✂️ Trim Messages เพื่อไม่ให้เกิน Token Limit
 * - 🌊 Streaming Response สำหรับ Real-time Chat
 * - 🔧 จัดการ Session ID อัตโนมัติ
 * 
 * การทำงาน:
 * 1. รับคำถามจากผู้ใช้
 * 2. ค้นหาเอกสารที่เกี่ยวข้องจาก Vector Store
 * 3. ใช้ข้อมูลจากเอกสารมาตอบคำถาม
 * 4. ส่งผลลัพธ์แบบ Streaming
*/

import { NextRequest } from 'next/server'
import { getDatabase } from '@/lib/database'

// LangChain & AI SDK Imports
import { ChatOpenAI } from '@langchain/openai'
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts'
import { toUIMessageStream } from '@ai-sdk/langchain'
import { createUIMessageStreamResponse, UIMessage } from 'ai'
import { PostgresChatMessageHistory } from '@langchain/community/stores/message/postgres'
import { BaseMessage, AIMessage, HumanMessage, SystemMessage, MessageContent } from '@langchain/core/messages'
import { trimMessages } from '@langchain/core/messages'
import { StringOutputParser } from '@langchain/core/output_parsers'
import { encodingForModel } from '@langchain/core/utils/tiktoken'
import { createClient } from '@supabase/supabase-js'

// ✨ NEW: Imports for Vector Search (Document RAG)
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase"
import { OpenAIEmbeddings } from "@langchain/openai"
import { CacheBackedEmbeddings } from "langchain/embeddings/cache_backed"
import { InMemoryStore } from "@langchain/core/stores"

export const dynamic = 'force-dynamic'
export const maxDuration = 30

// ===============================================
// ใช้ centralized database utility แทน pool ที่สร้างเอง
// ===============================================
const pool = getDatabase()

// สร้าง Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY!
)

// ===============================================
// ✨ NEW: สร้าง Vector Store สำหรับ Document Search
// ===============================================
async function createVectorStore() {
  const baseEmbeddings = new OpenAIEmbeddings({ 
    model: process.env.OPENAI_EMBEDDING_MODEL_NAME || "text-embedding-3-small",
    dimensions: 1536
  });

  // สร้าง Cache-backed embeddings เพื่อลดต้นทุนและเพิ่มความเร็ว
  const cacheStore = new InMemoryStore();
  const embeddings = CacheBackedEmbeddings.fromBytesStore(
    baseEmbeddings,
    cacheStore,
    {
      namespace: "rag_embeddings" // namespace สำหรับ RAG
    }
  );

  return new SupabaseVectorStore(embeddings, {
    client: supabase,
    tableName: 'documents',
    queryName: 'match_documents'
  });
}

// ===============================================
// ฟังก์ชันสำหรับ RAG (Vector Search)
// ===============================================
async function searchDocuments(query: string, limit: number = 5) {
  try {
    console.log(`🔧 Searching documents with query="${query}", limit=${limit}`);
    
    // สร้าง vector store
    const vectorStore = await createVectorStore();
    
    // ค้นหาเอกสารที่เกี่ยวข้อง
    const results = await vectorStore.similaritySearchWithScore(query, limit);
    
    if (!results || results.length === 0) {
      return `ไม่พบเอกสารที่เกี่ยวข้องกับ "${query}" ในระบบ`;
    }
    
    console.log(`✅ พบเอกสารที่เกี่ยวข้อง: ${results.length} รายการ`);
    
    // จัดรูปแบบผลลัพธ์เป็นข้อความสำหรับใส่ใน prompt
    const documents = results.map(([doc, score]) => {
      const filename = doc.metadata?.filename || 'ไม่ทราบชื่อไฟล์';
      const type = doc.metadata?.type || 'ไม่ทราบประเภท';
      return `ไฟล์: ${filename} (${type.toUpperCase()})
เนื้อหา: ${doc.pageContent}
ความเกี่ยวข้อง: ${(score * 100).toFixed(1)}%`;
    }).join('\n\n---\n\n');
    
    return documents;
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    console.log('❌ Search error:', errorMessage);
    
    if (errorMessage.includes('connection') || 
        errorMessage.includes('network') || 
        errorMessage.includes('timeout')) {
      throw new Error('ไม่สามารถเข้าถึงระบบค้นหาเอกสารได้ในขณะนี้');
    }
    
    throw new Error(`เกิดข้อผิดพลาดในการค้นหาเอกสาร: ${errorMessage}`);
  }
}

// ===============================================
// ฟังก์ชันสำหรับนับ Token (Tiktoken)
// ===============================================

/**
 * Type สำหรับ Encoder ที่ใช้นับ Token
 */
type Encoding = {
  encode: (text: string) => number[]
  free?: () => void
}

let encPromise: Promise<Encoding> | undefined

/**
 * ฟังก์ชันสำหรับขอ Encoder
 * Step 1: พยายามใช้ gpt-4o-mini ก่อน
 * Step 2: ถ้าไม่ได้ให้ fallback เป็น gpt-4
 * Step 3: Cache Encoder เพื่อไม่ต้องสร้างใหม่
 */
async function getEncoder(): Promise<Encoding> {
  if (!encPromise) {
    encPromise = encodingForModel("gpt-4o-mini").catch(() =>
      encodingForModel("gpt-4")
    )
  }
  return encPromise
}

/**
 * ฟังก์ชันนับ Token ของข้อความแต่ละอัน
 * Step 1: ตรวจสอบประเภทของ content (string, array, หรืออื่นๆ)
 * Step 2: แปลงเป็น string และนับ token
 * Step 3: คืนค่าจำนวน token
 */
async function strTokenCounter(content: MessageContent): Promise<number> {
  const enc = await getEncoder()
  if (typeof content === 'string') return enc.encode(content).length
  if (Array.isArray(content)) {
    return enc.encode(
      content.map(p => (p.type === 'text' ? p.text : JSON.stringify(p))).join(' ')
    ).length
  }
  return enc.encode(String(content ?? '')).length
}

/**
 * ฟังก์ชันนับ Token ทั้งหมดในอาเรย์ของข้อความ
 * Step 1: วนลูปผ่านข้อความทั้งหมด
 * Step 2: ระบุ role ของแต่ละข้อความ (user, assistant, system)
 * Step 3: นับ token ของ role และ content แล้วรวมกัน
 * Step 4: คืนค่าจำนวน token ทั้งหมด
 * 
 * หมายเหตุ: ไม่ export ฟังก์ชันนี้เพื่อหลีกเลี่ยง Next.js type error
 */
async function tiktokenCounter(messages: BaseMessage[]): Promise<number> {
  let total = 0
  for (const m of messages) {
    const role =
      m instanceof HumanMessage
        ? 'user'
        : m instanceof AIMessage
        ? 'assistant'
        : m instanceof SystemMessage
        ? 'system'
        : 'unknown'
    total += await strTokenCounter(role)
    total += await strTokenCounter(m.content)
  }
  return total
}

// ===============================================
// POST API: ส่งข้อความและรับการตอบกลับแบบ Stream
// ===============================================
/**
 * ฟังก์ชันหลักสำหรับจัดการ Chat
 * 
 * Flow การทำงาน:
 * 1. สร้าง/ใช้ Session ID
 * 2. โหลด Summary เดิมจากฐานข้อมูล
 * 3. ตั้งค่า AI Model
 * 4. โหลดและ Trim ประวัติการสนทนา
 * 5. สร้าง Prompt Template
 * 6. สร้าง Stream Response
 * 7. บันทึกข้อความลงฐานข้อมูล
 * 8. อัปเดต Summary
 * 9. ส่ง Response กลับ
 */
export async function POST(req: NextRequest) {
  try {
    // ===============================================
    // Step 1: รับข้อมูลจาก Request และเตรียม Session
    // ===============================================
    const { messages, sessionId, userId }: {
      messages: UIMessage[]
      sessionId?: string
      userId?: string
    } = await req.json()

    // ===============================================
    // Step 2: สร้าง Session ใหม่ถ้ายังไม่มี
    // ===============================================
    let currentSessionId = sessionId
    if (!currentSessionId) {
      const client = await pool.connect()
      try {
        // สร้างชื่อ session จากข้อความแรกของ user
        const firstMessage = messages.find(m => m.role === 'user')
        let title = 'New Chat'
        if (firstMessage && Array.isArray(firstMessage.parts) && firstMessage.parts.length > 0) {
          const textPart = firstMessage.parts.find(p => p.type === 'text')
          if (textPart && typeof textPart.text === 'string') {
            title = textPart.text.slice(0, 50) + (textPart.text.length > 50 ? '...' : '')
          }
        }
        
        // บันทึก session ใหม่ลงฐานข้อมูล
        if (!userId) throw new Error('User ID is required')
        const result = await client.query(
          'INSERT INTO chat_sessions (title, user_id) VALUES ($1, $2) RETURNING id',
          [title, userId]
        )
        currentSessionId = result.rows[0].id
      } finally {
        client.release()
      }
    }

    // ===============================================
    // Step 3: โหลด Summary เดิมจากฐานข้อมูล
    // ===============================================
    const clientForSummary = await pool.connect()
    let persistedSummary = ''
    try {
      const r = await clientForSummary.query(
        'SELECT summary FROM chat_sessions WHERE id = $1 LIMIT 1',
        [currentSessionId]
      )
      persistedSummary = r.rows?.[0]?.summary ?? ''
    } finally {
      clientForSummary.release()
    }

    // ===============================================
    // Step 4: ตั้งค่า AI Model (OpenAI GPT-4o-mini)
    // ===============================================
    const model = new ChatOpenAI({
      model: process.env.OPENAI_MODEL_NAME || "gpt-4o-mini",
      temperature: 0.1, // ลด temperature ให้ต่ำมากเพื่อให้ติดตาม instruction เข้มงวด
      maxTokens: 1000,
      streaming: true
    })

    // ===============================================
    // Step 5: โหลดประวัติการสนทนาและสร้าง Message History
    // ===============================================
    const messageHistory = new PostgresChatMessageHistory({
      sessionId: currentSessionId!,
      tableName: 'chat_messages',
      pool: pool
    })

    const fullHistory = await messageHistory.getMessages()
    
    // ===============================================
    // Step 6: ดึงข้อความล่าสุดจาก User
    // ===============================================
    const lastUserMessage = messages.filter(m => m.role === 'user').pop()
    let input = ''
    if (lastUserMessage && Array.isArray(lastUserMessage.parts) && lastUserMessage.parts.length > 0) {
      const textPart = lastUserMessage.parts.find(p => p.type === 'text')
      if (textPart) input = textPart.text
    }
    if (!input) return new Response('No valid user input found.', { status: 400 })

    // ===============================================
    // Step 7: จัดการ Message History และ Token Optimization
    // ===============================================
    /**
     * สำหรับ New Chat: ใช้ประวัติจากฐานข้อมูลเท่านั้น
     * สำหรับ Chat เดิม: ทำ trim และสร้าง summary สำหรับข้อความที่เกิน limit
     */
    let recentWindowWithoutCurrentInput: BaseMessage[] = []
    let overflowSummary = ''
    
    if (sessionId && fullHistory.length > 0) {
      // มี session เดิม - ทำ trim messages เพื่อประหยัด token
      const trimmedWindow = await trimMessages(fullHistory, {
        maxTokens: 1500,
        strategy: 'last',
        tokenCounter: tiktokenCounter
      })

      // กรองข้อความล่าสุดของ user ออกเพื่อไม่ให้ซ้ำ
      recentWindowWithoutCurrentInput = trimmedWindow.filter(msg => {
        if (msg instanceof HumanMessage && msg.content === input) {
          return false
        }
        return true
      })

      // สร้าง summary สำหรับข้อความที่ถูก trim ออกไป (overflow)
      const windowSet = new Set(trimmedWindow)
      const overflow = fullHistory.filter(m => !windowSet.has(m))
      if (overflow.length > 0) {
        const summarizerPrompt = ChatPromptTemplate.fromMessages([
          ['system', 'สรุปบทสนทนาให้สั้นที่สุด เป็นภาษาไทย เก็บเฉพาะสาระสำคัญ'],
          ['human', 'สรุปข้อความต่อไปนี้:\n\n{history}']
        ])
        const summarizer = summarizerPrompt.pipe(model).pipe(new StringOutputParser())
        const historyText = overflow
          .map(m => {
            if (m instanceof HumanMessage) return `ผู้ใช้: ${m.content}`
            if (m instanceof AIMessage) return `ผู้ช่วย: ${m.content}`
            return `ระบบ: ${String(m.content)}`
          })
          .join('\n')
        try {
          overflowSummary = await summarizer.invoke({ history: historyText })
        } catch (e) {
          console.warn('overflow summary failed', e)
        }
      }
    }

    // รวม summary เดิมกับ summary ของ overflow
    const summaryForThisTurn = [persistedSummary, overflowSummary].filter(Boolean).join('\n')

    // ===============================================
    // 🔄 MODIFIED Step 8: สร้าง RAG Chain แทน Agent
    // ===============================================
    const ragPrompt = ChatPromptTemplate.fromMessages([
      ['system', `คุณคือผู้ช่วย AI อัจฉริยะที่ตอบเป็นภาษาไทย 
      
      คุณมีข้อมูลจากเอกสารที่อัปโหลดไว้ในระบบ (PDF, CSV, TXT) เพื่อใช้ตอบคำถาม
      
      **หลักการตอบคำถาม:**
      - ใช้ข้อมูลจากเอกสารที่ให้มาในการตอบคำถาม
      - หากไม่มีข้อมูลที่เกี่ยวข้อง ให้บอกว่าไม่พบข้อมูลที่เกี่ยวข้อง
      - ห้ามเดาหรือสร้างข้อมูลขึ้นมาเอง ให้ใช้ข้อมูลจากเอกสารเท่านั้น
      - ตอบด้วยข้อมูลที่ถูกต้องและครบถ้วน
      
      บริบทการสนทนาก่อนหน้านี้โดยสรุปคือ: {summary}
      
      ข้อมูลจากเอกสารที่เกี่ยวข้อง:
      {context}`],
      new MessagesPlaceholder('chat_history'), // ประวัติการสนทนาก่อนหน้านี้
      ['human', '{input}']
    ])

    // สร้าง Chain โดยใช้ RAG
    const ragChain = ragPrompt.pipe(model).pipe(new StringOutputParser())

    // ===============================================
    // 🔄 MODIFIED Step 9: ค้นหาข้อมูลจากเอกสารและสร้าง Stream
    // ===============================================
    // ค้นหาเอกสารที่เกี่ยวข้องก่อน
    let documentContext = '';
    try {
      documentContext = await searchDocuments(input, 3); // ค้นหา 3 เอกสารที่เกี่ยวข้องที่สุด
    } catch (error) {
      console.warn('⚠️ ไม่สามารถค้นหาเอกสารได้:', error instanceof Error ? error.message : String(error));
      documentContext = 'ไม่สามารถเข้าถึงระบบค้นหาเอกสารได้ในขณะนี้';
    }

    // รวม summary เข้าไปเป็น chat history
    const chatHistoryForChain = [...recentWindowWithoutCurrentInput];
    if (summaryForThisTurn) {
        chatHistoryForChain.unshift(new SystemMessage(summaryForThisTurn));
    }

    // สร้าง Stream จาก Chain
    const stream = await ragChain.stream({
        input: input,
        chat_history: chatHistoryForChain,
        summary: summaryForThisTurn,
        context: documentContext
    });

    // ===============================================
    // Step 10: บันทึกข้อความของ User ลงฐานข้อมูล (เฉพาะเมื่อเชื่อมต่อได้)
    // ===============================================
    let canSaveToDatabase = true
    try {
      await messageHistory.addUserMessage(input)
    } catch (e) {
      console.warn('⚠️ ไม่สามารถบันทึกข้อความ user ลงฐานข้อมูลได้:', e instanceof Error ? e.message : String(e))
      canSaveToDatabase = false
    }
    
    // ===============================================
    // 🔄 MODIFIED Step 11: จัดการ Stream จาก Chain และบันทึกผลลัพธ์
    // ===============================================
    let assistantText = ''
    let hasSearchError = false // ตัวแปรเช็คว่ามี search error หรือไม่
    
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            // Chain stream จะส่ง string chunks ออกมา
            if (typeof chunk === 'string') {
              assistantText += chunk;
              
              // ตรวจสอบว่ามี search error หรือไม่
              if (chunk.includes('ไม่สามารถเข้าถึงระบบค้นหาเอกสารได้') || 
                  assistantText.includes('ไม่สามารถเข้าถึงระบบค้นหาเอกสารได้')) {
                hasSearchError = true;
                // แทนที่ error message ด้วยข้อความที่เป็นมิตร
                const friendlyMessage = 'ขออภัยครับ ขณะนี้ไม่สามารถเข้าถึงระบบค้นหาเอกสารได้ กรุณาลองใหม่อีกครั้งในภายหลัง';
                controller.enqueue(friendlyMessage);
                assistantText = friendlyMessage;
              } else {
                controller.enqueue(chunk);
              }
            }
          }
          
          // ===============================================
          // Step 12: บันทึกคำตอบของ AI ลงฐานข้อมูล (เฉพาะเมื่อไม่มี search error และเชื่อมต่อได้)
          // ===============================================
          if (assistantText && !hasSearchError && canSaveToDatabase) {
            try {
              await messageHistory.addMessage(new AIMessage(assistantText))
              
              // ===============================================
              // Step 13: อัปเดต Summary ถาวรในฐานข้อมูล
              // ===============================================
              const summarizerPrompt2 = ChatPromptTemplate.fromMessages([
                ['system', 'รวมสาระสำคัญให้สั้นที่สุด ภาษาไทย กระชับ'],
                ['human', 'นี่คือสรุปเดิม:\n{old}\n\nนี่คือข้อความใหม่:\n{delta}\n\nช่วยอัปเดตให้สั้นและครบถ้วน']
              ])
              const summarizer2 = summarizerPrompt2.pipe(model).pipe(new StringOutputParser())
              const updatedSummary = await summarizer2.invoke({
                old: persistedSummary || 'ไม่มีประวัติก่อนหน้า',
                delta: [overflowSummary, `ผู้ใช้: ${input}`, `ผู้ช่วย: ${assistantText}`].filter(Boolean).join('\n')
              })
              const clientUpdate = await pool.connect()
              try {
                await clientUpdate.query(
                  'UPDATE chat_sessions SET summary = $1 WHERE id = $2',
                  [updatedSummary, currentSessionId]
                )
              } finally {
                clientUpdate.release()
              }
            } catch (e) {
              console.warn('update summary failed', e)
            }
          } else if (hasSearchError || !canSaveToDatabase) {
            console.warn('🚫 ข้ามการบันทึกประวัติเนื่องจากมีปัญหาการเชื่อมต่อฐานข้อมูล')
          }
          
          controller.close()
        } catch (error) {
          controller.error(error)
        }
      }
    })

    // ===============================================
    // Step 14: ส่ง Response กลับไปยัง Client
    // ===============================================
    return createUIMessageStreamResponse({
      stream: toUIMessageStream(readable),
      headers: currentSessionId ? { 'x-session-id': currentSessionId } : undefined
    })
  } catch (error) {
    console.error('API Error:', error)
    return new Response(
      JSON.stringify({
        error: 'An error occurred while processing your request',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

// ===============================================
// GET API: ดึงประวัติการสนทนาจาก Session ID
// ===============================================
/**
 * ฟังก์ชันสำหรับดึงประวัติการสนทนาทั้งหมดของ Session
 * 
 * Flow การทำงาน:
 * 1. ตรวจสอบ Session ID
 * 2. Query ข้อมูลจากฐานข้อมูล
 * 3. แปลงข้อมูลให้อยู่ในรูปแบบที่ UI ต้องการ
 * 4. ส่งข้อมูลกลับ
 */
export async function GET(req: NextRequest) {
  try {
    // ===============================================
    // Step 1: ตรวจสอบ Session ID จาก URL Parameters
    // ===============================================
    const { searchParams } = new URL(req.url)
    const sessionId = searchParams.get('sessionId')
    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: 'Session ID is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // ===============================================
    // Step 2: Query ข้อมูลประวัติการสนทนาจากฐานข้อมูล
    // ===============================================
    const client = await pool.connect()
    try {
      const result = await client.query(
        `SELECT message, message->>'type' as message_type, created_at
         FROM chat_messages 
         WHERE session_id = $1 
         ORDER BY created_at ASC`,
        [sessionId]
      )
      
      // ===============================================
      // Step 3: แปลงข้อมูลให้อยู่ในรูปแบบที่ UI ต้องการ
      // ===============================================
      const messages = result.rows.map((row, i) => {
        const data = row.message
        let role = 'user'
        if (row.message_type === 'ai') role = 'assistant'
        else if (row.message_type === 'human') role = 'user'
        return {
          id: `history-${i}`,
          role,
          content: data.content || data.text || data.message || '',
          createdAt: row.created_at
        }
      })
      
      // ===============================================
      // Step 4: ส่งข้อมูลกลับ
      // ===============================================
      return new Response(JSON.stringify({ messages }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error fetching messages:', error)
    return new Response(
      JSON.stringify({
        error: 'Failed to fetch messages',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
```

#### 7. แก้ไข api endpoint
แก้ไขไฟล์ `src/constants/api.ts` โดยเพิ่ม endpoint ใหม่:
```typescript {.line-numbers}
export const API_BASE = '/api/chat_08_rag'
export const API_BASE_SESSION = '/api/chat_08_rag/session'
```

#### 8. สร้างไฟล์ api rag and tool calling
สร้างไฟล์ `src/app/api/chat_09_rag_tool_calling/route.ts` ด้วยโค้ดดังนี้:
```typescript {.line-numbers}
/**
 * ===============================================
 * API Route สำหรับ Chat (RAG + Agent with Tools Calling)
 * ===============================================
 *
 * ฟีเจอร์หลัก:
 * - 📚 RAG (Retrieval-Augmented Generation) with pgvector
 * - 🤖 Agent with Tool Calling (Supabase + Vector Search)
 * - 🗂️ เก็บประวัติการสนทนาใน PostgreSQL
 * - 🧠 ทำ Summary เพื่อประหยัด Token
 * - ✂️ Trim Messages เพื่อไม่ให้เกิน Token Limit
 * - 🌊 Streaming Response สำหรับ Real-time Chat
 * - 🔧 จัดการ Session ID อัตโนมัติ
 * 
 * Tools ที่มีให้ใช้งาน:
 * 1. search_documents - ค้นหาข้อมูลจากเอกสาร (PDF, CSV, TXT) ด้วย Vector Similarity
 * 2. get_product_info - ค้นหาข้อมูลสินค้าจากฐานข้อมูล
 * 3. get_sales_data - ดูประวัติการขาย
*/

import { NextRequest } from 'next/server'
import { getDatabase } from '@/lib/database'

// LangChain & AI SDK Imports
import { ChatOpenAI } from '@langchain/openai'
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts'
import { toUIMessageStream } from '@ai-sdk/langchain'
import { createUIMessageStreamResponse, UIMessage } from 'ai'
import { PostgresChatMessageHistory } from '@langchain/community/stores/message/postgres'
import { BaseMessage, AIMessage, HumanMessage, SystemMessage, MessageContent } from '@langchain/core/messages'
import { trimMessages } from '@langchain/core/messages'
import { StringOutputParser } from '@langchain/core/output_parsers'
import { encodingForModel } from '@langchain/core/utils/tiktoken'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { DynamicStructuredTool } from '@langchain/core/tools'
import { AgentExecutor, createOpenAIToolsAgent } from 'langchain/agents'

// ✨ NEW: Imports for Vector Search (Document RAG)
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase"
import { OpenAIEmbeddings } from "@langchain/openai"
import { CacheBackedEmbeddings } from "langchain/embeddings/cache_backed"
import { InMemoryStore } from "@langchain/core/stores"

export const dynamic = 'force-dynamic'
export const maxDuration = 30

// ===============================================
// ใช้ centralized database utility แทน pool ที่สร้างเอง
// ===============================================
const pool = getDatabase()

// สร้าง Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY!
)

// เพิ่ม datetime tool หลังจาก getSalesDataTool
const getCurrentDateTimeTool = new DynamicStructuredTool({
  name: "get_current_datetime",
  description: "ดูวันที่และเวลาปัจจุบัน สามารถระบุรูปแบบการแสดงผลได้",
  schema: z.object({
    format: z.enum(["full", "date", "time", "iso"]).optional().describe("รูปแบบการแสดงผล: full=เต็ม, date=วันที่อย่างเดียว, time=เวลาอย่างเดียว, iso=รูปแบบ ISO")
  }),
  func: async ({ format = "full" }) => {
    console.log(`🔧 TOOL CALLED: get_current_datetime with format="${format}"`);
    try {
      const now = new Date()
      const thailandTime = new Intl.DateTimeFormat('th-TH', {
        timeZone: 'Asia/Bangkok',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        weekday: 'long'
      })

      switch (format) {
        case "date":
          return `วันที่ปัจจุบัน: ${thailandTime.format(now).split(' ').slice(0, 4).join(' ')}`
        case "time":
          const timeOnly = thailandTime.format(now).split(' ').slice(-1)[0]
          return `เวลาปัจจุบัน: ${timeOnly} น.`
        case "iso":
          return `วันที่และเวลาในรูปแบบ ISO: ${now.toISOString()}`
        case "full":
        default:
          return `วันที่และเวลาปัจจุบัน: ${thailandTime.format(now)} (เขตเวลาประเทศไทย)`
      }
    } catch (error) {
      console.error('Error getting datetime:', error)
      return `เกิดข้อผิดพลาดในการดึงข้อมูลวันที่และเวลา: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
})

// ===============================================
// ✨ NEW: สร้าง Vector Store สำหรับ Document Search
// ===============================================
async function createVectorStore() {
  const baseEmbeddings = new OpenAIEmbeddings({ 
    model: process.env.OPENAI_EMBEDDING_MODEL_NAME || "text-embedding-3-small",
    dimensions: 1536
  });

  // สร้าง Cache-backed embeddings เพื่อลดต้นทุนและเพิ่มความเร็ว
  const cacheStore = new InMemoryStore();
  const embeddings = CacheBackedEmbeddings.fromBytesStore(
    baseEmbeddings,
    cacheStore,
    {
      namespace: "rag_embeddings" // namespace สำหรับ RAG
    }
  );

  return new SupabaseVectorStore(embeddings, {
    client: supabase,
    tableName: 'documents',
    queryName: 'match_documents'
  });
}

// ===============================================
// ✨ NEW: สร้าง Tools สำหรับคุยกับ Supabase และ Vector Search
// ===============================================

// สร้าง Tool สำหรับค้นหาเอกสารจาก Vector Store
const searchDocumentsTool = new DynamicStructuredTool({
    name: "search_documents",
    description: "ค้นหาข้อมูลจากเอกสารที่เก็บไว้ในระบบ เช่น ข้อมูลร้าน, สินค้า, การขาย, หรือข้อมูลอื่นๆ ที่อัปโหลดไว้ในรูปแบบ PDF, CSV, TXT",
    schema: z.object({
      query: z.string().describe("คำค้นหาสำหรับค้นหาข้อมูลในเอกสาร เช่น 'ข้อมูลร้าน', 'สินค้า', 'ราคา', 'การขาย' เป็นต้น"),
      limit: z.number().optional().default(200).describe("จำนวนผลลัพธ์ที่ต้องการ (ค่าเริ่มต้น 200)")
    }),
    func: async ({ query, limit = 200 }) => {
      console.log(`🔧 TOOL CALLED: search_documents with query="${query}", limit=${limit}`);
      try {
        // สร้าง vector store
        const vectorStore = await createVectorStore();
        
        // ค้นหาเอกสารที่เกี่ยวข้อง
        const results = await vectorStore.similaritySearchWithScore(query, limit);
        
        if (!results || results.length === 0) {
          return `ไม่พบเอกสารที่เกี่ยวข้องกับ "${query}" ในระบบ`;
        }
        
        console.log(`✅ พบเอกสารที่เกี่ยวข้อง: ${results.length} รายการ`);
        
        // จัดรูปแบบผลลัพธ์
        if (results.length === 1) {
          const [doc, score] = results[0];
          const filename = doc.metadata?.filename || 'ไม่ทราบชื่อไฟล์';
          const type = doc.metadata?.type || 'ไม่ทราบประเภท';
          
          return `พบข้อมูลที่เกี่ยวข้องกับ "${query}":

**ไฟล์:** ${filename} (${type.toUpperCase()})
**เนื้อหา:** ${doc.pageContent}
**ความเกี่ยวข้อง:** ${(score * 100).toFixed(1)}%`;
        } else {
          // หลายผลลัพธ์ - แสดงเป็นรายการ
          const resultList = results.map(([doc, score], index) => {
            const filename = doc.metadata?.filename || 'ไม่ทราบชื่อไฟล์';
            const type = doc.metadata?.type || 'ไม่ทราบประเภท';
            const preview = doc.pageContent.length > 200 ? 
              doc.pageContent.substring(0, 200) + '...' : 
              doc.pageContent;
            
            return `**${index + 1}. ${filename}** (${type.toUpperCase()}) - ความเกี่ยวข้อง: ${(score * 100).toFixed(1)}%
${preview}`;
          }).join('\n\n');
          
          return `พบข้อมูลที่เกี่ยวข้องกับ "${query}" จำนวน ${results.length} รายการ:

${resultList}`;
        }
      } catch (e: unknown) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        console.log('❌ Tool error:', errorMessage);
        
        if (errorMessage.includes('connection') || 
            errorMessage.includes('network') || 
            errorMessage.includes('timeout')) {
          return `ขออภัยครับ ไม่สามารถเข้าถึงระบบค้นหาเอกสารได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง`;
        }
        
        return `เกิดข้อผิดพลาดในการค้นหาเอกสาร: ${errorMessage}`;
      }
    },
})

// สร้าง Tool สำหรับค้นหาข้อมูลสินค้า (เดิม)
const getProductInfoTool = new DynamicStructuredTool({
    name: "get_product_info",
    description: "ค้นหาข้อมูลสินค้าจากฐานข้อมูล รวมถึงราคาและจำนวนคงคลัง (stock) โดยรับชื่อสินค้าเป็น input",
    schema: z.object({
      productName: z.string().describe("ชื่อของสินค้าที่ต้องการค้นหา เช่น 'MacBook Pro M3', 'iPhone', 'iPad' เป็นต้น"),
    }),
    func: async ({ productName }) => {
      console.log(`🔧 TOOL CALLED: get_product_info with productName="${productName}"`);
      try {
        // ตรวจสอบการเชื่อมต่อฐานข้อมูล
        const { data, error } = await supabase
          .from("products")
          .select("name, price, stock, description")
          .ilike("name", `%${productName}%`)
          .limit(5); // จำกัดผลลัพธ์ไม่เกิน 5 รายการ
          // .single(); // .single() จะคืนค่า object เดียว หรือ error ถ้าเจอหลายรายการ/ไม่เจอ
        
        if (error) {
          console.log('❌ Supabase error:', error.message);
          // ตรวจสอบว่าเป็น connection error หรือไม่
          if (error.message.includes('connection') || error.message.includes('network') || error.message.includes('timeout')) {
            throw new Error('DATABASE_CONNECTION_ERROR');
          }
          throw new Error(error.message);
        }
        
        if (!data || data.length === 0) {
          console.log(`❌ ไม่พบสินค้าที่ชื่อ '${productName}'`);
          return `ไม่พบสินค้าที่ชื่อ '${productName}' ในฐานข้อมูล`;
        }
        
        console.log('✅ พบข้อมูลสินค้า:', data);
        
        // หากพบหลายสินค้า ให้แสดงรายการทั้งหมด
        if (data.length === 1) {
          const product = data[0];
          return `ข้อมูลสินค้า "${product.name}":
- ราคา: ${product.price} บาท
- จำนวนในสต็อก: ${product.stock} ชิ้น
- รายละเอียด: ${product.description}`;
        } else {
          // แสดงรายการสินค้าทั้งหมดที่พบในรูปแบบตาราง Markdown
          const tableHeader = `| ชื่อสินค้า | ราคา (บาท) | สต็อก (ชิ้น) | รายละเอียด |
|----------|------------|-------------|------------|`;
          
          const tableRows = data.map(product => 
            `| ${product.name} | ${product.price.toLocaleString()} | ${product.stock} | ${product.description} |`
          ).join('\n');
          
          return `พบสินค้าที่ตรงกับคำค้นหา "${productName}" ทั้งหมด ${data.length} รายการ:

${tableHeader}
${tableRows}`;
        }
      } catch (e: unknown) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        console.log('❌ Tool error:', errorMessage);
        
        // ตรวจสอบว่าเป็น database connection error หรือไม่
        if (errorMessage === 'DATABASE_CONNECTION_ERROR' || 
            errorMessage.includes('connection') || 
            errorMessage.includes('network') || 
            errorMessage.includes('timeout')) {
          throw new Error('DATABASE_CONNECTION_ERROR');
        }
        
        return `เกิดข้อผิดพลาดในการดึงข้อมูลสินค้า: ${errorMessage}`;
      }
    },
})

// สร้าง Tool สำหรับดูข้อมูลการขาย
const getSalesDataTool = new DynamicStructuredTool({
    name: "get_sales_data",
    description: "ใช้ tool นี้เพื่อดูประวัติการขายของสินค้า. รับ input เป็นชื่อสินค้า.",
    schema: z.object({
      productName: z.string().describe("ชื่อของสินค้าที่ต้องการดูข้อมูลการขาย"),
    }),
    func: async ({ productName }) => {
      console.log(`TOOL CALLED: get_sales_data with productName=${productName}`);
      try {
        const { data: product, error: productError } = await supabase
          .from("products").select("id").ilike("name", `%${productName}%`).single();
        if (productError) {
          // ตรวจสอบว่าเป็น connection error หรือไม่
          if (productError.message.includes('connection') || productError.message.includes('network') || productError.message.includes('timeout')) {
            throw new Error('DATABASE_CONNECTION_ERROR');
          }
          throw new Error(productError.message);
        }
        if (!product) return `ไม่พบสินค้าที่ชื่อ '${productName}'`;
        
        const { data: sales, error: salesError } = await supabase
          .from("sales").select("sale_date, quantity_sold, total_price").eq("product_id", product.id);
        if (salesError) {
          // ตรวจสอบว่าเป็น connection error หรือไม่
          if (salesError.message.includes('connection') || salesError.message.includes('network') || salesError.message.includes('timeout')) {
            throw new Error('DATABASE_CONNECTION_ERROR');
          }
          throw new Error(salesError.message);
        }
        if (!sales || sales.length === 0) return `ยังไม่มีข้อมูลการขายสำหรับสินค้า '${productName}'`;
        
        // หากมีรายการเดียว แสดงแบบง่าย
        if (sales.length === 1) {
          const sale = sales[0];
          return `ประวัติการขายของสินค้า "${productName}":
                  - วันที่ขาย: ${new Date(sale.sale_date).toLocaleDateString('th-TH')}
                  - จำนวนที่ขาย: ${sale.quantity_sold} ชิ้น
                  - ยอดขาย: ${sale.total_price.toLocaleString()} บาท`;
        } else {
          // หากมีหลายรายการ แสดงเป็นตาราง Markdown
          const tableHeader = `| วันที่ขาย | จำนวนที่ขาย (ชิ้น) | ยอดขาย (บาท) |
|-----------|-------------------|---------------|`;
          
          const tableRows = sales.map(sale => 
            `| ${new Date(sale.sale_date).toLocaleDateString('th-TH')} | ${sale.quantity_sold} | ${sale.total_price.toLocaleString()} |`
          ).join('\n');
          
          const totalQuantity = sales.reduce((sum, sale) => sum + sale.quantity_sold, 0);
          const totalSales = sales.reduce((sum, sale) => sum + parseFloat(sale.total_price), 0);
          
          return `ประวัติการขายของสินค้า "${productName}" ทั้งหมด ${sales.length} รายการ:

${tableHeader}
${tableRows}

**สรุป:**
- ขายรวม: ${totalQuantity} ชิ้น
- ยอดขายรวม: ${totalSales.toLocaleString()} บาท`;
        }
      } catch (e: unknown) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        
        // ตรวจสอบว่าเป็น database connection error หรือไม่
        if (errorMessage === 'DATABASE_CONNECTION_ERROR' || 
            errorMessage.includes('connection') || 
            errorMessage.includes('network') || 
            errorMessage.includes('timeout')) {
          throw new Error('DATABASE_CONNECTION_ERROR');
        }
        
        return `เกิดข้อผิดพลาดในการดึงข้อมูลการขาย: ${errorMessage}`;
      }
    },
})

const tools = [searchDocumentsTool, getProductInfoTool, getSalesDataTool,getCurrentDateTimeTool];

// ===============================================
// ฟังก์ชันสำหรับนับ Token (Tiktoken)
// ===============================================

/**
 * Type สำหรับ Encoder ที่ใช้นับ Token
 */
type Encoding = {
  encode: (text: string) => number[]
  free?: () => void
}

let encPromise: Promise<Encoding> | undefined

/**
 * ฟังก์ชันสำหรับขอ Encoder
 * Step 1: พยายามใช้ gpt-4o-mini ก่อน
 * Step 2: ถ้าไม่ได้ให้ fallback เป็น gpt-4
 * Step 3: Cache Encoder เพื่อไม่ต้องสร้างใหม่
 */
async function getEncoder(): Promise<Encoding> {
  if (!encPromise) {
    encPromise = encodingForModel("gpt-4o-mini").catch(() =>
      encodingForModel("gpt-4")
    )
  }
  return encPromise
}

/**
 * ฟังก์ชันนับ Token ของข้อความแต่ละอัน
 * Step 1: ตรวจสอบประเภทของ content (string, array, หรืออื่นๆ)
 * Step 2: แปลงเป็น string และนับ token
 * Step 3: คืนค่าจำนวน token
 */
async function strTokenCounter(content: MessageContent): Promise<number> {
  const enc = await getEncoder()
  if (typeof content === 'string') return enc.encode(content).length
  if (Array.isArray(content)) {
    return enc.encode(
      content.map(p => (p.type === 'text' ? p.text : JSON.stringify(p))).join(' ')
    ).length
  }
  return enc.encode(String(content ?? '')).length
}

/**
 * ฟังก์ชันนับ Token ทั้งหมดในอาเรย์ของข้อความ
 * Step 1: วนลูปผ่านข้อความทั้งหมด
 * Step 2: ระบุ role ของแต่ละข้อความ (user, assistant, system)
 * Step 3: นับ token ของ role และ content แล้วรวมกัน
 * Step 4: คืนค่าจำนวน token ทั้งหมด
 * 
 * หมายเหตุ: ไม่ export ฟังก์ชันนี้เพื่อหลีกเลี่ยง Next.js type error
 */
async function tiktokenCounter(messages: BaseMessage[]): Promise<number> {
  let total = 0
  for (const m of messages) {
    const role =
      m instanceof HumanMessage
        ? 'user'
        : m instanceof AIMessage
        ? 'assistant'
        : m instanceof SystemMessage
        ? 'system'
        : 'unknown'
    total += await strTokenCounter(role)
    total += await strTokenCounter(m.content)
  }
  return total
}

// ===============================================
// POST API: ส่งข้อความและรับการตอบกลับแบบ Stream
// ===============================================
/**
 * ฟังก์ชันหลักสำหรับจัดการ Chat
 * 
 * Flow การทำงาน:
 * 1. สร้าง/ใช้ Session ID
 * 2. โหลด Summary เดิมจากฐานข้อมูล
 * 3. ตั้งค่า AI Model
 * 4. โหลดและ Trim ประวัติการสนทนา
 * 5. สร้าง Prompt Template
 * 6. สร้าง Stream Response
 * 7. บันทึกข้อความลงฐานข้อมูล
 * 8. อัปเดต Summary
 * 9. ส่ง Response กลับ
 */
export async function POST(req: NextRequest) {
  try {
    // ===============================================
    // Step 1: รับข้อมูลจาก Request และเตรียม Session
    // ===============================================
    const { messages, sessionId, userId }: {
      messages: UIMessage[]
      sessionId?: string
      userId?: string
    } = await req.json()

    // ===============================================
    // Step 2: สร้าง Session ใหม่ถ้ายังไม่มี
    // ===============================================
    let currentSessionId = sessionId
    if (!currentSessionId) {
      const client = await pool.connect()
      try {
        // สร้างชื่อ session จากข้อความแรกของ user
        const firstMessage = messages.find(m => m.role === 'user')
        let title = 'New Chat'
        if (firstMessage && Array.isArray(firstMessage.parts) && firstMessage.parts.length > 0) {
          const textPart = firstMessage.parts.find(p => p.type === 'text')
          if (textPart && typeof textPart.text === 'string') {
            title = textPart.text.slice(0, 50) + (textPart.text.length > 50 ? '...' : '')
          }
        }
        
        // บันทึก session ใหม่ลงฐานข้อมูล
        if (!userId) throw new Error('User ID is required')
        const result = await client.query(
          'INSERT INTO chat_sessions (title, user_id) VALUES ($1, $2) RETURNING id',
          [title, userId]
        )
        currentSessionId = result.rows[0].id
      } finally {
        client.release()
      }
    }

    // ===============================================
    // Step 3: โหลด Summary เดิมจากฐานข้อมูล
    // ===============================================
    const clientForSummary = await pool.connect()
    let persistedSummary = ''
    try {
      const r = await clientForSummary.query(
        'SELECT summary FROM chat_sessions WHERE id = $1 LIMIT 1',
        [currentSessionId]
      )
      persistedSummary = r.rows?.[0]?.summary ?? ''
    } finally {
      clientForSummary.release()
    }

    // ===============================================
    // Step 4: ตั้งค่า AI Model (OpenAI GPT-4o-mini)
    // ===============================================
    const model = new ChatOpenAI({
      model: 'gpt-4o-mini',
      temperature: 0.1, // ลด temperature ให้ต่ำมากเพื่อให้ติดตาม instruction เข้มงวด
      maxTokens: 1000,
      streaming: true
    })

    // ===============================================
    // Step 5: โหลดประวัติการสนทนาและสร้าง Message History
    // ===============================================
    const messageHistory = new PostgresChatMessageHistory({
      sessionId: currentSessionId!,
      tableName: 'chat_messages',
      pool: pool
    })

    const fullHistory = await messageHistory.getMessages()
    
    // ===============================================
    // Step 6: ดึงข้อความล่าสุดจาก User
    // ===============================================
    const lastUserMessage = messages.filter(m => m.role === 'user').pop()
    let input = ''
    if (lastUserMessage && Array.isArray(lastUserMessage.parts) && lastUserMessage.parts.length > 0) {
      const textPart = lastUserMessage.parts.find(p => p.type === 'text')
      if (textPart) input = textPart.text
    }
    if (!input) return new Response('No valid user input found.', { status: 400 })

    // ===============================================
    // Step 7: จัดการ Message History และ Token Optimization
    // ===============================================
    /**
     * สำหรับ New Chat: ใช้ประวัติจากฐานข้อมูลเท่านั้น
     * สำหรับ Chat เดิม: ทำ trim และสร้าง summary สำหรับข้อความที่เกิน limit
     */
    let recentWindowWithoutCurrentInput: BaseMessage[] = []
    let overflowSummary = ''
    
    if (sessionId && fullHistory.length > 0) {
      // มี session เดิม - ทำ trim messages เพื่อประหยัด token
      const trimmedWindow = await trimMessages(fullHistory, {
        maxTokens: 1500,
        strategy: 'last',
        tokenCounter: tiktokenCounter
      })

      // กรองข้อความล่าสุดของ user ออกเพื่อไม่ให้ซ้ำ
      recentWindowWithoutCurrentInput = trimmedWindow.filter(msg => {
        if (msg instanceof HumanMessage && msg.content === input) {
          return false
        }
        return true
      })

      // สร้าง summary สำหรับข้อความที่ถูก trim ออกไป (overflow)
      const windowSet = new Set(trimmedWindow)
      const overflow = fullHistory.filter(m => !windowSet.has(m))
      if (overflow.length > 0) {
        const summarizerPrompt = ChatPromptTemplate.fromMessages([
          ['system', 'สรุปบทสนทนาให้สั้นที่สุด เป็นภาษาไทย เก็บเฉพาะสาระสำคัญ'],
          ['human', 'สรุปข้อความต่อไปนี้:\n\n{history}']
        ])
        const summarizer = summarizerPrompt.pipe(model).pipe(new StringOutputParser())
        const historyText = overflow
          .map(m => {
            if (m instanceof HumanMessage) return `ผู้ใช้: ${m.content}`
            if (m instanceof AIMessage) return `ผู้ช่วย: ${m.content}`
            return `ระบบ: ${String(m.content)}`
          })
          .join('\n')
        try {
          overflowSummary = await summarizer.invoke({ history: historyText })
        } catch (e) {
          console.warn('overflow summary failed', e)
        }
      }
    }

    // รวม summary เดิมกับ summary ของ overflow
    const summaryForThisTurn = [persistedSummary, overflowSummary].filter(Boolean).join('\n')

    // ===============================================
    // 🔄 MODIFIED Step 8: สร้าง Agent แทน Chain เดิม
    // ===============================================
    const agentPrompt = ChatPromptTemplate.fromMessages([
      ['system', `คุณคือผู้ช่วย AI อัจฉริยะที่ตอบเป็นภาษาไทย 
      
      คุณมี tools ที่สามารถใช้ได้ ได้แก่:
      1. **search_documents** - สำหรับค้นหาข้อมูลจากเอกสารที่อัปโหลดไว้ในระบบ (PDF, CSV, TXT)
      2. **get_product_info** - สำหรับค้นหาข้อมูลสินค้า ราคา และจำนวนในสต็อกจากฐานข้อมูล
      3. **get_sales_data** - สำหรับดูประวัติการขาย
      4. **get_current_datetime** - สำหรับดูวันที่และเวลาปัจจุบัน
      
      **กฎการใช้ tools:**
      
      **สำหรับคำถามเกี่ยวกับข้อมูลทั่วไป เช่น:**
      - ข้อมูลร้าน (ที่อยู่, เบอร์โทร, เวลาเปิด-ปิด)
      - ข้อมูลบริษัท
      - นโยบาย การบริการ
      - ข้อมูลที่อัปโหลดไว้ในรูปแบบเอกสาร
      **→ ใช้ search_documents**
      
      **สำหรับคำถามเกี่ยวกับสินค้าเฉพาะ เช่น:**
      - "Gaming Mouse ราคาเท่าไหร่?"
      - "iPhone มีในสต็อกไหม?"
      - สินค้าที่ระบุชื่อชัดเจน
      **→ ใช้ get_product_info**
      
      **สำหรับคำถามเกี่ยวกับการขาย เช่น:**
      - "Gaming Mouse ขายไปแล้วกี่ชิ้น?"
      - ประวัติการขาย
      **→ ใช้ get_sales_data**
      
      **หลักการตอบคำถาม:**
      - หากไม่แน่ใจว่าควรใช้ tool ไหน ให้ลองใช้ search_documents ก่อน
      - ถ้าผู้ใช้ถามแบบทั่วๆ เช่น "บอกข้อมูลร้าน" ให้ใช้ search_documents
      - ถ้าผู้ใช้ถามสินค้าเฉพาะ ให้ใช้ get_product_info
      - ห้ามเดาหรือสร้างข้อมูลขึ้นมาเอง ให้ใช้ข้อมูลจาก tools เท่านั้น
      
      สำหรับการค้นหาสินค้า:
      - หากผู้ใช้ใช้คำที่อาจมีความหมายคล้าย ให้ลองค้นหาด้วยคำที่เกี่ยวข้อง
      - เช่น "เมาส์" ลองค้นหาด้วย "mouse", "gaming mouse", "เมาส์เกม"
      - เช่น "แมคบุ๊ค" ลองค้นหาด้วย "MacBook", "Mac"
      - เช่น "กาแฟ" ลองค้นหาด้วย "coffee", "espresso"

      สำหรับวันที่และเวลา:
      - เมื่อผู้ใช้ถามเกี่ยวกับเวลา วันที่ ให้ใช้ tool get_current_datetime
      - สามารถระบุ format ได้: full, date, time, iso
      - ตัวอย่างคำถาม: "วันนี้วันที่เท่าไหร่", "ตอนนี้กี่โมงแล้ว", "เวลาปัจจุบัน"
      
      หากเกิด DATABASE_CONNECTION_ERROR ให้ตอบว่า "ขออภัยครับ ขณะนี้ไม่สามารถเข้าถึงฐานข้อมูลได้ กรุณาลองใหม่อีกครั้งในภายหลัง"
      
      บริบทการสนทนาก่อนหน้านี้โดยสรุปคือ: {summary}`],
      new MessagesPlaceholder('chat_history'), // ประวัติการสนทนาก่อนหน้านี้
      ['human', '{input}'],
      new MessagesPlaceholder('agent_scratchpad'), // พื้นที่ให้ Agent จดบันทึกการใช้ tool
    ])

    // สร้าง Agent โดยใช้ Tools ที่เตรียมไว้
    const agent = await createOpenAIToolsAgent({
      llm: model,
      tools,
      prompt: agentPrompt,
    })

    const agentExecutor = new AgentExecutor({
      agent,
      tools,
      verbose: false, // true เปิด verbose mode เพื่อดู debug logs
      maxIterations: 5, // จำกัดจำนวนรอบการทำงาน
      returnIntermediateSteps: false, // ไม่ต้องแสดงขั้นตอนกลาง
    })

    // ===============================================
    // 🔄 MODIFIED Step 9: สร้าง Stream จาก Agent
    // ===============================================
    // รวม summary เข้าไปเป็น system message เพื่อให้ agent รับรู้บริบท
    const chatHistoryForAgent = [...recentWindowWithoutCurrentInput];
    if (summaryForThisTurn) {
        // หากมี summary ให้ใส่ไว้เป็นข้อความแรกสุดเพื่อให้ agent เห็นเป็นบริบทสำคัญ
        chatHistoryForAgent.unshift(new SystemMessage(summaryForThisTurn));
    }

    // สร้าง Stream จาก Agent
    const stream = await agentExecutor.stream({
        input: input,
        chat_history: chatHistoryForAgent,
        summary: summaryForThisTurn // เพิ่ม summary เข้าไปใน prompt
    });

    // ===============================================
    // Step 10: บันทึกข้อความของ User ลงฐานข้อมูล (เฉพาะเมื่อเชื่อมต่อได้)
    // ===============================================
    let canSaveToDatabase = true
    try {
      await messageHistory.addUserMessage(input)
    } catch (e) {
      console.warn('⚠️ ไม่สามารถบันทึกข้อความ user ลงฐานข้อมูลได้:', e instanceof Error ? e.message : String(e))
      canSaveToDatabase = false
    }
    
    // ===============================================
    // 🔄 MODIFIED Step 11: จัดการ Stream จาก Agent และบันทึกผลลัพธ์
    // ===============================================
    let assistantText = ''
    let hasDatabaseError = false // ตัวแปรเช็คว่ามี database error หรือไม่
    
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            // Agent stream จะส่ง object ที่มี key ต่างๆ ออกมา
            // เราสนใจเฉพาะ key 'output' ซึ่งเป็นคำตอบสุดท้าย
            if (chunk.output) {
              assistantText += chunk.output;
              
              // ตรวจสอบว่ามี database connection error หรือไม่
              if (chunk.output.includes('ไม่สามารถเข้าถึงฐานข้อมูลได้') || 
                  assistantText.includes('DATABASE_CONNECTION_ERROR')) {
                hasDatabaseError = true;
                // แทนที่ error message ด้วยข้อความที่เป็นมิตร
                const friendlyMessage = 'ขออภัยครับ ขณะนี้ไม่สามารถเข้าถึงฐานข้อมูลได้ กรุณาลองใหม่อีกครั้งในภายหลัง';
                controller.enqueue(friendlyMessage);
                assistantText = friendlyMessage;
              } else {
                controller.enqueue(chunk.output);
              }
            }
          }
          
          // ===============================================
          // Step 12: บันทึกคำตอบของ AI ลงฐานข้อมูล (เฉพาะเมื่อไม่มี database error และเชื่อมต่อได้)
          // ===============================================
          if (assistantText && !hasDatabaseError && canSaveToDatabase) {
            try {
              await messageHistory.addMessage(new AIMessage(assistantText))
              
              // ===============================================
              // Step 13: อัปเดต Summary ถาวรในฐานข้อมูล
              // ===============================================
              const summarizerPrompt2 = ChatPromptTemplate.fromMessages([
                ['system', 'รวมสาระสำคัญให้สั้นที่สุด ภาษาไทย กระชับ'],
                ['human', 'นี่คือสรุปเดิม:\n{old}\n\nนี่คือข้อความใหม่:\n{delta}\n\nช่วยอัปเดตให้สั้นและครบถ้วน']
              ])
              const summarizer2 = summarizerPrompt2.pipe(model).pipe(new StringOutputParser())
              const updatedSummary = await summarizer2.invoke({
                old: persistedSummary || 'ไม่มีประวัติก่อนหน้า',
                delta: [overflowSummary, `ผู้ใช้: ${input}`, `ผู้ช่วย: ${assistantText}`].filter(Boolean).join('\n')
              })
              const clientUpdate = await pool.connect()
              try {
                await clientUpdate.query(
                  'UPDATE chat_sessions SET summary = $1 WHERE id = $2',
                  [updatedSummary, currentSessionId]
                )
              } finally {
                clientUpdate.release()
              }
            } catch (e) {
              console.warn('update summary failed', e)
            }
          } else if (hasDatabaseError || !canSaveToDatabase) {
            console.warn('🚫 ข้ามการบันทึกประวัติเนื่องจากมีปัญหาการเชื่อมต่อฐานข้อมูล')
          }
          
          controller.close()
        } catch (error) {
          controller.error(error)
        }
      }
    })

    // ===============================================
    // Step 14: ส่ง Response กลับไปยัง Client
    // ===============================================
    return createUIMessageStreamResponse({
      stream: toUIMessageStream(readable),
      headers: currentSessionId ? { 'x-session-id': currentSessionId } : undefined
    })
  } catch (error) {
    console.error('API Error:', error)
    return new Response(
      JSON.stringify({
        error: 'An error occurred while processing your request',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

// ===============================================
// GET API: ดึงประวัติการสนทนาจาก Session ID
// ===============================================
/**
 * ฟังก์ชันสำหรับดึงประวัติการสนทนาทั้งหมดของ Session
 * 
 * Flow การทำงาน:
 * 1. ตรวจสอบ Session ID
 * 2. Query ข้อมูลจากฐานข้อมูล
 * 3. แปลงข้อมูลให้อยู่ในรูปแบบที่ UI ต้องการ
 * 4. ส่งข้อมูลกลับ
 */
export async function GET(req: NextRequest) {
  try {
    // ===============================================
    // Step 1: ตรวจสอบ Session ID จาก URL Parameters
    // ===============================================
    const { searchParams } = new URL(req.url)
    const sessionId = searchParams.get('sessionId')
    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: 'Session ID is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // ===============================================
    // Step 2: Query ข้อมูลประวัติการสนทนาจากฐานข้อมูล
    // ===============================================
    const client = await pool.connect()
    try {
      const result = await client.query(
        `SELECT message, message->>'type' as message_type, created_at
         FROM chat_messages 
         WHERE session_id = $1 
         ORDER BY created_at ASC`,
        [sessionId]
      )
      
      // ===============================================
      // Step 3: แปลงข้อมูลให้อยู่ในรูปแบบที่ UI ต้องการ
      // ===============================================
      const messages = result.rows.map((row, i) => {
        const data = row.message
        let role = 'user'
        if (row.message_type === 'ai') role = 'assistant'
        else if (row.message_type === 'human') role = 'user'
        return {
          id: `history-${i}`,
          role,
          content: data.content || data.text || data.message || '',
          createdAt: row.created_at
        }
      })
      
      // ===============================================
      // Step 4: ส่งข้อมูลกลับ
      // ===============================================
      return new Response(JSON.stringify({ messages }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error fetching messages:', error)
    return new Response(
      JSON.stringify({
        error: 'Failed to fetch messages',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
```
#### 9. แก้ไข api endpoint
แก้ไขไฟล์ `src/constants/api.ts` โดยเพิ่ม endpoint ใหม่:
```typescript {.line-numbers}
export const API_BASE = '/api/chat_09_rag_tool_calling'
export const API_BASE_SESSION = '/api/chat_09_rag_tool_calling/session'
```

---

### 🚀 การใช้งาน RAG

#### API Endpoint
```
POST /api/chat_08_rag
```

#### Request Format
```json
{
  "messages": [
    {
      "id": "1",
      "role": "user",
      "parts": [{"type": "text", "text": "ร้านอยู่ที่ไหน?"}]
    }
  ],
  "sessionId": "session-uuid", // optional
  "userId": "user-uuid"       // required
}
```
#### Response
- Streaming response ผ่าน Server-Sent Events
- Agent จะเลือกใช้ tool ที่เหมาะสม
- รวมผลลัพธ์จากหลาย tools ได้

### 📝 ตัวอย่างการใช้งาน

#### 1. ค้นหาข้อมูลร้าน (search_documents)

**User:** "ร้านอยู่ที่ไหน?"

**Agent การทำงาน:**
1. เลือกใช้ `search_documents` tool
2. ค้นหาใน pgvector ด้วย query "ร้านอยู่ที่ไหน"
3. พบข้อมูลจาก `information.txt`

**Response:**
```
พบข้อมูลที่เกี่ยวข้องกับ "ร้านอยู่ที่ไหน":

**ไฟล์:** information.txt (TXT)
**เนื้อหา:** ชื่อร้าน: เทคโนโลยี สมาร์ท สโตร์
ที่อยู่: 123 ถนนเทคโนโลยี แขวงนวัตกรรม เขตดิจิทัล กรุงเทพมหานคร 10400
โทรศัพท์: 02-123-4567
**ความเกี่ยวข้อง:** 89.5%
```
#### 2. ค้นหาข้อมูลสินค้า (get_product_info)

**User:** "Gaming Mouse ราคาเท่าไหร่?"

**Agent การทำงาน:**
1. เลือกใช้ `get_product_info` tool
2. Query ฐานข้อมูล products table
3. พบข้อมูลสินค้า

**Response:**
```
ข้อมูลสินค้า "Gaming Mouse":
- ราคา: 79,900 บาท
- จำนวนในสต็อก: 15 ชิ้น
- รายละเอียด: แล็ปท็อปประสิทธิภาพสูงสำหรับมือโปร
```

#### 3. ค้นหาข้อมูลการขาย (get_sales_data)

**User:** "Gaming Mouse ขายไปแล้วกี่ชิ้น?"

**Agent การทำงาน:**
1. เลือกใช้ `get_sales_data` tool
2. Query ฐานข้อมูล sales table
3. สรุปยอดขาย

**Response:**
```
ประวัติการขายของสินค้า "Gaming Mouse" ทั้งหมด 3 รายการ:

| วันที่ขาย | จำนวนที่ขาย (ชิ้น) | ยอดขาย (บาท) |
|-----------|-------------------|---------------|
| 1/12/2567 | 2 | 159,800 |
| 15/12/2567 | 1 | 79,900 |
| 20/12/2567 | 1 | 79,900 |

**สรุป:**
- ขายรวม: 4 ชิ้น
- ยอดขายรวม: 319,600 บาท
```

#### 4. คำถามแบบผสม

**User:** "อยากทราบข้อมูลร้านและราคา Gaming Mouse"

**Agent การทำงาน:**
1. ใช้ `search_documents` หาข้อมูลร้าน
2. ใช้ `get_product_info` หาราคา Gaming Mouse
3. รวมผลลัพธ์ทั้งสอง

**Response:**
```
**ข้อมูลร้าน:**
ชื่อร้าน: เทคโนโลยี สมาร์ท สโตร์
ที่อยู่: 123 ถนนเทคโนโลยี แขวงนวัตกรรม เขตดิจิทัล กรุงเทพมหานคร 10400
โทรศัพท์: 02-123-4567

**ข้อมูลสินค้า Gaming Mouse:**
- ราคา: 79,900 บาท
- จำนวนในสต็อก: 15 ชิ้น
- รายละเอียด: แล็ปท็อปประสิทธิภาพสูงสำหรับมือโปร
```

---

#### สร้าง Branch ใหม่
```bash
git add .
git commit -m "Finish RAG with Tool Calling and pgvector"
git checkout -b 10-deployment
```
### 🚀 Deployment Guide

คู่มือการ Deploy AI Chatbot ไปยัง Production Environment

#### 📋 สารบัญ

1. [Vercel Deployment](#-vercel-deployment)
2. [Docker Container Deployment](#-docker-container-deployment)
3. [Environment Variables](#-environment-variables)
4. [Database Setup](#-database-setup)
5. [Performance Optimization](#-performance-optimization)
6. [Monitoring & Maintenance](#-monitoring--maintenance)
7. [Troubleshooting](#-troubleshooting)

---

### 🌐 Vercel Deployment

#### Prerequisites
- ✅ Vercel Account
- ✅ GitHub/GitLab Repository
- ✅ Supabase Project
- ✅ OpenAI API Key

#### 🚀 Method 1: Deploy from GitHub (Recommended)

#### Step 1: Push Code to GitHub
```bash
# เชื่อมต่อกับ GitHub repository
git remote add origin https://github.com/yourusername/my-langchain-chatbot.git
git push -u origin main
```

#### Step 2: Connect to Vercel
1. ไปที่ [vercel.com](https://vercel.com)
2. Login ด้วย GitHub account
3. คลิก "New Project"
4. เลือก repository "my-langchain-chatbot"
5. Configure settings:

```yaml
Framework Preset: Next.js
Root Directory: ./
Build Command: npm run build
Output Directory: .next
Install Command: npm install
```

#### Step 3: Environment Variables
เพิ่ม Environment Variables ใน Vercel Dashboard:

```env
# OpenAI Configuration
OPENAI_API_KEY=sk-your-openai-api-key

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# PostgreSQL Configuration (Supabase)
PG_HOST=your-db-host.supabase.co
PG_PORT=5432
PG_USER=postgres
PG_PASSWORD=your-db-password
PG_DATABASE=postgres

# Next.js Configuration
NEXTAUTH_URL=https://your-app-name.vercel.app
NEXTAUTH_SECRET=your-nextauth-secret
```

#### Step 4: Deploy
- คลิก "Deploy"
- รอประมาณ 2-3 นาที
- เสร็จแล้ว! 🎉

### 🔧 Method 2: Deploy with Vercel CLI

#### Step 1: Install Vercel CLI
```bash
npm install -g vercel
```

#### Step 2: Login
```bash
vercel login
```

#### Step 3: Deploy
```bash
# ไปที่ project directory
cd my-langchain-chatbot

# Deploy
vercel

# หรือ deploy production
vercel --prod
```

### ⚙️ Vercel Configuration

สร้างไฟล์ `vercel.json`:

```json {.line-numbers}
{
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "functions": {
    "src/app/api/**/*.ts": {
      "maxDuration": 60
    }
  },
  "env": {
    "OPENAI_API_KEY": "@openai-api-key",
    "NEXT_PUBLIC_SUPABASE_URL": "@supabase-url",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY": "@supabase-anon-key"
  },
  "regions": ["sin1"],
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "/api/$1"
    }
  ]
}
```

### 🎯 Vercel Optimizations

#### Performance Settings
```javascript {.line-numbers}
// next.config.ts
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000", "*.vercel.app"]
    }
  },
  images: {
    domains: ['your-domain.com']
  },
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },
  // Enable compression
  compress: true,
  // Optimize fonts
  optimizeFonts: true,
  // Enable SWC minification
  swcMinify: true
}

module.exports = nextConfig
```

---

## 🐳 Docker Container Deployment

### 📦 Dockerfile

สร้างไฟล์ `Dockerfile`:

```dockerfile {.line-numbers}
# Use Node.js 18 Alpine as base image
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json package-lock.json* ./
RUN npm ci --only=production

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next.js collects completely anonymous telemetry data about general usage.
# Learn more here: https://nextjs.org/telemetry
# Uncomment the following line in case you want to disable telemetry during the build.
ENV NEXT_TELEMETRY_DISABLED 1

RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
# Uncomment the following line in case you want to disable telemetry during runtime.
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000
# set hostname to localhost
ENV HOSTNAME "0.0.0.0"

# server.js is created by next build from the standalone output
# https://nextjs.org/docs/pages/api-reference/next-config-js/output
CMD ["node", "server.js"]
```

### 🐳 Docker Compose

สร้างไฟล์ `docker-compose.yml`:

```yaml {.line-numbers}
version: '3.8'

services:
  # Main Application
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
      - NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
      - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
      - PG_HOST=${PG_HOST}
      - PG_PORT=${PG_PORT}
      - PG_USER=${PG_USER}
      - PG_PASSWORD=${PG_PASSWORD}
      - PG_DATABASE=${PG_DATABASE}
    depends_on:
      - postgres
    networks:
      - app-network
    restart: unless-stopped

  # PostgreSQL Database (Optional - use if not using Supabase)
  postgres:
    image: pgvector/pgvector:pg15
    environment:
      - POSTGRES_DB=chatbot
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=your_password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql
    networks:
      - app-network
    restart: unless-stopped

  # Redis (Optional - for caching)
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    networks:
      - app-network
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:

networks:
  app-network:
    driver: bridge
```

### 📝 Environment File

สร้างไฟล์ `.env.production`:

```env {.line-numbers}
# Application
NODE_ENV=production
PORT=3000

# OpenAI
OPENAI_API_KEY=sk-your-openai-api-key

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# PostgreSQL
PG_HOST=postgres
PG_PORT=5432
PG_USER=postgres
PG_PASSWORD=your_password
PG_DATABASE=chatbot

# Redis (Optional)
REDIS_URL=redis://redis:6379
```

### 🚀 Deployment Commands

#### Build และ Run
```bash
# Build Docker image
docker build -t my-langchain-chatbot .

# Run container
docker run -p 3000:3000 --env-file .env.production my-langchain-chatbot

# หรือใช้ Docker Compose
docker-compose up -d
```

#### Production Deployment
```bash
# Build for production
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Check logs
docker-compose logs -f app

# Scale application
docker-compose up -d --scale app=3
```

### 🔧 Docker Compose Override for Production

สร้างไฟล์ `docker-compose.prod.yml`:

```yaml {.line-numbers}
version: '3.8'

services:
  app:
    restart: always
    environment:
      - NODE_ENV=production
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.app.rule=Host(`yourdomain.com`)"
      - "traefik.http.routers.app.tls=true"
      - "traefik.http.routers.app.tls.certresolver=letsencrypt"

  # Load Balancer (Traefik)
  traefik:
    image: traefik:v2.10
    command:
      - "--api.dashboard=true"
      - "--providers.docker=true"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.websecure.address=:443"
      - "--certificatesresolvers.letsencrypt.acme.email=your-email@domain.com"
      - "--certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json"
      - "--certificatesresolvers.letsencrypt.acme.httpchallenge=true"
      - "--certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=web"
    ports:
      - "80:80"
      - "443:443"
      - "8080:8080"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - letsencrypt:/letsencrypt
    networks:
      - app-network

volumes:
  letsencrypt:
```

### 🌐 Kubernetes Deployment (Advanced)

สร้างไฟล์ `k8s/deployment.yaml`:

```yaml {.line-numbers}
apiVersion: apps/v1
kind: Deployment
metadata:
  name: langchain-chatbot
  namespace: default
spec:
  replicas: 3
  selector:
    matchLabels:
      app: langchain-chatbot
  template:
    metadata:
      labels:
        app: langchain-chatbot
    spec:
      containers:
      - name: chatbot
        image: your-registry/my-langchain-chatbot:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: OPENAI_API_KEY
          valueFrom:
            secretKeyRef:
              name: chatbot-secrets
              key: openai-api-key
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5

---
apiVersion: v1
kind: Service
metadata:
  name: langchain-chatbot-service
spec:
  selector:
    app: langchain-chatbot
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3000
  type: LoadBalancer
```

---

### 🔑 Environment Variables

#### 📋 Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `OPENAI_API_KEY` | OpenAI API Key | `sk-...` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL | `https://xxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Anon Key | `eyJ...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Role Key | `eyJ...` |
| `PG_HOST` | PostgreSQL Host | `db.xxx.supabase.co` |
| `PG_PORT` | PostgreSQL Port | `5432` |
| `PG_USER` | PostgreSQL User | `postgres` |
| `PG_PASSWORD` | PostgreSQL Password | `your_password` |
| `PG_DATABASE` | PostgreSQL Database | `postgres` |

#### 🔒 Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXTAUTH_SECRET` | NextAuth Secret | Auto-generated |
| `NEXTAUTH_URL` | Application URL | `http://localhost:3000` |
| `REDIS_URL` | Redis Connection URL | None |
| `NODE_ENV` | Environment | `development` |

#### 🛡️ Security Best Practices

#### 1. Environment Variable Management
```bash
# Use different .env files for different environments
.env                 # Default
.env.local          # Local development (gitignored)
.env.development    # Development
.env.production     # Production
```

#### 2. Secret Management
```bash
# For Docker Secrets
echo "your-secret-key" | docker secret create openai_api_key -

# For Kubernetes
kubectl create secret generic chatbot-secrets \
  --from-literal=openai-api-key="sk-your-key" \
  --from-literal=supabase-key="your-key"
```

#### 3. Environment Validation
สร้างไฟล์ `src/lib/env.ts`:

```typescript
import { z } from 'zod'

const envSchema = z.object({
  OPENAI_API_KEY: z.string().min(1, "OpenAI API key is required"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url("Invalid Supabase URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, "Supabase anon key is required"),
  PG_HOST: z.string().min(1, "PostgreSQL host is required"),
  PG_PORT: z.coerce.number().default(5432),
  PG_USER: z.string().min(1, "PostgreSQL user is required"),
  PG_PASSWORD: z.string().min(1, "PostgreSQL password is required"),
  PG_DATABASE: z.string().min(1, "PostgreSQL database is required"),
})

export const env = envSchema.parse(process.env)
```

---

### 🗄️ Database Setup

### 🎯 Supabase Setup (Recommended)

### 1. Create Supabase Project
1. ไปที่ [supabase.com](https://supabase.com)
2. สร้าง New Project
3. รอ setup เสร็จ (2-3 นาที)

#### 2. Enable pgvector Extension
```sql
-- ใน Supabase SQL Editor
CREATE EXTENSION IF NOT EXISTS vector;
```

#### 3. Run Database Migrations
```sql
-- Create tables for chat history
CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  user_id UUID NOT NULL,
  summary TEXT DEFAULT '',
  message_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  message JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create tables for tool calling
CREATE TABLE IF NOT EXISTS products (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0,
  category TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sales (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  product_id BIGINT NOT NULL REFERENCES products(id),
  quantity_sold INTEGER NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  sale_date DATE NOT NULL DEFAULT CURRENT_DATE,
  customer_type TEXT DEFAULT 'retail',
  sales_channel TEXT DEFAULT 'online',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create table for vector embeddings
CREATE TABLE IF NOT EXISTS demo_documents (
  id BIGSERIAL PRIMARY KEY,
  content TEXT NOT NULL,
  metadata JSONB,
  embedding VECTOR(1536),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX idx_products_name ON products USING gin(to_tsvector('simple', name));
CREATE INDEX idx_sales_product_id ON sales(product_id);
CREATE INDEX idx_sales_date ON sales(sale_date);

-- Vector search index
CREATE INDEX ON demo_documents 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Metadata search index
CREATE INDEX idx_demo_documents_metadata 
ON demo_documents USING GIN (metadata);

-- RLS (Row Level Security)
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE demo_documents ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can see own sessions" ON chat_sessions
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can see own messages" ON chat_messages
  FOR ALL USING (auth.uid() IN (
    SELECT user_id FROM chat_sessions WHERE id = session_id
  ));

CREATE POLICY "Enable read access for all users" ON demo_documents
  FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON demo_documents
  FOR INSERT WITH CHECK (true);
```

#### 4. Seed Sample Data
```sql
-- Insert sample products
INSERT INTO products (name, description, price, stock, category) VALUES
('MacBook Pro M3', 'แล็ปท็อปประสิทธิภาพสูงสำหรับมือโปร', 79900.00, 15, 'laptop'),
('iPhone 15 Pro Max', 'สมาร์ทโฟนรุ่นล่าสุดจาก Apple', 45900.00, 8, 'smartphone'),
('Gaming Mouse Pro', 'เมาส์เกมมิ่งไร้สาย ตอบสนองฉับไว', 2800.00, 50, 'gaming'),
('Monitor 4K 27"', 'จอมอนิเตอร์ 4K ขนาด 27 นิ้ว', 15900.00, 12, 'monitor'),
('Espresso Machine Deluxe', 'เครื่องชงกาแฟเอสเปรสโซ่อัตโนมัติ', 25900.00, 5, 'appliance');

-- Insert sample sales
INSERT INTO sales (product_id, quantity_sold, unit_price, total_price, sale_date, customer_type, sales_channel) VALUES
(1, 2, 79900.00, 159800.00, '2024-12-01', 'retail', 'online'),
(2, 1, 45900.00, 45900.00, '2024-12-01', 'wholesale', 'store'),
(3, 5, 2800.00, 14000.00, '2024-12-02', 'retail', 'online'),
(1, 1, 79900.00, 79900.00, '2024-12-15', 'retail', 'store'),
(4, 2, 15900.00, 31800.00, '2024-12-20', 'retail', 'online');
```

### 🐘 **Self-hosted PostgreSQL**

#### Docker Setup
```yaml
# In docker-compose.yml
services:
  postgres:
    image: pgvector/pgvector:pg15
    environment:
      POSTGRES_DB: chatbot
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: your_password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql
```

#### Manual Setup
```bash
# Install PostgreSQL with pgvector
sudo apt update
sudo apt install postgresql postgresql-contrib

# Install pgvector extension
cd /tmp
git clone https://github.com/pgvector/pgvector.git
cd pgvector
make
sudo make install

# Create database
sudo -u postgres createdb chatbot
sudo -u postgres psql chatbot -c "CREATE EXTENSION vector;"
```

---

### ⚡ Performance Optimization

#### 🚀 Next.js Optimizations

#### 1. Output Configuration
```javascript
// next.config.ts
module.exports = {
  output: 'standalone',
  experimental: {
    outputFileTracingRoot: path.join(__dirname, '../../'),
  },
  images: {
    unoptimized: true, // For static exports
  },
}
```

#### 2. Bundle Analysis
```bash
# Install bundle analyzer
npm install @next/bundle-analyzer

# Analyze bundle
ANALYZE=true npm run build
```

#### 3. Caching Strategy
```typescript
// src/lib/cache.ts
import { unstable_cache } from 'next/cache'

export const getCachedEmbeddings = unstable_cache(
  async (text: string) => {
    // Your embedding logic
  },
  ['embeddings'],
  { 
    revalidate: 3600, // 1 hour
    tags: ['embeddings'] 
  }
)
```

#### 🐳 Docker Optimizations

#### 1. Multi-stage Build
```dockerfile
# Use specific Node version
FROM node:18.17.0-alpine AS base

# Enable corepack for package managers
RUN corepack enable

# Use BuildKit for faster builds
# syntax=docker/dockerfile:1.4
```

#### 2. Layer Caching
```dockerfile
# Copy package files first for better caching
COPY package*.json ./
COPY .npmrc ./
RUN npm ci --only=production

# Copy source code last
COPY . .
```

#### 3. Image Size Optimization
```bash
# Use Alpine Linux
FROM node:18-alpine

# Remove unnecessary packages
RUN apk del --purge alpine-sdk

# Use .dockerignore
echo "node_modules\n.git\n.next\nREADME.md" > .dockerignore
```

### 🌐 Database Optimizations

#### Connection Pooling
```typescript
// src/lib/db.ts
import { Pool } from 'pg'

const pool = new Pool({
  host: process.env.PG_HOST,
  port: Number(process.env.PG_PORT),
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  database: process.env.PG_DATABASE,
  max: 20, // Maximum number of connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
})
```

#### Query Optimization
```sql
-- Add database indexes
CREATE INDEX CONCURRENTLY idx_chat_sessions_created_at 
ON chat_sessions(created_at DESC);

CREATE INDEX CONCURRENTLY idx_demo_documents_embedding_cosine 
ON demo_documents USING ivfflat (embedding vector_cosine_ops);

-- Analyze query performance
EXPLAIN ANALYZE SELECT * FROM chat_sessions WHERE user_id = $1;
```

---

### 📊 Monitoring & Maintenance

#### 🔍 Health Checks

สร้างไฟล์ `src/app/api/health/route.ts`:

```typescript {.line-numbers}
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/server'

export async function GET() {
  try {
    // Check database connection
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('chat_sessions')
      .select('id')
      .limit(1)
    
    if (error) throw error

    // Check OpenAI API
    const openaiHealthy = !!process.env.OPENAI_API_KEY

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'healthy',
        openai: openaiHealthy ? 'healthy' : 'unhealthy',
      }
    })
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
```

### 📈 Logging

```typescript
// src/lib/logger.ts
export const logger = {
  info: (message: string, data?: any) => {
    console.log(`[INFO] ${new Date().toISOString()} - ${message}`, data)
  },
  error: (message: string, error?: any) => {
    console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, error)
  },
  warn: (message: string, data?: any) => {
    console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, data)
  }
}
```

### 🚨 Error Tracking

#### Sentry Integration
```bash
npm install @sentry/nextjs
```

```typescript {.line-numbers}
// sentry.client.config.ts
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,
})
```

### 📊 **Metrics Dashboard**

#### Prometheus + Grafana
```yaml {.line-numbers}
# docker-compose.monitoring.yml
services:
  prometheus:
    image: prom/prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml

  grafana:
    image: grafana/grafana
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana_data:/var/lib/grafana

volumes:
  grafana_data:
```

---

### 🔧 Troubleshooting

### ❌ Common Issues

#### 1. Build Failures

**Error**: `Module not found: Can't resolve '@/lib/...'`

**Solution**:
```json {.line-numbers}
// tsconfig.json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

#### 2. Environment Variables Not Loading

**Error**: `OPENAI_API_KEY is not defined`

**Solution**:
```bash
# Check if .env files are properly loaded
console.log('Environment check:', {
  NODE_ENV: process.env.NODE_ENV,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY ? 'SET' : 'NOT SET'
})
```

#### 3. Database Connection Issues

**Error**: `connection refused`

**Solution**:
```typescript
// Add connection retry logic
import { Pool } from 'pg'

const pool = new Pool({
  // ... config
  retryDelay: 1000,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
})

pool.on('error', (err) => {
  console.error('Database connection error:', err)
})
```

#### 4. Docker Build Issues

**Error**: `ENOSPC: no space left on device`

**Solution**:
```bash
# Clean Docker system
docker system prune -a

# Increase Docker disk space
# Docker Desktop → Settings → Resources → Disk image size
```

#### 5. Memory Issues

**Error**: `JavaScript heap out of memory`

**Solution**:
```bash
# Increase Node.js memory limit
NODE_OPTIONS="--max-old-space-size=4096" npm run build

# Or in Dockerfile
ENV NODE_OPTIONS="--max-old-space-size=4096"
```

### 🐛 **Debug Commands**

```bash
# Check application logs
docker-compose logs -f app

# Check database connectivity
docker-compose exec postgres psql -U postgres -d chatbot -c "SELECT version();"

# Monitor resource usage
docker stats

# Check Next.js build info
npm run build 2>&1 | tee build.log

# Test API endpoints
curl -X GET http://localhost:3000/api/health
```

### 🔍 **Performance Debugging**

```typescript
// Add performance monitoring
export default async function handler(req: NextRequest) {
  const start = Date.now()
  
  try {
    // Your API logic here
    const result = await processRequest(req)
    
    const duration = Date.now() - start
    console.log(`API completed in ${duration}ms`)
    
    return result
  } catch (error) {
    const duration = Date.now() - start
    console.error(`API failed after ${duration}ms:`, error)
    throw error
  }
}
```

---

### ✅ Pre-deployment Checklist

### 🔒 Security
- [ ] Environment variables are properly set
- [ ] Database has proper authentication
- [ ] API keys are not exposed in client-side code
- [ ] CORS is properly configured
- [ ] Rate limiting is enabled

### 🚀 Performance
- [ ] Bundle size is optimized
- [ ] Database queries are optimized
- [ ] Caching is properly configured
- [ ] CDN is set up for static assets
- [ ] Compression is enabled

### 🧪 Testing
- [ ] All API endpoints work
- [ ] Database connections are stable
- [ ] Chat functionality works end-to-end
- [ ] Document loading works
- [ ] Tool calling functions properly

### 📊 Monitoring
- [ ] Health check endpoint is working
- [ ] Logging is properly configured
- [ ] Error tracking is set up
- [ ] Performance monitoring is enabled

### 📝 Documentation
- [ ] Environment variables are documented
-   [ ] Deployment process is documented
- [ ] Troubleshooting guide is available
- [ ] API documentation is up to date

---

### 🎉 Conclusion

ด้วยคู่มือนี้ คุณจะสามารถ deploy AI Chatbot ได้ทั้งบน Vercel และ Docker Container พร้อมด้วยการปรับแต่งประสิทธิภาพและการ monitor ระบบ

#### 🌟 Recommended Deployment Stack:

**สำหรับ Prototype/Demo:**
- ✅ Vercel + Supabase
- ✅ ง่าย รวดเร็ว
- ✅ Auto-scaling

**สำหรับ Production:**
- ✅ Docker + Kubernetes
- ✅ Self-hosted Database
- ✅ Full control

**สำหรับ Enterprise:**
- ✅ Multi-region deployment
- ✅ Load balancers
- ✅ Comprehensive monitoring

มีคำถามเพิ่มเติมเกี่ยวกับ deployment? สามารถดู troubleshooting guide หรือติดต่อทีมพัฒนาได้! 🚀

#### Response
"คู่มือนี้ครอบคลุมการ deploy AI Chatbot บน Vercel และ Docker Container พร้อมการปรับแต่งประสิทธิภาพและการ monitor ระบบอย่างละเอียด"