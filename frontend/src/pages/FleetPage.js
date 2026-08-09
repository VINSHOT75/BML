import React, { useState, useEffect } from 'react';
import { vehicleAPI } from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
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
  Car,
  Plus,
  MoreVertical,
  Edit,
  Trash2,
  Search,
  Loader2,
  Truck,
  Fuel,
  MapPin,
} from 'lucide-react';
import { toast } from 'sonner';

const vehicleTypes = ['Truck', 'Trailer', 'Tanker', 'Container', 'Pickup', 'Van'];
const fuelTypes = ['Diesel', 'Petrol', 'CNG', 'Electric'];

export default function FleetPage() {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [formData, setFormData] = useState({
    registration_number: '',
    vehicle_type: '',
    make: '',
    model: '',
    year: new Date().getFullYear(),
    capacity_tons: '',
    fuel_type: 'Diesel',
    current_location: '',
  });

  useEffect(() => {
    fetchVehicles();
  }, []);

  const fetchVehicles = async () => {
    try {
      const response = await vehicleAPI.getAll();
      setVehicles(response.data);
    } catch (error) {
      console.error('Failed to fetch vehicles:', error);
      toast.error('Failed to load vehicles');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = {
        ...formData,
        year: parseInt(formData.year),
        capacity_tons: parseFloat(formData.capacity_tons),
      };

      if (editingVehicle) {
        await vehicleAPI.update(editingVehicle.vehicle_id, data);
        toast.success('Vehicle updated successfully');
      } else {
        await vehicleAPI.create(data);
        toast.success('Vehicle added successfully');
      }
      
      setIsDialogOpen(false);
      resetForm();
      fetchVehicles();
    } catch (error) {
      console.error('Failed to save vehicle:', error);
      toast.error('Failed to save vehicle');
    }
  };

  const handleDelete = async (vehicleId) => {
    if (!window.confirm('Are you sure you want to delete this vehicle?')) return;
    
    try {
      await vehicleAPI.delete(vehicleId);
      toast.success('Vehicle deleted successfully');
      fetchVehicles();
    } catch (error) {
      console.error('Failed to delete vehicle:', error);
      toast.error('Failed to delete vehicle');
    }
  };

  const handleEdit = (vehicle) => {
    setEditingVehicle(vehicle);
    setFormData({
      registration_number: vehicle.registration_number,
      vehicle_type: vehicle.vehicle_type,
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
      capacity_tons: vehicle.capacity_tons,
      fuel_type: vehicle.fuel_type,
      current_location: vehicle.current_location || '',
    });
    setIsDialogOpen(true);
  };

  const handleStatusChange = async (vehicleId, status) => {
    try {
      await vehicleAPI.updateStatus(vehicleId, status);
      toast.success('Status updated');
      fetchVehicles();
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const resetForm = () => {
    setEditingVehicle(null);
    setFormData({
      registration_number: '',
      vehicle_type: '',
      make: '',
      model: '',
      year: new Date().getFullYear(),
      capacity_tons: '',
      fuel_type: 'Diesel',
      current_location: '',
    });
  };

  const getStatusColor = (status) => {
    const colors = {
      available: 'bg-green-500/20 text-green-500',
      in_transit: 'bg-orange-500/20 text-orange-500',
      maintenance: 'bg-yellow-500/20 text-yellow-500',
      offline: 'bg-red-500/20 text-red-500',
    };
    return colors[status] || 'bg-slate-500/20 text-slate-500';
  };

  const filteredVehicles = vehicles.filter(v =>
    v.registration_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.make.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.model.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  return (
    <div data-testid="fleet-page" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-heading font-bold text-2xl sm:text-3xl text-white">
            Fleet Management
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Manage your vehicles and track their status
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button 
              data-testid="add-vehicle-btn"
              className="bg-orange-500 hover:bg-orange-600 text-white font-heading font-semibold"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Vehicle
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-slate-900 border-slate-800 max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-heading text-xl text-white">
                {editingVehicle ? 'Edit Vehicle' : 'Add New Vehicle'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-slate-300">Registration Number</Label>
                  <Input
                    required
                    placeholder="MH12AB1234"
                    value={formData.registration_number}
                    onChange={(e) => setFormData({ ...formData, registration_number: e.target.value })}
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">Vehicle Type</Label>
                  <Select
                    value={formData.vehicle_type}
                    onValueChange={(value) => setFormData({ ...formData, vehicle_type: value })}
                  >
                    <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      {vehicleTypes.map((type) => (
                        <SelectItem key={type} value={type} className="text-white hover:bg-slate-700">
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-slate-300">Make</Label>
                  <Input
                    required
                    placeholder="Tata"
                    value={formData.make}
                    onChange={(e) => setFormData({ ...formData, make: e.target.value })}
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">Model</Label>
                  <Input
                    required
                    placeholder="Prima"
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-slate-300">Year</Label>
                  <Input
                    type="number"
                    required
                    min="2000"
                    max={new Date().getFullYear() + 1}
                    value={formData.year}
                    onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">Capacity (Tons)</Label>
                  <Input
                    type="number"
                    required
                    step="0.1"
                    min="0"
                    placeholder="25"
                    value={formData.capacity_tons}
                    onChange={(e) => setFormData({ ...formData, capacity_tons: e.target.value })}
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">Fuel Type</Label>
                  <Select
                    value={formData.fuel_type}
                    onValueChange={(value) => setFormData({ ...formData, fuel_type: value })}
                  >
                    <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      {fuelTypes.map((type) => (
                        <SelectItem key={type} value={type} className="text-white hover:bg-slate-700">
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">Current Location</Label>
                <Input
                  placeholder="Mumbai Depot"
                  value={formData.current_location}
                  onChange={(e) => setFormData({ ...formData, current_location: e.target.value })}
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
                  {editingVehicle ? 'Update' : 'Add'} Vehicle
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
          placeholder="Search vehicles..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 bg-slate-900 border-slate-800 text-white placeholder:text-slate-500"
        />
      </div>

      {/* Vehicles Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredVehicles.map((vehicle) => (
          <Card key={vehicle.vehicle_id} className="bg-slate-900 border-slate-800 hover:border-slate-700 transition-colors">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-orange-500/10 rounded-lg flex items-center justify-center">
                    <Truck className="w-5 h-5 text-orange-500" />
                  </div>
                  <div>
                    <CardTitle className="font-heading text-lg text-white">
                      {vehicle.registration_number}
                    </CardTitle>
                    <p className="text-xs text-slate-500 font-mono">
                      {vehicle.vehicle_id?.slice(0, 12)}
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
                      className="text-slate-300 hover:text-white cursor-pointer"
                      onClick={() => handleEdit(vehicle)}
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      className="text-red-400 hover:text-red-300 cursor-pointer"
                      onClick={() => handleDelete(vehicle.vehicle_id)}
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
                  value={vehicle.status}
                  onValueChange={(value) => handleStatusChange(vehicle.vehicle_id, value)}
                >
                  <SelectTrigger className="w-auto h-7 bg-transparent border-0 p-0">
                    <Badge className={getStatusColor(vehicle.status)}>
                      {vehicle.status?.replace('_', ' ')}
                    </Badge>
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="available" className="text-green-400">Available</SelectItem>
                    <SelectItem value="in_transit" className="text-orange-400">In Transit</SelectItem>
                    <SelectItem value="maintenance" className="text-yellow-400">Maintenance</SelectItem>
                    <SelectItem value="offline" className="text-red-400">Offline</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Type</span>
                <span className="text-white">{vehicle.vehicle_type}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Vehicle</span>
                <span className="text-white">{vehicle.make} {vehicle.model} ({vehicle.year})</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Capacity</span>
                <span className="text-white">{vehicle.capacity_tons} Tons</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400 flex items-center gap-1">
                  <Fuel className="w-3 h-3" />
                  Fuel
                </span>
                <span className="text-white">{vehicle.fuel_type}</span>
              </div>
              {vehicle.current_location && (
                <div className="flex items-center gap-2 text-sm pt-2 border-t border-slate-800">
                  <MapPin className="w-3 h-3 text-orange-500" />
                  <span className="text-slate-400">{vehicle.current_location}</span>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredVehicles.length === 0 && (
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="py-12 text-center">
            <Car className="w-12 h-12 mx-auto mb-4 text-slate-600" />
            <h3 className="text-lg font-heading text-white mb-2">No vehicles found</h3>
            <p className="text-slate-400 text-sm">
              {searchTerm ? 'Try a different search term' : 'Add your first vehicle to get started'}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
