import React, { useEffect, useState } from 'react';
import { emailAPI } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { AlertTriangle, Clock, Loader2, Mail, Play, RefreshCw, Send } from 'lucide-react';
import { toast } from 'sonner';

const errorText = error => error?.response?.data?.detail || 'Email operation failed';
const toggleFields = [
  ['enabled', 'Enable organization emails', 'Master switch for email delivery and reminders.'],
  ['transactional_enabled', 'Transactional updates', 'Trip assignments, invoices, delivery, payments and expense reviews.'],
  ['invoice_reminders_enabled', 'Invoice reminders', 'Notify customers before due dates and while overdue.'],
  ['compliance_reminders_enabled', 'Compliance expiry', 'Warn operations about expiring driver and vehicle documents.'],
  ['delayed_load_reminders_enabled', 'Delayed loads', 'Notify operations when a delivery deadline is missed.'],
  ['pending_expense_reminders_enabled', 'Pending expense approvals', 'Remind operations about submitted expenses awaiting review.'],
];

export default function EmailNotificationPanel() {
  const { user } = useAuth(); const [settings, setSettings] = useState(null); const [outbox, setOutbox] = useState([]); const [busy, setBusy] = useState(false);
  const permissions = user?.permissions || []; const canManage = permissions.includes('*') || permissions.includes('notifications.*') || permissions.includes('notifications.manage');
  const load = async () => { try { const [settingResponse, outboxResponse] = await Promise.all([emailAPI.getSettings(), emailAPI.getOutbox()]); setSettings(settingResponse.data); setOutbox(outboxResponse.data); } catch (error) { toast.error(errorText(error)); } };
  useEffect(() => { load(); }, []);
  const save = async () => { setBusy(true); try { const payload = { ...settings }; delete payload.smtp_configured; delete payload.last_scan_at; delete payload.updated_at; const response = await emailAPI.updateSettings(payload); setSettings(response.data); toast.success('Email settings saved'); } catch (error) { toast.error(errorText(error)); } finally { setBusy(false); } };
  const perform = async (call, success) => { setBusy(true); try { const response = await call(); toast.success(`${success}: ${response.data.sent || 0} sent, ${response.data.queued || 0} queued`); await load(); } catch (error) { toast.error(errorText(error)); } finally { setBusy(false); } };
  if (!settings) return <div className="h-24 flex items-center justify-center"><Loader2 className="animate-spin text-orange-500" /></div>;
  return <div className="space-y-6">
    <Card className="bg-slate-900 border-slate-800"><CardHeader className="border-b border-slate-800"><CardTitle className="text-white flex gap-2"><Mail className="text-orange-500" />Email notifications & reminders</CardTitle></CardHeader><CardContent className="p-6 space-y-5">
      {!settings.smtp_configured && <div className="flex gap-3 rounded border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm text-yellow-300"><AlertTriangle className="w-5 h-5 shrink-0" /><span>SMTP is not configured. Emails can be queued safely, but delivery starts only after the server SMTP variables are added.</span></div>}
      <div className="grid md:grid-cols-2 gap-3">{toggleFields.map(([field, label, description]) => <label key={field} className="flex gap-3 rounded border border-slate-800 bg-slate-950 p-3"><input type="checkbox" checked={!!settings[field]} disabled={!canManage} onChange={event => setSettings({ ...settings, [field]: event.target.checked })} className="mt-1 accent-orange-500" /><span><span className="block text-white font-medium">{label}</span><span className="text-xs text-slate-500">{description}</span></span></label>)}</div>
      <div className="grid sm:grid-cols-3 gap-3"><NumberField label="Invoice reminder days before due" value={settings.invoice_days_before_due} min="0" max="30" disabled={!canManage} onChange={value => setSettings({ ...settings, invoice_days_before_due: value })} /><NumberField label="Compliance warning days" value={settings.compliance_days_before_expiry} min="1" max="180" disabled={!canManage} onChange={value => setSettings({ ...settings, compliance_days_before_expiry: value })} /><NumberField label="Pending expense hours" value={settings.pending_expense_hours} min="1" max="168" disabled={!canManage} onChange={value => setSettings({ ...settings, pending_expense_hours: value })} /></div>
      <div className="flex flex-wrap gap-2">{canManage && <Button onClick={save} disabled={busy} className="bg-orange-500">{busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Save settings</Button>}{canManage && <Button variant="outline" disabled={busy || !settings.enabled} onClick={() => perform(emailAPI.sendTest, 'Test processed')}><Send className="w-4 h-4 mr-2" />Send test to me</Button>}{canManage && <Button variant="outline" disabled={busy || !settings.enabled} onClick={() => perform(emailAPI.runReminders, 'Reminder scan complete')}><Play className="w-4 h-4 mr-2" />Run reminders now</Button>}<span className="ml-auto text-xs text-slate-500 self-center"><Clock className="w-3 h-3 inline mr-1" />Last scan: {settings.last_scan_at ? new Date(settings.last_scan_at).toLocaleString() : 'Not run'}</span></div>
    </CardContent></Card>
    <Card className="bg-slate-900 border-slate-800"><CardHeader className="border-b border-slate-800"><CardTitle className="text-white text-base flex gap-2"><RefreshCw className="w-5 h-5 text-orange-500" />Recent email delivery</CardTitle></CardHeader><CardContent className="p-0 overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-slate-800 text-left text-xs uppercase text-slate-500">{['Created','Recipient','Subject','Type','Status','Attempts'].map(value => <th key={value} className="p-3">{value}</th>)}</tr></thead><tbody>{outbox.map(item => <tr key={item.email_id} className="border-b border-slate-800"><td className="p-3 text-slate-500">{new Date(item.created_at).toLocaleString()}</td><td className="p-3 text-white">{item.recipient_email}</td><td className="p-3 text-slate-300">{item.subject}{item.last_error && <span className="block max-w-xs truncate text-xs text-red-400" title={item.last_error}>{item.last_error}</span>}</td><td className="p-3 text-slate-500 capitalize">{item.notification_type.replaceAll('_',' ')}</td><td className="p-3"><Badge className={item.status === 'sent' ? 'bg-green-500/20 text-green-400' : item.status === 'failed' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'}>{item.status}</Badge></td><td className="p-3 text-slate-500">{item.attempts}</td></tr>)}</tbody></table>{!outbox.length && <div className="py-10 text-center text-slate-500">No email has been queued yet.</div>}</CardContent></Card>
  </div>;
}

function NumberField({ label, value, onChange, ...props }) { return <div><Label>{label}</Label><Input type="number" value={value} onChange={event => onChange(Number(event.target.value))} {...props} className="mt-1 bg-slate-800 border-slate-700" /></div>; }
