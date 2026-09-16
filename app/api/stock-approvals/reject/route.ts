import { getServerEmployee, isStockApproverRole } from '@/lib/server-auth'
import { supabase } from '@/lib/supabase'

export async function POST(request: Request) {
  try {
    const approver = await getServerEmployee()
    if (!approver || !isStockApproverRole(approver.role)) {
      return Response.json({ error: 'ไม่มีสิทธิ์ปฏิเสธคำขออนุมัติ หรือ session หมดอายุ' }, { status: 403 })
    }

    const body = await request.json().catch(() => null) as { requestId?: string } | null
    const requestId = String(body?.requestId || '')
    if (!requestId) return Response.json({ error: 'ไม่พบรหัสคำขออนุมัติ' }, { status: 400 })

    const { data, error } = await supabase.rpc('reject_stock_approval', {
      p_request_id: requestId,
      p_approver_id: approver.id
    })

    if (error) return Response.json({ error: error.message }, { status: 500 })
    if (!data) return Response.json({ error: 'คำขอไม่อยู่ในสถานะรอ หรือไม่พบสิทธิ์ผู้อนุมัติ' }, { status: 409 })
    return Response.json({ ok: true })
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'ระบบปฏิเสธคำขอขัดข้อง' }, { status: 500 })
  }
}
