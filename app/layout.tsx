import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Sidebar from '@/components/Sidebar'
import AuthGuard from './AuthGuard' // 🌟 1. นำเข้าป้อมยาม

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'คิงส์สว่าง Mini ERP - ระบบโรงงานน้ำแข็ง',
  description: 'ระบบบริหารงานขายและจัดการโรงงานน้ำแข็ง คิงส์สว่าง',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="th">
      <body className={`${inter.className} bg-slate-50 text-slate-900 antialiased`}>
        
        {/* 🛡️ 2. เอาป้อมยามมาครอบตึก (เนื้อหาทั้งหมด) ไว้ตรงนี้! */}
        <AuthGuard>
          
          <div className="flex min-h-screen">
            
            {/* แถบเมนูด้านข้าง (ซ่อนในมือถือ โชว์เฉพาะจอใหญ่ lg ขึ้นไป) */}
            <div className="hidden lg:block shrink-0 z-50">
              <Sidebar />
            </div>
            
            {/* พื้นที่แสดงเนื้อหา (ปรับ Padding ให้เป็น 0 ในมือถือ เพื่อให้แอปใช้พื้นที่เต็มจอ) */}
            <main className="flex-1 w-full p-0 lg:p-8 overflow-y-auto max-w-[1600px] mx-auto">
              {children}
            </main>
            
          </div>

        </AuthGuard>
        
      </body>
    </html>
  )
}