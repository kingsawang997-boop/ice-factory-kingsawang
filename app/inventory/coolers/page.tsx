'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

type CoolerTransaction = {
  id: string
  borrow_date: string
  customer_name: string
  cooler_type: string
  qty_borrowed: number
  qty_returned: number
  deposit_amount: number
  note?: string
  status: 'pending' | 'returned'
  recorded_by?: string
}

type CoolerStock = {
  id: string
  cooler_type: string
  total_qty: number
}

type BorrowFormData = {
  customer_name: string
  cooler_type: string
  qty_borrowed: number
  deposit_amount: number
  note: string
}

type ReturnPayload = {
  qty_returned: number
  status: 'pending' | 'returned'
  return_date?: string
}

const generateCoolerTransactionId = () => `CLR-${String(Date.now()).slice(-6)}`

export default function CoolersPage() {
  const [transactions, setTransactions] = useState<CoolerTransaction[]>([])
  const [coolerStocks, setCoolerStocks] = useState<CoolerStock[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'pending' | 'returned'>('pending')
  
  // 🌟 แก้ไข: ย้ายการดึง localStorage มาใช้ผ่าน useEffect ป้องกัน Hydration Error
  const [employeeName, setEmployeeName] = useState('กำลังโหลดชื่อ...')
  const [selectedTx, setSelectedTx] = useState<CoolerTransaction | null>(null)

  // Modal States
  const [isBorrowModalOpen, setIsBorrowModalOpen] = useState(false)
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false)
  
  // Form States
  const [formData, setFormData] = useState<BorrowFormData>({
    customer_name: '',
    cooler_type: '',
    qty_borrowed: 1,
    deposit_amount: 0,
    note: ''
  })
  const [returnQty, setReturnQty] = useState<number>(1)

  useEffect(() => {
    const session = localStorage.getItem('kingsawang_session')
    if (session) {
      setEmployeeName(JSON.parse(session).name)
    }
  }, [])

  // 🌟 แก้ไข: ครอบด้วย useCallback ตาม Best Practice ของ React
  const fetchData = useCallback(async () => {
    setIsLoading(true)
    const [txRes, stockRes] = await Promise.all([
      supabase.from('cooler_transactions').select('*').order('borrow_date', { ascending: false }),
      supabase.from('cooler_stock').select('*').order('id', { ascending: true })
    ])
    
    if (txRes.data) setTransactions(txRes.data)
    if (stockRes.data) {
      setCoolerStocks(stockRes.data)
      if (stockRes.data.length > 0) {
        setFormData(prev => ({ ...prev, cooler_type: stockRes.data[0].cooler_type }))
      }
    }
    setIsLoading(false)
  }, [])

  useEffect(() => {
    const load = async () => {
      await fetchData()
    }
    void load()
  }, [fetchData])

  // 🔄 คำนวณสรุปยอดสต๊อกถังแต่ละประเภท
  const stockSummary = coolerStocks.map(stock => {
    const borrowed = transactions
      .filter(t => t.status === 'pending' && t.cooler_type === stock.cooler_type)
      .reduce((sum, t) => sum + (t.qty_borrowed - t.qty_returned), 0)
    return {
      ...stock,
      borrowed: borrowed,
      available: stock.total_qty - borrowed
    }
  })

  // ✏️ แก้ไขจำนวนถังรวมของโรงงาน
  const handleEditTotalStock = async (id: string, currentTotal: number, typeName: string) => {
    const newQty = window.prompt(`ระบุจำนวน "รวมทั้งหมด" ของ ${typeName} ที่โรงงานมี:`, currentTotal.toString())
    if (newQty === null || newQty === '') return
    
    const qtyNumber = Number(newQty)
    if (isNaN(qtyNumber) || qtyNumber < 0) return alert('กรุณาระบุตัวเลขที่ถูกต้อง')

    const { error } = await supabase.from('cooler_stock').update({ total_qty: qtyNumber }).eq('id', id)
    if (error) alert('ข้อผิดพลาด: ' + error.message)
    else fetchData()
  }

  // ➕ ฟังก์ชันบันทึกการยืม
  const handleBorrowSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const stockInfo = stockSummary.find(s => s.cooler_type === formData.cooler_type)
    if (stockInfo && formData.qty_borrowed > stockInfo.available) {
      return alert(`❌ ไม่สามารถให้ยืมได้! ถังว่างมีเหลือแค่ ${stockInfo.available} ใบ เท่านั้น`)
    }

    const newId = generateCoolerTransactionId()
    const payload = {
      id: newId,
      customer_name: formData.customer_name,
      cooler_type: formData.cooler_type,
      qty_borrowed: Number(formData.qty_borrowed),
      deposit_amount: Number(formData.deposit_amount),
      note: formData.note,
      status: 'pending',
      recorded_by: employeeName
    }

    const { error } = await supabase.from('cooler_transactions').insert([payload])
    if (error) {
      alert('เกิดข้อผิดพลาด: ' + error.message)
    } else {
      alert('✅ บันทึกรายการยืมถังน้ำแข็งสำเร็จ!')
      setIsBorrowModalOpen(false)
      setFormData({ customer_name: '', cooler_type: coolerStocks[0]?.cooler_type || '', qty_borrowed: 1, deposit_amount: 0, note: '' })
      fetchData()
    }
  }

  // 🔄 ฟังก์ชันบันทึกการคืน
  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTx) return

    const newReturnedQty = selectedTx.qty_returned + Number(returnQty)
    if (newReturnedQty > selectedTx.qty_borrowed) return alert('จำนวนที่คืนมากกว่าจำนวนที่ค้างอยู่!')

    const newStatus: 'pending' | 'returned' = newReturnedQty === selectedTx.qty_borrowed ? 'returned' : 'pending'
    const payload: ReturnPayload = { qty_returned: newReturnedQty, status: newStatus }
    
    if (newStatus === 'returned') payload.return_date = new Date().toISOString()

    const { error } = await supabase.from('cooler_transactions').update(payload).eq('id', selectedTx.id)
    if (error) {
      alert('เกิดข้อผิดพลาด: ' + error.message)
    } else {
      alert(newStatus === 'returned' ? '✅ คืนถังครบถ้วนแล้ว!' : '✅ บันทึกการคืนบางส่วนเรียบร้อย')
      setIsReturnModalOpen(false)
      fetchData()
    }
  }

  const filteredData = transactions.filter(t => t.status === activeTab)

  return (
    <div className="p-4 md:p-8 bg-slate-50/50 min-h-screen text-slate-800 font-sans">
      
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* 🌟 Header */}
        <div className="bg-white/80 backdrop-blur-xl p-6 md:p-8 rounded-[2rem] border border-slate-200/60 shadow-sm flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 sticky top-4 z-40">
          <div>
            <h1 className="text-2xl font-black text-slate-900 flex items-center gap-3 tracking-tight">
              <div className="w-12 h-12 bg-sky-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-sky-500/30 text-2xl">🧊</div>
              ระบบยืม-คืน ถังน้ำแข็ง
            </h1>
            <p className="text-sm text-slate-500 font-medium mt-2 ml-1">ติดตามสต๊อกถังที่ลาน, ยอดค้างส่ง และประวัติการยืมของลูกค้า</p>
          </div>
          <button 
            onClick={() => {
              // ป้องกันบั๊กเปิดโมดอลแล้วไม่มีค่า Default
              if (!formData.cooler_type && coolerStocks.length > 0) {
                setFormData(prev => ({ ...prev, cooler_type: coolerStocks[0].cooler_type }))
              }
              setIsBorrowModalOpen(true)
            }} 
            className="w-full lg:w-auto bg-blue-600 hover:bg-blue-700 text-white px-8 py-3.5 rounded-2xl font-black transition-all shadow-lg shadow-blue-500/30 active:scale-[0.98] flex justify-center items-center gap-2 group"
          >
            <span className="text-xl group-hover:scale-110 transition-transform">➕</span> ทำรายการยืมถัง (นำออก)
          </button>
        </div>

        {/* 🌟 Dashboard สรุปจำนวนถังในโรงงาน */}
        <div>
          <h2 className="text-lg font-black text-slate-800 mb-4 ml-2">📦 สรุปคลังถังน้ำแข็งทั้งหมด</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-6">
            {isLoading && coolerStocks.length === 0 ? (
              [1,2,3,4].map(i => <div key={i} className="h-40 bg-white rounded-[2rem] border border-slate-100 animate-pulse"></div>)
            ) : (
              stockSummary.map(stock => (
                <div key={stock.id} className="bg-white p-6 md:p-7 rounded-[2rem] border border-slate-200/60 shadow-[0_4px_20px_rgb(0,0,0,0.03)] flex flex-col relative overflow-hidden group transition-all hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:border-blue-200">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-blue-50 to-transparent rounded-bl-full -z-10"></div>
                  
                  <div className="flex justify-between items-start mb-5 z-10">
                    <h3 className="font-black text-slate-800 text-lg tracking-tight">{stock.cooler_type}</h3>
                    <button 
                      onClick={() => handleEditTotalStock(stock.id, stock.total_qty, stock.cooler_type)}
                      className="text-slate-300 hover:text-blue-600 hover:bg-blue-50 w-8 h-8 rounded-xl flex items-center justify-center transition-all bg-white shadow-sm border border-slate-100"
                      title="แก้ไขจำนวนรวม"
                    >
                      ✏️
                    </button>
                  </div>
                  
                  <div className="space-y-3 mt-auto z-10">
                    <div className="flex justify-between items-center text-sm pb-2 border-b border-slate-50">
                      <span className="font-bold text-slate-500">มีทั้งหมด (ใบ):</span>
                      <span className="font-black text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">{stock.total_qty}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm pb-2 border-b border-slate-50">
                      <span className="font-bold text-rose-500">ถูกยืมค้างส่ง:</span>
                      <span className="font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md">{stock.borrowed}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2">
                      <span className="font-black text-emerald-600">ว่างที่ลาน:</span>
                      <span className="font-black text-emerald-500 text-2xl tracking-tighter">{stock.available}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 🌟 Tabs Switcher */}
        <div className="flex bg-white p-1.5 rounded-2xl w-full md:w-fit shadow-sm border border-slate-200/60">
          <button 
            onClick={() => setActiveTab('pending')} 
            className={`flex-1 md:flex-none px-6 py-3 rounded-xl font-bold text-sm transition-all duration-300 ${activeTab === 'pending' ? 'bg-orange-50 text-orange-600 shadow-sm border border-orange-100' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
          >
            ⏳ ค้างส่งคืน ({transactions.filter(t => t.status === 'pending').length})
          </button>
          <button 
            onClick={() => setActiveTab('returned')} 
            className={`flex-1 md:flex-none px-6 py-3 rounded-xl font-bold text-sm transition-all duration-300 ${activeTab === 'returned' ? 'bg-emerald-50 text-emerald-600 shadow-sm border border-emerald-100' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
          >
            ✅ ประวัติรับคืนแล้ว ({transactions.filter(t => t.status === 'returned').length})
          </button>
        </div>

        {/* 🌟 ตารางข้อมูล */}
        <div className="bg-white rounded-[2rem] border border-slate-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden animate-in fade-in duration-300">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50/80 border-b border-slate-100 text-slate-500 text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="p-5 font-black">วันที่ยืม / เลขที่</th>
                  <th className="p-5 font-black">ชื่อลูกค้า / ร้านค้า</th>
                  <th className="p-5 font-black text-center">ประเภทถัง</th>
                  <th className="p-5 font-black text-center">ยืม (ใบ)</th>
                  <th className="p-5 font-black text-center">คืนสะสม</th>
                  <th className="p-5 font-black text-center">ค้างส่ง</th>
                  <th className="p-5 font-black text-right">เงินมัดจำ (บ.)</th>
                  <th className="p-5 font-black text-center w-32">จัดการ</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-slate-50">
                {isLoading ? (
                  <tr><td colSpan={8} className="p-16 text-center text-slate-400 font-bold text-base">⏳ กำลังโหลดข้อมูล...</td></tr>
                ) : filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-16 text-center">
                      <div className="text-4xl mb-3 opacity-50">📋</div>
                      <p className="text-slate-500 font-bold text-base">ไม่พบรายการในหมวดหมู่นี้</p>
                    </td>
                  </tr>
                ) : (
                  filteredData.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-5">
                        <p className="font-bold text-slate-800">{new Date(tx.borrow_date).toLocaleDateString('th-TH')}</p>
                        <p className="text-[10px] text-slate-400 mt-1 font-medium">{tx.id}</p>
                      </td>
                      <td className="p-5">
                        <p className="font-black text-slate-700 text-base">{tx.customer_name}</p>
                        {tx.note && <p className="text-[10px] text-orange-500 mt-1 flex items-center gap-1"><span>↳</span> {tx.note}</p>}
                      </td>
                      <td className="p-5 text-center">
                        <span className="font-bold text-[10px] text-blue-700 bg-blue-50 border border-blue-100 px-3 py-1.5 rounded-lg whitespace-nowrap">
                          {tx.cooler_type}
                        </span>
                      </td>
                      <td className="p-5 text-center font-black text-slate-700 text-base">{tx.qty_borrowed}</td>
                      <td className="p-5 text-center font-black text-emerald-600 text-base">{tx.qty_returned > 0 ? tx.qty_returned : '-'}</td>
                      <td className="p-5 text-center font-black text-rose-500 text-base">
                        {tx.qty_borrowed - tx.qty_returned > 0 ? (tx.qty_borrowed - tx.qty_returned) : '-'}
                      </td>
                      <td className="p-5 text-right font-black text-slate-700 text-base">
                        {tx.deposit_amount > 0 ? tx.deposit_amount.toLocaleString() : '-'}
                      </td>
                      <td className="p-5 text-center">
                        {tx.status === 'pending' ? (
                          <button 
                            onClick={() => { setSelectedTx(tx); setReturnQty(tx.qty_borrowed - tx.qty_returned); setIsReturnModalOpen(true); }}
                            className="bg-white border border-emerald-200 text-emerald-600 hover:bg-emerald-500 hover:text-white hover:border-emerald-500 w-full py-2 rounded-xl font-bold text-xs transition-all shadow-sm active:scale-95"
                          >
                            รับคืนถัง
                          </button>
                        ) : (
                          <span className="text-emerald-500 text-[10px] font-bold bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100 flex flex-col items-center justify-center gap-0.5">
                            <span>✅ คืนครบแล้ว</span>
                            {tx.return_date && <span className="font-medium opacity-80">{new Date(tx.return_date).toLocaleDateString('th-TH')}</span>}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* 🚀 Modal: บันทึกการยืม */}
      {isBorrowModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
            <div className="p-6 border-b border-blue-100 flex justify-between items-center bg-blue-50/50">
              <h3 className="font-black text-xl text-blue-800 flex items-center gap-2">📤 ทำรายการให้ลูกค้ายืม</h3>
              <button onClick={() => setIsBorrowModalOpen(false)} className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-rose-500 font-bold transition-colors">✕</button>
            </div>
            
            <form onSubmit={handleBorrowSubmit} className="p-6 space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-black tracking-wider text-slate-500 uppercase">ชื่อลูกค้า / รหัสร้าน <span className="text-rose-500">*</span></label>
                <input type="text" required autoFocus value={formData.customer_name} onChange={e => setFormData({...formData, customer_name: e.target.value})} className="w-full border-2 border-slate-200 px-5 py-3.5 rounded-xl font-bold text-slate-800 bg-slate-50 hover:bg-slate-100 focus:bg-white outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all" placeholder="เช่น ร้านเจ๊สม, ตลาดสด..." />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black tracking-wider text-slate-500 uppercase">เลือกประเภทถัง <span className="text-rose-500">*</span></label>
                <div className="relative">
                  <select value={formData.cooler_type} onChange={e => setFormData({...formData, cooler_type: e.target.value})} className="w-full border-2 border-slate-200 pl-5 pr-10 py-3.5 rounded-xl font-bold text-slate-800 bg-slate-50 hover:bg-slate-100 focus:bg-white outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all appearance-none cursor-pointer">
                    {coolerStocks.map(stock => (
                      <option key={stock.id} value={stock.cooler_type}>{stock.cooler_type}</option>
                    ))}
                  </select>
                  <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">▼</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-xs font-black tracking-wider text-slate-500 uppercase">จำนวนที่ยืม (ใบ) <span className="text-rose-500">*</span></label>
                  <input type="number" min="1" required value={formData.qty_borrowed} onChange={e => setFormData({...formData, qty_borrowed: Number(e.target.value)})} className="w-full border-2 border-slate-200 px-5 py-3.5 rounded-xl font-black text-2xl text-center text-slate-800 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black tracking-wider text-slate-500 uppercase">ค่ามัดจำถังรวม (บาท)</label>
                  <input type="number" min="0" value={formData.deposit_amount} onChange={e => setFormData({...formData, deposit_amount: Number(e.target.value)})} className="w-full border-2 border-emerald-200 bg-emerald-50/50 px-5 py-3.5 rounded-xl font-black text-emerald-600 text-2xl focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 text-center outline-none transition-all" placeholder="0" />
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label className="text-xs font-black tracking-wider text-slate-500 uppercase">หมายเหตุ (ถ้ามี)</label>
                <input type="text" value={formData.note} onChange={e => setFormData({...formData, note: e.target.value})} className="w-full border-2 border-slate-200 px-5 py-3.5 rounded-xl font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 focus:bg-white outline-none focus:border-blue-500 transition-all" placeholder="เช่น ยืมชั่วคราวจัดงานบวช" />
              </div>

              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4.5 rounded-xl shadow-xl mt-4 active:scale-[0.98] shadow-blue-500/30 transition-all text-base">
                💾 ยืนยันบันทึกการยืมถัง
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 🚀 Modal: รับคืนถัง */}
      {isReturnModalOpen && selectedTx && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm overflow-hidden flex flex-col">
            <div className="p-6 border-b border-emerald-100 bg-emerald-50/50 flex justify-between items-center">
              <h3 className="font-black text-xl text-emerald-800 flex items-center gap-2">📥 รับคืนถังน้ำแข็ง</h3>
              <button onClick={() => setIsReturnModalOpen(false)} className="w-8 h-8 rounded-full bg-white text-slate-400 font-bold hover:text-rose-500 transition-colors border border-slate-200">✕</button>
            </div>
            
            <form onSubmit={handleReturnSubmit} className="p-6 space-y-6">
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 text-center space-y-2">
                <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-1">ข้อมูลผู้ยืม</p>
                <p className="font-black text-xl text-slate-900">{selectedTx.customer_name}</p>
                <div className="inline-block bg-white px-3 py-1 rounded-lg border border-slate-200 mt-1">
                  <span className="text-xs font-bold text-blue-600">{selectedTx.cooler_type}</span>
                </div>
                
                <div className="mt-3 pt-3 border-t border-slate-200 flex justify-around text-xs">
                  <div>
                    <p className="text-slate-500 font-bold">ค้างส่ง (ใบ)</p>
                    <p className="font-black text-rose-500 text-base">{selectedTx.qty_borrowed - selectedTx.qty_returned}</p>
                  </div>
                  {selectedTx.deposit_amount > 0 && (
                    <div>
                      <p className="text-slate-500 font-bold">มัดจำไว้ (บ.)</p>
                      <p className="font-black text-emerald-600 text-base">{selectedTx.deposit_amount.toLocaleString()}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3 text-center">
                <label className="text-xs font-black tracking-wider text-slate-500 uppercase">ระบุจำนวนที่ลูกค้านำมาคืนรอบนี้</label>
                <div className="flex justify-center items-center gap-5">
                  <button type="button" onClick={() => setReturnQty(Math.max(1, returnQty - 1))} className="w-14 h-14 rounded-2xl bg-slate-100 hover:bg-slate-200 font-black text-2xl text-slate-600 active:scale-95 transition-all shadow-inner">-</button>
                  <input type="number" min="1" max={selectedTx.qty_borrowed - selectedTx.qty_returned} value={returnQty} onChange={e => setReturnQty(Number(e.target.value))} className="w-28 border-2 border-slate-200 px-2 py-3 rounded-2xl font-black text-4xl text-center focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all text-slate-800" />
                  <button type="button" onClick={() => setReturnQty(Math.min(selectedTx.qty_borrowed - selectedTx.qty_returned, returnQty + 1))} className="w-14 h-14 rounded-2xl bg-slate-100 hover:bg-slate-200 font-black text-2xl text-slate-600 active:scale-95 transition-all shadow-inner">+</button>
                </div>
              </div>

              <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-4.5 rounded-xl shadow-xl mt-2 active:scale-[0.98] shadow-emerald-500/30 transition-all text-base flex justify-center items-center gap-2">
                💾 ยืนยันการรับคืน
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}