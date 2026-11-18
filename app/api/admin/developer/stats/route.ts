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
    const [sales, products, employees, drawerLogs] = await Promise.all([
      serverSupabase.from('sales').select('*', { count: 'exact', head: true }),
      serverSupabase.from('products').select('*', { count: 'exact', head: true }),
      serverSupabase.from('employees').select('*', { count: 'exact', head: true }),
      serverSupabase.from('drawer_logs').select('*', { count: 'exact', head: true })
    ])

    const probes = [
      { table: 'sales', result: sales },
      { table: 'products', result: products },
      { table: 'employees', result: employees },
      { table: 'drawer_logs', result: drawerLogs }
    ]

    const failures = probes
      .filter(({ result }) => result.error)
      .map(({ table, result }) => {
        const error = result.error as { message?: string; code?: string; status?: number } | null
        const detail = error?.message || error?.code || (error?.status ? `HTTP ${error.status}` : '') || 'Unknown database error'
        return `${table}: ${detail}`
      })

    if (failures.length) {
      return Response.json({ error: failures.join('; ') }, { status: 500 })
    }

    return Response.json({
      stats: {
        sales: sales.count || 0,
        products: products.count || 0,
        employees: employees.count || 0,
        pos_logs: drawerLogs.count || 0
      }
    })
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'โหลดสถิติฐานข้อมูลไม่สำเร็จ' }, { status: 500 })
  }
}
