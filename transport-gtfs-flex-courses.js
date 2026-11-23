/* GTFS-Flex course metadata. Windows are NOT confirmed schedules. */
(function(root){
'use strict';
const G=typeof module==='object'&&module.exports?require('./transport-gtfs-index.js'):root.CPGTFSIndex;
const sec=s=>{const m=/^(\d{1,3}):([0-5]\d):([0-5]\d)$/.exec(s||'');return m?Number(m[1])*3600+Number(m[2])*60+Number(m[3]):null;};
function notice(rule){const raw=rule?.prior_notice_duration_min;if(raw==null||String(raw).trim()==='')return null;const n=Number(raw);return Number.isFinite(n)&&n>=0?n:null;}

function serviceSeconds(iso,date,timeZone){
 if(typeof iso!=='string'||!/(Z|[+-]\d{2}:\d{2})$/.test(iso)||!Number.isFinite(Date.parse(iso))||!timeZone)return null;
 try{
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(iso)).map(p=>[p.type,p.value]));
  const day=Date.UTC(Number(parts.year),Number(parts.month)-1,Number(parts.day));
  const base=Date.parse(date+'T00:00:00Z');
  const difference=(day-base)/86400000;
  if(!Number.isInteger(difference)||difference<0||difference>7)return null;
  return difference*86400+Number(parts.hour)*3600+Number(parts.minute)*60+Number(parts.second);
 }catch(_){return null;}
}
function bookingRuleInfo(rule,id){
 if(!rule)return null;
 const int=v=>/^\d+$/.test(String(v||''))?Number(v):null;
 return {id,bookingType:rule.booking_type||null,noticeMinutes:rule.booking_type==='1'?notice(rule):null,
  priorNoticeLastDay:int(rule.prior_notice_last_day),priorNoticeLastTime:rule.prior_notice_last_time||null,
  priorNoticeStartDay:int(rule.prior_notice_start_day),priorNoticeStartTime:rule.prior_notice_start_time||null,
  priorNoticeServiceId:rule.prior_notice_service_id||null,
  bookingUrl:rule.booking_url||null,phoneNumber:rule.phone_number||null,infoUrl:rule.info_url||null,
  message:rule.message||null};
}
function extract(files,index,date,{limit=2000}={}){
 if(!files||!index||!/^\d{4}-\d{2}-\d{2}$/.test(date||'')||!Number.isSafeInteger(limit)||limit<1||limit>20000)throw Error('Invalid GTFS-Flex input');
 const agencies=[...G.csvRows(files['agency.txt']||'')];
 const active=G.activeServices(files,date),rules=new Map([...G.csvRows(files['booking_rules.txt']||'')].filter(r=>r.booking_rule_id).map(r=>[r.booking_rule_id,r]));
 const groups=new Map();
 for(const r of G.csvRows(files['location_group_stops.txt']||'')){if(!index.stopById.has(r.stop_id))continue;if(!groups.has(r.location_group_id))groups.set(r.location_group_id,[]);groups.get(r.location_group_id).push(r.stop_id);}
 const trips=new Map();
 for(const r of G.csvRows(files['stop_times.txt']||'')){
  if(!index.tripById.has(r.trip_id))continue;
  const start=sec(r.start_pickup_drop_off_window),end=sec(r.end_pickup_drop_off_window),sequence=Number(r.stop_sequence);
  if(start===null||end===null||end<start||!Number.isSafeInteger(sequence)||sequence<0)continue;
  if(r.pickup_booking_rule_id&&!rules.has(r.pickup_booking_rule_id)||r.drop_off_booking_rule_id&&!rules.has(r.drop_off_booking_rule_id))continue;
  if(!['','0','1','2','3'].includes(r.pickup_type||'')||!['','0','1','2','3'].includes(r.drop_off_type||''))continue;
  const stopIds=r.location_group_id?groups.get(r.location_group_id)||[]:r.stop_id&&index.stopById.has(r.stop_id)?[r.stop_id]:[];
  if(!stopIds.length)continue;
  if(!trips.has(r.trip_id))trips.set(r.trip_id,[]);
  trips.get(r.trip_id).push({sequence,start,end,stopIds,pickup:r.pickup_type!=='1',dropoff:r.drop_off_type!=='1',pickupRule:r.pickup_booking_rule_id||null,dropoffRule:r.drop_off_booking_rule_id||null});
 }
 const found=[];
 outer:for(const [tripId,stops] of trips){
  const trip=index.tripById.get(tripId),route=index.routeById.get(trip.route_id);
  if(!route||!active.has(trip.service_id))continue;
  stops.sort((a,b)=>a.sequence-b.sequence);
  for(let i=0;i<stops.length;i++)for(let j=i+1;j<stops.length;j++){
   const a=stops[i],b=stops[j];if(!a.pickup||!b.dropoff||b.end<a.start||b.sequence<=a.sequence)continue;
   if(a.stopIds.length===1&&b.stopIds.length===1&&a.stopIds[0]===b.stopIds[0])continue;
   const pickupRule=a.pickupRule?rules.get(a.pickupRule):null,dropoffRule=b.dropoffRule?rules.get(b.dropoffRule):null;
   const n1=pickupRule?.booking_type==='1'?notice(pickupRule):null,n2=dropoffRule?.booking_type==='1'?notice(dropoffRule):null;
   const noticeMinutes=a.pickupRule&&n1!==null&&(!b.dropoffRule||n2!==null)?Math.max(n1,n2??0):null;
   const agency=agencies.find(x=>x.agency_id&&x.agency_id===route.agency_id)||(agencies.length===1?agencies[0]:null);
   const info=id=>{const s=index.stopById.get(id)||{};const lat=s.stop_lat===''?NaN:Number(s.stop_lat),lon=s.stop_lon===''?NaN:Number(s.stop_lon);return {id,name:s.stop_name||'',point:Number.isFinite(lat)&&Number.isFinite(lon)?{lat,lon}:null};};
   found.push({kind:'gtfs-flex-candidate',tripId,routeId:trip.route_id,date,line:route.route_short_name||route.route_long_name||'',
    timeZone:agency?.agency_timezone||null,fromStopIds:a.stopIds.slice(),toStopIds:b.stopIds.slice(),fromStops:a.stopIds.map(info),toStops:b.stopIds.map(info),
    pickupWindow:{startSeconds:a.start,endSeconds:a.end},dropoffWindow:{startSeconds:b.start,endSeconds:b.end},
    pickupBookingRuleId:a.pickupRule,dropoffBookingRuleId:b.dropoffRule,
    pickupRule:bookingRuleInfo(pickupRule,a.pickupRule),dropoffRule:bookingRuleInfo(dropoffRule,b.dropoffRule),
    flexBooking:{noticeMinutes,requestedPickup:null,reservationConfirmed:false,pickupTimeConfirmed:false},
    serviceScheduled:true,serviceConfirmed:false,journeyConfirmed:false,priceStatus:'unknown',walkingRouteConfirmed:false,status:'Transport non confirmé'});
   if(found.length>=limit)break outer;
  }
 }
 return found;
}
function attachBooking(candidate,booking){
 if(!candidate||candidate.kind!=='gtfs-flex-candidate')throw Error('GTFS-Flex candidate required');
 const matches=booking&&booking.tripId===candidate.tripId&&booking.date===candidate.date&&candidate.fromStopIds.includes(booking.fromStopId)&&candidate.toStopIds.includes(booking.toStopId);
 const pickup=typeof booking?.requestedPickup==='string'?Date.parse(booking.requestedPickup):NaN;
 const pickupLocal=serviceSeconds(booking?.requestedPickup,candidate.date,candidate.timeZone);
 const within=pickupLocal!==null&&pickupLocal>=candidate.pickupWindow.startSeconds&&pickupLocal<=candidate.pickupWindow.endSeconds;
 const confirmed=!!(matches&&booking.reservationConfirmed===true&&booking.pickupTimeConfirmed===true&&
  /(Z|[+-]\d{2}:\d{2})$/.test(booking.requestedPickup||'')&&Number.isFinite(pickup)&&within);
 return {...candidate,flexBooking:{...candidate.flexBooking,requestedPickup:confirmed?booking.requestedPickup:null,
   reservationConfirmed:confirmed,pickupTimeConfirmed:confirmed},journeyConfirmed:false,status:'Transport non confirmé'};
}

