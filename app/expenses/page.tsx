'use client'

import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [employeeName, setEmployeeName] = useState('พนักงานบัญชี')

  // สำหรับเลือกดูข้อมูลรายเดือน
  const currentDate = new Date()
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth())
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear())

  // ฟอร์มบันทึกรายจ่าย
  const [formData, setFormData] = useState({
    amount: '',
    category: 'ค่าน้ำมัน (สายส่ง)',
    note: '',
    expenseDate: currentDate.toISOString().split('T')[0] // ค่าเริ่มต้นคือวันนี้ (YYYY-MM-DD)
  })

  useEffect(() => {
    const session = localStorage.getItem('kingsawang_session')
    if (session) setEmployeeName(JSON.parse(session).name)
    fetchExpenses()
  }, [selectedMonth, selectedYear])

  const fetchExpenses = async () => {
    setIsLoading(true)
    const startDate = new Date(selectedYear, selectedMonth, 1).toLocaleDateString('en-CA')
    const endDate = new Date(selectedYear, selectedMonth + 1, 0).toLocaleDateString('en-CA')

    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .gte('created_at', `${startDate}T00:00:00+07:00`)
      .lte('created_at', `${endDate}T23:59:59+07:00`)
      .order('created_at', { ascending: false })

    if (data) setExpenses(data)
    setIsLoading(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.amount || Number(formData.amount) <= 0) return alert('กรุณาระบุจำนวนเงิน')

    const newId = `EXP-${Date.now().toString().slice(-6)}`
    
    // แปลงวันที่จากฟอร์ม ให้เป็น ISO String เพื่อให้เข้ากับระบบ
    // (ตั้งเวลาไว้ช่วงเที่ยง เพื่อหลีกเลี่ยงปัญหา Timezone ข้ามวัน)
    const recordDate = new Date(`${formData.expenseDate}T12:00:00+07:00`).toISOString()

    const payload = {
      id: newId,
      amount: Number(formData.amount),
      category: formData.category,
      note: formData.note || '-',
      recorded_by: employeeName,
      created_at: recordDate
    }

    const { error } = await supabase.from('expenses').insert([payload])

    if (error) {
      alert('เกิดข้อผิดพลาด: ' + error.message)
    } else {
      alert('✅ บันทึกรายจ่ายสำเร็จ!')
      setFormData({ ...formData, amount: '', note: '' }) // เคลียร์แค่จำนวนเงินและหมายเหตุ
      fetchExpenses()
    }
  }

  const handleDelete = async (id: string, note: string) => {
    if (!confirm(`⚠️ คุณต้องการลบรายการ "${note}" ใช่หรือไม่?\n(การลบข้อมูลจะส่งผลต่อยอดสรุปบัญชี)`)) return
    
    await supabase.from('expenses').delete().eq('id', id)
    fetchExpenses()
  }

  // คำนวณยอดรวมรายจ่ายในเดือนที่เลือก
  const totalExpense = useMemo(() => expenses.reduce((sum, item) => sum + Number(item.amount), 0), [expenses])

  const thaiMonths = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ]
  const years = Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - i)

  return (
    <div className="space-y-6 p-4 md:p-6 bg-slate-50/50 min-h-screen text-sm font-sans max-w-7xl mx-auto">
      
      {/* 🌟 Header */}
      <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center text-3xl shadow-sm border border-rose-100">💸</div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">บันทึกรายจ่ายประจำวัน</h1>
            <p className="text-slate-500 font-medium text-sm mt-1">ค่าน้ำมัน ค่าแรง ซื้อของเข้าร้าน และเบ็ดเตล็ด</p>
          </div>
        </div>
        
        <div className="flex bg-slate-50 border border-slate-200 rounded-xl p-1 shadow-inner w-full md:w-auto">
          <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))} className="bg-transparent border-none font-bold text-slate-700 px-4 py-3 focus:outline-none focus:ring-0 cursor-pointer">
            {thaiMonths.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
          <div className="w-px bg-slate-200 my-2"></div>
          <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} className="bg-transparent border-none font-bold text-slate-700 px-4 py-3 focus:outline-none focus:ring-0 cursor-pointer">
            {years.map(y => <option key={y} value={y}>{y + 543}</option>)}
          </select>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        
        {/* 🌟 ฟอร์มบันทึก (ฝั่งซ้าย) */}
        <div className="w-full lg:w-96 bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden shrink-0 sticky top-6">
          <div className="p-6 border-b border-slate-100 bg-slate-50">
            <h2 className="font-black text-lg text-slate-800">📝 เพิ่มรายจ่ายใหม่</h2>
          </div>
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600">วันที่ทำรายการ</label>
              <input type="date" required value={formData.expenseDate} onChange={e => setFormData({...formData, expenseDate: e.target.value})} className="w-full border-2 border-slate-200 px-4 py-3 rounded-xl font-bold focus:outline-none focus:border-rose-500 text-slate-700 bg-white" />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600">หมวดหมู่รายจ่าย</label>
              <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full border-2 border-slate-200 px-4 py-3 rounded-xl font-bold focus:outline-none focus:border-rose-500 text-slate-800 bg-white">
                <option value="ค่าน้ำมัน (สายส่ง)">⛽ ค่าน้ำมัน (สายส่ง)</option>
                <option value="ค่าแรง / เงินเดือน">👥 ค่าแรง / เงินเดือน</option>
                <option value="ซื้อของเข้าร้าน / วัตถุดิบ">📦 ซื้อของเข้าร้าน / วัตถุดิบ</option>
                <option value="ค่าซ่อมบำรุง / อะไหล่">🔧 ค่าซ่อมบำรุง / อะไหล่</option>
                <option value="ค่าน้ำ / ค่าไฟ">⚡ ค่าน้ำ / ค่าไฟ</option>
                <option value="เบ็ดเตล็ด / อื่นๆ">🛒 เบ็ดเตล็ด / อื่นๆ</option>
              </select>
            </div>

            <div className="space-y-1.5 pt-2">
              <label className="text-xs font-bold text-rose-600">จำนวนเงิน (บาท) <span className="text-rose-500">*</span></label>
              <input type="number" min="1" required value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} className="w-full border-2 border-rose-200 bg-rose-50 px-4 py-4 rounded-xl focus:outline-none focus:border-rose-500 font-black text-3xl text-center text-rose-700 shadow-inner" placeholder="0" />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600">รายละเอียด / หมายเหตุ</label>
              <input type="text" value={formData.note} onChange={e => setFormData({...formData, note: e.target.value})} className="w-full border-2 border-slate-200 px-4 py-3 rounded-xl focus:outline-none focus:border-rose-500 font-medium text-slate-700" placeholder="เช่น เติมน้ำมันรถทะเบียน บต.1234" />
            </div>

            <button type="submit" className="w-full bg-rose-600 hover:bg-rose-700 text-white font-black py-4 rounded-xl shadow-lg mt-6 active:scale-95 transition-transform text-base shadow-rose-500/30">
              💾 บันทึกรายจ่าย
            </button>
          </form>
        </div>

        {/* 🌟 รายการรายจ่าย (ฝั่งขวา) */}
        <div className="flex-1 w-full bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
            <div>
              <h2 className="font-black text-lg text-slate-800">📋 ประวัติรายจ่ายประจำเดือน</h2>
              <p className="text-xs font-bold text-slate-500 mt-0.5">{thaiMonths[selectedMonth]} {selectedYear + 543}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold text-rose-500 mb-0.5">รวมรายจ่ายทั้งเดือน</p>
              <p className="font-black text-2xl text-rose-600 tracking-tight">{totalExpense.toLocaleString()} <span className="text-sm">บ.</span></p>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-white border-b-2 border-slate-100 text-slate-400 text-[11px] uppercase tracking-wider whitespace-nowrap">
                <tr>
                  <th className="p-5 font-bold">วันที่</th>
                  <th className="p-5 font-bold">หมวดหมู่ / รายละเอียด</th>
                  <th className="p-5 font-bold">ผู้บันทึก</th>
                  <th className="p-5 font-bold text-right">จำนวนเงิน (บ.)</th>
                  <th className="p-5 font-bold text-center w-20">ลบ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {isLoading ? (
                  <tr><td colSpan={5} className="p-10 text-center text-rose-500 font-bold">⏳ กำลังโหลดข้อมูล...</td></tr>
                ) : expenses.length === 0 ? (
                  <tr><td colSpan={5} className="p-10 text-center text-slate-400 font-bold">ไม่พบรายการใช้จ่ายในเดือนนี้</td></tr>
                ) : (
                  expenses.map(exp => (
                    <tr key={exp.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-5 text-xs font-bold text-slate-500 whitespace-nowrap">
                        {new Date(exp.created_at).toLocaleDateString('th-TH', { day: '2-digit', month: 'short' })}
                      </td>
                      <td className="p-5">
                        <p className="font-black text-slate-800">{exp.category}</p>
                        <p className="text-[11px] font-medium text-slate-500 mt-1">{exp.note}</p>
                      </td>
                      <td className="p-5 text-xs font-bold text-slate-400">👤 {exp.recorded_by}</td>
                      <td className="p-5 text-right font-black text-rose-600 text-lg">
                        {Number(exp.amount).toLocaleString()}
                      </td>
                      <td className="p-5 text-center">
                        <button 
                          onClick={() => handleDelete(exp.id, exp.note)} 
                          className="w-8 h-8 rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white flex items-center justify-center transition-colors font-bold"
                          title="ลบรายการนี้"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  )
}