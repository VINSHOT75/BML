import React, { useState, useEffect } from 'react';
import { dashboardAPI, tripAPI, aiAPI } from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  BarChart3,
  TrendingUp,
  Truck,
  Users,
  Route,
  Sparkles,
  Send,
  Loader2,
  Download,
  Calendar,
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
  LineChart,
  Line,
  Legend,
  Area,
  AreaChart,
} from 'recharts';
import { toast } from 'sonner';

const COLORS = ['#f97316', '#3b82f6', '#22c55e', '#eab308', '#ef4444', '#8b5cf6'];

export default function ReportsPage() {
  const [stats, setStats] = useState(null);
  const [tripSummary, setTripSummary] = useState({});
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reportPeriod, setReportPeriod] = useState('week');
  const [aiQuery, setAiQuery] = useState('');
  const [aiInsight, setAiInsight] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [statsRes, summaryRes, tripsRes] = await Promise.all([
        dashboardAPI.getStats(),
        dashboardAPI.getTripSummary(),
        tripAPI.getAll(),
      ]);
      setStats(statsRes.data);
      setTripSummary(summaryRes.data);
      setTrips(tripsRes.data);
    } catch (error) {
      console.error('Failed to fetch report data:', error);
      toast.error('Failed to load report data');
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

  // Prepare chart data
  const tripStatusData = Object.entries(tripSummary).map(([status, count]) => ({
    name: status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' '),
    value: count,
  }));

  // Mock data for demo charts
  const weeklyTripData = [
    { day: 'Mon', trips: 12, completed: 10 },
    { day: 'Tue', trips: 15, completed: 14 },
    { day: 'Wed', trips: 18, completed: 16 },
    { day: 'Thu', trips: 14, completed: 12 },
    { day: 'Fri', trips: 20, completed: 18 },
    { day: 'Sat', trips: 8, completed: 8 },
    { day: 'Sun', trips: 5, completed: 5 },
  ];

  const monthlyRevenueData = [
    { month: 'Jan', revenue: 450000 },
    { month: 'Feb', revenue: 520000 },
    { month: 'Mar', revenue: 480000 },
    { month: 'Apr', revenue: 610000 },
    { month: 'May', revenue: 550000 },
    { month: 'Jun', revenue: 680000 },
  ];

  const vehicleUtilization = [
    { name: 'In Transit', value: stats?.total_vehicles - stats?.available_vehicles || 0 },
    { name: 'Available', value: stats?.available_vehicles || 0 },
    { name: 'Maintenance', value: stats?.pending_maintenance || 0 },
  ].filter(item => item.value > 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  return (
    <div data-testid="reports-page" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-heading font-bold text-2xl sm:text-3xl text-white">
            Reports & Analytics
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Performance metrics and AI-powered insights
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={reportPeriod} onValueChange={setReportPeriod}>
            <SelectTrigger className="w-32 bg-slate-900 border-slate-800 text-white">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              <SelectItem value="week" className="text-white">This Week</SelectItem>
              <SelectItem value="month" className="text-white">This Month</SelectItem>
              <SelectItem value="quarter" className="text-white">This Quarter</SelectItem>
              <SelectItem value="year" className="text-white">This Year</SelectItem>
            </SelectContent>
          </Select>
          <Button 
            variant="outline"
            className="border-slate-700 text-slate-300 hover:bg-slate-800"
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                <Truck className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-slate-400 text-xs">Total Vehicles</p>
                <p className="font-heading font-bold text-2xl text-white">{stats?.total_vehicles || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-slate-400 text-xs">Total Drivers</p>
                <p className="font-heading font-bold text-2xl text-white">{stats?.total_drivers || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-500/10 rounded-lg flex items-center justify-center">
                <Route className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <p className="text-slate-400 text-xs">Total Trips</p>
                <p className="font-heading font-bold text-2xl text-white">{trips.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <p className="text-slate-400 text-xs">Completion Rate</p>
                <p className="font-heading font-bold text-2xl text-white">
                  {trips.length > 0 
                    ? `${Math.round((tripSummary.completed || 0) / trips.length * 100)}%`
                    : '0%'
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Weekly Trips Chart */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="border-b border-slate-800 pb-4">
            <CardTitle className="font-heading text-lg text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-orange-500" />
              Weekly Trip Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={weeklyTripData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="day" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1e293b', 
                    border: '1px solid #334155',
                    borderRadius: '8px',
                  }}
                  labelStyle={{ color: '#f8fafc' }}
                />
                <Legend />
                <Bar dataKey="trips" name="Total Trips" fill="#f97316" radius={[4, 4, 0, 0]} />
                <Bar dataKey="completed" name="Completed" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Trip Status Distribution */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="border-b border-slate-800 pb-4">
            <CardTitle className="font-heading text-lg text-white flex items-center gap-2">
              <Route className="w-5 h-5 text-orange-500" />
              Trip Status Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {tripStatusData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={tripStatusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {tripStatusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#1e293b', 
                        border: '1px solid #334155',
                        borderRadius: '8px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap justify-center gap-4 mt-2">
                  {tripStatusData.map((item, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="text-xs text-slate-400">{item.name}: {item.value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-64 flex items-center justify-center text-slate-500">
                <p>No trip data available</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Revenue Trend */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="border-b border-slate-800 pb-4">
            <CardTitle className="font-heading text-lg text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-orange-500" />
              Monthly Revenue Trend
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={monthlyRevenueData}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={(value) => `₹${value/1000}K`} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1e293b', 
                    border: '1px solid #334155',
                    borderRadius: '8px',
                  }}
                  formatter={(value) => [`₹${value.toLocaleString()}`, 'Revenue']}
                />
                <Area 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="#f97316" 
                  fillOpacity={1} 
                  fill="url(#colorRevenue)" 
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Vehicle Utilization */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="border-b border-slate-800 pb-4">
            <CardTitle className="font-heading text-lg text-white flex items-center gap-2">
              <Truck className="w-5 h-5 text-orange-500" />
              Vehicle Utilization
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {vehicleUtilization.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={vehicleUtilization}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {vehicleUtilization.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#1e293b', 
                        border: '1px solid #334155',
                        borderRadius: '8px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap justify-center gap-4 mt-2">
                  {vehicleUtilization.map((item, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="text-xs text-slate-400">{item.name}: {item.value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-64 flex items-center justify-center text-slate-500">
                <p>No vehicle data available</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* AI Insights */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="border-b border-slate-800 pb-4">
          <CardTitle className="font-heading text-lg text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-orange-500" />
            AI-Powered Analytics
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          <p className="text-slate-400 text-sm">
            Ask our AI for insights about your fleet operations, route optimization, or performance analysis.
          </p>
          <div className="flex gap-3">
            <Textarea
              placeholder="e.g., 'What's the best time to schedule deliveries to maximize efficiency?' or 'How can I reduce vehicle idle time?'"
              value={aiQuery}
              onChange={(e) => setAiQuery(e.target.value)}
              className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 min-h-[80px] resize-none flex-1"
            />
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              size="sm"
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
              onClick={() => setAiQuery('How can I improve fleet utilization?')}
            >
              Fleet Optimization
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
              onClick={() => setAiQuery('Suggest ways to reduce fuel costs')}
            >
              Cost Reduction
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
              onClick={() => setAiQuery('How to improve driver performance?')}
            >
              Driver Performance
            </Button>
          </div>
          <Button 
            onClick={handleAiQuery}
            disabled={aiLoading || !aiQuery.trim()}
            className="bg-orange-500 hover:bg-orange-600 text-white font-heading font-semibold"
          >
            {aiLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Get AI Insights
              </>
            )}
          </Button>
          {aiInsight && (
            <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
              <div className="flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-orange-500 mt-1" />
                <p className="text-sm text-slate-300 whitespace-pre-wrap">{aiInsight}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
