const fs = require('fs');
let content = fs.readFileSync('src/app/tenant/page.tsx', 'utf-8');

// 1. Add formatThaiDateShort helper
if (!content.includes('const formatThaiDateShort')) {
    content = content.replace(
        'const getMeterCycle = (issueDateStr: string, meterDay: number) => {',
        `const formatThaiDateShort = (dateStr: string) => {
    if (!dateStr) return '-';
    const parts = dateStr.split('-');
    if (parts.length >= 2) {
        const y = parseInt(parts[0], 10) + 543;
        const m = parts[1];
        const d = parts.length === 3 ? parts[2].substring(0, 2) : '01';
        return \`\${d}/\${m}/\${y}\`;
    }
    return dateStr;
};

const getMeterCycle = (issueDateStr: string, meterDay: number) => {`
    );
}

// 2. Modify บิลค่าเช่าเดือนล่าสุด
content = content.replace(
    /<p className="text-2xl font-black text-slate-800">\{invoice\.month_year\}<\/p>/g,
    `<p className="text-2xl font-black text-slate-800">{formatThaiDateShort(invoice.month_year)}</p>`
);

// 3. Modify ประวัติบิลย้อนหลัง
content = content.replace(
    /<div className="flex items-center gap-3">\s*<div className="w-12 h-12 rounded-xl bg-slate-50 flex flex-col items-center justify-center text-slate-500 border border-slate-100 font-medium shrink-0">\s*<span className="text-xs font-bold">\{inv\.month_year \? inv\.month_year\.split\('\/'\)\[0\] : '-'\}<\/span>\s*<span className="text-\[10px\] font-bold">\{inv\.month_year \? inv\.month_year\.split\('\/'\)\[1\] : ''\}<\/span>\s*<\/div>/g,
    `<div className="flex items-center gap-3 sm:gap-4 py-3">
                                                        <div className="whitespace-nowrap px-3 py-1.5 rounded-md bg-gray-100 text-sm font-medium text-gray-700 shrink-0">
                                                            {formatThaiDateShort(inv.month_year)}
                                                        </div>`
);

fs.writeFileSync('src/app/tenant/page.tsx', content);
console.log("Updated tenant/page.tsx successfully.");
