import React, { useState, useEffect } from 'react';
import { driverAPI } from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import {
  Users,
  Plus,
  MoreVertical,
  Edit,
  Trash2,
  Search,
  Loader2,
  Phone,
  Mail,
  CreditCard,
  Star,
  MapPin,
  UserPlus,
} from 'lucide-react';
import { toast } from 'sonner';

export default function DriversPage() {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    license_number: '',
    license_expiry: '',
    address: '',
    emergency_contact: '',
  });

  useEffect(() => {
    fetchDrivers();
  }, []);

  const fetchDrivers = async () => {
    try {
      const response = await driverAPI.getAll();
      setDrivers(response.data);
    } catch (error) {
      console.error('Failed to fetch drivers:', error);
      toast.error('Failed to load drivers');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = {
        ...formData,
        license_expiry: new Date(formData.license_expiry).toISOString(),
      };

      if (editingDriver) {
        await driverAPI.update(editingDriver.driver_id, data);
        toast.success('Driver updated successfully');
      } else {
        await driverAPI.create(data);
        toast.success('Driver added successfully');
      }
      
      setIsDialogOpen(false);
      resetForm();
      fetchDrivers();
    } catch (error) {
      console.error('Failed to save driver:', error);
      toast.error('Failed to save driver');
    }
  };

  const handleDelete = async (driverId) => {
    if (!window.confirm('Are you sure you want to delete this driver?')) return;
    
    try {
      await driverAPI.delete(driverId);
      toast.success('Driver deleted successfully');
      fetchDrivers();
    } catch (error) {
      console.error('Failed to delete driver:', error);
      toast.error('Failed to delete driver');
    }
  };

  const handleInvite = async (driver) => {
    const email = window.prompt(`Google email for ${driver.name}:`, driver.email || '');
    if (!email) return;
    try {
      await driverAPI.invite(driver.driver_id, email);
      toast.success('Driver invitation created. They can now sign in with that Google account.');
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Failed to invite driver');
    }
  };

  const handleEdit = (driver) => {
    setEditingDriver(driver);
    const expiryDate = driver.license_expiry ? new Date(driver.license_expiry).toISOString().split('T')[0] : '';
    setFormData({
      name: driver.name,
      phone: driver.phone,
      email: driver.email || '',
      license_number: driver.license_number,
      license_expiry: expiryDate,
      address: driver.address || '',
      emergency_contact: driver.emergency_contact || '',
    });
    setIsDialogOpen(true);
  };

  const handleStatusChange = async (driverId, status) => {
    try {
      await driverAPI.updateStatus(driverId, status);
      toast.success('Status updated');
      fetchDrivers();
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const resetForm = () => {
    setEditingDriver(null);
    setFormData({
      name: '',
      phone: '',
      email: '',
      license_number: '',
      license_expiry: '',
      address: '',
      emergency_contact: '',
    });
  };

  const getStatusColor = (status) => {
    const colors = {
      available: 'bg-green-500/20 text-green-500',
      on_trip: 'bg-orange-500/20 text-orange-500',
      off_duty: 'bg-slate-500/20 text-slate-400',
      on_leave: 'bg-blue-500/20 text-blue-500',
    };
    return colors[status] || 'bg-slate-500/20 text-slate-500';
  };

  const getInitials = (name) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const filteredDrivers = drivers.filter(d =>
    d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.phone.includes(searchTerm) ||
    d.license_number.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  return (
    <div data-testid="drivers-page" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-heading font-bold text-2xl sm:text-3xl text-white">
            Driver Management
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Manage your drivers and their assignments
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button 
              data-testid="add-driver-btn"
              className="bg-orange-500 hover:bg-orange-600 text-white font-heading font-semibold"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Driver
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-slate-900 border-slate-800 max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-heading text-xl text-white">
                {editingDriver ? 'Edit Driver' : 'Add New Driver'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2">
                  <Label className="text-slate-300">Full Name</Label>
                  <Input
                    required
                    placeholder="Ramesh Kumar"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-slate-300">Phone Number</Label>
                  <Input
                    required
                    type="tel"
                    placeholder="+91 9876543210"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">Email (Optional)</Label>
                  <Input
                    type="email"
                    placeholder="driver@email.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-slate-300">License Number</Label>
                  <Input
                    required
                    placeholder="MH0120200012345"
                    value={formData.license_number}
                    onChange={(e) => setFormData({ ...formData, license_number: e.target.value })}
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">License Expiry</Label>
                  <Input
                    required
                    type="date"
                    value={formData.license_expiry}
                    onChange={(e) => setFormData({ ...formData, license_expiry: e.target.value })}
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">Address</Label>
                <Input
                  placeholder="Full address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">Emergency Contact</Label>
                <Input
                  placeholder="+91 9876543211"
                  value={formData.emergency_contact}
                  onChange={(e) => setFormData({ ...formData, emergency_contact: e.target.value })}
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => { setIsDialogOpen(false); resetForm(); }}
                  className="border-slate-700 text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  className="bg-orange-500 hover:bg-orange-600 text-white font-heading font-semibold"
                >
                  {editingDriver ? 'Update' : 'Add'} Driver
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <Input
          placeholder="Search drivers..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 bg-slate-900 border-slate-800 text-white placeholder:text-slate-500"
        />
      </div>

      {/* Drivers Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredDrivers.map((driver) => (
          <Card key={driver.driver_id} className="bg-slate-900 border-slate-800 hover:border-slate-700 transition-colors">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="w-12 h-12">
                    <AvatarFallback className="bg-orange-500/20 text-orange-500 font-heading font-bold">
                      {getInitials(driver.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="font-heading text-lg text-white">
                      {driver.name}
                    </CardTitle>
                    <p className="text-xs text-slate-500 font-mono">
                      {driver.driver_id?.slice(0, 12)}
                    </p>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-slate-900 border-slate-800">
                    <DropdownMenuItem 
                      className="text-orange-400 cursor-pointer"
                      onClick={() => handleInvite(driver)}
                    >
                      <UserPlus className="w-4 h-4 mr-2" />
                      Invite to driver app
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      className="text-slate-300 hover:text-white cursor-pointer"
                      onClick={() => handleEdit(driver)}
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      className="text-red-400 hover:text-red-300 cursor-pointer"
                      onClick={() => handleDelete(driver.driver_id)}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Status</span>
                <Select
                  value={driver.status}
                  onValueChange={(value) => handleStatusChange(driver.driver_id, value)}
                >
                  <SelectTrigger className="w-auto h-7 bg-transparent border-0 p-0">
                    <Badge className={getStatusColor(driver.status)}>
                      {driver.status?.replace('_', ' ')}
                    </Badge>
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="available" className="text-green-400">Available</SelectItem>
                    <SelectItem value="on_trip" className="text-orange-400">On Trip</SelectItem>
                    <SelectItem value="off_duty" className="text-slate-400">Off Duty</SelectItem>
                    <SelectItem value="on_leave" className="text-blue-400">On Leave</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Phone className="w-3 h-3 text-slate-500" />
                <span className="text-slate-300">{driver.phone}</span>
              </div>
              {driver.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="w-3 h-3 text-slate-500" />
                  <span className="text-slate-300 truncate">{driver.email}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm">
                <CreditCard className="w-3 h-3 text-slate-500" />
                <span className="text-slate-400 font-mono text-xs">{driver.license_number}</span>
              </div>
              <div className="flex items-center justify-between text-sm pt-2 border-t border-slate-800">
                <div className="flex items-center gap-1">
                  <Star className="w-3 h-3 text-yellow-500" />
                  <span className="text-white">{driver.rating?.toFixed(1) || '5.0'}</span>
                </div>
                <span className="text-slate-500 text-xs">{driver.total_trips || 0} trips</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredDrivers.length === 0 && (
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="py-12 text-center">
            <Users className="w-12 h-12 mx-auto mb-4 text-slate-600" />
            <h3 className="text-lg font-heading text-white mb-2">No drivers found</h3>
            <p className="text-slate-400 text-sm">
              {searchTerm ? 'Try a different search term' : 'Add your first driver to get started'}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
