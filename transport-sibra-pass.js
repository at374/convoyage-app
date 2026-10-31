/* Conditional additional cost for a user-declared SIBRA pass.
 * Feed identity + an explicit route list establish scope, never a route name alone.
 * No account/card lookup, ticket purchase, confirmed fare or service claim.
 */
(function(root){
'use strict';
const DATASET='5bd9843e634f413220f7f04a',KEY='cp_sibra_pass_v1';
const SOURCE='https://www.sibra.fr/app/uploads/2026/07/Reglement_BUS_CARS_CGV_01072026_3.pdf';
const LINES=new Set([...Array.from({length:28},(_,i)=>String(i+1)),'30','40A','40B','41','42','80','81','82']);
// Grand Annecy rows of the official Y51 table (Annecy to Duingt Église).
const Y51_SOURCE='https://annecy.transdev.com/wp-content/uploads/2026/07/Y51_FP_2026-2027_acy-abt_Vdef.pdf';
const Y51_STOPS=new Map([["FR:74010:ZE:57539:HAUTExSAVOIE",[45.9016985,6.1201612]],["FR:74010:ZE:57555:HAUTExSAVOIE",[45.899777,6.12817]],["FR:74010:ZE:57556:HAUTExSAVOIE",[45.9000241,6.128212]],["FR:74010:ZE:58799:HAUTExSAVOIE",[45.8933503,6.1358716]],["FR:74010:ZE:58800:HAUTExSAVOIE",[45.8933637,6.1359787]],["FR:74108:ZE:58436:HAUTExSAVOIE",[45.827708,6.2018053]],["FR:74108:ZE:58437:HAUTExSAVOIE",[45.8276579,6.2022617]],["FR:74108:ZE:58922:HAUTExSAVOIE",[45.827332,6.196979]],["FR:74108:ZE:58923:HAUTExSAVOIE",[45.8273692,6.1969119]],["FR:74242:ZE:57567:HAUTExSAVOIE",[45.8379298,6.1579781]],["FR:74242:ZE:57568:HAUTExSAVOIE",[45.8379542,6.158264]],["FR:74242:ZE:57569:HAUTExSAVOIE",[45.8345575,6.1618635]],["FR:74242:ZE:57570:HAUTExSAVOIE",[45.8349227,6.1620746]],["FR:74242:ZE:57572:HAUTExSAVOIE",[45.832219,6.1717336]],["FR:74242:ZE:57573:HAUTExSAVOIE",[45.8324037,6.1714453]],["FR:74242:ZE:57574:HAUTExSAVOIE",[45.8291318,6.1878668]],["FR:74242:ZE:57575:HAUTExSAVOIE",[45.8290592,6.1877524]],["FR:74242:ZE:58804:HAUTExSAVOIE",[45.8308474,6.1789097]],["FR:74242:ZE:58805:HAUTExSAVOIE",[45.8306534,6.1793191]],["FR:74267:ZE:57557:HAUTExSAVOIE",[45.8733375,6.1413155]],["FR:74267:ZE:57558:HAUTExSAVOIE",[45.8739445,6.1416083]],["FR:74267:ZE:57559:HAUTExSAVOIE",[45.8697301,6.1406339]],["FR:74267:ZE:57560:HAUTExSAVOIE",[45.8697323,6.1404445]],["FR:74267:ZE:57561:HAUTExSAVOIE",[45.8588823,6.1422619]],["FR:74267:ZE:57562:HAUTExSAVOIE",[45.8593442,6.1419398]],["FR:74267:ZE:57563:HAUTExSAVOIE",[45.8525478,6.1444409]],["FR:74267:ZE:57564:HAUTExSAVOIE",[45.8529488,6.1444834]],["FR:74267:ZE:57565:HAUTExSAVOIE",[45.8476612,6.1465834]],["FR:74267:ZE:57566:HAUTExSAVOIE",[45.8477898,6.1463383]],["FR:74267:ZE:58438:HAUTExSAVOIE",[45.8805187,6.1417571]],["FR:74267:ZE:58439:HAUTExSAVOIE",[45.8810307,6.1419496]],["FR:74267:ZE:58440:HAUTExSAVOIE",[45.863937,6.14022]],["FR:74267:ZE:58441:HAUTExSAVOIE",[45.8646501,6.1401187]]]);
function day(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;
 const ms=Date.parse(value+'T12:00:00Z');
 return Number.isFinite(ms)&&new Date(ms).toISOString().slice(0,10)===value?value:null;
}
function normalize(value){
 return value?.active===true&&day(value.from)&&day(value.through)&&value.from<=value.through?
  {active:true,from:value.from,through:value.through}:null;
}
function boardingDay(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)||!day(value.slice(0,10)))return null;
 const time=value.slice(11,19).match(/^(\d{2}):(\d{2})(?::(\d{2}))?/);
 if(!time||Number(time[1])>23||Number(time[2])>59||Number(time[3]||0)>59)return null;
 const ms=Date.parse(value);if(!Number.isFinite(ms))return null;
 const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(ms)).map(x=>[x.type,x.value]));
 return p.year+'-'+p.month+'-'+p.day;
}
function regionalScope(leg,date){
 if(leg?.networkId!=='oura-haute-savoie'||leg.line!=='Y51'||!date||date<'2026-09-01'||date>'2027-07-02')return false;
 const proof=leg.fareScopePath;
 if(!proof||['networkId','tripId','from','to','departure','arrival'].some(k=>typeof leg[k]!=='string'||proof[k]!==leg[k])||
   !Array.isArray(proof.stops)||proof.stops.length<2||proof.stops.length>64||
   proof.stops[0]?.stopId!==leg.from||proof.stops.at(-1)?.stopId!==leg.to)return false;
 return proof.stops.every(stop=>{
  const pin=Y51_STOPS.get(stop?.stopId);
  if(!pin||!Number.isFinite(stop.lat)||!Number.isFinite(stop.lon))return false;
  const distance=Math.hypot((stop.lat-pin[0])*111195,(stop.lon-pin[1])*111195*Math.cos(pin[0]*Math.PI/180));
  return distance<=50;
 });
}
function assess(row,value){
 const pass=normalize(value),legs=Array.isArray(row?.legs)&&row.legs.length?row.legs:row?[row]:[];
 const breakdown=legs.map(leg=>{
  const date=boardingDay(leg?.departure),line=typeof leg?.line==='string'?leg.line.trim().toUpperCase():'';
  const regional=regionalScope(leg,date);
  // Regional scope requires a coordinate-bound proof for the whole GTFS portion.
  const scope=leg?.networkId===DATASET&&LINES.has(line)||regional;
  const covered=!!(pass&&scope&&date&&date>='2026-07-01'&&date>=pass.from&&date<=pass.through);
  return {line,covered,additionalEUR:covered?0:null,source:covered?SOURCE:null,scopeSource:covered&&regional?Y51_SOURCE:null,
   reason:!pass?'pass_missing':!scope?'scope_unverified':!date?'date_invalid':date<'2026-07-01'?'policy_unverified':date<pass.from||date>pass.through?'pass_outside_validity':'included_conditionally'};
 });
 return {breakdown,coveredLegs:breakdown.filter(x=>x.covered).length,
  additionalEUR:breakdown.length&&breakdown.every(x=>x.covered)?0:null,
  conditional:true,transportConfirmed:false,sourceCheckedOn:'2026-10-31'};
}
function describe(result){
 if(!result?.coveredLegs)return '';
 const portions=result.breakdown.map((x,i)=>'portion '+(i+1)+' ('+x.line+') : '+(x.covered?'incluse':'prix inconnu')).join(' · ');
 return ' · Abonnement SIBRA déclaré : '+portions+' · '+(result.additionalEUR===0?
  'Coût supplémentaire transport : 0,00 € sous réserve d’abonnement valide.':
  'Coût supplémentaire : 0,00 € sur les portions incluses ; total du trajet inconnu.')+
  ' Périmètre selon règlement SIBRA consulté le '+result.sourceCheckedOn+'.';
}
function mountControls(container,{storage,onChange=()=>{}}={}){
 const doc=container.ownerDocument;let pass=null;
 try{pass=normalize(JSON.parse(storage?.getItem(KEY)||'null'));}catch(_){}
 const box=doc.createElement('div');box.className='doux';box.style.marginTop='8px';
 const fields=[];
 for(const [id,label] of [['cpSibraPassFrom','Mon abonnement SIBRA — valable du'],['cpSibraPassThrough','Au (inclus)']]){
  const wrapper=doc.createElement('label');wrapper.htmlFor=id;wrapper.textContent=label;
  const input=doc.createElement('input');input.id=id;input.type='date';input.required=true;
  wrapper.appendChild(input);box.appendChild(wrapper);fields.push(input);
 }
 if(pass){fields[0].value=pass.from;fields[1].value=pass.through;}
 const status=doc.createElement('div');status.setAttribute('role','status');
 const update=message=>{status.textContent=message||(pass?'Abonnement déclaré du '+pass.from+' au '+pass.through+' ; dates et droits à vérifier sur votre carte.':'Aucun abonnement déclaré sur cet appareil.');};
 for(const [label,action] of [['Utiliser mon abonnement SIBRA',()=>{
  const chosen=normalize({active:true,from:fields[0].value,through:fields[1].value});
  if(!chosen){update('Indiquer deux dates valides, dans le bon ordre.');return;}
  pass=chosen;let stored=true;try{storage?.setItem(KEY,JSON.stringify(pass));stored=!!storage;}catch(_){stored=false;}
  update(stored?null:'Abonnement utilisé pour cette fiche uniquement : enregistrement sur cet appareil indisponible.');onChange();
 }],['Retirer mon abonnement SIBRA',()=>{
  try{storage?.removeItem(KEY);}catch(_){update('Impossible de supprimer l’abonnement enregistré sur cet appareil.');return;}
  pass=null;fields.forEach(x=>x.value='');update();onChange();
 }]]){const button=doc.createElement('button');button.type='button';button.className='second';button.textContent=label;button.onclick=action;box.appendChild(button);}
 const note=doc.createElement('p');note.textContent='Dates déclarées sur cet appareil uniquement. Déduction conditionnelle sur les lignes SIBRA et portions Y51 reconnues ; autres portions régionales et validité de la carte à vérifier. Aucun achat.';
 box.appendChild(status);box.appendChild(note);container.appendChild(box);update();
 return {getPass:()=>pass};
}
const api={DATASET,KEY,SOURCE,normalize,assess,describe,mountControls};
if(typeof module==='object'&&module.exports)module.exports=api;root.CPSibraPass=api;
})(typeof window!=='undefined'?window:globalThis);
