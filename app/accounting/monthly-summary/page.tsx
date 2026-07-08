'use client'

import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'

export default function MonthlySummaryPage() {
  const currentDate = new Date()
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth())
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear())
  
  const [sales, setSales] = useState<any[]>([])
  const [expenses, setExpenses] = useState<any[]>([])
  const [poList, setPoList] = useState<any[]>([])
  const [debtors, setDebtors] = useState<any[]>([]) // 🌟 State เก็บลูกหนี้
  
  const [isLoading, setIsLoading] = useState(true)
  const [employeeName, setEmployeeName] = useState('ผู้บริหาร')

  // 🌟 State สำหรับ Popup ดูรายละเอียดรายวัน
  const [selectedDayDetail, setSelectedDayDetail] = useState<any>(null)

  useEffect(() => {
    const session = localStorage.getItem('kingsawang_session')
    if (session) setEmployeeName(JSON.parse(session).name)
    
    fetchMonthlyData()
  }, [selectedMonth, selectedYear])

  const fetchMonthlyData = async () => {
    setIsLoading(true)
    try {
      const startDate = new Date(selectedYear, selectedMonth, 1).toLocaleDateString('en-CA')
      const endDate = new Date(selectedYear, selectedMonth + 1, 0).toLocaleDateString('en-CA')
      
      const [salesRes, expRes, poRes, debtorsRes] = await Promise.all([
        supabase.from('sales').select('totalAmount, payMethod, createdAt').gte('createdAt', `${startDate}T00:00:00+07:00`).lte('createdAt', `${endDate}T23:59:59+07:00`),
        supabase.from('expenses').select('amount, category, note, created_at').gte('created_at', `${startDate}T00:00:00+07:00`).lte('created_at', `${endDate}T23:59:59+07:00`),
        supabase.from('purchase_orders').select('id, totalAmount, supplierName, date').eq('status', 'received').gte('date', startDate).lte('date', endDate),
        // 🌟 ดึงข้อมูลลูกหนี้
        supabase.from('debtors').select('*')
      ])

      setSales(salesRes.data || [])
      setExpenses(expRes.data || [])
      setPoList(poRes.data || [])
      setDebtors(debtorsRes.data || []) // สมมติว่ามีตาราง debtors ถ้ายอดเป็น mockup จะใช้ค่าจำลองแทนได้
      
    } catch (err) {
      console.error('Error fetching data:', err)
    } finally {
      setIsLoading(false)
    }
  }

  // 🧮 คำนวณสรุปยอด
  const summary = useMemo(() => {
    let totalCash = 0
    let totalTransfer = 0
    let totalDailyExpense = 0
    let totalPoExpense = 0

    sales.forEach(s => {
      if (s.payMethod === 'cash') totalCash += Number(s.totalAmount)
      if (s.payMethod === 'transfer') totalTransfer += Number(s.totalAmount)
    })
    
    expenses.forEach(e => totalDailyExpense += Number(e.amount))
    poList.forEach(po => totalPoExpense += Number(po.totalAmount))

    const totalIncome = totalCash + totalTransfer
    const totalExpense = totalDailyExpense + totalPoExpense
    const netProfit = totalIncome - totalExpense

    return { totalCash, totalTransfer, totalIncome, totalDailyExpense, totalPoExpense, totalExpense, netProfit }
  }, [sales, expenses, poList])

  // 📅 แจกแจงรายวัน พร้อมยัดไส้ในรายการเพื่อแสดงบน Popup
  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate()
  const dailyData = useMemo(() => {
    const days = Array.from({ length: daysInMonth }, (_, i) => ({
      day: i + 1, cash: 0, transfer: 0, dailyExp: 0, poExp: 0, expense: 0, income: 0, profit: 0,
      expenseDetails: [] as any[], // เก็บไส้ในรายจ่าย
      poDetails: [] as any[]       // เก็บไส้ในจัดซื้อ
    }))

    sales.forEach(s => {
      const day = new Date(s.createdAt).getDate()
      if (day >= 1 && day <= daysInMonth) {
        const amt = Number(s.totalAmount)
        if (s.payMethod === 'cash') days[day - 1].cash += amt
        if (s.payMethod === 'transfer') days[day - 1].transfer += amt
        days[day - 1].income += amt
      }
    })

    expenses.forEach(e => {
      const dateStr = e.created_at || e.date
      const day = dateStr ? new Date(dateStr).getDate() : 0
      if (day >= 1 && day <= daysInMonth) {
        days[day - 1].dailyExp += Number(e.amount)
        days[day - 1].expense += Number(e.amount)
        days[day - 1].expenseDetails.push(e) // 🌟 เก็บข้อมูลไว้กดดู
      }
    })

    poList.forEach(po => {
      const day = new Date(po.date).getDate()
      if (day >= 1 && day <= daysInMonth) {
        days[day - 1].poExp += Number(po.totalAmount)
        days[day - 1].expense += Number(po.totalAmount)
        days[day - 1].poDetails.push(po) // 🌟 เก็บข้อมูลไว้กดดู
      }
    })

    days.forEach(d => d.profit = d.income - d.expense)
    return days
  }, [sales, expenses, poList, daysInMonth])

  const thaiMonths = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ]
  const years = Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - i)

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 md:p-6 font-sans">
      <style dangerouslySetInnerHTML={{__html: `
        @media print { 
          @page { size: A4 portrait; margin: 10mm; }
          body { background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .print-break-inside-avoid { break-inside: avoid; }
        }
      `}} />

      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6 print:hidden">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center text-3xl shadow-sm border border-blue-100">📈</div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">สรุปงบประจำเดือน</h1>
              <p className="text-slate-500 font-medium text-sm mt-1">รายงานรายรับ-รายจ่าย และกำไรสุทธิ</p>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
            <div className="flex bg-slate-50 border border-slate-200 rounded-xl p-1 shadow-inner w-full sm:w-auto">
              <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))} className="bg-transparent border-none font-bold text-slate-700 px-4 py-3 focus:outline-none focus:ring-0 cursor-pointer">
                {thaiMonths.map((m, i) => <option key={i} value={i}>{m}</option>)}
              </select>
              <div className="w-px bg-slate-200 my-2"></div>
              <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} className="bg-transparent border-none font-bold text-slate-700 px-4 py-3 focus:outline-none focus:ring-0 cursor-pointer">
                {years.map(y => <option key={y} value={y}>{y + 543}</option>)}
              </select>
            </div>
            <button onClick={() => window.print()} className="bg-slate-900 hover:bg-black text-white px-6 py-4 rounded-xl font-bold transition-all shadow-lg active:scale-95 flex items-center gap-2 w-full sm:w-auto justify-center">
              🖨️ พิมพ์รายงาน
            </button>
          </div>
        </div>

        {/* 🌟 เพิ่มทะเบียนลูกหนี้เข้ามาในหน้านี้ (จากรูป Screenshot 2026-07-01 120247.png) */}
        <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-100 shadow-sm print:break-inside-avoid">
          <h2 className="text-lg font-black text-slate-900 mb-5 flex items-center gap-2">
            📝 ทะเบียนลูกหนี้รายเดือน
          </h2>
          <div className="divide-y divide-slate-50">
            {debtors.length === 0 ? (
              <p className="text-slate-400 font-bold py-4">ไม่มียอดลูกหนี้ค้างชำระ</p>
            ) : (
              debtors.map((debtor, idx) => (
                <div key={idx} className="flex justify-between items-center py-3">
                  <span className="font-bold text-slate-800 text-sm">{debtor.name || debtor.customer_name}</span>
                  <span className="font-black text-rose-600 text-base">
                    {Number(debtor.outstanding || debtor.amount || 0).toLocaleString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-20 font-bold text-slate-400 text-lg">⏳ กำลังคำนวณงบประมาณ...</div>
        ) : (
          <>
            {/* KPI Cards (3 กล่อง) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-[2rem] p-6 border-2 border-emerald-100 shadow-sm relative overflow-hidden group print:border-black print:rounded-none">
                <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-50 rounded-full group-hover:scale-150 transition-transform duration-500 ease-out print:hidden"></div>
                <div className="relative z-10">
                  <p className="text-emerald-600 font-bold text-sm mb-1">รายรับรวมทั้งหมด</p>
                  <p className="font-black text-4xl text-slate-900 tracking-tight mb-4">{summary.totalIncome.toLocaleString()} <span className="text-lg font-bold text-slate-500">บ.</span></p>
                  <div className="flex justify-between items-center bg-emerald-50/50 p-3 rounded-xl text-xs font-bold print:bg-transparent print:p-0 print:border-t print:border-dashed print:pt-2">
                    <span className="text-slate-600">เงินสด: <span className="text-emerald-700">{summary.totalCash.toLocaleString()}</span></span>
                    <span className="text-slate-600">โอนเงิน: <span className="text-emerald-700">{summary.totalTransfer.toLocaleString()}</span></span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-[2rem] p-6 border-2 border-rose-100 shadow-sm relative overflow-hidden group print:border-black print:rounded-none">
                <div className="absolute -right-4 -top-4 w-24 h-24 bg-rose-50 rounded-full group-hover:scale-150 transition-transform duration-500 ease-out print:hidden"></div>
                <div className="relative z-10">
                  <p className="text-rose-600 font-bold text-sm mb-1">รายจ่ายรวมทั้งหมด</p>
                  <p className="font-black text-4xl text-slate-900 tracking-tight mb-4">{summary.totalExpense.toLocaleString()} <span className="text-lg font-bold text-slate-500">บ.</span></p>
                  
                  <div className="bg-rose-50/50 p-3 rounded-xl text-xs font-bold print:bg-transparent print:p-0 print:border-t print:border-dashed print:pt-2">
                    <div className="flex justify-between items-center text-slate-600 mb-1">
                      <span>รายจ่ายย่อย (รายวัน):</span><span className="text-rose-700">{summary.totalDailyExpense.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-600">
                      <span>บิลจัดซื้อ (PO):</span><span className="text-rose-700">{summary.totalPoExpense.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className={`bg-white rounded-[2rem] p-6 border-2 shadow-sm relative overflow-hidden group print:border-black print:rounded-none ${summary.netProfit >= 0 ? 'border-blue-100' : 'border-rose-200'}`}>
                <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full group-hover:scale-150 transition-transform duration-500 ease-out print:hidden ${summary.netProfit >= 0 ? 'bg-blue-50' : 'bg-rose-50'}`}></div>
                <div className="relative z-10">
                  <p className={`font-bold text-sm mb-1 ${summary.netProfit >= 0 ? 'text-blue-600' : 'text-rose-600'}`}>กำไรสุทธิ (Net Profit)</p>
                  <p className={`font-black text-4xl tracking-tight mb-4 ${summary.netProfit >= 0 ? 'text-blue-700' : 'text-rose-600'}`}>
                    {summary.netProfit.toLocaleString()} <span className="text-lg font-bold text-slate-500">บ.</span>
                  </p>
                  <div className={`p-3 rounded-xl text-xs font-bold print:bg-transparent print:p-0 print:border-t print:border-dashed print:pt-2 ${summary.netProfit >= 0 ? 'bg-blue-50/50 text-blue-700' : 'bg-rose-50 text-rose-700'}`}>
                    {summary.netProfit >= 0 ? '🎉 เดือนนี้มีกำไร! ยอดเยี่ยมมาก' : '⚠️ เดือนนี้ขาดทุน ตรวจสอบรายจ่ายด่วน'}
                  </div>
                </div>
              </div>
            </div>

            {/* 🌟 ตารางแจกแจงรายวัน (คลิกดูรายละเอียดได้) */}
            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden print:border-black print:rounded-none">
              <div className="p-6 border-b border-slate-100 bg-slate-50 print:bg-transparent print:border-black flex justify-between items-center">
                <h3 className="font-black text-slate-800 text-lg flex items-center gap-2">📅 ตารางแจกแจงรายวัน (วันที่ 1 - {daysInMonth})</h3>
                <span className="text-[10px] bg-blue-100 text-blue-600 px-3 py-1 rounded-full font-bold print:hidden animate-pulse">👆 คลิกที่แถวเพื่อดูรายละเอียดรายจ่าย</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left print:text-[10px]">
                  <thead className="bg-white border-b-2 border-slate-200 text-slate-500 text-xs whitespace-nowrap print:border-black">
                    <tr>
                      <th className="p-4 font-black text-center">วันที่</th>
                      <th className="p-4 font-black text-right text-emerald-600 bg-emerald-50/30">รายรับ (สด)</th>
                      <th className="p-4 font-black text-right text-emerald-600 bg-emerald-50/30">รายรับ (โอน)</th>
                      <th className="p-4 font-black text-right text-emerald-700 bg-emerald-100/50">รวมรายรับ</th>
                      <th className="p-4 font-black text-right text-rose-600 bg-rose-50/50">รายจ่ายย่อย</th>
                      <th className="p-4 font-black text-right text-rose-700 bg-rose-100/50">จัดซื้อ (PO)</th>
                      <th className="p-4 font-black text-right text-rose-800 bg-rose-200/50">รวมรายจ่าย</th>
                      <th className="p-4 font-black text-right text-blue-700 bg-blue-50/50 border-l border-slate-100">กำไรสุทธิ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 print:divide-black/20 text-sm">
                    {dailyData.map((d) => (
                      <tr 
                        key={d.day} 
                        // 🌟 ทำให้แถวคลิกได้ 
                        onClick={() => setSelectedDayDetail(d)}
                        className={`transition-colors ${(d.income > 0 || d.expense > 0) ? 'cursor-pointer hover:bg-blue-50 hover:shadow-inner' : 'text-slate-300'}`}
                      >
                        <td className="p-4 text-center font-bold">{d.day}</td>
                        <td className="p-4 text-right">{d.cash > 0 ? d.cash.toLocaleString() : '-'}</td>
                        <td className="p-4 text-right">{d.transfer > 0 ? d.transfer.toLocaleString() : '-'}</td>
                        <td className="p-4 text-right font-black text-emerald-600">{d.income > 0 ? d.income.toLocaleString() : '-'}</td>
                        
                        <td className="p-4 text-right text-rose-500">{d.dailyExp > 0 ? d.dailyExp.toLocaleString() : '-'}</td>
                        <td className="p-4 text-right font-black text-rose-700 bg-rose-50/30">{d.poExp > 0 ? d.poExp.toLocaleString() : '-'}</td>
                        
                        <td className="p-4 text-right font-black text-rose-800">{d.expense > 0 ? d.expense.toLocaleString() : '-'}</td>
                        <td className={`p-4 text-right font-black border-l border-slate-50 ${d.profit > 0 ? 'text-blue-600' : d.profit < 0 ? 'text-rose-600' : ''}`}>
                          {d.profit !== 0 ? d.profit.toLocaleString() : '-'}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-slate-100 font-black text-base print:bg-transparent print:border-t-2 print:border-black">
                      <td className="p-5 text-center text-slate-800">รวมทั้งเดือน</td>
                      <td className="p-5 text-right text-slate-700">{summary.totalCash.toLocaleString()}</td>
                      <td className="p-5 text-right text-slate-700">{summary.totalTransfer.toLocaleString()}</td>
                      <td className="p-5 text-right text-emerald-600">{summary.totalIncome.toLocaleString()}</td>
                      
                      <td className="p-5 text-right text-rose-500">{summary.totalDailyExpense.toLocaleString()}</td>
                      <td className="p-5 text-right text-rose-700">{summary.totalPoExpense.toLocaleString()}</td>
                      
                      <td className="p-5 text-right text-rose-800">{summary.totalExpense.toLocaleString()}</td>
                      <td className={`p-5 text-right ${summary.netProfit >= 0 ? 'text-blue-700' : 'text-rose-600'}`}>{summary.netProfit.toLocaleString()}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            
          </>
        )}
      </div>

      {/* 🚀 Modal: Popup ดูรายละเอียดรายจ่ายของวันนั้นๆ */}
      {selectedDayDetail && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 print:hidden">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            
            <div className="p-5 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-black text-slate-800 text-lg flex items-center gap-2">
                📅 วันที่ {selectedDayDetail.day} {thaiMonths[selectedMonth]} {selectedYear + 543}
              </h3>
              <button onClick={() => setSelectedDayDetail(null)} className="w-8 h-8 rounded-full bg-white text-slate-400 font-bold hover:text-rose-500 shadow-sm border border-slate-200 flex items-center justify-center">✕</button>
            </div>
            
            <div className="p-6 max-h-[60vh] overflow-y-auto space-y-6">
              
              {/* กลุ่มรายจ่ายย่อย */}
              <div>
                <h4 className="font-bold text-rose-600 border-b-2 border-rose-100 pb-2 mb-3 flex items-center gap-2">💸 รายจ่ายย่อย (รายวัน)</h4>
                {selectedDayDetail.expenseDetails.length === 0 ? (
                  <p className="text-xs text-slate-400 font-bold text-center py-2 bg-slate-50 rounded-lg">ไม่มีการบันทึกรายจ่ายย่อย</p>
                ) : (
                  <div className="space-y-2">
                    {selectedDayDetail.expenseDetails.map((exp: any, i: number) => (
                      <div key={i} className="flex justify-between items-center bg-rose-50/50 p-3 rounded-xl border border-rose-100 text-sm">
                        <div>
                          <p className="font-bold text-slate-700">{exp.category}</p>
                          {exp.note && <p className="text-[10px] text-slate-500 mt-0.5">📝 {exp.note}</p>}
                        </div>
                        <span className="font-black text-rose-600">{Number(exp.amount).toLocaleString()} บ.</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* กลุ่มจัดซื้อ PO */}
              <div>
                <h4 className="font-bold text-rose-800 border-b-2 border-rose-200 pb-2 mb-3 flex items-center gap-2">📦 บิลจัดซื้อ (PO)</h4>
                {selectedDayDetail.poDetails.length === 0 ? (
                  <p className="text-xs text-slate-400 font-bold text-center py-2 bg-slate-50 rounded-lg">ไม่มีบิลจัดซื้อ</p>
                ) : (
                  <div className="space-y-2">
                    {selectedDayDetail.poDetails.map((po: any, i: number) => (
                      <div key={i} className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-200 text-sm">
                        <div>
                          <p className="font-bold text-slate-800">{po.supplierName}</p>
                          <p className="text-[10px] text-blue-500 font-bold mt-0.5">Ref: {po.id}</p>
                        </div>
                        <span className="font-black text-rose-700">{Number(po.totalAmount).toLocaleString()} บ.</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* สรุปรวมของวัน */}
              <div className="border-t-2 border-slate-100 pt-4 flex justify-between items-end">
                <span className="font-bold text-slate-500">รวมรายจ่ายวันนี้:</span>
                <span className="text-2xl font-black text-rose-600">{selectedDayDetail.expense.toLocaleString()} <span className="text-sm text-slate-500">บ.</span></span>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  )
}