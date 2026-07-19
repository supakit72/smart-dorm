"use client";

import React from 'react';

// Shared utility
export const getMeterCycle = (issueDateStr: string, meterDay: number) => {
    if (!issueDateStr || !meterDay) return '';
    const [yStr, mStr, dStr] = issueDateStr.split('-');
    if (!mStr || !yStr || !dStr) return '';
    const m = parseInt(mStr, 10);
    const y = parseInt(yStr, 10);
    
    const currentMonthDate = new Date(y, m - 1, meterDay);
    const previousMonthDate = new Date(y, m - 2, meterDay);
    
    const thaiMonths = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
    
    const formatThaiDate = (date: Date) => {
        const dd = date.getDate();
        const mm = thaiMonths[date.getMonth()];
        const yy = (date.getFullYear() + 543).toString().slice(-2);
        return `${dd} ${mm} ${yy}`;
    };
    
    return `${formatThaiDate(previousMonthDate)} - ${formatThaiDate(currentMonthDate)}`;
};

export const formatMonthYear = (myStr: string) => {
    if (!myStr) return '-';
    // Handle YYYY-MM-DD
    const parts = myStr.split('-');
    if (parts.length >= 2) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      const thaiMonths = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
      return `${thaiMonths[m - 1]} ${y + 543}`;
    }
    return myStr;
};

export const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
};

interface InvoiceDocumentProps {
    invoice: any;
    dormSettings: any;
}

