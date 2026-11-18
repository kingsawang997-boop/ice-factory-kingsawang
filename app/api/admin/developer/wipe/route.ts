import { getServerEmployee } from '@/lib/server-auth'
import { getServerSupabase } from '@/lib/server-supabase'

export async function POST(request: Request) {
  const employee = await getServerEmployee()
  if (!employee || employee.role !== 'ผู้พัฒนาโปรแกรม') {
    return Response.json({ error: 'ไม่มีสิทธิ์ระดับผู้พัฒนา' }, { status: 403 })
  }

  const body = await request.json().catch(() => null) as { confirmation?: string } | null
  if (body?.confirmation !== 'DELETE') {
    return Response.json({ error: 'ต้องยืนยันคำว่า DELETE' }, { status: 400 })
  }

  try {
    const serverSupabase = getServerSupabase()
    const { data, error } = await serverSupabase.rpc('wipe_developer_transaction_data', {
      p_employee_id: employee.id,
      p_confirmation: 'DELETE'
    })

    if (error) return Response.json({ error: error.message }, { status: 500 })
    if (!data) return Response.json({ error: 'ไม่อนุญาตให้ล้างข้อมูลหรือไม่พบสิทธิ์ผู้พัฒนา' }, { status: 403 })
    return Response.json({ ok: true })
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'ล้างข้อมูลไม่สำเร็จ' }, { status: 500 })
  }
}
