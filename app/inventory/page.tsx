'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type TabletNavProps = { pathname: string; employeeName: string }
type InventoryProduct = { id: string; name: string; category: string; price: number; unit?: string; stock?: number; image?: string; icon?: string }
type InventoryLog = { id: string; date?: string; product_id: string; product_name: string; type: 'IN' | 'OUT'; qty: number; note?: string; by: string }
type NumpadState = { isOpen: boolean; type: 'IN' | 'OUT'; product: InventoryProduct | null; value: string; time: string; reason: string }

function TabletNav({ pathname, employeeName }: TabletNavProps) {
  return (
    <div className="flex items-center gap-3 overflow-x-auto pb-2 md:pb-0 scrollbar-hide shrink-0">
      <Link href="/" className="bg-white p-3 md:p-4 rounded-2xl shadow-sm hover:bg-slate-50 text-slate-600 font-bold border border-slate-200 transition-all active:scale-95 flex items-center justify-center shrink-0">🏠</Link>
      <div className="flex bg-white rounded-2xl p-1.5 border border-slate-200 shadow-sm shrink-0">
        <Link href="/sales/pos" className={`px-4 py-2.5 rounded-xl text-xs md:text-sm font-bold transition-all flex items-center gap-2 ${pathname === '/sales/pos' ? 'bg-emerald-50 text-emerald-700' : 'text-slate-500 hover:bg-slate-50'}`}>🛒 POS</Link>
        <Link href="/inventory" className={`px-4 py-2.5 rounded-xl text-xs md:text-sm font-bold transition-all flex items-center gap-2 ${pathname === '/inventory' ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-50'}`}>📦 เช็คคลังสินค้า</Link>
        <Link href="/inventory/truck-loading" className={`px-4 py-2.5 rounded-xl text-xs md:text-sm font-bold transition-all flex items-center gap-2 ${pathname === '/inventory/truck-loading' ? 'bg-orange-50 text-orange-700' : 'text-slate-500 hover:bg-slate-50'}`}>🚚 จ่ายของขึ้นรถ</Link>
        <Link href="/trucks/maintenance" className={`px-4 py-2.5 rounded-xl text-xs md:text-sm font-bold transition-all flex items-center gap-2 ${pathname === '/trucks/maintenance' ? 'bg-purple-50 text-purple-700' : 'text-slate-500 hover:bg-slate-50'}`}>🔧 ซ่อมบำรุงรถ</Link>
      </div>
      <div className="bg-white px-4 py-3 md:py-3.5 rounded-2xl border border-slate-200 font-bold text-slate-600 shadow-sm text-xs md:text-sm shrink-0 flex items-center gap-2">
        <span className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center text-lg">👤</span><span className="hidden md:inline">พนักงาน:</span> {employeeName}
      </div>
    </div>
  )
}

