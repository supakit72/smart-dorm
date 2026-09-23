"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/backend/lib/supabase';
import AdminLayout from '@/components/AdminLayout';
import { useAlert } from '@/contexts/AlertContext';
import ContractModal from '@/components/ContractModal';

export default function BookingRequestsPage() {
    const router = useRouter();
    const { showAlert, showConfirm } = useAlert();

    const [activeTab, setActiveTab] = useState<'pending' | 'appointments' | 'history'>('pending');
    const [bookings, setBookings] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Settings state
    const [maxBookingDays, setMaxBookingDays] = useState(7);
    const [unavailableDates, setUnavailableDates] = useState<string[]>([]);
    const [bookingDepositAmount, setBookingDepositAmount] = useState(0);
    const [isSavingSettings, setIsSavingSettings] = useState(false);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

    // Modal state for viewing slip
    const [selectedSlipImage, setSelectedSlipImage] = useState<string | null>(null);
    const [isImageModalOpen, setIsImageModalOpen] = useState(false);

    // Contract Modal State
    const [isContractModalOpen, setIsContractModalOpen] = useState(false);
    const [selectedBookingForContract, setSelectedBookingForContract] = useState<any>(null);

    const handleOpenSlipViewer = (url: string | null | undefined) => {
        if (!url) return;
        setSelectedSlipImage(url);
        setIsImageModalOpen(true);
    };

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
                .select('max_booking_days, unavailable_dates, booking_deposit_amount')
                .limit(1)
                .single();
            if (error && error.code !== 'PGRST116') throw error;
            if (data) {
                setMaxBookingDays(data.max_booking_days ?? 7);
                setUnavailableDates(data.unavailable_dates || []);
                setBookingDepositAmount(data.booking_deposit_amount ?? 0);
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
                booking_deposit_amount: bookingDepositAmount,
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
            setIsSettingsModalOpen(false);
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
            const booking = bookings.find(b => b.id === bookingId);
            if (booking) {
                setSelectedBookingForContract(booking);
                setIsContractModalOpen(true);
            }
            return;
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
    const historyList = bookings.filter(b => ['cancelled', 'rejected', 'refunded', 'no_show', 'moved_in'].includes(b.status));

    return (
        <AdminLayout>
            <div className="max-w-7xl mx-auto space-y-6 pb-24">
                {/* Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-100 text-blue-600 rounded-2xl">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-slate-800">จัดการนัดดูห้องและมัดจำ</h1>
                            <p className="text-sm font-medium text-slate-500">ตรวจสอบสลิปจองคิวและจัดการนัดหมายดูห้อง</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setIsSettingsModalOpen(true)}
                        className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl transition-all shadow-md flex items-center gap-2 active:scale-95"
                    >
                        ⚙️ ตั้งค่าการจอง
                    </button>
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
                        onClick={() => setActiveTab('history')}
                        className={`flex-1 py-3 px-6 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${activeTab === 'history' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}
                    >
                        ประวัติทั้งหมด
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
                                                            onClick={() => handleOpenSlipViewer(item.slip_image)}
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
                                                            onClick={() => handleOpenSlipViewer(item.slip_image)}
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
                    </div>
                )}

                {activeTab === 'history' && (
                    <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                🕒 ประวัติการนัดหมายทั้งหมด
                            </h2>
                        </div>
                        {historyList.length === 0 ? (
                            <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                <div className="text-4xl mb-3">🕒</div>
                                <p className="text-slate-500 font-medium">ยังไม่มีประวัติการนัดหมาย</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-xs">
                                        <tr>
                                            <th className="p-4">ห้อง</th>
                                            <th className="p-4">ผู้จอง</th>
                                            <th className="p-4">วันที่ทำรายการ</th>
                                            <th className="p-4">วันที่นัดหมาย</th>
                                            <th className="p-4">สถานะ</th>
                                            <th className="p-4 text-center">สลิป</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 bg-white">
                                        {historyList.map(b => (
                                            <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="p-4 font-black text-slate-700">
                                                    {b.rooms?.room_number || '-'}
                                                </td>
                                                <td className="p-4 font-medium text-slate-700">
                                                    {b.users?.first_name} {b.users?.last_name}
                                                </td>
                                                <td className="p-4 text-slate-500">
                                                    {formatDate(b.created_at)}
                                                </td>
                                                <td className="p-4 font-bold text-slate-700">
                                                    {formatDate(b.appointment_date)}
                                                </td>
                                                <td className="p-4">
                                                    {b.status === 'moved_in' && <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">ทำสัญญาแล้ว</span>}
                                                    {b.status === 'refunded' && <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-bold bg-slate-200 text-slate-700">คืนเงินแล้ว</span>}
                                                    {b.status === 'cancelled' && <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700">ลูกค้ายกเลิก</span>}
                                                    {b.status === 'rejected' && <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-700">ตีกลับสลิป</span>}
                                                    {b.status === 'no_show' && <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-700">ไม่มาตามนัด (ริบมัดจำ)</span>}
                                                </td>
                                                <td className="p-4 text-center">
                                                    {b.slip_image ? (
                                                        <div 
                                                            className="w-16 h-16 mx-auto rounded-md border border-slate-200 shadow-sm cursor-pointer hover:opacity-80 transition-opacity overflow-hidden"
                                                            onClick={() => handleOpenSlipViewer(b.slip_image)}
                                                            title="คลิกเพื่อดูรูปเต็ม"
                                                        >
                                                            <img 
                                                                src={b.slip_image} 
                                                                alt="Slip Thumbnail" 
                                                                className="w-full h-full object-cover"
                                                            />
                                                        </div>
                                                    ) : (
                                                        <div className="w-16 h-16 mx-auto bg-slate-100 text-slate-400 text-[10px] font-medium flex items-center justify-center rounded-md border border-slate-200">
                                                            ไม่มีสลิป
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Settings Modal */}
            {isSettingsModalOpen && (
                <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[100] flex justify-center items-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-3xl shadow-2xl animate-in fade-in zoom-in-95 duration-200 overflow-hidden flex flex-col max-h-[90vh]">
                        {/* Header */}
                        <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 sticky top-0 z-10">
                            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                ⚙️ ตั้งค่าการจองห้องพัก
                            </h2>
                            <button 
                                onClick={() => setIsSettingsModalOpen(false)} 
                                className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>
                        
                        {/* Body */}
                        <div className="p-6 overflow-y-auto custom-scrollbar">
                            <div className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">จองล่วงหน้าได้สูงสุด (วัน)</label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                required
                                                min="1"
                                                value={maxBookingDays}
                                                onChange={(e) => setMaxBookingDays(parseInt(e.target.value) || 0)}
                                                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all bg-slate-50 focus:bg-white text-sm"
                                            />
                                        </div>
                                        <p className="mt-2 text-xs text-slate-500">จำนวนวันที่อนุญาตให้ลูกค้าเลือกล่วงหน้าจากวันปัจจุบัน</p>
                                    </div>
                                    
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">จำนวนเงินมัดจำ (บาท)</label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                required
                                                min="0"
                                                value={bookingDepositAmount}
                                                onChange={(e) => setBookingDepositAmount(parseFloat(e.target.value) || 0)}
                                                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all bg-slate-50 focus:bg-white text-sm"
                                            />
                                        </div>
                                        <p className="mt-2 text-xs text-slate-500">เงินมัดจำประกันคิวที่ผู้เช่าต้องโอนเพื่อจองห้อง</p>
                                    </div>
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">วันหยุด / วันที่ไม่เปิดรับนัดหมาย</label>
                                    <div className="flex gap-2 mb-3 max-w-sm">
                                        <input
                                            type="date"
                                            id="new_unavailable_date_booking"
                                            className="flex-1 px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all bg-slate-50 focus:bg-white text-sm"
                                        />
                                        <button
                                            type="button"
                                            onClick={handleAddDate}
                                            className="px-4 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 font-bold rounded-xl transition-colors shrink-0"
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
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 border-t border-slate-100 bg-white flex justify-end gap-3 sticky bottom-0">
                            <button
                                type="button"
                                onClick={() => setIsSettingsModalOpen(false)}
                                className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors"
                            >
                                ยกเลิก
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveSettings}
                                disabled={isSavingSettings}
                                className="px-8 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 transition-all active:scale-95 disabled:opacity-70 flex items-center gap-2"
                            >
                                {isSavingSettings ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Slip Viewer Modal */}
            {isImageModalOpen && selectedSlipImage && (
                <div 
                    className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
                    onClick={() => setIsImageModalOpen(false)}
                >
                    <div 
                        className="bg-white rounded-xl shadow-lg w-full max-w-lg p-4 flex flex-col animate-in zoom-in-95 duration-200"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
                            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                🖼️ หลักฐานการโอนเงิน
                            </h2>
                            <button 
                                onClick={() => setIsImageModalOpen(false)}
                                className="w-8 h-8 flex items-center justify-center bg-slate-100 text-slate-500 rounded-full hover:bg-slate-200 hover:text-slate-800 transition-colors"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>
                        
                        {/* Body */}
                        <div className="flex justify-center items-center bg-slate-50 rounded-lg overflow-hidden border border-slate-100 min-h-[300px]">
                            <img 
                                src={selectedSlipImage} 
                                alt="Slip Evidence" 
                                className="max-w-full max-h-[70vh] object-contain rounded-lg" 
                            />
                        </div>
                    </div>
                </div>
            )}
            {/* Contract Modal */}
            <ContractModal
                isOpen={isContractModalOpen}
                onClose={() => setIsContractModalOpen(false)}
                onSuccess={() => fetchBookings()}
                room={selectedBookingForContract?.rooms || null}
                tenant={selectedBookingForContract?.users || null}
                bookingId={selectedBookingForContract?.id}
                bookingDepositAmount={bookingDepositAmount}
            />
        </AdminLayout>
    );
}
