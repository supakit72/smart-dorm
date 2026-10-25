"use client";

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/backend/lib/supabase';
import InvoiceDocument from '@/components/InvoiceDocument';
import generatePayload from 'promptpay-qr';
import { QRCodeSVG } from 'qrcode.react';

const formatThaiDateShort = (dateStr: string) => {
    if (!dateStr) return '-';
    const parts = dateStr.split('-');
    if (parts.length >= 2) {
        const y = parseInt(parts[0], 10) + 543;
        const m = parts[1];
        const d = parts.length === 3 ? parts[2].substring(0, 2) : '01';
        return `${d}/${m}/${y}`;
    }
    return dateStr;
};

const formatDateThai = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        const thaiMonths = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
        return `${d.getDate()} ${thaiMonths[d.getMonth()]} ${d.getFullYear() + 543}`;
    } catch {
        return dateStr;
    }
};

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
    const [activeContract, setActiveContract] = useState<any | null>(null);
    const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
    const [cancelCountdown, setCancelCountdown] = useState(5);
    const [isQrModalOpen, setIsQrModalOpen] = useState(false);
    const [copiedBank, setCopiedBank] = useState(false);
    const qrRef = useRef<HTMLDivElement>(null);

    // Profile & Change Password Modal States
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [tenantFirstName, setTenantFirstName] = useState('');
    const [tenantLastName, setTenantLastName] = useState('');
    const [tenantEmail, setTenantEmail] = useState('');
    const [tenantPhone, setTenantPhone] = useState('');
    const [tenantRoomNumber, setTenantRoomNumber] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [isChangingPassword, setIsChangingPassword] = useState(false);
    const [passwordError, setPasswordError] = useState<string | null>(null);
    const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

    // อ้างอิงถึง input file ที่ซ่อนไว้
    const fileInputRef = useRef<HTMLInputElement>(null);

    const fetchLatestInvoice = async (uid: string, showLoading = true) => {
        try {
            if (showLoading) setLoading(true);
            setError(null);

            // 1. หา UUID (user_id) ในตาราง users
            const { data: userRecord, error: userError } = await supabase
                .from('users')
                .select('user_id, first_name, last_name, phone_number, email')
                .eq('user_uid', uid)
                .single();

            if (userError || !userRecord) throw new Error('ไม่พบข้อมูลผู้ใช้งาน');

            setTenantFirstName(userRecord.first_name || '');
            setTenantLastName(userRecord.last_name || '');
            setTenantPhone(userRecord.phone_number || '');
            if (userRecord.email) {
                setTenantEmail(userRecord.email);
            }
            setUserName(`${userRecord.first_name || ''} ${userRecord.last_name || ''}`.trim());

            // 2. หาสัญญาเช่าปัจจุบัน และ Join ข้อมูลห้อง
            const { data: contract, error: contractError } = await supabase
                .from('contracts')
                .select(`
                    contracts_id, 
                    start_date,
                    end_date,
                    is_active,
                    tenant_id,
                    room_id,
                    rooms ( room_number, price_per_month, floor )
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
                setActiveContract(null);
                
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
                    setTenantRoomNumber((bookingData.rooms as any)?.room_number ? `${(bookingData.rooms as any).room_number} (อยู่ระหว่างจอง)` : '-');
                } else {
                    setActiveBooking(null);
                    setTenantRoomNumber('ยังไม่มีห้องพัก');
                }
                
                return;
            } else {
                setHasRoom(true);
                setActiveBooking(null);
                const rData = Array.isArray(contract.rooms) ? contract.rooms[0] : contract.rooms;
                setTenantRoomNumber(rData?.room_number || '-');
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

            const roomData = Array.isArray(contract.rooms) ? contract.rooms[0] : contract.rooms;

            // คำนวณเงินมัดจำ/ประกัน: ตรวจสอบจากรายการ additional_items ในบิล หรือใช้ค่าเช่า 1 เดือนเป็นค่าตั้งต้น
            let contractDeposit = Number(roomData?.price_per_month || 0);
            if (invoicesData && invoicesData.length > 0) {
                for (const inv of invoicesData) {
                    if (Array.isArray(inv.additional_items)) {
                        const item = inv.additional_items.find((x: any) =>
                            x?.name?.includes('ประกัน') || x?.name?.includes('มัดจำ')
                        );
                        if (item && item.amount) {
                            contractDeposit = Number(item.amount);
                            break;
                        }
                    }
                }
            }

            setActiveContract({
                contracts_id: contract.contracts_id,
                start_date: contract.start_date,
                end_date: contract.end_date,
                is_active: contract.is_active,
                room_id: contract.room_id,
                room_number: roomData?.room_number || '-',
                floor: roomData?.floor || '1',
                rent_price: Number(roomData?.price_per_month || 0),
                deposit_amount: contractDeposit
            });

            if (invoicesData && invoicesData.length > 0) {
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
                        calculatedTotal: Number(inv.total_amount || total),
                        tenant_name: `${userRecord.first_name || ''} ${userRecord.last_name || ''}`.trim()
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
                .select('role, first_name, last_name, phone_number, email')
                .eq('user_uid', session.user.id)
                .single();

            if (!userData || userData.role !== 'tenant') {
                router.push('/login');
                return;
            }

            setUserName(`${userData.first_name || ''} ${userData.last_name || ''}`.trim());
            setTenantFirstName(userData.first_name || '');
            setTenantLastName(userData.last_name || '');
            setTenantPhone(userData.phone_number || '');
            setTenantEmail(userData.email || session.user.email || '');

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

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setPasswordError(null);
        setPasswordSuccess(null);

        if (!newPassword || newPassword.length < 6) {
            setPasswordError('รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 6 ตัวอักษร');
            return;
        }

        if (newPassword !== confirmPassword) {
            setPasswordError('รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน');
            return;
        }

        try {
            setIsChangingPassword(true);
            const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
            if (updateError) throw updateError;

            setPasswordSuccess('เปลี่ยนรหัสผ่านสำเร็จเรียบร้อยแล้ว กำลังนำคุณออกจากระบบ...');

            // หน่วงเวลา 1.8 วินาที เพื่อให้ผู้ใช้อ่านข้อความแจ้งเตือน ก่อน Sign Out และ Redirect
            setTimeout(async () => {
                try {
                    await supabase.auth.signOut();
                } catch (signOutErr) {
                    console.error('Sign out error after password change:', signOutErr);
                } finally {
                    router.push('/login');
                }
            }, 1800);
        } catch (err: any) {
            console.error('Update password error:', err);
            setPasswordError(err.message || 'ไม่สามารถเปลี่ยนรหัสผ่านได้ กรุณาลองใหม่อีกครั้ง');
            setIsChangingPassword(false);
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

            // 4. อัปเดตข้อมูลในตาราง invoices เซ็ตค่า status เปลี่ยนเป็น pending (รอตรวจสอบ) พร้อมบันทึก paid_at
            const { error: updateError } = await supabase
                .from('invoices')
                .update({
                    status: 'pending',
                    slip_image: publicUrl,
                    paid_at: new Date().toISOString()
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

    const handleDownloadQr = () => {
        try {
            if (!qrRef.current) return;
            const svg = qrRef.current.querySelector('svg');
            if (!svg) return;

            const svgData = new XMLSerializer().serializeToString(svg);
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            const scale = 3;
            const width = 240 * scale;
            const height = 240 * scale;
            canvas.width = width;
            canvas.height = height;

            const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(svgBlob);
            const img = new Image();

            img.onload = () => {
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, width, height);
                ctx.drawImage(img, 0, 0, width, height);
                URL.revokeObjectURL(url);

                const pngUrl = canvas.toDataURL('image/png');
                const downloadLink = document.createElement('a');
                downloadLink.href = pngUrl;
                downloadLink.download = `PromptPay-QR-${invoice?.room_number || 'Room'}-${invoice?.calculatedTotal || 0}.png`;
                document.body.appendChild(downloadLink);
                downloadLink.click();
                document.body.removeChild(downloadLink);
            };

            img.onerror = () => {
                URL.revokeObjectURL(url);
                const downloadLink = document.createElement('a');
                downloadLink.href = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgData);
                downloadLink.download = `PromptPay-QR-${invoice?.room_number || 'Room'}.svg`;
                document.body.appendChild(downloadLink);
                downloadLink.click();
                document.body.removeChild(downloadLink);
            };

            img.src = url;
        } catch (err) {
            console.error('Download QR error:', err);
            alert('เกิดข้อผิดพลาดในการบันทึกรูปภาพ กรุณาแคปหน้าจอ');
        }
    };

    const handleCopyBankAccount = (accountNo?: string) => {
        const textToCopy = accountNo || dormSettings?.bank_account_no || dormSettings?.promptpay_id || '';
        if (!textToCopy) return;

        const cleanNo = textToCopy.replace(/[^0-9]/g, '');
        const toCopy = cleanNo || textToCopy;

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(toCopy)
                .then(() => {
                    setCopiedBank(true);
                    setTimeout(() => setCopiedBank(false), 2500);
                })
                .catch(() => fallbackCopy(toCopy));
        } else {
            fallbackCopy(toCopy);
        }
    };

    const fallbackCopy = (text: string) => {
        try {
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.opacity = '0';
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            setCopiedBank(true);
            setTimeout(() => setCopiedBank(false), 2500);
        } catch (err) {
            console.error('Copy error:', err);
            alert('คัดลอกเลขบัญชี: ' + text);
        }
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

    // คำนวณ Payload สำหรับ PromptPay QR Code
    const promptpayTarget = (dormSettings?.promptpay_id || dormSettings?.bank_account_no || dormSettings?.phone || '').replace(/[^0-9]/g, '');
    const qrAmount = Number(invoice?.calculatedTotal || 0);

    let qrPayload = '';
    if (promptpayTarget) {
        try {
            qrPayload = generatePayload(promptpayTarget, { amount: qrAmount > 0 ? qrAmount : undefined });
        } catch (err) {
            console.error('generatePayload error:', err);
        }
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
            <div className="space-y-3">
                <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                />
                
                {/* QR Code Button — show only when no slip selected yet */}
                {!selectedFile && !previewUrl && (
                    <button
                        type="button"
                        onClick={() => setIsQrModalOpen(true)}
                        className="w-full font-bold py-4 px-4 rounded-2xl transition-all shadow-md bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white flex items-center justify-center gap-3 active:scale-95 cursor-pointer"
                    >
                        <span className="text-2xl">📱</span>
                        <div className="flex flex-col items-start">
                            <span className="text-base leading-tight">สแกนจ่ายด้วย QR Code PromptPay</span>
                            <span className="text-xs font-medium text-violet-200">ยอดรวมสุทธิ {invoice?.calculatedTotal?.toLocaleString()} ฿</span>
                        </div>
                    </button>
                )}

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
                    <button
                        type="button"
                        onClick={() => setIsProfileModalOpen(true)}
                        className="flex items-center gap-3 text-left hover:opacity-85 transition-opacity cursor-pointer group"
                        title="ดูข้อมูลส่วนตัวและเปลี่ยนรหัสผ่าน"
                    >
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-white flex items-center justify-center font-black text-xl shadow-md shadow-emerald-500/30 uppercase group-hover:scale-105 transition-transform">
                            {userName ? userName.charAt(0) : 'T'}
                        </div>
                        <div>
                            <div className="flex items-center gap-1.5">
                                <h1 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">ผู้เช่า</h1>
                                <span className="text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded font-semibold hidden sm:inline-block">โปรไฟล์</span>
                            </div>
                            <p className="text-base font-black text-slate-800 leading-none mt-0.5 group-hover:text-blue-600 transition-colors flex items-center gap-1">
                                <span>{userName || 'ผู้เช่า'}</span>
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400 group-hover:text-blue-600 transition-colors"><polyline points="9 18 15 12 9 6"></polyline></svg>
                            </p>
                        </div>
                    </button>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setIsProfileModalOpen(true)}
                            className="p-2.5 rounded-xl bg-slate-50 text-slate-600 hover:text-blue-600 hover:bg-blue-50 border border-slate-200 transition-colors shadow-sm active:scale-95 flex items-center justify-center cursor-pointer"
                            title="ข้อมูลส่วนตัวและเปลี่ยนรหัสผ่าน"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                        </button>
                        <button
                            onClick={handleLogout}
                            className="p-2.5 rounded-xl bg-slate-50 text-slate-500 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 transition-colors shadow-sm active:scale-95 flex items-center justify-center cursor-pointer"
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
                        {/* Active Contract Card */}
                        {activeContract && (
                            <section className="bg-white rounded-[2rem] p-5 sm:p-6 shadow-sm border border-slate-200/80 relative overflow-hidden transition-all hover:shadow-md">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                                    <div className="flex items-center gap-3">
                                        <div className="w-11 h-11 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xl shadow-sm">
                                            📜
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h2 className="text-base font-black text-slate-800 tracking-tight">ข้อมูลสัญญาเช่าห้องพัก</h2>
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold border border-emerald-200">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                                    มีผลบังคับใช้
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-400 mt-0.5">สัญญาเช่าห้องพักฉบับปัจจุบันของคุณ (Read-Only)</p>
                                        </div>
                                    </div>
                                    <a
                                        href={`/contracts/print/${activeContract.contracts_id}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm transition-all shadow-sm active:scale-95 group shrink-0"
                                    >
                                        <span>📄 ดูสัญญาเช่าฉบับเต็ม</span>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                                    </a>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4">
                                    <div className="bg-slate-50/80 rounded-2xl p-3 border border-slate-100">
                                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">รหัสสัญญา</span>
                                        <span className="text-sm font-black text-slate-800 font-mono">
                                            #CN-{String(activeContract.contracts_id).padStart(4, '0')}
                                        </span>
                                    </div>

                                    <div className="bg-slate-50/80 rounded-2xl p-3 border border-slate-100">
                                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">ห้อง / ชั้น</span>
                                        <span className="text-sm font-black text-emerald-700">
                                            ห้อง {activeContract.room_number} <span className="text-xs font-normal text-slate-500">(ชั้น {activeContract.floor})</span>
                                        </span>
                                    </div>

                                    <div className="bg-slate-50/80 rounded-2xl p-3 border border-slate-100 col-span-2 sm:col-span-1">
                                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">ระยะเวลาสัญญา</span>
                                        <span className="text-xs sm:text-[13px] font-bold text-slate-700 block leading-tight">
                                            {formatDateThai(activeContract.start_date)} - {formatDateThai(activeContract.end_date)}
                                        </span>
                                    </div>

                                    <div className="bg-slate-50/80 rounded-2xl p-3 border border-slate-100 col-span-2 sm:col-span-1">
                                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">ค่าเช่า / เงินประกัน</span>
                                        <div className="text-xs font-bold text-slate-800">
                                            {activeContract.rent_price?.toLocaleString()} ฿ <span className="text-[10px] font-normal text-slate-500">(ประกัน {activeContract.deposit_amount?.toLocaleString()} ฿)</span>
                                        </div>
                                    </div>
                                </div>
                            </section>
                        )}

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
                                            <p className="text-2xl font-black text-slate-800">{formatThaiDateShort(invoice.month_year)}</p>
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
                                                    <div className="flex items-center gap-3 sm:gap-4 py-3">
                                                        <div className="whitespace-nowrap px-3 py-1.5 rounded-md bg-gray-100 text-sm font-medium text-gray-700 shrink-0">
                                                            {formatThaiDateShort(inv.month_year)}
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

            {/* Modal สแกนจ่ายด้วย QR Code PromptPay */}
            {isQrModalOpen && invoice && (
                <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[70] flex justify-center items-center p-4 transition-opacity overflow-y-auto custom-scrollbar">
                    <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-200 overflow-hidden flex flex-col my-auto border border-slate-100">
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/80">
                            <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center font-bold">
                                    📱
                                </div>
                                <div>
                                    <h2 className="text-base font-bold text-slate-800 leading-tight">
                                        สแกนจ่ายด้วย QR Code
                                    </h2>
                                    <p className="text-xs text-slate-500">
                                        ห้อง {invoice.room_number || '-'} • รอบบิล {formatThaiDateShort(invoice.month_year)}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsQrModalOpen(false)}
                                className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-6 overflow-y-auto flex flex-col items-center gap-4">
                            {/* Total Amount Badge */}
                            <div className="w-full bg-gradient-to-br from-violet-50 to-purple-50 border border-violet-100/80 rounded-2xl p-4 text-center">
                                <p className="text-xs font-bold text-violet-600 uppercase tracking-wider mb-1">ยอดชำระสุทธิ (Total Amount)</p>
                                <div className="flex items-baseline justify-center gap-1.5 text-violet-950">
                                    <span className="text-4xl font-black tracking-tight">{Number(invoice.calculatedTotal || 0).toLocaleString()}</span>
                                    <span className="text-base font-bold text-violet-700">บาท</span>
                                </div>
                            </div>

                            {/* PromptPay QR Frame */}
                            <div className="w-full max-w-[280px] bg-white rounded-2xl border-2 border-slate-200 shadow-md overflow-hidden flex flex-col items-center">
                                {/* Thai QR Payment Banner */}
                                <div className="w-full bg-[#003B71] text-white py-2 px-3 text-center flex items-center justify-center gap-2 shadow-sm">
                                    <div className="flex flex-col items-center">
                                        <span className="text-[11px] font-black tracking-wider uppercase">THAI QR PAYMENT</span>
                                        <span className="text-[10px] text-blue-200 font-medium">พร้อมเพย์ PromptPay</span>
                                    </div>
                                </div>

                                {/* QR SVG container */}
                                <div ref={qrRef} className="p-4 bg-white flex flex-col items-center justify-center">
                                    {qrPayload ? (
                                        <QRCodeSVG
                                            value={qrPayload}
                                            size={200}
                                            level="M"
                                            includeMargin={false}
                                        />
                                    ) : (
                                        <div className="w-48 h-48 flex flex-col items-center justify-center text-center p-3 text-slate-400">
                                            <span className="text-3xl mb-2">⚠️</span>
                                            <p className="text-xs font-semibold text-slate-600">ยังไม่ได้ระบุหมายเลขพร้อมเพย์</p>
                                            <p className="text-[11px] text-slate-400 mt-1">กรุณาโอนเงินผ่านเลขบัญชีธนาคารด้านล่าง</p>
                                        </div>
                                    )}
                                </div>

                                <div className="w-full bg-slate-50 py-2 px-3 border-t border-slate-100 text-center">
                                    <p className="text-[11px] text-slate-500 font-medium">
                                        สแกนผ่านแอปธนาคาร ยอดเงินจะระบุอัตโนมัติ
                                    </p>
                                </div>
                            </div>

                            {/* Bank Details from dorm_settings */}
                            <div className="w-full bg-slate-50 border border-slate-200/80 rounded-2xl p-4 text-xs space-y-2.5">
                                <div className="flex justify-between items-center text-slate-500 font-semibold border-b border-slate-200/60 pb-2">
                                    <span>ช่องทางโอนเงิน / บัญชีหอพัก</span>
                                    <span className="text-slate-400">{dormSettings?.dorm_name || 'หอพัก'}</span>
                                </div>

                                <div className="flex justify-between items-center">
                                    <span className="text-slate-500">ธนาคาร:</span>
                                    <span className="font-bold text-slate-800 text-right">{dormSettings?.bank_name || '-'}</span>
                                </div>

                                <div className="flex justify-between items-center">
                                    <span className="text-slate-500">ชื่อบัญชี:</span>
                                    <span className="font-bold text-slate-800 text-right">{dormSettings?.bank_account_name || dormSettings?.dorm_name || '-'}</span>
                                </div>

                                <div className="flex justify-between items-center bg-white px-3 py-2 rounded-xl border border-slate-200/60">
                                    <div>
                                        <span className="text-[10px] text-slate-400 block font-bold uppercase">เลขที่บัญชี</span>
                                        <span className="font-mono font-black text-slate-900 text-sm tracking-wider">
                                            {dormSettings?.bank_account_no || '-'}
                                        </span>
                                    </div>
                                    {dormSettings?.bank_account_no && (
                                        <button
                                            type="button"
                                            onClick={() => handleCopyBankAccount(dormSettings.bank_account_no)}
                                            className={`text-xs px-2.5 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1 active:scale-95 ${copiedBank ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
                                        >
                                            {copiedBank ? (
                                                <>
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                                    คัดลอกแล้ว
                                                </>
                                            ) : (
                                                <>
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                                                    คัดลอก
                                                </>
                                            )}
                                        </button>
                                    )}
                                </div>

                                {dormSettings?.promptpay_id && (
                                    <div className="flex justify-between items-center pt-1 text-slate-600">
                                        <span className="text-slate-500">พร้อมเพย์ (PromptPay):</span>
                                        <span className="font-mono font-bold text-slate-800">{dormSettings.promptpay_id}</span>
                                    </div>
                                )}
                            </div>

                            {/* Action Buttons: Save QR & Copy Account */}
                            <div className="w-full grid grid-cols-2 gap-3 pt-1">
                                <button
                                    type="button"
                                    onClick={handleDownloadQr}
                                    disabled={!qrPayload}
                                    className={`py-3 px-3 font-bold rounded-xl text-sm transition-all shadow-md flex items-center justify-center gap-2 active:scale-95 ${qrPayload ? 'bg-violet-600 hover:bg-violet-700 text-white shadow-violet-600/20 cursor-pointer' : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'}`}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                    บันทึกภาพ QR
                                </button>

                                <button
                                    type="button"
                                    onClick={() => handleCopyBankAccount(dormSettings?.bank_account_no)}
                                    disabled={!dormSettings?.bank_account_no}
                                    className={`py-3 px-3 font-bold rounded-xl text-sm transition-all flex items-center justify-center gap-2 active:scale-95 border ${copiedBank ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700 shadow-sm cursor-pointer'}`}
                                >
                                    {copiedBank ? (
                                        <>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600"><polyline points="20 6 9 17 4 12"/></svg>
                                            <span>คัดลอกสำเร็จ!</span>
                                        </>
                                    ) : (
                                        <>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                                            <span>คัดลอกเลขบัญชี</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsQrModalOpen(false);
                                    handleTriggerUpload();
                                }}
                                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl transition-all shadow-md shadow-blue-600/20 active:scale-95 flex items-center justify-center gap-1.5"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" y2="15" /></svg>
                                โอนเงินแล้ว แนบสลิปเลย
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsQrModalOpen(false)}
                                className="px-5 py-3 bg-white hover:bg-slate-100 text-slate-700 font-bold text-sm rounded-xl border border-slate-200 transition-colors active:scale-95"
                            >
                                ปิด
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

            {/* Profile & Change Password Modal */}
            {isProfileModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
                    <div className="relative bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden my-auto border border-slate-100 flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white/95 backdrop-blur z-10 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-slate-800 tracking-tight">โปรไฟล์และเปลี่ยนรหัสผ่าน</h3>
                                    <p className="text-xs text-slate-400">ข้อมูลบัญชีผู้เช่าและความปลอดภัย</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                disabled={isChangingPassword}
                                onClick={() => {
                                    if (isChangingPassword) return;
                                    setIsProfileModalOpen(false);
                                    setPasswordError(null);
                                    setPasswordSuccess(null);
                                    setNewPassword('');
                                    setConfirmPassword('');
                                }}
                                className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                title="ปิด"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 overflow-y-auto space-y-6">
                            {/* ส่วนที่ 1: ข้อมูลส่วนตัว (Read-Only) */}
                            <div className="bg-slate-50 rounded-2xl p-4 sm:p-5 border border-slate-200/70 space-y-3.5">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                        <span>👤</span> ข้อมูลส่วนตัว
                                    </h4>
                                    <span className="text-[10px] font-bold text-slate-400 bg-slate-200/70 px-2 py-0.5 rounded-md">อ่านอย่างเดียว</span>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">ชื่อ - นามสกุล</label>
                                    <input
                                        type="text"
                                        disabled
                                        value={`${tenantFirstName} ${tenantLastName}`.trim() || userName || '-'}
                                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 text-sm font-semibold cursor-not-allowed select-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">อีเมล</label>
                                    <input
                                        type="text"
                                        disabled
                                        value={tenantEmail || '-'}
                                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 text-sm font-semibold cursor-not-allowed select-none"
                                    />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">เบอร์โทรศัพท์</label>
                                        <input
                                            type="text"
                                            disabled
                                            value={tenantPhone || '-'}
                                            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 text-sm font-semibold cursor-not-allowed select-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">เลขห้องพัก</label>
                                        <input
                                            type="text"
                                            disabled
                                            value={tenantRoomNumber ? (tenantRoomNumber.includes('ห้อง') ? tenantRoomNumber : `ห้อง ${tenantRoomNumber}`) : (invoice?.room_number ? `ห้อง ${invoice.room_number}` : '-')}
                                            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 text-sm font-semibold cursor-not-allowed select-none text-emerald-700 font-black"
                                        />
                                    </div>
                                </div>

                                <p className="text-[11px] text-amber-600 font-medium flex items-center gap-1.5 pt-1">
                                    <span>ℹ️</span> *หากต้องการแก้ไขข้อมูลส่วนตัว กรุณาติดต่อผู้ดูแลหอพัก
                                </p>
                            </div>

                            {/* ข้อมูลสัญญาเช่าปัจจุบัน (Read-Only) */}
                            {activeContract && (
                                <div className="bg-indigo-50/50 rounded-2xl p-4 sm:p-5 border border-indigo-100/80 space-y-3.5">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-xs font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
                                            <span>📜</span> สัญญาเช่าปัจจุบัน
                                        </h4>
                                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                            มีผลบังคับใช้
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2.5 text-xs">
                                        <div className="bg-white/90 p-3 rounded-xl border border-indigo-50/80">
                                            <span className="text-[11px] font-bold text-slate-400 block mb-0.5">รหัสสัญญา</span>
                                            <span className="font-bold text-slate-800 font-mono">#CN-{String(activeContract.contracts_id).padStart(4, '0')}</span>
                                        </div>
                                        <div className="bg-white/90 p-3 rounded-xl border border-indigo-50/80">
                                            <span className="text-[11px] font-bold text-slate-400 block mb-0.5">ห้องพัก</span>
                                            <span className="font-bold text-emerald-700">ห้อง {activeContract.room_number} (ชั้น {activeContract.floor})</span>
                                        </div>
                                        <div className="bg-white/90 p-3 rounded-xl border border-indigo-50/80">
                                            <span className="text-[11px] font-bold text-slate-400 block mb-0.5">ค่าเช่ารายเดือน</span>
                                            <span className="font-bold text-slate-800">{activeContract.rent_price?.toLocaleString()} บาท/เดือน</span>
                                        </div>
                                        <div className="bg-white/90 p-3 rounded-xl border border-indigo-50/80">
                                            <span className="text-[11px] font-bold text-slate-400 block mb-0.5">เงินประกันความเสียหาย</span>
                                            <span className="font-bold text-slate-800">{activeContract.deposit_amount?.toLocaleString()} บาท</span>
                                        </div>
                                    </div>

                                    <div className="bg-white/90 p-3 rounded-xl border border-indigo-50/80 text-xs">
                                        <span className="text-[11px] font-bold text-slate-400 block mb-0.5">ระยะเวลาสัญญา</span>
                                        <span className="font-bold text-slate-700">{formatDateThai(activeContract.start_date)} ถึง {formatDateThai(activeContract.end_date)}</span>
                                    </div>

                                    <a
                                        href={`/contracts/print/${activeContract.contracts_id}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 text-xs active:scale-[0.98]"
                                    >
                                        <span>📄 ดูสัญญาเช่าฉบับเต็ม (เปิดแท็บใหม่)</span>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                                    </a>
                                </div>
                            )}

                            {/* ส่วนที่ 2: เปลี่ยนรหัสผ่าน */}
                            <form onSubmit={handleChangePassword} className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 space-y-4">
                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                    <span>🔒</span> เปลี่ยนรหัสผ่านใหม่
                                </h4>

                                {passwordSuccess && (
                                    <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold flex items-center gap-2 animate-in fade-in">
                                        <span>✓</span> {passwordSuccess}
                                    </div>
                                )}

                                {passwordError && (
                                    <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs font-bold flex items-center gap-2 animate-in fade-in">
                                        <span>⚠️</span> {passwordError}
                                    </div>
                                )}

                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1">รหัสผ่านใหม่ (อย่างน้อย 6 ตัวอักษร) <span className="text-rose-500">*</span></label>
                                    <div className="relative">
                                        <input
                                            type={showNewPassword ? "text" : "password"}
                                            value={newPassword}
                                            onChange={e => setNewPassword(e.target.value)}
                                            disabled={isChangingPassword}
                                            placeholder="••••••••"
                                            minLength={6}
                                            required
                                            className="w-full px-3.5 py-2.5 pr-14 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                        />
                                        <button
                                            type="button"
                                            disabled={isChangingPassword}
                                            onClick={() => setShowNewPassword(!showNewPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-semibold cursor-pointer select-none disabled:opacity-40 disabled:cursor-not-allowed"
                                        >
                                            {showNewPassword ? 'ซ่อน' : 'แสดง'}
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1">ยืนยันรหัสผ่านใหม่ <span className="text-rose-500">*</span></label>
                                    <div className="relative">
                                        <input
                                            type={showConfirmPassword ? "text" : "password"}
                                            value={confirmPassword}
                                            onChange={e => setConfirmPassword(e.target.value)}
                                            disabled={isChangingPassword}
                                            placeholder="••••••••"
                                            minLength={6}
                                            required
                                            className="w-full px-3.5 py-2.5 pr-14 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                        />
                                        <button
                                            type="button"
                                            disabled={isChangingPassword}
                                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-semibold cursor-pointer select-none disabled:opacity-40 disabled:cursor-not-allowed"
                                        >
                                            {showConfirmPassword ? 'ซ่อน' : 'แสดง'}
                                        </button>
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={isChangingPassword || !newPassword || !confirmPassword}
                                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold rounded-xl transition-all shadow-md shadow-blue-500/20 disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none flex items-center justify-center gap-2 text-sm active:scale-[0.99] cursor-pointer"
                                >
                                    {isChangingPassword ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                            <span>{passwordSuccess ? 'กำลังออกจากระบบ...' : 'กำลังบันทึก...'}</span>
                                        </>
                                    ) : (
                                        <span>บันทึกการเปลี่ยนรหัสผ่าน</span>
                                    )}
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
