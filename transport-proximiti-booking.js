/* Proxim iTi reference-only booking guard. No live Bus CheckIn confirmation. */
(function(root){
'use strict';
const SOURCE='https://www.proximiti.fr/wp-content/uploads/2025/12/horaire-46x-web.pdf';
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
 const registrationDeadlineMinutes=line==='460'?120:5;
 const registrationConfirmed=input.registrationConfirmed===true;
 const bookingAvailabilityVerified=input.bookingAvailabilityVerified===true;
 const serviceConfirmed=input.serviceConfirmed===true;
 const stopsConfirmed=input.stopsConfirmed===true;
 const walkingConfirmed=input.walkingConfirmed===true;
 const marginConfirmed=input.marginConfirmed===true;
 const ready=needsRegistration!==null&&(!needsRegistration||(registrationConfirmed&&bookingAvailabilityVerified))&&
  serviceConfirmed&&stopsConfirmed&&walkingConfirmed&&marginConfirmed;
 return {line,needsRegistration,registrationDeadlineMinutes,registrationConfirmed,
  ready,serviceConfirmed,bookingAvailabilityVerified,source:SOURCE,
  // No live availability is inferred. Only caller-supplied, independently verified evidence is accepted.
  status:ready?'confirmed_evidence_supplied':'Transport non confirmé — vérifiez vous-même'};
}
const api={assess,SOURCE};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(root)root.CPProximitiBooking=api;
})(typeof globalThis!=='undefined'?globalThis:this);
