'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

type Employee = {
  id: string
  name: string
  role: string
  baseSalary: number
}

type PayrollDetails = {
  grossAmount?: number
  lostBags?: number
  penaltyPerBag?: number
  totalPenalty?: number
}

type PayrollRecord = {
  id: string
  date: string
  employeeName: string
  role?: string
  type: string
  amount: number
  note?: string
  details?: PayrollDetails
  by?: string
  createdAt?: string
}

type SalarySummary = {
  empInfo?: Employee
  month: string
  baseSalary: number
  totalTripFee: number
  totalAdvance: number
  totalPenaltyPaid: number
  netSalary: number
}

type SalaryPrint = SalarySummary & {
  id: string
  datePrinted: string
}

// 🌟 Union Type (ตัวแปรนี้เป็นไปได้ 2 รูปแบบ)
type PrintSlip = PayrollRecord | SalaryPrint

export default function PayrollPage() {
  const getTodayString = () => {
    const today = new Date()
    return new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0]
  }

  const [activeTab, setActiveTab] = useState<'record' | 'salary' | 'history'>('record')

  // 🌟 State เก็บข้อมูลพนักงานจริงจาก Database
  const [employeeList, setEmployeeList] = useState<Employee[]>([])
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(true)

  const [hrName, setHrName] = useState('ฝ่ายบุคคล/บัญชี')
  const [printSlip, setPrintSlip] = useState<PrintSlip | null>(null)
  const [printType, setPrintType] = useState<'voucher' | 'payslip'>('voucher')

  // ==========================================
  // 🎯 TAB 1: บันทึกรายการประจำวัน
  // ==========================================
  const [currentDate, setCurrentDate] = useState(getTodayString())
  const [formData, setFormData] = useState({
    employeeName: '',
    type: 'ค่าเที่ยว',
    amount: '',
    note: ''
  })
  
  const [lostBags, setLostBags] = useState(0)
  const [penaltyPerBag, setPenaltyPerBag] = useState(5)

  const fetchLostBagsToday = useCallback(async () => {
    if (!formData.employeeName) return
    const { data } = await supabase.from('route_settlements')
      .select('details')
      .eq('date', currentDate)
      .eq('driverName', formData.employeeName)

    let totalLost = 0
    if (data) {
      data.forEach((d: any) => {
        totalLost += Number(d.details?.bagTracking?.lostBagsToDeduct || 0)
      })
    }
    setLostBags(totalLost)
  }, [currentDate, formData.employeeName])

  useEffect(() => {
    const loadLostBags = async () => {
      if (activeTab !== 'record' || !formData.employeeName) return
      await fetchLostBagsToday()
    }

    void loadLostBags()
  }, [activeTab, fetchLostBagsToday, formData.employeeName])

  const grossAmount = Number(formData.amount) || 0
  const totalPenalty = (formData.type === 'ค่าเที่ยว' && lostBags > 0) ? (lostBags * penaltyPerBag) : 0
  const netAmount = Math.max(0, grossAmount - totalPenalty)

  const handleSaveRecord = async (e: React.FormEvent) => {
    e.preventDefault()
    if (grossAmount <= 0) return alert('กรุณาระบุยอดเงิน')

    const empInfo = employeeList.find(e => e.name === formData.employeeName)
    const docNo = `PR-${Date.now().toString().slice(-6)}`

    const newRecord = {
      id: docNo,
      date: currentDate,
      employeeName: empInfo?.name || formData.employeeName,
      role: empInfo?.role,
      type: formData.type,
      amount: netAmount,
      note: formData.note || (totalPenalty > 0 ? `หักค่ากระสอบหาย ${lostBags} ใบ` : ''),
      details: {
        grossAmount: grossAmount,
        lostBags: lostBags,
        penaltyPerBag: penaltyPerBag,
        totalPenalty: totalPenalty
      },
      by: hrName
    }

    const { error } = await supabase.from('payroll').insert([newRecord])
    
    if (error) alert('เกิดข้อผิดพลาด: ' + error.message)
    else {
      setPrintType('voucher')
      setPrintSlip(newRecord)
      setFormData({ ...formData, amount: '', note: '' })
      fetchLostBagsToday()
      setTimeout(() => { window.print(); setTimeout(() => setPrintSlip(null), 500) }, 300)
    }
  }

  // ==========================================
  // 🎯 TAB 2: สรุปเงินเดือนที่ได้ (คำนวณรายเดือน)
  // ==========================================
  const [salaryMonth, setSalaryMonth] = useState(getTodayString().slice(0, 7))
  const [salaryEmp, setSalaryEmp] = useState('')
  const [salaryData, setSalaryData] = useState<SalarySummary | null>(null)
  const [isCalculating, setIsCalculating] = useState(false)

  useEffect(() => {
    const loadEmployees = async () => {
      const session = localStorage.getItem('kingsawang_session')
      if (session) {
        setHrName(JSON.parse(session).name)
      }

      setIsLoadingEmployees(true)
      const { data } = await supabase
        .from('employees')
        .select('*')
        .eq('isActive', true)
        .order('name', { ascending: true })

      if (data && data.length > 0) {
        const formattedEmployees = data.map((emp: any) => ({
          id: emp.id,
          name: emp.name,
          role: emp.role,
          // 🌟 แก้ไข: ดึงจาก base_salary ให้ตรงกับตาราง Employee
          baseSalary: Number(emp.base_salary) || 0 
        }))
        setEmployeeList(formattedEmployees)
        setFormData(prev => ({ ...prev, employeeName: formattedEmployees[0].name }))
        setSalaryEmp(formattedEmployees[0].name)
      }

      setIsLoadingEmployees(false)
    }

    void loadEmployees()
  }, [])

  const calculateMonthlySalary = useCallback(async () => {
    if (!salaryEmp) {
      setSalaryData(null)
      return
    }

    setIsCalculating(true)
    const empInfo = employeeList.find(emp => emp.name === salaryEmp)
    const startOfMonth = `${salaryMonth}-01`
    const endOfMonth = new Date(new Date(startOfMonth).setMonth(new Date(startOfMonth).getMonth() + 1)).toISOString().split('T')[0]

    const { data } = await supabase.from('payroll')
      .select('*')
      .eq('employeeName', salaryEmp)
      .gte('date', startOfMonth)
      .lt('date', endOfMonth)

    let totalTripFee = 0
    let totalAdvance = 0
    let totalPenaltyPaid = 0

    if (data) {
      (data as PayrollRecord[]).forEach(r => {
        if (r.type === 'ค่าเที่ยว') {
          totalTripFee += Number(r.details?.grossAmount || r.amount)
          totalPenaltyPaid += Number(r.details?.totalPenalty || 0)
        }
        else if (r.type === 'เบิกล่วงหน้า') totalAdvance += Number(r.amount)
      })
    }

    const baseSal = empInfo?.baseSalary || 0
    const netSalary = (baseSal + totalTripFee) - (totalAdvance + totalPenaltyPaid)

    setSalaryData({
      empInfo,
      month: salaryMonth,
      baseSalary: baseSal,
      totalTripFee,
      totalAdvance,
      totalPenaltyPaid,
      netSalary: Math.max(0, netSalary)
    })
    setIsCalculating(false)
  }, [employeeList, salaryEmp, salaryMonth])

  useEffect(() => {
    const loadSalary = async () => {
      if (activeTab !== 'salary') return
      await calculateMonthlySalary()
    }

    void loadSalary()
  }, [activeTab, calculateMonthlySalary])

  const printPayslip = () => {
    if (!salaryData) return
    setPrintType('payslip')
    setPrintSlip({
      id: `SLIP-${Date.now().toString().slice(-6)}`,
      ...salaryData,
      datePrinted: new Date().toLocaleString('th-TH')
    })
    setTimeout(() => { window.print(); setTimeout(() => setPrintSlip(null), 500) }, 300)
  }

  // ==========================================
  // 🎯 TAB 3: ประวัติย้อนหลัง
  // ==========================================
  const [historyMonth, setHistoryMonth] = useState(getTodayString().slice(0, 7))
  const [historyEmpFilter, setHistoryEmpFilter] = useState('ทั้งหมด')
  const [historyRecords, setHistoryRecords] = useState<PayrollRecord[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)

  const fetchHistory = useCallback(async () => {
    setIsLoadingHistory(true)
    const startOfMonth = `${historyMonth}-01`
    const endOfMonth = new Date(new Date(startOfMonth).setMonth(new Date(startOfMonth).getMonth() + 1)).toISOString().split('T')[0]

    let query = supabase.from('payroll').select('*').gte('date', startOfMonth).lt('date', endOfMonth).order('createdAt', { ascending: false })
    if (historyEmpFilter !== 'ทั้งหมด') query = query.eq('employeeName', historyEmpFilter)

    const { data } = await query
    if (data) setHistoryRecords(data as PayrollRecord[])
    setIsLoadingHistory(false)
  }, [historyEmpFilter, historyMonth])

  useEffect(() => {
    const loadHistory = async () => {
      if (activeTab !== 'history') return
      await fetchHistory()
    }

    void loadHistory()
  }, [activeTab, fetchHistory])

  const handleDelete = async (id: string) => {
    if (confirm(`⚠️ ต้องการลบรายการ ${id} ออกจากระบบถาวรหรือไม่?`)) {
      await supabase.from('payroll').delete().eq('id', id)
      fetchHistory()
    }
  }

  const reprintVoucher = (record: PayrollRecord) => {
    setPrintType('voucher')
    setPrintSlip(record)
    setTimeout(() => { window.print(); setTimeout(() => setPrintSlip(null), 500) }, 300)
  }

  if (isLoadingEmployees) {
    return <div className="min-h-screen flex items-center justify-center font-bold text-slate-400 text-lg bg-slate-50/50">⏳ กำลังโหลดข้อมูลระบบ...</div>
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        @media print { 
          @page { size: A4 portrait; margin: 15mm; } 
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: white; } 
        }
      `}} />

      <div className={`p-4 md:p-8 bg-slate-50/50 min-h-screen text-slate-800 font-sans ${printSlip ? 'hidden' : 'block print:hidden'}`}>
        
        <div className="max-w-6xl mx-auto space-y-8">
          
          {/* 🌟 Header & Tabs */}
          <div className="bg-white/80 backdrop-blur-xl p-6 md:p-8 rounded-[2rem] border border-slate-200/60 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6 sticky top-4 z-40">
            <div>
              <h1 className="text-2xl font-black text-slate-900 flex items-center gap-3 tracking-tight">
                <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-500/30">👥</div>
                ระบบบัญชีบุคคล (HR & Payroll)
              </h1>
              <p className="text-sm text-slate-500 font-medium mt-2 ml-1">จัดการค่าเที่ยว เบิกล่วงหน้า ประเมินเงินเดือน และหักคดีความ</p>
            </div>
            
            <div className="flex bg-slate-100/80 p-1.5 rounded-2xl w-full md:w-auto overflow-x-auto border border-slate-200/50">
              {[
                { id: 'record' as const, label: '📝 บันทึกรายการ', activeClass: 'bg-white text-blue-600 shadow-sm border-slate-200/50' },
                { id: 'salary' as const, label: '💰 สรุปเงินเดือน', activeClass: 'bg-white text-emerald-600 shadow-sm border-slate-200/50' },
                { id: 'history' as const, label: '🗂️ ประวัติย้อนหลัง', activeClass: 'bg-white text-slate-900 shadow-sm border-slate-200/50' }
              ].map(tab => (
                <button 
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)} 
                  className={`shrink-0 px-6 py-3 rounded-xl font-bold text-sm transition-all duration-300 border border-transparent ${activeTab === tab.id ? tab.activeClass : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* ==========================================
              TAB 1: บันทึกรายการ
              ========================================== */}
          {activeTab === 'record' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="lg:col-span-6 lg:col-start-4">
                <form onSubmit={handleSaveRecord} className="bg-white p-8 rounded-[2rem] border border-slate-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-8">
                  
                  <div className="flex justify-between items-center border-b border-slate-100 pb-5">
                    <div>
                      <h2 className="font-black text-slate-900 text-lg">สร้างใบสำคัญจ่าย</h2>
                      <p className="text-xs text-slate-500 mt-1 font-medium">Payment Voucher</p>
                    </div>
                    <input type="date" value={currentDate} onChange={e => setCurrentDate(e.target.value)} className="px-4 py-2 rounded-xl border border-slate-200 font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                  </div>
                  
                  <div className="space-y-3">
                    <label className="text-xs font-black tracking-wider text-slate-500 uppercase">เลือกพนักงาน / คนขับรถ <span className="text-rose-500">*</span></label>
                    <select value={formData.employeeName} onChange={e => setFormData({...formData, employeeName: e.target.value})} className="w-full border border-slate-200 px-5 py-4 rounded-2xl font-bold text-slate-800 bg-slate-50 hover:bg-slate-100 transition-colors outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 cursor-pointer appearance-none">
                      {employeeList.map(emp => <option key={emp.id} value={emp.name}>{emp.name} — {emp.role}</option>)}
                    </select>
                  </div>

                  <div className="space-y-3">
                    <label className="text-xs font-black tracking-wider text-slate-500 uppercase">ประเภทการเบิกจ่าย <span className="text-rose-500">*</span></label>
                    <div className="grid grid-cols-2 gap-4">
                      <button type="button" onClick={() => setFormData({...formData, type: 'ค่าเที่ยว'})} className={`py-4 rounded-2xl font-bold text-sm border-2 transition-all duration-300 ${formData.type === 'ค่าเที่ยว' ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-[0_0_20px_rgba(59,130,246,0.15)] scale-[1.02]' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50'}`}>🚚 จ่ายค่าเที่ยว</button>
                      <button type="button" onClick={() => setFormData({...formData, type: 'เบิกล่วงหน้า'})} className={`py-4 rounded-2xl font-bold text-sm border-2 transition-all duration-300 ${formData.type === 'เบิกล่วงหน้า' ? 'bg-rose-50 border-rose-500 text-rose-700 shadow-[0_0_20px_rgba(244,63,94,0.15)] scale-[1.02]' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50'}`}>💸 เบิกล่วงหน้า</button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-xs font-black tracking-wider text-slate-500 uppercase">จำนวนเงิน (บาท) <span className="text-rose-500">*</span></label>
                    <div className="relative">
                      <span className="absolute left-6 top-1/2 -translate-y-1/2 text-2xl text-slate-400 font-light">฿</span>
                      <input type="number" min="1" required value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} placeholder="0" className="w-full bg-white border-2 border-slate-200 pl-14 pr-6 py-5 rounded-2xl focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 font-black text-4xl text-slate-800 transition-all placeholder:text-slate-300" />
                    </div>
                  </div>

                  {formData.type === 'ค่าเที่ยว' && (
                    <div className={`p-5 rounded-2xl border transition-all duration-300 ${lostBags > 0 ? 'bg-rose-50/50 border-rose-200 shadow-inner' : 'bg-emerald-50/50 border-emerald-200'}`}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold text-slate-700 text-sm flex items-center gap-2">📦 แจ้งเตือนกระสอบหายวันนี้</span>
                        <span className={`font-black text-lg ${lostBags > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{lostBags} <span className="text-xs font-bold">ใบ</span></span>
                      </div>
                      {lostBags > 0 ? (
                        <div className="flex items-center gap-4 mt-4 pt-4 border-t border-rose-200/60">
                          <label className="text-xs font-bold text-rose-600">หักกระสอบละ:</label>
                          <input type="number" value={penaltyPerBag} onChange={e => setPenaltyPerBag(Number(e.target.value))} className="w-24 px-3 py-2 rounded-xl border border-rose-200 bg-white text-center font-black text-rose-700 outline-none focus:ring-2 focus:ring-rose-500/30 transition-all" />
                          <span className="flex-1 text-right font-black text-rose-600 text-base bg-white py-2 px-3 rounded-xl border border-rose-100 shadow-sm">-{totalPenalty.toLocaleString()} บ.</span>
                        </div>
                      ) : (
                        <p className="text-xs text-emerald-600 font-bold mt-2 flex items-center gap-1">✨ ยอดเยี่ยม! ไม่มียอดกระสอบหายจากหน้าลาน</p>
                      )}
                    </div>
                  )}

                  <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6 rounded-[1.5rem] shadow-xl flex flex-col sm:flex-row sm:justify-between sm:items-end gap-2 border border-slate-700">
                    <span className="font-bold text-slate-400 text-sm tracking-wide">ยอดสุทธิที่ต้องจ่าย (Net Paid)</span>
                    <div className="flex items-baseline gap-1">
                      <span className="font-black text-4xl text-emerald-400 tracking-tight">{netAmount.toLocaleString()}</span>
                      <span className="text-base text-emerald-500 font-bold mb-1">บาท</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-xs font-black tracking-wider text-slate-500 uppercase">หมายเหตุเพิ่มเติม</label>
                    <textarea rows={2} value={formData.note} onChange={e => setFormData({...formData, note: e.target.value})} placeholder="ระบุเหตุผลการเบิก หรือรายละเอียดอื่นๆ..." className="w-full border border-slate-200 px-5 py-4 rounded-2xl font-medium text-sm bg-slate-50 hover:bg-slate-100 transition-colors outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 resize-none" />
                  </div>

                  <button type="submit" disabled={netAmount <= 0} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-5 rounded-2xl shadow-lg transition-all text-base active:scale-[0.98] shadow-blue-500/25 flex justify-center items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed group">
                    <span className="text-xl group-hover:scale-110 transition-transform">🖨️</span> บันทึก และ พิมพ์ใบสำคัญจ่าย
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* ==========================================
              TAB 2: สรุปเงินเดือน
              ========================================== */}
          {activeTab === 'salary' && (
            <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              
              <div className="flex flex-col md:flex-row justify-between gap-6 bg-white p-6 md:p-8 rounded-[2rem] shadow-sm border border-slate-200/60">
                <div className="flex-1 space-y-3">
                  <label className="font-black tracking-wider text-slate-500 text-xs uppercase">พนักงานที่ต้องการสรุปยอด</label>
                  <div className="relative">
                    <select value={salaryEmp} onChange={e => setSalaryEmp(e.target.value)} className="w-full border-2 border-slate-200 pl-5 pr-10 py-4 rounded-2xl font-black text-slate-800 bg-slate-50 hover:bg-slate-100 outline-none focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 text-lg transition-all appearance-none cursor-pointer">
                      {employeeList.map(emp => <option key={emp.id} value={emp.name}>{emp.name}</option>)}
                    </select>
                    <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">▼</div>
                  </div>
                </div>
                <div className="shrink-0 space-y-3">
                  <label className="font-black tracking-wider text-slate-500 text-xs uppercase">ประจำเดือน</label>
                  <input type="month" value={salaryMonth} onChange={e => setSalaryMonth(e.target.value)} className="w-full px-5 py-4 rounded-2xl border-2 border-slate-200 font-bold text-slate-700 bg-slate-50 focus:outline-none focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 transition-all" />
                </div>
              </div>

              {isCalculating ? (
                <div className="bg-white p-16 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col items-center justify-center gap-4">
                  <div className="w-12 h-12 border-4 border-slate-200 border-t-emerald-500 rounded-full animate-spin"></div>
                  <p className="font-bold text-slate-500 text-lg">กำลังประมวลผลข้อมูลบัญชี...</p>
                </div>
              ) : salaryData && (
                <div className="bg-white rounded-[2rem] border border-slate-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-3 bg-gradient-to-r from-emerald-400 via-teal-500 to-emerald-600"></div>
                  
                  <div className="p-8 md:p-12">
                    <div className="text-center mb-10">
                      <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 shadow-sm border border-emerald-200/50">📄</div>
                      <h2 className="text-3xl font-black text-slate-900 tracking-tight">ใบสรุปเงินเดือนพนักงาน</h2>
                      <p className="text-slate-500 font-medium mt-2">รอบการจ่าย ประจำเดือน {salaryData.month}</p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
                      <div className="space-y-4">
                        <h3 className="font-black text-slate-400 text-xs uppercase tracking-widest border-b border-slate-100 pb-2">➕ หมวดรายรับ (Earnings)</h3>
                        <div className="flex justify-between items-center p-4 rounded-2xl bg-slate-50 border border-slate-100"><span className="font-bold text-slate-600">ฐานเงินเดือน</span><span className="font-black text-slate-900 text-lg">{salaryData.baseSalary.toLocaleString()} บ.</span></div>
                        <div className="flex justify-between items-center p-4 rounded-2xl bg-blue-50/50 border border-blue-100"><span className="font-bold text-blue-700">รวมค่าเที่ยวสะสม</span><span className="font-black text-blue-700 text-lg">+{salaryData.totalTripFee.toLocaleString()} บ.</span></div>
                      </div>
                      <div className="space-y-4">
                        <h3 className="font-black text-slate-400 text-xs uppercase tracking-widest border-b border-slate-100 pb-2">➖ หมวดรายจ่าย (Deductions)</h3>
                        <div className="flex justify-between items-center p-4 rounded-2xl bg-rose-50/50 border border-rose-100"><span className="font-bold text-rose-600">เบิกล่วงหน้าสะสม</span><span className="font-black text-rose-600 text-lg">-{salaryData.totalAdvance.toLocaleString()} บ.</span></div>
                        <div className="flex justify-between items-center p-4 rounded-2xl bg-orange-50/50 border border-orange-100"><span className="font-bold text-orange-700">ค่าปรับ/ถุงหายสะสม</span><span className="font-black text-orange-700 text-lg">-{salaryData.totalPenaltyPaid.toLocaleString()} บ.</span></div>
                      </div>
                    </div>

                    <div className="bg-emerald-50/50 border-2 border-emerald-100 rounded-3xl p-8 text-center space-y-2">
                      <p className="font-bold text-emerald-700 text-sm uppercase tracking-widest">ยอดรับสุทธิ (Net Salary)</p>
                      <p className="text-5xl md:text-7xl font-black text-emerald-600 tracking-tighter drop-shadow-sm">{salaryData.netSalary.toLocaleString()}</p>
                      <p className="font-bold text-emerald-600/60 text-base">บาทถ้วน</p>
                    </div>

                    <div className="mt-10 flex justify-center">
                      <button onClick={printPayslip} className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-12 py-5 rounded-2xl shadow-xl transition-all text-base active:scale-[0.98] shadow-emerald-500/30 flex items-center gap-3">
                        <span className="text-xl">🖨️</span> พิมพ์สลิปเงินเดือน (A4)
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ==========================================
              TAB 3: ประวัติย้อนหลัง
              ========================================== */}
          {activeTab === 'history' && (
            <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] animate-in fade-in slide-in-from-bottom-4 duration-500">
              
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 border-b border-slate-100 pb-6">
                <div>
                  <h2 className="text-xl font-black text-slate-900">🗂️ ประวัติการจ่ายเงิน (รายเดือน)</h2>
                  <p className="text-sm text-slate-500 mt-1 font-medium">ดูประวัติ ค้นหา พิมพ์ซ้ำ หรือยกเลิกรายการ</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                  <select value={historyEmpFilter} onChange={e => setHistoryEmpFilter(e.target.value)} className="px-5 py-3 rounded-xl border border-slate-200 font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 focus:outline-none focus:border-slate-400 transition-colors">
                    <option value="ทั้งหมด">แสดงพนักงานทั้งหมด</option>
                    {employeeList.map(emp => <option key={emp.id} value={emp.name}>{emp.name}</option>)}
                  </select>
                  <input type="month" value={historyMonth} onChange={e => setHistoryMonth(e.target.value)} className="px-5 py-3 rounded-xl border border-slate-200 font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 focus:outline-none focus:border-slate-400 transition-colors" />
                </div>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-100">
                <table className="w-full text-left">
                  <thead className="bg-slate-50/80 border-b border-slate-100 text-slate-500 text-xs uppercase tracking-wider">
                    <tr>
                      <th className="p-4 font-black">วันที่ / รหัสเอกสาร</th>
                      <th className="p-4 font-black">ชื่อพนักงาน</th>
                      <th className="p-4 font-black text-center">ประเภทการเบิก</th>
                      <th className="p-4 font-black text-right">ยอดสุทธิ (บาท)</th>
                      <th className="p-4 font-black text-center w-32">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm divide-y divide-slate-50">
                    {isLoadingHistory ? (
                      <tr><td colSpan={5} className="p-16 text-center text-slate-400 font-bold text-base">⏳ กำลังสืบค้นข้อมูล...</td></tr>
                    ) : historyRecords.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-16 text-center">
                          <div className="text-4xl mb-3 opacity-50">📄</div>
                          <p className="text-slate-500 font-bold text-base">ไม่พบประวัติการทำรายการในเดือนนี้</p>
                        </td>
                      </tr>
                    ) : (
                      historyRecords.map(record => (
                        <tr key={record.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-4">
                            <p className="font-bold text-slate-800">{new Date(record.date).toLocaleDateString('th-TH', { month:'short', day:'numeric', year:'numeric'})}</p>
                            <p className="text-[10px] text-slate-400 mt-1 font-medium">{record.id}</p>
                          </td>
                          <td className="p-4">
                            <p className="font-black text-slate-700">{record.employeeName}</p>
                            <p className="text-[10px] text-slate-500 mt-0.5 bg-slate-100 w-fit px-2 py-0.5 rounded font-bold">{record.role}</p>
                            {record.note && <p className="text-[10px] text-rose-500 mt-1.5 flex items-center gap-1"><span>↳</span> {record.note}</p>}
                          </td>
                          <td className="p-4 text-center">
                            <span className={`font-bold text-[10px] px-3 py-1.5 rounded-full border ${record.type === 'ค่าเที่ยว' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                              {record.type}
                            </span>
                          </td>
                          <td className="p-4 text-right font-black text-slate-800 text-base">{Number(record.amount).toLocaleString()}</td>
                          <td className="p-4 text-center">
                            <div className="flex gap-2 justify-center">
                              <button onClick={() => reprintVoucher(record)} className="p-2 bg-white border border-slate-200 hover:bg-blue-50 text-slate-600 hover:text-blue-600 hover:border-blue-200 font-bold text-sm rounded-xl transition-all shadow-sm">🖨️</button>
                              <button onClick={() => handleDelete(record.id)} className="p-2 bg-white border border-slate-200 hover:bg-rose-50 text-slate-400 hover:text-rose-600 hover:border-rose-200 rounded-xl transition-all shadow-sm">✕</button>
                            </div>
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
      </div>

      {/* 🖨️ รูปแบบเอกสารการพิมพ์ A4 (ซ่อนไว้สำหรับพิมพ์) */}
      {printSlip && (
        <div className="hidden print:block text-black font-sans bg-white p-10 max-w-4xl mx-auto min-h-screen">
          
          {/* 🌟 ใช้งาน Type Narrowing ด้วยเงื่อนไข 'employeeName' in printSlip */}
          {'employeeName' in printSlip ? (
            // ========================== ใบสำคัญจ่าย (Voucher) ==========================
            <>
              <div className="text-center mb-8 pb-6 border-b-4 border-black">
                <h1 className="text-3xl font-black mb-2">ใบสำคัญจ่าย (Payment Voucher)</h1>
                <p className="font-bold text-lg">คิงส์สว่าง โรงงานน้ำแข็งและน้ำดื่ม</p>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-8 text-base">
                <div><p><span className="font-bold">จ่ายให้ (Payee):</span> {printSlip.employeeName}</p><p><span className="font-bold">ตำแหน่ง:</span> {printSlip.role}</p></div>
                <div className="text-right"><p><span className="font-bold">เลขที่เอกสาร (No):</span> {printSlip.id}</p><p><span className="font-bold">วันที่ (Date):</span> {printSlip.date}</p></div>
              </div>

              <table className="w-full border-collapse border-2 border-black text-base mb-8">
                <thead><tr className="bg-gray-200 border-b-2 border-black"><th className="border-r border-black py-3 px-4 text-left">รายการ (Description)</th><th className="py-3 px-4 text-right w-48">จำนวนเงิน (Amount)</th></tr></thead>
                <tbody>
                  <tr className="border-b border-black">
                    <td className="border-r border-black p-4 font-bold">{printSlip.type === 'ค่าเที่ยว' ? 'จ่ายค่าเที่ยวประจำวัน' : 'เบิกเงินล่วงหน้า (เงินยืม)'}</td>
                    <td className="p-4 text-right font-black text-xl">{(printSlip.details?.grossAmount || printSlip.amount).toLocaleString()}</td>
                  </tr>
                  {(printSlip.details?.totalPenalty || 0) > 0 && (
                    <tr className="border-b border-black bg-gray-100">
                      <td className="border-r border-black p-4 font-bold text-gray-700">หัก: ค่ากระสอบหาย ({printSlip.details?.lostBags} ใบ x {printSlip.details?.penaltyPerBag} บ.)</td>
                      <td className="p-4 text-right font-bold text-lg text-gray-700">-{(printSlip.details?.totalPenalty || 0).toLocaleString()}</td>
                    </tr>
                  )}
                  <tr className="bg-gray-200 border-b-2 border-black">
                    <td className="border-r border-black p-4 font-black text-right text-xl">ยอดสุทธิที่จ่าย (Net Amount)</td>
                    <td className="p-4 text-right font-black text-3xl underline">{printSlip.amount.toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>

              {printSlip.note && <div className="mb-12"><p className="font-bold">หมายเหตุ (Remarks):</p><p className="p-3 border border-gray-400 bg-gray-50">{printSlip.note}</p></div>}

              <div className="grid grid-cols-3 gap-8 text-center mt-32 text-sm">
                <div><div className="border-b border-black mx-8 h-10 mb-2"></div><p className="mb-1">( {printSlip.employeeName} )</p><p className="font-bold">ผู้รับเงิน (Payee)</p></div>
                <div><div className="border-b border-black mx-8 h-10 mb-2"></div><p className="mb-1">( {printSlip.by} )</p><p className="font-bold">ผู้จ่ายเงิน (Payer)</p></div>
                <div><div className="border-b border-black mx-8 h-10 mb-2"></div><p className="mb-1">( ........................................ )</p><p className="font-bold">ผู้อนุมัติ (Authorized By)</p></div>
              </div>
            </>
          ) : (
            // ========================== ใบรับเงินเดือน (Payslip) ==========================
            <>
              <div className="text-center mb-8 pb-6 border-b-4 border-black">
                <h1 className="text-3xl font-black mb-2">ใบรับเงินเดือน (Payslip)</h1>
                <p className="font-bold text-lg">คิงส์สว่าง โรงงานน้ำแข็งและน้ำดื่ม</p>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-8 text-base">
                <div><p><span className="font-bold">ชื่อพนักงาน:</span> {printSlip.empInfo?.name}</p><p><span className="font-bold">ตำแหน่ง:</span> {printSlip.empInfo?.role}</p></div>
                <div className="text-right"><p><span className="font-bold">ประจำเดือน:</span> {printSlip.month}</p><p><span className="font-bold">วันที่พิมพ์:</span> {printSlip.datePrinted}</p></div>
              </div>

              <div className="grid grid-cols-2 gap-8 text-base border-2 border-black p-0 mb-8">
                <div className="border-r border-black p-0">
                  <div className="bg-gray-200 font-black p-3 border-b border-black text-center">รายได้ (Earnings)</div>
                  <div className="flex justify-between p-4 border-b border-gray-300"><span className="font-bold">เงินเดือนพื้นฐาน (Base Salary)</span><span>{printSlip.baseSalary.toLocaleString()}</span></div>
                  <div className="flex justify-between p-4"><span className="font-bold">รวมค่าเที่ยวสะสม (Trip Fees)</span><span>{printSlip.totalTripFee.toLocaleString()}</span></div>
                </div>
                <div className="p-0">
                  <div className="bg-gray-200 font-black p-3 border-b border-black text-center">รายการหัก (Deductions)</div>
                  <div className="flex justify-between p-4 border-b border-gray-300"><span className="font-bold text-gray-700">เบิกล่วงหน้าสะสม (Advances)</span><span>{printSlip.totalAdvance.toLocaleString()}</span></div>
                  <div className="flex justify-between p-4"><span className="font-bold text-gray-700">ค่าปรับ/กระสอบหายสะสม (Penalties)</span><span>{printSlip.totalPenaltyPaid.toLocaleString()}</span></div>
                </div>
              </div>

              <div className="flex justify-between items-center border-2 border-black bg-gray-100 p-6">
                <span className="font-black text-2xl">รายรับสุทธิ (Net Pay)</span>
                <span className="font-black text-4xl underline">{printSlip.netSalary.toLocaleString()} บาท</span>
              </div>

              <div className="grid grid-cols-2 gap-16 text-center mt-32 text-base">
                <div><div className="border-b border-black mx-16 h-10 mb-2"></div><p className="font-bold">ผู้จ่ายเงิน (Employer)</p></div>
                <div><div className="border-b border-black mx-16 h-10 mb-2"></div><p className="font-bold">พนักงานผู้รับเงิน (Employee)</p></div>
              </div>
            </>
          )}

        </div>
      )}
    </>
  )
}