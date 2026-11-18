import { getServerEmployee } from '@/lib/server-auth'
import { getServerSupabase } from '@/lib/server-supabase'

const requireDeveloper = async () => {
  const employee = await getServerEmployee()
  if (!employee || employee.role !== 'ผู้พัฒนาโปรแกรม') return null
  return employee
}

export async function GET() {
  if (!await requireDeveloper()) {
    return Response.json({ error: 'ไม่มีสิทธิ์ระดับผู้พัฒนา' }, { status: 403 })
  }

  const serverSupabase = getServerSupabase()
  const { data, error } = await serverSupabase
    .from('app_settings')
    .select('*')
    .eq('id', 'system_config')
    .maybeSingle()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ settings: data })
}

export async function POST(request: Request) {
  if (!await requireDeveloper()) {
    return Response.json({ error: 'ไม่มีสิทธิ์ระดับผู้พัฒนา' }, { status: 403 })
  }

  const body = await request.json().catch(() => null) as {
    status?: string
    next_billing_date?: string
    developer_contact?: string
    app_logo?: string
    font_size?: string
    theme_color?: string
  } | null

  if (!body || !['active', 'locked'].includes(String(body.status || '')) || !String(body.next_billing_date || '').trim() || !String(body.developer_contact || '').trim()) {
    return Response.json({ error: 'ข้อมูลการตั้งค่าไม่ถูกต้อง' }, { status: 400 })
  }

  const settings = {
    id: 'system_config',
    status: body.status,
    next_billing_date: body.next_billing_date,
    developer_contact: body.developer_contact,
    app_logo: String(body.app_logo || ''),
    font_size: ['text-xs', 'text-sm', 'text-base'].includes(String(body.font_size)) ? body.font_size : 'text-sm',
    theme_color: ['blue', 'emerald', 'rose', 'amber'].includes(String(body.theme_color)) ? body.theme_color : 'blue'
  }

  const serverSupabase = getServerSupabase()
  const { error } = await serverSupabase.from('app_settings').upsert([settings], { onConflict: 'id' })
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
