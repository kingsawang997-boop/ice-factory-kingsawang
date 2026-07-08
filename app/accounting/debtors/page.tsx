'use client'

import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase' 

const productOptions = [
  { name: 'น้ำแข็งหลอดใหญ่', price: 40 },
  { name: 'น้ำแข็งหลอดเล็ก', price: 45 },
  { name: 'น้ำแข็งบดหยาบ', price: 35 },
  { name: 'น้ำดื่ม 1500 ml', price: 45 },
  { name: 'น้ำดื่ม 600 ml', price: 45 },
  { name: 'อื่นๆ (ระบุเอง)', price: 0 }
]

export default function DebtorsPage() {
  const getTodayString = () => {
    const today = new Date()
    return new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0]
  }

  const [debtors, setDebtors] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true) 
  const [activeFilter, setActiveFilter] = useState('all') 
  const [searchQuery, setSearchQuery] = useState('') 
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [newDebtorData, setNewDebtorData] = useState({ name: '', phone: '', address: '', route: 'สาย 1 (ในเมือง)', taxId: '', creditLimit: '' })
  
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editDebtorData, setEditDebtorData] = useState({ id: '', name: '', phone: '', address: '', route: 'สาย 1 (ในเมือง)', taxId: '', creditLimit: '' })

  const [selectedDebtor, setSelectedDebtor] = useState<any | null>(null)
  
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
  const [payAmount, setPayAmount] = useState<number | string>('')
  const [payMethod, setPayMethod] = useState<'cash' | 'transfer'>('cash')

  const [isAddDebtModalOpen, setIsAddDebtModalOpen] = useState(false)
  const [invoiceItems, setInvoiceItems] = useState<{name: string, qty: number, price: number, total: number}[]>([])
  const [currentItem, setCurrentItem] = useState({ name: 'น้ำแข็งหลอดใหญ่', customName: '', qty: 1, price: 40 })
  const [invoiceNote, setInvoiceNote] = useState('เปิดบิลค่าสินค้า (เครดิต)')

  const [viewHistoryDebtor, setViewHistoryDebtor] = useState<any | null>(null)
  const [printReceipt, setPrintReceipt] = useState<any>(null)
  const [printInvoice, setPrintInvoice] = useState<any>(null)

  useEffect(() => {
    fetchDebtors()
  }, [])

  const fetchDebtors = async () => {
    setIsLoading(true)
    
    try {
      const { data: debtorsData, error: debtorsError } = await supabase
        .from('debtors')
        .select('*')
        .order('outstanding', { ascending: false })

      if (debtorsError) throw debtorsError

      const { data: txData, error: txError } = await supabase
        .from('debtor_transactions')
        .select('*')

      if (txError) throw txError

      const formattedData = (debtorsData || []).map(d => {
        const history = (txData || [])
          .filter(tx => tx.debtorId === d.id) 
          .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        
        return {
          ...d,
          currentDebt: d.outstanding || 0,
          creditLimit: d.creditLimit || 50000,
          history: history
        }
      })

      setDebtors(formattedData)
      
      if (viewHistoryDebtor) {
        const updatedCurrent = formattedData.find(d => d.id === viewHistoryDebtor.id)
        if (updatedCurrent) setViewHistoryDebtor(updatedCurrent)
      }

    } catch (error) {
      console.error('Error fetching data:', error)
      alert('เกิดข้อผิดพลาดในการโหลดข้อมูลลูกหนี้')
    }
    
    setIsLoading(false)
  }

  const totalDebt = useMemo(() => debtors.reduce((sum, d) => sum + Number(d.currentDebt), 0), [debtors])
  const totalDebtors = debtors.length
  const overLimitCount = debtors.filter(d => Number(d.currentDebt) >= Number(d.creditLimit)).length

  const filteredDebtors = debtors.filter(d => {
    const matchesSearch = d.name.toLowerCase().includes(searchQuery.toLowerCase()) || d.id.toLowerCase().includes(searchQuery.toLowerCase()) || (d.phone && d.phone.includes(searchQuery))
    if (!matchesSearch) return false

    if (activeFilter === 'all') return true
    if (activeFilter === 'cleared') return Number(d.currentDebt) === 0
    if (activeFilter === 'full') return Number(d.currentDebt) >= Number(d.creditLimit)
    if (activeFilter === 'active') return Number(d.currentDebt) > 0 && Number(d.currentDebt) < Number(d.creditLimit)
    return true
  })

  // 💾 บันทึกลูกหนี้ใหม่
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newDebtorData.name || !newDebtorData.creditLimit) return alert('กรุณากรอกชื่อและวงเงินเครดิตให้ครบถ้วน')
    
    const newId = `CUS-${Date.now().toString().slice(-4)}`
    const payload = {
      id: newId,
      name: newDebtorData.name,
      phone: newDebtorData.phone || '-',
      address: newDebtorData.address || '-',
      route: newDebtorData.route || '-', 
      taxId: newDebtorData.taxId || '-',     
      outstanding: 0,
      creditLimit: Number(newDebtorData.creditLimit),
    }
    
    const { error } = await supabase.from('debtors').insert([payload])
    
    if (error) {
      alert('เกิดข้อผิดพลาด: ' + error.message)
    } else {
      alert('✅ เพิ่มลูกหนี้ใหม่เข้าฐานข้อมูลเรียบร้อยแล้ว!')
      setNewDebtorData({ name: '', phone: '', address: '', route: 'สาย 1 (ในเมือง)', taxId: '', creditLimit: '' })
      setIsAddModalOpen(false)
      fetchDebtors()
    }
  }

  // 💾 แก้ไขข้อมูลลูกค้า
  const openEditModal = (debtor: any) => {
    setEditDebtorData({ 
      id: debtor.id, 
      name: debtor.name, 
      phone: debtor.phone, 
      address: debtor.address || '', 
      route: debtor.route || 'สาย 1 (ในเมือง)', 
      taxId: debtor.taxId || '', 
      creditLimit: debtor.creditLimit.toString() 
    })
    setIsEditModalOpen(true)
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const payload = {
      name: editDebtorData.name,
      phone: editDebtorData.phone || '-',
      address: editDebtorData.address || '-', 
      route: editDebtorData.route || '-', 
      taxId: editDebtorData.taxId || '-',
      creditLimit: Number(editDebtorData.creditLimit)
    }

    const { error } = await supabase.from('debtors').update(payload).eq('id', editDebtorData.id)
    
    if (error) {
      alert('เกิดข้อผิดพลาด: ' + error.message)
    } else {
      alert('✅ อัปเดตข้อมูลลูกค้าในฐานข้อมูลเรียบร้อยแล้ว!')
      setIsEditModalOpen(false)
      fetchDebtors()
    }
  }

  const handleProductSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value
    const found = productOptions.find(p => p.name === val)
    setCurrentItem({ name: val, customName: '', qty: 1, price: found ? found.price : 0 })
  }

  const addInvoiceItem = () => {
    const finalName = currentItem.name === 'อื่นๆ (ระบุเอง)' ? currentItem.customName : currentItem.name
    if (!finalName || currentItem.qty <= 0 || currentItem.price < 0) return alert('ข้อมูลสินค้าไม่ถูกต้อง')
    setInvoiceItems([...invoiceItems, { name: finalName, qty: Number(currentItem.qty), price: Number(currentItem.price), total: Number(currentItem.qty) * Number(currentItem.price) }])
    setCurrentItem({ name: 'น้ำแข็งหลอดใหญ่', customName: '', qty: 1, price: 40 })
  }

  const removeInvoiceItem = (index: number) => {
    setInvoiceItems(invoiceItems.filter((_, i) => i !== index))
  }

  const openAddDebtModal = (debtor: any) => {
    setSelectedDebtor(debtor)
    setInvoiceItems([])
    setInvoiceNote('เปิดบิลค่าสินค้า (เครดิต)')
    setIsAddDebtModalOpen(true)
  }

  const handleConfirmAddDebt = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedDebtor || invoiceItems.length === 0) return alert('กรุณาเพิ่มรายการสินค้า')

    const amountToAdd = invoiceItems.reduce((sum, item) => sum + item.total, 0)
    
    if (Number(selectedDebtor.currentDebt) + amountToAdd > Number(selectedDebtor.creditLimit)) {
      if (!confirm('⚠️ ยอดหนี้ใหม่จะเกินวงเงินเครดิต! อนุมัติการเปิดบิลนี้ต่อหรือไม่?')) return
    }

    const currentDate = getTodayString() // 🌟 ใช้ฟังก์ชัน Timezone ของไทย
    const invoiceNo = `INV-${Date.now().toString().slice(-6)}`
    
    const newDebt = Number(selectedDebtor.currentDebt) + amountToAdd
    await supabase.from('debtors').update({ outstanding: newDebt }).eq('id', selectedDebtor.id)

    await supabase.from('debtor_transactions').insert([{
      id: invoiceNo,
      debtorId: selectedDebtor.id, 
      debtorName: selectedDebtor.name,
      date: currentDate,
      type: 'debt', 
      amount: amountToAdd,
      note: invoiceNote,
      items: invoiceItems 
    }])

    const invoiceData = {
      debtor: selectedDebtor, invoiceNo: invoiceNo, date: new Date().toLocaleDateString('th-TH'),
      items: invoiceItems, totalAmount: amountToAdd, note: invoiceNote
    }

    setIsAddDebtModalOpen(false)
    fetchDebtors() 
    setPrintInvoice(invoiceData)

    setTimeout(() => { window.print(); setTimeout(() => setPrintInvoice(null), 500) }, 300)
  }

  const openPaymentModal = (debtor: any) => {
    setSelectedDebtor(debtor)
    setPayAmount(debtor.currentDebt) 
    setPayMethod('cash')
    setIsPaymentModalOpen(true)
  }

  const handleConfirmPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    const amountToPay = Number(payAmount)
    if (!selectedDebtor || amountToPay <= 0 || amountToPay > Number(selectedDebtor.currentDebt)) return alert('จำนวนเงินไม่ถูกต้อง!')

    const currentDate = getTodayString() // 🌟 ใช้ฟังก์ชัน Timezone ของไทย
    const receiptNo = `RC-${Date.now().toString().slice(-6)}`
    
    const newDebt = Number(selectedDebtor.currentDebt) - amountToPay
    await supabase.from('debtors').update({ outstanding: newDebt }).eq('id', selectedDebtor.id)

    await supabase.from('debtor_transactions').insert([{
      id: receiptNo,
      debtorId: selectedDebtor.id, 
      debtorName: selectedDebtor.name,
      date: currentDate,
      type: 'pay', 
      amount: amountToPay,
      note: `ชำระหนี้ (${payMethod === 'cash' ? 'เงินสด' : 'โอนเงิน'})`,
    }])

    const receiptData = { 
      debtor: selectedDebtor, paid: amountToPay, method: payMethod, 
      date: new Date().toLocaleDateString('th-TH', { hour: '2-digit', minute: '2-digit' }), receiptNo: receiptNo 
    }

    setIsPaymentModalOpen(false)
    fetchDebtors() 
    setPrintReceipt(receiptData)
    
    setTimeout(() => { window.print(); setTimeout(() => setPrintReceipt(null), 500) }, 300)
  }

  const getStatus = (current: number, limit: number) => {
    if (current === 0) return { label: 'ไม่มียอดค้าง', color: 'bg-emerald-50 text-emerald-600 border-emerald-200' }
    if (current >= limit) return { label: 'วงเงินเต็ม (งดเครดิต)', color: 'bg-rose-50 text-rose-600 border-rose-200' }
    const percent = (current / limit) * 100
    if (percent >= 80) return { label: 'ใกล้เต็มวงเงิน', color: 'bg-orange-50 text-orange-600 border-orange-200' }
    return { label: 'ปกติ', color: 'bg-blue-50 text-blue-600 border-blue-200' }
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        @media print { @page { size: A4 portrait; margin: 15mm; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: white; margin: 0; } }
      `}} />

      <div className={`space-y-4 md:space-y-6 p-3 md:p-6 bg-slate-50/50 min-h-screen text-xs ${(printReceipt || printInvoice) ? 'hidden' : 'block print:hidden'}`}>
        
        <div className="bg-white p-5 md:p-8 rounded-2xl md:rounded-3xl border border-slate-100 shadow-sm flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div className="space-y-2">
            <h1 className="text-xl md:text-2xl font-black text-slate-900 flex items-center gap-3"><span className="text-2xl">🤝</span> ทะเบียนลูกหนี้ / จัดการเครดิต</h1>
            <p className="text-sm text-slate-500 font-medium">เชื่อมต่อกับระบบฐานข้อมูล Cloud Database เรียบร้อย 🟢</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
            <div className="bg-rose-50 px-5 py-3 rounded-xl border border-rose-100 text-right w-full sm:w-48">
              <p className="text-[10px] text-rose-600 font-bold mb-0.5">ยอดหนี้รอเก็บรวมทั้งหมด</p>
              <p className="text-xl font-black text-rose-700">{totalDebt.toLocaleString()} <span className="text-sm">บ.</span></p>
            </div>
            <button onClick={() => setIsAddModalOpen(true)} className="bg-slate-900 hover:bg-black text-white px-5 py-3 rounded-xl font-bold transition-all shadow-md flex justify-center items-center gap-2 active:scale-95 text-sm w-full sm:w-auto">
              <span>➕</span> เพิ่มลูกหนี้ใหม่
            </button>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center">
          <div className="relative w-full lg:w-80">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 text-base">🔍</div>
            <input type="text" placeholder="ค้นหาชื่อลูกค้า, รหัส, เบอร์โทร..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-sm font-medium text-sm text-slate-700 bg-white" />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide w-full lg:w-auto">
            {[{ id: 'all', label: `ทั้งหมด (${totalDebtors})` }, { id: 'active', label: '🟡 ค้างชำระ' }, { id: 'full', label: `🔴 วงเงินเต็ม (${overLimitCount})` }, { id: 'cleared', label: '🟢 ไม่มียอดค้าง' }].map(tab => (
              <button key={tab.id} onClick={() => setActiveFilter(tab.id)} className={`px-5 py-2.5 rounded-xl font-bold transition-all whitespace-nowrap text-sm ${activeFilter === tab.id ? 'bg-slate-900 text-white shadow-md' : 'bg-white text-slate-500 hover:bg-slate-100 border border-slate-200'}`}>{tab.label}</button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl md:rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 text-[11px] whitespace-nowrap">
                  <th className="p-4 font-bold">ข้อมูลลูกค้า / ร้านค้า</th>
                  <th className="p-4 font-bold text-center">อัปเดตล่าสุด</th>
                  <th className="p-4 font-bold text-center">วงเงินเครดิต</th>
                  <th className="p-4 font-bold text-center">ความเสี่ยง (สถานะ)</th>
                  <th className="p-4 font-bold text-right">ยอดหนี้คงค้าง</th>
                  <th className="p-4 font-bold text-center w-40">จัดการ</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {isLoading ? (
                  <tr><td colSpan={6} className="p-10 text-center text-blue-500 font-bold">⏳ กำลังโหลดข้อมูลจาก Database...</td></tr>
                ) : filteredDebtors.length === 0 ? (
                  <tr><td colSpan={6} className="p-10 text-center text-slate-400 font-bold text-sm">{searchQuery ? `ไม่พบข้อมูลลูกค้าที่ตรงกับ "${searchQuery}"` : 'ยังไม่มีข้อมูลลูกค้าในฐานข้อมูล'}</td></tr>
                ) : (
                  filteredDebtors.map(debtor => {
                    const status = getStatus(Number(debtor.currentDebt), Number(debtor.creditLimit))
                    const progress = (Number(debtor.currentDebt) / Number(debtor.creditLimit)) * 100

                    return (
                      <tr key={debtor.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                        <td className="p-4">
                          <button onClick={() => setViewHistoryDebtor(debtor)} className="font-black text-blue-600 hover:text-blue-800 hover:underline text-left transition-colors flex items-center gap-1.5" title="คลิกเพื่อดูประวัติลูกค้า">
                            {debtor.name} <span className="text-xs">↗</span>
                          </button>
                          <p className="text-[10px] text-slate-500 font-bold mt-1">📞 {debtor.phone} | ID: {debtor.id}</p>
                          <p className="text-[10px] font-bold text-blue-600 mt-1 bg-blue-50 inline-block px-1.5 py-0.5 rounded">{debtor.route}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[200px]">{debtor.address}</p>
                        </td>
                        <td className="p-4 text-center text-slate-500 font-medium text-xs">{new Date(debtor.createdAt).toLocaleDateString('th-TH')}</td>
                        <td className="p-4 text-center text-slate-600 font-bold">{Number(debtor.creditLimit).toLocaleString()}</td>
                        <td className="p-4 text-center">
                          <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold border ${status.color}`}>{status.label}</span>
                          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden"><div className={`h-full ${progress >= 100 ? 'bg-rose-500' : progress >= 80 ? 'bg-orange-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(progress, 100)}%` }}></div></div>
                        </td>
                        <td className="p-4 text-right">
                          <span className={`font-black text-lg ${Number(debtor.currentDebt) >= Number(debtor.creditLimit) ? 'text-rose-600' : Number(debtor.currentDebt) === 0 ? 'text-emerald-500' : 'text-slate-800'}`}>{Number(debtor.currentDebt).toLocaleString()}</span><span className="text-[10px] text-slate-400 font-bold ml-1">บ.</span>
                        </td>
                        <td className="p-4">
                          <div className="flex flex-col gap-1.5 w-full">
                            <button onClick={() => openAddDebtModal(debtor)} className="w-full px-3 py-1.5 rounded-lg font-bold text-[10px] bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-100 transition-colors">➕ เปิดบิลเพิ่มหนี้</button>
                            <button onClick={() => openPaymentModal(debtor)} disabled={Number(debtor.currentDebt) === 0} className={`w-full px-3 py-1.5 rounded-lg font-bold text-[10px] transition-colors ${Number(debtor.currentDebt) === 0 ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-emerald-500 text-white hover:bg-emerald-600'}`}>💵 ตัดหนี้</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 📖 Modal: ประวัติลูกหนี้ (Statement) */}
      {viewHistoryDebtor && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200 print:hidden">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex justify-between items-start bg-slate-50 shrink-0">
              <div>
                <h3 className="font-black text-xl text-slate-900">{viewHistoryDebtor.name}</h3>
                <p className="text-xs text-slate-500 mt-1 font-bold">รหัส: {viewHistoryDebtor.id} | โทร: {viewHistoryDebtor.phone}</p>
                <p className="text-[10px] font-bold text-blue-600 mt-1">{viewHistoryDebtor.route}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{viewHistoryDebtor.address} (Tax ID: {viewHistoryDebtor.taxId})</p>
              </div>
              <button onClick={() => setViewHistoryDebtor(null)} className="w-8 h-8 rounded-full bg-white text-slate-400 hover:text-rose-500 shadow-sm font-bold flex items-center justify-center border border-slate-200">✕</button>
            </div>
            
            <div className="p-6 overflow-y-auto bg-white flex-1">
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl text-center"><p className="text-[10px] font-bold text-slate-500">วงเงินอนุมัติ</p><p className="font-black text-lg text-slate-800">{Number(viewHistoryDebtor.creditLimit).toLocaleString()} บ.</p></div>
                <div className="bg-rose-50 border border-rose-200 p-4 rounded-2xl text-center"><p className="text-[10px] font-bold text-rose-500">ยอดหนี้ปัจจุบัน</p><p className="font-black text-xl text-rose-600">{Number(viewHistoryDebtor.currentDebt).toLocaleString()} บ.</p></div>
                <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl text-center"><p className="text-[10px] font-bold text-emerald-600">วงเงินคงเหลือ (สั่งของได้อีก)</p><p className="font-black text-lg text-emerald-600">{(Number(viewHistoryDebtor.creditLimit) - Number(viewHistoryDebtor.currentDebt)).toLocaleString()} บ.</p></div>
              </div>

              <div className="flex justify-between items-end mb-3">
                <h4 className="font-black text-slate-800 text-sm flex items-center gap-2">📄 รายการเดินบัญชีย้อนหลัง (Statement)</h4>
                <button onClick={() => openAddDebtModal(viewHistoryDebtor)} className="px-4 py-1.5 rounded-lg font-bold text-xs bg-rose-50 text-rose-600 hover:bg-rose-100 transition-all border border-rose-200">➕ เปิดบิลเพิ่มหนี้</button>
              </div>
              
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 border-b border-slate-200 text-slate-600">
                    <tr><th className="p-3 font-bold w-32">วันที่/เวลา</th><th className="p-3 font-bold w-28">เอกสาร</th><th className="p-3 font-bold">รายการ / หมายเหตุ</th><th className="p-3 font-bold text-right text-rose-600 w-28">หนี้เพิ่ม (เปิดบิล)</th><th className="p-3 font-bold text-right text-emerald-600 w-28">รับชำระ (ตัดยอด)</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {viewHistoryDebtor.history && viewHistoryDebtor.history.length > 0 ? (
                      viewHistoryDebtor.history.map((tx: any) => (
                        <tr key={tx.id} className="hover:bg-slate-50 align-top">
                          <td className="p-3 font-medium text-slate-500 pt-4">{new Date(tx.createdAt).toLocaleDateString('th-TH')} {new Date(tx.createdAt).toLocaleTimeString('th-TH', {hour: '2-digit', minute:'2-digit'})}</td>
                          <td className="p-3 font-bold text-slate-700 pt-4">{tx.id}</td>
                          <td className="p-3 text-slate-600 pt-4">
                            <span className="font-bold">{tx.note}</span>
                            {/* ดึง items มาโชว์ ถ้ามี */}
                            {tx.items && tx.items.length > 0 && (
                              <ul className="mt-2 space-y-1">
                                {tx.items.map((item: any, idx: number) => (
                                  <li key={idx} className="text-[10px] text-slate-500 bg-white border border-slate-100 px-2 py-1 rounded flex justify-between">
                                    <span>- {item.name} ({item.qty} x {item.price}บ.)</span>
                                    <span className="font-bold text-slate-600">{Number(item.total).toLocaleString()} บ.</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </td>
                          <td className="p-3 text-right font-black text-rose-600 pt-4">{tx.type === 'debt' ? Number(tx.amount).toLocaleString() : '-'}</td>
                          <td className="p-3 text-right font-black text-emerald-600 pt-4">{tx.type === 'pay' ? Number(tx.amount).toLocaleString() : '-'}</td>
                        </tr>
                      ))
                    ) : (<tr><td colSpan={5} className="p-8 text-center text-slate-400 font-medium">ยังไม่มีประวัติการทำรายการ</td></tr>)}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-5 bg-slate-50 border-t border-slate-100 flex justify-end shrink-0 gap-3">
              <button onClick={() => openEditModal(viewHistoryDebtor)} className="px-5 py-2.5 rounded-xl font-bold text-slate-600 bg-white border border-slate-200 hover:bg-blue-50 hover:text-blue-600 transition-all text-sm">✏️ แก้ไขข้อมูลลูกค้า</button>
              <button onClick={() => setViewHistoryDebtor(null)} className="px-6 py-2.5 rounded-xl font-black text-white bg-slate-900 hover:bg-black shadow-md transition-all text-sm">ปิดหน้าต่าง</button>
            </div>
          </div>
        </div>
      )}

      {/* 🚀 3. Modal: เปิดบิลเพิ่มหนี้ (แบบมีรายการสินค้า) */}
      {isAddDebtModalOpen && selectedDebtor && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200 print:hidden">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[95vh]">
            <div className="p-5 border-b border-rose-100 flex justify-between items-center bg-rose-50 shrink-0">
              <h3 className="font-black text-lg text-rose-700 flex items-center gap-2">➕ เปิดบิลแจ้งหนี้ (เครดิต)</h3>
              <button onClick={() => setIsAddDebtModalOpen(false)} className="w-8 h-8 rounded-full bg-white text-slate-400 hover:text-rose-500 shadow-sm font-bold flex items-center justify-center">✕</button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-5">
              <div className="flex justify-between items-center bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div><p className="font-bold text-blue-600 text-sm">{selectedDebtor.name}</p><p className="text-[10px] text-slate-500 mt-0.5">วงเงินเครดิต: {Number(selectedDebtor.creditLimit).toLocaleString()} บ.</p></div>
                <div className="text-right"><p className="text-[10px] font-bold text-slate-500 mb-0.5">ยอดหนี้ค้างเดิม</p><p className="font-black text-xl text-slate-800">{Number(selectedDebtor.currentDebt).toLocaleString()} <span className="text-xs">บ.</span></p></div>
              </div>
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-700">ระบุรายการสินค้าที่ลูกค้าสั่งซื้อ <span className="text-rose-500">*</span></label>
                <div className="flex flex-col sm:flex-row gap-2 bg-blue-50 p-3 rounded-xl border border-blue-100">
                  <select value={currentItem.name} onChange={handleProductSelect} className="flex-1 border border-blue-200 px-3 py-2 rounded-lg text-xs font-bold focus:outline-none">
                    {productOptions.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                  </select>
                  {currentItem.name === 'อื่นๆ (ระบุเอง)' && (<input type="text" placeholder="ระบุชื่อสินค้า..." value={currentItem.customName} onChange={e => setCurrentItem({...currentItem, customName: e.target.value})} className="flex-1 border border-blue-200 px-3 py-2 rounded-lg text-xs" />)}
                  <div className="flex gap-2">
                    <input type="number" min="1" placeholder="จำนวน" value={currentItem.qty} onChange={e => setCurrentItem({...currentItem, qty: Number(e.target.value)})} className="w-16 border border-blue-200 px-2 py-2 rounded-lg text-xs text-center" title="จำนวน" />
                    <input type="number" min="0" placeholder="ราคา/หน่วย" value={currentItem.price} onChange={e => setCurrentItem({...currentItem, price: Number(e.target.value)})} className="w-20 border border-blue-200 px-2 py-2 rounded-lg text-xs text-right" title="ราคาต่อหน่วย" />
                    <button type="button" onClick={addInvoiceItem} className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-lg text-xs shadow-sm">เพิ่ม</button>
                  </div>
                </div>
                {invoiceItems.length > 0 ? (
                  <table className="w-full text-left text-xs border border-slate-200 rounded-lg overflow-hidden"><thead className="bg-slate-100 text-slate-600 border-b border-slate-200"><tr><th className="p-2">รายการ</th><th className="p-2 text-center">จำนวน</th><th className="p-2 text-right">ราคา/หน่วย</th><th className="p-2 text-right">รวม</th><th className="p-2 text-center">ลบ</th></tr></thead>
                    <tbody className="divide-y divide-slate-100">{invoiceItems.map((item, idx) => (<tr key={idx} className="bg-white"><td className="p-2 font-bold">{item.name}</td><td className="p-2 text-center">{item.qty}</td><td className="p-2 text-right">{item.price}</td><td className="p-2 text-right font-black text-blue-600">{item.total.toLocaleString()}</td><td className="p-2 text-center"><button type="button" onClick={() => removeInvoiceItem(idx)} className="text-rose-500 font-bold hover:text-rose-700">✕</button></td></tr>))}</tbody>
                  </table>
                ) : (<div className="text-center py-6 bg-slate-50 border border-slate-200 border-dashed rounded-xl text-slate-400 text-xs font-bold">ยังไม่มีรายการสินค้าในบิลนี้</div>)}
              </div>
              <div className="space-y-1.5"><label className="text-xs font-bold text-slate-700">หมายเหตุบนใบแจ้งหนี้</label><input type="text" value={invoiceNote} onChange={e => setInvoiceNote(e.target.value)} className="w-full border-2 border-slate-200 px-4 py-3 rounded-xl focus:outline-none focus:border-rose-500 font-bold text-sm text-slate-800" /></div>
            </div>
            <div className="p-5 bg-rose-50 border-t border-rose-100 shrink-0">
              <div className="flex justify-between items-center mb-4"><span className="font-bold text-slate-700">ยอดรวมบิลนี้ (Total):</span><span className="font-black text-2xl text-rose-600">{invoiceItems.reduce((sum, item) => sum + item.total, 0).toLocaleString()} <span className="text-sm">บ.</span></span></div>
              <button onClick={handleConfirmAddDebt} className="w-full bg-rose-600 hover:bg-rose-700 text-white font-black py-4 rounded-xl shadow-lg shadow-rose-500/30 transition-all text-sm active:scale-95">ยืนยันการเปิดบิล & พิมพ์ใบแจ้งหนี้</button>
            </div>
          </div>
        </div>
      )}

      {/* 🚀 4. Modal: รับชำระหนี้ */}
      {isPaymentModalOpen && selectedDebtor && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm print:hidden">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm flex flex-col"><div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50"><h3 className="font-black text-lg text-slate-900">💵 รับชำระหนี้ (ตัดยอด)</h3><button onClick={() => setIsPaymentModalOpen(false)} className="w-8 h-8 rounded-full bg-white text-slate-400 hover:text-rose-500 shadow-sm font-bold flex items-center justify-center">✕</button></div><form onSubmit={handleConfirmPayment} className="p-6 space-y-5"><div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-center"><p className="text-[10px] font-bold text-slate-500 mb-1">ยอดหนี้คงค้างปัจจุบัน</p><p className="font-black text-3xl text-slate-800">{Number(selectedDebtor.currentDebt).toLocaleString()} <span className="text-sm">บ.</span></p><p className="text-xs font-bold text-blue-600 mt-2">{selectedDebtor.name}</p></div><div className="space-y-1.5"><label className="text-xs font-bold text-slate-700">ระบุยอดเงินที่ลูกค้านำมาชำระ *</label><input type="number" min="1" max={selectedDebtor.currentDebt} required value={payAmount} onChange={e => setPayAmount(e.target.value)} className="w-full border-2 border-emerald-200 px-4 py-3 rounded-xl font-black text-2xl text-emerald-600 bg-emerald-50 text-center" /></div><div className="space-y-1.5"><label className="text-xs font-bold text-slate-700">ช่องทางรับเงิน</label><div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => setPayMethod('cash')} className={`py-3 rounded-xl font-bold text-xs border-2 ${payMethod === 'cash' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'border-slate-200 text-slate-500 bg-white'}`}>💵 เงินสด</button><button type="button" onClick={() => setPayMethod('transfer')} className={`py-3 rounded-xl font-bold text-xs border-2 ${payMethod === 'transfer' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'border-slate-200 text-slate-500 bg-white'}`}>📱 โอนเงิน</button></div></div><button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black py-4 rounded-xl shadow-lg mt-4">ยืนยันรับชำระ & พิมพ์ใบเสร็จ</button></form></div>
        </div>
      )}

      {/* 🚀 5. Modal: เพิ่มลูกหนี้ใหม่ และ แก้ไขข้อมูล */}
      {isAddModalOpen && ( 
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm print:hidden">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-black text-lg text-slate-900">➕ ลงทะเบียนลูกหนี้ใหม่</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="w-8 h-8 rounded-full bg-white text-slate-400 hover:text-rose-500 shadow-sm font-bold flex items-center justify-center">✕</button>
            </div>
            <form onSubmit={handleAddSubmit} className="p-6 space-y-4 overflow-y-auto">
              <div className="space-y-1.5"><label className="text-xs font-bold text-slate-700">ชื่อลูกค้า / ชื่อร้านค้า *</label><input type="text" required value={newDebtorData.name} onChange={e => setNewDebtorData({...newDebtorData, name: e.target.value})} className="w-full border-2 border-slate-200 px-4 py-3 rounded-xl font-bold text-sm" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5"><label className="text-xs font-bold text-slate-700">เบอร์โทรศัพท์</label><input type="text" value={newDebtorData.phone} onChange={e => setNewDebtorData({...newDebtorData, phone: e.target.value})} className="w-full border-2 border-slate-200 px-4 py-3 rounded-xl font-bold text-sm" /></div>
                <div className="space-y-1.5"><label className="text-xs font-bold text-slate-700">วงเงินอนุมัติ *</label><input type="number" min="1" required value={newDebtorData.creditLimit} onChange={e => setNewDebtorData({...newDebtorData, creditLimit: e.target.value})} className="w-full border-2 border-blue-200 px-4 py-3 rounded-xl font-black text-lg text-blue-600 bg-blue-50" /></div>
              </div>
              <div className="border-t border-slate-100 pt-4 space-y-4">
                <div className="space-y-1.5"><label className="text-xs font-bold text-slate-700">เลขผู้เสียภาษี</label><input type="text" maxLength={13} value={newDebtorData.taxId} onChange={e => setNewDebtorData({...newDebtorData, taxId: e.target.value})} className="w-full border-2 border-slate-200 px-4 py-3 rounded-xl font-bold text-sm" /></div>
                
                {/* 🌟 แยกที่อยู่ และ สายส่ง ออกจากกัน */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">ที่อยู่จดทะเบียน / จัดส่ง</label>
                  <textarea rows={2} value={newDebtorData.address} onChange={e => setNewDebtorData({...newDebtorData, address: e.target.value})} className="w-full border-2 border-slate-200 px-4 py-3 rounded-xl font-bold text-sm resize-none" placeholder="บ้านเลขที่, ถนน, ตำบล..." />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">สายส่งดูแลหลัก</label>
                  <select value={newDebtorData.route} onChange={e => setNewDebtorData({...newDebtorData, route: e.target.value})} className="w-full border-2 border-slate-200 px-4 py-3 rounded-xl font-bold text-sm outline-none focus:border-blue-500">
                    <option value="สาย 1 (ในเมือง)">สาย 1 (ในเมือง)</option>
                    <option value="สาย 2 (โซนเหนือ)">สาย 2 (โซนเหนือ)</option>
                    <option value="สาย 3 (อุตสาหกรรม)">สาย 3 (อุตสาหกรรม)</option>
                    <option value="หน้าร้าน (POS)">หน้าร้าน (POS)</option>
                    <option value="ไม่ได้ระบุ">ไม่ได้ระบุ</option>
                  </select>
                </div>

              </div>
              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-xl shadow-lg mt-6 transition-transform active:scale-95">💾 บันทึกข้อมูลลูกหนี้</button>
            </form>
          </div>
        </div> 
      )}
      
      {isEditModalOpen && ( 
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm print:hidden">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-black text-lg text-slate-900">✏️ แก้ไขข้อมูลลูกค้า</h3>
              <button onClick={() => setIsEditModalOpen(false)} className="w-8 h-8 rounded-full bg-white text-slate-400 hover:text-rose-500 shadow-sm font-bold flex items-center justify-center">✕</button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-6 space-y-4 overflow-y-auto">
              <div className="space-y-1.5"><label className="text-xs font-bold text-slate-700">ชื่อลูกค้า / ชื่อร้านค้า *</label><input type="text" required value={editDebtorData.name} onChange={e => setEditDebtorData({...editDebtorData, name: e.target.value})} className="w-full border-2 border-slate-200 px-4 py-3 rounded-xl font-bold text-sm" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5"><label className="text-xs font-bold text-slate-700">เบอร์โทรศัพท์</label><input type="text" value={editDebtorData.phone} onChange={e => setEditDebtorData({...editDebtorData, phone: e.target.value})} className="w-full border-2 border-slate-200 px-4 py-3 rounded-xl font-bold text-sm" /></div>
                <div className="space-y-1.5"><label className="text-xs font-bold text-slate-700">วงเงินอนุมัติ *</label><input type="number" min="1" required value={editDebtorData.creditLimit} onChange={e => setEditDebtorData({...editDebtorData, creditLimit: e.target.value})} className="w-full border-2 border-blue-200 px-4 py-3 rounded-xl font-black text-lg text-blue-600 bg-blue-50" /></div>
              </div>
              <div className="border-t border-slate-100 pt-4 space-y-4">
                <div className="space-y-1.5"><label className="text-xs font-bold text-slate-700">เลขผู้เสียภาษี</label><input type="text" maxLength={13} value={editDebtorData.taxId} onChange={e => setEditDebtorData({...editDebtorData, taxId: e.target.value})} className="w-full border-2 border-slate-200 px-4 py-3 rounded-xl font-bold text-sm" /></div>
                
                {/* 🌟 แยกที่อยู่ และ สายส่ง ออกจากกัน */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">ที่อยู่จดทะเบียน / จัดส่ง</label>
                  <textarea rows={2} value={editDebtorData.address} onChange={e => setEditDebtorData({...editDebtorData, address: e.target.value})} className="w-full border-2 border-slate-200 px-4 py-3 rounded-xl font-bold text-sm resize-none" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">สายส่งดูแลหลัก</label>
                  <select value={editDebtorData.route} onChange={e => setEditDebtorData({...editDebtorData, route: e.target.value})} className="w-full border-2 border-slate-200 px-4 py-3 rounded-xl font-bold text-sm outline-none focus:border-blue-500">
                    <option value="สาย 1 (ในเมือง)">สาย 1 (ในเมือง)</option>
                    <option value="สาย 2 (โซนเหนือ)">สาย 2 (โซนเหนือ)</option>
                    <option value="สาย 3 (อุตสาหกรรม)">สาย 3 (อุตสาหกรรม)</option>
                    <option value="หน้าร้าน (POS)">หน้าร้าน (POS)</option>
                    <option value="ไม่ได้ระบุ">ไม่ได้ระบุ</option>
                  </select>
                </div>

              </div>
              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-xl shadow-lg mt-6 transition-transform active:scale-95">💾 อัปเดตข้อมูล</button>
            </form>
          </div>
        </div> 
      )}

      {/* 🖨️ รูปแบบหน้ากระดาษ ใบเสร็จรับเงิน และ ใบแจ้งหนี้ (ซ่อนไว้รอสั่งพิมพ์) */}
      {printReceipt && ( <div className="hidden print:block text-black p-4 md:p-10 max-w-4xl mx-auto font-sans bg-white min-h-screen"><div className="flex justify-between items-start mb-8 border-b-4 border-black pb-6"><div><h1 className="text-4xl font-black mb-2 tracking-tight">ใบเสร็จรับเงิน / Receipt</h1><p className="text-base font-bold text-gray-800">คิงส์สว่าง โรงงานน้ำแข็งและน้ำดื่ม</p></div><div className="text-right"><p className="font-bold text-xl mb-1">เลขที่: <span className="font-normal text-gray-800">{printReceipt.receiptNo}</span></p><p className="font-bold text-base">วันที่: <span className="font-normal text-gray-800">{printReceipt.date}</span></p></div></div><div className="mb-8 p-6 border-2 border-gray-300 rounded-xl bg-gray-50/50 text-sm"><div className="grid grid-cols-12 gap-y-3"><div className="col-span-3 font-bold">ได้รับเงินจาก:</div><div className="col-span-9 font-black text-lg">{printReceipt.debtor.name}</div><div className="col-span-3 font-bold">ที่อยู่ / สายส่ง:</div><div className="col-span-9">{printReceipt.debtor.address} | Tax ID: {printReceipt.debtor.taxId || '-'}</div></div></div><table className="w-full border-collapse border-2 border-black text-base mb-8"><thead><tr className="bg-gray-100 border-b-2 border-black text-center"><th className="border-r border-black py-3 px-4 w-20">ลำดับ</th><th className="border-r border-black py-3 px-4">รายการ</th><th className="py-3 px-4 w-48">จำนวนเงิน</th></tr></thead><tbody><tr className="border-b border-black h-24 align-top"><td className="border-r border-black p-4 text-center">1</td><td className="border-r border-black p-4 font-bold">ชำระหนี้ค่าสินค้า ({printReceipt.method === 'cash' ? 'เงินสด' : 'โอนเงิน'})</td><td className="p-4 text-right font-black text-2xl">{printReceipt.paid.toLocaleString()}</td></tr><tr className="bg-gray-100 border-t-2 border-black"><td colSpan={2} className="border-r border-black p-4 font-black text-right text-lg">ยอดรับชำระทั้งสิ้น</td><td className="p-4 text-right font-black text-3xl">{printReceipt.paid.toLocaleString()}</td></tr></tbody></table><div className="flex justify-end mb-16"><div className="w-80 border-2 border-gray-800 p-4 rounded-xl bg-white text-right space-y-2"><div className="flex justify-between text-sm text-gray-600"><span>ยอดหนี้คงเหลือ:</span><span>{(printReceipt.debtor.currentDebt - printReceipt.paid).toLocaleString()} บาท</span></div></div></div></div> )}
      {printInvoice && ( <div className="hidden print:block text-black p-4 md:p-10 max-w-4xl mx-auto font-sans bg-white min-h-screen"><div className="flex justify-between items-start mb-8 border-b-4 border-black pb-6"><div><h1 className="text-4xl font-black mb-2 tracking-tight">ใบแจ้งหนี้ / ใบส่งของ</h1><p className="text-base font-bold text-gray-800">คิงส์สว่าง โรงงานน้ำแข็งและน้ำดื่ม</p></div><div className="text-right"><p className="font-bold text-xl mb-1">เลขที่เอกสาร: <span className="font-normal text-gray-800">{printInvoice.invoiceNo}</span></p><p className="font-bold text-base">วันที่: <span className="font-normal text-gray-800">{printInvoice.date}</span></p></div></div><div className="mb-8 p-6 border-2 border-gray-300 rounded-xl bg-white text-sm"><div className="grid grid-cols-12 gap-y-3"><div className="col-span-3 font-bold">ชื่อลูกค้า / ร้านค้า:</div><div className="col-span-9 font-black text-lg">{printInvoice.debtor.name}</div><div className="col-span-3 font-bold">ที่อยู่ / สายส่ง:</div><div className="col-span-9">{printInvoice.debtor.address} | Tax ID: {printInvoice.debtor.taxId || '-'}</div></div></div><table className="w-full border-collapse border-2 border-black text-base mb-8"><thead><tr className="bg-gray-100 border-b-2 border-black text-center"><th className="border-r border-black py-3 px-2 w-16">ลำดับ</th><th className="border-r border-black py-3 px-4">รายการสินค้า</th><th className="border-r border-black py-3 px-2 w-24">จำนวน</th><th className="border-r border-black py-3 px-2 w-32">ราคา/หน่วย</th><th className="py-3 px-4 w-40">จำนวนเงิน</th></tr></thead><tbody>{printInvoice.items.map((item: any, idx: number) => (<tr key={idx} className="border-b border-gray-300"><td className="border-r border-black p-3 text-center">{idx + 1}</td><td className="border-r border-black p-3 font-bold">{item.name}</td><td className="border-r border-black p-3 text-center">{item.qty}</td><td className="border-r border-black p-3 text-right">{item.price.toLocaleString()}</td><td className="p-3 text-right font-black">{item.total.toLocaleString()}</td></tr>))}<tr className="h-20"><td className="border-r border-black"></td><td className="border-r border-black p-4 text-gray-500 align-top">หมายเหตุ: {printInvoice.note}</td><td className="border-r border-black"></td><td className="border-r border-black"></td><td></td></tr><tr className="bg-gray-100 border-t-2 border-black"><td colSpan={4} className="border-r border-black p-4 font-black text-right text-lg">ยอดรวมใบแจ้งหนี้</td><td className="p-4 text-right font-black text-3xl">{printInvoice.totalAmount.toLocaleString()}</td></tr></tbody></table></div> )}
    </>
  )
}