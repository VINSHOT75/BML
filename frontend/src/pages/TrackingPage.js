import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, Popup, Polyline, TileLayer, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { trackingAPI } from '../lib/api';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { AlertTriangle, Clock, Loader2, MapPin, Navigation, RefreshCw, Route, Satellite, Truck } from 'lucide-react';
import { toast } from 'sonner';

const vehicleIcon = L.divIcon({ className: '', html: '<div style="width:34px;height:34px;border-radius:50%;background:#f97316;border:3px solid white;box-shadow:0 3px 12px #0008;display:flex;align-items:center;justify-content:center;font-size:17px">🚚</div>', iconSize: [34,34], iconAnchor: [17,17] });
const pointIcon = color => L.divIcon({ className: '', html: `<div style="width:16px;height:16px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 2px 7px #0008"></div>`, iconSize:[16,16], iconAnchor:[8,8] });
const pickupIcon = pointIcon('#22c55e'); const deliveryIcon = pointIcon('#ef4444');

function FitMap({ items, selected }) {
  const map = useMap();
  useEffect(() => {
    const source = selected ? [selected] : items;
    const points = source.flatMap(item => {
      const trip = item.trip; const values = [];
      if (item.last_location) values.push([item.last_location.lat,item.last_location.lng]);
      if (trip.origin_lat != null) values.push([trip.origin_lat,trip.origin_lng]);
      if (trip.destination_lat != null) values.push([trip.destination_lat,trip.destination_lng]);
      return values;
    });
    if (points.length === 1) map.setView(points[0], 13); else if (points.length > 1) map.fitBounds(points, { padding:[45,45], maxZoom:15 });
  }, [items, selected, map]);
  return null;
}

const ageText = seconds => seconds == null ? 'No signal yet' : seconds < 60 ? `${seconds}s ago` : `${Math.floor(seconds/60)}m ago`;
const alertText = value => ({ no_signal:'No GPS signal', stale:'Location is stale', low_accuracy:'Low GPS accuracy' }[value]);

