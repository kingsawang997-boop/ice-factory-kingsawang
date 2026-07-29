'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

// 🌟 ประกาศ Types ทั้งหมดไว้ด้านบน เพื่อให้ใช้งานร่วมกันได้ทั้งหน้า ป้องกัน TS Error
type TruckRoute = { id: string; route_name: string; driver_name?: string }
type Debtor = { id: string; name: string; outstanding?: number }
type DebtorItem = { productName: string; qty: number; price: number }

type IceBreakdown = { sold50?: number; sold45?: number; sold40?: number; sold35?: number; sold32?: number; service?: number }
type PackBreakdown = {
  icePacks?: number
  water1500?: number
  water600?: number
  water350?: number
  water1500PromoSets?: number
  water600PromoSets?: number
  water350PromoSets?: number
}
type DebtorDetailsPrint = { debtorName?: string; docNo?: string; items?: { productName?: string; qty?: number; price?: number }[]; total?: number }
type BagTracking = { grossLoad?: number; netLoad?: number; returnedToStock?: number; melted?: number; soldAndService?: number; customerOwe?: number; customerReturnOld?: number; expectedReturn?: number; actualReturn?: number; lostBagsToDeduct?: number }
type RevenueSummary = { iceSales?: number; packSales?: number; total?: number }
type CashSummary = { expected?: number; actual?: number; diff?: number }

type SettlementDetails = {
  date?: string
  truck?: string
  revenue?: RevenueSummary
  bagTracking?: BagTracking
  cash?: CashSummary
  debtorDetails?: DebtorDetailsPrint | null
  iceBreakdown?: IceBreakdown
  packBreakdown?: PackBreakdown
  [key: string]: any
}

type SettlementRecord = {
  id: string
  date?: string
  routeName?: string
  details?: SettlementDetails | null
  expectedAmount?: number
  cashAmount?: number
  transferAmount?: number
  creditAmount?: number
  expenseAmount?: number
  diffAmount?: number
  note?: string
  by?: string
  status?: string
  createdAt?: string
}

