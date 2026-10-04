"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/backend/lib/supabase';
import AdminLayout from '@/components/AdminLayout';
import { useAlert } from '@/contexts/AlertContext';
import ContractModal from '@/components/ContractModal';
import Link from 'next/link';

export default function RoomsManagementPage() {
  const router = useRouter();

  // Data states
  const [rooms, setRooms] = useState<any[]>([]);
  const [activeContracts, setActiveContracts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { showAlert, showConfirm } = useAlert();

  // View state
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Filter states
  const [floorFilter, setFloorFilter] = useState<string>('all');
  const [priceFilter, setPriceFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Available options derived from data
  const [availableFloors, setAvailableFloors] = useState<string[]>([]);
  const [availablePrices, setAvailablePrices] = useState<string[]>([]);

  // Add Room Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newRoomNumber, setNewRoomNumber] = useState('');
  const [newFloor, setNewFloor] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [newRoomTypeId, setNewRoomTypeId] = useState('');
  const [roomTypes, setRoomTypes] = useState<any[]>([]);

  // Edit Room Modal states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editRoomId, setEditRoomId] = useState<number | null>(null);
  const [editRoomNumber, setEditRoomNumber] = useState('');
  const [editFloor, setEditFloor] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editRoomTypeId, setEditRoomTypeId] = useState('');
  const [editRoomStatus, setEditRoomStatus] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  // Contract Modal states
  const [isContractModalOpen, setIsContractModalOpen] = useState(false);
  const [selectedRoomForContract, setSelectedRoomForContract] = useState<any>(null);

  // Room Details Drawer states
  const [isRoomDetailsModalOpen, setIsRoomDetailsModalOpen] = useState(false);
  const [selectedRoomDetails, setSelectedRoomDetails] = useState<any>(null);
  const [contractDetails, setContractDetails] = useState<any>(null);
  const [roomInvoices, setRoomInvoices] = useState<any[]>([]);

  // Maintenance Modal states
  const [isMaintenanceModalOpen, setIsMaintenanceModalOpen] = useState(false);
  const [selectedRoomForMaintenance, setSelectedRoomForMaintenance] = useState<any>(null);
  const [maintenanceReason, setMaintenanceReason] = useState('');
  const [isSubmittingMaintenance, setIsSubmittingMaintenance] = useState(false);

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
      fetchRoomTypes();
    };

    checkAuth();
  }, []);

  const fetchRoomTypes = async () => {
    try {
      const { data, error } = await supabase.from('room_types').select('*').order('id', { ascending: true });
      if (error) throw error;
      if (data) setRoomTypes(data);
    } catch (err) {
      console.error("Fetch room types error:", err);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const [roomsResult, contractsResult] = await Promise.all([
        supabase.from('rooms').select('*, room_types(name)').order('room_number', { ascending: true }),
        supabase.from('view_active_contracts').select('*')
      ]);

      if (roomsResult.error) throw roomsResult.error;
      if (contractsResult.error) throw contractsResult.error;

      if (roomsResult.data) {
        setRooms(roomsResult.data);
        const floors = Array.from(new Set(roomsResult.data.map(r => String(r.floor)))).filter(Boolean).sort();
        const prices = Array.from(new Set(roomsResult.data.map(r => String(r.price_per_month)))).filter(Boolean).sort((a, b) => Number(a) - Number(b));

        setAvailableFloors(floors);
        setAvailablePrices(prices);
      }

      if (contractsResult.data) {
        setActiveContracts(contractsResult.data);
      }
    } catch (err: any) {
      console.error("Fetch Data Error:", err);
      setError(err.message || 'เกิดข้อผิดพลาดในการดึงข้อมูลห้องพัก');
    } finally {
      setLoading(false);
    }
  };

  const handleAddRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomNumber || !newFloor || !newPrice) {
      alert('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    try {
      setIsAdding(true);
      const { error } = await supabase
        .from('rooms')
        .insert([
          {
            room_number: newRoomNumber,
            floor: newFloor,
            price_per_month: Number(newPrice),
            status: 'vacant',
            room_type_id: newRoomTypeId ? Number(newRoomTypeId) : null
          }
        ]);

      if (error) throw error;

      setNewRoomNumber('');
      setNewFloor('');
      setNewPrice('');
      setNewRoomTypeId('');
      setIsAddModalOpen(false);

      fetchData();

    } catch (err: any) {
      console.error("Add Room Error:", err);
      alert("เพิ่มห้องพักไม่สำเร็จ: " + err.message);
    } finally {
      setIsAdding(false);
    }
  };

  const openEditModal = (room: any) => {
    setEditRoomId(room.room_id);
    setEditRoomNumber(room.room_number);
    setEditFloor(String(room.floor || ''));
    setEditPrice(String(room.price_per_month || ''));
    setEditRoomTypeId(room.room_type_id ? String(room.room_type_id) : '');
    setEditRoomStatus(room.status || '');
    setIsEditModalOpen(true);
  };

  const confirmEditRoom = async () => {
    if (!editRoomId) return;
    try {
      setIsEditing(true);
      const { data: currentRoom, error: fetchError } = await supabase
        .from('rooms')
        .select('status')
        .eq('room_id', editRoomId)
        .single();
      
      if (fetchError) throw fetchError;

      const isOccupied = currentRoom?.status === 'occupied' || currentRoom?.status === 'มีผู้เช่า';
      const updatePayload: any = {
        room_number: editRoomNumber,
        floor: editFloor,
        room_type_id: editRoomTypeId ? Number(editRoomTypeId) : null
      };

      if (!isOccupied) {
        updatePayload.price_per_month = Number(editPrice);
      }

      const { error } = await supabase
        .from('rooms')
        .update(updatePayload)
        .eq('room_id', editRoomId);

      if (error) throw error;

      setIsEditModalOpen(false);
      showAlert('success', 'แก้ไขข้อมูลห้องพักสำเร็จ', 'อัปเดตข้อมูลห้องพักเรียบร้อยแล้ว');
      fetchData();
    } catch (err: any) {
      alert("แก้ไขห้องพักไม่สำเร็จ: " + err.message);
    } finally {
      setIsEditing(false);
    }
  };

  const handleEditRoomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editRoomNumber || !editFloor || !editPrice) {
      alert('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }
    showConfirm('ยืนยันการแก้ไขข้อมูล', `คุณต้องการบันทึกการแก้ไขข้อมูลห้องพัก ${editRoomNumber} ใช่หรือไม่?`, confirmEditRoom);
  };

  const confirmDeleteRoom = async (roomId: number) => {
    try {
      const { error } = await supabase.from('rooms').delete().eq('room_id', roomId);
      if (error) throw error;

      showAlert('success', 'ลบห้องพักสำเร็จ', 'ลบข้อมูลห้องพักออกจากระบบแล้ว');
      fetchData();
    } catch (err: any) {
      alert("ไม่สามารถลบห้องได้: " + err.message);
    }
  };

  const handleDeleteRoom = (roomId: number) => {
    showConfirm(
      'ยืนยันการลบห้องพัก',
      'คุณแน่ใจหรือไม่ว่าต้องการลบห้องนี้?',
      () => confirmDeleteRoom(roomId)
    );
  };

  const openContractModal = (room: any) => {
    setSelectedRoomForContract(room);
    setIsContractModalOpen(true);
  };

  const openRoomDetailsModal = async (room: any) => {
    setSelectedRoomDetails(room);
    setIsRoomDetailsModalOpen(true);
    setContractDetails(null);
    setRoomInvoices([]);

    const contract = activeContracts.find(c => c.room_id === room.room_id);
    if (contract) {
      setContractDetails(contract);
      try {
        const { data: invoiceData, error: invoiceError } = await supabase
          .from('invoices')
          .select('*')
          .eq('contract_id', contract.contracts_id)
          .order('invoices_id', { ascending: false });

        if (invoiceError) throw invoiceError;
        if (invoiceData) setRoomInvoices(invoiceData);
      } catch (err) {
        console.error("Error loading invoices:", err);
      }
    }
  };

  const confirmTerminate = async () => {
    try {
      const { error: contractError } = await supabase
        .from('contracts')
        .update({ is_active: false, end_date: new Date().toISOString() })
        .eq('contracts_id', contractDetails.contracts_id);
      if (contractError) throw contractError;

      const { error: roomError } = await supabase
        .from('rooms')
        .update({ status: 'vacant' })
        .eq('room_id', selectedRoomDetails.room_id);
      if (roomError) throw roomError;

      setIsRoomDetailsModalOpen(false);
      fetchData();

      showAlert('success', 'ยกเลิกสัญญาสำเร็จ', 'สัญญาเช่าถูกยกเลิกและห้องถูกเปลี่ยนเป็นสถานะว่างแล้ว');
    } catch (err: any) {
      alert('เกิดข้อผิดพลาด: ' + err.message);
    }
  };

  const terminateContract = () => {
    showConfirm(
      'ยืนยันการยกเลิกสัญญา',
      'คุณแน่ใจหรือไม่ว่าต้องการยกเลิกสัญญาเช่าห้องนี้ก่อนกำหนด? การกระทำนี้ไม่สามารถย้อนกลับได้',
      confirmTerminate
    );
  };

  const openMaintenanceModal = (room: any) => {
    setSelectedRoomForMaintenance(room);
    setMaintenanceReason('');
    setIsMaintenanceModalOpen(true);
  };

  const submitMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!maintenanceReason.trim()) {
      alert('กรุณากรอกเหตุผลในการปิดปรับปรุง');
      return;
    }

    try {
      setIsSubmittingMaintenance(true);
      const { error } = await supabase.from('rooms').update({
        status: 'maintenance',
        maintenance_reason: maintenanceReason.trim()
      }).eq('room_id', selectedRoomForMaintenance.room_id);

      if (error) throw error;

      setIsMaintenanceModalOpen(false);
      fetchData();
    } catch (err: any) {
      alert("ไม่สามารถปิดปรับปรุงห้องได้: " + err.message);
    } finally {
      setIsSubmittingMaintenance(false);
    }
  };

  const restoreRoomFromMaintenance = async (roomId: number) => {
    if (!window.confirm('คุณแน่ใจหรือไม่ว่าต้องการเปิดใช้งานห้องนี้ตามปกติ?')) return;
    try {
      const { error } = await supabase.from('rooms').update({
        status: 'vacant',
        maintenance_reason: null
      }).eq('room_id', roomId);
      if (error) throw error;
      fetchData();
    } catch (err: any) {
      alert("ไม่สามารถเปลี่ยนสถานะห้องได้: " + err.message);
    }
  };

  // Filtered Data
  const filteredRooms = rooms.filter(room => {
    const matchFloor = floorFilter === 'all' || String(room.floor) === floorFilter;
    const matchPrice = priceFilter === 'all' || String(room.price_per_month) === priceFilter;
    const matchType = typeFilter === 'all' || String(room.room_type_id) === typeFilter;

    let matchStatus = true;
    if (statusFilter !== 'all') {
      if (statusFilter === 'ว่าง') matchStatus = room.status === 'vacant';
      if (statusFilter === 'มีผู้เช่า') matchStatus = room.status === 'occupied';
      if (statusFilter === 'ปิดปรับปรุง') matchStatus = room.status === 'maintenance';
    }

    return matchFloor && matchPrice && matchType && matchStatus;
  });

  const getContractForRoom = (roomId: number) => {
    return activeContracts.find(c => c.room_id === roomId);
  };

  // Helper for formatting month_year to DD/MM/YYYY
  const formatInvoiceDate = (dateString: string) => {
    if (!dateString) return '-';
    if (dateString.includes('/') && dateString.split('/')[2]?.length === 4) {
      const parts = dateString.split('/');
      if (parts.length === 3) {
        return `${parts[0].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[2]}`;
      }
    }
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

  const handleAddRoomTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setNewRoomTypeId(val);
    if (val) {
      const selectedType = roomTypes.find(rt => String(rt.id) === val);
      if (selectedType && selectedType.base_price) {
        setNewPrice(String(selectedType.base_price));
      }
    }
  };

  const handleEditRoomTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setEditRoomTypeId(val);
    if (val && editRoomStatus !== 'occupied' && editRoomStatus !== 'มีผู้เช่า') {
      const selectedType = roomTypes.find(rt => String(rt.id) === val);
      if (selectedType && selectedType.base_price) {
        setEditPrice(String(selectedType.base_price));
      }
    }
  };

  const isNewRoomDuplicate = newRoomNumber.trim() !== '' && rooms.some(r => String(r.room_number).toLowerCase() === newRoomNumber.trim().toLowerCase());
  const isEditRoomDuplicate = editRoomNumber.trim() !== '' && rooms.some(r => String(r.room_number).toLowerCase() === editRoomNumber.trim().toLowerCase() && r.room_id !== editRoomId);

  // Group rooms for Grid View
  const uniqueFloors = Array.from(new Set(filteredRooms.map(r => String(r.floor)))).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  return (
    <AdminLayout>
      <div className="space-y-6">

        {/* Header Actions & Filters */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
            <div className="flex flex-col gap-1 w-full sm:w-auto">
              <label className="text-xs font-semibold text-slate-500 uppercase">ชั้นที่</label>
              <select
                value={floorFilter}
                onChange={(e) => setFloorFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-xl focus:ring-blue-500 focus:border-blue-500 block w-full sm:w-32 p-2.5 outline-none cursor-pointer"
              >
                <option value="all">ทั้งหมด</option>
                {availableFloors.map(f => <option key={f} value={f}>ชั้น {f}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-1 w-full sm:w-auto">
              <label className="text-xs font-semibold text-slate-500 uppercase">ราคา/เดือน</label>
              <select
                value={priceFilter}
                onChange={(e) => setPriceFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-xl focus:ring-blue-500 focus:border-blue-500 block w-full sm:w-36 p-2.5 outline-none cursor-pointer"
              >
                <option value="all">ทั้งหมด</option>
                {availablePrices.map(p => <option key={p} value={p}>{Number(p).toLocaleString()} ฿</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-1 w-full sm:w-auto">
              <label className="text-xs font-semibold text-slate-500 uppercase">สถานะ</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-xl focus:ring-blue-500 focus:border-blue-500 block w-full sm:w-36 p-2.5 outline-none cursor-pointer"
              >
                <option value="all">ทั้งหมด</option>
                <option value="ว่าง">ว่าง</option>
                <option value="มีผู้เช่า">มีผู้เช่า</option>
                <option value="ปิดปรับปรุง">ปิดปรับปรุง</option>
              </select>
            </div>
            
            <div className="flex flex-col gap-1 w-full sm:w-auto">
              <label className="text-xs font-semibold text-slate-500 uppercase">ประเภทห้องพัก</label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-xl focus:ring-blue-500 focus:border-blue-500 block w-full sm:w-36 p-2.5 outline-none cursor-pointer"
              >
                <option value="all">ทั้งหมด</option>
                <option value="null">ไม่ระบุประเภท</option>
                {roomTypes.map(rt => <option key={rt.id} value={rt.id}>{rt.name}</option>)}
              </select>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full xl:w-auto">
            {/* View Switcher */}
            <div className="flex bg-slate-100 p-1.5 rounded-xl w-full sm:w-auto border border-slate-200/60 shadow-inner">
              <button 
                onClick={() => setViewMode('grid')} 
                className={`flex-1 sm:w-auto px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${viewMode === 'grid' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
                ผังห้อง
              </button>
              <button 
                onClick={() => setViewMode('table')} 
                className={`flex-1 sm:w-auto px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${viewMode === 'table' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
                แบบตาราง
              </button>
            </div>

            <button
              onClick={() => setIsAddModalOpen(true)}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all shadow-md hover:shadow-lg active:scale-95 whitespace-nowrap"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              เพิ่มห้องพัก
            </button>
          </div>
        </div>

        {/* Content Area */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center">
            <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
            <p className="text-slate-500 font-medium">กำลังโหลดข้อมูลห้องพัก...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 text-red-600 p-6 rounded-2xl border border-red-100 text-center font-medium">
            {error}
          </div>
        ) : filteredRooms.length === 0 ? (
          <div className="py-16 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-white/50 flex flex-col items-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-3xl mb-3">🔍</div>
            <h3 className="text-lg font-bold text-slate-700">ไม่พบห้องพักที่ตรงกับเงื่อนไข</h3>
            <p className="text-slate-500">ลองปรับเปลี่ยนตัวกรองใหม่ หรือเพิ่มห้องพักเข้าสู่ระบบ</p>
            <button
              onClick={() => { setFloorFilter('all'); setPriceFilter('all'); setStatusFilter('all'); setTypeFilter('all'); }}
              className="mt-4 text-blue-600 font-medium hover:underline"
            >
              ล้างตัวกรองทั้งหมด
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="space-y-10">
            {uniqueFloors.map(floor => (
              <div key={floor} className="bg-white/40 p-6 rounded-3xl border border-slate-200/50">
                <h4 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-3">
                  <span className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shadow-sm">🏢</span>
                  ชั้น {floor}
                  <span className="text-sm font-medium text-slate-400 ml-2 px-2.5 py-0.5 bg-slate-100 rounded-full">
                    {filteredRooms.filter(r => String(r.floor) === floor).length} ห้อง
                  </span>
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {filteredRooms.filter(r => String(r.floor) === floor).map(room => {
                    const isVacant = room.status === 'vacant';
                    const isMaintenance = room.status === 'maintenance';
                    const isOccupied = room.status === 'occupied';

                    const statusColor = isMaintenance ? 'bg-slate-400' : isVacant ? 'bg-emerald-500' : 'bg-rose-500';
                    const borderClass = isMaintenance ? 'border-slate-200 bg-slate-50 opacity-80' : isOccupied ? 'border-rose-200/60 bg-white hover:border-rose-400' : 'border-emerald-200/60 bg-white hover:border-emerald-400';
                    
                    return (
                      <div
                        key={room.room_id}
                        onClick={() => openRoomDetailsModal(room)}
                        className={`rounded-2xl p-4 border shadow-sm transition-all cursor-pointer hover:shadow-md hover:-translate-y-1 ${borderClass}`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <h4 className={`text-2xl font-black tracking-tight ${isMaintenance ? 'text-slate-500' : 'text-slate-800'}`}>{room.room_number}</h4>
                          <span className={`w-3.5 h-3.5 rounded-full ring-4 shadow-sm ${statusColor} ${isMaintenance ? 'ring-slate-100' : isVacant ? 'ring-emerald-50' : 'ring-rose-50'} mt-1`}></span>
                        </div>
                        <div className="space-y-1 mt-3">
                          <p className="text-xs text-slate-500 font-medium">ราคา: <span className="font-bold text-slate-700">{Number(room.price_per_month).toLocaleString()}</span> ฿</p>
                          {room.room_types?.name && (
                            <p className="text-[10px] text-slate-400 bg-slate-100 inline-block px-1.5 py-0.5 rounded">{room.room_types.name}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white border border-slate-200/60 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              {/* Desktop Table */}
              <table className="w-full text-left text-sm text-slate-600 hidden md:table">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase font-bold tracking-wider">
                  <tr>
                    <th className="px-6 py-4">เลขห้อง</th>
                    <th className="px-6 py-4">ชั้น</th>
                    <th className="px-6 py-4">ราคา/เดือน</th>
                    <th className="px-6 py-4">สถานะ</th>
                    <th className="px-6 py-4">ผู้เช่าปัจจุบัน</th>
                    <th className="px-6 py-4 text-right">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRooms.map(room => {
                    const isVacant = room.status === 'vacant';
                    const isMaintenance = room.status === 'maintenance';
                    const isOccupied = room.status === 'occupied';
                    const contract = getContractForRoom(room.room_id);

                    return (
                      <tr key={room.room_id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-bold text-slate-800 text-base">{room.room_number}</div>
                          {room.room_types?.name && <div className="text-xs text-slate-400">{room.room_types.name}</div>}
                        </td>
                        <td className="px-6 py-4 font-medium text-slate-700">{room.floor || '-'}</td>
                        <td className="px-6 py-4 font-medium text-slate-700">{Number(room.price_per_month).toLocaleString()} ฿</td>
                        <td className="px-6 py-4">
                          {isVacant && <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-100 text-emerald-700">ว่าง</span>}
                          {isOccupied && <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-rose-100 text-rose-700">มีผู้เช่า</span>}
                          {isMaintenance && <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-slate-200 text-slate-700">ปิดปรับปรุง</span>}
                        </td>
                        <td className="px-6 py-4">
                          {contract ? (
                            <div className="text-sm">
                              <p className="font-semibold text-slate-800">{contract.first_name} {contract.last_name}</p>
                              <p className="text-xs text-slate-500">{contract.phone_number}</p>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button onClick={() => openRoomDetailsModal(room)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors" title="ดูรายละเอียด">
                              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                            </button>
                            <button onClick={() => openEditModal(room)} className="p-2 text-amber-500 hover:bg-amber-50 rounded-lg transition-colors" title="แก้ไข">
                              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                            </button>
                            {(isVacant || isMaintenance) && (
                              <button onClick={() => handleDeleteRoom(room.room_id)} className="p-2 text-rose-400 hover:bg-rose-50 rounded-lg transition-colors" title="ลบ">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Mobile Cards */}
              <div className="md:hidden divide-y divide-slate-100">
                {filteredRooms.map(room => {
                  const isVacant = room.status === 'vacant';
                  const isMaintenance = room.status === 'maintenance';
                  const isOccupied = room.status === 'occupied';
                  const contract = getContractForRoom(room.room_id);

                  return (
                    <div key={room.room_id} className="p-4 hover:bg-slate-50 transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-3">
                          <h4 className="text-xl font-bold text-slate-800">{room.room_number}</h4>
                          {isVacant && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700">ว่าง</span>}
                          {isOccupied && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700">มีผู้เช่า</span>}
                          {isMaintenance && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-700">ปิดปรับปรุง</span>}
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-slate-700">{Number(room.price_per_month).toLocaleString()} ฿</p>
                          <p className="text-xs text-slate-400">ชั้น {room.floor || '-'}</p>
                        </div>
                      </div>
                      
                      {contract && (
                        <div className="mb-3 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                          <p className="text-sm font-semibold text-slate-700 flex items-center gap-2"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg> {contract.first_name} {contract.last_name}</p>
                          <p className="text-xs text-slate-500 mt-0.5 ml-5">{contract.phone_number || '-'}</p>
                        </div>
                      )}

                      <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100">
                        <button onClick={() => openRoomDetailsModal(room)} className="flex-1 py-2 text-xs font-bold bg-blue-50 text-blue-600 rounded-lg">รายละเอียด</button>
                        <button onClick={() => openEditModal(room)} className="flex-1 py-2 text-xs font-bold bg-amber-50 text-amber-600 rounded-lg">แก้ไข</button>
                        {(isVacant || isMaintenance) && (
                           <button onClick={() => handleDeleteRoom(room.room_id)} className="flex-1 py-2 text-xs font-bold bg-rose-50 text-rose-600 rounded-lg">ลบ</button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Slide-over Drawer (Room Details) */}
      {isRoomDetailsModalOpen && selectedRoomDetails && (
        <div className="fixed inset-0 z-[100] flex items-end lg:items-stretch lg:justify-end">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={() => setIsRoomDetailsModalOpen(false)}></div>
          
          <div className="relative w-full lg:w-[450px] bg-white rounded-t-3xl lg:rounded-none lg:rounded-l-3xl shadow-2xl flex flex-col max-h-[90vh] lg:max-h-full transform transition-transform animate-in slide-in-from-bottom-full lg:slide-in-from-right-full duration-300">
            
            <div className="flex justify-between items-center px-6 py-5 border-b border-slate-100 bg-white rounded-t-3xl lg:rounded-tl-3xl shrink-0">
              <div>
                <h3 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                  <span className="text-2xl">🚪</span> ห้อง {selectedRoomDetails.room_number}
                </h3>
                <p className="text-sm text-slate-500 mt-1 font-medium">ชั้น {selectedRoomDetails.floor || '-'} • ราคา {Number(selectedRoomDetails.price_per_month).toLocaleString()} บาท/เดือน</p>
              </div>
              <button
                onClick={() => setIsRoomDetailsModalOpen(false)}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 bg-slate-50/50 space-y-6">
              
              {/* Status Section */}
              <div className="bg-white rounded-2xl border border-slate-200/70 p-5 shadow-sm">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">สถานะปัจจุบัน</h4>
                
                {selectedRoomDetails.status === 'vacant' ? (
                  <div className="flex flex-col items-center justify-center py-6 text-center">
                    <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mb-4">
                      <span className="text-emerald-500 text-3xl">✨</span>
                    </div>
                    <h5 className="text-lg font-bold text-emerald-600 mb-1">ห้องว่างพร้อมเช่า</h5>
                    <p className="text-slate-500 text-sm mb-6">ห้องนี้ยังไม่มีผู้เช่า คุณสามารถทำสัญญาเช่าใหม่ได้ทันที</p>
                    <button
                      onClick={() => {
                        setIsRoomDetailsModalOpen(false);
                        openContractModal(selectedRoomDetails);
                      }}
                      className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 active:scale-95"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line></svg>
                      ทำสัญญาเช่าใหม่
                    </button>
                    
                    <button
                      onClick={() => {
                        setIsRoomDetailsModalOpen(false);
                        openMaintenanceModal(selectedRoomDetails);
                      }}
                      className="w-full mt-3 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                    >
                      ปิดปรับปรุงห้อง
                    </button>
                  </div>
                ) : selectedRoomDetails.status === 'maintenance' ? (
                  <div className="flex flex-col items-center justify-center py-6 text-center">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                      <span className="text-slate-500 text-3xl">🛠️</span>
                    </div>
                    <h5 className="text-lg font-bold text-slate-700 mb-1">ห้องอยู่ระหว่างปิดปรับปรุง</h5>
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 w-full mt-4 text-left">
                      <p className="text-xs text-slate-500 mb-1">สาเหตุ:</p>
                      <p className="text-sm font-medium text-slate-700">{selectedRoomDetails.maintenance_reason || 'ไม่ได้ระบุ'}</p>
                    </div>
                    
                    <button
                      onClick={() => {
                        setIsRoomDetailsModalOpen(false);
                        restoreRoomFromMaintenance(selectedRoomDetails.room_id);
                      }}
                      className="w-full mt-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 active:scale-95"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                      เปิดใช้งานห้องปกติ
                    </button>
                  </div>
                ) : contractDetails ? (
                  <div className="space-y-5">
                    <div className="flex items-center gap-4 p-4 bg-blue-50/50 rounded-xl border border-blue-100">
                      <div className="w-12 h-12 bg-white rounded-full shadow-sm flex items-center justify-center text-blue-500 text-xl font-black shrink-0 border border-blue-100">
                        {contractDetails.first_name ? contractDetails.first_name[0] : '👤'}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800">{contractDetails.first_name} {contractDetails.last_name}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{contractDetails.phone_number || '-'}</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                        <p className="text-xs text-slate-400 mb-1">วันที่เริ่มสัญญา</p>
                        <p className="font-semibold text-slate-700 text-sm">{contractDetails.start_date ? new Date(contractDetails.start_date).toLocaleDateString('th-TH') : '-'}</p>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                        <p className="text-xs text-slate-400 mb-1">วันสิ้นสุดสัญญา</p>
                        <p className="font-semibold text-slate-700 text-sm">{contractDetails.end_date ? new Date(contractDetails.end_date).toLocaleDateString('th-TH') : '-'}</p>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 pt-2">
                      <div className="grid grid-cols-2 gap-3">
                        <Link
                          href="/invoices"
                          className="py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-sm transition-all flex items-center justify-center gap-2 text-sm"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                          ดูบิลทั้งหมด
                        </Link>
                        <button
                          onClick={() => window.open('/contracts/print/' + contractDetails.contracts_id, '_blank')}
                          className="py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-all flex items-center justify-center gap-2 text-sm"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                          พิมพ์สัญญา
                        </button>
                      </div>
                      
                      <button
                        onClick={() => {
                          setIsRoomDetailsModalOpen(false);
                          // We use general maintenance modal but the admin might want to record it.
                          // Usually tenant records it, but admin can also record if tenant calls.
                          router.push('/maintenance'); 
                        }}
                        className="w-full py-3 bg-amber-50 text-amber-600 border border-amber-200 hover:bg-amber-100 rounded-xl font-bold transition-all flex items-center justify-center gap-2 text-sm"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>
                        รายการแจ้งซ่อม
                      </button>

                      <div className="border-t border-slate-100 pt-3 mt-1">
                        <button
                          onClick={terminateContract}
                          className="w-full py-3 bg-white text-rose-500 border-2 border-rose-100 hover:bg-rose-50 rounded-xl font-bold transition-all text-sm"
                        >
                          ยกเลิกสัญญาเช่าก่อนกำหนด
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-10 text-center text-slate-500">กำลังโหลดข้อมูลสัญญา...</div>
                )}
              </div>

              {/* Invoice History Snippet (Only if occupied) */}
              {contractDetails && (
                <div className="bg-white rounded-2xl border border-slate-200/70 overflow-hidden shadow-sm">
                  <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center">
                    <h4 className="text-sm font-bold text-slate-700 tracking-wide">บิลค่าเช่าล่าสุด</h4>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {roomInvoices.length === 0 ? (
                      <div className="p-6 text-center text-slate-400 text-sm">ยังไม่มีบิลค่าเช่า</div>
                    ) : (
                      roomInvoices.slice(0, 3).map(inv => (
                        <div key={inv.invoices_id} className="flex justify-between items-center p-4 hover:bg-slate-50">
                          <div>
                            <p className="font-bold text-slate-700 text-sm">{formatInvoiceDate(inv.month_year)}</p>
                            <div className="mt-1">
                              {inv.status === 'paid' ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700">ชำระแล้ว</span>
                              ) : inv.status === 'pending' ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700">รอตรวจสอบ</span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700">รอชำระ</span>
                              )}
                            </div>
                          </div>
                          <p className="font-black text-slate-800">{Number(inv.total_amount).toLocaleString()} ฿</p>
                        </div>
                      ))
                    )}
                    {roomInvoices.length > 3 && (
                      <Link href="/invoices" className="block text-center py-3 text-xs font-bold text-blue-600 hover:bg-blue-50 bg-slate-50 transition-colors">
                        ดูบิลทั้งหมด ({roomInvoices.length})
                      </Link>
                    )}
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* Add Room Modal, Maintenance Modal, Edit Room Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={() => setIsAddModalOpen(false)}></div>
          <div className="relative bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden scale-100 transition-transform">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" className="text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                เพิ่มห้องพักใหม่
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-200/50 hover:bg-slate-200 text-slate-500 hover:text-slate-700 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>

            <form onSubmit={handleAddRoom} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">หมายเลขห้อง</label>
                  <input
                    type="text"
                    required
                    value={newRoomNumber}
                    onChange={(e) => setNewRoomNumber(e.target.value)}
                    className={`w-full px-4 py-3 rounded-xl border focus:ring-4 outline-none transition-all bg-slate-50 focus:bg-white ${
                      isNewRoomDuplicate 
                        ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/10 text-rose-600' 
                        : 'border-slate-200 focus:border-blue-500 focus:ring-blue-500/10'
                    }`}
                    placeholder="เช่น 101, 201"
                  />
                  {isNewRoomDuplicate && (
                    <p className="text-rose-500 text-sm mt-1.5 flex items-center gap-1">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                      หมายเลขห้องนี้มีในระบบแล้ว
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">ชั้นที่</label>
                    <input
                      type="text"
                      required
                      value={newFloor}
                      onChange={(e) => setNewFloor(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all bg-slate-50 focus:bg-white"
                      placeholder="เช่น 1, 2"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">ราคาต่อเดือน (บาท)</label>
                    <input
                      type="number"
                      required
                      value={newPrice}
                      onChange={(e) => setNewPrice(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all bg-slate-50 focus:bg-white"
                      placeholder="เช่น 4500"
                      min="0"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">ประเภทห้องพัก</label>
                  <select
                    value={newRoomTypeId}
                    onChange={handleAddRoomTypeChange}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all bg-slate-50 focus:bg-white"
                  >
                    <option value="">-- ไม่ระบุ --</option>
                    {roomTypes.map(rt => (
                      <option key={rt.id} value={rt.id}>{rt.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-8 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 px-4 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isAdding || isNewRoomDuplicate}
                  className="flex-1 px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition-colors shadow-md disabled:bg-blue-400 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none flex justify-center items-center"
                >
                  {isAdding ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    'บันทึกข้อมูล'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isMaintenanceModalOpen && selectedRoomForMaintenance && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={() => !isSubmittingMaintenance && setIsMaintenanceModalOpen(false)}></div>
          <div className="relative bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden scale-100 transition-transform">

            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-xl font-black text-slate-800 flex items-center gap-3">
                <span className="text-xl">🛠️</span>
                ปิดปรับปรุงห้อง {selectedRoomForMaintenance.room_number}
              </h3>
              <button
                onClick={() => !isSubmittingMaintenance && setIsMaintenanceModalOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-200/50 hover:bg-slate-200 text-slate-500 hover:text-slate-700 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>

            <form onSubmit={submitMaintenance} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">เหตุผลความจำเป็นในการปิดซ่อมแซม <span className="text-rose-500">*</span></label>
                  <textarea
                    required
                    value={maintenanceReason}
                    onChange={(e) => setMaintenanceReason(e.target.value)}
                    placeholder="เช่น แอร์น้ำหยด, พื้นห้องน้ำชำรุดรอช่างเข้าซ่อม..."
                    rows={4}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all bg-slate-50 focus:bg-white text-sm resize-none"
                  ></textarea>
                </div>
              </div>

              <div className="mt-8 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsMaintenanceModalOpen(false)}
                  disabled={isSubmittingMaintenance}
                  className="flex-1 px-4 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-colors disabled:opacity-50"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingMaintenance || !maintenanceReason.trim()}
                  className="flex-1 px-4 py-3 rounded-xl bg-slate-600 hover:bg-slate-700 text-white font-bold transition-colors shadow-md disabled:bg-slate-400 disabled:shadow-none flex justify-center items-center gap-2"
                >
                  {isSubmittingMaintenance ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    'บันทึกสถานะ'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isEditModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={() => setIsEditModalOpen(false)}></div>
          <div className="relative bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden scale-100 transition-transform">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" className="text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                แก้ไขข้อมูลห้องพัก
              </h3>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-200/50 hover:bg-slate-200 text-slate-500 hover:text-slate-700 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>

            <form onSubmit={handleEditRoomSubmit} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">หมายเลขห้อง</label>
                  <input
                    type="text"
                    required
                    value={editRoomNumber}
                    onChange={(e) => setEditRoomNumber(e.target.value)}
                    className={`w-full px-4 py-3 rounded-xl border focus:ring-4 outline-none transition-all bg-slate-50 focus:bg-white ${
                      isEditRoomDuplicate 
                        ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/10 text-rose-600' 
                        : 'border-slate-200 focus:border-amber-500 focus:ring-amber-500/10'
                    }`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">ชั้นที่</label>
                    <input
                      type="text"
                      required
                      value={editFloor}
                      onChange={(e) => setEditFloor(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 outline-none transition-all bg-slate-50 focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">ราคาต่อเดือน (บาท)</label>
                    <input
                      type="number"
                      required={editRoomStatus !== 'occupied' && editRoomStatus !== 'มีผู้เช่า'}
                      value={editPrice}
                      onChange={(e) => setEditPrice(e.target.value)}
                      disabled={editRoomStatus === 'occupied' || editRoomStatus === 'มีผู้เช่า'}
                      className={`w-full px-4 py-3 rounded-xl border focus:ring-4 outline-none transition-all ${
                        editRoomStatus === 'occupied' || editRoomStatus === 'มีผู้เช่า'
                        ? 'bg-slate-100 text-slate-500 cursor-not-allowed border-slate-200' 
                        : 'border-slate-200 focus:border-amber-500 focus:ring-amber-500/10 bg-slate-50 focus:bg-white'
                      }`}
                      min="0"
                    />
                  </div>
                </div>
                {(editRoomStatus === 'occupied' || editRoomStatus === 'มีผู้เช่า') && (
                  <p className="text-xs text-rose-500 font-medium">
                    🔒 ไม่สามารถเปลี่ยนราคาได้เนื่องจากห้องนี้มีผู้เช่าอยู่
                  </p>
                )}

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">ประเภทห้องพัก</label>
                  <select
                    value={editRoomTypeId}
                    onChange={handleEditRoomTypeChange}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 outline-none transition-all bg-slate-50 focus:bg-white"
                  >
                    <option value="">-- ไม่ระบุ --</option>
                    {roomTypes.map(rt => (
                      <option key={rt.id} value={rt.id}>{rt.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-8 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="flex-1 px-4 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isEditing || isEditRoomDuplicate}
                  className="flex-1 px-4 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold transition-colors shadow-md disabled:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none flex justify-center items-center"
                >
                  {isEditing ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    'บันทึกการแก้ไข'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </AdminLayout>
  );
}
