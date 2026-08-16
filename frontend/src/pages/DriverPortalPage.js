import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { complianceAPI, driverPortalAPI } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Checkbox } from '../components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { CheckCircle2, ClipboardCheck, Loader2, LogOut, MapPin, Navigation, Package, Phone, Truck } from 'lucide-react';
import { toast } from 'sonner';

const events = [
  ['accepted', 'Accept assignment'], ['reached_pickup', 'Reached pickup'], ['loading_started', 'Loading started'],
  ['loaded', 'Loading complete'], ['departed_pickup', 'Departed pickup'], ['reached_destination', 'Reached destination'], ['unloading_started', 'Unloading started'],
];
const emptyCheck = { tires_ok: false, brakes_ok: false, lights_ok: false, mirrors_ok: false, documents_ok: false, fuel_level: 'full', notes: '' };
const emptyPod = { delivered_to: '', delivery_otp: '', signature: '', photo: '', notes: '' };
const detail = e => e?.response?.data?.detail || 'Operation failed';
const position = () => new Promise(resolve => {
  if (!navigator.geolocation) return resolve({});
  navigator.geolocation.getCurrentPosition(value => resolve({ lat: value.coords.latitude, lng: value.coords.longitude }), () => resolve({}), { enableHighAccuracy: true, timeout: 5000 });
});

