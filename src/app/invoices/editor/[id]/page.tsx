"use client";

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { supabase } from '@/backend/lib/supabase';
import AdminLayout from '@/components/AdminLayout';
import { useAlert } from '@/contexts/AlertContext';
import Link from 'next/link';

const getMeterCycle = (issueDateStr: string, meterDay: number) => {
  if (!issueDateStr || !meterDay) return '';
  const [yStr, mStr, dStr] = issueDateStr.split('-'); // input date is YYYY-MM-DD
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

function InvoiceEditorContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const { showAlert } = useAlert();

  const id = params.id as string;
  const contractIdParam = searchParams.get('contract_id');

  const isNew = id === 'new';

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [dormSettings, setDormSettings] = useState<any>(null);

  // Contracts list for selection if not pre-selected or if user wants to change
  const [activeContracts, setActiveContracts] = useState<any[]>([]);

  // Form State
  const [selectedContractId, setSelectedContractId] = useState(contractIdParam || '');
  const [monthYear, setMonthYear] = useState(new Date().toISOString().slice(0, 10));

  // Set default due date to 5th of next month
  const getDefaultDueDate = () => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() + 1, 5).toISOString().slice(0, 10);
  };
  const [dueDate, setDueDate] = useState(getDefaultDueDate());

  const [waterMeterPrev, setWaterMeterPrev] = useState<number | ''>('');
  const [waterMeterCur, setWaterMeterCur] = useState<number | ''>('');
  const [waterRate, setWaterRate] = useState<number | ''>(15);

  const [electricMeterPrev, setElectricMeterPrev] = useState<number | ''>('');
  const [electricMeterCur, setElectricMeterCur] = useState<number | ''>('');
  const [electricRate, setElectricRate] = useState<number | ''>(8);

  const [additionalItems, setAdditionalItems] = useState<{ name: string; price: number; selectionType?: string }[]>([]);
  const [applyVat, setApplyVat] = useState(false);
  const [presets, setPresets] = useState<any[]>([]);

  // Initialize data
  useEffect(() => {
    const initData = async () => {
      setLoading(true);
      try {
        // 1. Fetch settings
        const { data: settingsData } = await supabase.from('dorm_settings').select('*').limit(1).single();
        if (settingsData) {
          setDormSettings(settingsData);
          if (isNew) {
            if (settingsData.water_rate !== null && settingsData.water_rate !== undefined) {
              setWaterRate(settingsData.water_rate);
            }
            if (settingsData.electric_rate !== null && settingsData.electric_rate !== undefined) {
              setElectricRate(settingsData.electric_rate);
            }
            if (settingsData.due_day !== null && settingsData.due_day !== undefined) {
              const now = new Date();
              let nextMonth = now.getMonth() + 1;
              let nextYear = now.getFullYear();
              if (nextMonth > 11) {
                nextMonth = 0;
                nextYear++;
              }
              const due = new Date(nextYear, nextMonth, settingsData.due_day);
              const yyyy = due.getFullYear();
              const mm = String(due.getMonth() + 1).padStart(2, '0');
              const dd = String(due.getDate()).padStart(2, '0');
              setDueDate(`${yyyy}-${mm}-${dd}`);
            }
          }
        }

        // 2. Fetch Active Contracts
        const { data: contractsData } = await supabase.from('view_active_contracts').select('*');
        if (contractsData) {
          setActiveContracts(contractsData);
        }

        // 3. Fetch Presets
        const { data: presetsData } = await supabase.from('invoice_item_presets').select('*').order('id', { ascending: true });
        const fetchedPresets = presetsData || [];
        if (presetsData) {
          setPresets(fetchedPresets);
        }

        if (!isNew) {
          // Fetch existing invoice
          const { data: invoiceData, error: invoiceError } = await supabase
            .from('invoices')
            .select('*')
            .eq('invoices_id', id)
            .single();

          if (invoiceError) throw invoiceError;
          if (invoiceData) {
            setSelectedContractId(String(invoiceData.contract_id));
            setMonthYear(invoiceData.month_year || '');
            setDueDate(invoiceData.due_date || '');
            setWaterMeterPrev(invoiceData.water_meter_previous ?? '');
            setWaterMeterCur(invoiceData.water_meter_current ?? '');
            setWaterRate(invoiceData.water_rate ?? 15);
            setElectricMeterPrev(invoiceData.electric_meter_previous ?? '');
            setElectricMeterCur(invoiceData.electric_meter_current ?? '');
            setElectricRate(invoiceData.electric_rate ?? 8);

            const loadedItems = invoiceData.additional_items || [];
            setAdditionalItems(loadedItems.map((item: any) => {
              const matched = fetchedPresets.find(p => p.name === item.name);
              return { ...item, selectionType: matched ? String(matched.id) : 'custom' };
            }));

            setApplyVat((invoiceData.vat_amount || 0) > 0);
          }
        } else if (contractIdParam) {
          // If new and has contract_id, try to fetch last invoice to auto-fill previous meters
          const { data: lastInvoice } = await supabase
            .from('invoices')
            .select('water_meter_current, electric_meter_current')
            .eq('contract_id', contractIdParam)
            .order('invoices_id', { ascending: false })
            .limit(1)
            .single();

          if (lastInvoice) {
            setWaterMeterPrev(lastInvoice.water_meter_current || 0);
            setElectricMeterPrev(lastInvoice.electric_meter_current || 0);
          }
        }
      } catch (err: any) {
        console.error("Init Error:", err);
        showAlert('error', 'เกิดข้อผิดพลาด', 'ไม่สามารถโหลดข้อมูลได้');
      } finally {
        setLoading(false);
      }
    };
    initData();
  }, [id, isNew, contractIdParam, showAlert]);

  const handleContractChange = async (cid: string) => {
    setSelectedContractId(cid);
    if (isNew) {
      // Auto-fill from last invoice
      const { data: lastInvoice } = await supabase
        .from('invoices')
        .select('water_meter_current, electric_meter_current')
        .eq('contract_id', cid)
        .order('invoices_id', { ascending: false })
        .limit(1)
        .single();

      if (lastInvoice) {
        setWaterMeterPrev(lastInvoice.water_meter_current || 0);
        setElectricMeterPrev(lastInvoice.electric_meter_current || 0);
      } else {
        setWaterMeterPrev('');
        setElectricMeterPrev('');
      }
    }
  };

  // Add-ons
  const handleAddAdditionalItem = () => {
    setAdditionalItems([...additionalItems, { name: '', price: 0, selectionType: '' }]);
  };

  const handleUpdateAdditionalItemSelect = (index: number, selection: string) => {
    const newItems = [...additionalItems];
    if (selection === 'custom') {
      newItems[index].selectionType = 'custom';
      newItems[index].name = '';
    } else {
      const preset = presets.find(p => String(p.id) === String(selection));
      if (preset) {
        newItems[index].selectionType = String(preset.id);
        newItems[index].name = preset.name;
        newItems[index].price = preset.price;
      }
    }
    setAdditionalItems(newItems);
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

  // Calculate totals
  const calculateTotal = () => {
    const contract = activeContracts.find(c => String(c.contracts_id) === String(selectedContractId));
    const roomRent = contract ? (Number(contract.price_per_month) || 0) : 0;

    const wUsed = Math.max(0, (Number(waterMeterCur) || 0) - (Number(waterMeterPrev) || 0));
    const eUsed = Math.max(0, (Number(electricMeterCur) || 0) - (Number(electricMeterPrev) || 0));

    const wTotal = wUsed * (Number(waterRate) || 0);
    const eTotal = eUsed * (Number(electricRate) || 0);
    const addTotal = additionalItems.reduce((sum, item) => sum + (Number(item.price) || 0), 0);

    let vat = 0;
    const vatPercentage = dormSettings?.vat_percentage !== undefined ? Number(dormSettings.vat_percentage) : 7;
    if (applyVat) {
      vat = (wTotal + eTotal) * (vatPercentage / 100);
    }

    const rawTotal = roomRent + wTotal + eTotal + addTotal + vat;
    const roundedTotal = Math.round(rawTotal);
    const roundingAmount = roundedTotal - rawTotal;

    return { roomRent, wUsed, wTotal, eUsed, eTotal, addTotal, vat, rawTotal, roundedTotal, roundingAmount, vatPercentage, contract };
  };

  const handleSave = async (status: 'draft' | 'unpaid') => {
    if (!selectedContractId || !monthYear || !dueDate || waterMeterPrev === '' || electricMeterPrev === '') {
      alert('กรุณากรอกข้อมูลสำคัญให้ครบถ้วน');
      return;
    }

    try {
      setSubmitting(true);
      const totals = calculateTotal();

      const payload = {
        contract_id: Number(selectedContractId),
        month_year: monthYear,
        due_date: dueDate,
        water_meter_previous: Number(waterMeterPrev),
        water_meter_current: waterMeterCur !== '' ? Number(waterMeterCur) : null,
        water_unit: totals.wUsed,
        water_rate: Number(waterRate),
        electric_meter_previous: Number(electricMeterPrev),
        electric_meter_current: electricMeterCur !== '' ? Number(electricMeterCur) : null,
        electric_unit: totals.eUsed,
        electric_rate: Number(electricRate),
        additional_items: additionalItems.map(({ name, price }) => ({ name, price })),
        vat_amount: totals.vat,
        rounding_amount: totals.roundingAmount,
        total_amount: totals.roundedTotal,
        status: status
      };

      if (isNew) {
        const { error } = await supabase.from('invoices').insert([payload]);
        if (error) throw error;
        alert(status === 'draft' ? 'บันทึกแบบร่างสำเร็จ' : 'ออกบิลสำเร็จ');
      } else {
        const { error } = await supabase.from('invoices').update(payload).eq('invoices_id', id);
        if (error) throw error;
        alert(status === 'draft' ? 'อัปเดตแบบร่างสำเร็จ' : 'ออกบิลสำเร็จ');
      }

      router.push('/invoices');
    } catch (err: any) {
      console.error("Save Error:", err);
      alert(err.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  const totals = calculateTotal();

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/invoices" className="p-2.5 bg-white rounded-xl shadow-sm border border-slate-200 hover:bg-slate-50 transition-colors text-slate-500 hover:text-slate-700">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
        </Link>
        <div>
          <h1 className="text-2xl font-black text-slate-800">{isNew ? 'สร้างบิลค่าเช่าใหม่' : 'แก้ไขบิลค่าเช่า'}</h1>
          <p className="text-sm font-medium text-slate-500">{isNew ? 'กรอกรายละเอียดเพื่อออกบิลใหม่' : 'แก้ไขข้อมูลบิล (สถานะแบบร่าง)'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Form Content */}
        <div className="lg:col-span-7 space-y-6">

          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-6">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">เลือกห้องพัก</label>
              <select
                value={selectedContractId}
                onChange={(e) => handleContractChange(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all bg-slate-50 focus:bg-white text-lg font-semibold text-slate-800"
              >
                <option value="" disabled>-- เลือกห้องที่มีสัญญา --</option>
                {activeContracts.map(c => (
                  <option key={c.contracts_id} value={c.contracts_id}>
                    ห้อง {c.room_number} (ผู้เช่า: {c.first_name})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">วันที่ออกบิล</label>
                <input
                  type="date"
                  value={monthYear}
                  onChange={(e) => setMonthYear(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all bg-slate-50 focus:bg-white font-medium"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">วันครบกำหนดชำระ</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all bg-slate-50 focus:bg-white font-medium"
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-6">
            {/* Water Meter */}
            <div className="p-5 bg-blue-50/50 rounded-2xl border border-blue-100 space-y-4">
              <div className="flex items-center justify-between border-b border-blue-100 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xl">💧</div>
                  <h4 className="font-bold text-blue-900 text-lg">ค่าน้ำประปา</h4>
                </div>
                <div className="text-right">
                  <p className="text-xs text-blue-600 font-bold uppercase tracking-wider">หน่วยที่ใช้</p>
                  <p className="text-2xl font-black text-blue-700">{totals.wUsed}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-blue-900 mb-1.5">เลขมิเตอร์ครั้งก่อน</label>
                  <input
                    type="number" min="0" value={waterMeterPrev}
                    onChange={(e) => setWaterMeterPrev(e.target.value ? Number(e.target.value) : '')}
                    className="w-full px-4 py-3 rounded-xl border border-blue-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all bg-white font-semibold text-lg text-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-blue-900 mb-1.5">เลขมิเตอร์ครั้งนี้</label>
                  <input
                    type="number" min="0" value={waterMeterCur}
                    onChange={(e) => setWaterMeterCur(e.target.value ? Number(e.target.value) : '')}
                    className="w-full px-4 py-3 rounded-xl border border-blue-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-600/20 outline-none transition-all bg-white font-black text-xl text-blue-700 shadow-sm"
                    placeholder="กรอกเลย..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-blue-900 mb-1.5">เรท (฿/หน่วย)</label>
                  <input
                    type="number" min="0" value={waterRate}
                    onChange={(e) => setWaterRate(e.target.value ? Number(e.target.value) : '')}
                    className="w-full px-4 py-3 rounded-xl border border-blue-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all bg-white font-medium text-slate-500"
                  />
                </div>
              </div>
            </div>

            {/* Electric Meter */}
            <div className="p-5 bg-amber-50/50 rounded-2xl border border-amber-100 space-y-4">
              <div className="flex items-center justify-between border-b border-amber-100 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-xl">⚡</div>
                  <h4 className="font-bold text-amber-900 text-lg">ค่าไฟฟ้า</h4>
                </div>
                <div className="text-right">
                  <p className="text-xs text-amber-600 font-bold uppercase tracking-wider">หน่วยที่ใช้</p>
                  <p className="text-2xl font-black text-amber-700">{totals.eUsed}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-amber-900 mb-1.5">เลขมิเตอร์ครั้งก่อน</label>
                  <input
                    type="number" min="0" value={electricMeterPrev}
                    onChange={(e) => setElectricMeterPrev(e.target.value ? Number(e.target.value) : '')}
                    className="w-full px-4 py-3 rounded-xl border border-amber-200 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 outline-none transition-all bg-white font-semibold text-lg text-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-amber-900 mb-1.5">เลขมิเตอร์ครั้งนี้</label>
                  <input
                    type="number" min="0" value={electricMeterCur}
                    onChange={(e) => setElectricMeterCur(e.target.value ? Number(e.target.value) : '')}
                    className="w-full px-4 py-3 rounded-xl border border-amber-400 focus:border-amber-600 focus:ring-4 focus:ring-amber-600/20 outline-none transition-all bg-white font-black text-xl text-amber-700 shadow-sm"
                    placeholder="กรอกเลย..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-amber-900 mb-1.5">เรท (฿/หน่วย)</label>
                  <input
                    type="number" min="0" value={electricRate}
                    onChange={(e) => setElectricRate(e.target.value ? Number(e.target.value) : '')}
                    className="w-full px-4 py-3 rounded-xl border border-amber-200 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 outline-none transition-all bg-white font-medium text-slate-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Additional Items */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h4 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-sm">➕</div>
                รายการเพิ่มเติม
              </h4>
              <button
                type="button" onClick={handleAddAdditionalItem}
                className="flex items-center gap-1.5 text-sm font-bold text-blue-600 bg-blue-50 px-4 py-2 rounded-xl hover:bg-blue-100 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                เพิ่มรายการ
              </button>
            </div>

            {additionalItems.length === 0 ? (
              <div className="py-6 text-center border-2 border-dashed border-slate-100 rounded-2xl">
                <p className="text-slate-400 font-medium">ไม่มีรายการเพิ่มเติม</p>
              </div>
            ) : (
              <div className="space-y-3 pt-2">
                {additionalItems.map((item, index) => (
                  <div key={index} className="flex flex-col sm:flex-row gap-4 items-start sm:items-center bg-slate-50 p-3 rounded-2xl border border-slate-100">
                    <div className="flex-1 w-full sm:w-auto flex flex-col sm:flex-row gap-2">
                      <select
                        value={item.selectionType || ''}
                        onChange={(e) => handleUpdateAdditionalItemSelect(index, e.target.value)}
                        className={`w-full ${item.selectionType === 'custom' ? 'sm:w-1/2' : ''} px-4 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all bg-white font-medium`}
                      >
                        <option value="" disabled>-- เลือกรายการ --</option>
                        {presets.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                        <option value="custom">อื่นๆ (พิมพ์กำหนดเอง...)</option>
                      </select>
                      {item.selectionType === 'custom' && (
                        <input
                          type="text" value={item.name} placeholder="ชื่อรายการ..."
                          onChange={(e) => handleUpdateAdditionalItem(index, 'name', e.target.value)}
                          className="w-full sm:w-1/2 px-4 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all bg-white font-medium"
                        />
                      )}
                    </div>
                    <div className="w-full sm:w-40 relative">
                      <input
                        type="number" value={item.price} placeholder="ราคา"
                        onChange={(e) => handleUpdateAdditionalItem(index, 'price', e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all bg-white font-bold text-slate-700 pr-10"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">฿</span>
                    </div>
                    <button
                      type="button" onClick={() => handleRemoveAdditionalItem(index)}
                      className="w-full sm:w-11 h-11 flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-colors shrink-0"
                    >
                      <span className="sm:hidden mr-2 font-bold">ลบรายการ</span>
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex items-center gap-4">
            <input
              type="checkbox" id="applyVat" checked={applyVat} onChange={(e) => setApplyVat(e.target.checked)}
              className="w-6 h-6 rounded-md border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
            <label htmlFor="applyVat" className="flex-1 text-base font-bold text-slate-700 cursor-pointer select-none">
              คิดภาษีมูลค่าเพิ่ม (VAT {totals.vatPercentage}%) สำหรับค่าน้ำประปาและค่าไฟฟ้า
            </label>
          </div>

        </div>

        {/* Live Preview (Sticky) */}
        <div className="lg:col-span-5 relative">
          <div className="sticky top-8 bg-slate-900 rounded-3xl p-8 shadow-xl shadow-slate-900/20 text-white flex flex-col min-h-[500px]">

            <div className="flex items-start justify-between border-b border-slate-700/50 pb-6 mb-6">
              <div>
                <h3 className="text-2xl font-black tracking-tight text-white mb-1">ใบแจ้งหนี้</h3>
                <p className="text-slate-400 font-medium text-sm">Invoice Preview</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">ห้องพัก</p>
                <p className="text-3xl font-black text-blue-400">{totals.contract?.room_number || '---'}</p>
              </div>
            </div>

            <div className="space-y-4 flex-1">
              <div className="flex justify-between items-center py-2">
                <span className="text-slate-300 font-medium">ค่าเช่าห้องพัก</span>
                <span className="font-bold text-lg">{totals.roomRent.toLocaleString(undefined, { minimumFractionDigits: 2 })} ฿</span>
              </div>
              <div className="flex justify-between items-start py-2">
                <div className="flex flex-col gap-0.5">
                  <span className="text-slate-300 font-medium">ค่าน้ำประปา <span className="text-xs text-slate-400">({getMeterCycle(monthYear, dormSettings?.meter_reading_day || 20)})</span></span>
                  {(waterMeterPrev !== '' && waterMeterCur !== '') ? (
                    <span className="text-xs text-slate-400">(มิเตอร์: {waterMeterPrev} - {waterMeterCur}) • {totals.wUsed} หน่วย</span>
                  ) : (
                    <span className="text-xs text-slate-400">{totals.wUsed} หน่วย</span>
                  )}
                </div>
                <span className="font-bold text-lg mt-0.5">{totals.wTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} ฿</span>
              </div>
              <div className="flex justify-between items-start py-2">
                <div className="flex flex-col gap-0.5">
                  <span className="text-slate-300 font-medium">ค่าไฟฟ้า <span className="text-xs text-slate-400">({getMeterCycle(monthYear, dormSettings?.meter_reading_day || 20)})</span></span>
                  {(electricMeterPrev !== '' && electricMeterCur !== '') ? (
                    <span className="text-xs text-slate-400">(มิเตอร์: {electricMeterPrev} - {electricMeterCur}) • {totals.eUsed} หน่วย</span>
                  ) : (
                    <span className="text-xs text-slate-400">{totals.eUsed} หน่วย</span>
                  )}
                </div>
                <span className="font-bold text-lg mt-0.5">{totals.eTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} ฿</span>
              </div>
              {totals.addTotal > 0 && (
                <div className="flex justify-between items-center py-2 text-amber-300">
                  <span className="font-medium">รายการเพิ่มเติม</span>
                  <span className="font-bold text-lg">{totals.addTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} ฿</span>
                </div>
              )}
              {totals.vat > 0 && (
                <div className="flex justify-between items-center py-2 text-rose-300">
                  <span className="font-medium">ภาษี (VAT {totals.vatPercentage}%)</span>
                  <span className="font-bold text-lg">{totals.vat.toLocaleString(undefined, { minimumFractionDigits: 2 })} ฿</span>
                </div>
              )}
              {totals.roundingAmount !== 0 && (
                <div className="flex justify-between items-center py-2 text-slate-400 border-t border-slate-700/50 pt-4 mt-2">
                  <span className="font-medium">ปัดเศษ (Rounding)</span>
                  <span className="font-bold text-lg">{totals.roundingAmount > 0 ? '+' : ''}{totals.roundingAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} ฿</span>
                </div>
              )}
            </div>

            <div className="border-t border-slate-700 pt-6 mt-6">
              <div className="flex justify-between items-end">
                <span className="text-slate-300 font-bold uppercase tracking-wider">ยอดรวมสุทธิ</span>
                <span className="text-4xl font-black text-emerald-400">{totals.roundedTotal.toLocaleString()} ฿</span>
              </div>
            </div>

          </div>
        </div>

      </div>

      {/* Action Bar (Sticky Bottom) */}
      <div className="fixed bottom-0 left-0 right-0 lg:left-64 bg-white/80 backdrop-blur-md border-t border-slate-200 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.05)] z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="hidden sm:block">
            <p className="text-sm font-bold text-slate-500">สถานะ: {isNew ? 'ร่างใหม่' : 'กำลังแก้ไขแบบร่าง'}</p>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              disabled={submitting}
              onClick={() => handleSave('draft')}
              className="flex-1 sm:flex-none px-6 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-all disabled:opacity-50"
            >
              บันทึกแบบร่าง (Draft)
            </button>
            <button
              disabled={submitting}
              onClick={() => handleSave('unpaid')}
              className="flex-1 sm:flex-none flex justify-center items-center gap-2 px-8 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg shadow-blue-600/20 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100"
            >
              {submitting ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>
              )}
              ออกบิล
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function InvoiceEditorPage() {
  return (
    <AdminLayout>
      <Suspense fallback={
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
        </div>
      }>
        <InvoiceEditorContent />
      </Suspense>
    </AdminLayout>
  );
}
