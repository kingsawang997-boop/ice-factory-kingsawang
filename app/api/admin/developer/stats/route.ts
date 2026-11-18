import { createClient } from '@supabase/supabase-js'
import { getServerEmployee } from '@/lib/server-auth'

export async function GET() {
  const employee = await getServerEmployee()
  if (!employee || employee.role !== 'ผู้พัฒนาโปรแกรม') {
    return Response.json({ error: 'ไม่มีสิทธิ์ระดับผู้พัฒนา' }, { status: 403 })
  }

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const publicKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !publicKey) {
      return Response.json({ error: 'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY' }, { status: 500 })
    }

    const serverSupabase = createClient(supabaseUrl, publicKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })
    const countRows = async (table: 'sales' | 'products' | 'employees' | 'drawer_logs') => {
      let count = 0
      let offset = 0

      while (true) {
        const { data, error } = await serverSupabase
          .from(table)
          .select('id')
          .range(offset, offset + 999)

        if (error) {
          const detail = error.message || error.code || 'Unknown database error'
          throw new Error(`${table}: ${detail}`)
        }

        const rows = data || []
        count += rows.length
        if (rows.length < 1000) break
        offset += 1000
      }

      return count
    }

    const [sales, products, employees, drawerLogs] = await Promise.all([
      countRows('sales'),
      countRows('products'),
      countRows('employees'),
      countRows('drawer_logs')
    ])

    return Response.json({
      stats: {
        sales,
        products,
        employees,
        pos_logs: drawerLogs
      }
    })
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'โหลดสถิติฐานข้อมูลไม่สำเร็จ' }, { status: 500 })
  }
}
