"use client";

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/backend/lib/supabase';

export default function MaintenanceRequest() {
    const [issueDetails, setIssueDetails] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [userId, setUserId] = useState<number | null>(null);
    const [roomId, setRoomId] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [maintenanceHistory, setMaintenanceHistory] = useState<any[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const router = useRouter();

    useEffect(() => {
        const fetchUserData = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) {
                    router.push('/login');
                    return;
                }

                // Get user_id
                const { data: userData } = await supabase
                    .from('users')
                    .select('user_id')
                    .eq('user_uid', session.user.id)
                    .single();

                if (!userData) {
                    router.push('/login');
                    return;
                }

                setUserId(userData.user_id);

                // Get active contract's room_id
                const { data: contractData } = await supabase
                    .from('contracts')
                    .select('room_id')
                    .eq('tenant_id', userData.user_id)
                    .eq('is_active', true)
                    .single();

                if (contractData) {
                    setRoomId(contractData.room_id);
                } else {
                    alert('คุณยังไม่มีสัญญาเช่าที่กำลังใช้งานอยู่ ไม่สามารถแจ้งซ่อมได้');
                    router.push('/tenant');
                    return;
                }

                // Fetch history
                const { data: historyData } = await supabase
                    .from('maintenance_requests')
                    .select('*')
                    .eq('tenant_id', userData.user_id)
                    .order('created_at', { ascending: false });
                
                if (historyData) setMaintenanceHistory(historyData);

            } catch (err) {
                console.error("Error fetching user data:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchUserData();
    }, [router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!issueDetails.trim()) {
            alert('กรุณากรอกรายละเอียดปัญหา');
            return;
        }

        if (!roomId || !userId) {
            alert('ไม่พบข้อมูลห้องพักหรือข้อมูลผู้ใช้งาน');
            return;
        }

        try {
            setIsSubmitting(true);

            let photoUrl = null;
            if (selectedFile) {
                const fileExt = selectedFile.name.split('.').pop();
                const fileName = `maintenance/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
                
                // อัปโหลดไฟล์ไปที่ Supabase Storage (ใช้ bucket slips แต่อยู่ในโฟลเดอร์ maintenance)
                const { error: uploadError } = await supabase.storage
                    .from('slips')
                    .upload(fileName, selectedFile, {
                        cacheControl: '3600',
                        upsert: false
                    });

                if (uploadError) {
                    throw new Error(`อัปโหลดรูปภาพไม่สำเร็จ: ${uploadError.message}`);
                }

                const { data: publicUrlData } = supabase.storage
                    .from('slips')
                    .getPublicUrl(fileName);
                
                photoUrl = publicUrlData.publicUrl;
            }

            const { error } = await supabase
                .from('maintenance_requests')
                .insert([
                    {
                        room_id: roomId,
                        tenant_id: userId,
                        issue_details: issueDetails,
                        status: 'pending',
                        photo_url: photoUrl
                    }
                ]);

            if (error) throw error;

            alert('ส่งเรื่องแจ้งซ่อมเรียบร้อยแล้ว');
            
            // ล้างข้อมูลในฟอร์มและดึงประวัติใหม่
            setIssueDetails('');
            setSelectedFile(null);
            setPreviewUrl(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
            
            const { data: historyData } = await supabase
                .from('maintenance_requests')
                .select('*')
                .eq('tenant_id', userId)
                .order('created_at', { ascending: false });
            if (historyData) setMaintenanceHistory(historyData);

        } catch (err: any) {
            console.error("Submit error:", err);
            alert("เกิดข้อผิดพลาดในการส่งเรื่อง: " + (err.message || "กรุณาลองใหม่อีกครั้ง"));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                alert('ขนาดไฟล์ต้องไม่เกิน 5MB');
                return;
            }
            setSelectedFile(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    const formatDateThai = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-20">
            {/* Header */}
            <header className="bg-white border-b border-slate-200/60 sticky top-0 z-10 shadow-sm">
                <div className="max-w-3xl mx-auto px-4 sm:px-6">
                    <div className="flex justify-between h-16 items-center">
                        <div className="flex items-center gap-3">
                            <Link href="/tenant" className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors active:scale-95">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                            </Link>
                            <h1 className="text-lg font-bold text-slate-800 tracking-tight">
                                แจ้งซ่อมแซม
                            </h1>
                        </div>
                        <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 font-bold border border-amber-200 shadow-sm">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></svg>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <div className="w-10 h-10 border-4 border-amber-200 border-t-amber-500 rounded-full animate-spin"></div>
                        <p className="mt-4 text-slate-500 font-medium text-sm">กำลังโหลดข้อมูลห้องพัก...</p>
                    </div>
                ) : (
                    <>
                        <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200/60 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-amber-50 to-transparent rounded-bl-full opacity-60 pointer-events-none"></div>

                    <div className="relative z-10 mb-6">
                        <h2 className="text-xl font-bold text-slate-800 mb-2">พบปัญหาในห้องพัก?</h2>
                        <p className="text-sm text-slate-500">กรุณาระบุรายละเอียดปัญหาที่พบ เพื่อให้ช่างเข้าตรวจสอบและทำการซ่อมแซม</p>
                    </div>

                    <form onSubmit={handleSubmit} className="relative z-10 space-y-5">
                        <div className="space-y-2">
                            <label htmlFor="issueDetails" className="block text-sm font-semibold text-slate-700">
                                รายละเอียดปัญหา <span className="text-rose-500">*</span>
                            </label>
                            <textarea
                                id="issueDetails"
                                value={issueDetails}
                                onChange={(e) => setIssueDetails(e.target.value)}
                                placeholder="ตัวอย่าง: แอร์น้ำหยด, หลอดไฟห้องน้ำขาด, ก๊อกน้ำอ่างล้างหน้ารั่ว..."
                                rows={5}
                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all resize-none shadow-sm"
                                disabled={isSubmitting}
                            ></textarea>
                        </div>

                        {/* แนบรูปภาพ */}
                        <div className="space-y-3">
                            <label className="block text-sm font-semibold text-slate-700">
                                แนบรูปภาพประกอบ (ถ้ามี) <span className="text-slate-400 font-normal ml-1">ไม่เกิน 5MB</span>
                            </label>
                            
                            {previewUrl ? (
                                <div className="relative inline-block">
                                    <img src={previewUrl} alt="Preview" className="max-h-48 rounded-xl border border-slate-200 shadow-sm" />
                                    <button 
                                        type="button" 
                                        onClick={() => { setSelectedFile(null); setPreviewUrl(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                                        className="absolute -top-3 -right-3 w-8 h-8 flex items-center justify-center bg-white border border-slate-200 text-rose-500 rounded-full shadow-md hover:bg-rose-50 hover:text-rose-600 transition-colors"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                    </button>
                                </div>
                            ) : (
                                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer group">
                                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" className="text-slate-400 mb-2 group-hover:text-blue-500 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                                        <p className="mb-1 text-sm text-slate-500 font-medium"><span className="text-blue-600 font-bold">คลิกอัปโหลด</span> หรือลากไฟล์มาวาง</p>
                                        <p className="text-xs text-slate-400">PNG, JPG, JPEG</p>
                                    </div>
                                    <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={handleFileChange} disabled={isSubmitting} />
                                </label>
                            )}
                        </div>

                        <button
                            type="submit"
                            disabled={isSubmitting || !issueDetails.trim()}
                            className={`w-full font-medium py-3.5 px-4 rounded-xl transition-all shadow-md flex justify-center items-center gap-2 active:scale-[0.98] ${isSubmitting || !issueDetails.trim()
                                    ? 'bg-slate-300 cursor-not-allowed text-slate-500 shadow-none'
                                    : 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-200 hover:shadow-lg'
                                }`}
                        >
                            {isSubmitting ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-slate-500 border-t-transparent rounded-full animate-spin"></div>
                                    กำลังส่งเรื่อง...
                                </>
                            ) : (
                                <>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                                    ส่งเรื่องแจ้งซ่อม
                                </>
                            )}
                        </button>
                    </form>
                </div>

                <div className="bg-amber-50 rounded-2xl p-5 border border-amber-100 flex gap-4 items-start">
                    <div className="text-2xl mt-0.5">💡</div>
                    <div>
                        <h4 className="font-semibold text-amber-800 text-sm mb-1">คำแนะนำ</h4>
                        <p className="text-xs text-amber-700/80 leading-relaxed">
                            การแจ้งซ่อมที่ชัดเจนจะช่วยให้ช่างสามารถเตรียมเครื่องมือและอะไหล่ได้ถูกต้อง รวดเร็วยิ่งขึ้น หากเป็นกรณีฉุกเฉิน (เช่น ท่อน้ำแตก น้ำท่วมห้อง) กรุณาติดต่อที่สำนักงานโดยตรง
                        </p>
                    </div>
                </div>

                {/* My Maintenance History */}
                <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200/60 overflow-hidden">
                    <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" className="text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
                        ประวัติการแจ้งซ่อมของฉัน
                    </h3>
                    
                    {maintenanceHistory.length > 0 ? (
                        <div className="space-y-4">
                            {maintenanceHistory.map((item) => (
                                <div key={item.maintenance_requests_id} className="p-4 rounded-2xl border border-slate-100 bg-slate-50 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                                    <div className="flex-1 space-y-1">
                                        <div className="flex items-center gap-2 mb-1.5">
                                            {item.status === 'pending' ? (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 font-semibold text-[10px] uppercase tracking-wider border border-rose-100">รอดำเนินการ</span>
                                            ) : item.status === 'in_progress' ? (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 font-semibold text-[10px] uppercase tracking-wider border border-amber-100">กำลังดำเนินการ</span>
                                            ) : (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-semibold text-[10px] uppercase tracking-wider border border-emerald-100">เสร็จสิ้น</span>
                                            )}
                                            <span className="text-xs text-slate-400 font-medium">
                                                {formatDateThai(item.created_at)}
                                            </span>
                                        </div>
                                        <p className="text-sm text-slate-700">{item.issue_details}</p>
                                    </div>
                                    {item.photo_url && (
                                        <a href={item.photo_url} target="_blank" rel="noopener noreferrer" className="shrink-0 group overflow-hidden rounded-lg border border-slate-200">
                                            <img src={item.photo_url} alt="Attached" className="w-16 h-16 object-cover group-hover:scale-110 transition-transform duration-300" />
                                        </a>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-10 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                            <span className="text-3xl mb-2 block">📋</span>
                            <p className="text-slate-500 font-medium text-sm">ยังไม่มีประวัติการแจ้งซ่อม</p>
                        </div>
                    )}
                </div>
                    </>
                )}
            </main>
        </div>
    );
}
