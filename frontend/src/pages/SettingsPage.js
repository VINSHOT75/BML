import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Badge } from '../components/ui/badge';
import {
  Settings,
  User,
  Building2,
  Bell,
  Shield,
  Palette,
  LogOut,
  Mail,
  Phone,
  MapPin,
} from 'lucide-react';
import { toast } from 'sonner';
import OrganizationAccessPanel from '../components/OrganizationAccessPanel';
import EmailNotificationPanel from '../components/EmailNotificationPanel';

export default function SettingsPage() {
  const { user, logout } = useAuth();

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const handleLogout = async () => {
    await logout();
    window.location.href = '/';
  };

  return (
    <div data-testid="settings-page" className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-heading font-bold text-2xl sm:text-3xl text-white">
          Settings
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Manage your account and application preferences
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Profile Section */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="border-b border-slate-800 pb-4">
              <CardTitle className="font-heading text-lg text-white flex items-center gap-2">
                <User className="w-5 h-5 text-orange-500" />
                Profile Information
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="flex items-start gap-6">
                <Avatar className="w-20 h-20">
                  <AvatarImage src={user?.picture} />
                  <AvatarFallback className="bg-orange-500/20 text-orange-500 text-xl font-heading font-bold">
                    {getInitials(user?.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-4">
                  <div>
                    <p className="text-slate-500 text-xs uppercase mb-1">Full Name</p>
                    <p className="text-white text-lg font-medium">{user?.name || 'Not set'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-slate-500" />
                    <span className="text-slate-300">{user?.email || 'Not set'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-orange-500/20 text-orange-500">{user?.role || 'Admin'}</Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Company Settings */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="border-b border-slate-800 pb-4">
              <CardTitle className="font-heading text-lg text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-orange-500" />
                Company Information
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <p className="text-slate-500 text-xs uppercase mb-1">Company Name</p>
                  <p className="text-white font-medium">{user?.organization_name || 'Not set'}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs uppercase mb-1">Industry</p>
                  <p className="text-white">Transportation & Logistics</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs uppercase mb-1">Country</p>
                  <p className="text-white">India</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs uppercase mb-1">Timezone</p>
                  <p className="text-white">IST (UTC+5:30)</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notification Settings */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="border-b border-slate-800 pb-4">
              <CardTitle className="font-heading text-lg text-white flex items-center gap-2">
                <Bell className="w-5 h-5 text-orange-500" />
                Notification Preferences
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                {[
                  { label: 'Trip Updates', description: 'Get notified when trips are started or completed', enabled: true },
                  { label: 'Driver Alerts', description: 'Notifications for driver status changes', enabled: true },
                  { label: 'Maintenance Reminders', description: 'Vehicle maintenance due alerts', enabled: true },
                  { label: 'License Expiry', description: 'Alerts for expiring driver licenses', enabled: true },
                ].map((item, index) => (
                  <div key={index} className="flex items-center justify-between py-2">
                    <div>
                      <p className="text-white font-medium">{item.label}</p>
                      <p className="text-slate-500 text-sm">{item.description}</p>
                    </div>
                    <Badge className={item.enabled ? 'bg-green-500/20 text-green-500' : 'bg-slate-500/20 text-slate-500'}>
                      {item.enabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </div>
                ))}
              </div>
              <p className="text-slate-500 text-xs mt-4">
                * SMS notifications require Twilio integration (coming soon)
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions Sidebar */}
        <div className="space-y-6">
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="border-b border-slate-800 pb-4">
              <CardTitle className="font-heading text-lg text-white">
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-2">
              <Button
                variant="ghost"
                className="w-full justify-start text-slate-300 hover:text-white hover:bg-slate-800"
              >
                <Palette className="w-4 h-4 mr-3" />
                Appearance
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start text-slate-300 hover:text-white hover:bg-slate-800"
              >
                <Shield className="w-4 h-4 mr-3" />
                Security
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start text-slate-300 hover:text-white hover:bg-slate-800"
              >
                <Bell className="w-4 h-4 mr-3" />
                Notifications
              </Button>
              <div className="border-t border-slate-800 pt-2 mt-2">
                <Button
                  variant="ghost"
                  onClick={handleLogout}
                  className="w-full justify-start text-red-400 hover:text-red-300 hover:bg-red-500/10"
                  data-testid="settings-logout-btn"
                >
                  <LogOut className="w-4 h-4 mr-3" />
                  Logout
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Support Card */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="border-b border-slate-800 pb-4">
              <CardTitle className="font-heading text-lg text-white">
                Need Help?
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <p className="text-slate-400 text-sm">
                Contact our support team for assistance with your account or any technical issues.
              </p>
              <div className="flex items-center gap-2 text-sm text-slate-300">
                <Mail className="w-4 h-4 text-orange-500" />
                support@bookmyload.in
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-300">
                <Phone className="w-4 h-4 text-orange-500" />
                1800-XXX-XXXX
              </div>
            </CardContent>
          </Card>

          {/* App Info */}
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-4 text-center">
              <p className="font-heading font-bold text-orange-500">BOOKMYLOAD</p>
              <p className="text-slate-500 text-xs mt-1">Version 1.0.0</p>
              <p className="text-slate-600 text-xs mt-2">
                © 2024 Bookmyload. All rights reserved.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <EmailNotificationPanel />
      <OrganizationAccessPanel />
    </div>
  );
}
