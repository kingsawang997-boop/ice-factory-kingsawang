'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

function SectionTitle({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 px-3 mt-8 mb-3 first:mt-2">
      <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 shrink-0">
        {title}
      </h3>
      <div className="h-px bg-slate-800/60 w-full rounded-full"></div>
    </div>
  )
}

export default function Sidebar() {
  const pathname = usePathname()
  const isActive = (path: string) => pathname === path

  const [userRole, setUserRole] = useState('')
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    const hydrateUser = () => {
      const session = localStorage.getItem('kingsawang_session')
      if (session) {
        try {
          const userData = JSON.parse(session)
          setUserRole(String(userData.role || '').trim())
        } catch (err) {
          console.error('Session Error:', err)
          setUserRole('')
        }
      } else {
        setUserRole('')
      }
      setIsMounted(true)
    }

    const timeoutId = window.setTimeout(hydrateUser, 0)
    return () => window.clearTimeout(timeoutId)
  }, [])

  const handleLogout = () => {
    if (confirm('คุณต้องการออกจากระบบ ใช่หรือไม่?')) {
      localStorage.removeItem('kingsawang_session')
      window.location.href = '/login'
    }
  }

  if (!isMounted) return <div className="w-[260px] bg-[#070b14] min-h-screen print:hidden shrink-0"></div>

  const roleCheck = userRole.toLowerCase()
  if (roleCheck.includes('หน้าลาน') || roleCheck.includes('แคชเชียร์')) return null;
  const isDev = roleCheck.includes('พัฒนา') || roleCheck.includes('dev')

  // 🌟 Pro Style: เมนูหลัก (Main Menu)
  const menuClass = (path: string) => 
    `group flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all duration-300 ${
      isActive(path) 
        ? 'bg-gradient-to-r from-blue-600/20 to-blue-600/5 text-blue-400 font-bold border border-blue-500/20 shadow-[inset_0_0_12px_rgba(59,130,246,0.1)]' 
        : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
    }`

  // 🌟 Pro Style: เมนูย่อย (Sub Menu)
  const subMenuClass = (path: string) => 
    `group flex items-center gap-3 py-2.5 pl-4 pr-3 text-[13px] transition-all duration-300 border-l-[3px] ml-2.5 ${
      isActive(path) 
        ? 'border-blue-500 text-blue-400 font-bold bg-gradient-to-r from-blue-500/10 to-transparent rounded-r-xl' 
        : 'border-slate-800 text-slate-500 hover:border-slate-600 hover:text-slate-300'
    }`

  return (
    <aside className="w-[260px] bg-[#070b14] border-r border-slate-800/80 h-screen sticky top-0 flex flex-col shrink-0 print:hidden z-50 shadow-[4px_0_24px_rgba(0,0,0,0.2)]">
      
      {/* 🌟 Redesigned Header/Logo */}
      <div className="h-[76px] flex items-center px-5 border-b border-slate-800/80 shrink-0 bg-gradient-to-b from-white/[0.02] to-transparent">
        <div className="flex items-center gap-3 w-full">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-500/20 shrink-0 border border-blue-400/20">
            <span className="text-white font-black text-xl tracking-tighter">K</span>
          </div>
          <div className="flex-1 truncate">
            <h2 className="text-base font-black text-slate-100 tracking-tight flex items-center gap-1.5">
              คิงส์สว่าง 
              <span className="text-[9px] text-blue-300 bg-blue-500/20 border border-blue-500/30 px-1.5 py-0.5 rounded-md uppercase tracking-wider">ERP</span>
            </h2>
          </div>
        </div>
      </div>

      {/* 🌟 Navigation Menu */}
      <div className="flex-1 overflow-y-auto px-4 py-6 scrollbar-hide [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        
        <Link href="/" className={menuClass('/')}>
          <span className="text-lg transition-transform duration-300 group-hover:scale-110">🏠</span> หน้าแรก / แดชบอร์ด
        </Link>

        <SectionTitle title="1. ระบบขาย" />
        <div className="space-y-1">
          <Link href="/sales/pos" className={menuClass('/sales/pos')}>
            <span className="text-lg transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3">🛒</span> ขายด่วนหน้าร้าน (POS)
          </Link>
        </div>

        <SectionTitle title="2. ระบบจัดซื้อ" />
        <div className="space-y-1">
          <Link href="/purchasing" className={menuClass('/purchasing')}>
            <span className="text-lg transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3">📦</span> จัดซื้อสินค้า (PO)
          </Link>
        </div>

        {/* 🌟 3. ระบบสต๊อกสินค้า (เพิ่มเมนูซ่อมบำรุงและอัปเดตชื่อคลัง) */}
        <SectionTitle title="3. ระบบสต๊อกสินค้า" />
        <div className="space-y-1">
          <Link href="/inventory" className={menuClass('/inventory')}>
            <span className="text-lg transition-transform duration-300 group-hover:scale-110">🏭</span> คลังสินค้า / กระสอบเปล่า
          </Link>
          <Link href="/inventory/truck-loading" className={subMenuClass('/inventory/truck-loading')}>
            <span className="transition-transform duration-300 group-hover:translate-x-1">🚚</span> จ่ายสินค้าขึ้นหน่วยรถ
          </Link>
          <Link href="/inventory/coolers" className={subMenuClass('/inventory/coolers')}>
            <span className="transition-transform duration-300 group-hover:translate-x-1">🧊</span> ยืม-คืนถังน้ำแข็ง
          </Link>
          <Link href="/trucks/maintenance" className={subMenuClass('/trucks/maintenance')}>
            <span className="transition-transform duration-300 group-hover:translate-x-1">🔧</span> ประวัติซ่อมบำรุงรถยนต์
          </Link>
        </div>

        <SectionTitle title="4. งานบุคคล (HR)" />
        <div className="space-y-1">
          <Link href="/hr/employees" className={subMenuClass('/hr/employees')}>
            <span className="transition-transform duration-300 group-hover:translate-x-1">🧑‍💼</span> จัดการรายชื่อพนักงาน
          </Link>
          <Link href="/hr/trucks" className={subMenuClass('/hr/trucks')}>
            <span className="transition-transform duration-300 group-hover:translate-x-1">🚚</span> จัดการหน่วยรถสายส่ง
          </Link>
          <Link href="/hr" className={subMenuClass('/hr')}>
            <span className="transition-transform duration-300 group-hover:translate-x-1">💰</span> เงินเดือน / ค่าเที่ยว
          </Link>
        </div>

        <SectionTitle title="5. ระบบบัญชี" />
        <div className="space-y-1">
          <Link href="/accounting/sales-summary" className={subMenuClass('/accounting/sales-summary')}>
            <span className="transition-transform duration-300 group-hover:translate-x-1">📝</span> บันทึกสรุปยอดสายส่ง
          </Link>
          <Link href="/accounting" className={subMenuClass('/accounting')}>
            <span className="transition-transform duration-300 group-hover:translate-x-1">📊</span> สรุปงบรายวัน
          </Link>
          <Link href="/accounting/monthly-summary" className={subMenuClass('/accounting/monthly-summary')}>
            <span className="transition-transform duration-300 group-hover:translate-x-1">📈</span> สรุปงบประจำเดือน
          </Link>
          <Link href="/accounting/field-delivery" className={subMenuClass('/accounting/field-delivery')}>
            <span className="transition-transform duration-300 group-hover:translate-x-1">🚚</span> สรุปส่งหน้าลาน
          </Link>
          <Link href="/expenses" className={subMenuClass('/expenses')}>
            <span className="transition-transform duration-300 group-hover:translate-x-1">💸</span> บันทึกรายจ่ายประจำวัน
          </Link>
          <Link href="/accounting/debtors" className={subMenuClass('/accounting/debtors')}>
            <span className="transition-transform duration-300 group-hover:translate-x-1">🤝</span> ทะเบียนลูกหนี้ / เครดิต
          </Link>
          <Link href="/accounting/suppliers" className={subMenuClass('/accounting/suppliers')}>
            <span className="transition-transform duration-300 group-hover:translate-x-1">🏭</span> ทะเบียนผู้จัดจำหน่าย
          </Link>
        </div>

        <SectionTitle title="6. ระบบแอดมิน" />
        <div className="space-y-1">
          <Link href="/admin/permissions" className={menuClass('/admin/permissions')}>
            <span className="text-lg transition-transform duration-300 group-hover:scale-110">🛡️</span> จัดการสิทธิ์เข้าถึงเมนู
          </Link>
          <Link href="/admin/products" className={menuClass('/admin/products')}>
            <span className="text-lg transition-transform duration-300 group-hover:scale-110">📦</span> จัดการข้อมูลสินค้า
          </Link>
          <Link href="/admin/drawer-logs" className={menuClass('/admin/drawer-logs')}>
            <span className="text-lg transition-transform duration-300 group-hover:scale-110">🚨</span> ตรวจสอบเปิดลิ้นชัก
          </Link>

          {isDev && (
            <div className="pt-4 mt-4">
              <Link href="/admin/developer" className={`group flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-bold transition-all duration-300 border ${isActive('/admin/developer') ? 'bg-rose-500/20 text-rose-400 border-rose-500/30 shadow-[inset_0_0_12px_rgba(244,63,94,0.15)]' : 'bg-rose-500/5 text-rose-500/70 border-rose-500/10 hover:bg-rose-500/10 hover:text-rose-400'}`}>
                <span className="text-lg animate-pulse">👨‍💻</span> ตั้งค่าระบบ (Dev Only)
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* 🌟 Redesigned Logout Button */}
      <div className="p-4 border-t border-slate-800/80 bg-gradient-to-t from-black/20 to-transparent shrink-0">
        <button 
          onClick={handleLogout} 
          className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl text-sm font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500 hover:text-white transition-all duration-300 active:scale-95 group shadow-sm hover:shadow-rose-500/25"
        >
          <span className="text-lg group-hover:-translate-y-0.5 transition-transform duration-300">🚪</span>
          <span>ออกจากระบบ (Logout)</span>
        </button>
      </div>

    </aside>
  )
}