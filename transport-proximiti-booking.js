/* Proxim iTi reference-only booking guard. No live Bus CheckIn confirmation. */
(function(root){
'use strict';
const SOURCE='https://www.proximiti.fr/wp-content/uploads/2025/12/horaire-46x-web.pdf';
function validDepartureDate(record){
 if(typeof record?.departure!=='string'||typeof record.serviceDate!=='string')return false;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(record.serviceDate)||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/.test(record.departure))return false;
 const timestamp=Date.parse(record.departure);
 if(!Number.isFinite(timestamp))return false;
 // The operator uses French local service dates, not UTC calendar dates.
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Europe/Paris',
  year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(timestamp));
 const part=type=>parts.find(p=>p.type===type)?.value;
 return record.serviceDate===[part('year'),part('month'),part('day')].join('-');
}
function sameJourney(booking,journey){
 if(!booking||!journey||!validDepartureDate(booking)||!validDepartureDate(journey))return false;
 for(const key of ['line','serviceDate','boardingStopId','alightingStopId','departure']){
  if(typeof booking[key]!=='string'||!booking[key].trim()||
     typeof journey[key]!=='string'||!journey[key].trim()||
     booking[key]!==journey[key])return false;
 }
 return true;
}
function assess(input={}){
 const line=String(input.line||'').trim();
 if(!['460','461'].includes(line))return null;
 const boarding=input.boardingStopType,alighting=input.alightingStopType;
 const types=['systematic','on_demand'];
 const stopTypesKnown=types.includes(boarding)&&types.includes(alighting);
 const guaranteedConnection=input.guaranteedConnection;
 const connectionKnown=typeof guaranteedConnection==='boolean';
 const needsRegistration=stopTypesKnown&&connectionKnown?
  boarding==='on_demand'||alighting==='on_demand'||guaranteedConnection:null;
 // The 461 five-minute PDF rule conflicts with the operator's general booking guidance.
 // Do not present a single cutoff as operationally verified.
 const publishedDeadlineMinutes=line==='460'?120:5;
 const registrationDeadlineMinutes=null;
 const registrationConfirmed=input.registrationConfirmed===true;
 const registrationForJourneyVerified=input.journeyEvidence?.line===line&&
  sameJourney(input.bookingEvidence,input.journeyEvidence);
 const bookingAvailabilityVerified=input.bookingAvailabilityVerified===true;
 const serviceConfirmed=input.serviceConfirmed===true;
 const stopsConfirmed=input.stopsConfirmed===true;
 const walkingConfirmed=input.walkingConfirmed===true;
 const marginConfirmed=input.marginConfirmed===true;
 const missingEvidence=[];
 if(!stopTypesKnown)missingEvidence.push('stop_types');
 if(!connectionKnown)missingEvidence.push('connection_type');
 if(needsRegistration===true){
  if(!registrationConfirmed)missingEvidence.push('registration_confirmation');
  if(!registrationForJourneyVerified)missingEvidence.push('registration_journey_match');
  if(!bookingAvailabilityVerified)missingEvidence.push('booking_availability');
 }
 if(!serviceConfirmed)missingEvidence.push('service');
 if(!stopsConfirmed)missingEvidence.push('stop_coordinates');
 if(!walkingConfirmed)missingEvidence.push('walking_access');
 if(!marginConfirmed)missingEvidence.push('arrival_margin');
 const ready=missingEvidence.length===0;
 return {line,needsRegistration,registrationDeadlineMinutes,registrationConfirmed,
  ready,missingEvidence,serviceConfirmed,registrationForJourneyVerified,bookingAvailabilityVerified,publishedDeadlineMinutes,source:SOURCE,
  // No live availability is inferred. Only caller-supplied, independently verified evidence is accepted.
  status:ready?'confirmed_evidence_supplied':'Transport non confirmé — vérifiez vous-même'};
}
const api={assess,sameJourney,SOURCE};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(root)root.CPProximitiBooking=api;
})(typeof globalThis!=='undefined'?globalThis:this);
