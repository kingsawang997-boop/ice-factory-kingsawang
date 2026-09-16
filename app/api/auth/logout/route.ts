import { clearServerSession } from '@/lib/server-auth'

export async function POST() {
  await clearServerSession()
  return Response.json({ ok: true })
}
