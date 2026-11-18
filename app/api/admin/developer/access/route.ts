import { getServerEmployee } from '@/lib/server-auth'

export async function GET() {
  const employee = await getServerEmployee()
  if (!employee || employee.role !== 'ผู้พัฒนาโปรแกรม') {
    return Response.json({ authorized: false }, { status: 403 })
  }

  return Response.json({ authorized: true, employee: { id: employee.id, name: employee.name } })
}
