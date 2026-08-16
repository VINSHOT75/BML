import React, { useEffect, useMemo, useState } from 'react';
import { customerAPI, driverAPI, loadAPI, transporterAPI, vehicleAPI } from '../lib/api';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Textarea } from '../components/ui/textarea';
import { Building2, Loader2, MapPin, Package, Plus, Route, Truck, Users } from 'lucide-react';
import { toast } from 'sonner';
import LocationPicker from '../components/LocationPicker';

const emptyCustomer = { name: '', contact_name: '', phone: '', email: '', gst_number: '', billing_address: '' };
const emptyLocation = { name: '', address: '', city: '', state: '', postal_code: '', contact_name: '', contact_phone: '', lat: '', lng: '' };
const emptyTransporter = { name: '', contact_name: '', phone: '', email: '', gst_number: '', service_areas: '' };
const emptyLoad = { reference_number: '', customer_id: '', pickup_location_id: '', delivery_location_id: '', transporter_id: '', cargo_type: 'General', cargo_weight_tons: '', quantity: '1', pickup_at: '', delivery_by: '', quoted_amount: '', notes: '' };

const nextActions = {
  draft: [['Submit', 'submitted'], ['Cancel', 'cancelled']],
  submitted: [['Approve', 'approved'], ['Reject', 'rejected'], ['Cancel', 'cancelled']],
  approved: [['Schedule', 'scheduled'], ['Cancel', 'cancelled']],
  delivered: [['Close', 'closed']],
  rejected: [['Return to draft', 'draft'], ['Cancel', 'cancelled']],
};

const statusColor = { draft: 'bg-slate-500/20 text-slate-300', submitted: 'bg-blue-500/20 text-blue-400', approved: 'bg-cyan-500/20 text-cyan-400', scheduled: 'bg-violet-500/20 text-violet-400', allocated: 'bg-amber-500/20 text-amber-400', in_execution: 'bg-orange-500/20 text-orange-400', delivered: 'bg-emerald-500/20 text-emerald-400', closed: 'bg-green-500/20 text-green-400', rejected: 'bg-red-500/20 text-red-400', cancelled: 'bg-red-500/20 text-red-400' };

function Field({ label, ...props }) {
  return <div className="space-y-1.5"><Label className="text-slate-300">{label}</Label><Input {...props} className="bg-slate-800 border-slate-700 text-white" /></div>;
}

function errorMessage(error) { return error?.response?.data?.detail || 'The operation failed'; }

