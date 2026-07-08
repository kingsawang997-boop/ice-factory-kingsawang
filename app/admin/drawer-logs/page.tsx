'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function DrawerLogsPage() {
  const getTodayString = () => {
    const today = new Date()
    return new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0]
  }

  const [logs, setLogs] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filterDate, setFilterDate] = useState(getTodayString())

  useEffect(() => {
    fetchLogs()
  }, [filterDate])

  const fetchLogs = async () => {
    setIsLoading(true)
    
    // ดึงข้อมูลตามวันที่เลือก (เวลาเริ่มวัน ถึง สิ้นวัน)
    const startOfDay = new Date(`${filterDate}T00:00:00+07:00`).toISOString()
    const endOfDay = new Date(`${filterDate}T23:59:59+07:00`).toISOString()

    const { data, error } = await supabase
      .from('drawer_logs')
      .select('*')
      .gte('createdAt', startOfDay)
      .lte('createdAt', endOfDay)
      .order('createdAt', { ascending: false }) // ล่าสุดอยู่บนสุด

    if (!error && data) {
      setLogs(data)
    }
    setIsLoading(false)
  }

  // ฟังก์ชันจัดสีป้ายสถานะตามรูปภาพเป๊ะๆ
  const getStatusBadge = (status: string) => {
    if (status === 'พิมพ์บิล') {
      return <span className="px-3 py-1 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-lg text-[10px] font-bold">พิมพ์บิล</span>
    } else if (status === 'ไม่พิมพ์บิล') {
      return <span className="px-3 py-1 bg-amber-50 text-amber-600 border border-amber-200 rounded-lg text-[10px] font-bold">ไม่พิมพ์บิล</span>
    } else if (status === 'ผู้ดูแลระบบ') {
      return <span className="px-3 py-1 bg-purple-50 text-purple-600 border border-purple-200 rounded-lg text-[10px] font-bold">ผู้ดูแลระบบ</span>
    }
    return <span className="px-3 py-1 bg-slate-50 text-slate-600 border border-slate-200 rounded-lg text-[10px] font-bold">{status}</span>
  }

  // นับสถิติรายวัน
  const totalOpens = logs.length
  const manualOpens = logs.filter(l => l.print_status === 'ผู้ดูแลระบบ').length
  const noBillOpens = logs.filter(l => l.print_status === 'ไม่พิมพ์บิล').length

  return (
    <div className="space-y-6 p-4 md:p-6 bg-slate-50/50 min-h-screen text-xs font-sans">
      
      {/* 🌟 Header */}
      <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-2">
          <h1 className="text-xl md:text-2xl font-black text-slate-900 flex items-center gap-3">
            <span className="text-2xl">🚨</span> ตรวจสอบการเปิดลิ้นชักเก็บเงิน
          </h1>
          <p className="text-sm text-slate-500 font-medium flex items-center gap-2">
            บันทึกการเปิดลิ้นชักทุกครั้งจากหน้า POS <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
          <input 
            type="date" 
            value={filterDate} 
            onChange={(e) => setFilterDate(e.target.value)} 
            className="w-full border-2 border-slate-200 px-4 py-3 rounded-xl font-bold focus:outline-none focus:border-blue-500 text-slate-800 bg-white" 
          />
          <button onClick={fetchLogs} className="bg-blue-50 hover:bg-blue-100 text-blue-600 px-6 py-3 rounded-xl font-bold transition-all shadow-sm flex justify-center items-center gap-2 active:scale-95 border border-blue-200">
            🔄 โหลดใหม่
          </button>
        </div>
      </div>

      {/* 🌟 KPI Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm text-center">
          <p className="text-[10px] font-bold text-slate-500 mb-1">การเปิดลิ้นชักทั้งหมด (วันนี้)</p>
          <p className="font-black text-2xl text-blue-600">{totalOpens} <span className="text-xs font-bold text-slate-400">ครั้ง</span></p>
        </div>
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm text-center">
          <p className="text-[10px] font-bold text-slate-500 mb-1">เปิดแบบ <span className="text-amber-600">ไม่พิมพ์บิล / ให้ฟรี</span></p>
          <p className="font-black text-2xl text-amber-500">{noBillOpens} <span className="text-xs font-bold text-slate-400">ครั้ง</span></p>
        </div>
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm text-center">
          <p className="text-[10px] font-bold text-slate-500 mb-1">เปิดด้วย <span className="text-purple-600">ปุ่ม Manual (ผู้ดูแลระบบ)</span></p>
          <p className="font-black text-2xl text-purple-600">{manualOpens} <span className="text-xs font-bold text-slate-400">ครั้ง</span></p>
        </div>
      </div>

      {/* 🌟 รายการประวัติ (ดีไซน์ตามหน้าจอออกแบบ) */}
      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden max-w-4xl mx-auto">
        <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center shrink-0">
          <h2 className="font-black text-slate-800 text-sm md:text-base flex items-center gap-2">
            🚨 ประวัติเปิดลิ้นชักเก็บเงิน <span className="hidden md:inline">(ประจำวันที่ {new Date(filterDate).toLocaleDateString('th-TH')})</span>
          </h2>
          <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></span>
        </div>

        <div className="p-6 space-y-4 bg-slate-50/30">
          {isLoading ? (
            <div className="text-center py-20 font-bold text-blue-500 text-sm">⏳ กำลังโหลดข้อมูลประวัติ...</div>
          ) : logs.length === 0 ? (
            <div className="text-center py-20 font-bold text-slate-400 text-sm">ไม่มีประวัติการเปิดลิ้นชักในวันนี้</div>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                
                <div className="space-y-2 flex-1">
                  <h3 className="font-black text-slate-800 text-sm">
                    {log.employee_name} <span className="text-xs text-slate-500 font-bold">({log.role})</span>
                  </h3>
                  <p className="text-[11px] font-bold text-slate-600 bg-slate-50 inline-block px-2 py-1 rounded">
                    {log.reason}
                  </p>
                </div>

                <div className="flex flex-row md:flex-col items-center md:items-end justify-between gap-2 border-t md:border-t-0 border-slate-100 pt-3 md:pt-0">
                  <span className="text-[10px] font-bold text-slate-400">
                    {new Date(log.createdAt).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'medium' })} น.
                  </span>
                  {getStatusBadge(log.print_status)}
                </div>

              </div>
            ))
          )}
        </div>
      </div>

    </div>
  )
}