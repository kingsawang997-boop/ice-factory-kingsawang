'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type MaintenanceRecord = {
  id: string
  date: string
  route_name: string
  license_plate?: string
  description: string
  cost: number
  mileage?: number
  garage_name?: string
  recorded_by: string
}

type TruckRoute = {
  id: string
  route_name: string
  license_plate: string
}

export default function MaintenancePage() {
  const [records, setRecords] = useState<MaintenanceRecord[]>([])
  const [trucks, setTrucks] = useState<TruckRoute[]>([])
  const [isLoading, setIsLoading] = useState(true)
  
  // กำหนดเดือนปัจจุบันเป็นค่าเริ่มต้น
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0, 7))

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    route_name: '', // ให้ค่าเริ่มต้นว่างเปล่า เพื่อบังคับเลือก
    description: '',
    cost: '',
    mileage: '',
    garage_name: ''
  })

  const [employeeName, setEmployeeName] = useState('กำลังโหลดชื่อ...')

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    const startOfMonth = `${filterMonth}-01`
    
    // หาวันที่สิ้นเดือนอย่างถูกต้อง
    const dateObj = new Date(startOfMonth)
    dateObj.setMonth(dateObj.getMonth() + 1)
    const endOfMonth = dateObj.toISOString().split('T')[0]

    const [recRes, truckRes] = await Promise.all([
      supabase.from('maintenance_logs').select('*').gte('date', startOfMonth).lt('date', endOfMonth).order('date', { ascending: false }),
      supabase.from('truck_routes').select('id, route_name, license_plate').eq('isActive', true).order('id', { ascending: true })
    ])

    if (recRes.data) setRecords(recRes.data)
    if (truckRes.data) setTrucks(truckRes.data)
      
    setIsLoading(false)
  }, [filterMonth])

  useEffect(() => {
    const session = localStorage.getItem('kingsawang_session')
    if (session) setEmployeeName(JSON.parse(session).name)
    void fetchData()
  }, [fetchData])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.route_name) return alert('กรุณาเลือกรถที่เข้าซ่อม')
    if (!formData.description || !formData.cost) return alert('กรุณากรอกรายการและค่าใช้จ่ายให้ครบถ้วน')

    // 🌟 ดึงข้อมูลทะเบียนรถจากตาราง truck_routes อัตโนมัติ
    const truck = trucks.find(t => t.route_name === formData.route_name)
    
    const payload = {
      id: `MNT-${Date.now().toString().slice(-6)}`,
      date: formData.date,
      route_name: formData.route_name,
      license_plate: truck?.license_plate || '', // ดึงทะเบียนมาใส่ให้อัตโนมัติ
      description: formData.description,
      cost: Number(formData.cost),
      mileage: Number(formData.mileage) || 0,
      garage_name: formData.garage_name || '-',
      recorded_by: employeeName
    }

    const { error } = await supabase.from('maintenance_logs').insert([payload])
    if (error) alert('ข้อผิดพลาด: ' + error.message)
    else {
      alert('✅ บันทึกประวัติการซ่อมบำรุงสำเร็จ')
      setIsModalOpen(false)
      // รีเซ็ตฟอร์มแต่คงวันที่และรถไว้เผื่อกรอกบิลซ้อน
      setFormData({ ...formData, description: '', cost: '', mileage: '', garage_name: '' })
      fetchData()
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('⚠️ ต้องการลบรายการนี้ใช่หรือไม่?')) return
    await supabase.from('maintenance_logs').delete().eq('id', id)
    fetchData()
  }

  // คำนวณยอดรวมต่างๆ
  const totalCost = records.reduce((sum, r) => sum + Number(r.cost), 0)
  const uniqueTrucksCount = new Set(records.map(r => r.route_name)).size

  return (
    <div className="p-4 md:p-8 bg-slate-50/50 min-h-screen text-slate-800 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* 🌟 Header (ปรับให้เหมือนในรูปเป๊ะๆ) */}
        <div className="bg-white/80 backdrop-blur-xl p-6 md:p-8 rounded-[2rem] border border-slate-200/60 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="flex items-center gap-4">
            <Link href="/inventory" className="w-12 h-12 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-2xl flex items-center justify-center font-black transition-colors text-lg">←</Link>
            <div>
              <h1 className="text-xl md:text-2xl font-black text-slate-900 flex items-center gap-3">
                <span className="text-2xl md:text-3xl">🔧</span> ระบบประวัติซ่อมบำรุงรถยนต์
              </h1>
              <p className="text-xs md:text-sm text-slate-500 font-medium mt-1">บันทึกค่าใช้จ่าย เปลี่ยนถ่ายน้ำมันเครื่อง และซ่อมแซมรถขนส่ง</p>
            </div>
          </div>
          <button onClick={() => setIsModalOpen(true)} className="w-full md:w-auto bg-[#9333EA] hover:bg-purple-700 text-white px-8 py-3.5 rounded-xl font-black transition-all shadow-lg shadow-purple-500/30 active:scale-[0.98] flex justify-center items-center gap-2 text-sm">
            <span className="text-lg">➕</span> บันทึกรายการซ่อม
          </button>
        </div>

        {/* 🌟 Dashboard (ปรับ Layout ให้เหมือนดีไซน์) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* กล่องซ้าย: ยอดรวม + เลือกเดือน */}
          <div className="lg:col-span-2 bg-white p-6 md:p-8 rounded-[2rem] border border-slate-200/60 shadow-sm flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <div>
              <p className="text-xs md:text-sm font-bold text-slate-500 mb-1">ยอดค่าซ่อมบำรุงรวม (เดือนนี้)</p>
              <p className="text-4xl md:text-5xl font-black text-rose-600 tracking-tight">
                {totalCost.toLocaleString()} <span className="text-lg md:text-xl font-bold text-rose-400 ml-1">บาท</span>
              </p>
            </div>
            <div className="sm:text-right">
              <p className="text-[10px] md:text-xs font-bold text-slate-400 mb-2">เลือกเดือนที่ต้องการดู</p>
              <input 
                type="month" 
                value={filterMonth} 
                onChange={e => setFilterMonth(e.target.value)} 
                className="w-full sm:w-auto border-2 border-slate-200 px-4 py-2.5 rounded-xl font-bold text-slate-700 bg-slate-50 focus:bg-white focus:border-[#9333EA] focus:ring-4 focus:ring-purple-500/10 outline-none transition-all cursor-pointer" 
              />
            </div>
          </div>
          
          {/* กล่องขวา: จำนวนรถ */}
          <div className="bg-[#1e293b] p-6 md:p-8 rounded-[2rem] border border-slate-700 shadow-xl flex flex-col justify-center text-white relative overflow-hidden">
            <div className="absolute -right-6 -top-6 w-32 h-32 bg-[#9333EA] rounded-full blur-3xl opacity-20 pointer-events-none"></div>
            <p className="text-xs md:text-sm font-bold text-slate-400 mb-2 z-10">จำนวนรถที่เข้าซ่อม</p>
            <p className="text-5xl font-black text-[#c084fc] z-10 tracking-tight">
              {uniqueTrucksCount} <span className="text-xl text-slate-500 font-bold ml-1">คัน</span>
            </p>
          </div>
        </div>

        {/* 🌟 Table */}
        <div className="bg-white rounded-[2rem] border border-slate-200/60 shadow-sm overflow-hidden animate-in fade-in duration-300">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50/80 border-b border-slate-100 text-slate-500 text-[11px] md:text-xs uppercase tracking-wider">
                <tr>
                  <th className="p-5 font-bold w-32 whitespace-nowrap">วันที่ซ่อม</th>
                  <th className="p-5 font-bold">สายส่ง / ทะเบียน</th>
                  <th className="p-5 font-bold">รายการที่ซ่อม</th>
                  <th className="p-5 font-bold text-center">อู่ / ร้านซ่อม</th>
                  <th className="p-5 font-bold text-right text-rose-600 whitespace-nowrap">ค่าใช้จ่าย (บ.)</th>
                  <th className="p-5 font-bold text-center w-24">จัดการ</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-slate-50">
                {isLoading ? (
                  <tr><td colSpan={6} className="p-16 text-center text-slate-400 font-bold">⏳ กำลังโหลดประวัติ...</td></tr>
                ) : records.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-16 text-center">
                      {/* ไอคอนและข้อความ Empty State ตรงตามรูป */}
                      <div className="text-5xl mb-3 opacity-30">📋</div>
                      <p className="text-slate-400 font-bold text-sm">ไม่มีประวัติการซ่อมในเดือนนี้</p>
                    </td>
                  </tr>
                ) : (
                  records.map(r => (
                    <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-5">
                        <p className="font-bold text-slate-700">{new Date(r.date).toLocaleDateString('th-TH')}</p>
                        <p className="text-[10px] text-slate-400 font-medium mt-1">{r.id}</p>
                      </td>
                      <td className="p-5">
                        <p className="font-black text-slate-800 text-base">{r.route_name}</p>
                        {r.license_plate && (
                          <p className="text-[10px] text-slate-500 font-bold bg-slate-100 w-fit px-2 py-0.5 rounded mt-1 border border-slate-200/60">
                            {r.license_plate}
                          </p>
                        )}
                      </td>
                      <td className="p-5">
                        <p className="font-bold text-slate-700">{r.description}</p>
                        {Number(r.mileage) > 0 && <p className="text-[10px] text-[#9333EA] mt-1 font-bold flex items-center gap-1"><span>🚙</span> เลขไมล์: {r.mileage?.toLocaleString()} กม.</p>}
                      </td>
                      <td className="p-5 text-center font-bold text-slate-500 text-xs">{r.garage_name}</td>
                      <td className="p-5 text-right font-black text-rose-600 text-lg">{Number(r.cost).toLocaleString()}</td>
                      <td className="p-5 text-center">
                        <button onClick={() => handleDelete(r.id)} className="w-8 h-8 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-rose-500 hover:border-rose-200 hover:bg-rose-50 transition-colors shadow-sm">✕</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* 🚀 Modal เพิ่มรายการ */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-black text-xl text-slate-900 flex items-center gap-2">➕ บันทึกประวัติซ่อมรถ</h3>
              <button onClick={() => setIsModalOpen(false)} className="w-8 h-8 rounded-full bg-white text-slate-400 font-bold border border-slate-200 hover:text-rose-500 transition-colors">✕</button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600">วันที่ซ่อม <span className="text-rose-500">*</span></label>
                  <input type="date" required value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full border-2 border-slate-200 px-4 py-3 rounded-xl font-bold outline-none focus:border-[#9333EA] transition-colors" />
                </div>
                
                {/* 🌟 1. ให้สามารถเลือกรถได้จากรายการรถและทะเบียน */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600">รถสายส่ง <span className="text-rose-500">*</span></label>
                  <div className="relative">
                    <select required value={formData.route_name} onChange={e => setFormData({...formData, route_name: e.target.value})} className="w-full border-2 border-slate-200 pl-4 pr-10 py-3 rounded-xl font-bold text-slate-800 bg-white outline-none focus:border-[#9333EA] transition-colors appearance-none cursor-pointer">
                      <option value="" disabled>-- เลือกรถที่จะซ่อม --</option>
                      {trucks.map(t => (
                        <option key={t.id} value={t.route_name}>
                          {t.route_name} {t.license_plate ? `[${t.license_plate}]` : ''}
                        </option>
                      ))}
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">▼</div>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600">รายการซ่อม / อาการ <span className="text-rose-500">*</span></label>
                <input type="text" required value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="เช่น ถ่ายน้ำมันเครื่อง, ปะยาง, เปลี่ยนแบตเตอรี่" className="w-full border-2 border-slate-200 px-4 py-3 rounded-xl font-bold outline-none focus:border-[#9333EA] transition-colors" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600">อู่ซ่อม / ร้านค้า</label>
                  <input type="text" value={formData.garage_name} onChange={e => setFormData({...formData, garage_name: e.target.value})} placeholder="ระบุชื่ออู่ (ถ้ามี)..." className="w-full border-2 border-slate-200 px-4 py-3 rounded-xl font-medium text-sm outline-none focus:border-[#9333EA] transition-colors" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600">เลขไมล์รถ (กม.)</label>
                  <input type="number" min="0" value={formData.mileage} onChange={e => setFormData({...formData, mileage: e.target.value})} placeholder="0" className="w-full border-2 border-slate-200 px-4 py-3 rounded-xl font-bold outline-none focus:border-[#9333EA] transition-colors text-center" />
                </div>
              </div>

              <div className="space-y-2 pt-4 border-t border-slate-100 mt-2">
                <label className="text-xs font-black text-rose-500 uppercase tracking-widest">ค่าใช้จ่ายรวม (บาท) *</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl text-rose-300 font-black">฿</span>
                  <input type="number" min="1" required value={formData.cost} onChange={e => setFormData({...formData, cost: e.target.value})} placeholder="0" className="w-full border-2 border-rose-200 bg-rose-50 pl-12 pr-4 py-4 rounded-xl font-black text-3xl text-rose-600 outline-none focus:border-rose-500 focus:ring-4 focus:ring-rose-500/20 text-center shadow-inner transition-all placeholder:text-rose-200" />
                </div>
              </div>

              <button type="submit" className="w-full bg-[#9333EA] hover:bg-purple-700 text-white font-black py-4.5 rounded-xl shadow-xl mt-4 transition-transform active:scale-[0.98] text-base">
                💾 บันทึกประวัติการซ่อม
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}