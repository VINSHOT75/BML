import React, { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Button } from './ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from './ui/dropdown-menu';
import { BarChart3, Car, ChevronDown, ClipboardCheck, LayoutDashboard, LogOut, MapPin, Menu, Package, ReceiptIndianRupee, Route, Settings, Users, WalletCards, X } from 'lucide-react';
import NotificationCenter from './NotificationCenter';

const groups = [
  { label: 'Command', items: [{ to: '/dashboard', icon: LayoutDashboard, label: 'Overview' }] },
  { label: 'Operations', items: [{ to: '/dashboard/loads', icon: Package, label: 'Loads' }, { to: '/dashboard/trips', icon: Route, label: 'Trips' }, { to: '/dashboard/tracking', icon: MapPin, label: 'Live tracking' }] },
  { label: 'Resources', items: [{ to: '/dashboard/fleet', icon: Car, label: 'Fleet' }, { to: '/dashboard/drivers', icon: Users, label: 'Drivers' }, { to: '/dashboard/compliance', icon: ClipboardCheck, label: 'Compliance' }] },
  { label: 'Business', items: [{ to: '/dashboard/finance', icon: ReceiptIndianRupee, label: 'Finance' }, { to: '/dashboard/expenses', icon: WalletCards, label: 'Trip costs' }, { to: '/dashboard/reports', icon: BarChart3, label: 'Reports' }] },
];
const pageNames = Object.fromEntries(groups.flatMap(group => group.items.map(item => [item.to, item.label])));

export default function DashboardLayout() {
  const { user, logout, switchOrganization } = useAuth(); const navigate = useNavigate(); const location = useLocation(); const [sidebarOpen, setSidebarOpen] = useState(false);
  const initials = (user?.name || 'User').split(' ').map(value => value[0]).join('').slice(0, 2).toUpperCase();
  const pageName = pageNames[location.pathname] || 'Workspace';
  const signOut = async () => { await logout(); navigate('/'); };
  return <div className="app-shell min-h-screen bg-[#edf1eb] text-[#17231f]">
    {sidebarOpen && <button aria-label="Close navigation" onClick={() => setSidebarOpen(false)} className="fixed inset-0 z-40 bg-[#071512]/55 backdrop-blur-sm lg:hidden" />}
    <aside className={`fixed inset-y-0 left-0 z-50 flex w-[282px] flex-col bg-[#071512] text-white transition-transform duration-300 lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="flex h-[82px] items-center justify-between border-b border-white/10 px-5"><button onClick={() => navigate('/dashboard')} className="flex items-center gap-3 text-left"><img src="/logo.svg" alt="" className="h-10 w-10 rounded-xl" /><span><b className="block text-lg tracking-[-.04em]">BookMyLoad</b><small className="block text-[9px] uppercase tracking-[.18em] text-white/35">Operations workspace</small></span></button><button onClick={() => setSidebarOpen(false)} className="text-white/50 lg:hidden"><X /></button></div>
      <div className="app-sidebar-nav flex-1 overflow-y-auto px-4 py-5">{groups.map(group => <div key={group.label} className="mb-6"><p className="mb-2 px-3 text-[9px] font-bold uppercase tracking-[.22em] text-white/40">{group.label}</p><nav className="space-y-1">{group.items.map(item => <NavLink key={item.to} to={item.to} end={item.to === '/dashboard'} onClick={() => setSidebarOpen(false)} className={({isActive}) => `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${isActive ? 'bg-[#d8ff61] text-[#071512] shadow-[0_10px_30px_rgba(216,255,97,.12)]' : 'text-white/60 hover:bg-white/[.06] hover:text-white'}`}><item.icon className="h-[18px] w-[18px]" /><span>{item.label}</span></NavLink>)}</nav></div>)}</div>
      <div className="border-t border-white/10 p-4"><div className="rounded-2xl bg-white/[.055] p-3"><p className="text-[9px] font-bold uppercase tracking-[.18em] text-[#d8ff61]/70">Organization</p><p className="mt-1 truncate text-sm font-bold">{user?.organization_name}</p><p className="mt-0.5 text-xs capitalize text-white/40">{user?.role?.replaceAll('_',' ')}</p>{user?.memberships?.length > 1 && <select aria-label="Switch organization" value={user.organization_id} onChange={event => switchOrganization(event.target.value)} className="mt-3 h-9 w-full rounded-lg border border-white/10 bg-[#071512] px-2 text-xs text-white">{user.memberships.map(item => <option value={item.organization_id} key={item.organization_id}>{item.organization_name}</option>)}</select>}</div></div>
    </aside>
    <div className="min-h-screen lg:pl-[282px]">
      <header className="sticky top-0 z-30 flex h-[82px] items-center gap-3 border-b border-[#17231f]/10 bg-[#edf1eb]/88 px-4 backdrop-blur-xl sm:px-6 lg:px-9"><button onClick={() => setSidebarOpen(true)} className="grid h-10 w-10 place-items-center rounded-xl border border-[#17231f]/10 bg-white lg:hidden"><Menu className="h-5 w-5" /></button><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#61736d]">{user?.organization_name}</p><h1 className="text-xl font-extrabold tracking-[-.035em]">{pageName}</h1></div><div className="ml-auto flex items-center gap-2"><NotificationCenter /><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" className="h-11 rounded-full border border-[#17231f]/10 bg-white pl-1.5 pr-3 hover:bg-[#f7f8f4]"><Avatar className="h-8 w-8"><AvatarImage src={user?.picture} /><AvatarFallback className="bg-[#17231f] text-xs text-[#d8ff61]">{initials}</AvatarFallback></Avatar><span className="hidden max-w-32 truncate text-sm font-bold sm:block">{user?.name?.split(' ')[0]}</span><ChevronDown className="h-4 w-4 text-[#61736d]" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-64 rounded-2xl border-[#17231f]/10 bg-white p-2 shadow-xl"><div className="px-2 py-2"><p className="font-bold text-[#17231f]">{user?.name}</p><p className="truncate text-xs text-[#71817c]">{user?.email}</p></div><DropdownMenuSeparator /><DropdownMenuItem onClick={() => navigate('/dashboard/settings')} className="rounded-lg"><Settings className="mr-2 h-4 w-4" />Settings</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem onClick={signOut} data-testid="logout-btn" className="rounded-lg text-red-600"><LogOut className="mr-2 h-4 w-4" />Logout</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div></header>
      <main className="app-content mx-auto max-w-[1640px] p-4 sm:p-6 lg:p-9"><Outlet /></main>
    </div>
  </div>;
}