export default function LoadsPage() {
  const [data, setData] = useState({ loads: [], customers: [], transporters: [], drivers: [], vehicles: [] });
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState(null);
  const [customer, setCustomer] = useState(emptyCustomer);
  const [location, setLocation] = useState(emptyLocation);
  const [locationCustomer, setLocationCustomer] = useState(null);
  const [transporter, setTransporter] = useState(emptyTransporter);
  const [load, setLoad] = useState(emptyLoad);
  const [allocation, setAllocation] = useState({ load: null, driver_id: '', vehicle_id: '' });

  const refresh = async () => {
    try {
      const [loads, customers, transporters, drivers, vehicles] = await Promise.all([loadAPI.getAll(), customerAPI.getAll(), transporterAPI.getAll(), driverAPI.getAll(), vehicleAPI.getAll()]);
      setData({ loads: loads.data, customers: customers.data, transporters: transporters.data, drivers: drivers.data, vehicles: vehicles.data });
    } catch (e) { toast.error(errorMessage(e)); } finally { setLoading(false); }
  };
  useEffect(() => { refresh(); }, []);

  const selectedCustomer = useMemo(() => data.customers.find(x => x.customer_id === load.customer_id), [data.customers, load.customer_id]);
  const submit = async (event, type) => {
    event.preventDefault();
    try {
      if (type === 'customer') await customerAPI.create(customer);
      if (type === 'location') await customerAPI.addLocation(locationCustomer.customer_id, { ...location, lat: location.lat ? Number(location.lat) : null, lng: location.lng ? Number(location.lng) : null });
      if (type === 'transporter') await transporterAPI.create(transporter);
      if (type === 'load') await loadAPI.create({ ...load, transporter_id: load.transporter_id || null, cargo_weight_tons: Number(load.cargo_weight_tons), quantity: Number(load.quantity), quoted_amount: load.quoted_amount ? Number(load.quoted_amount) : null, pickup_at: new Date(load.pickup_at).toISOString(), delivery_by: load.delivery_by ? new Date(load.delivery_by).toISOString() : null });
      toast.success(`${type[0].toUpperCase() + type.slice(1)} created`); setDialog(null); setCustomer(emptyCustomer); setLocation(emptyLocation); setTransporter(emptyTransporter); setLoad(emptyLoad); await refresh();
    } catch (e) { toast.error(errorMessage(e)); }
  };
  const changeStatus = async (id, status) => { try { await loadAPI.updateStatus(id, status); toast.success(`Load moved to ${status.replaceAll('_', ' ')}`); await refresh(); } catch (e) { toast.error(errorMessage(e)); } };
  const allocate = async (event) => { event.preventDefault(); try { await loadAPI.allocate(allocation.load.load_id, allocation.driver_id, allocation.vehicle_id); toast.success('Trip created and resources allocated'); setDialog(null); setAllocation({ load: null, driver_id: '', vehicle_id: '' }); await refresh(); } catch (e) { toast.error(errorMessage(e)); } };

  if (loading) return <div className="h-64 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-orange-500" /></div>;
  return <div className="space-y-6" data-testid="loads-page">
    <div><h1 className="text-3xl font-heading font-bold text-white">Load Operations</h1><p className="text-slate-400 mt-1">Manage customers, transport partners, commercial loads and trip allocation.</p></div>
    <Tabs defaultValue="loads">
      <TabsList className="bg-slate-900 border border-slate-800"><TabsTrigger value="loads">Loads</TabsTrigger><TabsTrigger value="customers">Customers</TabsTrigger><TabsTrigger value="transporters">Transporters</TabsTrigger></TabsList>
      <TabsContent value="loads" className="space-y-4 mt-5">
        <div className="flex justify-between items-center"><div className="text-sm text-slate-400">{data.loads.length} load records</div><Button onClick={() => setDialog('load')} className="bg-orange-500 hover:bg-orange-600"><Plus className="w-4 h-4 mr-2" />New Load</Button></div>
        <div className="grid gap-4">
          {data.loads.map(item => <Card key={item.load_id} className="bg-slate-900 border-slate-800"><CardContent className="p-5">
            <div className="flex flex-col xl:flex-row xl:items-center gap-4 justify-between"><div className="space-y-2 min-w-0"><div className="flex items-center gap-3"><Package className="w-5 h-5 text-orange-500" /><span className="font-semibold text-white">{item.reference_number}</span><Badge className={statusColor[item.status]}>{item.status.replaceAll('_', ' ')}</Badge></div><p className="text-sm text-slate-300">{item.customer_name} · {item.cargo_type} · {item.cargo_weight_tons} tons</p><div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500"><span>{item.pickup?.city} → {item.delivery?.city}</span><span>Pickup {new Date(item.pickup_at).toLocaleString()}</span>{item.trip_id && <span className="text-orange-400">Trip {item.trip_id}</span>}</div></div>
              <div className="flex flex-wrap gap-2">{(nextActions[item.status] || []).map(([label, status]) => <Button key={status} size="sm" variant="outline" onClick={() => changeStatus(item.load_id, status)} className="border-slate-700 text-slate-300">{label}</Button>)}{item.status === 'scheduled' && <Button size="sm" onClick={() => { setAllocation({ load: item, driver_id: '', vehicle_id: '' }); setDialog('allocate'); }} className="bg-orange-500 hover:bg-orange-600"><Route className="w-4 h-4 mr-2" />Allocate Trip</Button>}</div></div>
          </CardContent></Card>)}
          {!data.loads.length && <Empty icon={Package} title="No loads yet" text="Create a customer and two locations, then add your first load." />}
        </div>
      </TabsContent>
      <TabsContent value="customers" className="space-y-4 mt-5"><div className="flex justify-end"><Button onClick={() => setDialog('customer')} className="bg-orange-500"><Plus className="w-4 h-4 mr-2" />Add Customer</Button></div><div className="grid md:grid-cols-2 gap-4">{data.customers.map(item => <Card key={item.customer_id} className="bg-slate-900 border-slate-800"><CardHeader><CardTitle className="text-white flex items-center gap-2"><Building2 className="w-5 h-5 text-orange-500" />{item.name}</CardTitle></CardHeader><CardContent className="space-y-3 text-sm"><p className="text-slate-300">{item.contact_name} · {item.phone}</p><div className="space-y-2">{item.locations.map(loc => <div key={loc.location_id} className="rounded bg-slate-800 p-2 text-slate-400"><MapPin className="inline w-3 h-3 mr-1" />{loc.name}, {loc.city}</div>)}</div><Button size="sm" variant="outline" onClick={() => { setLocationCustomer(item); setDialog('location'); }} className="border-slate-700 text-slate-300"><Plus className="w-3 h-3 mr-1" />Location</Button></CardContent></Card>)}</div></TabsContent>
      <TabsContent value="transporters" className="space-y-4 mt-5"><div className="flex justify-end"><Button onClick={() => setDialog('transporter')} className="bg-orange-500"><Plus className="w-4 h-4 mr-2" />Add Transporter</Button></div><div className="grid md:grid-cols-3 gap-4">{data.transporters.map(item => <Card key={item.transporter_id} className="bg-slate-900 border-slate-800"><CardContent className="p-5 space-y-2"><Truck className="w-6 h-6 text-orange-500" /><h3 className="text-white font-semibold">{item.name}</h3><p className="text-sm text-slate-400">{item.contact_name} · {item.phone}</p><p className="text-xs text-slate-500">{item.service_areas || 'Service areas not set'}</p></CardContent></Card>)}</div></TabsContent>
    </Tabs>
    <Dialog open={!!dialog} onOpenChange={open => !open && setDialog(null)}><DialogContent className="bg-slate-900 border-slate-800 max-w-xl max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle className="text-white">{dialog === 'load' ? 'Create Load' : dialog === 'allocate' ? 'Allocate Load to Trip' : dialog === 'location' ? `Add Location — ${locationCustomer?.name}` : `Add ${dialog || ''}`}</DialogTitle></DialogHeader>
      {dialog === 'customer' && <SimpleForm onSubmit={e => submit(e, 'customer')} value={customer} setValue={setCustomer} fields={[['name','Company name'],['contact_name','Contact person'],['phone','Phone'],['email','Email'],['gst_number','GST number'],['billing_address','Billing address']]} />}
      {dialog === 'location' && <LocationPicker onSubmit={e => submit(e, 'location')} value={location} onChange={setLocation} />}
      {dialog === 'transporter' && <SimpleForm onSubmit={e => submit(e, 'transporter')} value={transporter} setValue={setTransporter} fields={[['name','Company name'],['contact_name','Contact person'],['phone','Phone'],['email','Email'],['gst_number','GST number'],['service_areas','Service areas']]} />}
      {dialog === 'load' && <form onSubmit={e => submit(e, 'load')} className="space-y-4"><div className="grid grid-cols-2 gap-3"><Field required label="Reference" value={load.reference_number} onChange={e => setLoad({...load,reference_number:e.target.value})}/><SelectField required label="Customer" value={load.customer_id} onChange={e => setLoad({...load,customer_id:e.target.value,pickup_location_id:'',delivery_location_id:''})} options={data.customers.map(x=>[x.customer_id,x.name])}/><SelectField required label="Pickup" value={load.pickup_location_id} onChange={e=>setLoad({...load,pickup_location_id:e.target.value})} options={(selectedCustomer?.locations||[]).map(x=>[x.location_id,`${x.name}, ${x.city}`])}/><SelectField required label="Delivery" value={load.delivery_location_id} onChange={e=>setLoad({...load,delivery_location_id:e.target.value})} options={(selectedCustomer?.locations||[]).map(x=>[x.location_id,`${x.name}, ${x.city}`])}/><Field required label="Cargo type" value={load.cargo_type} onChange={e=>setLoad({...load,cargo_type:e.target.value})}/><Field required type="number" min="0.01" step="0.01" label="Weight (tons)" value={load.cargo_weight_tons} onChange={e=>setLoad({...load,cargo_weight_tons:e.target.value})}/><Field required type="datetime-local" label="Pickup date" value={load.pickup_at} onChange={e=>setLoad({...load,pickup_at:e.target.value})}/><Field type="datetime-local" label="Deliver by" value={load.delivery_by} onChange={e=>setLoad({...load,delivery_by:e.target.value})}/><Field type="number" min="1" label="Quantity" value={load.quantity} onChange={e=>setLoad({...load,quantity:e.target.value})}/><Field type="number" min="0" step="0.01" label="Quoted amount" value={load.quoted_amount} onChange={e=>setLoad({...load,quoted_amount:e.target.value})}/></div><SelectField label="External transporter (optional)" value={load.transporter_id} onChange={e=>setLoad({...load,transporter_id:e.target.value})} options={data.transporters.map(x=>[x.transporter_id,x.name])}/><Textarea placeholder="Handling notes" value={load.notes} onChange={e=>setLoad({...load,notes:e.target.value})} className="bg-slate-800 border-slate-700 text-white"/><Submit label="Create Load" /></form>}
      {dialog === 'allocate' && <form onSubmit={allocate} className="space-y-4"><p className="text-sm text-slate-400">A linked trip will be created for {allocation.load?.reference_number}. Only available resources with enough capacity can be selected.</p><SelectField required label="Driver" value={allocation.driver_id} onChange={e=>setAllocation({...allocation,driver_id:e.target.value})} options={data.drivers.filter(x=>x.status==='available').map(x=>[x.driver_id,x.name])}/><SelectField required label="Vehicle" value={allocation.vehicle_id} onChange={e=>setAllocation({...allocation,vehicle_id:e.target.value})} options={data.vehicles.filter(x=>x.status==='available' && x.capacity_tons>=allocation.load?.cargo_weight_tons).map(x=>[x.vehicle_id,`${x.registration_number} (${x.capacity_tons}t)`])}/><Submit label="Create & Assign Trip" /></form>}
    </DialogContent></Dialog>
  </div>;
}

