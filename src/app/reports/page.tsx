"use client";

import React, { useEffect, useState, useMemo, useRef } from 'react';
import { supabase } from '@/backend/lib/supabase';
import AdminLayout from '@/components/AdminLayout';

const normalizeMonth = (raw: string) => {
  if (!raw) return 'Unknown';

  // Try to extract Year and Month using regex
  // Matches "YYYY-MM", "YYYY-MM-DD", "YYYY/MM"
  const matchIso = raw.match(/^(\d{4})[-\/](\d{1,2})/);
  if (matchIso) {
    let y = parseInt(matchIso[1]);
    let m = parseInt(matchIso[2]);
    if (y > 2500) y -= 543; // Convert Thai year to Gregorian if > 2500
    return `${y}-${String(m).padStart(2, '0')}`;
  }

  // Matches "MM/YYYY", "DD/MM/YYYY"
  const matchThai = raw.match(/(\d{1,2})\/(\d{4})/);
  if (matchThai) {
    let m = parseInt(matchThai[1]);
    let y = parseInt(matchThai[2]);
    if (y > 2500) y -= 543;
    const matchFullThai = raw.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (matchFullThai) {
      m = parseInt(matchFullThai[2]);
      y = parseInt(matchFullThai[3]);
      if (y > 2500) y -= 543;
    }
    return `${y}-${String(m).padStart(2, '0')}`;
  }

  // Handle Thai text months
  const thaiMonths = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.", "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
  for (let i = 0; i < thaiMonths.length; i++) {
    if (raw.includes(thaiMonths[i])) {
      const monthNum = (i % 12) + 1;
      const yearMatch = raw.match(/\d{4}/);
      if (yearMatch) {
        let y = parseInt(yearMatch[0]);
        if (y > 2500) y -= 543;
        return `${y}-${String(monthNum).padStart(2, '0')}`;
      }
    }
  }

  // Fallback to Date object
  const d = new Date(raw);
  if (!isNaN(d.getTime())) {
    let y = d.getFullYear();
    let m = d.getMonth() + 1;
    if (y > 2500) y -= 543;
    return `${y}-${String(m).padStart(2, '0')}`;
  }

  return raw;
};

const formatMonthTh = (monthYear: string) => {
  if (monthYear === 'Unknown') return 'ไม่ระบุเดือน';
  const match = monthYear.match(/^(\d{4})-(\d{2})$/);
  if (!match) return monthYear;
  const year = parseInt(match[1]);
  const month = parseInt(match[2]);
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
};

