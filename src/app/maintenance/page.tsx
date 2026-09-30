"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/backend/lib/supabase';
import AdminLayout from '@/components/AdminLayout';

export default function MaintenancePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [maintenanceRequests, setMaintenanceRequests] = useState<any[]>([]);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<string | null>(null);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  const router = useRouter();

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // ดึงข้อมูลรายการแจ้งซ่อมทั้งหมดจาก view_maintenance_details ตามกฎ
      const { data: maintenanceData, error: maintenanceError } = await supabase
        .from('view_maintenance_details')
        .select('*')
        .order('created_at', { ascending: false });

      if (maintenanceError) throw maintenanceError;

      setMaintenanceRequests(maintenanceData || []);

    } catch (err: any) {
      console.error("Fetch Data Error:", err);
      setError(err.message || 'เกิดข้อผิดพลาดในการดึงข้อมูลจากฐานข้อมูล');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const checkAuth = async () => {
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

      fetchData();
    };

    checkAuth();
  }, []);

  const filteredRequests = maintenanceRequests.filter(req => {
    const matchRoom = req.room_number?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus = filterStatus === 'all' || req.status === filterStatus;
    return matchRoom && matchStatus;
  });

  const updateMaintenanceStatus = async (id: string, newStatus: string) => {
    try {
      setIsUpdatingStatus(id);

      const { error: updateError } = await supabase
        .from('maintenance_requests')
        .update({ status: newStatus })
        .eq('maintenance_requests_id', id);

      if (updateError) throw updateError;

      // Refresh data
      await fetchData();

    } catch (err: any) {
      console.error("Update Status Error:", err);
      alert("เกิดข้อผิดพลาดในการอัปเดตสถานะ: " + (err.message || "กรุณาลองใหม่อีกครั้ง"));
    } finally {
      setIsUpdatingStatus(null);
    }
  };

  const formatDateThai = (dateString?: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    return date.toLocaleDateString('th-TH', options);
  };

  return (
    <AdminLayout>
      <div className="p-6 sm:p-8 max-w-7xl mx-auto space-y-8 pb-20">

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" className="text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></svg>
              รายการแจ้งซ่อม
            </h1>
            <p className="text-slate-500 font-medium mt-1 text-sm sm:text-base">จัดการคำร้องขอซ่อมแซมและบำรุงรักษาจากผู้เช่าทั้งหมด</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/60 flex flex-col sm:flex-row gap-4 justify-between items-center z-10 relative">
          <div className="flex gap-4 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" className="text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              </div>
              <input 
                type="text" 
                placeholder="ค้นหาเลขห้อง..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
              />
            </div>
            
            <div className="relative w-full sm:w-48">
              <select 
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full appearance-none px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all cursor-pointer font-medium"
              >
                <option value="all">สถานะทั้งหมด</option>
                <option value="pending">รอดำเนินการ</option>
                <option value="in_progress">กำลังดำเนินการ</option>
                <option value="resolved">เสร็จสิ้น</option>
              </select>
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" className="text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 flex items-start gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" className="shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
            <p className="font-semibold text-sm">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl shadow-sm border border-slate-100">
            <div className="w-12 h-12 border-4 border-amber-200 border-t-amber-500 rounded-full animate-spin"></div>
            <p className="mt-4 text-slate-500 font-medium">กำลังโหลดข้อมูลการแจ้งซ่อม...</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[900px]">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-sm font-semibold text-slate-600">
                    <th className="py-4 px-6 w-24">ห้องพัก</th>
                    <th className="py-4 px-6 w-48">ผู้แจ้ง</th>
                    <th className="py-4 px-6">รายละเอียดปัญหา</th>
                    <th className="py-4 px-6 w-48">วันที่และเวลาที่แจ้ง</th>
                    <th className="py-4 px-6 w-32">สถานะปัจจุบัน</th>
                    <th className="py-4 px-6 w-64 text-center">อัปเดตสถานะ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRequests.length > 0 ? (
                    filteredRequests.map((req) => (
                      <tr key={req.maintenance_requests_id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-4 px-6">
                          <span className="inline-flex items-center px-3 py-1.5 rounded-lg bg-slate-100 text-slate-800 font-bold text-sm border border-slate-200/80 shadow-sm">
                            {req.room_number || '-'}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <p className="text-sm font-medium text-slate-800">{req.first_name} {req.last_name}</p>
                        </td>
                        <td className="py-4 px-6">
                          <p className="text-sm text-slate-700 leading-relaxed break-words">{req.issue_details}</p>
                          {req.photo_url && (
                             <button 
                               onClick={() => { setSelectedPhoto(req.photo_url); setIsModalOpen(true); }}
                               className="inline-flex mt-2 text-xs text-blue-500 hover:text-blue-600 font-semibold items-center gap-1 bg-blue-50 px-2 py-1 rounded-md border border-blue-100 transition-colors"
                             >
                               <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                               ดูรูปภาพแนบ
                             </button>
                          )}
                        </td>
                        <td className="py-4 px-6">
                          <span className="text-xs text-slate-600 bg-slate-100 px-2.5 py-1.5 rounded-lg border border-slate-200/50">
                            {formatDateThai(req.created_at)}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          {req.status === 'pending' ? (
                            <span className="inline-flex items-center px-3 py-1 rounded-full bg-rose-50 text-rose-600 font-bold text-xs border border-rose-100 capitalize">
                              รอดำเนินการ
                            </span>
                          ) : req.status === 'in_progress' ? (
                            <span className="inline-flex items-center px-3 py-1 rounded-full bg-amber-50 text-amber-600 font-bold text-xs border border-amber-100 capitalize">
                              กำลังดำเนินการ
                            </span>
                          ) : req.status === 'resolved' ? (
                            <span className="inline-flex items-center px-3 py-1 rounded-full bg-emerald-50 text-emerald-600 font-bold text-xs border border-emerald-100 capitalize">
                              ซ่อมเสร็จสิ้น
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-3 py-1 rounded-full bg-slate-100 text-slate-600 font-bold text-xs border border-slate-200 capitalize">
                              {req.status}
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex gap-2 justify-center">
                            <button
                              onClick={() => updateMaintenanceStatus(req.maintenance_requests_id, 'in_progress')}
                              disabled={isUpdatingStatus === req.maintenance_requests_id || req.status === 'in_progress' || req.status === 'resolved'}
                              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border shadow-sm flex items-center gap-1.5 ${
                                req.status === 'in_progress' || req.status === 'resolved'
                                ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed shadow-none'
                                : 'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200 hover:shadow active:scale-95'
                              }`}
                            >
                              ดำเนินการ
                            </button>
                            <button
                              onClick={() => updateMaintenanceStatus(req.maintenance_requests_id, 'resolved')}
                              disabled={isUpdatingStatus === req.maintenance_requests_id || req.status === 'resolved'}
                              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border shadow-sm flex items-center gap-1.5 ${
                                req.status === 'resolved'
                                ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed shadow-none'
                                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200 hover:shadow active:scale-95'
                              }`}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                              เสร็จสิ้น
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-16 text-center text-slate-500 bg-slate-50/30">
                        <div className="text-4xl mb-3 text-slate-300">✨</div>
                        <p className="font-semibold text-slate-600">ไม่พบรายการแจ้งซ่อม</p>
                        <p className="text-xs text-slate-400 mt-1">ห้องพักทุกห้องอยู่ในสภาพสมบูรณ์</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Photo Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={() => setIsModalOpen(false)}></div>
          <div className="relative bg-white rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh] scale-100 transition-transform">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" className="text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
                รูปภาพประกอบการแจ้งซ่อม
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-200/50 hover:bg-slate-200 text-slate-500 hover:text-slate-700 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 flex flex-col items-center justify-center bg-slate-100/50 min-h-[300px]">
              {selectedPhoto ? (
                <img src={selectedPhoto} alt="Maintenance Photo" className="max-w-full h-auto rounded-xl shadow-sm border border-slate-200" style={{ maxHeight: '65vh', objectFit: 'contain' }} />
              ) : (
                <div className="text-slate-400 py-10 flex flex-col items-center">
                  <span className="text-4xl mb-2">📸</span>
                  <p>ไม่พบรูปภาพ</p>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-slate-100 bg-white flex justify-end">
              <button onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-medium transition-colors shadow-sm active:scale-[0.98]">ปิดหน้าต่าง</button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
