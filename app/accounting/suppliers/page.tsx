'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('') 
  
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({ name: '', phone: '', address: '', taxId: '', note: '' })

  useEffect(() => { fetchSuppliers() }, [])

  const fetchSuppliers = async () => {
    setIsLoading(true)
    const { data, error } = await supabase.from('suppliers').select('*').order('createdAt', { ascending: false })
    if (!error) setSuppliers(data || [])
    setIsLoading(false)
  }

  const filteredSuppliers = suppliers.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (s.phone && s.phone.includes(searchQuery))
  )

  const handleAddNew = () => {
    setEditingId(null)
    setFormData({ name: '', phone: '', address: '', taxId: '', note: '' })
    setIsModalOpen(true)
  }

  const handleEdit = (supplier: any) => {
    setEditingId(supplier.id)
    setFormData({ name: supplier.name, phone: supplier.phone, address: supplier.address, taxId: supplier.taxId, note: supplier.note })
    setIsModalOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name) return alert('กรุณากรอกชื่อผู้จัดจำหน่าย')

    const payload = { ...formData }

    if (editingId) {
      // แก้ไข
      const { error } = await supabase.from('suppliers').update(payload).eq('id', editingId)
      if (error) alert('Error: ' + error.message)
      else { alert('✅ อัปเดตข้อมูลสำเร็จ'); setIsModalOpen(false); fetchSuppliers() }
    } else {
      // เพิ่มใหม่
      const newId = `SUP-${Date.now().toString().slice(-4)}`
      const { error } = await supabase.from('suppliers').insert([{ id: newId, ...payload }])
      if (error) alert('Error: ' + error.message)
      else { alert('✅ เพิ่มผู้จัดจำหน่ายใหม่สำเร็จ'); setIsModalOpen(false); fetchSuppliers() }
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`⚠️ ต้องการลบซัพพลายเออร์ "${name}" ถาวรหรือไม่?`)) {
      const { error } = await supabase.from('suppliers').delete().eq('id', id)
      if (!error) fetchSuppliers()
    }
  }

  return (
    <div className="space-y-6 p-4 md:p-6 bg-slate-50/50 min-h-screen text-xs">
      <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-2">
          <h1 className="text-xl md:text-2xl font-black text-slate-900 flex items-center gap-3"><span className="text-2xl">🏭</span> ทะเบียนผู้จัดจำหน่าย (Suppliers)</h1>
          <p className="text-sm text-slate-500 font-medium">บันทึกรายชื่อร้านค้า โรงงาน เพื่อใช้ในการเปิดบิลสั่งซื้อ (PO)</p>
        </div>
        <button onClick={handleAddNew} className="bg-slate-900 hover:bg-black text-white px-5 py-3 rounded-xl font-bold transition-all shadow-md flex justify-center items-center gap-2 active:scale-95 text-sm">
          <span>➕</span> เพิ่มซัพพลายเออร์ใหม่
        </button>
      </div>

      <div className="relative w-full max-w-md">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">🔍</div>
        <input type="text" placeholder="ค้นหาชื่อ, เบอร์โทร..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:border-blue-500 shadow-sm font-medium text-sm" />
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 text-[11px]">
            <tr><th className="p-4 font-bold">ชื่อผู้จัดจำหน่าย / ร้านค้า</th><th className="p-4 font-bold text-center">เลขประจำตัวผู้เสียภาษี</th><th className="p-4 font-bold">หมายเหตุ</th><th className="p-4 font-bold text-center w-32">จัดการ</th></tr>
          </thead>
          <tbody className="text-sm">
            {isLoading ? ( <tr><td colSpan={4} className="p-10 text-center text-slate-500 font-bold">⏳ โหลดข้อมูล...</td></tr> ) : filteredSuppliers.length === 0 ? ( <tr><td colSpan={4} className="p-10 text-center text-slate-400 font-bold">ยังไม่มีข้อมูลผู้จัดจำหน่าย</td></tr> ) : (
              filteredSuppliers.map(sup => (
                <tr key={sup.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="p-4">
                    <p className="font-bold text-slate-800 text-base">{sup.name}</p>
                    <p className="text-[10px] text-slate-500 font-bold mt-0.5">📞 {sup.phone || '-'} | ID: {sup.id}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5 truncate max-w-sm">{sup.address || '-'}</p>
                  </td>
                  <td className="p-4 text-center font-medium text-slate-600">{sup.taxId || '-'}</td>
                  <td className="p-4 text-slate-500 text-xs">{sup.note || '-'}</td>
                  <td className="p-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => handleEdit(sup)} className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 flex items-center justify-center">✏️</button>
                      <button onClick={() => handleDelete(sup.id, sup.name)} className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 flex items-center justify-center">🗑️</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal เพิ่ม/แก้ไข */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-black text-lg text-slate-900">{editingId ? '✏️ แก้ไขข้อมูลซัพพลายเออร์' : '➕ เพิ่มซัพพลายเออร์ใหม่'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="w-8 h-8 rounded-full bg-white text-slate-400 hover:text-rose-500 shadow-sm font-bold flex items-center justify-center">✕</button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4 overflow-y-auto">
              <div className="space-y-1.5"><label className="text-xs font-bold text-slate-700">ชื่อร้านค้า / โรงงาน <span className="text-rose-500">*</span></label><input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full border-2 border-slate-200 px-4 py-3 rounded-xl font-bold" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5"><label className="text-xs font-bold text-slate-700">เบอร์โทรศัพท์ติดต่อ</label><input type="text" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full border-2 border-slate-200 px-4 py-3 rounded-xl font-bold" /></div>
                <div className="space-y-1.5"><label className="text-xs font-bold text-slate-700">เลขประจำตัวผู้เสียภาษี</label><input type="text" maxLength={13} value={formData.taxId} onChange={e => setFormData({...formData, taxId: e.target.value})} className="w-full border-2 border-slate-200 px-4 py-3 rounded-xl font-bold" /></div>
              </div>
              <div className="space-y-1.5"><label className="text-xs font-bold text-slate-700">ที่อยู่ / สาขา</label><textarea rows={2} value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} className="w-full border-2 border-slate-200 px-4 py-3 rounded-xl font-bold resize-none" /></div>
              <div className="space-y-1.5"><label className="text-xs font-bold text-slate-700">หมายเหตุ / ขายสินค้าประเภทใด</label><input type="text" value={formData.note} onChange={e => setFormData({...formData, note: e.target.value})} placeholder="เช่น ร้านขายกระสอบพลาสติก" className="w-full border-2 border-slate-200 px-4 py-3 rounded-xl font-medium" /></div>
              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-xl shadow-lg mt-6">💾 บันทึกข้อมูล</button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}