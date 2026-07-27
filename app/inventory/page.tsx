'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type TabletNavProps = {
  pathname: string
  employeeName: string
}

type InventoryProduct = {
  id: string
  name: string
  category: string
  price: number
  unit?: string
  stock?: number
  image?: string
  icon?: string
}

type InventoryLog = {
  id: string
  date?: string
  product_id: string
  product_name: string
  type: 'IN' | 'OUT'
  qty: number
  note?: string
  by: string
}

type NumpadState = {
  isOpen: boolean
  type: 'IN' | 'OUT'
  product: InventoryProduct | null
  value: string
  time: string
}

function TabletNav({ pathname, employeeName }: TabletNavProps) {
  return (
    <div className="flex items-center gap-3 overflow-x-auto pb-2 md:pb-0 scrollbar-hide shrink-0">
      <Link href="/" className="bg-white p-3 md:p-4 rounded-2xl shadow-sm hover:bg-slate-50 text-slate-600 font-bold border border-slate-200 transition-all active:scale-95 flex items-center justify-center shrink-0">🏠</Link>
      <div className="flex bg-white rounded-2xl p-1.5 border border-slate-200 shadow-sm shrink-0">
        <Link href="/sales/pos" className={`px-4 py-2.5 rounded-xl text-xs md:text-sm font-bold transition-all flex items-center gap-2 ${pathname === '/sales/pos' ? 'bg-emerald-50 text-emerald-700' : 'text-slate-500 hover:bg-slate-50'}`}>🛒 <span className="hidden md:inline">ขายหน้าร้าน (POS)</span><span className="md:hidden">POS</span></Link>
        <Link href="/inventory" className={`px-4 py-2.5 rounded-xl text-xs md:text-sm font-bold transition-all flex items-center gap-2 ${pathname === '/inventory' ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-50'}`}>📦 <span className="hidden md:inline">เช็คคลังสินค้า</span><span className="md:hidden">คลัง</span></Link>
        <Link href="/inventory/truck-loading" className={`px-4 py-2.5 rounded-xl text-xs md:text-sm font-bold transition-all flex items-center gap-2 ${pathname === '/inventory/truck-loading' ? 'bg-orange-50 text-orange-700' : 'text-slate-500 hover:bg-slate-50'}`}>🚚 <span className="hidden md:inline">จ่ายของขึ้นรถ</span><span className="md:hidden">จ่ายรถ</span></Link>
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
  
  // 🌟 แก้ไข: ป้องกัน Hydration Mismatch โดยใช้ useState เปล่าๆ แล้วค่อยไปดึง LocalStorage ใน useEffect
  const [employeeName, setEmployeeName] = useState('กำลังโหลดชื่อ...')

  // 🌟 เพิ่ม State สำหรับเปิด/ปิดหน้าต่างประวัติ
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false)

  // 🌟 State สำหรับระบบ Numpad และ เวลาผลิต
  const [numpad, setNumpad] = useState<NumpadState>({
    isOpen: false,
    type: 'IN',
    product: null,
    value: '0',
    time: ''
  })

  // 🌟 แก้ไข: ยุบรวมโค้ดโหลดข้อมูลด้วย useCallback ป้องกันการเรนเดอร์ซ้ำซ้อน
  const fetchInventory = useCallback(async () => {
    setIsLoading(true)
    const [prodRes, logRes] = await Promise.all([
      supabase.from('products').select('*').eq('category', 'main').order('id'),
      supabase.from('inventory_logs').select('*').order('date', { ascending: false }).limit(20)
    ])
    
    if (prodRes.data) setProducts(prodRes.data as InventoryProduct[])
    if (logRes.data) setLogs(logRes.data as InventoryLog[])
    setIsLoading(false)
  }, [])

  useEffect(() => {
    const session = localStorage.getItem('kingsawang_session')
    if (session) {
      setEmployeeName(JSON.parse(session).name)
    }
    
    void fetchInventory()
  }, [fetchInventory])

  // 🧮 ฟังก์ชันเปิด Numpad
  const openNumpad = (product: InventoryProduct, type: 'IN' | 'OUT') => {
    const now = new Date()
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    setNumpad({ isOpen: true, type, product, value: '0', time: currentTime })
  }

  // 🧮 ฟังก์ชันจัดการปุ่มกด
  const handleNumPress = (num: string) => setNumpad(prev => ({ ...prev, value: prev.value === '0' ? num : prev.value + num }))
  const handleBackspace = () => setNumpad(prev => ({ ...prev, value: prev.value.length > 1 ? prev.value.slice(0, -1) : '0' }))

  // 💾 ฟังก์ชันบันทึกสต๊อก
  const submitStockChange = async () => {
    const qty = Number(numpad.value)
    const product = numpad.product
    
    if (qty <= 0) return alert('กรุณาระบุจำนวนที่ต้องการทำรายการ')
    if (!product) return

    const newStock = numpad.type === 'IN' ? Number(product.stock || 0) + qty : Number(product.stock || 0) - qty
    if (newStock < 0) return alert('❌ ยอดคงเหลือห้ามติดลบ! (สต๊อกไม่พอเบิก)')

    const note = numpad.type === 'IN' 
      ? `ผลิตเสร็จ / รับของเข้า (รอบเวลา ${numpad.time} น.)` 
      : 'เบิกออก / คัดทิ้ง'

    await supabase.from('products').update({ stock: newStock }).eq('id', product.id)
    
    // บันทึกลงตาราง inventory_logs ให้ตรงชื่อคอลัมน์ใน Supabase
    await supabase.from('inventory_logs').insert([{
      id: `LOG-${Date.now()}`,
      date: new Date().toISOString(), // ส่งเวลาเข้าคอลัมน์ date
      product_id: product.id,
      product_name: product.name,
      type: numpad.type,
      qty: qty,
      note: note,
      by: employeeName
    }])

    alert(`✅ ${numpad.type === 'IN' ? 'รับเข้า' : 'เบิกออก'}สต๊อกสำเร็จ!`)
    setNumpad(prev => ({ ...prev, isOpen: false }))
    fetchInventory()
  }

  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
  const totalStock = products.reduce((sum, p) => sum + Number(p.stock || 0), 0)
  const lowStockCount = products.filter(p => Number(p.stock || 0) < 10).length

  return (
    <div className="fixed inset-0 z-[999] flex flex-col bg-slate-100 overflow-hidden text-xs md:text-sm font-sans">
      <div className="p-4 md:p-6 w-full max-w-7xl mx-auto flex flex-col h-full overflow-hidden">
        
        <TabletNav pathname={pathname} employeeName={employeeName} />

        {/* 🌟 Dashboard Card */}
        <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col md:flex-row justify-between items-center gap-6 mt-6 shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center text-3xl shadow-sm border border-blue-100">📦</div>
            <div>
              <h1 className="text-2xl font-black text-slate-900">คลังสินค้าคงเหลือ</h1>
              <p className="text-slate-500 font-medium mt-1">จัดการสต๊อกสินค้า รับเข้าจากการผลิต และเบิกออก</p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="bg-orange-50 border border-orange-100 px-6 py-3 rounded-2xl text-center">
              <p className="text-[10px] font-bold text-orange-600 mb-0.5">สินค้าใกล้หมด</p>
              <p className="font-black text-orange-700 text-xl">{lowStockCount} <span className="text-xs">รายการ</span></p>
            </div>
            <div className="bg-blue-50 border border-blue-100 px-6 py-3 rounded-2xl text-center">
              <p className="text-[10px] font-bold text-blue-600 mb-0.5">สินค้าในคลังทั้งหมด</p>
              <p className="font-black text-blue-700 text-xl">{totalStock.toLocaleString()} <span className="text-xs">หน่วย</span></p>
            </div>
          </div>
        </div>

        {/* 🌟 Action Bar (ค้นหา + ปุ่มประวัติ) */}
        <div className="flex gap-4 mt-6 shrink-0">
          <div className="relative flex-1">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
            <input type="text" placeholder="ค้นหาชื่อสินค้า..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-12 pr-4 py-4 rounded-2xl border border-slate-200 focus:outline-none focus:border-blue-500 font-bold text-slate-700 bg-white shadow-sm" />
          </div>
          <button onClick={() => setIsHistoryModalOpen(true)} className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 px-6 py-4 rounded-2xl font-bold flex items-center gap-2 shadow-sm active:scale-95 transition-all">
            <span className="text-lg">⏱️</span>
            <span className="hidden md:inline">ประวัติความเคลื่อนไหว</span>
            <span className="md:hidden">ประวัติ</span>
          </button>
        </div>

        {/* 🌟 ตารางสินค้า (เปลี่ยนเป็นแบบการ์ด Grid) */}
        <div className="flex-1 overflow-y-auto mt-6 pb-20 scrollbar-hide">
          {isLoading ? (
            <div className="text-center py-20 font-bold text-slate-400">⏳ กำลังโหลดคลังสินค้า...</div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-20 font-bold text-slate-400">ไม่พบสินค้าที่ค้นหา</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {filteredProducts.map(p => (
                <div key={p.id} className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col h-full relative group">
                  
                  {/* หัวการ์ด (รูป + หมวดหมู่) */}
                  <div className="flex justify-between items-start mb-3">
                    <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center text-3xl border border-slate-100 overflow-hidden shadow-sm group-hover:scale-105 transition-transform">
                      {p.image ? (
                        <Image
                          src={p.image}
                          alt={p.name}
                          width={64}
                          height={64}
                          unoptimized
                          className="w-full h-full object-cover"
                        />
                      ) : p.icon}
                    </div>
                    <span className="bg-slate-100 text-slate-500 px-2 py-1 rounded-lg text-[10px] font-bold border border-slate-200">
                      {p.category === 'main' ? 'กระสอบ' : 'ปลีก'}
                    </span>
                  </div>

                  {/* ชื่อสินค้า */}
                  <h3 className="font-black text-slate-800 text-sm mb-3 line-clamp-2 leading-tight h-10">{p.name}</h3>

                  {/* กล่องแสดงยอดคงเหลือ */}
                  <div className={`rounded-2xl p-3 flex flex-col items-center justify-center border mb-4 mt-auto ${Number(p.stock) < 10 ? 'bg-rose-50 border-rose-100' : 'bg-blue-50 border-blue-100'}`}>
                    <p className={`text-[10px] font-bold mb-0.5 ${Number(p.stock) < 10 ? 'text-rose-500' : 'text-blue-500'}`}>ยอดคงเหลือ</p>
                    <div className="flex items-baseline gap-1">
                      <span className={`font-black text-4xl tracking-tight ${Number(p.stock) < 10 ? 'text-rose-700' : 'text-blue-700'}`}>
                        {Number(p.stock || 0).toLocaleString()}
                      </span>
                      <span className={`text-xs font-bold ${Number(p.stock) < 10 ? 'text-rose-500' : 'text-blue-500'}`}>{p.unit}</span>
                    </div>
                  </div>

                  {/* ปุ่มกด รับเข้า/เบิกออก */}
                  <div className="grid grid-cols-2 gap-2 mt-auto">
                    <button onClick={() => openNumpad(p, 'IN')} className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 py-3 rounded-xl font-bold transition-transform active:scale-95 flex flex-col items-center justify-center shadow-sm">
                      <span className="text-xl leading-none mb-1">+</span>
                      <span className="text-[10px]">รับเข้า</span>
                    </button>
                    <button onClick={() => openNumpad(p, 'OUT')} className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 py-3 rounded-xl font-bold transition-transform active:scale-95 flex flex-col items-center justify-center shadow-sm">
                      <span className="text-xl leading-none mb-1">-</span>
                      <span className="text-[10px]">เบิกออก</span>
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
              <div>
                <h3 className="font-black text-slate-800 text-xl flex items-center gap-2">⏱️ ประวัติความเคลื่อนไหว</h3>
                <p className="text-[10px] text-slate-500 mt-1 font-bold">บันทึก 20 รายการล่าสุด</p>
              </div>
              <button onClick={() => setIsHistoryModalOpen(false)} className="w-10 h-10 rounded-full bg-white text-slate-400 font-bold hover:text-rose-500 hover:bg-rose-50 border border-slate-200 shadow-sm flex items-center justify-center transition-colors">✕</button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
              {logs.length === 0 ? <p className="text-center text-slate-400 font-bold py-10">ยังไม่มีประวัติในวันนี้</p> : 
               logs.map(log => (
                <div key={log.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-2">
                    <span className={`px-3 py-1 rounded-lg text-xs font-black ${log.type === 'IN' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                      {log.type === 'IN' ? 'รับเข้า' : 'เบิกออก'}
                    </span>
                    <span className={`font-black text-xl ${log.type === 'IN' ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {log.type === 'IN' ? '+' : '-'}{log.qty}
                    </span>
                  </div>
                  <p className="font-black text-slate-800 text-base mb-1">{log.product_name}</p>
                  <p className="text-[11px] text-blue-600 font-bold mb-2 bg-blue-50 inline-block px-2 py-0.5 rounded">{log.note}</p>
                  <div className="flex justify-between items-center mt-2 pt-3 border-t border-slate-100 text-[10px] text-slate-400 font-bold">
                    <span className="flex items-center gap-1">👤 บันทึกโดย: {log.by}</span>
                    <span>{log.date ? new Date(log.date).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }) : '-'} น.</span>
                  </div>
                </div>
               ))
              }
            </div>
          </div>
        </div>
      )}

      {/* 🚀 Modal: Numpad รับเข้า / เบิกออก */}
      {numpad.isOpen && numpad.product && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm print:hidden">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            
            <div className={`p-5 border-b flex justify-between items-center ${numpad.type === 'IN' ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
              <h3 className={`font-black text-lg flex items-center gap-2 ${numpad.type === 'IN' ? 'text-emerald-700' : 'text-rose-700'}`}>
                {numpad.type === 'IN' ? '📥 รับเข้าสต๊อก (ผลิต)' : '📤 เบิกออกสต๊อก'}
              </h3>
              <button onClick={() => setNumpad(prev => ({...prev, isOpen: false}))} className="w-8 h-8 rounded-full bg-white text-slate-400 font-bold hover:text-rose-500 shadow-sm border border-slate-200">✕</button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="text-center space-y-1">
                <p className="text-xs font-bold text-slate-500">สินค้าที่ทำรายการ</p>
                <p className="font-black text-xl text-slate-800 line-clamp-1">{numpad.product.name}</p>
              </div>

              {numpad.type === 'IN' && (
                <div className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-100 flex items-center justify-between">
                  <label className="text-xs font-bold text-emerald-800 flex items-center gap-1">⏱️ เวลาที่ผลิตเสร็จ:</label>
                  <input 
                    type="time" 
                    value={numpad.time} 
                    onChange={(e) => setNumpad(prev => ({ ...prev, time: e.target.value }))}
                    className="bg-white border border-emerald-200 px-3 py-1.5 rounded-lg font-black text-emerald-700 focus:outline-none focus:border-emerald-500 text-sm"
                  />
                </div>
              )}

              <div className={`p-4 rounded-2xl border-2 flex justify-between items-center bg-slate-50 ${numpad.type === 'IN' ? 'border-emerald-200' : 'border-rose-200'}`}>
                <span className="text-sm font-bold text-slate-400">จำนวน:</span>
                <span className={`text-4xl font-black tracking-tight ${numpad.type === 'IN' ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {Number(numpad.value).toLocaleString()}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                  <button key={num} onClick={() => handleNumPress(num.toString())} className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-black text-2xl py-4 rounded-xl shadow-sm active:scale-95 transition-all">
                    {num}
                  </button>
                ))}
                <button onClick={() => setNumpad(prev => ({...prev, value: '0'}))} className="bg-rose-50 hover:bg-rose-100 text-rose-500 font-black text-lg py-4 rounded-xl shadow-sm active:scale-95 transition-all">
                  ล้าง
                </button>
                <button onClick={() => handleNumPress('0')} className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-black text-2xl py-4 rounded-xl shadow-sm active:scale-95 transition-all">
                  0
                </button>
                <button onClick={handleBackspace} className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-black text-xl py-4 rounded-xl shadow-sm active:scale-95 transition-all">
                  ⌫
                </button>
              </div>

              <button 
                onClick={submitStockChange} 
                className={`w-full text-white font-black py-4 rounded-xl shadow-lg mt-2 text-lg active:scale-95 transition-transform ${numpad.type === 'IN' ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/30' : 'bg-rose-500 hover:bg-rose-600 shadow-rose-500/30'}`}
              >
                {numpad.type === 'IN' ? '💾 ยืนยันรับเข้าสต๊อก' : '💾 ยืนยันเบิกออกสต๊อก'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}