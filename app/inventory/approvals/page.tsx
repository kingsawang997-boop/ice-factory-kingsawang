'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  getSessionUser,
  isStockApproverRole,
  readStockApprovalRequests,
  syncApprovalInbox,
  writeStockApprovalRequests,
  type StockApprovalRequest
} from '@/lib/stock-approval'

const buildApprovalId = () => `stock-approval-${Math.random().toString(36).slice(2, 10)}`

export default function InventoryApprovalsPage() {
  const session = getSessionUser()
  const role = session?.role || ''
  const [requests, setRequests] = useState<StockApprovalRequest[]>(() => 
    []
  )

  const isBlocked = !isStockApproverRole(role)

  const refreshQueue = async () => {
    const allRequests = await readStockApprovalRequests()
    setRequests(allRequests.filter((request) => request.status === 'pending'))
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshQueue()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  const handleDecision = async (request: StockApprovalRequest, approved: boolean) => {
    const reviewerName = session?.name || 'System'
    const nextStatus: StockApprovalRequest['status'] = approved ? 'approved' : 'rejected'

    const allRequests = await readStockApprovalRequests()
    const currentRequest = allRequests.find((item) => item.id === request.id)
    if (!currentRequest || currentRequest.status !== 'pending') {
      await refreshQueue()
      alert('คำขอนี้ถูกดำเนินการไปแล้วโดยผู้อนุมัติคนอื่น')
      return
    }

    const claimedRequest: StockApprovalRequest = {
      ...currentRequest,
      status: 'approved',
      reviewedBy: reviewerName,
      reviewedAt: new Date().toISOString(),
      note: approved ? 'กำลังดำเนินการอนุมัติ' : 'ปฏิเสธคำขอ'
    }

    if (approved) {
      const { data: claimedRows, error: claimError } = await supabase
        .from('stock_approval_requests')
        .update({ status: 'approved', reviewed_by: reviewerName, reviewed_at: claimedRequest.reviewedAt, note: claimedRequest.note })
        .eq('id', request.id)
        .eq('status', 'pending')
        .select('id')

      if (claimError || !claimedRows || claimedRows.length !== 1) {
        alert('คำขอนี้ถูกดำเนินการไปแล้ว หรือไม่สามารถล็อกคำขอได้')
        await refreshQueue()
        return
      }
    } else {
      await writeStockApprovalRequests(allRequests.map((item) => item.id === request.id ? claimedRequest : item))
    }

    if (approved) {
      try {
        const { data: productRow, error: productError } = await supabase
          .from('products')
          .select('stock')
          .eq('id', request.productId)
          .single()

        if (productError || !productRow) {
          throw new Error('ไม่พบข้อมูลสินค้าในคลัง')
        }

        const currentStock = Number(productRow.stock || 0)
        const nextStock = request.action === 'OUT' ? currentStock - request.quantity : currentStock + request.quantity

        if (nextStock < 0) {
          throw new Error('ยอดคงเหลือหลังอนุมัติจะติดลบ')
        }

        const { error: updateError } = await supabase
          .from('products')
          .update({ stock: nextStock })
          .eq('id', request.productId)

        if (updateError) {
          throw updateError
        }

        const { error: logError } = await supabase.from('inventory_logs').insert([
          {
            id: `LOG-${buildApprovalId()}`,
            date: new Date().toISOString(),
            product_id: request.productId,
            product_name: request.productName,
            type: request.action,
            qty: request.quantity,
            note: `อนุมัติจากระบบ: ${request.reason} (${reviewerName})`,
            by: reviewerName
          }
        ])
        if (logError) {
          throw logError
        }
      } catch (error) {
        await supabase.from('stock_approval_requests').update({ status: 'pending', reviewed_by: null, reviewed_at: null, note: null }).eq('id', request.id).eq('status', 'approved')
        alert(error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการอนุมัติ')
        return
      }
    }

    const updatedRequest: StockApprovalRequest = { ...claimedRequest, status: nextStatus, note: approved ? 'อนุมัติแล้ว' : 'ปฏิเสธคำขอ' }

    await writeStockApprovalRequests((await readStockApprovalRequests()).map((item) => item.id === request.id ? updatedRequest : item))
    void syncApprovalInbox(updatedRequest, nextStatus)
    await refreshQueue()
    alert(approved ? '✅ อนุมัติคำขอเรียบร้อยแล้ว' : '❌ ปฏิเสธคำขอเรียบร้อยแล้ว')
  }

  if (isBlocked) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-white border border-slate-200 rounded-3xl p-8 text-center shadow-sm">
          <div className="text-5xl mb-4">🚫</div>
          <h1 className="text-2xl font-black text-slate-800 mb-2">ไม่มีสิทธิ์เข้าถึงหน้าอนุมัติ</h1>
          <p className="text-slate-600 font-medium mb-6">เฉพาะผู้บริหารหรือพนักงานที่ได้รับแต่งตั้งเท่านั้นที่สามารถเปิดหน้าอนุมัติสต๊อกได้</p>
          <Link href="/inventory" className="inline-flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-3 rounded-2xl">
            กลับสู่หน้าคลังสินค้า
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-sm font-bold text-blue-600 uppercase tracking-wide">Inventory approvals</p>
            <h1 className="text-3xl font-black text-slate-800">อนุมัติการเบิก-ลบสต๊อก</h1>
          </div>
          <Link href="/inventory" className="bg-white border border-slate-200 text-slate-700 font-bold px-4 py-2 rounded-xl shadow-sm hover:bg-slate-50">
            ← กลับหน้าคลัง
          </Link>
        </div>

        {requests.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-3xl p-10 text-center shadow-sm">
            <div className="text-5xl mb-4">✅</div>
            <h2 className="text-xl font-black text-slate-800 mb-2">ไม่มีคำขอที่รออนุมัติ</h2>
            <p className="text-slate-500 font-medium">ทุกคำขอเบิก-ลบสต๊อกได้รับการจัดการเรียบร้อยแล้ว</p>
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map((request) => (
              <div key={request.id} className="bg-white border border-slate-200 rounded-3xl shadow-sm p-5 md:p-6">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      <span className={`px-3 py-1 rounded-full text-xs font-black ${request.action === 'OUT' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                        {request.action === 'OUT' ? 'เบิกออก / ลบสต๊อก' : 'รับเข้า'}
                      </span>
                      <span className="text-xs font-bold text-slate-500">#{request.id}</span>
                    </div>

                    <h2 className="text-2xl font-black text-slate-800 mb-2">{request.productName}</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-slate-600">
                      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">จำนวน</p>
                        <p className="font-black text-lg text-slate-800">{request.quantity}</p>
                      </div>
                      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">ผู้ขอ</p>
                        <p className="font-black text-slate-800">{request.requestedBy}</p>
                      </div>
                      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">เวลา</p>
                        <p className="font-black text-slate-800">{new Date(request.requestedAt).toLocaleString('th-TH')}</p>
                      </div>
                    </div>

                    <div className="mt-4 bg-amber-50 border border-amber-200 rounded-2xl p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-amber-700 mb-1">เหตุผล</p>
                      <p className="font-bold text-amber-900">{request.reason}</p>
                    </div>
                  </div>

                  <div className="flex md:flex-col gap-3 w-full md:w-[220px]">
                    <button
                      onClick={() => void handleDecision(request, true)}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3 rounded-2xl shadow-sm transition-colors"
                    >
                      ✅ อนุมัติ
                    </button>
                    <button
                      onClick={() => void handleDecision(request, false)}
                      className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-black py-3 rounded-2xl shadow-sm transition-colors"
                    >
                      ❌ ปฏิเสธ
                    </button>
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
