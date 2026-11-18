import { getServerEmployee } from '@/lib/server-auth'
import { getServerSupabase } from '@/lib/server-supabase'

export async function GET() {
  const employee = await getServerEmployee()
  if (!employee || employee.role !== 'ผู้พัฒนาโปรแกรม') {
    return Response.json({ error: 'ไม่มีสิทธิ์ระดับผู้พัฒนา' }, { status: 403 })
  }

  try {
    const serverSupabase = getServerSupabase()
    const [sales, products, employees, drawerLogs] = await Promise.all([
      serverSupabase.from('sales').select('*', { count: 'exact', head: true }),
      serverSupabase.from('products').select('*', { count: 'exact', head: true }),
      serverSupabase.from('employees').select('*', { count: 'exact', head: true }),
      serverSupabase.from('drawer_logs').select('*', { count: 'exact', head: true })
    ])

    const failed = [sales.error, products.error, employees.error, drawerLogs.error].find(Boolean)
    if (failed) return Response.json({ error: failed.message }, { status: 500 })

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
