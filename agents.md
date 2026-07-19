# Project: Smart Dorm Manager (Web App)

## 1. Project Overview
ระบบจัดการหอพัก (Dormitory Management System) สำหรับใช้งานบน Web Browser โดยมี 2 สิทธิ์การใช้งานคือ Admin (เจ้าของหอพัก) และ Tenant (ผู้เช่า)

## 2. Tech Stack
* Frontend: Next.js (App Router), Tailwind CSS, shadcn/ui (สำหรับ UI Components)
* Backend & Database: Supabase

## 3. Database Schema (Supabase)
ห้ามสร้างตารางใหม่ ให้ใช้โครงสร้างข้อมูลตามนี้เท่านั้น:
* `users` (user_id UUID, first_name, last_name, phone_number, role, email)
* `rooms` (room_id INT8, room_number, floor, price_per_month, status)
* `contracts` (contracts_id INT8, start_date, end_date, is_active, tenant_id UUID, room_id INT8)
* `invoices` (invoices_id INT8, month_year, water_unit, electric_unit, water_rate, electric_rate, total_amount, status, slip_image, contract_id INT8)
* `maintenance_requests` (maintenance_requests_id INT8, issue_details, photo_url, status, room_id INT8, tenant_id UUID)

## 4. Key SQL Views (ใช้งาน Views เหล่านี้สำหรับการดึงข้อมูลแทนการ Join สด)
* `view_invoice_details`: ใช้แสดงรายละเอียดบิล (Join: invoices + contracts + rooms + users)
* `view_maintenance_details`: ใช้แสดงรายการแจ้งซ่อม (Join: maintenance_requests + rooms + users)
* `view_active_contracts`: ใช้ดูผู้เช่าปัจจุบัน (Join: contracts + rooms + users)

## 5. Agent Rules (กฎการทำงานของ AI)
1. ให้ทำงานทีละงาน (Step-by-step) อย่างรอบคอบ
2. เน้นการออกแบบ UI ที่ดูสะอาดตา ทันสมัย (Clean & Modern Design)
3. หากเกิด Error ใน Terminal หรือ Browser ให้ทำการวิเคราะห์และแก้บั๊กตัวเอง (Self-healing) ทันที