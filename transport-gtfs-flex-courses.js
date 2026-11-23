/* GTFS-Flex course metadata. Windows are NOT confirmed schedules. */
(function(root){
'use strict';
const G=typeof module==='object'&&module.exports?require('./transport-gtfs-index.js'):root.CPGTFSIndex;
const sec=s=>{const m=/^(\d{1,3}):([0-5]\d):([0-5]\d)$/.exec(s||'');return m?Number(m[1])*3600+Number(m[2])*60+Number(m[3]):null;};
function notice(rule){const raw=rule?.prior_notice_duration_min;if(raw==null||String(raw).trim()==='')return null;const n=Number(raw);return Number.isFinite(n)&&n>=0?n:null;}
function extract(files,index,date,{limit=2000}={}){
 if(!files||!index||!/^\d{4}-\d{2}-\d{2}$/.test(date||'')||!Number.isSafeInteger(limit)||limit<1||limit>20000)throw Error('Invalid GTFS-Flex input');
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
   const n1=notice(pickupRule),n2=notice(dropoffRule);
   const noticeMinutes=a.pickupRule&&n1!==null&&(!b.dropoffRule||n2!==null)?Math.max(n1,n2??0):null;
   const info=id=>{const s=index.stopById.get(id)||{};const lat=s.stop_lat===''?NaN:Number(s.stop_lat),lon=s.stop_lon===''?NaN:Number(s.stop_lon);return {id,name:s.stop_name||'',point:Number.isFinite(lat)&&Number.isFinite(lon)?{lat,lon}:null};};
   found.push({kind:'gtfs-flex-candidate',tripId,routeId:trip.route_id,date,line:route.route_short_name||route.route_long_name||'',
    fromStopIds:a.stopIds.slice(),toStopIds:b.stopIds.slice(),fromStops:a.stopIds.map(info),toStops:b.stopIds.map(info),
    pickupWindow:{startSeconds:a.start,endSeconds:a.end},dropoffWindow:{startSeconds:b.start,endSeconds:b.end},
    pickupBookingRuleId:a.pickupRule,dropoffBookingRuleId:b.dropoffRule,
    pickupRule:pickupRule?{noticeMinutes:n1,bookingMethod:pickupRule.booking_method||null,bookingUrl:pickupRule.booking_url||null,bookingPhone:pickupRule.booking_phone||null}:null,
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
 const confirmed=!!(matches&&booking.reservationConfirmed===true&&booking.pickupTimeConfirmed===true&&
  /(Z|[+-]\d{2}:\d{2})$/.test(booking.requestedPickup||'')&&Number.isFinite(pickup));
 return {...candidate,flexBooking:{...candidate.flexBooking,requestedPickup:confirmed?booking.requestedPickup:null,
   reservationConfirmed:confirmed,pickupTimeConfirmed:confirmed},journeyConfirmed:false,status:'Transport non confirmé'};
}
const api={extract,attachBooking};if(typeof module==='object'&&module.exports)module.exports=api;root.CPGTFSFlexCourses=api;
})(typeof window!=='undefined'?window:globalThis);
