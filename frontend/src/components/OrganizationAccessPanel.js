import React, { useCallback, useEffect, useState } from 'react';
import { Building2, Loader2, MailPlus, Shield, Trash2, UserMinus, Users } from 'lucide-react';
import { toast } from 'sonner';

import { organizationAPI } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';


const ROLES = [
  { value: 'organization_owner', label: 'Organization Owner' },
  { value: 'operations_admin', label: 'Operations Admin' },
  { value: 'dispatcher', label: 'Dispatcher' },
  { value: 'viewer', label: 'Viewer' },
];

const can = (user, permission) => {
  const permissions = user?.permissions || [];
  return permissions.includes('*') || permissions.includes(permission) || permissions.includes(`${permission.split('.')[0]}.*`);
};

export default function OrganizationAccessPanel() {
  const { user } = useAuth();
  const [organization, setOrganization] = useState(null);
  const [members, setMembers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('viewer');
  const [submitting, setSubmitting] = useState(false);
  const mayManage = can(user, 'members.manage');

  const load = useCallback(async () => {
    try {
      const organizationResponse = await organizationAPI.getCurrent();
      setOrganization(organizationResponse.data);
      if (can(user, 'members.read')) {
        const [membersResponse, invitationsResponse] = await Promise.all([
          organizationAPI.getMembers(),
          organizationAPI.getInvitations(),
        ]);
        setMembers(membersResponse.data);
        setInvitations(invitationsResponse.data);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to load organization access');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const invite = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await organizationAPI.invite(email, role);
      toast.success(`Invitation created for ${email}`);
      setEmail('');
      setRole('viewer');
      await load();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create invitation');
    } finally {
      setSubmitting(false);
    }
  };

  const changeRole = async (membershipId, nextRole) => {
    try {
      await organizationAPI.updateMemberRole(membershipId, nextRole);
      toast.success('Member role updated');
      await load();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update role');
    }
  };

  const removeMember = async (membership) => {
    if (!window.confirm(`Remove ${membership.name} from this organization?`)) return;
    try {
      await organizationAPI.removeMember(membership.membership_id);
      toast.success('Member removed');
      await load();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to remove member');
    }
  };

  const revokeInvitation = async (invitationId) => {
    try {
      await organizationAPI.revokeInvitation(invitationId);
      toast.success('Invitation revoked');
      await load();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to revoke invitation');
    }
  };

  if (loading) return <div className="flex h-32 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-orange-500" /></div>;

  return (
    <div className="space-y-6">
      {can(user, 'members.read') && <Card className="border-slate-800 bg-slate-900">
        <CardHeader className="border-b border-slate-800 pb-4">
          <CardTitle className="flex items-center gap-2 font-heading text-lg text-white"><Building2 className="h-5 w-5 text-orange-500" />Organization</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <p className="text-xs uppercase text-slate-500">Organization name</p>
          <p className="mt-1 text-lg font-medium text-white">{organization?.name}</p>
          <p className="mt-1 font-mono text-xs text-slate-500">{organization?.slug}</p>
        </CardContent>
      </Card>}

      {mayManage && (
        <Card className="border-slate-800 bg-slate-900">
          <CardHeader className="border-b border-slate-800 pb-4">
            <CardTitle className="flex items-center gap-2 font-heading text-lg text-white"><MailPlus className="h-5 w-5 text-orange-500" />Invite member</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <form onSubmit={invite} className="grid gap-4 md:grid-cols-[1fr_220px_auto] md:items-end">
              <div className="space-y-2"><Label htmlFor="member-email" className="text-slate-300">Google account email</Label><Input id="member-email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="border-slate-700 bg-slate-800 text-white" placeholder="person@company.com" /></div>
              <div className="space-y-2"><Label className="text-slate-300">Role</Label><Select value={role} onValueChange={setRole}><SelectTrigger className="border-slate-700 bg-slate-800 text-white"><SelectValue /></SelectTrigger><SelectContent className="border-[#d8dfd6] bg-white text-[#17231f]">{ROLES.map((item) => <SelectItem key={item.value} value={item.value} className="text-[#17231f] focus:bg-[#edf1eb] focus:text-[#17231f]">{item.label}</SelectItem>)}</SelectContent></Select></div>
              <Button disabled={submitting} className="bg-orange-500 text-white hover:bg-orange-600">{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create invitation'}</Button>
            </form>
            <p className="mt-3 text-xs text-slate-500">The invited person must sign in using this exact Google email within seven days.</p>
          </CardContent>
        </Card>
      )}

      <Card className="border-slate-800 bg-slate-900">
        <CardHeader className="border-b border-slate-800 pb-4"><CardTitle className="flex items-center gap-2 font-heading text-lg text-white"><Users className="h-5 w-5 text-orange-500" />Members ({members.length})</CardTitle></CardHeader>
        <CardContent className="divide-y divide-slate-800 p-0">
          {members.map((member) => (
            <div key={member.membership_id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center">
              <div className="min-w-0 flex-1"><p className="truncate font-medium text-white">{member.name}</p><p className="truncate text-sm text-slate-500">{member.email}</p></div>
              {mayManage && member.user_id !== user.user_id ? (
                <><Select value={member.role} onValueChange={(value) => changeRole(member.membership_id, value)}><SelectTrigger className="w-52 border-slate-700 bg-slate-800 text-white"><SelectValue /></SelectTrigger><SelectContent className="border-[#d8dfd6] bg-white text-[#17231f]">{ROLES.map((item) => <SelectItem key={item.value} value={item.value} className="text-[#17231f] focus:bg-[#edf1eb] focus:text-[#17231f]">{item.label}</SelectItem>)}</SelectContent></Select><Button variant="ghost" size="icon" onClick={() => removeMember(member)} className="text-red-400 hover:bg-red-500/10 hover:text-red-300" aria-label={`Remove ${member.name}`}><UserMinus className="h-4 w-4" /></Button></>
              ) : <Badge className="w-fit bg-orange-500/20 capitalize text-orange-500">{member.role.replaceAll('_', ' ')}</Badge>}
            </div>
          ))}
        </CardContent>
      </Card>

      {invitations.length > 0 && (
        <Card className="border-slate-800 bg-slate-900">
          <CardHeader className="border-b border-slate-800 pb-4"><CardTitle className="flex items-center gap-2 font-heading text-lg text-white"><Shield className="h-5 w-5 text-orange-500" />Invitations</CardTitle></CardHeader>
          <CardContent className="divide-y divide-slate-800 p-0">
            {invitations.map((invitation) => <div key={invitation.invitation_id} className="flex items-center gap-3 p-4"><div className="min-w-0 flex-1"><p className="truncate text-white">{invitation.email}</p><p className="text-xs capitalize text-slate-500">{invitation.role.replaceAll('_', ' ')} · {invitation.status}</p></div><Badge className="bg-slate-800 text-slate-300">{new Date(invitation.expires_at).toLocaleDateString()}</Badge>{mayManage && invitation.status === 'pending' && <Button variant="ghost" size="icon" onClick={() => revokeInvitation(invitation.invitation_id)} className="text-red-400" aria-label="Revoke invitation"><Trash2 className="h-4 w-4" /></Button>}</div>)}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
