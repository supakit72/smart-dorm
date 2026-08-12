"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/backend/lib/supabase';
import AdminLayout from '@/components/AdminLayout';
import { useAlert } from '@/contexts/AlertContext';

export default function RoomsManagementPage() {
  const router = useRouter();

  // Data states
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { showAlert, showConfirm } = useAlert();

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
  const [isEditing, setIsEditing] = useState(false);

  // Contract Modal states
  const [tenants, setTenants] = useState<any[]>([]);
  const [isContractModalOpen, setIsContractModalOpen] = useState(false);
  const [selectedRoomForContract, setSelectedRoomForContract] = useState<any>(null);
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isSubmittingContract, setIsSubmittingContract] = useState(false);

  // Room Details Modal states
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

      fetchRooms();
      fetchTenants();
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

  const fetchRooms = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('rooms')
        .select('*, room_types(name)')
        .order('room_number', { ascending: true });

      if (error) throw error;

      if (data) {
        setRooms(data);

        // Extract unique floors and prices for filters
        const floors = Array.from(new Set(data.map(r => String(r.floor)))).filter(Boolean).sort();
        const prices = Array.from(new Set(data.map(r => String(r.price_per_month)))).filter(Boolean).sort((a, b) => Number(a) - Number(b));

        setAvailableFloors(floors);
        setAvailablePrices(prices);
      }
    } catch (err: any) {
      console.error("Fetch Rooms Error:", err);
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

      // รีเซ็ตฟอร์มและปิด Modal
      setNewRoomNumber('');
      setNewFloor('');
      setNewPrice('');
      setNewRoomTypeId('');
      setIsAddModalOpen(false);

      // โหลดข้อมูลใหม่
      fetchRooms();

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
    setIsEditModalOpen(true);
  };

  const confirmEditRoom = async () => {
    if (!editRoomId) return;
    try {
      setIsEditing(true);
      const { error } = await supabase
        .from('rooms')
        .update({
          room_number: editRoomNumber,
          floor: editFloor,
          price_per_month: Number(editPrice),
          room_type_id: editRoomTypeId ? Number(editRoomTypeId) : null
        })
        .eq('room_id', editRoomId);

      if (error) throw error;

      setIsEditModalOpen(false);
      showAlert('success', 'แก้ไขข้อมูลห้องพักสำเร็จ', 'อัปเดตข้อมูลห้องพักเรียบร้อยแล้ว');
      fetchRooms();
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

  const fetchTenants = async () => {
    try {
      // 1. ดึงผู้เช่าทั้งหมด
      const { data: allTenants, error: tenantError } = await supabase.from('users').select('*').eq('role', 'tenant');
      if (tenantError) throw tenantError;

      // 2. ดึงสัญญาที่ยัง Active
      const { data: activeContracts, error: contractError } = await supabase.from('contracts').select('tenant_id').eq('is_active', true);
      if (contractError) throw contractError;

      // 3. นำข้อมูลมาคัดกรอง
      const activeTenantIds = activeContracts?.map(c => c.tenant_id) || [];

      if (allTenants) {
        const availableTenants = allTenants.filter(t => !activeTenantIds.includes(t.user_id) && !activeTenantIds.includes(t.user_uid));
        setTenants(availableTenants);
      }
    } catch (err) {
      console.error("Fetch tenants error:", err);
    }
  };

  const confirmDeleteRoom = async (roomId: number) => {
    try {
      const { error } = await supabase.from('rooms').delete().eq('room_id', roomId);
      if (error) throw error;

      showAlert('success', 'ลบห้องพักสำเร็จ', 'ลบข้อมูลห้องพักออกจากระบบแล้ว');
      fetchRooms();
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
    setSelectedTenantId('');
    setStartDate('');
    setEndDate('');
  };

  const submitContract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTenantId || !startDate || !endDate) {
      alert('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    try {
      setIsSubmittingContract(true);
      const selectedUser = tenants.find(t => t.user_uid === selectedTenantId || t.user_id === selectedTenantId);

      const { error: contractError } = await supabase.from('contracts').insert([
        {
          room_id: selectedRoomForContract.room_id,
          tenant_id: selectedUser?.user_id,
          tenant_uid: selectedUser?.user_uid,
          start_date: startDate,
          end_date: endDate,
          is_active: true
        }
      ]);
      if (contractError) throw contractError;

      const { error: roomError } = await supabase.from('rooms').update({ status: 'occupied' }).eq('room_id', selectedRoomForContract.room_id);
      if (roomError) throw roomError;

      setIsContractModalOpen(false);
      fetchRooms();

    } catch (err: any) {
      alert("ทำสัญญาไม่สำเร็จ: " + err.message);
    } finally {
      setIsSubmittingContract(false);
    }
  };

  const openRoomDetailsModal = async (room: any) => {
    setSelectedRoomDetails(room);
    setIsRoomDetailsModalOpen(true);
    setContractDetails(null);
    setRoomInvoices([]);

    try {
      // ดึงข้อมูลสัญญาที่ยัง Active
      const { data: contractData, error: contractError } = await supabase
        .from('contracts')
        .select(`
          *,
          users!tenant_id ( first_name, last_name, phone_number )
        `)
        .eq('room_id', room.room_id)
        .eq('is_active', true)
        .single();

      if (contractError && contractError.code !== 'PGRST116') {
        console.error("Fetch contract error:", contractError);
      }

      if (contractData) {
        setContractDetails(contractData);
        // ดึงข้อมูลบิลประวัติ
        const { data: invoiceData, error: invoiceError } = await supabase
          .from('invoices')
          .select('*')
          .eq('contract_id', contractData.contracts_id)
          .order('invoices_id', { ascending: false });

        if (invoiceError) throw invoiceError;
        if (invoiceData) setRoomInvoices(invoiceData);
      }
    } catch (err: any) {
      console.error("Error loading room details:", err);
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
      fetchRooms();

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
      fetchRooms();
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
      fetchRooms();
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

  // Helper for formatting month_year to DD/MM/YYYY
  const formatInvoiceDate = (dateString: string) => {
    if (!dateString) return '-';
    // If it's already in D/M/YYYY or DD/MM/YYYY format
    if (dateString.includes('/') && dateString.split('/')[2]?.length === 4) {
      const parts = dateString.split('/');
      if (parts.length === 3) {
        return `${parts[0].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[2]}`;
      }
    }
    // If it's in YYYY-MM-DD
    const match = dateString.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return `${match[3]}/${match[2]}/${match[1]}`;
    }
    // Fallback using Date object
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  return (
    <AdminLayout>
      <div className="space-y-6">

        {/* Header Actions & Filters */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
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

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all shadow-md hover:shadow-lg active:scale-95 whitespace-nowrap"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            เพิ่มห้องพักใหม่
          </button>
        </div>

        {/* Room Cards Grid */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center">
            <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
            <p className="text-slate-500 font-medium">กำลังโหลดข้อมูลห้องพัก...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 text-red-600 p-6 rounded-2xl border border-red-100 text-center font-medium">
            {error}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-slate-700 font-bold">รายการห้องพักทั้งหมด ({filteredRooms.length})</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
              {filteredRooms.map((room) => {
                const isVacant = room.status === 'vacant';
                const isMaintenance = room.status === 'maintenance';
                const isOccupied = room.status === 'occupied';

                const statusColor = isMaintenance ? 'bg-slate-500' : isVacant ? 'bg-emerald-500' : 'bg-red-500';
                const statusBg = isMaintenance ? 'bg-slate-100 text-slate-700 border-slate-300' : isVacant ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200';
                const displayStatus = isMaintenance ? '🛠️ ปิดปรับปรุง' : isVacant ? 'ว่าง' : 'มีผู้เช่า';

                return (
                  <div
                    key={room.room_id}
                    onClick={() => isOccupied && openRoomDetailsModal(room)}
                    className={`bg-white rounded-2xl p-5 border shadow-sm transition-all group relative overflow-hidden ${isMaintenance ? 'bg-slate-50 border-slate-300' : isOccupied ? 'border-blue-200/60 cursor-pointer hover:shadow-lg hover:-translate-y-1 hover:border-blue-400' : 'border-slate-200/60 hover:shadow-md hover:-translate-y-1'}`}
                  >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-slate-50 to-transparent rounded-bl-[100px] opacity-50 group-hover:scale-110 transition-transform pointer-events-none"></div>

                    <div className="flex justify-between items-start mb-4 relative z-10">
                      <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-0.5 flex items-center gap-2">
                          Room
                          {room.room_types?.name && (
                            <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[10px] whitespace-nowrap">{room.room_types.name}</span>
                          )}
                        </p>
                        <h4 className={`text-3xl font-black tracking-tight ${isMaintenance ? 'text-slate-500' : 'text-slate-800'}`}>{room.room_number}</h4>
                      </div>
                      <div className="flex shrink-0 gap-2 items-start mt-1">
                        <span className={`w-3.5 h-3.5 rounded-full ring-4 shadow-sm ${statusColor} ${isMaintenance ? 'ring-slate-200' : isVacant ? 'ring-emerald-50' : 'ring-red-50'} mt-0.5`}></span>
                        <button onClick={(e) => { e.stopPropagation(); openEditModal(room); }} className="text-amber-500 hover:text-amber-600 p-1 rounded-md hover:bg-amber-50 transition-colors" title="แก้ไขห้องพัก">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                        </button>
                        {(isVacant || isMaintenance) && (
                          <button onClick={(e) => { e.stopPropagation(); handleDeleteRoom(room.room_id); }} className="text-red-400 hover:text-red-600 p-1 rounded-md hover:bg-red-50 transition-colors" title="ลบห้อง">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1 mb-4 relative z-10">
                      <p className="text-sm text-slate-500 flex justify-between">
                        <span>ชั้นที่:</span> <span className={`font-semibold ${isMaintenance ? 'text-slate-500' : 'text-slate-700'}`}>{room.floor || '-'}</span>
                      </p>
                      <p className="text-sm text-slate-500 flex justify-between">
                        <span>ราคา:</span> <span className={`font-semibold ${isMaintenance ? 'text-slate-500' : 'text-slate-700'}`}>{Number(room.price_per_month).toLocaleString()} ฿</span>
                      </p>
                      {isMaintenance && room.maintenance_reason && (
                        <p className="text-xs text-slate-500 mt-2 bg-slate-100 p-2 rounded-lg border border-slate-200/60">
                          <span className="font-bold">สาเหตุ:</span> {room.maintenance_reason}
                        </p>
                      )}
                    </div>

                    <div className="relative z-10 border-t border-slate-100 pt-3 flex flex-col gap-2">
                      <div className={`inline-flex items-center justify-center w-full px-3 py-1.5 rounded-lg border font-semibold text-sm shadow-sm ${statusBg}`}>
                        {displayStatus}
                      </div>

                      {isVacant && (
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => openContractModal(room)}
                            className="w-full text-xs font-bold bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 py-2 rounded-lg border border-blue-200 shadow-sm transition-all flex items-center justify-center gap-1"
                          >
                            เพิ่มผู้เช่า
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); openMaintenanceModal(room); }}
                            className="w-full text-xs font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-800 py-2 rounded-lg border border-slate-200 shadow-sm transition-all flex items-center justify-center gap-1"
                          >
                            ปิดปรับปรุง
                          </button>
                        </div>
                      )}
                      {isMaintenance && (
                        <button
                          onClick={(e) => { e.stopPropagation(); restoreRoomFromMaintenance(room.room_id); }}
                          className="w-full text-xs font-bold bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 py-2 rounded-lg border border-emerald-200 shadow-sm transition-all flex items-center justify-center gap-1"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                          เปิดใช้งาน
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {filteredRooms.length === 0 && (
                <div className="col-span-full py-16 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-white/50 flex flex-col items-center">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-3xl mb-3">🔍</div>
                  <h3 className="text-lg font-bold text-slate-700">ไม่พบห้องพักที่ตรงกับเงื่อนไข</h3>
                  <p className="text-slate-500">ลองปรับเปลี่ยนตัวกรองใหม่ หรือเพิ่มห้องพักเข้าสู่ระบบ</p>
                  <button
                    onClick={() => { setFloorFilter('all'); setPriceFilter('all'); setStatusFilter('all'); }}
                    className="mt-4 text-blue-600 font-medium hover:underline"
                  >
                    ล้างตัวกรองทั้งหมด
                  </button>
                </div>
              )}
            </div>
          </>
        )}

      </div>

      {/* Add Room Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
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
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all bg-slate-50 focus:bg-white"
                    placeholder="เช่น 101, 201"
                  />
                </div>

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
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">ประเภทห้องพัก</label>
                  <select
                    value={newRoomTypeId}
                    onChange={(e) => setNewRoomTypeId(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all bg-slate-50 focus:bg-white"
                  >
                    <option value="">-- ไม่ระบุ --</option>
                    {roomTypes.map(rt => (
                      <option key={rt.id} value={rt.id}>{rt.name}</option>
                    ))}
                  </select>
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
                  disabled={isAdding}
                  className="flex-1 px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition-colors shadow-md disabled:bg-blue-400 disabled:shadow-none flex justify-center items-center"
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

      {/* Contract Modal */}
      {isContractModalOpen && selectedRoomForContract && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={() => setIsContractModalOpen(false)}></div>
          <div className="relative bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden scale-100 transition-transform">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" className="text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                ทำสัญญาเช่า (ห้อง {selectedRoomForContract.room_number})
              </h3>
              <button
                onClick={() => setIsContractModalOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-200/50 hover:bg-slate-200 text-slate-500 hover:text-slate-700 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>

            <form onSubmit={submitContract} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">ผู้เช่า (Tenant)</label>
                  <select
                    required
                    value={selectedTenantId}
                    onChange={(e) => setSelectedTenantId(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all bg-slate-50 focus:bg-white disabled:bg-slate-100 disabled:text-slate-400"
                    disabled={tenants.length === 0}
                  >
                    {tenants.length === 0 ? (
                      <option value="" disabled>ไม่มีผู้เช่าที่ว่างในขณะนี้</option>
                    ) : (
                      <>
                        <option value="" disabled>เลือกผู้เช่า</option>
                        {tenants.map(t => (
                          <option key={t.user_uid || t.user_id} value={t.user_uid || t.user_id}>
                            {t.first_name} {t.last_name} ({t.email})
                          </option>
                        ))}
                      </>
                    )}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">เริ่มสัญญา</label>
                    <input
                      type="date"
                      required
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all bg-slate-50 focus:bg-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">สิ้นสุดสัญญา</label>
                    <input
                      type="date"
                      required
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all bg-slate-50 focus:bg-white text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-8 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsContractModalOpen(false)}
                  className="flex-1 px-4 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingContract}
                  className="flex-1 px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition-colors shadow-md disabled:bg-blue-400 disabled:shadow-none flex justify-center items-center"
                >
                  {isSubmittingContract ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    'ยืนยันทำสัญญา'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Room Details Modal (Contract & Invoices) */}
      {isRoomDetailsModalOpen && selectedRoomDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={() => setIsRoomDetailsModalOpen(false)}></div>
          <div className="relative bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden scale-100 transition-transform">

            {/* Header */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50/50 shrink-0">
              <h3 className="text-xl font-black text-slate-800 flex items-center gap-3 tracking-tight">
                <span className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-lg">
                  🚪
                </span>
                ข้อมูลห้องพัก {selectedRoomDetails.room_number}
              </h3>
              <div className="flex items-center gap-3">
                {contractDetails && (
                  <button
                    onClick={terminateContract}
                    className="text-xs font-bold bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 px-4 py-2 rounded-lg border border-rose-200 shadow-sm transition-all"
                  >
                    ยกเลิกสัญญาเช่าก่อนกำหนด
                  </button>
                )}
                <button
                  onClick={() => setIsRoomDetailsModalOpen(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-200/50 hover:bg-slate-200 text-slate-500 hover:text-slate-700 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-slate-50">
              {contractDetails ? (
                <div className="space-y-6">
                  {/* Tenant Details Card */}
                  <div className="bg-white rounded-2xl border border-slate-200/70 p-6 shadow-sm">
                    <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">ข้อมูลผู้เช่าและสัญญา</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                      <div>
                        <p className="text-xs text-slate-500 mb-1">ชื่อ-นามสกุล</p>
                        <p className="font-semibold text-slate-800 text-lg">{contractDetails.users?.first_name} {contractDetails.users?.last_name}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-1">เบอร์โทรศัพท์</p>
                        <p className="font-semibold text-slate-800 text-lg">{contractDetails.users?.phone_number || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-1">วันที่เริ่มสัญญา</p>
                        <p className="font-medium text-slate-700">{contractDetails.start_date ? new Date(contractDetails.start_date).toLocaleDateString('th-TH') : '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-1">วันสิ้นสุดสัญญา</p>
                        <p className="font-medium text-slate-700">{contractDetails.end_date ? new Date(contractDetails.end_date).toLocaleDateString('th-TH') : '-'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Invoice History Table */}
                  <div className="bg-white rounded-2xl border border-slate-200/70 overflow-hidden shadow-sm flex flex-col">
                    <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
                      <h4 className="text-sm font-bold text-slate-700 tracking-wide">ประวัติบิลค่าเช่า (ย้อนหลัง)</h4>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm text-slate-600">
                        <thead className="bg-white border-b border-slate-100 text-slate-500 text-xs uppercase font-bold tracking-wider">
                          <tr>
                            <th className="px-6 py-3 whitespace-nowrap">วันที่ออกบิล</th>
                            <th className="px-6 py-3 whitespace-nowrap">ยอดรวม</th>
                            <th className="px-6 py-3 whitespace-nowrap">สถานะ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {roomInvoices.length === 0 ? (
                            <tr>
                              <td colSpan={3} className="px-6 py-8 text-center text-slate-400 font-medium">ยังไม่มีประวัติการออกบิล</td>
                            </tr>
                          ) : (
                            roomInvoices.map(inv => (
                              <tr key={inv.invoices_id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-3 font-medium text-slate-700">{formatInvoiceDate(inv.month_year)}</td>
                                <td className="px-6 py-3 font-bold text-slate-800">{Number(inv.total_amount).toLocaleString()} ฿</td>
                                <td className="px-6 py-3">
                                  {inv.status === 'paid' ? (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-700">ชำระแล้ว</span>
                                  ) : inv.status === 'pending' ? (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-blue-100 text-blue-700">รอตรวจสอบ</span>
                                  ) : (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-rose-100 text-rose-700">รอชำระ</span>
                                  )}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-20 text-center text-slate-500 flex flex-col items-center">
                  <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
                  กำลังโหลดข้อมูล...
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Maintenance Reason Modal */}
      {isMaintenanceModalOpen && selectedRoomForMaintenance && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
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
                  <label className="block text-sm font-bold text-slate-700 mb-2">เหตุผลความจำเป็นในการปิดซ่อมแซม <span className="text-red-500">*</span></label>
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
                  className="flex-1 px-4 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold transition-colors shadow-md disabled:bg-red-400 disabled:shadow-none flex justify-center items-center gap-2"
                >
                  {isSubmittingMaintenance ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                      บันทึกสถานะ
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Room Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
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
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 outline-none transition-all bg-slate-50 focus:bg-white"
                  />
                </div>

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
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">ประเภทห้องพัก</label>
                  <select
                    value={editRoomTypeId}
                    onChange={(e) => setEditRoomTypeId(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 outline-none transition-all bg-slate-50 focus:bg-white"
                  >
                    <option value="">-- ไม่ระบุ --</option>
                    {roomTypes.map(rt => (
                      <option key={rt.id} value={rt.id}>{rt.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">ราคาต่อเดือน (บาท)</label>
                  <input
                    type="number"
                    required
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 outline-none transition-all bg-slate-50 focus:bg-white"
                    min="0"
                  />
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
                  disabled={isEditing}
                  className="flex-1 px-4 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold transition-colors shadow-md disabled:bg-amber-400 flex justify-center items-center"
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
