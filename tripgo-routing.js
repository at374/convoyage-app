/* TripGo routing for the mission transport panel. The API key stays on the device.
 * No mission, account, platform session or synchronized setting is written here.
 */
(function(root) {
  'use strict';
  const ENDPOINT = 'https://api.tripgo.com/v1/routing.json';
  const STORAGE_KEY = 'cp_tripgo_device_key';
  const WARNING = 'Transport non confirmé — vérifiez vous-même';
  const MODES = ['pt_pub_bus','pt_pub_coach','pt_pub_expressbus','pt_pub_train',
    'pt_pub_regionaltrain','pt_pub_tram','pt_pub_subway','pt_pub_metro',
    'pt_pub_funicular','pt_pub_cablecar','pt_pub_gondola'];
  const cache = new Map(), pending = new Map();
  let key = '', generation = 0, remembered = false;
  try { key = root.localStorage?.getItem(STORAGE_KEY) || ''; remembered = !!key; } catch (_) {}
  const finite = value => typeof value === 'number' && Number.isFinite(value);
  function validPoint(p) {
    return !!p && finite(p.lat) && finite(p.lon) && Math.abs(p.lat)<=90 &&
      Math.abs(p.lon)<=180 && !(p.lat===0 && p.lon===0);
  }
  function instant(value) {
    if (typeof value !== 'string' || !/(Z|[+-]\d\d:\d\d)$/.test(value)) return NaN;
    return Date.parse(value);
  }
  function configure(value, {remember=false}={}) {
    const next = String(value || '').trim();
    if (next && !/^[A-Za-z0-9_-]{12,160}$/.test(next)) throw new Error('Clé TripGo invalide');
    let saved = false;
    try {
      if (remember && next) { root.localStorage?.setItem(STORAGE_KEY,next); saved=!!root.localStorage; }
      else root.localStorage?.removeItem(STORAGE_KEY);
    } catch (_) { saved=false; }
    key=next; remembered=saved; generation++;
    for (const entry of pending.values()) entry.controller.abort();
    pending.clear(); cache.clear();
    return {active:!!key,remembered};
  }
  function normalize(raw, {departure,arrivalDeadline}={}) {
    if (!raw || !Array.isArray(raw.groups)) throw new Error('Réponse TripGo invalide');
    if (!raw.groups.length) return [];
    if (!Array.isArray(raw.segmentTemplates)) throw new Error('Segments TripGo absents');
    const templates=new Map(raw.segmentTemplates.map(t=>[t.hashCode,t]));
    const earliest=departure ? instant(departure) : -Infinity;
    const latest=arrivalDeadline ? instant(arrivalDeadline) : Infinity;
    const results=[],seen=new Set();
    for (const group of raw.groups) for (const trip of group.trips || []) {
      const start=trip.depart*1000,end=trip.arrive*1000;
      if (!finite(trip.depart)||!finite(trip.arrive)||trip.hideExactTimes || end<start || start<earliest || end>latest) continue;
      const legs=[]; let previous=start,transit=false,valid=true;
      for (const ref of trip.segments || []) {
        const template=templates.get(ref.segmentTemplateHashCode);
        if (!template) {valid=false;break;}
        const s={...template,...ref};
        const mode=s.modeInfo?.identifier || s.modeIdentifier;
        const allowed=MODES.includes(mode) || ['wa_wal','stationary_transfer','stationary_wait'].includes(mode);
        if (!allowed || !finite(s.startTime)||!finite(s.endTime) || s.startTime*1000<previous ||
            s.endTime<s.startTime || s.endTime*1000>end) {valid=false;break;}
        previous=s.endTime*1000; transit ||= MODES.includes(mode);
        legs.push({mode,route:s.serviceNumber || '',from:s.from?.name || s.from?.address || '',
          to:s.to?.name || s.to?.address || '',startTime:s.startTime*1000,endTime:s.endTime*1000,
          operator:s.operator || s.externalData?.operatorName || '',
          walkMeters:mode==='wa_wal' && finite(s.metres) ? s.metres : null});
      }
      if (!valid || !transit || !legs.length) continue;
      const fingerprint=JSON.stringify([start,end,legs.map(l=>[l.mode,l.route,l.from,l.to,l.startTime,l.endTime])]);
      if (seen.has(fingerprint)) continue;
      seen.add(fingerprint);
      results.push({startTime:start,endTime:end,durationSeconds:(end-start)/1000,legs,
        price:null,priceVerified:false,transportConfirmed:false,exactAddressVerified:false,
        status:'horaire_theorique_a_verifier',source:'TripGo'});
    }
    return results.sort((a,b)=>a.endTime-b.endTime || a.startTime-b.startTime).slice(0,60);
  }
  function buildUrl(options) {
    if (!validPoint(options.from)||!validPoint(options.to)) throw new Error('Coordonnées nécessaires');
    const departure=options.departure ? instant(options.departure) : NaN;
    const arrival=options.arrivalDeadline ? instant(options.arrivalDeadline) : NaN;
    if ((options.departure && !finite(departure)) || (options.arrivalDeadline && !finite(arrival)) ||
        (!finite(departure) && !finite(arrival)) || (finite(departure) && finite(arrival) && departure>arrival))
      throw new Error('Heure de recherche invalide');
    const url=new URL(ENDPOINT);
    url.searchParams.set('from',`(${options.from.lat},${options.from.lon})`);
    url.searchParams.set('to',`(${options.to.lat},${options.to.lon})`);
    url.searchParams.set(finite(departure)?'departAfter':'arriveBefore',String(Math.floor((finite(departure)?departure:arrival)/1000)));
    url.searchParams.set('v','11');url.searchParams.set('locale','fr');
    for (const mode of MODES) url.searchParams.append('modes',mode);
    return url;
  }
  async function plan(options) {
    if (!key) return {source:'TripGo',status:'not_configured',itineraries:[]};
    const url=buildUrl(options), fetcher=options.fetcher || root.fetch;
    if (typeof fetcher !== 'function') throw new Error('Réseau indisponible');
    const timeoutMs=options.timeoutMs ?? 20000;
    if (!finite(timeoutMs)||timeoutMs<=0) throw new Error('Délai invalide');
    // Include both constraints: a junction's deadline can differ for the same departure.
    const id=JSON.stringify([generation,url.href,options.arrivalDeadline || '']);
    const cached=cache.get(id);
    if (!options.refresh && cached && Date.now()-cached.at<60000) return {...structuredClone(cached.result),cached:true};
    if (!options.refresh && pending.has(id)) return structuredClone(await pending.get(id).promise);
    if (pending.has(id)) pending.get(id).controller.abort();
    const controller=new AbortController(), credential=key, currentGeneration=generation;
    const task={controller};
    task.promise=(async()=>{
      const timer=setTimeout(()=>controller.abort(),timeoutMs);
      try {
        const response=await fetcher(url.href,{headers:{'X-TripGo-Key':credential,Accept:'application/json'},
          credentials:'omit',referrerPolicy:'no-referrer',cache:'no-store',signal:controller.signal});
        if (!response.ok) return {source:'TripGo',status:[401,403].includes(response.status)?'access_denied':
          response.status===429?'quota_reached':'unavailable',itineraries:[]};
        const text=await response.text();
        if (text.length>8000000) throw new Error('Réponse trop volumineuse');
        const raw=JSON.parse(text);
        if (raw.error || raw.errors) return {source:'TripGo',status:'provider_error',itineraries:[]};
        const itineraries=normalize(raw,options);
        const result={source:'TripGo',status:itineraries.length?'candidates':'no_candidate',itineraries,
          updatedAt:new Date().toISOString(),attribution:'Powered by TripGo',cached:false,
          dataSources:raw.groups.flatMap(g=>g.sources || []).map(s=>({
            name:String(s.provider?.name || ''),disclaimer:String(s.disclaimer || '')})),
          transportConfirmed:false};
        if (currentGeneration===generation && pending.get(id)===task) {
          if (cache.size>=64) cache.delete(cache.keys().next().value);
          cache.set(id,{at:Date.now(),result:structuredClone(result)});
        }
        return result;
      } catch(error) {
        return {source:'TripGo',status:error.name==='AbortError'?'timeout':'unavailable',itineraries:[]};
      } finally {
        clearTimeout(timer);
        if (pending.get(id)===task) pending.delete(id);
      }
    })();
    pending.set(id,task);
    return structuredClone(await task.promise);
  }
  const format=ms=>new Intl.DateTimeFormat('fr-FR',{timeZone:'Europe/Paris',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(ms);
  function mountSettings(container) {
    const d=container.ownerDocument,card=d.createElement('div');card.className='carte plusFiltres';
    const title=d.createElement('h2');title.textContent='Recherche automatique de transports';card.append(title);
    const label=d.createElement('label');label.textContent='Clé TripGo';label.htmlFor='tripgo-device-key';card.append(label);
    const input=d.createElement('input');input.id='tripgo-device-key';input.type='password';
    input.autocomplete='off';input.spellcheck=false;input.placeholder=key?'Une clé est déjà active':'Saisir la clé';card.append(input);
    const remember=d.createElement('input');remember.type='checkbox';remember.checked=remembered;
    remember.style.cssText='width:auto;min-height:0';
    const choice=d.createElement('label');choice.append(remember,d.createTextNode(' Conserver la clé sur ce téléphone'));card.append(choice);
    const info=d.createElement('p');info.className='doux';
    info.textContent='La clé reste sur cet appareil, hors des réglages synchronisés. Les recherches transmettent à TripGo les lieux et horaires du trajet.';card.append(info);
    const status=d.createElement('p');status.className='doux';status.setAttribute('role','status');
    const show=()=>{status.textContent=key?(remembered?'TripGo actif sur ce téléphone.':'TripGo actif pour cette session.'):'TripGo non configuré.';};show();
    const buttons=d.createElement('div');buttons.className='boutons';
    const save=d.createElement('button');save.type='button';save.textContent='Activer TripGo';
    save.onclick=()=>{try{configure(input.value.trim() || key,{remember:remember.checked});input.value='';show();}catch(_){status.textContent='La clé saisie est invalide.';}};
    const remove=d.createElement('button');remove.type='button';remove.className='second';remove.textContent='Retirer la clé';
    remove.onclick=()=>{configure('');input.value='';remember.checked=false;show();};
    buttons.append(save,remove);card.append(buttons,status);container.append(card);return card;
  }
  function mountPanel(container,context) {
    const d=container.ownerDocument,section=d.createElement('section');section.className='doux';
    section.setAttribute('aria-label','Recherche TripGo');
    const title=d.createElement('strong');title.textContent='Transports — recherche complémentaire';section.append(title);
    container.append(section);
    if (!key) {const p=d.createElement('p');p.textContent='Active TripGo dans Paramètres pour compléter les recherches de transports.';section.append(p);return;}
    const jobs=[];
    const latest=instant(context.pickup)-context.marginMinutes*60000;
    const nextLatest=instant(context.nextPickup)-context.marginMinutes*60000;
    if (validPoint(context.home) && validPoint(context.origin) && finite(latest))
      jobs.push(['Aller',context.home,context.origin,null,new Date(latest).toISOString()]);
    if (validPoint(context.destination) && validPoint(context.nextOrigin) && finite(instant(context.delivery)) && finite(nextLatest) && nextLatest>instant(context.delivery))
      jobs.push(['Jonction mission',context.destination,context.nextOrigin,context.delivery,new Date(nextLatest).toISOString()]);
    if (validPoint(context.destination) && validPoint(context.home) && finite(instant(context.delivery)))
      jobs.push(['Retour',context.destination,context.home,context.delivery,null]);
    if (!jobs.length) {const p=d.createElement('p');p.textContent='Coordonnées ou horaires insuffisants pour une recherche TripGo.';section.append(p);return;}
    const note=d.createElement('p');note.textContent='Prix non communiqués : propositions classées par arrivée. Le point de domicile peut être le centre de ta ville. '+WARNING+'.';section.append(note);
    for (const [label,from,to,departure,arrivalDeadline] of jobs) {
      const block=d.createElement('div'),status=d.createElement('p');status.setAttribute('role','status');
      status.textContent=label+' : recherche TripGo…';block.append(status);section.append(block);
      plan({from,to,departure,arrivalDeadline,refresh:context.refresh,fetcher:context.fetcher}).then(answer=>{
        if (!block.isConnected) return;
        const messages={no_candidate:'aucune proposition compatible ; d’autres réseaux peuvent proposer un trajet.',
          access_denied:'clé refusée ; vérifier la clé dans Paramètres.',quota_reached:'quota atteint ; les autres calculateurs restent disponibles.',
          timeout:'réponse trop lente ; les autres calculateurs restent disponibles.',unavailable:'service indisponible.',provider_error:'erreur du calculateur.',not_configured:'clé non configurée.'};
        status.textContent=label+' : '+(answer.itineraries.length?answer.itineraries.length+' proposition(s) indicatives.':messages[answer.status] || 'aucune réponse exploitable.');
        const render=(parent,item)=>{
          const row=d.createElement('details'),summary=d.createElement('summary');
          summary.textContent=format(item.startTime)+' → '+format(item.endTime)+' · '+Math.round(item.durationSeconds/60)+' min · '+
            item.legs.filter(l=>MODES.includes(l.mode)).map(l=>[l.route,l.operator].filter(Boolean).join(' ')).join(' · ');
          row.append(summary);
          for (const leg of item.legs) {const p=d.createElement('p');p.textContent=format(leg.startTime)+' → '+format(leg.endTime)+' · '+
            (leg.mode==='wa_wal'?'Marche':leg.route || leg.mode)+' · '+leg.from+' → '+leg.to;row.append(p);}
          const p=d.createElement('p');p.textContent='Tarif à vérifier. '+WARNING+'.';row.append(p);parent.append(row);
        };
        answer.itineraries.slice(0,3).forEach(it=>render(block,it));
        if(answer.itineraries.length>3){const more=d.createElement('details'),summary=d.createElement('summary');summary.textContent='Voir les '+(answer.itineraries.length-3)+' autres propositions';more.append(summary);answer.itineraries.slice(3).forEach(it=>render(more,it));block.append(more);}
        if (answer.updatedAt) {const stamp=d.createElement('p');stamp.textContent='Réponse du calculateur reçue le '+format(Date.parse(answer.updatedAt))+(answer.cached?' · cache de moins d’une minute':'');block.append(stamp);}
        const credits=d.createElement('p');credits.textContent='Powered by TripGo'+(answer.dataSources?.length?' · '+[...new Set(answer.dataSources.map(s=>s.name).filter(Boolean))].join(' · '):'');block.append(credits);
        for (const text of [...new Set((answer.dataSources || []).map(s=>s.disclaimer).filter(Boolean))]) {const credit=d.createElement('p');credit.textContent=text;block.append(credit);}
      }).catch(()=>{if(block.isConnected)status.textContent=label+' : recherche indisponible. '+WARNING+'.';});
    }
  }
  const api={configure,normalize,buildUrl,plan,mountSettings,mountPanel,
    status:()=>({active:!!key,remembered})};
  root.CPTripGo=api;
  if(typeof module!=='undefined' && module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
