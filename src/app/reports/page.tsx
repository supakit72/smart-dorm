"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/backend/lib/supabase';
import AdminLayout from '@/components/AdminLayout';
import * as XLSX from 'xlsx';

// Utility functions
const formatMonthTh = (monthYear: string) => {
  if (!monthYear || monthYear === 'Unknown') return 'ไม่ระบุเดือน';
  const thaiMonths = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

  // Format YYYY-MM
  const matchIso = monthYear.match(/^(\d{4})-(\d{2})$/);
  if (matchIso) {
    const year = parseInt(matchIso[1]);
    const month = parseInt(matchIso[2]);
    const thaiYear = year > 2500 ? year : year + 543;
    if (month >= 1 && month <= 12) {
      return `${thaiMonths[month - 1]} ${thaiYear}`;
    }
  }

  // Format D/M/YYYY or DD/MM/YYYY
  const matchDmy = monthYear.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
  if (matchDmy) {
    const month = parseInt(matchDmy[2]);
    const year = parseInt(matchDmy[3]);
    const thaiYear = year > 2500 ? year : year + 543;
    if (month >= 1 && month <= 12) {
      return `${thaiMonths[month - 1]} ${thaiYear}`;
    }
  }

  return monthYear;
};

const normalizeMonth = (raw: string) => {
  if (!raw || raw === 'Unknown') return 'Unknown';
  // Check ISO format YYYY-MM, YYYY/MM, or YYYY-MM-DD
  const matchIso = raw.match(/^(\d{4})[-\/](\d{1,2})/);
  if (matchIso) {
    let y = parseInt(matchIso[1]);
    let m = parseInt(matchIso[2]);
    if (y > 2500) y -= 543;
    return `${y}-${String(m).padStart(2, '0')}`;
  }
  // Check D/M/YYYY or DD/MM/YYYY
  const matchDmy = raw.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
  if (matchDmy) {
    let m = parseInt(matchDmy[2]);
    let y = parseInt(matchDmy[3]);
    if (y > 2500) y -= 543;
    return `${y}-${String(m).padStart(2, '0')}`;
  }
  return raw;
};

