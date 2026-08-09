import React, { useState, useEffect } from 'react';
import { tripAPI, vehicleAPI, driverAPI, complianceAPI } from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Checkbox } from '../components/ui/checkbox';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  ClipboardCheck,
  Shield,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  FileCheck,
  Truck,
  User,
  Calendar,
} from 'lucide-react';
import { toast } from 'sonner';

export default function CompliancePage() {
  const [trips, setTrips] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCheckDialogOpen, setIsCheckDialogOpen] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [checkForm, setCheckForm] = useState({
    tires_ok: false,
    brakes_ok: false,
    lights_ok: false,
    mirrors_ok: false,
    fuel_level: 'full',
    documents_ok: false,
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

  const handlePreTripCheck = async () => {
    if (!selectedTrip) return;
    
    try {
      await complianceAPI.createPreTripCheck({
        trip_id: selectedTrip.trip_id,
        driver_id: selectedTrip.driver_id,
        vehicle_id: selectedTrip.vehicle_id,
        ...checkForm,
      });
      toast.success('Pre-trip check completed');
      setIsCheckDialogOpen(false);
      resetCheckForm();
    } catch (error) {
      console.error('Failed to save pre-trip check:', error);
      toast.error('Failed to save pre-trip check');
    }
  };

  const resetCheckForm = () => {
    setSelectedTrip(null);
    setCheckForm({
      tires_ok: false,
      brakes_ok: false,
      lights_ok: false,
      mirrors_ok: false,
      fuel_level: 'full',
      documents_ok: false,
      notes: '',
    });
  };

  const getDriverName = (driverId) => {
    const driver = drivers.find(d => d.driver_id === driverId);
    return driver?.name || 'Unassigned';
  };

  const getVehicleNumber = (vehicleId) => {
    const vehicle = vehicles.find(v => v.vehicle_id === vehicleId);
    return vehicle?.registration_number || 'Unassigned';
  };

  // Get drivers with expiring licenses (within 30 days)
  const expiringLicenses = drivers.filter(d => {
    if (!d.license_expiry) return false;
    const expiry = new Date(d.license_expiry);
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    return expiry <= thirtyDaysFromNow;
  });

  // Get vehicles needing maintenance
  const maintenanceVehicles = vehicles.filter(v => v.status === 'maintenance');

  // Pending trips that need pre-trip checks
  const assignedTrips = trips.filter(t => t.status === 'assigned');

  const allChecksPassed = Object.entries(checkForm)
    .filter(([key]) => key !== 'notes' && key !== 'fuel_level')
    .every(([, value]) => value === true);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  return (
    <div data-testid="compliance-page" className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-heading font-bold text-2xl sm:text-3xl text-white">
          Safety & Compliance
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Pre-trip checks, license management, and safety compliance
        </p>
      </div>

      {/* Alert Cards */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card className={`border-l-4 ${expiringLicenses.length > 0 ? 'border-l-yellow-500 bg-yellow-500/5' : 'border-l-green-500 bg-green-500/5'} bg-slate-900 border-slate-800`}>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              {expiringLicenses.length > 0 ? (
                <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5" />
              )}
              <div>
                <h3 className="font-heading font-semibold text-white">License Expiry</h3>
                <p className="text-slate-400 text-sm mt-1">
                  {expiringLicenses.length > 0 
                    ? `${expiringLicenses.length} driver(s) with expiring licenses`
                    : 'All licenses up to date'
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={`border-l-4 ${maintenanceVehicles.length > 0 ? 'border-l-orange-500 bg-orange-500/5' : 'border-l-green-500 bg-green-500/5'} bg-slate-900 border-slate-800`}>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              {maintenanceVehicles.length > 0 ? (
                <AlertTriangle className="w-5 h-5 text-orange-500 mt-0.5" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5" />
              )}
              <div>
                <h3 className="font-heading font-semibold text-white">Vehicle Maintenance</h3>
                <p className="text-slate-400 text-sm mt-1">
                  {maintenanceVehicles.length > 0 
                    ? `${maintenanceVehicles.length} vehicle(s) in maintenance`
                    : 'All vehicles operational'
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500 bg-blue-500/5 bg-slate-900 border-slate-800">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <FileCheck className="w-5 h-5 text-blue-500 mt-0.5" />
              <div>
                <h3 className="font-heading font-semibold text-white">Pre-Trip Checks</h3>
                <p className="text-slate-400 text-sm mt-1">
                  {assignedTrips.length} trip(s) pending pre-trip check
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Pre-Trip Checks Section */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="border-b border-slate-800 pb-4">
            <CardTitle className="font-heading text-lg text-white flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-orange-500" />
              Pre-Trip Inspection Queue
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {assignedTrips.length > 0 ? (
              <div className="divide-y divide-slate-800">
                {assignedTrips.map((trip) => (
                  <div key={trip.trip_id} className="p-4 hover:bg-slate-800/50 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-mono text-xs text-orange-500">{trip.trip_id?.slice(0, 12)}</span>
                          <Badge className="bg-blue-500/20 text-blue-500">Assigned</Badge>
                        </div>
                        <p className="text-white text-sm mb-1">
                          {trip.origin} → {trip.destination}
                        </p>
                        <div className="flex flex-wrap gap-3 text-xs text-slate-400">
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {getDriverName(trip.driver_id)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Truck className="w-3 h-3" />
                            {getVehicleNumber(trip.vehicle_id)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(trip.scheduled_date).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => { setSelectedTrip(trip); setIsCheckDialogOpen(true); }}
                        className="bg-orange-500 hover:bg-orange-600 text-white font-heading font-semibold"
                      >
                        Start Check
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-slate-500">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No trips pending pre-trip checks</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* License Alerts */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="border-b border-slate-800 pb-4">
            <CardTitle className="font-heading text-lg text-white flex items-center gap-2">
              <Shield className="w-5 h-5 text-orange-500" />
              License & Document Alerts
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {expiringLicenses.length > 0 ? (
              <div className="divide-y divide-slate-800">
                {expiringLicenses.map((driver) => {
                  const daysUntilExpiry = Math.ceil(
                    (new Date(driver.license_expiry) - new Date()) / (1000 * 60 * 60 * 24)
                  );
                  const isExpired = daysUntilExpiry < 0;
                  
                  return (
                    <div key={driver.driver_id} className="p-4 hover:bg-slate-800/50 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-white font-medium">{driver.name}</p>
                          <p className="text-slate-500 text-xs font-mono mt-1">
                            License: {driver.license_number}
                          </p>
                        </div>
                        <div className="text-right">
                          <Badge className={isExpired ? 'bg-red-500/20 text-red-500' : 'bg-yellow-500/20 text-yellow-500'}>
                            {isExpired ? 'Expired' : `${daysUntilExpiry} days left`}
                          </Badge>
                          <p className="text-slate-500 text-xs mt-1">
                            {new Date(driver.license_expiry).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 text-center text-slate-500">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>All driver licenses are valid</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Maintenance Vehicles */}
      {maintenanceVehicles.length > 0 && (
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="border-b border-slate-800 pb-4">
            <CardTitle className="font-heading text-lg text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-500" />
              Vehicles in Maintenance
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-800">
                    <th className="px-4 py-3 text-left text-xs font-heading font-semibold text-slate-500 uppercase">
                      Vehicle
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-heading font-semibold text-slate-500 uppercase">
                      Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-heading font-semibold text-slate-500 uppercase">
                      Make/Model
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-heading font-semibold text-slate-500 uppercase">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {maintenanceVehicles.map((vehicle) => (
                    <tr key={vehicle.vehicle_id} className="hover:bg-slate-800/50 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-mono text-sm text-white">{vehicle.registration_number}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-300">{vehicle.vehicle_type}</td>
                      <td className="px-4 py-3 text-slate-300">{vehicle.make} {vehicle.model}</td>
                      <td className="px-4 py-3">
                        <Badge className="bg-yellow-500/20 text-yellow-500">Maintenance</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pre-Trip Check Dialog */}
      <Dialog open={isCheckDialogOpen} onOpenChange={(open) => { setIsCheckDialogOpen(open); if (!open) resetCheckForm(); }}>
        <DialogContent className="bg-slate-900 border-slate-800 max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl text-white">
              Pre-Trip Safety Check
            </DialogTitle>
          </DialogHeader>
          {selectedTrip && (
            <div className="space-y-4 mt-4">
              <div className="p-3 bg-slate-800/50 rounded-lg">
                <p className="text-sm text-slate-400">Trip</p>
                <p className="text-white">{selectedTrip.origin} → {selectedTrip.destination}</p>
                <div className="flex gap-4 mt-2 text-xs text-slate-500">
                  <span>Driver: {getDriverName(selectedTrip.driver_id)}</span>
                  <span>Vehicle: {getVehicleNumber(selectedTrip.vehicle_id)}</span>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-medium text-slate-300">Safety Checklist</h4>
                
                {[
                  { key: 'tires_ok', label: 'Tires in good condition' },
                  { key: 'brakes_ok', label: 'Brakes functioning properly' },
                  { key: 'lights_ok', label: 'All lights working' },
                  { key: 'mirrors_ok', label: 'Mirrors adjusted and clean' },
                  { key: 'documents_ok', label: 'All documents present' },
                ].map((item) => (
                  <div key={item.key} className="flex items-center gap-3">
                    <Checkbox
                      id={item.key}
                      checked={checkForm[item.key]}
                      onCheckedChange={(checked) => setCheckForm({ ...checkForm, [item.key]: checked })}
                      className="border-slate-600 data-[state=checked]:bg-orange-500"
                    />
                    <Label htmlFor={item.key} className="text-slate-300 cursor-pointer">
                      {item.label}
                    </Label>
                    {checkForm[item.key] ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500 ml-auto" />
                    ) : (
                      <XCircle className="w-4 h-4 text-slate-600 ml-auto" />
                    )}
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300">Fuel Level</Label>
                <Select
                  value={checkForm.fuel_level}
                  onValueChange={(value) => setCheckForm({ ...checkForm, fuel_level: value })}
                >
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="full" className="text-white">Full</SelectItem>
                    <SelectItem value="three_quarter" className="text-white">3/4</SelectItem>
                    <SelectItem value="half" className="text-white">1/2</SelectItem>
                    <SelectItem value="quarter" className="text-white">1/4</SelectItem>
                    <SelectItem value="empty" className="text-white">Empty</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300">Notes</Label>
                <Textarea
                  placeholder="Any issues or observations..."
                  value={checkForm.notes}
                  onChange={(e) => setCheckForm({ ...checkForm, notes: e.target.value })}
                  className="bg-slate-800 border-slate-700 text-white min-h-[80px]"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button 
                  variant="outline" 
                  onClick={() => { setIsCheckDialogOpen(false); resetCheckForm(); }}
                  className="border-slate-700 text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handlePreTripCheck}
                  disabled={!allChecksPassed}
                  className="bg-orange-500 hover:bg-orange-600 text-white font-heading font-semibold disabled:opacity-50"
                >
                  {allChecksPassed ? 'Complete Check' : 'Complete All Items'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