export default function TrackingPage() {
  const [items,setItems] = useState([]); const [selectedId,setSelectedId] = useState(null); const [loading,setLoading] = useState(true);
  const refresh = async silent => { try { const response = await trackingAPI.getActive(); setItems(response.data); if (!selectedId && response.data[0]) setSelectedId(response.data[0].trip.trip_id); } catch(e) { if(!silent) toast.error(e?.response?.data?.detail || 'Failed to load tracking'); } finally { setLoading(false); } };
  useEffect(() => { refresh(); const timer=setInterval(()=>refresh(true),15000); return()=>clearInterval(timer); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const selected = useMemo(()=>items.find(x=>x.trip.trip_id===selectedId)||null,[items,selectedId]);
  if(loading) return <div className="h-64 flex items-center justify-center"><Loader2 className="animate-spin text-orange-500"/></div>;
  return <div className="space-y-5"><div className="flex items-center justify-between"><div><h1 className="text-3xl font-bold text-white">Live Tracking</h1><p className="text-sm text-slate-400">OpenStreetMap · refreshes every 15 seconds</p></div><Button variant="outline" onClick={()=>refresh()} className="border-slate-700"><RefreshCw className="w-4 h-4 mr-2"/>Refresh</Button></div>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3"><Stat icon={Truck} value={items.length} label="Active trips"/><Stat icon={Satellite} value={items.filter(x=>x.last_location).length} label="Reporting GPS"/><Stat icon={AlertTriangle} value={items.filter(x=>x.alert).length} label="Alerts"/><Stat icon={MapPin} value={items.filter(x=>x.geofence?.suggestion).length} label="Geofence suggestions"/></div>
    <div className="grid lg:grid-cols-[1fr_320px] gap-4"><Card className="bg-slate-900 border-slate-800 overflow-hidden"><CardContent className="p-0"><div className="h-[570px] relative z-0"><MapContainer center={[20.5937,78.9629]} zoom={5} className="h-full w-full" zoomControl><TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/><FitMap items={items} selected={selected}/>{items.map(item=><TripLayer key={item.trip.trip_id} item={item} selected={item.trip.trip_id===selectedId} onSelect={()=>setSelectedId(item.trip.trip_id)}/>)}</MapContainer></div></CardContent></Card>
      <div className="space-y-3 max-h-[570px] overflow-y-auto">{items.map(item=><Card key={item.trip.trip_id} onClick={()=>setSelectedId(item.trip.trip_id)} className={`cursor-pointer bg-slate-900 ${selectedId===item.trip.trip_id?'border-orange-500':'border-slate-800'}`}><CardContent className="p-4 space-y-3"><div className="flex justify-between gap-2"><div><p className="font-mono text-sm text-white">{item.vehicle?.registration_number}</p><p className="text-xs text-slate-500">{item.driver?.name}</p></div><Badge className={item.alert?'bg-red-500/20 text-red-400':'bg-green-500/20 text-green-400'}>{item.alert?'Attention':'Live'}</Badge></div><div className="text-xs text-slate-400"><Route className="inline w-3 h-3 mr-1"/>{item.trip.origin} → {item.trip.destination}</div><div className="flex justify-between text-xs"><span className="text-slate-500"><Clock className="inline w-3 h-3 mr-1"/>{ageText(item.last_update_seconds)}</span><span className="text-orange-400">{item.current_milestone?.replaceAll('_',' ')||'Started'}</span></div>{item.alert&&<p className="text-xs text-red-400"><AlertTriangle className="inline w-3 h-3 mr-1"/>{alertText(item.alert)}</p>}{item.geofence?.suggestion&&<p className="rounded bg-blue-500/10 p-2 text-xs text-blue-400">Suggested: {item.geofence.suggestion.replaceAll('_',' ')}</p>}</CardContent></Card>)}{!items.length&&<Card className="bg-slate-900 border-slate-800"><CardContent className="py-12 text-center text-slate-500"><Navigation className="w-10 h-10 mx-auto mb-2"/>No trips are currently in progress.</CardContent></Card>}</div></div>
    {selected&&<Card className="bg-slate-900 border-slate-800"><CardContent className="p-5 grid sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm"><Info label="Driver" value={selected.driver?.name}/><Info label="Vehicle" value={selected.vehicle?.registration_number}/><Info label="GPS accuracy" value={selected.last_location?.accuracy_meters?`${Math.round(selected.last_location.accuracy_meters)} m`:'Unknown'}/><Info label="Speed" value={selected.last_location?.speed_kph!=null?`${Math.round(selected.last_location.speed_kph)} km/h`:'Unknown'}/></CardContent></Card>}
  </div>;
}

function TripLayer({item,selected,onSelect}) { const trip=item.trip; const history=item.history.map(x=>[x.lat,x.lng]); return <>{history.length>1&&<Polyline positions={history} pathOptions={{color:selected?'#f97316':'#64748b',weight:selected?5:3,opacity:.85}}/>}{trip.origin_lat!=null&&<><Circle center={[trip.origin_lat,trip.origin_lng]} radius={500} pathOptions={{color:'#22c55e',fillOpacity:.06}}/><Marker position={[trip.origin_lat,trip.origin_lng]} icon={pickupIcon}><Popup>Pickup: {trip.origin}</Popup></Marker></>}{trip.destination_lat!=null&&<><Circle center={[trip.destination_lat,trip.destination_lng]} radius={500} pathOptions={{color:'#ef4444',fillOpacity:.06}}/><Marker position={[trip.destination_lat,trip.destination_lng]} icon={deliveryIcon}><Popup>Destination: {trip.destination}</Popup></Marker></>}{item.last_location&&<Marker position={[item.last_location.lat,item.last_location.lng]} icon={vehicleIcon} eventHandlers={{click:onSelect}}><Popup><b>{item.vehicle?.registration_number}</b><br/>{item.driver?.name}<br/>{ageText(item.last_update_seconds)}</Popup></Marker>}</>; }
function Stat({icon:Icon,value,label}) { return <Card className="bg-slate-900 border-slate-800"><CardContent className="p-4"><Icon className="w-4 h-4 text-orange-500"/><p className="text-2xl font-bold text-white mt-2">{value}</p><p className="text-xs text-slate-500">{label}</p></CardContent></Card>; }
function Info({label,value}) { return <div><p className="text-xs uppercase text-slate-500">{label}</p><p className="text-white mt-1">{value||'—'}</p></div>; }
