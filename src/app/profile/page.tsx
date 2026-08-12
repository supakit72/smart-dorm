"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/backend/lib/supabase';
import AdminLayout from '@/components/AdminLayout';
import { useAlert } from '@/contexts/AlertContext';

export default function ProfilePage() {
  const router = useRouter();
  const { showAlert, showConfirm } = useAlert();

  const [loading, setLoading] = useState(true);
  const [authId, setAuthId] = useState<string | null>(null);

  // Profile Form State
  const [profileData, setProfileData] = useState({
    first_name: '',
    last_name: '',
    phone_number: ''
  });
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Password Form State
  const [passwordData, setPasswordData] = useState({
    new_password: '',
    confirm_password: ''
  });
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.push('/login');
          return;
        }

        const currentAuthId = session.user.id;
        setAuthId(currentAuthId);

        const { data: userData, error } = await supabase
          .from('users')
          .select('first_name, last_name, phone_number, role')
          .eq('user_uid', currentAuthId)
          .single();

        if (error) throw error;
        
        if (userData?.role !== 'admin') {
          router.push('/login');
          return;
        }

        setProfileData({
          first_name: userData.first_name || '',
          last_name: userData.last_name || '',
          phone_number: userData.phone_number || ''
        });
      } catch (error) {
        console.error("Error loading profile:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserProfile();
  }, [router]);

  const confirmSaveProfile = async () => {
    if (!authId) return;
    try {
      setIsSavingProfile(true);
      const { error } = await supabase
        .from('users')
        .update({
          first_name: profileData.first_name,
          last_name: profileData.last_name,
          phone_number: profileData.phone_number
        })
        .eq('user_uid', authId);

      if (error) throw error;

      showAlert('success', 'สำเร็จ', 'อัปเดตข้อมูลส่วนตัวสำเร็จ');
    } catch (err: any) {
      alert("อัปเดตข้อมูลไม่สำเร็จ: " + err.message);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    showConfirm('ยืนยันการบันทึก', 'คุณต้องการบันทึกการเปลี่ยนแปลงข้อมูลส่วนตัวใช่หรือไม่?', confirmSaveProfile);
  };

  const confirmSavePassword = async () => {
    try {
      setIsSavingPassword(true);
      const { error } = await supabase.auth.updateUser({
        password: passwordData.new_password
      });

      if (error) throw error;

      setPasswordData({ new_password: '', confirm_password: '' });
      showAlert('success', 'สำเร็จ', 'เปลี่ยนรหัสผ่านสำเร็จ');
    } catch (err: any) {
      alert("เปลี่ยนรหัสผ่านไม่สำเร็จ: " + err.message);
    } finally {
      setIsSavingPassword(false);
    }
  };

  const handleSavePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.new_password !== passwordData.confirm_password) {
      alert('รหัสผ่านไม่ตรงกัน');
      return;
    }
    if (passwordData.new_password.length < 6) {
      alert('รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร');
      return;
    }
    showConfirm('ยืนยันการเปลี่ยนรหัสผ่าน', 'คุณแน่ใจหรือไม่ว่าต้องการเปลี่ยนรหัสผ่านใหม่?', confirmSavePassword);
  };

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-black text-slate-800">โปรไฟล์ส่วนตัว</h1>
          <p className="text-slate-500 mt-1">จัดการข้อมูลส่วนตัวและรหัสผ่านของคุณ</p>
        </div>

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center">
            <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
            <p className="text-slate-500 font-medium">กำลังโหลดข้อมูลโปรไฟล์...</p>
          </div>
        ) : (
          <div className="space-y-8 pb-10">
            {/* 1. Profile Information */}
            <form onSubmit={handleSaveProfile} className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200/60 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 w-2 h-full bg-blue-500"></div>
              <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                <span className="text-xl">👤</span> ข้อมูลส่วนตัว
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">ชื่อจริง</label>
                  <input
                    type="text"
                    required
                    value={profileData.first_name}
                    onChange={(e) => setProfileData({ ...profileData, first_name: e.target.value })}
                    placeholder="ชื่อจริง"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all bg-slate-50 focus:bg-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">นามสกุล</label>
                  <input
                    type="text"
                    required
                    value={profileData.last_name}
                    onChange={(e) => setProfileData({ ...profileData, last_name: e.target.value })}
                    placeholder="นามสกุล"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all bg-slate-50 focus:bg-white text-sm"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-slate-700 mb-2">เบอร์โทรศัพท์</label>
                  <input
                    type="tel"
                    required
                    value={profileData.phone_number}
                    onChange={(e) => setProfileData({ ...profileData, phone_number: e.target.value })}
                    placeholder="081-xxx-xxxx"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all bg-slate-50 focus:bg-white text-sm"
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end">
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors disabled:opacity-50"
                >
                  {isSavingProfile ? 'กำลังบันทึก...' : 'บันทึกข้อมูลส่วนตัว'}
                </button>
              </div>
            </form>

            {/* 2. Change Password */}
            <form onSubmit={handleSavePassword} className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200/60 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 w-2 h-full bg-slate-800"></div>
              <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                <span className="text-xl">🔐</span> เปลี่ยนรหัสผ่าน
              </h2>
              
              <div className="grid grid-cols-1 gap-6 max-w-md">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">รหัสผ่านใหม่</label>
                  <input
                    type="password"
                    required
                    value={passwordData.new_password}
                    onChange={(e) => setPasswordData({ ...passwordData, new_password: e.target.value })}
                    placeholder="รหัสผ่านอย่างน้อย 6 ตัวอักษร"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-slate-800 focus:ring-4 focus:ring-slate-800/10 outline-none transition-all bg-slate-50 focus:bg-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">ยืนยันรหัสผ่านใหม่</label>
                  <input
                    type="password"
                    required
                    value={passwordData.confirm_password}
                    onChange={(e) => setPasswordData({ ...passwordData, confirm_password: e.target.value })}
                    placeholder="กรอกรหัสผ่านอีกครั้ง"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-slate-800 focus:ring-4 focus:ring-slate-800/10 outline-none transition-all bg-slate-50 focus:bg-white text-sm"
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-start">
                <button
                  type="submit"
                  disabled={isSavingPassword || !passwordData.new_password || !passwordData.confirm_password}
                  className="px-6 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl transition-colors disabled:opacity-50"
                >
                  {isSavingPassword ? 'กำลังเปลี่ยนรหัส...' : 'เปลี่ยนรหัสผ่าน'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
