"use client";

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/backend/lib/supabase';
import { useAlert } from '@/contexts/AlertContext';

export default function BookRoomPage() {
    const router = useRouter();
    const { showAlert, showConfirm } = useAlert();

    const [rooms, setRooms] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [userUid, setUserUid] = useState<string | null>(null);
    const [userId, setUserId] = useState<string | null>(null);

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedRoom, setSelectedRoom] = useState<any>(null);
    const [appointmentDate, setAppointmentDate] = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Settings state
    const [maxBookingDays, setMaxBookingDays] = useState(7);
    const [unavailableDates, setUnavailableDates] = useState<string[]>([]);
    const [waterRate, setWaterRate] = useState(0);
    const [electricRate, setElectricRate] = useState(0);
    const [dateError, setDateError] = useState('');

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const initData = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                router.push('/login');
                return;
            }

            setUserUid(session.user.id);

            // Get user_id (UUID from users table)
            const { data: userData } = await supabase
                .from('users')
                .select('user_id')
                .eq('user_uid', session.user.id)
                .single();

            if (userData) {
                setUserId(userData.user_id);

                // 1. Check if user already has an active booking
                const { data: existingBooking } = await supabase
                    .from('room_bookings')
                    .select('id')
                    .eq('user_id', userData.user_id)
                    .in('status', ['pending', 'confirmed'])
                    .limit(1)
                    .single();

                if (existingBooking) {
                    router.push('/tenant');
                    return;
                }
            }

            // Fetch settings
            const { data: settingsData } = await supabase
                .from('dorm_settings')
                .select('max_booking_days, unavailable_dates, water_rate, electric_rate')
                .limit(1)
                .single();

            if (settingsData) {
                setMaxBookingDays(settingsData.max_booking_days ?? 7);
                setUnavailableDates(settingsData.unavailable_dates || []);
                setWaterRate(settingsData.water_rate || 0);
                setElectricRate(settingsData.electric_rate || 0);
            }

            // Fetch available rooms
            fetchAvailableRooms();
        };

        initData();
    }, [router]);

    const fetchAvailableRooms = async () => {
        try {
            setLoading(true);

            // 1. Fetch pending or confirmed bookings
            const { data: bookingsData, error: bookingsError } = await supabase
                .from('room_bookings')
                .select('room_id')
                .in('status', ['pending', 'confirmed']);

            if (bookingsError) throw bookingsError;

            const bookedRoomIds = bookingsData?.map(b => b.room_id) || [];

            // 2. Fetch vacant rooms
            const { data, error } = await supabase
                .from('rooms')
                .select(`
                    room_id,
                    room_number,
                    floor,
                    price_per_month,
                    status,
                    room_types (name, base_price)
                `)
                .eq('status', 'vacant')
                .order('room_number', { ascending: true });

            if (error) throw error;

            // 3. Filter out booked rooms
            if (data) {
                const availableRooms = data.filter(room => !bookedRoomIds.includes(room.room_id));
                setRooms(availableRooms);
            }
        } catch (err: any) {
            console.error('Error fetching rooms:', err);
            showAlert('error', 'เกิดข้อผิดพลาด', 'ไม่สามารถโหลดข้อมูลห้องพักได้');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (room: any) => {
        setSelectedRoom(room);
        setAppointmentDate('');
        setSelectedFile(null);
        setPreviewUrl(null);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setSelectedRoom(null);
        setAppointmentDate('');
        setSelectedFile(null);
        setPreviewUrl(null);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setSelectedFile(file);
        const url = URL.createObjectURL(file);
        setPreviewUrl(url);
    };

    const handleSubmitBooking = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!appointmentDate) {
            showAlert('error', 'ข้อมูลไม่ครบ', 'กรุณาระบุวันที่ต้องการนัดหมายดูห้อง');
            return;
        }

        if (!selectedFile) {
            showAlert('error', 'ข้อมูลไม่ครบ', 'กรุณาอัปโหลดสลิปมัดจำประกันคิว');
            return;
        }

        showConfirm(
            'ยืนยันการจองคิวดูห้อง',
            'คุณได้อ่านเงื่อนไขการจองและต้องการยืนยันการนัดหมายใช่หรือไม่?',
            async () => {
                try {
                    setIsSubmitting(true);

                    let slipImageUrl = '';
                    if (selectedFile) {
                        const fileExt = selectedFile.name.split('.').pop();
                        const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
                        const filePath = `${userUid}/${fileName}`;

                        const { error: uploadError } = await supabase.storage
                            .from('slips')
                            .upload(filePath, selectedFile);

                        if (uploadError) throw uploadError;

                        const { data: publicUrlData } = supabase.storage
                            .from('slips')
                            .getPublicUrl(filePath);

                        slipImageUrl = publicUrlData.publicUrl;
                    }

                    // 1.5 Check again if user already has an active booking
                    const { data: existingBooking } = await supabase
                        .from('room_bookings')
                        .select('id')
                        .eq('user_id', userId)
                        .in('status', ['pending', 'confirmed'])
                        .limit(1)
                        .single();

                    if (existingBooking) {
                        showAlert('error', 'ข้อผิดพลาด', 'คุณมีรายการจองที่กำลังดำเนินการอยู่แล้ว');
                        router.push('/tenant');
                        return;
                    }

                    // 2. Insert into room_bookings
                    const { error: insertError } = await supabase
                        .from('room_bookings')
                        .insert([{
                            room_id: selectedRoom.room_id,
                            user_id: userId,
                            user_uid: userUid,
                            appointment_date: appointmentDate,
                            slip_image: slipImageUrl,
                            status: 'pending'
                        }]);

                    if (insertError) throw insertError;

                    showAlert('success', 'จองคิวสำเร็จ', 'กรุณารอแอดมินตรวจสอบสลิปมัดจำ');
                    setIsModalOpen(false);
                    router.push('/tenant');

                } catch (err: any) {
                    console.error('Booking error:', err);
                    alert("เกิดข้อผิดพลาด: " + err.message);
                } finally {
                    setIsSubmitting(false);
                }
            }
        );
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-20">
            {/* Header */}
            <header className="bg-white border-b border-slate-200/60 sticky top-0 z-10 shadow-sm">
                <div className="max-w-5xl mx-auto px-4 sm:px-6">
                    <div className="flex justify-between h-16 items-center">
                        <h1 className="text-lg font-bold text-slate-800 tracking-tight flex items-center">
                            Smart Dorm Manager
                            <span className="mx-2 text-slate-300">|</span>
                            <span className="text-blue-600 font-semibold text-base sm:text-lg">จองคิวดูห้องพัก</span>
                        </h1>
                        <button
                            onClick={() => router.push('/tenant')}
                            className="text-sm font-semibold text-slate-600 hover:text-blue-600 transition-colors px-3 py-1.5 rounded-xl hover:bg-blue-50 flex items-center gap-1.5 active:scale-95 shadow-sm border border-transparent hover:border-blue-100"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
                            กลับหน้าแรก
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
                <div className="mb-8">
                    <h2 className="text-2xl font-black text-slate-800 mb-2">ห้องพักที่ว่าง</h2>
                    <p className="text-slate-500 font-medium">เลือกห้องที่คุณสนใจและนัดหมายเพื่อเข้ามาดูห้องพักจริง</p>
                </div>

                {rooms.length === 0 ? (
                    <div className="bg-white rounded-3xl p-12 text-center shadow-sm border border-slate-200/60 border-dashed">
                        <div className="w-20 h-20 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-4 text-4xl">📭</div>
                        <h3 className="text-xl font-bold text-slate-700">ไม่มีห้องว่างในขณะนี้</h3>
                        <p className="text-slate-500 text-base mt-2">โปรดกลับมาตรวจสอบใหม่ในภายหลัง</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {rooms.map((room) => (
                            <div key={room.room_id} className="bg-white rounded-2xl p-6 border border-slate-200/60 shadow-sm flex flex-col relative overflow-hidden group hover:shadow-md transition-shadow hover:border-blue-200">
                                <div className="flex justify-between items-start mb-6">
                                    <div>
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-0.5">ห้องพัก</p>
                                        <h4 className="text-3xl font-black text-slate-800 tracking-tight">{room.room_number}</h4>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-0.5">ชั้น</p>
                                        <p className="text-lg font-bold text-slate-700">{room.floor}</p>
                                    </div>
                                </div>

                                <div className="space-y-3 mb-6 flex-1">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500 font-medium">ประเภทห้อง</span>
                                        <span className="font-bold text-slate-700">{room.room_types?.name || '-'}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500 font-medium">ราคาเช่า/เดือน</span>
                                        <span className="font-bold text-blue-600">{Number(room.price_per_month).toLocaleString()} ฿</span>
                                    </div>
                                    <div className="flex justify-between text-sm border-t border-slate-100 pt-2">
                                        <span className="text-slate-500 font-medium flex items-center gap-1.5"><span className="text-blue-500">💧</span> ค่าน้ำ</span>
                                        <span className="font-bold text-slate-700">{waterRate} ฿/หน่วย</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500 font-medium flex items-center gap-1.5"><span className="text-amber-500">⚡</span> ค่าไฟ</span>
                                        <span className="font-bold text-slate-700">{electricRate} ฿/หน่วย</span>
                                    </div>
                                </div>

                                <button
                                    onClick={() => handleOpenModal(room)}
                                    className="w-full py-3 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-xl transition-colors flex justify-center items-center gap-2 active:scale-95 border border-blue-100"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                                    นัดหมายดูห้อง
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {/* Booking Modal */}
            {isModalOpen && selectedRoom && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex justify-center items-center p-4 transition-opacity">
                    <div className="bg-white rounded-3xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                        <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                จองคิวดูห้อง {selectedRoom.room_number}
                            </h2>
                            <button onClick={handleCloseModal} disabled={isSubmitting} className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors disabled:opacity-50">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>

                        <form onSubmit={handleSubmitBooking} className="flex-1 overflow-y-auto custom-scrollbar">
                            <div className="p-6 space-y-6">

                                {/* Disclaimer Box */}
                                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3">
                                    <div className="text-amber-500 shrink-0 mt-0.5">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                                    </div>
                                    <div className="text-sm font-medium text-amber-800 leading-relaxed">
                                        <strong className="block text-amber-900 mb-1">เงื่อนไขการมัดจำประกันคิว:</strong>
                                        เงินมัดจำนี้เพื่อจองคิวดูห้อง <br />
                                        - หากยกเลิก<span className="font-bold">ขอสงวนสิทธิ์ไม่คืนเงินมัดจำ</span><br />
                                        - หากท่านมาตามนัดและไม่ทำสัญญา <span className="font-bold">จะได้รับเงินคืนเต็มจำนวน</span><br />
                                        - หากตกลงทำสัญญา <span className="font-bold">จะนำไปหักเป็นค่าแรกเข้า</span><br />
                                        - หากไม่มาตามนัด <span className="font-bold text-red-600 underline">ขอสงวนสิทธิ์ไม่คืนเงินทุกกรณี</span>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">วันที่ต้องการนัดหมาย</label>
                                    <input
                                        type="date"
                                        required
                                        value={appointmentDate}
                                        onChange={(e) => {
                                            const selected = e.target.value;
                                            if (!selected) {
                                                setDateError('');
                                                setAppointmentDate('');
                                                return;
                                            }
                                            if (unavailableDates.includes(selected)) {
                                                setDateError('วันนี้เจ้าหน้าที่ไม่สะดวกรับนัด กรุณาเลือกวันอื่น');
                                                setAppointmentDate('');
                                            } else {
                                                setDateError('');
                                                setAppointmentDate(selected);
                                            }
                                        }}
                                        min={new Date().toISOString().split('T')[0]}
                                        max={(() => {
                                            const d = new Date();
                                            d.setDate(d.getDate() + maxBookingDays);
                                            return d.toISOString().split('T')[0];
                                        })()}
                                        className={`w-full px-4 py-3 rounded-xl border focus:ring-4 outline-none transition-all font-medium bg-slate-50 focus:bg-white ${dateError ? 'border-red-300 focus:border-red-500 focus:ring-red-500/10' : 'border-slate-200 focus:border-blue-500 focus:ring-blue-500/10'}`}
                                    />
                                    {dateError && (
                                        <p className="text-sm text-red-600 font-medium mt-2">{dateError}</p>
                                    )}
                                    {unavailableDates.length > 0 && (
                                        <p className="text-xs text-rose-500 font-medium mt-2">
                                            * วันที่ปิดรับนัดหมาย: {unavailableDates.map(d => new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })).join(', ')}
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">แนบสลิปมัดจำประกันคิว</label>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        ref={fileInputRef}
                                        onChange={handleFileChange}
                                        required
                                    />

                                    {selectedFile && previewUrl ? (
                                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col items-center gap-3 relative">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setSelectedFile(null);
                                                    setPreviewUrl(null);
                                                    if (fileInputRef.current) fileInputRef.current.value = '';
                                                }}
                                                className="absolute top-2 right-2 w-8 h-8 bg-red-100 text-red-600 rounded-full flex items-center justify-center hover:bg-red-200 transition-colors"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                            </button>
                                            <img src={previewUrl} alt="Slip Preview" className="max-h-40 rounded-lg shadow-sm border border-slate-200 object-contain" />
                                            <p className="text-xs text-slate-500 font-medium truncate w-full text-center">{selectedFile.name}</p>
                                        </div>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            className="w-full font-medium py-6 px-4 rounded-xl transition-all shadow-sm bg-white border-2 border-dashed border-blue-200 text-blue-600 hover:bg-blue-50 hover:border-blue-400 flex flex-col items-center gap-2"
                                        >
                                            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-1">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                                            </div>
                                            คลิกเพื่ออัปโหลดสลิป
                                        </button>
                                    )}
                                </div>

                            </div>

                            <div className="px-6 py-4 border-t border-slate-100 bg-white">
                                <button
                                    type="submit"
                                    disabled={isSubmitting || !!dateError}
                                    className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                            กำลังดำเนินการ...
                                        </>
                                    ) : 'ยืนยันการจองคิว'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
