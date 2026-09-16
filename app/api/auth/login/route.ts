import { createServerSession } from '@/lib/server-auth'
import { supabase } from '@/lib/supabase'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { username?: string; password?: string } | null
  const username = String(body?.username || '').trim()
  const password = String(body?.password || '')

  if (!username || !password) return Response.json({ error: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน' }, { status: 400 })

  const { data: user, error } = await supabase
    .from('employees')
    .select('id, name, role, isActive')
    .eq('username', username)
    .eq('password', password)
    .single()

  if (error || !user) return Response.json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' }, { status: 401 })
  if (!user.isActive) return Response.json({ error: 'บัญชีนี้ถูกระงับการใช้งาน' }, { status: 403 })

  await createServerSession(user.id)
  return Response.json({ user })
}
