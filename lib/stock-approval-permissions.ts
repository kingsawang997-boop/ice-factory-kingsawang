export const isStockApproverRole = (role: string) =>
  /ผู้บริหาร|ผู้จัดการ|เจ้าของ|ผู้พัฒนาโปรแกรม|ได้รับแต่งตั้ง|อนุมัติ|แอดมิน|ผู้ดูแลระบบ|บัญชี|manager|director|owner|admin|approver/i.test(role)