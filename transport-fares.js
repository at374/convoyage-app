/* Conservative fare calculation: never infer prices or pass validity from GTFS.
 * All amounts are EUR and must come from a verified source.
 */
(function(root){
  'use strict';
  function money(value){
    if(typeof value!=='number'||!Number.isFinite(value)||value<0)return null;
    const cents=value*100;
    return Number.isSafeInteger(Math.round(cents))&&Math.abs(cents-Math.round(cents))<1e-7?Math.round(cents)/100:null;
  }
  function validForTravel(leg,travelDate){
    if(travelDate==null)return true;
    const when=Date.parse(travelDate);
    if(!Number.isFinite(when))return false;
    const startValue=leg?.fareValidFrom,endValue=leg?.fareValidUntil;
    // Date-only validity is inclusive for the full local boarding day.
    const dateOnly=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&
      Number.isFinite(Date.parse(value))&&new Date(Date.parse(value)).toISOString().slice(0,10)===value;
    const boardingDay=typeof travelDate==='string'&&/^\d{4}-\d{2}-\d{2}/.test(travelDate)?travelDate.slice(0,10):null;
    const start=dateOnly(startValue)?Date.parse(startValue+'T00:00:00Z'):Date.parse(startValue);
    const end=dateOnly(endValue)?Date.parse(endValue+'T23:59:59.999Z'):Date.parse(endValue);
    if((typeof startValue==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(startValue)&&!dateOnly(startValue))||
       (typeof endValue==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(endValue)&&!dateOnly(endValue)))return false;
    if(!Number.isFinite(start)||!Number.isFinite(end)||start>end)return false;
    if(dateOnly(startValue)&&boardingDay&&boardingDay<startValue)return false;
    if(dateOnly(endValue)&&boardingDay&&boardingDay>endValue)return false;
    return (dateOnly(startValue)&&boardingDay?true:start<=when)&&
      (dateOnly(endValue)&&boardingDay?true:when<=end);
  }
  function fare(legs,options={}){
    options=options&&typeof options==='object'?options:{};
    const items=Array.isArray(legs)?legs:[];
    if(!items.length)return {totalEUR:null,known:false,knownSubtotalEUR:0,unknownLegCount:0,breakdown:[],status:'Tarif non vérifié'};
    const breakdown=items.map(leg=>{
      // A later boarding can fall on another day (or after a pass expires).
      // The itinerary's date is only a fallback for legs without a departure.
      const travelDate=leg?.departure??options.travelDate;
      // A numerical amount is not evidence: require an explicit verified source.
      // Walking and stationary transfer/wait legs are not ticketed rides.
      const nonTicketed=leg?.mode==='wa_wal'||leg?.mode==='stationary_transfer'||leg?.mode==='stationary_wait';
      const price=!nonTicketed&&leg?.fareVerified===true && typeof leg?.fareSource==='string' && leg.fareSource.trim() && validForTravel(leg,travelDate)?money(leg.verifiedPriceEUR):null;
      const covered=!nonTicketed&&Boolean((travelDate==null || (leg?.passValidFrom && leg?.passValidUntil && validForTravel({fareValidFrom:leg.passValidFrom,fareValidUntil:leg.passValidUntil},travelDate)))&&leg?.passAccepted===true&&
        leg?.passProduct==='SIBRA'&&options.sibraPassActive===true&&
        leg?.passEligibilityVerified===true&&
        typeof leg?.passEligibilitySource==='string'&&leg.passEligibilitySource.trim());
      return {provider:leg?.provider||(nonTicketed?'Marche / correspondance':'Inconnu'),nonTicketed,amountEUR:nonTicketed||covered?0:price,
        passApplied:!nonTicketed&&covered,verified:nonTicketed||covered||price!==null,
        source:nonTicketed?'Aucun titre de transport requis':covered?leg.passEligibilitySource:price!==null?leg.fareSource:null,
        validFrom:covered?leg.passValidFrom||null:price!==null?leg.fareValidFrom||null:null,
        validUntil:covered?leg.passValidUntil||null:price!==null?leg.fareValidUntil||null:null};
    });
    const known=breakdown.every(x=>x.verified);
    const knownSubtotalEUR=breakdown.reduce((cents,x)=>cents+(x.verified?Math.round(x.amountEUR*100):0),0)/100;
    const unknownLegCount=breakdown.filter(x=>!x.verified).length;
    const totalEUR=known?knownSubtotalEUR:null;
    const noTicketRequired=breakdown.every(x=>x.nonTicketed);
    return {totalEUR,known,knownSubtotalEUR,unknownLegCount,breakdown,status:noTicketRequired?'Aucun billet requis':known?'Tarif vérifié':'Tarif non vérifié'};
  }
  function describe(result){
    if(!result||!Array.isArray(result.breakdown))return 'Tarif non vérifié';
    const portions=result.breakdown.map((leg,index)=>{
      const name=String(leg.provider||'Portion '+(index+1));
      if(leg.nonTicketed)return name+' : sans billet';
      if(leg.passApplied)return name+' : 0,00 € (abonnement vérifié)';
      return name+' : '+(leg.verified&&money(leg.amountEUR)!==null?
        leg.amountEUR.toFixed(2).replace('.',',')+' €':'prix inconnu');
    });
    const partial=!result.known&&result.breakdown.some(x=>x.verified&&!x.nonTicketed);
    const verifiedSubtotal=partial?Math.round(result.breakdown.reduce((sum,x)=>sum+(x.verified&&money(x.amountEUR)!==null?x.amountEUR:0),0)*100)/100:null;
    const unknownCount=partial?result.breakdown.filter(x=>!x.verified).length:0;
    const heading=result.breakdown.length&&result.breakdown.every(x=>x.nonTicketed)?'Aucun billet requis':result.known?'Total : '+result.totalEUR.toFixed(2).replace('.',',')+' €':
      partial?'Total inconnu · Sous-total vérifié : '+verifiedSubtotal.toFixed(2).replace('.',',')+' € · '+unknownCount+' portion'+(unknownCount>1?'s':'')+' sans prix':'Total inconnu';
    return heading+(portions.length?' · '+portions.join(' · '):'');
  }
  function describeLeg(leg){
    if(!leg||typeof leg!=='object')return 'Tarif inconnu';
    if(leg.nonTicketed)return 'Sans billet';
    if(leg.passApplied)return 'Couvert par abonnement vérifié';
    return leg.verified&&money(leg.amountEUR)!==null?'Tarif vérifié : '+leg.amountEUR.toFixed(2).replace('.',',')+' €':'Tarif inconnu';
  }
  const URBAN={
    'pan-synchro':{lines:['*'],label:'1,40 € · ticket 1 voyage Synchro Bus, valable 1 h (1,70 € par CB à bord)',
      source:'https://synchro.grandchambery.fr/tarifs-et-abonnements-bus/les-tickets/'},
    'pan-ondea':{lines:['*'],label:'1,70 € · ticket 1 voyage Ondéa, 1 h, correspondances autorisées (pas d’aller-retour même ligne)',
      source:'https://www.ondeagrandlac.fr/titres/titres-pour-tous-tarifs-applicables-du-1er-juillet-2026'},
    'pan-tam':{lines:['*'],label:'1,10 € · ticket unitaire TAM plein tarif (tarifs au 1er janvier 2026)',
      source:'https://philibert-transport.fr/wp-content/uploads/2017/08/TAM-TARIFS-2026.pdf'},
    'tac-annemasse':{lines:['T1','T2'],
      label:'1,70 € · ticket TAC zone 210, 60 min',
      labelsByLine:{T1:'1,70 € sans contact ou 2,00 € auprès du conducteur · TAC zone 210, 60 min'},
      source:'https://www.tac-mobilites.fr/nos-tarifs/guide-des-tarifs'},
    'mobivals-valserhone':{lines:['A','B'],label:'1,10 € à bord · ticket Mobi’Vals',
      source:'https://www.mobivals.fr/se-deplacer/les-titres-de-transport/'},
    'duobus-oyonnax':{lines:['L1','L2','L2B','L3','L3A','L3B','L4','ZIO'],
      label:'1,20 € à bord ou 1,10 € TixiPass · ticket Duobus 30 min',
      source:'https://www.duobus.fr/tous-les-titres'},
    'rubis-bourg-en-bresse':{lines:['1','2','3','4','5','6','7','10','11','12'],
      label:'1,40 € forfait Rubis 1 h ou 1,60 € auprès du conducteur',
      source:'https://www.rubis.grandbourg.fr/titres-abonnements/'}
  };
  const urbanDate=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'});
  // TCL is priced by the complete zone group, not by route number or stop name.
  // These are reference prices only; never mark an itinerary fare as verified.
  const TCL_REFERENCE=Object.freeze({
    zones_1_2:{price:2.10,label:'zones 1 et 2'},
    adjacent_excluding_1:{price:1.60,label:'2 zones voisines hors zone 1'},
    all_excluding_1:{price:2.50,label:'toutes zones hors zone 1'},
    all_zones:{price:3.70,label:'toutes zones'}
  });
  function tclReference(row){
    if(!row||row.interNetwork||row.crossBorder===true||row.legs!==undefined||
       row.networkId!=='tcl-lyon'||typeof row.departure!=='string')return null;
    const offer=Object.hasOwn(TCL_REFERENCE,row.fareZoneGroup)?TCL_REFERENCE[row.fareZoneGroup]:null;
    // Require a real, timezone-qualified departure; Date.parse alone normalizes
    // impossible calendar days and accepts timezone-less local strings.
    const datePattern=/^(\\d{4}-\\d{2}-\\d{2})T(\\d{2}):(\\d{2})(?::(\\d{2})(?:\\.\\d{1,3})?)?(Z|[+-](?:[01]\\d|2[0-3]):[0-5]\\d)$/;
    const match=datePattern.exec(row.departure);
    if(!offer||!match)return null;
    const [,date,hour,minute,second]=match;
    const calendar=Date.parse(date+'T12:00:00Z');
    if(!Number.isFinite(calendar)||new Date(calendar).toISOString().slice(0,10)!==date||
       Number(hour)>23||Number(minute)>59||Number(second||0)>59||
       !Number.isFinite(Date.parse(row.departure)))return null;
    const day=urbanDate.format(new Date(row.departure));
    if(day<'2026-11-09'||day>'2026-12-31')return null;
    return {label:'Référence tarifaire TCL · 1 voyage '+offer.label+' · '+
      offer.price.toFixed(2).replace('.',',')+' € (hors support de ticket)',
      source:'https://www.tcl.fr/sites/default/files/2026-05/TCL_Campagne_Unification_Guide_Tarifaire_Mai2026_W.pdf'};
  }
  function urbanReference(row){
    if(row?.networkId==='tcl-lyon')return tclReference(row);
    if(!row||row.interNetwork||row.legs!==undefined||!Object.hasOwn(URBAN,row.networkId))return null;
    // A known non-210 or cross-border TAC journey must not inherit the zone-210 reference.
    // Missing zone information remains a labelled reference, never a verified fare.
    if(row.networkId==='tac-annemasse'){
      const zones=[row.zone,row.fareZone,row.fromZone,row.toZone].filter(v=>v!==undefined&&v!==null);
      if(zones.some(v=>String(v)!=='210')||row.crossBorder===true||row.transfrontalier===true)return null;
    }
    const offer=URBAN[row.networkId];
    if(!(offer.lines.includes(row.line)||(offer.lines.includes('*')&&typeof row.line==='string'&&row.line.trim()))||!Number.isFinite(Date.parse(row.departure)))return null;
    const day=urbanDate.format(new Date(row.departure));
    // Current operator pages were checked on 9 November. Recheck later service dates.
    if(day<'2026-11-09'||day>'2026-12-31')return null;
    return {label:'Référence tarifaire · '+(offer.labelsByLine?.[row.line]||offer.label),source:offer.source};
  }
  const api={fare,describe,describeLeg,urbanReference};if(typeof module==='object'&&module.exports)module.exports=api;
  root.CPTransportFares=api;
})(typeof window!=='undefined'?window:globalThis);
