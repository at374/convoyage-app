// Convoyage Ultra — recherche non destructive de missions entre deux engagements acceptés.
// Ne lit que les missions déjà chargées ; aucune synchronisation, acceptation ou alerte.
(function(root){
'use strict';
const R=root.CPRetours||(typeof require==='function'?require('./retours.js'):null);
const G=root.CPGeo||(typeof require==='function'?require('./geo.js'):null);
const C=root.CPCalc||(typeof require==='function'?require('./calc.js'):null);
const H=3600000, DAY=86400000;
const key=m=>String(m.platform||'')+'|'+String(m.external_id||m.id||'');
const time=v=>{const x=Date.parse(v||'');return Number.isFinite(x)?x:null;};
const dateParis=t=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(t));
const enabled=(m,opts)=>!Array.isArray(opts.plateformesActives)||opts.plateformesActives.includes(m.platform);
const off=(t,opts)=>{const d=dateParis(t);const jours=opts.joursSansTravail||[];return jours.some(x=>typeof x==='string'?x===d:(x&&x.debut<=d&&d<=x.fin));};
function recherche(missions,reglages={},opts={}){
 const acc=(missions||[]).filter(m=>m.kind==='acceptee'&&m.status!=='annulee'&&m.status!=='terminee').map(m=>({m,d:R.debut(m),f:R.fin(m)})).filter(x=>x.d!=null&&x.f).sort((a,b)=>a.d-b.d);
 const dispo=(missions||[]).filter(m=>m.kind==='disponible'&&(!m.status||m.status==='disponible')&&enabled(m,opts));
 const marge=Math.max(0,Number(reglages.marge_minutes??60))*60000;
 const now=opts.maintenant??Date.now(), gaps=[];
 for(let i=0;i<acc.length-1;i++){
  const a=acc[i],b=acc[i+1];if(a.f.t>=b.d)continue;
  const pa=G.coordonnees(a.m,'destination'),pb=G.coordonnees(b.m,'origin');
  if(!pa||!pb){gaps.push({avant:key(a.m),apres:key(b.m),propositions:[],raison:'localisation_inconnue'});continue;}
  const kmDirect=G.routeKm(pa,pb),direct=C.liaison(kmDirect,reglages);
  const base={avant:key(a.m),apres:key(b.m),debut:a.f.t,fin:b.d,liaisonDirecteEstimee:direct,propositions:[]};
  for(const m of dispo){
   const d=R.debut(m),f=R.fin(m);if(d==null||!f||d<now||d<a.f.t||f.t>b.d||off(d,opts)||off(f.t,opts))continue;
   // Évite de proposer une mission qui traverse un jour déclaré sans travail.
   if(dateParis(d)!==dateParis(f.t)){let blocked=false;for(let t=d;t<=f.t;t+=H*6)if(off(t,opts))blocked=true;if(blocked)continue;}
   const p=G.coordonnees(m,'origin'),q=G.coordonnees(m,'destination');if(!p||!q)continue;
   const l1=C.liaison(G.routeKm(pa,p),reglages),l2=C.liaison(G.routeKm(q,pb),reglages);
   if(!l1||!l2||a.f.t+l1.heures*H+marge>(time(m.pickup_end)||d)||f.t+l2.heures*H+marge>b.d)continue;
   // Une autre mission acceptée ne peut jamais être déplacée ou supprimée.
   if(acc.some(x=>x!==a&&x!==b&&d<x.f.t&&f.t>x.d))continue;
   const rent=C.rentabiliteComplete(m,reglages,{approcheKm:l1.km,retourKm:l2.km});
   if(!rent.connu)continue;
   base.propositions.push({mission:m,cle:key(m),netMissionEstime:rent.net,liaisonAvantEstimee:l1,liaisonApresEstimee:l2,transportNonConfirme:true,avertissement:'Transport non confirmé — vérifiez vous-même les transports avant d’accepter cette mission.'});
  }
  base.propositions.sort((x,y)=>y.netMissionEstime-x.netMissionEstime);
  base.propositions=base.propositions.slice(0,Math.max(1,Math.min(30,opts.limite||10)));
  gaps.push(base);
 }
 return {intervalles:gaps,engagements:acc.length,estimation:true,aucuneModification:true};
}
const api={recherche};root.CPIntermissions=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