function SimpleForm({ onSubmit, value, setValue, fields }) { return <form onSubmit={onSubmit} className="grid grid-cols-2 gap-3">{fields.map(([key,label], i)=><div key={key} className={i===fields.length-1 && fields.length%2 ? 'col-span-2':''}><Field required={['name','contact_name','phone','address','city'].includes(key)} label={label} type={key==='email'?'email':'text'} value={value[key]} onChange={e=>setValue({...value,[key]:e.target.value})}/></div>)}<div className="col-span-2"><Submit label="Save" /></div></form>; }
function SelectField({ label, options, ...props }) { return <div className="space-y-1.5"><Label className="text-slate-300">{label}</Label><select {...props} className="w-full h-10 rounded-md border border-slate-700 bg-slate-800 px-3 text-sm text-white"><option value="">Select...</option>{options.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></div>; }
function Submit({ label }) { return <div className="flex justify-end pt-2"><Button type="submit" className="bg-orange-500 hover:bg-orange-600">{label}</Button></div>; }
function Empty({ icon: Icon, title, text }) { return <Card className="bg-slate-900 border-slate-800"><CardContent className="py-12 text-center"><Icon className="w-10 h-10 mx-auto text-slate-600"/><h3 className="text-white mt-3">{title}</h3><p className="text-sm text-slate-500 mt-1">{text}</p></CardContent></Card>; }
