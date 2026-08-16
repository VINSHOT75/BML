import React, { useEffect, useMemo, useState } from 'react';
import { commercialAPI, loadAPI } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Banknote, FileText, Loader2, Plus, ReceiptIndianRupee, Send } from 'lucide-react';
import { toast } from 'sonner';

const quoteBlank = { load_id: '', base_amount: '', fuel_surcharge: '0', toll_charges: '0', handling_charges: '0', tax_rate: '18', valid_until: '', terms: '' };
const invoiceBlank = { load_id: '', subtotal: '', tax_rate: '18', due_at: '', notes: '' };
const paymentBlank = { amount: '', paid_at: '', payment_method: 'bank_transfer', reference: '', notes: '' };
const errorText = error => error?.response?.data?.detail || 'Operation failed';
const currency = value => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(value || 0));
const stateClass = status => status === 'paid' || status === 'accepted' ? 'bg-green-500/20 text-green-400' : status === 'overdue' || status === 'rejected' ? 'bg-red-500/20 text-red-400' : status === 'partially_paid' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-slate-700 text-slate-300';

export default function FinancePage() {
  const { user } = useAuth();
  const [tab, setTab] = useState('quotations');
  const [quotations, setQuotations] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loads, setLoads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState(null);
  const [quote, setQuote] = useState(quoteBlank);
  const [invoice, setInvoice] = useState(invoiceBlank);
  const [payment, setPayment] = useState(paymentBlank);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const canManage = user?.permissions?.includes('*') || user?.permissions?.includes('commercial.*');

  const refresh = async () => {
    try {
      const [quoteResponse, invoiceResponse, loadResponse] = await Promise.all([commercialAPI.getQuotations(), commercialAPI.getInvoices(), loadAPI.getAll()]);
      setQuotations(quoteResponse.data); setInvoices(invoiceResponse.data); setLoads(loadResponse.data);
    } catch (error) { toast.error(errorText(error)); } finally { setLoading(false); }
  };
  useEffect(() => { refresh(); }, []);

  const quotedIds = useMemo(() => new Set(quotations.map(item => item.load_id)), [quotations]);
  const invoicedIds = useMemo(() => new Set(invoices.map(item => item.load_id)), [invoices]);
  const quoteLoads = loads.filter(item => !quotedIds.has(item.load_id) && !['delivered', 'closed', 'cancelled'].includes(item.status));
  const invoiceLoads = loads.filter(item => ['delivered', 'closed'].includes(item.status) && !invoicedIds.has(item.load_id));
  const outstanding = invoices.reduce((sum, item) => sum + Number(item.balance_due), 0);
  const collected = invoices.reduce((sum, item) => sum + Number(item.amount_paid), 0);

  const openQuote = () => { setQuote({ ...quoteBlank, load_id: quoteLoads[0]?.load_id || '' }); setDialog('quote'); };
  const openInvoice = () => {
    const load = invoiceLoads[0];
    const accepted = quotations.find(item => item.load_id === load?.load_id && item.status === 'accepted');
    setInvoice({ ...invoiceBlank, load_id: load?.load_id || '', subtotal: accepted ? String(accepted.subtotal) : String(load?.quoted_amount || '') , tax_rate: accepted ? String(accepted.tax_rate) : '18' }); setDialog('invoice');
  };
  const selectInvoiceLoad = loadId => {
    const load = loads.find(item => item.load_id === loadId); const accepted = quotations.find(item => item.load_id === loadId && item.status === 'accepted');
    setInvoice(current => ({ ...current, load_id: loadId, subtotal: accepted ? String(accepted.subtotal) : String(load?.quoted_amount || ''), tax_rate: accepted ? String(accepted.tax_rate) : '18' }));
  };
  const saveQuote = async event => {
    event.preventDefault();
    try { await commercialAPI.createQuotation({ ...quote, ...numericQuote(quote), valid_until: quote.valid_until ? new Date(`${quote.valid_until}T23:59:59`).toISOString() : null }); toast.success('Quotation created'); setDialog(null); refresh(); }
    catch (error) { toast.error(errorText(error)); }
  };
  const quoteStatus = async (id, status) => { try { await commercialAPI.updateQuotationStatus(id, status); toast.success(`Quotation ${status}`); refresh(); } catch (error) { toast.error(errorText(error)); } };
  const saveInvoice = async event => {
    event.preventDefault();
    try { await commercialAPI.createInvoice({ ...invoice, subtotal: Number(invoice.subtotal), tax_rate: Number(invoice.tax_rate), due_at: invoice.due_at ? new Date(`${invoice.due_at}T23:59:59`).toISOString() : null }); toast.success('Invoice created'); setDialog(null); refresh(); }
    catch (error) { toast.error(errorText(error)); }
  };
  const issue = async id => { try { await commercialAPI.issueInvoice(id); toast.success('Invoice issued'); refresh(); } catch (error) { toast.error(errorText(error)); } };
  const openPayment = value => { setSelectedInvoice(value); setPayment({ ...paymentBlank, amount: String(value.balance_due) }); setDialog('payment'); };
  const savePayment = async event => {
    event.preventDefault();
    try { await commercialAPI.recordPayment(selectedInvoice.invoice_id, { ...payment, amount: Number(payment.amount), paid_at: payment.paid_at ? new Date(`${payment.paid_at}T12:00:00`).toISOString() : null }); toast.success('Payment recorded'); setDialog(null); refresh(); }
    catch (error) { toast.error(errorText(error)); }
  };

  if (loading) return <div className="h-64 flex items-center justify-center"><Loader2 className="animate-spin text-orange-500" /></div>;
  return <div className="space-y-6">
    <div className="flex flex-wrap justify-between gap-3"><div><h1 className="text-3xl font-bold text-white">Finance</h1><p className="text-sm text-slate-400">Quote loads, invoice deliveries and track customer payments.</p></div>{canManage && <div className="flex gap-2"><Button onClick={openQuote} disabled={!quoteLoads.length} variant="outline" className="border-slate-700"><Plus className="w-4 h-4 mr-2" />Quotation</Button><Button onClick={openInvoice} disabled={!invoiceLoads.length} className="bg-orange-500"><ReceiptIndianRupee className="w-4 h-4 mr-2" />Invoice</Button></div>}</div>
    <div className="grid sm:grid-cols-3 gap-3"><Stat icon={FileText} label="Quotations" value={quotations.length} /><Stat icon={Banknote} label="Collected" value={currency(collected)} /><Stat icon={ReceiptIndianRupee} label="Outstanding" value={currency(outstanding)} /></div>
    <div className="flex gap-2 border-b border-slate-800"><Tab active={tab === 'quotations'} onClick={() => setTab('quotations')}>Quotations</Tab><Tab active={tab === 'invoices'} onClick={() => setTab('invoices')}>Invoices & payments</Tab></div>
    {tab === 'quotations' ? <QuoteTable values={quotations} canManage={canManage} changeStatus={quoteStatus} /> : <InvoiceTable values={invoices} canManage={canManage} issue={issue} pay={openPayment} />}

    <Dialog open={dialog === 'quote'} onOpenChange={open => !open && setDialog(null)}><DialogContent className="bg-slate-900 border-slate-800 text-white"><DialogHeader><DialogTitle>Create quotation</DialogTitle></DialogHeader><form onSubmit={saveQuote} className="space-y-3"><Select label="Load" required value={quote.load_id} onChange={event => setQuote({ ...quote, load_id: event.target.value })} values={quoteLoads.map(item => [item.load_id, `${item.reference_number} · ${item.customer_name}`])} /><div className="grid grid-cols-2 gap-3"><Field required type="number" min="0.01" step="0.01" label="Base freight (₹)" value={quote.base_amount} onChange={event => setQuote({ ...quote, base_amount: event.target.value })} /><Field type="number" min="0" step="0.01" label="Fuel surcharge" value={quote.fuel_surcharge} onChange={event => setQuote({ ...quote, fuel_surcharge: event.target.value })} /><Field type="number" min="0" step="0.01" label="Toll charges" value={quote.toll_charges} onChange={event => setQuote({ ...quote, toll_charges: event.target.value })} /><Field type="number" min="0" step="0.01" label="Handling charges" value={quote.handling_charges} onChange={event => setQuote({ ...quote, handling_charges: event.target.value })} /><Field type="number" min="0" max="100" step="0.01" label="Tax rate (%)" value={quote.tax_rate} onChange={event => setQuote({ ...quote, tax_rate: event.target.value })} /><Field type="date" label="Valid until" value={quote.valid_until} onChange={event => setQuote({ ...quote, valid_until: event.target.value })} /></div><Field label="Terms" value={quote.terms} onChange={event => setQuote({ ...quote, terms: event.target.value })} /><Button className="w-full bg-orange-500">Create quotation</Button></form></DialogContent></Dialog>
    <Dialog open={dialog === 'invoice'} onOpenChange={open => !open && setDialog(null)}><DialogContent className="bg-slate-900 border-slate-800 text-white"><DialogHeader><DialogTitle>Create delivery invoice</DialogTitle></DialogHeader><form onSubmit={saveInvoice} className="space-y-3"><Select label="Delivered load" required value={invoice.load_id} onChange={event => selectInvoiceLoad(event.target.value)} values={invoiceLoads.map(item => [item.load_id, `${item.reference_number} · ${item.customer_name}`])} /><div className="grid grid-cols-2 gap-3"><Field required type="number" min="0.01" step="0.01" label="Subtotal (₹)" value={invoice.subtotal} onChange={event => setInvoice({ ...invoice, subtotal: event.target.value })} /><Field required type="number" min="0" max="100" step="0.01" label="Tax rate (%)" value={invoice.tax_rate} onChange={event => setInvoice({ ...invoice, tax_rate: event.target.value })} /><Field type="date" label="Payment due" value={invoice.due_at} onChange={event => setInvoice({ ...invoice, due_at: event.target.value })} /></div><Field label="Notes" value={invoice.notes} onChange={event => setInvoice({ ...invoice, notes: event.target.value })} /><Button className="w-full bg-orange-500">Create draft invoice</Button></form></DialogContent></Dialog>
    <Dialog open={dialog === 'payment'} onOpenChange={open => !open && setDialog(null)}><DialogContent className="bg-slate-900 border-slate-800 text-white"><DialogHeader><DialogTitle>Record payment · {selectedInvoice?.invoice_number}</DialogTitle></DialogHeader><form onSubmit={savePayment} className="space-y-3"><p className="text-sm text-slate-400">Outstanding: <span className="text-white font-semibold">{currency(selectedInvoice?.balance_due)}</span></p><div className="grid grid-cols-2 gap-3"><Field required type="number" min="0.01" max={selectedInvoice?.balance_due} step="0.01" label="Amount (₹)" value={payment.amount} onChange={event => setPayment({ ...payment, amount: event.target.value })} /><Field type="date" label="Payment date" value={payment.paid_at} onChange={event => setPayment({ ...payment, paid_at: event.target.value })} /><Select label="Method" value={payment.payment_method} onChange={event => setPayment({ ...payment, payment_method: event.target.value })} values={[["bank_transfer", "Bank transfer"], ["upi", "UPI"], ["cash", "Cash"], ["cheque", "Cheque"], ["other", "Other"]]} /><Field label="Reference / UTR" value={payment.reference} onChange={event => setPayment({ ...payment, reference: event.target.value })} /></div><Field label="Notes" value={payment.notes} onChange={event => setPayment({ ...payment, notes: event.target.value })} /><Button className="w-full bg-orange-500">Record payment</Button></form></DialogContent></Dialog>
  </div>;
}

