"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/backend/lib/supabase';
import AdminLayout from '@/components/AdminLayout';
import Link from 'next/link';

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roomData, setRoomData] = useState<any[]>([]);
  const [allInvoices, setAllInvoices] = useState<any[]>([]);
  const [activeContracts, setActiveContracts] = useState<any[]>([]);

  // Function to calculate cycle dates
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

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSlipImage, setSelectedSlipImage] = useState<string | null>(null);

  const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<any | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // 1. ดึงข้อมูลบิลทั้งหมดจากมุมมอง view_invoice_details
      const { data: invoices, error: invoiceError } = await supabase
        .from('view_invoice_details')
        .select('*')
        .order('month_year', { ascending: false });

      if (invoiceError) throw invoiceError;

      // 2. ดึงข้อมูลการตั้งค่าหอพัก (cutoff_day)
      const { data: settingsData } = await supabase.from('dorm_settings').select('cutoff_day').limit(1).single();
      if (settingsData && settingsData.cutoff_day) {
        setCutoffDay(settingsData.cutoff_day);
        const cycle = getCycleDates(settingsData.cutoff_day);
        setStartDate(cycle.startStr);
        setEndDate(cycle.endStr);
      }

      // 3. ดึงข้อมูลห้องทั้งหมดจากตาราง rooms
      const { data: rooms, error: roomsError } = await supabase
        .from('rooms')
        .select('*')
        .order('room_number', { ascending: true });
      if (roomsError) throw roomsError;

      // 4. ดึงข้อมูลสัญญาที่ยัง active จากมุมมอง view_active_contracts
      const { data: contracts, error: contractsError } = await supabase
        .from('view_active_contracts')
        .select('*');
      if (contractsError) throw contractsError;

      setActiveContracts(contracts || []);

      // คำนวณยอดบิลทุกรายการ
      const invoicesWithBreakdown = invoices?.map(inv => ({
        ...inv,
        calculatedTotal: Number(inv.total_amount || 0),
        room_number: inv.room_number || '-'
      })) || [];

      setAllInvoices(invoicesWithBreakdown);

      // สร้าง Map ข้อมูลสัญญาตาม room_id และ room_number
      const activeContractsMap = new Map<any, any>();
      const activeRoomIds = new Set<any>();
      contracts?.forEach(c => {
        if (c.room_id) {
          activeRoomIds.add(Number(c.room_id));
          activeContractsMap.set(Number(c.room_id), c);
        }
        if (c.room_number) {
          activeContractsMap.set(String(c.room_number), c);
        }
      });

      // ดึงหมายเลขห้องที่มีบิลค้างชำระ
      const unpaidRoomNumbers = new Set<string>();
      invoices?.forEach(inv => {
        const isUnpaid = inv.status === 'unpaid' || inv.status === 'pending' || inv.status === 'รอชำระ';
        if (isUnpaid && inv.room_number) {
          unpaidRoomNumbers.add(String(inv.room_number));
        }
      });

      // คำนวณสถานะห้องพัก
      const computedRoomData = rooms?.map(room => {
        const roomIdNum = Number(room.room_id);
        const roomNumStr = String(room.room_number);
        const hasActiveContract = activeRoomIds.has(roomIdNum) || activeContractsMap.has(roomNumStr);
        const hasUnpaidInvoice = unpaidRoomNumbers.has(roomNumStr);
        const isMaintenance = room.status === 'maintenance' || room.status === 'แจ้งซ่อม';

        let statusKey: 'vacant' | 'occupied' | 'unpaid' | 'maintenance' = 'vacant';
        let statusText = 'ว่าง';
        let colorClass = 'bg-emerald-500';
        let badgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
        let cardBorder = 'hover:border-emerald-300';

        if (isMaintenance) {
          statusKey = 'maintenance';
          statusText = 'แจ้งซ่อม';
          colorClass = 'bg-rose-500';
          badgeClass = 'bg-rose-50 text-rose-700 border-rose-200';
          cardBorder = 'hover:border-rose-300';
        } else if (hasActiveContract && hasUnpaidInvoice) {
          statusKey = 'unpaid';
          statusText = 'รอชำระ';
          colorClass = 'bg-amber-500';
          badgeClass = 'bg-amber-50 text-amber-700 border-amber-200';
          cardBorder = 'hover:border-amber-300';
        } else if (hasActiveContract) {
          statusKey = 'occupied';
          statusText = 'มีผู้เช่า';
          colorClass = 'bg-blue-500';
          badgeClass = 'bg-blue-50 text-blue-700 border-blue-200';
          cardBorder = 'hover:border-blue-300';
        }

        const contractInfo = activeContractsMap.get(roomIdNum) || activeContractsMap.get(roomNumStr) || null;

        return {
          id: room.room_id,
          number: room.room_number,
          floor: room.floor,
          price_per_month: room.price_per_month,
          statusKey,
          status: statusText,
          color: colorClass,
          badgeClass,
          cardBorder,
          contractInfo
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
        router.push('/book-room');
        return;
      }

      const { data: userData } = await supabase
        .from('users')
        .select('role')
        .eq('user_uid', session.user.id)
        .single();

      if (!userData) {
        router.push('/book-room');
        return;
      }

      if (userData.role === 'tenant') {
        router.push('/tenant');
        return;
      }

      if (userData.role !== 'admin') {
        router.push('/book-room');
        return;
      }

      fetchData();
    };

    checkAuth();
  }, []);

  // เปิดปิด Modal สลิป
  const openSlipModal = (imageUrl: string) => {
    setSelectedSlipImage(imageUrl);
    setIsModalOpen(true);
  };

  const closeSlipModal = () => {
    setIsModalOpen(false);
    setSelectedSlipImage(null);
  };

  // ดักจับการกดปุ่ม ESC
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeSlipModal();
        setIsRoomModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  // Loading & Error States
  if (loading && allInvoices.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50/50 flex flex-col items-center justify-center font-sans text-slate-900">
        <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
        <h2 className="text-xl font-bold text-slate-700 tracking-tight">กำลังโหลดข้อมูล...</h2>
        <p className="text-sm text-slate-500 mt-2">โปรดรอสักครู่ ระบบกำลังดึงข้อมูล</p>
      </div>
    );
  }

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
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium py-3 px-6 rounded-xl transition-all shadow-md active:scale-[0.98]"
          >
            ลองใหม่อีกครั้ง
          </button>
        </div>
      </div>
    );
  }

  // --- Derived State & Metrics ---
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
    const invDateStr = new Date(invDateObj.getTime() - invDateObj.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

    if (startDate && invDateStr < startDate) return false;
    if (endDate && invDateStr > endDate) return false;
    return true;
  });

  // Calculate Dynamic Metrics
  const draftInvoices = filteredInvoices.filter(inv => inv.status === 'draft');
  const unpaidInvoices = filteredInvoices.filter(inv => inv.status === 'unpaid' || inv.status === 'pending' || inv.status === 'รอชำระ');
  const totalUnpaidAmount = unpaidInvoices.reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0);

  const totalFilteredRooms = filteredRooms.length;
  const occupiedFilteredRooms = filteredRooms.filter(r => r.statusKey === 'occupied' || r.statusKey === 'unpaid').length;
  const occupancyRate = totalFilteredRooms > 0 ? Math.round((occupiedFilteredRooms / totalFilteredRooms) * 100) : 0;

  const occupiedRoomNumbers = new Set(roomData.filter(r => r.statusKey === 'occupied' || r.statusKey === 'unpaid').map(r => String(r.number)));
  const totalOccupiedRooms = occupiedRoomNumbers.size;

  const occupiedRoomsWithInvoice = new Set(
    filteredInvoices
      .filter(inv => occupiedRoomNumbers.has(String(inv.room_number)))
      .map(inv => String(inv.room_number))
  ).size;

  const missingInvoicesCount = totalOccupiedRooms - occupiedRoomsWithInvoice;

  const dynamicMetrics = {
    totalRooms: totalFilteredRooms,
    occupiedRooms: occupiedFilteredRooms,
    occupancyRate,
    draftCount: draftInvoices.length,
    unpaidCount: unpaidInvoices.length,
    unpaidAmount: totalUnpaidAmount,
    totalOccupiedRooms,
    missingInvoicesCount
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
      <div className="space-y-6">

        {/* 1. Header & Integrated Filters */}
        <section className="bg-white/80 backdrop-blur-md p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <span>📊</span> ภาพรวมระบบ (Dashboard)
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              สรุปข้อมูลการเข้าพัก บิลค่าเช่า และสถานะห้องพัก
            </p>
          </div>

          {/* Controls: Date Picker & Refresh Button */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs sm:text-sm">
              <span className="text-slate-400 font-medium">📅</span>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="bg-transparent border-none outline-none text-slate-700 font-semibold cursor-pointer text-xs sm:text-sm"
                title="วันที่เริ่มต้น"
              />
              <span className="text-slate-300 font-bold">-</span>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="bg-transparent border-none outline-none text-slate-700 font-semibold cursor-pointer text-xs sm:text-sm"
                title="วันที่สิ้นสุด"
              />
            </div>

            <button
              onClick={handleRefresh}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-sm active:scale-95 flex items-center gap-1.5 text-xs sm:text-sm"
              title="รีเฟรชข้อมูล"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" /></svg>
              <span>รีเฟรช</span>
            </button>
          </div>
        </section>

        {/* 2. KPI Cards (4 Cards Grid) */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
          {/* Card 1: Occupancy Rate */}
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-2xs flex flex-col justify-between hover:shadow-md transition-all">
            <div className="flex justify-between items-start">
              <span className="text-xs font-bold text-slate-500">อัตราการเข้าพัก</span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-600 border border-blue-100">
                {dynamicMetrics.occupancyRate}%
              </span>
            </div>
            <div className="mt-3">
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl font-black text-slate-900">{dynamicMetrics.occupiedRooms}</span>
                <span className="text-xs sm:text-sm font-semibold text-slate-400">/ {dynamicMetrics.totalRooms} ห้อง</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2.5 overflow-hidden">
                <div
                  className="bg-blue-600 h-full rounded-full transition-all duration-500"
                  style={{ width: `${dynamicMetrics.occupancyRate}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* Card 2: Draft Invoices */}
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-2xs flex flex-col justify-between hover:shadow-md transition-all">
            <div className="flex justify-between items-start">
              <span className="text-xs font-bold text-slate-500">บิลแบบร่าง</span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-600 border border-amber-100">
                รอตรวจสอบ
              </span>
            </div>
            <div className="mt-3">
              <div className="flex items-baseline gap-1">
                <span className="text-2xl sm:text-3xl font-black text-slate-900">{dynamicMetrics.draftCount}</span>
                <span className="text-xs sm:text-sm font-semibold text-slate-500">รายการ</span>
              </div>
              <Link
                href="/invoices"
                className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 mt-2 transition-colors"
              >
                ตรวจสอบบิล <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 12h14m-7-7 7 7-7 7" /></svg>
              </Link>
            </div>
          </div>

          {/* Card 3: Pending Payments */}
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-2xs flex flex-col justify-between hover:shadow-md transition-all">
            <div className="flex justify-between items-start">
              <span className="text-xs font-bold text-slate-500">ยอดรอชำระ</span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-600 border border-rose-100">
                {dynamicMetrics.unpaidCount} บิล
              </span>
            </div>
            <div className="mt-3">
              <div className="flex items-baseline gap-1">
                <span className="text-2xl sm:text-3xl font-black text-rose-600">{dynamicMetrics.unpaidAmount.toLocaleString()}</span>
                <span className="text-xs sm:text-sm font-bold text-rose-400">฿</span>
              </div>
              <Link
                href="/invoices"
                className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 mt-2 transition-colors"
              >
                ดูรายการรอชำระ <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 12h14m-7-7 7 7-7 7" /></svg>
              </Link>
            </div>
          </div>

          {/* Card 4: Meter Status */}
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-2xs flex flex-col justify-between hover:shadow-md transition-all">
            <div className="flex justify-between items-start">
              <span className="text-xs font-bold text-slate-500">สถานะจดมิเตอร์</span>
              {dynamicMetrics.missingInvoicesCount <= 0 && dynamicMetrics.totalOccupiedRooms > 0 ? (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100">
                  ครบถ้วน
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-600 border border-amber-100">
                  รอจด
                </span>
              )}
            </div>
            <div className="mt-3">
              {dynamicMetrics.missingInvoicesCount <= 0 && dynamicMetrics.totalOccupiedRooms > 0 ? (
                <div>
                  <span className="text-lg sm:text-xl font-black text-emerald-600">จดครบแล้ว</span>
                  <p className="text-[11px] text-slate-400 mt-1">ออกบิลประจำเดือนแล้ว</p>
                </div>
              ) : (
                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl sm:text-3xl font-black text-amber-600">{Math.max(0, dynamicMetrics.missingInvoicesCount)}</span>
                    <span className="text-xs sm:text-sm font-semibold text-slate-500">ห้องค้างจด</span>
                  </div>
                  <Link
                    href="/invoices"
                    className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 mt-2 transition-colors"
                  >
                    ไปจดมิเตอร์ <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 12h14m-7-7 7 7-7 7" /></svg>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* 3. Main Two-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* Left Column: Floor Matrix (lg:col-span-7) */}
          <section className="lg:col-span-7 bg-white/90 backdrop-blur-sm rounded-2xl p-5 border border-slate-200/80 shadow-2xs flex flex-col">

            {/* Header & Tabs */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  <span>🏢</span> ผังสถานะห้องพัก (Floor Matrix)
                </h2>
                <p className="text-xs text-slate-500">คลิกที่ห้องเพื่อดูข้อมูลผู้เช่าและสัญญา</p>
              </div>

              {/* Floor Tabs */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl overflow-x-auto self-start sm:self-auto">
                <button
                  onClick={() => setFilterFloor('all')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${filterFloor === 'all'
                      ? 'bg-white text-blue-600 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                  ทั้งหมด
                </button>
                {uniqueFloors.map((f, i) => (
                  <button
                    key={i}
                    onClick={() => setFilterFloor(String(f))}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${filterFloor === String(f)
                        ? 'bg-white text-blue-600 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                      }`}
                  >
                    ชั้น {String(f)}
                  </button>
                ))}
              </div>
            </div>

            {/* Status Legend Bar */}
            <div className="flex flex-wrap items-center gap-3 sm:gap-4 py-3 text-[11px] font-semibold text-slate-600 border-b border-slate-100/80 mb-4 bg-slate-50/50 -mx-5 px-5">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> ว่าง
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span> มีผู้เช่า
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> รอชำระ
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> แจ้งซ่อม
              </span>
            </div>

            {/* Room Chips Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 sm:gap-3">
              {filteredRooms.map((room, idx) => (
                <button
                  key={room.id || idx}
                  onClick={() => {
                    setSelectedRoom(room);
                    setIsRoomModalOpen(true);
                  }}
                  className={`p-3 rounded-2xl bg-white border border-slate-200/80 shadow-2xs ${room.cardBorder} hover:shadow-md transition-all text-left flex flex-col justify-between group active:scale-[0.98] cursor-pointer`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-slate-400">ชั้น {room.floor}</span>
                    <span className={`w-2.5 h-2.5 rounded-full ${room.color} shadow-2xs`}></span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-xl font-black text-slate-800 tracking-tight">
                      {room.number}
                    </span>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${room.badgeClass}`}>
                      {room.status}
                    </span>
                  </div>
                </button>
              ))}

              {filteredRooms.length === 0 && (
                <div className="col-span-full py-10 text-center border-2 border-dashed border-slate-200 rounded-2xl">
                  <p className="text-xs text-slate-400 font-medium">ไม่พบข้อมูลห้องพักในชั้นนี้</p>
                </div>
              )}
            </div>

          </section>

          {/* Right Column: Recent Invoices (lg:col-span-5) */}
          <section className="lg:col-span-5 bg-white/90 backdrop-blur-sm rounded-2xl p-5 border border-slate-200/80 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                    <span>🧾</span> รายการบิลล่าสุด
                  </h2>
                  <p className="text-xs text-slate-500">ข้อมูลบิลและสถานะชำระเงิน</p>
                </div>
                <Link
                  href="/invoices"
                  className="text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-100 transition-colors"
                >
                  ดูทั้งหมด
                </Link>
              </div>

              {/* Compact List of Invoices */}
              <div className="space-y-2.5">
                {filteredInvoices.slice(0, 7).map((inv, idx) => {
                  const isPending = inv.status === 'pending' || inv.status === 'รอชำระ' || inv.status === 'unpaid';
                  const isPaid = inv.status === 'paid' || inv.status === 'ชำระแล้ว';
                  const isDraft = inv.status === 'draft' || inv.status === 'แบบร่าง';

                  return (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-slate-50/70 border border-slate-200/60 hover:bg-slate-50 transition-colors flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                          {inv.room_number}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-800">{inv.month_year || '-'}</span>
                          </div>
                          <span className="text-xs font-black text-blue-700">
                            {inv.calculatedTotal.toLocaleString()} ฿
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Slip Image Button */}
                        {inv.slip_image ? (
                          <button
                            onClick={() => openSlipModal(inv.slip_image)}
                            className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 font-semibold text-xs border border-blue-200/70 transition-colors flex items-center gap-1 shadow-2xs"
                            title="ดูหลักฐานโอนเงิน"
                          >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></svg>
                            <span className="hidden sm:inline">สลิป</span>
                          </button>
                        ) : null}

                        {/* Status Badge */}
                        {isPending ? (
                          <span className="px-2.5 py-1 rounded-full bg-rose-50 text-rose-600 font-bold text-[10px] border border-rose-100">
                            รอชำระ
                          </span>
                        ) : isPaid ? (
                          <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 font-bold text-[10px] border border-emerald-100">
                            ชำระแล้ว
                          </span>
                        ) : isDraft ? (
                          <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-600 font-bold text-[10px] border border-amber-100">
                            แบบร่าง
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 font-bold text-[10px] border border-slate-200">
                            {inv.status}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}

                {filteredInvoices.length === 0 && (
                  <div className="py-10 text-center border-2 border-dashed border-slate-200 rounded-2xl">
                    <p className="text-xs text-slate-400 font-medium">ไม่พบบิลตามเงื่อนไขที่เลือก</p>
                  </div>
                )}
              </div>
            </div>

            {filteredInvoices.length > 7 && (
              <div className="pt-3 text-center border-t border-slate-100 mt-3">
                <Link href="/invoices" className="text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors">
                  แสดงอีก {filteredInvoices.length - 7} รายการ →
                </Link>
              </div>
            )}
          </section>

        </div>

      </div>

      {/* Room Details Modal (view_active_contracts Data) */}
      {isRoomModalOpen && selectedRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={() => setIsRoomModalOpen(false)}
          ></div>
          <div className="relative bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col max-h-[90vh] z-10">

            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/60 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-black text-lg shadow-sm">
                  {selectedRoom.number}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 tracking-tight">ห้อง {selectedRoom.number}</h3>
                  <p className="text-xs text-slate-500 font-medium">ชั้น {selectedRoom.floor} • ค่าเช่า {Number(selectedRoom.price_per_month || 0).toLocaleString()} ฿/เดือน</p>
                </div>
              </div>
              <button
                onClick={() => setIsRoomModalOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-200/60 hover:bg-slate-200 text-slate-500 hover:text-slate-700 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4">

              {/* Status Banner */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-200/60">
                <span className="text-xs font-bold text-slate-500">สถานะห้องพักปัจจุบัน</span>
                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${selectedRoom.badgeClass}`}>
                  {selectedRoom.status}
                </span>
              </div>

              {/* Active Contract & Tenant Info */}
              {selectedRoom.contractInfo ? (
                <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-4 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-blue-600 flex items-center gap-1.5">
                    👤 ข้อมูลผู้เช่าและสัญญา
                  </h4>
                  <div className="grid grid-cols-1 gap-2.5 text-xs sm:text-sm">
                    <div className="flex justify-between border-b border-blue-100/60 pb-2">
                      <span className="text-slate-500 font-medium">ผู้เช่า:</span>
                      <span className="font-bold text-slate-800">
                        {selectedRoom.contractInfo.first_name || '-'} {selectedRoom.contractInfo.last_name || ''}
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-blue-100/60 pb-2">
                      <span className="text-slate-500 font-medium">เบอร์โทรศัพท์:</span>
                      <a href={`tel:${selectedRoom.contractInfo.phone_number}`} className="font-bold text-blue-600 hover:underline">
                        {selectedRoom.contractInfo.phone_number || '-'}
                      </a>
                    </div>
                    {selectedRoom.contractInfo.email && (
                      <div className="flex justify-between border-b border-blue-100/60 pb-2">
                        <span className="text-slate-500 font-medium">อีเมล:</span>
                        <span className="font-medium text-slate-700">
                          {selectedRoom.contractInfo.email}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between pt-1">
                      <span className="text-slate-500 font-medium">วันทำสัญญา:</span>
                      <span className="font-semibold text-slate-700">
                        {selectedRoom.contractInfo.start_date || '-'} ถึง {selectedRoom.contractInfo.end_date || '-'}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-5 text-center">
                  <p className="text-slate-500 font-medium text-xs sm:text-sm mb-3">ยังไม่มีผู้เช่าลงทะเบียนในระบบ (ห้องว่าง)</p>
                  <Link
                    href="/contracts"
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors"
                  >
                    + ทำสัญญาเช่าใหม่
                  </Link>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-2 flex gap-2">
                {selectedRoom.statusKey === 'unpaid' && (
                  <Link
                    href="/invoices"
                    className="flex-1 py-2.5 px-4 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl text-center shadow-xs transition-all"
                  >
                    ดูรายการบิลค้างชำระ
                  </Link>
                )}
                {selectedRoom.statusKey === 'maintenance' && (
                  <Link
                    href="/maintenance"
                    className="flex-1 py-2.5 px-4 bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs rounded-xl text-center shadow-xs transition-all"
                  >
                    ดูรายการแจ้งซ่อม
                  </Link>
                )}
                <button
                  onClick={() => setIsRoomModalOpen(false)}
                  className="flex-1 py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl text-center shadow-xs transition-all"
                >
                  ปิด
                </button>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* Slip Image Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity" onClick={closeSlipModal}></div>
          <div className="relative bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <span>📸</span> หลักฐานการโอนเงิน
              </h3>
              <button
                onClick={closeSlipModal}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-200/50 hover:bg-slate-200 text-slate-500 hover:text-slate-700 transition-colors"
              >
                ✕
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

