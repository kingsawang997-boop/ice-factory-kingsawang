'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function PermissionsPage() {
  type Role = {
    role: string
    menu_pos: boolean
    menu_purchase: boolean
    menu_inventory: boolean
    menu_payroll: boolean
    menu_accounting: boolean
    menu_admin: boolean
  }

  const [roles, setRoles] = useState<Role[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Modal เพิ่มกลุ่มผู้ใช้ใหม่
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [newRoleName, setNewRoleName] = useState('')

  // 🔄 ดึงข้อมูลสิทธิ์จาก Database
  const fetchPermissions = async () => {
    setIsLoading(true)
    const { data, error } = await supabase
      .from('role_permissions')
      .select('*')
      .order('role', { ascending: true })

    if (error) {
      console.error('Error fetching permissions:', error)
    } else if (data) {
      setRoles(data)
    }
    setIsLoading(false)
  }

  useEffect(() => {
    void fetchPermissions()
  }, [])

  // 🔀 ฟังก์ชันสลับสวิตช์ (Toggle) ใน State
  const handleToggle = (rowIndex: number, field: keyof Role) => {
    const updatedRoles = [...roles]
    // Toggle boolean field
    // @ts-expect-error dynamic key assignment for Role
    updatedRoles[rowIndex][field] = !updatedRoles[rowIndex][field]
    setRoles(updatedRoles)
  }

  // 💾 บันทึกการเปลี่ยนแปลงทั้งหมดลง Database
  const handleSaveChanges = async () => {
    setIsSaving(true)
    
    // ใช้คำสั่ง upsert เพื่ออัปเดตข้อมูลทั้งตารางในครั้งเดียว
    const { error } = await supabase
      .from('role_permissions')
      .upsert(roles, { onConflict: 'role' })

    if (error) {
      alert('เกิดข้อผิดพลาดในการบันทึก: ' + error.message)
    } else {
      alert('✅ บันทึกสิทธิ์การเข้าถึงเมนูเรียบร้อยแล้ว!')
    }
    
    setIsSaving(false)
  }

  // ➕ เพิ่มตำแหน่ง/กลุ่มผู้ใช้ใหม่
  const handleAddRole = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newRoleName.trim()) return alert('กรุณาระบุชื่อตำแหน่ง/กลุ่มผู้ใช้')

    // ตรวจสอบชื่อซ้ำ
    if (roles.find(r => r.role === newRoleName.trim())) {
      return alert('มีชื่อกลุ่มผู้ใช้นี้ในระบบแล้ว')
    }

    const newRole = {
      role: newRoleName.trim(),
      menu_pos: false,
      menu_purchase: false,
      menu_inventory: false,
      menu_payroll: false,
      menu_accounting: false,
      menu_admin: false
    }

    const { error } = await supabase.from('role_permissions').insert([newRole])

    if (error) {
      alert('เกิดข้อผิดพลาด: ' + error.message)
    } else {
      setNewRoleName('')
      setIsAddModalOpen(false)
      fetchPermissions()
      alert(`✅ เพิ่มกลุ่ม "${newRole.role}" เรียบร้อยแล้ว!`)
    }
  }

  // 🗑️ ลบตำแหน่ง
  const handleDeleteRole = async (roleName: string) => {
    if (roleName === 'ผู้จัดการ / เจ้าของ') return alert('ไม่สามารถลบกลุ่มผู้ดูแลระบบสูงสุดได้!')
    
    if (confirm(`⚠️ คำเตือน: คุณต้องการลบกลุ่ม "${roleName}" ใช่หรือไม่?\n(พนักงานที่อยู่ในกลุ่มนี้จะใช้งานระบบไม่ได้)`)) {
      await supabase.from('role_permissions').delete().eq('role', roleName)
      fetchPermissions()
    }
  }

  const filteredRoles = roles.filter(r => r.role.toLowerCase().includes(searchQuery.toLowerCase()))

  return (
    <div className="space-y-6 p-4 md:p-6 bg-slate-50/50 min-h-screen text-sm font-sans">
      
      {/* 🌟 Header */}
      <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div className="space-y-2">
          <h1 className="text-xl md:text-2xl font-black text-slate-900 flex items-center gap-3">
            <span className="text-2xl">🛡️</span> จัดการสิทธิ์เข้าถึงเมนู
          </h1>
          <p className="text-sm text-slate-500 font-medium">กำหนดว่าตำแหน่งไหน (Role) สามารถเข้าถึงเมนูอะไรได้บ้าง</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
          <button 
            onClick={() => setIsAddModalOpen(true)} 
            className="bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 px-6 py-3 rounded-xl font-bold transition-all shadow-sm flex justify-center items-center gap-2 active:scale-95"
          >
            <span>➕</span> เพิ่มกลุ่มผู้ใช้ใหม่
          </button>
          <button 
            onClick={handleSaveChanges} 
            disabled={isSaving || isLoading}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white px-8 py-3 rounded-xl font-black transition-all shadow-lg shadow-blue-500/30 flex justify-center items-center gap-2 active:scale-95"
          >
            {isSaving ? '⏳ กำลังบันทึก...' : '💾 บันทึกการเปลี่ยนแปลง'}
          </button>
        </div>
      </div>

      {/* 🌟 ตารางจัดการสิทธิ์ (Permissions Table) */}
      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col">
        <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
          <div className="relative w-full md:w-80">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">🔍</div>
            <input type="text" placeholder="ค้นหาชื่อตำแหน่ง..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-blue-500 shadow-sm font-medium text-sm text-slate-700 bg-white" />
          </div>
          <span className="text-xs font-bold text-slate-400 bg-slate-200 px-3 py-1 rounded-lg hidden md:block">อัปเดตสิทธิ์อัตโนมัติ (สลับสวิตช์แล้วกดบันทึก)</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-white border-b border-slate-100 text-slate-500 text-xs whitespace-nowrap">
              <tr>
                <th className="p-5 font-bold">ตำแหน่ง / กลุ่มผู้ใช้งาน</th>
                <th className="p-5 font-bold text-center">🛒 ระบบขาย (POS)</th>
                <th className="p-5 font-bold text-center">📦 จัดซื้อ (PO)</th>
                <th className="p-5 font-bold text-center">🏭 สต๊อกสินค้า</th>
                <th className="p-5 font-bold text-center">👥 งานบุคคล</th>
                <th className="p-5 font-bold text-center">📊 ระบบบัญชี</th>
                <th className="p-5 font-bold text-center">🛡️ ผู้ดูแลระบบ</th>
                <th className="p-5 font-bold text-center w-20">ลบ</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-slate-50">
              {isLoading ? (
                <tr><td colSpan={8} className="p-10 text-center text-blue-500 font-bold">⏳ กำลังโหลดข้อมูลสิทธิ์จาก Database...</td></tr>
              ) : filteredRoles.length === 0 ? (
                <tr><td colSpan={8} className="p-10 text-center text-slate-400 font-bold">ไม่พบกลุ่มผู้ใช้งาน</td></tr>
              ) : (
                filteredRoles.map((roleData, idx) => (
                  <tr key={roleData.role} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-5">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-xs ${roleData.role === 'ผู้จัดการ / เจ้าของ' ? 'bg-amber-500' : roleData.role.includes('บัญชี') ? 'bg-blue-500' : 'bg-slate-400'}`}>
                          {roleData.role.substring(0, 1)}
                        </div>
                        <span className="font-black text-slate-800">{roleData.role}</span>
                      </div>
                    </td>
                    
                    {/* วนลูปสร้าง Toggle Switches */}
                    {['menu_pos', 'menu_purchase', 'menu_inventory', 'menu_payroll', 'menu_accounting', 'menu_admin'].map((field) => (
                      <td key={field} className="p-5 text-center">
                        <button 
                          onClick={() => handleToggle(roles.findIndex(r => r.role === roleData.role), field)}
                          disabled={roleData.role === 'ผู้จัดการ / เจ้าของ'} // ล็อกไว้ไม่ให้แก้ของเจ้าของ
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${roleData[field] ? 'bg-emerald-500' : 'bg-slate-200'} ${roleData.role === 'ผู้จัดการ / เจ้าของ' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${roleData[field] ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                      </td>
                    ))}

                    <td className="p-5 text-center">
                      <button 
                        onClick={() => handleDeleteRole(roleData.role)} 
                        disabled={roleData.role === 'ผู้จัดการ / เจ้าของ'}
                        className="w-8 h-8 rounded-full bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white transition-colors font-bold flex items-center justify-center disabled:opacity-30 disabled:hover:bg-rose-50 disabled:hover:text-rose-500"
                        title="ลบกลุ่มผู้ใช้งาน"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
          <p className="text-xs text-slate-500 font-bold">💡 ข้อแนะนำ: เมื่อปรับสิทธิ์แล้ว ต้องกดปุ่ม &quot;บันทึกการเปลี่ยนแปลง&quot; ด้านบนขวาทุกครั้ง เพื่อให้ระบบจำค่าสิทธิ์ใหม่</p>
        </div>
      </div>

      {/* 🚀 Modal: เพิ่มกลุ่มผู้ใช้ใหม่ */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-black text-lg text-slate-900">➕ เพิ่มกลุ่มผู้ใช้งานใหม่</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="w-8 h-8 rounded-full bg-white text-slate-400 hover:text-rose-500 shadow-sm font-bold flex items-center justify-center">✕</button>
            </div>
            
            <form onSubmit={handleAddRole} className="p-6 space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">ชื่อตำแหน่ง / กลุ่มผู้ใช้ <span className="text-rose-500">*</span></label>
                <input 
                  type="text" 
                  required 
                  autoFocus
                  placeholder="เช่น หัวหน้าหน้าลาน, ออดิท, พนักงานพาร์ทไทม์" 
                  value={newRoleName} 
                  onChange={e => setNewRoleName(e.target.value)} 
                  className="w-full border-2 border-slate-200 px-4 py-3 rounded-xl font-bold focus:outline-none focus:border-blue-500 text-slate-800" 
                />
              </div>
              <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-blue-700 text-xs font-medium">
                *เมื่อสร้างกลุ่มเสร็จแล้ว ระบบจะปิดสิทธิ์การเข้าถึงทุกเมนูไว้เป็นค่าเริ่มต้น คุณสามารถมาเปิดสวิตช์ (Toggle) ให้สิทธิ์ในตารางภายหลังได้
              </div>
              <button type="submit" className="w-full bg-slate-900 hover:bg-black text-white font-black py-4 rounded-xl shadow-lg mt-2 transition-transform active:scale-95">
                💾 สร้างกลุ่มผู้ใช้
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}