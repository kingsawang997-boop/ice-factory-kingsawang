import { getServerEmployee, isStockApproverRole } from '@/lib/server-auth'
import { getServerSupabase } from '@/lib/server-supabase'

export async function POST(request: Request) {
  const approver = await getServerEmployee()
  if (!approver || !isStockApproverRole(approver.role)) {
    return Response.json({ error: 'ไม่มีสิทธิ์ปฏิเสธคำขออนุมัติ' }, { status: 403 })
  }

  const body = await request.json().catch(() => null) as { requestId?: string } | null
  const requestId = String(body?.requestId || '')
  if (!requestId) return Response.json({ error: 'ไม่พบรหัสคำขออนุมัติ' }, { status: 400 })

  const serverSupabase = getServerSupabase()
  const { data: approvalRequest, error: requestError } = await serverSupabase
    .from('inbox_entries')
    .select('id, status, requested_by_id')
    .eq('id', requestId)
    .single()

  if (requestError || !approvalRequest || String(approvalRequest.status || '').toLowerCase() !== 'pending') {
    return Response.json({ error: 'คำขอนี้ไม่อยู่ในสถานะรอดำเนินการแล้ว' }, { status: 409 })
  }

  if (String(approvalRequest.requested_by_id || '') === approver.id) {
    return Response.json({ error: 'ผู้ขอรายการไม่สามารถปฏิเสธคำขอของตัวเองได้' }, { status: 403 })
  }

  const { error } = await serverSupabase.from('inbox_entries').update({
    status: 'rejected',
    rejected_by: approver.id,
    rejected_at: new Date().toISOString()
  }).eq('id', requestId).eq('status', 'pending')

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
