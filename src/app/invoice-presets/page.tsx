"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/backend/lib/supabase';
import AdminLayout from '@/components/AdminLayout';
import { useAlert } from '@/contexts/AlertContext';

export default function InvoicePresetsPage() {
  const router = useRouter();
  const { showAlert, showConfirm } = useAlert();

  const [presets, setPresets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [selectedPreset, setSelectedPreset] = useState<any>(null);
  
  // Form State
  const [formData, setFormData] = useState({
    name: '',
    price: 0
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
      const { data: userData } = await supabase
        .from('users')
        .select('role')
        .eq('user_uid', session.user.id)
        .single();

      if (!userData || userData.role !== 'admin') {
        router.push('/login');
        return;
      }
      fetchPresets();
    };
    checkAuth();
  }, [router]);

  const fetchPresets = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('invoice_item_presets')
        .select('*')
        .order('id', { ascending: true });
        
      if (error) throw error;
      setPresets(data || []);
    } catch (err: any) {
      console.error("Fetch Presets Error:", err);
      showAlert('confirm', 'เกิดข้อผิดพลาด', err.message);
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setModalMode('add');
    setSelectedPreset(null);
    setFormData({ name: '', price: 0 });
    setIsModalOpen(true);
  };

  const openEditModal = (preset: any) => {
    setModalMode('edit');
    setSelectedPreset(preset);
    setFormData({ name: preset.name, price: preset.price || 0 });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (!isSubmitting) setIsModalOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      if (modalMode === 'add') {
        const { error } = await supabase.from('invoice_item_presets').insert([
          { name: formData.name, price: formData.price }
        ]);
        if (error) throw error;
        showAlert('success', 'เพิ่มรายการสำเร็จ', 'เพิ่มรายการเพิ่มเติมตั้งต้นเรียบร้อยแล้ว');
      } else {
        const { error } = await supabase.from('invoice_item_presets')
          .update({ name: formData.name, price: formData.price })
          .eq('id', selectedPreset.id);
        if (error) throw error;
        showAlert('success', 'แก้ไขรายการสำเร็จ', 'อัปเดตข้อมูลรายการเพิ่มเติมเรียบร้อยแล้ว');
      }
      closeModal();
      fetchPresets();
    } catch (err: any) {
      alert('เกิดข้อผิดพลาด: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDelete = async (id: number) => {
    try {
      const { error } = await supabase.from('invoice_item_presets').delete().eq('id', id);
      if (error) throw error;
      
      showAlert('success', 'ลบรายการสำเร็จ', 'ลบข้อมูลรายการออกจากระบบแล้ว');
      fetchPresets();
    } catch (err: any) {
      alert('ลบข้อมูลไม่สำเร็จ: ' + err.message);
    }
  };

  const handleDelete = (id: number) => {
    showConfirm(
      'ยืนยันการลบรายการ',
      'คุณแน่ใจหรือไม่ว่าต้องการลบรายการนี้? การกระทำนี้ไม่สามารถย้อนกลับได้',
      () => confirmDelete(id)
    );
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
              <span className="text-2xl">📋</span> จัดการรายการเพิ่มเติมตั้งต้น
            </h2>
            <p className="text-sm text-slate-500 mt-1">เพิ่ม แก้ไข และลบรายการบิลที่จะนำไปใช้ตอนสร้างบิลค่าเช่า (Presets)</p>
          </div>
          <button
            onClick={openAddModal}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            เพิ่มรายการตั้งต้น
          </button>
        </div>

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center">
            <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
            <p className="text-slate-500 font-medium">กำลังโหลดข้อมูลรายการ...</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 text-xs uppercase font-bold tracking-wider">
                  <tr>
                    <th className="px-6 py-4 whitespace-nowrap w-24">ID</th>
                    <th className="px-6 py-4 whitespace-nowrap">ชื่อรายการ</th>
                    <th className="px-6 py-4 whitespace-nowrap text-right">ราคา (บาท)</th>
                    <th className="px-6 py-4 whitespace-nowrap text-center w-32">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {presets.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-slate-400 font-medium">ไม่มีข้อมูลรายการเพิ่มเติม</td>
                    </tr>
                  ) : (
                    presets.map((preset) => (
                      <tr key={preset.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-500">#{preset.id}</td>
                        <td className="px-6 py-4 whitespace-nowrap font-bold text-slate-800">{preset.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap font-medium text-right text-slate-600">{Number(preset.price).toLocaleString()}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => openEditModal(preset)}
                              className="p-2 rounded-lg transition-colors text-amber-500 hover:bg-amber-50 hover:text-amber-700"
                              title="แก้ไข"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                            </button>
                            <button
                              onClick={() => handleDelete(preset.id)}
                              className="p-2 rounded-lg transition-colors text-rose-500 hover:bg-rose-50 hover:text-rose-700"
                              title="ลบ"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white ${modalMode === 'add' ? 'bg-blue-500' : 'bg-amber-500'}`}>
                  {modalMode === 'add' ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                  )}
                </div>
                {modalMode === 'add' ? 'เพิ่มรายการตั้งต้น' : 'แก้ไขรายการตั้งต้น'}
              </h3>
              <button 
                onClick={closeModal}
                className="text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors w-8 h-8 rounded-full flex items-center justify-center"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">ชื่อรายการ <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="เช่น ค่าทำความสะอาด, ค่าปรับล่าช้า"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-sm font-medium"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">ราคาเริ่มต้น (บาท) <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  required
                  min="0"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-sm font-medium"
                />
              </div>
              
              <div className="pt-4">
                <button
                  type="submit"
                  disabled={isSubmitting || !formData.name}
                  className={`w-full py-3 text-white font-bold rounded-xl transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
                    modalMode === 'add' 
                      ? 'bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/20' 
                      : 'bg-amber-500 hover:bg-amber-600 shadow-lg shadow-amber-500/20'
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      กำลังบันทึก...
                    </>
                  ) : (
                    'บันทึกข้อมูล'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
