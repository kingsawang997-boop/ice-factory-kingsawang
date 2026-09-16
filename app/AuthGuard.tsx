'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  
  const [isLoading, setIsLoading] = useState(true)
  const [isLocked, setIsLocked] = useState(false)
  const [lockInfo, setLockInfo] = useState({ contact: '', reason: '' })
  const [globalFont, setGlobalFont] = useState('text-sm')

  const checkSecurity = useCallback(async () => {
    // 1. อนุญาตให้เข้าหน้า Login ได้เสมอ
    if (pathname === '/login') {
      setIsLoading(false)
      return
    }

    // 2. ขอดูบัตร (เช็ค LocalStorage)
    const sessionStr = localStorage.getItem('kingsawang_session')
    if (!sessionStr) {
      return router.push('/login')
    }
    
    const session = JSON.parse(sessionStr)
    const userRole = session.role || ''

    // 3. เช็คระบบ Billing & Config จาก Database
    const { data: config } = await supabase.from('app_settings').select('*').eq('id', 'system_config').single()
    
    if (config) {
      setGlobalFont(config.font_size || 'text-sm')
      
      const today = new Date()
      const nextBilling = new Date(config.next_billing_date)
      const isExpired = today > nextBilling
      
      if ((config.status === 'locked' || isExpired) && userRole !== 'ผู้พัฒนาโปรแกรม') {
         setIsLocked(true)
         setLockInfo({
           contact: config.developer_contact,
           reason: isExpired ? 'ระบบหมดอายุการใช้งาน (Expired)' : 'ระบบถูกระงับชั่วคราว (Locked by Admin)'
         })
         setIsLoading(false)
         return
      }
    }

    const isApprover = ['ผู้บริหาร', 'ผู้จัดการ', 'เจ้าของ', 'owner', 'manager', 'executive', 'director', 'admin', 'supervisor', 'dev', 'developer', 'ผู้พัฒนาโปรแกรม', 'พัฒนาโปรแกรม'].some(keyword => userRole.toLowerCase().includes(keyword.toLowerCase()))

    if (userRole.includes('หน้าลาน') || userRole.includes('แคชเชียร์')) {
       if (pathname === '/') {
         setIsLoading(false)
         return router.push('/sales/pos')
       }
       
       const allowedPaths = ['/sales/pos', '/inventory', '/inventory/truck-loading']
       if (!allowedPaths.includes(pathname)) {
         alert('⛔ ภัยคุกคาม: พนักงานหน้าร้านไม่มีสิทธิ์เข้าถึงเมนูนี้')
         return router.push('/sales/pos')
       }
    } else if (pathname === '/inventory/approvals' && !isApprover) {
       alert('⛔ คุณไม่มีสิทธิ์เข้าถึงหน้าอนุมัติสต๊อก')
       return router.push('/inventory')
    } else if (userRole.includes('บัญชี')) {
       if (pathname.startsWith('/admin')) {
         alert('⛔ ภัยคุกคาม: ฝ่ายบัญชีไม่มีสิทธิ์เข้าถึงเมนูผู้ดูแลระบบ')
         return router.push('/')
       }
    }

    setIsLoading(false)
  }, [pathname, router])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void checkSecurity()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [checkSecurity])

  // ⏱️ ระบบ Auto-Logout (เตะออกถ้าไม่ขยับเมาส์ 30 นาที)
  useEffect(() => {
    let timeout: NodeJS.Timeout
    const resetTimeout = () => {
      clearTimeout(timeout)
      timeout = setTimeout(() => {
        const session = localStorage.getItem('kingsawang_session')
        if (session && pathname !== '/login') {
          alert('⏱️ หมดเวลาการเชื่อมต่อ (ไม่มีการใช้งานเกิน 30 นาที) กรุณาล็อกอินใหม่')
          localStorage.removeItem('kingsawang_session')
          router.push('/login')
        }
      }, 30 * 60 * 1000) // 30 นาที
    }

    window.addEventListener('mousemove', resetTimeout)
    window.addEventListener('keydown', resetTimeout)
    window.addEventListener('touchstart', resetTimeout)
    resetTimeout()

    return () => {
      window.removeEventListener('mousemove', resetTimeout)
      window.removeEventListener('keydown', resetTimeout)
      window.removeEventListener('touchstart', resetTimeout)
      clearTimeout(timeout)
    }
  }, [pathname, router])

  // 🔲 หน้าจอโหลด
  if (isLoading) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-blue-400 font-black animate-pulse">⏳ Authenticating System...</div>

  // 🔒 หน้าจอตอนโดนล็อก (Billing Expired)
  if (isLocked) return (
     <div className="fixed inset-0 z-[9999] bg-slate-950 flex flex-col items-center justify-center text-white p-6">
        <div className="text-[100px] mb-6 animate-bounce">🔒</div>
        <h1 className="text-4xl md:text-5xl font-black text-rose-500 mb-2">SYSTEM LOCKED</h1>
        <p className="text-xl font-bold mb-8 text-slate-300">{lockInfo.reason}</p>
        
        <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800 text-center max-w-lg w-full shadow-2xl">
          <p className="text-slate-400 mb-4 font-medium">กรุณาติดต่อผู้พัฒนาโปรแกรมเพื่อต่ออายุการใช้งาน หรือปลดล็อกระบบ</p>
          <div className="text-2xl font-black text-emerald-400 p-5 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
            {lockInfo.contact}
          </div>
        </div>
        
        <button onClick={() => { localStorage.removeItem('kingsawang_session'); window.location.href='/login' }} className="mt-8 text-slate-500 hover:text-white underline font-bold transition-colors">
          ออกจากระบบ (Logout)
        </button>
     </div>
  )

  // ✅ ผ่านหมด เอาฟอนต์ที่ Dev ตั้งไว้ครอบทั้งระบบเลย!
  return <div className={`min-h-screen ${globalFont}`}>{children}</div>
}