'use client'

import { useState, useEffect, useCallback, type ChangeEvent } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type TabletNavProps = {
  pathname: string
  employeeName: string
}

type TruckProduct = {
  id: string
  name: string
  price: number
  stock?: number
  image?: string
  icon?: string
}

type TruckRoute = {
  id: string
  route_name: string
  driver_name: string
  license_plate?: string
  isActive?: boolean
}

type TruckSettlementItem = {
  productId?: string
  id?: string
  name: string
  price?: number
  qty?: number
  loadedQty?: number
  returnedQty?: number
  damagedQty?: number
  soldQty?: number
  expectedTotal?: number
}

type TruckSettlementDetails = {
  shift?: string
  items?: TruckSettlementItem[]
  loadedItems?: TruckSettlementItem[]
  bagTracking?: {
    loadedBags?: number
    returnedBags?: number
    lostBags?: number
    returnedEmptyBags?: number
    pendingBags?: number
  }
}

type TruckSettlementRecord = {
  id: string
  date?: string
  createdAt?: string
  routeName?: string
  driverName?: string
  expectedAmount?: number
  status?: 'pending' | 'completed' | string
  note?: string
  details?: TruckSettlementDetails
  by?: string
  cashAmount?: number
  transferAmount?: number
  creditAmount?: number
  expenseAmount?: number
  returnAmount?: number
  diffAmount?: number
}

type TruckCartItem = {
  id: string
  name: string
  price: number
  qty: number
}

type TruckPendingGroup = {
  routeName: string
  driverName?: string
  records: TruckSettlementRecord[]
}

type TruckReturnItem = {
  productId: string
  name: string
  price: number
  loadedQty: number
  returnedQty: number
  damagedQty: number
}

function TabletNav({ pathname, employeeName }: TabletNavProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 pb-2 md:pb-0 shrink-0 w-full lg:w-auto">
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
}

