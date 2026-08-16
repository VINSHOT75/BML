import React, { useEffect, useState } from 'react';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Crosshair, Loader2, MapPin, Search } from 'lucide-react';
import { geocodingAPI } from '../lib/api';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { toast } from 'sonner';

const markerIcon = L.divIcon({ className:'', html:'<div style="font-size:34px;filter:drop-shadow(0 3px 4px #0008);transform:translate(-3px,-26px)">📍</div>', iconSize:[28,38], iconAnchor:[14,38] });
const defaultCenter = [20.5937,78.9629];
const message = error => error?.response?.data?.detail || 'Location service is unavailable';

function MapSelection({ position, onChoose }) {
  useMapEvents({ click: event => onChoose(event.latlng.lat,event.latlng.lng,true) });
  return position ? <Marker draggable position={position} icon={markerIcon} eventHandlers={{ dragend:event => { const point=event.target.getLatLng(); onChoose(point.lat,point.lng,true); } }}/>:null;
}
function Recenter({position}) { const map=useMap(); useEffect(()=>{ if(position) map.setView(position,16); },[position,map]); return null; }

export default function LocationPicker({ value, onChange, onSubmit }) {
  const [query,setQuery]=useState(''); const [results,setResults]=useState([]); const [searching,setSearching]=useState(false); const [locating,setLocating]=useState(false);
  const position=value.lat!==''&&value.lat!=null?[Number(value.lat),Number(value.lng)]:null;
  const applyResult=result=>{ onChange({...value,address:result.display_name||value.address,city:result.city||value.city,state:result.state||value.state,postal_code:result.postal_code||value.postal_code,lat:result.lat,lng:result.lng}); setQuery(result.display_name||''); setResults([]); };
  const reverse=async(lat,lng)=>{ onChange({...value,lat,lng}); try { const response=await geocodingAPI.reverse(lat,lng); applyResult(response.data); } catch(error){ toast.error(message(error)); } };
  const search=async event=>{ event.preventDefault(); if(query.trim().length<3)return toast.error('Enter at least three characters'); setSearching(true); try{const response=await geocodingAPI.search(query);setResults(response.data);if(!response.data.length)toast.info('No matching addresses found');}catch(error){toast.error(message(error));}finally{setSearching(false);} };
  const current=()=>{if(!navigator.geolocation)return toast.error('Location is not supported by this browser');setLocating(true);navigator.geolocation.getCurrentPosition(async point=>{await reverse(point.coords.latitude,point.coords.longitude);setLocating(false);},()=>{toast.error('Location permission was denied');setLocating(false);},{enableHighAccuracy:true,timeout:10000});};
  return <form onSubmit={onSubmit} className="space-y-4">
    <div className="grid grid-cols-2 gap-3"><Field required label="Location name" value={value.name} onChange={e=>onChange({...value,name:e.target.value})}/><Field label="Contact person" value={value.contact_name} onChange={e=>onChange({...value,contact_name:e.target.value})}/><Field label="Contact phone" value={value.contact_phone} onChange={e=>onChange({...value,contact_phone:e.target.value})}/><div className="flex items-end"><Button type="button" variant="outline" onClick={current} disabled={locating} className="w-full border-slate-700 text-slate-300">{locating?<Loader2 className="w-4 h-4 mr-2 animate-spin"/>:<Crosshair className="w-4 h-4 mr-2"/>}Use my location</Button></div></div>
    <div className="space-y-1.5"><Label className="text-slate-300">Search address</Label><div className="flex gap-2"><Input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Building, road, city, state" className="bg-slate-800 border-slate-700 text-white"/><Button type="button" onClick={search} disabled={searching} className="bg-orange-500">{searching?<Loader2 className="w-4 h-4 animate-spin"/>:<Search className="w-4 h-4"/>}</Button></div>{results.length>0&&<div className="rounded border border-slate-700 bg-slate-800 divide-y divide-slate-700 max-h-44 overflow-y-auto">{results.map((result,index)=><button type="button" key={`${result.lat}-${result.lng}-${index}`} onClick={()=>applyResult(result)} className="w-full p-3 text-left text-sm text-slate-300 hover:bg-slate-700"><MapPin className="inline w-3 h-3 mr-2 text-orange-500"/>{result.display_name}</button>)}</div>}</div>
    <div className="h-72 overflow-hidden rounded border border-slate-700"><MapContainer center={position||defaultCenter} zoom={position?16:5} className="h-full w-full"><TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/><MapSelection position={position} onChoose={reverse}/><Recenter position={position}/></MapContainer></div>
    <p className="text-xs text-slate-500">Search results © OpenStreetMap contributors. You can click the map or drag the marker to correct the exact entrance.</p>
    {value.address&&<div className="rounded bg-slate-800 p-3"><p className="text-xs text-slate-500">Selected address</p><p className="text-sm text-white mt-1">{value.address}</p></div>}
    <div className="flex justify-end"><Button type="submit" disabled={!position||!value.address||!value.name} className="bg-orange-500 hover:bg-orange-600">Save Location</Button></div>
  </form>;
}
function Field({label,...props}) { return <div className="space-y-1.5"><Label className="text-slate-300">{label}</Label><Input {...props} className="bg-slate-800 border-slate-700 text-white"/></div>; }
