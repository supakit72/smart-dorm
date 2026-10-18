"use client";

import React, { useEffect, useState } from 'react';
import { supabase } from '@/backend/lib/supabase';
import { useParams } from 'next/navigation';

export default function PrintContractPage() {
    const params = useParams();
    const contractId = params.contract_id;

    const [contract, setContract] = useState<any>(null);
    const [tenant, setTenant] = useState<any>(null);
    const [room, setRoom] = useState<any>(null);
    const [settings, setSettings] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchContractData = async () => {
            if (!contractId) return;
            try {
                setLoading(true);
                setError(null);

                // 0. ตรวจสอบการเข้าสู่ระบบและสิทธิ์การเข้าถึง (Authentication & Authorization)
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) {
                    setError('กรุณาเข้าสู่ระบบก่อนเข้าดูเอกสารสัญญาเช่า');
                    return;
                }

                const { data: currentUser, error: userAuthError } = await supabase
                    .from('users')
                    .select('user_id, role, user_uid')
                    .eq('user_uid', session.user.id)
                    .single();

                if (userAuthError || !currentUser) {
                    setError('ไม่พบข้อมูลผู้ใช้งาน หรือสิทธิ์การเข้าใช้งานไม่ถูกต้อง');
                    return;
                }

                // 1. Fetch Contract
                const { data: contractData, error: contractError } = await supabase
                    .from('contracts')
                    .select('*')
                    .eq('contracts_id', contractId)
                    .single();

                if (contractError) throw contractError;

                // ตรวจสอบความปลอดภัย: ผู้ดูแลระบบดูได้ทุกสัญญา / ผู้เช่าดูได้เฉพาะสัญญาของตนเองเท่านั้น
                if (currentUser.role !== 'admin') {
                    const isOwner =
                        String(contractData.tenant_id) === String(currentUser.user_id) ||
                        (contractData.tenant_uid && contractData.tenant_uid === session.user.id);

                    if (!isOwner) {
                        setError('คุณไม่มีสิทธิ์เข้าดูเอกสารสัญญานี้ (เอกสารนี้เป็นของผู้เช่าห้องอื่น)');
                        return;
                    }
                }

                setContract(contractData);

                // 2. Fetch Tenant
                if (contractData.tenant_id) {
                    const { data: userData, error: userError } = await supabase
                        .from('users')
                        .select('*')
                        .eq('user_id', contractData.tenant_id)
                        .single();
                    if (userError) throw userError;
                    setTenant(userData);
                }

                // 3. Fetch Room
                if (contractData.room_id) {
                    const { data: roomData, error: roomError } = await supabase
                        .from('rooms')
                        .select('*')
                        .eq('room_id', contractData.room_id)
                        .single();
                    if (roomError) throw roomError;
                    setRoom(roomData);
                }

                // 4. Fetch Settings
                const { data: settingsData, error: settingsError } = await supabase
                    .from('dorm_settings')
                    .select('*')
                    .limit(1)
                    .single();
                if (settingsError) throw settingsError;
                setSettings(settingsData);

            } catch (err: any) {
                console.error("Error fetching contract:", err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchContractData();
    }, [contractId]);

    const handlePrint = () => {
        window.print();
    };

    const formatDateThaiLong = (dateStr: string) => {
        if (!dateStr) return '-';
        const d = new Date(dateStr);
        const months = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
        return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear() + 543}`;
    };

    if (loading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-100 font-sans text-slate-700">
                <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-3"></div>
                <p className="text-sm font-bold">กำลังโหลดข้อมูลเอกสารสัญญา...</p>
            </div>
        );
    }

    if (error || !contract) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-100 p-4 font-sans text-center">
                <div className="bg-white border border-slate-200 rounded-3xl p-8 max-w-md w-full shadow-xl">
                    <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-4 text-3xl">⚠️</div>
                    <h2 className="text-xl font-bold text-slate-800 mb-2">ไม่สามารถเปิดดูเอกสารได้</h2>
                    <p className="text-sm text-slate-600 mb-6 bg-slate-50 p-4 rounded-xl border border-slate-100 leading-relaxed">{error || 'ไม่พบสัญญาเช่า'}</p>
                    <div className="flex gap-2.5">
                        <button
                            onClick={() => window.close()}
                            className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl transition-all text-sm cursor-pointer"
                        >
                            ปิดหน้าต่าง
                        </button>
                        <a
                            href="/tenant"
                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-all text-sm flex items-center justify-center cursor-pointer shadow-md shadow-blue-500/20"
                        >
                            กลับสู่หน้าหลัก
                        </a>
                    </div>
                </div>
            </div>
        );
    }

    const todayDate = new Date();
    const createdDate = new Date(contract.created_at || contract.start_date);

    return (
        <div className="min-h-screen bg-slate-200 py-8 print:bg-white print:py-0 font-sans text-slate-900">
            <style jsx global>{`
                @media print {
                    @page { margin: 15mm; }
                    body { -webkit-print-color-adjust: exact; }
                    .page-break { page-break-before: always; }
                    .avoid-break { page-break-inside: avoid; }
                }
            `}</style>

            {/* Top Toolbar (Hidden in Print) */}
            <div className="max-w-[210mm] mx-auto mb-4 flex justify-between items-center print:hidden px-4">
                <button
                    onClick={() => window.close()}
                    className="px-4 py-2 bg-white text-slate-700 rounded-lg shadow hover:bg-slate-50 font-bold"
                >
                    ปิดหน้าต่าง
                </button>
                <button
                    onClick={handlePrint}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg shadow-lg hover:bg-blue-700 font-bold flex items-center gap-2"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                    พิมพ์เอกสาร
                </button>
            </div>

            {/* A4 Paper Container */}
            <div className="max-w-[210mm] mx-auto bg-white shadow-2xl print:shadow-none p-10 md:p-16 print:p-0">

                {/* Document Header */}
                <div className="text-center mb-10">
                    <h1 className="text-2xl font-bold mb-4 tracking-wide">หนังสือสัญญาเช่าห้องพัก</h1>
                    <p className="text-base">
                        ทำที่ <strong>{settings?.bank_account_name || 'หอพัก Smart Dorm'}</strong>
                    </p>
                    <p className="text-base mt-1">
                        วันที่ <strong>{formatDateThaiLong(createdDate.toISOString())}</strong>
                    </p>
                </div>

                {/* Contract Body */}
                <div className="space-y-6 text-base leading-relaxed text-justify">
                    <p className="indent-10">
                        สัญญาฉบับนี้ทำขึ้นระหว่าง <strong>{settings?.bank_account_name || 'เจ้าของหอพัก'}</strong> ซึ่งต่อไปในสัญญานี้จะเรียกว่า <strong>"ผู้ให้เช่า"</strong> ฝ่ายหนึ่ง กับ
                        <span className="mx-2"></span>
                        <strong>{tenant?.first_name} {tenant?.last_name}</strong>
                        <span className="mx-2"></span>
                        ถือบัตรประจำตัวประชาชนเลขที่ <strong>{tenant?.id_card_number || '-'}</strong>
                    </p>
                    <p>
                        ออกให้เมื่อวันที่ <strong>{formatDateThaiLong(tenant?.id_card_issue_date)}</strong>
                        <span className="mx-2"></span>
                        บัตรหมดอายุวันที่ <strong>{formatDateThaiLong(tenant?.id_card_expiry_date)}</strong>
                    </p>
                    <p>
                        ตั้งบ้านเรือนอยู่เลขที่ <strong>{tenant?.address || '-'}</strong>
                        <span className="mx-2"></span>
                        เบอร์โทรศัพท์ติดต่อ <strong>{tenant?.phone_number || '-'}</strong>
                        <span className="mx-2"></span>
                        ซึ่งต่อไปในสัญญานี้จะเรียกว่า <strong>"ผู้เช่า"</strong> อีกฝ่ายหนึ่ง
                    </p>

                    <p className="indent-10 font-bold mt-4">
                        คู่สัญญาทั้งสองฝ่ายได้ตกลงทำสัญญากันมีข้อความดังต่อไปนี้:
                    </p>

                    <div className="pl-2 space-y-4">
                        {/* หมวด 1 */}
                        <div className="avoid-break">
                            <p className="font-bold underline mb-1">หมวดที่ 1: วัตถุประสงค์แห่งการเช่า</p>
                            <p className="pl-6">
                                <strong>ข้อ 1.1</strong> ผู้ให้เช่าตกลงให้เช่า และผู้เช่าตกลงรับเช่าห้องพักหมายเลข <strong>{room?.room_number}</strong> ชั้น <strong>{room?.floor}</strong>
                                เพื่อใช้เป็นที่พักอาศัยเท่านั้น ห้ามมิให้ผู้เช่านำไปใช้ประกอบธุรกิจการค้าหรือกระทำการใดๆ ที่ขัดต่อกฎหมายและศีลธรรมอันดีงาม
                            </p>
                            <p className="pl-6 mt-2">
                                <strong>ข้อ 1.2</strong> สัญญามีกำหนดระยะเวลาการเช่า <strong>1 ปี</strong> นับตั้งแต่วันที่ <strong>{formatDateThaiLong(contract.start_date)}</strong> ถึงวันที่ <strong>{formatDateThaiLong(contract.end_date)}</strong>
                            </p>
                        </div>

                        {/* หมวด 2 */}
                        <div className="avoid-break pt-2">
                            <p className="font-bold underline mb-1">หมวดที่ 2: ค่าเช่า ค่าสาธารณูปโภค และค่าปรับ</p>
                            <p className="pl-6">
                                <strong>ข้อ 2.1</strong> ผู้เช่าตกลงชำระค่าเช่าให้แก่ผู้ให้เช่าเป็นรายเดือน ในอัตราเดือนละ <strong>{Number(room?.price_per_month || 0).toLocaleString()}</strong> บาท
                            </p>
                            <p className="pl-6 mt-2">
                                <strong>ข้อ 2.2</strong> ผู้เช่าตกลงชำระค่ากระแสไฟฟ้าตามหน่วยที่ใช้จริง ในอัตราหน่วยละ <strong>{settings?.electric_rate || '-'}</strong> บาท และค่าน้ำประปา ในอัตราหน่วยละ <strong>{settings?.water_rate || '-'}</strong> บาท หรือตามอัตราเหมาจ่ายที่ระบุไว้
                            </p>
                            <p className="pl-6 mt-2">
                                <strong>ข้อ 2.3</strong> ผู้เช่าต้องชำระเงินค่าเช่าและค่าบริการต่างๆ ภายในวันที่ <strong>{settings?.due_day || '5'}</strong> ของทุกเดือน หากผู้เช่าผิดนัดชำระเกินกำหนด ผู้เช่ายินยอมให้ผู้ให้เช่าปรับเป็นรายวัน วันละ <strong>100</strong> บาท และหากค้างชำระเกินกำหนด 7 วัน ผู้ให้เช่ามีสิทธิล็อกประตูห้องพักและงดให้บริการน้ำประปาและกระแสไฟฟ้าได้ทันทีโดยไม่ต้องแจ้งล่วงหน้า
                            </p>
                        </div>

                        {/* หมวด 3 */}
                        <div className="avoid-break pt-2">
                            <p className="font-bold underline mb-1">หมวดที่ 3: เงินประกันความเสียหาย</p>
                            <p className="pl-6">
                                <strong>ข้อ 3.1</strong> ในวันทำสัญญานี้ ผู้เช่าได้วางเงินประกันความเสียหายเป็นจำนวนเงิน <strong>{Number(room?.price_per_month || 0).toLocaleString()}</strong> บาท ให้แก่ผู้ให้เช่า
                            </p>
                            <p className="pl-6 mt-2">
                                <strong>ข้อ 3.2</strong> ผู้ให้เช่าจะคืนเงินประกันให้ภายในระยะเวลา 15-30 วัน หลังจากที่ผู้เช่าย้ายออกและได้ทำการตรวจสอบแล้วว่าไม่มีหนี้สินค้างชำระ ตลอดจนไม่มีความเสียหายใดๆ เกิดขึ้นแก่ทรัพย์สินของผู้ให้เช่า
                            </p>
                            <p className="pl-6 mt-2">
                                <strong>ข้อ 3.3</strong> ห้ามมิให้ผู้เช่านำเงินประกันความเสียหายดังกล่าวมาหักกลบลบหนี้เป็นค่าเช่าในเดือนสุดท้ายที่อยู่อาศัยโดยเด็ดขาด
                            </p>
                        </div>

                        {/* Page Break for print */}
                        <div className="page-break hidden print:block"></div>

                        {/* หมวด 4 */}
                        <div className="avoid-break pt-6 print:pt-0">
                            <p className="font-bold underline mb-1">หมวดที่ 4: การรักษาสภาพแวดล้อมและทรัพย์สิน</p>
                            <p className="pl-6">
                                <strong>ข้อ 4.1</strong> ผู้เช่าต้องรักษาความสะอาด และห้ามทิ้งสิ่งปฏิกูลในบริเวณพื้นที่ส่วนรวม
                            </p>
                            <p className="pl-6 mt-2">
                                <strong>ข้อ 4.2</strong> ห้ามผู้เช่าเจาะ ตอก ทุบ หรือดัดแปลงต่อเติมผนังและโครงสร้างอาคารโดยเด็ดขาด
                            </p>
                            <p className="pl-6 mt-2">
                                <strong>ข้อ 4.3</strong> ห้ามเลี้ยงสัตว์ทุกชนิดภายในบริเวณหอพัก
                            </p>
                            <p className="pl-6 mt-2">
                                <strong>ข้อ 4.4</strong> ห้ามส่งเสียงดังรำคาญ ดื่มสุรามั่วสุม หรือกระทำการใดๆ ที่สร้างความเดือดร้อนรำคาญแก่ผู้พักอาศัยห้องอื่น
                            </p>
                            <p className="pl-6 mt-2">
                                <strong>ข้อ 4.5</strong> ห้ามนำวัตถุไวไฟ วัตถุอันตราย หรือสิ่งผิดกฎหมายเข้ามาในอาคาร
                            </p>
                            <p className="pl-6 mt-2">
                                <strong>ข้อ 4.6</strong> ผู้ให้เช่าจะไม่รับผิดชอบต่อการสูญหายหรือเสียหายของทรัพย์สินส่วนตัว หรือยานพาหนะของผู้เช่าไม่ว่ากรณีใดๆ ทั้งสิ้น
                            </p>
                        </div>

                        {/* หมวด 5 */}
                        <div className="avoid-break pt-2">
                            <p className="font-bold underline mb-1">หมวดที่ 5: การย้ายออกและการเลิกสัญญา</p>
                            <p className="pl-6">
                                <strong>ข้อ 5.1</strong> หากผู้เช่ามีความประสงค์จะย้ายออก ผู้เช่าต้องแจ้งให้ผู้ให้เช่าทราบล่วงหน้าไม่น้อยกว่า <strong>30 วัน</strong> หากแจ้งกระชั้นชิดกว่าที่กำหนด ผู้เช่ายินยอมให้ผู้ให้เช่าริบเงินประกันความเสียหายได้ทั้งหมด
                            </p>
                            <p className="pl-6 mt-2">
                                <strong>ข้อ 5.2</strong> หากผู้เช่าฝ่าฝืนหรือไม่ปฏิบัติตามข้อตกลงในสัญญานี้กระทงใดกระทงหนึ่ง ผู้ให้เช่ามีสิทธิบอกเลิกสัญญาได้ทันที และมีสิทธิเชิญผู้เช่าพร้อมบริวารออกจากพื้นที่เช่าโดยที่ผู้เช่าไม่มีสิทธิเรียกร้องค่าเสียหายใดๆ
                            </p>
                        </div>
                    </div>

                    <p className="indent-10 mt-8 avoid-break">
                        สัญญานี้ทำขึ้นเป็นสองฉบับมีข้อความถูกต้องตรงกัน คู่สัญญาได้อ่านและเข้าใจข้อความในสัญญานี้โดยตลอดแล้ว
                        เห็นว่าถูกต้องตรงตามเจตนา จึงได้ลงลายมือชื่อไว้เป็นสำคัญต่อหน้าพยาน และต่างฝ่ายต่างเก็บรักษาไว้ฝ่ายละหนึ่งฉบับ
                    </p>
                </div>

                {/* Signatures */}
                <div className="mt-20 avoid-break">
                    <div className="grid grid-cols-2 gap-y-16 gap-x-10">
                        <div className="text-center flex flex-col items-center">
                            <p className="text-sm mb-2">ลงชื่อ .......................................................... ผู้ให้เช่า</p>
                            <p className="text-sm mt-1">( {settings?.bank_account_name || '..........................................................'} )</p>
                        </div>

                        <div className="text-center flex flex-col items-center">
                            <p className="text-sm mb-2">ลงชื่อ .......................................................... ผู้เช่า</p>
                            <p className="text-sm mt-1">( {tenant?.first_name} {tenant?.last_name} )</p>
                        </div>

                        <div className="text-center flex flex-col items-center">
                            <p className="text-sm mb-2">ลงชื่อ .......................................................... พยาน</p>
                            <p className="text-sm mt-1">( .......................................................... )</p>
                        </div>

                        <div className="text-center flex flex-col items-center">
                            <p className="text-sm mb-2">ลงชื่อ .......................................................... พยาน</p>
                            <p className="text-sm mt-1">( .......................................................... )</p>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
