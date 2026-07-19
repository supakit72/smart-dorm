"use client";

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
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
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [selectedReceipt, setSelectedReceipt] = useState<any | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isFullInvoiceModalOpen, setIsFullInvoiceModalOpen] = useState(false);
    const [fullInvoiceData, setFullInvoiceData] = useState<any | null>(null);
    const [hasRoom, setHasRoom] = useState<boolean>(true);
    const [userName, setUserName] = useState<string>('');

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
                return;
            } else {
                setHasRoom(true);
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
            if (userUid) {
                await fetchLatestInvoice(userUid, false);
            }

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
            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-rose-50 text-rose-600 font-bold text-xs border border-rose-100 shadow-sm uppercase tracking-wide">
                รอชำระเงิน
            </span>
        );
    } else if (isRejected) {
        statusBadge = (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-orange-50 text-orange-600 font-bold text-xs border border-orange-100 shadow-sm uppercase tracking-wide animate-pulse">
                สลิปไม่ถูกต้อง กรุณาส่งใหม่
            </span>
        );
    }

    if (isPending || isRejected) {
        actionButton = (
            <div className="space-y-3">
                <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                />
                
                {selectedFile && previewUrl ? (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col items-center gap-3 animate-in fade-in zoom-in-95">
                        <img src={previewUrl} alt="Slip Preview" className="max-h-40 rounded-lg shadow-sm border border-slate-200" />
                        <p className="text-sm text-slate-600 font-medium break-all text-center">{selectedFile.name}</p>
                        <div className="flex w-full gap-2 mt-2">
                            <button
                                onClick={handleCancelUpload}
                                disabled={isPaying}
                                className="flex-1 font-medium py-2.5 px-4 rounded-xl transition-all shadow-sm bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50 active:scale-[0.98]"
                            >
                                ยกเลิก
                            </button>
                            <button
                                onClick={handleConfirmUpload}
                                disabled={isPaying}
                                className={`flex-[2] font-medium py-2.5 px-4 rounded-xl transition-all shadow-md flex justify-center items-center gap-2 active:scale-[0.98] ${isPaying ? 'bg-blue-400 cursor-not-allowed text-white shadow-none' : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200 hover:shadow-lg'}`}
                            >
                                {isPaying ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        กำลังยืนยัน...
                                    </>
                                ) : (
                                    <>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                        ยืนยันการแจ้งโอนเงิน
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                ) : (
                    <button
                        onClick={handleTriggerUpload}
                        className="w-full font-medium py-3.5 px-4 rounded-xl transition-all shadow-sm bg-white border-2 border-dashed border-rose-300 text-rose-600 hover:bg-rose-50 hover:border-rose-400 flex justify-center items-center gap-2 active:scale-[0.98]"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" x2="12" y1="3" y2="15" /></svg>
                        เลือกรูปภาพสลิป
                    </button>
                )}
            </div>
        );
    } else if (isReviewing) {
        statusBadge = (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-amber-50 text-amber-600 font-bold text-xs border border-amber-100 shadow-sm uppercase tracking-wide">
                รอตรวจสอบ
            </span>
        );
        actionButton = (
            <div 
                onClick={() => setSelectedReceipt(invoice)}
                className="w-full bg-amber-50 hover:bg-amber-100 transition-colors cursor-pointer text-amber-700 border border-amber-200 font-medium py-3.5 px-4 rounded-xl flex justify-center items-center gap-2 active:scale-[0.98]"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                <span>กำลังรอผู้ดูแลระบบตรวจสอบสลิป (คลิกดูรายละเอียด)</span>
            </div>
        );
    } else if (isPaid) {
        statusBadge = (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 font-bold text-xs border border-emerald-100 shadow-sm uppercase tracking-wide">
                ชำระแล้ว
            </span>
        );
        actionButton = (
            <div 
                onClick={() => setSelectedReceipt(invoice)}
                className="w-full bg-emerald-50 hover:bg-emerald-100 transition-colors cursor-pointer text-emerald-700 border border-emerald-200 font-medium py-3.5 px-4 rounded-xl flex justify-center items-center gap-2 active:scale-[0.98]"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
                <span>อัปโหลดสลิปและชำระเงินเรียบร้อย (คลิกดูใบเสร็จ)</span>
            </div>
        );
    } else if (invoice) {
        statusBadge = (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 font-semibold text-xs border border-slate-200 uppercase tracking-wide">
                {invoice.status}
            </span>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-20">
            {/* Header */}
            <header className="bg-white border-b border-slate-200/60 sticky top-0 z-10 shadow-sm">
                <div className="max-w-3xl mx-auto px-4 sm:px-6">
                    <div className="flex justify-between h-16 items-center">
                        <h1 className="text-lg font-bold text-slate-800 tracking-tight flex items-center">
                            Smart Dorm Manager
                            <span className="mx-2 text-slate-300">|</span>
                            <span className="text-emerald-600 font-semibold text-base sm:text-lg">มุมผู้เช่า</span>
                        </h1>
                        <div className="flex items-center gap-3">
                            <span className="text-sm font-bold text-slate-700 hidden sm:block">
                                {userName || 'ผู้เช่า'}
                            </span>
                            <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold border border-emerald-200 shadow-sm uppercase">
                                {userName ? userName.charAt(0) : 'T'}
                            </div>
                            <button
                                onClick={handleLogout}
                                className="text-sm font-semibold text-slate-600 hover:text-rose-600 transition-colors px-3 py-1.5 rounded-xl hover:bg-rose-50 border border-transparent hover:border-rose-100 flex items-center gap-1.5 active:scale-95 shadow-sm"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                                ออกจากระบบ
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
                {!hasRoom ? (
                    <section className="bg-white rounded-3xl p-8 md:p-12 shadow-sm border border-slate-200/60 flex flex-col items-center justify-center text-center mt-10 animate-in fade-in zoom-in-95">
                        <div className="w-24 h-24 bg-amber-50 rounded-full flex items-center justify-center mb-6 border border-amber-100 shadow-sm">
                            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/><circle cx="12" cy="8" r="2"/></svg>
                        </div>
                        <h2 className="text-2xl font-black text-slate-800 tracking-tight mb-3">ยังไม่มีข้อมูลห้องพัก</h2>
                        <p className="text-slate-500 text-base max-w-md">
                            คุณยังไม่มีข้อมูลห้องพักในระบบ กรุณาติดต่อเจ้าของหอพักเพื่อเพิ่มข้อมูลเข้าห้องพัก และทำสัญญาเช่าให้เรียบร้อย
                        </p>
                    </section>
                ) : (
                    <>
                        {/* Outstanding Balance Card */}
                        <section>
                    {invoice ? (
                        <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200/60 relative overflow-hidden transition-all hover:shadow-md">
                            <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-emerald-50 to-transparent rounded-bl-full opacity-60 pointer-events-none"></div>

                            <div className="flex justify-between items-start mb-6 relative z-10">
                                <div>
                                    <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-1">บิลเดือนล่าสุด</h2>
                                    <p className="text-slate-800 font-medium">ห้อง {invoice.room_number || '-'}</p>
                                </div>
                                {statusBadge}
                            </div>

                            {/* รายละเอียดค่าใช้จ่าย */}
                            <div className="space-y-4 mb-6 relative z-10">
                                <div className="flex justify-between items-center text-sm border-b border-dashed border-slate-200 pb-3">
                                    <span className="text-slate-600 flex items-center gap-2">🏠 ค่าเช่าห้อง</span>
                                    <span className="font-medium text-slate-800">{invoice.calculatedRent.toLocaleString()} ฿</span>
                                </div>
                                <div className="flex justify-between items-start text-sm border-b border-dashed border-slate-200 pb-3">
                                    <div className="flex flex-col gap-1">
                                        <span className="text-slate-600 flex items-center gap-2">💧 ค่าน้ำประปา <span className="text-xs text-slate-500">({getMeterCycle(invoice.month_year, dormSettings?.meter_reading_day || 20)})</span></span>
                                        <span className="text-xs text-slate-400">
                                            {invoice.water_meter_previous !== undefined && invoice.water_meter_current !== undefined 
                                                ? `(มิเตอร์: ${invoice.water_meter_previous} - ${invoice.water_meter_current}) ` 
                                                : ''}
                                            {invoice.water_unit} ยูนิต @ {invoice.water_rate} บาท
                                        </span>
                                    </div>
                                    <span className="font-medium text-slate-800 mt-0.5">{invoice.calculatedWater.toLocaleString()} ฿</span>
                                </div>
                                <div className="flex justify-between items-start text-sm border-b border-dashed border-slate-200 pb-3">
                                    <div className="flex flex-col gap-1">
                                        <span className="text-slate-600 flex items-center gap-2">⚡ ค่าไฟฟ้า <span className="text-xs text-slate-500">({getMeterCycle(invoice.month_year, dormSettings?.meter_reading_day || 20)})</span></span>
                                        <span className="text-xs text-slate-400">
                                            {invoice.electric_meter_previous !== undefined && invoice.electric_meter_current !== undefined 
                                                ? `(มิเตอร์: ${invoice.electric_meter_previous} - ${invoice.electric_meter_current}) ` 
                                                : ''}
                                            {invoice.electric_unit} ยูนิต @ {invoice.electric_rate} บาท
                                        </span>
                                    </div>
                                    <span className="font-medium text-slate-800 mt-0.5">{invoice.calculatedElectric.toLocaleString()} ฿</span>
                                </div>
                                {invoice.additional_items && Array.isArray(invoice.additional_items) && invoice.additional_items.map((item: any, idx: number) => (
                                    <div key={idx} className="flex justify-between items-center text-sm border-b border-dashed border-slate-200 pb-3">
                                        <span className="text-slate-600 flex items-center gap-2">✨ {item.name}</span>
                                        <span className="font-medium text-slate-800">{Number(item.price || 0).toLocaleString()} ฿</span>
                                    </div>
                                ))}

                                <div className="flex justify-between items-end pt-2">
                                    <span className="text-base font-bold text-slate-800">ยอดรวมสุทธิ</span>
                                    <p className="text-4xl font-black text-slate-800 tracking-tight text-right">
                                        {invoice.calculatedTotal.toLocaleString()} <span className="text-lg font-bold text-slate-500 ml-1">฿</span>
                                    </p>
                                </div>
                            </div>

                            <div className="relative z-10 mt-6 flex flex-col gap-3">
                                {actionButton}
                                <button
                                    onClick={() => {
                                        setFullInvoiceData(invoice);
                                        setIsFullInvoiceModalOpen(true);
                                    }}
                                    className="w-full py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl shadow-sm border border-slate-200 transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
                                >
                                    📄 ดูใบแจ้งหนี้แบบละเอียด
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-white rounded-3xl p-10 text-center shadow-sm border border-slate-200/60 border-dashed">
                            <div className="w-16 h-16 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">📭</div>
                            <h3 className="text-lg font-bold text-slate-700">ไม่มีบิลค้างชำระ</h3>
                            <p className="text-slate-500 text-sm mt-1">ยังไม่มีรอบบิลที่ต้องชำระในขณะนี้</p>
                        </div>
                    )}
                </section>

                {/* Action Menus */}
                <section>
                    <div className="grid grid-cols-2 gap-4">
                        <button onClick={() => setIsHistoryModalOpen(true)} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60 flex flex-col items-center justify-center gap-3 transition-all hover:border-blue-300 hover:shadow-md active:scale-95 group">
                            <div className="w-14 h-14 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-100 transition-colors shadow-inner">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" x2="8" y1="13" y2="13" /><line x1="16" x2="8" y1="17" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>
                            </div>
                            <span className="text-sm font-semibold text-slate-700 text-center group-hover:text-blue-700">ประวัติการจ่ายเงิน</span>
                        </button>

                        <Link href="/tenant/maintenance" className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60 flex flex-col items-center justify-center gap-3 transition-all hover:border-amber-300 hover:shadow-md active:scale-95 group">
                            <div className="w-14 h-14 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center group-hover:bg-amber-100 transition-colors shadow-inner">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></svg>
                            </div>
                            <span className="text-sm font-semibold text-slate-700 text-center group-hover:text-amber-700">แจ้งซ่อมแซม</span>
                        </Link>
                    </div>
                </section>
                    </>
                )}
            </main>

            {/* Modal ประวัติการจ่ายเงิน */}
            {isHistoryModalOpen && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex justify-center items-center p-4 transition-opacity">
                    <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                        <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" x2="8" y1="13" y2="13" /><line x1="16" x2="8" y1="17" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>
                                ประวัติการจ่ายเงิน
                            </h2>
                            <button onClick={() => setIsHistoryModalOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-slate-50/30">
                            {invoiceHistory.length > 0 ? (
                                <div className="space-y-3">
                                    {invoiceHistory.map((inv, idx) => {
                                        const isPaid = inv.status === 'paid' || inv.status === 'ชำระแล้ว';
                                        const isRejected = inv.status === 'rejected';
                                        const isReviewing = inv.status === 'pending' || inv.status === 'รอตรวจสอบ';
                                        const isPending = inv.status === 'unpaid' || inv.status === 'รอชำระ';
                                        return (
                                            <div key={inv.invoices_id || idx} className="bg-white p-4 rounded-2xl border border-slate-200/60 shadow-sm flex flex-col sm:flex-row justify-between sm:items-center gap-3 hover:border-blue-200 transition-colors">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 rounded-full bg-slate-50 flex flex-col items-center justify-center text-slate-500 border border-slate-100 font-medium shrink-0">
                                                        <span className="text-xs">{inv.month_year ? inv.month_year.split('/')[0] : '-'}</span>
                                                        <span className="text-[10px] font-bold">{inv.month_year ? inv.month_year.split('/')[1] : ''}</span>
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-slate-800 text-base">ยอดสุทธิ {inv.calculatedTotal?.toLocaleString()} ฿</p>
                                                        <p className="text-sm text-slate-500 font-medium">ห้อง {inv.room_number || '-'}</p>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col sm:items-end gap-2">
                                                    {isPaid ? (
                                                        <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 font-bold text-xs border border-emerald-100 shadow-sm uppercase tracking-wide">
                                                            ชำระแล้ว
                                                        </span>
                                                    ) : isRejected ? (
                                                        <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-orange-50 text-orange-600 font-bold text-xs border border-orange-100 shadow-sm uppercase tracking-wide">
                                                            ถูกตีกลับ
                                                        </span>
                                                    ) : isReviewing ? (
                                                        <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 font-bold text-xs border border-blue-100 shadow-sm uppercase tracking-wide">
                                                            รอตรวจสอบ
                                                        </span>
                                                    ) : isPending ? (
                                                        <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-rose-50 text-rose-600 font-bold text-xs border border-rose-100 shadow-sm uppercase tracking-wide">
                                                            รอชำระเงิน
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 font-semibold text-xs border border-slate-200 uppercase tracking-wide">
                                                            {inv.status}
                                                        </span>
                                                    )}
                                                    <div className="flex gap-2">
                                                        <button 
                                                            onClick={() => setSelectedReceipt(inv)}
                                                            className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1.5 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100 transition-colors hover:bg-blue-100 active:scale-95"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                                            ใบเสร็จสลิป
                                                        </button>
                                                        <button 
                                                            onClick={() => {
                                                                setFullInvoiceData(inv);
                                                                setIsFullInvoiceModalOpen(true);
                                                            }}
                                                            title="ดูใบแจ้งหนี้แบบละเอียด"
                                                            className="text-xs font-semibold text-slate-600 hover:text-slate-800 flex items-center justify-center bg-slate-50 w-8 h-8 rounded-lg border border-slate-200 transition-colors hover:bg-slate-100 active:scale-95"
                                                        >
                                                            👁️
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-center py-10">
                                    <p className="text-slate-500">ไม่มีประวัติการจ่ายเงิน</p>
                                </div>
                            )}
                        </div>
                        <div className="p-4 border-t border-slate-100 bg-white">
                            <button onClick={() => setIsHistoryModalOpen(false)} className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition-colors active:scale-95">
                                ปิดหน้าต่าง
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal ใบเสร็จและรายละเอียดสลิป */}
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
        </div>
    );
}
