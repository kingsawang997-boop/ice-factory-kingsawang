'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function AdminProductsPage() {
  type Product = { id: string; name: string; category: string; price: number; unit?: string; icon?: string; image?: string; isActive?: boolean }
  const [products, setProducts] = useState<Product[]>([])
  const [activeFilter, setActiveFilter] = useState('all') 
  const [isLoading, setIsLoading] = useState(true) 
  
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  
  // 🌟 นำตัวแปร color ออก เพื่อให้ตรงกับโครงสร้าง Database
  const [formData, setFormData] = useState({
    name: '', category: 'main', price: 0, unit: 'กระสอบ', icon: '📦', image: '', isActive: true
  })

  const handleAddNew = () => {
    setEditingId(null)
    setFormData({ name: '', category: 'main', price: 0, unit: 'กระสอบ', icon: '📦', image: '', isActive: true })
    setIsModalOpen(true)
  }

  const handleEdit = (product: Product) => {
    setEditingId(product.id)
    setFormData({ 
      name: product.name, 
      category: product.category, 
      price: product.price, 
      unit: product.unit || 'ชิ้น', 
      icon: product.icon || '📦', 
      image: product.image || '', 
      // 🌟 แก้ไข: เติม ?? true เพื่อป้องกันค่า undefined ตามที่ TypeScript แจ้งเตือน
      isActive: product.isActive ?? true 
    })
    setIsModalOpen(true)
  }

  const fetchProducts = useCallback(async () => {
    setIsLoading(true)
    const { data, error } = await supabase.from('products').select('*').order('id', { ascending: true })
    
    if (error) {
      console.error('Error fetching products:', error)
    } else {
      setProducts(data || [])
    }
    setIsLoading(false)
  }, [])

  useEffect(() => { const load = async () => { await fetchProducts() }; void load() }, [fetchProducts])

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 2 * 1024 * 1024) return alert('ขนาดไฟล์ใหญ่เกินไป (จำกัด 2MB)')
      const reader = new FileReader()
      reader.onloadend = () => setFormData({ ...formData, image: reader.result as string })
      reader.readAsDataURL(file)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // 🌟 ปรับ Format ID สินค้าใหม่ให้เป็นระบบ
    const idToSave = editingId || `PROD-${Date.now().toString().slice(-6)}`
    const payload = { ...formData, id: idToSave }

    const { error } = await supabase.from('products').upsert(payload)

    if (error) {
      alert('เกิดข้อผิดพลาดในการบันทึก: ' + error.message)
    } else {
      alert('✅ บันทึกข้อมูลสินค้าสำเร็จ! (หน้า POS จะอัปเดตตามนี้ทันที)')
      setIsModalOpen(false)
      fetchProducts() 
    }
  }

  // 🌟 แก้ไข: ทำให้ currentStatus รองรับ undefined ป้องกัน Error ซ้อน
  const toggleActive = async (id: string, currentStatus?: boolean) => {
    const isCurrentlyActive = currentStatus ?? true
    setProducts(prev => prev.map(p => p.id === id ? { ...p, isActive: !isCurrentlyActive } : p))
    await supabase.from('products').update({ isActive: !isCurrentlyActive }).eq('id', id)
  }

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`⚠️ คุณแน่ใจหรือไม่ว่าต้องการลบ "${name}" ออกจากระบบถาวร?`)) {
      setProducts(prev => prev.filter(p => p.id !== id)) 
      await supabase.from('products').delete().eq('id', id) 
    }
  }

  // 🌟 เพิ่มตัวแปรสำหรับ Filter ข้อมูลที่ตกหล่นไป
  const filteredProducts = products.filter(p => activeFilter === 'all' || p.category === activeFilter)

  return (
    <div className="space-y-6 p-4 md:p-6 bg-slate-50/50 min-h-screen text-xs font-sans">
      <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-xl md:text-2xl font-black text-slate-900 flex items-center gap-3"><span className="text-2xl">⚙️</span> จัดการข้อมูลสินค้า (Product Master)</h1>
          </div>
          <p className="text-sm text-slate-500 font-medium">ตั้งค่าสินค้า ราคา หน่วยนับ และอัปโหลดรูปภาพ (เชื่อมต่อ Database จริงแล้ว 🟢)</p>
        </div>
        <button onClick={handleAddNew} className="bg-slate-900 hover:bg-black text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg flex justify-center items-center gap-2 active:scale-95 text-sm w-full md:w-auto">
          <span>➕</span> เพิ่มสินค้าใหม่
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {[{ id: 'all', label: 'รายการทั้งหมด' }, { id: 'main', label: '🧊 สินค้ากระสอบ/แพ็ค' }, { id: 'retail', label: '🛍️ สินค้าแบ่งขาย (ปลีก)' }].map(tab => (
          <button key={tab.id} onClick={() => setActiveFilter(tab.id)} className={`px-5 py-2.5 rounded-xl font-bold transition-all whitespace-nowrap text-sm ${activeFilter === tab.id ? 'bg-slate-900 text-white shadow-md' : 'bg-white text-slate-500 hover:bg-slate-100 border border-slate-200'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 text-xs">
                <th className="p-5 font-bold w-20 text-center">รูปภาพ</th>
                <th className="p-5 font-bold">ชื่อสินค้า</th>
                <th className="p-5 font-bold text-center">หมวดหมู่</th>
                <th className="p-5 font-bold text-right">ราคาขาย</th>
                <th className="p-5 font-bold text-center">สถานะ</th>
                <th className="p-5 font-bold text-center w-32">จัดการ</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-slate-50">
              {isLoading ? (
                <tr><td colSpan={6} className="p-10 text-center text-blue-500 font-bold">⏳ กำลังโหลดข้อมูลจาก Database...</td></tr>
              ) : filteredProducts.length === 0 ? (
                <tr><td colSpan={6} className="p-10 text-center text-slate-400 font-bold">ไม่มีข้อมูลสินค้า กรุณากด "เพิ่มสินค้าใหม่"</td></tr>
              ) : (
                filteredProducts.map(product => (
                  <tr key={product.id} className={`hover:bg-slate-50/50 transition-colors ${!(product.isActive ?? true) ? 'opacity-50 grayscale' : ''}`}>
                    <td className="p-4 text-center">
                      {product.image ? (
                        <div className="w-12 h-12 rounded-xl overflow-hidden shadow-sm mx-auto border border-slate-200 bg-white"><img src={product.image} alt={product.name} className="w-full h-full object-cover" /></div>
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-2xl mx-auto shadow-sm">{product.icon}</div>
                      )}
                    </td>
                    <td className="p-4 font-black text-slate-800 text-base">{product.name}<p className="text-[10px] text-slate-400 font-bold mt-0.5">ID: {product.id}</p></td>
                    <td className="p-4 text-center"><span className={`px-3 py-1 rounded-lg text-[10px] font-bold border ${product.category === 'main' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-orange-50 text-orange-700 border-orange-100'}`}>{product.category === 'main' ? 'กระสอบ/แพ็ค' : 'แบ่งขาย'}</span></td>
                    <td className="p-4 text-right"><span className="font-black text-blue-600 text-lg">{Number(product.price).toLocaleString()}</span><span className="text-[10px] text-slate-500 font-bold ml-1">บ. / {product.unit}</span></td>
                    <td className="p-4 text-center">
                      <button onClick={() => toggleActive(product.id, product.isActive)} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${(product.isActive ?? true) ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${(product.isActive ?? true) ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => handleEdit(product)} className="w-9 h-9 rounded-xl bg-slate-100 text-slate-600 hover:text-blue-600 hover:bg-blue-100 flex items-center justify-center transition-colors">✏️</button>
                        <button onClick={() => handleDelete(product.id, product.name)} className="w-9 h-9 rounded-xl bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white flex items-center justify-center transition-colors">🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
              <h3 className="font-black text-xl text-slate-900">{editingId ? '✏️ แก้ไขข้อมูลสินค้า' : '➕ เพิ่มสินค้าใหม่'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="w-8 h-8 rounded-full shadow-sm font-bold bg-white text-slate-400 hover:text-rose-500 border border-slate-200">✕</button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 overflow-y-auto space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">ชื่อสินค้า <span className="text-rose-500">*</span></label>
                <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full border-2 border-slate-200 px-4 py-3 rounded-xl focus:border-blue-500 font-bold focus:outline-none" placeholder="เช่น น้ำแข็งหลอดเล็ก" />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">หมวดหมู่ <span className="text-rose-500">*</span></label>
                  <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full border-2 border-slate-200 px-4 py-3 rounded-xl focus:border-blue-500 font-bold focus:outline-none bg-white">
                    <option value="main">กระสอบ/แพ็ค</option>
                    <option value="retail">แบ่งขาย (ปลีก)</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">หน่วยนับ <span className="text-rose-500">*</span></label>
                  <input type="text" required value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})} className="w-full border-2 border-slate-200 px-4 py-3 rounded-xl focus:border-blue-500 font-bold focus:outline-none" placeholder="กระสอบ, แพ็ค, แก้ว" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">ราคาขาย (บาท) <span className="text-rose-500">*</span></label>
                <input type="number" min="0" required value={formData.price} onChange={e => setFormData({...formData, price: Number(e.target.value)})} className="w-full border-2 border-blue-200 px-4 py-3 rounded-xl focus:border-blue-500 font-black text-2xl text-blue-700 bg-blue-50 focus:outline-none text-center" />
              </div>

              <div className="border-t border-slate-100 pt-5 space-y-4">
                <h4 className="font-black text-slate-800 text-sm">🖼️ รูปภาพและการแสดงผลในหน้า POS</h4>
                <div className="space-y-2">
                  {formData.image ? (
                    <div className="relative w-32 h-32 rounded-2xl border-2 border-slate-200 overflow-hidden group bg-white shadow-sm mx-auto">
                      <img src={formData.image} alt="Preview" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button type="button" onClick={() => setFormData({...formData, image: ''})} className="text-white text-xs font-bold bg-rose-500 px-3 py-2 rounded-xl hover:bg-rose-600">ลบรูปภาพ</button>
                      </div>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full h-32 bg-slate-50 border-2 border-slate-300 border-dashed rounded-2xl cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                        <span className="font-bold text-slate-500 text-sm">คลิกเพื่ออัปโหลดรูปภาพ</span>
                        <span className="text-[10px] text-slate-400 mt-1">(ขนาดไม่เกิน 2MB)</span>
                        <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                    </label>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500">หรือเลือกไอคอน (ถ้าไม่มีรูปภาพ)</label>
                  <div className="flex gap-2 justify-center">
                    {['🧊', '❄️', '🛍️', '🍼', '🥤', '🧃', '📦', '🎁'].map(icon => (
                      <button key={icon} type="button" onClick={() => setFormData({...formData, icon})} className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center transition-all ${formData.icon === icon ? 'bg-blue-100 border-2 border-blue-500 scale-110 shadow-sm' : 'bg-slate-50 border border-slate-200 hover:bg-slate-100'}`}>{icon}</button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <button type="submit" className="w-full py-4 rounded-xl font-black text-white bg-slate-900 hover:bg-black shadow-lg transition-transform active:scale-95">
                  💾 {editingId ? 'บันทึกการแก้ไข' : 'เพิ่มสินค้าเข้าระบบ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}