const formatDateTimeTh = (isoString?: string) => {
  if (!isoString) return '-';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    const thaiMonths = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
    const day = d.getDate();
    const month = thaiMonths[d.getMonth()];
    const year = d.getFullYear() > 2500 ? d.getFullYear() : d.getFullYear() + 543;
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day} ${month} ${year} ${hours}:${minutes}`;
  } catch {
    return isoString;
  }
};

const parseIssue = (issueDetails?: string) => {
  if (!issueDetails) return { category: 'ทั่วไป', detail: '-' };
  const match = issueDetails.match(/^\[(.*?)\]\s*(.*)$/);
  if (match) {
    return {
      category: match[1]?.trim() || 'ทั่วไป',
      detail: match[2]?.trim() || '-'
    };
  }
  return {
    category: 'ทั่วไป',
    detail: issueDetails.trim()
  };
};

const getCategoryColor = (cat: string, index = 0) => {
  const norm = (cat || '').trim().toLowerCase();
  if (norm.includes('ไฟ')) {
    return { bg: 'bg-amber-500', bar: 'bg-amber-500', text: 'text-amber-700', badge: 'bg-amber-50 text-amber-700 border-amber-200' };
  }
  if (norm.includes('แอร์') || norm.includes('ปรับอากาศ')) {
    return { bg: 'bg-sky-500', bar: 'bg-sky-500', text: 'text-sky-700', badge: 'bg-sky-50 text-sky-700 border-sky-200' };
  }
  if (norm.includes('น้ำ') || norm.includes('ประปา') || norm.includes('ท่อ') || norm.includes('ส้วม')) {
    return { bg: 'bg-blue-500', bar: 'bg-blue-500', text: 'text-blue-700', badge: 'bg-blue-50 text-blue-700 border-blue-200' };
  }
  if (norm.includes('เฟอร์') || norm.includes('โครงสร้าง') || norm.includes('ประตู') || norm.includes('หน้าต่าง')) {
    return { bg: 'bg-emerald-500', bar: 'bg-emerald-500', text: 'text-emerald-700', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  }
  if (norm.includes('เน็ต') || norm.includes('wifi') || norm.includes('อินเทอร์เน็ต')) {
    return { bg: 'bg-violet-500', bar: 'bg-violet-500', text: 'text-violet-700', badge: 'bg-violet-50 text-violet-700 border-violet-200' };
  }

  const palette = [
    { bg: 'bg-indigo-500', bar: 'bg-indigo-500', text: 'text-indigo-700', badge: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
    { bg: 'bg-purple-500', bar: 'bg-purple-500', text: 'text-purple-700', badge: 'bg-purple-50 text-purple-700 border-purple-200' },
    { bg: 'bg-rose-500', bar: 'bg-rose-500', text: 'text-rose-700', badge: 'bg-rose-50 text-rose-700 border-rose-200' },
    { bg: 'bg-teal-500', bar: 'bg-teal-500', text: 'text-teal-700', badge: 'bg-teal-50 text-teal-700 border-teal-200' },
    { bg: 'bg-slate-500', bar: 'bg-slate-500', text: 'text-slate-700', badge: 'bg-slate-100 text-slate-700 border-slate-200' }
  ];
  return palette[index % palette.length];
};

export default function ReportsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Tab Switcher
  const [activeTab, setActiveTab] = useState<'finance' | 'maintenance'>('finance');

  // Financial Data
  const [invoicesData, setInvoicesData] = useState<any[]>([]);
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  
  // Maintenance Data & Filters
  const [maintenanceData, setMaintenanceData] = useState<any[]>([]);
  const [maintSearchQuery, setMaintSearchQuery] = useState('');
  const [maintStatusFilter, setMaintStatusFilter] = useState('all');
  const [expandedMaintId, setExpandedMaintId] = useState<any | null>(null);
  const [selectedMaintenancePhoto, setSelectedMaintenancePhoto] = useState<string | null>(null);

  // UI State for mobile accordion (Financial)
  const [expandedRoom, setExpandedRoom] = useState<string | null>(null);
  
  // UI State for Invoice Detail Modal
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [showSlip, setShowSlip] = useState(false);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedInvoice(null);
        setShowSlip(false);
        setSelectedMaintenancePhoto(null);
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
      
      const [invRes, maintRes] = await Promise.all([
        supabase.from('view_invoice_details').select('*'),
        supabase.from('view_maintenance_details').select('*').order('created_at', { ascending: false })
      ]);

      if (invRes.error) throw invRes.error;
      
      const invoices = (invRes.data || []).map(inv => {
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

      if (!maintRes.error && maintRes.data) {
        setMaintenanceData(maintRes.data);
      } else if (maintRes.error) {
        console.warn('Maintenance fetch error:', maintRes.error);
      }
      
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
    const targetNorm = normalizeMonth(selectedMonth);
    return invoicesData.filter(inv => 
      inv.month_year_normalized === selectedMonth || 
      inv.month_year_normalized === targetNorm ||
      inv.month_year === selectedMonth
    );
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
    if (filteredInvoices.length === 0) {
      alert('ไม่พบข้อมูลสำหรับส่งออก Excel ในช่วงเวลาที่เลือก');
      return;
    }

    try {
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

        const roomDisplay = inv?.room_number 
          ? (String(inv.room_number).includes('ห้อง') ? String(inv.room_number) : `ห้อง ${inv.room_number}`)
          : '-';

        return {
          'เลขที่บิล': inv?.invoices_id || '-',
          'ประจำรอบเดือน': formatMonthTh(inv?.month_year_normalized || inv?.month_year),
          'เลขห้อง': roomDisplay,
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

      // Excel Sheet Name: Cannot contain: \ / ? * [ ] : and max 31 chars
      const rawSheetName = selectedMonth === 'all' ? 'ทุกเดือน' : formatMonthTh(selectedMonth);
      let safeSheetName = rawSheetName.replace(/[\/\\?*\[\]:]/g, '-').trim();
      if (!safeSheetName) safeSheetName = 'รายงาน';
      safeSheetName = safeSheetName.substring(0, 31);

      XLSX.utils.book_append_sheet(workbook, worksheet, safeSheetName);

      worksheet['!cols'] = [
        { wch: 15 }, // เลขที่บิล
        { wch: 18 }, // ประจำรอบเดือน
        { wch: 12 }, // เลขห้อง
        { wch: 25 }, // ชื่อผู้เช่า
        { wch: 14 }, // ค่าเช่าห้อง
        { wch: 14 }, // หน่วยน้ำที่ใช้
        { wch: 14 }, // รวมเงินค่าน้ำ
        { wch: 14 }, // หน่วยไฟที่ใช้
        { wch: 14 }, // รวมเงินค่าไฟ
        { wch: 16 }, // บริการเสริม/อื่นๆ
        { wch: 16 }, // ยอดรวมสุทธิ
        { wch: 16 }, // สถานะการชำระเงิน
        { wch: 18 }  // วันที่ชำระเงินจริง
      ];

      // File Name:
      // ถ้าโหลดทุกเดือน: SmartDorm_Report_All.xlsx
      // ถ้าโหลดเฉพาะเดือน: SmartDorm_Report_2026-03.xlsx
      let fileName = 'SmartDorm_Report_All.xlsx';
      if (selectedMonth !== 'all') {
        const norm = normalizeMonth(selectedMonth);
        const cleanMonth = (norm && norm !== 'Unknown' ? norm : selectedMonth).replace(/[\/\\?*\[\]:]/g, '-');
        fileName = `SmartDorm_Report_${cleanMonth}.xlsx`;
      }

      XLSX.writeFile(workbook, fileName);
    } catch (err: any) {
      console.error('Export Excel error:', err);
      alert('เกิดข้อผิดพลาดในการส่งออก Excel: ' + (err?.message || err));
    }
  };

  // Maintenance Metrics & KPIs
  const maintMetrics = useMemo(() => {
    const total = maintenanceData.length;
    let pending = 0;
    let inProgress = 0;
    let resolved = 0;
    const categoryCounts: Record<string, number> = {};

    maintenanceData.forEach(item => {
      if (item.status === 'resolved') {
        resolved++;
      } else if (item.status === 'in_progress') {
        inProgress++;
      } else {
        pending++;
      }

      const { category } = parseIssue(item.issue_details);
      categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    });

    const active = pending + inProgress;
    const resolvedPct = total > 0 ? (resolved / total) * 100 : 0;

    const sortedCats = Object.entries(categoryCounts)
      .map(([cat, count]) => ({
        category: cat,
        count,
        pct: total > 0 ? (count / total) * 100 : 0
      }))
      .sort((a, b) => b.count - a.count);

    const topCategory = sortedCats.length > 0 ? sortedCats[0].category : 'ไม่มีข้อมูล';
    const topCategoryCount = sortedCats.length > 0 ? sortedCats[0].count : 0;
    const topCategoryPct = sortedCats.length > 0 ? sortedCats[0].pct : 0;

    return {
      total,
      active,
      pending,
      inProgress,
      resolved,
      resolvedPct,
      topCategory,
      topCategoryCount,
      topCategoryPct,
      categories: sortedCats
    };
  }, [maintenanceData]);

  // Maintenance Monthly Trend (6 months)
  const maintMonthlyTrend = useMemo(() => {
    const presentMonths = new Set<string>();
    maintenanceData.forEach(item => {
      if (item.created_at) {
        presentMonths.add(item.created_at.slice(0, 7));
      }
    });

    // Ensure the last 6 calendar months are represented
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      presentMonths.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }

    const sortedMonths = Array.from(presentMonths).sort().slice(-6);

    const trend = sortedMonths.map(m => {
      let pendingCount = 0;
      let inProgressCount = 0;
      let resolvedCount = 0;

      maintenanceData.forEach(item => {
        if (!item.created_at) return;
        const itemMonth = item.created_at.slice(0, 7);
        if (itemMonth === m) {
          if (item.status === 'resolved') {
            resolvedCount++;
          } else if (item.status === 'in_progress') {
            inProgressCount++;
          } else {
            pendingCount++;
          }
        }
      });

      const activeCount = pendingCount + inProgressCount;
      const total = resolvedCount + activeCount;

      return {
        month: m,
        monthLabel: formatMonthTh(m),
        total,
        pendingCount,
        inProgressCount,
        activeCount,
        resolvedCount
      };
    });

    const maxTotal = Math.max(...trend.map(d => d.total), 1);
    return { trend, maxTotal };
  }, [maintenanceData]);

  // Filtered Maintenance Requests
  const filteredMaintenance = useMemo(() => {
    return maintenanceData.filter(item => {
      // Status filter
      if (maintStatusFilter === 'active') {
        if (item.status === 'resolved') return false;
      } else if (maintStatusFilter !== 'all') {
        if (item.status !== maintStatusFilter) return false;
      }

      // Search query filter
      if (maintSearchQuery.trim()) {
        const q = maintSearchQuery.toLowerCase();
        const matchRoom = String(item.room_number || '').toLowerCase().includes(q);
        const matchDetails = String(item.issue_details || '').toLowerCase().includes(q);
        const matchName = `${item.first_name || ''} ${item.last_name || ''}`.toLowerCase().includes(q);
        const matchPhone = String(item.phone_number || '').toLowerCase().includes(q);
        return matchRoom || matchDetails || matchName || matchPhone;
      }

      return true;
    });
  }, [maintenanceData, maintStatusFilter, maintSearchQuery]);

  // Export Maintenance Excel
  const exportMaintenanceToExcel = () => {
    if (filteredMaintenance.length === 0) {
      alert('ไม่พบข้อมูลงานซ่อมสำหรับส่งออก Excel ในเงื่อนไขที่เลือก');
      return;
    }

    try {
      const statusMap: Record<string, string> = {
        pending: 'รอซ่อม',
        in_progress: 'กำลังซ่อม',
        resolved: 'เสร็จสิ้น'
      };

      const excelData = filteredMaintenance.map((req, idx) => {
        const { category, detail } = parseIssue(req.issue_details);
        const tenantName = `${req.first_name || ''} ${req.last_name || ''}`.trim() || '-';
        const thStatus = statusMap[req.status] || req.status || '-';

        return {
          'ลำดับ': idx + 1,
          'วันที่แจ้ง': formatDateTimeTh(req.created_at),
          'เลขห้อง': req.room_number ? `ห้อง ${req.room_number}` : '-',
          'ชื่อผู้แจ้ง': tenantName,
          'เบอร์โทรศัพท์': req.phone_number || '-',
          'หมวดหมู่': category,
          'รายละเอียดปัญหา': detail,
          'สถานะ': thStatus,
          'มีรูปถ่าย': req.photo_url ? 'มี' : 'ไม่มี'
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(excelData);
      const workbook = XLSX.utils.book_new();

      worksheet['!cols'] = [
        { wch: 8 },  // ลำดับ
        { wch: 22 }, // วันที่แจ้ง
        { wch: 12 }, // เลขห้อง
        { wch: 24 }, // ชื่อผู้แจ้ง
        { wch: 16 }, // เบอร์โทรศัพท์
        { wch: 16 }, // หมวดหมู่
        { wch: 45 }, // รายละเอียดปัญหา
        { wch: 16 }, // สถานะ
        { wch: 12 }, // มีรูปถ่าย
      ];

      XLSX.utils.book_append_sheet(workbook, worksheet, "สถิติงานซ่อม");

      const dateStr = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(workbook, `SmartDorm_Maintenance_${dateStr}.xlsx`);
    } catch (err: any) {
      console.error('Export Maintenance Excel error:', err);
      alert('เกิดข้อผิดพลาดในการส่งออก Excel: ' + (err?.message || err));
    }
  };

  // Status Badge Helper
  const renderMaintenanceStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 shadow-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
            รอซ่อม
          </span>
        );
      case 'in_progress':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 shadow-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
            กำลังซ่อม
          </span>
        );
      case 'resolved':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            เสร็จสิ้น
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200 shadow-xs">
            {status}
          </span>
        );
    }
  };

  // Category Badge Helper
  const renderCategoryBadge = (category: string, idx = 0) => {
    const color = getCategoryColor(category, idx);
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold border ${color.badge}`}>
        {category}
      </span>
    );
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
              รายงานและสถิติ
            </h1>
            <p className="text-slate-500 font-medium mt-1 ml-13 text-sm">
              {activeTab === 'finance'
                ? 'ข้อมูลภาพรวมการเงินและสถิติการชำระเงิน'
                : 'ข้อมูลภาพรวมสถิติงานซ่อมบำรุงและการดำเนินงาน'}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            {activeTab === 'finance' ? (
              <>
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
                  className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-5 py-3 font-bold focus:outline-none focus:ring-4 focus:ring-emerald-500/20 shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                  ส่งออก Excel
                </button>
              </>
            ) : (
              <button
                onClick={exportMaintenanceToExcel}
                disabled={loading || filteredMaintenance.length === 0}
                className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-5 py-3 font-bold focus:outline-none focus:ring-4 focus:ring-emerald-500/20 shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                ส่งออก Excel (งานซ่อม)
              </button>
            )}
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-slate-100 p-1.5 rounded-2xl w-full sm:w-fit gap-1.5 border border-slate-200/80 shadow-xs">
          <button
            type="button"
            onClick={() => setActiveTab('finance')}
            className={`flex-1 sm:flex-initial px-5 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'finance'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
            รายงานรายได้และการเงิน
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('maintenance')}
            className={`flex-1 sm:flex-initial px-5 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'maintenance'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>
            สถิติงานซ่อมบำรุง
            {maintMetrics.active > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-700 font-extrabold">
                {maintMetrics.active}
              </span>
            )}
          </button>
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
            {activeTab === 'finance' && (
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
              <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
                <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                  <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
                    แจกแจงรายได้ตามห้องพัก {selectedMonth !== 'all' && `(${formatMonthTh(selectedMonth)})`}
                  </h3>
                  <span className="text-xs font-bold bg-white px-2 py-1 rounded-md text-slate-500 border border-slate-200 shadow-sm">
                    {filteredInvoices.length} รายการ
                  </span>
                </div>

                {/* Desktop Table (md+) with Scroll Container & Sticky Header / Footer */}
                <div className="hidden md:block overflow-x-auto overflow-y-auto max-h-[580px] custom-scrollbar">
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 z-10 bg-white shadow-xs border-b border-slate-200">
                      <tr className="bg-slate-50/95 backdrop-blur-xs text-[11px] uppercase tracking-wider text-slate-500">
                        <th className="px-4 py-3.5 font-bold bg-slate-50">ห้อง</th>
                        <th className="px-4 py-3.5 font-bold bg-slate-50">ค่าเช่า</th>
                        <th className="px-4 py-3.5 font-bold text-right bg-slate-50">ค่าน้ำ</th>
                        <th className="px-4 py-3.5 font-bold text-right bg-slate-50">ค่าไฟ</th>
                        <th className="px-4 py-3.5 font-bold text-right bg-slate-50">ส่วนเสริม</th>
                        <th className="px-4 py-3.5 font-bold text-right bg-slate-50">ยอดสุทธิ</th>
                        <th className="px-4 py-3.5 font-bold text-center bg-slate-50">สถานะ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filteredInvoices.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-6 py-12 text-center text-slate-400">ไม่พบข้อมูลในเดือนนี้</td>
                        </tr>
                      ) : (
                        filteredInvoices.map((inv, i) => {
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
                        })
                      )}
                    </tbody>
                    {filteredInvoices.length > 0 && (
                      <tfoot className="sticky bottom-0 z-10 bg-white border-t border-slate-200 shadow-[0_-2px_6px_rgba(0,0,0,0.03)]">
                        <tr className="bg-slate-50/95 font-bold">
                          <td className="px-4 py-3.5 text-slate-700 bg-slate-50">รวมทั้งหมด</td>
                          <td className="px-4 py-3.5 text-slate-700 text-sm bg-slate-50">
                            {filteredInvoices.reduce((sum, inv) => sum + getInvoiceBreakdown(inv).rent, 0).toLocaleString()} ฿
                          </td>
                          <td className="px-4 py-3.5 text-right text-sky-600 text-sm bg-slate-50">
                            {filteredInvoices.reduce((sum, inv) => sum + getInvoiceBreakdown(inv).wCost, 0).toLocaleString()} ฿
                          </td>
                          <td className="px-4 py-3.5 text-right text-amber-500 text-sm bg-slate-50">
                            {filteredInvoices.reduce((sum, inv) => sum + getInvoiceBreakdown(inv).eCost, 0).toLocaleString()} ฿
                          </td>
                          <td className="px-4 py-3.5 text-right text-violet-600 text-sm bg-slate-50">
                            {filteredInvoices.reduce((sum, inv) => sum + getInvoiceBreakdown(inv).extras, 0).toLocaleString()} ฿
                          </td>
                          <td className="px-4 py-3.5 text-right text-slate-900 text-base font-black bg-slate-50">
                            {filteredInvoices.reduce((sum, inv) => sum + getInvoiceBreakdown(inv).total, 0).toLocaleString()} ฿
                          </td>
                          <td className="px-4 py-3.5 bg-slate-50"></td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>

                {/* Mobile Accordion (below md) */}
                <div className="md:hidden divide-y divide-slate-100 overflow-y-auto max-h-[580px] custom-scrollbar">
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
                      
                      <div className="bg-slate-50/95 backdrop-blur-xs border-t-2 border-slate-200 p-4 sticky bottom-0 z-10 shadow-[0_-2px_6px_rgba(0,0,0,0.03)]">
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

            {activeTab === 'maintenance' && (
              <>
                {/* Maintenance KPI Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
                  {/* Card 1: รายการซ่อมทั้งหมด */}
                  <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-2xl p-5 text-white shadow-lg shadow-indigo-900/20 relative overflow-hidden flex flex-col justify-between">
                    <div className="relative z-10">
                      <div className="flex justify-between items-start mb-2">
                        <p className="text-indigo-100 font-medium text-xs sm:text-sm">รายการซ่อมทั้งหมด</p>
                        <div className="p-1.5 bg-white/10 text-white rounded-lg">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>
                        </div>
                      </div>
                      <h2 className="text-xl sm:text-3xl font-black">{maintMetrics.total} <span className="text-sm sm:text-base font-bold text-indigo-200">งาน</span></h2>
                      <p className="text-[10px] sm:text-xs text-indigo-200 mt-1">ประวัติคำขอแจ้งซ่อมทั้งหมด</p>
                    </div>
                    <div className="absolute -right-4 -bottom-4 opacity-10">
                      <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>
                    </div>
                  </div>

                  {/* Card 2: กำลังดำเนินการ */}
                  <div className="bg-white rounded-2xl p-5 border border-amber-100 shadow-sm flex flex-col justify-between relative overflow-hidden">
                    <div className="relative z-10">
                      <div className="flex justify-between items-start mb-2">
                        <p className="text-slate-500 font-medium text-xs sm:text-sm">กำลังดำเนินการ</p>
                        <div className="p-1.5 bg-amber-50 text-amber-500 rounded-lg">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                        </div>
                      </div>
                      <h2 className="text-xl sm:text-3xl font-black text-amber-600">{maintMetrics.active} <span className="text-sm sm:text-base font-bold text-amber-400">งาน</span></h2>
                      <p className="text-[10px] sm:text-xs text-slate-400 mt-1">
                        รอซ่อม {maintMetrics.pending} | กำลังซ่อม {maintMetrics.inProgress}
                      </p>
                    </div>
                  </div>

                  {/* Card 3: ดำเนินการเสร็จสิ้น */}
                  <div className="bg-white rounded-2xl p-5 border border-emerald-100 shadow-sm flex flex-col justify-between relative overflow-hidden">
                    <div className="relative z-10">
                      <div className="flex justify-between items-start mb-2">
                        <p className="text-slate-500 font-medium text-xs sm:text-sm">ดำเนินการเสร็จสิ้น</p>
                        <div className="p-1.5 bg-emerald-50 text-emerald-500 rounded-lg">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                        </div>
                      </div>
                      <h2 className="text-xl sm:text-3xl font-black text-emerald-600">{maintMetrics.resolved} <span className="text-sm sm:text-base font-bold text-emerald-400">งาน</span></h2>
                      <p className="text-[10px] sm:text-xs text-slate-400 mt-1">
                        {maintMetrics.resolvedPct.toFixed(1)}% ซ่อมเสร็จเรียบร้อย
                      </p>
                    </div>
                  </div>

                  {/* Card 4: ปัญหาที่แจ้งบ่อยที่สุด */}
                  <div className="bg-white rounded-2xl p-5 border border-purple-100 shadow-sm flex flex-col justify-between relative overflow-hidden">
                    <div className="relative z-10">
                      <div className="flex justify-between items-start mb-2">
                        <p className="text-slate-500 font-medium text-xs sm:text-sm">ปัญหาที่แจ้งบ่อยสุด</p>
                        <div className="p-1.5 bg-purple-50 text-purple-500 rounded-lg">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path></svg>
                        </div>
                      </div>
                      <h2 className="text-lg sm:text-2xl font-black text-purple-700 truncate" title={maintMetrics.topCategory}>
                        {maintMetrics.topCategory}
                      </h2>
                      <p className="text-[10px] sm:text-xs text-slate-400 mt-1">
                        {maintMetrics.topCategoryCount > 0 ? `${maintMetrics.topCategoryCount} ครั้ง (${maintMetrics.topCategoryPct.toFixed(1)}%)` : 'ยังไม่มีสถิติ'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 2 Graphs: Category Breakdown & Monthly Trend */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Graph 1: สัดส่วนประเภทงานซ่อม */}
                  <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path><path d="M22 12A10 10 0 0 0 12 2v10z"></path></svg>
                          สัดส่วนประเภทงานซ่อม
                        </h3>
                        <span className="text-xs font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                          ทั้งหมด {maintMetrics.total} งาน
                        </span>
                      </div>

                      {/* Horizontal Multi-color Bar */}
                      {maintMetrics.categories.length > 0 && (
                        <div className="mb-6">
                          <div className="w-full bg-slate-100 rounded-xl h-4 flex overflow-hidden p-0.5 gap-0.5">
                            {maintMetrics.categories.map((cat, idx) => {
                              const color = getCategoryColor(cat.category, idx);
                              return (
                                <div
                                  key={cat.category}
                                  style={{ width: `${Math.max(cat.pct, 3)}%` }}
                                  className={`h-full ${color.bg} rounded-xs transition-all duration-700 hover:brightness-110 cursor-pointer`}
                                  title={`${cat.category}: ${cat.count} ครั้ง (${cat.pct.toFixed(1)}%)`}
                                />
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Categories List with Progress Bars */}
                      <div className="space-y-3.5">
                        {maintMetrics.categories.length === 0 ? (
                          <div className="py-12 text-center text-slate-400 text-sm">ยังไม่มีข้อมูลงานแจ้งซ่อม</div>
                        ) : (
                          maintMetrics.categories.map((cat, idx) => {
                            const color = getCategoryColor(cat.category, idx);
                            return (
                              <div key={cat.category} className="space-y-1.5">
                                <div className="flex justify-between items-center text-xs">
                                  <div className="flex items-center gap-2">
                                    <span className={`w-2.5 h-2.5 rounded-full ${color.bg}`}></span>
                                    <span className="font-bold text-slate-700">{cat.category}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold text-slate-500">{cat.count} ครั้ง</span>
                                    <span className="font-bold text-slate-800 bg-slate-50 px-1.5 py-0.5 rounded text-[11px] border border-slate-100">
                                      {cat.pct.toFixed(1)}%
                                    </span>
                                  </div>
                                </div>
                                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                                  <div
                                    className={`h-full ${color.bg} rounded-full transition-all duration-1000 ease-out`}
                                    style={{ width: `${cat.pct}%` }}
                                  ></div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Graph 2: จำนวนงานซ่อมรายเดือน (6 เดือนย้อนหลัง) */}
                  <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                        <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
                          จำนวนงานซ่อมรายเดือน (6 เดือนย้อนหลัง)
                        </h3>
                        
                        {/* Legend */}
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                            <span>รอ/กำลังซ่อม</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                            <span>เสร็จสิ้น</span>
                          </div>
                        </div>
                      </div>

                      {/* Monthly Trend Bars */}
                      <div className="space-y-4 pt-2">
                        {maintMonthlyTrend.trend.length === 0 ? (
                          <div className="py-12 text-center text-slate-400 text-sm">ยังไม่มีข้อมูลสถิติรายเดือน</div>
                        ) : (
                          maintMonthlyTrend.trend.map((m, idx) => {
                            const totalWidth = m.total > 0 ? Math.max((m.total / maintMonthlyTrend.maxTotal) * 100, 5) : 0;
                            const resolvedPct = m.total > 0 ? (m.resolvedCount / m.total) * 100 : 0;
                            const activePct = m.total > 0 ? (m.activeCount / m.total) * 100 : 0;

                            return (
                              <div key={idx} className="group relative">
                                <div className="flex justify-between items-center text-xs font-bold text-slate-600 mb-1.5">
                                  <span className="flex items-center gap-1.5">
                                    <span className="text-slate-700">{m.monthLabel}</span>
                                    {m.activeCount > 0 && (
                                      <span className="text-[10px] font-extrabold px-1.5 py-0.2 bg-amber-100 text-amber-700 rounded-md">
                                        ค้าง {m.activeCount}
                                      </span>
                                    )}
                                  </span>
                                  <span className="text-slate-800 font-extrabold">{m.total} รายการ</span>
                                </div>

                                <div className="w-full bg-slate-100 rounded-xl h-4 flex overflow-hidden">
                                  {totalWidth > 0 ? (
                                    <div 
                                      className="h-full flex overflow-hidden rounded-xl transition-all duration-1000 ease-out"
                                      style={{ width: `${totalWidth}%` }}
                                    >
                                      {resolvedPct > 0 && (
                                        <div 
                                          className="h-full bg-emerald-500 hover:brightness-110 cursor-crosshair transition-all"
                                          style={{ width: `${resolvedPct}%` }}
                                          title={`เสร็จสิ้น: ${m.resolvedCount} งาน`}
                                        />
                                      )}
                                      {activePct > 0 && (
                                        <div 
                                          className="h-full bg-amber-500 hover:brightness-110 cursor-crosshair transition-all"
                                          style={{ width: `${activePct}%` }}
                                          title={`รอ/กำลังซ่อม: ${m.activeCount} งาน`}
                                        />
                                      )}
                                    </div>
                                  ) : (
                                    <div className="h-full w-full flex items-center pl-2">
                                      <span className="text-[10px] text-slate-300 font-medium">0 รายการ</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Maintenance History Table */}
                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
                  <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
                        ประวัติรายการแจ้งซ่อมบำรุง
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        แสดง {filteredMaintenance.length} รายการ (จากทั้งหมด {maintenanceData.length} รายการ)
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                      {/* Search Input */}
                      <div className="relative w-full sm:w-56">
                        <input
                          type="text"
                          value={maintSearchQuery}
                          onChange={(e) => setMaintSearchQuery(e.target.value)}
                          placeholder="ค้นหาห้อง, ผู้แจ้ง, ปัญหา..."
                          className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all"
                        />
                        <svg className="absolute left-3 top-2.5 text-slate-400" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                      </div>

                      {/* Status Filter */}
                      <select
                        value={maintStatusFilter}
                        onChange={(e) => setMaintStatusFilter(e.target.value)}
                        className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all cursor-pointer"
                      >
                        <option value="all">สถานะทั้งหมด</option>
                        <option value="active">ค้างดำเนินการ (รอ+กำลังซ่อม)</option>
                        <option value="pending">รอซ่อม</option>
                        <option value="in_progress">กำลังซ่อม</option>
                        <option value="resolved">เสร็จสิ้น</option>
                      </select>

                      {/* Export Maintenance Excel Button */}
                      <button
                        onClick={exportMaintenanceToExcel}
                        disabled={filteredMaintenance.length === 0}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-4 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/30 shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                        ส่งออก Excel (งานซ่อม)
                      </button>
                    </div>
                  </div>

                  {/* Desktop Table (md+) with Scroll Container & Sticky Header / Footer */}
                  <div className="hidden md:block overflow-x-auto overflow-y-auto max-h-[580px] custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                      <thead className="sticky top-0 z-10 bg-white shadow-xs border-b border-slate-200">
                        <tr className="bg-slate-50/95 backdrop-blur-xs text-[11px] uppercase tracking-wider text-slate-500">
                          <th className="px-4 py-3.5 font-bold bg-slate-50 w-36">วันที่แจ้ง</th>
                          <th className="px-4 py-3.5 font-bold bg-slate-50 w-24">ห้อง</th>
                          <th className="px-4 py-3.5 font-bold bg-slate-50 w-44">ผู้แจ้ง</th>
                          <th className="px-4 py-3.5 font-bold bg-slate-50 w-32">หมวดหมู่</th>
                          <th className="px-4 py-3.5 font-bold bg-slate-50">รายละเอียดปัญหา</th>
                          <th className="px-4 py-3.5 font-bold text-center bg-slate-50 w-32">สถานะ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {filteredMaintenance.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                              ไม่พบรายการแจ้งซ่อมที่ตรงกับเงื่อนไข
                            </td>
                          </tr>
                        ) : (
                          filteredMaintenance.map((req, i) => {
                            const { category, detail } = parseIssue(req.issue_details);
                            const tenantName = `${req.first_name || ''} ${req.last_name || ''}`.trim() || '-';
                            return (
                              <tr key={req.maintenance_requests_id || i} className="hover:bg-slate-50/80 transition-colors">
                                <td className="px-4 py-3 font-semibold text-slate-600 whitespace-nowrap">
                                  {formatDateTimeTh(req.created_at)}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <span className="font-black text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md">
                                    {req.room_number ? `ห้อง ${req.room_number}` : '-'}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="font-bold text-slate-800">{tenantName}</div>
                                  {req.phone_number && (
                                    <div className="text-[11px] text-slate-400">{req.phone_number}</div>
                                  )}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  {renderCategoryBadge(category, i)}
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-start gap-2 max-w-xl">
                                    <span className="text-slate-700 font-medium break-words leading-relaxed">{detail}</span>
                                    {req.photo_url && (
                                      <button
                                        onClick={() => setSelectedMaintenancePhoto(req.photo_url)}
                                        title="คลิกเพื่อดูรูปภาพ"
                                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded text-[11px] font-bold shrink-0 transition-colors cursor-pointer"
                                      >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                                        รูปแนบ
                                      </button>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-center whitespace-nowrap">
                                  {renderMaintenanceStatusBadge(req.status)}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                      <tfoot className="sticky bottom-0 z-10 bg-slate-50 shadow-inner border-t border-slate-200">
                        <tr className="text-xs font-bold text-slate-700">
                          <td colSpan={2} className="px-4 py-3.5 bg-slate-50">
                            รวมทั้งหมด: {filteredMaintenance.length} รายการ
                          </td>
                          <td colSpan={4} className="px-4 py-3.5 text-right bg-slate-50 text-slate-500 font-medium">
                            รอซ่อม: <span className="font-bold text-amber-600">{filteredMaintenance.filter(r => r.status === 'pending').length}</span> | 
                            กำลังซ่อม: <span className="font-bold text-blue-600 ml-1">{filteredMaintenance.filter(r => r.status === 'in_progress').length}</span> | 
                            เสร็จสิ้น: <span className="font-bold text-emerald-600 ml-1">{filteredMaintenance.filter(r => r.status === 'resolved').length}</span>
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Mobile View (sm and down) */}
                  <div className="md:hidden divide-y divide-slate-100 max-h-[580px] overflow-y-auto custom-scrollbar">
                    {filteredMaintenance.length === 0 ? (
                      <div className="p-8 text-center text-slate-400 text-xs">
                        ไม่พบรายการแจ้งซ่อมที่ตรงกับเงื่อนไข
                      </div>
                    ) : (
                      filteredMaintenance.map((req, i) => {
                        const { category, detail } = parseIssue(req.issue_details);
                        const tenantName = `${req.first_name || ''} ${req.last_name || ''}`.trim() || '-';
                        const isExpanded = expandedMaintId === (req.maintenance_requests_id || i);

                        return (
                          <div key={req.maintenance_requests_id || i} className="p-4 bg-white">
                            <div 
                              onClick={() => setExpandedMaintId(isExpanded ? null : (req.maintenance_requests_id || i))}
                              className="flex justify-between items-start gap-2 cursor-pointer"
                            >
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-black text-slate-800 bg-slate-100 px-2 py-0.5 rounded text-xs">
                                    {req.room_number ? `ห้อง ${req.room_number}` : '-'}
                                  </span>
                                  {renderCategoryBadge(category, i)}
                                </div>
                                <p className="text-xs font-bold text-slate-700 line-clamp-1">{detail}</p>
                                <p className="text-[11px] text-slate-400 mt-0.5">{formatDateTimeTh(req.created_at)}</p>
                              </div>
                              <div className="flex flex-col items-end gap-1.5 shrink-0">
                                {renderMaintenanceStatusBadge(req.status)}
                                <svg 
                                  className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                  fill="none" viewBox="0 0 24 24" stroke="currentColor"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                </svg>
                              </div>
                            </div>

                            {isExpanded && (
                              <div className="mt-3 pt-3 border-t border-slate-100 text-xs space-y-2 animate-in fade-in duration-150">
                                <div className="flex justify-between">
                                  <span className="text-slate-400">ผู้แจ้ง:</span>
                                  <span className="font-bold text-slate-700">{tenantName}</span>
                                </div>
                                {req.phone_number && (
                                  <div className="flex justify-between">
                                    <span className="text-slate-400">เบอร์โทรศัพท์:</span>
                                    <a href={`tel:${req.phone_number}`} className="font-semibold text-blue-600 underline">
                                      {req.phone_number}
                                    </a>
                                  </div>
                                )}
                                <div className="pt-1">
                                  <span className="text-slate-400 block mb-1">รายละเอียดปัญหา:</span>
                                  <p className="text-slate-700 bg-slate-50 p-2.5 rounded-lg leading-relaxed whitespace-pre-wrap">
                                    {detail}
                                  </p>
                                </div>
                                {req.photo_url && (
                                  <button
                                    onClick={() => setSelectedMaintenancePhoto(req.photo_url)}
                                    className="w-full mt-2 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                                    ดูรูปถ่ายประกอบ
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Mobile Footer Summary */}
                  <div className="md:hidden bg-slate-50 border-t border-slate-200 p-3 text-xs flex justify-between items-center text-slate-600">
                    <span className="font-bold">รวม {filteredMaintenance.length} รายการ</span>
                    <span className="text-[11px]">
                      ค้าง <span className="font-bold text-amber-600">{filteredMaintenance.filter(r => r.status !== 'resolved').length}</span> | 
                      เสร็จ <span className="font-bold text-emerald-600 ml-0.5">{filteredMaintenance.filter(r => r.status === 'resolved').length}</span>
                    </span>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Maintenance Photo Modal */}
      {selectedMaintenancePhoto && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs"
          onClick={() => setSelectedMaintenancePhoto(null)}
        >
          <div 
            className="bg-white rounded-2xl max-w-2xl w-full p-4 overflow-hidden shadow-2xl relative animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                รูปถ่ายประกอบการแจ้งซ่อม
              </h3>
              <button
                onClick={() => setSelectedMaintenancePhoto(null)}
                className="text-slate-400 hover:text-slate-600 w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="py-4 flex justify-center bg-slate-50/50 rounded-xl my-2">
              <img 
                src={selectedMaintenancePhoto} 
                alt="รูปแจ้งซ่อม" 
                className="max-h-[70vh] object-contain rounded-xl shadow-xs"
              />
            </div>
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedMaintenancePhoto(null)}
                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

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
