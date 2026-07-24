'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const createPurchaseOrderId = () => `PO-${Date.now().toString().slice(-6)}`

export default function PurchaseOrderPage() {
  const getTodayString = () => {
    const today = new Date()
    return new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0]
  }

  const [activeTab, setActiveTab] = useState<'create' | 'history'>('create')
  type Supplier = {
    id: string
    name: string
    address?: string
    phone?: string
    taxId?: string
  }

  type PurchaseOrderItem = {
    name: string
    qty: number
    unit: string
    price: number
    total: number
  }

  type PurchaseOrder = {
    id: string
    date: string
    supplierName: string
    totalAmount: number
    status: string
    items: PurchaseOrderItem[]
    note: string
    by: string
  }

  type PurchaseSlip = PurchaseOrder & {
    supplierDetails: {
      address: string
      phone: string
      taxId: string
    } | null
  }

  const [poList, setPoList] = useState<PurchaseOrder[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [employeeName, setEmployeeName] = useState('ฝ่ายจัดซื้อ')

  const [dbSuppliers, setDbSuppliers] = useState<Supplier[]>([])

  const [poDate, setPoDate] = useState(getTodayString())
  const [selectedSupplier, setSelectedSupplier] = useState('')
  const [customSupplier, setCustomSupplier] = useState('')
  const [poNote, setPoNote] = useState('')
  
  const [poItems, setPoItems] = useState<{name: string, qty: number, unit: string, price: number, total: number}[]>([])
  const [currentItem, setCurrentItem] = useState({ name: '', qty: 1, unit: 'ชิ้น', price: 0 })

  const [printSlip, setPrintSlip] = useState<PurchaseSlip | null>(null)

  const fetchSuppliers = async () => {
    const { data, error } = await supabase.from('suppliers').select('*').order('name', { ascending: true })
    if (!error && data) {
      setDbSuppliers(data)
      if (data.length > 0) setSelectedSupplier(data[0].name)
      else setSelectedSupplier('อื่นๆ (ระบุเอง)')
    }
  }

  const fetchPOs = async () => {
    setIsLoading(true)
    const { data, error } = await supabase.from('purchase_orders').select('*').order('createdAt', { ascending: false }).limit(100)
    if (!error && data) setPoList(data)
    setIsLoading(false)
  }

  useEffect(() => {
    const sessionTimer = window.setTimeout(() => {
      const session = localStorage.getItem('kingsawang_session')
      if (session) setEmployeeName(JSON.parse(session).name)
      fetchSuppliers()
    }, 0)

    return () => window.clearTimeout(sessionTimer)
  }, [])

  useEffect(() => {
    const loadHistory = async () => {
      if (activeTab === 'history') await fetchPOs()
    }

    loadHistory()
  }, [activeTab])

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentItem.name) return alert('กรุณาระบุชื่อสินค้า')
    if (currentItem.qty <= 0) return alert('จำนวนต้องมากกว่า 0')

    const total = currentItem.qty * currentItem.price
    setPoItems([...poItems, { ...currentItem, total }])
    setCurrentItem({ name: '', qty: 1, unit: 'ชิ้น', price: 0 })
  }

  const removePoItem = (index: number) => {
    setPoItems(poItems.filter((_, i) => i !== index))
  }

  const poGrandTotal = poItems.reduce((sum, item) => sum + item.total, 0)

  const handleSavePO = async () => {
    if (poItems.length === 0) return alert('กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ')
    
    const supplierName = selectedSupplier === 'อื่นๆ (ระบุเอง)' ? customSupplier : selectedSupplier
    if (!supplierName) return alert('กรุณาระบุชื่อผู้จำหน่าย (Supplier)')

    const matchedSupplier = dbSuppliers.find(s => s.name === supplierName)
    const poNo = createPurchaseOrderId()

    const dbPayload = {
      id: poNo,
      date: poDate,
      supplierName: supplierName,
      totalAmount: poGrandTotal,
      status: 'pending', 
      items: poItems,
      note: poNote,
      by: employeeName
    }

    const { error } = await supabase.from('purchase_orders').insert([dbPayload])

    if (error) {
      alert('เกิดข้อผิดพลาด: ' + error.message)
    } else {
      alert('✅ สร้างใบสั่งซื้อเรียบร้อยแล้ว!')
      
      setPrintSlip({
        ...dbPayload,
        supplierDetails: matchedSupplier ? { 
          address: matchedSupplier.address || '-', 
          phone: matchedSupplier.phone || '-',
          taxId: matchedSupplier.taxId || '-' 
        } : null
      })
      
      setPoItems([])
      setPoNote('')
      setCustomSupplier('')
      
      setTimeout(() => { window.print(); setTimeout(() => setPrintSlip(null), 500) }, 300)
    }
  }

  // 🌟 จุดเปลี่ยน: แค่อัปเดตสถานะก็พอ ไม่ต้องไปยุ่งกับรายจ่ายรายวัน
  const handleUpdateStatus = async (po: PurchaseOrder, newStatus: string) => {
    if (!confirm(`ต้องการเปลี่ยนสถานะเป็น "${newStatus === 'received' ? 'รับของแล้ว' : 'ยกเลิก'}" ใช่หรือไม่?`)) return
    
    await supabase.from('purchase_orders').update({ status: newStatus }).eq('id', po.id)
    
    if (newStatus === 'received') {
      alert('✅ รับของเรียบร้อย! (ยอดสั่งซื้อนี้จะวิ่งตรงไปรวมใน "สรุปงบประจำเดือน" โดยอัตโนมัติ)')
    }
    fetchPOs()
  }

  const handlePrintPO = (po: PurchaseOrder) => {
    const matchedSupplier = dbSuppliers.find(s => s.name === po.supplierName)
    setPrintSlip({
      ...po,
      supplierDetails: matchedSupplier ? { 
        address: matchedSupplier.address || '-', 
        phone: matchedSupplier.phone || '-',
        taxId: matchedSupplier.taxId || '-' 
      } : null
    })
    setTimeout(() => { window.print(); setTimeout(() => setPrintSlip(null), 500) }, 300)
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        @media print { 
          @page { size: A4 portrait; margin: 15mm; } 
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: white; margin: 0; } 
        }
      `}} />

      <div className={`space-y-4 md:space-y-6 p-3 md:p-6 bg-slate-50/50 min-h-screen text-xs ${printSlip ? 'hidden' : 'block print:hidden'}`}>
        
        <div className="bg-white p-5 md:p-8 rounded-2xl md:rounded-3xl border border-slate-100 shadow-sm flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div className="space-y-2">
            <h1 className="text-xl md:text-2xl font-black text-slate-900 flex items-center gap-3"><span className="text-2xl">📦</span> ระบบจัดซื้อสินค้า (Purchase Order)</h1>
            <p className="text-sm text-slate-500 font-medium">ออกใบสั่งซื้อ สั่งน้ำมัน/อะไหล่ และติดตามการรับสินค้า</p>
          </div>
          <div className="flex bg-slate-100 p-1.5 rounded-xl w-full lg:w-auto">
            <button onClick={() => setActiveTab('create')} className={`flex-1 md:flex-none px-6 py-2.5 rounded-lg font-bold text-sm transition-all ${activeTab === 'create' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>📝 สร้างใบสั่งซื้อ (PO)</button>
            <button onClick={() => setActiveTab('history')} className={`flex-1 md:flex-none px-6 py-2.5 rounded-lg font-bold text-sm transition-all ${activeTab === 'history' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>🗂️ ประวัติการสั่งซื้อ</button>
          </div>
        </div>

        {activeTab === 'create' && (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            <div className="xl:col-span-4 space-y-6">
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                <div className="border-b-2 border-slate-100 pb-3"><h2 className="font-black text-slate-800 text-base">🏢 ข้อมูลผู้จำหน่าย (Supplier)</h2></div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500">วันที่สั่งซื้อ</label>
                  <input type="date" value={poDate} onChange={e => setPoDate(e.target.value)} className="w-full border-2 border-slate-200 px-4 py-3 rounded-xl font-bold focus:border-blue-500 outline-none" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500">เลือกร้านค้า / ผู้จำหน่าย <span className="text-rose-500">*</span></label>
                  <select value={selectedSupplier} onChange={e => setSelectedSupplier(e.target.value)} className="w-full border-2 border-slate-200 px-4 py-3 rounded-xl font-bold bg-slate-50 text-blue-700 focus:border-blue-500 outline-none">
                    {dbSuppliers.map((sup) => <option key={sup.id} value={sup.name}>{sup.name}</option>)}
                    <option value="อื่นๆ (ระบุเอง)">+ อื่นๆ (ระบุชื่อเอง)</option>
                  </select>
                </div>
                {selectedSupplier === 'อื่นๆ (ระบุเอง)' && (
                  <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2">
                    <input type="text" placeholder="พิมพ์ชื่อร้านค้า..." value={customSupplier} onChange={e => setCustomSupplier(e.target.value)} className="w-full border-2 border-blue-200 px-4 py-3 rounded-xl font-bold bg-blue-50 focus:border-blue-500 outline-none" />
                  </div>
                )}
                <div className="space-y-1.5 pt-2">
                  <label className="text-xs font-bold text-slate-500">หมายเหตุ / อ้างอิง</label>
                  <input type="text" placeholder="เช่น ขอใบกำกับภาษีเต็มรูป" value={poNote} onChange={e => setPoNote(e.target.value)} className="w-full border border-slate-200 px-4 py-2.5 rounded-xl font-medium focus:border-blue-500 outline-none bg-slate-50" />
                </div>
              </div>

              <div className="bg-gradient-to-b from-slate-900 to-slate-800 p-6 rounded-3xl shadow-lg border border-slate-700 text-white">
                <div className="border-b border-slate-700 pb-3 mb-4"><h2 className="font-black text-white text-base">🛒 เพิ่มรายการสินค้า</h2></div>
                <form onSubmit={handleAddItem} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400">ชื่อสินค้า / รายการ <span className="text-rose-400">*</span></label>
                    <input type="text" required placeholder="เช่น น้ำมันดีเซล B7, ฟิล์มหด" value={currentItem.name} onChange={e => setCurrentItem({...currentItem, name: e.target.value})} className="w-full border border-slate-600 bg-slate-800 px-4 py-3 rounded-xl font-bold text-white focus:border-blue-500 outline-none" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400">จำนวน <span className="text-rose-400">*</span></label>
                      <input type="number" min="0.01" step="0.01" required value={currentItem.qty || ''} onChange={e => setCurrentItem({...currentItem, qty: Number(e.target.value)})} className="w-full border border-slate-600 bg-slate-800 px-4 py-3 rounded-xl font-black text-center text-white focus:border-blue-500 outline-none" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400">หน่วยนับ</label>
                      <input type="text" value={currentItem.unit} onChange={e => setCurrentItem({...currentItem, unit: e.target.value})} className="w-full border border-slate-600 bg-slate-800 px-4 py-3 rounded-xl font-bold text-center text-white focus:border-blue-500 outline-none" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400">ราคาต่อหน่วย (บาท)</label>
                    <input type="number" min="0" step="0.01" value={currentItem.price || ''} onChange={e => setCurrentItem({...currentItem, price: Number(e.target.value)})} className="w-full border border-slate-600 bg-slate-800 px-4 py-3 rounded-xl font-black text-right text-emerald-400 focus:border-emerald-500 outline-none" placeholder="0.00" />
                  </div>
                  <div className="pt-2">
                    <div className="flex justify-between items-center mb-3 px-2">
                      <span className="text-xs text-slate-400 font-bold">รวมรายการนี้:</span>
                      <span className="text-lg font-black text-emerald-400">{(currentItem.qty * currentItem.price).toLocaleString()} บ.</span>
                    </div>
                    <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-3 rounded-xl shadow-lg transition-transform active:scale-95 text-sm">
                      ➕ เพิ่มลงในใบสั่งซื้อ
                    </button>
                  </div>
                </form>
              </div>
            </div>

            <div className="xl:col-span-8 bg-white p-6 md:p-8 rounded-3xl border border-slate-100 shadow-sm flex flex-col h-full min-h-[500px]">
              <div className="border-b-2 border-slate-100 pb-3 mb-4 flex justify-between items-end">
                <h2 className="font-black text-slate-800 text-lg">📄 รายการในใบสั่งซื้อ (Draft PO)</h2>
                <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-lg font-bold text-xs border border-amber-200">สถานะ: ร่าง (Draft)</span>
              </div>
              <div className="flex-1 overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[11px]">
                    <tr><th className="p-3 font-bold w-12 text-center">ลำดับ</th><th className="p-3 font-bold">รายการสินค้า</th><th className="p-3 font-bold text-center w-24">จำนวน</th><th className="p-3 font-bold text-right w-28">ราคา/หน่วย</th><th className="p-3 font-bold text-right w-32">จำนวนเงิน</th><th className="p-3 font-bold text-center w-12">ลบ</th></tr>
                  </thead>
                  <tbody className="text-sm divide-y divide-slate-100">
                    {poItems.length === 0 ? (
                      <tr><td colSpan={6} className="py-20 text-center text-slate-400 font-bold border-dashed border-2 border-slate-100 rounded-xl">ยังไม่มีรายการสินค้า<br/><span className="text-[10px] font-normal">เพิ่มรายการจากช่องด้านซ้ายมือ</span></td></tr>
                    ) : (
                      poItems.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3 text-center text-slate-400 font-bold">{idx + 1}</td>
                          <td className="p-3 font-bold text-slate-800">{item.name}</td>
                          <td className="p-3 text-center font-black text-blue-600 bg-blue-50/50 rounded-lg">{item.qty} <span className="text-[10px] text-slate-500 font-medium">{item.unit}</span></td>
                          <td className="p-3 text-right">{item.price.toLocaleString()}</td>
                          <td className="p-3 text-right font-black text-emerald-600">{item.total.toLocaleString()}</td>
                          <td className="p-3 text-center"><button onClick={() => removePoItem(idx)} className="w-7 h-7 rounded-full bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white transition-colors font-bold flex items-center justify-center">✕</button></td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="mt-6 pt-6 border-t-2 border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-50 p-6 rounded-2xl">
                <div className="text-center sm:text-left">
                  <p className="text-slate-500 font-bold text-sm mb-1">ยอดรวมทั้งสิ้น (Grand Total)</p>
                  <p className="text-4xl font-black text-slate-900">{poGrandTotal.toLocaleString()} <span className="text-lg text-slate-500">บาท</span></p>
                </div>
                <button onClick={handleSavePO} disabled={poItems.length === 0} className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-black px-10 py-4 rounded-xl shadow-lg transition-transform active:scale-95 text-base flex items-center justify-center gap-2">
                  🖨️ บันทึก & พิมพ์ใบสั่งซื้อ
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <h2 className="font-black text-slate-800 text-base">🗂️ ประวัติใบสั่งซื้อทั้งหมด</h2>
              <button onClick={fetchPOs} className="text-blue-600 font-bold text-[10px] bg-blue-100 px-3 py-1.5 rounded-lg">🔄 รีเฟรช</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-white border-b border-slate-200 text-slate-500 text-[11px] whitespace-nowrap">
                  <tr>
                    <th className="p-4 font-bold">วันที่ / เลขที่ PO</th>
                    <th className="p-4 font-bold">ผู้จำหน่าย (Supplier)</th>
                    <th className="p-4 font-bold text-center">สถานะ</th>
                    <th className="p-4 font-bold text-right">ยอดรวม (บาท)</th>
                    <th className="p-4 font-bold text-center">จัดการ</th>
                    <th className="p-4 font-bold text-center w-24">พิมพ์</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {isLoading ? (<tr><td colSpan={6} className="p-10 text-center text-slate-400 font-bold">⏳ โหลดข้อมูล...</td></tr>) : poList.length === 0 ? (<tr><td colSpan={6} className="p-10 text-center text-slate-400 font-bold">ยังไม่มีประวัติการสั่งซื้อ</td></tr>) : (
                    poList.map(po => (
                      <tr key={po.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                        <td className="p-4">
                          <p className="font-bold text-slate-800">{new Date(po.date).toLocaleDateString('th-TH')}</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">{po.id}</p>
                        </td>
                        <td className="p-4">
                          <p className="font-black text-slate-700">{po.supplierName}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[200px]">{po.note}</p>
                        </td>
                        <td className="p-4 text-center">
                          {po.status === 'pending' && <span className="bg-amber-50 text-amber-600 border border-amber-200 px-3 py-1 rounded-full font-bold text-[10px]">⏳ รอรับของ</span>}
                          {po.status === 'received' && <span className="bg-emerald-50 text-emerald-600 border border-emerald-200 px-3 py-1 rounded-full font-bold text-[10px]">✅ รับของแล้ว</span>}
                          {po.status === 'cancelled' && <span className="bg-rose-50 text-rose-600 border border-rose-200 px-3 py-1 rounded-full font-bold text-[10px]">❌ ยกเลิก</span>}
                        </td>
                        <td className="p-4 text-right font-black text-slate-800 text-base">{Number(po.totalAmount).toLocaleString()}</td>
                        <td className="p-4 text-center">
                          {po.status === 'pending' ? (
                            <div className="flex gap-2 justify-center flex-col sm:flex-row">
                              <button onClick={() => handleUpdateStatus(po, 'received')} className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-lg font-bold text-[10px] transition-colors shadow-sm">รับของแล้ว</button>
                              <button onClick={() => handleUpdateStatus(po, 'cancelled')} className="bg-slate-200 hover:bg-rose-500 hover:text-white text-slate-600 px-3 py-1.5 rounded-lg font-bold text-[10px] transition-colors">ยกเลิก</button>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-[10px] text-slate-300 font-bold">- ปิดบิลแล้ว -</span>
                            </div>
                          )}
                        </td>
                        <td className="p-4 text-center">
                          <button onClick={() => handlePrintPO(po)} className="bg-slate-100 hover:bg-blue-100 text-slate-600 hover:text-blue-600 px-4 py-2 rounded-xl font-bold transition-colors text-xs border border-slate-200 shadow-sm">
                            🖨️
                          </button>
                        </td>
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
        <div className="hidden print:block text-black p-4 md:p-10 max-w-4xl mx-auto font-sans bg-white min-h-screen">
          <div className="flex justify-between items-start mb-8 border-b-4 border-black pb-6">
            <div>
              <h1 className="text-4xl font-black mb-2 tracking-tight">ใบสั่งซื้อ (Purchase Order)</h1>
              <p className="text-base font-bold text-gray-800">คิงส์สว่าง โรงงานน้ำแข็งและน้ำดื่ม</p>
              <p className="text-sm text-gray-600 mt-1">อ.สว่างแดนดิน จ.สกลนคร</p>
            </div>
            <div className="text-right bg-gray-100 p-4 border-2 border-black rounded-xl">
              <p className="font-bold text-xl mb-1">เลขที่ (PO No): <span className="font-black text-blue-800">{printSlip.id}</span></p>
              <p className="font-bold text-base">วันที่ (Date): <span className="font-normal text-gray-800">{new Date(printSlip.date).toLocaleDateString('th-TH', {year:'numeric', month:'long', day:'numeric'})}</span></p>
            </div>
          </div>
          <div className="mb-8 p-6 border-2 border-gray-400 rounded-xl bg-white text-sm">
            <div className="grid grid-cols-12 gap-y-3">
              <div className="col-span-3 font-bold text-gray-600">สั่งซื้อจาก (Supplier):</div>
              <div className="col-span-9 font-black text-xl text-black">{printSlip.supplierName}</div>
              {printSlip.supplierDetails && (
                <>
                  <div className="col-span-3 font-bold text-gray-600 mt-1">ที่อยู่:</div>
                  <div className="col-span-9 mt-1 text-gray-800">{printSlip.supplierDetails.address}</div>
                  <div className="col-span-3 font-bold text-gray-600 mt-1">เบอร์โทรติดต่อ:</div>
                  <div className="col-span-9 mt-1 text-gray-800">{printSlip.supplierDetails.phone}</div>
                  <div className="col-span-3 font-bold text-gray-600 mt-1">เลขประจำตัวผู้เสียภาษี:</div>
                  <div className="col-span-9 mt-1 text-gray-800">{printSlip.supplierDetails.taxId}</div>
                </>
              )}
              <div className="col-span-12 border-t border-gray-200 my-1"></div>
              <div className="col-span-3 font-bold text-gray-600">หมายเหตุ (Note):</div>
              <div className="col-span-9 text-base">{printSlip.note || '-'}</div>
            </div>
          </div>
          <table className="w-full border-collapse border-2 border-black text-base mb-8">
            <thead>
              <tr className="bg-gray-200 border-b-2 border-black text-center">
                <th className="border-r border-black py-3 px-2 w-16">ลำดับ</th>
                <th className="border-r border-black py-3 px-4 text-left">รายการสินค้า (Description)</th>
                <th className="border-r border-black py-3 px-2 w-32">จำนวน (Qty)</th>
                <th className="border-r border-black py-3 px-2 w-32">ราคา/หน่วย</th>
                <th className="py-3 px-4 w-40">จำนวนเงิน (Amount)</th>
              </tr>
            </thead>
            <tbody>
              {printSlip.items?.map((item, idx) => (
                <tr key={idx} className="border-b border-gray-300">
                  <td className="border-r border-black p-3 text-center text-gray-600">{idx + 1}</td>
                  <td className="border-r border-black p-3 font-bold">{item.name}</td>
                  <td className="border-r border-black p-3 text-center font-black">{item.qty} <span className="text-sm font-normal text-gray-600">{item.unit}</span></td>
                  <td className="border-r border-black p-3 text-right">{item.price > 0 ? item.price.toLocaleString() : '-'}</td>
                  <td className="p-3 text-right font-black">{item.total > 0 ? item.total.toLocaleString() : '-'}</td>
                </tr>
              ))}
              {printSlip.items && printSlip.items.length < 5 && Array(5 - printSlip.items.length).fill(0).map((_, i) => (
                 <tr key={`empty-${i}`} className="h-10 border-b border-gray-100">
                   <td className="border-r border-black"></td><td className="border-r border-black"></td><td className="border-r border-black"></td><td className="border-r border-black"></td><td></td>
                 </tr>
              ))}
              <tr className="bg-gray-100 border-t-2 border-black">
                <td colSpan={4} className="border-r border-black p-4 font-black text-right text-lg">ยอดรวมทั้งสิ้น (Grand Total)</td>
                <td className="p-4 text-right font-black text-3xl underline">{Number(printSlip.totalAmount).toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
          <div className="grid grid-cols-3 gap-8 text-center mt-32 text-base">
            <div>
              <div className="border-b border-black mx-4 h-10 mb-2"></div><p className="font-bold">ผู้จัดทำ (Prepared By)</p><p className="text-xs text-gray-500 mt-1">{printSlip.by}</p>
            </div>
            <div>
              <div className="border-b border-black mx-4 h-10 mb-2"></div><p className="font-bold">ผู้อนุมัติ (Authorized By)</p><p className="text-xs text-gray-500 mt-1">ผู้จัดการ / เถ้าแก่</p>
            </div>
            <div>
              <div className="border-b border-gray-400 border-dashed mx-4 h-10 mb-2"></div><p className="font-bold text-gray-500">ผู้รับบิล (Supplier Sign)</p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}