'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type ApprovalQueueItem = {
  id: string
  productId: string
  productName: string
  qty: number
  reason: string
  requestedBy: string
  requestedById?: string
  requestedAt: string
  status: 'pending'
}

const STOCK_APPROVAL_QUEUE_KEY = 'kingsawang_stock_approval_requests'

const isStockApproverRole = (role: string) => /ผู้บริหาร|ผู้จัดการ|เจ้าของ|ผู้พัฒนาโปรแกรม|ได้รับแต่งตั้ง|อนุมัติ|manager|director|owner|admin|approver/i.test(role)

const createLogId = () => `LOG-${Date.now()}`

function readStockApprovalQueue(): ApprovalQueueItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STOCK_APPROVAL_QUEUE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed as ApprovalQueueItem[] : []
  } catch {
    return []
  }
}

function writeStockApprovalQueue(items: ApprovalQueueItem[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STOCK_APPROVAL_QUEUE_KEY, JSON.stringify(items))
}

export default function StockApprovalQueuePage() {
  const [requests, setRequests] = useState<ApprovalQueueItem[]>(() => readStockApprovalQueue())
  const [sessionName] = useState(() => {
    if (typeof window === 'undefined') return ''
    try {
      const session = localStorage.getItem('kingsawang_session')
      if (!session) return ''
      return JSON.parse(session)?.name || ''
    } catch {
      return ''
    }
  })
  const [sessionId] = useState(() => {
    if (typeof window === 'undefined') return ''
    try {
      const session = localStorage.getItem('kingsawang_session')
      if (!session) return ''
      return String(JSON.parse(session)?.id || '')
    } catch {
      return ''
    }
  })
  const [isApprover, setIsApprover] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const refreshStatus = async () => {
      if (typeof window === 'undefined') return
      try {
        const session = localStorage.getItem('kingsawang_session')
        if (!session) {
          setIsApprover(false)
          setRequests([])
          setIsLoading(false)
          return
        }

        const parsed = JSON.parse(session)
        const { data: employee } = await supabase
          .from('employees')
          .select('id, role, isActive')
          .eq('id', parsed?.id || '')
          .single()
        setIsApprover(Boolean(employee?.isActive) && isStockApproverRole(String(employee?.role || '')))
      } catch {
        setIsApprover(false)
      }

      setRequests(readStockApprovalQueue())
      setIsLoading(false)
    }

    refreshStatus()
  }, [])

  const refreshQueue = async () => {
    const localQueue = readStockApprovalQueue()
    let mergedQueue = [...localQueue]

    try {
      const { data, error } = await supabase.from('inbox_entries').select('*').limit(100)
      if (!error && Array.isArray(data)) {
        const inboxItems = data
          .filter((entry) => !['approved', 'rejected'].includes(String(entry?.status || '').toLowerCase()))
          .filter((entry) => entry?.type === 'stock_approval' || entry?.kind === 'stock_approval' || /อนุมัติ.*สต็อก|stock.*approval/i.test(String(entry?.message || entry?.title || '')))
          .map((entry) => ({
            id: String(entry?.id || `inbox-${Date.now()}`),
            productId: String(entry?.product_id || entry?.target_id || 'unknown'),
            productName: String(entry?.product_name || entry?.title || 'สินค้า'),
            qty: Number(entry?.qty || entry?.quantity || 0),
            reason: String(entry?.reason || entry?.message || 'จัดการสต๊อก'),
            requestedBy: String(entry?.requested_by || entry?.sender || entry?.owner || 'ระบบ'),
            requestedById: entry?.requested_by_id ? String(entry.requested_by_id) : undefined,
            requestedAt: String(entry?.created_at || entry?.createdAt || new Date().toISOString()),
            status: 'pending' as const
          }))

        const byId = new Map(mergedQueue.map((item) => [item.id, item]))
        inboxItems.forEach((item) => byId.set(item.id, item))
        mergedQueue = Array.from(byId.values()).sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime())
      }
    } catch {
      // Ignore missing inbox table and keep local queue only.
    }

    writeStockApprovalQueue(mergedQueue)
    setRequests(mergedQueue)
  }

  const handleApprove = async (request: ApprovalQueueItem) => {
    if (!isApprover || !sessionId) {
      alert('❌ คุณไม่มีสิทธิ์อนุมัติการลบสต๊อก')
      return
    }

    if (request.requestedById && request.requestedById === sessionId) {
      alert('❌ ผู้ขอรายการไม่สามารถอนุมัติคำขอของตัวเองได้')
      return
    }

    const response = await fetch('/api/stock-approvals/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId: request.id })
    })
    const result = await response.json().catch(() => null) as { error?: string } | null
    if (!response.ok) {
      alert(`❌ ${result?.error || 'อนุมัติคำขอไม่สำเร็จ'}`)
      return
    }

    const queue = readStockApprovalQueue().filter(item => item.id !== request.id)
    writeStockApprovalQueue(queue)
    setRequests(queue)
    void refreshQueue()
    alert('✅ อนุมัติคำขอลบสต๊อกสำเร็จ')
  }

  const handleReject = (request: ApprovalQueueItem) => {
    if (!isApprover) {
      alert('❌ คุณไม่มีสิทธิ์ปฏิเสธคำขออนุมัติ')
      return
    }

    const queue = readStockApprovalQueue().filter(item => item.id !== request.id)
    writeStockApprovalQueue(queue)
    setRequests(queue)
    void supabase.from('inbox_entries').update({
      status: 'rejected',
      rejected_by: sessionId,
      rejected_at: new Date().toISOString()
    }).eq('id', request.id)
    void refreshQueue()
    alert('❌ ปฏิเสธคำขออนุมัติแล้ว')
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6 text-sm font-sans">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-rose-500">Approval Queue</p>
            <h1 className="mt-2 text-2xl font-black text-slate-900">คิวอนุมัติการลบสต๊อก</h1>
          </div>
          <div className="flex gap-3">
            <button onClick={() => void refreshQueue()} className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2.5 rounded-xl font-bold transition-all">↻ อัปเดต</button>
            <Link href="/inventory" className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2.5 rounded-xl font-bold transition-all">← กลับหน้าคลัง</Link>
          </div>
        </div>

        {isLoading ? (
          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-10 text-center text-slate-400 font-black">⏳ กำลังโหลดคิวอนุมัติ...</div>
        ) : !isApprover ? (
          <div className="bg-rose-50 border border-rose-200 rounded-[2rem] p-8 text-center">
            <div className="text-5xl mb-3">🔒</div>
            <h2 className="text-xl font-black text-rose-700">ไม่มีสิทธิ์อนุมัติ</h2>
            <p className="mt-2 text-sm text-rose-600 font-bold">เฉพาะผู้บริหารหรือพนักงานที่ได้รับแต่งตั้งเท่านั้นที่สามารถดูและตอบรับคำขอนี้</p>
          </div>
        ) : requests.length === 0 ? (
          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-10 text-center text-slate-400 font-black">ไม่มีคำขออนุมัติสำหรับตัดสต๊อกในขณะนี้</div>
        ) : (
          <div className="space-y-4">
            {requests.map((request) => (
              <div key={request.id} className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-5">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded-full text-[10px] font-black">รอดำเนินการ</span>
                      <span className="text-[10px] text-slate-400 font-bold">{new Date(request.requestedAt).toLocaleString('th-TH')}</span>
                    </div>
                    <h3 className="mt-3 text-lg font-black text-slate-800">{request.productName}</h3>
                    <p className="mt-1 text-sm text-slate-600 font-bold">จำนวน: {request.qty.toLocaleString()} ชิ้น</p>
                    <p className="mt-1 text-sm text-slate-500">เหตุผล: {request.reason}</p>
                    <p className="mt-2 text-[11px] text-slate-400 font-bold">ขอโดย: {request.requestedBy}</p>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <button onClick={() => void handleApprove(request)} className="bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-3 rounded-xl font-black shadow-lg shadow-emerald-500/20 transition-all active:scale-95">✅ อนุมัติ</button>
                    <button onClick={() => handleReject(request)} className="bg-rose-500 hover:bg-rose-600 text-white px-5 py-3 rounded-xl font-black shadow-lg shadow-rose-500/20 transition-all active:scale-95">❌ ปฏิเสธ</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