export default function InvoiceDocument({ invoice, dormSettings }: InvoiceDocumentProps) {
    if (!invoice) return null;

    const roomRent = Number(invoice.contracts?.rooms?.price_per_month || invoice.room_rent || 0);
    const wTotal = (invoice.water_unit || 0) * (invoice.water_rate || 0);
    const eTotal = (invoice.electric_unit || 0) * (invoice.electric_rate || 0);
    const totalWE = wTotal + eTotal;
    
    let wVat = 0; let eVat = 0;
    const vatTotal = Number(invoice.vat_amount || 0);
    if (vatTotal > 0 && totalWE > 0) {
        wVat = (wTotal / totalWE) * vatTotal;
        eVat = vatTotal - wVat;
    }

    const showTaxColumn = dormSettings?.show_tax_column !== false;

    const addItems = invoice.additional_items || [];
    const addTotal = addItems.reduce((sum: number, item: any) => sum + Number(item.price || 0), 0);
    
    const rawSubtotal = roomRent + wTotal + eTotal + addTotal;
    const rounding = Number(invoice.rounding_amount || 0);
    const netTotal = Number(invoice.total_amount || 0);

    const bahtText = (num: number): string => {
        if (num === 0) return 'ศูนย์บาทถ้วน';
        const numStr = Number(num).toFixed(2);
        const [bahtStr, satangStr] = numStr.split('.');
        
        const readNumber = (nStr: string): string => {
            const thaiNumbers = ['ศูนย์', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
            const thaiPositions = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน', 'ล้าน'];
            let result = '';
            const len = nStr.length;
            for (let i = 0; i < len; i++) {
                const digit = parseInt(nStr.charAt(i));
                const pos = len - i - 1;
                if (digit !== 0) {
                    if (pos % 6 === 0 && pos > 0) {
                        if (digit === 1 && i > 0 && nStr.charAt(i-1) !== '0') result += 'เอ็ด';
                        else result += thaiNumbers[digit];
                        result += 'ล้าน';
                    } else {
                        const p = pos % 6;
                        if (p === 0 && digit === 1 && len > 1 && nStr.charAt(i-1) !== '0') {
                            result += 'เอ็ด';
                        } else if (p === 1 && digit === 2) {
                            result += 'ยี่สิบ';
                        } else if (p === 1 && digit === 1) {
                            result += 'สิบ';
                        } else {
                            result += thaiNumbers[digit] + thaiPositions[p];
                        }
                    }
                } else if (pos % 6 === 0 && pos > 0) {
                    result += 'ล้าน';
                }
            }
            return result;
        };

        let result = '';
        if (parseInt(bahtStr) > 0) result += readNumber(bahtStr) + 'บาท';
        if (parseInt(satangStr) > 0) result += readNumber(satangStr) + 'สตางค์';
        else result += 'ถ้วน';
        
        return result;
    };

    return (
      <div className="max-w-[21cm] mx-auto bg-white p-6 md:p-12 text-black font-sans text-sm">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start mb-6 border-b-2 border-black pb-6 gap-4">
          <div>
            {dormSettings?.invoice_logo_url && (
              <img src={dormSettings.invoice_logo_url} alt="Logo" className="h-16 w-auto object-contain mb-3" />
            )}
            <h1 className="text-3xl font-black text-black mb-1">ใบแจ้งหนี้ / INVOICE</h1>
            <p className="font-bold text-lg mt-2">{dormSettings?.dorm_name || 'สมาร์ท ดอร์ม (Smart Dorm)'}</p>
            <p className="text-sm whitespace-pre-wrap max-w-sm mt-1">{dormSettings?.address || '-'}</p>
            <p className="text-sm mt-1">โทร: {dormSettings?.phone || '-'}</p>
          </div>
          <div className="text-right border border-black p-4 rounded-lg min-w-[200px] w-full sm:w-auto">
            <p className="text-xl font-bold text-black border-b border-gray-300 pb-2 mb-2">
              ห้องพัก: {invoice.room_number || invoice.contracts?.rooms?.room_number}
            </p>
            <table className="w-full text-sm">
              <tbody>
                <tr>
                  <td className="text-left py-1 text-gray-600">ประจำเดือน:</td>
                  <td className="text-right font-medium">{formatMonthYear(invoice.month_year)}</td>
                </tr>
                <tr>
                  <td className="text-left py-1 text-gray-600">วันที่ออกบิล:</td>
                  <td className="text-right font-medium">{new Date(invoice.created_at || new Date()).toLocaleDateString('th-TH')}</td>
                </tr>
                <tr>
                  <td className="text-left py-1 text-black font-bold">กำหนดชำระ:</td>
                  <td className="text-right font-bold text-black">{formatDate(invoice.due_date)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left mb-6 border-collapse min-w-[600px]">
            <thead className="border-y-2 border-black">
              <tr>
                <th className="py-2 px-2 font-bold w-1/3">รายการ</th>
                <th className="py-2 px-2 font-bold text-center">ราคา/หน่วย</th>
                <th className="py-2 px-2 font-bold text-center">จำนวน</th>
                <th className="py-2 px-2 font-bold text-right">ราคา (ก่อน VAT)</th>
                {showTaxColumn && <th className="py-2 px-2 font-bold text-right">ภาษี</th>}
                <th className="py-2 px-2 font-bold text-right">จำนวนเงิน</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-300 border-b-2 border-black">
              <tr>
                <td className="py-3 px-2">ค่าเช่าห้องพัก</td>
                <td className="py-3 px-2 text-center">{roomRent.toLocaleString(undefined, {minimumFractionDigits:2})}</td>
                <td className="py-3 px-2 text-center">1 เดือน</td>
                <td className="py-3 px-2 text-right">{roomRent.toLocaleString(undefined, {minimumFractionDigits:2})}</td>
                {showTaxColumn && <td className="py-3 px-2 text-right">0.00</td>}
                <td className="py-3 px-2 text-right font-medium">{roomRent.toLocaleString(undefined, {minimumFractionDigits:2})}</td>
              </tr>
              <tr>
                <td className="py-3 px-2">
                  ค่าน้ำประปา
                  <div className="text-xs text-gray-600 mt-0.5 font-normal">
                    ({getMeterCycle(invoice.month_year, dormSettings?.meter_reading_day || 20)})
                  </div>
                  {(invoice.water_meter_previous !== undefined && invoice.water_meter_current !== undefined) && (
                    <div className="text-xs text-gray-600 mt-0.5">
                      (มิเตอร์: {invoice.water_meter_previous} - {invoice.water_meter_current})
                    </div>
                  )}
                </td>
                <td className="py-3 px-2 text-center">{Number(invoice.water_rate).toLocaleString(undefined, {minimumFractionDigits:2})}</td>
                <td className="py-3 px-2 text-center">{invoice.water_unit} หน่วย</td>
                <td className="py-3 px-2 text-right">{wTotal.toLocaleString(undefined, {minimumFractionDigits:2})}</td>
                {showTaxColumn && <td className="py-3 px-2 text-right">{wVat.toLocaleString(undefined, {minimumFractionDigits:2})}</td>}
                <td className="py-3 px-2 text-right font-medium">{(wTotal + wVat).toLocaleString(undefined, {minimumFractionDigits:2})}</td>
              </tr>
              <tr>
                <td className="py-3 px-2">
                  ค่าไฟฟ้า
                  <div className="text-xs text-gray-600 mt-0.5 font-normal">
                    ({getMeterCycle(invoice.month_year, dormSettings?.meter_reading_day || 20)})
                  </div>
                  {(invoice.electric_meter_previous !== undefined && invoice.electric_meter_current !== undefined) && (
                    <div className="text-xs text-gray-600 mt-0.5">
                      (มิเตอร์: {invoice.electric_meter_previous} - {invoice.electric_meter_current})
                    </div>
                  )}
                </td>
                <td className="py-3 px-2 text-center">{Number(invoice.electric_rate).toLocaleString(undefined, {minimumFractionDigits:2})}</td>
                <td className="py-3 px-2 text-center">{invoice.electric_unit} หน่วย</td>
                <td className="py-3 px-2 text-right">{eTotal.toLocaleString(undefined, {minimumFractionDigits:2})}</td>
                {showTaxColumn && <td className="py-3 px-2 text-right">{eVat.toLocaleString(undefined, {minimumFractionDigits:2})}</td>}
                <td className="py-3 px-2 text-right font-medium">{(eTotal + eVat).toLocaleString(undefined, {minimumFractionDigits:2})}</td>
              </tr>
              {addItems.map((item: any, idx: number) => (
                <tr key={idx}>
                  <td className="py-3 px-2">{item.name}</td>
                  <td className="py-3 px-2 text-center">-</td>
                  <td className="py-3 px-2 text-center">-</td>
                  <td className="py-3 px-2 text-right">{Number(item.price).toLocaleString(undefined, {minimumFractionDigits:2})}</td>
                  {showTaxColumn && <td className="py-3 px-2 text-right">0.00</td>}
                  <td className="py-3 px-2 text-right font-medium">{Number(item.price).toLocaleString(undefined, {minimumFractionDigits:2})}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Summary Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start mt-4 gap-4">
          <div className="w-full sm:w-1/2 pt-4">
            {/* Thai Baht Text */}
            <div className="bg-gray-100 p-4 rounded-lg inline-block border border-gray-300 w-full">
              <p className="font-bold text-gray-800 text-sm mb-1">จำนวนเงินตัวอักษร:</p>
              <p className="text-base text-black font-medium">( {bahtText(netTotal)} )</p>
            </div>
          </div>
          <div className="w-full sm:w-1/2">
            <table className="w-full text-right text-sm">
              <tbody>
                <tr>
                  <td className="py-1.5 px-2 font-medium">รวมเป็นเงิน (Subtotal)</td>
                  <td className="py-1.5 px-2 w-32 border-b border-dotted border-gray-400">{rawSubtotal.toLocaleString(undefined, {minimumFractionDigits:2})}</td>
                </tr>
                {vatTotal > 0 && (
                  <tr>
                    <td className="py-1.5 px-2 font-medium">ภาษีมูลค่าเพิ่ม (VAT)</td>
                    <td className="py-1.5 px-2 border-b border-dotted border-gray-400">{vatTotal.toLocaleString(undefined, {minimumFractionDigits:2})}</td>
                  </tr>
                )}
                {rounding !== 0 && (
                  <tr>
                    <td className="py-1.5 px-2 font-medium">ปัดเศษสตางค์ (Rounding)</td>
                    <td className="py-1.5 px-2 border-b border-dotted border-gray-400">{rounding.toLocaleString(undefined, {minimumFractionDigits:2})}</td>
                  </tr>
                )}
                <tr className="border-t-2 border-black">
                  <td className="py-3 px-2 font-black text-lg">ยอดรวมสุทธิ (Net Total)</td>
                  <td className="py-3 px-2 font-black text-xl">{netTotal.toLocaleString(undefined, {minimumFractionDigits:2})} ฿</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Payment Info & Signatures */}
        <div className="mt-8 border border-gray-300 rounded-lg p-6 flex items-start gap-4 mb-8 break-inside-avoid">
          <div className="text-3xl mt-1">🏦</div>
          <div>
            <p className="font-bold text-black mb-1 text-base">ช่องทางการชำระเงิน (โอนเข้าบัญชี)</p>
            <p className="text-black">ธนาคาร: <span className="font-semibold">{dormSettings?.bank_name || '-'}</span></p>
            <p className="text-black">เลขที่บัญชี: <span className="font-semibold text-lg tracking-wider mx-1">{dormSettings?.bank_account_no || '-'}</span></p>
            <p className="text-black">ชื่อบัญชี: <span className="font-semibold">{dormSettings?.bank_account_name || '-'}</span></p>
          </div>
        </div>

        {dormSettings?.invoice_footer_text && (
          <div className="mt-4 mb-8 text-sm text-gray-700 whitespace-pre-wrap break-inside-avoid">
            <p className="font-bold text-black mb-1">หมายเหตุ:</p>
            {dormSettings.invoice_footer_text}
          </div>
        )}

        <div className="flex justify-between items-end pt-8 border-t border-black break-inside-avoid">
          <div className="text-center w-40 sm:w-56">
            <div className="border-b border-black mb-2 h-8"></div>
            {dormSettings?.invoice_signature_name ? (
              <p className="font-medium text-black">{dormSettings.invoice_signature_name}</p>
            ) : (
              <p className="font-medium text-black">ผู้รับเงิน / ผู้แจ้งหนี้</p>
            )}
            <p className="text-sm text-gray-600 mt-1">วันที่ _______/_______/_______</p>
          </div>
          <div className="text-center w-40 sm:w-56">
            <div className="border-b border-black mb-2 h-8"></div>
            <p className="font-medium text-black">ผู้เช่า / ผู้ชำระเงิน</p>
            <p className="text-sm text-gray-600 mt-1">วันที่ _______/_______/_______</p>
          </div>
        </div>
        
      </div>
    );
}