export default function TruckLoadingPage() {
  const getTodayString = () => {
    const today = new Date()
    return new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0]
  }

  const [activeTab, setActiveTab] = useState<'form' | 'return' | 'history'>('form')
  const [products, setProducts] = useState<TruckProduct[]>([])
  const [cart, setCart] = useState<TruckCartItem[]>([])
  const pathname = usePathname()

  const [selectedRoute, setSelectedRoute] = useState('')
  const [selectedShift, setSelectedShift] = useState('')
  const [note, setNote] = useState('')
  
  const [employeeName, setEmployeeName] = useState('กำลังโหลดชื่อ...')

  const [truckRoutes, setTruckRoutes] = useState<TruckRoute[]>([])

  const [historyDate, setHistoryDate] = useState(getTodayString())
  const [historyRecords, setHistoryRecords] = useState<TruckSettlementRecord[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)

  const [pendingGroups, setPendingGroups] = useState<TruckPendingGroup[]>([])
  const [selectedRouteKey, setSelectedRouteKey] = useState('')
  const [returnItems, setReturnItems] = useState<TruckReturnItem[]>([])
  const [bagForm, setBagForm] = useState({ returnedEmptyBags: '', pendingBags: '', note: '' })
  const [isLoadingPending, setIsLoadingPending] = useState(false)

  async function fetchProducts() {
    const { data } = await supabase.from('products').select('*').eq('category', 'main').eq('isActive', true).order('id')
    if (data) setProducts(data)
  }

  async function fetchTruckRoutes() {
    const { data } = await supabase.from('truck_routes').select('*').eq('isActive', true).order('id')
    if (data) setTruckRoutes(data)
  }

  const fetchHistory = useCallback(async () => {
    setIsLoadingHistory(true)
    const { data } = await supabase.from('route_settlements').select('*').eq('date', historyDate).order('createdAt', { ascending: false })
    if (data) {
      const validRecords = data.filter(r => r.details && (r.details.items || r.details.loadedItems))
      setHistoryRecords(validRecords as TruckSettlementRecord[])
    }
    setIsLoadingHistory(false)
  }, [historyDate])

  const fetchPendingRoutesGrouped = useCallback(async () => {
    setIsLoadingPending(true)
    const { data } = await supabase.from('route_settlements').select('*').eq('status', 'pending').order('createdAt', { ascending: true })
    
    if (data) {
      const groupsMap: Record<string, TruckPendingGroup> = {}
      data.forEach((record: TruckSettlementRecord) => {
        const key = record.routeName ?? 'ไม่ระบุ'
        if (!groupsMap[key]) {
          groupsMap[key] = {
            routeName: key,
            driverName: record.driverName,
            records: []
          }
        }
        groupsMap[key].records.push(record)
      })
      setPendingGroups(Object.values(groupsMap))
    }
    setIsLoadingPending(false)
  }, [])

  useEffect(() => {
    const session = localStorage.getItem('kingsawang_session')
    if (session) {
      setEmployeeName(JSON.parse(session).name)
    }

    const loadInitial = async () => {
      await fetchProducts()
      await fetchTruckRoutes()
    }
    void loadInitial()
  }, [])

  useEffect(() => {
    const loadTabData = async () => {
      if (activeTab === 'history') await fetchHistory()
      if (activeTab === 'return') await fetchPendingRoutesGrouped()
    }
    void loadTabData()
  }, [activeTab, historyDate, fetchHistory, fetchPendingRoutesGrouped])

  const handleProductClick = (product: TruckProduct) => {
    const qtyInput = window.prompt(`ระบุจำนวน "${product.name}" ที่ต้องการเบิกขึ้นรถ:`, '1')
    if (qtyInput === null) return 
    const qty = parseInt(qtyInput, 10)
    if (isNaN(qty) || qty <= 0) return alert('❌ กรุณาระบุจำนวนเป็นตัวเลขให้ถูกต้อง')

    setCart(prev => {
      const existing = prev.find(i => i.id === product.id)
      if (existing) return prev.map(i => i.id === product.id ? { ...i, qty: existing.qty + qty } : i)
      return [...prev, { id: product.id, name: product.name, price: product.price, qty }]
    })
  }

  const updateQty = (id: string, delta: number) => setCart(prev => prev.map(i => i.id === id ? { ...i, qty: Math.max(0, i.qty + delta) } : i).filter(i => i.qty > 0))
  
  const editCartQty = (id: string, currentQty: number) => {
    const qtyInput = window.prompt('ระบุจำนวนใหม่ที่ต้องการ:', currentQty.toString())
    if (qtyInput === null) return
    const qty = parseInt(qtyInput, 10)
    if (isNaN(qty) || qty < 0) return alert('❌ กรุณาระบุจำนวนเป็นตัวเลขให้ถูกต้อง')
    if (qty === 0) removeFromCart(id)
    else setCart(prev => prev.map(i => i.id === id ? { ...i, qty } : i))
  }

  const removeFromCart = (id: string) => setCart(prev => prev.filter(i => i.id !== id))

  const totalItems = cart.reduce((sum, item) => sum + item.qty, 0)
  const expectedTotalAmount = cart.reduce((sum, item) => sum + (item.price * item.qty), 0)

  const handleRouteSelection = async (e: ChangeEvent<HTMLSelectElement>) => {
    const selected = e.target.value
    if (!selected) { setSelectedRoute(''); return }

    const todayStr = getTodayString()
    const { data } = await supabase.from('route_settlements').select('details').eq('date', todayStr).eq('routeName', selected)

    if (data && data.length > 0) {
      let alertMsg = `⚠️ แจ้งเตือน: สายส่ง "${selected}" มีการเบิกของไปแล้วในวันนี้!\n\n`
      
      data.forEach((load: any) => {
        const shift = load.details?.shift || 'ไม่ระบุรอบ'
        const items = (load.details?.items || load.details?.loadedItems || []) as TruckSettlementItem[]
        const itemText = items.map((i: TruckSettlementItem) => `- ${i.name} : ${i.loadedQty || i.qty} หน่วย`).join('\n')
        alertMsg += `[รายการเบิก ${shift}]\n${itemText}\n\n`
      })
      
      alertMsg += `คุณแน่ใจหรือไม่ ว่าต้องการเบิกสินค้า "เพิ่ม/ซ้ำ" ให้รถคันนี้อีกครั้ง?`
      if (!window.confirm(alertMsg)) { setSelectedRoute(''); return }
    }
    setSelectedRoute(selected)
  }

  const handleSaveDraft = async () => {
    if (!selectedRoute || !selectedShift) return alert('กรุณาเลือกสายส่งและรอบวิ่งก่อน')
    if (cart.length === 0) return alert('ยังไม่ได้เลือกสินค้าที่จะจ่ายขึ้นรถ')

    for (const item of cart) {
      const currentProd = products.find(p => p.id === item.id)
      if (Number(currentProd?.stock || 0) < item.qty) return alert(`❌ สต๊อกไม่พอ! สินค้า "${item.name}" มีในคลังแค่ ${currentProd?.stock || 0} หน่วย`)
    }

    const settlementId = `R-SET-${Date.now().toString().slice(-6)}`
    const loadedItemsForSettlement = cart.map(item => ({
      productId: item.id, name: item.name, price: item.price,
      loadedQty: item.qty, returnedQty: 0, damagedQty: 0, soldQty: 0,          
      expectedTotal: item.qty * item.price 
    }))

    let driverName = 'ไม่ระบุ'
    if (selectedRoute.includes('(คนขับ:')) driverName = selectedRoute.split('(คนขับ: ')[1]?.replace(')', '') || 'ไม่ระบุ'

    const { error } = await supabase.from('route_settlements').insert([{
      id: settlementId, date: new Date().toISOString().split('T')[0], createdAt: new Date().toISOString(),
      routeName: selectedRoute, driverName: driverName, expectedAmount: expectedTotalAmount, status: 'pending', 
      cashAmount: 0, transferAmount: 0, creditAmount: 0, expenseAmount: 0, returnAmount: 0, diffAmount: 0,
      details: { shift: selectedShift, items: loadedItemsForSettlement, bagTracking: { loadedBags: totalItems, returnedBags: 0, lostBags: 0 } },
      note: note, by: employeeName
    }])

    if (error) return alert('เกิดข้อผิดพลาดในการสร้างบิล: ' + error.message)

    const stockPromises = cart.map(item => {
      const currentProd = products.find(p => p.id === item.id)
      return supabase.from('products').update({ stock: Number(currentProd?.stock || 0) - item.qty }).eq('id', item.id)
    })

    const logPromises = cart.map(item => supabase.from('inventory_logs').insert([{
      id: `LOG-${Date.now()}-${item.id.slice(-4)}`, 
      date: new Date().toISOString(),
      product_id: item.id, 
      product_name: item.name, 
      type: 'OUT', 
      qty: item.qty,
      note: `จ่ายขึ้นรถ ${selectedRoute} (รอบ ${selectedShift})`, 
      by: employeeName
    }]))

    await Promise.all([...stockPromises, ...logPromises])
    alert('✅ จ่ายของขึ้นรถและตัดสต๊อกสำเร็จ!')
    setCart([]); setSelectedRoute(''); setSelectedShift(''); setNote(''); fetchProducts()
  }

  const handleCancelLoad = async (record: TruckSettlementRecord) => {
    if (!confirm(`⚠️ คำเตือน: ต้องการยกเลิกบิลจ่ายรถเลขที่ ${record.id} ใช่หรือไม่?\n(สต๊อกจะถูกดึงกลับเข้าคลังอัตโนมัติ)`)) return
    await supabase.from('route_settlements').delete().eq('id', record.id)

    const items = record.details?.items || record.details?.loadedItems || []
    const stockPromises = items.map(async (item: TruckSettlementItem) => {
       const productId = item.productId || item.id
       const { data: currentProd } = await supabase.from('products').select('stock').eq('id', productId).single()
       if (currentProd) return supabase.from('products').update({ stock: Number(currentProd.stock) + Number(item.loadedQty || item.qty) }).eq('id', productId)
    })
    
    const logPromises = items.map((item: TruckSettlementItem) => supabase.from('inventory_logs').insert([{
      id: `LOG-RET-${Date.now()}-${(item.productId || item.id || '').slice(-4)}`, 
      date: new Date().toISOString(),
      product_id: item.productId || item.id, 
      product_name: item.name, 
      type: 'IN', 
      qty: item.loadedQty || item.qty,
      note: `ยกเลิกบิลจ่ายรถ ${record.id} (คืนสต๊อก)`, 
      by: employeeName
    }]))

    await Promise.all([...stockPromises, ...logPromises])
    alert('✅ ยกเลิกบิลและคืนสต๊อกกลับเข้าคลังเรียบร้อยแล้ว')
    fetchHistory(); fetchProducts()
  }

  const handleSelectRouteGroup = (group: TruckPendingGroup) => {
    setSelectedRouteKey(group.routeName)
    const itemMap: Record<string, TruckReturnItem> = {}
    group.records.forEach((rec: TruckSettlementRecord) => {
      const items = rec.details?.items || rec.details?.loadedItems || []
      items.forEach((i: TruckSettlementItem) => {
        const pId = i.productId || i.id || ''
        if (!itemMap[pId]) itemMap[pId] = { productId: pId, name: i.name, price: i.price || 0, loadedQty: 0, returnedQty: 0, damagedQty: 0 }
        itemMap[pId].loadedQty += Number(i.loadedQty || i.qty || 0)
      })
    })
    setReturnItems(Object.values(itemMap))
    setBagForm({ returnedEmptyBags: '', pendingBags: '', note: '' })
  }

  const updateReturnQty = (productId: string, field: 'returnedQty' | 'damagedQty', val: string) => {
    const num = Math.max(0, parseInt(val) || 0)
    setReturnItems(prev => prev.map(item => {
      if (item.productId === productId) {
        const updated = { ...item, [field]: num }
        if (updated.returnedQty + updated.damagedQty > updated.loadedQty) { alert('❌ จำนวนของที่คืน + ของเสีย มากกว่าจำนวนรวมที่เบิกไป!'); return item }
        return updated
      }
      return item
    }))
  }

  const submitSettlement = async () => {
    const group = pendingGroups.find(g => g.routeName === selectedRouteKey)
    if (!group) return
    if (!confirm('ยืนยันบันทึกสินค้าเหลือกลับและคืนสต๊อก?\n(ข้อมูลจะถูกส่งต่อไปยังบัญชีเพื่อสรุปยอดเงิน)')) return

    const trackingReturns = returnItems.map(i => ({...i}))

    const updatePromises = group.records.map(async (record: TruckSettlementRecord) => {
      const newItems = (record.details?.items || record.details?.loadedItems || []).map((i: TruckSettlementItem) => {
        const pId = i.productId || i.id || '';
        const globalReturnItem = trackingReturns.find(ri => ri.productId === pId);
        
        const myReturn = globalReturnItem ? Math.min(globalReturnItem.returnedQty, i.loadedQty || i.qty || 0) : 0
        if (globalReturnItem) {
          globalReturnItem.returnedQty -= myReturn
        }
        const myDamage = globalReturnItem ? Math.min(globalReturnItem.damagedQty, (i.loadedQty || i.qty || 0) - myReturn) : 0
        if (globalReturnItem) {
          globalReturnItem.damagedQty -= myDamage
        }
        return { ...i, returnedQty: myReturn, damagedQty: myDamage };
      });

      const updatedDetails = {
        ...record.details,
        items: newItems,
        bagTracking: { ...record.details?.bagTracking, returnedEmptyBags: Number(bagForm.returnedEmptyBags || 0), pendingBags: Number(bagForm.pendingBags || 0) }
      };

      return supabase.from('route_settlements').update({
        status: 'completed',
        details: updatedDetails,
        note: (record.note || '') + (bagForm.note ? ` | คืนกระสอบ(เปล่า:${bagForm.returnedEmptyBags || 0}, ค้าง:${bagForm.pendingBags || 0}) ${bagForm.note}` : '')
      }).eq('id', record.id)
    })
    
    await Promise.all(updatePromises)

    const stockPromises: any[] = returnItems.filter(i => i.returnedQty > 0).map(async (item) => {
      const { data: currentProd } = await supabase.from('products').select('stock').eq('id', item.productId).single()
      if (currentProd) return supabase.from('products').update({ stock: Number(currentProd.stock) + Number(item.returnedQty) }).eq('id', item.productId)
    })

    const logPromises: any[] = returnItems.filter(i => i.returnedQty > 0 || i.damagedQty > 0).map(item => {
      const logs = []
      if (item.returnedQty > 0) logs.push(supabase.from('inventory_logs').insert([{ 
        id: `LOG-RET-${Date.now()}-${item.productId.slice(-4)}`, 
        date: new Date().toISOString(),
        product_id: item.productId, 
        product_name: item.name, 
        type: 'IN', 
        qty: item.returnedQty, 
        note: `รับคืนจากรถ ${group.routeName} (เคลียร์ยอดรวม)`, 
        by: employeeName 
      }]))
      if (item.damagedQty > 0) logs.push(supabase.from('inventory_logs').insert([{ 
        id: `LOG-DMG-${Date.now()}-${item.productId.slice(-4)}`, 
        date: new Date().toISOString(),
        product_id: item.productId, 
        product_name: item.name, 
        type: 'OUT', 
        qty: item.damagedQty, 
        note: `ของเสีย/ละลาย (รถ ${group.routeName})`, 
        by: employeeName 
      }]))
      return logs
    }).flat()

    const returnedEmptyBags = Number(bagForm.returnedEmptyBags || 0);
    const lostBags = Number(bagForm.pendingBags || 0);

    if (returnedEmptyBags > 0 || lostBags > 0) {
      const { data: sackProd } = await supabase.from('products')
        .select('id, stock, name')
        .ilike('name', '%กระสอบเปล่า%')
        .limit(1)
        .single();
      
      if (sackProd) {
        let sackStockUpdate = 0;

        if (returnedEmptyBags > 0) {
          sackStockUpdate += returnedEmptyBags;
          logPromises.push(
            supabase.from('inventory_logs').insert([{
              id: `LOG-SACK-IN-${Date.now()}`,
              date: new Date().toISOString(),
              product_id: sackProd.id,
              product_name: sackProd.name,
              type: 'IN',
              qty: returnedEmptyBags,
              note: `รับคืนกระสอบเปล่าจากสายส่ง ${group.routeName}`,
              by: employeeName
            }])
          );
        }

        if (lostBags > 0) {
          sackStockUpdate -= lostBags;
          logPromises.push(
            supabase.from('inventory_logs').insert([{
              id: `LOG-SACK-LOST-${Date.now()}`,
              date: new Date().toISOString(),
              product_id: sackProd.id,
              product_name: sackProd.name,
              type: 'OUT',
              qty: lostBags,
              note: `กระสอบสูญหาย (หักเงินสายส่ง ${group.routeName})`,
              by: employeeName
            }])
          );
        }

        if (sackStockUpdate !== 0) {
          stockPromises.push(
            supabase.from('products').update({ stock: Number(sackProd.stock || 0) + sackStockUpdate }).eq('id', sackProd.id)
          );
        }
      }
    }

    await Promise.all([...stockPromises, ...logPromises])
    alert('✅ บันทึกยอดสินค้าและรับกระสอบคืนเข้าคลังเรียบร้อยแล้ว!\n(ข้อมูลพร้อมให้ฝ่ายบัญชีสรุปยอดเงินแล้ว)')
    setSelectedRouteKey(''); fetchPendingRoutesGrouped(); fetchProducts()
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-slate-100 overflow-hidden text-xs md:text-sm font-sans">
      <div className="bg-white p-4 border-b border-slate-200 shadow-sm flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 shrink-0 z-10">
        <TabletNav pathname={pathname} employeeName={employeeName} />
        <div className="flex bg-slate-100 p-1.5 rounded-xl w-full xl:w-auto overflow-x-auto scrollbar-hide">
          <button onClick={() => setActiveTab('form')} className={`flex-none px-5 py-2.5 rounded-lg font-bold text-sm transition-all shadow-sm ${activeTab === 'form' ? 'bg-white text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>🚚 1. โหลดของขึ้นรถ</button>
          <button onClick={() => setActiveTab('return')} className={`flex-none px-5 py-2.5 rounded-lg font-bold text-sm transition-all shadow-sm ${activeTab === 'return' ? 'bg-white text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>📦 2. รับของคืน (เคลียร์ยอด)</button>
          <button onClick={() => setActiveTab('history')} className={`flex-none px-5 py-2.5 rounded-lg font-bold text-sm transition-all shadow-sm ${activeTab === 'history' ? 'bg-white text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>🗂️ 3. ประวัติวันนี้</button>
        </div>
      </div>

      {activeTab === 'form' ? (
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
          
          {/* ซ้าย: สินค้า */}
          <div className="flex-1 flex flex-col p-4 md:p-6 overflow-hidden relative h-full">
            <h2 className="font-black text-slate-800 text-base md:text-lg mb-4 shrink-0 flex items-center gap-2">🧊 เลือกสินค้าเพื่อจ่ายขึ้นรถ</h2>
            <div className="flex-1 overflow-y-auto pr-2 pb-24 md:pb-0 scrollbar-hide">
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {products.map(product => (
                  <button key={product.id} onClick={() => handleProductClick(product)} className="flex flex-col items-center p-5 rounded-[2rem] border-2 bg-white border-slate-200 transition-all active:scale-95 shadow-sm hover:shadow-md hover:bg-slate-50 relative group">
                    {product.image ? (
                      <div className="w-16 h-16 md:w-20 md:h-20 mb-3 rounded-2xl overflow-hidden shadow-sm group-hover:scale-105 transition-transform bg-white border border-slate-100">
                        <Image src={product.image} alt={product.name} width={80} height={80} unoptimized className="w-full h-full object-cover" />
                      </div>
                    ) : (<span className="text-5xl md:text-6xl mb-3 group-hover:scale-110 transition-transform">{product.icon}</span>)}
                    <span className="font-bold text-sm text-center leading-tight mb-2">{product.name}</span>
                    <span className={`font-black px-3 py-1 rounded-lg ${Number(product.stock) < 10 ? 'text-rose-600 bg-rose-50' : 'text-blue-600 bg-blue-50'}`}>คงเหลือ: {product.stock || 0}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ขวา: 🌟 ปรับขนาดความกว้างและระยะห่าง (Compact Mode) ตามที่คุณต้องการ */}
          <div className="w-full md:w-[340px] lg:w-[380px] xl:w-[400px] bg-white shadow-2xl flex flex-col h-[75vh] md:h-full fixed md:relative bottom-0 z-20 rounded-t-[2rem] md:rounded-none shrink-0 transition-transform duration-300 border-l border-slate-200">
            
            {/* Header: รายการจ่ายขึ้นรถ */}
            <div className="p-4 md:p-5 border-b border-slate-100 bg-slate-50 shrink-0">
              <h2 className="font-black text-slate-900 text-lg flex items-center gap-2">📋 รายการจ่ายขึ้นรถ</h2>
            </div>
            
            {/* Form: เลือกรถและกะ */}
            <div className="p-4 md:p-5 space-y-4 border-b border-slate-100 shrink-0 bg-white">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-600">เลือกรถสายส่ง / เส้นทาง <span className="text-rose-500">*</span></label>
                <select value={selectedRoute} onChange={handleRouteSelection} className="w-full border-2 border-blue-200 px-3 py-2.5 rounded-xl font-bold focus:border-blue-500 bg-blue-50 text-blue-800 outline-none text-sm">
                  <option value="" disabled>-- เลือกสายส่ง --</option>
                  {truckRoutes.map(r => (<option key={r.id} value={`${r.route_name} (คนขับ: ${r.driver_name})`}>{r.route_name} [ทะเบียน: {r.license_plate}] - {r.driver_name}</option>))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-600">รอบจ่ายสินค้า <span className="text-rose-500">*</span></label>
                <div className="grid grid-cols-4 gap-1.5">
                  {['รอบเช้า', 'รอบบ่าย', 'รอบเย็น', 'รอบพิเศษ'].map(shift => (
                    <button key={shift} onClick={() => setSelectedShift(shift)} className={`py-2 rounded-lg font-bold text-[10px] border-2 transition-all ${selectedShift === shift ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>{shift}</button>
                  ))}
                </div>
              </div>
            </div>

            {/* List: รายการสินค้า (เลื่อนได้และไม่โดนทับ) */}
            <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-2.5 bg-slate-50/50 min-h-0">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-3 opacity-50"><span className="text-4xl">👆</span><p className="font-bold text-xs">จิ้มเลือกสินค้าฝั่งซ้าย</p></div>
              ) : (
                cart.map(item => (
                  <div key={item.id} className="flex justify-between items-center border border-slate-200 p-2.5 rounded-xl bg-white shadow-sm">
                    <div className="flex-1 pr-2"><h3 className="font-bold text-slate-800 text-xs truncate">{item.name}</h3></div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200">
                        <button onClick={() => updateQty(item.id, -1)} className="w-7 h-7 bg-white hover:bg-slate-50 rounded text-slate-600 font-black shadow-sm">-</button>
                        <button onClick={() => editCartQty(item.id, item.qty)} className="w-8 text-center font-black text-sm text-blue-600 hover:bg-blue-100 rounded transition-colors">{item.qty}</button>
                        <button onClick={() => updateQty(item.id, 1)} className="w-7 h-7 bg-white hover:bg-slate-50 rounded text-slate-600 font-black shadow-sm">+</button>
                      </div>
                      <button onClick={() => removeFromCart(item.id)} className="text-slate-300 hover:text-rose-500 font-black text-base px-1">✕</button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer: สรุปและปุ่มบันทึก (ถูกล็อกให้อยู่ข้างล่างเสมอ ไม่ทับของ) */}
            <div className="p-4 md:p-5 bg-white border-t border-slate-200 z-10 shrink-0">
              <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="หมายเหตุ (เช่น เบิกเพิ่มพิเศษ, งานแต่ง ฯลฯ)" className="w-full border-2 border-slate-200 px-3 py-2.5 rounded-xl font-bold focus:border-blue-500 outline-none text-xs mb-3" />
              <div className="flex justify-between items-end mb-3">
                <span className="font-bold text-slate-500 text-xs">ยอดรวมจ่ายของ</span>
                <span className="font-black text-4xl text-blue-600 tracking-tight leading-none">{totalItems}<span className="text-xs text-slate-500 ml-1 font-bold">หน่วย</span></span>
              </div>
              <button onClick={handleSaveDraft} disabled={cart.length === 0 || !selectedRoute || !selectedShift} className="w-full font-black text-base py-3.5 rounded-xl bg-slate-800 hover:bg-black disabled:bg-slate-200 disabled:text-slate-400 text-white shadow-lg transition-all active:scale-95 flex justify-center items-center gap-2">💾 บันทึกยืนยันจ่ายรถ</button>
            </div>

          </div>
        </div>

      ) : activeTab === 'return' ? (
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
          <div className="w-full md:w-[350px] bg-white border-r border-slate-200 shadow-sm flex flex-col h-full shrink-0">
            <div className="p-5 border-b border-slate-100 bg-slate-50"><h2 className="font-black text-slate-900 text-base">🚛 เลือกรถที่กลับมาส่งยอด</h2></div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {isLoadingPending ? (<p className="text-center text-slate-400 font-bold mt-10">⏳ กำลังโหลดข้อมูล...</p>) 
              : pendingGroups.length === 0 ? (<p className="text-center text-slate-400 font-bold mt-10">✅ ไม่มีรถค้างส่งยอด</p>) 
              : pendingGroups.map(group => (
                <button key={group.routeName} onClick={() => handleSelectRouteGroup(group)} className={`w-full text-left p-4 rounded-2xl border-2 transition-all shadow-sm ${selectedRouteKey === group.routeName ? 'bg-blue-50 border-blue-500 ring-4 ring-blue-500/20' : 'bg-white border-slate-200 hover:border-blue-300'}`}>
                  <p className="font-black text-slate-800 text-sm mb-1">{group.routeName}</p>
                  <div className="text-[11px] font-bold text-slate-500 space-y-0.5 mt-2 pt-2 border-t border-slate-100">
                    {group.records.map((rec: TruckSettlementRecord, idx: number) => (<p key={idx} className="flex justify-between"><span>รอบ: {rec.details?.shift}</span><span className="text-blue-600">บิล: {rec.id.slice(-6)}</span></p>))}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 flex flex-col bg-slate-50 overflow-hidden">
            {!selectedRouteKey ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 space-y-3 opacity-50"><span className="text-6xl">📝</span><p className="font-bold text-lg">เลือกรถจากเมนูด้านซ้ายเพื่อเริ่มเช็คของคืน</p></div>
            ) : (
              <div className="flex-1 overflow-y-auto p-4 md:p-8">
                <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden max-w-4xl mx-auto flex flex-col">
                  <div className="p-6 border-b border-slate-200 bg-white">
                    <h2 className="text-xl font-black text-slate-800 mb-2">ตรวจสอบสินค้าเหลือกลับ & คืนกระสอบ (รวมทุกกะ)</h2>
                    <p className="text-sm font-bold text-slate-500">สายรถ: <span className="text-blue-600">{selectedRouteKey}</span></p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-slate-100 border-b-2 border-slate-200 text-slate-600 text-xs">
                        <tr><th className="p-4 font-bold">สินค้า</th><th className="p-4 font-black text-center w-32">เบิกไป (รวม)</th><th className="p-4 font-bold text-center w-32 text-orange-600">คืน (ดี)</th><th className="p-4 font-bold text-center w-32 text-rose-600">เสีย/ละลาย</th><th className="p-4 font-black text-right w-32 text-emerald-600">ขายได้ (ยอดส่ง)</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {returnItems.map((item, idx) => {
                          const soldQty = item.loadedQty - item.returnedQty - item.damagedQty
                          return (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className="p-4 font-bold text-slate-700 text-sm">{item.name}</td>
                              <td className="p-4 font-black text-center text-xl">{item.loadedQty}</td>
                              <td className="p-3"><input type="number" min="0" max={item.loadedQty} value={item.returnedQty === 0 ? '' : item.returnedQty} onChange={e => updateReturnQty(item.productId, 'returnedQty', e.target.value)} placeholder="0" className="w-full text-center border-2 border-orange-200 focus:border-orange-500 rounded-xl py-2 font-black text-orange-700 outline-none" /></td>
                              <td className="p-3"><input type="number" min="0" max={item.loadedQty} value={item.damagedQty === 0 ? '' : item.damagedQty} onChange={e => updateReturnQty(item.productId, 'damagedQty', e.target.value)} placeholder="0" className="w-full text-center border-2 border-rose-200 focus:border-rose-500 rounded-xl py-2 font-black text-rose-700 outline-none" /></td>
                              <td className="p-4 font-black text-right text-xl text-emerald-600">{soldQty}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="p-6 bg-slate-50 border-t-2 border-slate-200 space-y-6">
                    <h3 className="font-black text-slate-700">📦 การจัดการกระสอบเปล่า / กระสอบค้าง</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1"><label className="text-xs font-bold text-slate-600">คืนกระสอบเปล่า (ใบ)</label><input type="number" min="0" value={bagForm.returnedEmptyBags} onChange={e => setBagForm({...bagForm, returnedEmptyBags: e.target.value})} placeholder="0" className="w-full border border-slate-300 rounded-xl p-3 font-black text-lg bg-white outline-none focus:border-blue-500" /></div>
                      <div className="space-y-1"><label className="text-xs font-bold text-slate-600">กระสอบค้าง/ค้างส่งที่ลูกค้า (ใบ)</label><input type="number" min="0" value={bagForm.pendingBags} onChange={e => setBagForm({...bagForm, pendingBags: e.target.value})} placeholder="0" className="w-full border border-slate-300 rounded-xl p-3 font-black text-lg bg-white outline-none focus:border-blue-500" /></div>
                    </div>
                    <div className="space-y-1"><label className="text-xs font-bold text-slate-600">หมายเหตุเพิ่มเติม</label><input type="text" value={bagForm.note} onChange={e => setBagForm({...bagForm, note: e.target.value})} placeholder="ระบุรายละเอียดเพิ่มเติม..." className="w-full border border-slate-300 rounded-xl p-3 font-bold text-sm bg-white outline-none focus:border-blue-500" /></div>
                    <div className="flex justify-end items-center bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mt-4">
                      <button onClick={submitSettlement} className="w-full md:w-auto bg-slate-900 hover:bg-black text-white font-black py-4 px-12 rounded-xl shadow-lg transition-transform active:scale-95 text-base flex items-center justify-center gap-2">💾 บันทึกรับคืนสินค้าเข้าคลัง (ส่งยอดให้บัญชี)</button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-50/50">
          <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-100 shadow-sm max-w-6xl mx-auto animate-in fade-in duration-300">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 border-b border-slate-100 pb-4 gap-4">
              <h2 className="text-lg font-black text-slate-800">🗂️ ประวัติการเบิกสินค้าและรับของคืน (คลังสินค้า)</h2>
              <div className="flex items-center gap-3 w-full md:w-auto">
                <span className="font-bold text-slate-500">เลือกวันที่:</span>
                <input type="date" value={historyDate} onChange={e => setHistoryDate(e.target.value)} className="flex-1 px-4 py-2 rounded-xl border border-slate-300 focus:border-blue-500 outline-none font-bold bg-slate-50" />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 text-[11px] whitespace-nowrap">
                  <tr><th className="p-4 font-bold">เวลา / เลขที่บิล</th><th className="p-4 font-bold">สายส่งรถ</th><th className="p-4 font-bold text-center">สถานะ</th><th className="p-4 font-bold">รายการเบิก (และรับคืน)</th><th className="p-4 font-bold text-center">พนักงานจ่ายของ</th><th className="p-4 font-bold text-center w-24">จัดการ</th></tr>
                </thead>
                <tbody className="text-sm divide-y divide-slate-50">
                  {isLoadingHistory ? (<tr><td colSpan={6} className="p-10 text-center text-slate-400 font-bold">⏳ กำลังค้นหาข้อมูล...</td></tr>) : historyRecords.length === 0 ? (<tr><td colSpan={6} className="p-10 text-center text-slate-400 font-bold">ยังไม่มีประวัติในวันที่ {historyDate}</td></tr>) : (
                    historyRecords.map(record => {
                      const items = record.details?.items || record.details?.loadedItems || []
                      return (
                        <tr key={record.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-4"><p className="font-bold text-slate-800">{record.createdAt ? new Date(record.createdAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '-'} น.</p><p className="text-[10px] text-slate-400 mt-1">{record.id}</p></td>
                          <td className="p-4"><p className="font-black text-blue-700">{record.routeName}</p><p className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded font-bold w-fit mt-1">รอบ {record.details?.shift || '-'}</p></td>
                          <td className="p-4 text-center">{record.status === 'pending' ? (<span className="bg-amber-100 text-amber-700 border border-amber-200 px-3 py-1 rounded-full font-bold text-[10px]">⏳ รอเคลียร์</span>) : (<span className="bg-emerald-100 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-full font-bold text-[10px]">✅ เคลียร์แล้ว</span>)}</td>
                          <td className="p-4"><ul className="text-[11px] font-bold text-slate-600 space-y-0.5">{items.map((i: TruckSettlementItem, idx: number) => (<li key={idx}>• {i.name} <span className="text-blue-600">x{i.loadedQty || i.qty}</span> {(i.returnedQty ?? 0) > 0 && <span className="text-orange-500">(คืน {i.returnedQty})</span>} {(i.damagedQty ?? 0) > 0 && <span className="text-rose-500">(เสีย {i.damagedQty})</span>}</li>))}</ul>{record.note && <p className="text-[10px] text-rose-500 mt-1">📝 หมายเหตุ: {record.note}</p>}</td>
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