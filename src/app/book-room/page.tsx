"use client";

import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/backend/lib/supabase';
import { useAlert } from '@/contexts/AlertContext';
import generatePayload from 'promptpay-qr';
import { QRCodeSVG } from 'qrcode.react';

const DEFAULT_ROOM_IMAGE = 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=80';

type FilterType = 'all' | 'air' | 'fan' | 'floor_1_2' | 'floor_3_4';

interface RoomCardProps {
    room: any;
    waterRate: number;
    electricRate: number;
    onOpenModal: (room: any) => void;
}

function RoomCard({ room, waterRate, electricRate, onOpenModal }: RoomCardProps) {
    const [currentIdx, setCurrentIdx] = useState(0);

    // Hybrid Images Fallback:
    // 1. room.image_urls
    // 2. room.room_types?.image_urls
    // 3. DEFAULT_ROOM_IMAGE
    const images: string[] = useMemo(() => {
        if (Array.isArray(room.image_urls) && room.image_urls.length > 0) {
            return room.image_urls;
        }
        if (Array.isArray(room.room_types?.image_urls) && room.room_types.image_urls.length > 0) {
            return room.room_types.image_urls;
        }
        return [DEFAULT_ROOM_IMAGE];
    }, [room]);

    const hasMultipleImages = images.length > 1;

    const handlePrev = (e: React.MouseEvent) => {
        e.stopPropagation();
        setCurrentIdx(prev => (prev === 0 ? images.length - 1 : prev - 1));
    };

    const handleNext = (e: React.MouseEvent) => {
        e.stopPropagation();
        setCurrentIdx(prev => (prev === images.length - 1 ? 0 : prev + 1));
    };

    const typeName = room.room_types?.name || '';
    const isAir = typeName.includes('แอร์') || typeName.toLowerCase().includes('air');
    const isFan = typeName.includes('พัดลม') || typeName.toLowerCase().includes('fan');

    return (
        <div className="bg-white rounded-3xl border border-slate-200/80 overflow-hidden shadow-sm hover:shadow-xl hover:shadow-slate-200/60 transition-all duration-300 flex flex-col group">
            {/* ส่วนหัวภาพ (Carousel & Floating Badges) */}
            <div className="relative aspect-[16/10] w-full overflow-hidden bg-slate-900 select-none">
                <img
                    src={images[currentIdx]}
                    alt={`ห้อง ${room.room_number}`}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />

                {/* แปะ Badge สถานะ ว่าง สีเขียวลอยมุมขวาบน */}
                <div className="absolute top-3.5 right-3.5 z-10 px-3 py-1 rounded-full bg-emerald-500/95 backdrop-blur-md text-white font-bold text-xs shadow-md flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                    <span>ว่าง</span>
                </div>

                {/* ไอคอนกล้อง/รูปภาพลอยมุมขวาล่าง */}
                <div className="absolute bottom-3.5 right-3.5 z-10 px-2.5 py-1 rounded-full bg-slate-900/75 backdrop-blur-md text-white text-[11px] font-bold flex items-center gap-1 shadow-sm">
                    <span>📷</span>
                    <span>{images.length}</span>
                </div>

                {/* Carousel Controls (Previous / Next) */}
                {hasMultipleImages && (
                    <>
                        <button
                            type="button"
                            onClick={handlePrev}
                            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 hover:bg-black/70 text-white flex items-center justify-center transition-all z-10 backdrop-blur-sm opacity-90 sm:opacity-0 group-hover:opacity-100 shadow-sm active:scale-90"
                            title="รูปก่อนหน้า"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                        </button>
                        <button
                            type="button"
                            onClick={handleNext}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 hover:bg-black/70 text-white flex items-center justify-center transition-all z-10 backdrop-blur-sm opacity-90 sm:opacity-0 group-hover:opacity-100 shadow-sm active:scale-90"
                            title="รูปถัดไป"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                        </button>

                        {/* Carousel Dots กึ่งกลางล่างของรูปภาพ */}
                        <div className="absolute bottom-3.5 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-md">
                            {images.map((_, i) => (
                                <button
                                    key={i}
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setCurrentIdx(i);
                                    }}
                                    className={`h-1.5 rounded-full transition-all ${
                                        i === currentIdx ? 'w-5 bg-white' : 'w-1.5 bg-white/50 hover:bg-white/80'
                                    }`}
                                    aria-label={`ไปยังรูปที่ ${i + 1}`}
                                />
                            ))}
                        </div>
                    </>
                )}
            </div>

            {/* ส่วนรายละเอียด */}
            <div className="p-4 sm:p-6 flex-1 flex flex-col justify-between">
                <div>
                    <h3 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">
                        ห้อง {room.room_number}
                    </h3>

                    {/* ป้ายแท็กแนวนอน */}
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-2.5 sm:mt-3">
                        <span className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold">
                            🏢 ชั้น {room.floor}
                        </span>
                        {isAir ? (
                            <span className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-xl bg-cyan-50 text-cyan-700 text-xs font-bold border border-cyan-100">
                                ❄️ ห้องแอร์
                            </span>
                        ) : isFan ? (
                            <span className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-xl bg-amber-50 text-amber-700 text-xs font-bold border border-amber-100">
                                💨 พัดลม
                            </span>
                        ) : typeName ? (
                            <span className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-xl bg-blue-50 text-blue-700 text-xs font-bold border border-blue-100">
                                🛏️ {typeName}
                            </span>
                        ) : null}
                        {typeName && (isAir || isFan) && (
                            <span className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-xl bg-slate-50 text-slate-500 text-[11px] font-medium border border-slate-100">
                                {typeName}
                            </span>
                        )}
                    </div>

                    {/* ข้อมูลเรทน้ำไฟ */}
                    <div className="flex flex-wrap items-center gap-x-3 sm:gap-x-4 gap-y-1 text-xs font-medium text-slate-500 mt-3 sm:mt-4 pt-2.5 sm:pt-3 border-t border-slate-100">
                        <span className="flex items-center gap-1">
                            💧 ค่าน้ำ <strong className="text-slate-700">{waterRate}</strong> ฿/หน่วย
                        </span>
                        <span className="flex items-center gap-1">
                            ⚡ ไฟ <strong className="text-slate-700">{electricRate}</strong> ฿/หน่วย
                        </span>
                    </div>
                </div>

                {/* ส่วนราคาและ Action */}
                <div className="mt-4 sm:mt-6 pt-3 sm:pt-4 border-t border-slate-100">
                    <div className="flex items-baseline justify-between mb-3 sm:mb-4">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                            ค่าเช่าเดือนละ
                        </span>
                        <div className="text-right">
                            <span className="text-2xl sm:text-3xl font-black text-blue-600 tracking-tight">
                                {Number(room.price_per_month).toLocaleString()}
                            </span>
                            <span className="text-slate-500 font-bold ml-1 text-sm">฿</span>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={() => onOpenModal(room)}
                        className="w-full py-3 sm:py-3.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold rounded-xl sm:rounded-2xl transition-all shadow-md shadow-blue-500/20 active:scale-[0.98] flex items-center justify-center gap-2 text-sm sm:text-base group/btn cursor-pointer"
                    >
                        <span>นัดหมายดูห้อง</span>
                        <span className="transition-transform group-hover/btn:translate-x-1">➔</span>
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function BookRoomPage() {
    const router = useRouter();
    const { showAlert, showConfirm } = useAlert();

    const [rooms, setRooms] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeFilter, setActiveFilter] = useState<FilterType>('all');

    // User State
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [userUid, setUserUid] = useState<string | null>(null);
    const [userId, setUserId] = useState<string | null>(null);

    // Guest Form State
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedRoom, setSelectedRoom] = useState<any>(null);
    const [appointmentDate, setAppointmentDate] = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Settings state
    const [dormName, setDormName] = useState('Smart Dorm');
    const [phone, setPhone] = useState('');
    const [maxBookingDays, setMaxBookingDays] = useState(7);
    const [unavailableDates, setUnavailableDates] = useState<string[]>([]);
    const [waterRate, setWaterRate] = useState(0);
    const [electricRate, setElectricRate] = useState(0);
    const [bookingDepositAmount, setBookingDepositAmount] = useState(100);
    const [bankName, setBankName] = useState('');
    const [bankAccountNo, setBankAccountNo] = useState('');
    const [bankAccountName, setBankAccountName] = useState('');
    const [promptpayId, setPromptpayId] = useState('');

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const initData = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                setIsLoggedIn(true);
                setUserUid(session.user.id);

                const { data: userData } = await supabase
                    .from('users')
                    .select('user_id, first_name, last_name, phone_number')
                    .eq('user_uid', session.user.id)
                    .single();

                if (userData) {
                    setUserId(userData.user_id);
                    setFirstName(userData.first_name || '');
                    setLastName(userData.last_name || '');
                    setPhoneNumber(userData.phone_number || '');
                }
            }

            // Fetch settings
            const { data: settingsData } = await supabase
                .from('dorm_settings')
                .select('dorm_name, phone, max_booking_days, unavailable_dates, water_rate, electric_rate, booking_deposit_amount, bank_name, bank_account_no, bank_account_name, promptpay_id')
                .limit(1)
                .single();

            if (settingsData) {
                setDormName(settingsData.dorm_name || 'Smart Dorm');
                setPhone(settingsData.phone || '');
                setMaxBookingDays(settingsData.max_booking_days ?? 7);
                setUnavailableDates(settingsData.unavailable_dates || []);
                setWaterRate(settingsData.water_rate || 0);
                setElectricRate(settingsData.electric_rate || 0);
                setBookingDepositAmount(settingsData.booking_deposit_amount || 100);
                setBankName(settingsData.bank_name || '-');
                setBankAccountNo(settingsData.bank_account_no || '-');
                setBankAccountName(settingsData.bank_account_name || '-');
                setPromptpayId(settingsData.promptpay_id || '');
            }

            fetchAvailableRooms();
        };

        initData();
    }, []);

    // Auto-open modal if roomId is in URL
    useEffect(() => {
        if (rooms.length > 0) {
            const params = new URLSearchParams(window.location.search);
            const roomId = params.get('roomId');
            if (roomId) {
                const roomToOpen = rooms.find(r => r.room_id.toString() === roomId);
                if (roomToOpen) {
                    handleOpenModal(roomToOpen);
                    window.history.replaceState(null, '', '/book-room');
                }
            }
        }
    }, [rooms]);

    const fetchAvailableRooms = async () => {
        try {
            setLoading(true);

            const { data: bookingsData, error: bookingsError } = await supabase
                .from('room_bookings')
                .select('room_id')
                .in('status', ['pending', 'confirmed']);

            if (bookingsError) throw bookingsError;

            const bookedRoomIds = bookingsData?.map(b => b.room_id) || [];

            // Query vacant rooms joining room_types:room_type_id(*)
            const { data, error } = await supabase
                .from('rooms')
                .select(`
                    room_id,
                    room_number,
                    floor,
                    price_per_month,
                    status,
                    image_urls,
                    room_types:room_type_id (*)
                `)
                .eq('status', 'vacant')
                .order('room_number', { ascending: true });

            if (error) throw error;

            if (data) {
                const availableRooms = data.filter(room => !bookedRoomIds.includes(room.room_id));
                setRooms(availableRooms);
            }
        } catch (err: any) {
            console.error('Error fetching rooms:', err);
        } finally {
            setLoading(false);
        }
    };

    // Filter pills options
    const filterOptions: { label: string; value: FilterType }[] = [
        { label: 'ทั้งหมด', value: 'all' },
        { label: 'ห้องแอร์', value: 'air' },
        { label: 'พัดลม', value: 'fan' },
        { label: 'ชั้น 1-2', value: 'floor_1_2' },
        { label: 'ชั้น 3-4', value: 'floor_3_4' },
    ];

    // Filtered rooms computed in real-time
    const filteredRooms = useMemo(() => {
        return rooms.filter(room => {
            const typeName = room.room_types?.name || '';
            const floorNum = Number(room.floor);

            switch (activeFilter) {
                case 'air':
                    return typeName.includes('แอร์') || typeName.toLowerCase().includes('air');
                case 'fan':
                    return typeName.includes('พัดลม') || typeName.toLowerCase().includes('fan');
                case 'floor_1_2':
                    return floorNum === 1 || floorNum === 2;
                case 'floor_3_4':
                    return floorNum === 3 || floorNum === 4;
                case 'all':
                default:
                    return true;
            }
        });
    }, [rooms, activeFilter]);

    const handleOpenModal = (room: any) => {
        setSelectedRoom(room);
        setAppointmentDate('');
        setSelectedFile(null);
        setPreviewUrl(null);
        setIsModalOpen(true);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            showAlert('error', 'ไฟล์มีขนาดใหญ่เกินไป', 'กรุณาอัปโหลดรูปภาพขนาดไม่เกิน 5MB');
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }

        setSelectedFile(file);
        setPreviewUrl(URL.createObjectURL(file));
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text).then(() => {
            alert('คัดลอกเลขบัญชีแล้ว: ' + text);
        });
    };

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selected = e.target.value;

        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);

        const selectedDate = new Date(selected);
        selectedDate.setHours(0, 0, 0, 0);

        if (selectedDate < tomorrow) {
            showAlert('error', 'วันที่ไม่ถูกต้อง', 'ไม่สามารถนัดหมายในวันปัจจุบันหรือย้อนหลังได้ กรุณาเลือกวันพรุ่งนี้เป็นต้นไป');
            setAppointmentDate('');
            return;
        }

        if (unavailableDates.includes(selected)) {
            showAlert('error', 'วันที่ไม่ว่าง', 'วันนัดหมายนี้ไม่เปิดให้บริการ กรุณาเลือกวันอื่น');
            setAppointmentDate('');
            return;
        }
        setAppointmentDate(selected);
    };

    const handleSubmitBooking = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!appointmentDate || !selectedFile) {
            showAlert('error', 'ข้อมูลไม่ครบ', 'กรุณาระบุวันที่นัดหมาย และอัปโหลดสลิปมัดจำ');
            return;
        }

        if (unavailableDates.includes(appointmentDate)) {
            showAlert('error', 'วันที่ไม่ว่าง', 'วันนัดหมายนี้ไม่เปิดให้บริการ กรุณาเลือกวันอื่น');
            return;
        }

        if (!isLoggedIn && (!firstName || !lastName || !phoneNumber || !email || !password)) {
            showAlert('error', 'ข้อมูลไม่ครบ', 'กรุณากรอกข้อมูลส่วนตัวให้ครบถ้วน');
            return;
        }

        showConfirm(
            'ยืนยันการจองคิวดูห้อง',
            `คุณได้อ่านข้อตกลงและต้องการยืนยันการโอนมัดจำ (${bookingDepositAmount} บาท) ใช่หรือไม่?`,
            async () => {
                try {
                    setIsSubmitting(true);

                    let currentUserUid = userUid;
                    let currentUserId = userId;

                    // 1. If guest, Sign Up and create user profile
                    if (!isLoggedIn) {
                        const { data: authData, error: signUpError } = await supabase.auth.signUp({
                            email,
                            password,
                            options: {
                                data: {
                                    first_name: firstName,
                                    last_name: lastName,
                                    role: 'tenant'
                                }
                            }
                        });

                        if (signUpError) throw signUpError;

                        currentUserUid = authData.user?.id || null;

                        if (currentUserUid) {
                            const { data: newUser, error: insertUserError } = await supabase
                                .from('users')
                                .insert([{
                                    user_uid: currentUserUid,
                                    email: email,
                                    first_name: firstName,
                                    last_name: lastName,
                                    phone_number: phoneNumber,
                                    role: 'tenant'
                                }])
                                .select('user_id')
                                .single();

                            if (insertUserError) throw insertUserError;
                            currentUserId = newUser.user_id;
                        }
                    }

                    // 2. Upload Slip
                    let slipImageUrl = '';
                    if (selectedFile && currentUserUid) {
                        const fileExt = selectedFile.name.split('.').pop();
                        const fileName = `booking_${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
                        const filePath = `${currentUserUid}/${fileName}`;

                        const { error: uploadError } = await supabase.storage
                            .from('slips')
                            .upload(filePath, selectedFile);

                        if (uploadError) throw uploadError;

                        const { data: publicUrlData } = supabase.storage
                            .from('slips')
                            .getPublicUrl(filePath);

                        slipImageUrl = publicUrlData.publicUrl;
                    }

                    // 3. Insert Room Booking
                    const { error: insertBookingError } = await supabase
                        .from('room_bookings')
                        .insert([{
                            room_id: selectedRoom.room_id,
                            user_id: currentUserId,
                            user_uid: currentUserUid,
                            appointment_date: appointmentDate,
                            slip_image: slipImageUrl,
                            status: 'pending'
                        }]);

                    if (insertBookingError) throw insertBookingError;

                    showAlert('success', 'สำเร็จ!', 'ระบบได้รับข้อมูลการจองของคุณแล้ว กำลังพาท่านไปยังหน้าติดตามสถานะ');
                    setIsModalOpen(false);

                    router.push('/tenant');

                } catch (err: any) {
                    console.error('Booking error:', err);
                    showAlert('error', 'เกิดข้อผิดพลาด', err.message || 'ไม่สามารถทำรายการได้');
                } finally {
                    setIsSubmitting(false);
                }
            }
        );
    };

    // Calculate min/max dates
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const minDateStr = tomorrow.toISOString().split('T')[0];

    const maxDate = new Date(today);
    maxDate.setDate(today.getDate() + maxBookingDays);
    const maxDateStr = maxDate.toISOString().split('T')[0];

    // Selected room image for modal
    const selectedRoomImage = useMemo(() => {
        if (!selectedRoom) return DEFAULT_ROOM_IMAGE;
        if (Array.isArray(selectedRoom.image_urls) && selectedRoom.image_urls.length > 0) {
            return selectedRoom.image_urls[0];
        }
        if (Array.isArray(selectedRoom.room_types?.image_urls) && selectedRoom.room_types.image_urls.length > 0) {
            return selectedRoom.room_types.image_urls[0];
        }
        return DEFAULT_ROOM_IMAGE;
    }, [selectedRoom]);

    return (
        <div className="min-h-screen bg-slate-50 font-sans pb-20">
            {/* Navbar Public */}
            <header className="bg-white border-b border-slate-200/60 sticky top-0 z-20 shadow-sm">
                <div className="max-w-6xl mx-auto px-4 py-2.5 sm:px-6 h-16 flex justify-between items-center gap-2">
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0">
                            <span className="text-white font-black text-lg sm:text-xl leading-none tracking-tighter">SD</span>
                        </div>
                        <div className="min-w-0">
                            <h1 className="text-base sm:text-xl font-black text-slate-800 tracking-tight truncate">{dormName}</h1>
                            {phone && <p className="text-[10px] font-bold text-slate-500 uppercase truncate">โทร. {phone}</p>}
                        </div>
                    </div>
                    <div className="shrink-0">
                        {!isLoggedIn ? (
                            <Link href="/login" className="px-3 sm:px-5 py-2 sm:py-2.5 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-800 font-bold rounded-xl transition-colors shadow-sm active:scale-95 text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2 border border-blue-100">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><polyline points="10 17 15 12 10 7" /><line x1="15" y1="12" x2="3" y2="12" /></svg>
                                <span>เข้าสู่ระบบ</span>
                                <span className="hidden sm:inline">(ผู้เช่า/ผู้ดูแล)</span>
                            </Link>
                        ) : (
                            <Link href={userUid ? "/tenant" : "/admin"} className="px-3 sm:px-5 py-2 sm:py-2.5 bg-slate-100 text-slate-700 hover:bg-slate-200 font-bold rounded-xl transition-colors shadow-sm active:scale-95 text-xs sm:text-sm border border-slate-200 flex items-center gap-1.5 sm:gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>
                                <span className="sm:hidden">แดชบอร์ด</span>
                                <span className="hidden sm:inline">ไปยังหน้า Dashboard ของคุณ</span>
                            </Link>
                        )}
                    </div>
                </div>
            </header>

            {/* Hero Section */}
            <div className="bg-white border-b border-slate-200/60 py-4 sm:py-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-[280px] sm:w-[500px] h-[280px] sm:h-[500px] bg-gradient-to-bl from-blue-50 to-transparent rounded-full opacity-60 -translate-y-1/2 translate-x-1/3 blur-3xl pointer-events-none"></div>
                <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10 text-center">
                    <h2 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight mb-1 sm:mb-2">ค้นหาและจองห้องพัก</h2>
                    <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
                        เลือกดูห้องพักที่ว่างและทำการนัดหมายเพื่อเข้ามาดูห้องจริง สะดวก รวดเร็ว พร้อมเข้าอยู่ได้ทันที
                    </p>
                </div>
            </div>

            <main className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
                {/* แถบตัวกรองห้องพัก (Filter Pills) */}
                {!loading && rooms.length > 0 && (
                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar whitespace-nowrap px-4 py-1.5 sm:justify-center mb-6 sm:mb-10 -mx-4 sm:mx-0">
                        {filterOptions.map(option => {
                            const isActive = activeFilter === option.value;
                            const count = option.value === 'all'
                                ? rooms.length
                                : rooms.filter(r => {
                                    const tName = r.room_types?.name || '';
                                    const fNum = Number(r.floor);
                                    if (option.value === 'air') return tName.includes('แอร์') || tName.toLowerCase().includes('air');
                                    if (option.value === 'fan') return tName.includes('พัดลม') || tName.toLowerCase().includes('fan');
                                    if (option.value === 'floor_1_2') return fNum === 1 || fNum === 2;
                                    if (option.value === 'floor_3_4') return fNum === 3 || fNum === 4;
                                    return true;
                                }).length;

                            return (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => setActiveFilter(option.value)}
                                    className={`shrink-0 px-4 sm:px-5 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 sm:gap-2 active:scale-95 cursor-pointer select-none ${
                                        isActive
                                            ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 scale-[1.02] sm:scale-105'
                                            : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200/80 shadow-sm hover:border-slate-300'
                                    }`}
                                >
                                    <span>{option.label}</span>
                                    <span className={`px-2 py-0.5 rounded-full text-[11px] sm:text-xs font-semibold ${
                                        isActive ? 'bg-blue-700/60 text-white' : 'bg-slate-100 text-slate-500'
                                    }`}>
                                        {count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                )}

                {loading ? (
                    <div className="flex flex-col justify-center items-center py-20">
                        <div className="w-12 h-12 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin"></div>
                        <p className="mt-4 text-slate-500 font-medium">กำลังค้นหาห้องว่าง...</p>
                    </div>
                ) : rooms.length === 0 ? (
                    <div className="bg-white p-12 rounded-[2rem] text-center border border-slate-200/60 shadow-sm max-w-2xl mx-auto my-10">
                        <div className="text-5xl mb-4">🏢</div>
                        <h3 className="text-xl font-bold text-slate-800 mb-2">ขออภัย ไม่มีห้องว่างในขณะนี้</h3>
                        <p className="text-slate-500">กรุณากลับมาตรวจสอบใหม่ในภายหลัง หรือติดต่อผู้ดูแลระบบ</p>
                    </div>
                ) : filteredRooms.length === 0 ? (
                    <div className="bg-white p-12 rounded-[2rem] text-center border border-slate-200/60 shadow-sm max-w-xl mx-auto my-8">
                        <div className="text-5xl mb-4">🔍</div>
                        <h3 className="text-xl font-bold text-slate-800 mb-2">ไม่พบห้องพักที่ตรงกับตัวกรองนี้</h3>
                        <p className="text-slate-500 text-sm mb-5">ลองเปลี่ยนตัวกรอง หรือเลือกดูห้องพักทั้งหมด</p>
                        <button
                            onClick={() => setActiveFilter('all')}
                            className="px-5 py-2.5 bg-blue-50 text-blue-600 hover:bg-blue-100 font-bold rounded-xl text-sm transition-colors"
                        >
                            ดูห้องพักทั้งหมด ({rooms.length} ห้อง)
                        </button>
                    </div>
                ) : (
                    /* ดีไซน์การ์ดห้องพัก (Modern Room Cards) 2 คอลัมน์บนจอคอมพิวเตอร์ และ 1 คอลัมน์บนจอมือถือ */
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
                        {filteredRooms.map((room) => (
                            <RoomCard
                                key={room.room_id}
                                room={room}
                                waterRate={waterRate}
                                electricRate={electricRate}
                                onOpenModal={handleOpenModal}
                            />
                        ))}
                    </div>
                )}
            </main>

            {/* Booking Modal */}
            {isModalOpen && selectedRoom && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl my-auto flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
                        <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white/95 backdrop-blur z-10 rounded-t-[2rem]">
                            <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                                <span>🚪</span> นัดหมายดูห้อง <span className="text-blue-600">{selectedRoom.room_number}</span>
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-full transition-colors active:scale-95">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto custom-scrollbar">
                            {/* Room Quick Summary in Modal */}
                            <div className="flex items-center gap-4 p-3.5 bg-slate-50 rounded-2xl border border-slate-200 mb-6">
                                <img
                                    src={selectedRoomImage}
                                    alt={`ห้อง ${selectedRoom.room_number}`}
                                    className="w-16 h-16 rounded-xl object-cover border border-slate-200 shadow-sm shrink-0"
                                />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-lg font-black text-slate-800 truncate">ห้อง {selectedRoom.room_number}</h4>
                                        <span className="font-black text-blue-600 text-lg">{Number(selectedRoom.price_per_month).toLocaleString()} ฿/ด.</span>
                                    </div>
                                    <p className="text-xs text-slate-500 font-medium truncate mt-0.5">
                                        ชั้น {selectedRoom.floor} • {selectedRoom.room_types?.name || 'ห้องมาตรฐาน'}
                                    </p>
                                </div>
                            </div>

                            <form id="booking-form" onSubmit={handleSubmitBooking} className="space-y-8">
                                {/* Info Box with Rules */}
                                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-sm space-y-3">
                                    <div className="flex gap-3">
                                        <div className="text-xl">ℹ️</div>
                                        <div className="text-amber-800 font-medium">
                                            <p>กรุณากรอกข้อมูลและโอนเงินมัดจำจำนวน <strong className="text-amber-900 font-black text-base">{bookingDepositAmount} บาท</strong> เพื่อล็อคคิว</p>
                                        </div>
                                    </div>
                                    <div className="bg-white/60 rounded-xl p-3 text-amber-900/90 space-y-2 ml-8 text-xs">
                                        <p>• หากยกเลิก <span className="text-rose-600 font-semibold">ขอสงวนสิทธิ์ไม่คืนเงินมัดจำ</span></p>
                                        <p>• หากท่านมาตามนัดและไม่ทำสัญญา <span className="text-emerald-600 font-semibold">จะได้รับเงินคืนเต็มจำนวน</span></p>
                                        <p>• หากตกลงทำสัญญา <span className="font-semibold text-slate-800">จะนำไปหักเป็นค่าแรกเข้า</span></p>
                                        <p>• หากไม่มาตามนัด <span className="text-rose-600 font-bold underline">ขอสงวนสิทธิ์ไม่คืนเงินทุกกรณี</span></p>
                                    </div>
                                </div>

                                {/* Guest Registration Form (if not logged in) */}
                                {!isLoggedIn && (
                                    <div className="space-y-4">
                                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-2 gap-2">
                                            <h4 className="font-black text-slate-800 text-lg">1. ข้อมูลผู้ติดต่อ (สร้างบัญชีใหม่)</h4>
                                            <Link href={`/login?redirect=/book-room&roomId=${selectedRoom.room_id}`} className="text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors shrink-0 flex items-center justify-center">
                                                มีบัญชีอยู่แล้ว? เข้าสู่ระบบ
                                            </Link>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">ชื่อจริง <span className="text-rose-500">*</span></label>
                                                <input type="text" required value={firstName} onChange={e => setFirstName(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/50 outline-none transition-all" placeholder="ชื่อ" />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">นามสกุล <span className="text-rose-500">*</span></label>
                                                <input type="text" required value={lastName} onChange={e => setLastName(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/50 outline-none transition-all" placeholder="นามสกุล" />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">เบอร์โทรศัพท์ <span className="text-rose-500">*</span></label>
                                                <input type="tel" required value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/50 outline-none transition-all" placeholder="08xxxxxxxx" />
                                            </div>
                                            <div className="space-y-1.5 sm:col-span-2">
                                                <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">อีเมล <span className="text-rose-500">*</span></label>
                                                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/50 outline-none transition-all" placeholder="email@example.com" />
                                            </div>
                                            <div className="space-y-1.5 sm:col-span-2">
                                                <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">ตั้งรหัสผ่าน <span className="text-rose-500">*</span></label>
                                                <input type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/50 outline-none transition-all" placeholder="รหัสผ่านอย่างน้อย 6 ตัวอักษร" />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Always display user info if logged in */}
                                {isLoggedIn && (
                                    <div className="space-y-4">
                                        <h4 className="font-black text-slate-800 text-lg border-b border-slate-100 pb-2">1. ข้อมูลผู้ติดต่อ (คุณ)</h4>
                                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row gap-4 sm:items-center">
                                            <div className="w-12 h-12 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold text-xl uppercase">
                                                {firstName ? firstName.charAt(0) : 'U'}
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-800">{firstName} {lastName}</p>
                                                <p className="text-sm text-slate-500">{phoneNumber || 'ไม่ได้ระบุเบอร์โทรศัพท์'}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Step 2: Date */}
                                <div className="space-y-4">
                                    <h4 className="font-black text-slate-800 text-lg border-b border-slate-100 pb-2">2. เลือกวันนัดหมาย</h4>
                                    <input
                                        type="date"
                                        required
                                        value={appointmentDate}
                                        onChange={handleDateChange}
                                        min={minDateStr}
                                        max={maxDateStr}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-medium text-slate-700 focus:ring-2 focus:ring-blue-500/50 outline-none transition-all cursor-pointer"
                                    />
                                    {unavailableDates.length > 0 && (
                                        <p className="text-xs text-rose-500 font-medium">*ไม่สามารถเลือกวันเหล่านี้ได้: {unavailableDates.join(', ')}</p>
                                    )}
                                </div>

                                {/* Step 3: Payment */}
                                <div className="space-y-4">
                                    <h4 className="font-black text-slate-800 text-lg border-b border-slate-100 pb-2">3. สแกนชำระเงินมัดจำ {bookingDepositAmount} บาท</h4>

                                    <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-stretch">
                                        <div className="w-48 h-48 bg-white border-2 border-slate-200 rounded-2xl flex flex-col items-center justify-center p-2 shadow-sm shrink-0">
                                            {promptpayId ? (
                                                <div className="flex flex-col items-center justify-center w-full h-full p-2">
                                                    <QRCodeSVG
                                                        value={generatePayload(promptpayId, { amount: Number(bookingDepositAmount) })}
                                                        size={140}
                                                        level="M"
                                                        includeMargin={true}
                                                    />
                                                    <p className="mt-2 text-[10px] text-slate-500 text-center font-medium leading-tight">
                                                        สแกนผ่านแอปธนาคาร ยอด {bookingDepositAmount} ฿
                                                    </p>
                                                </div>
                                            ) : (
                                                <img
                                                    src={`https://promptpay.io/${bankAccountNo || '0000000000'}/${bookingDepositAmount}.png`}
                                                    alt="PromptPay QR"
                                                    className="w-full h-full object-contain"
                                                    onError={(e) => {
                                                        (e.target as HTMLImageElement).src = "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d0/QR_code_for_mobile_English_Wikipedia.svg/1200px-QR_code_for_mobile_English_Wikipedia.svg.png";
                                                        (e.target as HTMLImageElement).className = "w-full h-full object-contain opacity-20";
                                                    }}
                                                />
                                            )}
                                        </div>

                                        <div className="flex-1 space-y-4 w-full">
                                            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
                                                <div>
                                                    <p className="text-xs font-bold text-slate-500 uppercase">ธนาคาร</p>
                                                    <p className="font-medium text-slate-800">{bankName || '-'}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold text-slate-500 uppercase flex items-center justify-between">
                                                        เลขบัญชี
                                                        {bankAccountNo && (
                                                            <button type="button" onClick={() => copyToClipboard(bankAccountNo)} className="text-blue-600 hover:text-blue-800 cursor-pointer px-2 py-0.5 bg-blue-100 rounded text-[10px]">คัดลอก</button>
                                                        )}
                                                    </p>
                                                    <p className="font-black text-slate-800 text-lg tracking-wider">{bankAccountNo || '-'}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold text-slate-500 uppercase">ชื่อบัญชี</p>
                                                    <p className="font-medium text-slate-800">{bankAccountName || '-'}</p>
                                                </div>
                                            </div>

                                            {/* Uploader */}
                                            {previewUrl ? (
                                                <div className="relative border border-slate-200 rounded-xl overflow-hidden group w-full h-32">
                                                    <img src={previewUrl} alt="Slip" className="w-full h-full object-cover" />
                                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                        <button type="button" onClick={() => { setSelectedFile(null); setPreviewUrl(null); }} className="px-4 py-2 bg-rose-500 text-white font-bold rounded-lg text-sm">ลบรูปภาพ</button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-blue-300 rounded-xl bg-blue-50 hover:bg-blue-100 transition-colors cursor-pointer text-blue-600 active:scale-[0.98]">
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mb-2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                                                    <span className="font-bold text-sm">อัปโหลดสลิปเงินโอน</span>
                                                    <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={handleFileChange} required />
                                                </label>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </form>
                        </div>

                        <div className="p-5 border-t border-slate-100 bg-slate-50/50 sticky bottom-0 z-10 flex flex-col-reverse sm:flex-row gap-3 rounded-b-[2rem]">
                            <button
                                type="button"
                                onClick={() => setIsModalOpen(false)}
                                disabled={isSubmitting}
                                className="w-full sm:w-auto px-6 py-3.5 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-colors active:scale-95 disabled:opacity-50"
                            >
                                ยกเลิก
                            </button>
                            <button
                                type="submit"
                                form="booking-form"
                                disabled={isSubmitting}
                                className="w-full sm:flex-1 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                            >
                                {isSubmitting ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        กำลังดำเนินการ...
                                    </>
                                ) : (
                                    <>
                                        ยืนยันการนัดหมาย
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
