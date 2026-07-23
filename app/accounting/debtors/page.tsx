'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function DebtorsPage() {
  const [debtors, setDebtors] = useState<any[]>([])
  const [selectedDebtor, setSelectedDebtor] = useState<any>(null)
  const [transactions, setTransactions] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // States สำหรับป๊อปอัปจัดการข้อมูล
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [newDebtorForm, setNewDebtorForm] = useState({ name: '', phone: '', address: '', route: 'สาย 1 (ในเมือง)', taxId: '', creditLimit: '50000' })
  
  // States สำหรับรับชำระเงิน
  const [isPayModalOpen, setIsPayModalOpen] = useState(false)
  const [payForm, setPayForm] = useState({ amount: '', note: '', method: 'cash' })
  const [selectedInvoicesToPay, setSelectedInvoicesToPay] = useState<any[]>([])
  
  // States สำหรับดูและพิมพ์เอกสาร
  const [viewDoc, setViewDoc] = useState<any>(null)
  const [printDoc, setPrintDoc] = useState<any>(null)

  const [employeeName, setEmployeeName] = useState('ผู้ดูแลระบบ')

  useEffect(() => {
    const session = localStorage.getItem('kingsawang_session')
    if (session) setEmployeeName(JSON.parse(session).name)
    fetchDebtors()
  }, [])

  const fetchDebtors = async () => {
    setIsLoading(true)
    const { data } = await supabase.from('debtors').select('*').order('name')
    if (data) setDebtors(data)
    setIsLoading(false)
  }

  const fetchTransactions = async (debtorId: string) => {
    const { data, error } = await supabase
      .from('debtor_transactions')
      .select('*')
      .eq('debtor_id', debtorId)
      .order('date', { ascending: false })
      
    if (data) {
      const sortedData = data.sort((a, b) => b.id.localeCompare(a.id))
      setTransactions(sortedData)
    }
  }

  const handleSelectDebtor = (debtor: any) => {
    setSelectedDebtor(debtor)
    fetchTransactions(debtor.id)
  }

  const handleAddDebtor = async () => {
    if (!newDebtorForm.name) return alert('กรุณากรอกชื่อลูกหนี้')
    const { error } = await supabase.from('debtors').insert([{ 
      id: `CUST-${Date.now().toString().slice(-6)}`,
      name: newDebtorForm.name, 
      phone: newDebtorForm.phone, 
      address: newDebtorForm.address,
      route: newDebtorForm.route,
      taxId: newDebtorForm.taxId,
      creditLimit: Number(newDebtorForm.creditLimit),
      outstanding: 0
    }])
    if (!error) {
      alert('เพิ่มลูกหนี้สำเร็จ')
      setIsAddModalOpen(false)
      setNewDebtorForm({ name: '', phone: '', address: '', route: 'สาย 1 (ในเมือง)', taxId: '', creditLimit: '50000' })
      fetchDebtors()
    } else { alert(error.message) }
  }

  // 🌟 Logic การติ๊กเลือกบิลเพื่อจ่าย
  const handleToggleInvoice = (trx: any, isChecked: boolean) => {
    let updatedSelection = []
    if (isChecked) {
      updatedSelection = [...selectedInvoicesToPay, trx]
    } else {
      updatedSelection = selectedInvoicesToPay.filter(item => item.id !== trx.id)
    }
    setSelectedInvoicesToPay(updatedSelection)
    
    // คำนวณยอดเงินอัตโนมัติเมื่อเลือกบิล
    const totalSelected = updatedSelection.reduce((sum, item) => sum + Number(item.amount), 0)
    setPayForm({ 
      ...payForm, 
      amount: totalSelected > 0 ? totalSelected.toString() : '',
      note: updatedSelection.length > 0 ? `ชำระบิล: ${updatedSelection.map(i => parseTransactionNote(i.note).docNo).join(', ')}` : ''
    })
  }

  const handlePayment = async () => {
    const payAmount = Number(payForm.amount)
    if (payAmount <= 0) return alert('กรุณาระบุจำนวนเงินที่ถูกต้อง')
    if (!selectedDebtor) return

    const { data: currentDebtor } = await supabase.from('debtors').select('outstanding').eq('id', selectedDebtor.id).single()
    const newDebt = Number(currentDebtor?.outstanding || 0) - payAmount

    const receiptNo = `RC-${Date.now()}`
    const currentDate = new Date().toISOString().split('T')[0]

    // บันทึกประวัติการรับเงิน (Receipt)
    const newTransaction = {
      id: receiptNo,
      debtor_id: selectedDebtor.id, 
      date: currentDate,
      type: 'pay',
      amount: payAmount,
      note: payForm.note ? `[เลขที่เอกสาร: ${receiptNo}] รายการ: ${payForm.note} (${payForm.method === 'transfer' ? 'โอนเงิน' : 'เงินสด'})` : `[เลขที่เอกสาร: ${receiptNo}] รายการ: ชำระหนี้ค้าง (${payForm.method === 'transfer' ? 'โอนเงิน' : 'เงินสด'})`
    }

    await supabase.from('debtor_transactions').insert([newTransaction])
    await supabase.from('debtors').update({ outstanding: newDebt }).eq('id', selectedDebtor.id)

    alert('✅ บันทึกรับชำระเงินสำเร็จ')
    setIsPayModalOpen(false)
    setPayForm({ amount: '', note: '', method: 'cash' })
    setSelectedInvoicesToPay([])
    fetchDebtors()
    
    setSelectedDebtor({ ...selectedDebtor, outstanding: newDebt })
    fetchTransactions(selectedDebtor.id)
    
    // เด้งหน้าพิมพ์ใบเสร็จอัตโนมัติ
    handlePrintDoc({ ...newTransaction, createdAt: new Date().toISOString() })
  }

  // 🌟 ฟังก์ชันแกะข้อมูลอัจฉริยะ (ดึงเลขเอกสารและรายการ)
  const parseTransactionNote = (note: string) => {
    if (!note) return { docNo: '-', itemsDesc: '-' }
    
    let docNo = '-'
    let itemsDesc = note

    if (note.includes('[เลขที่เอกสาร:')) {
      const docMatch = note.match(/\[เลขที่เอกสาร:\s*(.*?)\]/)
      if (docMatch) docNo = docMatch[1]
      
      const itemStartIdx = note.indexOf('รายการ:')
      const routeStartIdx = note.indexOf('(สายส่ง:')
      
      if (itemStartIdx !== -1 && routeStartIdx !== -1) {
        itemsDesc = note.substring(itemStartIdx + 7, routeStartIdx).trim()
      } else if (itemStartIdx !== -1) {
        itemsDesc = note.substring(itemStartIdx + 7).trim()
      }
    } else if (note.includes('ชำระบิล')) {
      // สำหรับดึงเลขบิลกรณีเป็นโน้ตเก่า
      docNo = 'PAYMENT'
    }
    return { docNo, itemsDesc }
  }

  // ฟังก์ชันช่วยจัดรูปแบบเงินบัญชี
  const formatMoney = (amount: number) => {
    return Number(amount).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  // เปิดดูรายละเอียดเอกสาร
  const handleViewDoc = (trx: any) => {
    setViewDoc(trx)
  }

  // สั่งพิมพ์เอกสาร
  const handlePrintDoc = (trx: any) => {
    setViewDoc(null)
    setPrintDoc(trx)
    setTimeout(() => {
      window.print()
      setTimeout(() => setPrintDoc(null), 500)
    }, 300)
  }

  // กรองเอาเฉพาะบิลค้าง (ซื้อเชื่อ) มาให้เลือกชำระ
  const borrowTransactions = transactions.filter(t => t.type === 'borrow' || t.type === 'debt')

  return (
    <>
      {/* 🌟 CSS สำหรับจัดหน้ากระดาษ A4 แบบบัญชี */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print { 
          @page { size: A4 portrait; margin: 15mm; } 
          body { background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; } 
          .no-print { display: none !important; }
        }
      `}} />

      <div className={`min-h-screen bg-slate-50 flex flex-col md:flex-row text-sm font-sans ${printDoc ? 'hidden' : 'block'}`}>
        
        {/* 🟢 PANEL ซ้าย: รายชื่อลูกหนี้ */}
        <div className="w-full md:w-[350px] lg:w-[400px] bg-white border-r border-slate-200 shadow-sm flex flex-col shrink-0 h-screen sticky top-0">
          <div className="p-6 border-b border-slate-100 bg-white z-10 shrink-0">
            <div className="flex justify-between items-center mb-4">
              <h1 className="text-xl font-black text-slate-800 flex items-center gap-2"><span className="text-2xl">🤝</span> ทะเบียนลูกหนี้</h1>
              <Link href="/" className="bg-slate-100 hover:bg-slate-200 text-slate-600 p-2 rounded-xl transition-colors font-bold text-xs">🏠 ออก</Link>
            </div>
            <button onClick={() => setIsAddModalOpen(true)} className="w-full bg-blue-50 hover:bg-blue-100 text-blue-600 font-bold py-3 rounded-xl border border-blue-200 transition-colors flex items-center justify-center gap-2 shadow-sm">
              ➕ เพิ่มลูกหนี้ใหม่
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {isLoading ? (<p className="text-center text-slate-400 font-bold mt-10">⏳ กำลังโหลด...</p>) : debtors.length === 0 ? (<p className="text-center text-slate-400 font-bold mt-10">ไม่พบข้อมูล</p>) : (
              debtors.map(debtor => (
                <button key={debtor.id} onClick={() => handleSelectDebtor(debtor)} className={`w-full text-left p-4 rounded-2xl border-2 transition-all ${selectedDebtor?.id === debtor.id ? 'bg-blue-600 border-blue-600 shadow-md transform scale-[1.02]' : 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-sm'}`}>
                  <div className="flex justify-between items-start mb-2">
                    <h3 className={`font-black text-base truncate pr-2 ${selectedDebtor?.id === debtor.id ? 'text-white' : 'text-slate-800'}`}>{debtor.name}</h3>
                  </div>
                  <div className={`flex justify-between items-end ${selectedDebtor?.id === debtor.id ? 'text-blue-100' : 'text-slate-500'}`}>
                    <p className="text-xs font-bold">{debtor.phone || 'ไม่ระบุเบอร์'}</p>
                    <div className="text-right">
                      <p className="text-[10px] font-bold uppercase tracking-wider opacity-80 mb-0.5">ยอดค้างชำระ</p>
                      <p className={`font-black text-lg leading-none ${selectedDebtor?.id === debtor.id ? 'text-white' : Number(debtor.outstanding) > 0 ? 'text-rose-600' : 'text-emerald-500'}`}>{Number(debtor.outstanding || 0).toLocaleString()} บ.</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* 🔵 PANEL ขวา: รายละเอียดและประวัติ */}
        <div className="flex-1 flex flex-col bg-slate-50 overflow-hidden h-screen">
          {!selectedDebtor ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 opacity-50 space-y-4">
              <span className="text-7xl">🧾</span>
              <p className="font-bold text-xl">เลือกลูกหนี้จากเมนูด้านซ้ายเพื่อดูประวัติ</p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              
              {/* Header */}
              <div className="p-6 md:p-8 bg-white border-b border-slate-200 shadow-sm shrink-0 z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                  <h2 className="text-2xl md:text-3xl font-black text-slate-800 mb-1">{selectedDebtor.name}</h2>
                  <p className="text-slate-500 font-bold text-sm">📞 {selectedDebtor.phone || '-'} | 📍 {selectedDebtor.address || '-'}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex items-center gap-6 w-full md:w-auto shadow-inner">
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">ยอดค้างชำระสะสม</p>
                    <p className={`text-3xl font-black ${Number(selectedDebtor.outstanding) > 0 ? 'text-rose-600' : 'text-emerald-500'}`}>{formatMoney(Number(selectedDebtor.outstanding || 0))} <span className="text-sm">บาท</span></p>
                  </div>
                  <button onClick={() => { setPayForm({amount: '', note: '', method: 'cash'}); setSelectedInvoicesToPay([]); setIsPayModalOpen(true); }} className="bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-black px-6 py-3.5 rounded-xl shadow-md transition-all flex items-center gap-2">
                    <span>💰</span> รับชำระหนี้
                  </button>
                </div>
              </div>

              {/* ตารางประวัติ */}
              <div className="flex-1 overflow-y-auto p-4 md:p-8">
                <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                    <h3 className="font-black text-lg text-slate-800 flex items-center gap-2">📋 ประวัติการซื้อและการชำระเงิน (Statement)</h3>
                    <span className="text-xs font-bold text-slate-500 bg-white px-3 py-1 rounded-full border border-slate-200">ทั้งหมด {transactions.length} รายการ</span>
                  </div>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-white border-b-2 border-slate-200 text-slate-500 text-[11px] uppercase tracking-wider">
                        <tr>
                          <th className="p-4 font-black whitespace-nowrap">วันที่ / เวลา</th>
                          <th className="p-4 font-black whitespace-nowrap text-center">ประเภท</th>
                          <th className="p-4 font-black whitespace-nowrap">อ้างอิงเอกสาร</th>
                          <th className="p-4 font-black min-w-[250px]">รายการสินค้า / หมายเหตุ</th>
                          <th className="p-4 font-black text-right whitespace-nowrap">ยอดเงิน (บาท)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {transactions.length === 0 ? (
                          <tr><td colSpan={5} className="p-12 text-center text-slate-400 font-bold text-base">ไม่มีประวัติทำรายการ</td></tr>
                        ) : (
                          transactions.map(trx => {
                            const isBorrow = trx.type === 'borrow' || trx.type === 'debt'
                            const { docNo, itemsDesc } = parseTransactionNote(trx.note)

                            return (
                              <tr key={trx.id} className="hover:bg-blue-50/30 transition-colors align-top group">
                                <td className="p-4">
                                  <p className="font-bold text-slate-800">{trx.date}</p>
                                  <p className="text-[10px] text-slate-400 font-bold mt-0.5">{trx.createdAt ? new Date(trx.createdAt).toLocaleTimeString('th-TH') : '-'}</p>
                                </td>
                                <td className="p-4 text-center">
                                  <span className={`px-2.5 py-1 rounded-md text-[10px] font-black tracking-wide ${isBorrow ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
                                    {isBorrow ? '🔴 บิลแจ้งหนี้' : '🟢 รับชำระเงิน'}
                                  </span>
                                </td>
                                <td className="p-4 font-black">
                                  {/* 🌟 จุดที่ 1: คลิกเลขเอกสารเพื่อดูรายละเอียดและปริ้น */}
                                  <button onClick={() => handleViewDoc(trx)} className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 transition-colors">
                                    📄 {docNo}
                                  </button>
                                </td>
                                <td className="p-4">
                                  <p className={`font-bold leading-relaxed ${isBorrow ? 'text-slate-700' : 'text-emerald-700'}`}>{itemsDesc}</p>
                                  
                                  {trx.items && Array.isArray(trx.items) && trx.items.length > 0 && (
                                    <ul className="mt-2 space-y-1">
                                      {trx.items.map((item: any, idx: number) => (
                                        <li key={idx} className="text-[10px] text-slate-500 bg-white border border-slate-100 px-2 py-1 rounded flex justify-between shadow-sm">
                                          <span>- {item.productName || item.name} ({item.qty} x {item.price}บ.)</span>
                                          <span className="font-bold text-slate-600">{formatMoney(Number(item.total || (item.qty * item.price)))}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </td>
                                <td className={`p-4 text-right font-black text-sm ${isBorrow ? 'text-rose-600' : 'text-emerald-500'}`}>
                                  {isBorrow ? '+' : '-'}{formatMoney(Number(trx.amount))}
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

            </div>
          )}
        </div>
      </div>

      {/* ========================================= */}
      {/* 🌟 MODAL 1: ดูรายละเอียดเอกสารและปุ่มพิมพ์ */}
      {/* ========================================= */}
      {viewDoc && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className={`p-6 border-b flex justify-between items-center ${viewDoc.type === 'pay' ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-100'}`}>
              <div>
                <h3 className={`font-black text-lg ${viewDoc.type === 'pay' ? 'text-emerald-800' : 'text-slate-800'}`}>
                  {viewDoc.type === 'pay' ? '🧾 รายละเอียดใบเสร็จรับเงิน' : '📄 รายละเอียดใบแจ้งหนี้'}
                </h3>
                <p className="text-xs font-bold text-slate-500 mt-1">อ้างอิง: {parseTransactionNote(viewDoc.note).docNo}</p>
              </div>
              <button onClick={() => setViewDoc(null)} className="w-8 h-8 rounded-full bg-white text-slate-400 hover:text-rose-500 shadow-sm font-bold flex items-center justify-center">✕</button>
            </div>
            
            <div className="p-6 space-y-4 bg-white text-sm">
              <div className="flex justify-between border-b border-slate-100 pb-3">
                <span className="font-bold text-slate-500">วันที่ทำรายการ:</span>
                <span className="font-black text-slate-800">{viewDoc.date} {viewDoc.createdAt ? new Date(viewDoc.createdAt).toLocaleTimeString('th-TH') : ''}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-3">
                <span className="font-bold text-slate-500">ลูกหนี้ / ร้านค้า:</span>
                <span className="font-black text-slate-800">{selectedDebtor?.name}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-3">
                <span className="font-bold text-slate-500">รายละเอียด:</span>
                <span className="font-bold text-slate-700 text-right max-w-[60%]">{parseTransactionNote(viewDoc.note).itemsDesc}</span>
              </div>

              {viewDoc.items && Array.isArray(viewDoc.items) && (
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <p className="text-xs font-bold text-slate-500 mb-2">รายการสินค้า:</p>
                  <ul className="space-y-1">
                    {viewDoc.items.map((item: any, idx: number) => (
                      <li key={idx} className="text-xs flex justify-between font-bold text-slate-700">
                        <span>{item.productName || item.name} ({item.qty})</span>
                        <span>{formatMoney(Number(item.total || (item.qty * item.price)))}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className={`p-4 rounded-2xl flex justify-between items-center border ${viewDoc.type === 'pay' ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
                <span className={`font-bold ${viewDoc.type === 'pay' ? 'text-emerald-700' : 'text-rose-700'}`}>ยอดรวมสุทธิ:</span>
                <span className={`font-black text-2xl ${viewDoc.type === 'pay' ? 'text-emerald-600' : 'text-rose-600'}`}>{formatMoney(Number(viewDoc.amount))} บ.</span>
              </div>
            </div>

            <div className="p-5 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button onClick={() => setViewDoc(null)} className="flex-1 bg-white hover:bg-slate-100 text-slate-600 font-bold py-3 rounded-xl border border-slate-200 transition-colors">ปิดหน้าต่าง</button>
              <button onClick={() => handlePrintDoc(viewDoc)} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-black py-3 rounded-xl shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-2">
                🖨️ พิมพ์เอกสาร A4
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================= */}
      {/* 🌟 MODAL 2: รับชำระเงิน (เลือกบิลได้) */}
      {/* ========================================= */}
      {isPayModalOpen && selectedDebtor && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 bg-emerald-50 flex justify-between items-center shrink-0">
              <h3 className="font-black text-lg text-emerald-800">💰 บันทึกรับชำระหนี้ (Receipt)</h3>
              <button onClick={() => setIsPayModalOpen(false)} className="text-slate-400 hover:text-rose-500 font-bold bg-white w-8 h-8 rounded-full shadow-sm">✕</button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[75vh] flex flex-col md:flex-row gap-6">
              
              {/* ส่วนเลือกเอกสารอ้างอิง */}
              <div className="flex-1 space-y-3">
                <label className="font-black text-slate-700 text-sm">อ้างอิงเอกสารบิลค้าง (เลือกเพื่อรวมยอด)</label>
                <div className="border border-slate-200 rounded-xl overflow-hidden flex flex-col h-64">
                  <div className="bg-slate-100 p-2 text-xs font-bold text-slate-600 flex justify-between border-b border-slate-200">
                    <span>รายการบิล (Invoice)</span>
                    <span>ยอดเงิน</span>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-slate-50">
                    {borrowTransactions.length === 0 ? (
                      <p className="text-center text-slate-400 text-xs mt-10 font-bold">ไม่พบประวัติบิลค้าง</p>
                    ) : (
                      borrowTransactions.map(trx => {
                        const { docNo } = parseTransactionNote(trx.note)
                        const isSelected = selectedInvoicesToPay.some(i => i.id === trx.id)
                        return (
                          <label key={trx.id} className={`flex items-center justify-between p-3 rounded-lg border-2 cursor-pointer transition-colors ${isSelected ? 'bg-blue-50 border-blue-500' : 'bg-white border-slate-200 hover:border-blue-300'}`}>
                            <div className="flex items-center gap-3">
                              <input type="checkbox" checked={isSelected} onChange={(e) => handleToggleInvoice(trx, e.target.checked)} className="w-4 h-4 text-blue-600 rounded" />
                              <div>
                                <p className="font-bold text-slate-800 text-xs">{docNo}</p>
                                <p className="text-[10px] text-slate-500">{trx.date}</p>
                              </div>
                            </div>
                            <span className="font-black text-sm text-slate-700">{formatMoney(Number(trx.amount))}</span>
                          </label>
                        )
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* ส่วนระบุยอดเงินและยืนยัน */}
              <div className="w-full md:w-[280px] space-y-4 flex flex-col">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-center shadow-inner">
                  <p className="text-xs font-bold text-slate-500 mb-1">ยอดหนี้คงค้างทั้งหมด</p>
                  <p className="text-2xl font-black text-rose-600">{formatMoney(Number(selectedDebtor.outstanding || 0))} <span className="text-sm">บ.</span></p>
                </div>

                <div className="space-y-1.5">
                  <label className="font-black text-slate-700 text-sm">ยอดรับชำระจริง (บาท) <span className="text-rose-500">*</span></label>
                  <input type="number" min="1" value={payForm.amount} onChange={e => setPayForm({...payForm, amount: e.target.value})} className="w-full p-4 rounded-xl border-2 border-emerald-300 focus:border-emerald-500 outline-none font-black text-2xl text-emerald-700 text-center bg-emerald-50/50 shadow-sm" placeholder="0.00" />
                  <button onClick={() => setPayForm({...payForm, amount: selectedDebtor.outstanding})} className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 py-2 rounded-lg text-xs font-bold transition-colors mt-1 border border-slate-200">จ่ายเต็มจำนวนทั้งหมด</button>
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700 text-xs">วิธีรับชำระ</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setPayForm({...payForm, method: 'cash'})} className={`py-2.5 rounded-xl font-bold text-xs border-2 ${payForm.method === 'cash' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'border-slate-200 text-slate-500 bg-white'}`}>💵 เงินสด</button>
                    <button type="button" onClick={() => setPayForm({...payForm, method: 'transfer'})} className={`py-2.5 rounded-xl font-bold text-xs border-2 ${payForm.method === 'transfer' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'border-slate-200 text-slate-500 bg-white'}`}>📱 โอนเงิน</button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-slate-600 text-xs">หมายเหตุ</label>
                  <textarea rows={2} value={payForm.note} onChange={e => setPayForm({...payForm, note: e.target.value})} className="w-full p-3 rounded-xl border border-slate-300 focus:border-emerald-500 outline-none font-bold text-xs resize-none bg-white" placeholder="อ้างอิงบิล หรือ รายละเอียดเพิ่มเติม..." />
                </div>

              </div>
            </div>
            
            <div className="p-5 border-t border-slate-100 bg-slate-50 shrink-0">
              <button onClick={handlePayment} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black py-4 rounded-xl shadow-lg transition-transform active:scale-95 text-base flex items-center justify-center gap-2">
                <span>🖨️</span> ยืนยันรับชำระเงิน & พิมพ์ใบเสร็จ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Modal เพิ่มลูกหนี้ */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <h3 className="font-black text-lg text-slate-800">➕ เพิ่มลูกหนี้ใหม่</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-rose-500 font-bold bg-white w-8 h-8 rounded-full shadow-sm">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="font-bold text-slate-600 text-xs">ชื่อลูกหนี้ / ร้านค้า <span className="text-rose-500">*</span></label>
                <input type="text" value={newDebtorForm.name} onChange={e => setNewDebtorForm({...newDebtorForm, name: e.target.value})} className="w-full p-3 rounded-xl border border-slate-300 focus:border-blue-500 outline-none font-bold text-sm" placeholder="เช่น ร้านป้าแจ๋ว มินิมาร์ท" />
              </div>
              <div className="space-y-1.5">
                <label className="font-bold text-slate-600 text-xs">วงเงินเครดิตอนุมัติ</label>
                <input type="number" value={newDebtorForm.creditLimit} onChange={e => setNewDebtorForm({...newDebtorForm, creditLimit: e.target.value})} className="w-full p-3 rounded-xl border border-slate-300 focus:border-blue-500 outline-none font-bold text-sm" placeholder="50000" />
              </div>
              <div className="space-y-1.5">
                <label className="font-bold text-slate-600 text-xs">เบอร์โทรศัพท์</label>
                <input type="text" value={newDebtorForm.phone} onChange={e => setNewDebtorForm({...newDebtorForm, phone: e.target.value})} className="w-full p-3 rounded-xl border border-slate-300 focus:border-blue-500 outline-none font-bold text-sm" placeholder="08X-XXX-XXXX" />
              </div>
              <div className="space-y-1.5">
                <label className="font-bold text-slate-600 text-xs">สายส่งหลัก</label>
                <select value={newDebtorForm.route} onChange={e => setNewDebtorForm({...newDebtorForm, route: e.target.value})} className="w-full p-3 rounded-xl border border-slate-300 focus:border-blue-500 outline-none font-bold text-sm bg-white">
                  <option value="สาย 1 (ในเมือง)">สาย 1 (ในเมือง)</option>
                  <option value="สาย 2 (โซนเหนือ)">สาย 2 (โซนเหนือ)</option>
                  <option value="สาย 3 (อุตสาหกรรม)">สาย 3 (อุตสาหกรรม)</option>
                  <option value="หน้าร้าน (POS)">หน้าร้าน (POS)</option>
                  <option value="ไม่ได้ระบุ">ไม่ได้ระบุ</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="font-bold text-slate-600 text-xs">ที่อยู่ / รายละเอียด</label>
                <textarea value={newDebtorForm.address} onChange={e => setNewDebtorForm({...newDebtorForm, address: e.target.value})} className="w-full p-3 rounded-xl border border-slate-300 focus:border-blue-500 outline-none font-bold text-sm resize-none" rows={2} placeholder="รายละเอียดที่อยู่..." />
              </div>
              <button onClick={handleAddDebtor} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-3.5 rounded-xl shadow-lg transition-transform active:scale-95 mt-2">
                บันทึกลูกหนี้
              </button>
            </div>
          </div>
        </div>
      )}


      {/* ========================================= */}
      {/* 🖨️ หน้ากระดาษพิมพ์เอกสาร A4 (Invoice / Receipt) */}
      {/* ========================================= */}
      {printDoc && (
        <div className="hidden print:block text-black p-8 max-w-4xl mx-auto font-sans bg-white min-h-screen">
          
          {/* ส่วนหัวกระดาษ */}
          <div className="flex justify-between items-start mb-6 border-b-2 border-black pb-4">
            <div>
              <h1 className="text-3xl font-black mb-1 tracking-tight">{printDoc.type === 'pay' ? 'ใบเสร็จรับเงิน (RECEIPT)' : 'ใบแจ้งหนี้ (INVOICE)'}</h1>
              <p className="text-lg font-bold text-gray-800">โรงงานน้ำแข็ง คิงส์สว่าง</p>
              <p className="text-sm">ที่อยู่: 123 ถ.สุขุมวิท ต.ในเมือง อ.เมือง จ.สกลนคร 47000</p>
              <p className="text-sm">โทร: 08X-XXX-XXXX | เลขประจำตัวผู้เสียภาษี: 0123456789012</p>
            </div>
            <div className="text-right border border-gray-400 p-3 rounded text-sm min-w-[200px]">
              <p className="font-bold text-base mb-1">เลขที่: <span className="font-normal">{parseTransactionNote(printDoc.note).docNo}</span></p>
              <p className="font-bold">วันที่: <span className="font-normal">{printDoc.date}</span></p>
            </div>
          </div>

          {/* ข้อมูลลูกค้า */}
          <div className="mb-6 p-4 border border-black rounded text-sm flex justify-between">
            <div>
              <p className="font-bold mb-1">ลูกค้า / Customer:</p>
              <p className="font-black text-lg">{selectedDebtor?.name}</p>
              <p>{selectedDebtor?.address || '-'}</p>
              <p>โทร: {selectedDebtor?.phone || '-'} | Tax ID: {selectedDebtor?.taxId || '-'}</p>
            </div>
            <div className="text-right">
              <p className="font-bold">เงื่อนไขการชำระเงิน:</p>
              <p>{printDoc.type === 'pay' ? 'เงินสด/โอน' : 'เครดิต'}</p>
            </div>
          </div>

          {/* ตารางรายการ */}
          <table className="w-full border-collapse border border-black text-sm mb-6">
            <thead>
              <tr className="bg-gray-100 border-b border-black text-center font-bold">
                <th className="border-r border-black py-2 px-2 w-12">ลำดับ</th>
                <th className="border-r border-black py-2 px-4 text-left">รายการ (Description)</th>
                {printDoc.type === 'borrow' && <th className="border-r border-black py-2 px-2 w-24">จำนวน</th>}
                {printDoc.type === 'borrow' && <th className="border-r border-black py-2 px-2 w-28">ราคาหน่วยละ</th>}
                <th className="py-2 px-4 w-36 text-right">จำนวนเงิน (Amount)</th>
              </tr>
            </thead>
            <tbody>
              {printDoc.type === 'borrow' && printDoc.items && Array.isArray(printDoc.items) ? (
                printDoc.items.map((item: any, idx: number) => (
                  <tr key={idx} className="border-b border-gray-300">
                    <td className="border-r border-black p-2 text-center">{idx + 1}</td>
                    <td className="border-r border-black p-2">{item.productName || item.name}</td>
                    <td className="border-r border-black p-2 text-center">{item.qty}</td>
                    <td className="border-r border-black p-2 text-right">{formatMoney(Number(item.price))}</td>
                    <td className="p-2 text-right">{formatMoney(Number(item.total || (item.qty * item.price)))}</td>
                  </tr>
                ))
              ) : (
                <tr className="border-b border-gray-300">
                  <td className="border-r border-black p-4 text-center">1</td>
                  <td colSpan={printDoc.type === 'borrow' ? 3 : 1} className="border-r border-black p-4">{parseTransactionNote(printDoc.note).itemsDesc}</td>
                  <td className="p-4 text-right">{formatMoney(Number(printDoc.amount))}</td>
                </tr>
              )}
              {/* เติมช่องว่างให้ตารางดูเต็ม */}
              <tr className="h-32 align-top">
                <td className="border-r border-black"></td>
                <td colSpan={printDoc.type === 'borrow' ? 3 : 1} className="border-r border-black p-2 text-gray-500 italic">หมายเหตุ: {printDoc.type === 'pay' ? 'รับชำระหนี้เสร็จสมบูรณ์' : ''}</td>
                <td></td>
              </tr>
            </tbody>
            <tfoot>
              <tr className="border-t border-black bg-gray-50">
                <td colSpan={printDoc.type === 'borrow' ? 4 : 2} className="border-r border-black p-3 font-black text-right text-base">ยอดรวมสุทธิ (Grand Total)</td>
                <td className="p-3 text-right font-black text-xl underline">{formatMoney(Number(printDoc.amount))}</td>
              </tr>
            </tfoot>
          </table>

          {/* สรุปยอดคงเหลือ และลายเซ็น */}
          <div className="flex justify-between mt-12 text-sm">
            <div className="border border-gray-400 p-4 rounded bg-gray-50 h-fit">
              <p className="font-bold text-gray-600 mb-1">สถานะลูกหนี้ปัจจุบัน:</p>
              <p className="font-black text-base">ยอดหนี้คงค้าง: {formatMoney(Number(selectedDebtor?.outstanding))} บาท</p>
            </div>
            
            <div className="flex gap-12 text-center">
              <div>
                <div className="border-b border-black w-40 h-10 mb-2"></div>
                <p className="font-bold">ผู้รับเงิน / ผู้ส่งของ</p>
                <p className="text-xs mt-1 text-gray-500">วันที่ ......../......../........</p>
              </div>
              <div>
                <div className="border-b border-black w-40 h-10 mb-2"></div>
                <p className="font-bold">{printDoc.type === 'pay' ? 'ผู้จ่ายเงิน' : 'ผู้รับของ (ลูกค้า)'}</p>
                <p className="text-xs mt-1 text-gray-500">วันที่ ......../......../........</p>
              </div>
            </div>
          </div>

        </div>
      )}
    </>
  )
}