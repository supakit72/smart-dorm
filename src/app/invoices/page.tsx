"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/backend/lib/supabase';
import AdminLayout from '@/components/AdminLayout';
import { useAlert } from '@/contexts/AlertContext';
import * as XLSX from 'xlsx';
import Link from 'next/link';
import InvoiceDocument from '@/components/InvoiceDocument';

const getMeterCycle = (issueDateStr: string, meterDay: number) => {
  if (!issueDateStr || !meterDay) return '';
  const [yStr, mStr, dStr] = issueDateStr.split('-');
  if (!mStr || !yStr || !dStr) return '';
  const m = parseInt(mStr, 10);
  const y = parseInt(yStr, 10);

  const currentMonthDate = new Date(y, m - 1, meterDay);
  const previousMonthDate = new Date(y, m - 2, meterDay);

  const thaiMonths = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

  const formatThaiDate = (date: Date) => {
    const dd = date.getDate();
    const mm = thaiMonths[date.getMonth()];
    const yy = (date.getFullYear() + 543).toString().slice(-2);
    return `${dd} ${mm} ${yy}`;
  };

  return `${formatThaiDate(previousMonthDate)} - ${formatThaiDate(currentMonthDate)}`;
};

export default function InvoicesManagementPage() {
  const router = useRouter();
  const currentDateString = new Date().toISOString().slice(0, 10);
  const currentMonthYearString = new Date().toISOString().slice(0, 7);

  // Data states
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active Contracts & Rooms (for Dropdown & Cards)
  const [activeContracts, setActiveContracts] = useState<any[]>([]);
  const [allRooms, setAllRooms] = useState<any[]>([]);

  // Create Invoice Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedContractId, setSelectedContractId] = useState('');
  const [monthYear, setMonthYear] = useState(currentDateString);
  const [dueDate, setDueDate] = useState('');
  const [waterMeterPrev, setWaterMeterPrev] = useState<number | ''>('');
  const [waterMeterCur, setWaterMeterCur] = useState<number | ''>('');
  const [waterRate, setWaterRate] = useState<number | ''>(15); // Default
  const [electricMeterPrev, setElectricMeterPrev] = useState<number | ''>('');
  const [electricMeterCur, setElectricMeterCur] = useState<number | ''>('');
  const [electricRate, setElectricRate] = useState<number | ''>(8); // Default
  const [additionalItems, setAdditionalItems] = useState<{ name: string; price: number }[]>([]);
  const [applyVat, setApplyVat] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // View Slip Modal states
  const [isSlipModalOpen, setIsSlipModalOpen] = useState(false);
  const [selectedSlipImage, setSelectedSlipImage] = useState<string | null>(null);

  // Filters state
  const [filterMonth, setFilterMonth] = useState('');
  const [filterRoom, setFilterRoom] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  // Settings State
  const [cutoffDay, setCutoffDay] = useState(27);
  const [dormSettings, setDormSettings] = useState<any>(null);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [tempCutoffDay, setTempCutoffDay] = useState(27);

  // Print State
  const [invoiceToPrint, setInvoiceToPrint] = useState<any>(null);

  const { showAlert, showConfirm } = useAlert();

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

      const fetchSettings = async () => {
        try {
          const { data, error } = await supabase.from('dorm_settings').select('*').limit(1).single();
          if (!error && data) {
            setDormSettings(data);
            if (data.cutoff_day) {
              setCutoffDay(data.cutoff_day);
              setTempCutoffDay(data.cutoff_day);
            }
          }
        } catch (err) {
          // fallback
        }
      };

      fetchSettings();
      fetchInvoices();
      fetchActiveContracts();
      fetchAllRooms();
    };

    checkAuth();
  }, [router]);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          contracts (
            rooms ( room_number, price_per_month ),
            users!tenant_id ( first_name, last_name )
          )
        `)
        .order('invoices_id', { ascending: false });

      if (error) throw error;
      if (data) {
        // Map data to maintain compatibility with the UI
        const mappedData = data.map((inv: any) => ({
          ...inv,
          room_number: inv.contracts?.rooms?.room_number || '-',
          first_name: inv.contracts?.users?.first_name || '',
          last_name: inv.contracts?.users?.last_name || '',
        }));
        setInvoices(mappedData);
      }
    } catch (err: any) {
      console.error("Fetch Invoices Error:", err);
      setError(err.message || 'เกิดข้อผิดพลาดในการดึงข้อมูลบิลค่าเช่า');
    } finally {
      setLoading(false);
    }
  };

  const fetchActiveContracts = async () => {
    try {
      const { data, error } = await supabase
        .from('view_active_contracts')
        .select('*');
      if (error) throw error;
      if (data) setActiveContracts(data);
    } catch (err) {
      console.error("Fetch contracts error:", err);
    }
  };

  const fetchAllRooms = async () => {
    try {
      const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .order('room_number', { ascending: true });
      if (error) throw error;
      if (data) setAllRooms(data);
    } catch (err) {
      console.error("Fetch rooms error:", err);
    }
  };

  const handleAddAdditionalItem = () => {
    setAdditionalItems([...additionalItems, { name: '', price: 0 }]);
  };

  const handleUpdateAdditionalItem = (index: number, field: 'name' | 'price', value: string | number) => {
    const newItems = [...additionalItems];
    if (field === 'name') newItems[index].name = value as string;
    if (field === 'price') newItems[index].price = Number(value);
    setAdditionalItems(newItems);
  };

  const handleRemoveAdditionalItem = (index: number) => {
    setAdditionalItems(additionalItems.filter((_, i) => i !== index));
  };

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContractId || !monthYear || !dueDate || waterMeterCur === '' || waterMeterPrev === '' || electricMeterCur === '' || electricMeterPrev === '' || waterRate === '' || electricRate === '') {
      alert('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    try {
      setIsSubmitting(true);
      const contract = activeContracts.find(c => String(c.contracts_id) === String(selectedContractId));
      if (!contract) throw new Error("ไม่พบข้อมูลสัญญาเช่า");

      const roomRent = Number(contract.price_per_month) || 0;
      const waterUnitUsed = Math.max(0, (Number(waterMeterCur) || 0) - (Number(waterMeterPrev) || 0));
      const electricUnitUsed = Math.max(0, (Number(electricMeterCur) || 0) - (Number(electricMeterPrev) || 0));

      const totals = calculateTotal();

      const { error } = await supabase.from('invoices').insert([
        {
          contract_id: contract.contracts_id,
          month_year: monthYear,
          due_date: dueDate,
          water_meter_previous: Number(waterMeterPrev),
          water_meter_current: Number(waterMeterCur),
          water_unit: waterUnitUsed,
          water_rate: Number(waterRate),
          electric_meter_previous: Number(electricMeterPrev),
          electric_meter_current: Number(electricMeterCur),
          electric_unit: electricUnitUsed,
          electric_rate: Number(electricRate),
          additional_items: additionalItems,
          vat_amount: totals.vat,
          rounding_amount: totals.roundingAmount,
          total_amount: totals.roundedTotal,
          status: 'unpaid'
        }
      ]);

      if (error) throw error;

      // รีเซ็ตฟอร์มและปิด Modal
      setSelectedContractId('');
      setMonthYear(currentDateString);
      setDueDate('');
      setWaterMeterPrev('');
      setWaterMeterCur('');
      setElectricMeterPrev('');
      setElectricMeterCur('');
      setAdditionalItems([]);
      setApplyVat(false);
      setIsAddModalOpen(false);

      fetchInvoices();
      showAlert('success', 'สำเร็จ!', 'สร้างบิลใหม่สำเร็จ!');

    } catch (err: any) {
      console.error("Create Invoice Error:", err);
      alert("ออกบิลไม่สำเร็จ: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const doConfirmPayment = async (invoiceId: number) => {
    try {
      const { error } = await supabase.from('invoices').update({ status: 'paid' }).eq('invoices_id', invoiceId);
      if (error) throw error;
      showAlert('success', 'ชำระเงินสำเร็จ', 'อัปเดตสถานะบิลเป็นชำระแล้ว');
      fetchInvoices();
    } catch (err: any) {
      alert("อัปเดตสถานะไม่สำเร็จ: " + err.message);
    }
  };

  const confirmPayment = (invoiceId: number) => {
    showConfirm('ยืนยันการชำระเงิน', 'คุณตรวจสอบสลิปและต้องการยืนยันการชำระเงินใช่หรือไม่?', () => doConfirmPayment(invoiceId));
  };

  const doRejectSlip = async (invoiceId: number) => {
    try {
      const { error } = await supabase.from('invoices').update({ status: 'rejected', slip_image: null }).eq('invoices_id', invoiceId);
      if (error) throw error;
      showAlert('success', 'ปฏิเสธสลิปแล้ว', 'ตีกลับสลิปให้ผู้เช่าเรียบร้อยแล้ว');
      fetchInvoices();
    } catch (err: any) {
      alert("เกิดข้อผิดพลาด: " + err.message);
    }
  };

  const rejectSlip = (invoiceId: number) => {
    showConfirm('ปฏิเสธสลิป', 'ต้องการตีกลับสลิปนี้ใช่หรือไม่? สลิปเดิมจะถูกลบและผู้เช่าจะต้องส่งใหม่', () => doRejectSlip(invoiceId));
  };

  const confirmDeleteInvoice = async (invoiceId: number) => {
    try {
      const { error } = await supabase.from('invoices').delete().eq('invoices_id', invoiceId);
      if (error) throw error;

      showAlert('success', 'ลบบิลสำเร็จ', 'ข้อมูลบิลถูกลบออกจากระบบแล้ว');
      fetchInvoices();
    } catch (err: any) {
      alert("ลบบิลไม่สำเร็จ: " + err.message);
    }
  };

  const handleDeleteInvoice = (invoiceId: number) => {
    showConfirm(
      'ยืนยันการลบบิล',
      'คุณแน่ใจหรือไม่ว่าต้องการลบบิลนี้? การกระทำนี้ไม่สามารถย้อนกลับได้',
      () => confirmDeleteInvoice(invoiceId)
    );
  };

  const openSlipModal = (imgUrl: string) => {
    setSelectedSlipImage(imgUrl);
    setIsSlipModalOpen(true);
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      const { data: existingSettings } = await supabase.from('dorm_settings').select('id').limit(1);

      let error;
      if (existingSettings && existingSettings.length > 0) {
        const res = await supabase.from('dorm_settings').update({ cutoff_day: tempCutoffDay }).eq('id', existingSettings[0].id);
        error = res.error;
      } else {
        const res = await supabase.from('dorm_settings').insert([{ cutoff_day: tempCutoffDay }]);
        error = res.error;
      }

      if (error) throw error;
      setCutoffDay(tempCutoffDay);
      setIsSettingsModalOpen(false);

      showAlert('success', 'สำเร็จ!', 'บันทึกการตั้งค่ารอบบิลสำเร็จ!');
    } catch (err: any) {
      alert('เกิดข้อผิดพลาดในการบันทึกการตั้งค่า: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleContractChange = async (contractId: string) => {
    setSelectedContractId(String(contractId));

    // reset current meters
    setWaterMeterCur('');
    setElectricMeterCur('');

    if (!contractId) {
      setWaterMeterPrev('');
      setElectricMeterPrev('');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('water_meter_current, electric_meter_current')
        .eq('contract_id', contractId)
        .order('invoices_id', { ascending: false })
        .limit(1)
        .single();

      if (data) {
        setWaterMeterPrev(data.water_meter_current != null ? data.water_meter_current : '');
        setElectricMeterPrev(data.electric_meter_current != null ? data.electric_meter_current : '');
      } else {
        setWaterMeterPrev(0);
        setElectricMeterPrev(0);
      }
    } catch (err: any) {
      if (err.code !== 'PGRST116') {
        console.error("Error fetching previous meters:", err);
      }
      setWaterMeterPrev(0);
      setElectricMeterPrev(0);
    }
  };

  const handleOpenModalForContract = (contractId: string) => {
    handleContractChange(contractId);
    setMonthYear(currentDateString);
    setIsAddModalOpen(true);
  };

  // Real-time calculation helper
  const calculateTotal = () => {
    const vatPercentage = dormSettings?.vat_percentage !== undefined ? Number(dormSettings.vat_percentage) : 7;
    const contract = activeContracts.find(c => String(c.contracts_id) === String(selectedContractId));
    const roomRent = contract ? Number(contract.price_per_month) : 0;
    const waterUnitUsed = Math.max(0, (Number(waterMeterCur) || 0) - (Number(waterMeterPrev) || 0));
    const electricUnitUsed = Math.max(0, (Number(electricMeterCur) || 0) - (Number(electricMeterPrev) || 0));
    const wTotal = waterUnitUsed * (Number(waterRate) || 0);
    const eTotal = electricUnitUsed * (Number(electricRate) || 0);
    const addTotal = additionalItems.reduce((sum, item) => sum + (Number(item.price) || 0), 0);

    const vat = applyVat ? (wTotal + eTotal) * (vatPercentage / 100) : 0;
    const rawTotal = roomRent + wTotal + eTotal + addTotal + vat;
    const roundedTotal = Math.round(rawTotal);
    const roundingAmount = roundedTotal - rawTotal;

    return { roomRent, wTotal, eTotal, addTotal, vat, rawTotal, roundedTotal, roundingAmount, vatPercentage };
  };

  // Get status badge UI
  const getStatusBadge = (status: string) => {
    if (status === 'paid') {
      return <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 font-bold text-xs border border-emerald-100 uppercase">ชำระแล้ว</span>;
    } else if (status === 'pending') {
      return <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 font-bold text-xs border border-blue-100 uppercase">รอตรวจสอบ</span>;
    } else if (status === 'draft') {
      return <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 font-bold text-xs border border-slate-200 uppercase">แบบร่าง</span>;
    } else if (status === 'rejected') {
      return <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-orange-50 text-orange-600 font-bold text-xs border border-orange-100 uppercase">สลิปถูกตีกลับ</span>;
    } else {
      return <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-rose-50 text-rose-600 font-bold text-xs border border-rose-100 uppercase">รอชำระ</span>;
    }
  };

  // Date format helper for due_date and standard timestamps
  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    const match = dateString.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return `${match[3]}/${match[2]}/${match[1]}`;
    }
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  // Special Date format helper for month_year which might contain 'D/M/YYYY'
  const formatMonthYear = (dateString?: string) => {
    if (!dateString) return '-';
    if (dateString.includes('/')) {
      const parts = dateString.split('/');
      if (parts.length === 3) {
        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        const year = parts[2];
        return `${day}/${month}/${year}`;
      }
    }
    return formatDate(dateString);
  };

  const filteredInvoices = invoices.filter(inv => {
    const matchMonth = filterMonth ? (() => {
      const [fYear, fMonth] = filterMonth.split('-');
      if (inv.month_year?.includes('/')) {
        const parts = inv.month_year.split('/');
        const invMonth = parts[1].padStart(2, '0');
        const invYear = parts[2];
        return invYear === fYear && invMonth === fMonth;
      }
      return inv.month_year?.startsWith(filterMonth);
    })() : true;
    const matchRoom = filterRoom ? String(inv.room_number).includes(filterRoom) : true;
    const matchStatus = filterStatus === 'all' ? true : inv.status === filterStatus;
    return matchMonth && matchRoom && matchStatus;
  });

  const handleExportExcel = () => {
    if (filteredInvoices.length === 0) {
      alert("ไม่มีข้อมูลสำหรับส่งออก");
      return;
    }

    const exportData = filteredInvoices.map(invoice => {
      let thStatus = 'รอชำระ';
      if (invoice.status === 'pending') thStatus = 'รอตรวจสอบ';
      else if (invoice.status === 'paid') thStatus = 'ชำระแล้ว';
      else if (invoice.status === 'draft') thStatus = 'แบบร่าง';
      else if (invoice.status === 'rejected') thStatus = 'สลิปถูกตีกลับ';

      return {
        'วันที่ออกบิล': formatMonthYear(invoice.month_year),
        'วันครบกำหนดชำระ': formatDate(invoice.due_date),
        'ห้องพัก': invoice.room_number || '-',
        'หน่วยน้ำที่ใช้': invoice.water_unit || 0,
        'ราคาต่อหน่วยน้ำ (฿)': invoice.water_rate || 0,
        'ค่าน้ำ (บาท)': (invoice.water_unit || 0) * (invoice.water_rate || 0),
        'หน่วยไฟที่ใช้': invoice.electric_unit || 0,
        'ราคาต่อหน่วยไฟ (฿)': invoice.electric_rate || 0,
        'ค่าไฟ (บาท)': (invoice.electric_unit || 0) * (invoice.electric_rate || 0),
        'ยอดรวมสุทธิ (บาท)': Number(invoice.total_amount) || 0,
        'สถานะ': thStatus
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);

    // Auto-size columns slightly
    worksheet['!cols'] = [
      { wch: 15 }, // วันที่ออกบิล
      { wch: 18 }, // วันครบกำหนดชำระ
      { wch: 10 }, // ห้องพัก
      { wch: 15 }, // หน่วยน้ำที่ใช้
      { wch: 20 }, // ราคาต่อหน่วยน้ำ
      { wch: 15 }, // ค่าน้ำ
      { wch: 15 }, // หน่วยไฟที่ใช้
      { wch: 20 }, // ราคาต่อหน่วยไฟ
      { wch: 15 }, // ค่าไฟ
      { wch: 20 }, // ยอดรวมสุทธิ
      { wch: 15 }, // สถานะ
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Invoices");

    const dateStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `รายงานบิลค่าเช่า_${dateStr}.xlsx`);
  };

  const handlePrint = (invoice: any) => {
    setInvoiceToPrint(invoice);
    setTimeout(() => {
      window.print();
    }, 100);
  };

  return (
    <>
      <div className="print:hidden">
        <AdminLayout>
          <div className="space-y-10">

            {/* Section 1: Dashboard Top */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-black text-slate-800 tracking-tight">สถานะการออกบิล (เดือนปัจจุบัน)</h2>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setIsSettingsModalOpen(true)}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition-all shadow-sm active:scale-95 whitespace-nowrap"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                    ตั้งค่ารอบบิล
                  </button>
                  <Link
                    href="/invoices/editor/new"
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all shadow-md hover:shadow-lg active:scale-95 whitespace-nowrap"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    ออกบิลใหม่
                  </Link>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {activeContracts.length === 0 ? (
                  <div className="col-span-full py-12 bg-white border border-slate-200/60 shadow-sm rounded-2xl text-center text-slate-500">
                    ไม่พบห้องที่มีผู้เช่าปัจจุบัน
                  </div>
                ) : (
                  allRooms.filter(room => activeContracts.some(c => String(c.room_id) === String(room.room_id))).map(room => {
                    const contract = activeContracts.find(c => String(c.room_id) === String(room.room_id));
                    const isOccupied = true;

                    // หาวันที่เริ่มต้นรอบบิลปัจจุบัน (อิงตาม cutoffDay)
                    const today = new Date();
                    let cycleYear = today.getFullYear();
                    let cycleMonth = today.getMonth(); // 0-11
                    if (today.getDate() < cutoffDay) {
                      // ถ้าน้อยกว่าวันตัดรอบ ให้ถือว่าเป็นรอบของเดือนก่อน
                      cycleMonth -= 1;
                      if (cycleMonth < 0) {
                        cycleMonth = 11;
                        cycleYear -= 1;
                      }
                    }
                    const cycleStartDate = new Date(cycleYear, cycleMonth, cutoffDay);

                    // ตรวจสอบว่ามีบิลที่ถูกสร้างขึ้นในรอบบิลปัจจุบันหรือไม่
                    const currentMonthInvoice = invoices.find(inv => {
                      if (String(inv.room_number) !== String(room.room_number)) return false;

                      let invDate;
                      if (inv.created_at) {
                        invDate = new Date(inv.created_at);
                      } else if (inv.month_year) {
                        if (inv.month_year.includes('/')) {
                          const parts = inv.month_year.split('/');
                          if (parts.length === 3) {
                            invDate = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
                          }
                        } else {
                          invDate = new Date(inv.month_year);
                        }
                      }

                      if (!invDate || isNaN(invDate.getTime())) return false;

                      // เช็คว่าบิลใบล่าสุดถูกสร้างหลังจาก (หรือตรงกับ) วันเริ่มรอบบิลปัจจุบันหรือไม่
                      return invDate >= cycleStartDate;
                    });

                    return (
                      <div key={room.room_id} className="bg-white rounded-2xl p-5 border border-slate-200/60 shadow-sm flex flex-col relative overflow-hidden group hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-0.5">ห้องพัก</p>
                            <h4 className="text-3xl font-black text-slate-800 tracking-tight">{room.room_number}</h4>
                          </div>
                          <div className="text-right">
                            {isOccupied ? (
                              <>
                                <p className="text-xs text-slate-400 font-bold uppercase mb-0.5">ผู้เช่า</p>
                                <p className="text-sm font-semibold text-slate-700 truncate max-w-[120px]" title={contract.first_name}>{contract.first_name}</p>
                              </>
                            ) : (
                              <>
                                <p className="text-xs text-slate-400 font-bold uppercase mb-0.5">สถานะห้อง</p>
                                <p className="text-sm font-semibold text-slate-400">ว่าง</p>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="mt-auto pt-4 border-t border-slate-100">
                          {currentMonthInvoice ? (
                            currentMonthInvoice.status === 'draft' ? (
                              <Link
                                href={`/invoices/editor/${currentMonthInvoice.invoices_id}`}
                                className="flex items-center justify-center gap-1.5 py-2.5 w-full bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-700 rounded-xl font-bold text-sm border border-slate-200 transition-all shadow-sm active:scale-95 group-hover:ring-2 ring-slate-200/50"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2-2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                แก้ไขแบบร่าง (คลิก)
                              </Link>
                            ) : (
                              <div className="flex items-center justify-center gap-1.5 py-2.5 w-full bg-emerald-50 text-emerald-600 rounded-xl font-bold text-sm border border-emerald-100 shadow-sm">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                ออกบิลแล้ว
                              </div>
                            )
                          ) : (
                            <Link
                              href={`/invoices/editor/new?contract_id=${contract.contracts_id}`}
                              className="flex items-center justify-center gap-1.5 py-2.5 w-full bg-amber-50 text-amber-600 hover:bg-amber-100 hover:text-amber-700 rounded-xl font-bold text-sm border border-amber-200 transition-all shadow-sm active:scale-95 group-hover:ring-2 ring-amber-200/50"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                              ยังไม่ได้ออกบิล (คลิก)
                            </Link>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}

              </div>
            </section>

            {/* Section 2: Table & Filters */}
            <section className="space-y-4">
              <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm flex-wrap">
                <h2 className="text-xl font-black text-slate-800 tracking-tight whitespace-nowrap">ประวัติบิลและการจัดการ</h2>

                <div className="flex flex-wrap items-center gap-4 w-full xl:w-auto xl:justify-end">
                  {/* Tabs Filter */}
                  <div className="flex p-1 bg-slate-100 rounded-xl overflow-x-auto w-full md:w-auto hide-scrollbar">
                    <button
                      onClick={() => setFilterStatus('all')}
                      className={`px-4 py-2 text-sm font-bold rounded-lg transition-all whitespace-nowrap ${filterStatus === 'all' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
                    >
                      ทั้งหมด
                    </button>
                    <button
                      onClick={() => setFilterStatus('draft')}
                      className={`px-4 py-2 text-sm font-bold rounded-lg transition-all whitespace-nowrap ${filterStatus === 'draft' ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
                    >
                      แบบร่าง
                    </button>
                    <button
                      onClick={() => setFilterStatus('unpaid')}
                      className={`px-4 py-2 text-sm font-bold rounded-lg transition-all whitespace-nowrap ${filterStatus === 'unpaid' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
                    >
                      รอชำระ
                    </button>
                    <button
                      onClick={() => setFilterStatus('pending')}
                      className={`px-4 py-2 text-sm font-bold rounded-lg transition-all whitespace-nowrap flex items-center gap-2 ${filterStatus === 'pending' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
                    >
                      รอตรวจสอบ
                      {invoices.filter(i => i.status === 'pending').length > 0 && (
                        <span className="bg-red-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full animate-pulse shadow-sm">
                          {invoices.filter(i => i.status === 'pending').length}
                        </span>
                      )}
                    </button>
                    <button
                      onClick={() => setFilterStatus('paid')}
                      className={`px-4 py-2 text-sm font-bold rounded-lg transition-all whitespace-nowrap ${filterStatus === 'paid' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
                    >
                      ชำระแล้ว
                    </button>
                    <button
                      onClick={() => setFilterStatus('rejected')}
                      className={`px-4 py-2 text-sm font-bold rounded-lg transition-all whitespace-nowrap ${filterStatus === 'rejected' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
                    >
                      สลิปถูกตีกลับ
                    </button>
                  </div>

                  <div className="w-px h-8 bg-slate-200 hidden md:block"></div>

                  {/* Inputs Filter */}
                  <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 w-full md:w-auto">
                    <input
                      type="month"
                      value={filterMonth}
                      onChange={(e) => setFilterMonth(e.target.value)}
                      className="px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-sm font-medium focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none flex-1 lg:w-40 transition-all"
                      title="กรองตามเดือน/ปี"
                    />
                    <input
                      type="text"
                      placeholder="ค้นหาเลขห้อง"
                      value={filterRoom}
                      onChange={(e) => setFilterRoom(e.target.value)}
                      className="px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-sm font-medium focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none flex-1 lg:w-36 transition-all"
                    />
                    <button
                      onClick={fetchInvoices}
                      className="inline-flex items-center justify-center p-2.5 bg-slate-50 hover:bg-slate-200 text-slate-600 rounded-xl transition-all shadow-sm active:scale-95 border border-slate-200 shrink-0"
                      title="รีเฟรชข้อมูล"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"></path><path d="M21 3v5h-5"></path></svg>
                    </button>
                    <button
                      onClick={handleExportExcel}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition-all shadow-sm active:scale-95 whitespace-nowrap shrink-0"
                      title="ส่งออกเป็น Excel"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16c0 1.1.9 2 2 2h12a2 2 0 0 0 2-2V8l-6-6z"></path><path d="M14 3v5h5M16 13H8M16 17H8M10 9H8"></path></svg>
                      <span className="hidden sm:inline">ส่งออก</span>
                    </button>
                  </div>
                </div>
              </div>

              {loading ? (
                <div className="py-20 flex flex-col items-center justify-center bg-white rounded-2xl border border-slate-200/60 shadow-sm">
                  <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
                  <p className="text-slate-500 font-medium">กำลังโหลดข้อมูล...</p>
                </div>
              ) : error ? (
                <div className="bg-red-50 text-red-600 p-6 rounded-2xl border border-red-100 text-center font-medium shadow-sm">
                  {error}
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-600">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold">
                        <tr>
                          <th className="px-4 py-4 whitespace-nowrap">วันที่ออกบิล</th>
                          <th className="px-4 py-4 whitespace-nowrap">กำหนดชำระ</th>
                          <th className="px-4 py-4 whitespace-nowrap">ห้องพัก</th>
                          <th className="px-4 py-4 whitespace-nowrap">ค่าน้ำ</th>
                          <th className="px-4 py-4 whitespace-nowrap">ค่าไฟ</th>
                          <th className="px-4 py-4 whitespace-nowrap">ยอดรวม</th>
                          <th className="px-4 py-4 whitespace-nowrap">สถานะ</th>
                          <th className="px-4 py-4 text-center whitespace-nowrap">จัดการ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredInvoices.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                              <div className="flex flex-col items-center justify-center">
                                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-2xl mb-3">📄</div>
                                <p>ไม่พบรายการบิลที่ตรงกับตัวกรอง</p>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          filteredInvoices.map((invoice) => (
                            <tr key={invoice.invoices_id} className="hover:bg-slate-50 transition-colors">
                              <td className="px-4 py-4 text-slate-700 font-medium whitespace-nowrap">
                                {formatMonthYear(invoice.month_year)}
                              </td>
                              <td className="px-4 py-4 text-slate-700 font-medium whitespace-nowrap">
                                {formatDate(invoice.due_date)}
                              </td>
                              <td className="px-4 py-4 font-bold text-slate-800 whitespace-nowrap">
                                {invoice.room_number || '-'}
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap">
                                <div className="space-y-0.5">
                                  <p className="text-blue-600 font-semibold text-sm">{invoice.water_unit} น.</p>
                                  <p className="text-xs text-slate-500">@ {invoice.water_rate} ฿/น.</p>
                                  <p className="text-slate-700 font-medium text-sm">{(invoice.water_unit * invoice.water_rate).toLocaleString()} ฿</p>
                                </div>
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap">
                                <div className="space-y-0.5">
                                  <p className="text-amber-600 font-semibold text-sm">{invoice.electric_unit} น.</p>
                                  <p className="text-xs text-slate-500">@ {invoice.electric_rate} ฿/น.</p>
                                  <p className="text-slate-700 font-medium text-sm">{(invoice.electric_unit * invoice.electric_rate).toLocaleString()} ฿</p>
                                </div>
                              </td>
                              <td className="px-4 py-4 font-bold text-slate-800 text-base whitespace-nowrap">
                                {Number(invoice.total_amount).toLocaleString()} ฿
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap">
                                {getStatusBadge(invoice.status)}
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap">
                                <div className="flex items-center justify-center gap-2">
                                  {invoice.status === 'draft' ? (
                                    <Link
                                      href={`/invoices/editor/${invoice.invoices_id}`}
                                      className="p-2 rounded-lg transition-colors text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                                      title="แก้ไขแบบร่าง"
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                    </Link>
                                  ) : (
                                    <>
                                      <button
                                        disabled={!invoice.slip_image}
                                        onClick={() => openSlipModal(invoice.slip_image)}
                                        className={`p-2 rounded-lg transition-colors ${invoice.slip_image ? 'text-blue-600 hover:bg-blue-50 hover:text-blue-700' : 'text-slate-300 cursor-not-allowed'}`}
                                        title="ดูสลิปโอนเงิน"
                                      >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                                      </button>
                                      <button
                                        disabled={invoice.status === 'paid' || !invoice.slip_image}
                                        onClick={() => confirmPayment(invoice.invoices_id)}
                                        className={`p-2 rounded-lg transition-colors ${invoice.status === 'paid' || !invoice.slip_image ? 'text-slate-300 cursor-not-allowed' : 'text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700'}`}
                                        title="ยืนยันการชำระเงิน"
                                      >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                                      </button>
                                      {invoice.status === 'pending' && (
                                        <button
                                          onClick={() => rejectSlip(invoice.invoices_id)}
                                          className="p-2 rounded-lg transition-colors text-orange-500 hover:bg-orange-50 hover:text-orange-600"
                                          title="ปฏิเสธสลิป"
                                        >
                                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline><line x1="9" y1="9" x2="15" y2="15"></line><line x1="15" y1="9" x2="9" y2="15"></line></svg>
                                        </button>
                                      )}
                                      <button
                                        onClick={() => handlePrint(invoice)}
                                        className="p-2 rounded-lg transition-colors text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                                        title="พิมพ์ใบแจ้งหนี้"
                                      >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                                      </button>
                                    </>
                                  )}
                                  <button
                                    disabled={invoice.status === 'paid'}
                                    onClick={() => handleDeleteInvoice(invoice.invoices_id)}
                                    className={`p-2 rounded-lg transition-colors ${invoice.status === 'paid' ? 'text-slate-300 cursor-not-allowed' : 'text-rose-600 hover:bg-rose-50 hover:text-rose-700'}`}
                                    title="ลบบิล"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>
          </div>



          {/* Slip View Modal */}
          {isSlipModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={() => setIsSlipModalOpen(false)}></div>
              <div className="relative bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh] scale-100 transition-transform">
                <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                  <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" className="text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
                    หลักฐานการโอนเงิน
                  </h3>
                  <button
                    onClick={() => setIsSlipModalOpen(false)}
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
              </div>
            </div>
          )}
          {/* Settings Modal */}
          {isSettingsModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={() => setIsSettingsModalOpen(false)}></div>
              <div className="relative bg-white rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden scale-100 transition-transform">
                <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                  <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" className="text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                    ตั้งค่ารอบบิล
                  </h3>
                  <button
                    onClick={() => setIsSettingsModalOpen(false)}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-200/50 hover:bg-slate-200 text-slate-500 hover:text-slate-700 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                  </button>
                </div>

                <form onSubmit={handleSaveSettings} className="p-6 space-y-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">วันที่ตัดรอบบิลของทุกเดือน</label>
                    <div className="relative">
                      <input
                        type="number"
                        required
                        min="1"
                        max="31"
                        value={tempCutoffDay}
                        onChange={(e) => setTempCutoffDay(Number(e.target.value))}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all bg-slate-50 focus:bg-white text-lg font-bold"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium text-sm">ของเดือน</span>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">ระบบจะใช้ค่านี้ในการคำนวณว่าเริ่มรอบบิลใหม่หรือยัง เพื่อเปลี่ยนสีการ์ดห้องพักในหน้าแรก</p>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isSubmitting ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </AdminLayout>
      </div>

      {/* Print Layout */}
      {invoiceToPrint && (
        <div className="hidden print:block fixed inset-0 z-[9999] bg-white text-black p-0 m-0 font-sans text-sm h-screen overflow-visible">
          <InvoiceDocument invoice={invoiceToPrint} dormSettings={dormSettings} />
        </div>
      )}
    </>
  );
}
