"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function RegisterPage() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    // เช็ครหัสผ่าน
    if (password !== confirmPassword) {
      setErrorMsg('รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน กรุณาตรวจสอบอีกครั้ง');
      setLoading(false);
      return;
    }

    try {
      // 1. สร้างบัญชีผู้ใช้งานใน Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) {
        throw authError;
      }

      if (authData.user) {
        // 2. บันทึกข้อมูลลงในตาราง users (public schema)
        const { error: insertError } = await supabase
          .from('users')
          .insert([
            {
              user_uid: authData.user.id,
              email: email,
              first_name: firstName,
              last_name: lastName,
              phone_number: phone,
              role: 'tenant',
            }
          ]);

        if (insertError) {
          console.error("Insert User Error:", insertError);
          throw new Error('บันทึกข้อมูลผู้ใช้งานไม่สำเร็จ โปรดลองใหม่อีกครั้ง');
        }

        setSuccessMsg('สมัครสมาชิกสำเร็จ! ระบบกำลังพาคุณไปยังหน้าเข้าสู่ระบบ...');
        
        // พาไปหน้า Login หลังจากสมัครเสร็จสิ้น 2 วินาที
        setTimeout(() => {
          router.push('/login');
        }, 2000);
      }
    } catch (err: any) {
      console.error("Register Error:", err);
      if (err.message.includes('already registered')) {
        setErrorMsg('อีเมลนี้มีผู้ใช้งานในระบบแล้ว');
      } else {
        setErrorMsg(err.message || 'เกิดข้อผิดพลาดในการสมัครสมาชิก');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4 font-sans text-slate-900">
      <div className="max-w-xl w-full bg-white rounded-[2rem] shadow-2xl shadow-slate-200/50 overflow-hidden border border-slate-100 my-8 relative">
        
        <button
          onClick={() => router.back()}
          className="absolute top-6 left-6 md:top-8 md:left-8 flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors font-medium text-sm bg-slate-50 hover:bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm"
          type="button"
          title="ย้อนกลับ"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
          <span className="hidden sm:inline">ย้อนกลับ</span>
        </button>

        <div className="p-8 sm:p-10 pt-16 sm:pt-20">
          <div className="text-center mb-8">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">สมัครสมาชิกผู้เช่า</h1>
            <p className="text-sm font-medium text-slate-500 mt-2">กรอกข้อมูลเพื่อลงทะเบียนเข้าใช้งานระบบ Smart Dorm</p>
          </div>
          
          {errorMsg && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-sm font-medium flex items-start gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" className="shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
             <div className="mb-6 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-emerald-600 text-sm font-medium flex items-start gap-3">
               <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" className="shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
               <span>{successMsg}</span>
             </div>
          )}

          <form onSubmit={handleRegister} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2" htmlFor="firstName">ชื่อ</label>
                <input
                  id="firstName"
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all bg-slate-50 focus:bg-white font-medium text-slate-700 placeholder:text-slate-400 placeholder:font-normal"
                  placeholder="ชื่อจริง"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2" htmlFor="lastName">นามสกุล</label>
                <input
                  id="lastName"
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all bg-slate-50 focus:bg-white font-medium text-slate-700 placeholder:text-slate-400 placeholder:font-normal"
                  placeholder="นามสกุล"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2" htmlFor="phone">เบอร์โทรศัพท์</label>
              <input
                id="phone"
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all bg-slate-50 focus:bg-white font-medium text-slate-700 placeholder:text-slate-400 placeholder:font-normal"
                placeholder="08X-XXX-XXXX"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2" htmlFor="email">อีเมล</label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all bg-slate-50 focus:bg-white font-medium text-slate-700 placeholder:text-slate-400 placeholder:font-normal"
                placeholder="your@email.com"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2" htmlFor="password">รหัสผ่าน</label>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all bg-slate-50 focus:bg-white font-medium text-slate-700 placeholder:text-slate-400 placeholder:font-normal"
                  placeholder="อย่างน้อย 6 ตัวอักษร"
                  minLength={6}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2" htmlFor="confirmPassword">ยืนยันรหัสผ่าน</label>
                <input
                  id="confirmPassword"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all bg-slate-50 focus:bg-white font-medium text-slate-700 placeholder:text-slate-400 placeholder:font-normal"
                  placeholder="กรอกรหัสผ่านอีกครั้ง"
                  minLength={6}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 px-4 rounded-2xl transition-all shadow-lg shadow-slate-900/20 active:scale-[0.98] disabled:bg-slate-300 disabled:shadow-none disabled:text-slate-500 disabled:cursor-not-allowed flex items-center justify-center mt-6"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-slate-500 border-t-white rounded-full animate-spin mr-2"></div>
                  กำลังลงทะเบียน...
                </>
              ) : (
                'สมัครสมาชิก'
              )}
            </button>
            
            <div className="text-center mt-6">
              <span className="text-slate-500 text-sm font-medium">มีบัญชีอยู่แล้ว? </span>
              <Link href="/login" className="text-blue-600 font-bold text-sm hover:underline">
                เข้าสู่ระบบที่นี่
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
