"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/backend/lib/supabase';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

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

  const handleLinkClick = () => {
    setIsOpen(false);
  };

  return (
    <div className="flex h-screen bg-slate-50/50 font-sans text-slate-900 overflow-hidden">
      
      {/* Mobile Overlay Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 md:hidden transition-opacity" 
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`fixed inset-y-0 left-0 z-50 ${isCollapsed ? 'w-20' : 'w-64'} bg-slate-900 text-slate-300 flex flex-col shrink-0 shadow-2xl md:shadow-xl md:relative transform transition-all duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}
      >
        <div className={`h-16 flex items-center ${isCollapsed ? 'justify-center' : 'justify-between px-6'} border-b border-slate-800 bg-slate-950/30 relative`}>
          <div className="flex items-center">
            <div className={`w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold shadow-lg shadow-blue-600/20 ${isCollapsed ? '' : 'mr-3'}`}>S</div>
            {!isCollapsed && <h1 className="text-xl font-bold text-white tracking-tight">Smart Dorm</h1>}
          </div>
          {/* Close Button (Mobile Only) */}
          <button 
            onClick={() => setIsOpen(false)}
            className="md:hidden text-slate-400 hover:text-white transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
          {/* Collapse Toggle (Desktop) */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-slate-800 rounded-full items-center justify-center text-slate-300 hover:text-white border border-slate-700 shadow-sm z-50 transition-colors"
          >
            {isCollapsed ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
            )}
          </button>
        </div>
        
        <div className={`py-4 pb-2 ${isCollapsed ? 'px-0 text-center' : 'px-6'}`}>
          <p className={`text-xs font-bold text-slate-500 uppercase tracking-wider ${isCollapsed ? 'text-[10px]' : ''}`}>
            {isCollapsed ? 'ทั่วไป' : 'ทั่วไป'}
          </p>
        </div>

        <nav className="flex-1 px-4 space-y-1 overflow-y-auto pb-6 hide-scrollbar">
          <Link href="/" onClick={handleLinkClick} className={`flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-4'} py-3 rounded-xl transition-all ${pathname === '/' ? 'bg-blue-600 text-white shadow-md shadow-blue-900/50' : 'hover:bg-slate-800 hover:text-white'}`} title="ภาพรวม">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="14" width="7" height="7" rx="1"></rect><rect x="3" y="14" width="7" height="7" rx="1"></rect></svg>
            {!isCollapsed && <span className="font-medium truncate">ภาพรวม</span>}
          </Link>
          <Link href="/reports" onClick={handleLinkClick} className={`flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-4'} py-3 rounded-xl transition-all ${pathname === '/reports' ? 'bg-blue-600 text-white shadow-md shadow-blue-900/50' : 'hover:bg-slate-800 hover:text-white'}`} title="รายงานสรุป">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
            {!isCollapsed && <span className="font-medium truncate">รายงานสรุป</span>}
          </Link>

          <div className={`pt-6 pb-2 ${isCollapsed ? 'px-0 text-center' : 'px-2'}`}>
            <p className={`text-xs font-bold text-slate-500 uppercase tracking-wider ${isCollapsed ? 'text-[10px]' : ''}`}>
              {isCollapsed ? 'จัดการ' : 'การจัดการ'}
            </p>
          </div>

          <Link href="/rooms" onClick={handleLinkClick} className={`flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-4'} py-3 rounded-xl transition-all ${pathname === '/rooms' ? 'bg-blue-600 text-white shadow-md shadow-blue-900/50' : 'hover:bg-slate-800 hover:text-white'}`} title="จัดการห้องพัก">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
            {!isCollapsed && <span className="font-medium truncate">จัดการห้องพัก</span>}
          </Link>
          <Link href="/room-types" onClick={handleLinkClick} className={`flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-4'} py-3 rounded-xl transition-all ${pathname === '/room-types' ? 'bg-blue-600 text-white shadow-md shadow-blue-900/50' : 'hover:bg-slate-800 hover:text-white'}`} title="ประเภทห้องพัก">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
            {!isCollapsed && <span className="font-medium truncate">ประเภทห้องพัก</span>}
          </Link>
          <Link href="/booking-requests" onClick={handleLinkClick} className={`flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-4'} py-3 rounded-xl transition-all ${pathname === '/booking-requests' ? 'bg-blue-600 text-white shadow-md shadow-blue-900/50' : 'hover:bg-slate-800 hover:text-white'}`} title="คำขอจองห้องพัก">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
            {!isCollapsed && <span className="font-medium truncate">คำขอจองห้องพัก</span>}
          </Link>
          <Link href="/invoices" onClick={handleLinkClick} className={`flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-4'} py-3 rounded-xl transition-all ${pathname === '/invoices' || pathname.startsWith('/invoices/editor') ? 'bg-blue-600 text-white shadow-md shadow-blue-900/50' : 'hover:bg-slate-800 hover:text-white'}`} title="จัดการบิลค่าเช่า">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"></rect><path d="M7 15h0M2 9.5h20"></path></svg>
            {!isCollapsed && <span className="font-medium truncate">จัดการบิลค่าเช่า</span>}
          </Link>
          <Link href="/invoice-presets" onClick={handleLinkClick} className={`flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-4'} py-3 rounded-xl transition-all ${pathname === '/invoice-presets' ? 'bg-blue-600 text-white shadow-md shadow-blue-900/50' : 'hover:bg-slate-800 hover:text-white'}`} title="รายการบิลเพิ่มเติม">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
            {!isCollapsed && <span className="font-medium truncate">รายการบิลเพิ่มเติม</span>}
          </Link>
          <Link href="/users" onClick={handleLinkClick} className={`flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-4'} py-3 rounded-xl transition-all ${pathname === '/users' ? 'bg-blue-600 text-white shadow-md shadow-blue-900/50' : 'hover:bg-slate-800 hover:text-white'}`} title="จัดการผู้ใช้งาน">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
            {!isCollapsed && <span className="font-medium truncate">จัดการผู้ใช้งาน</span>}
          </Link>

          <div className={`pt-6 pb-2 ${isCollapsed ? 'px-0 text-center' : 'px-2'}`}>
            <p className={`text-xs font-bold text-slate-500 uppercase tracking-wider ${isCollapsed ? 'text-[10px]' : ''}`}>
              {isCollapsed ? 'ระบบ' : 'ระบบ'}
            </p>
          </div>

          <Link href="/settings" onClick={handleLinkClick} className={`flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-4'} py-3 rounded-xl transition-all ${pathname === '/settings' ? 'bg-blue-600 text-white shadow-md shadow-blue-900/50' : 'hover:bg-slate-800 hover:text-white'}`} title="ตั้งค่าระบบ">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
            {!isCollapsed && <span className="font-medium truncate">ตั้งค่าระบบ</span>}
          </Link>
        </nav>

        <div className={`p-4 border-t border-slate-800 bg-slate-900/50 ${isCollapsed ? 'px-2' : ''}`}>
          <div className={`flex items-center gap-3 mb-4 ${isCollapsed ? 'justify-center' : 'px-2'}`}>
             <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 font-bold border border-slate-700 shrink-0">A</div>
             {!isCollapsed && (
               <div>
                 <p className="text-sm font-bold text-white">Admin</p>
                 <p className="text-xs text-slate-500">ผู้ดูแลระบบ</p>
               </div>
             )}
          </div>
          <Link href="/profile" onClick={handleLinkClick} className={`flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-4'} py-2.5 w-full rounded-xl transition-colors mb-1 ${pathname === '/profile' ? 'bg-blue-600/10 text-blue-500' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`} title="โปรไฟล์ส่วนตัว">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
            {!isCollapsed && <span className="font-medium truncate">โปรไฟล์ส่วนตัว</span>}
          </Link>
          <button onClick={handleLogout} className={`flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-4'} py-2.5 w-full rounded-xl text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 transition-colors group`} title="ออกจากระบบ">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:-translate-x-1 transition-transform"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
            {!isCollapsed && <span className="font-medium truncate">ออกจากระบบ</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-50 overflow-hidden relative">
        
        {/* Mobile Topbar */}
        <div className="md:hidden h-16 bg-slate-900 text-white flex items-center px-4 sticky top-0 z-30 shrink-0 shadow-md gap-4">
          <button 
            onClick={() => setIsOpen(true)}
            className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
          </button>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold shadow-lg shadow-blue-600/20">S</div>
            <h1 className="text-xl font-bold tracking-tight">Smart Dorm</h1>
          </div>
        </div>

        {/* Desktop Top Header (Hidden on Mobile? No, just keep it, or maybe simplify padding) */}
        <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200/60 flex items-center justify-between px-6 sm:px-8 z-10 sticky top-0 shadow-sm shrink-0">
           <h2 className="text-base sm:text-lg font-bold text-slate-800 tracking-tight truncate mr-4">
             {pathname === '/rooms' ? 'จัดการห้องพัก (Room Management)' : pathname === '/room-types' ? 'ประเภทห้องพัก (Room Types)' : pathname === '/booking-requests' ? 'คำขอจองห้องพัก (Booking Requests)' : pathname === '/invoices' || pathname.startsWith('/invoices/editor') ? 'จัดการบิลค่าเช่า (Invoices)' : pathname === '/users' ? 'จัดการผู้ใช้งาน (Users)' : pathname === '/settings' ? 'ตั้งค่าระบบ (Settings)' : pathname === '/profile' ? 'โปรไฟล์ส่วนตัว (Profile)' : pathname === '/reports' ? 'รายงานสรุปรายได้ (Reports)' : 'ภาพรวม (Dashboard)'}
           </h2>
           <div className="text-xs sm:text-sm font-medium text-slate-500 whitespace-nowrap hidden sm:block">
             {new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}
           </div>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
             {children}
          </div>
        </main>
      </div>
    </div>
  );
}
