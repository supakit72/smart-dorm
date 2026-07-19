"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAlert } from '@/contexts/AlertContext';

export default function ForceChangePasswordPage() {
  const router = useRouter();
  const { showAlert } = useAlert();
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
      setUserId(session.user.id);
    };
    checkUser();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setErrorMsg('รหัสผ่านไม่ตรงกัน');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      // 1. Update Auth password
      const { error: authError } = await supabase.auth.updateUser({ password });
      if (authError) throw authError;

      // 2. Update users table flag
      if (userId) {
        const { error: dbError } = await supabase
          .from('users')
          .update({ force_password_change: false })
          .eq('user_uid', userId);
        
        if (dbError) throw dbError;
      }

      showAlert('success', 'เปลี่ยนรหัสผ่านสำเร็จ', 'รหัสผ่านของคุณถูกเปลี่ยนเรียบร้อยแล้ว');
      
      // Redirect based on role
      const { data: userData } = await supabase.from('users').select('role').eq('user_uid', userId).single();
      if (userData?.role === 'admin') {
        router.push('/');
      } else {
        router.push('/tenant');
      }

    } catch (err: any) {
      console.error('Change Password Error:', err);
      setErrorMsg(err.message || 'ไม่สามารถเปลี่ยนรหัสผ่านได้');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-100 max-w-md w-full">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
          </div>
          <h2 className="text-2xl font-black text-slate-800">บังคับเปลี่ยนรหัสผ่าน</h2>
          <p className="text-slate-500 mt-2 text-sm">ผู้ดูแลระบบได้ตั้งค่าให้คุณเปลี่ยนรหัสผ่านใหม่ เพื่อความปลอดภัยในการเข้าใช้งาน</p>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm font-medium rounded-xl border border-red-100 text-center">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">รหัสผ่านใหม่</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 outline-none transition-colors"
              placeholder="รหัสผ่านอย่างน้อย 6 ตัวอักษร"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">ยืนยันรหัสผ่านใหม่</label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 outline-none transition-colors"
              placeholder="กรอกรหัสผ่านอีกครั้ง"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !password || !confirmPassword}
            className="w-full py-3 mt-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors disabled:opacity-50"
          >
            {loading ? 'กำลังเปลี่ยนรหัสผ่าน...' : 'ยืนยันการเปลี่ยนรหัสผ่าน'}
          </button>
        </form>
      </div>
    </div>
  );
}
