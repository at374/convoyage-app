// Convoyage Ultra — validation de flux GTFS statiques officiels.
// Ce module ne télécharge rien et ne prétend pas fournir du temps réel.
(function(root){
'use strict';
function csv(texte){
  if(typeof texte!=='string') throw new TypeError('CSV attendu');
  const lignes=[];let ligne=[],champ='',guillemets=false;
  for(let i=0;i<texte.length;i++){
    const c=texte[i];
    if(c==='"'){
      if(guillemets&&texte[i+1]==='"'){champ+='"';i++;}
      else guillemets=!guillemets;
    }else if(c===','&&!guillemets){ligne.push(champ);champ='';}
    else if((c==='\n'||c==='\r')&&!guillemets){
      if(c==='\r'&&texte[i+1]==='\n')i++;
      ligne.push(champ);if(ligne.some(v=>v!==''))lignes.push(ligne);
      ligne=[];champ='';
    }else champ+=c;
  }
  if(guillemets)throw new Error('CSV: guillemets non fermés');
  ligne.push(champ);if(ligne.some(v=>v!==''))lignes.push(ligne);
  if(!lignes.length)return [];
  const entetes=lignes.shift().map((v,i)=>i===0?v.replace(/^\uFEFF/,''):v);
  if(new Set(entetes).size!==entetes.length)throw new Error('CSV: colonnes dupliquées');
  return lignes.map(valeurs=>Object.fromEntries(entetes.map((nom,i)=>[nom,valeurs[i]||''])));
}
function heureGTFS(v){
  if(typeof v!=='string'||!/^\d{1,2}:\d{2}:\d{2}$/.test(v))return null;
  const [h,m,s]=v.split(':').map(Number);
  return h<=47&&m<60&&s<60?h*3600+m*60+s:null;
}
// Vérifie une date civile locale GTFS (YYYYMMDD), sans conversion UTC.
function dateGTFS(v){
  if(typeof v!=='string'||!/^\d{8}$/.test(v))return false;
  const y=Number(v.slice(0,4)),m=Number(v.slice(4,6)),d=Number(v.slice(6,8));
  const x=new Date(Date.UTC(y,m-1,d));
  return x.getUTCFullYear()===y&&x.getUTCMonth()===m-1&&x.getUTCDate()===d;
}
function circule(fichiers, serviceId, date){
  if(!dateGTFS(date)||!serviceId)throw new Error('Service ou date GTFS invalide');
  const exceptions=typeof fichiers['calendar_dates.txt']==='string'
    ? csv(fichiers['calendar_dates.txt']) : [];
  // Une exception explicite prime sur le calendrier hebdomadaire.
  const duJour=exceptions.filter(x=>x.service_id===serviceId&&x.date===date);
  if(duJour.length){
    const types=new Set(duJour.map(x=>x.exception_type));
    if(types.size!==1||(!types.has('1')&&!types.has('2')))
      throw new Error('Exceptions GTFS contradictoires');
    return types.has('1');
  }
  const calendrier=typeof fichiers['calendar.txt']==='string'
    ? csv(fichiers['calendar.txt']) : [];
  const lignes=calendrier.filter(x=>x.service_id===serviceId);
  if(lignes.length>1)throw new Error('Service GTFS dupliqué');
  if(!lignes.length)return false;
  const ligne=lignes[0];
  if(!dateGTFS(ligne.start_date)||!dateGTFS(ligne.end_date))return false;
  if(date<ligne.start_date||date>ligne.end_date)return false;
  const jour=['sunday','monday','tuesday','wednesday','thursday','friday','saturday'][
    new Date(Date.UTC(Number(date.slice(0,4)),Number(date.slice(4,6))-1,Number(date.slice(6,8)))).getUTCDay()
  ];
  return ligne[jour]==='1';
}
function analyser(fichiers){
  if(!fichiers||typeof fichiers!=='object')throw new TypeError('Fichiers GTFS manquants');
  const requis={stops:'stop_id',routes:'route_id',trips:'trip_id',stop_times:'trip_id'};
  const tables={};
  for(const [nom,colonne] of Object.entries(requis)){
    if(typeof fichiers[nom+'.txt']!=='string')throw new Error('GTFS: '+nom+'.txt manquant');
    tables[nom]=csv(fichiers[nom+'.txt']);
    if(tables[nom].length&&!Object.hasOwn(tables[nom][0],colonne))
      throw new Error('GTFS: colonne '+colonne+' manquante dans '+nom);
  }
  const stops=new Set(tables.stops.map(v=>v.stop_id));
  const trips=new Set(tables.trips.map(v=>v.trip_id));
  const routes=new Set(tables.routes.map(v=>v.route_id));
  const erreurs=[];
  const calendrier = typeof fichiers['calendar.txt']==='string'
    ? csv(fichiers['calendar.txt']) : [];
  const exceptions = typeof fichiers['calendar_dates.txt']==='string'
    ? csv(fichiers['calendar_dates.txt']) : [];
  const services = new Set([...calendrier,...exceptions].map(v=>v.service_id).filter(Boolean));
  if(!services.size)erreurs.push('aucun calendrier de circulation disponible');
  for(const t of tables.trips){
    if(!t.service_id || !services.has(t.service_id))
      erreurs.push('service absent: '+t.trip_id+'/'+(t.service_id||'?'));
  }
  for(const t of tables.trips)if(!routes.has(t.route_id))erreurs.push('route absente: '+t.route_id);
  for(const st of tables.stop_times){
    if(!trips.has(st.trip_id))erreurs.push('course absente: '+st.trip_id);
    if(!stops.has(st.stop_id))erreurs.push('arrêt absent: '+st.stop_id);
    if(heureGTFS(st.arrival_time)===null||heureGTFS(st.departure_time)===null)
      erreurs.push('horaire invalide: '+st.trip_id+'/'+st.stop_id);
  }
  return {valide:erreurs.length===0,erreurs:erreurs.slice(0,100),
    nombreErreurs:erreurs.length,
    compteurs:Object.fromEntries(Object.entries(tables).map(([k,v])=>[k,v.length])),
    // Les données ne sont pas utilisables sans calendrier de service.
    calendrierPresent:services.size>0,
    services:services.size,
    exceptions:exceptions.length};
}
const api={csv,heureGTFS,dateGTFS,circule,analyser};
root.CPGTFSValidation=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
