import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import { getServerSupabase } from '@/lib/server-supabase'

const SESSION_COOKIE = 'kingsawang_server_session'
const sessionSecret = process.env.APP_SESSION_SECRET || randomBytes(32).toString('hex')

type SessionPayload = {
  employeeId: string
  issuedAt: number
}

type Employee = {
  id: string
  name: string
  role: string
  isActive: boolean
}

const encode = (value: string) => Buffer.from(value).toString('base64url')
const decode = (value: string) => Buffer.from(value, 'base64url').toString('utf8')

const sign = (value: string) => createHmac('sha256', sessionSecret).update(value).digest('base64url')

export const createServerSession = async (employeeId: string) => {
  const payload = encode(JSON.stringify({ employeeId, issuedAt: Date.now() } satisfies SessionPayload))
  const token = `${payload}.${sign(payload)}`
  const cookieStore = await cookies()

  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 12
  })
}

export const clearServerSession = async () => {
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, '', { httpOnly: true, expires: new Date(0), path: '/' })
}

const readSession = async (): Promise<SessionPayload | null> => {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) return null

  const [payload, signature] = token.split('.')
  if (!payload || !signature) return null

  const expected = sign(payload)
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null

  try {
    const parsed = JSON.parse(decode(payload)) as SessionPayload
    if (!parsed.employeeId || Date.now() - parsed.issuedAt > 1000 * 60 * 60 * 12) return null
    return parsed
  } catch {
    return null
  }
}

export const getServerEmployee = async (): Promise<Employee | null> => {
  const session = await readSession()
  if (!session) return null

  const { data, error } = await getServerSupabase()
    .from('employees')
    .select('id, name, role, isActive')
    .eq('id', session.employeeId)
    .single()

  if (error || !data || !data.isActive) return null
  return data as Employee
}

export const isStockApproverRole = (role: string) => /ผู้บริหาร|ผู้จัดการ|เจ้าของ|ผู้พัฒนาโปรแกรม|ได้รับแต่งตั้ง|อนุมัติ|manager|director|owner|admin|approver/i.test(role)

export const getServerSessionCookieName = () => SESSION_COOKIE
