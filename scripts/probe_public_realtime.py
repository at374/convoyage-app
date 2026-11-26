"""Probe public endpoints without credentials; HTTP success alone is not validation."""
import json, pathlib, sys, urllib.request, urllib.error, urllib.parse, time
from collections import Counter
import xml.etree.ElementTree as ET
from google.transit import gtfs_realtime_pb2
from google.protobuf.message import DecodeError
data = json.loads(pathlib.Path('realtime-candidates.json').read_text())
limit = int(sys.argv[1]) if len(sys.argv)>1 else 30
# Only official catalogue URLs, HTTPS, no redirects to non-HTTPS or private hosts.
# Restrict initial batch to known public catalogue proxy host.
offset = int(sys.argv[2]) if len(sys.argv)>2 else 0
items = [r for r in data if urllib.parse.urlsplit(r['url']).hostname == 'proxy.transport.data.gouv.fr'][offset:offset+limit]
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*args,**kwargs):
        return None
def probe(r):
    result = dict(r)
    try:
        req = urllib.request.Request(r['url'],headers={'User-Agent':'ConvoyageUltra-CatalogueAudit/1.0'})
        with urllib.request.build_opener(NoRedirect()).open(req,timeout=10) as response:
            cap = 8 * 1024 * 1024
            sample = response.read(cap + 1)
            typ = response.headers.get('Content-Type','')
            result['payload_hint'] = ('html' if b'<html' in sample[:1024].lower() or b'<!doctype html' in sample[:1024].lower() else 'xml' if sample.lstrip().startswith(b'<') else 'json' if sample.lstrip().startswith((b'{',b'[')) else 'binary_or_other')
            result.update(http=response.status,content_type=typ,sample_bytes=len(sample),status='anonymous_response_unvalidated' if sample else 'empty_response')
            if len(sample)>cap:
                result['status']='payload_too_large'
            elif result['payload_hint']=='html':
                result['status']='unexpected_html'
            elif result['payload_hint']=='xml':
                try:
                    root=ET.fromstring(sample)
                    result['xml_root']=root.tag
                    result['status']='siri_xml_structure_detected' if root.tag.split('}')[-1] in ('Siri','ServiceDelivery') else 'unexpected_xml'
                except ET.ParseError:
                    result['status']='invalid_xml'
            elif result['payload_hint']=='json':
                try:
                    obj=json.loads(sample)
                    result['status']='json_parsed_unvalidated'
                    result['json_root_keys']=list(obj)[:20] if isinstance(obj,dict) else []
                except (ValueError,UnicodeError):
                    result['status']='invalid_json'
            elif sample:
                try:
                    feed=gtfs_realtime_pb2.FeedMessage()
                    feed.ParseFromString(sample)
                    if not feed.IsInitialized() or feed.header.gtfs_realtime_version not in ('1.0','2.0'):
                        result['status']='invalid_gtfs_rt_header'
                    else:
                        result['entity_count']=len(feed.entity)
                        result['trip_updates']=sum(e.HasField('trip_update') for e in feed.entity)
                        trip_ids={e.trip_update.trip.trip_id for e in feed.entity if e.HasField('trip_update') and e.trip_update.trip.trip_id}
                        result['distinct_trip_ids']=len(trip_ids)
                        result['trip_id_sample']=sorted(trip_ids)[:50]
                        result['cancelled_updates']=sum(e.HasField('trip_update') and e.trip_update.trip.schedule_relationship==gtfs_realtime_pb2.TripDescriptor.CANCELED for e in feed.entity)
                        result['vehicle_positions']=sum(e.HasField('vehicle') for e in feed.entity)
                        result['alerts']=sum(e.HasField('alert') for e in feed.entity)
                        result['gtfs_rt_version']=feed.header.gtfs_realtime_version
                        stamp=feed.header.timestamp if feed.header.HasField('timestamp') else None
                        result['feed_timestamp']=stamp
                        result['age_seconds']=int(time.time()-stamp) if stamp else None
                        result['status']='gtfs_rt_parsed' if stamp and -60<=result['age_seconds']<=300 else 'gtfs_rt_freshness_unconfirmed'
                except DecodeError:
                    result['status']='invalid_protobuf'
    except urllib.error.HTTPError as e:
        result.update(http=e.code,status='auth_required_or_forbidden' if e.code in (401,403) else 'http_error')
    except (OSError,ValueError) as e:
        result.update(status='connection_error',error=type(e).__name__)
    return result
results=[]
# Sequential requests avoid bursts against the shared public proxy.
for item in items:
    results.append(probe(item))
    if results[-1].get('http')==429:
        break
    time.sleep(1)
pathlib.Path('realtime-probes.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
print('Probe results:',dict(Counter(r['status'] for r in results)))
print('Static GTFS associations:',sum(bool(r.get('static_gtfs_candidates')) for r in results))
print('Distinct datasets probed:',len({r.get('dataset') for r in results}))
print('Payload hints:',dict(Counter(r.get('payload_hint','none') for r in results)))
for r in results:
    print(json.dumps({k:r.get(k) for k in ('dataset','title','format','http','status','payload_hint','entity_count','trip_updates','vehicle_positions','alerts','age_seconds')},ensure_ascii=False))
