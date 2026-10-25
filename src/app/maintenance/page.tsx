"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/backend/lib/supabase';
import AdminLayout from '@/components/AdminLayout';
import * as XLSX from 'xlsx';

export default function MaintenancePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [maintenanceRequests, setMaintenanceRequests] = useState<any[]>([]);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  
  // Mobile Tab State
  const [mobileTab, setMobileTab] = useState<'pending' | 'in_progress' | 'resolved'>('pending');

  // Pagination states (5 items per page)
  const [pagePending, setPagePending] = useState(1);
  const [pageInProgress, setPageInProgress] = useState(1);
  const [pageResolved, setPageResolved] = useState(1);
  const itemsPerPage = 5;

  // Photo Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  // Delete Modal
  const [requestToDelete, setRequestToDelete] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const router = useRouter();

  // Reset pagination to page 1 when search query or mobile tab changes
  useEffect(() => {
    setPagePending(1);
    setPageInProgress(1);
    setPageResolved(1);
  }, [searchQuery, mobileTab]);

  // Read initial search query from URL (e.g. /maintenance?room=101 or ?search=101)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const queryParam = params.get('room') || params.get('search');
      if (queryParam) {
        setSearchQuery(queryParam);
      }
    }
  }, []);

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

  const handleDeleteRequest = async () => {
    if (!requestToDelete) return;
    try {
      setIsDeleting(true);
      const idToDelete = requestToDelete.maintenance_requests_id;

      // Optimistic update
      setMaintenanceRequests(prev => prev.filter(req => req.maintenance_requests_id !== idToDelete));

      const { error: deleteError } = await supabase
        .from('maintenance_requests')
        .delete()
        .eq('maintenance_requests_id', idToDelete);

      if (deleteError) {
        throw deleteError;
      }

      setRequestToDelete(null);
    } catch (err: any) {
      console.error("Delete Maintenance Request Error:", err);
      alert("เกิดข้อผิดพลาดในการลบรายการแจ้งซ่อม: " + (err.message || "กรุณาลองใหม่อีกครั้ง"));
      fetchData();
    } finally {
      setIsDeleting(false);
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

  // Export to Excel function
  const handleExportExcel = () => {
    if (!filteredRequests || filteredRequests.length === 0) {
      alert('ไม่พบข้อมูลรายการแจ้งซ่อมสำหรับส่งออก');
      return;
    }

    const formatDateTimeForExcel = (dateString?: string) => {
      if (!dateString) return '-';
      const d = new Date(dateString);
      if (isNaN(d.getTime())) return dateString;
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      return `${day}/${month}/${year} ${hours}:${minutes}`;
    };

    const statusMap: Record<string, string> = {
      pending: 'รอดำเนินการ',
      in_progress: 'กำลังดำเนินการ',
      resolved: 'เสร็จสิ้น'
    };

    const exportData = filteredRequests.map(req => {
      const match = req.issue_details?.match(/^\[(.*?)\]\s*(.*)$/);
      const category = match ? match[1] : 'ทั่วไป';
      const detail = match ? match[2] : (req.issue_details || '-');
      const tenantName = `${req.first_name || ''} ${req.last_name || ''}`.trim() || '-';
      const thStatus = statusMap[req.status] || req.status || '-';

      return {
        'วันที่แจ้ง': formatDateTimeForExcel(req.created_at),
        'เลขห้อง': req.room_number ? `ห้อง ${req.room_number}` : '-',
        'ชื่อผู้เช่า': tenantName,
        'เบอร์โทรศัพท์': req.phone_number || '-',
        'หมวดหมู่งานซ่อม': category,
        'รายละเอียดปัญหา': detail,
        'สถานะปัจจุบัน': thStatus
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);

    // Auto-size columns for clear readability
    worksheet['!cols'] = [
      { wch: 18 }, // วันที่แจ้ง (DD/MM/YYYY HH:mm)
      { wch: 12 }, // เลขห้อง
      { wch: 22 }, // ชื่อผู้เช่า
      { wch: 15 }, // เบอร์โทรศัพท์
      { wch: 16 }, // หมวดหมู่งานซ่อม
      { wch: 40 }, // รายละเอียดปัญหา
      { wch: 16 }, // สถานะปัจจุบัน
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Maintenance");

    const dateStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `maintenance_report_${dateStr}.xlsx`);
  };

  // Grouped lists for Kanban
  const pendingList = filteredRequests.filter(req => req.status === 'pending');
  const inProgressList = filteredRequests.filter(req => req.status === 'in_progress');
  const resolvedList = filteredRequests.filter(req => req.status === 'resolved');

  // Pagination calculations (5 items per page)
  const totalPendingPages = Math.ceil(pendingList.length / itemsPerPage) || 1;
  const paginatedPending = pendingList.slice((pagePending - 1) * itemsPerPage, pagePending * itemsPerPage);

  const totalInProgressPages = Math.ceil(inProgressList.length / itemsPerPage) || 1;
  const paginatedInProgress = inProgressList.slice((pageInProgress - 1) * itemsPerPage, pageInProgress * itemsPerPage);

  const totalResolvedPages = Math.ceil(resolvedList.length / itemsPerPage) || 1;
  const paginatedResolved = resolvedList.slice((pageResolved - 1) * itemsPerPage, pageResolved * itemsPerPage);

  // Safe page boundary
  useEffect(() => {
    if (pagePending > totalPendingPages) setPagePending(totalPendingPages);
    if (pageInProgress > totalInProgressPages) setPageInProgress(totalInProgressPages);
    if (pageResolved > totalResolvedPages) setPageResolved(totalResolvedPages);
  }, [totalPendingPages, totalInProgressPages, totalResolvedPages, pagePending, pageInProgress, pageResolved]);

  // Pagination Controls Component
  const PaginationControls = ({
    currentPage,
    totalPages,
    onPageChange,
    totalItems,
    colorTheme = 'blue'
  }: {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    totalItems: number;
    colorTheme?: 'amber' | 'blue' | 'emerald';
  }) => {
    if (totalPages <= 1) return null;

    const activeColor = 
      colorTheme === 'amber' ? 'bg-amber-600 text-white shadow-amber-600/30 ring-2 ring-amber-500/20' :
      colorTheme === 'emerald' ? 'bg-emerald-600 text-white shadow-emerald-600/30 ring-2 ring-emerald-500/20' :
      'bg-blue-600 text-white shadow-blue-600/30 ring-2 ring-blue-500/20';

    const getPages = () => {
      const pages: (number | string)[] = [];
      if (totalPages <= 5) {
        for (let i = 1; i <= totalPages; i++) pages.push(i);
      } else {
        if (currentPage <= 3) {
          pages.push(1, 2, 3, '...', totalPages);
        } else if (currentPage >= totalPages - 2) {
          pages.push(1, '...', totalPages - 2, totalPages - 1, totalPages);
        } else {
          pages.push(1, '...', currentPage, '...', totalPages);
        }
      }
      return pages;
    };

    return (
      <div className="flex items-center justify-between pt-3 pb-1 border-t border-slate-200/80 mt-2 px-1 text-xs">
        <span className="text-[11px] font-bold text-slate-500">
          หน้า <span className="text-slate-800">{currentPage}</span>/{totalPages}
          <span className="hidden sm:inline text-slate-400 font-normal"> ({totalItems} รายการ)</span>
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer font-black text-xs shadow-xs"
            title="หน้าก่อนหน้า"
          >
            &lt;
          </button>

          {getPages().map((page, idx) => {
            if (page === '...') {
              return (
                <span key={`ellipsis-${idx}`} className="px-1 text-slate-400 select-none text-xs">
                  ...
                </span>
              );
            }
            const isCurrent = page === currentPage;
            return (
              <button
                key={`page-${page}`}
                type="button"
                onClick={() => onPageChange(Number(page))}
                className={`min-w-[28px] h-7 px-1.5 rounded-lg font-bold text-xs transition-all cursor-pointer flex items-center justify-center shadow-xs ${
                  isCurrent
                    ? `${activeColor} shadow-sm`
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {page}
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer font-black text-xs shadow-xs"
            title="หน้าถัดไป"
          >
            &gt;
          </button>
        </div>
      </div>
    );
  };

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
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] sm:text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-md font-medium border border-slate-200/50">
              {formatDateThai(req.created_at)}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setRequestToDelete(req);
              }}
              title="ลบรายการแจ้งซ่อม"
              className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-all active:scale-95 cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
            </button>
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
            <div className="flex gap-2.5 sm:gap-3 mt-3 flex-wrap">
              <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-amber-50 text-amber-600 border border-amber-100">รอซ่อม {pendingList.length}</span>
              <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-blue-50 text-blue-600 border border-blue-100">กำลังซ่อม {inProgressList.length}</span>
              <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-600 border border-emerald-100">เสร็จสิ้น {resolvedList.length}</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 sm:w-64">
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

            {/* Export Excel Button */}
            <button
              type="button"
              onClick={handleExportExcel}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl transition-all shadow-sm active:scale-95 whitespace-nowrap cursor-pointer shrink-0"
              title="ส่งออกรายงานเป็น Excel (.xlsx)"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
              <span>ส่งออก Excel</span>
            </button>
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
                  <div className="flex flex-col gap-3">
                    {paginatedPending.map(req => <MaintenanceCard key={req.maintenance_requests_id} req={req} />)}
                    <div className="bg-white px-3 py-2 rounded-2xl border border-slate-200/60 shadow-xs">
                      <PaginationControls currentPage={pagePending} totalPages={totalPendingPages} onPageChange={setPagePending} totalItems={pendingList.length} colorTheme="amber" />
                    </div>
                  </div>
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
                  <div className="flex flex-col gap-3">
                    {paginatedInProgress.map(req => <MaintenanceCard key={req.maintenance_requests_id} req={req} />)}
                    <div className="bg-white px-3 py-2 rounded-2xl border border-slate-200/60 shadow-xs">
                      <PaginationControls currentPage={pageInProgress} totalPages={totalInProgressPages} onPageChange={setPageInProgress} totalItems={inProgressList.length} colorTheme="blue" />
                    </div>
                  </div>
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
                  <div className="flex flex-col gap-3">
                    {paginatedResolved.map(req => <MaintenanceCard key={req.maintenance_requests_id} req={req} />)}
                    <div className="bg-white px-3 py-2 rounded-2xl border border-slate-200/60 shadow-xs">
                      <PaginationControls currentPage={pageResolved} totalPages={totalResolvedPages} onPageChange={setPageResolved} totalItems={resolvedList.length} colorTheme="emerald" />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Mobile View (Tab Switcher) */}
            <div className="md:hidden space-y-5 pb-8">
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
                {mobileTab === 'pending' && (
                  <>
                    {pendingList.length === 0 ? (
                      <div className="py-16 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-white/50 text-slate-400 font-medium">ไม่มีรายการรอดำเนินการ</div>
                    ) : (
                      <>
                        {paginatedPending.map(req => <MaintenanceCard key={req.maintenance_requests_id} req={req} isMobile />)}
                        <div className="bg-white px-4 py-2.5 rounded-2xl border border-slate-200/60 shadow-xs">
                          <PaginationControls currentPage={pagePending} totalPages={totalPendingPages} onPageChange={setPagePending} totalItems={pendingList.length} colorTheme="amber" />
                        </div>
                      </>
                    )}
                  </>
                )}

                {mobileTab === 'in_progress' && (
                  <>
                    {inProgressList.length === 0 ? (
                      <div className="py-16 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-white/50 text-slate-400 font-medium">ไม่มีรายการที่กำลังดำเนินการ</div>
                    ) : (
                      <>
                        {paginatedInProgress.map(req => <MaintenanceCard key={req.maintenance_requests_id} req={req} isMobile />)}
                        <div className="bg-white px-4 py-2.5 rounded-2xl border border-slate-200/60 shadow-xs">
                          <PaginationControls currentPage={pageInProgress} totalPages={totalInProgressPages} onPageChange={setPageInProgress} totalItems={inProgressList.length} colorTheme="blue" />
                        </div>
                      </>
                    )}
                  </>
                )}

                {mobileTab === 'resolved' && (
                  <>
                    {resolvedList.length === 0 ? (
                      <div className="py-16 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-white/50 text-slate-400 font-medium">ไม่มีรายการที่เสร็จสิ้น</div>
                    ) : (
                      <>
                        {paginatedResolved.map(req => <MaintenanceCard key={req.maintenance_requests_id} req={req} isMobile />)}
                        <div className="bg-white px-4 py-2.5 rounded-2xl border border-slate-200/60 shadow-xs">
                          <PaginationControls currentPage={pageResolved} totalPages={totalResolvedPages} onPageChange={setPageResolved} totalItems={resolvedList.length} colorTheme="emerald" />
                        </div>
                      </>
                    )}
                  </>
                )}
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

      {/* Delete Confirmation Modal */}
      {requestToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in transition-opacity" 
            onClick={() => !isDeleting && setRequestToDelete(null)}
          />
          <div className="relative bg-white rounded-3xl p-6 sm:p-7 max-w-sm w-full shadow-2xl border border-slate-100 z-10 animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-500 border border-rose-100 flex items-center justify-center text-2xl mb-4 mx-auto">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
            </div>

            <h3 className="text-base sm:text-lg font-black text-slate-800 text-center mb-1.5">
              ยืนยันการลบรายการแจ้งซ่อม
            </h3>

            <p className="text-xs sm:text-sm text-slate-500 text-center mb-4 leading-relaxed">
              คุณแน่ใจหรือไม่ว่าต้องการลบรายการแจ้งซ่อมนี้ออกจากระบบ? ข้อมูลที่ลบจะไม่สามารถกู้คืนได้
            </p>

            <div className="bg-slate-50 rounded-2xl p-3.5 mb-5 border border-slate-100 text-xs text-slate-600 space-y-1">
              <div><span className="font-bold text-slate-700">ห้องพัก:</span> ห้อง {requestToDelete.room_number || '-'}</div>
              <div><span className="font-bold text-slate-700">ผู้แจ้ง:</span> {requestToDelete.first_name} {requestToDelete.last_name}</div>
              <div className="line-clamp-2"><span className="font-bold text-slate-700">ปัญหา:</span> {requestToDelete.issue_details}</div>
            </div>

            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setRequestToDelete(null)}
                disabled={isDeleting}
                className="flex-1 py-3 px-4 rounded-xl font-bold text-xs sm:text-sm bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors disabled:opacity-50 cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleDeleteRequest}
                disabled={isDeleting}
                className="flex-1 py-3 px-4 rounded-xl font-bold text-xs sm:text-sm bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-500/20 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {isDeleting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    กำลังลบ...
                  </>
                ) : (
                  'ยืนยันลบ'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
