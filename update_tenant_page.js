const fs = require('fs');
let content = fs.readFileSync('src/app/tenant/page.tsx', 'utf-8');

// Replace 1: .select('user_id') to .select('user_id, first_name, last_name')
content = content.replace(
    /\.from\('users'\)\s*\r?\n\s*\.select\('user_id'\)/g,
    `.from('users')\n                .select('user_id, first_name, last_name')`
);

// Replace 2: add tenant_name
content = content.replace(
    /calculatedTotal:\s*Number\(inv\.total_amount\s*\|\|\s*total\)\r?\n\s*\};\r?\n\s*\}\);/g,
    `calculatedTotal: Number(inv.total_amount || total),\n                        tenant_name: \`\${userRecord.first_name || ''} \${userRecord.last_name || ''}\`.trim()\n                    };\n                });`
);

fs.writeFileSync('src/app/tenant/page.tsx', content);
