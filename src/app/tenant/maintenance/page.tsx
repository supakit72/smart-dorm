"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function MaintenanceRequest() {
    const [issueDetails, setIssueDetails] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!issueDetails.trim()) {
            alert('กรุณากรอกรายละเอียดปัญหา');
            return;
        }

        try {
            setIsSubmitting(true);

            const { error } = await supabase
                .from('maintenance_requests')
                .insert([
                    {
                        room_id: 3,
                        tenant_id: 3,
                        issue_details: issueDetails,
                        status: 'pending'
                        // photo_url is left empty for now
                    }
                ]);

            if (error) throw error;

            alert('ส่งเรื่องแจ้งซ่อมเรียบร้อยแล้ว');
            setIssueDetails(''); // ล้างข้อมูลในฟอร์ม

        } catch (err: any) {
            console.error("Submit error:", err);
            alert("เกิดข้อผิดพลาดในการส่งเรื่อง: " + (err.message || "กรุณาลองใหม่อีกครั้ง"));
        } finally {
            setIsSubmitting(false);
        }
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

                        {/* ในอนาคตสามารถเพิ่ม input file สำหรับอัปโหลดรูปภาพตรงนี้ได้ */}
                        {/* <div className="space-y-2">...</div> */}

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

            </main>
        </div>
    );
}
