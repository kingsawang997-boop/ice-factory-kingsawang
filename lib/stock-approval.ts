import { supabase } from '@/lib/supabase'

export type StockActionType = 'IN' | 'OUT'

export type StockApprovalRequest = {
  id: string
  productId: string
  productName: string
  productCategory?: string
  quantity: number
  action: StockActionType
  reason: string
  requestedBy: string
  requestedByRole?: string
  requestedAt: string
  status: 'pending' | 'approved' | 'rejected'
  reviewedBy?: string
  reviewedAt?: string
  note?: string
}

export const STOCK_APPROVAL_STORAGE_KEY = 'kingsawang_stock_approval_requests'

export const STOCK_APPROVER_KEYWORDS = [
  'ผู้บริหาร',
  'ผู้จัดการ',
  'เจ้าของ',
  'owner',
  'manager',
  'executive',
  'director',
  'admin',
  'admin staff',
  'supervisor',
  'dev',
  'developer',
  'พัฒนาโปรแกรม',
  'ผู้พัฒนาโปรแกรม',
  'general manager',
  'operations manager',
  'warehouse manager'
]

export function getSessionUser() {
  if (typeof window === 'undefined') return null

  try {
    const session = localStorage.getItem('kingsawang_session')
    if (!session) return null
    return JSON.parse(session) as { id?: string; name?: string; role?: string }
  } catch {
    return null
  }
}

export function isStockApproverRole(role?: string) {
  const normalized = (role || '').toLowerCase()
  return STOCK_APPROVER_KEYWORDS.some((keyword) => normalized.includes(keyword.toLowerCase()))
}

function normalizeRequest(request: Partial<StockApprovalRequest> & { id: string }): StockApprovalRequest {
  return {
    id: request.id,
    productId: request.productId || '',
    productName: request.productName || 'Unknown product',
    productCategory: request.productCategory,
    quantity: Number(request.quantity || 0),
    action: request.action === 'IN' ? 'IN' : 'OUT',
    reason: request.reason || '',
    requestedBy: request.requestedBy || 'Unknown user',
    requestedByRole: request.requestedByRole,
    requestedAt: request.requestedAt || new Date().toISOString(),
    status: request.status === 'approved' || request.status === 'rejected' ? request.status : 'pending',
    reviewedBy: request.reviewedBy,
    reviewedAt: request.reviewedAt,
    note: request.note
  }
}

function mapRowToRequest(row: Record<string, unknown>): StockApprovalRequest {
  return normalizeRequest({
    id: String(row.id || ''),
    productId: String(row.product_id || row.productId || ''),
    productName: String(row.product_name || row.productName || 'Unknown product'),
    productCategory: typeof row.product_category === 'string' ? row.product_category : undefined,
    quantity: Number(row.quantity || 0),
    action: row.action === 'IN' ? 'IN' : 'OUT',
    reason: String(row.reason || ''),
    requestedBy: String(row.requested_by || row.requestedBy || 'Unknown user'),
    requestedByRole: typeof row.requested_by_role === 'string' ? row.requested_by_role : undefined,
    requestedAt: String(row.requested_at || row.requestedAt || new Date().toISOString()),
    status: row.status === 'approved' || row.status === 'rejected' ? row.status : 'pending',
    reviewedBy: typeof row.reviewed_by === 'string' ? row.reviewed_by : undefined,
    reviewedAt: typeof row.reviewed_at === 'string' ? row.reviewed_at : undefined,
    note: typeof row.note === 'string' ? row.note : undefined
  })
}

function mapRequestToRow(request: StockApprovalRequest) {
  return {
    id: request.id,
    product_id: request.productId,
    product_name: request.productName,
    product_category: request.productCategory || null,
    quantity: request.quantity,
    action: request.action,
    reason: request.reason,
    requested_by: request.requestedBy,
    requested_by_role: request.requestedByRole || null,
    requested_at: request.requestedAt,
    status: request.status,
    reviewed_by: request.reviewedBy || null,
    reviewed_at: request.reviewedAt || null,
    note: request.note || null
  }
}

export async function readStockApprovalRequests(): Promise<StockApprovalRequest[]> {
  if (typeof window === 'undefined') return []

  try {
    const { data, error } = await supabase
      .from('stock_approval_requests')
      .select('*')
      .order('requested_at', { ascending: false })

    if (!error && Array.isArray(data)) {
      return data.map((row) => mapRowToRequest(row as Record<string, unknown>))
    }
  } catch {
    // Fall through to local storage when the table is absent or not yet created.
  }

  try {
    const raw = localStorage.getItem(STOCK_APPROVAL_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map((item) => normalizeRequest(item)) : []
  } catch {
    return []
  }
}

export async function writeStockApprovalRequests(requests: StockApprovalRequest[]) {
  if (typeof window === 'undefined') return

  try {
    const rows = requests.map(mapRequestToRow)
    const { error } = await supabase.from('stock_approval_requests').upsert(rows, { onConflict: 'id' })
    if (!error) {
      return
    }
  } catch {
    // Fall back to localStorage when the table is absent or not yet ready.
  }

  localStorage.setItem(STOCK_APPROVAL_STORAGE_KEY, JSON.stringify(requests))
}

export async function syncApprovalInbox(request: StockApprovalRequest, actionLabel: 'pending' | 'approved' | 'rejected') {
  try {
    const message =
      actionLabel === 'pending'
        ? `📦 คำขออนุมัติสต๊อก: ${request.productName} (${request.action === 'OUT' ? 'เบิกออก' : 'รับเข้า'})`
        : actionLabel === 'approved'
          ? `✅ อนุมัติสต๊อกแล้ว: ${request.productName}`
          : `❌ ปฏิเสธคำขอสต๊อก: ${request.productName}`

    await supabase.from('inbox_entries').insert([
      {
        id: `inbox-${Date.now()}-${request.id}`,
        title: 'Stock approval',
        message,
        user_name: request.requestedBy,
        created_at: new Date().toISOString(),
        status: actionLabel === 'pending' ? 'new' : actionLabel
      }
    ])
  } catch {
    // Best-effort only: table may not exist or the environment may not support it.
  }
}
