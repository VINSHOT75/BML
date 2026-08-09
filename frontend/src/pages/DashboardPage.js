import React, { useState, useEffect } from 'react';
import { dashboardAPI, vehicleAPI, driverAPI, tripAPI, aiAPI } from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import {
  Car,
  Users,
  Route,
  Wrench,
  TrendingUp,
  Truck,
  MapPin,
  Clock,
  Sparkles,
  Send,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const COLORS = ['#f97316', '#3b82f6', '#22c55e', '#eab308', '#ef4444'];

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [tripSummary, setTripSummary] = useState({});
  const [recentTrips, setRecentTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [aiQuery, setAiQuery] = useState('');
  const [aiInsight, setAiInsight] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [statsRes, summaryRes, tripsRes] = await Promise.all([
        dashboardAPI.getStats(),
        dashboardAPI.getTripSummary(),
        tripAPI.getAll(),
      ]);
      setStats(statsRes.data);
      setTripSummary(summaryRes.data);
      setRecentTrips(tripsRes.data.slice(0, 5));
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAiQuery = async () => {
    if (!aiQuery.trim()) return;
    setAiLoading(true);
    try {
      const response = await aiAPI.getInsights(aiQuery);
      setAiInsight(response.data.insight);
    } catch (error) {
      console.error('AI query failed:', error);
      setAiInsight('Failed to get insights. Please try again.');
    } finally {
      setAiLoading(false);
    }
  };

  const statCards = [
    {
      title: 'Total Vehicles',
      value: stats?.total_vehicles || 0,
      subValue: `${stats?.available_vehicles || 0} available`,
      icon: Car,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: 'Total Drivers',
      value: stats?.total_drivers || 0,
      subValue: `${stats?.available_drivers || 0} available`,
      icon: Users,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      title: 'Active Trips',
      value: stats?.active_trips || 0,
      subValue: `${stats?.completed_trips_today || 0} completed today`,
      icon: Route,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
    },
    {
      title: 'Maintenance',
      value: stats?.pending_maintenance || 0,
      subValue: 'Vehicles pending',
      icon: Wrench,
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-500/10',
    },
  ];

  const tripChartData = Object.entries(tripSummary).map(([status, count]) => ({
    name: status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' '),
    value: count,
  }));

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  return (
    <div data-testid="dashboard-page" className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-heading font-bold text-2xl sm:text-3xl text-white">
            Dashboard
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Overview of your fleet operations
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Clock className="w-4 h-4" />
          <span>Last updated: {new Date().toLocaleTimeString()}</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, index) => (
          <Card key={index} className="bg-slate-900 border-slate-800 hover:border-slate-700 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-slate-400 text-sm font-medium">{stat.title}</p>
                  <p className="font-heading font-bold text-3xl text-white mt-1">
                    {stat.value}
                  </p>
                  <p className="text-slate-500 text-xs mt-1">{stat.subValue}</p>
                </div>
                <div className={`w-10 h-10 rounded-lg ${stat.bgColor} flex items-center justify-center`}>
                  <stat.icon className={`w-5 h-5 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Trip Status Chart */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="border-b border-slate-800 pb-4">
            <CardTitle className="font-heading text-lg text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-orange-500" />
              Trip Status Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {tripChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={tripChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {tripChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1e293b', 
                      border: '1px solid #334155',
                      borderRadius: '8px',
                    }}
                    labelStyle={{ color: '#f8fafc' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-slate-500">
                <div className="text-center">
                  <Route className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No trip data available</p>
                </div>
              </div>
            )}
            <div className="flex flex-wrap justify-center gap-4 mt-4">
              {tripChartData.map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <span className="text-xs text-slate-400">{item.name}: {item.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* AI Insights */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="border-b border-slate-800 pb-4">
            <CardTitle className="font-heading text-lg text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-orange-500" />
              AI Insights
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            <div className="space-y-2">
              <Textarea
                placeholder="Ask AI for logistics insights... (e.g., 'How can I optimize my fleet utilization?')"
                value={aiQuery}
                onChange={(e) => setAiQuery(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 min-h-[80px] resize-none"
              />
              <Button 
                onClick={handleAiQuery}
                disabled={aiLoading || !aiQuery.trim()}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-heading font-semibold"
              >
                {aiLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Get Insights
                  </>
                )}
              </Button>
            </div>
            {aiInsight && (
              <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                <p className="text-sm text-slate-300 whitespace-pre-wrap">{aiInsight}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Trips */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="border-b border-slate-800 pb-4">
          <CardTitle className="font-heading text-lg text-white flex items-center gap-2">
            <Truck className="w-5 h-5 text-orange-500" />
            Recent Trips
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {recentTrips.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-800">
                    <th className="px-4 py-3 text-left text-xs font-heading font-semibold text-slate-500 uppercase tracking-wider">
                      Trip ID
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-heading font-semibold text-slate-500 uppercase tracking-wider">
                      Route
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-heading font-semibold text-slate-500 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-heading font-semibold text-slate-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-heading font-semibold text-slate-500 uppercase tracking-wider">
                      Cargo
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {recentTrips.map((trip) => (
                    <tr key={trip.trip_id} className="hover:bg-slate-800/50 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-orange-500">
                          {trip.trip_id?.slice(0, 12)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 text-sm">
                          <MapPin className="w-3 h-3 text-green-500" />
                          <span className="text-slate-300 truncate max-w-[150px]">{trip.origin}</span>
                          <span className="text-slate-600">→</span>
                          <MapPin className="w-3 h-3 text-red-500" />
                          <span className="text-slate-300 truncate max-w-[150px]">{trip.destination}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-300">
                        {trip.customer_name}
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={getStatusColor(trip.status)}>
                          {trip.status?.replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-400">
                        {trip.cargo_type} ({trip.cargo_weight_tons}T)
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center text-slate-500">
              <AlertCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No trips found. Create your first trip to get started.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
