import { getServerEmployee } from '@/lib/server-auth'

export async function GET() {
  const employee = await getServerEmployee()
  if (!employee) return Response.json({ error: 'ไม่ได้เข้าสู่ระบบ' }, { status: 401 })
  return Response.json({ user: employee })
}
