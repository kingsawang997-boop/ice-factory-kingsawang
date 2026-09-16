'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  getSessionUser,
  isStockApproverRole,
  readStockApprovalRequests,
  syncApprovalInbox,
  writeStockApprovalRequests,
  type StockApprovalRequest
} from '@/lib/stock-approval'

type TabletNavProps = { pathname: string; employeeName: string; approvalQueueCount: number; canApproveStock: boolean }
type InventoryProduct = { id: string; name: string; category: string; price: number; unit?: string; stock?: number; image?: string; icon?: string }
type InventoryLog = { id: string; date?: string; product_id: string; product_name: string; type: 'IN' | 'OUT'; qty: number; note?: string; by: string }
type NumpadState = { isOpen: boolean; type: 'IN' | 'OUT'; product: InventoryProduct | null; value: string; time: string; reason: string }

const buildApprovalId = () => `stock-approval-${Math.random().toString(36).slice(2, 10)}`

function TabletNav({ pathname, employeeName, approvalQueueCount, canApproveStock }: TabletNavProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 pb-2 shrink-0">
      <Link href="/" className="bg-white p-3 rounded-xl shadow-sm hover:bg-slate-50 text-slate-600 font-bold border border-slate-200 transition-all active:scale-95 flex items-center justify-center">🏠</Link>
      <div className="flex bg-white rounded-xl p-1 border border-slate-200 shadow-sm shrink-0">
        <Link href="/sales/pos" className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${pathname === '/sales/pos' ? 'bg-emerald-50 text-emerald-700' : 'text-slate-500 hover:bg-slate-50'}`}>🛒 POS</Link>
        <Link href="/inventory" className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${pathname === '/inventory' ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-50'}`}>📦 เช็คคลังสินค้า</Link>
        <Link href="/inventory/truck-loading" className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${pathname === '/inventory/truck-loading' ? 'bg-orange-50 text-orange-700' : 'text-slate-500 hover:bg-slate-50'}`}>🚚 จ่ายของขึ้นรถ</Link>
        {canApproveStock && (
          <Link href="/inventory/approvals" className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${pathname === '/inventory/approvals' ? 'bg-amber-50 text-amber-700' : 'text-slate-500 hover:bg-slate-50'}`}>
            🧾 อนุมัติ
            {approvalQueueCount > 0 && <span className="bg-amber-500 text-white rounded-full min-w-[18px] h-[18px] text-[10px] leading-[18px] px-1">{approvalQueueCount}</span>}
          </Link>
        )}
        <Link href="/trucks/maintenance" className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${pathname === '/trucks/maintenance' ? 'bg-purple-50 text-purple-700' : 'text-slate-500 hover:bg-slate-50'}`}>🔧 ซ่อมบำรุงรถ</Link>
      </div>
      <div className="bg-white px-3 py-2 rounded-xl border border-slate-200 font-bold text-slate-600 shadow-sm text-xs shrink-0 flex items-center gap-2 ml-auto">
        <span className="w-5 h-5 bg-slate-100 rounded-full flex items-center justify-center">👤</span>{employeeName}
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
  
  const [employeeName] = useState(() => {
    if (typeof window === 'undefined') return 'กำลังโหลดชื่อ...'
    try {
      const session = localStorage.getItem('kingsawang_session')
      if (!session) return 'กำลังโหลดชื่อ...'
      return JSON.parse(session).name || 'ไม่ระบุชื่อ'
    } catch {
      return 'กำลังโหลดชื่อ...'
    }
  })
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false)
  const [approvalQueueCount, setApprovalQueueCount] = useState(0)
  
  // 🌟 เริ่มต้นที่หน้ากระสอบเปล่าเลย (ตามที่คุณต้องการดู)
  const [activeCategory, setActiveCategory] = useState<'main' | 'packaging'>('packaging')
  
  const [numpad, setNumpad] = useState<NumpadState>({ isOpen: false, type: 'IN', product: null, value: '0', time: '', reason: '' })

  const refreshApprovalQueueCount = useCallback(async () => {
    const requests = await readStockApprovalRequests()
    setApprovalQueueCount(requests.filter((request) => request.status === 'pending').length)
  }, [])

  const fetchInventory = useCallback(async () => {
    setIsLoading(true)
    const [prodRes, logRes] = await Promise.all([
      supabase.from('products').select('*').in('category', ['main', 'packaging']).order('id'),
      supabase.from('inventory_logs').select('*').order('date', { ascending: false })
    ])
    
    if (prodRes.data) setProducts(prodRes.data as InventoryProduct[])
    if (logRes.data) setLogs(logRes.data as InventoryLog[])
    setIsLoading(false)
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshApprovalQueueCount()
      void fetchInventory()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [fetchInventory, refreshApprovalQueueCount])

  const openNumpad = (product: InventoryProduct, type: 'IN' | 'OUT') => {
    const sessionUser = getSessionUser()
    const userRole = sessionUser?.role || ''

    if (type === 'OUT' && !isStockApproverRole(userRole)) {
      const request: StockApprovalRequest = {
        id: buildApprovalId(),
        productId: product.id,
        productName: product.name,
        productCategory: product.category,
        quantity: 1,
        action: 'OUT',
        reason: 'รออนุมัติจากผู้บริหารหรือพนักงานที่ได้รับแต่งตั้ง',
        requestedBy: sessionUser?.name || 'ไม่ระบุชื่อ',
        requestedByRole: userRole,
        requestedAt: new Date().toISOString(),
        status: 'pending'
      }

      const allRequests = readStockApprovalRequests()
      writeStockApprovalRequests([request, ...allRequests])
      void syncApprovalInbox(request, 'pending')
      refreshApprovalQueueCount()
      alert('⚠️ คำขออนุมัติถูกส่งแล้ว กรุณารอการอนุมัติจากผู้บริหารหรือพนักงานที่ได้รับแต่งตั้ง')
      return
    }

    const now = new Date()
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    
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

    const sessionUser = getSessionUser()
    const userRole = sessionUser?.role || ''
    const isApprover = isStockApproverRole(userRole)

    if (numpad.type === 'OUT' && !isApprover) {
      const request: StockApprovalRequest = {
        id: buildApprovalId(),
        productId: product.id,
        productName: product.name,
        productCategory: product.category,
        quantity: qty,
        action: 'OUT',
        reason: numpad.reason,
        requestedBy: sessionUser?.name || 'ไม่ระบุชื่อ',
        requestedByRole: userRole,
        requestedAt: new Date().toISOString(),
        status: 'pending'
      }

      const allRequests = readStockApprovalRequests()
      writeStockApprovalRequests([request, ...allRequests])
      void syncApprovalInbox(request, 'pending')
      refreshApprovalQueueCount()
      alert('⚠️ คำขออนุมัติถูกส่งแล้ว กรุณารอการอนุมัติจากผู้บริหารหรือพนักงานที่ได้รับแต่งตั้ง')
      setNumpad(prev => ({ ...prev, isOpen: false }))
      return
    }

    const newStock = numpad.type === 'IN' ? Number(product.stock || 0) + qty : Number(product.stock || 0) - qty
    if (newStock < 0) return alert('❌ ยอดคงเหลือห้ามติดลบ! (สต๊อกไม่พอเบิก)')

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

  const canApproveStock = isStockApproverRole(getSessionUser()?.role || '')

  // 📊 คำนวณ Analytics ของกระสอบ (บีบโค้ดให้เร็วขึ้น)
  const sackAnalytics = useMemo(() => {
    const currentMonth = new Date().toISOString().slice(0, 7)
    const currentLogs = logs.filter(log => (log.product_name.includes('กระสอบ') || log.product_id.includes('PKG')) && log.date?.startsWith(currentMonth))
    
    return {
      newIn: currentLogs.filter(l => l.type === 'IN' && l.note?.includes('ซื้อเข้า')).reduce((sum, l) => sum + l.qty, 0),
      returned: currentLogs.filter(l => l.type === 'IN' && (l.note?.includes('รับคืน') || l.note?.includes('เคลียร์'))).reduce((sum, l) => sum + l.qty, 0),
      damaged: currentLogs.filter(l => l.type === 'OUT' && (l.note?.includes('ชำรุด') || l.note?.includes('ขาด'))).reduce((sum, l) => sum + l.qty, 0),
      lost: currentLogs.filter(l => l.type === 'OUT' && l.note?.includes('หาย')).reduce((sum, l) => sum + l.qty, 0),
    }
  }, [logs])

  return (
    <div className="fixed inset-0 z-[999] flex flex-col bg-slate-50 overflow-hidden text-xs md:text-sm font-sans">
      <div className="p-4 w-full max-w-7xl mx-auto flex flex-col h-full overflow-hidden">
        
        <TabletNav pathname={pathname} employeeName={employeeName} approvalQueueCount={approvalQueueCount} canApproveStock={canApproveStock} />

        {/* 🌟 Tab Switcher (บีบให้เล็กและอยู่ตรงกลาง) */}
        <div className="flex bg-white p-1 rounded-xl w-fit shadow-sm border border-slate-200 mt-2 mx-auto shrink-0">
          <button onClick={() => setActiveCategory('main')} className={`px-6 py-2 rounded-lg font-bold text-xs transition-all ${activeCategory === 'main' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>
            🧊 คลังสินค้าน้ำแข็ง
          </button>
          <button onClick={() => setActiveCategory('packaging')} className={`px-6 py-2 rounded-lg font-bold text-xs transition-all ${activeCategory === 'packaging' ? 'bg-orange-500 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>
            🛍️ คลังกระสอบเปล่า
          </button>
        </div>

        {/* 🌟 Compact Dashboard & Action Bar (บีบรวมกันเป็น 1 แถว) */}
        <div className="flex flex-col lg:flex-row gap-3 mt-4 shrink-0">
          
          {/* Dashboard สรุปกระสอบ (เปลี่ยนจากกล่องดำใหญ่ เป็นกล่องยาวเรียบหรู) */}
          {activeCategory === 'packaging' ? (
            <div className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl p-3 flex flex-wrap lg:flex-nowrap items-center justify-between shadow-lg gap-4">
              <div className="flex items-center gap-3 pl-2">
                <span className="text-2xl">📊</span>
                <div>
                  <h2 className="text-white font-black text-sm">ความเคลื่อนไหวกระสอบ</h2>
                  <p className="text-slate-400 text-[10px] font-bold">ข้อมูลสรุปประจำเดือนนี้</p>
                </div>
              </div>
              <div className="flex gap-2 w-full lg:w-auto">
                <div className="flex-1 lg:flex-none bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700 text-center">
                  <p className="text-[9px] text-emerald-400 font-bold">ซื้อใหม่</p>
                  <p className="text-white font-black">+{sackAnalytics.newIn}</p>
                </div>
                <div className="flex-1 lg:flex-none bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700 text-center">
                  <p className="text-[9px] text-blue-400 font-bold">รับคืนมา</p>
                  <p className="text-white font-black">+{sackAnalytics.returned}</p>
                </div>
                <div className="flex-1 lg:flex-none bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700 text-center">
                  <p className="text-[9px] text-rose-400 font-bold">ชำรุด/ขาด</p>
                  <p className="text-white font-black">-{sackAnalytics.damaged}</p>
                </div>
                <div className="flex-1 lg:flex-none bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700 text-center">
                  <p className="text-[9px] text-orange-400 font-bold">หาย(หักเงิน)</p>
                  <p className="text-white font-black">-{sackAnalytics.lost}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 bg-white border border-slate-200 rounded-2xl p-3 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-3 pl-2">
                <span className="text-2xl text-blue-500">🧊</span>
                <div>
                  <h2 className="text-slate-800 font-black text-sm">ภาพรวมคลังสินค้าน้ำแข็ง</h2>
                  <p className="text-slate-500 text-[10px] font-bold">ยอดคงเหลือรวมทั้งหมดในระบบ</p>
                </div>
              </div>
              <div className="bg-blue-50 px-6 py-2 rounded-xl border border-blue-100">
                <p className="text-blue-700 font-black text-xl">{currentCategoryStock.toLocaleString()} <span className="text-xs">หน่วย</span></p>
              </div>
            </div>
          )}

          {/* ช่องค้นหา + ปุ่มประวัติ */}
          <div className="flex gap-2 lg:w-[350px]">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
              <input type="text" placeholder="ค้นหาสินค้า..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-9 pr-3 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:border-blue-500 font-bold text-slate-700 bg-white shadow-sm text-xs h-full" />
            </div>
            <button onClick={() => setIsHistoryModalOpen(true)} className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 px-4 rounded-2xl font-bold flex items-center gap-2 shadow-sm active:scale-95 transition-all text-xs h-full shrink-0">
              ⏱️ ประวัติ
            </button>
          </div>
        </div>

        {/* 🌟 ตารางสินค้า (ปรับให้กินพื้นที่ล่างทั้งหมด) */}
        <div className="flex-1 overflow-y-auto mt-4 pb-10 scrollbar-hide bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          {isLoading ? (
            <div className="text-center py-20 font-bold text-slate-400">⏳ กำลังโหลดคลังสินค้า...</div>
          ) : displayedProducts.length === 0 ? (
            <div className="text-center py-20 font-bold text-slate-400">ไม่พบสินค้าในหมวดหมู่นี้</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {displayedProducts.map(p => (
                <div key={p.id} className="bg-slate-50 p-3 rounded-2xl border border-slate-100 shadow-sm flex flex-col h-full relative group">
                  <div className="flex justify-between items-start mb-2">
                    <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center text-2xl border border-slate-200 overflow-hidden shadow-sm">
                      {p.image ? (<Image src={p.image} alt={p.name} width={48} height={48} unoptimized className="w-full h-full object-cover" />) : p.icon}
                    </div>
                  </div>
                  <h3 className="font-black text-slate-800 text-xs mb-2 line-clamp-2 h-8">{p.name}</h3>
                  <div className={`rounded-xl p-2 flex flex-col items-center justify-center border mb-3 mt-auto ${Number(p.stock) < 10 ? 'bg-rose-100/50 border-rose-200' : 'bg-blue-100/50 border-blue-200'}`}>
                    <p className={`text-[9px] font-bold ${Number(p.stock) < 10 ? 'text-rose-500' : 'text-blue-500'}`}>ยอดคงเหลือ</p>
                    <div className="flex items-baseline gap-1 mt-0.5">
                      <span className={`font-black text-2xl tracking-tight ${Number(p.stock) < 10 ? 'text-rose-700' : 'text-blue-700'}`}>{Number(p.stock || 0).toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 mt-auto">
                    <button onClick={() => openNumpad(p, 'IN')} className="bg-emerald-500 hover:bg-emerald-600 text-white py-2 rounded-lg font-black active:scale-95 transition-transform shadow-sm text-xs">
                      + รับ
                    </button>
                    <button onClick={() => openNumpad(p, 'OUT')} className="bg-rose-500 hover:bg-rose-600 text-white py-2 rounded-lg font-black active:scale-95 transition-transform shadow-sm text-xs">
                      - เบิก
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
              <div><h3 className="font-black text-slate-800 text-xl flex items-center gap-2">⏱️ ประวัติความเคลื่อนไหวทั้งหมด</h3><p className="text-[10px] text-slate-500 mt-1 font-bold">บันทึก 30 รายการล่าสุด</p></div>
              <button onClick={() => setIsHistoryModalOpen(false)} className="w-10 h-10 rounded-full bg-white text-slate-400 font-bold hover:text-rose-500 hover:bg-rose-50 border border-slate-200 shadow-sm flex items-center justify-center transition-colors">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
              {logs.slice(0, 30).map(log => (
                <div key={log.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-2">
                    <span className={`px-3 py-1 rounded-lg text-xs font-black ${log.type === 'IN' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{log.type === 'IN' ? 'รับเข้า' : 'เบิกออก'}</span>
                    <span className={`font-black text-xl ${log.type === 'IN' ? 'text-emerald-600' : 'text-rose-600'}`}>{log.type === 'IN' ? '+' : '-'}{log.qty}</span>
                  </div>
                  <p className="font-black text-slate-800 text-sm mb-1">{log.product_name}</p>
                  <p className={`text-[10px] font-bold mb-2 inline-block px-2 py-0.5 rounded ${log.note?.includes('ชำรุด') || log.note?.includes('หาย') ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600'}`}>{log.note}</p>
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

      {/* 🚀 Modal: Numpad รับเข้า / เบิกออก */}
      {numpad.isOpen && numpad.product && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm print:hidden">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className={`p-5 border-b flex justify-between items-center ${numpad.type === 'IN' ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
              <h3 className={`font-black text-base flex items-center gap-2 ${numpad.type === 'IN' ? 'text-emerald-700' : 'text-rose-700'}`}>{numpad.type === 'IN' ? '📥 รับเข้าสต๊อก' : '📤 ตัดสต๊อก / เบิกออก'}</h3>
              <button onClick={() => setNumpad(prev => ({...prev, isOpen: false}))} className="w-8 h-8 rounded-full bg-white text-slate-400 font-bold hover:text-rose-500 shadow-sm border border-slate-200">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="text-center space-y-1"><p className="text-[10px] font-bold text-slate-500">สินค้าที่ทำรายการ</p><p className="font-black text-lg text-slate-800 line-clamp-1">{numpad.product.name}</p></div>
              
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase">เหตุผล / หมวดหมู่</label>
                <select 
                  value={numpad.reason} 
                  onChange={e => setNumpad(prev => ({...prev, reason: e.target.value}))} 
                  className="w-full border-2 border-slate-200 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-blue-500"
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
                <div className="bg-emerald-50/50 p-2.5 rounded-xl border border-emerald-100 flex items-center justify-between">
                  <label className="text-[10px] font-bold text-emerald-800 flex items-center gap-1">⏱️ เวลาผลิตเสร็จ:</label>
                  <input type="time" value={numpad.time} onChange={(e) => setNumpad(prev => ({ ...prev, time: e.target.value }))} className="bg-white border border-emerald-200 px-2 py-1 rounded-lg font-black text-emerald-700 outline-none text-xs" />
                </div>
              )}

              <div className={`p-4 rounded-2xl border-2 flex justify-between items-center bg-slate-50 ${numpad.type === 'IN' ? 'border-emerald-200' : 'border-rose-200'}`}>
                <span className="text-xs font-bold text-slate-400">จำนวน:</span><span className={`text-4xl font-black tracking-tight ${numpad.type === 'IN' ? 'text-emerald-600' : 'text-rose-600'}`}>{Number(numpad.value).toLocaleString()}</span>
              </div>
              
              <div className="grid grid-cols-3 gap-2 pt-2">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (<button key={num} onClick={() => handleNumPress(num.toString())} className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-black text-xl py-3 rounded-xl shadow-sm active:scale-95 transition-all">{num}</button>))}
                <button onClick={() => setNumpad(prev => ({...prev, value: '0'}))} className="bg-rose-50 hover:bg-rose-100 text-rose-500 font-black text-sm py-3 rounded-xl shadow-sm active:scale-95 transition-all">ล้าง</button>
                <button onClick={() => handleNumPress('0')} className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-black text-xl py-3 rounded-xl shadow-sm active:scale-95 transition-all">0</button>
                <button onClick={handleBackspace} className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-black text-lg py-3 rounded-xl shadow-sm active:scale-95 transition-all">⌫</button>
              </div>
              
              <button onClick={submitStockChange} className={`w-full text-white font-black py-4 rounded-xl shadow-lg mt-2 text-sm active:scale-95 transition-transform ${numpad.type === 'IN' ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/30' : 'bg-rose-500 hover:bg-rose-600 shadow-rose-500/30'}`}>{numpad.type === 'IN' ? '💾 ยืนยันรับเข้าสต๊อก' : '💾 ยืนยันทำรายการ'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}