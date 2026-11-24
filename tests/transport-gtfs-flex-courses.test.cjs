'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const G=require('../transport-gtfs-index.js');
const F=require('../transport-gtfs-flex-courses.js');
const files={
 'agency.txt':'agency_name,agency_timezone\nRéseau Flex,Europe/Paris\n',
 'stops.txt':'stop_id,stop_name,stop_lat,stop_lon\nA,Arrêt A,45.9,6.1\nB,Arrêt B,45.8,6.2\nC,Arrêt C,45.7,6.3\n',
 'routes.txt':'route_id,route_short_name,route_long_name,route_type\nR,TAD,Navette Flex,3\n',
 'trips.txt':'route_id,service_id,trip_id\nR,W,T1\n',
 'calendar.txt':'service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date\nW,1,1,1,1,1,1,1,20260101,20271231\n',
 'location_group_stops.txt':'location_group_id,stop_id\nZ,A\nZ,C\n',
 'booking_rules.txt':'booking_rule_id,booking_type,prior_notice_duration_min,booking_url\nP,1,60,https://example.org/book\n',
 'stop_times.txt':'trip_id,stop_sequence,stop_id,location_group_id,start_pickup_drop_off_window,end_pickup_drop_off_window,pickup_type,drop_off_type,pickup_booking_rule_id,drop_off_booking_rule_id\nT1,1,,Z,08:00:00,09:00:00,2,1,P,\nT1,2,B,,09:15:00,10:00:00,1,2,,\n'
};
test('GTFS-Flex: one course contains its own windows/rules, never a fixed departure',()=>{
 const [c]=F.extract(files,G.buildIndex(files),'2026-11-23');
 assert.ok(c);assert.deepEqual(c.fromStopIds,['A','C']);assert.deepEqual(c.toStopIds,['B']);
 assert.equal(c.flexBooking.noticeMinutes,60);assert.equal(c.pickupWindow.startSeconds,28800);
 assert.equal(c.flexBooking.reservationConfirmed,false);assert.equal(c.journeyConfirmed,false);
 assert.equal(c.departure,undefined);assert.equal(c.priceStatus,'unknown');
});
test('Missing booking notice is unknown rather than zero',()=>{
 const f={...files,'booking_rules.txt':'booking_rule_id,booking_type,prior_notice_duration_min\nP,1,\n'};
 const [c]=F.extract(f,G.buildIndex(f),'2026-11-23');assert.equal(c.flexBooking.noticeMinutes,null);
});
test('Submitted, unmatched and partially confirmed bookings cannot become confirmed',()=>{
 const [c]=F.extract(files,G.buildIndex(files),'2026-11-23');
 const b={tripId:'T1',date:'2026-11-23',fromStopId:'A',toStopId:'B',requestedPickup:'2026-11-23T08:30:00+01:00'};
 assert.equal(F.attachBooking(c,{...b,reservationConfirmed:false,pickupTimeConfirmed:true}).flexBooking.reservationConfirmed,false);
 assert.equal(F.attachBooking(c,{...b,fromStopId:'X',reservationConfirmed:true,pickupTimeConfirmed:true}).flexBooking.reservationConfirmed,false);
 assert.equal(F.attachBooking(c,{...b,reservationConfirmed:true,pickupTimeConfirmed:false}).flexBooking.reservationConfirmed,false);
 const approved=F.attachBooking(c,{...b,reservationConfirmed:true,pickupTimeConfirmed:true});
 assert.equal(approved.flexBooking.reservationConfirmed,true);
 assert.equal(approved.journeyConfirmed,false);
});
test('Inactive date has no TAD course',()=>{
 assert.deepEqual(F.extract(files,G.buildIndex(files),'2028-01-01'),[]);
});


