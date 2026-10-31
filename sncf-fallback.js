/* SNCF GTFS fallback — station-to-station theoretical schedules only.
 * Public data: SNCF Voyageurs, ODbL and producer conditions.
 * No mission/auth/settings writes and no personal locations sent to a provider.
 */
(function(root){
  'use strict';
  const BASE='data/sncf/';
  const cache=new Map(),pending=new Map();
  const norm=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  function validDate(value){return /^20\d{2}-\d{2}-\d{2}$/.test(value)&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;}
  function localDate(value){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));}
  function serviceBase(day){
    if(!validDate(day))throw Error('Date SNCF invalide');
    const noon=Date.parse(day+'T12:00:00Z');
    const offset=new Intl.DateTimeFormat('en-US',{timeZone:'Europe/Paris',timeZoneName:'shortOffset'}).formatToParts(new Date(noon)).find(p=>p.type==='timeZoneName').value;
    const m=/^GMT([+-])(\d{1,2})(?::(\d{2}))?$/.exec(offset);
    if(!m)throw Error('Fuseau Paris indisponible');
    return noon-(m[1]==='+'?1:-1)*(Number(m[2])*60+Number(m[3]||0))*60000-43200000;
  }
  function point(p){return p&&p.lat!=null&&(p.lon!=null||p.lng!=null)&&p.lat!==''&&(p.lon??p.lng)!==''&&
    Number.isFinite(Number(p.lat))&&Number.isFinite(Number(p.lon??p.lng))&&Math.abs(Number(p.lat))<=90&&Math.abs(Number(p.lon??p.lng))<=180&&!(Number(p.lat)===0&&Number(p.lon??p.lng)===0);}
  function distance(a,b){const rad=x=>x*Math.PI/180,lat=rad(b[2]-Number(a.lat)),lon=rad(b[3]-Number(a.lon??a.lng));const h=Math.sin(lat/2)**2+Math.cos(rad(Number(a.lat)))*Math.cos(rad(b[2]))*Math.sin(lon/2)**2;return 6371000*2*Math.asin(Math.min(1,Math.sqrt(h)));}
  function stationsFor(query,stations){
    const name=norm(typeof query==='string'?query:query?.name);
    const exact=name?stations.map((s,i)=>({s,i})).filter(x=>norm(x.s[1])===name):[];
    if(exact.length){
      if(point(query?.point))return exact.map(x=>({index:x.i,name:x.s[1],distanceMeters:distance(query.point,x.s)})).filter(x=>x.distanceMeters<=20000).sort((a,b)=>a.distanceMeters-b.distanceMeters).slice(0,3);
      return exact.length===1?[{index:exact[0].i,name:exact[0].s[1],distanceMeters:null}]:[];
    }
    if(point(query?.point))return stations.map((s,i)=>({index:i,name:s[1],distanceMeters:distance(query.point,s)})).filter(x=>x.distanceMeters<=20000).sort((a,b)=>a.distanceMeters-b.distanceMeters).slice(0,3);
    if(!name)return [];
    return stations.map((s,i)=>({index:i,name:s[1]})).filter(x=>norm(x.name).startsWith(name+' ')).slice(0,12);
  }
  function validateDay(data,day,sha){
    if(!data||data.schemaVersion!==1||data.date!==day||data.timeZone!=='Europe/Paris'||data.sourceSha256!==sha||data.realtime!==false||data.transportConfirmed!==false||!Array.isArray(data.stations)||data.stations.length>15000||!Array.isArray(data.trips)||data.trips.length>30000)throw Error('Index SNCF invalide');
    const ids=new Set();
    for(const s of data.stations){if(!Array.isArray(s)||typeof s[0]!=='string'||ids.has(s[0])||typeof s[1]!=='string'||!Number.isFinite(s[2])||!Number.isFinite(s[3])||Math.abs(s[2])>90||Math.abs(s[3])>180)throw Error('Gare SNCF invalide');ids.add(s[0]);}
    const trips=new Set();
    for(const t of data.trips){if(!Array.isArray(t)||typeof t[0]!=='string'||trips.has(t[0])||!Array.isArray(t[3])||t[3].length<2||t[3].length>1000)throw Error('Course SNCF invalide');trips.add(t[0]);
      let previous=-1;for(const e of t[3]){if(!Array.isArray(e)||e.length!==5||!e.every(Number.isInteger)||e[0]<0||e[0]>=data.stations.length||e[1]<previous||e[1]<0||e[2]<e[1]||e[2]>259199||e[3]<0||e[3]>3||e[4]<0||e[4]>3)throw Error('Horaire SNCF invalide');previous=e[2];}}
    return data;
  }
  const abortError=()=>new DOMException('Recherche SNCF annulée','AbortError');
  function checkSignal(signal){if(signal?.aborted)throw abortError();}
  async function json(url,fetcher,signal){
    checkSignal(signal);
    const controller=new AbortController(),cancel=()=>controller.abort();
    signal?.addEventListener('abort',cancel,{once:true});
    const timer=setTimeout(cancel,8000);
    try{
      const r=await fetcher(url,{signal:controller.signal,cache:'no-cache',credentials:'omit',referrerPolicy:'no-referrer'});
      checkSignal(controller.signal);if(!r.ok)throw Error('Index SNCF indisponible ('+r.status+')');
      const data=await r.json();checkSignal(controller.signal);return data;
    }finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);}
  }
  async function loadDay(day,manifest,fetcher,signal){
    checkSignal(signal);
    const resource=manifest.dates[day];if(!resource||resource.file!=='sncf-'+day+'.json'||!/^[a-f0-9]{64}$/.test(resource.sha256))throw Error('Calendrier SNCF non publié pour '+day);
    const key=manifest.sourceSha256+'|'+resource.sha256+'|'+day;
    if(cache.has(key))return cache.get(key);
    let entry=pending.get(key);
    if(!entry||entry.controller.signal.aborted){
      entry={controller:new AbortController(),users:new Set(),settled:false};const current=entry;
      current.promise=json(BASE+resource.file+'?v='+resource.sha256.slice(0,16),fetcher,current.controller.signal).then(value=>{
        checkSignal(current.controller.signal);
        const data=validateDay(value,day,manifest.sourceSha256);
        if(cache.size>=16)cache.delete(cache.keys().next().value);cache.set(key,data);return data;
      }).finally(()=>{current.settled=true;if(pending.get(key)===current)pending.delete(key);});
      pending.set(key,current);
    }
    return new Promise((resolve,reject)=>{
      const user={};let finished=false;entry.users.add(user);
      const cleanup=()=>{
        entry.users.delete(user);signal?.removeEventListener('abort',cancel);
        if(!entry.settled&&!entry.users.size){entry.controller.abort();if(pending.get(key)===entry)pending.delete(key);}
      };
      const cancel=()=>{if(finished)return;finished=true;cleanup();reject(abortError());};
      signal?.addEventListener('abort',cancel,{once:true});
      entry.promise.then(value=>{if(finished)return;finished=true;cleanup();resolve(value);},error=>{if(finished)return;finished=true;cleanup();reject(error);});
      if(signal?.aborted)cancel();
    });
  }
  function search(days,options){
    const threshold=Date.parse(options.when);if(!Number.isFinite(threshold)||!/[zZ]|[+-]\d{2}:\d{2}$/.test(options.when))throw Error('Date avec fuseau requise');
    const latest=options.latestArrival===undefined?null:Date.parse(options.latestArrival);
    if(latest!==null&&(!Number.isFinite(latest)||!/[zZ]|[+-]\d{2}:\d{2}$/.test(options.latestArrival)))throw Error('Arrivée limite SNCF invalide');
    const margin=options.transferMinutes??10;if(!Number.isInteger(margin)||margin<5||margin>120)throw Error('Marge ferroviaire invalide');
    const limit=options.limit??5;if(!Number.isInteger(limit)||limit<1||limit>10)throw Error('Limite SNCF invalide');
    const first=[],second=new Map(),direct=[];let originFound=false,destinationFound=false;
    const makeLeg=(data,t,a,b,base)=>({source:'SNCF GTFS',serviceDate:data.date,tripId:t[0],line:t[1],trainNumber:t[2]||null,from:data.stations[a[0]][1],to:data.stations[b[0]][1],fromStationId:data.stations[a[0]][0],toStationId:data.stations[b[0]][0],departure:base+a[2]*1000,arrival:base+b[1]*1000});
    for(const data of days){
      const origins=new Set(stationsFor(options.from,data.stations).map(s=>s.index));
      const destinations=new Set(stationsFor(options.to,data.stations).map(s=>s.index));
      originFound ||= origins.size>0;destinationFound ||= destinations.size>0;
      const base=serviceBase(data.date);
      for(const t of data.trips){const events=t[3];
        for(let i=0;i<events.length-1;i++){const a=events[i];if(a[3]!==0)continue;
          for(let j=i+1;j<events.length;j++){const b=events[j];if(b[4]!==0)continue;
            const dep=base+a[2]*1000,arr=base+b[1]*1000;
            if(a[0]===b[0]||arr<dep||arr-dep>43200000||(latest!==null&&arr>latest))continue;
            const fromHere=origins.has(a[0]),toHere=destinations.has(b[0]);
            if(fromHere&&toHere&&(!options.arriveBy?dep>=threshold:arr<=threshold))direct.push({legs:[makeLeg(data,t,a,b,base)],departure:dep,arrival:arr});
            if(fromHere&&!destinations.has(a[0])&&(!options.arriveBy?dep>=threshold:dep>=threshold-43200000)&&arr<=threshold+43200000){first.push(makeLeg(data,t,a,b,base));}
            if(toHere&&(!options.arriveBy?dep>=threshold:arr<=threshold)&&dep>=threshold-43200000){const id=data.stations[a[0]][0];if(!second.has(id))second.set(id,[]);second.get(id).push(makeLeg(data,t,a,b,base));}
          }
        }
      }
    }
    const combined=[];let combinations=0,truncated=false;
    outer:for(const a of first){for(const b of second.get(a.toStationId)||[]){
      if(++combinations>200000){truncated=true;break outer;}
      const wait=b.departure-a.arrival;if(wait<margin*60000||wait>7200000||b.arrival-a.departure>43200000||(a.tripId===b.tripId&&a.serviceDate===b.serviceDate)||a.fromStationId===b.toStationId)continue;
      combined.push({legs:[a,b],departure:a.departure,arrival:b.arrival,transferMinutes:wait/60000,transferWalkingVerified:false});
    }}
    const useful=combined.filter(x=>!direct.some(d=>d.legs[0].tripId===x.legs[0].tripId&&d.legs[0].serviceDate===x.legs[0].serviceDate&&d.legs[0].fromStationId===x.legs[0].fromStationId&&d.arrival<=x.arrival));
    const all=[...direct,...useful],seen=new Set();
    all.sort((a,b)=>options.arriveBy?b.departure-a.departure||a.legs.length-b.legs.length||a.arrival-b.arrival:a.departure-b.departure||a.arrival-b.arrival||a.legs.length-b.legs.length);
    const results=all.filter(x=>{const key=x.legs.map(l=>l.tripId+'|'+l.serviceDate+'|'+l.fromStationId+'|'+l.toStationId+'|'+l.departure).join(';');if(seen.has(key))return false;seen.add(key);return true;}).slice(0,limit).map(x=>({...x,departure:new Date(x.departure).toISOString(),arrival:new Date(x.arrival).toISOString(),price:null,transportConfirmed:false,realtime:false,walkingVerified:false}));
    return {status:!originFound||!destinationFound?'stations_not_found':results.length?'ok':'no_trains_in_loaded_days',itineraries:results,truncated,serviceDates:days.map(d=>d.date),transportConfirmed:false,realtime:false};
  }
  async function plan(options){
    const fetcher=options.fetcher||((...args)=>root.fetch(...args));
    if(typeof fetcher!=='function'||!Number.isFinite(Date.parse(options.when)))throw Error('Requête SNCF invalide');
    checkSignal(options.signal);
    const manifest=await json(BASE+'manifest.json',fetcher,options.signal);
    if(manifest.schemaVersion!==1||!manifest.dates||!/^[a-f0-9]{64}$/.test(manifest.sourceSha256))throw Error('Catalogue SNCF invalide');
    const day=localDate(options.when);if(!manifest.dates[day])throw Error('Calendrier SNCF non publié pour '+day);
    const previous=new Date(Date.parse(day+'T12:00:00Z')-86400000).toISOString().slice(0,10);
    const dates=[...(manifest.dates[previous]?[previous]:[]),day];
    const days=await Promise.all(dates.map(d=>loadDay(d,manifest,fetcher,options.signal)));
    checkSignal(options.signal);
    return {...search(days,options),sourceVersion:manifest.sourceVersion,sourceSha256:manifest.sourceSha256,licenseUrl:manifest.licenseUrl};
  }
  const api={plan,search,stationsFor,validateDay,serviceBase};root.CPSncfFallback=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
