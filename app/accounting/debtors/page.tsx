'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function DebtorsPage() {
  const [debtors, setDebtors] = useState<any[]>([])
  const [selectedDebtor, setSelectedDebtor] = useState<any>(null)
  const [transactions, setTransactions] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // States สำหรับป๊อปอัป
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [newDebtorForm, setNewDebtorForm] = useState({ name: '', phone: '', address: '', route: 'สาย 1 (ในเมือง)', taxId: '', creditLimit: '50000' })
  
  const [isPayModalOpen, setIsPayModalOpen] = useState(false)
  const [payForm, setPayForm] = useState({ amount: '', note: '' })
  const [employeeName, setEmployeeName] = useState('ผู้ดูแลระบบ')

  useEffect(() => {
    const session = localStorage.getItem('kingsawang_session')
    if (session) setEmployeeName(JSON.parse(session).name)
    fetchDebtors()
  }, [])

  // 🌟 ดึงข้อมูลลูกหนี้ (ใช้ outstanding ตาม Schema ของคุณ)
  const fetchDebtors = async () => {
    setIsLoading(true)
    const { data } = await supabase.from('debtors').select('*').order('name')
    if (data) setDebtors(data)
    setIsLoading(false)
  }

  // 🌟 ดึงประวัติธุรกรรม (ใช้ debtor_id ตาม Schema ของคุณเป๊ะๆ)
  const fetchTransactions = async (debtorId: string) => {
    const { data } = await supabase.from('debtor_transactions').select('*').eq('debtor_id', debtorId).order('createdAt', { ascending: false })
    if (data) setTransactions(data)
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
      outstanding: 0 // 🌟 ใช้ outstanding
    }])
    if (!error) {
      alert('เพิ่มลูกหนี้สำเร็จ')
      setIsAddModalOpen(false)
      setNewDebtorForm({ name: '', phone: '', address: '', route: 'สาย 1 (ในเมือง)', taxId: '', creditLimit: '50000' })
      fetchDebtors()
    } else { alert(error.message) }
  }

  const handlePayment = async () => {
    const payAmount = Number(payForm.amount)
    if (payAmount <= 0) return alert('กรุณาระบุจำนวนเงินที่ถูกต้อง')
    if (!selectedDebtor) return

    const { data: currentDebtor } = await supabase.from('debtors').select('outstanding').eq('id', selectedDebtor.id).single()
    const newDebt = Number(currentDebtor?.outstanding || 0) - payAmount

    // บันทึกประวัติการจ่าย
    await supabase.from('debtor_transactions').insert([{
      id: `PAY-${Date.now()}`,
      debtor_id: selectedDebtor.id, // 🌟 ใช้ debtor_id (Snake Case)
      // ลบ debtorName ทิ้งเพราะไม่มีใน Schema ในภาพ
      date: new Date().toISOString().split('T')[0],
      type: 'pay',
      amount: payAmount,
      note: payForm.note ? `ชำระหนี้: ${payForm.note}` : 'ชำระหนี้ค้าง',
      // by: employeeName
    }])

    // อัปเดตยอดหนี้คงเหลือ
    await supabase.from('debtors').update({ outstanding: newDebt }).eq('id', selectedDebtor.id)

    alert('✅ บันทึกรับชำระเงินสำเร็จ')
    setIsPayModalOpen(false)
    setPayForm({ amount: '', note: '' })
    fetchDebtors()
    
    // อัปเดตข้อมูลที่เลือกอยู่ปัจจุบัน
    setSelectedDebtor({ ...selectedDebtor, outstanding: newDebt })
    fetchTransactions(selectedDebtor.id)
  }

  // 🌟 ฟังก์ชันแกะข้อมูลบิลจากหน้าบัญชี
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
    }
    return { docNo, itemsDesc }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row text-sm font-sans">
      
      {/* 🟢 PANEL ซ้าย: รายชื่อลูกหนี้ */}
      <div className="w-full md:w-[350px] lg:w-[400px] bg-white border-r border-slate-200 shadow-sm flex flex-col shrink-0 h-screen sticky top-0">
        <div className="p-6 border-b border-slate-100 bg-white z-10 shrink-0">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-xl font-black text-slate-800 flex items-center gap-2"><span className="text-2xl">🤝</span> ทะเบียนลูกหนี้</h1>
            <Link href="/" className="bg-slate-100 hover:bg-slate-200 text-slate-600 p-2 rounded-xl transition-colors font-bold">🏠 ออก</Link>
          </div>
          <button onClick={() => setIsAddModalOpen(true)} className="w-full bg-blue-50 hover:bg-blue-100 text-blue-600 font-bold py-3 rounded-xl border border-blue-200 transition-colors flex items-center justify-center gap-2 shadow-sm">
            ➕ เพิ่มลูกหนี้ใหม่
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {isLoading ? (<p className="text-center text-slate-400 font-bold mt-10">⏳ กำลังโหลดข้อมูล...</p>) : debtors.length === 0 ? (<p className="text-center text-slate-400 font-bold mt-10">ไม่พบข้อมูลลูกหนี้</p>) : (
            debtors.map(debtor => (
              <button key={debtor.id} onClick={() => handleSelectDebtor(debtor)} className={`w-full text-left p-4 rounded-2xl border-2 transition-all ${selectedDebtor?.id === debtor.id ? 'bg-blue-600 border-blue-600 shadow-md transform scale-[1.02]' : 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-sm'}`}>
                <div className="flex justify-between items-start mb-2">
                  <h3 className={`font-black text-base ${selectedDebtor?.id === debtor.id ? 'text-white' : 'text-slate-800'}`}>{debtor.name}</h3>
                </div>
                <div className={`flex justify-between items-end ${selectedDebtor?.id === debtor.id ? 'text-blue-100' : 'text-slate-500'}`}>
                  <p className="text-xs font-bold">{debtor.phone || 'ไม่ระบุเบอร์'}</p>
                  <div className="text-right">
                    <p className="text-[10px] font-bold uppercase tracking-wider opacity-80 mb-0.5">ยอดค้างชำระ</p>
                    {/* 🌟 แก้ไขเป็น outstanding ป้องกันค่า NaN */}
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
            
            {/* Header รายละเอียดลูกหนี้ */}
            <div className="p-6 md:p-8 bg-white border-b border-slate-200 shadow-sm shrink-0 z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div>
                <h2 className="text-2xl md:text-3xl font-black text-slate-800 mb-1">{selectedDebtor.name}</h2>
                <p className="text-slate-500 font-bold text-sm">📞 {selectedDebtor.phone || '-'} | 📍 {selectedDebtor.address || 'ไม่มีข้อมูลที่อยู่'}</p>
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex items-center gap-6 w-full md:w-auto shadow-inner">
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">ยอดค้างชำระสะสม</p>
                  {/* 🌟 แก้ไขเป็น outstanding */}
                  <p className={`text-3xl font-black ${Number(selectedDebtor.outstanding) > 0 ? 'text-rose-600' : 'text-emerald-500'}`}>{Number(selectedDebtor.outstanding || 0).toLocaleString()} <span className="text-sm">บาท</span></p>
                </div>
                <button onClick={() => setIsPayModalOpen(true)} className="bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-black px-6 py-3.5 rounded-xl shadow-md transition-all flex items-center gap-2">
                  <span>💰</span> รับชำระหนี้
                </button>
              </div>
            </div>

            {/* ประวัติการทำรายการ (ตาราง) */}
            <div className="flex-1 overflow-y-auto p-4 md:p-8">
              <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                  <h3 className="font-black text-lg text-slate-800 flex items-center gap-2">📋 ประวัติการซื้อและการชำระเงิน</h3>
                  <span className="text-xs font-bold text-slate-500 bg-white px-3 py-1 rounded-full border border-slate-200 shadow-sm">ทั้งหมด {transactions.length} รายการ</span>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-white border-b-2 border-slate-200 text-slate-500 text-xs">
                      <tr>
                        <th className="p-4 font-black whitespace-nowrap">วันที่ / เวลา</th>
                        <th className="p-4 font-black whitespace-nowrap text-center">ประเภท</th>
                        <th className="p-4 font-black whitespace-nowrap">อ้างอิงเอกสาร</th>
                        <th className="p-4 font-black min-w-[250px]">รายการสินค้า / หมายเหตุ</th>
                        <th className="p-4 font-black text-right whitespace-nowrap">ยอดเงิน (บาท)</th>
                        {/* <th className="p-4 font-black text-center whitespace-nowrap">ผู้ทำรายการ</th> */}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {transactions.length === 0 ? (
                        <tr><td colSpan={6} className="p-12 text-center text-slate-400 font-bold text-base">ไม่มีประวัติทำรายการ</td></tr>
                      ) : (
                        transactions.map(trx => {
                          // รองรับทั้ง 'debt' และ 'borrow'
                          const isBorrow = trx.type === 'borrow' || trx.type === 'debt'
                          
                          // 🌟 เรียกใช้ฟังก์ชันแกะข้อมูล note
                          const { docNo, itemsDesc } = isBorrow ? parseTransactionNote(trx.note) : { docNo: '-', itemsDesc: trx.note }

                          return (
                            <tr key={trx.id} className="hover:bg-slate-50 transition-colors align-top">
                              <td className="p-4">
                                <p className="font-bold text-slate-800">{trx.date}</p>
                                <p className="text-[10px] text-slate-400 font-bold mt-0.5">{trx.createdAt ? new Date(trx.createdAt).toLocaleTimeString('th-TH') : '-'}</p>
                              </td>
                              <td className="p-4 text-center">
                                <span className={`px-3 py-1.5 rounded-lg text-[10px] font-black tracking-wide ${isBorrow ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
                                  {isBorrow ? '🔴 ซื้อเชื่อ (ค้างหนี้)' : '🟢 รับชำระเงิน'}
                                </span>
                              </td>
                              <td className="p-4 font-black text-slate-600">{docNo}</td>
                              <td className="p-4">
                                <p className={`text-xs font-bold leading-relaxed ${isBorrow ? 'text-slate-700' : 'text-emerald-700'}`}>{itemsDesc}</p>
                                
                                {/* 🌟 ถ้าข้อมูลในบิลถูกบันทึกมาเป็น JSON Array (จากระบบ POS หรือหน้าลงบิล) จะแสดงเป็นลิสต์สวยงาม */}
                                {trx.items && Array.isArray(trx.items) && trx.items.length > 0 && (
                                  <ul className="mt-2 space-y-1">
                                    {trx.items.map((item: any, idx: number) => (
                                      <li key={idx} className="text-[10px] text-slate-500 bg-white border border-slate-100 px-2 py-1 rounded flex justify-between">
                                        <span>- {item.name} ({item.qty} x {item.price}บ.)</span>
                                        <span className="font-bold text-slate-600">{Number(item.total || (item.qty * item.price)).toLocaleString()} บ.</span>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </td>
                              <td className={`p-4 text-right font-black text-base ${isBorrow ? 'text-rose-600' : 'text-emerald-500'}`}>
                                {isBorrow ? '+' : '-'}{Number(trx.amount).toLocaleString()}
                              </td>
                              {/* <td className="p-4 text-center font-bold text-slate-500 text-[11px]">{trx.by || '-'}</td> */}
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

      {/* ========================================= */}
      {/* MODALS ป๊อปอัปต่างๆ */}
      {/* ========================================= */}

      {/* 1. Modal เพิ่มลูกหนี้ */}
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

      {/* 2. Modal รับชำระเงิน */}
      {isPayModalOpen && selectedDebtor && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 bg-emerald-50 flex justify-between items-center">
              <h3 className="font-black text-lg text-emerald-800">💰 รับชำระหนี้</h3>
              <button onClick={() => setIsPayModalOpen(false)} className="text-slate-400 hover:text-rose-500 font-bold bg-white w-8 h-8 rounded-full shadow-sm">✕</button>
            </div>
            <div className="p-6 space-y-5">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-center">
                <p className="text-xs font-bold text-slate-500 mb-1">ยอดหนี้ค้างชำระของ {selectedDebtor.name}</p>
                <p className="text-3xl font-black text-rose-600">{Number(selectedDebtor.outstanding || 0).toLocaleString()} <span className="text-sm">บ.</span></p>
              </div>

              <div className="space-y-1.5">
                <label className="font-black text-slate-700 text-sm">จำนวนเงินที่ชำระ (บาท) <span className="text-rose-500">*</span></label>
                <input type="number" min="1" value={payForm.amount} onChange={e => setPayForm({...payForm, amount: e.target.value})} className="w-full p-4 rounded-xl border-2 border-emerald-200 focus:border-emerald-500 outline-none font-black text-2xl text-emerald-600 text-center bg-emerald-50/30" placeholder="0" />
                <div className="flex gap-2 mt-2">
                  <button onClick={() => setPayForm({...payForm, amount: selectedDebtor.outstanding})} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 py-1.5 rounded-lg text-xs font-bold transition-colors">จ่ายเต็มจำนวน</button>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="font-bold text-slate-600 text-xs">หมายเหตุ (อ้างอิงบิล / เลขสลิปโอน)</label>
                <input type="text" value={payForm.note} onChange={e => setPayForm({...payForm, note: e.target.value})} className="w-full p-3 rounded-xl border border-slate-300 focus:border-emerald-500 outline-none font-bold text-sm" placeholder="เช่น ชำระบิล INV-001 หรือ โอน SCB..." />
              </div>
              <button onClick={handlePayment} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black py-4 rounded-xl shadow-lg transition-transform active:scale-95 text-base mt-2 flex items-center justify-center gap-2">
                <span>💾</span> ยืนยันรับชำระเงิน
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}