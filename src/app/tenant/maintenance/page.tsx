
"use client";

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/backend/lib/supabase';

export default function MaintenanceRequest() {
    const [issueDetails, setIssueDetails] = useState('');
    const [category, setCategory] = useState('ไฟฟ้า');
    const [activeTab, setActiveTab] = useState<'form' | 'history'>('form');
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

            const fullIssueDetails = `[${category}] ${issueDetails}`;

            const { error } = await supabase
                .from('maintenance_requests')
                .insert([
                    {
                        room_id: roomId,
                        tenant_id: userId,
                        issue_details: fullIssueDetails,
                        status: 'pending',
                        photo_url: photoUrl
                    }
                ]);

            if (error) throw error;

            alert('ส่งเรื่องแจ้งซ่อมเรียบร้อยแล้ว');
            
            setIssueDetails('');
            setCategory('ไฟฟ้า');
            setSelectedFile(null);
            setPreviewUrl(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
            
            const { data: historyData } = await supabase
                .from('maintenance_requests')
                .select('*')
                .eq('tenant_id', userId)
                .order('created_at', { ascending: false });
            if (historyData) setMaintenanceHistory(historyData);

            setActiveTab('history');

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

    const categories = [
        { id: 'ไฟฟ้า', icon: '⚡' },
        { id: 'ประปา', icon: '💧' },
        { id: 'แอร์', icon: '❄️' },
        { id: 'เฟอร์นิเจอร์', icon: '🪑' },
        { id: 'ประตู-หน้าต่าง', icon: '🚪' },
        { id: 'อื่นๆ', icon: '❓' }
    ];

    const inProgressCount = maintenanceHistory.filter(h => h.status === 'pending' || h.status === 'in_progress').length;

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-20">
            {/* Header Navigation */}
            <header className="bg-white border-b border-slate-200/60 sticky top-0 z-20 shadow-sm pt-safe">
                <div className="max-w-3xl mx-auto px-4 sm:px-6">
                    <div className="flex h-16 items-center gap-4">
                        <Link href="/tenant" className="w-10 h-10 flex items-center justify-center rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors active:scale-95 shadow-sm border border-slate-200/60 shrink-0">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                        </Link>
                        <h1 className="text-lg font-black text-slate-800 tracking-tight flex-1">
                            แจ้งซ่อมและติดตามสถานะ
                        </h1>
                    </div>
                    
                    {/* Segmented Tabs */}
                    <div className="flex bg-slate-100 p-1.5 rounded-2xl mb-4 shadow-inner border border-slate-200/60">
                        <button
                            onClick={() => setActiveTab('form')}
                            className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all ${activeTab === 'form' ? 'bg-white text-slate-800 shadow-sm border border-slate-200/50' : 'text-slate-500 hover:text-slate-700 active:scale-95'}`}
                        >
                            <span className="mr-1.5">🛠️</span>แจ้งปัญหาใหม่
                        </button>
                        <button
                            onClick={() => setActiveTab('history')}
                            className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${activeTab === 'history' ? 'bg-white text-slate-800 shadow-sm border border-slate-200/50' : 'text-slate-500 hover:text-slate-700 active:scale-95'}`}
                        >
                            ประวัติ / สถานะ
                            {inProgressCount > 0 && (
                                <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-black animate-pulse">
                                    {inProgressCount}
                                </span>
                            )}
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <div className="w-10 h-10 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin"></div>
                        <p className="mt-4 text-slate-500 font-medium text-sm">กำลังโหลดข้อมูล...</p>
                    </div>
                ) : (
                    <>
                        {/* Tab 1: New Request Form */}
                        {activeTab === 'form' && (
                            <div className="bg-white rounded-[2rem] p-6 md:p-8 shadow-xl shadow-slate-200/40 border border-slate-100 relative overflow-hidden animate-in fade-in slide-in-from-bottom-4">
                                <form onSubmit={handleSubmit} className="relative z-10 space-y-6">
                                    
                                    {/* Category Chips */}
                                    <div className="space-y-3">
                                        <label className="block text-sm font-bold text-slate-700">หมวดหมู่ปัญหา</label>
                                        <div className="flex flex-wrap gap-2.5">
                                            {categories.map(cat => (
                                                <button
                                                    key={cat.id}
                                                    type="button"
                                                    onClick={() => setCategory(cat.id)}
                                                    className={`px-4 py-2.5 rounded-full text-sm font-bold transition-all border ${category === cat.id ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/30 scale-105' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
                                                >
                                                    {cat.icon} {cat.id}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Issue Details */}
                                    <div className="space-y-3">
                                        <label htmlFor="issueDetails" className="block text-sm font-bold text-slate-700">
                                            รายละเอียดปัญหา <span className="text-rose-500">*</span>
                                        </label>
                                        <textarea
                                            id="issueDetails"
                                            value={issueDetails}
                                            onChange={(e) => setIssueDetails(e.target.value)}
                                            placeholder="ระบุบริเวณที่พบปัญหาและอาการ เช่น แอร์มีน้ำหยดมุมขวา"
                                            rows={4}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all resize-none shadow-inner"
                                            disabled={isSubmitting}
                                        ></textarea>
                                    </div>

                                    {/* Photo Uploader */}
                                    <div className="space-y-3">
                                        <label className="block text-sm font-bold text-slate-700">
                                            รูปภาพถ่ายหน้างาน (ถ้ามี)
                                        </label>
                                        
                                        {previewUrl ? (
                                            <div className="relative inline-block w-full">
                                                <img src={previewUrl} alt="Preview" className="w-full h-48 object-cover rounded-2xl border border-slate-200 shadow-sm" />
                                                <button 
                                                    type="button" 
                                                    onClick={() => { setSelectedFile(null); setPreviewUrl(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                                                    className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center bg-black/60 backdrop-blur-md text-white rounded-full shadow-md hover:bg-black/80 transition-colors"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                                </button>
                                            </div>
                                        ) : (
                                            <label className="flex flex-col items-center justify-center w-full h-36 border-2 border-dashed border-blue-200 rounded-2xl bg-blue-50/30 hover:bg-blue-50/80 transition-colors cursor-pointer group active:scale-[0.98]">
                                                <div className="flex flex-col items-center justify-center text-center px-4">
                                                    <div className="w-12 h-12 bg-white rounded-full shadow-sm flex items-center justify-center text-blue-500 mb-2 border border-blue-100 group-hover:scale-110 transition-transform">
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                                                    </div>
                                                    <p className="text-sm text-slate-600 font-medium"><span className="text-blue-600 font-bold">แตะเพื่อถ่ายรูป</span> หรือเลือกจากคลังภาพ</p>
                                                </div>
                                                <input ref={fileInputRef} type="file" className="hidden" accept="image/*" capture="environment" onChange={handleFileChange} disabled={isSubmitting} />
                                            </label>
                                        )}
                                    </div>

                                    {/* Submit Button */}
                                    <button
                                        type="submit"
                                        disabled={isSubmitting || !issueDetails.trim()}
                                        className={`w-full py-4 px-4 rounded-2xl font-bold transition-all shadow-md flex justify-center items-center gap-2 active:scale-[0.98] ${isSubmitting || !issueDetails.trim()
                                                ? 'bg-slate-100 cursor-not-allowed text-slate-400 shadow-none'
                                                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20'
                                            }`}
                                    >
                                        {isSubmitting ? (
                                            <>
                                                <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin"></div>
                                                กำลังส่งข้อมูล...
                                            </>
                                        ) : (
                                            <>
                                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                                                ยืนยันส่งเรื่องแจ้งซ่อม
                                            </>
                                        )}
                                    </button>
                                </form>
                            </div>
                        )}

                        {/* Tab 2: History & Tracking */}
                        {activeTab === 'history' && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
                                {maintenanceHistory.length > 0 ? (
                                    maintenanceHistory.map((item) => {
                                        const match = item.issue_details.match(/^\[(.*?)\]\s*(.*)$/);
                                        const itemCat = match ? match[1] : 'ทั่วไป';
                                        const itemDetail = match ? match[2] : item.issue_details;

                                        return (
                                            <div key={item.maintenance_requests_id} className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/30 overflow-hidden">
                                                
                                                {/* Card Header */}
                                                <div className="flex justify-between items-start mb-4">
                                                    <div className="flex flex-col">
                                                        <span className="inline-flex w-max items-center px-3 py-1 rounded-full bg-slate-100 text-slate-600 font-black text-[10px] uppercase tracking-widest mb-1.5 border border-slate-200/60">
                                                            หมวดหมู่ {itemCat}
                                                        </span>
                                                        <p className="text-sm font-medium text-slate-800 line-clamp-2">{itemDetail}</p>
                                                    </div>
                                                    {item.photo_url && (
                                                        <a href={item.photo_url} target="_blank" rel="noopener noreferrer" className="shrink-0 overflow-hidden rounded-xl border border-slate-200 shadow-sm ml-3">
                                                            <img src={item.photo_url} alt="Attached" className="w-16 h-16 object-cover" />
                                                        </a>
                                                    )}
                                                </div>

                                                <p className="text-[11px] font-bold text-slate-400 mb-4">{formatDateThai(item.created_at)}</p>

                                                {/* Step Tracker / Timeline 3 Steps */}
                                                <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-100/80">
                                                    <div className="flex items-center justify-between relative">
                                                        {/* Step 1: Pending */}
                                                        <div className="flex flex-col items-center z-10">
                                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-sm transition-colors ${['pending', 'in_progress', 'resolved'].includes(item.status) ? 'bg-amber-500 shadow-amber-500/30 ring-4 ring-amber-50' : 'bg-slate-200 text-transparent'}`}>✓</div>
                                                            <span className={`text-[10px] mt-2 font-black ${['pending', 'in_progress', 'resolved'].includes(item.status) ? 'text-amber-600' : 'text-slate-400'}`}>รับเรื่องแล้ว</span>
                                                        </div>
                                                        
                                                        <div className={`absolute top-4 left-8 right-[50%] h-1 -translate-y-1/2 ${['in_progress', 'resolved'].includes(item.status) ? 'bg-blue-400' : 'bg-slate-200'}`}></div>

                                                        {/* Step 2: In Progress */}
                                                        <div className="flex flex-col items-center z-10">
                                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-sm transition-colors ${['in_progress', 'resolved'].includes(item.status) ? 'bg-blue-500 shadow-blue-500/30 ring-4 ring-blue-50' : 'bg-slate-200 text-transparent'}`}>✓</div>
                                                            <span className={`text-[10px] mt-2 font-black ${['in_progress', 'resolved'].includes(item.status) ? 'text-blue-600' : 'text-slate-400'}`}>กำลังดำเนินการ</span>
                                                        </div>

                                                        <div className={`absolute top-4 left-[50%] right-8 h-1 -translate-y-1/2 ${item.status === 'resolved' ? 'bg-emerald-400' : 'bg-slate-200'}`}></div>

                                                        {/* Step 3: Resolved */}
                                                        <div className="flex flex-col items-center z-10">
                                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-sm transition-colors ${item.status === 'resolved' ? 'bg-emerald-500 shadow-emerald-500/30 ring-4 ring-emerald-50' : 'bg-slate-200 text-transparent'}`}>✓</div>
                                                            <span className={`text-[10px] mt-2 font-black ${item.status === 'resolved' ? 'text-emerald-600' : 'text-slate-400'}`}>เสร็จสิ้น</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="text-center py-16 bg-white rounded-[2rem] shadow-sm border border-slate-200/60">
                                        <div className="text-4xl mb-3 block">📋</div>
                                        <h3 className="text-lg font-bold text-slate-800">ยังไม่มีประวัติการแจ้งซ่อม</h3>
                                        <p className="text-slate-500 font-medium text-sm mt-1">ประวัติการส่งเรื่องของคุณจะแสดงที่นี่</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </main>
        </div>
    );
}
