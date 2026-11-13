// Génère docs/BILAN-COUVERTURE-TRANSPORTS.md à partir de transport-coverage.js (aucun chiffre saisi à la main).
// Sans diagnostic téléphone, aucun réseau ne peut être « Validé en réel ».
const fs=require('fs'),path=require('path');
const C=require('../transport-coverage.js');
const inv=C.inventory(null);
const esc=v=>String(v??'').replace(/\|/g,'/');
const L=['# Bilan chiffré de couverture — transports AURA–Suisse','',
 'Généré le '+new Date().toISOString().slice(0,10)+' par `scripts/bilan-couverture-transports.cjs` à partir de `transport-coverage.js`.',
 '**Aucun diagnostic réel n’a encore été lancé sur téléphone** : aucun réseau n’est donc « Validé en réel ».','',
 '## Synthèse par zone (dénominateur = réseaux identifiés dans la zone)','',
 '| Zone | Périmètre de l’inventaire | Identifiés | Raccordés | Validés en réel | Prix vérifiés | Prix partiels | Restant à terminer |','|---|---|---|---|---|---|---|---|'];
for(const z of inv.zones)L.push('| '+[z.zone,z.scope,z.total,z.connected+' ('+z.connectedPct+' %)',z.real+' ('+z.realPct+' %)',z.priced+' ('+Math.round(z.priced/z.total*100)+' %)',z.partialFare||0,z.remaining].map(esc).join(' | ')+' |');
const T=inv.zones.reduce((a,z)=>({total:a.total+z.total,connected:a.connected+z.connected,real:a.real+z.real,priced:a.priced+z.priced,remaining:a.remaining+z.remaining}),{total:0,connected:0,real:0,priced:0,remaining:0});
L.push('| **Total** | — | '+T.total+' | '+T.connected+' ('+Math.round(T.connected/T.total*100)+' %) | '+T.real+' (0 %) | '+T.priced+' ('+Math.round(T.priced/T.total*100)+' %) | — | **'+T.remaining+'** |','');
L.push('« Raccordé » = une source officielle est branchée (pas une validation). La présence possible d’un opérateur dans TripGo n’est **jamais** comptée comme raccordement.','');
const states={};for(const r of inv.rows)states[r.state]=(states[r.state]||0)+1;
L.push('## États','',...Object.entries(states).map(([k,v])=>'- '+k+' : '+v+' réseau(x)'),'');
L.push('## Détail réseau par réseau','','| Réseau | Zone | Couverture | Horaires | Tarifs | Marche | Dernier contrôle | Blocage | Prochaine action |','|---|---|---|---|---|---|---|---|---|');
for(const r of inv.rows)L.push('| '+[r.name,r.zone,r.state,r.horaires,r.tarif,r.marche,r.dernierControle,r.blocage,r.action].map(esc).join(' | ')+' |');
L.push('','## Tarifs manquants ou partiels, réseau par réseau','');
for(const r of inv.rows.filter(r=>r.tarif!=='vérifiés'))L.push('- **'+r.name+'** ('+r.tarif+') : '+r.fare+' — '+r.blocage);
L.push('','## Axes du diagnostic téléphone','','Dans l’application : Réglages → « Couverture et diagnostic des transports » → « Lancer le diagnostic réel », puis « Copier le rapport ».','');
for(const a of C.AXES)L.push('- '+a.name+' — réseaux attendus : '+a.expect.join(', '));
fs.writeFileSync(path.join(__dirname,'..','docs','BILAN-COUVERTURE-TRANSPORTS.md'),L.join('\n')+'\n');
console.log(JSON.stringify({zones:inv.zones.map(z=>[z.zone,z.total,z.connected,z.real,z.priced,z.remaining]),total:T,states}));
