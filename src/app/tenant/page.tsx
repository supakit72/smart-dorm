"use client";

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/backend/lib/supabase';
import InvoiceDocument from '@/components/InvoiceDocument';

const getMeterCycle = (issueDateStr: string, meterDay: number) => {
    if (!issueDateStr || !meterDay) return '';
    const [yStr, mStr, dStr] = issueDateStr.split('-');
    if (!mStr || !yStr || !dStr) return '';
    const m = parseInt(mStr, 10);
    const y = parseInt(yStr, 10);
    
    const currentMonthDate = new Date(y, m - 1, meterDay);
    const previousMonthDate = new Date(y, m - 2, meterDay);
    
    const thaiMonths = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
    
    const formatThaiDate = (date: Date) => {
        const dd = date.getDate();
        const mm = thaiMonths[date.getMonth()];
        const yy = (date.getFullYear() + 543).toString().slice(-2);
        return `${dd} ${mm} ${yy}`;
    };
    
    return `${formatThaiDate(previousMonthDate)} - ${formatThaiDate(currentMonthDate)}`;
};

export default function TenantDashboard() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [invoice, setInvoice] = useState<any | null>(null);
    const [invoiceHistory, setInvoiceHistory] = useState<any[]>([]);
    const [userUid, setUserUid] = useState<string | null>(null);
    const [dormSettings, setDormSettings] = useState<any>(null);
    const [isPaying, setIsPaying] = useState(false);
    const [expandedHistory, setExpandedHistory] = useState<number | null>(null);
    const [selectedReceipt, setSelectedReceipt] = useState<any | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isFullInvoiceModalOpen, setIsFullInvoiceModalOpen] = useState(false);
    const [fullInvoiceData, setFullInvoiceData] = useState<any | null>(null);
    const [hasRoom, setHasRoom] = useState<boolean>(true);
    const [activeBooking, setActiveBooking] = useState<any | null>(null);
    const [userName, setUserName] = useState<string>('');
    const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
    const [cancelCountdown, setCancelCountdown] = useState(5);

    // อ้างอิงถึง input file ที่ซ่อนไว้
    const fileInputRef = useRef<HTMLInputElement>(null);

    const fetchLatestInvoice = async (uid: string, showLoading = true) => {
        try {
            if (showLoading) setLoading(true);
            setError(null);

            // 1. หา UUID (user_id) ในตาราง users
            const { data: userRecord, error: userError } = await supabase
                .from('users')
                .select('user_id')
                .eq('user_uid', uid)
                .single();

            if (userError || !userRecord) throw new Error('ไม่พบข้อมูลผู้ใช้งาน');

            // 2. หาสัญญาเช่าปัจจุบัน และ Join ข้อมูลห้อง
            const { data: contract, error: contractError } = await supabase
                .from('contracts')
                .select(`
                    contracts_id, 
                    room_id,
                    rooms ( room_number, price_per_month )
                `)
                .eq('tenant_id', userRecord.user_id)
                .eq('is_active', true)
                .single();

            if (contractError && contractError.code !== 'PGRST116') {
                throw contractError;
            }

            if (!contract) {
                // ไม่มีสัญญาเช่า
                setHasRoom(false);
                setInvoice(null);
                
                // Fetch active booking instead
                const { data: bookingData } = await supabase
                    .from('room_bookings')
                    .select('*, rooms(room_number)')
                    .eq('user_id', userRecord.user_id)
                    .in('status', ['pending', 'confirmed'])
                    .limit(1)
                    .single();
                    
                if (bookingData) {
                    setActiveBooking(bookingData);
                } else {
                    setActiveBooking(null);
                }
                
                return;
            } else {
                setHasRoom(true);
                setActiveBooking(null);
            }

            // 3. หาบิลทั้งหมดจากตาราง invoices โดยตรง (ตัดบิลร่างทิ้ง) เรียงจากใหม่ไปเก่า
            const { data: invoicesData, error: fetchError } = await supabase
                .from('invoices')
                .select('*')
                .eq('contract_id', contract.contracts_id)
                .neq('status', 'draft')
                .order('invoices_id', { ascending: false });

            if (fetchError && fetchError.code !== 'PGRST116') {
                throw fetchError;
            }

            if (invoicesData && invoicesData.length > 0) {
                // ดึงข้อมูลห้องจาก object ที่ Join มาได้
                const roomData = Array.isArray(contract.rooms) ? contract.rooms[0] : contract.rooms;

                const historyWithCalc = invoicesData.map(inv => {
                    // คำนวณยอดเงินตามสูตร: ค่าเช่าห้อง + (ค่าน้ำ) + (ค่าไฟ) + vat + rounding
                    const rent = Number(roomData?.price_per_month || 0);
                    const water = Number(inv.water_unit || 0) * Number(inv.water_rate || 0);
                    const electric = Number(inv.electric_unit || 0) * Number(inv.electric_rate || 0);
                    const total = rent + water + electric + Number(inv.vat_amount || 0) + Number(inv.rounding_amount || 0);

                    return {
                        ...inv,
                        room_number: roomData?.room_number,
                        room_rent: rent,
                        calculatedRent: rent,
                        calculatedWater: water,
                        calculatedElectric: electric,
                        calculatedTotal: Number(inv.total_amount || total)
                    };
                });

                setInvoiceHistory(historyWithCalc);
                setInvoice(historyWithCalc[0]); // ใบแรกคือใบล่าสุด
            } else {
                setInvoiceHistory([]);
                setInvoice(null);
            }

        } catch (err: any) {
            console.error("Fetch Data Error:", err);
            setError(err.message || 'เกิดข้อผิดพลาดในการดึงข้อมูลบิลรายเดือน');
        } finally {
            if (showLoading) setLoading(false);
        }
    };

    const router = useRouter();

    useEffect(() => {
        const checkAuth = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                router.push('/login');
                return;
            }

            const { data: userData } = await supabase
                .from('users')
                .select('role, first_name, last_name')
                .eq('user_uid', session.user.id)
                .single();

            if (!userData || userData.role !== 'tenant') {
                router.push('/login');
                return;
            }

            setUserName(`${userData.first_name || ''} ${userData.last_name || ''}`.trim());

            const { data: settings } = await supabase
                .from('dorm_settings')
                .select('*')
                .limit(1)
                .single();
            
            if (settings) {
                setDormSettings(settings);
            }

            setUserUid(session.user.id);
            fetchLatestInvoice(session.user.id);
        };

        checkAuth();
    }, []);

    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (isCancelModalOpen && cancelCountdown > 0) {
            timer = setTimeout(() => {
                setCancelCountdown(prev => prev - 1);
            }, 1000);
        }
        return () => clearTimeout(timer);
    }, [isCancelModalOpen, cancelCountdown]);

    const openCancelModal = () => {
        setCancelCountdown(5);
        setIsCancelModalOpen(true);
    };

    const handleCancelBooking = async (bookingId: number, roomId: number) => {

        try {
            // Update booking status
            const { error: bookingError } = await supabase
                .from('room_bookings')
                .update({ status: 'cancelled' })
                .eq('id', bookingId);
                
            if (bookingError) throw bookingError;

            // Update room status back to vacant
            const { error: roomError } = await supabase
                .from('rooms')
                .update({ status: 'vacant' })
                .eq('room_id', roomId);
                
            if (roomError) throw roomError;

            alert('ยกเลิกการนัดหมายสำเร็จ');
            setIsCancelModalOpen(false);
            
            // Refresh data
            if (userUid) {
                fetchLatestInvoice(userUid);
            }
        } catch (error: any) {
            console.error('Cancel booking error:', error);
            alert('เกิดข้อผิดพลาดในการยกเลิกการนัดหมาย: ' + error.message);
        }
    };

    const handleLogout = async () => {
        try {
            const { error } = await supabase.auth.signOut();
            if (error) throw error;
            router.push('/login');
        } catch (err: any) {
            console.error("Logout Error:", err);
            alert("ไม่สามารถออกจากระบบได้: " + err.message);
        }
    };

    // ฟังก์ชันเปิดหน้าต่างเลือกไฟล์
    const handleTriggerUpload = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    // ฟังก์ชันจัดการเมื่อผู้ใช้เลือกไฟล์แล้ว
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setSelectedFile(file);
        const url = URL.createObjectURL(file);
        setPreviewUrl(url);
    };

    const handleConfirmUpload = async () => {
        if (!selectedFile || !invoice || !invoice.invoices_id) return;

        try {
            setIsPaying(true);

            // 1. สร้างชื่อไฟล์ใหม่เพื่อป้องกันการซ้ำกัน
            const fileExt = selectedFile.name.split('.').pop();
            const fileName = `slip_${invoice.invoices_id}_${Date.now()}.${fileExt}`;
            const filePath = `${fileName}`;

            // 2. อัปโหลดไฟล์ไปที่ Supabase Storage bucket 'slips'
            const { error: uploadError } = await supabase.storage
                .from('slips')
                .upload(filePath, selectedFile, {
                    cacheControl: '3600',
                    upsert: false // ไม่อนุญาตให้ทับไฟล์เดิม
                });

            if (uploadError) {
                throw new Error(`อัปโหลดไฟล์ไม่สำเร็จ: ${uploadError.message}`);
            }

            // 3. ขอ Public URL ของไฟล์ที่เพิ่งอัปโหลด
            const { data: publicUrlData } = supabase.storage
                .from('slips')
                .getPublicUrl(filePath);

            const publicUrl = publicUrlData.publicUrl;

            // 4. อัปเดตข้อมูลในตาราง invoices เซ็ตค่า status เปลี่ยนเป็น pending (รอตรวจสอบ)
            const { error: updateError } = await supabase
                .from('invoices')
                .update({
                    status: 'pending',
                    slip_image: publicUrl
                })
                .eq('invoices_id', invoice.invoices_id);

            if (updateError) {
                throw new Error(`บันทึกข้อมูลไม่สำเร็จ: ${updateError.message}`);
            }

            // 5. เมื่อทุกอย่างสำเร็จ ให้ดึงข้อมูลมาแสดงใหม่ซ้ำ เพื่ออัปเดต UI 
            if (userUid) { await fetchLatestInvoice(userUid, false); }

            alert('ส่งสลิปชำระเงินเรียบร้อยแล้ว!\nระบบจะทำการอัปเดตสถานะทันทีเมื่อผู้ดูแลตรวจสอบสำเร็จ');

            // เคลียร์ค่า input file
            setSelectedFile(null);
            setPreviewUrl(null);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }

        } catch (err: any) {
            console.error("Payment Form Error:", err);
            alert("เกิดข้อผิดพลาดในการทำรายการ: \n" + (err.message || "กรุณาลองใหม่อีกครั้ง"));
        } finally {
            setIsPaying(false);
        }
    };

    const handleCancelUpload = () => {
        setSelectedFile(null);
        setPreviewUrl(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // Loading State
    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center font-sans text-slate-900">
                <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mb-4"></div>
                <h2 className="text-lg font-bold text-slate-700 tracking-tight">กำลังโหลดข้อมูลห้องพัก...</h2>
            </div>
        );
    }

    // Error State
    if (error) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans px-4">
                <div className="bg-white border border-red-100 rounded-3xl p-8 max-w-sm w-full text-center shadow-lg shadow-red-100/30">
                    <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">⚠️</div>
                    <h2 className="text-xl font-bold text-slate-800 mb-2">เกิดข้อผิดพลาด</h2>
                    <p className="text-sm text-slate-600 mb-6 font-mono text-left break-words bg-slate-50 p-3 rounded-xl border border-slate-100">{error}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium py-3 rounded-xl transition-all shadow-md active:scale-95"
                    >
                        ลองใหม่
                    </button>
                </div>
            </div>
        );
    }

    // กำหนดสีและป้ายสถานะ
    let statusBadge = null;
    let actionButton = null;

    const isPaid = invoice && (invoice.status === 'paid' || invoice.status === 'ชำระแล้ว');
    const isReviewing = invoice && !isPaid && invoice.slip_image && (invoice.status === 'pending' || invoice.status === 'รอตรวจสอบ');
    const isRejected = invoice && !isPaid && invoice.status === 'rejected';
    const isPending = invoice && !isPaid && !isReviewing && !isRejected && (invoice.status === 'unpaid' || invoice.status === 'รอชำระ' || invoice.status === 'pending');

    if (isPending) {
        statusBadge = (
            <span className="inline-flex items-center px-3 py-1.5 rounded-xl bg-rose-50 text-rose-600 font-bold text-xs border border-rose-100 shadow-sm uppercase tracking-wider">
                รอชำระเงิน
            </span>
        );
    } else if (isRejected) {
        statusBadge = (
            <span className="inline-flex items-center px-3 py-1.5 rounded-xl bg-orange-50 text-orange-600 font-bold text-xs border border-orange-100 shadow-sm uppercase tracking-wider animate-pulse">
                สลิปไม่ถูกต้อง (ส่งใหม่)
            </span>
        );
    }

    if (isPending || isRejected) {
        actionButton = (
            <div className="space-y-4">
                <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                />
                
                {selectedFile && previewUrl ? (
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col items-center gap-3 animate-in fade-in zoom-in-95 shadow-inner">
                        <div className="relative rounded-xl overflow-hidden mb-1 border border-slate-200 bg-white w-full flex justify-center">
                            <img src={previewUrl} alt="Slip Preview" className="max-h-48 object-contain rounded-lg" />
                            <button onClick={handleCancelUpload} className="absolute top-2 right-2 w-8 h-8 bg-black/60 hover:bg-black/80 text-white rounded-full flex items-center justify-center backdrop-blur-md transition-colors shadow-sm">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>
                        <p className="text-xs text-slate-500 font-medium truncate max-w-full px-2">{selectedFile.name}</p>
                        
                        <button
                            onClick={handleConfirmUpload}
                            disabled={isPaying}
                            className={`w-full font-bold py-3.5 px-4 rounded-xl transition-all shadow-md flex justify-center items-center gap-2 active:scale-[0.98] ${isPaying ? 'bg-blue-400 cursor-not-allowed text-white shadow-none' : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20'}`}
                        >
                            {isPaying ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    กำลังส่งข้อมูล...
                                </>
                            ) : (
                                <>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" x2="12" y1="3" y2="15" /></svg>
                                    ยืนยันส่งสลิปชำระเงิน
                                </>
                            )}
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={handleTriggerUpload}
                        className="w-full font-bold py-5 px-4 rounded-2xl transition-all shadow-sm bg-blue-50/50 border-2 border-dashed border-blue-200 text-blue-600 hover:bg-blue-50 hover:border-blue-300 flex flex-col justify-center items-center gap-2 active:scale-95 group"
                    >
                        <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm border border-blue-100 text-blue-500 mb-1 group-hover:scale-110 transition-transform">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" x2="12" y1="3" y2="15" /></svg>
                        </div>
                        <span className="text-base">ชำระเงิน / แนบสลิปโอนเงิน</span>
                        <span className="text-xs font-medium text-slate-400">แตะเพื่อถ่ายรูปหรือเลือกสลิปจากคลังภาพ</span>
                    </button>
                )}
            </div>
        );
    } else if (isReviewing) {
        statusBadge = (
            <span className="inline-flex items-center px-3 py-1.5 rounded-xl bg-amber-50 text-amber-600 font-bold text-xs border border-amber-100 shadow-sm uppercase tracking-wider">
                รอตรวจสอบสลิป
            </span>
        );
        actionButton = (
            <div 
                onClick={() => setSelectedReceipt(invoice)}
                className="w-full bg-amber-50 hover:bg-amber-100 transition-colors cursor-pointer text-amber-700 border border-amber-200 font-bold py-4 px-4 rounded-2xl flex justify-center items-center gap-3 active:scale-95 shadow-sm"
            >
                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm text-amber-500">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                </div>
                <div className="flex flex-col items-start">
                    <span>รอผู้ดูแลตรวจสอบสลิป</span>
                    <span className="text-xs font-medium text-amber-600/80">แตะเพื่อดูรายละเอียด</span>
                </div>
            </div>
        );
    } else if (isPaid) {
        statusBadge = (
            <span className="inline-flex items-center px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-600 font-bold text-xs border border-emerald-100 shadow-sm uppercase tracking-wider">
                ชำระเงินเรียบร้อย
            </span>
        );
        actionButton = (
            <div 
                onClick={() => setSelectedReceipt(invoice)}
                className="w-full bg-emerald-50 hover:bg-emerald-100 transition-colors cursor-pointer text-emerald-700 border border-emerald-200 font-bold py-4 px-4 rounded-2xl flex justify-center items-center gap-3 active:scale-95 shadow-sm"
            >
                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm text-emerald-500">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
                </div>
                <div className="flex flex-col items-start">
                    <span>ชำระเงินเรียบร้อยแล้ว</span>
                    <span className="text-xs font-medium text-emerald-600/80">แตะเพื่อดูใบเสร็จรับเงิน</span>
                </div>
            </div>
        );
    } else if (invoice) {
        statusBadge = (
            <span className="inline-flex items-center px-3 py-1.5 rounded-xl bg-slate-100 text-slate-600 font-bold text-xs border border-slate-200 shadow-sm uppercase tracking-wider">
                {invoice.status}
            </span>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-28">
            {/* Header (Tenant Profile & Room Info) */}
            <header className="bg-white border-b border-slate-200/60 sticky top-0 z-20 shadow-sm pt-safe">
                <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-white flex items-center justify-center font-black text-xl shadow-md shadow-emerald-500/30 uppercase">
                            {userName ? userName.charAt(0) : 'T'}
                        </div>
                        <div>
                            <h1 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">ผู้เช่า</h1>
                            <p className="text-base font-black text-slate-800 leading-none">{userName || 'ผู้เช่า'}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleLogout}
                            className="p-2.5 rounded-xl bg-slate-50 text-slate-500 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 transition-colors shadow-sm active:scale-95 flex items-center justify-center"
                            title="ออกจากระบบ"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                        </button>
                    </div>
                </div>
                {hasRoom && activeBooking === null && invoice && (
                    <div className="bg-slate-900 text-white px-4 py-2.5 flex justify-between items-center shadow-inner">
                        <div className="flex items-center gap-2 text-sm">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                            <span className="font-medium text-slate-300">ห้องพักของคุณ</span>
                        </div>
                        <div className="font-black text-emerald-400 tracking-widest text-lg">
                            {invoice.room_number || '-'}
                        </div>
                    </div>
                )}
            </header>

            <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-8">
                {!hasRoom ? (
                    activeBooking ? (
                        <section className="bg-white rounded-[2rem] p-8 md:p-12 shadow-sm border border-slate-200/60 flex flex-col items-center justify-center text-center mt-6 animate-in fade-in zoom-in-95 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-50 to-transparent rounded-bl-full opacity-60 pointer-events-none"></div>
                            
                            <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 border shadow-sm ${activeBooking.status === 'confirmed' ? 'bg-emerald-50 border-emerald-100 text-emerald-500' : 'bg-amber-50 border-amber-100 text-amber-500'}`}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line>
                                </svg>
                            </div>
                            
                            <h2 className="text-2xl font-black text-slate-800 tracking-tight mb-6">ข้อมูลนัดหมายดูห้องพัก</h2>
                            
                            <div className="w-full max-w-sm bg-slate-50 rounded-2xl p-6 border border-slate-100 text-left space-y-4 mb-2">
                                <div>
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">ห้องที่ต้องการนัดดู</span>
                                    <span className="text-lg font-bold text-slate-700">{activeBooking.rooms?.room_number || '-'}</span>
                                </div>
                                <div>
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">วันที่นัดหมาย</span>
                                    <span className="text-lg font-bold text-slate-700">{new Date(activeBooking.appointment_date).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                                </div>
                                <div>
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">ยอดมัดจำ</span>
                                    <span className="text-lg font-bold text-blue-600">{dormSettings?.booking_deposit_amount ? `${dormSettings.booking_deposit_amount} บาท` : '100 บาท'}</span>
                                </div>
                                <div>
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">สลิปที่แนบ</span>
                                    {activeBooking.slip_image ? (
                                        <a href={activeBooking.slip_image} target="_blank" rel="noopener noreferrer" className="block w-full h-32 rounded-xl overflow-hidden border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                                            <img src={activeBooking.slip_image} alt="Slip" className="w-full h-full object-cover" />
                                        </a>
                                    ) : (
                                        <span className="text-sm font-medium text-slate-500">- ไม่มีสลิป -</span>
                                    )}
                                </div>
                                <div>
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">สถานะ</span>
                                    <span className={`inline-flex px-3 py-1.5 rounded-lg text-sm font-bold border ${activeBooking.status === 'confirmed' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-amber-50 text-amber-600 border-amber-200'}`}>
                                        {activeBooking.status === 'confirmed' ? 'ยืนยันแล้ว (เจอกันตามวันนัดหมาย)' : 'รอผู้ดูแลตรวจสอบสลิปมัดจำ'}
                                    </span>
                                </div>
                                <div className="pt-4 border-t border-slate-200 mt-2">
                                    <button
                                        onClick={openCancelModal}
                                        className="w-full py-2.5 px-4 bg-white border border-red-200 text-red-500 font-bold rounded-xl hover:bg-red-50 hover:border-red-300 transition-colors flex items-center justify-center gap-2 text-sm"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
                                        ยกเลิกการนัดหมาย
                                    </button>
                                </div>
                            </div>
                        </section>
                    ) : (
                        <section className="bg-white rounded-[2rem] p-8 md:p-12 shadow-sm border border-slate-200/60 flex flex-col items-center justify-center text-center mt-6 animate-in fade-in zoom-in-95">
                            <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mb-6 border border-blue-100 shadow-sm">
                                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/><circle cx="12" cy="8" r="2"/></svg>
                            </div>
                            <h2 className="text-2xl font-black text-slate-800 tracking-tight mb-3">ยังไม่มีข้อมูลห้องพัก</h2>
                            <p className="text-slate-500 text-base max-w-md mb-8">
                                คุณยังไม่มีข้อมูลห้องพักในระบบ กรุณาติดต่อเจ้าของหอพักเพื่อเพิ่มข้อมูลเข้าห้องพัก และทำสัญญาเช่าให้เรียบร้อย หรือกดค้นหาห้องพักด้านล่าง
                            </p>
                            <Link href="/book-room" className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 px-8 rounded-xl transition-all shadow-md shadow-blue-600/20 active:scale-95 flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                                ค้นหาและจองห้องพัก
                            </Link>
                        </section>
                    )
                ) : (
                    <>
                        {/* Hero Bill (Latest Invoice) */}
                        <section>
                            {invoice ? (
                                <div className="bg-white rounded-[2rem] p-6 sm:p-8 shadow-xl shadow-slate-200/40 border border-slate-100 relative overflow-hidden flex flex-col gap-5">
                                    {/* Decorative background */}
                                    <div className="absolute -top-24 -right-24 w-64 h-64 bg-gradient-to-br from-blue-50 to-emerald-50 rounded-full opacity-60 blur-3xl pointer-events-none"></div>

                                    {/* Header / Month */}
                                    <div className="flex justify-between items-center z-10">
                                        <div>
                                            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">บิลค่าเช่าเดือนล่าสุด</h2>
                                            <p className="text-2xl font-black text-slate-800">{invoice.month_year}</p>
                                        </div>
                                        {statusBadge}
                                    </div>

                                    {/* Big Total */}
                                    <div className="z-10 py-6 border-y border-dashed border-slate-200 flex flex-col items-center justify-center bg-slate-50/50 rounded-2xl">
                                        <p className="text-sm font-bold text-slate-500 mb-2">ยอดรวมสุทธิ (Total Amount)</p>
                                        <div className="flex items-end gap-1.5 text-slate-900">
                                            <span className="text-5xl sm:text-6xl font-black tracking-tighter">{invoice.calculatedTotal.toLocaleString()}</span>
                                            <span className="text-xl font-bold mb-2 text-slate-400">฿</span>
                                        </div>
                                    </div>

                                    {/* Compact Breakdown */}
                                    <div className="z-10 bg-white rounded-2xl px-4 py-3 border border-slate-100 text-sm space-y-2 shadow-sm">
                                        <div className="flex justify-between items-center">
                                            <span className="text-slate-500 font-medium">ค่าเช่าห้อง</span>
                                            <span className="font-bold text-slate-700">{invoice.calculatedRent.toLocaleString()} ฿</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-slate-500 font-medium">ค่าน้ำ ({invoice.water_unit} หน่วย)</span>
                                            <span className="font-bold text-slate-700">{invoice.calculatedWater.toLocaleString()} ฿</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-slate-500 font-medium">ค่าไฟ ({invoice.electric_unit} หน่วย)</span>
                                            <span className="font-bold text-slate-700">{invoice.calculatedElectric.toLocaleString()} ฿</span>
                                        </div>
                                        {invoice.additional_items && Array.isArray(invoice.additional_items) && invoice.additional_items.map((item: any, idx: number) => (
                                            <div key={idx} className="flex justify-between items-center">
                                                <span className="text-slate-500 font-medium">{item.name}</span>
                                                <span className="font-bold text-slate-700">{Number(item.price || 0).toLocaleString()} ฿</span>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Action Block */}
                                    <div className="z-10 mt-2 flex flex-col gap-3">
                                        {actionButton}
                                        <button
                                            onClick={() => {
                                                setFullInvoiceData(invoice);
                                                setIsFullInvoiceModalOpen(true);
                                            }}
                                            className="w-full py-3.5 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold rounded-2xl border border-slate-200 transition-all flex items-center justify-center gap-2 active:scale-95"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>
                                            ดูใบแจ้งหนี้แบบละเอียด
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-white rounded-[2rem] p-10 text-center shadow-sm border border-slate-200/60 border-dashed">
                                    <div className="w-16 h-16 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">📭</div>
                                    <h3 className="text-lg font-bold text-slate-700">ไม่มีบิลค้างชำระ</h3>
                                    <p className="text-slate-500 text-sm mt-1">ยังไม่มีรอบบิลที่ต้องชำระในขณะนี้</p>
                                </div>
                            )}
                        </section>

                        {/* Invoice History Accordion List */}
                        {invoiceHistory.length > 1 && (
                            <section className="mt-8">
                                <h3 className="text-lg font-black text-slate-800 mb-4 flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                                    ประวัติบิลย้อนหลัง
                                </h3>
                                <div className="space-y-3">
                                    {invoiceHistory.slice(1).map((inv, idx) => {
                                        const isExpanded = expandedHistory === idx;
                                        const isPaidPast = inv.status === 'paid' || inv.status === 'ชำระแล้ว';
                                        
                                        return (
                                            <div key={inv.invoices_id || idx} className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden transition-all">
                                                {/* Header / Summary */}
                                                <div 
                                                    onClick={() => setExpandedHistory(isExpanded ? null : idx)}
                                                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors active:bg-slate-100"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-12 h-12 rounded-xl bg-slate-50 flex flex-col items-center justify-center text-slate-500 border border-slate-100 font-medium shrink-0">
                                                            <span className="text-xs font-bold">{inv.month_year ? inv.month_year.split('/')[0] : '-'}</span>
                                                            <span className="text-[10px] font-bold">{inv.month_year ? inv.month_year.split('/')[1] : ''}</span>
                                                        </div>
                                                        <div>
                                                            <p className="font-bold text-slate-800 text-base">{inv.calculatedTotal?.toLocaleString()} ฿</p>
                                                            <div className="flex items-center gap-2 mt-0.5">
                                                                {isPaidPast ? (
                                                                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100 uppercase">ชำระแล้ว</span>
                                                                ) : (
                                                                    <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200 uppercase">{inv.status}</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="text-slate-400">
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${isExpanded ? 'rotate-180 text-blue-500' : ''}`}><polyline points="6 9 12 15 18 9"></polyline></svg>
                                                    </div>
                                                </div>

                                                {/* Expanded Details */}
                                                {isExpanded && (
                                                    <div className="px-4 pb-4 pt-1 bg-slate-50/50 border-t border-slate-100 animate-in slide-in-from-top-2">
                                                        <div className="space-y-2 text-sm mt-3 mb-4">
                                                            <div className="flex justify-between items-center text-slate-600">
                                                                <span>ค่าเช่าห้อง</span>
                                                                <span className="font-medium text-slate-800">{inv.calculatedRent?.toLocaleString()} ฿</span>
                                                            </div>
                                                            <div className="flex justify-between items-center text-slate-600">
                                                                <span>ค่าน้ำประปา ({inv.water_unit} หน่วย)</span>
                                                                <span className="font-medium text-slate-800">{inv.calculatedWater?.toLocaleString()} ฿</span>
                                                            </div>
                                                            <div className="flex justify-between items-center text-slate-600">
                                                                <span>ค่าไฟฟ้า ({inv.electric_unit} หน่วย)</span>
                                                                <span className="font-medium text-slate-800">{inv.calculatedElectric?.toLocaleString()} ฿</span>
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); setSelectedReceipt(inv); }}
                                                                className="flex-1 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-sm font-bold rounded-xl transition-colors active:scale-95 flex items-center justify-center gap-1.5 border border-blue-100"
                                                            >
                                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                                                ดูสลิป
                                                            </button>
                                                            <button 
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setFullInvoiceData(inv);
                                                                    setIsFullInvoiceModalOpen(true);
                                                                }}
                                                                className="flex-1 py-2 bg-white hover:bg-slate-100 text-slate-700 text-sm font-bold rounded-xl transition-colors active:scale-95 flex items-center justify-center gap-1.5 border border-slate-200"
                                                            >
                                                                📄 ใบแจ้งหนี้
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </section>
                        )}

                        {/* Floating Maintenance Banner */}
                        <Link href="/tenant/maintenance" className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 bg-slate-900 text-white px-6 py-3.5 rounded-2xl shadow-2xl shadow-slate-900/30 border border-slate-700 font-bold flex items-center gap-3 active:scale-95 transition-all hover:bg-slate-800 w-[90%] max-w-sm justify-between animate-in slide-in-from-bottom-10">
                            <div className="flex items-center gap-2.5 text-sm">
                                <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-lg">🛠️</div>
                                พบปัญหาในห้องพัก?
                            </div>
                            <span className="text-emerald-400 text-sm flex items-center gap-1">แจ้งซ่อม <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg></span>
                        </Link>
                    </>
                )}
            </main>

            {/* Modal ใบเสร็จและรายละเอียดสลิป */}            {/* Modal ใบเสร็จและรายละเอียดสลิป */}
            {selectedReceipt && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex justify-center items-center p-4 transition-opacity">
                    <div className="bg-white rounded-3xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200 relative">
                        {/* Modal Header */}
                        <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/80">
                            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" x2="8" y1="13" y2="13" /><line x1="16" x2="8" y1="17" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>
                                รายละเอียดใบเสร็จ
                            </h2>
                            <button onClick={() => setSelectedReceipt(null)} className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>
                        
                        {/* Modal Body */}
                        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <p className="text-slate-500 text-sm font-medium">รอบบิล</p>
                                    <p className="font-bold text-slate-800 text-lg">{selectedReceipt.month_year}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-slate-500 text-sm font-medium mb-1">สถานะ</p>
                                    {(selectedReceipt.status === 'paid' || selectedReceipt.status === 'ชำระแล้ว') ? (
                                        <span className="inline-flex items-center px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 font-bold text-sm">
                                            ชำระแล้ว
                                        </span>
                                    ) : (selectedReceipt.status === 'pending' || selectedReceipt.status === 'รอตรวจสอบ') && selectedReceipt.slip_image ? (
                                        <span className="inline-flex items-center px-3 py-1 rounded-full bg-amber-100 text-amber-700 font-bold text-sm">
                                            รอตรวจสอบ
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center px-3 py-1 rounded-full bg-slate-100 text-slate-700 font-bold text-sm">
                                            {selectedReceipt.status}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* รายละเอียดค่าใช้จ่าย */}
                            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 mb-6 space-y-4">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-slate-600">ค่าเช่าห้อง (ห้อง {selectedReceipt.room_number || '-'})</span>
                                    <span className="font-medium text-slate-800">{selectedReceipt.calculatedRent?.toLocaleString() || 0} ฿</span>
                                </div>
                                <div className="flex justify-between items-start text-sm">
                                    <div className="flex flex-col gap-1">
                                        <span className="text-slate-600">ค่าน้ำประปา <span className="text-xs text-slate-500">({getMeterCycle(selectedReceipt.month_year, dormSettings?.meter_reading_day || 20)})</span></span>
                                        <span className="text-xs text-slate-400">
                                            {selectedReceipt.water_meter_previous !== undefined && selectedReceipt.water_meter_current !== undefined 
                                                ? `(มิเตอร์: ${selectedReceipt.water_meter_previous} - ${selectedReceipt.water_meter_current}) ` 
                                                : ''}
                                            {selectedReceipt.water_unit} ยูนิต
                                        </span>
                                    </div>
                                    <span className="font-medium text-slate-800 mt-0.5">{selectedReceipt.calculatedWater?.toLocaleString() || 0} ฿</span>
                                </div>
                                <div className="flex justify-between items-start text-sm">
                                    <div className="flex flex-col gap-1">
                                        <span className="text-slate-600">ค่าไฟฟ้า <span className="text-xs text-slate-500">({getMeterCycle(selectedReceipt.month_year, dormSettings?.meter_reading_day || 20)})</span></span>
                                        <span className="text-xs text-slate-400">
                                            {selectedReceipt.electric_meter_previous !== undefined && selectedReceipt.electric_meter_current !== undefined 
                                                ? `(มิเตอร์: ${selectedReceipt.electric_meter_previous} - ${selectedReceipt.electric_meter_current}) ` 
                                                : ''}
                                            {selectedReceipt.electric_unit} ยูนิต
                                        </span>
                                    </div>
                                    <span className="font-medium text-slate-800 mt-0.5">{selectedReceipt.calculatedElectric?.toLocaleString() || 0} ฿</span>
                                </div>
                                {selectedReceipt.additional_items && Array.isArray(selectedReceipt.additional_items) && selectedReceipt.additional_items.map((item: any, idx: number) => (
                                    <div key={idx} className="flex justify-between items-center text-sm">
                                        <span className="text-slate-600">{item.name}</span>
                                        <span className="font-medium text-slate-800">{Number(item.price || 0).toLocaleString()} ฿</span>
                                    </div>
                                ))}
                                <div className="pt-3 border-t border-slate-200 flex justify-between items-center">
                                    <span className="font-bold text-slate-800">ยอดรวมสุทธิ</span>
                                    <span className="text-xl font-black text-emerald-600">{selectedReceipt.calculatedTotal?.toLocaleString() || 0} ฿</span>
                                </div>
                            </div>

                            {/* รูปภาพสลิปโอนเงิน */}
                            {selectedReceipt.slip_image ? (
                                <div>
                                    <p className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                                        รูปภาพสลิปที่แนบ
                                    </p>
                                    <div className="rounded-2xl border border-slate-200 overflow-hidden bg-slate-50 relative group">
                                        <a href={selectedReceipt.slip_image} target="_blank" rel="noopener noreferrer" className="block outline-none">
                                            <img 
                                                src={selectedReceipt.slip_image} 
                                                alt="Slip" 
                                                className="w-full h-auto object-contain max-h-80 mix-blend-multiply transition-transform duration-300 group-hover:scale-105"
                                                loading="lazy"
                                            />
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                                                <span className="bg-white/90 text-slate-900 px-4 py-2 rounded-full font-medium text-sm flex items-center gap-2 shadow-lg">
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                                    คลิกเพื่อดูรูปเต็ม
                                                </span>
                                            </div>
                                        </a>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-slate-50 rounded-2xl p-6 text-center border border-slate-200 border-dashed">
                                    <div className="w-12 h-12 rounded-full bg-slate-100 flex flex-col items-center justify-center text-slate-400 mx-auto mb-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                                    </div>
                                    <p className="text-sm text-slate-500 font-medium">ไม่มีรูปภาพสลิปแนบไว้</p>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 border-t border-slate-100 bg-slate-50/50">
                            <button onClick={() => setSelectedReceipt(null)} className="w-full py-3.5 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-xl transition-colors shadow-md active:scale-95">
                                ปิดหน้าต่าง
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal ใบแจ้งหนี้แบบละเอียด (Full Invoice View) */}
            {isFullInvoiceModalOpen && fullInvoiceData && (
                <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[9999] flex justify-center items-start overflow-y-auto p-4 transition-opacity custom-scrollbar">
                    <div className="bg-white rounded-3xl w-full max-w-[22cm] my-8 shadow-2xl animate-in fade-in zoom-in-95 duration-200 relative overflow-hidden">
                        {/* Close Button Header */}
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 sticky top-0 z-10">
                            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                📄 ใบแจ้งหนี้แบบละเอียด
                            </h2>
                            <button 
                                onClick={() => {
                                    setIsFullInvoiceModalOpen(false);
                                    setFullInvoiceData(null);
                                }} 
                                className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>
                        
                        {/* Invoice Component */}
                        <div className="p-0 sm:p-4 bg-slate-100">
                            <InvoiceDocument invoice={fullInvoiceData} dormSettings={dormSettings} />
                        </div>

                        {/* Footer Actions */}
                        <div className="px-6 py-4 border-t border-slate-100 bg-white flex justify-end">
                            <button 
                                onClick={() => {
                                    setIsFullInvoiceModalOpen(false);
                                    setFullInvoiceData(null);
                                }}
                                className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors"
                            >
                                ปิดหน้าต่าง
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Cancel Booking Modal */}
            {isCancelModalOpen && activeBooking && (
                <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[100] flex justify-center items-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
                        <div className="p-8 flex flex-col items-center text-center">
                            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-6">
                                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                            </div>
                            <h2 className="text-xl font-black text-slate-800 mb-2">
                                ต้องการยกเลิกการนัดหมายใช่หรือไม่?
                            </h2>
                            <p className="text-red-600 font-semibold mb-6">
                                หากยืนยันการยกเลิก คุณจะไม่สามารถขอรับเงินมัดจำคืนได้ในทุกกรณี
                            </p>

                            <div className="w-full space-y-3">
                                <button
                                    onClick={() => handleCancelBooking(activeBooking.id, activeBooking.room_id)}
                                    disabled={cancelCountdown > 0}
                                    className={`w-full py-3.5 font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-2 ${cancelCountdown > 0 ? 'bg-slate-200 text-slate-500 cursor-not-allowed shadow-none' : 'bg-red-600 hover:bg-red-700 text-white active:scale-95'}`}
                                >
                                    {cancelCountdown > 0 ? (
                                        <>กรุณารอ {cancelCountdown} วินาที...</>
                                    ) : (
                                        <>ยืนยันการยกเลิก (ริบมัดจำ)</>
                                    )}
                                </button>
                                <button
                                    onClick={() => setIsCancelModalOpen(false)}
                                    className="w-full py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-all active:scale-95"
                                >
                                    ปิด/ไม่ยกเลิก
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
