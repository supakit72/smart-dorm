import React, { useState, useEffect } from 'react';
import { supabase } from '@/backend/lib/supabase';

interface TenantData {
  user_id?: number;
  user_uid?: string;
  uid?: string;
  first_name?: string;
  last_name?: string;
  phone_number?: string;
  email?: string;
  id_card_number?: string;
  id_card_issue_date?: string;
  id_card_expiry_date?: string;
  address?: string;
}

interface RoomData {
  room_id: number;
  room_number: string;
  price_per_month: number;
}

interface ContractModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  room: RoomData | null;
  tenant?: TenantData | null; // Optional: if null, show dropdown
  bookingId?: number | null; // Optional: if provided, update booking to moved_in
  bookingDepositAmount?: number; // Optional: amount to deduct
}

export default function ContractModal({
  isOpen,
  onClose,
  onSuccess,
  room,
  tenant,
  bookingId,
  bookingDepositAmount = 0
}: ContractModalProps) {
  // State
  const [tenants, setTenants] = useState<any[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>(''); // For dropdown mode
  
  const [idCardNumber, setIdCardNumber] = useState('');
  const [idCardIssueDate, setIdCardIssueDate] = useState('');
  const [idCardExpiryDate, setIdCardExpiryDate] = useState('');
  const [address, setAddress] = useState('');
  
  const [contractStartDate, setContractStartDate] = useState('');
  const [contractEndDate, setContractEndDate] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize dates & pre-fill
  useEffect(() => {
    if (isOpen) {
      const today = new Date();
      setContractStartDate(today.toISOString().split('T')[0]);
      
      const nextYear = new Date(today);
      nextYear.setFullYear(today.getFullYear() + 1);
      setContractEndDate(nextYear.toISOString().split('T')[0]);

      if (tenant) {
        setIdCardNumber(tenant.id_card_number || '');
        setIdCardIssueDate(tenant.id_card_issue_date ? tenant.id_card_issue_date.split('T')[0] : '');
        setIdCardExpiryDate(tenant.id_card_expiry_date ? tenant.id_card_expiry_date.split('T')[0] : '');
        setAddress(tenant.address || '');
      } else {
        // Fetch tenants for dropdown
        fetchTenants();
      }
      
      setError(null);
    }
  }, [isOpen, tenant]);

  const fetchTenants = async () => {
    try {
      // 1. ดึงผู้เช่าทั้งหมด
      const { data: allTenants, error: tenantError } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'tenant');
      if (tenantError) throw tenantError;

      // 2. ดึงสัญญาที่ยัง Active
      const { data: activeContracts, error: contractError } = await supabase
        .from('contracts')
        .select('tenant_id, tenant_uid')
        .eq('is_active', true);
      if (contractError) throw contractError;

      // 3. กรองรายชื่อผู้เช่าที่ไม่มีสัญญา Active
      const activeNumericIds = activeContracts?.map(c => c.tenant_id) || [];
      const activeUuids = activeContracts?.map(c => c.tenant_uid) || [];

      const availableTenants = (allTenants || []).filter(t => 
        !activeNumericIds.includes(t.user_id) && 
        !activeUuids.includes(t.user_uid)
      );

      setTenants(availableTenants);
    } catch (err: any) {
      console.error("Error fetching tenants:", err);
    }
  };

  // When dropdown changes, pre-fill if data exists
  const handleTenantSelect = (uidOrId: string) => {
    setSelectedTenantId(uidOrId);
    const selected = tenants.find(t => t.user_uid === uidOrId || String(t.user_id) === uidOrId);
    if (selected) {
      setIdCardNumber(selected.id_card_number || '');
      setIdCardIssueDate(selected.id_card_issue_date ? selected.id_card_issue_date.split('T')[0] : '');
      setIdCardExpiryDate(selected.id_card_expiry_date ? selected.id_card_expiry_date.split('T')[0] : '');
      setAddress(selected.address || '');
    }
  };

  const getEffectiveTenant = () => {
    if (tenant) return tenant;
    if (selectedTenantId) {
      return tenants.find(t => t.user_uid === selectedTenantId || String(t.user_id) === selectedTenantId);
    }
    return null;
  };

  const calculateTotals = () => {
    const rent = room?.price_per_month || 0;
    const deposit = room?.price_per_month || 0;
    const total = rent + deposit - bookingDepositAmount;
    return { rent, deposit, total };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!room) return;
    
    const effectiveTenant = getEffectiveTenant();
    if (!effectiveTenant) {
      setError("กรุณาเลือกผู้เช่า");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      // 1. Update User info
      const numericId = effectiveTenant.user_id || effectiveTenant.id;
      const uuid = effectiveTenant.user_uid || effectiveTenant.uid;
      
      if (!numericId) {
        throw new Error("ไม่พบ Numeric ID ของผู้เช่า (user_id)");
      }

      const { error: userError } = await supabase
        .from('users')
        .update({ 
          id_card_number: idCardNumber,
          id_card_issue_date: idCardIssueDate,
          id_card_expiry_date: idCardExpiryDate,
          address: address
        })
        .eq('user_id', numericId);
      
      if (userError) throw userError;

      // 2. Insert Contract
      const { data: contractData, error: contractError } = await supabase
        .from('contracts')
        .insert([{
          start_date: contractStartDate,
          end_date: contractEndDate,
          is_active: true,
          tenant_id: numericId,
          tenant_uid: uuid,
          room_id: room.room_id
        }])
        .select()
        .single();
      
      if (contractError) throw contractError;

      // 3. Auto Generate Move-in Invoice
      const totals = calculateTotals();
      
      // 3.1 Prepare Additional Items JSON
      const additionalItems = [
        { name: 'ค่าเช่าล่วงหน้า 1 เดือน', price: totals.rent },
        { name: 'เงินประกันความเสียหาย', price: totals.deposit }
      ];
      
      if (bookingDepositAmount > 0) {
        additionalItems.push({ 
          name: 'หักเงินมัดจำจอง', 
          price: -bookingDepositAmount 
        });
      }

      // 3.2 Insert into `invoices` with JSONB column
      const { data: invoiceData, error: invoiceError } = await supabase
        .from('invoices')
        .insert([{
          contract_id: contractData.contracts_id,
          month_year: new Date().toISOString().split('T')[0],
          total_amount: totals.total,
          status: 'unpaid',
          additional_items: additionalItems
        }])
        .select()
        .single();
        
      if (invoiceError) {
        console.error("Warning: Could not create invoice:", invoiceError);
        alert(`เกิดข้อผิดพลาดในการสร้างบิล: ${invoiceError.message || JSON.stringify(invoiceError)}`);
        throw invoiceError;
      }

      // 4. Update Room Status
      const { error: roomError } = await supabase
        .from('rooms')
        .update({ status: 'occupied' })
        .eq('room_id', room.room_id);
      
      if (roomError) throw roomError;

      // 5. Update Booking Status (if provided)
      if (bookingId) {
        const { error: bookingError } = await supabase
          .from('room_bookings')
          .update({ status: 'moved_in' })
          .eq('id', bookingId);
          
        if (bookingError) throw bookingError;
      }

      // Success
      alert("ทำสัญญาและสร้างบิลวันเข้าอยู่สำเร็จ!");
      onSuccess();
      onClose();

    } catch (err: any) {
      console.error(err);
      setError("เกิดข้อผิดพลาด: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !room) return null;

  const totals = calculateTotals();

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={onClose}></div>
      
      <div className="relative bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center px-6 py-5 border-b border-slate-100 bg-slate-50/80">
          <h3 className="text-xl font-black text-slate-800 flex items-center gap-3 tracking-tight">
            <span className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-lg">
              📝
            </span>
            ทำสัญญาเช่าห้องพัก (ห้อง {room.room_number})
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-200/50 hover:bg-slate-200 text-slate-500 hover:text-slate-700 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-8 flex-1 custom-scrollbar">
          
          {error && (
            <div className="p-4 bg-red-50 text-red-600 border border-red-100 rounded-xl text-sm font-semibold">
              {error}
            </div>
          )}

          {/* Section: Tenant Info */}
          <div>
            <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">ข้อมูลผู้เช่า</h4>
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
              
              {!tenant ? (
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">เลือกผู้เช่าจากระบบ</label>
                  <select
                    required
                    value={selectedTenantId}
                    onChange={(e) => handleTenantSelect(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                  >
                    <option value="" disabled>-- เลือกผู้เช่า --</option>
                    {tenants.map(t => (
                      <option key={t.user_uid || t.user_id} value={t.user_uid || t.user_id}>
                        {t.first_name} {t.last_name} ({t.phone_number})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">ชื่อ-นามสกุล</label>
                    <div className="px-4 py-3 bg-slate-200/50 rounded-xl text-slate-700 font-medium">
                      {tenant.first_name} {tenant.last_name}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">เบอร์โทรศัพท์</label>
                    <div className="px-4 py-3 bg-slate-200/50 rounded-xl text-slate-700 font-medium">
                      {tenant.phone_number || '-'}
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">เลขบัตรประจำตัวประชาชน</label>
                  <input
                    type="text"
                    required
                    maxLength={13}
                    value={idCardNumber}
                    onChange={(e) => setIdCardNumber(e.target.value)}
                    placeholder="เลขบัตร 13 หลัก"
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">วันที่ออกบัตร</label>
                  <input
                    type="date"
                    required
                    value={idCardIssueDate}
                    onChange={(e) => setIdCardIssueDate(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">วันหมดอายุ</label>
                  <input
                    type="date"
                    required
                    value={idCardExpiryDate}
                    onChange={(e) => setIdCardExpiryDate(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">ที่อยู่ตามทะเบียนบ้าน</label>
                  <textarea
                    required
                    rows={2}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="บ้านเลขที่ หมู่ ซอย ถนน ตำบล อำเภอ จังหวัด รหัสไปรษณีย์"
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all resize-none"
                  ></textarea>
                </div>
              </div>
            </div>
          </div>

          {/* Section: Contract Info */}
          <div>
            <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">ข้อมูลสัญญา</h4>
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">วันที่เริ่มสัญญา</label>
                  <input
                    type="date"
                    required
                    value={contractStartDate}
                    onChange={(e) => setContractStartDate(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">วันที่สิ้นสุดสัญญา</label>
                  <input
                    type="date"
                    required
                    value={contractEndDate}
                    onChange={(e) => setContractEndDate(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section: Financial Summary */}
          <div>
            <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">สรุปยอดชำระวันเข้าอยู่ (Invoice)</h4>
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 space-y-3">
              <div className="flex justify-between items-center text-slate-600 text-sm">
                <span>ค่าเช่าล่วงหน้า 1 เดือน (ห้อง {room.room_number})</span>
                <span className="font-semibold text-slate-800">{totals.rent.toLocaleString()} ฿</span>
              </div>
              <div className="flex justify-between items-center text-slate-600 text-sm">
                <span>เงินประกันความเสียหาย</span>
                <span className="font-semibold text-slate-800">{totals.deposit.toLocaleString()} ฿</span>
              </div>
              
              {bookingDepositAmount > 0 && (
                <div className="flex justify-between items-center text-emerald-600 text-sm font-medium">
                  <span>หักเงินมัดจำจอง</span>
                  <span>- {bookingDepositAmount.toLocaleString()} ฿</span>
                </div>
              )}
              
              <div className="pt-3 mt-3 border-t border-blue-200/50 flex justify-between items-center">
                <span className="font-bold text-slate-800">ยอดรวมสุทธิที่ต้องชำระ</span>
                <span className="text-xl font-black text-blue-600">{totals.total.toLocaleString()} ฿</span>
              </div>
            </div>
          </div>

        </form>

        <div className="p-6 border-t border-slate-100 bg-white flex gap-4 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-colors"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex-1 px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition-colors shadow-md disabled:bg-blue-400 disabled:shadow-none flex justify-center items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                กำลังบันทึก...
              </>
            ) : (
              'ยืนยันทำสัญญา & ออกบิล'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
