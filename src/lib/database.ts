/**
 * ===============================================
 * Database Connection Pool Utility
 * ===============================================
 * 
 * Purpose: จัดการ PostgreSQL connection pool แบบ centralized
 * 
 * Features:
 * - Singleton pattern สำหรับ connection pool
 * - Configuration management
 * - Error handling และ logging
 * - Type safety
 * 
 * Benefits:
 * - ลดการสร้าง connection pool ซ้ำๆ
 * - จัดการ configuration ในที่เดียว
 * - ง่ายต่อการ maintain และ debug
 * - รองรับ connection pooling อย่างมีประสิทธิภาพ
 */

import { Pool, PoolConfig } from 'pg'

// ===============================================
// Database Configuration Interface
// ===============================================

/**
 * Interface สำหรับ database configuration
 * ใช้สำหรับ type checking และ documentation
 */
interface DatabaseConfig {
  host: string
  port: number
  user: string
  password: string
  database: string
  ssl: boolean | { rejectUnauthorized: boolean }
}

// ===============================================
// Configuration Setup
// ===============================================
function getDatabaseConfig(): DatabaseConfig {
  // ตรวจสอบ required environment variables
  const requiredEnvVars = ['PG_HOST', 'PG_PORT', 'PG_USER', 'PG_PASSWORD', 'PG_DATABASE']
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName])
  
  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`)
  }

  return {
    host: process.env.PG_HOST!,
    port: Number(process.env.PG_PORT!),
    user: process.env.PG_USER!,
    password: process.env.PG_PASSWORD!,
    database: process.env.PG_DATABASE!,
    ssl: process.env.NODE_ENV === 'production' 
      ? { rejectUnauthorized: false } 
      : false,
  }
}

// ===============================================
// Database Pool Singleton
// ===============================================
let globalPool: Pool | null = null

export function getDatabase(): Pool {
  // หาก pool ยังไม่ถูกสร้าง ให้สร้างใหม่
  if (!globalPool) {
    try {
      const config = getDatabaseConfig()
      
      // สร้าง pool configuration
      const poolConfig: PoolConfig = {
        ...config,
        // Pool-specific configurations
        max: 20,                      // จำนวน connection สูงสุด
        idleTimeoutMillis: 30000,     // timeout สำหรับ idle connections
        connectionTimeoutMillis: 2000, // timeout สำหรับการเชื่อมต่อ
      }
      
      globalPool = new Pool(poolConfig)
      
    // ตั้งค่า event listeners สำหรับ monitoring
    //   globalPool.on('connect', () => {
    //     console.log('🐘 PostgreSQL: New client connected')
    //   })
      
      globalPool.on('error', (err) => {
        console.error('🚨 PostgreSQL: Unexpected error on idle client', err)
      })
      
    //   console.log('✅ PostgreSQL: Connection pool initialized successfully')
      
    } catch (error) {
      console.error('❌ PostgreSQL: Failed to initialize connection pool:', error)
      throw new Error(`Database connection pool initialization failed: ${error}`)
    }
  }
  
  return globalPool
}

// ===============================================
// Connection Testing Utility
// ===============================================
export async function testDatabaseConnection(): Promise<boolean> {
  try {
    const pool = getDatabase()
    const client = await pool.connect()
    
    try {
      // ทดสอบด้วย simple query
      await client.query('SELECT 1')
      console.log('✅ PostgreSQL: Connection test successful')
      return true
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('❌ PostgreSQL: Connection test failed:', error)
    return false
  }
}

// ===============================================
// Cleanup Utilities
// ===============================================
export async function closeDatabasePool(): Promise<void> {
  if (globalPool) {
    try {
      await globalPool.end()
      globalPool = null
      console.log('🔒 PostgreSQL: Connection pool closed successfully')
    } catch (error) {
      console.error('❌ PostgreSQL: Error closing connection pool:', error)
      throw error
    }
  }
}

// ===============================================
// Health Check Function
// ===============================================
export async function getDatabaseHealth() {
  try {
    const pool = getDatabase()
    const client = await pool.connect()
    
    try {
      const startTime = Date.now()
      await client.query('SELECT version()')
      const responseTime = Date.now() - startTime
      
      return {
        status: 'healthy',
        responseTime: `${responseTime}ms`,
        totalConnections: pool.totalCount,
        idleConnections: pool.idleCount,
        waitingConnections: pool.waitingCount,
        timestamp: new Date().toISOString()
      }
    } finally {
      client.release()
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }
  }
}

// ===============================================
// Export Default Database Instance
// ===============================================
export default getDatabase