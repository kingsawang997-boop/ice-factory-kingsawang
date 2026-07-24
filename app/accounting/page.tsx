'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function AccountingDashboardPage() {
  const getTodayString = () => {
    const today = new Date()
    return new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0]
  }

  const [reportDate, setReportDate] = useState(getTodayString())
  const [isLoading, setIsLoading] = useState(true)
  
  // --- 🖨️ ระบบควบคุมการพิมพ์ ---
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false)
  const [printMode, setPrintMode] = useState('all')

  const [selectedRouteDetail, setSelectedRouteDetail] = useState<any>(null)

  const handlePrint = (mode: string) => {
    setPrintMode(mode)
    setIsPrintModalOpen(false)
    setTimeout(() => {
      window.print()
      setTimeout(() => setPrintMode('all'), 500) 
    }, 200)
  }

  const [dailyStats, setDailyStats] = useState({ totalRevenue: 0, totalExpense: 0, netProfit: 0, cashInDrawer: 0 })
  const [revenueSources, setRevenueSources] = useState<any[]>([])
  const [recentTransactions, setRecentTransactions] = useState<any[]>([])
  const [dailyArrears, setDailyArrears] = useState<any[]>([])

  useEffect(() => {
    fetchDashboardData()
  }, [reportDate])

  const fetchDashboardData = async () => {
    setIsLoading(true)
    const startOfDay = new Date(`${reportDate}T00:00:00+07:00`).toISOString()
    const endOfDay = new Date(`${reportDate}T23:59:59+07:00`).toISOString()

    try {
      // 🌟 ดึงข้อมูลจาก "ทุกตาราง" ที่เกี่ยวข้องกับเงิน
      const [
        salesRes, 
        expensesRes, 
        routesRes,
        payrollsRes,
        debtorPaysRes,
        coolerBorrowRes,
        coolerReturnRes
      ] = await Promise.all([
        supabase.from('sales').select('*').gte('createdAt', startOfDay).lte('createdAt', endOfDay),
        supabase.from('expenses').select('*').gte('created_at', startOfDay).lte('created_at', endOfDay),
        supabase.from('route_settlements').select('*').eq('date', reportDate).eq('status', 'received'), // ดึงเฉพาะสายส่งที่เคลียร์ยอดแล้ว
        supabase.from('payroll').select('*').eq('date', reportDate), // เงินเดือน / ค่าเที่ยว
        supabase.from('debtor_transactions').select('*').eq('date', reportDate).eq('type', 'pay'), // ลูกหนี้จ่ายเงิน
        supabase.from('cooler_transactions').select('*').gte('created_at', startOfDay).lte('created_at', endOfDay).gt('deposit_amount', 0), // รับมัดจำถัง
        supabase.from('cooler_transactions').select('*').eq('status', 'returned').gte('return_date', startOfDay).lte('return_date', endOfDay).gt('deposit_amount', 0) // คืนมัดจำถัง
      ])

      const sales = salesRes.data || []
      const expenses = expensesRes.data || []
      const routes = routesRes.data || []
      const payrolls = payrollsRes.data || []
      const debtorPays = debtorPaysRes.data || []
      const coolerBorrows = coolerBorrowRes.data || []
      const coolerReturns = coolerReturnRes.data || []

      // 💰 คำนวณรายรับ (Revenue)
      const posRevenue = sales.reduce((sum, s) => sum + Number(s.totalAmount), 0)
      const routeRevenue = routes.reduce((sum, r) => sum + Number(r.expectedAmount), 0)
      const totalRev = posRevenue + routeRevenue // รายได้หลักของบริษัท (ไม่รวมมัดจำ/รับชำระหนี้ เพราะถือเป็นกระแสเงินสด)

      // 💸 คำนวณรายจ่าย (Expense)
      const generalExp = expenses.reduce((sum, e) => sum + Number(e.amount), 0)
      const payrollExp = payrolls.reduce((sum, p) => sum + Number(p.amount), 0)
      const totalExp = generalExp + payrollExp // รายจ่ายรวม (กำไร = รายรับ - รายจ่าย)

      // 💵 คำนวณเงินสดเข้า-ออกเก๊ะ (Cash in Drawer)
      const posCash = sales.filter(s => s.payMethod === 'cash').reduce((sum, s) => sum + Number(s.totalAmount), 0)
      const routeCash = routes.reduce((sum, r) => sum + Number(r.cashAmount), 0)
      const debtorCash = debtorPays.filter(d => d.note?.includes('เงินสด')).reduce((sum, d) => sum + Number(d.amount), 0)
      const coolerDepositIn = coolerBorrows.reduce((sum, c) => sum + Number(c.deposit_amount), 0)
      
      const totalCashIn = posCash + routeCash + debtorCash + coolerDepositIn
      
      const coolerDepositOut = coolerReturns.reduce((sum, c) => sum + Number(c.deposit_amount), 0)
      const totalCashOut = generalExp + payrollExp + coolerDepositOut

      setDailyStats({
        totalRevenue: totalRev,
        totalExpense: totalExp,
        netProfit: totalRev - totalExp, // กำไรทางบัญชี
        cashInDrawer: Math.max(0, totalCashIn - totalCashOut) // เงินสดที่จะต้องมีในลิ้นชัก ณ ตอนนี้
      })

      // --- 📊 ดึงข้อมูลสัดส่วนรายได้ และผูกข้อมูลไส้ในสำหรับ Popup ---
      const colors = ['bg-emerald-500', 'bg-blue-500', 'bg-sky-500', 'bg-indigo-500', 'bg-purple-500']
      const sources = []
      
      sources.push({
        id: 'POS', name: 'ขายด่วนหน้าร้าน (POS)', 
        amount: posRevenue, 
        percent: totalRev > 0 ? Math.round((posRevenue / totalRev) * 100) : 0,
        color: colors[0],
        detail: { cash: posCash, transfer: posRevenue - posCash, credit: 0, expense: 0, lostBags: 0, note: 'ยอดขายหน้าร้านรวม' }
      })

      routes.forEach((r, idx) => {
        sources.push({
          id: r.id, name: r.routeName, 
          amount: Number(r.expectedAmount), 
          percent: totalRev > 0 ? Math.round((Number(r.expectedAmount) / totalRev) * 100) : 0,
          color: colors[(idx + 1) % colors.length],
          detail: {
            cash: Number(r.cashAmount),
            transfer: Number(r.transferAmount),
            credit: Number(r.creditAmount),
            expense: Number(r.expenseAmount),
            lostBags: r.details?.bagTracking?.lostBagsToDeduct || 0,
            note: r.note || 'ไม่มีหมายเหตุ'
          }
        })
      })
      setRevenueSources(sources.sort((a, b) => b.amount - a.amount))

      // ⚠️ ยอดหนี้ค้างรายวัน
      const arrears = routes.filter(r => Number(r.creditAmount) > 0).map(r => ({ id: r.id, route: r.routeName, driver: r.driverName, amount: Number(r.creditAmount) }))
      setDailyArrears(arrears)

      // 📝 เรียงสมุดบัญชี (Ledger) รวมทุก Activity
      const txs: any[] = []
      
      sales.forEach(s => txs.push({ 
        id: `S-${s.id}`, 
        time: new Date(s.createdAt).toLocaleTimeString('th-TH', {hour: '2-digit', minute:'2-digit'}) + ' น.', 
        timestamp: new Date(s.createdAt).getTime(), 
        type: 'income', title: `ขาย POS (${s.id})`, 
        amount: Number(s.totalAmount), method: s.payMethod === 'cash' ? 'เงินสด' : 'โอนเงิน', user: s.by 
      }))
      
      expenses.forEach(e => txs.push({ 
        id: `E-${e.id}`, 
        time: new Date(e.created_at).toLocaleTimeString('th-TH', {hour: '2-digit', minute:'2-digit'}) + ' น.', 
        timestamp: new Date(e.created_at).getTime(), 
        type: 'expense', title: `รายจ่าย: ${e.category}`, 
        amount: -Number(e.amount), method: 'เงินสด', user: e.recorded_by 
      }))

      payrolls.forEach(p => txs.push({ 
        id: `P-${p.id}`, 
        time: new Date(p.createdAt || p.date).toLocaleTimeString('th-TH', {hour: '2-digit', minute:'2-digit'}) + ' น.', 
        timestamp: new Date(p.createdAt || p.date).getTime(), 
        type: 'expense', title: `จ่าย${p.type}: ${p.employeeName}`, 
        amount: -Number(p.amount), method: 'เงินสด', user: p.by 
      }))

      debtorPays.forEach(d => txs.push({ 
        id: `D-${d.id}`, 
        time: new Date(d.createdAt || d.date).toLocaleTimeString('th-TH', {hour: '2-digit', minute:'2-digit'}) + ' น.', 
        timestamp: new Date(d.createdAt || d.date).getTime(), 
        type: 'income', title: `รับชำระหนี้: ${d.debtorName}`, 
        amount: Number(d.amount), method: d.note?.includes('เงินสด') ? 'เงินสด' : 'โอนเงิน', user: '-' 
      }))

      coolerBorrows.forEach(c => txs.push({ 
        id: `CB-${c.id}`, 
        time: new Date(c.created_at || c.borrow_date).toLocaleTimeString('th-TH', {hour: '2-digit', minute:'2-digit'}) + ' น.', 
        timestamp: new Date(c.created_at || c.borrow_date).getTime(), 
        type: 'income', title: `รับมัดจำถัง: ${c.customer_name}`, 
        amount: Number(c.deposit_amount), method: 'เงินสด', user: c.recorded_by 
      }))

      coolerReturns.forEach(c => txs.push({ 
        id: `CR-${c.id}`, 
        time: new Date(c.return_date).toLocaleTimeString('th-TH', {hour: '2-digit', minute:'2-digit'}) + ' น.', 
        timestamp: new Date(c.return_date).getTime(), 
        type: 'expense', title: `คืนมัดจำถัง: ${c.customer_name}`, 
        amount: -Number(c.deposit_amount), method: 'เงินสด', user: c.recorded_by 
      }))
      
      routes.forEach(r => txs.push({ 
        id: `R-${r.id}`, 
        time: new Date(r.createdAt).toLocaleTimeString('th-TH', {hour: '2-digit', minute:'2-digit'}) + ' น.', 
        timestamp: new Date(r.createdAt).getTime(), 
        type: 'income', title: `เคลียร์บิล: ${r.routeName}`, 
        amount: Number(r.cashAmount) + Number(r.transferAmount), method: 'เงินสด/โอน', user: r.by 
      }))
      
      // เรียงจากล่าสุดไปเก่าสุด
      txs.sort((a, b) => b.timestamp - a.timestamp)
      setRecentTransactions(txs) 

    } catch (error) { 
      console.error('Error fetching dashboard data:', error) 
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        @media print { 
          @page { size: A4 portrait; margin: 15mm; } 
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: white; } 
          .no-print { display: none !important; }
        }
      `}} />

      <div className="p-4 md:p-8 bg-slate-50/50 min-h-screen font-sans print:bg-white print:p-0 print:m-0">
        
        <div className="max-w-7xl mx-auto space-y-6 md:space-y-8">
          
          {/* 🌟 Header */}
          <div className="bg-white/80 backdrop-blur-xl p-6 md:p-8 rounded-[2rem] border border-slate-200/60 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6 sticky top-4 z-30 print:relative print:border-none print:shadow-none print:p-0 print:mb-8 overflow-hidden">
            {isLoading && <div className="absolute inset-0 bg-white/60 backdrop-blur-md z-10 flex items-center justify-center font-bold text-blue-600 print:hidden">
              <div className="flex items-center gap-3"><span className="animate-spin text-2xl">⏳</span> กำลังคำนวณงบการเงิน...</div>
            </div>}
            
            <div className="space-y-2">
              <h1 className="text-2xl font-black text-slate-900 flex items-center gap-3 tracking-tight">
                <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-500/30 text-xl print:hidden">📊</div>
                {printMode === 'all' ? 'สรุปงบการเงินประจำวัน' : printMode === 'ledger' ? 'รายงานการเดินบัญชี (Ledger)' : 'สรุปงบการเงิน'}
              </h1>
              <p className="text-sm text-slate-500 font-medium ml-1 print:text-black">
                ข้อมูลประจำวันที่: <strong className="text-blue-600 text-base ml-1 print:text-black">{new Date(reportDate).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric'})}</strong>
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto print:hidden">
              <input type="date" value={reportDate} onChange={e => setReportDate(e.target.value)} className="px-5 py-3.5 rounded-xl border border-slate-200 font-bold text-slate-700 bg-white shadow-sm focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all cursor-pointer" />
              <button onClick={() => setIsPrintModalOpen(true)} className="bg-slate-900 hover:bg-black text-white px-6 py-3.5 rounded-xl font-bold transition-all shadow-lg active:scale-95 flex justify-center items-center gap-2 group">
                <span className="group-hover:scale-110 transition-transform">🖨️</span> พิมพ์รายงาน
              </button>
            </div>
          </div>

          {/* 🌟 KPI Financial Cards */}
          <div className={`grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-6 print:grid-cols-4 print:gap-4 print:mb-8 ${printMode !== 'all' ? 'print:hidden' : ''}`}>
            
            <div className="bg-white p-6 md:p-7 rounded-[2rem] border border-blue-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative overflow-hidden group print:shadow-none print:border-2 print:border-slate-800">
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-blue-50 to-transparent rounded-bl-full -z-10 transition-transform group-hover:scale-110 print:hidden"></div>
              <p className="font-bold text-slate-500 text-xs uppercase tracking-widest flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-blue-500"></span>รายรับรวมสุทธิ</p>
              <div className="mt-4 flex items-end justify-between">
                <span className="text-4xl md:text-5xl font-black text-slate-800 tracking-tighter print:text-black">{dailyStats.totalRevenue.toLocaleString()}</span>
                <span className="text-sm font-bold text-slate-400 mb-1">บาท</span>
              </div>
            </div>

            <div className="bg-white p-6 md:p-7 rounded-[2rem] border border-rose-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative overflow-hidden group print:shadow-none print:border-2 print:border-slate-800">
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-rose-50 to-transparent rounded-bl-full -z-10 transition-transform group-hover:scale-110 print:hidden"></div>
              <p className="font-bold text-slate-500 text-xs uppercase tracking-widest flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-rose-500"></span>รายจ่ายรวมสุทธิ</p>
              <div className="mt-4 flex items-end justify-between">
                <span className="text-4xl md:text-5xl font-black text-rose-600 tracking-tighter print:text-black">{dailyStats.totalExpense.toLocaleString()}</span>
                <span className="text-sm font-bold text-slate-400 mb-1">บาท</span>
              </div>
            </div>

            <div className="bg-gradient-to-br from-emerald-400 to-emerald-600 print:bg-none print:bg-white p-6 md:p-7 rounded-[2rem] shadow-lg shadow-emerald-500/20 text-white print:text-slate-900 print:shadow-none print:border-2 print:border-slate-800 relative overflow-hidden">
              <div className="absolute -right-4 -top-4 text-7xl opacity-20 rotate-12 print:hidden">✨</div>
              <p className="font-bold text-emerald-100 print:text-slate-500 text-xs uppercase tracking-widest relative z-10">กำไรสุทธิ (Net Profit)</p>
              <div className="mt-4 flex items-end justify-between relative z-10">
                <span className="text-4xl md:text-5xl font-black tracking-tighter print:text-black">{dailyStats.netProfit.toLocaleString()}</span>
                <span className="text-xs font-bold bg-white/20 print:bg-transparent print:text-slate-400 px-2 py-1 rounded-lg mb-1">บาท</span>
              </div>
            </div>

            <div className="bg-gradient-to-br from-amber-400 to-orange-500 print:bg-none print:bg-white p-6 md:p-7 rounded-[2rem] shadow-lg shadow-orange-500/20 text-white print:text-slate-900 print:shadow-none print:border-2 print:border-slate-800 relative overflow-hidden">
              <div className="absolute -right-2 -top-2 text-7xl opacity-20 rotate-12 print:hidden">💵</div>
              <p className="font-bold text-orange-100 print:text-slate-500 text-xs uppercase tracking-widest relative z-10">เงินสดในเก๊ะ (ลิ้นชัก)</p>
              <div className="mt-4 flex items-end justify-between relative z-10">
                <span className="text-4xl md:text-5xl font-black tracking-tighter print:text-black">{dailyStats.cashInDrawer.toLocaleString()}</span>
                <span className="text-xs font-bold bg-white/20 print:bg-transparent print:text-slate-400 px-2 py-1 rounded-lg mb-1">บาท</span>
              </div>
            </div>

          </div>

          {/* 🌟 Content Grid */}
          <div className={`grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8 print:gap-8 print:mt-8 ${printMode !== 'all' && printMode !== 'ledger' ? 'print:hidden' : ''} ${printMode === 'ledger' ? 'print:flex print:flex-col' : ''}`}>
            
            {/* 📊 สัดส่วนรายได้ */}
            <div className={`lg:col-span-5 bg-white p-6 md:p-8 print:p-0 rounded-[2rem] border border-slate-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] print:shadow-none print:border-none ${printMode !== 'all' ? 'print:hidden' : ''}`}>
              <div className="flex items-center gap-3 border-b border-slate-100 print:border-black pb-4 mb-6">
                <span className="text-2xl print:hidden">📊</span>
                <h2 className="text-lg font-black text-slate-900 uppercase tracking-wide">สัดส่วนรายได้แยกตามสายส่ง</h2>
              </div>

              {revenueSources.length === 0 ? (
                <div className="text-slate-400 text-center py-20 font-bold flex flex-col items-center gap-3 opacity-60">
                  <span className="text-4xl">📭</span> ไม่มีข้อมูลรายได้ในวันนี้
                </div>
              ) : (
                <div className="space-y-6">
                  {revenueSources.map((source) => (
                    <div 
                      key={source.id} 
                      onClick={() => setSelectedRouteDetail(source)}
                      className="group cursor-pointer hover:bg-slate-50 p-3 -mx-3 rounded-2xl transition-all duration-300 space-y-2 relative"
                    >
                      <div className="flex justify-between items-end">
                        <span className="font-bold text-slate-700 text-sm flex items-center gap-2">
                          {source.name}
                          <span className="text-[10px] text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity print:hidden shadow-sm">
                            คลิกดูรายละเอียด
                          </span>
                        </span>
                        <span className="font-black text-slate-900 text-lg">{source.amount.toLocaleString()} <span className="text-xs text-slate-400 font-bold ml-0.5">บ.</span></span>
                      </div>
                      <div className="w-full bg-slate-100 print:bg-slate-200 rounded-full h-3 overflow-hidden shadow-inner">
                        <div className={`h-full rounded-full ${source.color} print:bg-slate-700 transition-all duration-1000 ease-out`} style={{ width: `${source.percent}%` }}></div>
                      </div>
                      <div className="text-[10px] font-bold text-slate-400 text-right">{source.percent}% ของรายได้รวม</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 📜 Ledger */}
            <div className={`lg:col-span-7 bg-white p-6 md:p-8 print:p-0 rounded-[2rem] border border-slate-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] print:shadow-none print:border-none flex flex-col h-[600px] md:h-[700px] print:h-auto ${printMode !== 'all' && printMode !== 'ledger' ? 'print:hidden' : ''}`}>
              <div className="flex justify-between items-center border-b border-slate-100 print:border-black pb-4 mb-4 shrink-0">
                <h2 className="text-lg font-black text-slate-900 uppercase tracking-wide flex items-center gap-2"><span className="text-2xl print:hidden">📝</span> รายการเดินบัญชี (Ledger)</h2>
                <span className="text-xs font-bold text-slate-400 bg-slate-100 px-3 py-1 rounded-full print:hidden">รวมทุกระบบ</span>
              </div>
              
              <div className="space-y-3 flex-1 overflow-y-auto pr-2 scrollbar-hide print:overflow-visible">
                {recentTransactions.length === 0 ? (
                  <div className="text-center py-20 text-slate-400 font-bold opacity-60">ยังไม่มีรายการเคลื่อนไหว</div>
                ) : (
                  recentTransactions.map((tx) => (
                    <div key={tx.id} className="flex gap-4 items-center p-4 rounded-2xl bg-white border border-slate-100 hover:border-slate-300 hover:shadow-md transition-all print:border-b print:border-x-0 print:border-t-0 print:rounded-none print:py-3 print:px-0">
                      <div className={`w-12 h-12 shrink-0 rounded-2xl flex items-center justify-center font-black text-xl shadow-sm print:hidden ${tx.type === 'income' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'}`}>
                        {tx.type === 'income' ? '↓' : '↑'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-slate-800 text-sm truncate">{tx.title}</h3>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <span className="text-[10px] text-slate-500 font-bold bg-slate-100 print:bg-transparent print:p-0 px-2 py-0.5 rounded-md">{tx.time}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md print:hidden ${tx.method === 'เงินสด' ? 'text-emerald-700 bg-emerald-100' : 'text-blue-700 bg-blue-100'}`}>{tx.method}</span>
                          <span className="text-[10px] text-slate-400 truncate print:hidden">โดย: {tx.user}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className={`font-black text-lg print:text-slate-900 ${tx.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {tx.type === 'income' ? '+' : '-'}{Math.abs(tx.amount).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>

          {/* ⚠️ ยอดค้าง และ ลูกหนี้ */}
          {dailyArrears.length > 0 && (
            <div className={`animate-in fade-in slide-in-from-bottom-4 duration-500 print:mt-8 ${printMode !== 'all' && printMode !== 'arrears' ? 'print:hidden' : ''}`}>
              <div className="bg-rose-50/50 p-6 md:p-8 print:p-0 rounded-[2rem] border border-rose-100 print:border-none print:shadow-none">
                <div className="border-b border-rose-200 print:border-black pb-4 mb-6">
                  <h2 className="text-lg font-black text-rose-800 flex items-center gap-2 uppercase tracking-wide"><span className="text-2xl print:hidden">⚠️</span> ยอดค้างจ่ายรายวัน (ลูกหนี้สายส่ง)</h2>
                  <p className="text-xs font-bold text-rose-600/70 mt-1">ยอดค้างที่ต้องติดตามเก็บจากคนขับในรอบบิลวันนี้</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {dailyArrears.map((route) => (
                    <div key={route.id} className="flex justify-between items-center p-4 rounded-2xl bg-white border border-rose-100 shadow-sm print:border-b print:border-x-0 print:border-t-0 print:shadow-none print:rounded-none print:p-2">
                      <div>
                        <h3 className="font-bold text-slate-800 text-sm">{route.route}</h3>
                        <p className="text-[10px] text-slate-500 font-bold mt-0.5">คนขับ: {route.driver}</p>
                      </div>
                      <span className="font-black text-rose-600 text-lg">{route.amount.toLocaleString()} <span className="text-xs">บ.</span></span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* 🚀 Modal: โชว์รายละเอียดบิลสายส่งตอนกดคลิกแถบสี */}
      {selectedRouteDetail && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md transition-opacity print:hidden">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-start">
              <div>
                <h3 className="font-black text-lg text-slate-900 flex items-center gap-2">📄 รายละเอียดปิดยอด</h3>
                <p className="text-sm text-blue-600 font-bold mt-1 bg-blue-50 inline-block px-3 py-1 rounded-lg border border-blue-100">{selectedRouteDetail.name}</p>
              </div>
              <button onClick={() => setSelectedRouteDetail(null)} className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-rose-500 hover:bg-rose-50 font-bold flex items-center justify-center transition-colors">✕</button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="bg-gradient-to-br from-blue-500 to-blue-700 p-6 rounded-2xl shadow-lg shadow-blue-500/20 text-white text-center">
                <span className="font-bold text-blue-100 text-xs uppercase tracking-widest block mb-1">ยอดขายรวมสุทธิ</span>
                <span className="font-black text-4xl">{selectedRouteDetail.amount.toLocaleString()} <span className="text-lg font-normal text-blue-200">บ.</span></span>
              </div>

              <div className="space-y-4">
                <p className="font-black text-slate-400 text-xs uppercase tracking-widest border-b border-slate-100 pb-2">โครงสร้างรายได้ / การชำระ</p>
                <div className="space-y-3 text-sm">
                  {selectedRouteDetail.detail.cash > 0 && (
                    <div className="flex justify-between items-center bg-emerald-50 p-3 rounded-xl border border-emerald-100 text-emerald-700 font-bold"><p className="flex items-center gap-2"><span className="text-lg">💵</span> รับเป็นเงินสด</p><p className="text-lg">{selectedRouteDetail.detail.cash.toLocaleString()}</p></div>
                  )}
                  {selectedRouteDetail.detail.transfer > 0 && (
                    <div className="flex justify-between items-center bg-blue-50 p-3 rounded-xl border border-blue-100 text-blue-700 font-bold"><p className="flex items-center gap-2"><span className="text-lg">📱</span> ลูกค้าโอนเข้าบัญชี</p><p className="text-lg">{selectedRouteDetail.detail.transfer.toLocaleString()}</p></div>
                  )}
                  {selectedRouteDetail.detail.credit > 0 && (
                    <div className="flex justify-between items-center bg-orange-50 p-3 rounded-xl border border-orange-100 text-orange-700 font-bold"><p className="flex items-center gap-2"><span className="text-lg">🤝</span> ลงบิลเครดิต / ค้าง</p><p className="text-lg">{selectedRouteDetail.detail.credit.toLocaleString()}</p></div>
                  )}
                  {selectedRouteDetail.detail.expense > 0 && (
                    <div className="flex justify-between items-center bg-rose-50 p-3 rounded-xl border border-rose-100 text-rose-600 font-bold"><p className="flex items-center gap-2"><span className="text-lg">⛽</span> หักจ่าย / ค่าน้ำมัน</p><p className="text-lg">-{selectedRouteDetail.detail.expense.toLocaleString()}</p></div>
                  )}
                  
                  {selectedRouteDetail.detail.cash === 0 && selectedRouteDetail.detail.transfer === 0 && selectedRouteDetail.detail.credit === 0 && (
                    <div className="text-center p-6 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 font-bold text-sm">ไม่มีข้อมูลการชำระเงินในระบบ</div>
                  )}
                </div>
              </div>

              {selectedRouteDetail.detail.lostBags > 0 && (
                <div className="bg-rose-50 p-4 rounded-xl border border-rose-200 text-center animate-pulse flex items-center justify-center gap-2">
                  <span className="text-xl">🚨</span> <span className="font-black text-rose-600">แจ้งเตือน: ถุงหาย {selectedRouteDetail.detail.lostBags} ใบ</span>
                </div>
              )}

              {selectedRouteDetail.detail.note && selectedRouteDetail.detail.note !== 'ไม่มีหมายเหตุ' && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">หมายเหตุ:</p>
                  <p className="text-sm font-bold text-slate-700">{selectedRouteDetail.detail.note}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 🖨️ Modal เลือกลักษณะการพิมพ์ */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[300] p-4 print:hidden">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-black text-lg text-slate-900 flex items-center gap-2">🖨️ เลือกรายงานที่ต้องการพิมพ์</h3>
              <button onClick={() => setIsPrintModalOpen(false)} className="w-8 h-8 rounded-full bg-white text-slate-400 hover:text-rose-500 border border-slate-200 shadow-sm font-bold flex items-center justify-center">✕</button>
            </div>
            <div className="p-6 space-y-3">
              <button onClick={() => handlePrint('all')} className="w-full text-left p-5 rounded-2xl border-2 border-slate-200 hover:border-blue-500 hover:bg-blue-50 hover:shadow-md transition-all group flex items-center gap-4">
                <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center text-xl group-hover:scale-110 transition-transform">📊</div>
                <div className="flex-1"><h4 className="font-black text-slate-800 text-base">พิมพ์ทั้งหมด (ภาพรวม)</h4><p className="text-[10px] font-bold text-slate-500 mt-0.5">สรุปงบ + กราฟ + รายการเดินบัญชี</p></div>
                <span className="text-slate-300 font-black group-hover:text-blue-500 transition-colors">➔</span>
              </button>
              <button onClick={() => handlePrint('ledger')} className="w-full text-left p-5 rounded-2xl border-2 border-slate-200 hover:border-emerald-500 hover:bg-emerald-50 hover:shadow-md transition-all group flex items-center gap-4">
                <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center text-xl group-hover:scale-110 transition-transform">📝</div>
                <div className="flex-1"><h4 className="font-black text-slate-800 text-base">พิมพ์เฉพาะรายการรับ-จ่าย</h4><p className="text-[10px] font-bold text-slate-500 mt-0.5">เฉพาะรายการเดินบัญชี (Ledger)</p></div>
                <span className="text-slate-300 font-black group-hover:text-emerald-500 transition-colors">➔</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}