export default function DriverPortalPage() {
  const { user, logout } = useAuth(); const navigate = useNavigate();
  const [trips, setTrips] = useState([]); const [loading, setLoading] = useState(true); const [dialog, setDialog] = useState(null); const [selected, setSelected] = useState(null); const [check, setCheck] = useState(emptyCheck); const [pod, setPod] = useState(emptyPod);
  const refresh = async () => { try { const response = await driverPortalAPI.getTrips(); setTrips(response.data); } catch (e) { toast.error(detail(e)); } finally { setLoading(false); } };
  useEffect(() => { if (user && user.role !== 'driver') navigate('/dashboard'); else if (user) refresh(); }, [user]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const active = trips.find(trip => trip.status === 'in_progress');
    if (!active || !navigator.geolocation) return undefined;
    const watchId = navigator.geolocation.watchPosition(async value => {
      try {
        await driverPortalAPI.updateLocation(active.trip_id, {
          lat: value.coords.latitude, lng: value.coords.longitude,
          accuracy_meters: value.coords.accuracy,
          speed_kph: value.coords.speed == null ? null : value.coords.speed * 3.6,
          heading: value.coords.heading,
          recorded_at: new Date(value.timestamp).toISOString(),
        });
      } catch (error) { console.warn('Location update failed', error); }
    }, () => toast.warning('Enable location permission for live trip tracking.'), { enableHighAccuracy: true, maximumAge: 15000, timeout: 15000 });
    return () => navigator.geolocation.clearWatch(watchId);
  }, [trips]);
  const record = async (trip, event_type) => { try { await driverPortalAPI.addEvent(trip.trip_id, { event_type, ...await position() }); toast.success(event_type.replaceAll('_',' ')); await refresh(); } catch (e) { toast.error(detail(e)); } };
  const inspect = async e => { e.preventDefault(); try { await complianceAPI.createPreTripCheck({ trip_id:selected.trip_id, driver_id:selected.driver_id, vehicle_id:selected.vehicle_id, ...check }); toast.success('Inspection submitted'); setDialog(null); setCheck(emptyCheck); await refresh(); } catch(e) { toast.error(detail(e)); } };
  const start = async trip => { try { await driverPortalAPI.startTrip(trip.trip_id); toast.success('Trip started'); await refresh(); } catch(e) { toast.error(detail(e)); } };
  const deliver = async e => { e.preventDefault(); try { await driverPortalAPI.completeTrip(selected.trip_id, { ...pod, delivery_otp:pod.delivery_otp||null, signature:pod.signature||null, photo:pod.photo||null, ...await position() }); toast.success('Delivery completed'); setDialog(null); setPod(emptyPod); await refresh(); } catch(err) { toast.error(detail(err)); } };
  const capturePhoto = e => { const file = e.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => setPod(current => ({...current, photo:reader.result})); reader.readAsDataURL(file); };
  const signOut = async () => { await logout(); navigate('/'); };
  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="animate-spin text-orange-500" /></div>;
  return <div className="min-h-screen bg-slate-950 text-white"><header className="sticky top-0 z-10 bg-slate-900 border-b border-slate-800 px-4 py-3 flex justify-between items-center"><div><img src="/logo.svg" alt="BookMyLoad" className="h-8"/><p className="text-xs text-slate-500 mt-1">Driver workspace · {user?.name}</p></div><Button variant="ghost" onClick={signOut}><LogOut className="w-4 h-4 mr-2"/>Logout</Button></header><main className="max-w-3xl mx-auto p-4 space-y-4"><div><h1 className="text-2xl font-bold">My Trips</h1><p className="text-sm text-slate-400">Only trips assigned to your driver profile appear here.</p></div>
    {trips.map(trip => { const done = new Set(trip.events.map(x=>x.event_type)); const next = events.find(([key])=>!done.has(key)); return <Card key={trip.trip_id} className="bg-slate-900 border-slate-800"><CardContent className="p-5 space-y-5"><div className="flex justify-between gap-3"><div><p className="font-mono text-xs text-orange-500">{trip.trip_id}</p><h2 className="font-semibold mt-1">{trip.origin}</h2><p className="text-slate-500 text-sm my-1">to</p><h2 className="font-semibold">{trip.destination}</h2></div><Badge className="h-fit bg-orange-500/20 text-orange-400">{trip.status.replaceAll('_',' ')}</Badge></div><div className="grid grid-cols-2 gap-3 text-sm"><div className="bg-slate-800 rounded p-3"><Package className="w-4 h-4 text-orange-500 mb-1"/>{trip.cargo_type} · {trip.cargo_weight_tons}T</div><div className="bg-slate-800 rounded p-3"><Truck className="w-4 h-4 text-orange-500 mb-1"/>{trip.vehicle?.registration_number || 'Vehicle'}</div></div>{trip.customer_phone && <a href={`tel:${trip.customer_phone}`} className="flex items-center gap-2 text-sm text-blue-400"><Phone className="w-4 h-4"/>Call customer</a>}
      <div className="space-y-2"><p className="text-xs uppercase tracking-wide text-slate-500">Execution timeline</p>{events.map(([key,label])=><div key={key} className={`flex items-center gap-2 text-sm ${done.has(key)?'text-green-400':'text-slate-600'}`}><CheckCircle2 className="w-4 h-4"/>{label}</div>)}</div>
      {['assigned','in_progress'].includes(trip.status) && <div className="flex flex-wrap gap-2">{next && (trip.status === 'in_progress' || next[0] === 'accepted') && <Button onClick={()=>record(trip,next[0])} className="bg-orange-500 hover:bg-orange-600"><MapPin className="w-4 h-4 mr-2"/>{next[1]}</Button>}<Button variant="outline" onClick={()=>{setSelected(trip);setDialog('check')}} className="border-slate-700"><ClipboardCheck className="w-4 h-4 mr-2"/>{trip.pre_trip_passed?'Redo inspection':'Pre-trip inspection'}</Button>{trip.status==='assigned' && done.has('accepted') && trip.pre_trip_passed && <Button onClick={()=>start(trip)} className="bg-green-600 hover:bg-green-700"><Navigation className="w-4 h-4 mr-2"/>Start trip</Button>}{trip.status==='in_progress' && done.has('reached_destination') && <Button onClick={()=>{setSelected(trip);setDialog('pod')}} className="bg-green-600 hover:bg-green-700">Proof & complete</Button>}</div>}
    </CardContent></Card>})}{!trips.length && <Card className="bg-slate-900 border-slate-800"><CardContent className="py-16 text-center text-slate-400"><Truck className="w-12 h-12 mx-auto mb-3 text-slate-600"/>No trips are assigned to you.</CardContent></Card>}</main>
    <Dialog open={!!dialog} onOpenChange={open=>!open&&setDialog(null)}><DialogContent className="bg-slate-900 border-slate-800 text-white"><DialogHeader><DialogTitle>{dialog==='check'?'Pre-trip inspection':'Proof of delivery'}</DialogTitle></DialogHeader>{dialog==='check' && <form onSubmit={inspect} className="space-y-4">{[['tires_ok','Tyres'],['brakes_ok','Brakes'],['lights_ok','Lights'],['mirrors_ok','Mirrors'],['documents_ok','Vehicle documents']].map(([key,label])=><label key={key} className="flex items-center gap-3 rounded bg-slate-800 p-3"><Checkbox checked={check[key]} onCheckedChange={v=>setCheck({...check,[key]:!!v})}/>{label} passed</label>)}<Textarea placeholder="Inspection notes" value={check.notes} onChange={e=>setCheck({...check,notes:e.target.value})} className="bg-slate-800 border-slate-700"/><Button type="submit" className="w-full bg-orange-500">Submit inspection</Button></form>}{dialog==='pod' && <form onSubmit={deliver} className="space-y-3"><Field required label="Recipient name" value={pod.delivered_to} onChange={e=>setPod({...pod,delivered_to:e.target.value})}/><Field label="Delivery OTP" value={pod.delivery_otp} onChange={e=>setPod({...pod,delivery_otp:e.target.value})}/><Field label="Recipient signature/name" value={pod.signature} onChange={e=>setPod({...pod,signature:e.target.value})}/><Field label="Delivery photo URL" value={pod.photo} onChange={e=>setPod({...pod,photo:e.target.value})}/><Textarea placeholder="Delivery, damage or shortage notes" value={pod.notes} onChange={e=>setPod({...pod,notes:e.target.value})} className="bg-slate-800 border-slate-700"/><p className="text-xs text-slate-500">Provide at least one of OTP, signature, or photo.</p><Button type="submit" className="w-full bg-green-600">Complete delivery</Button></form>}</DialogContent></Dialog>
  </div>;
}
function Field({label,...props}) { return <div className="space-y-1"><Label>{label}</Label><Input {...props} className="bg-slate-800 border-slate-700 text-white"/></div>; }
