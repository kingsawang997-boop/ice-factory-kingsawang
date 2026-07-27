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
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0, 7))

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    route_name: '',
    description: '',
    cost: '',
    mileage: '',
    garage_name: ''
  })

  const [employeeName, setEmployeeName] = useState('กำลังโหลดชื่อ...')

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    const startOfMonth = `${filterMonth}-01`
    const endOfMonth = new Date(new Date(startOfMonth).setMonth(new Date(startOfMonth).getMonth() + 1)).toISOString().split('T')[0]

    const [recRes, truckRes] = await Promise.all([
      supabase.from('maintenance_logs').select('*').gte('date', startOfMonth).lt('date', endOfMonth).order('date', { ascending: false }),
      supabase.from('truck_routes').select('id, route_name, license_plate').eq('isActive', true)
    ])

    if (recRes.data) setRecords(recRes.data)
    if (truckRes.data) {
      setTrucks(truckRes.data)
      if (truckRes.data.length > 0 && !formData.route_name) {
        setFormData(prev => ({ ...prev, route_name: truckRes.data[0].route_name }))
      }
    }
    setIsLoading(false)
  }, [filterMonth, formData.route_name])

  useEffect(() => {
    const session = localStorage.getItem('kingsawang_session')
    if (session) setEmployeeName(JSON.parse(session).name)
    void fetchData()
  }, [fetchData])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.route_name || !formData.description || !formData.cost) return alert('กรอกข้อมูลจำเป็นให้ครบถ้วน')

    const truck = trucks.find(t => t.route_name === formData.route_name)
    
    const payload = {
      id: `MNT-${Date.now()}`,
      date: formData.date,
      route_name: formData.route_name,
      license_plate: truck?.license_plate || '',
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
      setFormData({ ...formData, description: '', cost: '', mileage: '', garage_name: '' })
      fetchData()
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('⚠️ ต้องการลบรายการนี้ใช่หรือไม่?')) return
    await supabase.from('maintenance_logs').delete().eq('id', id)
    fetchData()
  }

  const totalCost = records.reduce((sum, r) => sum + Number(r.cost), 0)

  return (
    <div className="p-4 md:p-8 bg-slate-50/50 min-h-screen text-slate-800 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="bg-white/80 backdrop-blur-xl p-6 md:p-8 rounded-[2rem] border border-slate-200/60 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="flex items-center gap-4">
            <Link href="/inventory" className="w-12 h-12 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl flex items-center justify-center font-black transition-colors">←</Link>
            <div>
              <h1 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                <span className="text-3xl">🔧</span> ระบบประวัติซ่อมบำรุงรถยนต์
              </h1>
              <p className="text-sm text-slate-500 font-medium mt-1">บันทึกค่าใช้จ่าย เปลี่ยนถ่ายน้ำมันเครื่อง และซ่อมแซมรถขนส่ง</p>
            </div>
          </div>
          <button onClick={() => setIsModalOpen(true)} className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-3.5 rounded-2xl font-black transition-all shadow-lg shadow-purple-500/30 active:scale-[0.98] flex items-center gap-2">
            <span>➕</span> บันทึกรายการซ่อม
          </button>
        </div>

        {/* Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex justify-between items-center">
            <div>
              <p className="text-sm font-bold text-slate-500">ยอดค่าซ่อมบำรุงรวม (เดือนนี้)</p>
              <p className="text-4xl font-black text-rose-600 mt-1 tracking-tight">{totalCost.toLocaleString()} <span className="text-lg font-bold text-rose-400">บาท</span></p>
            </div>
            <div className="text-right">
              <p className="text-xs font-bold text-slate-400 mb-2">เลือกเดือนที่ต้องการดู</p>
              <input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="border-2 border-slate-200 px-4 py-2 rounded-xl font-bold text-slate-700 bg-slate-50 focus:border-purple-500 outline-none" />
            </div>
          </div>
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-6 rounded-[2rem] border border-slate-700 shadow-xl flex flex-col justify-center text-white">
            <p className="text-sm font-bold text-slate-400 mb-1">จำนวนรถที่เข้าซ่อม</p>
            <p className="text-4xl font-black text-purple-400">{new Set(records.map(r => r.route_name)).size} <span className="text-lg text-slate-500 font-bold">คัน</span></p>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="p-5 font-black w-32">วันที่ซ่อม</th>
                  <th className="p-5 font-black">สายส่ง / ทะเบียน</th>
                  <th className="p-5 font-black">รายการที่ซ่อม</th>
                  <th className="p-5 font-black text-center">อู่ / ร้านซ่อม</th>
                  <th className="p-5 font-black text-right text-rose-600">ค่าใช้จ่าย (บ.)</th>
                  <th className="p-5 font-black text-center w-24">จัดการ</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-slate-50">
                {isLoading ? (
                  <tr><td colSpan={6} className="p-16 text-center text-slate-400 font-bold">⏳ กำลังโหลดประวัติ...</td></tr>
                ) : records.length === 0 ? (
                  <tr><td colSpan={6} className="p-16 text-center text-slate-400 font-bold"><span className="text-4xl block mb-2 opacity-50">📋</span>ไม่มีประวัติการซ่อมในเดือนนี้</td></tr>
                ) : (
                  records.map(r => (
                    <tr key={r.id} className="hover:bg-slate-50/50">
                      <td className="p-5 font-bold text-slate-700">{new Date(r.date).toLocaleDateString('th-TH')}</td>
                      <td className="p-5">
                        <p className="font-black text-slate-800">{r.route_name}</p>
                        <p className="text-[10px] text-slate-500 font-bold bg-slate-100 w-fit px-2 py-0.5 rounded mt-1">{r.license_plate}</p>
                      </td>
                      <td className="p-5">
                        <p className="font-bold text-slate-700">{r.description}</p>
                        {Number(r.mileage) > 0 && <p className="text-[10px] text-blue-600 mt-1">🚙 เลขไมล์: {r.mileage?.toLocaleString()} กม.</p>}
                      </td>
                      <td className="p-5 text-center font-bold text-slate-500 text-xs">{r.garage_name}</td>
                      <td className="p-5 text-right font-black text-rose-600 text-lg">{Number(r.cost).toLocaleString()}</td>
                      <td className="p-5 text-center">
                        <button onClick={() => handleDelete(r.id)} className="w-8 h-8 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-rose-500 hover:border-rose-200 hover:bg-rose-50 transition-colors">✕</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Modal เพิ่มรายการ */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-black text-xl text-slate-900 flex items-center gap-2">➕ บันทึกประวัติซ่อมรถ</h3>
              <button onClick={() => setIsModalOpen(false)} className="w-8 h-8 rounded-full bg-white text-slate-400 font-bold border border-slate-200 hover:text-rose-500">✕</button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600">วันที่ซ่อม <span className="text-rose-500">*</span></label>
                  <input type="date" required value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full border-2 border-slate-200 px-4 py-3 rounded-xl font-bold outline-none focus:border-purple-500" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600">รถสายส่ง <span className="text-rose-500">*</span></label>
                  <select required value={formData.route_name} onChange={e => setFormData({...formData, route_name: e.target.value})} className="w-full border-2 border-slate-200 px-4 py-3 rounded-xl font-bold outline-none focus:border-purple-500 bg-white">
                    {trucks.map(t => <option key={t.id} value={t.route_name}>{t.route_name}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600">รายการซ่อม / อาการ <span className="text-rose-500">*</span></label>
                <input type="text" required value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="เช่น ถ่ายน้ำมันเครื่อง, ปะยาง, ซ่อมแอร์" className="w-full border-2 border-slate-200 px-4 py-3 rounded-xl font-bold outline-none focus:border-purple-500" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600">อู่ซ่อม / ร้านค้า</label>
                  <input type="text" value={formData.garage_name} onChange={e => setFormData({...formData, garage_name: e.target.value})} placeholder="ระบุชื่ออู่..." className="w-full border-2 border-slate-200 px-4 py-3 rounded-xl font-bold outline-none focus:border-purple-500" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600">เลขไมล์รถ (กม.)</label>
                  <input type="number" min="0" value={formData.mileage} onChange={e => setFormData({...formData, mileage: e.target.value})} placeholder="0" className="w-full border-2 border-slate-200 px-4 py-3 rounded-xl font-bold outline-none focus:border-purple-500 text-center" />
                </div>
              </div>

              <div className="space-y-1 pt-2">
                <label className="text-xs font-black text-rose-500 uppercase">ค่าใช้จ่ายรวม (บาท) *</label>
                <input type="number" min="1" required value={formData.cost} onChange={e => setFormData({...formData, cost: e.target.value})} placeholder="0" className="w-full border-2 border-rose-200 bg-rose-50 px-4 py-4 rounded-xl font-black text-3xl text-rose-700 outline-none focus:border-rose-500 focus:ring-4 focus:ring-rose-500/20 text-center shadow-inner" />
              </div>

              <button type="submit" className="w-full bg-purple-600 hover:bg-purple-700 text-white font-black py-4.5 rounded-xl shadow-xl mt-4 transition-transform active:scale-[0.98]">
                💾 บันทึกประวัติการซ่อม
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}