'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function TruckLoadingPage() {
  const getTodayString = () => {
    const today = new Date()
    return new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0]
  }

  const [activeTab, setActiveTab] = useState<'form' | 'history'>('form')
  const [products, setProducts] = useState<any[]>([])
  const [cart, setCart] = useState<any[]>([])
  const pathname = usePathname()

  const [selectedRoute, setSelectedRoute] = useState('')
  const [selectedShift, setSelectedShift] = useState('')
  const [note, setNote] = useState('')
  const [employeeName, setEmployeeName] = useState('กำลังโหลดชื่อ...')

  // 🌟 State เก็บข้อมูลรถจาก Database
  const [truckRoutes, setTruckRoutes] = useState<any[]>([])

  // History State
  const [historyDate, setHistoryDate] = useState(getTodayString())
  const [historyRecords, setHistoryRecords] = useState<any[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)

  useEffect(() => {
    const session = localStorage.getItem('kingsawang_session')
    if (session) setEmployeeName(JSON.parse(session).name)
    fetchProducts()
    fetchTruckRoutes() // 🌟 โหลดข้อมูลรถทันทีที่เปิดหน้า
  }, [])

  useEffect(() => {
    if (activeTab === 'history') fetchHistory()
  }, [activeTab, historyDate])

  const fetchProducts = async () => {
    const { data } = await supabase.from('products').select('*').eq('category', 'main').eq('isActive', true).order('id')
    if (data) setProducts(data)
  }

  // 🌟 ฟังก์ชันดึงสายรถจากระบบจัดการ
  const fetchTruckRoutes = async () => {
    const { data } = await supabase.from('truck_routes').select('*').eq('isActive', true).order('id')
    if (data) setTruckRoutes(data)
  }

  const fetchHistory = async () => {
    setIsLoadingHistory(true)
    const { data } = await supabase
      .from('route_settlements')
      .select('*')
      .eq('date', historyDate)
      .order('createdAt', { ascending: false })
    
    if (data) {
      const validRecords = data.filter(r => r.details && (r.details.items || r.details.loadedItems))
      setHistoryRecords(validRecords)
    }
    setIsLoadingHistory(false)
  }

  const addToCart = (product: any) => { setCart(prev => { const e = prev.find(i => i.id === product.id); return e ? prev.map(i => i.id === product.id ? { ...i, qty: i.qty + 1 } : i) : [...prev, { ...product, qty: 1 }] }) }
  const updateQty = (id: string, delta: number) => { setCart(prev => prev.map(i => i.id === id ? { ...i, qty: Math.max(0, i.qty + delta) } : i).filter(i => i.qty > 0)) }
  const removeFromCart = (id: string) => setCart(prev => prev.filter(i => i.id !== id))

  const totalItems = cart.reduce((sum, item) => sum + item.qty, 0)
  const expectedTotalAmount = cart.reduce((sum, item) => sum + (item.price * item.qty), 0)

  // แจ้งเตือนถ้ารถคันนี้เบิกไปแล้ว
  const handleRouteSelection = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = e.target.value
    if (!selected) {
      setSelectedRoute('')
      return
    }

    const todayStr = getTodayString()
    const { data } = await supabase.from('route_settlements').select('details').eq('date', todayStr).eq('routeName', selected)

    if (data && data.length > 0) {
      let alertMsg = `⚠️ แจ้งเตือน: สายส่ง "${selected}" มีการเบิกของไปแล้วในวันนี้!\n\n`
      data.forEach(load => {
        const shift = load.details?.shift || 'ไม่ระบุรอบ'
        const items = load.details?.items || load.details?.loadedItems || []
        const itemText = items.map((i: any) => `- ${i.name} : ${i.loadedQty || i.qty} หน่วย`).join('\n')
        alertMsg += `[รายการเบิก ${shift}]\n${itemText}\n\n`
      })
      alertMsg += `คุณแน่ใจหรือไม่ ว่าต้องการเบิกสินค้า "เพิ่ม/ซ้ำ" ให้รถคันนี้อีกครั้ง?`

      if (!window.confirm(alertMsg)) {
        setSelectedRoute('')
        return
      }
    }
    setSelectedRoute(selected)
  }

  const handleSaveDraft = async () => {
    if (!selectedRoute || !selectedShift) return alert('กรุณาเลือกสายส่งและรอบวิ่งก่อน')
    if (cart.length === 0) return alert('ยังไม่ได้เลือกสินค้าที่จะจ่ายขึ้นรถ')

    for (const item of cart) {
      const currentProd = products.find(p => p.id === item.id)
      if (Number(currentProd?.stock || 0) < item.qty) {
        return alert(`❌ สต๊อกไม่พอ! สินค้า "${item.name}" มีในคลังแค่ ${currentProd?.stock || 0} หน่วย แต่พยายามเบิก ${item.qty} หน่วย`)
      }
    }

    const settlementId = `R-SET-${Date.now().toString().slice(-6)}`
    
    const loadedItemsForSettlement = cart.map(item => ({
      productId: item.id, name: item.name, price: item.price,
      loadedQty: item.qty, returnedQty: 0, damagedQty: 0, soldQty: 0,          
      expectedTotal: item.qty * item.price 
    }))

    // ดึงชื่อคนขับออกมาจากวงเล็บ (เพื่อบันทึกลงบิล)
    let driverName = 'ไม่ระบุ'
    if (selectedRoute.includes('(คนขับ:')) {
      driverName = selectedRoute.split('(คนขับ: ')[1]?.replace(')', '') || 'ไม่ระบุ'
    }

    const { error } = await supabase.from('route_settlements').insert([{
      id: settlementId,
      date: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      routeName: selectedRoute,
      driverName: driverName,
      expectedAmount: expectedTotalAmount, 
      status: 'pending', 
      cashAmount: 0, transferAmount: 0, creditAmount: 0, expenseAmount: 0, returnAmount: 0, diffAmount: 0,
      details: { 
        shift: selectedShift,
        items: loadedItemsForSettlement,
        bagTracking: { loadedBags: totalItems, returnedBags: 0, lostBags: 0 }
      },
      note: note,
      by: employeeName
    }])

    if (error) return alert('เกิดข้อผิดพลาดในการสร้างบิล: ' + error.message)

    const stockPromises = cart.map(item => {
      const currentProd = products.find(p => p.id === item.id)
      const newStock = Number(currentProd?.stock || 0) - item.qty
      return supabase.from('products').update({ stock: newStock }).eq('id', item.id)
    })

    const logPromises = cart.map(item => {
      return supabase.from('inventory_logs').insert([{
        id: `LOG-${Date.now()}-${item.id.slice(-4)}`,
        productId: item.id, productName: item.name, type: 'OUT', qty: item.qty,
        note: `จ่ายขึ้นรถ ${selectedRoute} (รอบ ${selectedShift})`, by: employeeName
      }])
    })

    await Promise.all([...stockPromises, ...logPromises])

    alert('✅ จ่ายของขึ้นรถและตัดสต๊อกสำเร็จ!')
    setCart([]); setSelectedRoute(''); setSelectedShift(''); setNote(''); fetchProducts()
  }

  const handleCancelLoad = async (record: any) => {
    if (!confirm(`⚠️ คำเตือน: ต้องการยกเลิกบิลจ่ายรถเลขที่ ${record.id} ใช่หรือไม่?\n(สต๊อกจะถูกดึงกลับเข้าคลังอัตโนมัติ)`)) return

    await supabase.from('route_settlements').delete().eq('id', record.id)

    const items = record.details?.items || record.details?.loadedItems || []
    const stockPromises = items.map(async (item: any) => {
       const productId = item.productId || item.id
       const { data: currentProd } = await supabase.from('products').select('stock').eq('id', productId).single()
       if (currentProd) {
         const newStock = Number(currentProd.stock) + Number(item.loadedQty || item.qty)
         return supabase.from('products').update({ stock: newStock }).eq('id', productId)
       }
    })
    
    const logPromises = items.map((item: any) => {
      return supabase.from('inventory_logs').insert([{
        id: `LOG-RET-${Date.now()}-${(item.productId || item.id).slice(-4)}`,
        productId: item.productId || item.id, productName: item.name, type: 'IN', qty: item.loadedQty || item.qty,
        note: `ยกเลิกบิลจ่ายรถ ${record.id} (คืนสต๊อก)`, by: employeeName
      }])
    })

    await Promise.all([...stockPromises, ...logPromises])
    alert('✅ ยกเลิกบิลและคืนสต๊อกกลับเข้าคลังเรียบร้อยแล้ว')
    fetchHistory(); fetchProducts()
  }

  const TabletNav = () => (
    <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide">
      <Link href="/" className="bg-white p-3 md:p-3.5 rounded-xl shadow-sm hover:bg-slate-50 text-slate-600 font-bold border border-slate-200 transition-all active:scale-95 flex items-center justify-center shrink-0">🏠</Link>
      <div className="flex bg-white rounded-xl p-1.5 border border-slate-200 shadow-sm shrink-0">
        <Link href="/inventory/truck-loading" className={`px-4 py-2.5 rounded-lg text-xs md:text-sm font-bold transition-all flex items-center gap-2 ${pathname === '/inventory/truck-loading' ? 'bg-orange-50 text-orange-700' : 'text-slate-500 hover:bg-slate-50'}`}>🚚 จ่ายของขึ้นรถ</Link>
        <Link href="/sales/pos" className={`px-4 py-2.5 rounded-lg text-xs md:text-sm font-bold transition-all flex items-center gap-2 ${pathname === '/sales/pos' ? 'bg-emerald-50 text-emerald-700' : 'text-slate-500 hover:bg-slate-50'}`}>🛒 POS</Link>
        <Link href="/inventory" className={`px-4 py-2.5 rounded-lg text-xs md:text-sm font-bold transition-all flex items-center gap-2 ${pathname === '/inventory' ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-50'}`}>📦 เช็คคลังสินค้า</Link>
      </div>
      <div className="bg-white px-4 py-3 md:py-3 rounded-xl border border-slate-200 font-bold text-slate-600 shadow-sm text-xs shrink-0 flex items-center gap-2">
        <span className="w-5 h-5 bg-slate-100 rounded-full flex items-center justify-center text-sm">👤</span>{employeeName}
      </div>
    </div>
  )

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-slate-100 overflow-hidden text-xs md:text-sm font-sans">
      
      {/* --- TOP BAR --- */}
      <div className="bg-white p-4 border-b border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0 z-10">
        <TabletNav />
        <div className="flex bg-slate-100 p-1.5 rounded-xl w-full md:w-auto">
          <button onClick={() => setActiveTab('form')} className={`flex-1 md:flex-none px-6 py-2.5 rounded-lg font-bold text-sm transition-all shadow-sm ${activeTab === 'form' ? 'bg-white text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>🚚 เบิกสินค้าขึ้นรถ</button>
          <button onClick={() => setActiveTab('history')} className={`flex-1 md:flex-none px-6 py-2.5 rounded-lg font-bold text-sm transition-all shadow-sm ${activeTab === 'history' ? 'bg-white text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>🗂️ ประวัติการเบิกวันนี้</button>
        </div>
      </div>

      {/* --- CONTENT AREA --- */}
      {activeTab === 'form' ? (
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
          
          {/* ซ้าย: เลือกสินค้า */}
          <div className="flex-1 flex flex-col p-4 md:p-6 overflow-hidden relative h-full">
            <h2 className="font-black text-slate-800 text-base md:text-lg mb-4 shrink-0 flex items-center gap-2">🧊 เลือกสินค้าเพื่อจ่ายขึ้นรถ</h2>
            
            <div className="flex-1 overflow-y-auto pr-2 pb-24 md:pb-0 scrollbar-hide">
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {products.map(product => (
                  <button key={product.id} onClick={() => addToCart(product)} className="flex flex-col items-center p-5 rounded-[2rem] border-2 bg-white border-slate-200 transition-all active:scale-95 shadow-sm hover:shadow-md hover:bg-slate-50 relative group">
                    {product.image ? (
                      <div className="w-16 h-16 md:w-20 md:h-20 mb-3 rounded-2xl overflow-hidden shadow-sm group-hover:scale-105 transition-transform bg-white border border-slate-100"><img src={product.image} className="w-full h-full object-cover" /></div>
                    ) : (<span className="text-5xl md:text-6xl mb-3 group-hover:scale-110 transition-transform">{product.icon}</span>)}
                    <span className="font-bold text-sm text-center leading-tight mb-2">{product.name}</span>
                    <span className={`font-black px-3 py-1 rounded-lg ${Number(product.stock) < 10 ? 'text-rose-600 bg-rose-50' : 'text-blue-600 bg-blue-50'}`}>คงเหลือ: {product.stock || 0}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ขวา: ฟอร์มจ่ายขึ้นรถ */}
          <div className="w-full md:w-[400px] lg:w-[450px] bg-white shadow-2xl flex flex-col h-[80vh] md:h-full fixed md:relative bottom-0 z-20 rounded-t-[2rem] md:rounded-none shrink-0 transition-transform duration-300 border-l border-slate-200">
            <div className="p-6 border-b border-slate-100 bg-slate-50 shrink-0"><h2 className="font-black text-slate-900 text-lg flex items-center gap-2">📋 รายการจ่ายขึ้นรถ</h2></div>

            <div className="p-6 space-y-5 border-b border-slate-100 shrink-0">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-600">เลือกรถสายส่ง / เส้นทาง <span className="text-rose-500">*</span></label>
                <select value={selectedRoute} onChange={handleRouteSelection} className="w-full border-2 border-blue-200 px-4 py-3.5 rounded-xl font-bold focus:border-blue-500 bg-blue-50 text-blue-800 outline-none">
                  <option value="" disabled>-- เลือกสายส่ง --</option>
                  {/* 🌟 แสดงรถที่ดึงมาจากระบบจัดการ */}
                  {truckRoutes.map(r => {
                    const routeNameFull = `${r.route_name} (คนขับ: ${r.driver_name})`
                    return (
                      <option key={r.id} value={routeNameFull}>
                        {r.route_name} [ทะเบียน: {r.license_plate}] - {r.driver_name}
                      </option>
                    )
                  })}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-600">รอบจ่ายสินค้า <span className="text-rose-500">*</span></label>
                <div className="grid grid-cols-4 gap-2">
                  {['รอบเช้า', 'รอบบ่าย', 'รอบเย็น', 'รอบพิเศษ'].map(shift => (
                    <button key={shift} onClick={() => setSelectedShift(shift)} className={`py-2.5 rounded-xl font-bold text-[11px] border-2 transition-all ${selectedShift === shift ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>{shift}</button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-3 bg-slate-50/50">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-3 opacity-50"><span className="text-5xl">👆</span><p className="font-bold text-sm">จิ้มเลือกสินค้าฝั่งซ้าย</p></div>
              ) : (
                cart.map(item => (
                  <div key={item.id} className="flex justify-between items-center border border-slate-200 p-3 rounded-2xl bg-white shadow-sm">
                    <div className="flex-1 pr-2"><h3 className="font-bold text-slate-800 text-sm truncate">{item.name}</h3></div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center bg-slate-100 rounded-xl p-1 border border-slate-200">
                        <button onClick={() => updateQty(item.id, -1)} className="w-8 h-8 bg-white hover:bg-slate-50 rounded-lg font-black shadow-sm">-</button>
                        <span className="w-8 text-center font-black text-base text-blue-600">{item.qty}</span>
                        <button onClick={() => updateQty(item.id, 1)} className="w-8 h-8 bg-white hover:bg-slate-50 rounded-lg font-black shadow-sm">+</button>
                      </div>
                      <button onClick={() => removeFromCart(item.id)} className="text-slate-300 hover:text-rose-500 font-black text-lg px-2">✕</button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-6 bg-white border-t border-slate-100 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] space-y-4 shrink-0">
              <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="หมายเหตุ (เช่น เบิกเพิ่มพิเศษ, งานแต่ง ฯลฯ)" className="w-full border-2 border-slate-200 px-4 py-3 rounded-xl font-bold focus:border-blue-500 outline-none text-xs" />
              <div className="flex justify-between items-end mb-2">
                <span className="font-bold text-slate-500 text-sm">ยอดรวมจ่ายของ</span>
                <span className="font-black text-5xl text-blue-600 tracking-tight">{totalItems}<span className="text-base text-slate-500 ml-2 font-bold">หน่วย</span></span>
              </div>
              <button onClick={handleSaveDraft} disabled={cart.length === 0 || !selectedRoute || !selectedShift} className="w-full font-black text-lg py-5 rounded-[1.25rem] bg-slate-800 hover:bg-black disabled:bg-slate-200 disabled:text-slate-400 text-white shadow-xl transition-all active:scale-95 flex justify-center items-center gap-2">
                💾 บันทึกยืนยันจ่ายของขึ้นรถ
              </button>
            </div>
          </div>

        </div>
      ) : (
        /* === HISTORY TAB === */
        <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-50/50">
          <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-100 shadow-sm max-w-6xl mx-auto animate-in fade-in duration-300">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 border-b border-slate-100 pb-4 gap-4">
              <h2 className="text-lg font-black text-slate-800">🗂️ ประวัติการเบิกสินค้าขึ้นรถสายส่ง</h2>
              <div className="flex items-center gap-3 w-full md:w-auto">
                <span className="font-bold text-slate-500">เลือกวันที่:</span>
                <input type="date" value={historyDate} onChange={e => setHistoryDate(e.target.value)} className="flex-1 px-4 py-2 rounded-xl border border-slate-300 focus:border-blue-500 outline-none font-bold bg-slate-50" />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 text-[11px] whitespace-nowrap">
                  <tr>
                    <th className="p-4 font-bold">เวลา / เลขที่บิล</th><th className="p-4 font-bold">สายส่งรถ</th><th className="p-4 font-bold text-center">สถานะ</th><th className="p-4 font-bold">รายการเบิก (ชิ้น/ใบ)</th><th className="p-4 font-bold text-center">พนักงานจ่ายของ</th><th className="p-4 font-bold text-center w-24">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="text-sm divide-y divide-slate-50">
                  {isLoadingHistory ? (<tr><td colSpan={6} className="p-10 text-center text-slate-400 font-bold">⏳ กำลังค้นหาข้อมูล...</td></tr>) : historyRecords.length === 0 ? (<tr><td colSpan={6} className="p-10 text-center text-slate-400 font-bold">ยังไม่มีประวัติการจ่ายของในวันที่ {historyDate}</td></tr>) : (
                    historyRecords.map(record => {
                      const items = record.details?.items || record.details?.loadedItems || []
                      return (
                        <tr key={record.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-4"><p className="font-bold text-slate-800">{new Date(record.createdAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.</p><p className="text-[10px] text-slate-400 mt-1">{record.id}</p></td>
                          <td className="p-4"><p className="font-black text-blue-700">{record.routeName}</p><p className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded font-bold w-fit mt-1">รอบ {record.details?.shift || '-'}</p></td>
                          <td className="p-4 text-center">{record.status === 'pending' ? (<span className="bg-amber-100 text-amber-700 border border-amber-200 px-3 py-1 rounded-full font-bold text-[10px]">⏳ รอรถกลับมาเคลียร์</span>) : (<span className="bg-emerald-100 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-full font-bold text-[10px]">✅ เคลียร์ยอดแล้ว</span>)}</td>
                          <td className="p-4"><ul className="text-[11px] font-bold text-slate-600 space-y-0.5">{items.map((i: any, idx: number) => (<li key={idx}>• {i.name} <span className="text-blue-600">x{i.loadedQty || i.qty}</span></li>))}</ul>{record.note && <p className="text-[10px] text-rose-500 mt-1">📝 หมายเหตุ: {record.note}</p>}</td>
                          <td className="p-4 text-center font-bold text-slate-600">{record.by}</td>
                          <td className="p-4 text-center">{record.status === 'pending' ? (<button onClick={() => handleCancelLoad(record)} className="px-3 py-1.5 bg-rose-50 text-rose-600 hover:bg-rose-500 hover:text-white font-bold text-[10px] rounded-lg transition-colors border border-rose-200 shadow-sm">✕ ยกเลิกบิล</button>) : (<span className="text-[10px] text-slate-300 font-bold">- ล็อก -</span>)}</td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}