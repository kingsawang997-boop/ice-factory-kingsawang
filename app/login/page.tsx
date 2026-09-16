'use client'

import { useState, useEffect, type FormEvent } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [appLogo, setAppLogo] = useState('') // 🌟 State สำหรับเก็บโลโก้
  const router = useRouter()

  // 🌟 ดึงข้อมูลตั้งค่าระบบ (โลโก้) ตอนเปิดหน้าเว็บ
  useEffect(() => {
    const fetchSystemSettings = async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('app_logo')
        .eq('id', 'system_config')
        .single()
        
      if (error) {
        console.warn('App settings load error:', error.message)
      }
      if (data && data.app_logo) {
        setAppLogo(data.app_logo)
      }
    }
    fetchSystemSettings()
  }, [])

  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    setErrorMsg('')

    // 1. ตรวจสอบ Username / Password
    const { data: user, error } = await supabase
      .from('employees')
      .select('id, name, role, isActive, isStockApprover')
      .eq('username', username)
      .eq('password', password)
      .single()

    if (error || !user) {
      setErrorMsg(error?.message ?? '❌ ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง')
      setIsLoading(false)
      return
    }

    if (!user.isActive) {
      setErrorMsg('❌ บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ')
      setIsLoading(false)
      return
    }

    // 2. ถ้าล็อกอินสำเร็จ ให้เก็บข้อมูลลง LocalStorage (จำลอง Session)
    const role = String(user.role || '')
    const isStockApprover = /ผู้บริหาร|ผู้จัดการ|เจ้าของ|ผู้พัฒนาโปรแกรม|ได้รับแต่งตั้ง|อนุมัติ|manager|director|owner|admin|approver/i.test(role)

    const sessionData = {
      id: user.id,
      name: user.name,
      role,
      isStockApprover: Boolean(user.isStockApprover) || isStockApprover,
      loginAt: new Date().getTime()
    }
    
    localStorage.setItem('kingsawang_session', JSON.stringify(sessionData))
    
    // 3. พาไปหน้าแรก
    router.push('/')
  }

  return (
    <div className="fixed inset-0 z-[999] bg-slate-900 flex items-center justify-center p-4 overflow-hidden">
      
      {/* ของตกแต่งพื้นหลัง */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-md bg-white/10 backdrop-blur-xl border border-white/20 p-8 rounded-[2.5rem] shadow-2xl relative z-10">
        <div className="text-center mb-8">
          {/* 🌟 แสดงโลโก้ (ถ้ามีรูปจาก DB จะโชว์รูป ถ้าไม่มีจะโชว์ไอคอนน้ำแข็ง) */}
          <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-blue-600 rounded-[2rem] mx-auto flex items-center justify-center text-5xl shadow-lg shadow-blue-500/30 mb-4 transform -rotate-6 overflow-hidden border-4 border-white/10">
            {appLogo ? (
              <Image
                src={appLogo}
                alt="KingSawang Logo"
                width={96}
                height={96}
                unoptimized
                className="w-full h-full object-cover transform rotate-6"
              />
            ) : (
              '🧊'
            )}
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">คิงส์สว่าง ERP</h1>
          <p className="text-blue-200 mt-2 text-sm font-medium">เข้าสู่ระบบเพื่อจัดการโรงงาน</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          {errorMsg && (
            <div className="bg-rose-500/20 border border-rose-500/50 text-rose-200 text-sm font-bold p-4 rounded-2xl text-center animate-in shake">
              {errorMsg}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-bold text-blue-100 pl-2">ชื่อผู้ใช้งาน (Username)</label>
            <input 
              type="text" 
              required
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full bg-slate-900/50 border-2 border-white/10 px-5 py-4 rounded-2xl focus:outline-none focus:border-blue-500 text-white font-bold transition-colors"
              placeholder="กรอกชื่อผู้ใช้งาน..."
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-blue-100 pl-2">รหัสผ่าน (Password)</label>
            <input 
              type="password" 
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-slate-900/50 border-2 border-white/10 px-5 py-4 rounded-2xl focus:outline-none focus:border-blue-500 text-white font-bold transition-colors tracking-widest"
              placeholder="••••••••"
            />
          </div>

          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-black py-4 rounded-2xl shadow-lg shadow-blue-500/25 transition-transform active:scale-95 text-lg mt-4 disabled:opacity-50 disabled:cursor-wait"
          >
            {isLoading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ ➔'}
          </button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-slate-400 text-xs">พัฒนาระบบโดย <span className="text-white font-bold">นายโต้งดอทคอม</span></p>
        </div>
      </div>
    </div>
  )
}
