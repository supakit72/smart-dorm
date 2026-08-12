"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/backend/lib/supabase';
import AdminLayout from '@/components/AdminLayout';
import Link from 'next/link';

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summaryData, setSummaryData] = useState<any[]>([]);
  const [roomData, setRoomData] = useState<any[]>([]);
  const [allInvoices, setAllInvoices] = useState<any[]>([]);
  const [maintenanceRequests, setMaintenanceRequests] = useState<any[]>([]);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<string | null>(null);

  const getCycleDates = (cutoff: number) => {
    const today = new Date();
    let startYear = today.getFullYear();
    let startMonth = today.getMonth(); // 0-11
    
    if (today.getDate() < cutoff) {
      startMonth -= 1;
      if (startMonth < 0) {
        startMonth = 11;
        startYear -= 1;
      }
    }
    
    let endYear = startYear;
    let endMonth = startMonth + 1;
    if (endMonth > 11) {
      endMonth = 0;
      endYear += 1;
    }
    
    const startObj = new Date(startYear, startMonth, cutoff);
    const endObj = new Date(endYear, endMonth, cutoff - 1);
    
    const startStr = new Date(startObj.getTime() - startObj.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    const endStr = new Date(endObj.getTime() - endObj.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    
    return { startStr, endStr };
  };

  // Top Filter State
  const initialCycle = getCycleDates(27);
  const [startDate, setStartDate] = useState(initialCycle.startStr);
  const [endDate, setEndDate] = useState(initialCycle.endStr);
  const [filterFloor, setFilterFloor] = useState('all');
  const [cutoffDay, setCutoffDay] = useState(27);

  // State สำหรับจัดการ Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSlipImage, setSelectedSlipImage] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // ดึงข้อมูลบิลทั้งหมดจากมุมมอง view_invoice_details
      const { data: invoices, error: invoiceError } = await supabase
        .from('view_invoice_details')
        .select('*')
        .order('month_year', { ascending: false });

      if (invoiceError) throw invoiceError;

      // ดึงข้อมูลการตั้งค่าหอพัก (cutoff_day)
      const { data: settingsData } = await supabase.from('dorm_settings').select('cutoff_day').limit(1).single();
      if (settingsData && settingsData.cutoff_day) {
        setCutoffDay(settingsData.cutoff_day);
        const cycle = getCycleDates(settingsData.cutoff_day);
        // Only update if they were still default (or we just want to force sync on load)
        setStartDate(cycle.startStr);
        setEndDate(cycle.endStr);
      }

      // ดึงข้อมูลห้องทั้งหมดจากตาราง rooms
      const { data: rooms, error: roomsError } = await supabase
        .from('rooms')
        .select('*')
        .order('room_number', { ascending: true });
      if (roomsError) throw roomsError;

      // ดึงข้อมูลสัญญาที่ยัง active จากมุมมอง view_active_contracts
      const { data: activeContracts, error: contractsError } = await supabase
        .from('view_active_contracts')
        .select('*');
      if (contractsError) throw contractsError;

      // ดึงข้อมูลรายการแจ้งซ่อม (เฉพาะที่ไม่ใช่ resolved)
      const { data: maintenanceData, error: maintenanceError } = await supabase
        .from('maintenance_requests')
        .select(`
          maintenance_requests_id,
          issue_details,
          status,
          room_id,
          created_at,
          rooms (room_number)
        `)
        .neq('status', 'resolved')
        .order('created_at', { ascending: false });

      if (maintenanceError) throw maintenanceError;

      setMaintenanceRequests(maintenanceData || []);

      // การคำนวณ Metrics ถูกย้ายไปทำแบบ Dynamic ในตอน Render เพื่อให้รองรับ Filter

      // คำนวณยอดบิลทุกรายการ
      const invoicesWithBreakdown = invoices?.map(inv => ({
          ...inv,
          calculatedTotal: Number(inv.total_amount || 0),
          room_number: inv.room_number || '-'
      })) || [];

      setAllInvoices(invoicesWithBreakdown);

      // คำนวณ Room Status
      const activeRoomIds = new Set(activeContracts?.map(c => c.room_id));

      const computedRoomData = rooms?.map(room => {
        let statusText = "ว่าง";
        let colorClass = "bg-emerald-500";
        let ringClass = "ring-emerald-50";

        if (activeRoomIds.has(room.room_id)) {
          statusText = "มีผู้เช่า";
          colorClass = "bg-red-500";
          ringClass = "ring-red-50";
        } else if (room.status === 'maintenance' || room.status === 'แจ้งซ่อม') {
          statusText = "แจ้งซ่อม";
          colorClass = "bg-amber-500";
          ringClass = "ring-amber-50";
        }

        return {
          number: room.room_number,
          floor: room.floor,
          status: statusText,
          color: colorClass,
          ring: ringClass
        };
      }) || [];

      setRoomData(computedRoomData);

    } catch (err: any) {
      console.error("Fetch Data Error:", err);
      setError(err.message || 'เกิดข้อผิดพลาดในการดึงข้อมูลจากฐานข้อมูล');
    } finally {
      setLoading(false);
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

  // ฟังก์ชันสำหรับเปิดปิด Modal สลิป
  const openSlipModal = (imageUrl: string) => {
    setSelectedSlipImage(imageUrl);
    setIsModalOpen(true);
  };

  const closeSlipModal = () => {
    setIsModalOpen(false);
    setSelectedSlipImage(null);
  };

  // ดักจับการกดปุ่ม ESC เพื่อปิด Modal
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeSlipModal();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  const formatDateThai = (dateString?: string) => {
    if (!dateString) return '-';
    // เพิ่ม timezone offset เพื่อให้ตรงเวลาไทย
    const date = new Date(dateString);
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    return date.toLocaleDateString('th-TH', options) + ' น.';
  };

  // Loading State
  if (loading && allInvoices.length === 0) { // ลดการกระพริบถ้ามีข้อมูลอยู่แล้ว
    return (
      <div className="min-h-screen bg-slate-50/50 flex flex-col items-center justify-center font-sans text-slate-900">
        <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
        <h2 className="text-xl font-bold text-slate-700 tracking-tight">กำลังโหลดข้อมูล...</h2>
        <p className="text-sm text-slate-500 mt-2">โปรดรอสักครู่ ระบบกำลังดึงข้อมูล</p>
      </div>
    );
  }

  // Error State
  if (error) {
    return (
      <div className="min-h-screen bg-slate-50/50 flex items-center justify-center font-sans px-4">
        <div className="bg-white border border-red-100 rounded-2xl p-8 max-w-md w-full text-center shadow-lg shadow-red-100/50">
          <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-5 text-3xl">⚠️</div>
          <h2 className="text-xl font-bold text-slate-800 mb-2 tracking-tight">ไม่สามารถโหลดข้อมูลได้</h2>
          <p className="text-sm text-slate-600 bg-slate-50 p-4 rounded-xl border border-slate-100 mb-6 font-mono text-left break-words">
            {error}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium py-3 px-6 rounded-xl transition-all shadow-md hover:shadow-lg active:scale-[0.98]"
          >
            ลองใหม่อีกครั้ง
          </button>
        </div>
      </div>
    );
  }

  // --- Derived State (Logic การกรองข้อมูล) ---
  const uniqueFloors = Array.from(new Set(roomData.map(r => r.floor).filter(Boolean))).sort((a, b) => Number(a) - Number(b));

  const filteredRooms = filterFloor === 'all' 
    ? roomData 
    : roomData.filter(r => String(r.floor) === filterFloor);

  const filteredInvoices = allInvoices.filter(inv => {
    let invDateObj;
    if (inv.created_at) {
      invDateObj = new Date(inv.created_at);
    } else if (inv.month_year) {
      if (inv.month_year.includes('/')) {
        const parts = inv.month_year.split('/');
        if (parts.length === 3) {
          invDateObj = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
        }
      } else {
        invDateObj = new Date(inv.month_year);
      }
    }

    if (!invDateObj || isNaN(invDateObj.getTime())) return true;

    // Convert to local YYYY-MM-DD
    const invDateStr = new Date(invDateObj.getTime() - invDateObj.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

    if (startDate && invDateStr < startDate) return false;
    if (endDate && invDateStr > endDate) return false;
    return true;
  });

  // คำนวณ Metrics จากข้อมูลที่ถูกกรองแล้ว
  const draftInvoices = filteredInvoices.filter(inv => inv.status === 'draft');
  const unpaidInvoices = filteredInvoices.filter(inv => inv.status === 'unpaid' || inv.status === 'pending' || inv.status === 'รอชำระ');
  const totalUnpaidAmount = unpaidInvoices.reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0);

  const totalFilteredRooms = filteredRooms.length;
  const occupiedFilteredRooms = filteredRooms.filter(r => r.status === 'มีผู้เช่า').length;
  const occupancyRate = totalFilteredRooms > 0 ? Math.round((occupiedFilteredRooms / totalFilteredRooms) * 100) : 0;

  const occupiedRoomNumbers = new Set(roomData.filter(r => r.status === 'มีผู้เช่า').map(r => r.number));
  const totalOccupiedRooms = occupiedRoomNumbers.size;

  const occupiedRoomsWithInvoice = new Set(
    filteredInvoices
      .filter(inv => occupiedRoomNumbers.has(inv.room_number))
      .map(inv => inv.room_number)
  ).size;

  const missingInvoicesCount = totalOccupiedRooms - occupiedRoomsWithInvoice;

  const dynamicMetrics = {
    totalRooms: totalFilteredRooms,
    occupiedRooms: occupiedFilteredRooms,
    occupancyRate,
    draftCount: draftInvoices.length,
    unpaidCount: unpaidInvoices.length,
    unpaidAmount: totalUnpaidAmount,
    totalCurrentInvoices: occupiedRoomsWithInvoice,
    totalOccupiedRooms: totalOccupiedRooms,
    missingInvoicesCount: missingInvoicesCount
  };

  const handleRefresh = () => {
    const cycle = getCycleDates(cutoffDay);
    setStartDate(cycle.startStr);
    setEndDate(cycle.endStr);
    setFilterFloor('all');
    fetchData();
  };

  return (
    <AdminLayout>
      <div className="space-y-8">

        {/* Top Filter Bar */}
        <section className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200/60 flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
            <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-xl border border-slate-200">
              <input 
                type="date" 
                value={startDate} 
                onChange={e => setStartDate(e.target.value)}
                className="bg-transparent border-none outline-none text-sm font-medium text-slate-700 cursor-pointer"
                title="วันที่เริ่มต้น"
              />
              <span className="text-slate-400 font-bold text-sm">ถึง</span>
              <input 
                type="date" 
                value={endDate} 
                onChange={e => setEndDate(e.target.value)}
                className="bg-transparent border-none outline-none text-sm font-medium text-slate-700 cursor-pointer"
                title="วันที่สิ้นสุด"
              />
            </div>
            <select 
              value={filterFloor} onChange={e => setFilterFloor(e.target.value)}
              className="px-4 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none text-sm font-medium bg-slate-50"
            >
              <option value="all">ชั้น (ทั้งหมด)</option>
              {uniqueFloors.map((f, i) => (
                <option key={i} value={String(f)}>ชั้น {String(f)}</option>
              ))}
            </select>
          </div>
          <button 
            onClick={handleRefresh}
            className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-md active:scale-95 flex items-center justify-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
            รีเฟรชข้อมูล
          </button>
        </section>

        {/* Summary Cards */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          {/* Card 1: Occupancy */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60 flex flex-col justify-between h-full">
            <div>
              <p className="text-sm font-bold text-slate-500 mb-1">อัตราการเข้าพัก</p>
              <h3 className="text-3xl font-black text-slate-800">{dynamicMetrics.occupiedRooms} <span className="text-xl text-slate-400 font-bold">/ {dynamicMetrics.totalRooms}</span></h3>
            </div>
            <div className="mt-6 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div className="bg-blue-500 h-full rounded-full transition-all duration-500" style={{ width: `${dynamicMetrics.occupancyRate}%` }}></div>
            </div>
          </div>

          {/* Card 2: Draft Invoices */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60 flex flex-col justify-between h-full">
            <div>
              <p className="text-sm font-bold text-slate-500 mb-1">บิลแบบร่าง (รอตรวจสอบ)</p>
              <h3 className="text-3xl font-black text-slate-800">{dynamicMetrics.draftCount} <span className="text-base text-slate-500 font-semibold">รายการ</span></h3>
            </div>
            <div className="mt-4">
              <Link href="/invoices" className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors">
                ตรวจสอบรายการ <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>
              </Link>
            </div>
          </div>

          {/* Card 3: Unpaid Invoices */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60 flex flex-col justify-between h-full">
            <div>
              <p className="text-sm font-bold text-slate-500 mb-1">ยอดรอชำระ ({dynamicMetrics.unpaidCount} บิล)</p>
              <h3 className="text-3xl font-black text-rose-600">{dynamicMetrics.unpaidAmount.toLocaleString()} <span className="text-base text-rose-400 font-semibold">฿</span></h3>
            </div>
            <div className="mt-4">
              <Link href="/invoices" className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors">
                ดูรายการรอชำระ <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>
              </Link>
            </div>
          </div>

          {/* Card 4: Meter Status */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60 flex flex-col justify-between h-full">
            <div>
              <p className="text-sm font-bold text-slate-500 mb-2">สถานะจดมิเตอร์ (เดือนนี้)</p>
              {dynamicMetrics.missingInvoicesCount <= 0 && dynamicMetrics.totalOccupiedRooms > 0 ? (
                <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-3 py-2 rounded-xl w-fit">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                  <span className="font-bold">จดครบแล้ว</span>
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2 text-rose-600 bg-rose-50 px-3 py-2 rounded-xl w-fit">
                    <span className="font-bold">รอจด</span>
                  </div>
                  <p className="text-sm font-semibold text-slate-500">
                    ขาดอีก {Math.max(0, dynamicMetrics.missingInvoicesCount)} ห้อง
                  </p>
                </div>
              )}
            </div>
            <div className="mt-4">
              <Link href="/invoices" className={`text-xs font-bold flex items-center gap-1 transition-colors ${dynamicMetrics.missingInvoicesCount <= 0 && dynamicMetrics.totalOccupiedRooms > 0 ? 'text-slate-400 hover:text-slate-600' : 'text-blue-600 hover:text-blue-800'}`}>
                {dynamicMetrics.missingInvoicesCount <= 0 && dynamicMetrics.totalOccupiedRooms > 0 ? 'ดูรายการบิลทั้งหมด' : 'ไปจดมิเตอร์ / ออกบิล'} <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>
              </Link>
            </div>
          </div>
        </section>

        {/* All Invoices Breakdown Table */}
        {allInvoices.length > 0 && (
          <section>
            <div className="mb-5 flex flex-col sm:flex-row justify-between sm:items-end gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-800 tracking-tight">รายการบิลล่าสุด (Recent Invoices)</h2>
                <p className="text-sm text-slate-500">แสดงรายการบิล 5 รายการล่าสุด</p>
              </div>
              <Link href="/invoices" className="text-sm font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-xl transition-colors">
                ดูทั้งหมด
              </Link>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[800px]">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-sm font-semibold text-slate-600">
                      <th className="py-4 px-6">บิลของเดือน</th>
                      <th className="py-4 px-6">ห้องพัก</th>
                      <th className="py-4 px-6 text-right">ค่าเช่า</th>
                      <th className="py-4 px-6 text-right">ค่าน้ำ</th>
                      <th className="py-4 px-6 text-right">ค่าไฟ</th>
                      <th className="py-4 px-6 text-right text-blue-700">ยอดรวมสุทธิ</th>
                      <th className="py-4 px-6 text-center">หลักฐานโอนเงิน</th>
                      <th className="py-4 px-6 text-right">สถานะ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredInvoices.slice(0, 5).map((inv, idx) => {
                      const isPending = inv.status === 'pending' || inv.status === 'รอชำระ' || inv.status === 'unpaid';
                      const isPaid = inv.status === 'paid' || inv.status === 'ชำระแล้ว';

                      return (
                        <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-4 px-6 text-sm text-slate-700 font-medium">
                            {inv.month_year || 'ไม่ระบุเดือน'}
                          </td>
                          <td className="py-4 px-6">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 font-semibold text-xs border border-slate-200/60">
                              Room {inv.room_number}
                            </span>
                          </td>
                          <td className="py-4 px-6 text-right text-sm text-slate-500">
                            {Number(inv.price_per_month || 0).toLocaleString()}
                          </td>
                          <td className="py-4 px-6 text-right text-sm text-slate-500">
                            {(Number(inv.water_unit || 0) * Number(inv.water_rate || 0)).toLocaleString()}
                          </td>
                          <td className="py-4 px-6 text-right text-sm text-slate-500">
                            {(Number(inv.electric_unit || 0) * Number(inv.electric_rate || 0)).toLocaleString()}
                          </td>
                          <td className="py-4 px-6 text-right text-sm font-bold text-slate-800 tracking-tight">
                            {inv.calculatedTotal.toLocaleString()} ฿
                          </td>
                          <td className="py-4 px-6 text-center">
                            {inv.slip_image ? (
                              <button
                                onClick={() => openSlipModal(inv.slip_image)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 font-medium text-xs transition-colors border border-blue-200 shadow-sm"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
                                ดูสลิป
                              </button>
                            ) : (
                              <span className="text-xs text-slate-400 font-medium">-</span>
                            )}
                          </td>
                          <td className="py-4 px-6 text-right">
                            {isPending ? (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-rose-50 text-rose-600 font-bold text-xs border border-rose-100 uppercase tracking-wider">
                                รอชำระ
                              </span>
                            ) : isPaid ? (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 font-bold text-xs border border-emerald-100 uppercase tracking-wider">
                                ชำระแล้ว
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 font-semibold text-xs border border-slate-200 uppercase tracking-wider">
                                {inv.status}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {/* Room Status */}
        <section>
          <div className="mb-5 flex flex-col sm:flex-row justify-between sm:items-end gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-800 tracking-tight">สถานะห้องพัก (Room Status)</h2>
              <p className="text-sm text-slate-500">อัปเดตสถานะห้องพักล่าสุดจากฐานข้อมูล</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6">
            {filteredRooms.map((room, idx) => (
              <div key={idx} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60 flex flex-col justify-between transition-all hover:-translate-y-1 hover:shadow-md hover:border-slate-300 group cursor-pointer relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-slate-50 to-transparent rounded-bl-[100px] opacity-50 group-hover:scale-110 transition-transform"></div>

                <div className="flex justify-between items-start mb-6 relative z-10">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Room</span>
                    <span className="text-3xl font-black text-slate-800 tracking-tight">{room.number}</span>
                  </div>
                  <div className="flex shrink-0 pt-1">
                    <span className={`w-3.5 h-3.5 rounded-full ring-4 shadow-sm ${room.color} ${room.ring}`}></span>
                  </div>
                </div>

                <div className="relative z-10">
                  <div className="inline-flex items-center px-3 py-1.5 rounded-lg bg-slate-50 text-slate-700 border border-slate-200/60 font-semibold text-sm shadow-sm">
                    {room.status}
                  </div>
                </div>
              </div>
            ))}

            {filteredRooms.length === 0 && (
              <div className="col-span-full py-12 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-white/50">
                <p className="text-slate-500 font-medium">ไม่มีข้อมูลห้องพักในระบบ</p>
              </div>
            )}
          </div>
        </section>

        {/* Maintenance Requests */}
        <section>
          <div className="mb-5 flex flex-col sm:flex-row justify-between sm:items-end gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-800 tracking-tight flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" className="text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></svg>
                รายการแจ้งซ่อมล่าสุด
              </h2>
              <p className="text-sm text-slate-500">จัดการคำร้องขอซ่อมแซมจากผู้เช่า (เฉพาะรายการที่ยังไม่สำเร็จ)</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-sm font-semibold text-slate-600">
                    <th className="py-4 px-6 w-24">ห้องพัก</th>
                    <th className="py-4 px-6">รายละเอียดปัญหา</th>
                    <th className="py-4 px-6 w-48">วันที่และเวลาที่แจ้ง</th>
                    <th className="py-4 px-6 w-32">สถานะปัจจุบัน</th>
                    <th className="py-4 px-6 w-64">อัปเดตสถานะ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {maintenanceRequests.length > 0 ? (
                    maintenanceRequests.map((req) => (
                      <tr key={req.maintenance_requests_id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-4 px-6">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-slate-100 text-slate-800 font-bold text-sm border border-slate-200/80">
                            {req.rooms?.room_number || '-'}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <p className="text-sm text-slate-700 line-clamp-2">{req.issue_details}</p>
                        </td>
                        <td className="py-4 px-6">
                          <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-md border border-slate-200/50">
                            {formatDateThai(req.created_at)}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          {req.status === 'pending' ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-rose-50 text-rose-600 font-semibold text-xs border border-rose-100 capitalize">
                              รอดำเนินการ
                            </span>
                          ) : req.status === 'in_progress' ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-amber-50 text-amber-600 font-semibold text-xs border border-amber-100 capitalize">
                              กำลังดำเนินการ
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 font-semibold text-xs border border-slate-200 capitalize">
                              {req.status}
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex gap-2">
                            <button
                              onClick={() => updateMaintenanceStatus(req.maintenance_requests_id, 'in_progress')}
                              disabled={isUpdatingStatus === req.maintenance_requests_id || req.status === 'in_progress'}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border shadow-sm flex items-center gap-1.5 ${req.status === 'in_progress'
                                ? 'bg-amber-100/50 text-amber-400 border-amber-200/50 cursor-not-allowed'
                                : 'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200 hover:shadow active:scale-95'
                                }`}
                            >
                              กำลังดำเนินการ
                            </button>
                            <button
                              onClick={() => updateMaintenanceStatus(req.maintenance_requests_id, 'resolved')}
                              disabled={isUpdatingStatus === req.maintenance_requests_id}
                              className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold text-xs transition-all border border-emerald-200 shadow-sm hover:shadow flex items-center gap-1.5 active:scale-95"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                              ซ่อมเสร็จสิ้น
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-12 text-center text-slate-500 bg-slate-50/30">
                        <div className="text-3xl mb-2 text-slate-300">✨</div>
                        ไม่พบรายการแจ้งซ่อมที่ค้างอยู่
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

      </div>

      {/* Slip Image Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={closeSlipModal}></div>
          <div className="relative bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh] scale-100 transition-transform">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" className="text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
                หลักฐานการโอนเงิน
              </h3>
              <button
                onClick={closeSlipModal}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-200/50 hover:bg-slate-200 text-slate-500 hover:text-slate-700 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 flex flex-col items-center justify-center bg-slate-100/50">
              {selectedSlipImage ? (
                <img src={selectedSlipImage} alt="Slip Preview" className="max-w-full h-auto rounded-xl shadow-sm border border-slate-200" style={{ maxHeight: '60vh', objectFit: 'contain' }} />
              ) : (
                <div className="text-slate-400 py-10 flex flex-col items-center">
                  <span className="text-4xl mb-2">📸</span>
                  <p>ไม่พบรูปภาพ</p>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-slate-100 bg-white flex justify-end">
              <button onClick={closeSlipModal} className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-medium transition-colors shadow-sm active:scale-[0.98]">ปิดหน้าต่าง</button>
            </div>
          </div>
        </div>
      )}

    </AdminLayout>
  );
}
