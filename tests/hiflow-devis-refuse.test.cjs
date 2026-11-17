const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');
test('missions Hiflow dont le devis est refusé : écartées de « Missions disponibles »',()=>{
 const src=fs.readFileSync(require.resolve('../app.js'),'utf8');
 assert.match(src,/m\.platform === 'Hiflow' && m\.fees && Number\(m\.fees\.devis_refuse\) === 1\) return false/);
 // la règle est dans estDisponible, avant le contrôle de date
 const i=src.indexOf('const estDisponible'),j=src.indexOf('devis_refuse',i);
 assert.ok(i>0&&j>i&&j-i<900);
});
