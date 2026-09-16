'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

type DeliveryRecord = {
  id: string
  date: string
  employee_name: string
  employee_role: string
  bags_sold: number
  sales_id?: string
  total_amount?: number
  createdAt?: string
}

export default function FieldDeliverySummaryPage() {
  const [records, setRecords] = useState<DeliveryRecord[]>([])
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth())
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedEmployee, setSelectedEmployee] = useState('all')
  const [selectedDay, setSelectedDay] = useState('all')
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const fetchRecords = async () => {
    setIsLoading(true)
    setLoadError('')
    const start = new Date(selectedYear, selectedMonth, 1)
    const end = new Date(selectedYear, selectedMonth + 1, 0)
    const formatDate = (date: Date) => {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }

    const { data, error } = await supabase
      .from('field_delivery_daily')
      .select('*')
      .gte('date', formatDate(start))
      .lte('date', formatDate(end))
      .order('date', { ascending: false })

    if (error) {
      setRecords([])
      setLoadError(error.message)
    } else if (data) {
      setRecords(data as DeliveryRecord[])
    }
    setIsLoading(false)
  }

  useEffect(() => {
    void fetchRecords()
  }, [selectedMonth, selectedYear])

  const employeeOptions = useMemo(() => {
    return Array.from(new Set(records.map((record) => record.employee_name))).sort((a, b) => a.localeCompare(b))
  }, [records])

  const dayOptions = useMemo(() => {
    return Array.from(new Set(records.map((record) => record.date))).sort((a, b) => b.localeCompare(a))
  }, [records])

  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      const employeeMatches = selectedEmployee === 'all' || record.employee_name === selectedEmployee
      const dayMatches = selectedDay === 'all' || record.date === selectedDay
      return employeeMatches && dayMatches
    })
  }, [records, selectedEmployee, selectedDay])

  const visibleRecords = filteredRecords

  const summaryByEmployee = useMemo(() => {
    const map = new Map<string, { name: string; role: string; bags: number; sales: number; days: Set<string>; records: DeliveryRecord[] }>()

    visibleRecords.forEach((record) => {
      const key = record.employee_name
      const current = map.get(key) || { name: record.employee_name, role: record.employee_role || '-', bags: 0, sales: 0, days: new Set<string>(), records: [] }
      current.bags += Number(record.bags_sold || 0)
      current.sales += Number(record.total_amount || 0)
      current.days.add(record.date)
      current.records.push(record)
      map.set(key, current)
    })

    return Array.from(map.values()).sort((a, b) => b.bags - a.bags)
  }, [visibleRecords])

  const totalBags = summaryByEmployee.reduce((sum, item) => sum + item.bags, 0)
  const totalSales = summaryByEmployee.reduce((sum, item) => sum + item.sales, 0)

  const monthLabel = new Date(selectedYear, selectedMonth, 1).toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })

  const exportCsv = () => {
    const csvRows = [
      ['วันที่', 'พนักงาน', 'ตำแหน่ง', 'กระสอบ', 'ยอดขาย', 'เลขบิล'],
      ...visibleRecords.map((record) => [
        record.date,
        record.employee_name,
        record.employee_role,
        String(record.bags_sold || 0),
        String(Number(record.total_amount || 0)),
        record.sales_id || ''
      ])
    ]

    const csv = csvRows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `field-delivery-${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 md:p-6 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h1 className="text-2xl font-black text-slate-900">🚚 สรุปส่งหน้าลาน</h1>
            <p className="text-sm text-slate-500 mt-1">จำนวนกระสอบที่พนักงานขายได้ต่อวัน เพื่อใช้สรุปรายเดือน</p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch gap-3 w-full md:w-auto">
            <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))} className="border border-slate-200 rounded-xl px-4 py-2.5 font-bold text-slate-700 bg-white">
              {Array.from({ length: 12 }, (_, idx) => (
                <option key={idx} value={idx}>{new Date(2024, idx, 1).toLocaleDateString('th-TH', { month: 'long' })}</option>
              ))}
            </select>
            <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} className="border border-slate-200 rounded-xl px-4 py-2.5 font-bold text-slate-700 bg-white">
              {[selectedYear - 1, selectedYear, selectedYear + 1].map((y) => <option key={y} value={y}>{y + 543}</option>)}
            </select>
            <button onClick={exportCsv} className="bg-slate-900 hover:bg-black text-white px-5 py-2.5 rounded-xl font-bold transition-all active:scale-95">
              ⬇️ Export CSV
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6">
            <p className="text-xs font-black text-slate-500 uppercase tracking-[0.2em]">เดือน</p>
            <p className="mt-3 text-2xl font-black text-slate-900">{monthLabel}</p>
          </div>
          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6">
            <p className="text-xs font-black text-slate-500 uppercase tracking-[0.2em]">รวมกระสอบ</p>
            <p className="mt-3 text-2xl font-black text-sky-700">{totalBags.toLocaleString()} <span className="text-base text-slate-500">กระสอบ</span></p>
          </div>
          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6">
            <p className="text-xs font-black text-slate-500 uppercase tracking-[0.2em]">รายได้</p>
            <p className="mt-3 text-2xl font-black text-emerald-700">{totalSales.toLocaleString()} <span className="text-base text-slate-500">บ.</span></p>
          </div>
        </div>

        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 bg-slate-50 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <h2 className="font-black text-slate-800">สรุปตามชื่อพนักงาน</h2>
            <div className="flex flex-col sm:flex-row gap-2">
              <select value={selectedEmployee} onChange={(e) => setSelectedEmployee(e.target.value)} className="border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 bg-white">
                <option value="all">ทั้งหมด</option>
                {employeeOptions.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
              <select value={selectedDay} onChange={(e) => setSelectedDay(e.target.value)} className="border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 bg-white">
                <option value="all">ทุกวัน</option>
                {dayOptions.map((day) => (
                  <option key={day} value={day}>{day}</option>
                ))}
              </select>
            </div>
          </div>

          {isLoading ? (
            <div className="p-10 text-center text-slate-400 font-bold">⏳ กำลังโหลดข้อมูล...</div>
          ) : loadError ? (
            <div className="p-10 text-center text-rose-500 font-bold">โหลดข้อมูลไม่สำเร็จ: {loadError}</div>
          ) : summaryByEmployee.length === 0 ? (
            <div className="p-10 text-center text-slate-400 font-bold">ยังไม่มีข้อมูลส่งหน้าลานสำหรับเงื่อนไขนี้</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-white border-b border-slate-100 text-slate-500 text-xs uppercase">
                  <tr>
                    <th className="p-4 font-bold">พนักงาน</th>
                    <th className="p-4 font-bold">ตำแหน่ง</th>
                    <th className="p-4 font-bold text-center">กระสอบรวม</th>
                    <th className="p-4 font-bold text-right">ยอดขาย</th>
                    <th className="p-4 font-bold text-center">วันทำงาน</th>
                    <th className="p-4 font-bold text-center">บิล</th>
                  </tr>
                </thead>
                <tbody>
                  {summaryByEmployee.map((item) => (
                    <tr key={item.name} className="border-b border-slate-50 hover:bg-slate-50/60">
                      <td className="p-4 font-black text-slate-800">{item.name}</td>
                      <td className="p-4 text-slate-600">{item.role}</td>
                      <td className="p-4 text-center font-black text-sky-700">{item.bags.toLocaleString()}</td>
                      <td className="p-4 text-right font-black text-emerald-700">{item.sales.toLocaleString()} บ.</td>
                      <td className="p-4 text-center text-slate-600">{item.days.size}</td>
                      <td className="p-4 text-center text-slate-600">{item.records.length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 bg-slate-50">
            <h2 className="font-black text-slate-800">รายละเอียดวันต่อวัน</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {visibleRecords.length === 0 ? (
              <div className="p-10 text-center text-slate-400 font-bold">ไม่มีบันทึกรายการในเงื่อนไขที่เลือก</div>
            ) : (
              visibleRecords.map((record) => (
                <div key={record.id} className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 p-4">
                  <div>
                    <p className="font-black text-slate-800">{record.employee_name}</p>
                    <p className="text-xs text-slate-500">{record.employee_role} • {record.date}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 md:gap-6 text-sm font-bold">
                    <span className="text-sky-700">{record.bags_sold.toLocaleString()} กระสอบ</span>
                    <span className="text-emerald-700">{Number(record.total_amount || 0).toLocaleString()} บ.</span>
                    <span className="text-slate-500">#{record.sales_id || '-'}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
