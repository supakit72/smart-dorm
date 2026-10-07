'use client'

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/backend/lib/supabase';

const allMenus = [
  { label: 'ภาพรวม', href: '/', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="14" width="7" height="7" rx="1"></rect><rect x="3" y="14" width="7" height="7" rx="1"></rect></svg>, category: 'ทั่วไป', isBottomNav: true, shortLabel: 'ภาพรวม' },
  { label: 'รายงานสรุป', href: '/reports', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>, category: 'ทั่วไป', isBottomNav: false },

  { label: 'จัดการห้องพัก', href: '/rooms', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>, category: 'การจัดการ', isBottomNav: true, shortLabel: 'ห้องพัก' },
  { label: 'ประเภทห้องพัก', href: '/room-types', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>, category: 'การจัดการ', isBottomNav: false },
  { label: 'คำขอจองห้องพัก', href: '/booking-requests', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>, category: 'การจัดการ', isBottomNav: false },
  { label: 'จัดการบิลค่าเช่า', href: '/invoices', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"></rect><path d="M7 15h0M2 9.5h20"></path></svg>, category: 'การจัดการ', isBottomNav: true, shortLabel: 'บิลค่าเช่า' },
  { label: 'รายการบิลเพิ่มเติม', href: '/invoice-presets', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>, category: 'การจัดการ', isBottomNav: false },
  { label: 'รายการแจ้งซ่อม', href: '/maintenance', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>, category: 'การจัดการ', isBottomNav: true, shortLabel: 'แจ้งซ่อม' },
  { label: 'จัดการผู้ใช้งาน', href: '/users', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>, category: 'การจัดการ', isBottomNav: false },

  { label: 'ตั้งค่าระบบ', href: '/settings', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>, category: 'ระบบ', isBottomNav: false },
];

const categories = ['ทั่วไป', 'การจัดการ', 'ระบบ'];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const checkIsActive = (href: string) => {
    if (href === '/invoices' && pathname.startsWith('/invoices/editor')) return true;
    return pathname === href;
  };

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      router.push('/login');
    } catch (err: any) {
      console.error("Logout Error:", err);
      alert("ไม่สามารถออกจากระบบได้: " + err.message);
    }
  };

  const getPageTitle = () => {
    const activeMenu = allMenus.find(m => checkIsActive(m.href));
    if (activeMenu) return activeMenu.label;
    if (pathname === '/profile') return 'โปรไฟล์ส่วนตัว';
    return 'Smart Dorm';
  };

  const bottomNavItems = allMenus.filter(m => m.isBottomNav);

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans text-slate-900 overflow-hidden">

      {/* 1. Desktop Sidebar */}
      <aside className="hidden md:flex w-64 bg-slate-900 text-slate-300 flex-col shrink-0 min-h-screen sticky top-0 shadow-xl z-20">
        <div className="h-16 flex items-center justify-center px-6 border-b border-slate-800 bg-slate-950/30">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold shadow-lg shadow-blue-600/20">S</div>
            <h1 className="text-xl font-bold text-white tracking-tight">Smart Dorm</h1>
          </div>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-6 overflow-y-auto hide-scrollbar">
          {categories.map((cat) => {
            const catMenus = allMenus.filter(m => m.category === cat);
            if (catMenus.length === 0) return null;
            return (
              <div key={cat}>
                <p className="px-2 mb-2 text-xs font-bold text-slate-500 uppercase tracking-wider">{cat}</p>
                <div className="space-y-1">
                  {catMenus.map((menu) => {
                    const isActive = checkIsActive(menu.href);
                    return (
                      <Link
                        key={menu.href}
                        href={menu.href}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${isActive ? 'bg-blue-600 text-white shadow-md shadow-blue-900/50' : 'hover:bg-slate-800 hover:text-white'}`}
                      >
                        {menu.icon}
                        <span className="font-medium">{menu.label}</span>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </nav>

        <div className="p-4 border-t border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-3 mb-4 px-2">
            <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 font-bold border border-slate-700 shrink-0">A</div>
            <div>
              <p className="text-sm font-bold text-white">Admin</p>
              <p className="text-xs text-slate-500">ผู้ดูแลระบบ</p>
            </div>
          </div>
          <Link href="/profile" className={`flex items-center gap-3 px-4 py-2.5 w-full rounded-xl transition-colors mb-1 ${pathname === '/profile' ? 'bg-blue-600/10 text-blue-500' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
            <span className="font-medium">โปรไฟล์ส่วนตัว</span>
          </Link>
          <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-2.5 w-full rounded-xl text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 transition-colors group">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:-translate-x-1 transition-transform"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
            <span className="font-medium">ออกจากระบบ</span>
          </button>
        </div>
      </aside>

      {/* 2. Main Wrapper */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">

        {/* Mobile Top Header */}
        <header className="md:hidden flex items-center justify-between px-4 h-16 bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold shadow-sm">S</div>
            <span className="font-bold text-slate-800 text-lg tracking-tight">Smart Dorm</span>
          </div>
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
          </button>
        </header>

        {/* Desktop Header */}
        <header className="hidden md:flex h-16 bg-white/80 backdrop-blur-md border-b border-slate-200/60 items-center justify-between px-8 sticky top-0 z-10 shadow-sm shrink-0">
          <h2 className="text-lg font-bold text-slate-800 tracking-tight truncate mr-4">
            {getPageTitle()}
          </h2>
          <div className="text-sm font-medium text-slate-500 whitespace-nowrap">
            {new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </header>

        {/* เนื้อหาหน้าเว็บ */}
        <main className="flex-1 p-4 md:p-8 pb-24 md:pb-8 w-full">
          <div className="max-w-7xl mx-auto h-full">
            {children}
          </div>
        </main>
      </div>

      {/* 3. Mobile Bottom Navigation Bar */}
      {!pathname.startsWith('/invoices/editor') && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 py-2 flex justify-around items-center z-50 shadow-[0_-4px_15px_-3px_rgba(0,0,0,0.05)] pb-safe">
          {bottomNavItems.map((item) => {
            const isActive = checkIsActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-1.5 px-3 py-1 rounded-xl min-w-[64px] transition-all duration-200 ${isActive ? 'text-blue-600' : 'text-slate-500 hover:text-slate-800'}`}
              >
                <div className={`transition-transform duration-200 ${isActive ? '-translate-y-1' : ''}`}>
                  {React.cloneElement(item.icon, { width: 22, height: 22, className: isActive ? 'drop-shadow-sm' : '' })}
                </div>
                <span className={`text-[10px] font-bold ${isActive ? 'opacity-100' : 'opacity-80'}`}>{item.shortLabel || item.label}</span>
                {isActive && <div className="absolute bottom-1 w-1 h-1 rounded-full bg-blue-600"></div>}
              </Link>
            )
          })}
        </nav>
      )}

      {/* 4. Mobile Drawer (สำหรับเมนูย่อยที่เหลือ) */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex justify-end">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={() => setMobileMenuOpen(false)} />
          <div className="relative w-[280px] bg-slate-900 text-white h-full shadow-2xl flex flex-col transform transition-transform animate-slide-in-right">

            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/30">
              <span className="font-bold text-lg">เมนูเพิ่มเติม</span>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
              {categories.map((cat) => {
                const catMenus = allMenus.filter(m => m.category === cat && !m.isBottomNav);
                if (catMenus.length === 0) return null;
                return (
                  <div key={cat}>
                    <p className="px-2 mb-2 text-xs font-bold text-slate-500 uppercase tracking-wider">{cat}</p>
                    <div className="space-y-1">
                      {catMenus.map((menu) => {
                        const isActive = checkIsActive(menu.href);
                        return (
                          <Link
                            key={menu.href}
                            href={menu.href}
                            onClick={() => setMobileMenuOpen(false)}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${isActive ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}
                          >
                            {menu.icon}
                            <span className="font-medium text-sm">{menu.label}</span>
                          </Link>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </nav>

            <div className="p-5 border-t border-slate-800 bg-slate-900/80">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 font-bold border border-slate-700 shrink-0">A</div>
                <div>
                  <p className="text-sm font-bold text-white">Admin</p>
                  <p className="text-xs text-slate-500">ผู้ดูแลระบบ</p>
                </div>
              </div>
              <Link href="/profile" onClick={() => setMobileMenuOpen(false)} className={`flex items-center gap-3 px-4 py-3 w-full rounded-xl transition-colors mb-2 ${pathname === '/profile' ? 'bg-blue-600/20 text-blue-400' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                <span className="font-medium text-sm">โปรไฟล์ส่วนตัว</span>
              </Link>
              <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 transition-colors">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                <span className="font-medium text-sm">ออกจากระบบ</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Required style for drawer animation */}
      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes slide-in-right {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        /* Handle safe area on iPhone notches for bottom nav */
        .pb-safe { padding-bottom: max(0.5rem, env(safe-area-inset-bottom)); }
      `}} />
    </div>
  );
}
