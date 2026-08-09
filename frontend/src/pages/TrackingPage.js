import React, { useState, useEffect } from 'react';
import { tripAPI, vehicleAPI } from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  MapPin,
  Truck,
  Navigation,
  Search,
  Loader2,
  RefreshCw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Clock,
  Route,
} from 'lucide-react';
import { toast } from 'sonner';

export default function TrackingPage() {
  const [vehicles, setVehicles] = useState([]);
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [vehiclesRes, tripsRes] = await Promise.all([
        vehicleAPI.getAll(),
        tripAPI.getAll('in_progress'),
      ]);
      setVehicles(vehiclesRes.data);
      setTrips(tripsRes.data);
    } catch (error) {
      console.error('Failed to fetch tracking data:', error);
      toast.error('Failed to load tracking data');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      available: 'bg-green-500',
      in_transit: 'bg-orange-500',
      maintenance: 'bg-yellow-500',
      offline: 'bg-red-500',
    };
    return colors[status] || 'bg-slate-500';
  };

  const activeVehicles = vehicles.filter(v => v.status === 'in_transit');
  const filteredVehicles = vehicles.filter(v =>
    v.registration_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.current_location?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  return (
    <div data-testid="tracking-page" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-heading font-bold text-2xl sm:text-3xl text-white">
            Live Tracking
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Real-time vehicle location and trip status
          </p>
        </div>
        <Button 
          onClick={fetchData}
          variant="outline"
          className="border-slate-700 text-slate-300 hover:bg-slate-800"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-heading font-bold text-white">{vehicles.length}</div>
            <div className="text-xs text-slate-400">Total Vehicles</div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-heading font-bold text-orange-500">{activeVehicles.length}</div>
            <div className="text-xs text-slate-400">In Transit</div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-heading font-bold text-green-500">
              {vehicles.filter(v => v.status === 'available').length}
            </div>
            <div className="text-xs text-slate-400">Available</div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-heading font-bold text-blue-500">{trips.length}</div>
            <div className="text-xs text-slate-400">Active Trips</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Map Area */}
        <div className="lg:col-span-2">
          <Card className="bg-slate-900 border-slate-800 overflow-hidden">
            <CardHeader className="border-b border-slate-800 pb-4">
              <CardTitle className="font-heading text-lg text-white flex items-center gap-2">
                <Navigation className="w-5 h-5 text-orange-500" />
                Fleet Map
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="relative">
                {/* Map Placeholder */}
                <div 
                  className="h-[500px] bg-cover bg-center relative"
                  style={{
                    backgroundImage: `url('https://images.pexels.com/photos/9966011/pexels-photo-9966011.jpeg')`,
                  }}
                >
                  {/* Dark overlay */}
                  <div className="absolute inset-0 bg-slate-900/60" />
                  
                  {/* Map Controls - Glass Panel Style */}
                  <div className="absolute top-4 right-4 flex flex-col gap-2">
                    <div className="glass-panel rounded-lg p-1">
                      <Button size="icon" variant="ghost" className="text-white hover:bg-white/10">
                        <ZoomIn className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="text-white hover:bg-white/10">
                        <ZoomOut className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="text-white hover:bg-white/10">
                        <Maximize2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Vehicle Markers */}
                  <div className="absolute inset-0 p-8">
                    {activeVehicles.slice(0, 5).map((vehicle, index) => {
                      // Simulated positions for demo
                      const positions = [
                        { top: '20%', left: '30%' },
                        { top: '40%', left: '60%' },
                        { top: '60%', left: '40%' },
                        { top: '35%', left: '75%' },
                        { top: '70%', left: '55%' },
                      ];
                      const pos = positions[index] || positions[0];
                      
                      return (
                        <div
                          key={vehicle.vehicle_id}
                          className="absolute cursor-pointer group"
                          style={pos}
                          onClick={() => setSelectedVehicle(vehicle)}
                        >
                          <div className="relative">
                            <div className={`w-10 h-10 rounded-full ${getStatusColor(vehicle.status)} flex items-center justify-center shadow-lg marker-bounce`}>
                              <Truck className="w-5 h-5 text-white" />
                            </div>
                            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-orange-500 rotate-45" />
                            
                            {/* Tooltip */}
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                              <div className="glass-panel rounded-lg px-3 py-2 whitespace-nowrap">
                                <p className="text-white font-mono text-xs">{vehicle.registration_number}</p>
                                <p className="text-slate-400 text-xs">{vehicle.current_location || 'On Route'}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Legend */}
                  <div className="absolute bottom-4 left-4 glass-panel rounded-lg px-4 py-3">
                    <p className="text-xs text-slate-400 mb-2">Vehicle Status</p>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded-full bg-orange-500" />
                        <span className="text-xs text-white">In Transit</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded-full bg-green-500" />
                        <span className="text-xs text-white">Available</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded-full bg-yellow-500" />
                        <span className="text-xs text-white">Maintenance</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Vehicle List */}
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <Input
              placeholder="Search vehicles..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-slate-900 border-slate-800 text-white placeholder:text-slate-500"
            />
          </div>

          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="border-b border-slate-800 pb-3">
              <CardTitle className="font-heading text-base text-white">
                Vehicle List ({filteredVehicles.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 max-h-[400px] overflow-y-auto">
              {filteredVehicles.map((vehicle) => (
                <div
                  key={vehicle.vehicle_id}
                  className={`p-3 border-b border-slate-800 last:border-0 cursor-pointer hover:bg-slate-800/50 transition-colors ${
                    selectedVehicle?.vehicle_id === vehicle.vehicle_id ? 'bg-slate-800' : ''
                  }`}
                  onClick={() => setSelectedVehicle(vehicle)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full ${getStatusColor(vehicle.status)} flex items-center justify-center`}>
                        <Truck className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <p className="text-white font-mono text-sm">{vehicle.registration_number}</p>
                        <p className="text-slate-500 text-xs">{vehicle.vehicle_type}</p>
                      </div>
                    </div>
                    <Badge className={`${getStatusColor(vehicle.status)}/20 text-white text-xs`}>
                      {vehicle.status?.replace('_', ' ')}
                    </Badge>
                  </div>
                  {vehicle.current_location && (
                    <div className="flex items-center gap-1 mt-2 text-xs text-slate-400">
                      <MapPin className="w-3 h-3" />
                      {vehicle.current_location}
                    </div>
                  )}
                </div>
              ))}
              {filteredVehicles.length === 0 && (
                <div className="p-8 text-center text-slate-500">
                  <Truck className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No vehicles found</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Active Trips */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="border-b border-slate-800 pb-3">
              <CardTitle className="font-heading text-base text-white flex items-center gap-2">
                <Route className="w-4 h-4 text-orange-500" />
                Active Trips ({trips.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 max-h-[250px] overflow-y-auto">
              {trips.length > 0 ? (
                trips.map((trip) => (
                  <div key={trip.trip_id} className="p-3 border-b border-slate-800 last:border-0">
                    <div className="flex items-center gap-2 text-sm mb-1">
                      <MapPin className="w-3 h-3 text-green-500" />
                      <span className="text-slate-300">{trip.origin}</span>
                      <span className="text-slate-600">→</span>
                      <MapPin className="w-3 h-3 text-red-500" />
                      <span className="text-slate-300">{trip.destination}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Clock className="w-3 h-3" />
                      <span>Started: {trip.started_at ? new Date(trip.started_at).toLocaleTimeString() : 'N/A'}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-slate-500">
                  <Route className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No active trips</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Selected Vehicle Detail */}
      {selectedVehicle && (
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="border-b border-slate-800 pb-4">
            <CardTitle className="font-heading text-lg text-white flex items-center gap-2">
              <Truck className="w-5 h-5 text-orange-500" />
              Vehicle Details - {selectedVehicle.registration_number}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="grid md:grid-cols-4 gap-4">
              <div>
                <p className="text-slate-500 text-xs uppercase mb-1">Status</p>
                <Badge className={`${getStatusColor(selectedVehicle.status)}/20 text-white`}>
                  {selectedVehicle.status?.replace('_', ' ')}
                </Badge>
              </div>
              <div>
                <p className="text-slate-500 text-xs uppercase mb-1">Type</p>
                <p className="text-white">{selectedVehicle.vehicle_type}</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs uppercase mb-1">Vehicle</p>
                <p className="text-white">{selectedVehicle.make} {selectedVehicle.model}</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs uppercase mb-1">Location</p>
                <p className="text-white">{selectedVehicle.current_location || 'Unknown'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
