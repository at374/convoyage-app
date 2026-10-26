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
  if(y<100||m<1||m>12||d<1||d>31)return false;
  const x=new Date(0);
  x.setUTCFullYear(y,m-1,d);
  x.setUTCHours(0,0,0,0);
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
  const jourDate=new Date(0);
  jourDate.setUTCFullYear(Number(date.slice(0,4)),Number(date.slice(4,6))-1,Number(date.slice(6,8)));
  const jour=['sunday','monday','tuesday','wednesday','thursday','friday','saturday'][jourDate.getUTCDay()];
  return ligne[jour]==='1';
}
// Courses prévues à une date civile, sans inventer de temps réel.
// Les heures GTFS sont conservées en secondes depuis minuit du jour de service.
function coursesDuJour(fichiers, date, options={}){
  if(!dateGTFS(date))throw new Error('Date GTFS invalide');
  const courses=csv(fichiers['trips.txt']||'');
  const passages=csv(fichiers['stop_times.txt']||'');
  const arrets=csv(fichiers['stops.txt']||'');
  const lignes=csv(fichiers['routes.txt']||'');
  const arretsConnus=new Set(arrets.map(s=>s.stop_id));
  const lignesConnues=new Set(lignes.map(l=>l.route_id));
  const services=new Map();
  const serviceActif=preparerCalendrier(fichiers);
  const actives=new Map();
  // GTFS peut contenir des fréquences (frequencies.txt) : les passages
  // stop_times y sont des modèles, pas nécessairement des départs réels.
  // Ne jamais annoncer ces modèles comme des horaires fixes.
  const frequences=typeof fichiers['frequencies.txt']==='string'
    ? csv(fichiers['frequencies.txt']) : [];
  const tripsFrequence=new Set(frequences.map(f=>f.trip_id).filter(Boolean));
  for(const t of courses){
    if(!services.has(t.service_id))
      services.set(t.service_id,serviceActif(t.service_id,date));
    if(services.get(t.service_id)&&lignesConnues.has(t.route_id)&&!tripsFrequence.has(t.trip_id))
      actives.set(t.trip_id,{tripId:t.trip_id,routeId:t.route_id,serviceId:t.service_id,passages:[]});
  }
  for(const p of passages){
    const course=actives.get(p.trip_id);
    if(!course||!arretsConnus.has(p.stop_id))continue;
    const arrivee=heureGTFS(p.arrival_time),depart=heureGTFS(p.departure_time);
    if(arrivee===null||depart===null||depart<arrivee)continue;
    const ordre=Number(p.stop_sequence);
    if(!Number.isInteger(ordre)||ordre<0)continue;
    course.passages.push({stopId:p.stop_id,ordre,arriveeSecondes:arrivee,departSecondes:depart});
  }
  const resultats=[];
  for(const course of actives.values()){
    course.passages.sort((a,b)=>a.ordre-b.ordre);
    if(course.passages.length<2)continue;
    let coherent=true;
    for(let i=1;i<course.passages.length;i++)
      if(course.passages[i].arriveeSecondes<course.passages[i-1].departSecondes ||
         course.passages[i].ordre===course.passages[i-1].ordre)coherent=false;
    if(coherent)resultats.push(course);
  }
  const limite=Number.isInteger(options.limite)&&options.limite>0?Math.min(options.limite,100000):100000;
  return resultats.slice(0,limite);
}
// Recherche de trajets directs entre deux arrêts officiels sur un jour de service.
// Horaires en secondes GTFS : pas de conversion hasardeuse de fuseau ni de tarif estimé.
function trajetsDirects(fichiers,date,departStopId,arriveeStopId,options={}){
  if(!departStopId||!arriveeStopId||departStopId===arriveeStopId)return [];
  const apres=options.departApresSecondes==null?0:Number(options.departApresSecondes);
  const avant=options.arriveeAvantSecondes==null?172799:Number(options.arriveeAvantSecondes);
  if(!Number.isInteger(apres)||!Number.isInteger(avant)||apres<0||avant>172799||avant<apres)return [];
  const sorties=[];
  // Les passages après minuit peuvent appartenir au service de la veille.
  // Cette recherche utilise volontairement la date de service GTFS, et non
  // la date civile du passage ; l'appelant doit en tenir compte.
  for(const course of coursesDuJour(fichiers,date)){
    const p=course.passages;
    for(let i=0;i<p.length-1;i++){
      if(p[i].stopId!==departStopId||p[i].departSecondes<apres)continue;
      for(let j=i+1;j<p.length;j++){
        if(p[j].stopId!==arriveeStopId||p[j].arriveeSecondes>avant||p[j].arriveeSecondes<p[i].departSecondes)continue;
        sorties.push({tripId:course.tripId,routeId:course.routeId,
          departStopId,arriveeStopId,dateService:date,
          departSecondes:p[i].departSecondes,arriveeSecondes:p[j].arriveeSecondes,
          source:'GTFS statique',tempsReel:false,prixEUR:null});
        break;
      }
    }
  }
  sorties.sort((a,b)=>a.arriveeSecondes-b.arriveeSecondes||a.departSecondes-b.departSecondes);
  const limite=Number.isInteger(options.limite)&&options.limite>0?Math.min(options.limite,200):30;
  return sorties.slice(0,limite);
}
// Résolution des passages GTFS après minuit : les heures 24:xx et plus
// sont rattachées au jour civil suivant sans changer le jour de service.
function datePassageGTFS(dateService,secondes){
  if(!dateGTFS(dateService)||!Number.isInteger(secondes)||secondes<0||secondes>=172800)
    throw new Error('Date ou secondes GTFS invalides');
  const date=new Date(0);
  date.setUTCFullYear(Number(dateService.slice(0,4)),Number(dateService.slice(4,6))-1,Number(dateService.slice(6,8)));
  date.setUTCHours(0,0,0,0);
  date.setUTCSeconds(secondes);
  const y=String(date.getUTCFullYear()).padStart(4,'0');
  const m=String(date.getUTCMonth()+1).padStart(2,'0');
  const d=String(date.getUTCDate()).padStart(2,'0');
  const h=String(date.getUTCHours()).padStart(2,'0');
  const min=String(date.getUTCMinutes()).padStart(2,'0');
  const s=String(date.getUTCSeconds()).padStart(2,'0');
  return {date:y+m+d,heure:h+':'+min+':'+s,jourSupplementaire:Math.floor(secondes/86400)};
}
// Recherche à date civile : inclut les courses de la veille passant après minuit.
// Ne convertit pas les heures GTFS en instants UTC (fuseau agence inconnu).
function trajetsDateCivile(fichiers,dateCivile,departStopId,arriveeStopId,options={}){
  if(!dateGTFS(dateCivile))throw new Error('Date civile invalide');
  const jour=new Date(0);
  jour.setUTCFullYear(Number(dateCivile.slice(0,4)),Number(dateCivile.slice(4,6))-1,Number(dateCivile.slice(6,8)));
  jour.setUTCHours(0,0,0,0);
  jour.setUTCDate(jour.getUTCDate()-1);
  const veille=String(jour.getUTCFullYear()).padStart(4,'0')+
    String(jour.getUTCMonth()+1).padStart(2,'0')+
    String(jour.getUTCDate()).padStart(2,'0');
  const apres=options.departApresSecondes==null?0:Number(options.departApresSecondes);
  const avant=options.arriveeAvantSecondes==null?86399:Number(options.arriveeAvantSecondes);
  if(!Number.isInteger(apres)||!Number.isInteger(avant)||apres<0||avant>86399||avant<apres)return [];
  const resultats=[];
  for(const serviceDate of [veille,dateCivile]){
    const decalage=serviceDate===veille?86400:0;
    const directs=trajetsDirects(fichiers,serviceDate,departStopId,arriveeStopId,{
      departApresSecondes:apres+decalage,
      arriveeAvantSecondes:avant+decalage,limite:200
    });
    for(const trajet of directs)resultats.push({
      ...trajet,dateDepart:datePassageGTFS(serviceDate,trajet.departSecondes),
      dateArrivee:datePassageGTFS(serviceDate,trajet.arriveeSecondes)
    });
  }
  resultats.sort((a,b)=>a.dateDepart.heure.localeCompare(b.dateDepart.heure)||
    a.dateArrivee.heure.localeCompare(b.dateArrivee.heure));
  const limite=Number.isInteger(options.limite)&&options.limite>0?Math.min(options.limite,200):30;
  return resultats.slice(0,limite);
}
// Construit un index de services pour éviter de reparcourir les CSV de
// calendrier à chaque course d'un gros réseau. Les exceptions priment.
function preparerCalendrier(fichiers){
  const calendrier=typeof fichiers['calendar.txt']==='string'?csv(fichiers['calendar.txt']):[];
  const exceptions=typeof fichiers['calendar_dates.txt']==='string'?csv(fichiers['calendar_dates.txt']):[];
  const services=new Map(),jours=new Map();
  for(const s of calendrier){
    if(!s.service_id||services.has(s.service_id))throw new Error('Service GTFS dupliqué ou vide');
    services.set(s.service_id,s);
  }
  for(const x of exceptions){
    if(!x.service_id||!dateGTFS(x.date)||!['1','2'].includes(x.exception_type))
      throw new Error('Exception GTFS invalide');
    const cle=x.service_id+'|'+x.date;
    if(jours.has(cle)&&jours.get(cle)!==x.exception_type)
      throw new Error('Exceptions GTFS contradictoires');
    jours.set(cle,x.exception_type);
  }
  return function serviceActif(serviceId,date){
    if(!dateGTFS(date)||!serviceId)throw new Error('Service ou date GTFS invalide');
    const exception=jours.get(serviceId+'|'+date);
    if(exception)return exception==='1';
    const s=services.get(serviceId);
    if(!s||!dateGTFS(s.start_date)||!dateGTFS(s.end_date)||
       date<s.start_date||date>s.end_date)return false;
    const d=new Date(0);
    d.setUTCFullYear(Number(date.slice(0,4)),Number(date.slice(4,6))-1,Number(date.slice(6,8)));
    const jour=['sunday','monday','tuesday','wednesday','thursday','friday','saturday'][d.getUTCDay()];
    return s[jour]==='1';
  };
}
// Prépare les données d'un réseau une seule fois pour les requêtes répétées.
// Les données restent en mémoire ; aucune connexion ni requête payante.
function preparerReseau(fichiers){
  const verification=analyser(fichiers);
  if(!verification.valide)throw new Error('GTFS invalide: '+verification.erreurs.slice(0,3).join('; '));
  const services=preparerCalendrier(fichiers);
  const servicesActifsParDate=new Map();
  function actif(serviceId,date){
    let jour=servicesActifsParDate.get(date);
    if(!jour){
      jour=new Map();
      servicesActifsParDate.set(date,jour);
      // Borne le cache pour éviter une croissance illimitée en navigation.
      if(servicesActifsParDate.size>14)
        servicesActifsParDate.delete(servicesActifsParDate.keys().next().value);
    }
    if(!jour.has(serviceId))jour.set(serviceId,services(serviceId,date));
    return jour.get(serviceId);
  }
  const arrets=new Set(csv(fichiers['stops.txt']).map(x=>x.stop_id));
  const lignes=new Set(csv(fichiers['routes.txt']).map(x=>x.route_id));
  const frequences=new Set((typeof fichiers['frequencies.txt']==='string'
    ?csv(fichiers['frequencies.txt']):[]).map(x=>x.trip_id));
  const courses=new Map();
  for(const t of csv(fichiers['trips.txt'])){
    if(!lignes.has(t.route_id)||frequences.has(t.trip_id))continue;
    courses.set(t.trip_id,{tripId:t.trip_id,routeId:t.route_id,
      serviceId:t.service_id,passages:[]});
  }
  for(const p of csv(fichiers['stop_times.txt'])){
    const t=courses.get(p.trip_id);
    if(!t||!arrets.has(p.stop_id))continue;
    const a=heureGTFS(p.arrival_time),d=heureGTFS(p.departure_time),ordre=Number(p.stop_sequence);
    if(a===null||d===null||d<a||!Number.isInteger(ordre)||ordre<0)continue;
    t.passages.push({stopId:p.stop_id,ordre,arriveeSecondes:a,departSecondes:d});
  }
  const index=[];
  for(const t of courses.values()){
    t.passages.sort((a,b)=>a.ordre-b.ordre);
    if(t.passages.length<2)continue;
    if(t.passages.some((p,i)=>i>0&&(p.ordre<=t.passages[i-1].ordre||
      p.arriveeSecondes<t.passages[i-1].departSecondes)))continue;
    index.push(t);
  }
  return Object.freeze({
    compteurs:verification.compteurs,
    coursesDuJour(date,options={}){
      if(!dateGTFS(date))throw new Error('Date GTFS invalide');
      const limite=Number.isInteger(options.limite)&&options.limite>0
        ?Math.min(options.limite,100000):100000;
      return index.filter(t=>actif(t.serviceId,date)).slice(0,limite);
    },
    trajetsDirects(date,depart,arrivee,options={}){
      if(!dateGTFS(date))throw new Error('Date GTFS invalide');
      if(!depart||!arrivee||depart===arrivee)return [];
      const apres=options.departApresSecondes==null?0:Number(options.departApresSecondes);
      const avant=options.arriveeAvantSecondes==null?172799:Number(options.arriveeAvantSecondes);
      if(!Number.isInteger(apres)||!Number.isInteger(avant)||apres<0||avant>172799||avant<apres)return [];
      const sorties=[];
      for(const t of index){
        if(!actif(t.serviceId,date))continue;
        for(let i=0;i<t.passages.length-1;i++){
          const p=t.passages[i];
          if(p.stopId!==depart||p.departSecondes<apres)continue;
          for(let j=i+1;j<t.passages.length;j++){
            const q=t.passages[j];
            if(q.stopId!==arrivee||q.arriveeSecondes>avant||q.arriveeSecondes<p.departSecondes)continue;
            sorties.push({tripId:t.tripId,routeId:t.routeId,departStopId:depart,
              arriveeStopId:arrivee,dateService:date,departSecondes:p.departSecondes,
              arriveeSecondes:q.arriveeSecondes,source:'GTFS statique',
              tempsReel:false,prixEUR:null});
            break;
          }
        }
      }
      sorties.sort((a,b)=>a.arriveeSecondes-b.arriveeSecondes||
        a.departSecondes-b.departSecondes);
      const limite=Number.isInteger(options.limite)&&options.limite>0
        ?Math.min(options.limite,200):30;
      return sorties.slice(0,limite);
    }
  });
}
// Cherche sur un index préparé sans relire les fichiers CSV.
// Le jour civil inclut les passages du service de la veille après minuit.
function trajetsDateCivileIndex(index,dateCivile,depart,arrivee,options={}){
  if(!index||typeof index.trajetsDirects!=='function')
    throw new TypeError('Index GTFS préparé requis');
  if(!dateGTFS(dateCivile))throw new Error('Date civile invalide');
  const apres=options.departApresSecondes==null?0:Number(options.departApresSecondes);
  const avant=options.arriveeAvantSecondes==null?86399:Number(options.arriveeAvantSecondes);
  if(!Number.isInteger(apres)||!Number.isInteger(avant)||apres<0||avant>86399||avant<apres)return [];
  const d=new Date(0);
  d.setUTCFullYear(Number(dateCivile.slice(0,4)),Number(dateCivile.slice(4,6))-1,Number(dateCivile.slice(6,8)));
  d.setUTCHours(0,0,0,0);
  d.setUTCDate(d.getUTCDate()-1);
  const veille=String(d.getUTCFullYear()).padStart(4,'0')+
    String(d.getUTCMonth()+1).padStart(2,'0')+
    String(d.getUTCDate()).padStart(2,'0');
  const resultats=[];
  for(const [date,decalage] of [[veille,86400],[dateCivile,0]]){
    for(const trajet of index.trajetsDirects(date,depart,arrivee,{
      departApresSecondes:apres+decalage,
      arriveeAvantSecondes:avant+decalage,
      limite:200
    })){
      resultats.push({...trajet,
        dateDepart:datePassageGTFS(date,trajet.departSecondes),
        dateArrivee:datePassageGTFS(date,trajet.arriveeSecondes)});
    }
  }
  resultats.sort((a,b)=>a.dateDepart.heure.localeCompare(b.dateDepart.heure)||
    a.dateArrivee.heure.localeCompare(b.dateArrivee.heure));
  const limite=Number.isInteger(options.limite)&&options.limite>0
    ?Math.min(options.limite,200):30;
  return resultats.slice(0,limite);
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
  // Vérifier les dates, exceptions et plages de validité avant toute recherche.
  for(const s of calendrier){
    if(!dateGTFS(s.start_date)||!dateGTFS(s.end_date)||s.start_date>s.end_date)
      erreurs.push('calendrier invalide: '+(s.service_id||'?'));
    for(const jour of ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'])
      if(s[jour]!=='0'&&s[jour]!=='1')
        erreurs.push('jour de circulation invalide: '+(s.service_id||'?')+'/'+jour);
  }
  for(const x of exceptions){
    if(!dateGTFS(x.date)||!['1','2'].includes(x.exception_type))
      erreurs.push('exception invalide: '+(x.service_id||'?')+'/'+(x.date||'?'));
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
const api={csv,heureGTFS,dateGTFS,circule,coursesDuJour,trajetsDirects,trajetsDateCivile,datePassageGTFS,preparerCalendrier,preparerReseau,trajetsDateCivileIndex,analyser};
root.CPGTFSValidation=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