export default function RouteSettlementPage() {
  const [activeTab, setActiveTab] = useState<'form' | 'history'>('form')

  const getTodayString = () => {
    const today = new Date()
    return new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0]
  }

  const [truckRoutes, setTruckRoutes] = useState<TruckRoute[]>([])
  const [selectedTruck, setSelectedTruck] = useState('')
  const [reportDate, setReportDate] = useState(getTodayString())
  const [isPullingData, setIsPullingData] = useState(false)

  const [adminSettings, setAdminSettings] = useState({ icePrice50: 50, icePrice1: 45, icePrice2: 40, icePrice3: 35, icePrice32: 32, icePackPrice: 15, waterPrice1500: 45, waterPrice600: 45, waterPrice350: 45 })
  const [morningLoad, setMorningLoad] = useState({ totalIceBags: 0, icePacks: 0, water1500: 0, water600: 0, water350: 0 })
  const [iceData, setIceData] = useState({ returned: 0, melted: 0, sold50: 0, sold45: 0, sold40: 0, sold35: 0, sold32: 0, service: 0, customerOweBags: 0, customerReturnOldBags: 0, returnEmptyBags: 0 })
  const [packReturns, setPackReturns] = useState({ icePacks: 0, water1500: 0, water600: 0, water350: 0 })
  const [waterPromoSets, setWaterPromoSets] = useState({ water1500: 0, water600: 0, water350: 0 })
  const [finance, setFinance] = useState({ transfer: 0, payArrears: 0, dailyArrears: 0, monthlyArrears: 0, actualCash: 0 })
  const [cashierName, setCashierName] = useState('นางสาวนภา หน้าร้าน')

  const [isDebtorModalOpen, setIsDebtorModalOpen] = useState(false)
  const [debtorsList, setDebtorsList] = useState<Debtor[]>([])
  const [tempDebtorId, setTempDebtorId] = useState('')
  const [debtorItems, setDebtorItems] = useState<DebtorItem[]>([{ productName: 'น้ำแข็งหลอดใหญ่', qty: 1, price: 45 }])
  const [debtorDocNo, setDebtorDocNo] = useState('')
  const [selectedDebtorId, setSelectedDebtorId] = useState('')
  const [selectedDebtorName, setSelectedDebtorName] = useState('')

  // 🌟 แก้ไข Type ให้ถูกต้อง ป้องกัน TS Error
  const [selectedDetailRecord, setSelectedDetailRecord] = useState<SettlementRecord | null>(null)

  const fetchLivePrices = useCallback(async () => {
    const { data } = await supabase.from('products').select('name, price').eq('isActive', true)
    if (data) {
      const newSettings = { icePrice50: 50, icePrice1: 45, icePrice2: 40, icePrice3: 35, icePrice32: 32, icePackPrice: 15, waterPrice1500: 45, waterPrice600: 45, waterPrice350: 45 }
      data.forEach(p => {
        if (p.name.includes('แพ็ค') && p.name.includes('น้ำแข็ง')) newSettings.icePackPrice = Number(p.price)
        else if (p.name.includes('1500')) newSettings.waterPrice1500 = Number(p.price)
        else if (p.name.includes('600')) newSettings.waterPrice600 = Number(p.price)
        else if (p.name.includes('350')) newSettings.waterPrice350 = Number(p.price)
      })
      setAdminSettings(newSettings)
    }
  }, [])

  const fetchTruckRoutes = useCallback(async () => {
    const { data } = await supabase.from('truck_routes').select('*').eq('isActive', true).order('id')
    if (data) {
      setTruckRoutes(data)
      if (data.length > 0) {
        setSelectedTruck(prev => prev || `${data[0].route_name} (คนขับ: ${data[0].driver_name})`)
      }
    }
  }, [])

  const fetchTruckLoadingData = useCallback(async () => {
    setIceData({ returned: 0, melted: 0, sold50: 0, sold45: 0, sold40: 0, sold35: 0, sold32: 0, service: 0, customerOweBags: 0, customerReturnOldBags: 0, returnEmptyBags: 0 })
    setPackReturns({ icePacks: 0, water1500: 0, water600: 0, water350: 0 })
    setWaterPromoSets({ water1500: 0, water600: 0, water350: 0 })
    setFinance({ transfer: 0, payArrears: 0, dailyArrears: 0, monthlyArrears: 0, actualCash: 0 })
    setSelectedDebtorId(''); setSelectedDebtorName('')
    
    setIsPullingData(true)
    const { data } = await supabase.from('route_settlements').select('details').eq('routeName', selectedTruck).eq('date', reportDate).eq('status', 'completed')

    let iceBags = 0, packs = 0, w1500 = 0, w600 = 0, w350 = 0
    let retIce = 0, dmgIce = 0, retPacks = 0, ret1500 = 0, ret600 = 0, ret350 = 0
    let retEmptyBags = 0, pendingBags = 0

    if (data && data.length > 0) {
      data.forEach(record => {
          type LoadedItem = { loadedQty?: number; qty?: number; returnedQty?: number; damagedQty?: number; name?: string }
          const itemsList: LoadedItem[] = record.details?.items || record.details?.loadedItems || []
          itemsList.forEach((item: LoadedItem) => {
            const qty = Number(item.loadedQty || item.qty || 0)
            const returned = Number(item.returnedQty || 0)
            const damaged = Number(item.damagedQty || 0)
            const name = item.name || ''
          
          if (name.includes('แพ็ค') && name.includes('น้ำแข็ง')) { packs += qty; retPacks += (returned + damaged) }
          else if (name.includes('1500')) { w1500 += qty; ret1500 += (returned + damaged) }
          else if (name.includes('600')) { w600 += qty; ret600 += (returned + damaged) }
          else if (name.includes('350')) { w350 += qty; ret350 += (returned + damaged) }
          else { iceBags += qty; retIce += returned; dmgIce += damaged }
        })

        if(record.details?.bagTracking) {
          retEmptyBags += Number(record.details.bagTracking.returnedEmptyBags || 0)
          pendingBags += Number(record.details.bagTracking.pendingBags || 0)
        }
      })
    }
    
    setMorningLoad({ totalIceBags: iceBags, icePacks: packs, water1500: w1500, water600: w600, water350: w350 })
    setIceData(prev => ({ ...prev, returned: retIce, melted: dmgIce, customerOweBags: pendingBags, returnEmptyBags: retEmptyBags }))
    setPackReturns({ icePacks: retPacks, water1500: ret1500, water600: ret600, water350: ret350 })

    setIsPullingData(false)
  }, [selectedTruck, reportDate])

  useEffect(() => {
    const load = async () => {
      const session = localStorage.getItem('kingsawang_session')
      if (session) setCashierName(JSON.parse(session).name)
      await fetchLivePrices()
      await fetchTruckRoutes()
    }
    void load()
  }, [fetchLivePrices, fetchTruckRoutes])

  useEffect(() => {
    if (selectedTruck) {
      const load = async () => { await fetchTruckLoadingData() }
      void load()
    }
  }, [selectedTruck, reportDate, fetchTruckLoadingData])

  const openDebtorModal = async () => {
    const { data } = await supabase.from('debtors').select('*').order('name')
    if (data) setDebtorsList(data)
    setIsDebtorModalOpen(true)
  }

  const addDebtorItemRow = () => setDebtorItems([...debtorItems, { productName: 'น้ำแข็งหลอดเล็ก', qty: 1, price: 40 }])
  const updateDebtorItem = (index: number, field: keyof DebtorItem, value: string | number) => {
    const newItems = [...debtorItems]
    const item = { ...newItems[index] }
    if (field === 'productName') item.productName = String(value)
    else if (field === 'qty') item.qty = Number(value)
    else if (field === 'price') item.price = Number(value)
    newItems[index] = item
    setDebtorItems(newItems)
  }
  const removeDebtorItemRow = (index: number) => setDebtorItems(debtorItems.filter((_, idx) => idx !== index))
  const totalDebtorCalculatedAmount = debtorItems.reduce((sum, item) => sum + (Number(item.qty || 0) * Number(item.price || 0)), 0)

  const confirmDebtor = () => {
    if (!tempDebtorId) return alert('กรุณาเลือกลูกหนี้ในระบบ')
    if (!debtorDocNo) return alert('กรุณากรอกเลขที่เอกสารอ้างอิง')
    if (totalDebtorCalculatedAmount <= 0) return alert('กรุณาเพิ่มรายการสินค้าและยอดเงินให้ถูกต้อง')

    const debtorInfo = debtorsList.find(d => d.id === tempDebtorId)
    if(debtorInfo) {
      setSelectedDebtorId(debtorInfo.id)
      setSelectedDebtorName(debtorInfo.name)
      setFinance(prev => ({ ...prev, monthlyArrears: totalDebtorCalculatedAmount }))
      setIsDebtorModalOpen(false)
    }
  }

  const cancelDebtor = () => {
    setSelectedDebtorId(''); setSelectedDebtorName(''); setTempDebtorId(''); setDebtorDocNo('')
    setFinance(prev => ({ ...prev, monthlyArrears: 0 }))
  }

  const netIceBags = Math.max(0, morningLoad.totalIceBags - iceData.returned)
  const accountedIceBags = iceData.melted + iceData.service + iceData.sold50 + iceData.sold45 + iceData.sold40 + iceData.sold35 + iceData.sold32
  const bagDifference = netIceBags - accountedIceBags
  const iceRevenue = (iceData.sold50 * adminSettings.icePrice50) + (iceData.sold45 * adminSettings.icePrice1) + (iceData.sold40 * adminSettings.icePrice2) + (iceData.sold35 * adminSettings.icePrice3) + (iceData.sold32 * adminSettings.icePrice32)

  const totalSoldAndServiceBags = iceData.sold50 + iceData.sold45 + iceData.sold40 + iceData.sold35 + iceData.sold32 + iceData.service
  // 🌟 แก้ไขจุดที่เกิด Error: ใส่คำว่า iceData. นำหน้า
  const expectedEmptyBags = totalSoldAndServiceBags - iceData.customerOweBags + iceData.customerReturnOldBags
  const lostEmptyBags = expectedEmptyBags - iceData.returnEmptyBags

  const icePackSold = Math.max(0, morningLoad.icePacks - packReturns.icePacks)
  const waterSold1500 = Math.max(0, morningLoad.water1500 - packReturns.water1500)
  const waterSold600 = Math.max(0, morningLoad.water600 - packReturns.water600)
  const waterSold350 = Math.max(0, morningLoad.water350 - packReturns.water350)

  const WATER_PROMO_PACKS = 3
  const WATER_PROMO_PRICE = 100
  const calculateWaterRevenue = (sold: number, unitPrice: number, promoSets = 0) => {
    const validPromoSets = Math.min(Math.max(0, Math.floor(promoSets)), Math.floor(sold / WATER_PROMO_PACKS))
    const promoPacks = validPromoSets * WATER_PROMO_PACKS
    return (validPromoSets * WATER_PROMO_PRICE) + ((sold - promoPacks) * unitPrice)
  }

  const waterRevenue1500 = calculateWaterRevenue(waterSold1500, adminSettings.waterPrice1500, waterPromoSets.water1500)
  const waterRevenue600 = calculateWaterRevenue(waterSold600, adminSettings.waterPrice600, waterPromoSets.water600)
  const waterRevenue350 = calculateWaterRevenue(waterSold350, adminSettings.waterPrice350, waterPromoSets.water350)
  const totalPackRevenue = (icePackSold * adminSettings.icePackPrice) + waterRevenue1500 + waterRevenue600 + waterRevenue350

  const totalRevenue = iceRevenue + totalPackRevenue
  const expectedCash = Math.max(0, totalRevenue + finance.payArrears - finance.transfer - finance.dailyArrears - finance.monthlyArrears)
  const cashDifference = finance.actualCash - expectedCash

  const updateIce = (field: keyof typeof iceData, value: string) => setIceData(prev => ({ ...prev, [field]: Number(value) }))
  const updateWaterPromo = (field: keyof typeof waterPromoSets, value: string, sold: number) => {
    const maxPromoSets = Math.floor(sold / WATER_PROMO_PACKS)
    const nextValue = Math.min(Math.max(0, Math.floor(Number(value) || 0)), maxPromoSets)
    setWaterPromoSets(prev => ({ ...prev, [field]: nextValue }))
  }
  const updateFinance = (field: keyof typeof finance, value: string) => setFinance(prev => ({ ...prev, [field]: Number(value) }))
  const exactCash = () => updateFinance('actualCash', expectedCash.toString())

  const handleSave = async () => {
    if (bagDifference !== 0) {
      const confirmSave = window.confirm(`⚠️ ยอดน้ำแข็งเต็มไม่ตรงกับตอนเบิก (คลาดเคลื่อน ${bagDifference} กระสอบ)\nคุณต้องการบันทึกข้อมูลเพื่อตรวจสอบใช่หรือไม่?`)
      if (!confirmSave) return
    }

    const docNo = `SET-${Date.now().toString().slice(-6)}`
    
    if (finance.monthlyArrears > 0 && selectedDebtorId) {
      const { data: debtorData } = await supabase.from('debtors').select('outstanding').eq('id', selectedDebtorId).single()
      
      if (debtorData) {
        const itemDesc = debtorItems.map(i => `${i.productName} x${i.qty} (${i.qty * i.price}บ.)`).join(', ')
        
        await supabase.from('debtor_transactions').insert([{
          id: `TRX-${Date.now()}`, 
          debtor_id: selectedDebtorId, 
          date: reportDate, 
          type: 'borrow',
          amount: finance.monthlyArrears, 
          note: `[เลขที่เอกสาร: ${debtorDocNo}] รายการ: ${itemDesc} (สายส่ง: ${selectedTruck})`, 
          items: debtorItems, 
        }])
        
        await supabase.from('debtors').update({ 
          outstanding: Number(debtorData.outstanding || 0) + Number(finance.monthlyArrears) 
        }).eq('id', selectedDebtorId)
      }
    }

    const monthlyReportData = {
      date: reportDate, truck: selectedTruck,
      revenue: { iceSales: iceRevenue, packSales: totalPackRevenue, total: totalRevenue },
      bagTracking: { grossLoad: morningLoad.totalIceBags, netLoad: netIceBags, returnedToStock: iceData.returned, melted: iceData.melted, soldAndService: totalSoldAndServiceBags, customerOwe: iceData.customerOweBags, customerReturnOld: iceData.customerReturnOldBags, expectedReturn: expectedEmptyBags, actualReturn: iceData.returnEmptyBags, lostBagsToDeduct: lostEmptyBags },
      cash: { expected: expectedCash, actual: finance.actualCash, diff: cashDifference },
      debtorDetails: selectedDebtorId ? { debtorName: selectedDebtorName, docNo: debtorDocNo, items: debtorItems, total: finance.monthlyArrears } : null,
      iceBreakdown: { sold50: iceData.sold50, sold45: iceData.sold45, sold40: iceData.sold40, sold35: iceData.sold35, sold32: iceData.sold32, service: iceData.service },
      packBreakdown: {
        icePacks: icePackSold,
        water1500: waterSold1500,
        water600: waterSold600,
        water350: waterSold350,
        water1500PromoSets: waterPromoSets.water1500,
        water600PromoSets: waterPromoSets.water600,
        water350PromoSets: waterPromoSets.water350
      }
    }

    const newSettlement = {
      id: docNo, date: reportDate, routeName: selectedTruck, expectedAmount: totalRevenue, cashAmount: finance.actualCash, transferAmount: finance.transfer, creditAmount: finance.dailyArrears + finance.monthlyArrears, expenseAmount: finance.payArrears, diffAmount: cashDifference, note: `ถุงหาย: ${lostEmptyBags > 0 ? lostEmptyBags : 0} ใบ`, details: monthlyReportData, by: cashierName, status: 'received' 
    }

    await supabase.from('route_settlements').update({ status: 'cleared_by_summary' }).eq('routeName', selectedTruck).eq('date', reportDate).eq('status', 'completed')
    const { error } = await supabase.from('route_settlements').insert([newSettlement])
    
    if (error) alert('เกิดข้อผิดพลาดในการบันทึก: ' + error.message)
    else {
      alert(`✅ ปิดยอดสำเร็จ!\nเลขที่บิล: ${docNo}\nเงินสดรับเข้า: ${finance.actualCash.toLocaleString()} บาท`)
      window.location.reload()
    }
  }

  // TAB 2: ประวัติ
  const [historyDate, setHistoryDate] = useState(getTodayString())
  const [historyRecords, setHistoryRecords] = useState<SettlementRecord[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [printSlip, setPrintSlip] = useState<SettlementRecord | null>(null)

  const fetchHistory = useCallback(async () => {
    setIsLoadingHistory(true)
    const { data, error } = await supabase.from('route_settlements').select('*').eq('date', historyDate).eq('status', 'received').order('createdAt', { ascending: false })
    if (!error && data) setHistoryRecords(data as SettlementRecord[])
    setIsLoadingHistory(false)
  }, [historyDate])

  useEffect(() => { if (activeTab === 'history') { const load = async () => { await fetchHistory() }; void load() } }, [activeTab, historyDate, fetchHistory])

  const handlePrint = (record: SettlementRecord) => { setPrintSlip(record); setTimeout(() => { window.print(); setTimeout(() => setPrintSlip(null), 500) }, 300) }
  const handleDelete = async (id: string) => {
    if(confirm(`⚠️ ต้องการลบบิล ${id} ออกจากระบบถาวรหรือไม่?`)) { await supabase.from('route_settlements').delete().eq('id', id); fetchHistory() }
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `@media print { @page { size: A4 portrait; margin: 15mm; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: white; } }`}} />

      <div className={`space-y-6 p-4 md:p-6 bg-slate-50/50 min-h-screen text-xs ${printSlip ? 'hidden' : 'block print:hidden'}`}>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-2">
            <h1 className="text-xl md:text-2xl font-black text-slate-900 flex items-center gap-3 tracking-tight"><span className="text-2xl">📝</span> บันทึกสรุปยอดสายส่ง (Sales Summary)</h1>
            <p className="text-sm text-slate-500 font-medium">ระบบปิดยอดประจำวัน <span className="text-emerald-500 font-bold">(🟢 เชื่อมต่อยอดเบิกและรับคืนอัตโนมัติ)</span></p>
          </div>
          <div className="flex bg-slate-100 p-1.5 rounded-xl w-full md:w-auto">
            <button onClick={() => setActiveTab('form')} className={`flex-1 md:flex-none px-6 py-2.5 rounded-lg font-bold text-sm transition-all ${activeTab === 'form' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>➕ บันทึกปิดยอดใหม่</button>
            <button onClick={() => setActiveTab('history')} className={`flex-1 md:flex-none px-6 py-2.5 rounded-lg font-bold text-sm transition-all ${activeTab === 'history' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>🗂️ ประวัติย้อนหลัง</button>
          </div>
        </div>

        {activeTab === 'form' && (
          <>
            <div className="flex justify-end mb-4">
              <div className="flex gap-3 w-full md:w-auto">
                <input type="date" value={reportDate} onChange={e => setReportDate(e.target.value)} className="px-4 py-3.5 rounded-2xl border border-slate-200 font-bold text-slate-700 bg-white focus:outline-none shadow-sm" />
                <button onClick={handleSave} className="flex-1 bg-slate-900 hover:bg-black active:scale-95 text-white px-8 py-3.5 rounded-2xl font-bold shadow-lg transition-all flex items-center justify-center gap-2"><span>✅</span> ยืนยันปิดยอด</button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1 space-y-6">
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4 relative overflow-hidden">
                  {isPullingData && <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex items-center justify-center font-bold text-blue-600">⏳ กำลังดึงข้อมูลจากหน้าลาน...</div>}
                  <label className="text-sm font-bold text-slate-700 block">เลือกรถที่กลับเข้าโรงงาน</label>
                  <select value={selectedTruck} onChange={e => setSelectedTruck(e.target.value)} className="w-full px-5 py-3 rounded-xl border border-slate-200 bg-slate-50 font-black text-blue-600 focus:outline-none">
                    {truckRoutes.map(r => {
                      const routeNameFull = `${r.route_name} (คนขับ: ${r.driver_name})`
                      return <option key={r.id} value={routeNameFull}>{r.route_name} - คนขับ: {r.driver_name}</option>
                    })}
                  </select>
                  <div className="bg-sky-50 px-4 py-3 rounded-xl border border-sky-100 flex justify-between items-center"><span className="font-bold text-sky-800">ยอดเบิกสุทธิ <span className="text-[10px] text-sky-600 font-normal">(หลังหักคืนคลัง)</span>:</span><span className="text-2xl font-black text-blue-600">{netIceBags} <span className="text-sm">ใบ</span></span></div>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4 flex flex-col h-full relative">
                  {isPullingData && <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10"></div>}
                  <div className="border-b-2 border-slate-100 pb-2 flex justify-between items-end mb-2"><h2 className="text-base font-black text-slate-900 flex items-center gap-2"><span className="text-blue-500">🧊</span> กระทบยอดกระสอบ</h2><span className={`px-2.5 py-1 rounded-lg text-[10px] font-black tracking-wider border ${bagDifference === 0 ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-amber-50 text-amber-600 border-amber-200 animate-pulse'}`}>{bagDifference === 0 ? '✓ กระสอบครบ' : bagDifference > 0 ? `⚠️ หาย ${bagDifference} ใบ` : `❓ เกิน ${Math.abs(bagDifference)} ใบ`}</span></div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3"><label className="w-1/2 font-bold text-emerald-700">น้ำแข็งส่งคืนคลัง (กระสอบ)</label><input type="number" value={iceData.returned === 0 ? '' : iceData.returned} readOnly className="w-1/2 p-2.5 rounded-xl border border-emerald-200 text-center font-bold outline-none bg-emerald-50/50 text-emerald-700 cursor-not-allowed" placeholder="0" /></div>
                    <div className="flex items-center gap-3"><label className="w-1/2 font-bold text-rose-500">ละลาย / แตก / สูญเสีย</label><input type="number" value={iceData.melted === 0 ? '' : iceData.melted} readOnly className="w-1/2 p-2.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-center font-bold outline-none cursor-not-allowed" placeholder="0" /></div>
                    <div className="pt-3 space-y-3 border-t border-slate-100">
                      <div className="flex items-center gap-3"><label className="w-1/2 font-bold text-blue-600">ขายได้ (ราคา {adminSettings.icePrice50}.-)</label><input type="number" value={iceData.sold50 || ''} onChange={e => updateIce('sold50', e.target.value)} className="w-1/2 p-2.5 rounded-xl border border-blue-200 text-center font-bold text-blue-700 focus:border-blue-500 outline-none" placeholder="0" /></div>
                      <div className="flex items-center gap-3"><label className="w-1/2 font-bold text-blue-600">ขายได้ (ราคา {adminSettings.icePrice1}.-)</label><input type="number" value={iceData.sold45 || ''} onChange={e => updateIce('sold45', e.target.value)} className="w-1/2 p-2.5 rounded-xl border border-blue-200 text-center font-bold text-blue-700 focus:border-blue-500 outline-none" placeholder="0" /></div>
                      <div className="flex items-center gap-3"><label className="w-1/2 font-bold text-blue-600">ขายได้ (ราคา {adminSettings.icePrice2}.-)</label><input type="number" value={iceData.sold40 || ''} onChange={e => updateIce('sold40', e.target.value)} className="w-1/2 p-2.5 rounded-xl border border-blue-200 text-center font-bold text-blue-700 focus:border-blue-500 outline-none" placeholder="0" /></div>
                      <div className="flex items-center gap-3"><label className="w-1/2 font-bold text-blue-600">ขายได้ (ราคา {adminSettings.icePrice3}.-)</label><input type="number" value={iceData.sold35 || ''} onChange={e => updateIce('sold35', e.target.value)} className="w-1/2 p-2.5 rounded-xl border border-blue-200 text-center font-bold text-blue-700 focus:border-blue-500 outline-none" placeholder="0" /></div>
                      <div className="flex items-center gap-3"><label className="w-1/2 font-bold text-blue-600">ขายได้ (ราคา {adminSettings.icePrice32}.-)</label><input type="number" value={iceData.sold32 || ''} onChange={e => updateIce('sold32', e.target.value)} className="w-1/2 p-2.5 rounded-xl border border-blue-200 text-center font-bold text-blue-700 focus:border-blue-500 outline-none" placeholder="0" /></div>
                    </div>
                    <div className="flex items-center gap-3 pt-3"><label className="w-1/2 font-bold text-slate-600">บริการ (ถุง)</label><input type="number" value={iceData.service || ''} onChange={e => updateIce('service', e.target.value)} className="w-1/2 p-2.5 rounded-xl border border-slate-200 text-center font-bold focus:border-blue-500 outline-none" placeholder="0" /></div>
                  </div>
                  <div className="pt-4 mt-4 border-t-2 border-dashed border-slate-200">
                    <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100 space-y-3">
                      <h3 className="font-black text-orange-800 text-sm flex justify-between items-center mb-1"><span>📦 จัดการถุงเปล่า (คุมถุงหาย)</span><span className="text-[9px] bg-orange-200 text-orange-800 px-2 py-0.5 rounded-md">ขาย+แจก: {totalSoldAndServiceBags} ใบ</span></h3>
                      <div className="flex items-center gap-3"><label className="w-1/2 font-bold text-slate-600 text-[10px]">ลูกค้าค้างถุงวันนี้ (ใบ)</label><input type="number" value={iceData.customerOweBags === 0 ? '' : iceData.customerOweBags} readOnly className="w-1/2 p-2 rounded-xl border border-orange-200 text-center font-bold text-orange-900 bg-orange-50 cursor-not-allowed outline-none" placeholder="0" /></div>
                      <div className="flex items-center gap-3"><label className="w-1/2 font-bold text-slate-600 text-[10px]">ลูกค้าคืนถุงเก่า (ใบ)</label><input type="number" value={iceData.customerReturnOldBags || ''} onChange={e => updateIce('customerReturnOldBags', e.target.value)} className="w-1/2 p-2 rounded-xl border border-orange-200 text-center font-bold text-orange-900 focus:outline-none bg-white" placeholder="0" /></div>
                      <div className="flex justify-between items-center py-2 border-y border-orange-200/50"><span className="font-bold text-orange-800 text-[11px]">ถุงเปล่าที่ต้องคืนโรงงาน:</span><span className="font-black text-orange-900">{expectedEmptyBags} ใบ</span></div>
                      <div className="flex items-center gap-3"><label className="w-1/2 font-black text-slate-700">พนักงานนำมาคืนจริง</label><input type="number" value={iceData.returnEmptyBags === 0 ? '' : iceData.returnEmptyBags} readOnly className="w-1/2 p-2.5 rounded-xl border-2 border-orange-300 text-center font-black text-orange-900 bg-orange-50 cursor-not-allowed outline-none" placeholder="0" /></div>
                      <div className={`p-2 rounded-xl text-center font-bold text-[11px] ${lostEmptyBags > 0 ? 'bg-rose-500/20 text-rose-700 border border-rose-500/30' : lostEmptyBags < 0 ? 'bg-blue-500/20 text-blue-700 border border-blue-500/30' : 'bg-emerald-500/20 text-emerald-700 border border-emerald-500/30'}`}>{lostEmptyBags > 0 ? `🚨 ถุงหาย ${lostEmptyBags} ใบ (บันทึกรอหักเงิน)` : lostEmptyBags < 0 ? `🤔 ถุงเกินมา ${Math.abs(lostEmptyBags)} ใบ` : '✅ ถุงเปล่าคืนครบถ้วน'}</div>
                    </div>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl flex justify-between items-center mt-4 border border-slate-200"><span className="font-bold text-slate-500">ยอดเงินน้ำแข็ง:</span><span className="font-black text-slate-800 text-lg">{iceRevenue.toLocaleString()} บ.</span></div>
                </div>
              </div>

              <div className="lg:col-span-1 space-y-6 flex flex-col h-full">
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex-1 flex flex-col relative">
                  {isPullingData && <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center font-bold text-blue-600 gap-2"><span className="text-4xl animate-spin">📦</span>กำลังโหลด...</div>}
                  <div className="border-b-2 border-slate-100 pb-2 mb-4"><h2 className="text-base font-black text-slate-900 flex items-center gap-2"><span className="text-sky-400">📦</span> สินค้าแบบแพ็ค (หักยอดขายอัตโนมัติ)</h2></div>
                  <div className="space-y-4 flex-1">
                    {[
                      { label: '🧊 น้ำแข็งแพ็ค', field: 'icePacks', load: morningLoad.icePacks, sold: icePackSold, price: adminSettings.icePackPrice, revenue: icePackSold * adminSettings.icePackPrice, promoField: null as keyof typeof waterPromoSets | null },
                      { label: '💧 น้ำดื่ม 1500 ml', field: 'water1500', load: morningLoad.water1500, sold: waterSold1500, price: adminSettings.waterPrice1500, revenue: waterRevenue1500, promoField: 'water1500' as keyof typeof waterPromoSets },
                      { label: '💧 น้ำดื่ม 600 ml', field: 'water600', load: morningLoad.water600, sold: waterSold600, price: adminSettings.waterPrice600, revenue: waterRevenue600, promoField: 'water600' as keyof typeof waterPromoSets },
                      { label: '💧 น้ำดื่ม 350 ml', field: 'water350', load: morningLoad.water350, sold: waterSold350, price: adminSettings.waterPrice350, revenue: waterRevenue350, promoField: 'water350' as keyof typeof waterPromoSets }
                    ].map((item, idx) => (
                      <div key={idx} className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <div className="flex justify-between items-center mb-3"><span className="font-bold text-slate-800">{item.label}</span><span className="text-[10px] font-bold text-slate-400 bg-white px-2 py-1 rounded shadow-sm border border-slate-100">เบิกรวมวันนี้: <span className="text-blue-600">{item.load}</span></span></div>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] text-emerald-600 font-bold whitespace-nowrap">นำมาคืน:</span>
                          <input type="number" value={packReturns[item.field as keyof typeof packReturns] === 0 ? '' : packReturns[item.field as keyof typeof packReturns]} readOnly className="w-full p-2 rounded-xl border border-emerald-200 text-center font-bold outline-none bg-emerald-50/50 text-emerald-700 cursor-not-allowed" placeholder="0" />
                          <div className="flex flex-col items-end bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-100">
                            <span className="text-[10px] text-blue-600 font-bold whitespace-nowrap">ขาย: {item.sold}</span>
                            <span className="text-[9px] text-blue-500 font-medium">={item.revenue.toLocaleString()} บ.</span>
                          </div>
                        </div>
                        {item.promoField && (
                          <div className="mt-3 flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl p-2.5">
                            <label className="flex-1 text-[10px] font-black text-amber-700">🏷️ โปรน้ำ 3 แพ็ค 100 บาท (จำนวนชุด)</label>
                            <input
                              type="number"
                              min="0"
                              max={Math.floor(item.sold / WATER_PROMO_PACKS)}
                              value={waterPromoSets[item.promoField] || ''}
                              onChange={e => updateWaterPromo(item.promoField!, e.target.value, item.sold)}
                              className="w-20 p-2 rounded-lg border border-amber-300 bg-white text-center font-black text-amber-800 outline-none focus:border-amber-500"
                              placeholder="0"
                            />
                            <span className="text-[9px] font-bold text-amber-600 whitespace-nowrap">สูงสุด {Math.floor(item.sold / WATER_PROMO_PACKS)} ชุด</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl flex justify-between items-center mt-4 border border-slate-200"><span className="font-bold text-slate-500">ยอดเงินสินค้าแพ็ค:</span><span className="font-black text-slate-800 text-lg">{totalPackRevenue.toLocaleString()} บ.</span></div>
                </div>
              </div>

              <div className="lg:col-span-1 space-y-6">
                <div className="bg-gradient-to-b from-slate-900 to-slate-800 p-6 md:p-8 rounded-3xl border border-slate-700 shadow-xl flex flex-col h-full text-white">
                  <h2 className="text-base font-black text-white border-b border-slate-700 pb-3 mb-4 flex items-center gap-2">💰 สรุปรับเงินสด (Cashier)</h2>
                  <div className="space-y-4 flex-1">
                    <div className="flex justify-between items-center bg-slate-800/50 p-3 rounded-xl border border-slate-700"><span className="text-slate-300 font-bold">ยอดขายรวมสุทธิ</span><span className="font-black text-xl text-white">{totalRevenue.toLocaleString()} บ.</span></div>
                    <div className="space-y-3 pt-2">
                      <div className="flex items-center gap-3"><label className="w-32 text-[10px] text-slate-400 font-bold">หัก โอนเข้าบัญชี (บ.)</label><input type="number" value={finance.transfer || ''} onChange={e => updateFinance('transfer', e.target.value)} className="flex-1 p-2 rounded-xl bg-slate-800 border border-slate-600 focus:border-blue-500 outline-none text-white font-bold text-right" placeholder="0" /></div>
                      <div className="flex items-center gap-3"><label className="w-32 text-[10px] text-emerald-400 font-bold">บวก จ่ายค้างหนี้เก่า (บ.)</label><input type="number" value={finance.payArrears || ''} onChange={e => updateFinance('payArrears', e.target.value)} className="flex-1 p-2 rounded-xl bg-slate-800 border border-emerald-600 focus:border-emerald-400 outline-none text-emerald-400 font-bold text-right" placeholder="0" /></div>
                      <div className="flex items-center gap-3"><label className="w-32 text-[10px] text-slate-400 font-bold">หัก ค้างรายวัน (บ.)</label><input type="number" value={finance.dailyArrears || ''} onChange={e => updateFinance('dailyArrears', e.target.value)} className="flex-1 p-2 rounded-xl bg-slate-800 border border-slate-600 focus:border-blue-500 outline-none text-white font-bold text-right" placeholder="0" /></div>
                      
                      <div className="flex items-center gap-3">
                        <label className="w-32 text-[10px] text-rose-400 font-bold">หัก ค้างรายเดือน (บ.)</label>
                        <div className="flex-1 flex gap-2">
                          <input type="number" value={finance.monthlyArrears || ''} readOnly className="flex-1 p-2 rounded-xl bg-slate-800/50 border border-slate-700 text-rose-300 font-bold text-right cursor-not-allowed outline-none" placeholder="0" />
                          <button onClick={openDebtorModal} className="bg-rose-600 hover:bg-rose-500 text-white px-3 rounded-xl font-bold text-[10px] transition-colors whitespace-nowrap">เลือกลูกหนี้</button>
                        </div>
                      </div>
                      {selectedDebtorName && (
                        <div className="text-right text-[10px] text-rose-400 bg-rose-950/30 p-2 rounded-lg">ลูกหนี้: <span className="font-bold">{selectedDebtorName}</span> ({finance.monthlyArrears} บ.) <button onClick={cancelDebtor} className="text-slate-400 underline ml-2 hover:text-white">ยกเลิก</button></div>
                      )}

                    </div>
                    <div className="pt-4 mt-2 border-t border-slate-700 text-center"><span className="text-xs text-emerald-400 font-bold block mb-1">ยอดเงินสดที่ต้องนำส่ง:</span><p className="text-4xl font-black text-emerald-400">{expectedCash.toLocaleString()} <span className="text-sm font-normal text-slate-400">บาท</span></p><button onClick={exactCash} className="mt-2 text-[10px] bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-1 rounded-full transition-colors">คลิกถ้ารับพอดีเป๊ะ</button></div>
                    <div className="bg-white/10 p-4 rounded-2xl border border-white/20 mt-4 backdrop-blur-sm">
                      <label className="text-xs font-bold text-amber-300 block mb-2">💸 ระบุเงินสดที่นับได้จริง (บ.)</label>
                      <input type="number" value={finance.actualCash || ''} onChange={e => updateFinance('actualCash', e.target.value)} className="w-full p-3 rounded-xl bg-white text-slate-900 text-center font-black text-xl focus:outline-none focus:ring-4 focus:ring-amber-500/30" placeholder="0" />
                      {finance.actualCash > 0 && (<div className={`mt-3 p-2.5 rounded-lg text-center font-bold text-sm ${cashDifference === 0 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : cashDifference > 0 ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'}`}>{cashDifference === 0 ? '✅ ยอดเงินสดพอดีเป๊ะ' : cashDifference > 0 ? `⬆️ เงินส่งเกินมา ${Math.abs(cashDifference).toLocaleString()} บ.` : `🔻 เงินส่งขาดไป ${Math.abs(cashDifference).toLocaleString()} บ.`}</div>)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* TAB 2: ประวัติ + ฟีเจอร์คลิกดูรายการสินค้า */}
        {activeTab === 'history' && (
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm animate-in fade-in duration-300">
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 border-b border-slate-100 pb-4 gap-4">
              <h2 className="text-lg font-black text-slate-800">🗂️ ค้นหาประวัติปิดยอดสายส่ง</h2>
              <div className="flex items-center gap-3 w-full md:w-auto">
                <span className="font-bold text-slate-500">เลือกวันที่:</span>
                <input type="date" value={historyDate} onChange={e => setHistoryDate(e.target.value)} className="flex-1 px-4 py-2 rounded-xl border border-slate-300 focus:border-blue-500 outline-none font-bold" />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 text-[11px]">
                  <tr><th className="p-4 font-bold">เวลา / เลขที่บิล</th><th className="p-4 font-bold">สายส่งรถ</th><th className="p-4 font-bold text-right">ยอดขายรวม</th><th className="p-4 font-bold text-center">ถุงหาย (ใบ)</th><th className="p-4 font-bold text-right">เงินสดรับจริง</th><th className="p-4 font-bold text-center w-32">จัดการ</th></tr>
                </thead>
                <tbody className="text-sm">
                  {isLoadingHistory ? (<tr><td colSpan={6} className="p-10 text-center text-slate-400 font-bold">⏳ กำลังค้นหาข้อมูล...</td></tr>) : historyRecords.length === 0 ? (<tr><td colSpan={6} className="p-10 text-center text-slate-400 font-bold">ไม่มีประวัติการปิดยอดในวันที่ {historyDate}</td></tr>) : (
                    historyRecords.map(record => (
                      <tr key={record.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                        <td className="p-4">
                          <button onClick={() => setSelectedDetailRecord(record)} className="font-bold text-blue-600 hover:underline text-left">
                            {record.createdAt ? new Date(record.createdAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '-'} น.
                          </button>
                          <p className="text-[10px] text-slate-400 mt-0.5">{record.id}</p>
                        </td>
                        <td className="p-4 font-black text-slate-800">{record.routeName}</td>
                        <td className="p-4 text-right font-bold text-slate-700">{Number(record.expectedAmount).toLocaleString()} บ.</td>
                        <td className="p-4 text-center">{record.details?.bagTracking?.lostBagsToDeduct && record.details.bagTracking.lostBagsToDeduct > 0 ? <span className="text-rose-600 font-black bg-rose-50 px-2 py-1 rounded">{record.details.bagTracking.lostBagsToDeduct}</span> : <span className="text-emerald-500 font-bold">-</span>}</td>
                        <td className="p-4 text-right font-black text-emerald-600">{Number(record.cashAmount).toLocaleString()} บ.</td>
                        <td className="p-4 text-center"><div className="flex gap-2 justify-center"><button onClick={() => handlePrint(record)} className="px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 font-bold text-[10px] rounded-lg transition-colors flex items-center gap-1">🖨️ พิมพ์</button><button onClick={() => handleDelete(record.id)} className="w-7 h-7 bg-rose-50 text-rose-500 hover:bg-rose-100 rounded-lg flex items-center justify-center transition-colors">✕</button></div></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ป๊อปอัป Modal แสดงรายละเอียดรายการสินค้าเมื่อคลิกดูประวัติ */}
      {selectedDetailRecord && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm print:hidden">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <div>
                <h3 className="font-black text-lg text-slate-800">📦 รายละเอียดการปิดยอด: {selectedDetailRecord.id}</h3>
                <p className="text-xs font-bold text-slate-500 mt-0.5">สายส่ง: {selectedDetailRecord.routeName} | วันที่: {selectedDetailRecord.date}</p>
              </div>
              <button onClick={() => setSelectedDetailRecord(null)} className="text-slate-400 hover:text-rose-500 font-bold bg-white w-8 h-8 rounded-full shadow-sm">✕</button>
            </div>
            <div className="p-6 space-y-4 text-sm max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div><span className="text-slate-500 font-bold">ยอดขายรวม:</span> <span className="font-black text-slate-800 text-base">{Number(selectedDetailRecord.expectedAmount).toLocaleString()} บาท</span></div>
                <div><span className="text-slate-500 font-bold">เงินสดรับจริง:</span> <span className="font-black text-emerald-600 text-base">{Number(selectedDetailRecord.cashAmount).toLocaleString()} บาท</span></div>
              </div>

              <h4 className="font-black text-slate-700 text-xs uppercase tracking-wider">🧊 รายการน้ำแข็งที่ขายได้</h4>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-600">
                    <tr><th className="p-3 font-bold">เรทราคา</th><th className="p-3 font-bold text-center">จำนวน (กระสอบ)</th><th className="p-3 font-bold text-right">รวมเงิน</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedDetailRecord.details?.iceBreakdown ? (
                      <>
                        <tr><td className="p-3">ราคา {adminSettings.icePrice50}.-</td><td className="p-3 text-center font-bold">{selectedDetailRecord.details.iceBreakdown.sold50 || 0}</td><td className="p-3 text-right font-bold">{((selectedDetailRecord.details.iceBreakdown.sold50 || 0) * adminSettings.icePrice50).toLocaleString()} บ.</td></tr>
                        <tr><td className="p-3">ราคา {adminSettings.icePrice1}.-</td><td className="p-3 text-center font-bold">{selectedDetailRecord.details.iceBreakdown.sold45 || 0}</td><td className="p-3 text-right font-bold">{((selectedDetailRecord.details.iceBreakdown.sold45 || 0) * adminSettings.icePrice1).toLocaleString()} บ.</td></tr>
                        <tr><td className="p-3">ราคา {adminSettings.icePrice2}.-</td><td className="p-3 text-center font-bold">{selectedDetailRecord.details.iceBreakdown.sold40 || 0}</td><td className="p-3 text-right font-bold">{((selectedDetailRecord.details.iceBreakdown.sold40 || 0) * adminSettings.icePrice2).toLocaleString()} บ.</td></tr>
                        <tr><td className="p-3">ราคา {adminSettings.icePrice3}.-</td><td className="p-3 text-center font-bold">{selectedDetailRecord.details.iceBreakdown.sold35 || 0}</td><td className="p-3 text-right font-bold">{((selectedDetailRecord.details.iceBreakdown.sold35 || 0) * adminSettings.icePrice3).toLocaleString()} บ.</td></tr>
                        <tr><td className="p-3">ราคา {adminSettings.icePrice32}.-</td><td className="p-3 text-center font-bold">{selectedDetailRecord.details.iceBreakdown.sold32 || 0}</td><td className="p-3 text-right font-bold">{((selectedDetailRecord.details.iceBreakdown.sold32 || 0) * adminSettings.icePrice32).toLocaleString()} บ.</td></tr>
                      </>
                    ) : (<tr><td colSpan={3} className="p-4 text-center text-slate-400">ไม่มีข้อมูลรายละเอียด</td></tr>)}
                  </tbody>
                </table>
              </div>

              <h4 className="font-black text-slate-700 text-xs uppercase tracking-wider pt-2">📦 รายการสินค้าแพ็คที่ขายได้</h4>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-600">
                    <tr><th className="p-3 font-bold">สินค้าแพ็ค</th><th className="p-3 font-bold text-center">จำนวนขาย</th><th className="p-3 font-bold text-right">รวมเงิน</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedDetailRecord.details?.packBreakdown ? (
                      <>
                        <tr><td className="p-3">น้ำแข็งแพ็ค</td><td className="p-3 text-center font-bold">{selectedDetailRecord.details.packBreakdown.icePacks}</td><td className="p-3 text-right font-bold">{((selectedDetailRecord.details.packBreakdown.icePacks || 0) * adminSettings.icePackPrice).toLocaleString()} บ.</td></tr>
                        <tr><td className="p-3">น้ำดื่ม 1500 ml {(selectedDetailRecord.details.packBreakdown.water1500PromoSets || 0) > 0 && <span className="text-amber-600 font-bold">(โปร {selectedDetailRecord.details.packBreakdown.water1500PromoSets} ชุด)</span>}</td><td className="p-3 text-center font-bold">{selectedDetailRecord.details.packBreakdown.water1500 || 0}</td><td className="p-3 text-right font-bold">{calculateWaterRevenue(selectedDetailRecord.details.packBreakdown.water1500 || 0, adminSettings.waterPrice1500, selectedDetailRecord.details.packBreakdown.water1500PromoSets || 0).toLocaleString()} บ.</td></tr>
                        <tr><td className="p-3">น้ำดื่ม 600 ml {(selectedDetailRecord.details.packBreakdown.water600PromoSets || 0) > 0 && <span className="text-amber-600 font-bold">(โปร {selectedDetailRecord.details.packBreakdown.water600PromoSets} ชุด)</span>}</td><td className="p-3 text-center font-bold">{selectedDetailRecord.details.packBreakdown.water600 || 0}</td><td className="p-3 text-right font-bold">{calculateWaterRevenue(selectedDetailRecord.details.packBreakdown.water600 || 0, adminSettings.waterPrice600, selectedDetailRecord.details.packBreakdown.water600PromoSets || 0).toLocaleString()} บ.</td></tr>
                        <tr><td className="p-3">น้ำดื่ม 350 ml {(selectedDetailRecord.details.packBreakdown.water350PromoSets || 0) > 0 && <span className="text-amber-600 font-bold">(โปร {selectedDetailRecord.details.packBreakdown.water350PromoSets} ชุด)</span>}</td><td className="p-3 text-center font-bold">{selectedDetailRecord.details.packBreakdown.water350 || 0}</td><td className="p-3 text-right font-bold">{calculateWaterRevenue(selectedDetailRecord.details.packBreakdown.water350 || 0, adminSettings.waterPrice350, selectedDetailRecord.details.packBreakdown.water350PromoSets || 0).toLocaleString()} บ.</td></tr>
                      </>
                    ) : (<tr><td colSpan={3} className="p-4 text-center text-slate-400">ไม่มีข้อมูลรายละเอียด</td></tr>)}
                  </tbody>
                </table>
              </div>

              {selectedDetailRecord.details?.debtorDetails && (
                <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl text-xs space-y-1">
                  <p className="font-black text-rose-800">📌 บันทึกหนี้ค้างรายเดือน:</p>
                  <p>ลูกหนี้: <span className="font-bold">{selectedDetailRecord.details.debtorDetails.debtorName}</span> (เลขที่เอกสาร: {selectedDetailRecord.details.debtorDetails.docNo})</p>
                  <p>ยอดเงินหนี้: <span className="font-bold text-rose-600">{selectedDetailRecord.details.debtorDetails.total} บาท</span></p>
                </div>
              )}
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button onClick={() => { const rec = selectedDetailRecord; setSelectedDetailRecord(null); handlePrint(rec); }} className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2.5 rounded-xl shadow">🖨️ พิมพ์เอกสารนี้</button>
            </div>
          </div>
        </div>
      )}

      {/* ป๊อปอัป Modal เลือกลูกหนี้แบบสมบูรณ์ */}
      {isDebtorModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm print:hidden">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <h3 className="font-black text-lg text-slate-800">📋 บันทึกค้างรายเดือน (เลือกลูกหนี้)</h3>
              <button onClick={() => setIsDebtorModalOpen(false)} className="text-slate-400 hover:text-rose-500 font-bold bg-white w-8 h-8 rounded-full shadow-sm">✕</button>
            </div>
            <div className="p-6 space-y-5 text-sm max-h-[75vh] overflow-y-auto">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-bold text-slate-600 text-xs">เลือกลูกหนี้:</label>
                  <select value={tempDebtorId} onChange={e => setTempDebtorId(e.target.value)} className="w-full p-3 rounded-xl border-2 border-slate-200 font-bold text-blue-600 focus:border-blue-500 outline-none bg-slate-50 text-xs">
                    <option value="">-- กรุณาเลือกลูกหนี้ --</option>
                    {debtorsList.map(d => <option key={d.id} value={d.id}>{d.name} (ค้างเดิม: {d.outstanding || 0} บ.)</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-600 text-xs">เลขที่เอกสารอ้างอิง:</label>
                  <input type="text" value={debtorDocNo} onChange={e => setDebtorDocNo(e.target.value)} placeholder="เช่น INV-001 หรือเลขที่บิล" className="w-full p-3 rounded-xl border-2 border-slate-200 font-bold text-slate-800 focus:border-blue-500 outline-none text-xs bg-slate-50" />
                </div>
              </div>

              {/* ตารางรายการสินค้า */}
              <div className="space-y-2 pt-2">
                <div className="flex justify-between items-center">
                  <label className="font-black text-slate-700 text-xs">1. รายการสินค้า & 2. ยอดเงินสินค้า:</label>
                  <button onClick={addDebtorItemRow} className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold text-xs px-3 py-1.5 rounded-lg border border-emerald-200">+ เพิ่มรายการ</button>
                </div>
                <div className="border border-slate-200 rounded-2xl overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-slate-100 text-[11px] text-slate-600">
                      <tr><th className="p-3 font-bold">ชื่อสินค้า</th><th className="p-3 font-bold text-center w-24">จำนวน</th><th className="p-3 font-bold text-right w-28">ราคา/หน่วย</th><th className="p-3 font-bold text-right w-28">รวม (บาท)</th><th className="p-3 w-12"></th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {debtorItems.map((item, idx) => (
                        <tr key={idx}>
                          <td className="p-2"><input type="text" value={item.productName} onChange={e => updateDebtorItem(idx, 'productName', e.target.value)} className="w-full p-2 border border-slate-200 rounded-lg font-bold" /></td>
                          <td className="p-2"><input type="number" min="1" value={item.qty} onChange={e => updateDebtorItem(idx, 'qty', Number(e.target.value))} className="w-full p-2 border border-slate-200 rounded-lg text-center font-bold" /></td>
                          <td className="p-2"><input type="number" min="0" value={item.price} onChange={e => updateDebtorItem(idx, 'price', Number(e.target.value))} className="w-full p-2 border border-slate-200 rounded-lg text-right font-bold" /></td>
                          <td className="p-2 text-right font-black text-slate-800">{(item.qty * item.price).toLocaleString()}</td>
                          <td className="p-2 text-center"><button onClick={() => removeDebtorItemRow(idx)} className="text-rose-500 font-bold hover:bg-rose-50 p-1.5 rounded">✕</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ยอดรวมสุทธิ */}
              <div className="bg-blue-50 border border-blue-200 p-4 rounded-2xl flex justify-between items-center">
                <span className="font-bold text-blue-900 text-sm">3. ยอดรวมสุทธิทั้งหมด:</span>
                <span className="font-black text-3xl text-blue-700">{totalDebtorCalculatedAmount.toLocaleString()} <span className="text-sm font-bold">บาท</span></span>
              </div>

              <button onClick={confirmDebtor} className="w-full bg-slate-900 hover:bg-black text-white font-black py-4 rounded-xl shadow-lg transition-transform active:scale-95 text-base mt-2">
                ยืนยันบันทึกยอดหนี้ค้างรายเดือน
              </button>
            </div>
          </div>
        </div>
      )}

      {/* หน้ากระดาษพิมพ์ข้อมูลทั้งหมด */}
      {printSlip && (
        <div className="hidden print:block text-black font-sans bg-white p-10 max-w-4xl mx-auto min-h-screen">
          <div className="text-center mb-6 pb-4 border-b-4 border-black">
            <h1 className="text-2xl font-black mb-1">ใบสรุปยอดสายส่งประจำวัน (Route Settlement)</h1>
            <p className="font-bold text-base">คิงส์สว่าง โรงงานน้ำแข็งและน้ำดื่ม</p>
          </div>
          
          <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
            <div><p><span className="font-bold">วันที่:</span> {printSlip.date}</p><p><span className="font-bold">สายส่ง:</span> {printSlip.routeName}</p></div>
            <div className="text-right"><p><span className="font-bold">เลขที่เอกสาร:</span> {printSlip.id}</p><p><span className="font-bold">พิมพ์เมื่อ:</span> {new Date().toLocaleString('th-TH')}</p></div>
          </div>

          <table className="w-full border-collapse border-2 border-black text-xs mb-4">
            <thead>
              <tr className="bg-gray-200 border-b-2 border-black">
                <th className="border-r border-black py-2 px-3 text-left">รายการสินค้า (Description)</th>
                <th className="border-r border-black py-2 px-3 text-center w-24">จำนวนขาย</th>
                <th className="py-2 px-3 text-right w-32">จำนวนเงิน (บาท)</th>
              </tr>
            </thead>
            <tbody>
              <tr className="bg-gray-100 font-bold"><td colSpan={3} className="p-1.5 border-b border-black">-- หมวดน้ำแข็ง --</td></tr>
              {(printSlip.details?.iceBreakdown?.sold50 || 0) > 0 && (
                <tr className="border-b border-gray-300">
                  <td className="border-r border-black p-1.5 pl-4">น้ำแข็ง (เรทราคา {adminSettings.icePrice50}.-)</td>
                  <td className="border-r border-black p-1.5 text-center">{printSlip.details?.iceBreakdown?.sold50} กระสอบ</td>
                  <td className="p-1.5 text-right">{((printSlip.details?.iceBreakdown?.sold50 || 0) * adminSettings.icePrice50).toLocaleString()}</td>
                </tr>
              )}
              {(printSlip.details?.iceBreakdown?.sold45 || 0) > 0 && (
                <tr className="border-b border-gray-300">
                  <td className="border-r border-black p-1.5 pl-4">น้ำแข็ง (เรทราคา {adminSettings.icePrice1}.-)</td>
                  <td className="border-r border-black p-1.5 text-center">{printSlip.details?.iceBreakdown?.sold45} กระสอบ</td>
                  <td className="p-1.5 text-right">{((printSlip.details?.iceBreakdown?.sold45 || 0) * adminSettings.icePrice1).toLocaleString()}</td>
                </tr>
              )}
              {(printSlip.details?.iceBreakdown?.sold40 || 0) > 0 && (
                <tr className="border-b border-gray-300">
                  <td className="border-r border-black p-1.5 pl-4">น้ำแข็ง (เรทราคา {adminSettings.icePrice2}.-)</td>
                  <td className="border-r border-black p-1.5 text-center">{printSlip.details?.iceBreakdown?.sold40} กระสอบ</td>
                  <td className="p-1.5 text-right">{((printSlip.details?.iceBreakdown?.sold40 || 0) * adminSettings.icePrice2).toLocaleString()}</td>
                </tr>
              )}
              {(printSlip.details?.iceBreakdown?.sold35 || 0) > 0 && (
                <tr className="border-b border-gray-300">
                  <td className="border-r border-black p-1.5 pl-4">น้ำแข็ง (เรทราคา {adminSettings.icePrice3}.-)</td>
                  <td className="border-r border-black p-1.5 text-center">{printSlip.details?.iceBreakdown?.sold35} กระสอบ</td>
                  <td className="p-1.5 text-right">{((printSlip.details?.iceBreakdown?.sold35 || 0) * adminSettings.icePrice3).toLocaleString()}</td>
                </tr>
              )}

              {(printSlip.details?.iceBreakdown?.sold32 || 0) > 0 && (
                <tr className="border-b border-gray-300">
                  <td className="border-r border-black p-1.5 pl-4">น้ำแข็ง (เรทราคา {adminSettings.icePrice32}.-)</td>
                  <td className="border-r border-black p-1.5 text-center">{printSlip.details?.iceBreakdown?.sold32} กระสอบ</td>
                  <td className="p-1.5 text-right">{((printSlip.details?.iceBreakdown?.sold32 || 0) * adminSettings.icePrice32).toLocaleString()}</td>
                </tr>
              )}

              <tr className="bg-gray-100 font-bold"><td colSpan={3} className="p-1.5 border-b border-black border-t">-- หมวดสินค้าแพ็ค --</td></tr>
              {(printSlip.details?.packBreakdown?.icePacks || 0) > 0 && (
                <tr className="border-b border-gray-300">
                  <td className="border-r border-black p-1.5 pl-4">น้ำแข็งแพ็ค</td>
                  <td className="border-r border-black p-1.5 text-center">{printSlip.details?.packBreakdown?.icePacks} แพ็ค</td>
                  <td className="p-1.5 text-right">{((printSlip.details?.packBreakdown?.icePacks || 0) * adminSettings.icePackPrice).toLocaleString()}</td>
                </tr>
              )}
              {(printSlip.details?.packBreakdown?.water1500 || 0) > 0 && (
                <tr className="border-b border-gray-300">
                  <td className="border-r border-black p-1.5 pl-4">น้ำดื่ม 1500 ml {(printSlip.details?.packBreakdown?.water1500PromoSets || 0) > 0 ? `(โปร ${printSlip.details?.packBreakdown?.water1500PromoSets} ชุด)` : ''}</td>
                  <td className="border-r border-black p-1.5 text-center">{printSlip.details?.packBreakdown?.water1500} แพ็ค</td>
                  <td className="p-1.5 text-right">{calculateWaterRevenue(printSlip.details?.packBreakdown?.water1500 || 0, adminSettings.waterPrice1500, printSlip.details?.packBreakdown?.water1500PromoSets || 0).toLocaleString()}</td>
                </tr>
              )}
              {(printSlip.details?.packBreakdown?.water600 || 0) > 0 && (
                <tr className="border-b border-gray-300">
                  <td className="border-r border-black p-1.5 pl-4">น้ำดื่ม 600 ml {(printSlip.details?.packBreakdown?.water600PromoSets || 0) > 0 ? `(โปร ${printSlip.details?.packBreakdown?.water600PromoSets} ชุด)` : ''}</td>
                  <td className="border-r border-black p-1.5 text-center">{printSlip.details?.packBreakdown?.water600} แพ็ค</td>
                  <td className="p-1.5 text-right">{calculateWaterRevenue(printSlip.details?.packBreakdown?.water600 || 0, adminSettings.waterPrice600, printSlip.details?.packBreakdown?.water600PromoSets || 0).toLocaleString()}</td>
                </tr>
              )}
              {(printSlip.details?.packBreakdown?.water350 || 0) > 0 && (
                <tr className="border-b border-gray-300">
                  <td className="border-r border-black p-1.5 pl-4">น้ำดื่ม 350 ml {(printSlip.details?.packBreakdown?.water350PromoSets || 0) > 0 ? `(โปร ${printSlip.details?.packBreakdown?.water350PromoSets} ชุด)` : ''}</td>
                  <td className="border-r border-black p-1.5 text-center">{printSlip.details?.packBreakdown?.water350} แพ็ค</td>
                  <td className="p-1.5 text-right">{calculateWaterRevenue(printSlip.details?.packBreakdown?.water350 || 0, adminSettings.waterPrice350, printSlip.details?.packBreakdown?.water350PromoSets || 0).toLocaleString()}</td>
                </tr>
              )}

              <tr className="border-t-2 border-black bg-gray-50 font-black">
                <td colSpan={2} className="border-r border-black p-2 text-right">ยอดรวมสุทธิ (Total Sales)</td>
                <td className="p-2 text-right text-sm">{(printSlip.expectedAmount || 0).toLocaleString()} บาท</td>
              </tr>
            </tbody>
          </table>

          <table className="w-full border-collapse border-2 border-black text-xs mb-4">
            <thead><tr className="bg-gray-200 border-b-2 border-black"><th className="border-r border-black py-1.5 px-3 text-left">การรับเงิน & ชำระเงิน</th><th className="py-1.5 px-3 text-right w-40">จำนวนเงิน</th></tr></thead>
            <tbody>
              <tr className="border-b border-gray-300"><td className="border-r border-black p-1.5 pl-4">โอนเข้าบริษัท</td><td className="p-1.5 text-right">{(printSlip.transferAmount || 0).toLocaleString()}</td></tr>
              <tr className="border-b border-gray-300"><td className="border-r border-black p-1.5 pl-4">จ่ายค้างหนี้เก่า / ค้างรายวัน</td><td className="p-1.5 text-right">{(printSlip.creditAmount || 0).toLocaleString()}</td></tr>
              <tr className="border-b border-gray-300"><td className="border-r border-black p-1.5 pl-4">ยอดเงินสดที่ต้องนำส่ง (Expected Cash)</td><td className="p-1.5 text-right font-bold">{printSlip.details?.cash?.expected?.toLocaleString()}</td></tr>
              <tr className="border-b-2 border-black bg-gray-50 font-black"><td className="border-r border-black p-2 text-right">ยอดเงินสดส่งจริง (Actual Cash)</td><td className="p-2 text-right text-sm">{(printSlip.cashAmount || 0).toLocaleString()}</td></tr>
              <tr><td className="border-r border-black p-2 text-right">ส่วนต่างเงินสด (Diff.)</td><td className="p-2 text-right font-bold">{printSlip.diffAmount === 0 ? 'พอดี (0)' : (printSlip.diffAmount || 0).toLocaleString()}</td></tr>
            </tbody>
          </table>

          {printSlip.details?.debtorDetails && (
            <div className="border border-black p-2 mb-4 text-xs">
              <p className="font-bold underline">รายละเอียดหนี้ค้างรายเดือน:</p>
              <p>ลูกหนี้: {printSlip.details.debtorDetails.debtorName} | เอกสาร: {printSlip.details.debtorDetails.docNo} | ยอดหนี้: {printSlip.details.debtorDetails.total} บาท</p>
            </div>
          )}

          <div className="border border-black p-2 text-center text-xs mb-10">
            <p className="font-bold">สรุปถุงเปล่า/ถุงหาย: ถุงหายที่ต้องหักเงิน: <span className="font-black text-sm">{printSlip.details?.bagTracking?.lostBagsToDeduct || 0}</span> ใบ</p>
          </div>

          <div className="grid grid-cols-2 gap-8 text-center text-xs">
            <div><div className="border-b border-black mx-10 h-8 mb-1"></div><p className="font-bold">พนักงานขับรถ / ผู้ส่งเงิน</p></div>
            <div><div className="border-b border-black mx-10 h-8 mb-1"></div><p className="font-bold">พนักงานบัญชี / ผู้รับเงิน</p></div>
          </div>
        </div>
      )}
    </>
  )
}