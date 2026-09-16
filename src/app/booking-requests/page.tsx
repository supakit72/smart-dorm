"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/backend/lib/supabase';
import AdminLayout from '@/components/AdminLayout';
import { useAlert } from '@/contexts/AlertContext';

export default function BookingRequestsPage() {
    const router = useRouter();
    const { showAlert, showConfirm } = useAlert();

    const [activeTab, setActiveTab] = useState<'pending' | 'appointments' | 'settings'>('pending');
    const [bookings, setBookings] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Settings state
    const [maxBookingDays, setMaxBookingDays] = useState(7);
    const [unavailableDates, setUnavailableDates] = useState<string[]>([]);
    const [isSavingSettings, setIsSavingSettings] = useState(false);

    // Modal state for viewing slip
    const [selectedImage, setSelectedImage] = useState<string | null>(null);

    useEffect(() => {
        const checkAuthAndFetch = async () => {
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

            fetchBookings();
            fetchSettings();
        };

        checkAuthAndFetch();
    }, [router]);

    const fetchBookings = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('room_bookings')
                .select('*, users!room_bookings_user_id_fkey(*), rooms(*)')
                .order('created_at', { ascending: false });

            if (error) throw error;
            if (data) setBookings(data);
        } catch (err: any) {
            console.error('===== Error fetching room_bookings =====');
            console.error("Supabase Error Details:", err.message, err.hint, err.details);
            console.error(err);
            showAlert('error', 'ข้อผิดพลาด', 'ไม่สามารถโหลดข้อมูลการจองได้ (กรุณาตรวจสอบ Console)');
        } finally {
            setLoading(false);
        }
    };

    const fetchSettings = async () => {
        try {
            const { data, error } = await supabase
                .from('dorm_settings')
                .select('max_booking_days, unavailable_dates')
                .limit(1)
                .single();
            if (error && error.code !== 'PGRST116') throw error;
            if (data) {
                setMaxBookingDays(data.max_booking_days ?? 7);
                setUnavailableDates(data.unavailable_dates || []);
            }
        } catch (err) {
            console.error("Error fetching settings:", err);
        }
    };

    const handleSaveSettings = async () => {
        try {
            setIsSavingSettings(true);
            const { data: existingData } = await supabase.from('dorm_settings').select('id').limit(1).single();
            
            const updatePayload = {
                max_booking_days: maxBookingDays,
                unavailable_dates: unavailableDates,
                updated_at: new Date().toISOString()
            };

            if (existingData) {
                const { error } = await supabase.from('dorm_settings').update(updatePayload).eq('id', existingData.id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('dorm_settings').insert([updatePayload]);
                if (error) throw error;
            }
            showAlert('success', 'บันทึกสำเร็จ', 'อัปเดตการตั้งค่าการนัดหมายเรียบร้อยแล้ว');
        } catch (err: any) {
            console.error(err);
            showAlert('error', 'บันทึกล้มเหลว', err.message);
        } finally {
            setIsSavingSettings(false);
        }
    };

    const handleAddDate = () => {
        const input = document.getElementById('new_unavailable_date_booking') as HTMLInputElement;
        if (input && input.value) {
            if (!unavailableDates.includes(input.value)) {
                setUnavailableDates([...unavailableDates, input.value].sort());
            }
            input.value = '';
        }
    };

    const handleRemoveDate = (dateToRemove: string) => {
        setUnavailableDates(unavailableDates.filter(d => d !== dateToRemove));
    };

    const handleConfirmSlip = (bookingId: number, roomId: number) => {
        showConfirm(
            'ยืนยันสลิปมัดจำ',
            'คุณตรวจสอบสลิปแล้วว่าถูกต้อง และต้องการเปลี่ยนสถานะห้องเป็น "รอตรวจสอบ (Reserved)" ใช่หรือไม่?',
            async () => {
                try {
                    // 1. Update booking status
                    const { error: bookingError } = await supabase
                        .from('room_bookings')
                        .update({ status: 'confirmed' })
                        .eq('id', bookingId);
                    if (bookingError) throw bookingError;

                    // 2. Update room status
                    const { error: roomError } = await supabase
                        .from('rooms')
                        .update({ status: 'reserved' })
                        .eq('room_id', roomId);
                    if (roomError) throw roomError;

                    showAlert('success', 'ยืนยันสำเร็จ', 'เปลี่ยนสถานะการจองเป็น "นัดหมาย" และล็อคห้องเรียบร้อย');
                    fetchBookings();
                } catch (err: any) {
                    console.error('Confirm slip error:', err);
                    alert("เกิดข้อผิดพลาด: " + err.message);
                }
            }
        );
    };

    const handleAction = (bookingId: number, roomId: number, actionType: 'sign' | 'refund' | 'noshow' | 'reject') => {
        let title = '';
        let desc = '';
        let newBookingStatus = '';
        let newRoomStatus = '';

        if (actionType === 'sign') {
            title = 'ทำสัญญาเข้าอยู่';
            desc = 'ยืนยันว่าผู้เช่าได้ตกลงทำสัญญาแล้ว ระบบจะเปลี่ยนสถานะห้องเป็น "ไม่ว่าง (Occupied)"';
            newBookingStatus = 'moved_in';
            newRoomStatus = 'occupied';
        } else if (actionType === 'refund') {
            title = 'คืนเงินมัดจำ (ไม่เช่า)';
            desc = 'ผู้เช่ามาตามนัดแต่ไม่ตกลงทำสัญญา ระบบจะคืนเงินและเปลี่ยนสถานะห้องเป็น "ว่าง"';
            newBookingStatus = 'refunded';
            newRoomStatus = 'vacant';
        } else if (actionType === 'noshow') {
            title = 'ไม่มาตามนัด (ริบมัดจำ)';
            desc = 'ผู้เช่าไม่มาตามนัด ระบบจะริบมัดจำและเปลี่ยนสถานะห้องกลับเป็น "ว่าง"';
            newBookingStatus = 'no_show';
            newRoomStatus = 'vacant';
        } else if (actionType === 'reject') {
            title = 'ตีกลับสลิป (Reject)';
            desc = 'ตีกลับสลิปมัดจำเนื่องจากไม่ถูกต้อง ระบบจะเปลี่ยนสถานะห้องกลับเป็น "ว่าง"';
            newBookingStatus = 'rejected';
            newRoomStatus = 'vacant';
        }

        showConfirm(title, desc, async () => {
            try {
                // 1. Update booking status
                const { error: bookingError } = await supabase
                    .from('room_bookings')
                    .update({ status: newBookingStatus })
                    .eq('id', bookingId);
                if (bookingError) throw bookingError;

                // 2. Update room status
                const { error: roomError } = await supabase
                    .from('rooms')
                    .update({ status: newRoomStatus })
                    .eq('room_id', roomId);
                if (roomError) throw roomError;

                showAlert('success', 'ทำรายการสำเร็จ', 'ระบบได้บันทึกสถานะเรียบร้อยแล้ว');
                fetchBookings();
                
                // If signed contract, maybe navigate to contract creation page?
                if (actionType === 'sign') {
                    // Optional: router.push('/contracts/editor/new?room_id=' + roomId);
                    // For now we just stay on this page.
                }
            } catch (err: any) {
                console.error('Action error:', err);
                alert("เกิดข้อผิดพลาด: " + err.message);
            }
        });
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr) return '-';
        const d = new Date(dateStr);
        return d.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
    };

    const pendingList = bookings.filter(b => b.status === 'pending');
    const confirmedList = bookings.filter(b => b.status === 'confirmed');
    // We can also show history if we want, but requirements didn't specify.

    return (
        <AdminLayout>
            <div className="max-w-7xl mx-auto space-y-6 pb-24">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-100 text-blue-600 rounded-2xl">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-800">จัดการนัดดูห้องและมัดจำ</h1>
                        <p className="text-sm font-medium text-slate-500">ตรวจสอบสลิปจองคิวและจัดการนัดหมายดูห้อง</p>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex flex-col sm:flex-row bg-white rounded-2xl p-1 shadow-sm border border-slate-200 gap-1">
                    <button
                        onClick={() => setActiveTab('pending')}
                        className={`flex-1 py-3 px-6 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${activeTab === 'pending' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}
                    >
                        รอยืนยันสลิปมัดจำ
                        {pendingList.length > 0 && (
                            <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full">{pendingList.length}</span>
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab('appointments')}
                        className={`flex-1 py-3 px-6 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${activeTab === 'appointments' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}
                    >
                        จัดการวันนัดหมาย
                        {confirmedList.length > 0 && (
                            <span className="bg-blue-500 text-white text-[10px] px-2 py-0.5 rounded-full">{confirmedList.length}</span>
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab('settings')}
                        className={`flex-1 py-3 px-6 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${activeTab === 'settings' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}
                    >
                        ตั้งค่าการนัดหมาย
                    </button>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center min-h-[40vh]">
                        <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {activeTab === 'pending' && (
                            <div>
                                {pendingList.length === 0 ? (
                                    <div className="bg-white rounded-3xl p-12 text-center shadow-sm border border-slate-200/60 border-dashed mt-6">
                                        <div className="w-16 h-16 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">✅</div>
                                        <h3 className="text-lg font-bold text-slate-700">ไม่มีรายการรอยืนยัน</h3>
                                        <p className="text-slate-500 text-sm mt-1">คุณได้ตรวจสอบสลิปทั้งหมดเรียบร้อยแล้ว</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {pendingList.map(item => (
                                            <div key={item.id} className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                                                <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                                    <div>
                                                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">ห้อง</span>
                                                        <h3 className="text-2xl font-black text-slate-800">{item.rooms?.room_number}</h3>
                                                    </div>
                                                    <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-lg text-xs font-bold border border-amber-200">
                                                        รอตรวจสอบสลิป
                                                    </span>
                                                </div>
                                                <div className="p-5 space-y-4 flex-1">
                                                    <div className="flex gap-4">
                                                        <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 shrink-0 font-bold uppercase">
                                                            {item.users?.first_name?.charAt(0) || '?'}
                                                        </div>
                                                        <div>
                                                            <p className="font-bold text-slate-700">{item.users?.first_name} {item.users?.last_name}</p>
                                                            <p className="text-xs text-slate-500">{item.users?.phone_number || 'ไม่มีเบอร์'}</p>
                                                        </div>
                                                    </div>
                                                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-2">
                                                        <div className="flex justify-between text-sm">
                                                            <span className="text-slate-500">วันที่นัดหมาย</span>
                                                            <span className="font-bold text-slate-700">{formatDate(item.appointment_date)}</span>
                                                        </div>
                                                        <div className="flex justify-between text-sm">
                                                            <span className="text-slate-500">วันที่แจ้งจอง</span>
                                                            <span className="font-bold text-slate-700">{formatDate(item.created_at)}</span>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-bold text-slate-500 mb-2">สลิปมัดจำ</p>
                                                        <button 
                                                            onClick={() => setSelectedImage(item.slip_image)}
                                                            className="w-full h-32 bg-slate-100 rounded-xl border border-slate-200 flex items-center justify-center overflow-hidden hover:opacity-90 transition-opacity"
                                                        >
                                                            <img src={item.slip_image} alt="Slip" className="object-cover w-full h-full" />
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="p-5 border-t border-slate-100 flex gap-3">
                                                    <button
                                                        onClick={() => handleConfirmSlip(item.id, item.room_id)}
                                                        className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-md shadow-blue-600/20 active:scale-95"
                                                    >
                                                        ยืนยันสลิป
                                                    </button>
                                                    <button
                                                        onClick={() => handleAction(item.id, item.room_id, 'reject')}
                                                        className="flex-1 py-3 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold rounded-xl transition-all border border-rose-200 active:scale-95"
                                                    >
                                                        ตีกลับสลิป (Reject)
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'appointments' && (
                            <div>
                                {confirmedList.length === 0 ? (
                                    <div className="bg-white rounded-3xl p-12 text-center shadow-sm border border-slate-200/60 border-dashed mt-6">
                                        <div className="w-16 h-16 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">📅</div>
                                        <h3 className="text-lg font-bold text-slate-700">ไม่มีนัดหมาย</h3>
                                        <p className="text-slate-500 text-sm mt-1">ยังไม่มีคิวที่ต้องจัดการในขณะนี้</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
                                        {confirmedList.map(item => (
                                            <div key={item.id} className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col md:flex-row">
                                                <div className="p-6 border-b md:border-b-0 md:border-r border-slate-100 bg-slate-50/50 flex flex-col items-center justify-center w-full md:w-1/3 min-w-[150px]">
                                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">ห้อง</span>
                                                    <h3 className="text-4xl font-black text-slate-800 mb-2">{item.rooms?.room_number}</h3>
                                                    <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-lg text-xs font-bold border border-blue-200 mb-4">
                                                        มีนัดหมาย
                                                    </span>
                                                    <div className="text-center bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
                                                        <p className="text-[10px] text-slate-400 font-bold uppercase mb-0.5">วันที่นัดหมาย</p>
                                                        <p className="text-sm font-bold text-slate-700">{formatDate(item.appointment_date)}</p>
                                                    </div>
                                                </div>
                                                <div className="p-6 flex-1 flex flex-col justify-between">
                                                    <div>
                                                        <div className="flex gap-4 mb-4">
                                                            <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 shrink-0 font-bold uppercase">
                                                                {item.users?.first_name?.charAt(0) || '?'}
                                                            </div>
                                                            <div>
                                                                <p className="font-bold text-slate-700 text-lg">{item.users?.first_name} {item.users?.last_name}</p>
                                                                <p className="text-sm text-slate-500">{item.users?.phone_number || 'ไม่มีเบอร์'} • {item.users?.email || 'ไม่มีอีเมล'}</p>
                                                            </div>
                                                        </div>
                                                        <button 
                                                            onClick={() => setSelectedImage(item.slip_image)}
                                                            className="text-xs font-bold text-blue-600 underline hover:text-blue-800"
                                                        >
                                                            ดูรูปสลิปมัดจำ
                                                        </button>
                                                    </div>
                                                    <div className="mt-6 flex flex-col gap-3">
                                                        <button
                                                            onClick={() => handleAction(item.id, item.room_id, 'sign')}
                                                            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all shadow-md shadow-emerald-600/20 active:scale-95 text-sm"
                                                        >
                                                            ทำสัญญาเข้าอยู่ (Sign Contract)
                                                        </button>
                                                        <div className="grid grid-cols-2 gap-3">
                                                            <button
                                                                onClick={() => handleAction(item.id, item.room_id, 'refund')}
                                                                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-all border border-slate-200 active:scale-95 text-xs sm:text-sm"
                                                            >
                                                                คืนเงิน/ไม่เช่า (Refund)
                                                            </button>
                                                            <button
                                                                onClick={() => handleAction(item.id, item.room_id, 'noshow')}
                                                                className="w-full py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold rounded-xl transition-all border border-rose-200 active:scale-95 text-xs sm:text-sm"
                                                            >
                                                                ไม่มาตามนัด (No Show)
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'settings' && (
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
                                                value={maxBookingDays}
                                                onChange={(e) => setMaxBookingDays(parseInt(e.target.value) || 0)}
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
                                                id="new_unavailable_date_booking"
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
                                            {unavailableDates.length === 0 ? (
                                                <span className="text-sm text-slate-400">ยังไม่มีการตั้งค่าวันหยุด</span>
                                            ) : (
                                                unavailableDates.map(date => (
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
                                <div className="pt-6 mt-6 border-t border-slate-100 flex justify-end">
                                    <button
                                        type="button"
                                        onClick={handleSaveSettings}
                                        disabled={isSavingSettings}
                                        className="px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 transition-all active:scale-95 disabled:opacity-70 flex items-center justify-center gap-2"
                                    >
                                        {isSavingSettings ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Slip Modal */}
            {selectedImage && (
                <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[100] flex justify-center items-center p-4" onClick={() => setSelectedImage(null)}>
                    <div className="relative max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        <button 
                            onClick={() => setSelectedImage(null)}
                            className="absolute -top-4 -right-4 w-10 h-10 bg-white rounded-full flex items-center justify-center text-slate-800 shadow-xl hover:bg-slate-100"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                        <img src={selectedImage} alt="Slip Full" className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl" />
                    </div>
                </div>
            )}
        </AdminLayout>
    );
}
