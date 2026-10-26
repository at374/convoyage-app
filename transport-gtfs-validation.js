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
    calendrierPresent:typeof fichiers['calendar.txt']==='string'||
      typeof fichiers['calendar_dates.txt']==='string'};
}
const api={csv,heureGTFS,analyser};
root.CPGTFSValidation=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
