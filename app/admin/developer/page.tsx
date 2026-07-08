'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function DeveloperPortalPage() {
  const router = useRouter()
  const [isAuthorized, setIsAuthorized] = useState(false) // 🛡️ State ยืนยันสิทธิ์
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'billing' | 'ui' | 'database'>('billing')

  const [settings, setSettings] = useState({
    status: 'active', next_billing_date: '', developer_contact: '', app_logo: '', font_size: 'text-sm', theme_color: 'blue'
  })
  const [dbStats, setDbStats] = useState({ sales: 0, products: 0, employees: 0, pos_logs: 0 })

  useEffect(() => {
    verifyDevAccess() // 🛡️ เช็คสิทธิ์ก่อนโหลดหน้าต่าง
  }, [])

  // 🛡️ ระบบรักษาความปลอดภัย 2 ชั้น (Double-Layer Security)
  const verifyDevAccess = async () => {
    const sessionStr = localStorage.getItem('kingsawang_session')
    
    // ชั้นที่ 1: เช็คว่ามีการล็อกอินไหม
    if (!sessionStr) {
      alert('⛔ ไม่อนุญาตให้เข้าถึง: กรุณาล็อกอิน')
      return router.push('/login')
    }

    const session = JSON.parse(sessionStr)

    // ชั้นที่ 2: เช็คกับ Database ยืนยันว่าเป็น Dev ของแท้ (ป้องกันการแฮกแก้ไข LocalStorage)
    const { data: user, error } = await supabase
      .from('employees')
      .select('role')
      .eq('id', session.id)
      .single()

    if (error || !user || user.role !== 'ผู้พัฒนาโปรแกรม') {
      alert('⛔ ภัยคุกคาม: คุณไม่มีสิทธิ์ระดับผู้พัฒนา (Developer) ในการเข้าถึงหน้านี้')
      return router.push('/') // เตะกลับหน้าแรก
    }

    // ผ่านทุกด่าน! อนุญาตให้แสดงหน้าต่างได้
    setIsAuthorized(true)
    fetchSettings()
    fetchDatabaseStats()
  }

  const fetchSettings = async () => {
    const { data } = await supabase.from('app_settings').select('*').eq('id', 'system_config').single()
    if (data) setSettings({ status: data.status || 'active', next_billing_date: data.next_billing_date || '', developer_contact: data.developer_contact || '', app_logo: data.app_logo || '', font_size: data.font_size || 'text-sm', theme_color: data.theme_color || 'blue' })
    setIsLoading(false)
  }

  const fetchDatabaseStats = async () => {
    const { count: salesCount } = await supabase.from('sales').select('*', { count: 'exact', head: true })
    const { count: prodCount } = await supabase.from('products').select('*', { count: 'exact', head: true })
    const { count: empCount } = await supabase.from('employees').select('*', { count: 'exact', head: true })
    const { count: logCount } = await supabase.from('drawer_logs').select('*', { count: 'exact', head: true })
    setDbStats({ sales: salesCount || 0, products: prodCount || 0, employees: empCount || 0, pos_logs: logCount || 0 })
  }

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    const { error } = await supabase.from('app_settings').upsert([{ id: 'system_config', ...settings }])
    if (error) alert('❌ เกิดข้อผิดพลาด: ' + error.message)
    else alert('✅ บันทึกการตั้งค่าระบบ (Developer) เรียบร้อยแล้ว!')
    setIsSaving(false)
  }

  const handleWipeSalesData = async () => {
    const confirmWord = window.prompt("⚠️ คำเตือน: นี่คือการลบข้อมูลการขายและประวัติลิ้นชักทั้งหมด\n\nพิมพ์คำว่า 'DELETE' เพื่อยืนยัน:")
    if (confirmWord === 'DELETE') {
      setIsLoading(true)
      await supabase.from('sales').delete().neq('id', 'dummy')
      await supabase.from('drawer_logs').delete().neq('id', 'dummy')
      alert('🗑️ ล้างข้อมูลธุรกรรมเรียบร้อยแล้ว')
      fetchDatabaseStats()
      setIsLoading(false)
    } else if (confirmWord !== null) {
      alert('ยกเลิกการทำงาน')
    }
  }

  // 🛡️ ถ้ากำลังตรวจสอบสิทธิ์ ให้โชว์หน้าจอดำๆ ป้องกันการแอบดู
  if (!isAuthorized) {
    return <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center text-rose-500 font-bold font-mono">🔐 Verifying Access...</div>
  }

  return (
    <div className="bg-[#0A0A0A] p-4 md:p-8 font-mono text-slate-300 rounded-[2rem] min-h-[85vh] border-4 border-[#222]">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* 🌟 Header God Mode */}
        <div className="bg-[#111111] border border-[#222] p-6 md:p-8 rounded-[2rem] shadow-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-rose-500/5 rounded-full blur-3xl pointer-events-none"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl">👨‍💻</span>
              <h1 className="text-2xl font-black text-white tracking-tight">System God Mode</h1>
              <span className="bg-rose-500 text-white px-3 py-1 rounded-sm text-[10px] font-black tracking-widest uppercase animate-pulse">Developer Only</span>
            </div>
            <p className="text-xs text-slate-500 font-medium">เข้าถึงการตั้งค่าระดับ Root, ปรับจูน UI และจัดการ Database โดยตรง</p>
          </div>
        </div>

        {/* 🌟 Navigation Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          <button onClick={() => setActiveTab('billing')} className={`px-6 py-3 rounded-xl font-bold transition-all text-sm flex items-center gap-2 ${activeTab === 'billing' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'bg-[#111] text-slate-500 border border-[#222] hover:bg-[#222]'}`}>💳 ควบคุมระบบ & บิลลิ่ง</button>
          <button onClick={() => setActiveTab('ui')} className={`px-6 py-3 rounded-xl font-bold transition-all text-sm flex items-center gap-2 ${activeTab === 'ui' ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/50' : 'bg-[#111] text-slate-500 border border-[#222] hover:bg-[#222]'}`}>🎨 ปรับแต่ง UI & แบรนด์</button>
          <button onClick={() => setActiveTab('database')} className={`px-6 py-3 rounded-xl font-bold transition-all text-sm flex items-center gap-2 ${activeTab === 'database' ? 'bg-rose-600 text-white shadow-lg shadow-rose-900/50' : 'bg-[#111] text-slate-500 border border-[#222] hover:bg-[#222]'}`}>⚠️ การจัดการ Database</button>
        </div>

        {isLoading ? (
          <div className="text-center py-20 text-slate-500 font-bold animate-pulse text-sm">⏳ Executing Root Query...</div>
        ) : (
          <form onSubmit={handleSaveSettings} className="space-y-6">
            
            {activeTab === 'billing' && (
              <div className="bg-[#111] border border-[#222] p-6 md:p-8 rounded-[2rem] shadow-xl space-y-6 animate-in fade-in duration-300">
                <h2 className="text-base font-black text-white flex items-center gap-2 border-b border-[#222] pb-4"><span className="text-blue-500">⚙️</span> ควบคุมสถานะโปรแกรม (Kill Switch)</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <label className="text-xs font-bold text-slate-400">สถานะโปรแกรมปัจจุบัน</label>
                    <div className="flex bg-[#0A0A0A] rounded-xl p-1.5 border border-[#222]">
                      <button type="button" onClick={() => setSettings({...settings, status: 'active'})} className={`flex-1 py-3 rounded-lg font-black text-xs transition-all ${settings.status === 'active' ? 'bg-emerald-500 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>✅ ACTIVE (ใช้งานปกติ)</button>
                      <button type="button" onClick={() => setSettings({...settings, status: 'locked'})} className={`flex-1 py-3 rounded-lg font-black text-xs transition-all ${settings.status === 'locked' ? 'bg-rose-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>🔒 LOCKED (ล็อกให้จ่ายเงิน)</button>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <label className="text-xs font-bold text-slate-400">วันครบกำหนดชำระเงิน (Next Billing Date)</label>
                    <input type="date" required value={settings.next_billing_date} onChange={e => setSettings({...settings, next_billing_date: e.target.value})} className="w-full bg-[#0A0A0A] border border-[#333] px-4 py-3 rounded-xl focus:outline-none focus:border-blue-500 text-white font-bold text-sm" />
                  </div>
                  <div className="md:col-span-2 space-y-3">
                    <label className="text-xs font-bold text-slate-400">ข้อความช่องทางติดต่อ (แสดงตอนระบบโดนล็อก)</label>
                    <input type="text" required value={settings.developer_contact} onChange={e => setSettings({...settings, developer_contact: e.target.value})} placeholder="เช่น โทร: 09X-XXX-XXXX หรือ Line: @devname" className="w-full bg-[#0A0A0A] border border-[#333] px-4 py-3 rounded-xl focus:outline-none focus:border-blue-500 text-white font-bold text-sm" />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'ui' && (
              <div className="bg-[#111] border border-[#222] p-6 md:p-8 rounded-[2rem] shadow-xl space-y-8 animate-in fade-in duration-300">
                <h2 className="text-base font-black text-white flex items-center gap-2 border-b border-[#222] pb-4"><span className="text-purple-500">🎨</span> ปรับแต่งหน้าตาและแบรนดิ้ง (White-label UI)</h2>
                <div className="space-y-3">
                  <label className="text-xs font-bold text-slate-400">ขนาดตัวอักษรของระบบ (Global Font Size)</label>
                  <div className="grid grid-cols-3 gap-3">
                    {[{id: 'text-xs', label: 'เล็ก (Small)'}, {id: 'text-sm', label: 'มาตรฐาน (Normal)'}, {id: 'text-base', label: 'ใหญ่ (Large)'}].map(size => (
                      <button key={size.id} type="button" onClick={() => setSettings({...settings, font_size: size.id})} className={`py-4 rounded-xl font-bold border-2 transition-all ${settings.font_size === size.id ? 'bg-purple-500/20 border-purple-500 text-purple-400' : 'bg-[#0A0A0A] border-[#222] text-slate-500 hover:border-[#444]'}`}><span className={size.id}>{size.label}</span></button>
                    ))}
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-xs font-bold text-slate-400">สีธีมหลักของระบบ (Primary Theme Color)</label>
                  <div className="flex gap-4">
                    {[{id: 'blue', color: 'bg-blue-500'}, {id: 'emerald', color: 'bg-emerald-500'}, {id: 'rose', color: 'bg-rose-500'}, {id: 'amber', color: 'bg-amber-500'}].map(theme => (
                      <button key={theme.id} type="button" onClick={() => setSettings({...settings, theme_color: theme.id})} className={`w-12 h-12 rounded-full transition-all flex items-center justify-center border-4 ${settings.theme_color === theme.id ? 'border-white scale-110 shadow-[0_0_15px_rgba(255,255,255,0.3)]' : 'border-transparent opacity-50 hover:opacity-100'} ${theme.color}`}>{settings.theme_color === theme.id && '✓'}</button>
                    ))}
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-xs font-bold text-slate-400">URL โลโก้โรงงานลูกค้า</label>
                  <div className="flex gap-4 items-center">
                    <div className="w-16 h-16 bg-[#0A0A0A] rounded-xl flex items-center justify-center text-2xl border border-[#333] overflow-hidden shrink-0">{settings.app_logo ? <img src={settings.app_logo} className="w-full h-full object-cover" /> : '🧊'}</div>
                    <input type="url" value={settings.app_logo} onChange={e => setSettings({...settings, app_logo: e.target.value})} placeholder="https://..." className="w-full bg-[#0A0A0A] border border-[#333] px-4 py-4 rounded-xl focus:outline-none focus:border-purple-500 text-white text-sm" />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'database' && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="bg-[#111] border border-[#222] p-6 md:p-8 rounded-[2rem] shadow-xl space-y-4">
                  <h2 className="text-base font-black text-white flex items-center gap-2 border-b border-[#222] pb-4"><span className="text-emerald-500">📊</span> Raw Database Statistics</h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-[#0A0A0A] p-4 rounded-xl border border-[#222]"><p className="text-[10px] text-slate-500 mb-1">TABLE: sales</p><p className="text-2xl font-black text-white">{dbStats.sales} <span className="text-xs text-slate-600 font-normal">rows</span></p></div>
                    <div className="bg-[#0A0A0A] p-4 rounded-xl border border-[#222]"><p className="text-[10px] text-slate-500 mb-1">TABLE: products</p><p className="text-2xl font-black text-white">{dbStats.products} <span className="text-xs text-slate-600 font-normal">rows</span></p></div>
                    <div className="bg-[#0A0A0A] p-4 rounded-xl border border-[#222]"><p className="text-[10px] text-slate-500 mb-1">TABLE: employees</p><p className="text-2xl font-black text-white">{dbStats.employees} <span className="text-xs text-slate-600 font-normal">rows</span></p></div>
                    <div className="bg-[#0A0A0A] p-4 rounded-xl border border-[#222]"><p className="text-[10px] text-slate-500 mb-1">TABLE: drawer_logs</p><p className="text-2xl font-black text-white">{dbStats.pos_logs} <span className="text-xs text-slate-600 font-normal">rows</span></p></div>
                  </div>
                </div>

                <div className="bg-rose-950/20 border border-rose-900/50 p-6 md:p-8 rounded-[2rem] shadow-xl space-y-4">
                  <h2 className="text-base font-black text-rose-500 flex items-center gap-2 border-b border-rose-900/50 pb-4"><span>⚠️</span> Danger Zone (เขตอันตราย)</h2>
                  <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-[#0A0A0A] p-5 rounded-xl border border-rose-900/30">
                    <div><h3 className="font-bold text-rose-100 text-sm">ล้างข้อมูลธุรกรรมทั้งหมด</h3><p className="text-xs text-slate-500 mt-1">ลบข้อมูลในตารางขาย และ ประวัติลิ้นชักทั้งหมด (รีเซ็ตระบบส่งมอบลูกค้า)</p></div>
                    <button type="button" onClick={handleWipeSalesData} className="w-full md:w-auto bg-rose-600 hover:bg-rose-700 text-white px-6 py-3 rounded-lg font-black text-xs transition-colors shrink-0">🚨 เริ่มการล้างข้อมูล</button>
                  </div>
                </div>
              </div>
            )}

            {activeTab !== 'database' && (
              <div className="sticky bottom-4 z-50 mt-8 pt-4">
                <button type="submit" disabled={isSaving} className="w-full bg-white hover:bg-slate-200 text-black font-black py-4 rounded-xl shadow-[0_0_30px_rgba(255,255,255,0.2)] transition-transform active:scale-95 text-sm flex items-center justify-center gap-2">
                  {isSaving ? '⏳ Uploading to Cloud...' : '💾 [Dev] Execute Save Command'}
                </button>
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  )
}