function toHubRow(candidate,booking){
 const c=attachBooking(candidate,booking);
 if(!c.flexBooking.reservationConfirmed||booking.arrivalConfirmed!==true)return null;
 const pickup=Date.parse(c.flexBooking.requestedPickup),arrival=Date.parse(booking.confirmedArrival||'');
 const arrivalLocal=serviceSeconds(booking.confirmedArrival,c.date,c.timeZone);
 if(!Number.isFinite(arrival)||arrival<pickup||arrivalLocal===null||
    arrivalLocal<c.dropoffWindow.startSeconds||arrivalLocal>c.dropoffWindow.endSeconds)return null;
 const from=c.fromStops.find(s=>s.id===booking.fromStopId);
 const to=c.toStops.find(s=>s.id===booking.toStopId);
 if(!from?.point||!to?.point)return null;
 return {isFlex:true,tripId:c.tripId,date:c.date,network:booking.operator||c.line,
  line:c.line,departure:c.flexBooking.requestedPickup,arrival:booking.confirmedArrival,
  originStop:{id:from.id,name:from.name,...from.point},
  destinationStop:{id:to.id,name:to.name,...to.point},
  flexBooking:{...c.flexBooking},serviceScheduled:true,serviceConfirmed:false,
  priceStatus:'unknown',source:'confirmed-provider-booking'};
}
const api={extract,attachBooking,toHubRow};if(typeof module==='object'&&module.exports)module.exports=api;root.CPGTFSFlexCourses=api;
})(typeof window!=='undefined'?window:globalThis);