const numericQuote = value => ({ base_amount: Number(value.base_amount), fuel_surcharge: Number(value.fuel_surcharge), toll_charges: Number(value.toll_charges), handling_charges: Number(value.handling_charges), tax_rate: Number(value.tax_rate) });
function QuoteTable({ values, canManage, changeStatus }) { return <Table headers={['Quotation', 'Load / customer', 'Total', 'Valid until', 'Status', 'Actions']} empty="No quotations created yet.">{values.map(item => <tr key={item.quotation_id} className="border-b border-slate-800"><Cell><span className="font-mono text-white">{item.quotation_number}</span></Cell><Cell><span className="text-white">{item.load_reference}</span><br />{item.customer_name}</Cell><Cell><span className="text-white font-semibold">{currency(item.total_amount)}</span><br /><span className="text-xs">Tax {Number(item.tax_rate)}%</span></Cell><Cell>{item.valid_until ? new Date(item.valid_until).toLocaleDateString() : 'No limit'}</Cell><Cell><Badge className={stateClass(item.status)}>{item.status.replaceAll('_', ' ')}</Badge></Cell><Cell><div className="flex gap-1">{canManage && item.status === 'draft' && <Button size="sm" onClick={() => changeStatus(item.quotation_id, 'sent')}><Send className="w-3 h-3 mr-1" />Mark sent</Button>}{canManage && item.status === 'sent' && <><Button size="sm" onClick={() => changeStatus(item.quotation_id, 'accepted')} className="bg-green-600">Accept</Button><Button size="sm" variant="outline" onClick={() => changeStatus(item.quotation_id, 'rejected')}>Reject</Button></>}</div></Cell></tr>)}</Table>; }
function InvoiceTable({ values, canManage, issue, pay }) { return <Table headers={['Invoice', 'Load / customer', 'Total', 'Paid / balance', 'Due', 'Status', 'Actions']} empty="No delivery invoices created yet.">{values.map(item => <tr key={item.invoice_id} className="border-b border-slate-800"><Cell><span className="font-mono text-white">{item.invoice_number}</span></Cell><Cell><span className="text-white">{item.load_reference}</span><br />{item.customer_name}</Cell><Cell className="text-white font-semibold">{currency(item.total_amount)}</Cell><Cell><span className="text-green-400">{currency(item.amount_paid)}</span><br /><span className="text-xs">Due {currency(item.balance_due)}</span></Cell><Cell>{item.due_at ? new Date(item.due_at).toLocaleDateString() : 'Not set'}</Cell><Cell><Badge className={stateClass(item.status)}>{item.status.replaceAll('_', ' ')}</Badge></Cell><Cell><div className="flex gap-1">{canManage && item.status === 'draft' && <Button size="sm" onClick={() => issue(item.invoice_id)}>Issue</Button>}{canManage && ['issued', 'partially_paid', 'overdue'].includes(item.status) && <Button size="sm" className="bg-green-600" onClick={() => pay(item)}>Record payment</Button>}</div></Cell></tr>)}</Table>; }
function Table({ headers, empty, children }) { return <Card className="bg-slate-900 border-slate-800"><CardContent className="p-0 overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-slate-800 text-left text-xs uppercase text-slate-500">{headers.map(value => <th className="p-3" key={value}>{value}</th>)}</tr></thead><tbody>{children}</tbody></table>{!React.Children.count(children) && <div className="py-14 text-center text-slate-500">{empty}</div>}</CardContent></Card>; }
function Cell({ children, className = '' }) { return <td className={`p-3 text-slate-400 ${className}`}>{children}</td>; }
function Stat({ icon: Icon, label, value }) { return <Card className="bg-slate-900 border-slate-800"><CardContent className="p-4"><Icon className="w-4 h-4 text-orange-500" /><p className="text-xl text-white font-bold mt-2">{value}</p><p className="text-xs text-slate-500">{label}</p></CardContent></Card>; }
function Tab({ active, children, ...props }) { return <button {...props} className={`px-4 py-3 text-sm border-b-2 ${active ? 'border-orange-500 text-orange-400' : 'border-transparent text-slate-500'}`}>{children}</button>; }
function Field({ label, ...props }) { return <div><Label>{label}</Label><Input {...props} className="bg-slate-800 border-slate-700 mt-1" /></div>; }
function Select({ label, values, ...props }) { return <div><Label>{label}</Label><select {...props} className="w-full h-10 rounded border border-slate-700 bg-slate-800 px-2 mt-1"><option value="">Select</option>{values.map(([value, text]) => <option value={value} key={value}>{text}</option>)}</select></div>; }
