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

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  
  // Mobile Tab State
  const [mobileTab, setMobileTab] = useState<'pending' | 'in_progress' | 'resolved'>('pending');

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  const router = useRouter();

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

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
    const searchLower = searchQuery.toLowerCase();
    const matchRoom = req.room_number?.toLowerCase().includes(searchLower);
    const matchDetail = req.issue_details?.toLowerCase().includes(searchLower);
    const matchName = `${req.first_name} ${req.last_name}`.toLowerCase().includes(searchLower);
    return matchRoom || matchDetail || matchName;
  });

  const updateMaintenanceStatus = async (id: string, newStatus: string) => {
    try {
      setIsUpdatingStatus(id);

      // Optimistic update
      setMaintenanceRequests(prev => prev.map(req => 
        req.maintenance_requests_id === id ? { ...req, status: newStatus } : req
      ));

      const { error: updateError } = await supabase
        .from('maintenance_requests')
        .update({ status: newStatus })
        .eq('maintenance_requests_id', id);

      if (updateError) {
        throw updateError;
      }

    } catch (err: any) {
      console.error("Update Status Error:", err);
      alert("เกิดข้อผิดพลาดในการอัปเดตสถานะ: " + (err.message || "กรุณาลองใหม่อีกครั้ง"));
      // Revert if error
      fetchData();
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

  // Grouped lists for Kanban
  const pendingList = filteredRequests.filter(req => req.status === 'pending');
  const inProgressList = filteredRequests.filter(req => req.status === 'in_progress');
  const resolvedList = filteredRequests.filter(req => req.status === 'resolved');

  // Kanban Card Component
  const MaintenanceCard = ({ req, isMobile = false }: { req: any, isMobile?: boolean }) => {
    const isPending = req.status === 'pending';
    const isInProgress = req.status === 'in_progress';
    const isResolved = req.status === 'resolved';

    const cardTheme = isPending 
      ? 'border-amber-200/60 hover:border-amber-400 bg-white' 
      : isInProgress 
      ? 'border-blue-200/60 hover:border-blue-400 bg-white' 
      : 'border-emerald-200/60 hover:border-emerald-400 bg-slate-50/50 opacity-90';
    
    return (
      <div className={`rounded-2xl p-4 sm:p-5 border shadow-sm transition-all hover:shadow-md hover:-translate-y-1 flex flex-col ${cardTheme}`}>
        <div className="flex justify-between items-start mb-3">
          <div>
            <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold mb-2 ${
              isPending ? 'bg-amber-100 text-amber-700' : 
              isInProgress ? 'bg-blue-100 text-blue-700' : 
              'bg-emerald-100 text-emerald-700'
            }`}>
              {isPending ? 'รอดำเนินการ' : isInProgress ? 'กำลังดำเนินการ' : 'เสร็จสิ้น'}
            </span>
            <h4 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">Room {req.room_number || '-'}</h4>
          </div>
          <div className="text-right">
            <span className="text-[10px] sm:text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-md font-medium border border-slate-200/50">
              {formatDateThai(req.created_at)}
            </span>
          </div>
        </div>

        <div className="mb-4">
          <p className="text-sm font-semibold text-slate-700 flex items-center gap-1.5 mb-1">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
            {req.first_name} {req.last_name}
          </p>
          {req.phone_number && (
            <a href={`tel:${req.phone_number}`} className="text-xs font-medium text-blue-500 hover:text-blue-600 flex items-center gap-1.5 transition-colors group">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" className="group-hover:animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
              {req.phone_number}
            </a>
          )}
        </div>

        <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 mb-4 flex-1">
          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{req.issue_details}</p>
        </div>

        {req.photo_url && (
          <button
            onClick={() => { setSelectedPhoto(req.photo_url); setIsModalOpen(true); }}
            className="w-full flex justify-center text-xs text-blue-600 hover:text-blue-700 font-semibold items-center gap-1.5 bg-blue-50/50 hover:bg-blue-100 px-3 py-2 rounded-xl border border-blue-100/50 transition-colors mb-4"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
            ดูรูปภาพประกอบ
          </button>
        )}

        {/* Action Buttons */}
        <div className="mt-auto pt-4 border-t border-slate-100 flex flex-col sm:flex-row gap-2">
          {isPending && (
            <button
              onClick={() => updateMaintenanceStatus(req.maintenance_requests_id, 'in_progress')}
              disabled={isUpdatingStatus === req.maintenance_requests_id}
              className={`w-full py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-sm flex justify-center items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white active:scale-95 disabled:opacity-50`}
            >
              รับเรื่อง / กำลังซ่อม
            </button>
          )}
          {isInProgress && (
            <>
              <button
                onClick={() => updateMaintenanceStatus(req.maintenance_requests_id, 'pending')}
                disabled={isUpdatingStatus === req.maintenance_requests_id}
                className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all border shadow-sm flex justify-center items-center bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200 active:scale-95 disabled:opacity-50`}
              >
                ย้อนกลับ
              </button>
              <button
                onClick={() => updateMaintenanceStatus(req.maintenance_requests_id, 'resolved')}
                disabled={isUpdatingStatus === req.maintenance_requests_id}
                className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-sm flex justify-center items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white active:scale-95 disabled:opacity-50`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                เสร็จสิ้น
              </button>
            </>
          )}
          {isResolved && (
            <button
              onClick={() => updateMaintenanceStatus(req.maintenance_requests_id, 'in_progress')}
              disabled={isUpdatingStatus === req.maintenance_requests_id}
              className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all border shadow-sm flex justify-center items-center bg-white hover:bg-slate-50 text-slate-500 border-slate-200 active:scale-95 disabled:opacity-50`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>
              แก้ไขสถานะกลับไปกำลังซ่อม
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <AdminLayout>
      <div className="space-y-6">

        {/* Header & Quick Stats */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-amber-100 text-amber-500 flex items-center justify-center shadow-sm">
                🛠️
              </span>
              รายการแจ้งซ่อม
            </h1>
            <div className="flex gap-3 mt-3">
              <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-amber-50 text-amber-600 border border-amber-100">รอซ่อม {pendingList.length}</span>
              <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-blue-50 text-blue-600 border border-blue-100">กำลังซ่อม {inProgressList.length}</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <div className="relative w-full sm:w-64">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" className="text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              </div>
              <input
                type="text"
                placeholder="ค้นหาเลขห้อง หรือปัญหา..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all placeholder:text-slate-400"
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-rose-50 text-rose-600 p-4 rounded-xl border border-rose-100 flex items-start gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" className="shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
            <p className="font-semibold text-sm">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white/50 rounded-3xl border border-slate-200/50">
            <div className="w-12 h-12 border-4 border-amber-200 border-t-amber-500 rounded-full animate-spin"></div>
            <p className="mt-4 text-slate-500 font-bold">กำลังโหลดข้อมูลการแจ้งซ่อม...</p>
          </div>
        ) : (
          <>
            {/* Desktop Kanban Board (Hidden on mobile) */}
            <div className="hidden md:grid grid-cols-3 gap-6 items-start">
              {/* Column: Pending */}
              <div className="flex flex-col gap-4">
                <h3 className="font-bold text-amber-700 bg-amber-100/50 px-4 py-3 rounded-2xl border border-amber-200/60 flex justify-between items-center shadow-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                    รอดำเนินการ
                  </div>
                  <span className="bg-white text-amber-600 px-2.5 py-0.5 rounded-lg text-sm shadow-sm">{pendingList.length}</span>
                </h3>
                {pendingList.length === 0 ? (
                  <div className="py-10 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-white/30 text-slate-400 text-sm font-medium">ไม่มีรายการรอดำเนินการ</div>
                ) : (
                  pendingList.map(req => <MaintenanceCard key={req.maintenance_requests_id} req={req} />)
                )}
              </div>

              {/* Column: In Progress */}
              <div className="flex flex-col gap-4">
                <h3 className="font-bold text-blue-700 bg-blue-100/50 px-4 py-3 rounded-2xl border border-blue-200/60 flex justify-between items-center shadow-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                    กำลังดำเนินการ
                  </div>
                  <span className="bg-white text-blue-600 px-2.5 py-0.5 rounded-lg text-sm shadow-sm">{inProgressList.length}</span>
                </h3>
                {inProgressList.length === 0 ? (
                  <div className="py-10 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-white/30 text-slate-400 text-sm font-medium">ไม่มีรายการที่กำลังดำเนินการ</div>
                ) : (
                  inProgressList.map(req => <MaintenanceCard key={req.maintenance_requests_id} req={req} />)
                )}
              </div>

              {/* Column: Resolved */}
              <div className="flex flex-col gap-4">
                <h3 className="font-bold text-emerald-700 bg-emerald-100/50 px-4 py-3 rounded-2xl border border-emerald-200/60 flex justify-between items-center shadow-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    เสร็จสิ้น
                  </div>
                  <span className="bg-white text-emerald-600 px-2.5 py-0.5 rounded-lg text-sm shadow-sm">{resolvedList.length}</span>
                </h3>
                {resolvedList.length === 0 ? (
                  <div className="py-10 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-white/30 text-slate-400 text-sm font-medium">ไม่มีรายการที่เสร็จสิ้น</div>
                ) : (
                  resolvedList.map(req => <MaintenanceCard key={req.maintenance_requests_id} req={req} />)
                )}
              </div>
            </div>

            {/* Mobile View (Tab Switcher) */}
            <div className="md:hidden space-y-5">
              <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200/60 shadow-inner overflow-x-auto hide-scrollbar">
                <button 
                  onClick={() => setMobileTab('pending')} 
                  className={`flex-1 min-w-[100px] px-3 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${mobileTab === 'pending' ? 'bg-white shadow-sm text-amber-600' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  รอซ่อม ({pendingList.length})
                </button>
                <button 
                  onClick={() => setMobileTab('in_progress')} 
                  className={`flex-1 min-w-[100px] px-3 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${mobileTab === 'in_progress' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  กำลังซ่อม ({inProgressList.length})
                </button>
                <button 
                  onClick={() => setMobileTab('resolved')} 
                  className={`flex-1 min-w-[100px] px-3 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${mobileTab === 'resolved' ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  เสร็จสิ้น ({resolvedList.length})
                </button>
              </div>

              <div className="flex flex-col gap-4">
                {mobileTab === 'pending' && pendingList.length === 0 && (
                   <div className="py-16 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-white/50 text-slate-400 font-medium">ไม่มีรายการรอดำเนินการ</div>
                )}
                {mobileTab === 'pending' && pendingList.map(req => <MaintenanceCard key={req.maintenance_requests_id} req={req} isMobile />)}

                {mobileTab === 'in_progress' && inProgressList.length === 0 && (
                   <div className="py-16 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-white/50 text-slate-400 font-medium">ไม่มีรายการที่กำลังดำเนินการ</div>
                )}
                {mobileTab === 'in_progress' && inProgressList.map(req => <MaintenanceCard key={req.maintenance_requests_id} req={req} isMobile />)}

                {mobileTab === 'resolved' && resolvedList.length === 0 && (
                   <div className="py-16 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-white/50 text-slate-400 font-medium">ไม่มีรายการที่เสร็จสิ้น</div>
                )}
                {mobileTab === 'resolved' && resolvedList.map(req => <MaintenanceCard key={req.maintenance_requests_id} req={req} isMobile />)}
              </div>
            </div>
          </>
        )}

      </div>

      {/* Photo Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm transition-opacity" onClick={() => setIsModalOpen(false)}></div>
          <div className="relative bg-white rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh] scale-100 transition-transform animate-in zoom-in-95">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <span className="text-blue-500">📸</span> รูปภาพประกอบการแจ้งซ่อม
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-200/50 hover:bg-slate-200 text-slate-500 hover:text-slate-700 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 flex items-center justify-center bg-slate-900/5 min-h-[300px]">
              {selectedPhoto ? (
                <img src={selectedPhoto} alt="Maintenance Photo" className="max-w-full h-auto rounded-xl shadow-lg border border-slate-200/50" style={{ maxHeight: '70vh', objectFit: 'contain' }} />
              ) : (
                <div className="text-slate-400 py-10 flex flex-col items-center">
                  <span className="text-4xl mb-2 opacity-50">📸</span>
                  <p className="font-medium">ไม่พบรูปภาพ</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
