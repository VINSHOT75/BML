import React, { useEffect, useMemo, useState } from 'react';
import { complianceAPI, driverAPI, vehicleAPI } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { AlertTriangle, Clock, Eye, FileCheck, FileUp, Loader2, ShieldCheck, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const documentTypes = {
  driver: [['license', 'Driving licence'], ['identity', 'Identity proof'], ['medical', 'Medical certificate']],
  vehicle: [['registration', 'Registration certificate'], ['insurance', 'Insurance'], ['fitness', 'Fitness certificate'], ['pollution', 'Pollution certificate'], ['permit', 'National/state permit']],
};
const blank = { entity_type: 'vehicle', entity_id: '', document_type: 'registration', document_number: '', issued_at: '', expires_at: '', file_name: '', mime_type: '', file_data: '', notes: '' };
const errorText = error => error?.response?.data?.detail || 'Operation failed';

export default function CompliancePage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [drivers, setDrivers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState(null);
  const [form, setForm] = useState(blank);
  const canManage = user?.permissions?.includes('*') || user?.permissions?.includes('compliance.*');

  const load = async () => {
    try {
      const [summaryResponse, driverResponse, vehicleResponse] = await Promise.all([complianceAPI.getSummary(), driverAPI.getAll(), vehicleAPI.getAll()]);
      setSummary(summaryResponse.data); setDrivers(driverResponse.data); setVehicles(vehicleResponse.data);
    } catch (error) { toast.error(errorText(error)); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const entities = form.entity_type === 'driver' ? drivers : vehicles;
  const entityNames = useMemo(() => Object.fromEntries([...drivers.map(x => [x.driver_id, x.name]), ...vehicles.map(x => [x.vehicle_id, x.registration_number])]), [drivers, vehicles]);

  const showUpload = () => {
    const entityId = vehicles[0]?.vehicle_id || '';
    setForm({ ...blank, entity_id: entityId });
    setOpen(true);
  };
  const changeEntityType = entityType => {
    const list = entityType === 'driver' ? drivers : vehicles;
    setForm(current => ({ ...current, entity_type: entityType, entity_id: list[0]?.driver_id || list[0]?.vehicle_id || '', document_type: entityType === 'driver' ? 'license' : 'registration' }));
  };
  const chooseFile = event => {
    const file = event.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setForm(current => ({ ...current, file_name: file.name, mime_type: file.type, file_data: reader.result }));
    reader.readAsDataURL(file);
  };
  const upload = async event => {
    event.preventDefault();
    if (!form.entity_id) return toast.error(`Select a ${form.entity_type}`);
    try {
      await complianceAPI.uploadDocument({ ...form, issued_at: form.issued_at ? new Date(form.issued_at).toISOString() : null, expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null });
      toast.success('Document uploaded'); setOpen(false); setForm(blank); load();
    } catch (error) { toast.error(errorText(error)); }
  };
  const verify = async (id, status) => { try { await complianceAPI.verifyDocument(id, status); toast.success(`Document ${status}`); load(); } catch (error) { toast.error(errorText(error)); } };
  const view = async id => {
    try { setPreview((await complianceAPI.getFile(id)).data); }
    catch (error) { toast.error(errorText(error)); }
  };
  const remove = async id => { if (!window.confirm('Delete this document?')) return; try { await complianceAPI.deleteDocument(id); load(); } catch (error) { toast.error(errorText(error)); } };

  if (loading) return <div className="h-64 flex items-center justify-center"><Loader2 className="animate-spin text-orange-500" /></div>;
  return <div className="space-y-6">
    <div className="flex justify-between items-center"><div><h1 className="text-3xl font-bold text-white">Documents & Compliance</h1><p className="text-sm text-slate-400">Upload, verify and monitor driver and vehicle records.</p></div>{canManage && <Button onClick={showUpload} className="bg-orange-500"><FileUp className="w-4 h-4 mr-2" />Upload</Button>}</div>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3"><Stat icon={FileCheck} label="Documents" value={summary.total} /><Stat icon={Clock} label="Pending verification" value={summary.pending} /><Stat icon={AlertTriangle} label="Expiring in 30 days" value={summary.expiring} /><Stat icon={ShieldCheck} label="Expired" value={summary.expired} /></div>
    <Card className="bg-slate-900 border-slate-800"><CardContent className="p-0 overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-slate-800 text-left text-xs uppercase text-slate-500">{['Entity', 'Document', 'Number', 'Expiry', 'Verification', 'Actions'].map(value => <th key={value} className="p-3">{value}</th>)}</tr></thead><tbody>{summary.documents.map(document => <tr key={document.document_id} className="border-b border-slate-800"><td className="p-3 text-white"><span className="capitalize text-slate-500">{document.entity_type}</span><br />{entityNames[document.entity_id] || document.entity_id}</td><td className="p-3 text-slate-300 capitalize">{document.document_type.replaceAll('_', ' ')}</td><td className="p-3 text-slate-400">{document.document_number || '—'}</td><td className="p-3"><Badge className={document.compliance_state === 'expired' ? 'bg-red-500/20 text-red-400' : document.compliance_state === 'expiring' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-green-500/20 text-green-400'}>{document.expires_at ? new Date(document.expires_at).toLocaleDateString() : 'No expiry'}</Badge></td><td className="p-3"><Badge className="bg-slate-700 text-slate-300">{document.verification_status}</Badge></td><td className="p-3"><div className="flex gap-1"><Button size="icon" variant="ghost" onClick={() => view(document.document_id)}><Eye className="w-4 h-4" /></Button>{canManage && document.verification_status === 'pending' && <><Button size="sm" variant="ghost" onClick={() => verify(document.document_id, 'verified')} className="text-green-400">Verify</Button><Button size="sm" variant="ghost" onClick={() => verify(document.document_id, 'rejected')} className="text-red-400">Reject</Button></>}{canManage && <Button size="icon" variant="ghost" onClick={() => remove(document.document_id)} className="text-red-400"><Trash2 className="w-4 h-4" /></Button>}</div></td></tr>)}</tbody></table>{!summary.documents.length && <div className="py-14 text-center text-slate-500"><FileCheck className="w-10 h-10 mx-auto mb-2" />No documents uploaded yet.</div>}</CardContent></Card>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="bg-slate-900 border-slate-800 text-white"><DialogHeader><DialogTitle>Upload compliance document</DialogTitle></DialogHeader><form onSubmit={upload} className="space-y-3"><div className="grid grid-cols-2 gap-3"><SelectField label="Entity type" value={form.entity_type} onChange={event => changeEntityType(event.target.value)} options={[['driver', 'Driver'], ['vehicle', 'Vehicle']]} /><SelectField required label="Entity" value={form.entity_id} onChange={event => setForm({ ...form, entity_id: event.target.value })} options={entities.map(entity => [entity.driver_id || entity.vehicle_id, entity.name || entity.registration_number])} placeholder={`Select ${form.entity_type}`} /><SelectField required label="Document type" value={form.document_type} onChange={event => setForm({ ...form, document_type: event.target.value })} options={documentTypes[form.entity_type]} /><Field label="Document number" value={form.document_number} onChange={event => setForm({ ...form, document_number: event.target.value })} /><Field type="date" label="Issue date" value={form.issued_at} onChange={event => setForm({ ...form, issued_at: event.target.value })} /><Field type="date" label="Expiry date" value={form.expires_at} onChange={event => setForm({ ...form, expires_at: event.target.value })} /></div><div><Label>File (PDF or image, maximum 5 MB)</Label><Input required type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={chooseFile} className="bg-slate-800 border-slate-700 mt-1" /></div><Button type="submit" disabled={!form.file_data || !form.entity_id} className="w-full bg-orange-500">Upload document</Button></form></DialogContent></Dialog>
    <Dialog open={!!preview} onOpenChange={isOpen => !isOpen && setPreview(null)}>
      <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-4xl">
        <DialogHeader><DialogTitle>{preview?.file_name || 'Document preview'}</DialogTitle></DialogHeader>
        {preview?.mime_type === 'application/pdf'
          ? <iframe title="Document preview" src={preview.file_data} className="w-full h-[70vh] rounded bg-white" />
          : preview && <img src={preview.file_data} alt={preview.file_name} className="max-h-[70vh] w-full object-contain rounded bg-slate-950" />}
      </DialogContent>
    </Dialog>
  </div>;
}

function Stat({ icon: Icon, label, value }) { return <Card className="bg-slate-900 border-slate-800"><CardContent className="p-4"><Icon className="w-4 h-4 text-orange-500" /><p className="text-2xl text-white font-bold mt-2">{value}</p><p className="text-xs text-slate-500">{label}</p></CardContent></Card>; }
function Field({ label, ...props }) { return <div><Label>{label}</Label><Input {...props} className="bg-slate-800 border-slate-700 mt-1" /></div>; }
function SelectField({ label, options, placeholder, ...props }) { return <div><Label>{label}</Label><select {...props} className="w-full h-10 rounded border border-slate-700 bg-slate-800 px-2 mt-1">{placeholder && <option value="">{placeholder}</option>}{options.map(([value, text]) => <option value={value} key={value}>{text}</option>)}</select></div>; }
