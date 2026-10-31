/* Conditional additional cost for a user-declared SIBRA pass.
 * Feed identity + an explicit route list establish scope, never a route name alone.
 * No account/card lookup, ticket purchase, confirmed fare or service claim.
 */
(function(root){
'use strict';
const DATASET='5bd9843e634f413220f7f04a',KEY='cp_sibra_pass_v1';
const SOURCE='https://www.sibra.fr/app/uploads/2026/07/Reglement_BUS_CARS_CGV_01072026_3.pdf';
const LINES=new Set([...Array.from({length:28},(_,i)=>String(i+1)),'30','40A','40B','41','42','80','81','82']);
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
function assess(row,value){
 const pass=normalize(value),legs=Array.isArray(row?.legs)&&row.legs.length?row.legs:row?[row]:[];
 const breakdown=legs.map(leg=>{
  const date=boardingDay(leg?.departure),line=typeof leg?.line==='string'?leg.line.trim().toUpperCase():'';
  // Regional routes, seasonal products and unknown feeds require separate evidence.
  const scope=leg?.networkId===DATASET&&LINES.has(line);
  const covered=!!(pass&&scope&&date&&date>='2026-07-01'&&date>=pass.from&&date<=pass.through);
  return {line,covered,additionalEUR:covered?0:null,source:covered?SOURCE:null,
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
 const note=doc.createElement('p');note.textContent='Dates déclarées sur cet appareil uniquement. Déduction conditionnelle sur les lignes SIBRA reconnues ; portions régionales et validité de la carte à vérifier. Aucun achat.';
 box.appendChild(status);box.appendChild(note);container.appendChild(box);update();
 return {getPass:()=>pass};
}
const api={DATASET,KEY,SOURCE,normalize,assess,describe,mountControls};
if(typeof module==='object'&&module.exports)module.exports=api;root.CPSibraPass=api;
})(typeof window!=='undefined'?window:globalThis);
