"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/backend/lib/supabase';
import AdminLayout from '@/components/AdminLayout';
import { useAlert } from '@/contexts/AlertContext';
import { adminResetUserPassword } from '@/backend/actions/authActions';

export default function UsersManagementPage() {
  const router = useRouter();

  const [users, setUsers] = useState<any[]>([]);
  const [activeContractsMap, setActiveContractsMap] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const { showAlert, showConfirm } = useAlert();

  const [resetModal, setResetModal] = useState<{
    isOpen: boolean;
    userId: string | null;
    userEmail: string | null;
    tempPassword: string;
  }>({
    isOpen: false,
    userId: null,
    userEmail: null,
    tempPassword: ''
  });
  const [isResetting, setIsResetting] = useState(false);

  const [editModal, setEditModal] = useState<{
    isOpen: boolean;
    userUid: string | null;
    firstName: string;
    lastName: string;
    phoneNumber: string;
  }>({
    isOpen: false,
    userUid: null,
    firstName: '',
    lastName: '',
    phoneNumber: ''
  });
  const [isEditing, setIsEditing] = useState(false);

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
  }, [router]);

  const fetchData = async () => {
    try {
      setLoading(true);
      // Fetch tenants
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'tenant')
        .order('created_at', { ascending: false });
      
      if (usersError) throw usersError;

      // Fetch active contracts
      const { data: contractsData, error: contractsError } = await supabase
        .from('contracts')
        .select('tenant_id')
        .eq('is_active', true);
      
      if (contractsError) throw contractsError;

      const map: Record<string, boolean> = {};
      contractsData?.forEach(c => {
        if (c.tenant_id) map[c.tenant_id] = true;
      });

      if (usersData) setUsers(usersData);
      setActiveContractsMap(map);

    } catch (err: any) {
      console.error("Fetch Data Error:", err);
      alert('เกิดข้อผิดพลาดในการดึงข้อมูล: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const confirmDeleteUser = async (userId: string) => {
    try {
      const { error } = await supabase.from('users').delete().eq('user_uid', userId);
      if (error) throw error;
      
      showAlert('success', 'ลบบัญชีสำเร็จ', 'ลบบัญชีผู้ใช้งานสำเร็จ');
      fetchData();
    } catch (err: any) {
      alert('ลบผู้ใช้งานไม่สำเร็จ: ' + err.message);
    }
  };

  const handleDeleteUser = (userId: string) => {
    showConfirm(
      'ยืนยันการลบผู้ใช้งาน',
      'คุณแน่ใจหรือไม่ว่าต้องการลบบัญชีผู้ใช้งานนี้? ข้อมูลจะไม่สามารถกู้คืนได้',
      () => confirmDeleteUser(userId)
    );
  };

  const openEditModal = (user: any) => {
    setEditModal({
      isOpen: true,
      userUid: user.user_uid,
      firstName: user.first_name || '',
      lastName: user.last_name || '',
      phoneNumber: user.phone_number || ''
    });
  };

  const confirmEditUser = async () => {
    if (!editModal.userUid) return;
    try {
      setIsEditing(true);
      const { error } = await supabase
        .from('users')
        .update({
          first_name: editModal.firstName,
          last_name: editModal.lastName,
          phone_number: editModal.phoneNumber
        })
        .eq('user_uid', editModal.userUid);
        
      if (error) throw error;
      
      setEditModal(prev => ({ ...prev, isOpen: false }));
      showAlert('success', 'อัปเดตข้อมูลผู้ใช้งานสำเร็จ', 'บันทึกข้อมูลผู้เช่าเรียบร้อยแล้ว');
      fetchData();
    } catch (err: any) {
      alert('อัปเดตข้อมูลไม่สำเร็จ: ' + err.message);
    } finally {
      setIsEditing(false);
    }
  };

  const handleEditUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    showConfirm('ยืนยันการแก้ไขข้อมูล', 'คุณต้องการบันทึกการแก้ไขข้อมูลผู้ใช้งานใช่หรือไม่?', confirmEditUser);
  };

  const openResetModal = (user: any) => {
    setResetModal({
      isOpen: true,
      userId: user.user_uid || user.user_id,
      userEmail: user.email,
      tempPassword: ''
    });
  };

  const handleResetByEmail = async () => {
    if (!resetModal.userEmail) return;
    try {
      setIsResetting(true);
      const { error } = await supabase.auth.resetPasswordForEmail(resetModal.userEmail);
      if (error) throw error;
      setResetModal(prev => ({ ...prev, isOpen: false }));
      showAlert('success', 'ส่งลิงก์สำเร็จ', 'ส่งลิงก์รีเซ็ตรหัสผ่านไปที่อีเมลผู้ใช้งานแล้ว');
    } catch (err: any) {
      alert('ส่งลิงก์ไม่สำเร็จ: ' + err.message);
    } finally {
      setIsResetting(false);
    }
  };

  const handleResetByTempPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetModal.userId || !resetModal.tempPassword) return;
    try {
      setIsResetting(true);
      const res = await adminResetUserPassword(resetModal.userId, resetModal.tempPassword);
      if (!res.success) throw new Error(res.error);
      
      setResetModal(prev => ({ ...prev, isOpen: false }));
      showAlert('success', 'ตั้งรหัสผ่านสำเร็จ', 'ตั้งรหัสผ่านชั่วคราวและบังคับเปลี่ยนเรียบร้อยแล้ว');
    } catch (err: any) {
      alert('เปลี่ยนรหัสผ่านไม่สำเร็จ: ' + err.message);
    } finally {
      setIsResetting(false);
    }
  };

  const filteredUsers = users.filter(user => 
    `${user.first_name} ${user.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.phone_number?.includes(searchQuery)
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-slate-800 tracking-tight">รายชื่อผู้ใช้งานระบบ (Tenants)</h2>
            <p className="text-sm text-slate-500 mt-1">จัดการข้อมูลและบัญชีของผู้เช่าในหอพัก</p>
          </div>
          <div className="relative w-full md:w-72">
            <input 
              type="text" 
              placeholder="ค้นหาชื่อ, อีเมล หรือเบอร์โทร..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm"
            />
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          </div>
        </div>

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center">
            <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
            <p className="text-slate-500 font-medium">กำลังโหลดข้อมูลผู้ใช้งาน...</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 text-xs uppercase font-bold tracking-wider">
                  <tr>
                    <th className="px-6 py-4 whitespace-nowrap">ชื่อ-นามสกุล</th>
                    <th className="px-6 py-4 whitespace-nowrap">การติดต่อ</th>
                    <th className="px-6 py-4 whitespace-nowrap">สถานะปัจจุบัน</th>
                    <th className="px-6 py-4 whitespace-nowrap text-center">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-slate-400 font-medium">ไม่พบข้อมูลผู้ใช้งาน</td>
                    </tr>
                  ) : (
                    filteredUsers.map(user => {
                      // Check if user has an active contract using both possible ID fields
                      const hasActiveContract = activeContractsMap[user.user_id] || activeContractsMap[user.user_uid];

                      return (
                        <tr key={user.user_id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                                {user.first_name ? user.first_name.charAt(0) : 'U'}
                              </div>
                              <div>
                                <p className="font-bold text-slate-800">{user.first_name} {user.last_name}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <p className="text-slate-700">{user.email || '-'}</p>
                            <p className="text-slate-500 text-xs mt-0.5">{user.phone_number || '-'}</p>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {hasActiveContract ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                มีสัญญาเช่า
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                                ไม่มีสัญญาเช่า
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => openEditModal(user)}
                                className="p-2 rounded-lg transition-colors text-amber-500 hover:bg-amber-50 hover:text-amber-700 inline-flex items-center justify-center"
                                title="แก้ไขข้อมูล"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                              </button>
                              <button
                                onClick={() => openResetModal(user)}
                                className="p-2 rounded-lg transition-colors text-blue-500 hover:bg-blue-50 hover:text-blue-700 inline-flex items-center justify-center"
                                title="รีเซ็ตรหัสผ่าน"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                              </button>
                              <button
                              disabled={hasActiveContract}
                              onClick={() => handleDeleteUser(user.user_uid)}
                              className={`p-2 rounded-lg transition-colors inline-flex items-center justify-center ${hasActiveContract ? 'text-slate-300 cursor-not-allowed bg-slate-50' : 'text-rose-500 hover:bg-rose-50 hover:text-rose-700'}`}
                              title={hasActiveContract ? 'ไม่สามารถลบได้ (มีสัญญาเช่า)' : 'ลบบัญชี'}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                            </button>
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
        )}
      </div>

      {/* Reset Password Modal */}
      {resetModal.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                รีเซ็ตรหัสผ่าน
              </h3>
              <button 
                onClick={() => !isResetting && setResetModal(prev => ({ ...prev, isOpen: false }))}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            <div className="p-6 space-y-6">
              
              {/* Option A: Email Link */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <h4 className="font-bold text-slate-700 mb-1">ตัวเลือก A: ส่งลิงก์รีเซ็ตเข้าอีเมล</h4>
                <p className="text-sm text-slate-500 mb-3">อีเมล: {resetModal.userEmail || '-'}</p>
                <button
                  type="button"
                  onClick={handleResetByEmail}
                  disabled={isResetting || !resetModal.userEmail}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-lg transition-colors disabled:opacity-50"
                >
                  ส่งลิงก์รีเซ็ตรหัสผ่าน
                </button>
              </div>

              <div className="flex items-center gap-3">
                <div className="h-px bg-slate-200 flex-1"></div>
                <span className="text-xs font-bold text-slate-400 uppercase">หรือ</span>
                <div className="h-px bg-slate-200 flex-1"></div>
              </div>

              {/* Option B: Temp Password */}
              <form onSubmit={handleResetByTempPassword} className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                <h4 className="font-bold text-blue-800 mb-1">ตัวเลือก B: ตั้งรหัสชั่วคราว</h4>
                <p className="text-sm text-blue-600/80 mb-3">ระบบจะบังคับให้ผู้ใช้เปลี่ยนรหัสใหม่ตอนล็อกอินครั้งถัดไป</p>
                <div className="space-y-3">
                  <input
                    type="text"
                    required
                    placeholder="รหัสผ่านชั่วคราว..."
                    value={resetModal.tempPassword}
                    onChange={(e) => setResetModal(prev => ({ ...prev, tempPassword: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-blue-200 focus:border-blue-500 outline-none text-sm"
                  />
                  <button
                    type="submit"
                    disabled={isResetting || !resetModal.tempPassword}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors disabled:opacity-50"
                  >
                    บันทึกรหัสผ่านชั่วคราว
                  </button>
                </div>
              </form>

            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editModal.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                แก้ไขข้อมูลผู้ใช้งาน
              </h3>
              <button 
                onClick={() => !isEditing && setEditModal(prev => ({ ...prev, isOpen: false }))}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            <form onSubmit={handleEditUserSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">ชื่อจริง</label>
                <input
                  type="text"
                  required
                  value={editModal.firstName}
                  onChange={(e) => setEditModal(prev => ({ ...prev, firstName: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 outline-none transition-all text-sm"
                  placeholder="ชื่อจริง"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">นามสกุล</label>
                <input
                  type="text"
                  required
                  value={editModal.lastName}
                  onChange={(e) => setEditModal(prev => ({ ...prev, lastName: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 outline-none transition-all text-sm"
                  placeholder="นามสกุล"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">เบอร์โทรศัพท์</label>
                <input
                  type="tel"
                  required
                  value={editModal.phoneNumber}
                  onChange={(e) => setEditModal(prev => ({ ...prev, phoneNumber: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 outline-none transition-all text-sm"
                  placeholder="เบอร์โทรศัพท์"
                />
              </div>
              <button
                type="submit"
                disabled={isEditing}
                className="w-full py-3 mt-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl transition-colors disabled:opacity-50"
              >
                {isEditing ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
              </button>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