export default function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState<any[]>([]);

  // States for Multi-select Dropdown
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // State for toggling % and Absolute Diff on mobile
  const [toggledCells, setToggledCells] = useState<{ [key: string]: boolean }>({});
  
  const handleToggleCell = (key: string) => {
    setToggledCells(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    fetchReportData();
  }, []);

  const fetchReportData = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          contracts (
            rooms ( price_per_month )
          )
        `)
        .eq('status', 'paid');

      if (error) throw error;

      if (data) {
        processReportData(data);
      }
    } catch (err: any) {
      console.error('Error fetching reports:', err);
      alert('ไม่สามารถดึงข้อมูลรายงานได้: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const processReportData = (invoices: any[]) => {
    const grouped: { [key: string]: any } = {};

    invoices.forEach(inv => {
      const month = normalizeMonth(inv.month_year);

      if (!grouped[month]) {
        grouped[month] = {
          month,
          totalRevenue: 0,
          water: 0,
          electric: 0,
          rent: 0,
          other: 0,
        };
      }

      const waterCost = (inv.water_unit || 0) * (inv.water_rate || 0);
      const electricCost = (inv.electric_unit || 0) * (inv.electric_rate || 0);
      const rentCost = inv.contracts?.rooms?.price_per_month || 0;
      const totalAmount = Number(inv.total_amount) || 0;

      const otherCost = totalAmount - waterCost - electricCost - rentCost;

      grouped[month].totalRevenue += totalAmount;
      grouped[month].water += waterCost;
      grouped[month].electric += electricCost;
      grouped[month].rent += rentCost;
      grouped[month].other += otherCost > 0 ? otherCost : 0;
    });

    const sortedData = Object.values(grouped).sort((a: any, b: any) => {
      return a.month.localeCompare(b.month);
    });

    setReportData(sortedData);
  };

  // Logic for toggling checkboxes
  const toggleMonth = (month: string) => {
    setSelectedMonths(prev =>
      prev.includes(month)
        ? prev.filter(m => m !== month)
        : [...prev, month]
    );
  };

  const selectAll = () => setSelectedMonths([]); // Empty array represents "All"

  const filteredData = useMemo(() => {
    if (selectedMonths.length === 0) return reportData; // Show all if none checked
    return reportData.filter(d => selectedMonths.includes(d.month));
  }, [reportData, selectedMonths]);

  const displayTotals = useMemo(() => {
    return filteredData.reduce((acc, curr) => {
      acc.totalRevenue += curr.totalRevenue;
      acc.totalWater += curr.water;
      acc.totalElectric += curr.electric;
      acc.totalRent += curr.rent;
      return acc;
    }, { totalRevenue: 0, totalWater: 0, totalElectric: 0, totalRent: 0 });
  }, [filteredData]);

  const maxRevenue = reportData.length > 0 ? Math.max(...reportData.map(d => d.totalRevenue)) : 1;

  // Render Change Indicator Function (MoM Percentage Change)
  const renderChangeIndicator = (current: number, prev: number | null | undefined, cellKey: string) => {
    if (prev === null || prev === undefined) return null; // No previous month to compare
    let change = 0;
    const diff = current - prev;

    if (prev === 0) {
      if (current === 0) return <span className="text-slate-400 text-[10px] mt-0.5">-</span>;
      change = 100; // Represent as 100% increase if going from 0 to positive
    } else {
      change = (diff / prev) * 100;
    }

    if (change === 0) return <span className="text-slate-400 text-[10px] mt-0.5">-</span>;

    const formattedDiff = Math.abs(diff).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    const isToggled = !!toggledCells[cellKey];
    
    const displayText = isToggled ? `${formattedDiff} ฿` : `${Math.abs(change).toFixed(1)}%`;
    const colorClass = change > 0 
      ? (isToggled ? 'text-green-700 bg-green-100' : 'text-green-500 hover:text-green-600') 
      : (isToggled ? 'text-red-700 bg-red-100' : 'text-red-500 hover:text-red-600');
    
    const arrowIcon = change > 0 
      ? <svg className="w-3 h-3 mr-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" /></svg>
      : <svg className="w-3 h-3 mr-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>;

    return (
      <div 
        onClick={() => handleToggleCell(cellKey)}
        className={`flex items-center text-[10.5px] font-bold mt-0.5 cursor-pointer px-1.5 py-0.5 rounded transition-colors duration-200 select-none active:scale-95 ${colorClass}`}
        title="คลิกเพื่อสลับดูจำนวนเงิน/เปอร์เซ็นต์"
      >
        {arrowIcon}
        {displayText}
      </div>
    );
  };

  return (
    <AdminLayout>
      <div className="p-6 sm:p-8 max-w-7xl mx-auto space-y-8 pb-20">

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">รายงานสรุปรายได้</h1>
            <p className="text-slate-500 font-medium mt-1 text-sm sm:text-base">ข้อมูลรายได้จากบิลที่ชำระเงินเรียบร้อยแล้วทั้งหมด</p>
          </div>
          {!loading && reportData.length > 0 && (
            <div className="w-full sm:w-auto relative" ref={dropdownRef}>
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="w-full sm:w-64 bg-white border border-slate-200 text-slate-700 rounded-xl px-4 py-2.5 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm transition-all flex items-center justify-between"
              >
                <span>
                  {selectedMonths.length === 0
                    ? "ดูทั้งหมด"
                    : `เลือก ${selectedMonths.length} เดือน`}
                </span>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}><polyline points="6 9 12 15 18 9"></polyline></svg>
              </button>

              {isDropdownOpen && (
                <div className="absolute right-0 z-50 mt-2 w-full sm:w-64 bg-white border border-slate-200 rounded-xl shadow-xl max-h-[300px] overflow-y-auto">
                  <div className="p-2">
                    <label className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors border-b border-slate-100 mb-1">
                      <input
                        type="checkbox"
                        checked={selectedMonths.length === 0}
                        onChange={selectAll}
                        className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 accent-blue-600 cursor-pointer"
                      />
                      <span className="text-sm font-bold text-slate-700">ดูทั้งหมด</span>
                    </label>

                    {reportData.map(d => (
                      <label key={d.month} className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          checked={selectedMonths.includes(d.month)}
                          onChange={() => toggleMonth(d.month)}
                          className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 accent-blue-600 cursor-pointer"
                        />
                        <span className="text-sm font-medium text-slate-600">{formatMonthTh(d.month)}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl shadow-sm border border-slate-100">
            <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
            <p className="mt-4 text-slate-500 font-medium">กำลังโหลดข้อมูลรายงาน...</p>
          </div>
        ) : (
          <>
            {/* ส่วนบน: สรุปยอดรวม (Cards) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-3xl p-6 text-white shadow-xl shadow-blue-900/20 relative overflow-hidden transition-all duration-300">
                <div className="relative z-10">
                  <p className="text-blue-100 font-medium mb-1">รายได้สุทธิทั้งหมด</p>
                  <h2 className="text-4xl font-black whitespace-nowrap">{displayTotals.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ฿</h2>
                </div>
                <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-4 translate-y-4">
                  <svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
                </div>
              </div>

              <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex items-center justify-between transition-all duration-300">
                <div>
                  <p className="text-slate-500 font-medium mb-1 text-sm">ยอดรวมค่าน้ำประปา</p>
                  <h2 className="text-2xl font-black text-cyan-600 whitespace-nowrap">{displayTotals.totalWater.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ฿</h2>
                </div>
                <div className="w-12 h-12 rounded-full bg-cyan-50 flex items-center justify-center text-cyan-500 shrink-0 ml-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path></svg>
                </div>
              </div>

              <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex items-center justify-between transition-all duration-300">
                <div>
                  <p className="text-slate-500 font-medium mb-1 text-sm">ยอดรวมค่าไฟฟ้า</p>
                  <h2 className="text-2xl font-black text-amber-500 whitespace-nowrap">{displayTotals.totalElectric.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ฿</h2>
                </div>
                <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center text-amber-500 shrink-0 ml-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
                </div>
              </div>
            </div>

            {/* ส่วนกลาง: CSS Bar Chart แนวนอน */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
                  กราฟแสดงรายได้สุทธิรายเดือน
                </h3>

                {/* Legend */}
                {reportData.length > 0 && (
                  <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-600 bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-100">
                    <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-blue-500 shadow-sm"></div>ค่าเช่า</div>
                    <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-cyan-400 shadow-sm"></div>ค่าน้ำ</div>
                    <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-yellow-400 shadow-sm"></div>ค่าไฟ</div>
                    <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-purple-400 shadow-sm"></div>บริการอื่นๆ เช่น เช่าตู้เย็น</div>
                  </div>
                )}
              </div>

              <div className="space-y-5">
                {filteredData.length === 0 ? (
                  <p className="text-center text-slate-500 py-10 font-medium">ยังไม่มีข้อมูลรายได้ที่ชำระแล้ว</p>
                ) : (
                  filteredData.map((data, idx) => {
                    const percent = Math.max((data.totalRevenue / maxRevenue) * 100, 2);

                    const rentPct = data.totalRevenue > 0 ? (data.rent / data.totalRevenue) * 100 : 0;
                    const waterPct = data.totalRevenue > 0 ? (data.water / data.totalRevenue) * 100 : 0;
                    const electricPct = data.totalRevenue > 0 ? (data.electric / data.totalRevenue) * 100 : 0;
                    const otherPct = data.totalRevenue > 0 ? (data.other / data.totalRevenue) * 100 : 0;

                    return (
                      <div key={idx} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 group">
                        <div className="w-32 shrink-0 text-sm font-semibold text-slate-600 sm:text-right">
                          {formatMonthTh(data.month)}
                        </div>
                        <div className="flex-1 h-8 bg-slate-50 rounded-lg flex items-center w-full overflow-hidden">
                          {/* Stacked Bar Container */}
                          <div
                            className="h-full flex rounded-lg overflow-hidden shadow-sm transition-all duration-1000 ease-out"
                            style={{ width: `${percent}%` }}
                          >
                            {rentPct > 0 && (
                              <div className="h-full bg-blue-500 transition-all hover:brightness-110 flex items-center justify-center text-xs text-white font-bold" style={{ width: `${rentPct}%` }} title={`ค่าเช่า: ${data.rent.toLocaleString()} ฿`}>
                                {rentPct > 8 && `${Math.round(rentPct)}%`}
                              </div>
                            )}
                            {waterPct > 0 && (
                              <div className="h-full bg-cyan-400 transition-all hover:brightness-110 flex items-center justify-center text-xs text-white font-bold" style={{ width: `${waterPct}%` }} title={`ค่าน้ำ: ${data.water.toLocaleString()} ฿`}>
                                {waterPct > 8 && `${Math.round(waterPct)}%`}
                              </div>
                            )}
                            {electricPct > 0 && (
                              <div className="h-full bg-yellow-400 transition-all hover:brightness-110 flex items-center justify-center text-xs text-white font-bold" style={{ width: `${electricPct}%` }} title={`ค่าไฟ: ${data.electric.toLocaleString()} ฿`}>
                                {electricPct > 8 && `${Math.round(electricPct)}%`}
                              </div>
                            )}
                            {otherPct > 0 && (
                              <div className="h-full bg-purple-400 transition-all hover:brightness-110 flex items-center justify-center text-xs text-white font-bold" style={{ width: `${otherPct}%` }} title={`อื่นๆ: ${data.other.toLocaleString()} ฿`}>
                                {otherPct > 8 && `${Math.round(otherPct)}%`}
                              </div>
                            )}
                          </div>
                        </div>
                        {/* ตัวเลขยอดรวมแบบ Fix Layout */}
                        <div className="w-28 shrink-0 text-sm font-bold text-slate-700 sm:text-right whitespace-nowrap">
                          {data.totalRevenue.toLocaleString()} ฿
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* ส่วนล่าง: ตารางสรุปรายได้ */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
                  ตารางสรุปรายได้แยกตามเดือน
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 border-b border-slate-100">
                      <th className="px-6 py-4 font-bold">เดือน</th>
                      <th className="px-6 py-4 font-bold text-right">ค่าเช่า</th>
                      <th className="px-6 py-4 font-bold text-right">ค่าน้ำ</th>
                      <th className="px-6 py-4 font-bold text-right">ค่าไฟ</th>
                      <th className="px-6 py-4 font-bold text-right">บริการอื่นๆ</th>
                      <th className="px-6 py-4 font-bold text-right bg-blue-50/30">รายได้สุทธิ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {filteredData.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-slate-500 font-medium">
                          ยังไม่มีข้อมูล
                        </td>
                      </tr>
                    ) : (
                      filteredData.map((row, idx) => {
                        // ค้นหาเดือนก่อนหน้าโดยอิงจากข้อมูลที่ถูก Filter แล้ว (index ก่อนหน้าในตาราง)
                        const prevRow = idx > 0 ? filteredData[idx - 1] : null;

                        return (
                          <tr key={idx} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 font-semibold text-slate-700 whitespace-nowrap">
                              {formatMonthTh(row.month)}
                            </td>
                            <td className="px-6 py-4 text-right whitespace-nowrap">
                              <div className="flex flex-col items-end">
                                <span className="text-slate-600 font-medium">{row.rent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                {renderChangeIndicator(row.rent, prevRow?.rent, `${row.month}-rent`)}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right whitespace-nowrap">
                              <div className="flex flex-col items-end">
                                <span className="text-cyan-600 font-medium">{row.water.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                {renderChangeIndicator(row.water, prevRow?.water, `${row.month}-water`)}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right whitespace-nowrap">
                              <div className="flex flex-col items-end">
                                <span className="text-amber-500 font-medium">{row.electric.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                {renderChangeIndicator(row.electric, prevRow?.electric, `${row.month}-electric`)}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right whitespace-nowrap">
                              <div className="flex flex-col items-end">
                                <span className="text-slate-600 font-medium">{row.other.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                {renderChangeIndicator(row.other, prevRow?.other, `${row.month}-other`)}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right whitespace-nowrap bg-blue-50/10">
                              <div className="flex flex-col items-end">
                                <span className="font-bold text-blue-600 text-base">{row.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ฿</span>
                                {renderChangeIndicator(row.totalRevenue, prevRow?.totalRevenue, `${row.month}-total`)}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
