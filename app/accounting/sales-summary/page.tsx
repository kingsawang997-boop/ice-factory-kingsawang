'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function RouteSettlementPage() {
  const [activeTab, setActiveTab] = useState<'form' | 'history'>('form')

  const getTodayString = () => {
    const today = new Date()
    return new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0]
  }

  // 🌟 State เก็บข้อมูลรถจาก Database
  const [truckRoutes, setTruckRoutes] = useState<any[]>([])

  const [selectedTruck, setSelectedTruck] = useState('')
  const [reportDate, setReportDate] = useState(getTodayString())
  const [isPullingData, setIsPullingData] = useState(false)

  const [adminSettings, setAdminSettings] = useState({
    icePrice1: 45, icePrice2: 40, icePrice3: 35,
    icePackPrice: 15, waterPrice1500: 45, waterPrice600: 45, waterPrice350: 45
  })

  const [morningLoad, setMorningLoad] = useState({
    totalIceBags: 0, icePacks: 0, water1500: 0, water600: 0, water350: 0
  })

  const [iceData, setIceData] = useState({ returned: 0, melted: 0, sold45: 0, sold40: 0, sold35: 0, service: 0, customerOweBags: 0, customerReturnOldBags: 0, returnEmptyBags: 0 })
  const [packReturns, setPackReturns] = useState({ icePacks: 0, water1500: 0, water600: 0, water350: 0 })
  const [finance, setFinance] = useState({ transfer: 0, payArrears: 0, dailyArrears: 0, monthlyArrears: 0, actualCash: 0 })

  const [cashierName, setCashierName] = useState('นางสาวนภา หน้าร้าน')

  useEffect(() => {
    const session = localStorage.getItem('kingsawang_session')
    if (session) setCashierName(JSON.parse(session).name)
    fetchLivePrices()
    fetchTruckRoutes() // 🌟 ดึงข้อมูลรถตอนเปิดหน้า
  }, [])

  useEffect(() => {
    if (selectedTruck) {
      fetchTruckLoadingData()
      // รีเซ็ตยอดเมื่อเปลี่ยนคัน
      setIceData({ returned: 0, melted: 0, sold45: 0, sold40: 0, sold35: 0, service: 0, customerOweBags: 0, customerReturnOldBags: 0, returnEmptyBags: 0 })
      setPackReturns({ icePacks: 0, water1500: 0, water600: 0, water350: 0 })
      setFinance({ transfer: 0, payArrears: 0, dailyArrears: 0, monthlyArrears: 0, actualCash: 0 })
    }
  }, [selectedTruck, reportDate])

  const fetchLivePrices = async () => {
    const { data } = await supabase.from('products').select('name, price').eq('isActive', true)
    if (data) {
      let newSettings = { ...adminSettings }
      data.forEach(p => {
        if (p.name.includes('แพ็ค') && p.name.includes('น้ำแข็ง')) newSettings.icePackPrice = Number(p.price)
        else if (p.name.includes('1500')) newSettings.waterPrice1500 = Number(p.price)
        else if (p.name.includes('600')) newSettings.waterPrice600 = Number(p.price)
        else if (p.name.includes('350')) newSettings.waterPrice350 = Number(p.price)
      })
      setAdminSettings(newSettings)
    }
  }

  // 🌟 ฟังก์ชันดึงรถจากระบบจัดการ
  const fetchTruckRoutes = async () => {
    const { data } = await supabase.from('truck_routes').select('*').eq('isActive', true).order('id')
    if (data) {
      setTruckRoutes(data)
      if(data.length > 0) {
        setSelectedTruck(`${data[0].route_name} (คนขับ: ${data[0].driver_name})`)
      }
    }
  }

  const fetchTruckLoadingData = async () => {
    setIsPullingData(true)
    
    const { data } = await supabase
      .from('route_settlements')
      .select('details')
      .eq('routeName', selectedTruck)
      .eq('date', reportDate)
      .eq('status', 'pending')

    let iceBags = 0, packs = 0, w1500 = 0, w600 = 0, w350 = 0

    if (data && data.length > 0) {
      data.forEach(record => {
        const itemsList = record.details?.loadedItems || record.details?.items || []
        itemsList.forEach((item: any) => {
          const qty = Number(item.loadedQty || item.qty || 0)
          const name = item.name || ''
          if (name.includes('แพ็ค')) packs += qty
          else if (name.includes('1500')) w1500 += qty
          else if (name.includes('600')) w600 += qty
          else if (name.includes('350')) w350 += qty
          else iceBags += qty 
        })
      })
    }
    
    setMorningLoad({ totalIceBags: iceBags, icePacks: packs, water1500: w1500, water600: w600, water350: w350 })
    setIsPullingData(false)
  }

  const accountedIceBags = iceData.returned + iceData.melted + iceData.service + iceData.sold45 + iceData.sold40 + iceData.sold35
  const bagDifference = morningLoad.totalIceBags - accountedIceBags
  const iceRevenue = (iceData.sold45 * adminSettings.icePrice1) + (iceData.sold40 * adminSettings.icePrice2) + (iceData.sold35 * adminSettings.icePrice3)

  const totalSoldAndServiceBags = iceData.sold45 + iceData.sold40 + iceData.sold35 + iceData.service
  const expectedEmptyBags = totalSoldAndServiceBags - iceData.customerOweBags + iceData.customerReturnOldBags
  const lostEmptyBags = expectedEmptyBags - iceData.returnEmptyBags

  const icePackSold = Math.max(0, morningLoad.icePacks - packReturns.icePacks)
  const waterSold1500 = Math.max(0, morningLoad.water1500 - packReturns.water1500)
  const waterSold600 = Math.max(0, morningLoad.water600 - packReturns.water600)
  const waterSold350 = Math.max(0, morningLoad.water350 - packReturns.water350)
  
  const icePackRevenue = icePackSold * adminSettings.icePackPrice
  const waterRevenue = (waterSold1500 * adminSettings.waterPrice1500) + (waterSold600 * adminSettings.waterPrice600) + (waterSold350 * adminSettings.waterPrice350)
  const totalPackRevenue = icePackRevenue + waterRevenue

  const totalRevenue = iceRevenue + totalPackRevenue
  const totalDeductions = finance.transfer + finance.payArrears + finance.dailyArrears + finance.monthlyArrears
  const expectedCash = Math.max(0, totalRevenue - totalDeductions)
  const cashDifference = finance.actualCash - expectedCash

  const updateIce = (field: keyof typeof iceData, value: string) => setIceData(prev => ({ ...prev, [field]: Number(value) }))
  const updatePack = (field: keyof typeof packReturns, value: string) => setPackReturns(prev => ({ ...prev, [field]: Number(value) }))
  const updateFinance = (field: keyof typeof finance, value: string) => setFinance(prev => ({ ...prev, [field]: Number(value) }))
  const exactCash = () => updateFinance('actualCash', expectedCash.toString())

  const handleSave = async () => {
    if (bagDifference !== 0) {
      const confirmSave = window.confirm(`⚠️ ยอดน้ำแข็งเต็มไม่ตรงกับตอนเบิก (คลาดเคลื่อน ${bagDifference} กระสอบ)\nคุณต้องการบันทึกข้อมูลเพื่อตรวจสอบภายหลังใช่หรือไม่?`)
      if (!confirmSave) return
    }

    const monthlyReportData = {
      date: reportDate, truck: selectedTruck,
      revenue: { iceSales: iceRevenue, packSales: totalPackRevenue, total: totalRevenue },
      bagTracking: { soldAndService: totalSoldAndServiceBags, customerOwe: iceData.customerOweBags, customerReturnOld: iceData.customerReturnOldBags, expectedReturn: expectedEmptyBags, actualReturn: iceData.returnEmptyBags, lostBagsToDeduct: lostEmptyBags },
      cash: { expected: expectedCash, actual: finance.actualCash, diff: cashDifference }
    }

    const docNo = `SET-${Date.now().toString().slice(-6)}`
    const newSettlement = {
      id: docNo, date: reportDate, routeName: selectedTruck, expectedAmount: totalRevenue, cashAmount: finance.actualCash, transferAmount: finance.transfer, creditAmount: finance.dailyArrears + finance.monthlyArrears, expenseAmount: finance.payArrears, diffAmount: cashDifference, note: `ถุงหาย: ${lostEmptyBags > 0 ? lostEmptyBags : 0} ใบ`, details: monthlyReportData, by: cashierName,
      status: 'received' 
    }

    await supabase.from('route_settlements').update({ status: 'cleared_by_summary' }).eq('routeName', selectedTruck).eq('date', reportDate).eq('status', 'pending')

    const { error } = await supabase.from('route_settlements').insert([newSettlement])
    if (error) alert('เกิดข้อผิดพลาดในการบันทึก: ' + error.message)
    else {
      alert(`✅ ปิดยอดสำเร็จ!\nเลขที่บิล: ${docNo}\nเงินสดรับเข้า: ${finance.actualCash.toLocaleString()} บาท\nถุงหาย(รอหักเงิน): ${lostEmptyBags > 0 ? lostEmptyBags : 0} ใบ`)
      window.location.reload()
    }
  }

  // ==========================================
  // 🎯 TAB 2: ประวัติย้อนหลัง & การพิมพ์
  // ==========================================
  const [historyDate, setHistoryDate] = useState(getTodayString())
  const [historyRecords, setHistoryRecords] = useState<any[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [printSlip, setPrintSlip] = useState<any>(null)

  useEffect(() => {
    if (activeTab === 'history') fetchHistory()
  }, [activeTab, historyDate])

  const fetchHistory = async () => {
    setIsLoadingHistory(true)
    const { data, error } = await supabase.from('route_settlements').select('*').eq('date', historyDate).eq('status', 'received').order('createdAt', { ascending: false })
    if (!error && data) setHistoryRecords(data)
    setIsLoadingHistory(false)
  }

  const handlePrint = (record: any) => {
    setPrintSlip(record)
    setTimeout(() => { window.print(); setTimeout(() => setPrintSlip(null), 500) }, 300)
  }

  const handleDelete = async (id: string) => {
    if(confirm(`⚠️ ต้องการลบบิล ${id} ออกจากระบบถาวรหรือไม่?`)) {
      await supabase.from('route_settlements').delete().eq('id', id)
      fetchHistory()
    }
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `@media print { @page { size: A4 portrait; margin: 15mm; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: white; } }`}} />

      <div className={`space-y-6 p-4 md:p-6 bg-slate-50/50 min-h-screen text-xs ${printSlip ? 'hidden' : 'block print:hidden'}`}>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-2">
            <h1 className="text-xl md:text-2xl font-black text-slate-900 flex items-center gap-3 tracking-tight"><span className="text-2xl">📝</span> บันทึกสรุปยอดสายส่ง (Sales Summary)</h1>
            <p className="text-sm text-slate-500 font-medium">ระบบปิดยอดประจำวัน <span className="text-emerald-500 font-bold">(🟢 เชื่อมต่อยอดเบิกสินค้าอัตโนมัติ)</span></p>
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
                    {/* 🌟 ดึงข้อมูลที่ผูกไว้มาแสดง */}
                    {truckRoutes.map(r => {
                      const routeNameFull = `${r.route_name} (คนขับ: ${r.driver_name})`
                      return <option key={r.id} value={routeNameFull}>{r.route_name} - คนขับ: {r.driver_name}</option>
                    })}
                  </select>
                  <div className="bg-sky-50 px-4 py-3 rounded-xl border border-sky-100 flex justify-between items-center"><span className="font-bold text-sky-800">ยอดเบิกกระสอบรวม:</span><span className="text-2xl font-black text-blue-600">{morningLoad.totalIceBags} <span className="text-sm">ใบ</span></span></div>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4 flex flex-col h-full relative">
                  {isPullingData && <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10"></div>}
                  <div className="border-b-2 border-slate-100 pb-2 flex justify-between items-end mb-2"><h2 className="text-base font-black text-slate-900 flex items-center gap-2"><span className="text-blue-500">🧊</span> กระทบยอดกระสอบ</h2><span className={`px-2.5 py-1 rounded-lg text-[10px] font-black tracking-wider border ${bagDifference === 0 ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-amber-50 text-amber-600 border-amber-200 animate-pulse'}`}>{bagDifference === 0 ? '✓ กระสอบครบ' : bagDifference > 0 ? `⚠️ หาย ${bagDifference} ใบ` : `❓ เกิน ${Math.abs(bagDifference)} ใบ`}</span></div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3"><label className="w-1/2 font-bold text-slate-600">กระสอบส่งคืนคลัง</label><input type="number" value={iceData.returned || ''} onChange={e => updateIce('returned', e.target.value)} className="w-1/2 p-2.5 rounded-xl border border-slate-200 text-center font-bold focus:border-blue-500 outline-none" placeholder="0" /></div>
                    <div className="flex items-center gap-3"><label className="w-1/2 font-bold text-rose-500">ละลาย / แตก / สูญเสีย</label><input type="number" value={iceData.melted || ''} onChange={e => updateIce('melted', e.target.value)} className="w-1/2 p-2.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-center font-bold outline-none" placeholder="0" /></div>
                    <div className="pt-3 space-y-3">
                      <div className="flex items-center gap-3"><label className="w-1/2 font-bold text-emerald-600">ขายได้ (ราคา {adminSettings.icePrice1}.-)</label><input type="number" value={iceData.sold45 || ''} onChange={e => updateIce('sold45', e.target.value)} className="w-1/2 p-2.5 rounded-xl border border-emerald-200 text-center font-bold text-emerald-700 focus:border-emerald-500 outline-none" placeholder="0" /></div>
                      <div className="flex items-center gap-3"><label className="w-1/2 font-bold text-emerald-600">ขายได้ (ราคา {adminSettings.icePrice2}.-)</label><input type="number" value={iceData.sold40 || ''} onChange={e => updateIce('sold40', e.target.value)} className="w-1/2 p-2.5 rounded-xl border border-emerald-200 text-center font-bold text-emerald-700 focus:border-emerald-500 outline-none" placeholder="0" /></div>
                      <div className="flex items-center gap-3"><label className="w-1/2 font-bold text-emerald-600">ขายได้ (ราคา {adminSettings.icePrice3}.-)</label><input type="number" value={iceData.sold35 || ''} onChange={e => updateIce('sold35', e.target.value)} className="w-1/2 p-2.5 rounded-xl border border-emerald-200 text-center font-bold text-emerald-700 focus:border-emerald-500 outline-none" placeholder="0" /></div>
                    </div>
                    <div className="flex items-center gap-3 pt-3"><label className="w-1/2 font-bold text-slate-600">บริการ (ถุง)</label><input type="number" value={iceData.service || ''} onChange={e => updateIce('service', e.target.value)} className="w-1/2 p-2.5 rounded-xl border border-slate-200 text-center font-bold focus:border-blue-500 outline-none" placeholder="0" /></div>
                  </div>
                  <div className="pt-4 mt-4 border-t-2 border-dashed border-slate-200">
                    <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100 space-y-3">
                      <h3 className="font-black text-orange-800 text-sm flex justify-between items-center mb-1"><span>📦 จัดการถุงเปล่า (คุมถุงหาย)</span><span className="text-[9px] bg-orange-200 text-orange-800 px-2 py-0.5 rounded-md">ขาย+แจก: {totalSoldAndServiceBags} ใบ</span></h3>
                      <div className="flex items-center gap-3"><label className="w-1/2 font-bold text-slate-600 text-[10px]">ลูกค้าค้างถุงวันนี้ (ใบ)</label><input type="number" value={iceData.customerOweBags || ''} onChange={e => updateIce('customerOweBags', e.target.value)} className="w-1/2 p-2 rounded-xl border border-orange-200 text-center font-bold text-orange-900 focus:outline-none" placeholder="0" /></div>
                      <div className="flex items-center gap-3"><label className="w-1/2 font-bold text-slate-600 text-[10px]">ลูกค้าคืนถุงเก่า (ใบ)</label><input type="number" value={iceData.customerReturnOldBags || ''} onChange={e => updateIce('customerReturnOldBags', e.target.value)} className="w-1/2 p-2 rounded-xl border border-orange-200 text-center font-bold text-orange-900 focus:outline-none" placeholder="0" /></div>
                      <div className="flex justify-between items-center py-2 border-y border-orange-200/50"><span className="font-bold text-orange-800 text-[11px]">ถุงเปล่าที่ต้องคืนโรงงาน:</span><span className="font-black text-orange-900">{expectedEmptyBags} ใบ</span></div>
                      <div className="flex items-center gap-3"><label className="w-1/2 font-black text-slate-700">พนักงานนำมาคืนจริง</label><input type="number" value={iceData.returnEmptyBags || ''} onChange={e => updateIce('returnEmptyBags', e.target.value)} className="w-1/2 p-2.5 rounded-xl border-2 border-orange-300 text-center font-black text-orange-900 focus:outline-none focus:border-orange-500 shadow-sm" placeholder="0" /></div>
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
                      { label: '🧊 น้ำแข็งแพ็ค', field: 'icePacks', load: morningLoad.icePacks, sold: icePackSold, price: adminSettings.icePackPrice }, 
                      { label: '💧 น้ำดื่ม 1500 ml', field: 'water1500', load: morningLoad.water1500, sold: waterSold1500, price: adminSettings.waterPrice1500 }, 
                      { label: '💧 น้ำดื่ม 600 ml', field: 'water600', load: morningLoad.water600, sold: waterSold600, price: adminSettings.waterPrice600 }, 
                      { label: '💧 น้ำดื่ม 350 ml', field: 'water350', load: morningLoad.water350, sold: waterSold350, price: adminSettings.waterPrice350 }
                    ].map((item, idx) => (
                      <div key={idx} className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <div className="flex justify-between items-center mb-3"><span className="font-bold text-slate-800">{item.label}</span><span className="text-[10px] font-bold text-slate-400 bg-white px-2 py-1 rounded shadow-sm border border-slate-100">เบิกรวมวันนี้: <span className="text-blue-600">{item.load}</span></span></div>
                        <div className="flex items-center gap-3"><span className="text-[10px] text-slate-500 whitespace-nowrap">นำมาคืน:</span><input type="number" value={packReturns[item.field as keyof typeof packReturns] || ''} onChange={e => updatePack(item.field as keyof typeof packReturns, e.target.value)} className="w-full p-2 rounded-xl border border-slate-200 text-center font-bold outline-none focus:border-blue-500" placeholder="0" /><div className="flex flex-col items-end bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-100"><span className="text-[10px] text-emerald-600 font-bold whitespace-nowrap">ขาย: {item.sold}</span><span className="text-[9px] text-emerald-500 font-medium">={(item.sold * item.price).toLocaleString()} บ.</span></div></div>
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
                      <div className="flex items-center gap-3"><label className="w-32 text-[10px] text-slate-400 font-bold">หัก จ่ายค้าง (บ.)</label><input type="number" value={finance.payArrears || ''} onChange={e => updateFinance('payArrears', e.target.value)} className="flex-1 p-2 rounded-xl bg-slate-800 border border-slate-600 focus:border-blue-500 outline-none text-white font-bold text-right" placeholder="0" /></div>
                      <div className="flex items-center gap-3"><label className="w-32 text-[10px] text-slate-400 font-bold">หัก ค้างรายวัน (บ.)</label><input type="number" value={finance.dailyArrears || ''} onChange={e => updateFinance('dailyArrears', e.target.value)} className="flex-1 p-2 rounded-xl bg-slate-800 border border-slate-600 focus:border-blue-500 outline-none text-white font-bold text-right" placeholder="0" /></div>
                      <div className="flex items-center gap-3"><label className="w-32 text-[10px] text-slate-400 font-bold">หัก ค้างรายเดือน (บ.)</label><input type="number" value={finance.monthlyArrears || ''} onChange={e => updateFinance('monthlyArrears', e.target.value)} className="flex-1 p-2 rounded-xl bg-slate-800 border border-slate-600 focus:border-blue-500 outline-none text-white font-bold text-right" placeholder="0" /></div>
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

        {/* TAB 2: ประวัติ */}
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
                        <td className="p-4"><p className="font-bold text-slate-800">{new Date(record.createdAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.</p><p className="text-[10px] text-slate-400 mt-1">{record.id}</p></td>
                        <td className="p-4 font-black text-blue-700">{record.routeName}</td>
                        <td className="p-4 text-right font-bold text-slate-700">{Number(record.expectedAmount).toLocaleString()} บ.</td>
                        <td className="p-4 text-center">{record.details?.bagTracking?.lostBagsToDeduct > 0 ? <span className="text-rose-600 font-black bg-rose-50 px-2 py-1 rounded">{record.details.bagTracking.lostBagsToDeduct}</span> : <span className="text-emerald-500 font-bold">-</span>}</td>
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

      {printSlip && (
        <div className="hidden print:block text-black font-sans bg-white p-10 max-w-4xl mx-auto min-h-screen">
          <div className="text-center mb-8 pb-6 border-b-4 border-black"><h1 className="text-3xl font-black mb-2">ใบสรุปยอดสายส่งประจำวัน (Route Settlement)</h1><p className="font-bold text-lg">คิงส์สว่าง โรงงานน้ำแข็งและน้ำดื่ม</p></div>
          <div className="grid grid-cols-2 gap-4 mb-8 text-base"><div><p><span className="font-bold">วันที่:</span> {printSlip.date}</p><p><span className="font-bold">สายส่ง:</span> {printSlip.routeName}</p></div><div className="text-right"><p><span className="font-bold">เลขที่เอกสาร:</span> {printSlip.id}</p><p><span className="font-bold">พิมพ์เมื่อ:</span> {new Date().toLocaleString('th-TH')}</p></div></div>
          <table className="w-full border-collapse border-2 border-black text-sm mb-6">
            <thead><tr className="bg-gray-200 border-b-2 border-black"><th className="border-r border-black py-2 px-3 text-left">รายการ (Description)</th><th className="py-2 px-3 text-right w-40">จำนวนเงิน (Amount)</th></tr></thead>
            <tbody>
              <tr className="bg-gray-100"><td colSpan={2} className="p-2 font-bold border-b border-black text-center">-- หมวดรายรับจากการขาย --</td></tr>
              <tr className="border-b border-gray-300"><td className="border-r border-black p-2 pl-6">ยอดขายกระสอบ/น้ำแข็ง</td><td className="p-2 text-right">{printSlip.details?.revenue?.iceSales?.toLocaleString() || '-'}</td></tr>
              <tr className="border-b border-gray-300"><td className="border-r border-black p-2 pl-6">ยอดขายสินค้าแพ็ค</td><td className="p-2 text-right">{printSlip.details?.revenue?.packSales?.toLocaleString() || '-'}</td></tr>
              <tr className="border-b-2 border-black"><td className="border-r border-black p-3 font-black text-right">ยอดรวมสุทธิ (Total Sales)</td><td className="p-3 text-right font-black text-lg">{printSlip.expectedAmount.toLocaleString()}</td></tr>
              <tr className="bg-gray-100"><td colSpan={2} className="p-2 font-bold border-b border-black text-center">-- หมวดหักชำระ / ค้างชำระ --</td></tr>
              <tr className="border-b border-gray-300"><td className="border-r border-black p-2 pl-6">หัก ยอดลูกค้าโอนเข้าบริษัท</td><td className="p-2 text-right">{printSlip.transferAmount.toLocaleString()}</td></tr>
              <tr className="border-b border-gray-300"><td className="border-r border-black p-2 pl-6">หัก จ่ายค้าง/ค้างรายวัน/ค้างเดือน</td><td className="p-2 text-right">{printSlip.creditAmount.toLocaleString()}</td></tr>
              <tr className="border-b-2 border-black"><td className="border-r border-black p-3 font-black text-right text-emerald-600">ยอดเงินสดที่ต้องนำส่ง (Expected Cash)</td><td className="p-3 text-right font-black text-lg text-emerald-600">{printSlip.details?.cash?.expected?.toLocaleString() || '-'}</td></tr>
              <tr className="border-b-2 border-black bg-gray-50"><td className="border-r border-black p-4 font-black text-lg text-right">ยอดเงินสดส่งจริง (Actual Cash)</td><td className="p-4 text-right font-black text-2xl underline">{printSlip.cashAmount.toLocaleString()}</td></tr>
              <tr><td className="border-r border-black p-4 font-black text-right">ส่วนต่างเงินสด (Cash Diff.)</td><td className={`p-4 text-right font-black text-xl ${printSlip.diffAmount === 0 ? '' : 'text-rose-600'}`}>{printSlip.diffAmount === 0 ? 'พอดี (0)' : `${printSlip.diffAmount > 0 ? '+' : ''}${printSlip.diffAmount.toLocaleString()}`}</td></tr>
            </tbody>
          </table>
          <div className="border-2 border-black p-4 text-center mt-6"><p className="font-bold text-lg mb-2 underline">สรุปประเมินถุงเปล่า/ถุงหาย (Bag Tracking)</p><p className="text-base">จำนวนถุงหายที่ต้องหักเงิน: <span className="font-black text-2xl ml-2">{printSlip.details?.bagTracking?.lostBagsToDeduct || 0}</span> ใบ</p></div>
          <div className="grid grid-cols-2 gap-8 text-center mt-24 text-sm"><div><div className="border-b border-black mx-12 h-10 mb-2"></div><p className="font-bold">พนักงานขับรถ / ผู้ส่งเงิน</p></div><div><div className="border-b border-black mx-12 h-10 mb-2"></div><p className="font-bold">พนักงานบัญชี / ผู้รับเงิน</p></div></div>
        </div>
      )}
    </>
  )
}