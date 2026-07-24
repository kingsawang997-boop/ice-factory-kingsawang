'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

type TruckRoute = {
  id: string
  route_name: string
  driver_name: string
  license_plate: string
  isActive: boolean
}

type Driver = {
  name: string
  role: string
}

export default function TruckManagementPage() {
  const [routes, setRoutes] = useState<TruckRoute[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)

  // ฟอร์มข้อมูลรถ
  const [formData, setFormData] = useState<TruckRoute>({
    id: '', route_name: '', driver_name: '', license_plate: '', isActive: true
  })
  const [isEditing, setIsEditing] = useState(false)

  const fetchRoutes = async () => {
    setIsLoading(true)
    const { data } = await supabase.from('truck_routes').select('*').order('id', { ascending: true })
    if (data) setRoutes(data as TruckRoute[])
    setIsLoading(false)
  }

  const fetchDrivers = async () => {
    // 🌟 ดึงพนักงานทั้งหมดที่ Active ก่อน
    const { data } = await supabase.from('employees').select('name, role').eq('isActive', true)

    if (data) {
      const onlyDrivers = (data as Driver[]).filter(emp => 
        emp.role.includes('ขับรถ') || emp.role.includes('สายส่ง')
      )
      setDrivers(onlyDrivers)
    }
  }

  useEffect(() => {
    const load = async () => {
      await fetchRoutes()
      await fetchDrivers()
    }

    void load()
  }, [])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (isEditing) {
      await supabase.from('truck_routes').update(formData).eq('id', formData.id)
      alert('✅ อัปเดตข้อมูลรถสำเร็จ')
    } else {
      const newId = `TRK-${Date.now().toString().slice(-4)}`
      await supabase.from('truck_routes').insert([{ ...formData, id: newId }])
      alert('✅ เพิ่มหน่วยรถสายส่งสำเร็จ')
    }
    
    setIsModalOpen(false)
    fetchRoutes()
  }

  const openAddModal = () => {
    setFormData({ id: '', route_name: '', driver_name: '', license_plate: '', isActive: true })
    setIsEditing(false)
    setIsModalOpen(true)
  }

  const openEditModal = (route: TruckRoute) => {
    setFormData(route)
    setIsEditing(true)
    setIsModalOpen(true)
  }

  return (
    <div className="p-4 md:p-8 bg-slate-50/50 min-h-screen font-sans">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 flex items-center gap-3">🚚 จัดการหน่วยรถสายส่ง</h1>
            <p className="text-sm text-slate-500 font-medium mt-1">เพิ่มข้อมูลเส้นทาง ทะเบียนรถ และผูกชื่อพนักงานขับรถ</p>
          </div>
          <button onClick={openAddModal} className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-blue-500/30 transition-all active:scale-95 flex items-center justify-center gap-2">
            ➕ เพิ่มหน่วยรถ
          </button>
        </div>

        {/* ตารางแสดงข้อมูล */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs whitespace-nowrap">
                <tr>
                  <th className="p-4 font-bold w-20">รหัสรถ</th>
                  <th className="p-4 font-bold">ชื่อสายส่ง / เส้นทาง</th>
                  <th className="p-4 font-bold">พนักงานขับรถ</th>
                  <th className="p-4 font-bold">ทะเบียนรถ</th>
                  <th className="p-4 font-bold text-center">สถานะ</th>
                  <th className="p-4 font-bold text-center w-24">จัดการ</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-slate-100">
                {isLoading ? (
                  <tr><td colSpan={6} className="p-10 text-center text-slate-400 font-bold">⏳ กำลังโหลดข้อมูล...</td></tr>
                ) : routes.length === 0 ? (
                  <tr><td colSpan={6} className="p-10 text-center text-slate-400 font-bold">ยังไม่มีข้อมูลรถสายส่ง</td></tr>
                ) : (
                  routes.map(route => (
                    <tr key={route.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4 font-bold text-slate-400">{route.id}</td>
                      <td className="p-4 font-black text-blue-700">{route.route_name}</td>
                      <td className="p-4 font-bold text-slate-700 flex items-center gap-2"><span className="text-lg">👤</span> {route.driver_name}</td>
                      <td className="p-4 font-bold text-slate-600"><span className="bg-slate-100 px-3 py-1 rounded-lg border border-slate-200">{route.license_plate || '-'}</span></td>
                      <td className="p-4 text-center">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${route.isActive ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-rose-100 text-rose-700 border border-rose-200'}`}>
                          {route.isActive ? '🟢 ใช้งาน' : '🔴 ปิดพัก'}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <button onClick={() => openEditModal(route)} className="bg-slate-100 hover:bg-amber-100 text-slate-600 hover:text-amber-600 px-4 py-2 rounded-xl font-bold transition-colors text-xs border border-slate-200 shadow-sm">
                          ✏️ แก้ไข
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Modal เพิ่ม/แก้ไข */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <h3 className="font-black text-lg text-slate-800 flex items-center gap-2">🚚 {isEditing ? 'แก้ไขข้อมูลรถ' : 'เพิ่มหน่วยรถใหม่'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-rose-500 font-bold transition-colors">✕</button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500">ชื่อสายส่ง / เส้นทาง <span className="text-rose-500">*</span></label>
                <input type="text" required value={formData.route_name} onChange={e => setFormData({...formData, route_name: e.target.value})} className="w-full border-2 border-slate-200 px-4 py-3 rounded-xl font-bold focus:border-blue-500 outline-none" placeholder="เช่น สาย 1 (อ.เมือง - นิตโย)" />
              </div>
              
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500">พนักงานขับรถ <span className="text-rose-500">*</span></label>
                <select required value={formData.driver_name} onChange={e => setFormData({...formData, driver_name: e.target.value})} className="w-full border-2 border-slate-200 px-4 py-3 rounded-xl font-bold bg-slate-50 text-slate-800 focus:border-blue-500 outline-none">
                  <option value="" disabled>-- เลือกพนักงาน --</option>
                  {drivers.map((driver, idx) => (
                    <option key={idx} value={driver.name}>{driver.name} ({driver.role})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500">ทะเบียนรถ <span className="text-rose-500">*</span></label>
                <input type="text" required value={formData.license_plate} onChange={e => setFormData({...formData, license_plate: e.target.value})} className="w-full border-2 border-slate-200 px-4 py-3 rounded-xl font-bold focus:border-blue-500 outline-none text-center" placeholder="เช่น บร 1234 สกลนคร" />
              </div>

              <label className="flex items-center gap-3 p-4 rounded-xl border-2 border-slate-100 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors">
                <input type="checkbox" checked={formData.isActive} onChange={e => setFormData({...formData, isActive: e.target.checked})} className="w-5 h-5 accent-emerald-500 rounded" />
                <span className="font-bold text-slate-700 text-sm">เปิดใช้งานรถคันนี้</span>
              </label>

              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-xl shadow-lg transition-transform active:scale-95 mt-4">
                💾 บันทึกข้อมูล
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}