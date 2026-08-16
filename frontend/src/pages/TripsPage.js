import React, { useState, useEffect } from 'react';
import { tripAPI, vehicleAPI, driverAPI } from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
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
  Route,
  Plus,
  MoreVertical,
  Edit,
  Trash2,
  Search,
  Loader2,
  MapPin,
  Package,
  User,
  Truck,
  Calendar,
  Play,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';

const cargoTypes = ['General', 'Perishable', 'Hazardous', 'Fragile', 'Bulk', 'Liquid', 'Container'];

export default function TripsPage() {
  const [trips, setTrips] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [editingTrip, setEditingTrip] = useState(null);
  const [assigningTrip, setAssigningTrip] = useState(null);
  const [assignData, setAssignData] = useState({ driver_id: '', vehicle_id: '' });
  const [formData, setFormData] = useState({
    origin: '',
    destination: '',
    cargo_type: '',
    cargo_weight_tons: '',
    customer_name: '',
    customer_phone: '',
    scheduled_date: '',
    notes: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [tripsRes, vehiclesRes, driversRes] = await Promise.all([
        tripAPI.getAll(),
        vehicleAPI.getAll(),
        driverAPI.getAll(),
      ]);
      setTrips(tripsRes.data);
      setVehicles(vehiclesRes.data);
      setDrivers(driversRes.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = {
        ...formData,
        cargo_weight_tons: parseFloat(formData.cargo_weight_tons),
        scheduled_date: new Date(formData.scheduled_date).toISOString(),
      };

      if (editingTrip) {
        await tripAPI.update(editingTrip.trip_id, data);
        toast.success('Trip updated successfully');
      } else {
        await tripAPI.create(data);
        toast.success('Trip created successfully');
      }
      
      setIsDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Failed to save trip:', error);
      toast.error('Failed to save trip');
    }
  };

  const handleAssign = async () => {
    if (!assignData.driver_id || !assignData.vehicle_id) {
      toast.error('Please select both driver and vehicle');
      return;
    }
    try {
      await tripAPI.assign(assigningTrip.trip_id, assignData.driver_id, assignData.vehicle_id);
      toast.success('Trip assigned successfully');
      setIsAssignDialogOpen(false);
      setAssigningTrip(null);
      setAssignData({ driver_id: '', vehicle_id: '' });
      fetchData();
    } catch (error) {
      console.error('Failed to assign trip:', error);
      toast.error('Failed to assign trip');
    }
  };

  const handleStatusChange = async (tripId, status) => {
    try {
      await tripAPI.updateStatus(tripId, status);
      toast.success('Status updated');
      fetchData();
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Failed to update status');
    }
  };

  const handleDelete = async (tripId) => {
    if (!window.confirm('Are you sure you want to delete this trip?')) return;
    
    try {
      await tripAPI.delete(tripId);
      toast.success('Trip deleted successfully');
      fetchData();
    } catch (error) {
      console.error('Failed to delete trip:', error);
      toast.error('Failed to delete trip');
    }
  };

  const handleEdit = (trip) => {
    setEditingTrip(trip);
    const scheduledDate = trip.scheduled_date ? new Date(trip.scheduled_date).toISOString().slice(0, 16) : '';
    setFormData({
      origin: trip.origin,
      destination: trip.destination,
      cargo_type: trip.cargo_type,
      cargo_weight_tons: trip.cargo_weight_tons,
      customer_name: trip.customer_name,
      customer_phone: trip.customer_phone || '',
      scheduled_date: scheduledDate,
      notes: trip.notes || '',
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setEditingTrip(null);
    setFormData({
      origin: '',
      destination: '',
      cargo_type: '',
      cargo_weight_tons: '',
      customer_name: '',
      customer_phone: '',
      scheduled_date: '',
      notes: '',
    });
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: 'bg-yellow-500/20 text-yellow-500',
      assigned: 'bg-blue-500/20 text-blue-500',
      in_progress: 'bg-orange-500/20 text-orange-500',
      completed: 'bg-green-500/20 text-green-500',
      cancelled: 'bg-red-500/20 text-red-500',
    };
    return colors[status] || 'bg-slate-500/20 text-slate-500';
  };

  const getDriverName = (driverId) => {
    const driver = drivers.find(d => d.driver_id === driverId);
    return driver?.name || 'Unassigned';
  };

  const getVehicleNumber = (vehicleId) => {
    const vehicle = vehicles.find(v => v.vehicle_id === vehicleId);
    return vehicle?.registration_number || 'Unassigned';
  };

  const availableDrivers = drivers.filter(d => d.status === 'available');
  const availableVehicles = vehicles.filter(v => v.status === 'available');

  const filteredTrips = trips.filter(t => {
    const matchesSearch = t.origin.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.destination.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.customer_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  return (
    <div data-testid="trips-page" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-heading font-bold text-2xl sm:text-3xl text-white">
            Trip Management
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Create and manage trips, assign drivers and vehicles
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button 
              data-testid="create-trip-btn"
              className="bg-orange-500 hover:bg-orange-600 text-white font-heading font-semibold"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Trip
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-slate-900 border-slate-800 max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-heading text-xl text-white">
                {editingTrip ? 'Edit Trip' : 'Create New Trip'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-slate-300">Origin</Label>
                  <Input
                    required
                    placeholder="Mumbai"
                    value={formData.origin}
                    onChange={(e) => setFormData({ ...formData, origin: e.target.value })}
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">Destination</Label>
                  <Input
                    required
                    placeholder="Delhi"
                    value={formData.destination}
                    onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-slate-300">Cargo Type</Label>
                  <Select
                    value={formData.cargo_type}
                    onValueChange={(value) => setFormData({ ...formData, cargo_type: value })}
                  >
                    <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      {cargoTypes.map((type) => (
                        <SelectItem key={type} value={type} className="text-white hover:bg-slate-700">
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">Weight (Tons)</Label>
                  <Input
                    required
                    type="number"
                    step="0.1"
                    min="0"
                    placeholder="20"
                    value={formData.cargo_weight_tons}
                    onChange={(e) => setFormData({ ...formData, cargo_weight_tons: e.target.value })}
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-slate-300">Customer Name</Label>
                  <Input
                    required
                    placeholder="ABC Logistics"
                    value={formData.customer_name}
                    onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">Customer Phone</Label>
                  <Input
                    type="tel"
                    placeholder="+91 9876543210"
                    value={formData.customer_phone}
                    onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">Scheduled Date & Time</Label>
                <Input
                  required
                  type="datetime-local"
                  value={formData.scheduled_date}
                  onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">Notes</Label>
                <Textarea
                  placeholder="Additional instructions..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="bg-slate-800 border-slate-700 text-white min-h-[80px]"
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
                  {editingTrip ? 'Update' : 'Create'} Trip
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            placeholder="Search trips..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-slate-900 border-slate-800 text-white placeholder:text-slate-500"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 bg-slate-900 border-slate-800 text-white">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-700">
            <SelectItem value="all" className="text-white">All Status</SelectItem>
            <SelectItem value="pending" className="text-yellow-400">Pending</SelectItem>
            <SelectItem value="assigned" className="text-blue-400">Assigned</SelectItem>
            <SelectItem value="in_progress" className="text-orange-400">In Progress</SelectItem>
            <SelectItem value="completed" className="text-green-400">Completed</SelectItem>
            <SelectItem value="cancelled" className="text-red-400">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Trips List */}
      <div className="space-y-4">
        {filteredTrips.map((trip) => (
          <Card key={trip.trip_id} className="bg-slate-900 border-slate-800 hover:border-slate-700 transition-colors">
            <CardContent className="p-4">
              <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                {/* Route Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-mono text-xs text-orange-500">{trip.trip_id?.slice(0, 12)}</span>
                    <Badge className={getStatusColor(trip.status)}>
                      {trip.status?.replace('_', ' ')}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-sm mb-2">
                    <div className="flex items-center gap-1">
                      <MapPin className="w-4 h-4 text-green-500" />
                      <span className="text-white font-medium">{trip.origin}</span>
                    </div>
                    <span className="text-slate-600">→</span>
                    <div className="flex items-center gap-1">
                      <MapPin className="w-4 h-4 text-red-500" />
                      <span className="text-white font-medium">{trip.destination}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-4 text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <Package className="w-3 h-3" />
                      {trip.cargo_type} ({trip.cargo_weight_tons}T)
                    </span>
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {trip.customer_name}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(trip.scheduled_date).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Assignment Info */}
                <div className="flex flex-col gap-1 text-sm min-w-[180px]">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-slate-500" />
                    <span className="text-slate-300">{getDriverName(trip.driver_id)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-slate-500" />
                    <span className="text-slate-300 font-mono text-xs">{getVehicleNumber(trip.vehicle_id)}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {trip.status === 'pending' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-blue-500/50 text-blue-400 hover:bg-blue-500/10"
                      onClick={() => { setAssigningTrip(trip); setIsAssignDialogOpen(true); }}
                    >
                      Assign
                    </Button>
                  )}
                  {trip.status === 'assigned' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-orange-500/50 text-orange-400 hover:bg-orange-500/10"
                      onClick={() => handleStatusChange(trip.trip_id, 'in_progress')}
                    >
                      <Play className="w-3 h-3 mr-1" />
                      Start
                    </Button>
                  )}
                  {trip.status === 'in_progress' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-green-500/50 text-green-400 hover:bg-green-500/10"
                      onClick={() => handleStatusChange(trip.trip_id, 'completed')}
                    >
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Complete
                    </Button>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-slate-900 border-slate-800">
                      <DropdownMenuItem 
                        className="text-slate-300 hover:text-white cursor-pointer"
                        onClick={() => handleEdit(trip)}
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      {trip.status !== 'cancelled' && trip.status !== 'completed' && (
                        <DropdownMenuItem 
                          className="text-yellow-400 hover:text-yellow-300 cursor-pointer"
                          onClick={() => handleStatusChange(trip.trip_id, 'cancelled')}
                        >
                          <XCircle className="w-4 h-4 mr-2" />
                          Cancel Trip
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem 
                        className="text-red-400 hover:text-red-300 cursor-pointer"
                        onClick={() => handleDelete(trip.trip_id)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredTrips.length === 0 && (
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="py-12 text-center">
            <Route className="w-12 h-12 mx-auto mb-4 text-slate-600" />
            <h3 className="text-lg font-heading text-white mb-2">No trips found</h3>
            <p className="text-slate-400 text-sm">
              {searchTerm || statusFilter !== 'all' ? 'Try different filters' : 'Create your first trip to get started'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Assign Dialog */}
      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl text-white">
              Assign Trip
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="p-3 bg-slate-800/50 rounded-lg">
              <p className="text-sm text-slate-400">Route</p>
              <p className="text-white font-medium">
                {assigningTrip?.origin} → {assigningTrip?.destination}
              </p>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Select Driver</Label>
              <Select
                value={assignData.driver_id}
                onValueChange={(value) => setAssignData({ ...assignData, driver_id: value })}
              >
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue placeholder="Choose driver" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {availableDrivers.length > 0 ? (
                    availableDrivers.map((driver) => (
                      <SelectItem key={driver.driver_id} value={driver.driver_id} className="text-white hover:bg-slate-700">
                        {driver.name} ({driver.phone})
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="none" disabled className="text-slate-500">
                      No available drivers
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Select Vehicle</Label>
              <Select
                value={assignData.vehicle_id}
                onValueChange={(value) => setAssignData({ ...assignData, vehicle_id: value })}
              >
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue placeholder="Choose vehicle" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {availableVehicles.length > 0 ? (
                    availableVehicles.map((vehicle) => (
                      <SelectItem key={vehicle.vehicle_id} value={vehicle.vehicle_id} className="text-white hover:bg-slate-700">
                        {vehicle.registration_number} - {vehicle.vehicle_type} ({vehicle.capacity_tons}T)
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="none" disabled className="text-slate-500">
                      No available vehicles
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button 
                variant="outline" 
                onClick={() => setIsAssignDialogOpen(false)}
                className="border-slate-700 text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleAssign}
                className="bg-orange-500 hover:bg-orange-600 text-white font-heading font-semibold"
              >
                Assign Trip
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
