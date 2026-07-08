'use client'

import { useState } from 'react'

export default function PurchasePage() {
  // 1. จำลองประวัติการสั่งซื้อ/จ่ายเงินหลังบ้าน
  const [purchaseLogs, setPurchaseLogs] = useState([
    { id: 'PO-001', date: '2026-06-25', supplier: 'โรงงานพลาสติกไทย', item: 'กระสอบบรรจุภัณฑ์น้ำแข็ง', qty: 1000, unit: 'ใบ', total: 5000, status: 'รับของแล้ว' },
    { id: 'PO-002', date: '2026-06-24', supplier: 'ปั๊มน้ำมัน ปตท.', item: 'น้ำมันดีเซล (รถเบอร์ 01)', qty: 80, unit: 'ลิตร', total: 2640, status: 'ชำระเงินแล้ว' },
    { id: 'PO-003', date: '2026-06-23', supplier: 'คลังน้ำดื่มสาขาใหญ่', item: 'น้ำดื่มคิงส์สว่าง 600ml', qty: 100, unit: 'แพ็ค', total: 3500, status: 'รับของแล้ว' },
  ])

  // 2. State สำหรับฟอร์มสร้างใบสั่งซื้อ/บันทึกจ่ายเงินใหม่
  const [supplier, setSupplier] = useState('')
  const [itemName, setItemName] = useState('')
  const [barcode, setBarcode] = useState('')
  const [qty, setQty] = useState(0)
  const [pricePerUnit, setPricePerUnit] = useState(0)
  const [vatType, setVatType] = useState('none') // none, include, exclude

  // --- ส่วนคำนวณอัตโนมัติ (Computed Fields) ---
  const subTotal = qty * pricePerUnit
  let vatAmount = 0
  let grandTotal = subTotal

  if (vatType === 'exclude') {
    vatAmount = subTotal * 0.07
    grandTotal = subTotal + vatAmount
  } else if (vatType === 'include') {
    vatAmount = subTotal - (subTotal / 1.07)
    grandTotal = subTotal
  }

  // ฟังก์ชันจำลองการบันทึกเอกสารจัดซื้อ
  const handleSavePurchase = (e: React.FormEvent) => {
    e.preventDefault()
    if (!supplier || !itemName || qty <= 0 || pricePerUnit <= 0) {
      alert('กรุณากรอกข้อมูลการจัดซื้อให้ครบถ้วนครับ')
      return
    }

    const newPO = {
      id: `PO-${String(purchaseLogs.length + 1).padStart(3, '0')}`,
      date: new Date().toISOString().split('T')[0],
      supplier,
      item: itemName,
      qty,
      unit: 'หน่วย',
      total: grandTotal,
      status: 'ชำระเงินแล้ว'
    }

    setPurchaseLogs([newPO, ...purchaseLogs])
    alert(`📄 บันทึกใบสั่งซื้อ/จ่ายเงินสำเร็จ!\nยอดสุทธิรวม VAT: ${grandTotal.toFixed(2)} บาท`)
    
    // ล้างฟอร์ม
    setSupplier('')
    setItemName('')
    setBarcode('')
    setQty(0)
    setPricePerUnit(0)
  }

  return (
    <div className="space-y-6">
      {/* ส่วนหัวหน้าจอ */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">📦 ระบบจัดซื้อและบันทึกค่าใช้จ่าย (Purchase)</h1>
          <p className="text-sm text-slate-500 mt-1">บันทึกใบสั่งซื้อสินค้า รับเข้าวัตถุดิบ และค่าใช้จ่ายต่างๆ ของโรงงานเพื่อคำนวณต้นทุน</p>
        </div>
      </div>

      {/* แบ่งพื้นที่เป็น 2 ส่วน: ซ้ายกรอกฟอร์ม / ขวาดูประวัติจัดซื้อ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* ฝั่งซ้าย: ฟอร์มบันทึกการจัดซื้อ / ใบสั่งซื้อ (PO) */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
            📝 สร้างบิลจัดซื้อ / บันทึกจ่ายเงิน
          </h2>

          <form onSubmit={handleSavePurchase} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">ผู้จัดจำหน่าย / ซัพพลายเออร์</label>
              <input 
                type="text" 
                placeholder="เช่น โรงงานกระสอบ, การไฟฟ้า, ชื่อปั๊มน้ำมัน"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-slate-600 mb-1">ชื่อสินค้า / รายการค่าใช้จ่าย</label>
                <input 
                  type="text" 
                  placeholder="เช่น กระสอบใบใหญ่, ค่าน้ำมันรถ"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">รหัสบาร์โค้ด (ถ้ามี)</label>
                <input 
                  type="text" 
                  placeholder="สแกนบาร์โค้ด"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:bg-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">จำนวนที่ซื้อ</label>
                <input 
                  type="number" 
                  value={qty || ''}
                  onChange={(e) => setQty(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">ราคาต่อหน่วย (บาท)</label>
                <input 
                  type="number" 
                  value={pricePerUnit || ''}
                  onChange={(e) => setPricePerUnit(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
                />
              </div>
            </div>

            {/* ระบบคำนวณภาษีมูลค่าเพิ่ม VAT 7% */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">การคำนวณภาษี (VAT 7%)</label>
              <div className="grid grid-cols-3 gap-2">
                <button 
                  type="button"
                  onClick={() => setVatType('none')}
                  className={`py-1.5 rounded-lg text-xs font-medium transition-all ${vatType === 'none' ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-600'}`}
                >
                  ไม่มี VAT
                </button>
                <button 
                  type="button"
                  onClick={() => setVatType('exclude')}
                  className={`py-1.5 rounded-lg text-xs font-medium transition-all ${vatType === 'exclude' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}
                >
                  VAT แยกนอก
                </button>
                <button 
                  type="button"
                  onClick={() => setVatType('include')}
                  className={`py-1.5 rounded-lg text-xs font-medium transition-all ${vatType === 'include' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}
                >
                  VAT รวมใน
                </button>
              </div>
            </div>

            {/* ส่วนสรุปตัวเลขท้ายบิล */}
            <div className="bg-slate-50 p-4 rounded-xl text-sm space-y-1.5 border border-slate-100">
              <div className="flex justify-between text-slate-500">
                <span>ราคารวมสินค้า:</span>
                <span>{subTotal.toLocaleString()} บาท</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>ภาษีมูลค่าเพิ่ม (7%):</span>
                <span>{vatAmount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} บาท</span>
              </div>
              <div className="flex justify-between font-bold text-slate-900 text-base pt-1.5 border-t border-slate-200">
                <span>ยอดเงินสุทธิที่ต้องจ่าย:</span>
                <span>{grandTotal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} บาท</span>
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-all shadow-lg shadow-blue-600/10"
            >
              💾 บันทึกใบสั่งซื้อและจ่ายเงิน
            </button>
          </form>
        </div>

        {/* ฝั่งขวา: ตารางแสดงประวัติรายงานการจัดซื้อสินค้าและบริการ */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">📋 ประวัติการจัดซื้อและค่าใช้จ่ายล่าสุด</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 text-xs font-semibold uppercase">
                  <th className="p-3 rounded-l-xl">เลขที่บิล</th>
                  <th className="p-3">ผู้จำหน่าย</th>
                  <th className="p-3">รายการ</th>
                  <th className="p-3 text-right">จำนวน</th>
                  <th className="p-3 text-right rounded-r-xl">ยอดสุทธิ (บาท)</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-slate-100">
                {purchaseLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-3 font-semibold text-blue-600 text-xs">{log.id}</td>
                    <td className="p-3 font-medium text-slate-800">{log.supplier}</td>
                    <td className="p-3 text-slate-600 text-xs">{log.item}</td>
                    <td className="p-3 text-right text-slate-500 text-xs">{log.qty} {log.unit}</td>
                    <td className="p-3 text-right font-bold text-slate-900">{log.total.toLocaleString()} บ.</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  )
}