export default function InventoryCheckPage() {
  const [products, setProducts] = useState<InventoryProduct[]>([])
  const [logs, setLogs] = useState<InventoryLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const pathname = usePathname()
  
  const [employeeName, setEmployeeName] = useState('กำลังโหลดชื่อ...')
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false)
  const [activeCategory, setActiveCategory] = useState<'main' | 'packaging'>('main')

  const [numpad, setNumpad] = useState<NumpadState>({ isOpen: false, type: 'IN', product: null, value: '0', time: '', reason: '' })

  const fetchInventory = useCallback(async () => {
    setIsLoading(true)
    const [prodRes, logRes] = await Promise.all([
      supabase.from('products').select('*').in('category', ['main', 'packaging']).order('id'),
      supabase.from('inventory_logs').select('*').order('date', { ascending: false }) // ดึงมาทั้งหมดเพื่อทำ Analytics
    ])
    
    if (prodRes.data) setProducts(prodRes.data as InventoryProduct[])
    if (logRes.data) setLogs(logRes.data as InventoryLog[])
    setIsLoading(false)
  }, [])

  useEffect(() => {
    const session = localStorage.getItem('kingsawang_session')
    if (session) setEmployeeName(JSON.parse(session).name)
    void fetchInventory()
  }, [fetchInventory])

  const openNumpad = (product: InventoryProduct, type: 'IN' | 'OUT') => {
    const now = new Date()
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    
    // ตั้งค่าเหตุผลเริ่มต้น
    let defaultReason = type === 'IN' ? 'ผลิตเสร็จ/รับเข้า' : 'เบิกออก/ใช้งาน'
    if (product.category === 'packaging') {
      defaultReason = type === 'IN' ? 'รับกระสอบใหม่ (ซื้อเข้า)' : 'เบิกกระสอบไปใช้งาน'
    }

    setNumpad({ isOpen: true, type, product, value: '0', time: currentTime, reason: defaultReason })
  }

  const handleNumPress = (num: string) => setNumpad(prev => ({ ...prev, value: prev.value === '0' ? num : prev.value + num }))
  const handleBackspace = () => setNumpad(prev => ({ ...prev, value: prev.value.length > 1 ? prev.value.slice(0, -1) : '0' }))

  const submitStockChange = async () => {
    const qty = Number(numpad.value)
    const product = numpad.product
    
    if (qty <= 0) return alert('กรุณาระบุจำนวนที่ต้องการทำรายการ')
    if (!product) return

    const newStock = numpad.type === 'IN' ? Number(product.stock || 0) + qty : Number(product.stock || 0) - qty
    if (newStock < 0) return alert('❌ ยอดคงเหลือห้ามติดลบ! (สต๊อกไม่พอเบิก)')

    // ใช้ note จาก reason ที่เลือกใน UI
    let finalNote = numpad.reason
    if (numpad.type === 'IN' && product.category === 'main' && numpad.reason.includes('ผลิตเสร็จ')) {
      finalNote = `${numpad.reason} (รอบเวลา ${numpad.time} น.)`
    }

    await supabase.from('products').update({ stock: newStock }).eq('id', product.id)
    
    await supabase.from('inventory_logs').insert([{
      id: `LOG-${Date.now()}`, date: new Date().toISOString(), product_id: product.id, product_name: product.name, type: numpad.type, qty: qty, note: finalNote, by: employeeName
    }])

    alert(`✅ ${numpad.type === 'IN' ? 'รับเข้า' : 'เบิกออก'}สต๊อกสำเร็จ!`)
    setNumpad(prev => ({ ...prev, isOpen: false }))
    fetchInventory()
  }

  const displayedProducts = products.filter(p => p.category === activeCategory && p.name.toLowerCase().includes(searchQuery.toLowerCase()))
  const currentCategoryStock = products.filter(p => p.category === activeCategory).reduce((sum, p) => sum + Number(p.stock || 0), 0)

  // 📊 คำนวณ Dashboard สำหรับคลังกระสอบโดยเฉพาะ (เดือนปัจจุบัน)
  const sackAnalytics = useMemo(() => {
    const currentMonth = new Date().toISOString().slice(0, 7)
    const currentLogs = logs.filter(log => log.product_name.includes('กระสอบ') && log.date?.startsWith(currentMonth))
    
    return {
      newIn: currentLogs.filter(l => l.type === 'IN' && l.note?.includes('ซื้อเข้า')).reduce((sum, l) => sum + l.qty, 0),
      returned: currentLogs.filter(l => l.type === 'IN' && (l.note?.includes('รับคืน') || l.note?.includes('ลูกค้า'))).reduce((sum, l) => sum + l.qty, 0),
      damaged: currentLogs.filter(l => l.type === 'OUT' && (l.note?.includes('ชำรุด') || l.note?.includes('ขาด'))).reduce((sum, l) => sum + l.qty, 0),
      lost: currentLogs.filter(l => l.type === 'OUT' && l.note?.includes('หาย')).reduce((sum, l) => sum + l.qty, 0),
    }
  }, [logs])

  return (
    <div className="fixed inset-0 z-[999] flex flex-col bg-slate-100 overflow-hidden text-xs md:text-sm font-sans">
      <div className="p-4 md:p-6 w-full max-w-7xl mx-auto flex flex-col h-full overflow-hidden">
        <TabletNav pathname={pathname} employeeName={employeeName} />

        {/* 🌟 Tab Switcher (น้ำแข็ง vs กระสอบ) */}
        <div className="flex bg-white p-1.5 rounded-2xl w-full md:w-fit shadow-sm border border-slate-200 mt-6 shrink-0 mx-auto">
          <button onClick={() => setActiveCategory('main')} className={`flex-1 md:flex-none px-8 py-3 rounded-xl font-bold text-sm transition-all shadow-sm ${activeCategory === 'main' ? 'bg-blue-600 text-white shadow-blue-500/30' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}>
            🧊 คลังสินค้าน้ำแข็ง
          </button>
          <button onClick={() => setActiveCategory('packaging')} className={`flex-1 md:flex-none px-8 py-3 rounded-xl font-bold text-sm transition-all shadow-sm ${activeCategory === 'packaging' ? 'bg-orange-500 text-white shadow-orange-500/30' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}>
            🛍️ คลังกระสอบเปล่า
          </button>
        </div>

        {/* 🌟 Dynamic Dashboard Card */}
        {activeCategory === 'main' ? (
          <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col md:flex-row justify-between items-center gap-6 mt-6 shrink-0 animate-in fade-in duration-300">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center text-3xl shadow-sm border border-blue-100">📦</div>
              <div>
                <h1 className="text-2xl font-black text-slate-900">คลังน้ำแข็งคงเหลือ</h1>
                <p className="text-slate-500 font-medium mt-1">จัดการสต๊อกสินค้า รับเข้าจากการผลิต และเบิกออก</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="bg-blue-50 border border-blue-100 px-6 py-3 rounded-2xl text-center">
                <p className="text-[10px] font-bold text-blue-600 mb-0.5">น้ำแข็งในคลังทั้งหมด</p>
                <p className="font-black text-blue-700 text-xl">{currentCategoryStock.toLocaleString()} <span className="text-xs">หน่วย</span></p>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-[#1e293b] p-6 md:p-8 rounded-[2rem] border border-slate-700 shadow-xl flex flex-col xl:flex-row justify-between items-center gap-6 mt-6 shrink-0 animate-in fade-in duration-300 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500 rounded-full blur-[80px] opacity-20 pointer-events-none"></div>
            <div className="flex items-center gap-4 z-10 w-full xl:w-auto border-b xl:border-b-0 border-slate-700 pb-4 xl:pb-0 pr-6">
              <div className="w-14 h-14 bg-orange-500/20 text-orange-400 rounded-2xl flex items-center justify-center text-3xl border border-orange-500/30">📊</div>
              <div>
                <h1 className="text-2xl font-black text-white tracking-tight">สรุปความเคลื่อนไหวกระสอบ</h1>
                <p className="text-slate-400 font-medium mt-1 text-xs">ข้อมูลสถิติประจำเดือนนี้ (ภาพรวม)</p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 w-full xl:w-auto z-10">
              <div className="bg-slate-800/50 border border-slate-700 px-4 py-3 rounded-2xl text-center">
                <p className="text-[10px] font-bold text-slate-400 mb-1">ซื้อใหม่ (ใบ)</p>
                <p className="font-black text-emerald-400 text-xl">+{sackAnalytics.newIn.toLocaleString()}</p>
              </div>
              <div className="bg-slate-800/50 border border-slate-700 px-4 py-3 rounded-2xl text-center">
                <p className="text-[10px] font-bold text-slate-400 mb-1">หมุนเวียนรับคืน</p>
                <p className="font-black text-blue-400 text-xl">+{sackAnalytics.returned.toLocaleString()}</p>
              </div>
              <div className="bg-slate-800/50 border border-slate-700 px-4 py-3 rounded-2xl text-center">
                <p className="text-[10px] font-bold text-rose-400 mb-1">ชำรุด/ขาด/ทิ้ง</p>
                <p className="font-black text-rose-500 text-xl">-{sackAnalytics.damaged.toLocaleString()}</p>
              </div>
              <div className="bg-slate-800/50 border border-slate-700 px-4 py-3 rounded-2xl text-center">
                <p className="text-[10px] font-bold text-orange-400 mb-1">สูญหาย (หักเงิน)</p>
                <p className="font-black text-orange-500 text-xl">-{sackAnalytics.lost.toLocaleString()}</p>
              </div>
            </div>
          </div>
        )}

        {/* 🌟 Action Bar (ค้นหา + ปุ่มประวัติ) */}
        <div className="flex gap-4 mt-6 shrink-0">
          <div className="relative flex-1">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
            <input type="text" placeholder={`ค้นหา${activeCategory === 'main' ? 'น้ำแข็ง' : 'กระสอบ'}...`} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-12 pr-4 py-4 rounded-2xl border border-slate-200 focus:outline-none focus:border-blue-500 font-bold text-slate-700 bg-white shadow-sm" />
          </div>
          <button onClick={() => setIsHistoryModalOpen(true)} className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 px-6 py-4 rounded-2xl font-bold flex items-center gap-2 shadow-sm active:scale-95 transition-all">
            <span className="text-lg">⏱️</span><span className="hidden md:inline">ประวัติความเคลื่อนไหว</span>
          </button>
        </div>

        {/* 🌟 ตารางสินค้า (Grid Cards) */}
        <div className="flex-1 overflow-y-auto mt-6 pb-20 scrollbar-hide">
          {isLoading ? (
            <div className="text-center py-20 font-bold text-slate-400">⏳ กำลังโหลดคลังสินค้า...</div>
          ) : displayedProducts.length === 0 ? (
            <div className="text-center py-20 font-bold text-slate-400">ไม่พบสินค้าในหมวดหมู่นี้</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {displayedProducts.map(p => (
                <div key={p.id} className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col h-full relative group">
                  <div className="flex justify-between items-start mb-3">
                    <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center text-3xl border border-slate-100 overflow-hidden shadow-sm group-hover:scale-105 transition-transform">
                      {p.image ? (<Image src={p.image} alt={p.name} width={64} height={64} unoptimized className="w-full h-full object-cover" />) : p.icon}
                    </div>
                  </div>
                  <h3 className="font-black text-slate-800 text-sm mb-3 line-clamp-2 leading-tight h-10">{p.name}</h3>
                  <div className={`rounded-2xl p-3 flex flex-col items-center justify-center border mb-4 mt-auto ${Number(p.stock) < 10 ? 'bg-rose-50 border-rose-100' : 'bg-blue-50 border-blue-100'}`}>
                    <p className={`text-[10px] font-bold mb-0.5 ${Number(p.stock) < 10 ? 'text-rose-500' : 'text-blue-500'}`}>ยอดคงเหลือจริง</p>
                    <div className="flex items-baseline gap-1">
                      <span className={`font-black text-4xl tracking-tight ${Number(p.stock) < 10 ? 'text-rose-700' : 'text-blue-700'}`}>{Number(p.stock || 0).toLocaleString()}</span>
                      <span className={`text-xs font-bold ${Number(p.stock) < 10 ? 'text-rose-500' : 'text-blue-500'}`}>{p.unit}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-auto">
                    <button onClick={() => openNumpad(p, 'IN')} className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 py-3 rounded-xl font-bold transition-transform active:scale-95 flex flex-col items-center justify-center shadow-sm">
                      <span className="text-xl leading-none mb-1">+</span><span className="text-[10px]">รับเข้า</span>
                    </button>
                    <button onClick={() => openNumpad(p, 'OUT')} className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 py-3 rounded-xl font-bold transition-transform active:scale-95 flex flex-col items-center justify-center shadow-sm">
                      <span className="text-xl leading-none mb-1">-</span><span className="text-[10px]">เบิกออก/ตัดทิ้ง</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 🚀 Modal: หน้าต่างประวัติความเคลื่อนไหว */}
      {isHistoryModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg h-[80vh] flex flex-col animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0 rounded-t-[2rem]">
              <div><h3 className="font-black text-slate-800 text-xl flex items-center gap-2">⏱️ ประวัติความเคลื่อนไหวทั้งหมด</h3><p className="text-[10px] text-slate-500 mt-1 font-bold">บันทึก 20 รายการล่าสุด</p></div>
              <button onClick={() => setIsHistoryModalOpen(false)} className="w-10 h-10 rounded-full bg-white text-slate-400 font-bold hover:text-rose-500 hover:bg-rose-50 border border-slate-200 shadow-sm flex items-center justify-center transition-colors">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
              {logs.slice(0, 20).map(log => (
                <div key={log.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-2">
                    <span className={`px-3 py-1 rounded-lg text-xs font-black ${log.type === 'IN' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{log.type === 'IN' ? 'รับเข้า' : 'เบิกออก'}</span>
                    <span className={`font-black text-xl ${log.type === 'IN' ? 'text-emerald-600' : 'text-rose-600'}`}>{log.type === 'IN' ? '+' : '-'}{log.qty}</span>
                  </div>
                  <p className="font-black text-slate-800 text-base mb-1">{log.product_name}</p>
                  <p className={`text-[11px] font-bold mb-2 inline-block px-2 py-0.5 rounded ${log.note?.includes('ชำรุด') || log.note?.includes('หาย') ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600'}`}>{log.note}</p>
                  <div className="flex justify-between items-center mt-2 pt-3 border-t border-slate-100 text-[10px] text-slate-400 font-bold">
                    <span className="flex items-center gap-1">👤 โดย: {log.by}</span>
                    <span>{log.date ? new Date(log.date).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }) : '-'} น.</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 🚀 Modal: Numpad รับเข้า / เบิกออก (อัปเกรดระบบเลือกเหตุผล) */}
      {numpad.isOpen && numpad.product && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm print:hidden">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className={`p-5 border-b flex justify-between items-center ${numpad.type === 'IN' ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
              <h3 className={`font-black text-lg flex items-center gap-2 ${numpad.type === 'IN' ? 'text-emerald-700' : 'text-rose-700'}`}>{numpad.type === 'IN' ? '📥 รับเข้าสต๊อก' : '📤 ตัดสต๊อก / เบิกออก'}</h3>
              <button onClick={() => setNumpad(prev => ({...prev, isOpen: false}))} className="w-8 h-8 rounded-full bg-white text-slate-400 font-bold hover:text-rose-500 shadow-sm border border-slate-200">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="text-center space-y-1"><p className="text-xs font-bold text-slate-500">สินค้าที่ทำรายการ</p><p className="font-black text-xl text-slate-800 line-clamp-1">{numpad.product.name}</p></div>
              
              {/* 🌟 เลือกเหตุผลการนำเข้า/ออก */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase">เหตุผล / หมวดหมู่</label>
                <select 
                  value={numpad.reason} 
                  onChange={e => setNumpad(prev => ({...prev, reason: e.target.value}))} 
                  className="w-full border-2 border-slate-200 px-3 py-2 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500"
                >
                  {numpad.type === 'IN' ? (
                    numpad.product.category === 'packaging' ? (
                      <><option value="รับกระสอบใหม่ (ซื้อเข้า)">สั่งซื้อกระสอบมาใหม่ (เพิ่มสต๊อก)</option><option value="รับคืนกระสอบ (เคลียร์มือ)">ลูกค้านำมาคืน (Manual)</option></>
                    ) : (
                      <><option value="ผลิตเสร็จ/รับเข้า">ผลิตเสร็จ / รับเข้าปกติ</option><option value="ปรับปรุงยอดเข้า (Manual)">ปรับปรุงยอดเข้า (บวกเพิ่ม)</option></>
                    )
                  ) : (
                    numpad.product.category === 'packaging' ? (
                      <><option value="เบิกกระสอบไปใช้งาน">เบิกไปใช้งานที่ลาน/บรรจุ</option><option value="กระสอบชำรุด/ขาด/คัดทิ้ง">กระสอบชำรุด/ขาด/ทิ้ง 💥</option><option value="กระสอบสูญหาย">กระสอบสูญหาย ❓</option></>
                    ) : (
                      <><option value="เบิกออก/ใช้งาน">เบิกออก / ใช้งานปกติ</option><option value="สินค้าชำรุด/ละลาย/ทิ้ง">สินค้าชำรุด / ละลาย 💥</option><option value="ปรับปรุงยอดออก (Manual)">ปรับปรุงยอดออก (ลบออก)</option></>
                    )
                  )}
                </select>
              </div>

              {numpad.type === 'IN' && numpad.product.category === 'main' && numpad.reason.includes('ผลิตเสร็จ') && (
                <div className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-100 flex items-center justify-between">
                  <label className="text-xs font-bold text-emerald-800 flex items-center gap-1">⏱️ เวลาที่ผลิตเสร็จ:</label>
                  <input type="time" value={numpad.time} onChange={(e) => setNumpad(prev => ({ ...prev, time: e.target.value }))} className="bg-white border border-emerald-200 px-3 py-1.5 rounded-lg font-black text-emerald-700 focus:outline-none focus:border-emerald-500 text-sm" />
                </div>
              )}

              <div className={`p-4 rounded-2xl border-2 flex justify-between items-center bg-slate-50 ${numpad.type === 'IN' ? 'border-emerald-200' : 'border-rose-200'}`}>
                <span className="text-sm font-bold text-slate-400">จำนวน:</span><span className={`text-4xl font-black tracking-tight ${numpad.type === 'IN' ? 'text-emerald-600' : 'text-rose-600'}`}>{Number(numpad.value).toLocaleString()}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-2">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (<button key={num} onClick={() => handleNumPress(num.toString())} className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-black text-2xl py-4 rounded-xl shadow-sm active:scale-95 transition-all">{num}</button>))}
                <button onClick={() => setNumpad(prev => ({...prev, value: '0'}))} className="bg-rose-50 hover:bg-rose-100 text-rose-500 font-black text-lg py-4 rounded-xl shadow-sm active:scale-95 transition-all">ล้าง</button>
                <button onClick={() => handleNumPress('0')} className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-black text-2xl py-4 rounded-xl shadow-sm active:scale-95 transition-all">0</button>
                <button onClick={handleBackspace} className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-black text-xl py-4 rounded-xl shadow-sm active:scale-95 transition-all">⌫</button>
              </div>
              <button onClick={submitStockChange} className={`w-full text-white font-black py-4 rounded-xl shadow-lg mt-2 text-lg active:scale-95 transition-transform ${numpad.type === 'IN' ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/30' : 'bg-rose-500 hover:bg-rose-600 shadow-rose-500/30'}`}>{numpad.type === 'IN' ? '💾 ยืนยันรับเข้าสต๊อก' : '💾 ยืนยันทำรายการ'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}