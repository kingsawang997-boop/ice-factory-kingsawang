'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<any[]>([])
  const [roles, setRoles] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  // 📝 Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    role: '',
    base_salary: '',
    phone: '',
    username: '',
    password: '',
    pin: ''
  })

  useEffect(() => {
    fetchEmployees()
    fetchRoles()
  }, [])

  // 🔄 ดึงข้อมูลพนักงาน (🌟 อัปเดต: ซ่อน 'ผู้พัฒนาโปรแกรม' ออกจากตาราง 100%)
  const fetchEmployees = async () => {
    setIsLoading(true)
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .neq('role', 'ผู้พัฒนาโปรแกรม') // 🛡️ คำสั่งซ่อน Dev
      .order('isActive', { ascending: false })
      .order('createdAt', { ascending: true })
      
    if (data) setEmployees(data)
    setIsLoading(false)
  }

  // 🔄 ดึงข้อมูลตำแหน่ง (🌟 อัปเดต: ซ่อน 'ผู้พัฒนาโปรแกรม' ไม่ให้เลือกสร้างได้)
  const fetchRoles = async () => {
    const { data } = await supabase
      .from('role_permissions')
      .select('role')
      .neq('role', 'ผู้พัฒนาโปรแกรม') // 🛡️ คำสั่งซ่อน Dev
      .order('role', { ascending: true })
      
    if (data) {
      setRoles(data)
      if (data.length > 0) setFormData(prev => ({ ...prev, role: data[0].role }))
    }
  }

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name || !formData.role) return alert('กรุณากรอกชื่อและตำแหน่งให้ครบถ้วน')

    const newEmpId = `EMP-${Date.now().toString().slice(-4)}`
    
    const payload = {
      id: newEmpId,
      name: formData.name,
      role: formData.role,
      base_salary: Number(formData.base_salary) || 0,
      phone: formData.phone || '-',
      username: formData.username || null,
      password: formData.password || null,
      pin: formData.pin || null,
      isActive: true
    }

    const { error } = await supabase.from('employees').insert([payload])

    if (error) {
      if (error.message.includes('unique constraint')) {
        alert('❌ ชื่อผู้ใช้งาน (Username) นี้มีคนใช้แล้ว กรุณาตั้งชื่ออื่น')
      } else {
        alert('เกิดข้อผิดพลาด: ' + error.message)
      }
    } else {
      alert('✅ เพิ่มรายชื่อพนักงานสำเร็จ!')
      setIsAddModalOpen(false)
      setFormData({ id: '', name: '', role: roles[0]?.role || '', base_salary: '', phone: '', username: '', password: '', pin: '' })
      fetchEmployees()
    }
  }

  const openEditModal = (emp: any) => {
    setFormData({
      id: emp.id,
      name: emp.name,
      role: emp.role,
      base_salary: emp.base_salary?.toString() || '0',
      phone: emp.phone || '',
      username: emp.username || '',
      password: emp.password || '',
      pin: emp.pin || ''
    })
    setIsEditModalOpen(true)
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const payload = {
      name: formData.name,
      role: formData.role,
      base_salary: Number(formData.base_salary) || 0,
      phone: formData.phone || '-',
      username: formData.username || null,
      password: formData.password || null,
      pin: formData.pin || null
    }

    const { error } = await supabase.from('employees').update(payload).eq('id', formData.id)

    if (error) {
      if (error.message.includes('unique constraint')) {
        alert('❌ ชื่อผู้ใช้งาน (Username) นี้มีคนใช้แล้ว กรุณาตั้งชื่ออื่น')
      } else {
        alert('เกิดข้อผิดพลาด: ' + error.message)
      }
    } else {
      alert('✅ อัปเดตข้อมูลพนักงานสำเร็จ!')
      setIsEditModalOpen(false)
      fetchEmployees()
    }
  }

  const toggleActiveStatus = async (id: string, currentStatus: boolean) => {
    const actionText = currentStatus ? 'ปิดการใช้งาน (พนักงานลาออก/พักงาน)' : 'เปิดการใช้งาน'
    if (!confirm(`⚠️ ต้องการ ${actionText} ใช่หรือไม่?\n(ข้อมูลเก่าในระบบบัญชีและค่าเที่ยวจะยังคงอยู่ปกติ)`)) return

    await supabase.from('employees').update({ isActive: !currentStatus }).eq('id', id)
    fetchEmployees()
  }

  const filteredEmployees = employees.filter(emp => 
    emp.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    emp.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    emp.role.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const activeCount = employees.filter(e => e.isActive).length
  const inactiveCount = employees.filter(e => !e.isActive).length

  return (
    <div className="space-y-6 p-4 md:p-6 bg-slate-50/50 min-h-screen text-sm font-sans">
      
      {/* 🌟 Header */}
      <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div className="space-y-2">
          <h1 className="text-xl md:text-2xl font-black text-slate-900 flex items-center gap-3">
            <span className="text-2xl">👥</span> จัดการรายชื่อพนักงาน
          </h1>
          <p className="text-sm text-slate-500 font-medium">เพิ่มข้อมูลพนักงาน กำหนดตำแหน่ง ระบบเข้าใช้งาน และฐานเงินเดือน</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
          <div className="bg-blue-50 px-5 py-3 rounded-xl border border-blue-100 flex items-center gap-4">
            <div className="text-center">
              <p className="text-[10px] font-bold text-blue-500">ทำงานอยู่</p>
              <p className="font-black text-blue-700 text-lg">{activeCount} <span className="text-xs">คน</span></p>
            </div>
            <div className="w-px h-8 bg-blue-200"></div>
            <div className="text-center">
              <p className="text-[10px] font-bold text-slate-400">ลาออก/พักงาน</p>
              <p className="font-black text-slate-600 text-lg">{inactiveCount} <span className="text-xs">คน</span></p>
            </div>
          </div>
          <button 
            onClick={() => { setFormData({ id: '', name: '', role: roles[0]?.role || '', base_salary: '', phone: '', username: '', password: '', pin: '' }); setIsAddModalOpen(true); }} 
            className="bg-slate-900 hover:bg-black text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg flex justify-center items-center gap-2 active:scale-95"
          >
            <span>➕</span> เพิ่มพนักงานใหม่
          </button>
        </div>
      </div>

      {/* 🌟 ตารางรายชื่อพนักงาน */}
      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
          <div className="relative w-full md:w-96">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">🔍</div>
            <input type="text" placeholder="ค้นหาชื่อ, รหัส, หรือตำแหน่ง..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-blue-500 shadow-sm font-medium text-sm text-slate-700 bg-white" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-white border-b border-slate-100 text-slate-500 text-xs whitespace-nowrap">
              <tr>
                <th className="p-5 font-bold w-20">รหัส</th>
                <th className="p-5 font-bold">ชื่อ-นามสกุล</th>
                <th className="p-5 font-bold text-center">ตำแหน่ง</th>
                <th className="p-5 font-bold text-center">Username</th>
                <th className="p-5 font-bold text-center">PIN</th>
                <th className="p-5 font-bold text-right">ฐานเงินเดือน (บาท)</th>
                <th className="p-5 font-bold text-center">สถานะ</th>
                <th className="p-5 font-bold text-center w-32">จัดการ</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-slate-50">
              {isLoading ? (
                <tr><td colSpan={8} className="p-10 text-center text-blue-500 font-bold">⏳ กำลังโหลดข้อมูล...</td></tr>
              ) : filteredEmployees.length === 0 ? (
                <tr><td colSpan={8} className="p-10 text-center text-slate-400 font-bold">ไม่พบรายชื่อพนักงาน</td></tr>
              ) : (
                filteredEmployees.map((emp) => (
                  <tr key={emp.id} className={`hover:bg-slate-50/50 transition-colors ${!emp.isActive ? 'opacity-60 bg-slate-50 grayscale' : ''}`}>
                    <td className="p-5 text-xs font-bold text-slate-400">{emp.id}</td>
                    <td className="p-5">
                      <p className={`font-black text-base ${emp.isActive ? 'text-slate-800' : 'text-slate-500 line-through'}`}>{emp.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">📞 {emp.phone}</p>
                    </td>
                    <td className="p-5 text-center">
                      <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-lg font-bold text-[11px] border border-blue-100">
                        {emp.role}
                      </span>
                    </td>
                    <td className="p-5 text-center font-bold text-slate-600">
                      {emp.username || <span className="text-slate-300 italic text-[10px]">ไม่ได้ตั้งค่า</span>}
                    </td>
                    <td className="p-5 text-center font-mono font-bold text-amber-600 tracking-widest">
                      {emp.pin ? '****' : '-'}
                    </td>
                    <td className="p-5 text-right font-black text-slate-700">
                      {Number(emp.base_salary).toLocaleString()}
                    </td>
                    <td className="p-5 text-center">
                      {emp.isActive ? (
                        <span className="text-emerald-500 font-bold text-xs flex items-center justify-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> ทำงานอยู่</span>
                      ) : (
                        <span className="text-rose-500 font-bold text-xs flex items-center justify-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500"></span> ลาออก/พักงาน</span>
                      )}
                    </td>
                    <td className="p-5 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => openEditModal(emp)} className="p-2 bg-slate-100 hover:bg-blue-100 text-slate-600 hover:text-blue-600 rounded-lg transition-colors" title="แก้ไขข้อมูล">✏️</button>
                        <button onClick={() => toggleActiveStatus(emp.id, emp.isActive)} className={`p-2 rounded-lg transition-colors font-bold text-xs ${emp.isActive ? 'bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white'}`} title={emp.isActive ? 'ปิดการใช้งาน' : 'เปิดการใช้งาน'}>
                          {emp.isActive ? 'ปิดการใช้งาน' : 'เปิดการใช้งาน'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 🚀 Modal: เพิ่ม/แก้ไข พนักงาน */}
      {(isAddModalOpen || isEditModalOpen) && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col my-8">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 sticky top-0 z-10">
              <h3 className="font-black text-xl text-slate-900">{isAddModalOpen ? '➕ เพิ่มพนักงานใหม่' : '✏️ แก้ไขประวัติพนักงาน'}</h3>
              <button onClick={() => { setIsAddModalOpen(false); setIsEditModalOpen(false); }} className="w-8 h-8 rounded-full bg-white text-slate-400 hover:text-rose-500 shadow-sm font-bold flex items-center justify-center border border-slate-200">✕</button>
            </div>
            
            <form onSubmit={isAddModalOpen ? handleAddSubmit : handleEditSubmit} className="p-6 space-y-4">
              
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600">ชื่อ - นามสกุล <span className="text-rose-500">*</span></label>
                <input type="text" required autoFocus value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full border-2 border-slate-200 px-4 py-3 rounded-xl font-bold focus:outline-none focus:border-blue-500 text-slate-800" placeholder="เช่น นายสมชาย ดีใจ" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600">ตำแหน่ง / สิทธิ์ผู้ใช้งาน <span className="text-rose-500">*</span></label>
                  <select required value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} className="w-full border-2 border-slate-200 px-4 py-3 rounded-xl font-bold focus:outline-none focus:border-blue-500 text-slate-800 bg-white">
                    <option value="" disabled>-- เลือกตำแหน่ง --</option>
                    {roles.map(r => (
                      <option key={r.role} value={r.role}>{r.role}</option>
                    ))}
                  </select>
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600">เบอร์โทรศัพท์</label>
                  <input type="text" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full border-2 border-slate-200 px-4 py-3 rounded-xl font-bold focus:outline-none focus:border-blue-500 text-slate-800" placeholder="08X-XXX-XXXX" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600">Username (ใช้ล็อกอิน)</label>
                  <input type="text" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} className="w-full border-2 border-slate-200 px-4 py-3 rounded-xl focus:outline-none focus:border-blue-500 font-bold text-slate-800" placeholder="เช่น emp01" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600">Password (รหัสผ่าน)</label>
                  <input type="text" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full border-2 border-slate-200 px-4 py-3 rounded-xl focus:outline-none focus:border-blue-500 font-bold text-slate-800" placeholder="ตั้งรหัสผ่าน..." />
                </div>
              </div>

              <div className="space-y-1.5 pt-2">
                <label className="text-xs font-bold text-slate-600">รหัส PIN 4 หลัก (สำหรับกดเปิดลิ้นชักที่หน้า POS)</label>
                <input type="text" maxLength={4} pattern="\d{4}" title="กรุณากรอกตัวเลข 4 หลัก" value={formData.pin} onChange={e => setFormData({...formData, pin: e.target.value})} className="w-full border-2 border-amber-200 bg-amber-50 px-4 py-3 rounded-xl focus:outline-none focus:border-amber-500 font-black tracking-widest text-center text-amber-700 text-xl" placeholder="____" />
                <p className="text-[10px] text-slate-400 text-center">ต้องเป็นตัวเลข 4 หลักเท่านั้น (เว้นว่างไว้ถ้าไม่ได้อยู่หน้าร้าน)</p>
              </div>

              <div className="space-y-1.5 border-t border-slate-100 pt-4 mt-2">
                <label className="text-xs font-bold text-emerald-600">ฐานเงินเดือนตั้งต้น (บาท) <span className="text-rose-500">*</span></label>
                <p className="text-[10px] text-slate-400 mb-2">ใช้สำหรับคำนวณในเมนู 'สรุปเงินเดือน/ค่าเที่ยว' (ถ้าไม่มีให้ใส่ 0)</p>
                <input type="number" min="0" required value={formData.base_salary} onChange={e => setFormData({...formData, base_salary: e.target.value})} className="w-full border-2 border-emerald-200 px-4 py-3 rounded-xl font-black text-emerald-700 bg-emerald-50 focus:outline-none focus:border-emerald-500 text-xl" placeholder="0" />
              </div>

              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-xl shadow-lg mt-6 transition-transform active:scale-95 shadow-blue-500/30">
                {isAddModalOpen ? '💾 บันทึกข้อมูลพนักงาน' : '💾 อัปเดตข้อมูลพนักงาน'}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}