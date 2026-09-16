"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/backend/lib/supabase';
import AdminLayout from '@/components/AdminLayout';
import { useAlert } from '@/contexts/AlertContext';

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const { showAlert, showConfirm } = useAlert();
  const [formData, setFormData] = useState({
    dorm_name: '',
    address: '',
    phone: '',
    bank_name: '',
    bank_account_no: '',
    bank_account_name: '',
    cutoff_day: 27,
    vat_percentage: 7,
    invoice_logo_url: '',
    invoice_footer_text: '',
    invoice_signature_name: '',
    show_tax_column: true,
    meter_reading_day: 20,
    water_rate: 0,
    electric_rate: 0,
    due_day: 5,
    max_booking_days: 7,
    unavailable_dates: [] as string[]
  });

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
      fetchSettings();
    };
    init();
  }, [router]);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('dorm_settings')
        .select('*')
        .limit(1)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      
      if (data) {
        setFormData({
          dorm_name: data.dorm_name || '',
          address: data.address || '',
          phone: data.phone || '',
          bank_name: data.bank_name || '',
          bank_account_no: data.bank_account_no || '',
          bank_account_name: data.bank_account_name || '',
          cutoff_day: data.cutoff_day || 27,
          vat_percentage: data.vat_percentage !== undefined ? data.vat_percentage : 7,
          invoice_logo_url: data.invoice_logo_url || '',
          invoice_footer_text: data.invoice_footer_text || '',
          invoice_signature_name: data.invoice_signature_name || '',
          show_tax_column: data.show_tax_column !== undefined ? data.show_tax_column : true,
          meter_reading_day: data.meter_reading_day || 20,
          water_rate: data.water_rate || 0,
          electric_rate: data.electric_rate || 0,
          due_day: data.due_day || 5,
          max_booking_days: data.max_booking_days ?? 7,
          unavailable_dates: data.unavailable_dates || []
        });
        if (data.updated_at) {
          const d = new Date(data.updated_at);
          setLastUpdated(`${d.toLocaleDateString('th-TH')} ${d.toLocaleTimeString('th-TH')}`);
        }
      }
    } catch (err: any) {
      console.error("Error fetching settings:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddDate = () => {
    const input = document.getElementById('new_unavailable_date') as HTMLInputElement;
    if (input && input.value) {
      if (!formData.unavailable_dates.includes(input.value)) {
        setFormData({
          ...formData,
          unavailable_dates: [...formData.unavailable_dates, input.value].sort()
        });
      }
      input.value = '';
    }
  };

  const handleRemoveDate = (dateToRemove: string) => {
    setFormData({
      ...formData,
      unavailable_dates: formData.unavailable_dates.filter(d => d !== dateToRemove)
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    showConfirm('ยืนยันการบันทึกข้อมูล', 'คุณต้องการบันทึกการเปลี่ยนแปลงการตั้งค่าระบบใช่หรือไม่?', confirmSave);
  };

  const confirmSave = async () => {
    try {
      setIsSubmitting(true);
      
      const { data: existingData } = await supabase.from('dorm_settings').select('id').limit(1).single();
      
      const updatePayload = {
        ...formData,
        updated_at: new Date().toISOString()
      };

      if (existingData) {
        const { error } = await supabase.from('dorm_settings').update(updatePayload).eq('id', existingData.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('dorm_settings').insert([updatePayload]);
        if (error) throw error;
      }

      showAlert('success', 'บันทึกสำเร็จ', 'ข้อมูลการตั้งค่าระบบถูกบันทึกเรียบร้อยแล้ว');

      fetchSettings();
    } catch (err: any) {
      alert("เกิดข้อผิดพลาดในการบันทึกข้อมูล: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-2xl font-black text-slate-800">ตั้งค่าระบบ</h1>
            <p className="text-slate-500 mt-1">จัดการข้อมูลหอพักและบัญชีรับเงินสำหรับแสดงในใบแจ้งหนี้</p>
          </div>
          {lastUpdated && (
            <p className="text-sm font-medium text-slate-400 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200/50">
              แก้ไขข้อมูลล่าสุดเมื่อ: {lastUpdated}
            </p>
          )}
        </div>

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center">
            <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
            <p className="text-slate-500 font-medium">กำลังโหลดข้อมูลการตั้งค่า...</p>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-8 pb-10">
            
            {/* 1. ข้อมูลหอพัก */}
            <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200/60 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 w-2 h-full bg-blue-500"></div>
              <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                <span className="text-xl">🏢</span> ข้อมูลหอพัก
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-slate-700 mb-2">ชื่อหอพัก</label>
                  <input
                    type="text"
                    required
                    value={formData.dorm_name}
                    onChange={(e) => setFormData({...formData, dorm_name: e.target.value})}
                    placeholder="เช่น สมาร์ท ดอร์ม (Smart Dorm)"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all bg-slate-50 focus:bg-white text-sm"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-slate-700 mb-2">ที่อยู่</label>
                  <textarea
                    required
                    rows={3}
                    value={formData.address}
                    onChange={(e) => setFormData({...formData, address: e.target.value})}
                    placeholder="ที่อยู่สำหรับแสดงบนใบเสร็จ..."
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all bg-slate-50 focus:bg-white text-sm resize-none"
                  ></textarea>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-slate-700 mb-2">เบอร์โทรศัพท์ติดต่อ</label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    required
                    value={formData.phone}
                    onChange={(e) => {
                      const numericValue = e.target.value.replace(/\D/g, '');
                      setFormData({...formData, phone: numericValue});
                    }}
                    placeholder="081xxxxxxx"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all bg-slate-50 focus:bg-white text-sm"
                  />
                </div>
              </div>
            </div>

            {/* 2. ข้อมูลการรับเงิน */}
            <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200/60 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 w-2 h-full bg-emerald-500"></div>
              <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                <span className="text-xl">💰</span> ข้อมูลการรับเงิน (บัญชีธนาคาร)
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">ชื่อธนาคาร</label>
                  <input
                    type="text"
                    required
                    value={formData.bank_name}
                    onChange={(e) => setFormData({...formData, bank_name: e.target.value})}
                    placeholder="เช่น กสิกรไทย, ไทยพาณิชย์"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all bg-slate-50 focus:bg-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">เลขที่บัญชี</label>
                  <input
                    type="text"
                    required
                    value={formData.bank_account_no}
                    onChange={(e) => setFormData({...formData, bank_account_no: e.target.value})}
                    placeholder="xxx-x-xxxxx-x"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all bg-slate-50 focus:bg-white text-sm"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-slate-700 mb-2">ชื่อบัญชี</label>
                  <input
                    type="text"
                    required
                    value={formData.bank_account_name}
                    onChange={(e) => setFormData({...formData, bank_account_name: e.target.value})}
                    placeholder="ชื่อนามสกุล หรือชื่อนิติบุคคล"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all bg-slate-50 focus:bg-white text-sm"
                  />
                </div>
              </div>
            </div>

            {/* 3. ตั้งค่ารอบบิล */}
            <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200/60 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 w-2 h-full bg-amber-500"></div>
              <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                <span className="text-xl">📅</span> ตั้งค่ารอบบิล
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">วันที่ตัดรอบบิลประจำเดือน</label>
                  <div className="relative">
                    <input
                      type="number"
                      required
                      min="1"
                      max="31"
                      value={formData.cutoff_day}
                      onChange={(e) => setFormData({...formData, cutoff_day: Number(e.target.value)})}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 outline-none transition-all bg-slate-50 focus:bg-white text-sm"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium text-sm">ของเดือน</span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">ใช้อ้างอิงในการเริ่มรอบบิลใหม่ในระบบ</p>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">วันที่จดมิเตอร์น้ำและไฟ</label>
                  <div className="relative">
                    <input
                      type="number"
                      required
                      min="1"
                      max="31"
                      value={formData.meter_reading_day}
                      onChange={(e) => setFormData({...formData, meter_reading_day: Number(e.target.value)})}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 outline-none transition-all bg-slate-50 focus:bg-white text-sm"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium text-sm">ของเดือน</span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">สำหรับคำนวณช่วงวันที่ของรอบมิเตอร์ในใบแจ้งหนี้</p>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">เปอร์เซ็นต์ภาษี (VAT %)</label>
                  <div className="relative">
                    <input
                      type="number"
                      required
                      min="0"
                      max="100"
                      step="0.01"
                      value={formData.vat_percentage}
                      onChange={(e) => setFormData({...formData, vat_percentage: Number(e.target.value)})}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 outline-none transition-all bg-slate-50 focus:bg-white text-sm"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium text-sm">%</span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">สำหรับคำนวณภาษีในหน้าสร้างบิลค่าเช่า</p>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">เรทค่าน้ำ (บาท/หน่วย)</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={formData.water_rate}
                    onChange={(e) => setFormData({...formData, water_rate: Number(e.target.value)})}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 outline-none transition-all bg-slate-50 focus:bg-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">เรทค่าไฟ (บาท/หน่วย)</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={formData.electric_rate}
                    onChange={(e) => setFormData({...formData, electric_rate: Number(e.target.value)})}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 outline-none transition-all bg-slate-50 focus:bg-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">กำหนดชำระเงิน (วันที่ของเดือนถัดไป)</label>
                  <div className="relative">
                    <input
                      type="number"
                      required
                      min="1"
                      max="31"
                      value={formData.due_day}
                      onChange={(e) => setFormData({...formData, due_day: Number(e.target.value)})}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 outline-none transition-all bg-slate-50 focus:bg-white text-sm"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium text-sm">ของเดือน</span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">ใช้คำนวณวันครบกำหนดชำระเงินในรอบบิลใหม่อัตโนมัติ</p>
                </div>
              </div>
            </div>

            {/* 4. รูปแบบใบแจ้งหนี้ */}
            <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200/60 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 w-2 h-full bg-purple-500"></div>
              <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                <span className="text-xl">📄</span> รูปแบบใบแจ้งหนี้ (Invoice Template)
              </h2>
              <div className="grid grid-cols-1 gap-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">URL โลโก้หอพัก</label>
                  <input
                    type="text"
                    value={formData.invoice_logo_url}
                    onChange={(e) => setFormData({...formData, invoice_logo_url: e.target.value})}
                    placeholder="https://example.com/logo.png"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 outline-none transition-all bg-slate-50 focus:bg-white text-sm"
                  />
                  <p className="mt-2 text-xs text-slate-500">ใส่ลิงก์รูปภาพโลโก้ (ปล่อยว่างไว้ถ้าไม่ต้องการแสดงโลโก้)</p>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">ข้อความท้ายบิล (หมายเหตุ)</label>
                  <textarea
                    rows={3}
                    value={formData.invoice_footer_text}
                    onChange={(e) => setFormData({...formData, invoice_footer_text: e.target.value})}
                    placeholder="เช่น โปรดชำระเงินภายในวันที่กำหนด หากพ้นกำหนดจะมีค่าปรับ 100 บาท/วัน"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 outline-none transition-all bg-slate-50 focus:bg-white text-sm resize-none"
                  ></textarea>
                </div>
                <div className="md:w-1/2">
                  <label className="block text-sm font-bold text-slate-700 mb-2">ชื่อผู้รับเงิน / ผู้จัดการ</label>
                  <input
                    type="text"
                    value={formData.invoice_signature_name}
                    onChange={(e) => setFormData({...formData, invoice_signature_name: e.target.value})}
                    placeholder="เช่น สมหมาย ใจดี"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 outline-none transition-all bg-slate-50 focus:bg-white text-sm"
                  />
                </div>
                <div className="flex items-center gap-3 mt-2">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={formData.show_tax_column}
                      onChange={(e) => setFormData({...formData, show_tax_column: e.target.checked})}
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                  </label>
                  <span className="text-sm font-bold text-slate-700">แสดงคอลัมน์ภาษี (VAT) ในตารางพิมพ์บิล</span>
                </div>
              </div>
            </div>

            {/* 5. ตั้งค่าการจองห้องพัก */}
            <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200/60 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 w-2 h-full bg-rose-500"></div>
              <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                <span className="text-xl">📆</span> ตั้งค่าการจองห้องพัก (Room Booking)
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">จองล่วงหน้าได้สูงสุด (วัน)</label>
                  <div className="relative">
                    <input
                      type="number"
                      required
                      min="1"
                      value={formData.max_booking_days}
                      onChange={(e) => setFormData({...formData, max_booking_days: parseInt(e.target.value) || 0})}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 outline-none transition-all bg-slate-50 focus:bg-white text-sm"
                    />
                  </div>
                  <p className="mt-2 text-xs text-slate-500">จำนวนวันที่อนุญาตให้ลูกค้าเลือกล่วงหน้าจากวันปัจจุบัน</p>
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">วันหยุด / วันที่ไม่เปิดรับนัดหมาย</label>
                  <div className="flex gap-2 mb-3">
                    <input
                      type="date"
                      id="new_unavailable_date"
                      className="flex-1 px-4 py-3 rounded-xl border border-slate-200 focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 outline-none transition-all bg-slate-50 focus:bg-white text-sm"
                    />
                    <button
                      type="button"
                      onClick={handleAddDate}
                      className="px-4 py-2 bg-rose-100 hover:bg-rose-200 text-rose-700 font-bold rounded-xl transition-colors shrink-0"
                    >
                      เพิ่มวันหยุด
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {formData.unavailable_dates.length === 0 ? (
                      <span className="text-sm text-slate-400">ยังไม่มีการตั้งค่าวันหยุด</span>
                    ) : (
                      formData.unavailable_dates.map(date => (
                        <div key={date} className="bg-slate-100 border border-slate-200 rounded-lg px-3 py-1.5 flex items-center gap-2 text-sm text-slate-700 font-medium">
                          {new Date(date).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })}
                          <button
                            type="button"
                            onClick={() => handleRemoveDate(date)}
                            className="text-slate-400 hover:text-red-500 transition-colors"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    กำลังบันทึก...
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                    บันทึกข้อมูล
                  </>
                )}
              </button>
            </div>

          </form>
        )}
      </div>
    </AdminLayout>
  );
}
