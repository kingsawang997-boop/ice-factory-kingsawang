'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

// กำหนดโครงสร้างข้อมูลสินค้าให้ TypeScript รู้จัก
interface Product {
  id: string
  name: string
  category: string
  price: number
  size: string | null
  stock: number
}

export default function Home() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchProducts() {
      // ดึงข้อมูลจากตาราง products บน Supabase
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('price', { ascending: false }) // เรียงจากราคามากไปน้อย

      if (error) {
        console.error('Error fetching products:', error)
      } else if (data) {
        setProducts(data)
      }
      setLoading(false)
    }

    fetchProducts()
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        {/* หัวข้อระบบ */}
        <header className="mb-8 text-center bg-blue-600 text-white p-6 rounded-2xl shadow-md">
          <h1 className="text-3xl font-bold">ระบบบริหารจัดการ โรงน้ำแข็ง คิงส์สว่าง</h1>
          <p className="mt-2 text-blue-100">ข้อมูลประเภทสินค้าและราคากลางในระบบ</p>
        </header>

        {/* ตารางแสดงข้อมูลสินค้า */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 bg-gray-50">
            <h2 className="text-xl font-semibold text-gray-800">รายการน้ำแข็งและน้ำดื่มทั้งหมด</h2>
          </div>

          {loading ? (
            <div className="p-8 text-center text-gray-500">กำลังโหลดข้อมูลจากฐานข้อมูล Supabase...</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {products.map((product) => (
                <div key={product.id} className="p-4 flex justify-between items-center hover:bg-gray-50 transition">
                  <div>
                    <h3 className="font-medium text-gray-950 text-lg">{product.name}</h3>
                    <span className={`inline-block mt-1 text-xs px-2.5 py-0.5 rounded-full font-medium ${
                      product.category === 'ice' ? 'bg-blue-50 text-blue-700' : 'bg-green-50 text-green-700'
                    }`}>
                      {product.category === 'ice' ? '💧 ประเภท: น้ำแข็ง' : '🥤 ประเภท: น้ำดื่ม'}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-blue-600">
                      {product.price > 0 ? `${product.price} บาท` : 'ยังไม่ระบุราคา'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">คงเหลือในคลัง: {product.stock} หน่วย</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}