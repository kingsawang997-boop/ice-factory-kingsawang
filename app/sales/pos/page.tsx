'use client'

import { useState, useEffect, useMemo } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type TabletNavProps = {
  pathname: string
  cashierName: string
}

type Product = {
  id: string
  name: string
  category: string
  price: number
  unit?: string
  image?: string
  icon?: string
  isActive?: boolean | string
  stock?: number
  color?: string
}

type CartItem = Product & {
  qty: number
}

type ReceiptItem = {
  id: string
  name: string
  qty: number
  price: number
  unit?: string
}

type PrintReceiptData = {
  receiptNo: string
  date: string
  cashier: string
  items: ReceiptItem[]
  total: number
  received: number
  change: number
  method: string
}

type ManualKickData = {
  isManualKick: true
}

type CloseShiftSlip = {
  id: string
  date: string
  cashAmount: number
  transferAmount: number
  actualCash: number
  diff: number
  by: string
}

function TabletNav({ pathname, cashierName }: TabletNavProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 shrink-0">
      <Link href="/" className="bg-white p-3 rounded-xl shadow-sm hover:bg-slate-50 text-slate-600 font-bold border border-slate-200 transition-all active:scale-95 flex items-center justify-center shrink-0">🏠</Link>
      <div className="flex bg-white rounded-xl p-1 border border-slate-200 shadow-sm shrink-0">
        <Link href="/sales/pos" className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${pathname === '/sales/pos' ? 'bg-emerald-50 text-emerald-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>🛒 POS</Link>
        <Link href="/inventory" className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${pathname === '/inventory' ? 'bg-blue-50 text-blue-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>📦 เช็คคลัง</Link>
        <Link href="/inventory/truck-loading" className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${pathname === '/inventory/truck-loading' ? 'bg-orange-50 text-orange-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>🚚 จ่ายรถ</Link>
      </div>
      <div className="bg-white px-3 py-2 rounded-xl border border-slate-200 font-bold text-slate-600 shadow-sm text-xs shrink-0 flex items-center gap-2">
        <span className="w-5 h-5 bg-slate-100 rounded-full flex items-center justify-center text-sm">👤</span>
        <span className="hidden md:inline">พนักงาน:</span> {cashierName}
      </div>
    </div>
  )
}

export default function POSPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [cart, setCart] = useState<CartItem[]>([])
  
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer'>('cash')
  const [cashReceived, setCashReceived] = useState<number | string>('')
  const [isFreeBill, setIsFreeBill] = useState(false)
  const [cashierName, setCashierName] = useState('กำลังโหลด...')

  const [isFieldDelivery, setIsFieldDelivery] = useState(false)
  const [fieldDeliveryEmployees, setFieldDeliveryEmployees] = useState<{ id: string; name: string; role: string }[]>([])
  const [selectedFieldDeliveryEmployee, setSelectedFieldDeliveryEmployee] = useState('')
  const [fieldDeliveryBags, setFieldDeliveryBags] = useState<number | string>(0)
  
  const [printFormat, setPrintFormat] = useState<'58mm' | 'A4'>('58mm')
  const [printReceipt, setPrintReceipt] = useState<PrintReceiptData | ManualKickData | null>(null)

  const [isClosingShift, setIsClosingShift] = useState(false)
  const [posCashToday, setPosCashToday] = useState(0)
  const [posTransferToday, setPosTransferToday] = useState(0)
  const [actualPosCash, setActualPosCash] = useState<number | string>('')
  const [closeShiftSlip, setCloseShiftSlip] = useState<CloseShiftSlip | null>(null)

  const [isPinModalOpen, setIsPinModalOpen] = useState(false)
  const [pinInput, setPinInput] = useState('')
  const [isVerifyingPin, setIsVerifyingPin] = useState(false)

  const [isScreenLocked, setIsScreenLocked] = useState(false)
  const [unlockPin, setUnlockPin] = useState('')
  const [isUnlocking, setIsUnlocking] = useState(false)

  const [isSackReturnModalOpen, setIsSackReturnModalOpen] = useState(false)
  const [sackReturnQty, setSackReturnQty] = useState<number | string>('')
  const [sackRefundRate, setSackRefundRate] = useState<number | string>(10)

  const [discountAmount, setDiscountAmount] = useState<number>(0)
  const [isDiscountModalOpen, setIsDiscountModalOpen] = useState(false)

  const pathname = usePathname()

  const fetchActiveProducts = async () => {
    setIsLoading(true)
    const { data } = await supabase.from('products').select('*').order('sort_order', { ascending: true })
    if (data) setProducts((data as Product[]).filter((p) => p.isActive === true || p.isActive === 'true'))
    setIsLoading(false)
  }

  useEffect(() => {
    const sessionTimer = window.setTimeout(() => {
      const session = localStorage.getItem('kingsawang_session')
      if (session) setCashierName(JSON.parse(session).name)
    }, 0)

    const loadProducts = async () => {
      await fetchActiveProducts()
    }

    const loadFieldDeliveryEmployees = async () => {
      const { data, error } = await supabase
        .from('employees')
        .select('id, name, role')
        .eq('isActive', true)
        .order('name', { ascending: true })

      if (!error && data) {
        const filtered = data.filter((emp: any) => !['ผู้บริหาร', 'แอดมิน', 'ผู้พัฒนาโปรแกรม', 'Admin', 'Manager'].includes((emp.role || '').trim()))
        setFieldDeliveryEmployees(filtered)
        if (filtered.length > 0 && !selectedFieldDeliveryEmployee) setSelectedFieldDeliveryEmployee(filtered[0].name)
      }
    }

    loadProducts()
    void loadFieldDeliveryEmployees()

    return () => window.clearTimeout(sessionTimer)
  }, [])

  const mainProducts = products.filter(p => p.category === 'main' || p.category === 'packaging')
  const retailProducts = products.filter(p => p.category === 'retail')

  const subTotal = useMemo(() => cart.reduce((sum, item) => sum + (item.price * item.qty), 0), [cart])
  const totalAmount = isFreeBill ? 0 : Math.max(0, subTotal - discountAmount)
  const change = useMemo(() => { const r = Number(cashReceived); return r > totalAmount ? r - totalAmount : 0 }, [cashReceived, totalAmount])

  const addToCart = (product: Product) => { setCart(prev => { const e = prev.find(i => i.id === product.id); return e ? prev.map(i => i.id === product.id ? { ...i, qty: i.qty + 1 } : i) : [...prev, { ...product, qty: 1 }] }) }
  const updateQty = (id: string, delta: number) => { setCart(prev => prev.map(i => i.id === id ? { ...i, qty: Math.max(0, i.qty + delta) } : i).filter(i => i.qty > 0)) }
  const editPrice = (id: string, currentPrice: number) => { const n = window.prompt('ราคาใหม่:', currentPrice.toString()); if(n) setCart(prev => prev.map(i => i.id === id ? { ...i, price: Number(n) } : i)) }
  const addCustomRetailItem = () => { const p = window.prompt('ลูกค้าระบุซื้อกี่บาท?'); if(p) addToCart({ id: `CUSTOM-${Date.now()}`, name: `น้ำแข็งแบ่งขาย/ตัก (${p}บ.)`, category: 'retail', price: Number(p), unit: 'ถุง', icon: '🛍️', image: '', isActive: true, color: 'bg-orange-50' }) }
  const removeFromCart = (id: string) => setCart(prev => prev.filter(i => i.id !== id))
  const clearCart = () => { setCart([]); setCashReceived(''); setPaymentMethod('cash'); setIsFreeBill(false); setDiscountAmount(0); }
  const addQuickCash = (amount: number) => setCashReceived(prev => Number(prev || 0) + amount)
  const exactCash = () => setCashReceived(totalAmount)

  const isMobileDevice = () => /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 1024

  const getEscPosImageBytes = (canvas: HTMLCanvasElement) => {
    const widthBytes = Math.ceil(canvas.width / 8);
    const height = canvas.height;
    const imgData = canvas.getContext('2d')?.getImageData(0, 0, canvas.width, height).data;
    if (!imgData) return new Uint8Array();
    
    const buffer = new Uint8Array(8 + (widthBytes * height));
    buffer.set([29, 118, 48, 0, widthBytes & 0xFF, (widthBytes >> 8) & 0xFF, height & 0xFF, (height >> 8) & 0xFF], 0);
    
    let offset = 8;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < widthBytes; x++) {
        let byte = 0;
        for (let bit = 0; bit < 8; bit++) {
          const px = (x * 8) + bit;
          if (px < canvas.width) {
            const idx = (y * canvas.width + px) * 4;
            if (imgData[idx + 3] > 128 && (imgData[idx] + imgData[idx + 1] + imgData[idx + 2]) / 3 < 128) {
              byte |= (1 << (7 - bit));
            }
          }
        }
        buffer[offset++] = byte;
      }
    }
    return buffer;
  }

  const sendToRawBT = (imageBuffer: Uint8Array) => {
    const kickDrawer = [27, 112, 0, 60, 255]; 
    const feedLines = [10, 10, 10];
    const payload = new Uint8Array([...kickDrawer, ...imageBuffer, ...feedLines]);
    
    let binaryString = '';
    for (let i = 0; i < payload.length; i++) {
      binaryString += String.fromCharCode(payload[i]);
    }
    window.location.href = `rawbt:base64,${btoa(binaryString)}`;
  }

  const drawReceiptAndPrint = (billNo: string, dateStr: string, cashier: string, cartItems: CartItem[], total: number, received: number, changeAmount: number) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    canvas.width = 384; 
    canvas.height = 500 + (cartItems.length * 60);

    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000000'; ctx.textBaseline = 'top';

    let y = 10;
    ctx.font = 'bold 28px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('คิงส์สว่าง โรงงานน้ำแข็ง', 192, y); y += 40;
    ctx.font = '22px sans-serif'; ctx.fillText('ใบเสร็จรับเงินอย่างย่อ', 192, y); y += 40;
    
    ctx.textAlign = 'left'; ctx.font = '20px sans-serif';
    ctx.fillText(`เลขที่: ${billNo}`, 10, y); y += 30;
    ctx.fillText(`วันที่: ${dateStr}`, 10, y); y += 30;
    ctx.fillText(`พนักงาน: ${cashier}`, 10, y); y += 30;

    ctx.beginPath(); ctx.setLineDash([5, 5]); ctx.moveTo(10, y); ctx.lineTo(374, y); ctx.stroke(); ctx.setLineDash([]); y += 15;

    cartItems.forEach(item => {
      ctx.fillText(item.name, 10, y); y += 25;
      ctx.fillText(`x${item.qty}`, 30, y);
      ctx.textAlign = 'right'; ctx.fillText(`${(item.price * item.qty).toLocaleString()} บ.`, 374, y); ctx.textAlign = 'left';
      y += 30;
    });

    ctx.beginPath(); ctx.setLineDash([5, 5]); ctx.moveTo(10, y); ctx.lineTo(374, y); ctx.stroke(); ctx.setLineDash([]); y += 15;

    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('ยอดสุทธิ:', 10, y); ctx.textAlign = 'right'; ctx.fillText(`${total.toLocaleString()} บ.`, 374, y); ctx.textAlign = 'left'; y += 35;
    ctx.fillText('รับเงินสด:', 10, y); ctx.textAlign = 'right'; ctx.fillText(`${received.toLocaleString()} บ.`, 374, y); ctx.textAlign = 'left'; y += 35;
    ctx.fillText('เงินทอน:', 10, y); ctx.textAlign = 'right'; ctx.fillText(`${changeAmount.toLocaleString()} บ.`, 374, y); ctx.textAlign = 'left'; y += 45;

    ctx.font = '20px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('ขอบคุณที่ใช้บริการครับ 🙏', 192, y); y += 40;

    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = 384; finalCanvas.height = y;
    finalCanvas.getContext('2d')?.drawImage(canvas, 0, 0);

    sendToRawBT(getEscPosImageBytes(finalCanvas));
  }

  const saveFieldDeliveryRecord = async (saleId: string, saleAmount: number) => {
    if (!isFieldDelivery || !selectedFieldDeliveryEmployee || Number(fieldDeliveryBags) <= 0) return

    const now = new Date()
    const deliveryDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const selectedEmployee = fieldDeliveryEmployees.find(emp => emp.name === selectedFieldDeliveryEmployee)

    try {
      const { error } = await supabase.from('field_delivery_daily').insert([{
        id: `FD-${Date.now()}`,
        date: deliveryDate,
        employee_name: selectedFieldDeliveryEmployee,
        employee_role: selectedEmployee?.role || 'พนักงานส่งหน้าลาน',
        bags_sold: Number(fieldDeliveryBags),
        sales_id: saleId,
        total_amount: Number(saleAmount || 0)
      }])

      if (error) {
        console.error('Field delivery log save failed', error)
      }
    } catch (err) {
      console.error('Field delivery log save failed', err)
    }
  }

  const handleCheckout = async () => {
    if (cart.length === 0) return alert('กรุณาเลือกสินค้า')
    if (isFieldDelivery && (!selectedFieldDeliveryEmployee || Number(fieldDeliveryBags) <= 0)) return alert('กรุณาเลือกพนักงานออกส่งหน้าลาน และระบุจำนวนกระสอบที่ขายได้')
    const finalReceived = cashReceived === '' ? totalAmount : Number(cashReceived)
    if (paymentMethod === 'cash' && !isFreeBill && finalReceived < totalAmount) return alert('รับเงินมาไม่ครบ!')

    const billNo = `POS-${Date.now().toString().slice(-4)}`
    const finalChange = isFreeBill ? 0 : (paymentMethod === 'transfer' ? 0 : finalReceived - totalAmount)
    const actualReceive = isFreeBill ? 0 : (paymentMethod === 'transfer' ? totalAmount : finalReceived)
    const currentDate = new Date().toISOString()
    const printDateStr = new Date().toLocaleString('th-TH')

    const newSale = { id: billNo, totalAmount, discount: discountAmount, subTotal, receiveAmount: actualReceive, changeAmount: finalChange, payMethod: isFreeBill ? 'free' : paymentMethod, items: cart, by: cashierName, createdAt: currentDate }
    await supabase.from('sales').insert([newSale])
    await saveFieldDeliveryRecord(billNo, totalAmount)

    const stockUpdatePromises = cart
      .filter(item => !String(item.id).startsWith('CUSTOM-'))
      .map(item => {
        const currentProduct = products.find(p => p.id === item.id)
        return supabase.from('products').update({ stock: Number(currentProduct?.stock || 0) - item.qty }).eq('id', item.id)
      })
    await Promise.all(stockUpdatePromises)

    const logId = `LOG-${Date.now()}`
    
    if (isFreeBill || paymentMethod === 'transfer') {
      await supabase.from('drawer_logs').insert([{ id: logId, employee_name: cashierName, role: 'แคชเชียร์', reason: `ขายบิล #${billNo} (${isFreeBill ? 'ให้ฟรี' : 'โอนเงิน'})`, print_status: 'ไม่พิมพ์บิล' }])
      alert('✅ บันทึกรายการและตัดสต๊อกสำเร็จ (ไม่ได้สั่งพิมพ์บิล)')
      clearCart(); setIsCheckoutModalOpen(false); fetchActiveProducts()
    } else {
      await supabase.from('drawer_logs').insert([{ id: logId, employee_name: cashierName, role: 'แคชเชียร์', reason: `เปิดอัตโนมัติ (ขายบิล #${billNo})`, print_status: 'พิมพ์บิล' }])
      setIsCheckoutModalOpen(false)

      const receiptData = { receiptNo: billNo, date: printDateStr, items: cart, total: totalAmount, received: actualReceive, change: finalChange, method: 'เงินสด', cashier: cashierName }

      if (printFormat === '58mm' && isMobileDevice()) {
        drawReceiptAndPrint(billNo, printDateStr, cashierName, cart, totalAmount, actualReceive, finalChange);
        setTimeout(() => { clearCart(); fetchActiveProducts(); }, 1000);
      } else {
        setPrintReceipt(receiptData)
        setTimeout(() => { 
          window.print(); 
          setTimeout(() => { 
            setPrintReceipt(null); 
            clearCart(); 
            fetchActiveProducts() 
          }, 1000) 
        }, 500)
      }
    }
  }

  const handleUnlockScreen = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!unlockPin) return
    setIsUnlocking(true)

    const { data: employeeData, error } = await supabase.from('employees').select('name').eq('pin', unlockPin).eq('isActive', true).single()

    if (error || !employeeData) {
      alert('❌ รหัสพนักงานไม่ถูกต้อง หรือไม่มีสิทธิ์เข้าใช้งาน'); setIsUnlocking(false); setUnlockPin(''); return
    }

    setCashierName(employeeData.name)
    const session = JSON.parse(localStorage.getItem('kingsawang_session') || '{}')
    localStorage.setItem('kingsawang_session', JSON.stringify({ ...session, name: employeeData.name }))
    
    setIsScreenLocked(false)
    setIsUnlocking(false)
    setUnlockPin('')
  }

  const submitManualOpenWithPin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pinInput) return
    setIsVerifyingPin(true)

    const { data: employeeData, error } = await supabase.from('employees').select('name, role').eq('pin', pinInput).eq('isActive', true).single()

    if (error || !employeeData) {
      alert('❌ รหัสพนักงานไม่ถูกต้อง'); setIsVerifyingPin(false); setPinInput(''); return
    }

    await supabase.from('drawer_logs').insert([{ id: `LOG-${Date.now()}`, employee_name: employeeData.name, role: employeeData.role, reason: 'เปิดด้วยมือ (ใส่รหัสผ่านกดหน้า POS)', print_status: 'ผู้ดูแลระบบ' }])
    setIsVerifyingPin(false); setIsPinModalOpen(false); setPinInput('')

    if (isMobileDevice() && printFormat === '58mm') {
      const canvas = document.createElement('canvas');
      canvas.width = 384; canvas.height = 80;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, 384, 80);
        ctx.fillStyle = '#000000'; ctx.font = '22px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(`เปิดลิ้นชักโดย: ${employeeData.name}`, 192, 40);
        sendToRawBT(getEscPosImageBytes(canvas));
      }
    } else {
      setPrintReceipt({ isManualKick: true })
      setTimeout(() => { window.print(); setTimeout(() => setPrintReceipt(null), 500) }, 200)
    }
  }

  const submitSackReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = Number(sackReturnQty);
    const rate = Number(sackRefundRate);
    if (qty <= 0 || rate <= 0) return alert('กรุณาระบุจำนวนใบ และราคาคืนมัดจำให้ถูกต้อง');

    const refundAmount = qty * rate;
    const billNo = `REF-${Date.now().toString().slice(-4)}`;

    const newSale = {
      id: billNo,
      totalAmount: -refundAmount,
      receiveAmount: 0,
      changeAmount: 0,
      payMethod: 'cash',
      items: [{ id: 'SACK-REFUND', name: `รับคืนกระสอบเปล่า`, qty: qty, price: -rate }],
      by: cashierName,
      createdAt: new Date().toISOString()
    };
    await supabase.from('sales').insert([newSale]);

    let sackProd = products.find(p => p.category === 'packaging' && p.name.includes('เวียน'));
    if (!sackProd) {
      sackProd = products.find(p => p.category === 'packaging' && p.name.includes('กระสอบ'));
    }

    if (sackProd) {
      await supabase.from('products').update({ stock: Number(sackProd.stock || 0) + qty }).eq('id', sackProd.id);
      
      await supabase.from('inventory_logs').insert([{
        id: `LOG-SACK-IN-${Date.now()}`,
        date: new Date().toISOString(),
        product_id: sackProd.id,
        product_name: sackProd.name,
        type: 'IN',
        qty: qty,
        note: `รับคืนกระสอบจากลูกค้า (จ่ายเงินมัดจำคืน ${refundAmount} บ.)`,
        by: cashierName
      }]);
    }

    await supabase.from('drawer_logs').insert([{
      id: `LOG-${Date.now()}`,
      employee_name: cashierName,
      role: 'แคชเชียร์',
      reason: `จ่ายเงินคืนค่ามัดจำกระสอบ ${qty} ใบ (-${refundAmount} บ.)`,
      print_status: 'ผู้ดูแลระบบ'
    }]);

    if (isMobileDevice() && printFormat === '58mm') {
      const canvas = document.createElement('canvas');
      canvas.width = 384; canvas.height = 80;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, 384, 80);
        ctx.fillStyle = '#000000'; ctx.font = '22px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(`จ่ายคืนมัดจำกระสอบ: -${refundAmount} บ.`, 192, 40);
        sendToRawBT(getEscPosImageBytes(canvas));
      }
    } else {
      setPrintReceipt({ isManualKick: true });
      setTimeout(() => { window.print(); setTimeout(() => setPrintReceipt(null), 500) }, 200);
    }

    alert(`✅ คืนเงินมัดจำ ${refundAmount} บาท และอัปเดตสต๊อกกระสอบเข้าคลังเรียบร้อย!`);
    setIsSackReturnModalOpen(false);
    setSackReturnQty('');
    fetchActiveProducts();
  }

  const openDrawerToCount = async () => {
    await supabase.from('drawer_logs').insert([{ id: `LOG-${Date.now()}`, employee_name: cashierName, role: 'แคชเชียร์', reason: 'เปิดลิ้นชักเพื่อนับเงิน (ก่อนปิดกะ)', print_status: 'ผู้ดูแลระบบ' }])
    
    if (isMobileDevice() && printFormat === '58mm') {
      const canvas = document.createElement('canvas');
      canvas.width = 384; canvas.height = 80;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, 384, 80);
        ctx.fillStyle = '#000000'; ctx.font = '22px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(`เปิดลิ้นชักนับเงิน: ${cashierName}`, 192, 40);
        sendToRawBT(getEscPosImageBytes(canvas));
      }
    } else {
      setPrintReceipt({ isManualKick: true })
      setTimeout(() => { window.print(); setTimeout(() => setPrintReceipt(null), 500) }, 200)
    }
  }

  const handleOpenCloseShift = async () => {
    setIsClosingShift(true)
    const now = new Date()
    const todayStr = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().split('T')[0]
    let startTime = `${todayStr}T00:00:00+07:00`
    const endTime = `${todayStr}T23:59:59+07:00`

    const { data: lastLog } = await supabase.from('drawer_logs').select('id').eq('reason', 'เปิดอัตโนมัติ (พิมพ์สลิปส่งยอดปิดกะ)').order('id', { ascending: false }).limit(1)

    if (lastLog && lastLog.length > 0) {
      const timestampStr = lastLog[0].id.replace('LOG-', '')
      const timestamp = Number(timestampStr)
      if (!isNaN(timestamp)) {
        const lastCloseTime = new Date(timestamp)
        const lastCloseDateStr = new Date(lastCloseTime.getTime() - (lastCloseTime.getTimezoneOffset() * 60000)).toISOString().split('T')[0]
        if (lastCloseDateStr === todayStr) {
          startTime = lastCloseTime.toISOString()
        }
      }
    }

    const { data } = await supabase.from('sales').select('totalAmount, payMethod').gt('createdAt', startTime).lte('createdAt', endTime)
    let cCash = 0, cTransfer = 0
    if (data) { data.forEach(sale => { if (sale.payMethod === 'cash') cCash += Number(sale.totalAmount); if (sale.payMethod === 'transfer') cTransfer += Number(sale.totalAmount); }) }
    setPosCashToday(cCash); setPosTransferToday(cTransfer)
  }

  const submitCloseShift = async () => {
    if (actualPosCash === '') return alert('ระบุยอดเงินที่นับได้จริงในลิ้นชัก')
    if (!confirm(`ยืนยันการปิดกะด้วยยอดเงินนับจริง: ${Number(actualPosCash).toLocaleString()} บาท ใช่หรือไม่?\n(ระบบจะพิมพ์สลิปและออกจากระบบทันที)`)) return
    
    const diff = Number(actualPosCash) - posCashToday
    await supabase.from('drawer_logs').insert([{ id: `LOG-${Date.now()}`, employee_name: cashierName, role: 'แคชเชียร์', reason: 'เปิดอัตโนมัติ (พิมพ์สลิปส่งยอดปิดกะ)', print_status: 'พิมพ์บิล' }])
    
    const slipId = `CLS-POS-${Date.now().toString().slice(-6)}`
    const printDateStr = new Date().toLocaleString('th-TH')
    setIsClosingShift(false)

    if (isMobileDevice() && printFormat === '58mm') {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if(ctx) {
        canvas.width = 384; canvas.height = 500;
        ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, 384, 500);
        ctx.fillStyle = '#000000'; ctx.textBaseline = 'top';

        let y = 10;
        ctx.font = 'bold 28px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('ใบนับเงินปิดกะ', 192, y); y += 40;
        ctx.font = '22px sans-serif'; ctx.fillText('คิงส์สว่าง (หน้าร้าน POS)', 192, y); y += 40;

        ctx.textAlign = 'left'; ctx.font = '20px sans-serif';
        ctx.fillText(`พิมพ์: ${printDateStr}`, 10, y); y += 30;
        ctx.fillText(`ผู้ปิดกะ: ${cashierName}`, 10, y); y += 30;
        ctx.fillText(`เลขที่กะ: ${slipId}`, 10, y); y += 30;
        
        ctx.beginPath(); ctx.setLineDash([5, 5]); ctx.moveTo(10, y); ctx.lineTo(374, y); ctx.stroke(); ctx.setLineDash([]); y += 15;

        ctx.fillText('ยอดสแกนโอน:', 10, y); ctx.textAlign = 'right'; ctx.fillText(`${posTransferToday.toLocaleString()} บ.`, 374, y); ctx.textAlign = 'left'; y += 30;
        ctx.fillText('ยอดเงินสดในระบบ:', 10, y); ctx.textAlign = 'right'; ctx.fillText(`${posCashToday.toLocaleString()} บ.`, 374, y); ctx.textAlign = 'left'; y += 30;

        ctx.beginPath(); ctx.setLineDash([5, 5]); ctx.moveTo(10, y); ctx.lineTo(374, y); ctx.stroke(); ctx.setLineDash([]); y += 15;

        ctx.font = 'bold 22px sans-serif';
        ctx.fillText('เงินสดที่นับได้จริง:', 10, y); ctx.textAlign = 'right'; ctx.fillText(`${Number(actualPosCash).toLocaleString()} บ.`, 374, y); ctx.textAlign = 'left'; y += 35;
        const diffStr = diff === 0 ? 'พอดี' : diff > 0 ? `+${diff.toLocaleString()}` : diff.toLocaleString();
        ctx.fillText('ส่วนต่างเก๊ะเงิน:', 10, y); ctx.textAlign = 'right'; ctx.fillText(`${diffStr} บ.`, 374, y); ctx.textAlign = 'left'; y += 50;

        ctx.font = '20px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('ลงชื่อแคชเชียร์ ......................', 192, y); y += 40;
        
        const finalCanvas = document.createElement('canvas');
        finalCanvas.width = 384; finalCanvas.height = y;
        finalCanvas.getContext('2d')?.drawImage(canvas, 0, 0);
        
        sendToRawBT(getEscPosImageBytes(finalCanvas));
      }

      setTimeout(() => {
        alert('✅ บันทึกยอดปิดกะเรียบร้อย ระบบจะทำการออกจากระบบ');
        localStorage.removeItem('kingsawang_session'); window.location.href = '/login';
      }, 1500);

    } else {
      setCloseShiftSlip({ id: slipId, date: printDateStr, cashAmount: posCashToday, transferAmount: posTransferToday, actualCash: Number(actualPosCash), diff, by: cashierName })
      setTimeout(() => { window.print(); setTimeout(() => { setCloseShiftSlip(null); localStorage.removeItem('kingsawang_session'); window.location.href = '/login' }, 1000) }, 1000)
    }
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `@media print { @page { size: ${closeShiftSlip || printFormat === '58mm' ? '58mm auto' : 'A4 portrait'}; margin: ${closeShiftSlip || printFormat === '58mm' ? '0' : '15mm'}; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: white; margin: 0; padding: 0;} }`}} />

      {/* 🌟 แก้ไข: ลบ md:flex-row ตรงนี้ออกเด็ดขาด และบังคับให้เป็น flex-col เสมอ */}
      <div className={`fixed inset-0 z-[99] flex flex-col bg-slate-50 overflow-hidden text-xs md:text-sm font-sans print:hidden ${(printReceipt || closeShiftSlip) ? 'hidden' : 'flex'}`}>
        
        {/* 🌟 Top Header: เปลี่ยนเป็นโครงสร้าง flex-wrap เต็มแถบแนวนอน */}
        <div className="bg-white p-3 md:px-6 md:py-4 border-b border-slate-200 shadow-sm flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 shrink-0 z-20">
          <TabletNav pathname={pathname} cashierName={cashierName} />
          
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button onClick={() => setIsSackReturnModalOpen(true)} className="shrink-0 bg-orange-50 text-orange-700 hover:bg-orange-100 px-4 py-2.5 rounded-xl font-bold border border-orange-200 shadow-sm active:scale-95 text-xs flex items-center gap-2">
              ♻️ <span className="hidden sm:inline">คืนกระสอบเปล่า</span>
            </button>
            
            <button onClick={() => setIsScreenLocked(true)} className="shrink-0 bg-purple-50 text-purple-700 hover:bg-purple-100 px-4 py-2.5 rounded-xl font-bold border border-purple-200 shadow-sm active:scale-95 text-xs flex items-center gap-2">
              🔒 <span className="hidden sm:inline">พักหน้าจอ</span>
            </button>

            <button onClick={() => { setPinInput(''); setIsPinModalOpen(true); }} className="shrink-0 bg-amber-50 text-amber-700 hover:bg-amber-100 px-4 py-2.5 rounded-xl font-bold border border-amber-200 shadow-sm active:scale-95 text-xs flex items-center gap-2">
              🔓 <span className="hidden sm:inline">เปิดลิ้นชัก (Manual)</span>
            </button>
            
            <div className="shrink-0 bg-slate-100 rounded-xl flex p-1 border border-slate-200 shadow-sm">
              <button onClick={() => setPrintFormat('58mm')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${printFormat === '58mm' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}>58mm</button>
              <button onClick={() => setPrintFormat('A4')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${printFormat === 'A4' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}>A4</button>
            </div>

            <button onClick={handleOpenCloseShift} className="shrink-0 bg-rose-50 hover:bg-rose-100 text-rose-700 px-4 py-2.5 rounded-xl font-bold border border-rose-200 transition-all flex items-center gap-2 shadow-sm active:scale-95 text-xs">
              🔐 ปิดกะส่งยอด
            </button>
          </div>
        </div>

        {/* === Content Area === */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
          
          {/* === ด้านซ้าย (สินค้า) === */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 scrollbar-hide bg-slate-50">
             {isLoading ? (<div className="text-center py-20 font-bold text-lg text-slate-400">⏳ กำลังโหลดสินค้า...</div>) : (
               <>
                 {mainProducts.length > 0 && (<div><h2 className="font-black text-slate-700 text-sm md:text-base mb-3">🧊 สินค้ากระสอบ และ แพ็ค</h2><div className="grid grid-cols-3 xl:grid-cols-4 gap-4">{mainProducts.map(product => (<button key={product.id} onClick={() => addToCart(product)} className="flex flex-col items-center p-4 rounded-[1.5rem] border-2 bg-white border-slate-200 transition-all active:scale-95 shadow-sm hover:shadow-md hover:bg-slate-50 relative group">{product.image ? (<div className="relative w-14 h-14 md:w-20 md:h-20 mb-2 rounded-2xl overflow-hidden shadow-sm group-hover:scale-105 transition-transform bg-white"><Image src={product.image} alt={product.name} fill className="object-cover" sizes="(min-width: 768px) 80px, 56px" /> </div>) : (<span className="text-4xl md:text-5xl mb-2 group-hover:scale-110 transition-transform">{product.icon}</span>)}<span className="font-bold text-sm text-center leading-tight mb-1">{product.name}</span><span className="font-black text-blue-600 text-lg">{product.price} <span className="text-[10px] font-bold">บ.</span></span></button>))}</div></div>)}
                 <div><h2 className="font-black text-orange-700 text-sm md:text-base mb-3 border-t border-slate-200 pt-5">🛍️ สินค้าแบ่งขายปลีก (ย่อย)</h2><div className="grid grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4"><button onClick={addCustomRetailItem} className="flex flex-col items-center justify-center p-4 rounded-[1.5rem] border-2 bg-orange-50 border-orange-300 text-orange-800 transition-all active:scale-95 shadow-sm hover:shadow-md border-dashed"><span className="text-4xl mb-2 transition-transform">⚖️</span><span className="font-bold text-sm text-center mb-1">น้ำแข็งตักขาย</span><span className="font-black text-orange-600 text-xs bg-orange-100 px-2 py-1 rounded">ระบุราคา ✏️</span></button>{retailProducts.map(product => (<button key={product.id} onClick={() => addToCart(product)} className="flex flex-col items-center p-4 rounded-[1.5rem] border-2 bg-white border-slate-200 transition-all active:scale-95 shadow-sm hover:shadow-md hover:bg-slate-50 relative group">{product.image ? (<div className="relative w-12 h-12 md:w-16 md:h-16 mb-2 rounded-2xl overflow-hidden shadow-sm group-hover:scale-105 transition-transform bg-white"><Image src={product.image} alt={product.name} fill className="object-cover" sizes="(min-width: 768px) 64px, 48px" /> </div>) : (<span className="text-4xl mb-2 transition-transform">{product.icon}</span>)}<span className="font-bold text-sm text-center mb-1">{product.name}</span><span className="font-black text-orange-600 text-base">{product.price} <span className="text-[10px] font-bold">บ.</span></span></button>))}</div></div>
               </>
             )}
          </div>

          {/* === ด้านขวา (ตะกร้า) === */}
          <div className="w-full md:w-[340px] lg:w-[380px] xl:w-[400px] bg-white border-l border-slate-200 shadow-2xl flex flex-col h-[75vh] md:h-full fixed md:relative bottom-0 z-30 rounded-t-[2rem] md:rounded-none shrink-0 transition-transform duration-300">
             <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/80"><h2 className="font-black text-slate-900 text-lg flex items-center gap-2">🧾 รายการขาย</h2>{cart.length > 0 && (<button onClick={clearCart} className="text-rose-500 font-bold text-sm bg-rose-50 hover:bg-rose-100 px-4 py-2 rounded-xl transition-colors">ล้างรายการ</button>)}</div>
             <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-3 bg-slate-50/50">
               {cart.length === 0 ? (
                 <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-3 opacity-50"><span className="text-5xl">🛒</span><p className="font-bold text-sm">แตะสินค้าด้านซ้ายเพื่อเพิ่มรายการ</p></div>
               ) : (
                 cart.map(item => (<div key={item.id} className="flex justify-between items-center border border-slate-200 p-3 rounded-2xl bg-white shadow-sm"><div className="flex-1 min-w-[80px]"><h3 className="font-bold text-slate-800 text-sm truncate">{item.name}</h3><button onClick={() => editPrice(item.id, item.price)} className="text-xs text-slate-500 font-bold mt-1 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded transition-colors">✏️ {item.price} บ.</button></div><div className="flex items-center gap-3"><div className="flex items-center bg-slate-100 rounded-xl p-1 border border-slate-200"><button onClick={() => updateQty(item.id, -1)} className="w-8 h-8 bg-white hover:bg-slate-50 rounded-lg font-black shadow-sm">-</button><span className="w-8 text-center font-black text-sm">{item.qty}</span><button onClick={() => updateQty(item.id, 1)} className="w-8 h-8 bg-white hover:bg-slate-50 rounded-lg font-black shadow-sm">+</button></div><div className="w-14 text-right"><span className="font-black text-blue-600 text-base">{(item.price * item.qty).toLocaleString()}</span></div><button onClick={() => removeFromCart(item.id)} className="text-slate-300 hover:text-rose-500 font-black text-lg px-2">✕</button></div></div>))
               )}
             </div>
             
             <div className="p-5 md:p-6 bg-white border-t border-slate-100 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
               <div className="flex justify-between items-end mb-4"><span className="font-bold text-slate-500 text-sm">ยอดรวมทั้งสิ้น</span><span className="font-black text-4xl text-slate-900 tracking-tight">{(cart.reduce((sum, item) => sum + (item.price * item.qty), 0) - discountAmount).toLocaleString()}<span className="text-base text-slate-500 ml-1 font-bold">บ.</span></span></div>
               {discountAmount > 0 && (
                 <div className="flex justify-between items-center mb-3 p-3 bg-orange-50 rounded-xl border border-orange-200">
                   <span className="font-bold text-orange-600 text-sm">ส่วนลด:</span>
                   <span className="font-black text-lg text-orange-700">{discountAmount.toLocaleString()} บ.</span>
                 </div>
               )}
               <button onClick={() => setIsDiscountModalOpen(true)} className="w-full font-black text-sm py-2 md:py-2.5 rounded-lg mb-3 bg-orange-100 hover:bg-orange-200 text-orange-700 border border-orange-300 transition-all active:scale-95">🏷️ แก้ไขส่วนลด</button>
               <button onClick={() => setIsCheckoutModalOpen(true)} disabled={cart.length === 0} className="w-full font-black text-lg py-4 md:py-5 rounded-[1.25rem] bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white shadow-xl shadow-emerald-500/20 active:scale-95 transition-all">💳 รับชำระเงิน (Pay)</button>
             </div>
          </div>
        </div>
      </div>

      {/* 🚀 Modal: หน้าจอล็อก (Quick Lock) */}
      {isScreenLocked && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm overflow-hidden flex flex-col p-8 text-center">
            <div className="w-20 h-20 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center text-4xl mx-auto mb-6 shadow-sm border border-purple-100">🔒</div>
            <h2 className="text-2xl font-black text-slate-800 mb-2">หน้าจอถูกล็อก</h2>
            <p className="text-sm font-bold text-slate-500 mb-8">กรุณากรอกรหัส PIN ของคุณ<br/>เพื่อเข้าใช้งานระบบ POS ต่อ</p>
            
            <form onSubmit={handleUnlockScreen} className="space-y-6">
              <input 
                type="password" 
                maxLength={6} 
                required 
                autoFocus 
                value={unlockPin} 
                onChange={(e) => setUnlockPin(e.target.value)} 
                className="w-full bg-slate-50 border-2 border-slate-200 px-4 py-4 rounded-xl focus:outline-none focus:border-purple-500 font-black text-3xl text-center text-slate-800 tracking-widest shadow-inner transition-colors" 
                placeholder="****" 
              />
              <button 
                type="submit" 
                disabled={isUnlocking || !unlockPin} 
                className="w-full text-white font-black py-4 rounded-xl shadow-lg transition-transform active:scale-95 bg-purple-600 hover:bg-purple-700 shadow-purple-500/30 disabled:bg-slate-300"
              >
                {isUnlocking ? '⏳ กำลังตรวจสอบ...' : 'ปลดล็อกหน้าจอ'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 🚀 Modal: แก้ไขส่วนลด */}
      {isDiscountModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm print:hidden">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-orange-50">
              <h3 className="font-black text-lg text-orange-700 flex items-center gap-2">🏷️ แก้ไขส่วนลด</h3>
              <button onClick={() => setIsDiscountModalOpen(false)} className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-rose-500 font-bold transition-colors">✕</button>
            </div>
            
            <div className="p-6 space-y-5">
              <div className="space-y-2 text-center">
                <label className="text-xs font-black tracking-wider text-slate-500 uppercase">ระบุจำนวนส่วนลด (บาท)</label>
                <div className="flex justify-center items-center gap-4">
                  <button type="button" onClick={() => setDiscountAmount(Math.max(0, discountAmount - 10))} className="w-14 h-14 rounded-2xl bg-slate-100 hover:bg-slate-200 font-black text-2xl text-slate-600 active:scale-95 transition-all shadow-inner">-</button>
                  <input type="number" min="0" max={subTotal} autoFocus value={discountAmount} onChange={e => setDiscountAmount(Math.max(0, Math.min(Number(e.target.value), subTotal)))} className="w-32 border-2 border-orange-200 px-2 py-3 rounded-2xl font-black text-4xl text-center focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 outline-none transition-all text-slate-800" placeholder="0" />
                  <button type="button" onClick={() => setDiscountAmount(Math.min(subTotal, discountAmount + 10))} className="w-14 h-14 rounded-2xl bg-slate-100 hover:bg-slate-200 font-black text-2xl text-slate-600 active:scale-95 transition-all shadow-inner">+</button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100">
                <button onClick={() => setDiscountAmount(0)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded-xl font-bold text-sm">ไม่มีส่วนลด</button>
                <button onClick={() => setDiscountAmount(10)} className="bg-orange-100 hover:bg-orange-200 text-orange-700 py-2 rounded-xl font-bold text-sm">10 บ.</button>
                <button onClick={() => setDiscountAmount(20)} className="bg-orange-100 hover:bg-orange-200 text-orange-700 py-2 rounded-xl font-bold text-sm">20 บ.</button>
                <button onClick={() => setDiscountAmount(50)} className="bg-orange-100 hover:bg-orange-200 text-orange-700 py-2 rounded-xl font-bold text-sm">50 บ.</button>
              </div>

              <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 flex justify-between items-center mt-2">
                <span className="font-bold text-orange-600 text-sm">ยอดหลังหักส่วนลด:</span>
                <span className="font-black text-2xl text-orange-700">{Math.max(0, subTotal - discountAmount).toLocaleString()} บ.</span>
              </div>

              <button onClick={() => setIsDiscountModalOpen(false)} className="w-full text-white font-black py-4 rounded-xl shadow-lg transition-transform active:scale-95 bg-orange-500 hover:bg-orange-600 shadow-orange-500/30 flex items-center justify-center gap-2">
                ✓ ยืนยันส่วนลด
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🚀 Modal: คืนมัดจำกระสอบ */}
      {isSackReturnModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm print:hidden">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-orange-50">
              <h3 className="font-black text-lg text-orange-700 flex items-center gap-2">♻️ รับคืนกระสอบเปล่า (คืนเงิน)</h3>
              <button onClick={() => { setIsSackReturnModalOpen(false); setSackReturnQty(''); }} className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-rose-500 font-bold transition-colors">✕</button>
            </div>
            
            <form onSubmit={submitSackReturn} className="p-6 space-y-5">
              <div className="space-y-2 text-center">
                <label className="text-xs font-black tracking-wider text-slate-500 uppercase">จำนวนกระสอบที่ลูกค้านำมาคืน (ใบ)</label>
                <div className="flex justify-center items-center gap-4">
                  <button type="button" onClick={() => setSackReturnQty(Math.max(1, Number(sackReturnQty || 1) - 1))} className="w-14 h-14 rounded-2xl bg-slate-100 hover:bg-slate-200 font-black text-2xl text-slate-600 active:scale-95 transition-all shadow-inner">-</button>
                  <input type="number" min="1" required autoFocus value={sackReturnQty} onChange={e => setSackReturnQty(Number(e.target.value))} className="w-28 border-2 border-slate-200 px-2 py-3 rounded-2xl font-black text-4xl text-center focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 outline-none transition-all text-slate-800" placeholder="0" />
                  <button type="button" onClick={() => setSackReturnQty(Number(sackReturnQty || 0) + 1)} className="w-14 h-14 rounded-2xl bg-slate-100 hover:bg-slate-200 font-black text-2xl text-slate-600 active:scale-95 transition-all shadow-inner">+</button>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100 text-center">
                <label className="text-xs font-black tracking-wider text-slate-500 uppercase">อัตราคืนมัดจำ (บาท/ใบ)</label>
                <input type="number" min="1" required value={sackRefundRate} onChange={e => setSackRefundRate(Number(e.target.value))} className="w-24 border-2 border-slate-200 px-2 py-2 rounded-xl font-bold text-lg text-center focus:border-blue-500 outline-none mx-auto text-slate-700" />
              </div>

              <div className="bg-rose-50 p-4 rounded-xl border border-rose-100 flex justify-between items-center mt-2">
                <span className="font-bold text-rose-600 text-sm">ยอดจ่ายเงินคืนรวม:</span>
                <span className="font-black text-3xl text-rose-700">{(Number(sackReturnQty || 0) * Number(sackRefundRate || 0)).toLocaleString()} บ.</span>
              </div>

              <button type="submit" disabled={Number(sackReturnQty) <= 0} className="w-full text-white font-black py-4 rounded-xl shadow-lg transition-transform active:scale-95 bg-orange-500 hover:bg-orange-600 shadow-orange-500/30 disabled:bg-slate-300 flex items-center justify-center gap-2">
                💵 ยืนยันเตะลิ้นชัก & จ่ายเงินคืน
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 🚀 Modal: กรอกรหัส PIN ก่อนเตะลิ้นชัก */}
      {isPinModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm print:hidden">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-xs overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-amber-50">
              <h3 className="font-black text-lg text-amber-700 flex items-center gap-2">🔓 ใส่รหัสเพื่อเปิดลิ้นชัก</h3>
              <button onClick={() => setIsPinModalOpen(false)} className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-rose-500 font-bold transition-colors">✕</button>
            </div>
            <form onSubmit={submitManualOpenWithPin} className="p-6 space-y-5 text-center">
              <p className="text-xs font-bold text-slate-500">กรุณากรอกรหัสประจำตัวพนักงาน<br/>เพื่อบันทึกประวัติการเปิดลิ้นชัก</p>
              <input type="password" maxLength={6} required autoFocus value={pinInput} onChange={(e) => setPinInput(e.target.value)} className="w-full bg-slate-50 border-2 border-amber-200 px-4 py-4 rounded-xl focus:outline-none focus:border-amber-500 font-black text-3xl text-center text-amber-800 tracking-widest shadow-inner" placeholder="****" />
              <button type="submit" disabled={isVerifyingPin || !pinInput} className="w-full text-white font-black py-4 rounded-xl shadow-lg transition-transform active:scale-95 bg-amber-500 hover:bg-amber-600 shadow-amber-500/30 disabled:bg-slate-300">
                {isVerifyingPin ? '⏳ กำลังตรวจสอบ...' : 'ยืนยันรหัส & เปิดลิ้นชัก'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 🚀 Modal: หน้าต่างรับชำระเงิน */}
      {isCheckoutModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 bg-slate-900/70 backdrop-blur-sm print:hidden overflow-y-auto">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm overflow-hidden flex flex-col my-auto animate-in zoom-in-95 duration-200 border border-slate-100">
            
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-black text-base text-slate-900">💵 รับชำระเงิน</h3>
              <button onClick={() => {setIsCheckoutModalOpen(false); setIsFreeBill(false); setCashReceived('')}} className="w-7 h-7 rounded-full bg-white border border-slate-200 text-slate-400 hover:bg-rose-50 hover:text-rose-500 font-bold transition-colors flex items-center justify-center">✕</button>
            </div>
            
            <div className="p-4 space-y-3">
              <label className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border-2 transition-all cursor-pointer ${isFreeBill ? 'bg-orange-50 border-orange-400 text-orange-700' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'}`}>
                <input type="checkbox" checked={isFreeBill} onChange={(e) => {setIsFreeBill(e.target.checked); setPaymentMethod('cash'); setCashReceived('');}} className="w-4 h-4 accent-orange-500 rounded" />
                <span className="font-bold text-xs">🎁 ให้ฟรี / เป็นของแถม (ไม่เตะลิ้นชัก)</span>
              </label>

              <label className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border-2 transition-all cursor-pointer ${isFieldDelivery ? 'bg-sky-50 border-sky-400 text-sky-700' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'}`}>
                <input type="checkbox" checked={isFieldDelivery} onChange={(e) => { setIsFieldDelivery(e.target.checked); if (!e.target.checked) { setSelectedFieldDeliveryEmployee(''); setFieldDeliveryBags(0) } else if (fieldDeliveryEmployees.length > 0) { setSelectedFieldDeliveryEmployee(fieldDeliveryEmployees[0].name) } }} className="w-4 h-4 accent-sky-500 rounded" />
                <span className="font-bold text-xs">🚚 ออกส่งหน้าลาน</span>
              </label>

              {isFieldDelivery && (
                <div className="space-y-3 rounded-2xl border border-sky-200 bg-sky-50 p-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-[0.15em] text-sky-700">เลือกพนักงาน</label>
                    <select value={selectedFieldDeliveryEmployee} onChange={(e) => setSelectedFieldDeliveryEmployee(e.target.value)} className="w-full border-2 border-sky-200 bg-white px-3 py-2 rounded-xl font-bold text-sky-800 focus:outline-none focus:border-sky-500" >
                      <option value="">-- เลือกพนักงาน --</option>
                      {fieldDeliveryEmployees.map(emp => (
                        <option key={emp.id} value={emp.name}>{emp.name} ({emp.role})</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-[0.15em] text-sky-700">ขายได้ (กระสอบ)</label>
                    <input type="number" min="0" value={fieldDeliveryBags} onChange={(e) => setFieldDeliveryBags(e.target.value === '' ? 0 : Number(e.target.value))} className="w-full border-2 border-sky-200 bg-white px-3 py-2 rounded-xl font-black text-sky-800 text-xl text-center focus:outline-none focus:border-sky-500" placeholder="0" />
                  </div>
                </div>
              )}

              <div className="flex justify-between items-end border-b border-slate-100 pb-2">
                <span className="font-bold text-slate-500 text-xs">ยอดที่ต้องชำระ:</span>
                <span className={`text-3xl font-black tracking-tight ${isFreeBill ? 'text-orange-500 line-through decoration-rose-500 decoration-4' : 'text-slate-900'}`}>{subTotal.toLocaleString()}<span className="text-sm font-bold ml-1">บ.</span></span>
              </div>

              {!isFreeBill && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-xl">
                    <button onClick={() => setPaymentMethod('cash')} className={`py-2 rounded-lg font-bold text-xs transition-all shadow-sm ${paymentMethod === 'cash' ? 'bg-white text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>💵 เงินสด</button>
                    <button onClick={() => {setPaymentMethod('transfer'); setCashReceived('');}} className={`py-2 rounded-lg font-bold text-xs transition-all shadow-sm ${paymentMethod === 'transfer' ? 'bg-white text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>📱 โอนเงิน (QR)</button>
                  </div>

                  {paymentMethod === 'cash' && (
                    <div className="space-y-2.5">
                      <input type="number" value={cashReceived} onChange={(e) => setCashReceived(e.target.value)} placeholder="รับเงินมา..." className="w-full bg-slate-50 border-2 border-slate-200 px-3 py-2.5 rounded-xl focus:outline-none focus:border-blue-500 font-black text-2xl text-center text-slate-800 shadow-inner" />
                      
                      <div className="grid grid-cols-4 gap-1.5">
                        <button onClick={exactCash} className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 py-2 rounded-lg font-black border border-emerald-200 text-xs transition-colors">พอดี</button>
                        {[100, 500, 1000].map(amt => (
                          <button key={amt} onClick={() => addQuickCash(amt)} className="bg-white border border-slate-200 hover:bg-slate-50 py-2 rounded-lg font-black text-slate-700 text-xs transition-colors">+{amt}</button>
                        ))}
                      </div>

                      <div className="flex justify-between items-center bg-rose-50 p-3 rounded-xl border border-rose-100">
                        <span className="font-bold text-rose-600 text-xs">เงินทอน:</span>
                        <span className="font-black text-2xl text-rose-600 tracking-tight">{change > 0 ? change.toLocaleString() : '0'}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <button onClick={handleCheckout} className={`w-full text-white font-black py-3.5 rounded-xl shadow-lg text-sm transition-transform active:scale-95 flex items-center justify-center gap-2 ${isFreeBill || paymentMethod === 'transfer' ? 'bg-orange-500 hover:bg-orange-600 shadow-orange-500/30' : 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/30'}`}>
                {isFreeBill || paymentMethod === 'transfer' ? '💾 บันทึกยอด (ไม่เตะลิ้นชัก)' : '🖨️ พิมพ์ใบเสร็จ & เปิดลิ้นชัก'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🚀 Modal: ปิดกะ POS (Blind Close) */}
      {isClosingShift && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm print:hidden">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-rose-100 bg-rose-50 flex justify-between items-center">
              <h3 className="font-black text-xl text-rose-700 flex items-center gap-2">🔐 ปิดกะส่งยอด (Blind Close)</h3>
              <button onClick={() => setIsClosingShift(false)} className="w-8 h-8 rounded-full bg-white text-slate-400 font-bold hover:text-rose-500 hover:bg-rose-100 transition-colors">✕</button>
            </div>
            
            <div className="p-6 space-y-6 text-center">
              <div className="bg-amber-50 p-5 rounded-2xl border border-amber-200">
                <span className="text-4xl block mb-2">💵</span>
                <p className="font-black text-amber-800 text-base mb-3">กรุณานับเงินสดในลิ้นชักทั้งหมด</p>
                
                <button onClick={openDrawerToCount} className="mx-auto bg-white border-2 border-amber-300 text-amber-700 hover:bg-amber-100 font-black py-2.5 px-6 rounded-xl shadow-sm transition-transform active:scale-95 text-sm flex items-center justify-center gap-2">
                  🔓 กดเพื่อเตะลิ้นชักออกมานับเงิน
                </button>
                
                <p className="text-[10px] font-bold text-amber-600 mt-4">ระบบจะทำการคำนวณส่วนต่าง (ขาด/เกิน) <br/>และแสดงผลลัพธ์ในสลิปปิดกะ</p>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-black text-slate-700 uppercase tracking-widest">ระบุยอดเงินที่นับได้จริง</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl text-slate-400 font-bold">฿</span>
                  <input 
                    type="number" 
                    min="0" 
                    autoFocus
                    value={actualPosCash} 
                    onChange={e => setActualPosCash(e.target.value)} 
                    className="w-full bg-slate-50 border-2 border-slate-300 pl-12 pr-4 py-5 rounded-2xl focus:outline-none focus:border-rose-500 font-black text-5xl text-center shadow-inner text-slate-800 transition-colors placeholder:text-slate-300" 
                    placeholder="0"
                  />
                </div>
              </div>
              
              <button onClick={submitCloseShift} disabled={actualPosCash === ''} className="w-full bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 text-white font-black py-4.5 rounded-xl shadow-xl shadow-rose-500/30 transition-transform active:scale-[0.98] text-lg mt-2 flex items-center justify-center gap-2">
                🖨️ ยืนยันยอดนับ & พิมพ์สลิป
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🖨️ โซนแสดงผลการพิมพ์ */}
      {closeShiftSlip ? (
         <div className="hidden print:block text-black font-mono leading-tight w-[52mm] mx-auto p-0 pt-2"><div className="text-center mb-3 border-b-2 border-black pb-2"><h1 className="text-lg font-black font-sans">ใบนับเงินปิดกะ</h1><p className="text-[10px] mt-1 font-sans">คิงส์สว่าง (หน้าร้าน POS)</p></div><div className="text-[10px] space-y-1 font-sans mb-3"><p>พิมพ์: {closeShiftSlip.date}</p><p>ผู้ปิดกะ: {closeShiftSlip.by}</p><p>เลขที่: {closeShiftSlip.id}</p></div><div className="text-[11px] font-sans border-t border-b border-black py-2 mb-3 space-y-1"><div className="flex justify-between"><span>ยอดสแกนโอน:</span><span>{closeShiftSlip.transferAmount.toLocaleString()}</span></div><div className="flex justify-between font-bold text-[12px] mt-1"><span className="text-black">ยอดเงินสดในระบบ:</span><span>{closeShiftSlip.cashAmount.toLocaleString()}</span></div></div><div className="text-[13px] font-sans font-black space-y-1"><div className="flex justify-between border-b border-dashed border-black pb-1"><span>เงินสดที่นับได้:</span><span className="underline">{closeShiftSlip.actualCash.toLocaleString()}</span></div><div className="flex justify-between mt-1 text-[11px]"><span>ส่วนต่าง:</span><span>{closeShiftSlip.diff === 0 ? 'พอดี' : closeShiftSlip.diff > 0 ? `+${closeShiftSlip.diff.toLocaleString()}` : closeShiftSlip.diff.toLocaleString()}</span></div></div><div className="mt-6 border-t border-black text-center text-[10px] font-sans pt-2"><p>ลงชื่อแคชเชียร์ ......................</p></div></div>
      ) : printReceipt && !('isManualKick' in printReceipt) && (
        <div className="hidden print:block text-black font-sans bg-white mx-auto" style={printFormat === '58mm' ? { width: '50mm', padding: '0 2mm', fontSize: '11px' } : { width: '100%', maxWidth: '800px', padding: '40px', fontSize: '14px' }}>
          {printFormat === 'A4' && (<><div className="flex justify-between items-start mb-8 border-b-4 border-black pb-6"><div><h1 className="text-3xl font-black mb-1">ใบเสร็จรับเงิน / Receipt</h1><p className="text-lg font-bold">คิงส์สว่าง โรงงานน้ำแข็งและน้ำดื่ม</p><p className="text-sm">อ.สว่างแดนดิน จ.สกลนคร</p></div><div className="text-right"><p className="font-bold text-lg">เลขที่: <span className="font-normal">{printReceipt.receiptNo}</span></p><p className="font-bold">วันที่: <span className="font-normal">{printReceipt.date}</span></p><p className="font-bold">พนักงานขาย: <span className="font-normal">{printReceipt.cashier}</span></p></div></div><table className="w-full border-collapse border-2 border-black text-base mb-8"><thead><tr className="bg-gray-100 border-b-2 border-black text-center"><th className="border-r border-black py-2 px-2 w-16">ลำดับ</th><th className="border-r border-black py-2 px-4 text-left">รายการสินค้า</th><th className="border-r border-black py-2 px-2 w-24">จำนวน</th><th className="border-r border-black py-2 px-2 w-32">ราคา/หน่วย</th><th className="py-2 px-4 w-40">จำนวนเงิน (บาท)</th></tr></thead><tbody>{printReceipt.items.map((item: ReceiptItem, idx: number) => (<tr key={idx} className="border-b border-gray-300"><td className="border-r border-black p-3 text-center">{idx + 1}</td><td className="border-r border-black p-3 font-bold">{item.name}</td><td className="border-r border-black p-3 text-center">{item.qty}</td><td className="border-r border-black p-3 text-right">{item.price.toLocaleString()}</td><td className="p-3 text-right font-black">{(item.qty * item.price).toLocaleString()}</td></tr>))}<tr className="border-t-2 border-black"><td colSpan={4} className="border-r border-black p-3 font-black text-right text-lg">ยอดรวมทั้งสิ้น</td><td className="p-3 text-right font-black text-2xl">{printReceipt.total.toLocaleString()}</td></tr></tbody></table><div className="w-80 ml-auto border-2 border-black p-4 rounded-xl space-y-2"><div className="flex justify-between font-bold"><span>ชำระเงินโดย:</span><span>{printReceipt.method}</span></div><div className="flex justify-between font-bold"><span>รับเงินมา:</span><span>{printReceipt.received.toLocaleString()} บาท</span></div><div className="flex justify-between font-black text-rose-600 border-t border-gray-300 pt-2 mt-2"><span>เงินทอน:</span><span>{printReceipt.change.toLocaleString()} บาท</span></div></div></>)}
        </div>
      )}

      {printReceipt && 'isManualKick' in printReceipt && (<div className="hidden print:block text-black text-[10px] text-center" style={{ width: '50mm' }}>.</div>)}
    </>
  )
}