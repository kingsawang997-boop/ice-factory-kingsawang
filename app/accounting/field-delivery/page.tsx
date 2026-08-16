'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

type FieldDeliveryRecord = {
  id: string
  date: string
  employee_name: string
  sacks_sold: number
  cashier_name?: string
  updated_at?: string
}

const getTodayString = () => {
  const today = new Date()
  return new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0]
}

export default function FieldDeliverySummaryPage() {
  const [records, setRecords] = useState<FieldDeliveryRecord[]>([])
  const [selectedDate, setSelectedDate] = useState(getTodayString())
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  const fetchSummary = async (date: string) => {
    setIsLoading(true)
    setErrorMessage('')

    try {
      const { data, error } = await supabase
        .from('field_delivery_daily')
        .select('*')
        .eq('date', date)
        .order('sacks_sold', { ascending: false })

      if (error) {
        throw error
      }

      setRecords((data || []) as FieldDeliveryRecord[])
    } catch (error: any) {
      console.warn('field_delivery_daily not available yet:', error?.message || error)
      setRecords([])
      setErrorMessage('ยังไม่มีข้อมูลส่งหน้าลานสำหรับวันที่นี้ หรือยังไม่ได้สร้างตารางข้อมูล')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void fetchSummary(selectedDate)
  }, [selectedDate])

  const totalSacks = useMemo(
    () => records.reduce((sum, item) => sum + Number(item.sacks_sold || 0), 0),
    [records]
  )

  const topEmployee = useMemo(
    () => [...records].sort((a, b) => Number(b.sacks_sold || 0) - Number(a.sacks_sold || 0))[0],
    [records]
  )

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-[2rem] bg-gradient-to-r from-blue-700 via-indigo-700 to-sky-600 p-6 text-white shadow-xl">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-100">Field Delivery</p>
          <h1 className="mt-2 text-3xl font-black">สรุปส่งหน้าลาน</h1>
          <p className="mt-2 text-sm text-blue-100">ติดตามยอดกระสอบที่พนักงานขายได้ต่อวัน เพื่อช่วยสรุปรายวันและรายเดือน</p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">เลือกวันที่</p>
              <h2 className="mt-1 text-lg font-black text-slate-800">สรุปตามวัน</h2>
            </div>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">รวมกระสอบ</p>
            <p className="mt-3 text-3xl font-black text-slate-900">{totalSacks.toLocaleString()} <span className="text-base text-slate-500">กระสอบ</span></p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">จำนวนคนทำงาน</p>
            <p className="mt-3 text-3xl font-black text-slate-900">{records.length}<span className="text-base text-slate-500"> คน</span></p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">ยอดเยี่ยม</p>
            <p className="mt-3 text-lg font-black text-blue-700">{topEmployee ? `${topEmployee.employee_name} (${topEmployee.sacks_sold} กระสอบ)` : '—'}</p>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-200 bg-slate-50 px-5 py-4 text-left">
            <h3 className="text-lg font-black text-slate-800">รายชื่อพนักงานที่ออกส่งหน้าลาน</h3>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-base font-bold text-slate-400">⏳ กำลังโหลดข้อมูล...</div>
          ) : errorMessage ? (
            <div className="p-6 text-center text-sm font-bold text-amber-700">{errorMessage}</div>
          ) : records.length === 0 ? (
            <div className="p-6 text-center text-sm font-bold text-slate-500">ยังไม่มีประวัติส่งหน้าลานสำหรับวันที่นี้</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left">
                <thead className="bg-slate-100 text-slate-600">
                  <tr>
                    <th className="px-5 py-3 text-xs font-black uppercase tracking-[0.12em]">พนักงาน</th>
                    <th className="px-5 py-3 text-xs font-black uppercase tracking-[0.12em]">กระสอบที่ขาย</th>
                    <th className="px-5 py-3 text-xs font-black uppercase tracking-[0.12em]">บันทึกโดย</th>
                    <th className="px-5 py-3 text-xs font-black uppercase tracking-[0.12em]">อัปเดตล่าสุด</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record) => (
                    <tr key={record.id} className="border-t border-slate-200 hover:bg-slate-50/70">
                      <td className="px-5 py-4 font-bold text-slate-800">{record.employee_name}</td>
                      <td className="px-5 py-4 font-black text-blue-700">{Number(record.sacks_sold || 0).toLocaleString()} กระสอบ</td>
                      <td className="px-5 py-4 text-sm font-medium text-slate-600">{record.cashier_name || '—'}</td>
                      <td className="px-5 py-4 text-sm text-slate-500">{record.updated_at ? new Date(record.updated_at).toLocaleString('th-TH') : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
