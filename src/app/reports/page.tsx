"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/backend/lib/supabase';
import AdminLayout from '@/components/AdminLayout';
import * as XLSX from 'xlsx';

// Utility functions
const formatMonthTh = (monthYear: string) => {
  if (!monthYear || monthYear === 'Unknown') return 'ไม่ระบุเดือน';
  const match = monthYear.match(/^(\d{4})-(\d{2})$/);
  if (!match) return monthYear;
  const year = parseInt(match[1]);
  const month = parseInt(match[2]);
  
  const thaiMonths = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  const thaiYear = year > 2500 ? year : year + 543;
  
  return `${thaiMonths[month - 1]} ${thaiYear}`;
};

const normalizeMonth = (raw: string) => {
  if (!raw) return 'Unknown';
  const matchIso = raw.match(/^(\d{4})[-\/](\d{1,2})/);
  if (matchIso) {
    let y = parseInt(matchIso[1]);
    let m = parseInt(matchIso[2]);
    if (y > 2500) y -= 543;
    return `${y}-${String(m).padStart(2, '0')}`;
  }
  return raw;
};

export default function ReportsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Data
  const [invoicesData, setInvoicesData] = useState<any[]>([]);
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  
  // UI State for mobile accordion
  const [expandedRoom, setExpandedRoom] = useState<string | null>(null);
  
  // UI State for Invoice Detail Modal
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [showSlip, setShowSlip] = useState(false);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedInvoice(null);
        setShowSlip(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
      fetchData();
    };
    checkAuth();
  }, []);

  const handleRowClick = async (inv: any) => {
    // Check if additional_items is already fetched
    if (inv.additional_items !== undefined) {
      setSelectedInvoice(inv);
      return;
    }
    
    // Fetch only additional_items for the modal without nested join on the main query
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('additional_items')
        .eq('invoices_id', inv.invoices_id)
        .single();
        
      if (!error && data) {
        setSelectedInvoice({ ...inv, additional_items: data.additional_items || [] });
      } else {
        setSelectedInvoice({ ...inv, additional_items: [] });
      }
    } catch (e) {
      setSelectedInvoice({ ...inv, additional_items: [] });
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('view_invoice_details')
        .select('*');

      if (error) throw error;
      
      const invoices = (data || []).map(inv => {
        return {
          ...inv,
          month_year_normalized: normalizeMonth(inv?.month_year || '')
        };
      });

      // Sort by room number
      invoices.sort((a, b) => {
        const roomA = String(a.room_number || '');
        const roomB = String(b.room_number || '');
        return roomA.localeCompare(roomB, undefined, { numeric: true });
      });

      setInvoicesData(invoices);
      
      // Extract unique months, sort ascending initially to easily find previous month, then reverse for display
      const months = Array.from(new Set(invoices.map(d => d.month_year_normalized)))
                          .filter(Boolean)
                          .sort((a, b) => b.localeCompare(a));
      
      setAvailableMonths(months);
      if (months.length > 0) {
        setSelectedMonth(months[0]); // Default to latest month
      }
      
    } catch (err: any) {
      console.error('Fetch error details:', err?.message || err, err?.details, err?.hint);
      setError('ไม่สามารถโหลดข้อมูลรายงานได้');
    } finally {
      setLoading(false);
    }
  };

  // Filtered Data based on selected month
  const filteredInvoices = useMemo(() => {
    if (selectedMonth === 'all') return invoicesData;
    return invoicesData.filter(inv => inv.month_year_normalized === selectedMonth);
  }, [invoicesData, selectedMonth]);

  // Calculations for extras and base rent
  const getInvoiceBreakdown = (inv: any) => {
    const wCost = (Number(inv?.water_unit || 0)) * (Number(inv?.water_rate || 0));
    const eCost = (Number(inv?.electric_unit || 0)) * (Number(inv?.electric_rate || 0));
    const total = Number(inv?.total_amount || 0);
    const rentFromDB = Number(inv?.price_per_month || 0);
    
    let rent = 0;
    let extras = 0;

    if (rentFromDB > 0) {
      rent = rentFromDB;
      extras = total - wCost - eCost - rent;
      if (extras < 0) extras = 0;
    } else {
      rent = total - wCost - eCost;
      extras = 0;
    }

    return { wCost, eCost, extras, rent, total };
  };

  // KPIs
  const { totalCollected, outstandingBalance, waterRevenue, electricRevenue, totalBilled } = useMemo(() => {
    let collected = 0;
    let outstanding = 0;
    let water = 0;
    let electric = 0;

    filteredInvoices.forEach(inv => {
      const { wCost, eCost, total } = getInvoiceBreakdown(inv);

      if (inv.status === 'paid' || inv.status === 'ชำระแล้ว') {
        collected += total;
        water += wCost;
        electric += eCost;
      } else {
        outstanding += total;
      }
    });

    return {
      totalCollected: collected,
      outstandingBalance: outstanding,
      waterRevenue: water,
      electricRevenue: electric,
      totalBilled: collected + outstanding
    };
  }, [filteredInvoices]);

  const utilitiesRevenue = waterRevenue + electricRevenue;
  const collectionRate = totalBilled > 0 ? (totalCollected / totalBilled) * 100 : 0;

  // MoM Calculation
  const momData = useMemo(() => {
    // Determine which month to calculate MoM for (either selected or the latest if 'all')
    const targetMonth = selectedMonth === 'all' ? availableMonths[0] : selectedMonth;
    if (!targetMonth) return null;

    // Find the previous month in the available list
    const sortedAsc = [...availableMonths].sort((a, b) => a.localeCompare(b));
    const currentIndex = sortedAsc.indexOf(targetMonth);
    
    if (currentIndex > 0) {
      const prevMonth = sortedAsc[currentIndex - 1];
      
      const currentCollected = invoicesData
        .filter(inv => inv.month_year_normalized === targetMonth && (inv.status === 'paid' || inv.status === 'ชำระแล้ว'))
        .reduce((sum, inv) => sum + (Number(inv.total_amount) || 0), 0);
        
      const prevCollected = invoicesData
        .filter(inv => inv.month_year_normalized === prevMonth && (inv.status === 'paid' || inv.status === 'ชำระแล้ว'))
        .reduce((sum, inv) => sum + (Number(inv.total_amount) || 0), 0);
        
      if (prevCollected === 0) {
        return currentCollected > 0 ? { diff: currentCollected, pct: 100, isPositive: true } : null;
      }
      
      const diff = currentCollected - prevCollected;
      const pct = (diff / prevCollected) * 100;
      
      return { diff, pct, isPositive: diff >= 0 };
    }
    
    return null;
  }, [invoicesData, selectedMonth, availableMonths]);

  // Monthly Trend Data
  const trendData = useMemo(() => {
    const grouped: Record<string, { rent: number, water: number, electric: number, extras: number, total: number }> = {};
    
    invoicesData.forEach(inv => {
      if (inv.status === 'paid' || inv.status === 'ชำระแล้ว') {
        const m = inv.month_year_normalized;
        if (!grouped[m]) {
          grouped[m] = { rent: 0, water: 0, electric: 0, extras: 0, total: 0 };
        }
        
        const { rent, wCost, eCost, extras, total } = getInvoiceBreakdown(inv);
        
        grouped[m].rent += rent;
        grouped[m].water += wCost;
        grouped[m].electric += eCost;
        grouped[m].extras += extras;
        grouped[m].total += total;
      }
    });
    
    const result = Object.entries(grouped)
      .map(([month, data]) => ({ month, ...data }))
      .sort((a, b) => a.month.localeCompare(b.month));
      
    return result.slice(-6);
  }, [invoicesData]);
  
  const maxTrendValue = trendData.length > 0 ? Math.max(...trendData.map(d => d.total)) : 1;

  // Export Excel for Accounting
  const exportToExcel = () => {
    if (filteredInvoices.length === 0) return;

    let sumRent = 0;
    let sumWaterUnit = 0;
    let sumWaterCost = 0;
    let sumElecUnit = 0;
    let sumElecCost = 0;
    let sumExtras = 0;
    let sumTotal = 0;

    const excelData = filteredInvoices.map(inv => {
      const { rent, wCost, eCost, extras, total } = getInvoiceBreakdown(inv);
      const isPaid = inv?.status === 'paid' || inv?.status === 'ชำระแล้ว';
      const statusTh = isPaid ? 'ชำระแล้ว' : 'ค้างชำระ';
      const paymentDate = isPaid ? (inv?.updated_at ? new Date(inv.updated_at).toLocaleDateString('th-TH') : '-') : '-';

      const wUnit = Number(inv?.water_unit || 0);
      const eUnit = Number(inv?.electric_unit || 0);

      sumRent += rent;
      sumWaterUnit += wUnit;
      sumWaterCost += wCost;
      sumElecUnit += eUnit;
      sumElecCost += eCost;
      sumExtras += extras;
      sumTotal += total;

      return {
        'เลขที่บิล': inv?.invoices_id || '-',
        'ประจำรอบเดือน': formatMonthTh(inv?.month_year_normalized),
        'เลขห้อง': inv?.room_number || '-',
        'ชื่อผู้เช่า': `${inv?.first_name || ''} ${inv?.last_name || ''}`.trim() || '-',
        'ค่าเช่าห้อง': rent,
        'หน่วยน้ำที่ใช้': wUnit,
        'รวมเงินค่าน้ำ': wCost,
        'หน่วยไฟที่ใช้': eUnit,
        'รวมเงินค่าไฟ': eCost,
        'บริการเสริม/อื่นๆ': extras,
        'ยอดรวมสุทธิ': total,
        'สถานะการชำระเงิน': statusTh,
        'วันที่ชำระเงินจริง': paymentDate
      };
    });

    // Add Total Row
    excelData.push({
      'เลขที่บิล': 'รวมทั้งหมด (Total)',
      'ประจำรอบเดือน': '',
      'เลขห้อง': '',
      'ชื่อผู้เช่า': '',
      'ค่าเช่าห้อง': sumRent,
      'หน่วยน้ำที่ใช้': sumWaterUnit,
      'รวมเงินค่าน้ำ': sumWaterCost,
      'หน่วยไฟที่ใช้': sumElecUnit,
      'รวมเงินค่าไฟ': sumElecCost,
      'บริการเสริม/อื่นๆ': sumExtras,
      'ยอดรวมสุทธิ': sumTotal,
      'สถานะการชำระเงิน': '',
      'วันที่ชำระเงินจริง': ''
    });

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    const sheetName = selectedMonth === 'all' ? 'ทุกเดือน' : formatMonthTh(selectedMonth).substring(0,30);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    worksheet['!cols'] = [
      { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 25 }, { wch: 15 },
      { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
      { wch: 15 }, { wch: 15 }, { wch: 15 }
    ];

    XLSX.writeFile(workbook, `บัญชีหอพัก_${selectedMonth}.xlsx`);
  };

  return (
    <AdminLayout>
      <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6 pb-20">

        {/* 1. Header & Actions */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/60 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-blue-100 text-blue-500 flex items-center justify-center shadow-sm">
                📊
              </span>
              รายงานสรุปรายได้และสถิติ
            </h1>
            <p className="text-slate-500 font-medium mt-1 ml-13 text-sm">ข้อมูลภาพรวมการเงินและสถิติการชำระเงิน</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <div className="relative w-full sm:w-48">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full appearance-none pl-4 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all cursor-pointer"
              >
                <option value="all">ทุกเดือน (ภาพรวม)</option>
                {availableMonths.map(m => (
                  <option key={m} value={m}>{formatMonthTh(m)}</option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </div>
            </div>

            <button
              onClick={exportToExcel}
              disabled={loading || filteredInvoices.length === 0}
              className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-5 py-3 font-bold focus:outline-none focus:ring-4 focus:ring-emerald-500/20 shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
              ส่งออก Excel
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-rose-50 text-rose-600 p-4 rounded-xl border border-rose-100 flex items-center gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
            <span className="font-bold">{error}</span>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white/50 rounded-3xl border border-slate-200/50">
            <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
            <p className="mt-4 text-slate-500 font-bold">กำลังประมวลผลรายงาน...</p>
          </div>
        ) : (
          <>
            {/* 2. Financial KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
              
              {/* Card 1: Total Collected */}
              <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl p-5 text-white shadow-lg shadow-blue-900/20 relative overflow-hidden flex flex-col justify-between">
                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-2">
                    <p className="text-blue-100 font-medium text-xs sm:text-sm">รายรับรวมทั้งหมด</p>
                    {momData && (
                      <div className={`px-2 py-1 rounded-md text-[10px] sm:text-xs font-bold flex items-center gap-1 ${momData.isPositive ? 'bg-emerald-400/20 text-emerald-300' : 'bg-rose-400/20 text-rose-300'}`}>
                        {momData.isPositive ? '▲' : '▼'} {momData.isPositive ? '+' : ''}{momData.pct.toFixed(1)}% จากเดือนก่อน
                      </div>
                    )}
                  </div>
                  <h2 className="text-xl sm:text-3xl font-black">{totalCollected.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ฿</h2>
                  <p className="text-[10px] sm:text-xs text-blue-200 mt-1">เฉพาะบิลที่ชำระเงินแล้ว</p>
                </div>
                <div className="absolute -right-4 -bottom-4 opacity-10">
                  <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
                </div>
              </div>

              {/* Card 2: Outstanding Balance */}
              <div className="bg-white rounded-2xl p-5 border border-rose-100 shadow-sm flex flex-col justify-between relative overflow-hidden">
                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-2">
                    <p className="text-slate-500 font-medium text-xs sm:text-sm">ยอดค้างชำระ</p>
                    <div className="p-1.5 bg-rose-50 text-rose-500 rounded-lg">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                    </div>
                  </div>
                  <h2 className="text-xl sm:text-3xl font-black text-rose-600">{outstandingBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ฿</h2>
                  <p className="text-[10px] sm:text-xs text-slate-400 mt-1">บิลที่รอชำระ / รอตรวจสอบ</p>
                </div>
              </div>

              {/* Card 3: Utilities Revenue */}
              <div className="bg-white rounded-2xl p-5 border border-cyan-100 shadow-sm flex flex-col justify-between relative overflow-hidden">
                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-2">
                    <p className="text-slate-500 font-medium text-xs sm:text-sm">รายได้ค่าน้ำ-ค่าไฟ</p>
                    <div className="flex -space-x-2">
                      <div className="p-1.5 bg-sky-50 text-sky-500 rounded-lg ring-2 ring-white z-10">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path></svg>
                      </div>
                      <div className="p-1.5 bg-amber-50 text-amber-500 rounded-lg ring-2 ring-white">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
                      </div>
                    </div>
                  </div>
                  <h2 className="text-xl sm:text-3xl font-black text-slate-800">{utilitiesRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ฿</h2>
                  <p className="text-[10px] sm:text-xs text-slate-400 mt-1">ส่วนต่างยูนิตที่จัดเก็บสำเร็จ</p>
                </div>
              </div>

              {/* Card 4: Collection Rate */}
              <div className="bg-white rounded-2xl p-5 border border-emerald-100 shadow-sm flex flex-col justify-between relative overflow-hidden">
                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-2">
                    <p className="text-slate-500 font-medium text-xs sm:text-sm">อัตราการเก็บเงิน</p>
                    <div className="p-1.5 bg-emerald-50 text-emerald-500 rounded-lg">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                    </div>
                  </div>
                  <h2 className="text-xl sm:text-3xl font-black text-slate-800">{collectionRate.toFixed(1)}%</h2>
                  
                  {/* Mini Progress Bar */}
                  <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2">
                    <div 
                      className={`h-1.5 rounded-full ${collectionRate >= 90 ? 'bg-emerald-500' : collectionRate >= 70 ? 'bg-amber-400' : 'bg-rose-500'}`}
                      style={{ width: `${collectionRate}%` }}
                    ></div>
                  </div>
                </div>
              </div>

            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              
              {/* 3. Monthly Trend & Analytics (1 Column on LG) */}
              <div className="lg:col-span-1 bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2 mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
                  แนวโน้มรายได้ 6 เดือนย้อนหลัง
                </h3>
                
                {/* Legend */}
                <div className="flex flex-wrap gap-2 mb-6">
                  <div className="flex items-center gap-1 text-[10px] font-bold text-slate-600"><span className="w-2 h-2 rounded-full bg-blue-600"></span>ค่าเช่า</div>
                  <div className="flex items-center gap-1 text-[10px] font-bold text-slate-600"><span className="w-2 h-2 rounded-full bg-sky-500"></span>ค่าน้ำ</div>
                  <div className="flex items-center gap-1 text-[10px] font-bold text-slate-600"><span className="w-2 h-2 rounded-full bg-amber-500"></span>ค่าไฟ</div>
                  <div className="flex items-center gap-1 text-[10px] font-bold text-slate-600"><span className="w-2 h-2 rounded-full bg-violet-500"></span>บริการเสริม</div>
                </div>

                <div className="space-y-4">
                  {trendData.length === 0 ? (
                    <div className="py-10 text-center text-slate-400 text-sm">ยังไม่มีข้อมูลสถิติ</div>
                  ) : (
                    trendData.map((d, idx) => {
                      const totalWidth = Math.max((d.total / maxTrendValue) * 100, 2);
                      const rentPct = (d.rent / d.total) * 100;
                      const waterPct = (d.water / d.total) * 100;
                      const elecPct = (d.electric / d.total) * 100;
                      const extraPct = (d.extras / d.total) * 100;

                      return (
                        <div key={idx} className="group relative">
                          <div className="flex justify-between text-xs font-bold text-slate-600 mb-1">
                            <span>{formatMonthTh(d.month)}</span>
                            <span>{d.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ฿</span>
                          </div>
                          
                          <div className="w-full bg-slate-100 rounded-lg h-4 flex overflow-hidden">
                            <div className="h-full flex overflow-hidden rounded-lg transition-all duration-1000 ease-out" style={{ width: `${totalWidth}%` }}>
                              {rentPct > 0 && <div className="h-full bg-blue-600 hover:brightness-110 cursor-crosshair" style={{ width: `${rentPct}%` }} title={`ค่าเช่า: ${d.rent.toLocaleString()} ฿`}></div>}
                              {waterPct > 0 && <div className="h-full bg-sky-500 hover:brightness-110 cursor-crosshair" style={{ width: `${waterPct}%` }} title={`ค่าน้ำ: ${d.water.toLocaleString()} ฿`}></div>}
                              {elecPct > 0 && <div className="h-full bg-amber-500 hover:brightness-110 cursor-crosshair" style={{ width: `${elecPct}%` }} title={`ค่าไฟ: ${d.electric.toLocaleString()} ฿`}></div>}
                              {extraPct > 0 && <div className="h-full bg-violet-500 hover:brightness-110 cursor-crosshair" style={{ width: `${extraPct}%` }} title={`บริการเสริม: ${d.extras.toLocaleString()} ฿`}></div>}
                            </div>
                          </div>

                          {/* Hover Tooltip inside element via Group-hover could be complex with Tailwind, native title used on segments. 
                              But to show an aggregate tooltip: */}
                          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10 bg-slate-800 text-white text-[10px] p-2 rounded-xl shadow-lg w-max mt-6">
                            <p className="font-bold border-b border-slate-600 pb-1 mb-1">{formatMonthTh(d.month)}</p>
                            <p className="text-blue-300">ค่าเช่า: {d.rent.toLocaleString()} ฿</p>
                            <p className="text-sky-300">ค่าน้ำ: {d.water.toLocaleString()} ฿</p>
                            <p className="text-amber-300">ค่าไฟ: {d.electric.toLocaleString()} ฿</p>
                            <p className="text-violet-300">เสริม: {d.extras.toLocaleString()} ฿</p>
                            <p className="font-bold mt-1 pt-1 border-t border-slate-600">รวม: {d.total.toLocaleString()} ฿</p>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>

              {/* 4. Room Breakdown Table (2 Columns on LG) */}
              <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col h-full">
                <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                  <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
                    แจกแจงรายได้ตามห้องพัก {selectedMonth !== 'all' && `(${formatMonthTh(selectedMonth)})`}
                  </h3>
                  <span className="text-xs font-bold bg-white px-2 py-1 rounded-md text-slate-500 border border-slate-200 shadow-sm">
                    {filteredInvoices.length} รายการ
                  </span>
                </div>

                {/* Desktop Table (md+) */}
                <div className="hidden md:block overflow-x-auto flex-1">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/80 text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-100">
                        <th className="px-4 py-3 font-bold">ห้อง</th>
                        <th className="px-4 py-3 font-bold">ค่าเช่า</th>
                        <th className="px-4 py-3 font-bold text-right">ค่าน้ำ</th>
                        <th className="px-4 py-3 font-bold text-right">ค่าไฟ</th>
                        <th className="px-4 py-3 font-bold text-right">ส่วนเสริม</th>
                        <th className="px-4 py-3 font-bold text-right">ยอดสุทธิ</th>
                        <th className="px-4 py-3 font-bold text-center">สถานะ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filteredInvoices.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-6 py-12 text-center text-slate-400">ไม่พบข้อมูลในเดือนนี้</td>
                        </tr>
                      ) : (
                        <>
                          {filteredInvoices.map((inv, i) => {
                            const { rent, wCost, eCost, extras, total } = getInvoiceBreakdown(inv);
                            const isPaid = inv.status === 'paid' || inv.status === 'ชำระแล้ว';

                            return (
                              <tr 
                                key={i} 
                                onClick={() => handleRowClick(inv)}
                                className="hover:bg-blue-50/60 cursor-pointer transition-colors group"
                              >
                                <td className="px-4 py-3">
                                  <div className="font-bold text-slate-800">ห้อง {inv.room_number || '-'}</div>
                                  <div className="text-[10px] text-slate-400 line-clamp-1">{inv.first_name} {inv.last_name}</div>
                                </td>
                                <td className="px-4 py-3 text-slate-600 text-sm">{rent.toLocaleString()} ฿</td>
                                <td className="px-4 py-3 text-right">
                                  <div className="text-sky-600 font-medium text-sm">{wCost.toLocaleString()} ฿</div>
                                  <div className="text-[10px] text-slate-400">{inv.water_unit || 0} หน่วย</div>
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <div className="text-amber-500 font-medium text-sm">{eCost.toLocaleString()} ฿</div>
                                  <div className="text-[10px] text-slate-400">{inv.electric_unit || 0} หน่วย</div>
                                </td>
                                <td className="px-4 py-3 text-right">
                                  {extras > 0 ? (
                                    <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-violet-100 text-violet-700">
                                      +{extras.toLocaleString()} ฿
                                    </span>
                                  ) : (
                                    <span className="text-slate-300">-</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-right font-black text-slate-800">
                                  {total.toLocaleString()} ฿
                                </td>
                                <td className="px-4 py-3 text-center flex items-center justify-center gap-2">
                                  {isPaid ? (
                                    <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700">ชำระแล้ว</span>
                                  ) : (
                                    <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700">รอชำระ</span>
                                  )}
                                  <button 
                                    className="p-1 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-100 transition-colors opacity-0 group-hover:opacity-100"
                                    title="ดูรายละเอียด"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                          
                          {/* Total Row */}
                          <tr className="bg-slate-50/80 font-bold border-t-2 border-slate-200">
                            <td className="px-4 py-3 text-slate-700">รวมทั้งหมด</td>
                            <td className="px-4 py-3 text-slate-700 text-sm">
                              {filteredInvoices.reduce((sum, inv) => sum + getInvoiceBreakdown(inv).rent, 0).toLocaleString()} ฿
                            </td>
                            <td className="px-4 py-3 text-right text-sky-600 text-sm">
                              {filteredInvoices.reduce((sum, inv) => sum + getInvoiceBreakdown(inv).wCost, 0).toLocaleString()} ฿
                            </td>
                            <td className="px-4 py-3 text-right text-amber-500 text-sm">
                              {filteredInvoices.reduce((sum, inv) => sum + getInvoiceBreakdown(inv).eCost, 0).toLocaleString()} ฿
                            </td>
                            <td className="px-4 py-3 text-right text-violet-600 text-sm">
                              {filteredInvoices.reduce((sum, inv) => sum + getInvoiceBreakdown(inv).extras, 0).toLocaleString()} ฿
                            </td>
                            <td className="px-4 py-3 text-right text-slate-800 text-base">
                              {filteredInvoices.reduce((sum, inv) => sum + getInvoiceBreakdown(inv).total, 0).toLocaleString()} ฿
                            </td>
                            <td></td>
                          </tr>
                        </>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Accordion (below md) */}
                <div className="md:hidden divide-y divide-slate-100 overflow-y-auto max-h-[500px]">
                  {filteredInvoices.length === 0 ? (
                    <div className="py-12 text-center text-slate-400">ไม่พบข้อมูลในเดือนนี้</div>
                  ) : (
                    <>
                      {filteredInvoices.map((inv, i) => {
                        const { rent, wCost, eCost, extras, total } = getInvoiceBreakdown(inv);
                        const isPaid = inv.status === 'paid' || inv.status === 'ชำระแล้ว';
                        const isExpanded = expandedRoom === inv.invoices_id;

                        return (
                          <div key={i} className="bg-white">
                            <button 
                              onClick={() => setExpandedRoom(isExpanded ? null : inv.invoices_id)}
                              className="w-full px-4 py-3 flex justify-between items-center text-left active:bg-slate-50 transition-colors"
                            >
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-slate-800 text-base">ห้อง {inv.room_number || '-'}</span>
                                  {isPaid ? (
                                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                  ) : (
                                    <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                                  )}
                                </div>
                                <span className="text-xs text-slate-500">{total.toLocaleString()} ฿</span>
                              </div>
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}><polyline points="6 9 12 15 18 9"></polyline></svg>
                            </button>
                            
                            {/* Expanded Content */}
                            {isExpanded && (
                              <div className="px-4 pb-4 pt-1 bg-slate-50/50 border-t border-slate-50 text-sm">
                                <div className="grid grid-cols-2 gap-3 mb-2">
                                  <div className="bg-white p-2 rounded-lg border border-slate-100">
                                    <p className="text-[10px] text-slate-400 mb-0.5">ค่าน้ำ ({inv.water_unit || 0} น.)</p>
                                    <p className="font-semibold text-sky-600">{wCost.toLocaleString()} ฿</p>
                                  </div>
                                  <div className="bg-white p-2 rounded-lg border border-slate-100">
                                    <p className="text-[10px] text-slate-400 mb-0.5">ค่าไฟ ({inv.electric_unit || 0} น.)</p>
                                    <p className="font-semibold text-amber-500">{eCost.toLocaleString()} ฿</p>
                                  </div>
                                </div>
                                <div className="flex justify-between items-center bg-white p-2.5 rounded-lg border border-slate-100 mb-2">
                                  <span className="text-xs text-slate-500">ค่าเช่าหลัก</span>
                                  <span className="font-semibold text-slate-700">{rent.toLocaleString()} ฿</span>
                                </div>
                                {extras > 0 && (
                                  <div className="flex justify-between items-center bg-violet-50 p-2.5 rounded-lg border border-violet-100 mb-2">
                                    <span className="text-xs text-violet-600 font-bold">บริการเสริม</span>
                                    <span className="font-semibold text-violet-700">+{extras.toLocaleString()} ฿</span>
                                  </div>
                                )}
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleRowClick(inv); }}
                                  className="w-full mt-2 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1 active:scale-95"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                  ดูรายละเอียดบิลฉบับเต็ม
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                      
                      <div className="bg-slate-50 border-t-2 border-slate-200 p-4">
                        <div className="flex justify-between items-center font-black text-slate-800">
                          <span>ยอดรวมทั้งหมด</span>
                          <span>{filteredInvoices.reduce((sum, inv) => sum + getInvoiceBreakdown(inv).total, 0).toLocaleString()} ฿</span>
                        </div>
                      </div>
                    </>
                  )}
                </div>

              </div>
            </div>
          </>
        )}
      </div>

      {/* Invoice Detail Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm print-hide" onClick={() => { setSelectedInvoice(null); setShowSlip(false); }}></div>
          
          <div id="printable-invoice" className="bg-white w-full max-w-2xl max-h-full sm:h-auto overflow-y-auto rounded-2xl shadow-2xl relative z-10 flex flex-col animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex justify-between items-start p-5 sm:p-6 border-b border-slate-100 bg-slate-50/50 sticky top-0 z-20 rounded-t-2xl">
              <div>
                <h3 className="text-lg sm:text-xl font-black text-slate-800 flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                  รายละเอียดบิลประจำห้อง {selectedInvoice.room_number || '-'}
                </h3>
                <div className="flex flex-wrap items-center gap-3 mt-1.5">
                  <span className="text-xs font-bold text-slate-500 bg-white px-2 py-0.5 rounded-md border border-slate-200 shadow-sm">
                    {formatMonthTh(selectedInvoice.month_year_normalized)}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">เลขที่บิล: #{selectedInvoice.invoices_id || '-'}</span>
                  {(selectedInvoice.status === 'paid' || selectedInvoice.status === 'ชำระแล้ว') ? (
                    <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700">ชำระแล้ว</span>
                  ) : (
                    <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700">รอชำระ</span>
                  )}
                </div>
              </div>
              <button 
                onClick={() => { setSelectedInvoice(null); setShowSlip(false); }}
                className="p-2 bg-white text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors border border-slate-200 print-hide"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 sm:p-6 space-y-6 flex-1">
              {/* Tenant Info */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">
                    {selectedInvoice.first_name ? selectedInvoice.first_name.charAt(0) : '?'}
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 font-medium">คู่สัญญา / ผู้เช่า</p>
                    <p className="text-sm font-bold text-slate-800">{selectedInvoice.first_name || '-'} {selectedInvoice.last_name || ''}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-500 font-medium">เบอร์โทรศัพท์</p>
                  <p className="text-sm font-bold text-slate-800">{selectedInvoice.phone_number || '-'}</p>
                </div>
              </div>

              {/* Itemized Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-500 text-[10px] sm:text-xs uppercase">
                    <tr>
                      <th className="px-3 sm:px-4 py-3 text-left font-bold">รายการ</th>
                      <th className="px-3 sm:px-4 py-3 text-right font-bold hidden sm:table-cell">หน่วย</th>
                      <th className="px-3 sm:px-4 py-3 text-right font-bold hidden sm:table-cell">ราคา</th>
                      <th className="px-3 sm:px-4 py-3 text-right font-bold">จำนวนเงิน (THB)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(() => {
                      const breakdown = getInvoiceBreakdown(selectedInvoice);
                      return (
                        <>
                          <tr>
                            <td className="px-3 sm:px-4 py-3 font-medium text-slate-700">ค่าเช่าห้องพักหลัก</td>
                            <td className="px-3 sm:px-4 py-3 text-right text-slate-500 hidden sm:table-cell">-</td>
                            <td className="px-3 sm:px-4 py-3 text-right text-slate-500 hidden sm:table-cell">-</td>
                            <td className="px-3 sm:px-4 py-3 text-right font-semibold text-slate-700">{breakdown.rent.toLocaleString()}</td>
                          </tr>
                          <tr>
                            <td className="px-3 sm:px-4 py-3 font-medium text-slate-700 flex items-center gap-1.5 sm:gap-2">
                              <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-sky-500"></span>ค่าน้ำประปา
                            </td>
                            <td className="px-3 sm:px-4 py-3 text-right text-slate-500 hidden sm:table-cell">{selectedInvoice.water_unit || 0}</td>
                            <td className="px-3 sm:px-4 py-3 text-right text-slate-500 hidden sm:table-cell">{selectedInvoice.water_rate || 0}</td>
                            <td className="px-3 sm:px-4 py-3 text-right font-semibold text-sky-600">{breakdown.wCost.toLocaleString()}</td>
                          </tr>
                          <tr>
                            <td className="px-3 sm:px-4 py-3 font-medium text-slate-700 flex items-center gap-1.5 sm:gap-2">
                              <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-amber-500"></span>ค่าไฟฟ้า
                            </td>
                            <td className="px-3 sm:px-4 py-3 text-right text-slate-500 hidden sm:table-cell">{selectedInvoice.electric_unit || 0}</td>
                            <td className="px-3 sm:px-4 py-3 text-right text-slate-500 hidden sm:table-cell">{selectedInvoice.electric_rate || 0}</td>
                            <td className="px-3 sm:px-4 py-3 text-right font-semibold text-amber-500">{breakdown.eCost.toLocaleString()}</td>
                          </tr>
                          {(() => {
                            const hasAddItems = Array.isArray(selectedInvoice.additional_items) && selectedInvoice.additional_items.length > 0;
                            let addItemsSum = 0;
                            let addItemsElements = null;

                            if (hasAddItems) {
                              addItemsSum = selectedInvoice.additional_items.reduce((sum: number, item: any) => sum + (Number(item.price) || 0), 0);
                              addItemsElements = selectedInvoice.additional_items.map((item: any, idx: number) => (
                                <tr key={`add-${idx}`}>
                                  <td className="px-3 sm:px-4 py-3 font-medium text-slate-700 flex items-center gap-1.5 sm:gap-2">
                                    <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-violet-500"></span>{item.name || 'บริการเสริม'}
                                  </td>
                                  <td className="px-3 sm:px-4 py-3 text-right text-slate-500 hidden sm:table-cell">-</td>
                                  <td className="px-3 sm:px-4 py-3 text-right text-slate-500 hidden sm:table-cell">-</td>
                                  <td className="px-3 sm:px-4 py-3 text-right font-semibold text-violet-600">{Number(item.price || 0).toLocaleString()}</td>
                                </tr>
                              ));
                            }

                            // Calculate remaining extra (VAT or other nameless fee)
                            const remainingExtra = Math.max(0, breakdown.extras - addItemsSum);
                            
                            let remainingElement = null;
                            if (remainingExtra > 0) {
                              remainingElement = (
                                <tr>
                                  <td className="px-3 sm:px-4 py-3 font-medium text-slate-700 flex items-center gap-1.5 sm:gap-2">
                                    <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-rose-500"></span>ภาษีมูลค่าเพิ่ม (VAT 7%) / ค่าธรรมเนียมอื่นๆ
                                  </td>
                                  <td className="px-3 sm:px-4 py-3 text-right text-slate-500 hidden sm:table-cell">-</td>
                                  <td className="px-3 sm:px-4 py-3 text-right text-slate-500 hidden sm:table-cell">-</td>
                                  <td className="px-3 sm:px-4 py-3 text-right font-semibold text-rose-600">{remainingExtra.toLocaleString()}</td>
                                </tr>
                              );
                            }

                            return (
                              <>
                                {addItemsElements}
                                {remainingElement}
                              </>
                            );
                          })()}
                          <tr className="bg-slate-50/80">
                            <td colSpan={3} className="px-3 sm:px-4 py-4 text-right font-black text-slate-800 text-sm sm:text-base hidden sm:table-cell">ยอดรวมสุทธิ (Total Amount)</td>
                            <td className="px-3 sm:px-4 py-4 text-left font-black text-slate-800 text-sm sm:hidden">ยอดรวมสุทธิ</td>
                            <td className="px-3 sm:px-4 py-4 text-right font-black text-blue-600 text-base sm:text-xl">{breakdown.total.toLocaleString()} ฿</td>
                          </tr>
                        </>
                      );
                    })()}
                  </tbody>
                </table>
              </div>

              {/* Slip Image */}
              {selectedInvoice.slip_image && (
                <div className="space-y-2">
                  <p className="text-sm font-bold text-slate-700">หลักฐานการชำระเงิน (Slip)</p>
                  <div 
                    className="w-24 h-32 sm:w-32 sm:h-40 bg-slate-100 rounded-xl overflow-hidden border border-slate-200 relative group cursor-zoom-in shadow-sm" 
                    onClick={() => setShowSlip(!showSlip)}
                  >
                    <img 
                      src={selectedInvoice.slip_image} 
                      alt="Slip Thumbnail" 
                      className="w-full h-full object-cover transition-all"
                    />
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
                    </div>
                  </div>

                  {/* Full Slip Viewer */}
                  {showSlip && (
                    <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
                      <button 
                        onClick={() => setShowSlip(false)} 
                        className="absolute top-4 right-4 z-[210] p-3 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur-md transition-colors"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                      </button>
                      <img 
                        src={selectedInvoice.slip_image} 
                        alt="Full Slip" 
                        className="max-w-full max-h-full object-contain cursor-zoom-out rounded-lg shadow-2xl"
                        onClick={() => setShowSlip(false)}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50 flex justify-center rounded-b-2xl print-hide">
              <button 
                onClick={() => { setSelectedInvoice(null); setShowSlip(false); }}
                className="px-8 py-2.5 bg-white border border-slate-300 text-slate-700 font-bold rounded-xl hover:bg-slate-50 active:scale-95 transition-all text-sm w-full sm:w-auto shadow-sm"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-invoice, #printable-invoice * {
            visibility: visible;
          }
          #printable-invoice {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            margin: 0;
            padding: 20px;
            background: white !important;
            box-shadow: none !important;
            border-radius: 0 !important;
          }
          .print-hide, .print-hide * {
            display: none !important;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>
    </AdminLayout>
  );
}