test('Booking confirmed outside the pickup window is rejected',()=>{
 const [c]=F.extract(files,G.buildIndex(files),'2026-11-23');
 const b={tripId:'T1',date:'2026-11-23',fromStopId:'A',toStopId:'B',
  reservationConfirmed:true,pickupTimeConfirmed:true,requestedPickup:'2026-11-23T11:30:00+01:00'};
 assert.equal(F.attachBooking(c,b).flexBooking.reservationConfirmed,false);
});
test('booking_type=2 prior-day deadline is kept, not invented as same-day minute notice',()=>{
 const f={...files,'booking_rules.txt':'booking_rule_id,booking_type,prior_notice_last_day,prior_notice_last_time,phone_number\nP,2,1,17:00:00,+33123456789\n'};
 const [c]=F.extract(f,G.buildIndex(f),'2026-11-23');
 assert.equal(c.flexBooking.noticeMinutes,null);
 assert.equal(c.pickupRule.bookingType,'2');
 assert.equal(c.pickupRule.priorNoticeLastDay,1);
 assert.equal(c.pickupRule.priorNoticeLastTime,'17:00:00');
 assert.equal(c.pickupRule.phoneNumber,'+33123456789');
});
test('An operator booking with confirmed pickup and arrival becomes a hub row, not an invented fare',()=>{
 const [c]=F.extract(files,G.buildIndex(files),'2026-11-23');
 const b={tripId:'T1',date:'2026-11-23',fromStopId:'A',toStopId:'B',
  reservationConfirmed:true,pickupTimeConfirmed:true,requestedPickup:'2026-11-23T08:30:00+01:00',
  arrivalConfirmed:true,confirmedArrival:'2026-11-23T09:30:00+01:00'};
 assert.equal(F.toHubRow(c,{...b,arrivalConfirmed:false}),null);
 assert.equal(F.toHubRow(c,{...b,confirmedArrival:'2026-11-23T10:30:00+01:00'}),null);
 const row=F.toHubRow(c,b);
 assert.equal(row.isFlex,true);
 assert.equal(row.priceStatus,'unknown');
 const hub=require('../transport-mission-hub.js');
 const [normalized]=hub.fromGTFS([row],'Réseau Flex');
 assert.equal(normalized.flexBooking.reservationConfirmed,true);
 const assessed=hub.assess(normalized,{latestArrival:'2026-11-23T10:00:00+01:00',now:'2026-11-23T08:00:00+01:00'});
 assert.equal(assessed.scheduled,true,'static GTFS does not certify realtime operational execution');
 assert.equal(assessed.price.status,'unknown');
});


test('Mission provider discovers Flex course by GPS but never emits an unbooked timetable',async()=>{
 const hub=require('../transport-mission-hub.js');
 const feed={files,index:G.buildIndex(files)};
 const root={CPGTFSLoader:{loadResource:async()=>feed},CPGTFSIndex:{nearbyDirectTrips:()=>[]},CPGTFSFlexCourses:F};
 const task={from:{lat:45.875,lon:6.1},to:{lat:45.8,lon:6.2},latestArrival:'2026-11-23T10:00:00+01:00'};
 const seen=[];
 const providers=hub.makeProviders(root,{fetcher:async()=>{},onFlexCandidates:x=>seen.push(x)});
 const p=providers.local_cars_isere;
 assert.equal(p.enabled(task),true);
 const unbooked=await p.run(task);
 assert.deepEqual(unbooked,[]);
 assert.equal(seen.length,1);
 assert.equal(seen[0].network,'Cars Région Isère');
 assert.equal(seen[0].candidates[0].status,'Transport non confirmé');
});
test('Mission provider includes only operator-confirmed Flex journey, preserving TAD controls',async()=>{
 const hub=require('../transport-mission-hub.js');
 const feed={files,index:G.buildIndex(files)};
 const root={CPGTFSLoader:{loadResource:async()=>feed},CPGTFSIndex:{nearbyDirectTrips:()=>[]},CPGTFSFlexCourses:F};
 const booking={tripId:'T1',date:'2026-11-23',fromStopId:'A',toStopId:'B',
  reservationConfirmed:true,pickupTimeConfirmed:true,requestedPickup:'2026-11-23T08:30:00+01:00',
  arrivalConfirmed:true,confirmedArrival:'2026-11-23T09:30:00+01:00'};
 const task={from:{lat:45.875,lon:6.1},to:{lat:45.8,lon:6.2},latestArrival:'2026-11-23T10:00:00+01:00'};
 const providers=hub.makeProviders(root,{fetcher:async()=>{},flexBookings:[booking]});
 const journeys=await providers.local_cars_isere.run(task);
 assert.equal(journeys.length,1);
 assert.equal(journeys[0].flexBooking.reservationConfirmed,true);
 assert.equal(journeys[0].flexBooking.pickupTimeConfirmed,true);
 assert.ok(journeys[0].legs[0].departure);
 assert.equal(journeys[0].legs[0].fare,null);
});
