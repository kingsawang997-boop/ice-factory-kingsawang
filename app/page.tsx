'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function DashboardPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [stats, setStats] = useState({ todaySales: 0, lowStock: 0, pendingPO: 0, totalDebtors: 0 })
  
  // 🌟 State สำหรับเก็บชื่อคนล็อกอิน
  const [currentUser, setCurrentUser] = useState({ name: 'กำลังโหลด...', role: '' })

  const fetchDashboardStats = async () => {
    setIsLoading(true)
    const today = new Date()
    const todayStr = new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0]
    const startOfDay = `${todayStr}T00:00:00+07:00`
    const endOfDay = `${todayStr}T23:59:59+07:00`

    try {
      // 1. ยอดขายวันนี้ (จาก POS)
      const { data: salesData } = await supabase.from('sales').select('totalAmount').gte('createdAt', startOfDay).lte('createdAt', endOfDay)
      const todaySales = salesData?.reduce((sum, s) => sum + Number(s.totalAmount), 0) || 0

      // 2. สินค้าใกล้หมด (น้อยกว่า 20 ชิ้น)
      const { data: stockData } = await supabase.from('products').select('stock').eq('isActive', true).lt('stock', 20)
      const lowStock = stockData?.length || 0

      // 3. ใบสั่งซื้อรอรับของ (Pending PO)
      const { data: poData } = await supabase.from('purchase_orders').select('id').eq('status', 'pending')
      const pendingPO = poData?.length || 0

      // 4. ยอดหนี้ค้างรวม
      const { data: debtData } = await supabase.from('debtors').select('outstanding').gt('outstanding', 0)
      const totalDebtors = debtData?.reduce((sum, d) => sum + Number(d.outstanding), 0) || 0

      setStats({ todaySales, lowStock, pendingPO, totalDebtors })
    } catch (error) {
      console.error('Error fetching stats:', error)
    }
    setIsLoading(false)
  }

  useEffect(() => {
    const sessionTimer = window.setTimeout(() => {
      const session = localStorage.getItem('kingsawang_session')
      if (session) {
        const userData = JSON.parse(session)
        setCurrentUser({ name: userData.name, role: userData.role })
      }
    }, 0)

    const loadStats = async () => {
      await fetchDashboardStats()
    }

    loadStats()

    return () => window.clearTimeout(sessionTimer)
  }, [])

  // ข้อมูลเมนูทางลัด (Quick Links)
  const quickMenus = [
    { title: 'ขายหน้าร้าน (POS)', icon: '🛒', desc: 'ระบบคิดเงิน ทอนเงิน พิมพ์สลิป', link: '/sales/pos', color: 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-500 hover:text-white', badge: '' },
    { title: 'จ่ายของขึ้นรถ', icon: '🚚', desc: 'ตัดสต๊อกให้รถสายส่ง', link: '/inventory/truck-loading', color: 'bg-orange-50 text-orange-600 border-orange-100 hover:bg-orange-500 hover:text-white', badge: '' },
    { title: 'เช็คคลังสินค้า', icon: '📦', desc: 'ดูยอดคงเหลือ รับของเข้าคลัง', link: '/inventory', color: 'bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-600 hover:text-white', badge: stats.lowStock > 0 ? `${stats.lowStock} ใกล้หมด` : '' },
    { title: 'เคลียร์บิลสายส่ง', icon: '📝', desc: 'นับเงินกลับจากรถสายส่ง', link: '/accounting/sales-summary', color: 'bg-indigo-50 text-indigo-600 border-indigo-100 hover:bg-indigo-500 hover:text-white', badge: '' },
    { title: 'ทะเบียนลูกหนี้', icon: '🤝', desc: 'จัดการเครดิต และรับชำระหนี้', link: '/accounting/debtors', color: 'bg-rose-50 text-rose-600 border-rose-100 hover:bg-rose-500 hover:text-white', badge: '' },
    { title: 'จัดซื้อสินค้า (PO)', icon: '📋', desc: 'สั่งซื้อ กระสอบ ถังน้ำแข็ง', link: '/purchasing', color: 'bg-amber-50 text-amber-600 border-amber-100 hover:bg-amber-500 hover:text-white', badge: stats.pendingPO > 0 ? `${stats.pendingPO} รอรับของ` : '' },
  ]

  const adminMenus = [
    { title: 'สรุปงบประจำเดือน', icon: '📈', link: '/accounting/monthly-summary' },
    { title: 'ระบบเงินเดือนพนักงาน', icon: '💰', link: '/hr' },
    { title: 'จัดการข้อมูลสินค้า', icon: '⚙️', link: '/admin/products' },
    { title: 'ประวัติเปิดลิ้นชัก', icon: '🚨', link: '/admin/drawer-logs' },
  ]

  return (
    <div className="space-y-6 p-4 md:p-6 bg-slate-50/50 min-h-screen text-sm font-sans">
      
      {/* 🌟 Header & Greeting */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-8 rounded-[2rem] shadow-xl text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden">
        {/* ลายน้ำพื้นหลัง */}
        <div className="absolute -right-10 -top-20 text-[15rem] opacity-5 pointer-events-none select-none">🧊</div>
        
        <div className="relative z-10 space-y-2">
          <p className="text-blue-300 font-bold text-sm tracking-wider uppercase">ยินดีต้อนรับเข้าสู่ระบบ</p>
          <h1 className="text-3xl md:text-4xl font-black">คิงส์สว่าง Mini ERP</h1>
          <p className="text-slate-300 font-medium pt-2 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            เชื่อมต่อฐานข้อมูล Cloud สำเร็จ • อัปเดตข้อมูลล่าสุดแบบ Real-time
          </p>
        </div>
        
        <div className="relative z-10 bg-white/10 backdrop-blur-md border border-white/20 px-6 py-4 rounded-2xl flex items-center gap-4">
          <div className="w-12 h-12 bg-white text-slate-900 rounded-full flex items-center justify-center text-xl shadow-inner font-black">
            {currentUser.name.substring(0, 1)}
          </div>
          <div>
            <p className="font-bold text-white text-base">{currentUser.name}</p>
            <p className="text-xs text-blue-200 font-medium">{currentUser.role}</p>
          </div>
        </div>
      </div>

      {/* 🌟 KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-lg">💰</div>
            <span className="text-[10px] font-bold text-slate-400">วันนี้</span>
          </div>
          <p className="text-xs font-bold text-slate-500 mb-1">ยอดขายหน้าร้าน (POS)</p>
          {isLoading ? <div className="h-8 w-24 bg-slate-100 animate-pulse rounded"></div> : (
            <p className="font-black text-2xl text-slate-800">{stats.todaySales.toLocaleString()} <span className="text-sm text-slate-400">บ.</span></p>
          )}
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center text-lg">🤝</div>
            <span className="text-[10px] font-bold text-slate-400">สะสม</span>
          </div>
          <p className="text-xs font-bold text-slate-500 mb-1">ยอดหนี้รอเก็บรวม</p>
          {isLoading ? <div className="h-8 w-24 bg-slate-100 animate-pulse rounded"></div> : (
            <p className="font-black text-2xl text-rose-600">{stats.totalDebtors.toLocaleString()} <span className="text-sm text-rose-400">บ.</span></p>
          )}
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center text-lg">⚠️</div>
            <span className="text-[10px] font-bold text-slate-400">แจ้งเตือน</span>
          </div>
          <p className="text-xs font-bold text-slate-500 mb-1">สินค้าใกล้หมดคลัง</p>
          {isLoading ? <div className="h-8 w-24 bg-slate-100 animate-pulse rounded"></div> : (
            <p className="font-black text-2xl text-orange-600">{stats.lowStock} <span className="text-sm text-orange-400">รายการ</span></p>
          )}
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-lg">📋</div>
            <span className="text-[10px] font-bold text-slate-400">ติดตาม</span>
          </div>
          <p className="text-xs font-bold text-slate-500 mb-1">ใบสั่งซื้อรอรับของ</p>
          {isLoading ? <div className="h-8 w-24 bg-slate-100 animate-pulse rounded"></div> : (
            <p className="font-black text-2xl text-blue-600">{stats.pendingPO} <span className="text-sm text-blue-400">บิล</span></p>
          )}
        </div>
      </div>

      {/* 🌟 Quick Access Menu (เมนูลัดสำหรับพนักงาน) */}
      <div>
        <h2 className="font-black text-slate-800 text-lg mb-4 ml-2 flex items-center gap-2">🚀 เมนูใช้งานด่วน (Quick Links)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {quickMenus.map((menu, idx) => (
            <Link key={idx} href={menu.link} className={`p-6 rounded-[2rem] border transition-all duration-300 group flex items-center gap-5 shadow-sm active:scale-95 cursor-pointer ${menu.color}`}>
              <div className="text-4xl transition-transform group-hover:scale-110">{menu.icon}</div>
              <div className="flex-1">
                <h3 className="font-black text-lg mb-1">{menu.title}</h3>
                <p className="text-xs opacity-80 font-medium line-clamp-1">{menu.desc}</p>
              </div>
              {menu.badge && (
                <span className="bg-rose-500 text-white text-[10px] font-black px-3 py-1 rounded-full shadow-sm animate-pulse whitespace-nowrap">
                  {menu.badge}
                </span>
              )}
            </Link>
          ))}
        </div>
      </div>

      {/* 🌟 Admin Access Menu (เฉพาะผู้บริหาร) */}
      <div className="bg-slate-900 rounded-[2rem] p-6 md:p-8 mt-8 shadow-lg text-white">
        <h2 className="font-black text-white text-lg mb-5 flex items-center gap-2">👑 เมนูสำหรับผู้บริหาร / เจ้าของร้าน</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {adminMenus.map((menu, idx) => (
            <Link key={idx} href={menu.link} className="bg-slate-800 hover:bg-slate-700 border border-slate-700 p-5 rounded-3xl transition-all hover:-translate-y-1 text-center group cursor-pointer">
              <div className="text-3xl mb-3 transition-transform group-hover:scale-110">{menu.icon}</div>
              <h3 className="font-bold text-xs md:text-sm text-slate-300 group-hover:text-white transition-colors">{menu.title}</h3>
            </Link>
          ))}
        </div>
      </div>

    </div>
  )
}