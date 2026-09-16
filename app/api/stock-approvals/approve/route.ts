import { getServerEmployee, isStockApproverRole } from '@/lib/server-auth'
import { getServerSupabase } from '@/lib/server-supabase'

export async function POST(request: Request) {
  const approver = await getServerEmployee()
  if (!approver || !isStockApproverRole(approver.role)) {
    return Response.json({ error: 'ไม่มีสิทธิ์อนุมัติการลบสต็อก' }, { status: 403 })
  }

  const body = await request.json().catch(() => null) as { requestId?: string } | null
  const serverSupabase = getServerSupabase()
  const requestId = String(body?.requestId || '')
  if (!requestId) return Response.json({ error: 'ไม่พบรหัสคำขออนุมัติ' }, { status: 400 })

  const { data: approvalRequest, error: requestError } = await serverSupabase
    .from('inbox_entries')
    .select('*')
    .eq('id', requestId)
    .single()

  if (requestError || !approvalRequest || String(approvalRequest.status || '').toLowerCase() !== 'pending') {
    return Response.json({ error: 'คำขอนี้ไม่อยู่ในสถานะรออนุมัติแล้ว' }, { status: 409 })
  }

  if (String(approvalRequest.requested_by_id || '') === approver.id) {
    return Response.json({ error: 'ผู้ขอรายการไม่สามารถอนุมัติคำขอของตัวเองได้' }, { status: 403 })
  }

  const productId = String(approvalRequest.product_id || '')
  const qty = Number(approvalRequest.qty || 0)
  if (!productId || !Number.isInteger(qty) || qty <= 0) {
    return Response.json({ error: 'ข้อมูลคำขออนุมัติไม่ถูกต้อง' }, { status: 422 })
  }

  const { data: product, error: productError } = await serverSupabase
    .from('products')
    .select('id, name, stock')
    .eq('id', productId)
    .single()

  if (productError || !product) return Response.json({ error: 'ไม่พบสินค้าในระบบ' }, { status: 404 })

  const newStock = Number(product.stock || 0) - qty
  if (newStock < 0) return Response.json({ error: 'ยอดคงเหลือไม่พอเบิก' }, { status: 409 })

  const { error: stockError } = await serverSupabase.from('products').update({ stock: newStock }).eq('id', productId)
  if (stockError) return Response.json({ error: stockError.message }, { status: 500 })

  const { error: logError } = await serverSupabase.from('inventory_logs').insert([{
    id: `LOG-${Date.now()}`,
    date: new Date().toISOString(),
    product_id: productId,
    product_name: String(approvalRequest.product_name || product.name || 'สินค้า'),
    type: 'OUT',
    qty,
    note: `${String(approvalRequest.reason || approvalRequest.message || 'จัดการสต๊อก')} (อนุมัติโดย ${approver.name})`,
    by: approver.name
  }])

  if (logError) {
    await serverSupabase.from('products').update({ stock: Number(product.stock || 0) }).eq('id', productId)
    return Response.json({ error: logError.message }, { status: 500 })
  }

  const { error: statusError } = await serverSupabase.from('inbox_entries').update({
    status: 'approved',
    approved_by: approver.id,
    approved_at: new Date().toISOString()
  }).eq('id', requestId)

  if (statusError) return Response.json({ error: statusError.message }, { status: 500 })
  return Response.json({ ok: true })
}
