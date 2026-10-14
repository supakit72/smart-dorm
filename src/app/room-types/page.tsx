"use client";

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/backend/lib/supabase';
import AdminLayout from '@/components/AdminLayout';
import { useAlert } from '@/contexts/AlertContext';
import { uploadRoomImageToStorage } from '@/backend/lib/uploadImage';

export default function RoomTypesManagementPage() {
  const router = useRouter();
  const { showAlert, showConfirm } = useAlert();

  const [roomTypes, setRoomTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [selectedType, setSelectedType] = useState<any>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    base_price: ''
  });
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [newImages, setNewImages] = useState<{ id: string; file: File; previewUrl: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
      fetchRoomTypes();
    };
    checkAuth();
  }, [router]);

  const fetchRoomTypes = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('room_types')
        .select('*')
        .order('id', { ascending: true });

      if (error) throw error;
      setRoomTypes(data || []);
    } catch (err: any) {
      console.error("Fetch Room Types Error:", err);
      showAlert('confirm', 'เกิดข้อผิดพลาด', err.message);
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setModalMode('add');
    setSelectedType(null);
    setFormData({ name: '', description: '', base_price: '' });
    setExistingImages([]);
    setNewImages([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setIsModalOpen(true);
  };

  const openEditModal = (roomType: any) => {
    setModalMode('edit');
    setSelectedType(roomType);
    setFormData({
      name: roomType.name,
      description: roomType.description || '',
      base_price: roomType.base_price?.toString() || ''
    });
    setExistingImages(Array.isArray(roomType.image_urls) ? [...roomType.image_urls] : []);
    setNewImages([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (!isSubmitting) {
      setIsModalOpen(false);
      setExistingImages([]);
      setNewImages([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleImagesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const validFiles: File[] = [];
    let hasOversized = false;

    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) {
        hasOversized = true;
      } else {
        validFiles.push(file);
      }
    }

    if (hasOversized) {
      showAlert('confirm', 'ไฟล์มีขนาดใหญ่เกินไป', 'ระบบเลือกเฉพาะไฟล์รูปภาพขนาดไม่เกิน 5MB ต่อรูป');
    }

    const items = validFiles.map(file => ({
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      file,
      previewUrl: URL.createObjectURL(file)
    }));

    setNewImages(prev => [...prev, ...items]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveExistingImage = (indexToRemove: number) => {
    setExistingImages(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleRemoveNewImage = (idToRemove: string) => {
    setNewImages(prev => prev.filter(img => img.id !== idToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);

      let newlyUploadedUrls: string[] = [];
      if (newImages.length > 0) {
        newlyUploadedUrls = await Promise.all(
          newImages.map((img, idx) =>
            uploadRoomImageToStorage(img.file, `room-type-${idx + 1}`)
          )
        );
      }

      const finalImageUrls: string[] = [...existingImages, ...newlyUploadedUrls];

      if (modalMode === 'add') {
        const { error } = await supabase.from('room_types').insert([
          {
            name: formData.name,
            description: formData.description,
            base_price: Number(formData.base_price),
            image_urls: finalImageUrls
          }
        ]);
        if (error) throw error;
        showAlert('success', 'เพิ่มประเภทห้องสำเร็จ', 'เพิ่มข้อมูลประเภทห้องพักเรียบร้อยแล้ว');
      } else {
        const { error } = await supabase.from('room_types')
          .update({
            name: formData.name,
            description: formData.description,
            base_price: Number(formData.base_price),
            image_urls: finalImageUrls
          })
          .eq('id', selectedType.id);
        if (error) throw error;
        showAlert('success', 'แก้ไขประเภทห้องสำเร็จ', 'อัปเดตข้อมูลประเภทห้องพักเรียบร้อยแล้ว');
      }
      closeModal();
      fetchRoomTypes();
    } catch (err: any) {
      console.error('Submit Room Type Error:', err);
      showAlert('confirm', 'เกิดข้อผิดพลาด', err.message || 'บันทึกข้อมูลไม่สำเร็จ');
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDelete = async (id: number) => {
    try {
      // Check if there are rooms using this type before deleting
      const { data: roomsWithThisType, error: checkError } = await supabase
        .from('rooms')
        .select('room_id')
        .eq('room_type_id', id)
        .limit(1);

      if (checkError) throw checkError;

      if (roomsWithThisType && roomsWithThisType.length > 0) {
        alert('ไม่สามารถลบประเภทห้องพักนี้ได้ เนื่องจากมีห้องพักที่ใช้ประเภทนี้อยู่');
        return;
      }

      const { error } = await supabase.from('room_types').delete().eq('id', id);
      if (error) throw error;

      showAlert('success', 'ลบประเภทห้องพักสำเร็จ', 'ลบข้อมูลประเภทห้องพักออกจากระบบแล้ว');
      fetchRoomTypes();
    } catch (err: any) {
      alert('ลบข้อมูลไม่สำเร็จ: ' + err.message);
    }
  };

  const handleDelete = (id: number) => {
    showConfirm(
      'ยืนยันการลบประเภทห้องพัก',
      'คุณแน่ใจหรือไม่ว่าต้องการลบประเภทห้องพักนี้? การกระทำนี้ไม่สามารถย้อนกลับได้',
      () => confirmDelete(id)
    );
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-slate-800 tracking-tight">จัดการประเภทห้องพัก</h2>
            <p className="text-sm text-slate-500 mt-1">เพิ่ม แก้ไข และลบประเภทห้องพัก (Room Types)</p>
          </div>
          <button
            onClick={openAddModal}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            เพิ่มประเภทห้อง
          </button>
        </div>

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center">
            <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
            <p className="text-slate-500 font-medium">กำลังโหลดข้อมูลประเภทห้องพัก...</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 text-xs uppercase font-bold tracking-wider">
                  <tr>
                    <th className="px-6 py-4 whitespace-nowrap w-20">ID</th>
                    <th className="px-6 py-4 whitespace-nowrap w-28">รูปภาพ</th>
                    <th className="px-6 py-4 whitespace-nowrap w-56">ชื่อประเภทห้องพัก</th>
                    <th className="px-6 py-4 whitespace-nowrap w-32">ราคามาตรฐาน</th>
                    <th className="px-6 py-4 whitespace-nowrap">รายละเอียด</th>
                    <th className="px-6 py-4 whitespace-nowrap text-center w-32">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {roomTypes.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-medium">ไม่มีข้อมูลประเภทห้องพัก</td>
                    </tr>
                  ) : (
                    roomTypes.map((type) => (
                      <tr key={type.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-500">#{type.id}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {type.image_urls?.[0] ? (
                            <img
                              src={type.image_urls[0]}
                              alt={type.name}
                              className="w-14 h-14 rounded-xl object-cover border border-slate-200 shadow-sm"
                            />
                          ) : (
                            <div className="w-14 h-14 rounded-xl bg-slate-100 border border-slate-200/80 flex flex-col items-center justify-center text-slate-400 text-xs">
                              <span className="text-base">🖼️</span>
                              <span className="text-[10px] font-medium mt-0.5">ไม่มีรูป</span>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap font-bold text-slate-800">{type.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap font-semibold text-blue-600">{Number(type.base_price || 0).toLocaleString()} ฿</td>
                        <td className="px-6 py-4 text-slate-600">{type.description || '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => openEditModal(type)}
                              className="p-2 rounded-lg transition-colors text-amber-500 hover:bg-amber-50 hover:text-amber-700"
                              title="แก้ไข"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                            </button>
                            <button
                              onClick={() => handleDelete(type.id)}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200 my-auto">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white ${modalMode === 'add' ? 'bg-blue-500' : 'bg-amber-500'}`}>
                  {modalMode === 'add' ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                  )}
                </div>
                {modalMode === 'add' ? 'เพิ่มประเภทห้องพัก' : 'แก้ไขประเภทห้องพัก'}
              </h3>
              <button
                onClick={closeModal}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">ชื่อประเภทห้องพัก <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="เช่น ห้องแอร์, ห้องพัดลม"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-sm font-medium"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">ราคามาตรฐาน (บาท/เดือน) <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  required
                  min="0"
                  value={formData.base_price}
                  onChange={(e) => setFormData({ ...formData, base_price: e.target.value })}
                  placeholder="เช่น 4500"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-sm font-medium"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">รายละเอียด (ไม่บังคับ)</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="รายละเอียดเพิ่มเติมของประเภทห้องนี้"
                  rows={2}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-sm font-medium resize-none"
                ></textarea>
              </div>

              {/* รูปภาพประเภทห้องพัก (Multi-Image) */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-sm font-bold text-slate-700">
                    รูปภาพประเภทห้องพัก
                  </label>
                  {(existingImages.length + newImages.length) > 0 && (
                    <span className="text-xs text-blue-600 font-semibold bg-blue-50 px-2 py-0.5 rounded-full">
                      ทั้งหมด {existingImages.length + newImages.length} รูป
                    </span>
                  )}
                </div>
                <input
                  type="file"
                  ref={fileInputRef}
                  multiple
                  accept="image/*"
                  onChange={handleImagesChange}
                  className="hidden"
                />

                {(existingImages.length + newImages.length) > 0 ? (
                  <div>
                    <div className="grid grid-cols-3 gap-2.5 max-h-56 overflow-y-auto p-1.5 bg-slate-50/80 rounded-2xl border border-slate-200">
                      {/* รูปภาพเดิมที่มีในฐานข้อมูล */}
                      {existingImages.map((url, idx) => {
                        const isCover = idx === 0;
                        return (
                          <div key={`existing-${idx}`} className="relative rounded-xl overflow-hidden border border-slate-200/80 bg-slate-900 group aspect-square shadow-sm">
                            <img
                              src={url}
                              alt={`Existing ${idx + 1}`}
                              className="w-full h-full object-cover"
                            />
                            {isCover ? (
                              <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-blue-600 text-white text-[9px] font-bold rounded shadow-sm">
                                รูปหน้าปก (Cover)
                              </span>
                            ) : (
                              <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-slate-900/70 text-white text-[9px] font-medium rounded shadow-sm">
                                รูปเดิม
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => handleRemoveExistingImage(idx)}
                              className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-slate-900/75 hover:bg-rose-600 text-white flex items-center justify-center transition-colors text-xs font-bold shadow-md"
                              title="ลบรูปนี้"
                            >
                              ✕
                            </button>
                          </div>
                        );
                      })}

                      {/* รูปภาพใหม่ที่เพิ่งเลือกจากเครื่อง */}
                      {newImages.map((img, nIdx) => {
                        const overallIndex = existingImages.length + nIdx;
                        const isCover = overallIndex === 0;
                        return (
                          <div key={img.id} className="relative rounded-xl overflow-hidden border border-emerald-300 bg-slate-900 group aspect-square shadow-sm ring-1 ring-emerald-400">
                            <img
                              src={img.previewUrl}
                              alt={`New ${nIdx + 1}`}
                              className="w-full h-full object-cover"
                            />
                            {isCover ? (
                              <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-blue-600 text-white text-[9px] font-bold rounded shadow-sm">
                                รูปหน้าปก (Cover)
                              </span>
                            ) : (
                              <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-emerald-600 text-white text-[9px] font-bold rounded shadow-sm">
                                ใหม่
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => handleRemoveNewImage(img.id)}
                              className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-slate-900/75 hover:bg-rose-600 text-white flex items-center justify-center transition-colors text-xs font-bold shadow-md"
                              title="ลบรูปนี้"
                            >
                              ✕
                            </button>
                          </div>
                        );
                      })}

                      {/* ปุ่มเพิ่มรูปภาพเพิ่ม */}
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="aspect-square border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-xl flex flex-col items-center justify-center text-slate-500 hover:text-blue-600 bg-white hover:bg-blue-50/40 transition-all text-xs font-bold gap-1"
                      >
                        <span className="text-xl leading-none text-slate-400 group-hover:text-blue-500">+</span>
                        <span>เพิ่มรูป</span>
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-1">
                      <span>💡</span> รูปแรกจะถูกใช้เป็นรูปหน้าปก สามารถคลิก [✕] เพื่อนำรูปที่ไม่ต้องการออกได้
                    </p>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full border-2 border-dashed border-slate-300 hover:border-blue-400 bg-slate-50/50 hover:bg-blue-50/20 rounded-2xl p-5 flex flex-col items-center justify-center cursor-pointer transition-all group"
                  >
                    <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 group-hover:text-blue-500 group-hover:scale-110 shadow-sm transition-all mb-2">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                    </div>
                    <p className="text-sm font-bold text-slate-700 group-hover:text-blue-600 transition-colors">คลิกเพื่อเลือกรูปภาพ</p>
                    <p className="text-xs text-slate-400 mt-0.5">เลือกได้หลายรูปพร้อมกัน (รูปแรกจะเป็นรูปหน้าปก)</p>
                  </div>
                )}
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting || !formData.name}
                  className={`w-full py-3 text-white font-bold rounded-xl transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${modalMode === 'add'
                      ? 'bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/20'
                      : 'bg-amber-500 hover:bg-amber-600 shadow-lg shadow-amber-500/20'
                    }`}
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>กำลังบันทึกข้อมูล...</span>
                    </>
                  ) : (
                    <span>บันทึกข้อมูล</span>
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
