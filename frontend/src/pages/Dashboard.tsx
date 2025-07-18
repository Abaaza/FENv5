import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { 
  FileSpreadsheet, 
  Coins, 
  FolderOpen, 
  Users, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  Activity,
  TrendingUp,
  Database,
  Wifi,
  WifiOff,
  Server,
  Calendar,
  BarChart3,
  ArrowRight,
  Loader2,
  RefreshCw,
  XCircle,
  Building2,
  Package,
  FileText,
  Timer,
  Plus
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { api } from '../lib/api';
import { format, formatDistanceToNow } from 'date-fns';
import { useCurrency } from '../hooks/useCurrency';
import { useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';
import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Progress } from '../components/ui/progress';

interface DashboardStats {
  totalProjects: number;
  activeProjects: number;
  priceItems: number;
  clients: number;
  matchesToday: number;
  completedToday: number;
  activitiesToday?: number;
}

interface RecentJob {
  _id: string;
  fileName: string;
  status: string;
  progress: number;
  itemCount: number;
  matchedCount: number;
  clientName: string;
  startedAt: number;
  completedAt?: number;
  totalValue?: number;
}

interface SystemHealth {
  apiStatus: {
    cohere: { status: string; responseTime: number };
    openai: { status: string; responseTime: number };
    convex: { status: string; responseTime: number };
  };
  timestamp: number;
}

interface ActivitySummary {
  today: any;
  week: any;
  month: any;
}

interface RecentActivity {
  _id: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  action: string;
  entityType: string;
  entityId?: string;
  details?: string;
  timestamp: number;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { symbol, formatPrice } = useCurrency();
  const [activeTimeframe, setActiveTimeframe] = useState<'today' | 'week' | 'month'>('today');
  const [refreshKey, setRefreshKey] = useState(0);

  // Fetch dashboard stats
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats', refreshKey],
    queryFn: async () => {
      const response = await api.get('/dashboard/stats');
      console.log('[Dashboard] Stats received:', response.data);
      return response.data;
    },
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 0, // Always fetch fresh data
  });

  // Fetch recent jobs
  const { data: recentJobs, isLoading: jobsLoading } = useQuery<RecentJob[]>({
    queryKey: ['recent-jobs', refreshKey],
    queryFn: async () => {
      const response = await api.get('/dashboard/recent-jobs?limit=6');
      return response.data;
    },
  });

  // Fetch system health
  const { data: systemHealth, isLoading: healthLoading } = useQuery<SystemHealth>({
    queryKey: ['system-health', refreshKey],
    queryFn: async () => {
      const response = await api.get('/dashboard/system-health');
      return response.data;
    },
    refetchInterval: 60000, // Refetch every minute
  });

  // Fetch activity summary
  const { data: activitySummary, isLoading: summaryLoading } = useQuery<ActivitySummary>({
    queryKey: ['activity-summary', refreshKey],
    queryFn: async () => {
      const response = await api.get('/dashboard/activity-summary');
      return response.data;
    },
  });

  // Fetch recent activities
  const { data: recentActivities, isLoading: activitiesLoading } = useQuery<RecentActivity[]>({
    queryKey: ['recent-activities', refreshKey],
    queryFn: async () => {
      const response = await api.get('/dashboard/activity?limit=6');
      return response.data;
    },
  });

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  // Log when stats change
  useEffect(() => {
    if (stats) {
      console.log('[Dashboard] Stats updated:', {
        activitiesToday: stats.activitiesToday,
        totalProjects: stats.totalProjects,
        matchesToday: stats.matchesToday
      });
    }
  }, [stats]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'matching':
      case 'parsing':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getApiStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <Wifi className="h-4 w-4 text-green-500" />;
      case 'error':
        return <WifiOff className="h-4 w-4 text-red-500" />;
      case 'not_configured':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getApiStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'error':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'not_configured':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'invalid_key':
        return 'text-orange-600 bg-orange-50 border-orange-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };


  const getTimeframeData = () => {
    if (!activitySummary) return null;
    return activitySummary[activeTimeframe];
  };

  const timeframeData = getTimeframeData();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          className="gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/projects')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Projects</CardTitle>
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : stats?.totalProjects || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.activeProjects || 0} active BOQs
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/price-list')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Price Items</CardTitle>
            <Coins className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : stats?.priceItems || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Construction materials ({symbol})
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/clients')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clients</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : stats?.clients || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Total companies
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Activity</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : stats?.activitiesToday || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.completedToday || 0} BOQs completed
            </p>
          </CardContent>
        </Card>
      </div>

      {/* System Health & API Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              System Health
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {healthLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : systemHealth && systemHealth.apiStatus ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  {/* Cohere API */}
                  <div className={cn(
                    "p-4 rounded-lg border text-center",
                    getApiStatusColor(systemHealth.apiStatus?.cohere?.status || 'error')
                  )}>
                    <div className="flex items-center justify-center gap-2 mb-2">
                      {getApiStatusIcon(systemHealth.apiStatus?.cohere?.status || 'error')}
                      <span className="font-medium">Cohere API</span>
                    </div>
                    <p className="text-sm font-semibold capitalize mb-1">
                      {(systemHealth.apiStatus?.cohere?.status || 'error').replace(/_/g, ' ')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {systemHealth.apiStatus?.cohere?.status === 'connected' 
                        ? `Response: ${systemHealth.apiStatus?.cohere?.responseTime || 0}ms`
                        : 'Check API configuration'}
                    </p>
                  </div>

                  {/* OpenAI API */}
                  <div className={cn(
                    "p-4 rounded-lg border text-center",
                    getApiStatusColor(systemHealth.apiStatus?.openai?.status || 'error')
                  )}>
                    <div className="flex items-center justify-center gap-2 mb-2">
                      {getApiStatusIcon(systemHealth.apiStatus?.openai?.status || 'error')}
                      <span className="font-medium">OpenAI API</span>
                    </div>
                    <p className="text-sm font-semibold capitalize mb-1">
                      {(systemHealth.apiStatus?.openai?.status || 'error').replace(/_/g, ' ')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {systemHealth.apiStatus?.openai?.status === 'connected' 
                        ? `Response: ${systemHealth.apiStatus?.openai?.responseTime || 0}ms`
                        : 'Check API configuration'}
                    </p>
                  </div>

                  {/* Database */}
                  <div className={cn(
                    "col-span-2 p-4 rounded-lg border text-center",
                    getApiStatusColor(systemHealth.apiStatus?.convex?.status || 'error')
                  )}>
                    <div className="flex items-center justify-center gap-2 mb-2">
                      {getApiStatusIcon(systemHealth.apiStatus?.convex?.status || 'error')}
                      <span className="font-medium">Database Connection</span>
                    </div>
                    <p className="text-sm font-semibold capitalize mb-1">
                      {systemHealth.apiStatus?.convex?.status || 'error'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {systemHealth.apiStatus?.convex?.status === 'connected' 
                        ? `Response: ${systemHealth.apiStatus?.convex?.responseTime || 0}ms`
                        : 'Database connection issue'}
                    </p>
                  </div>
                </div>
                
                {/* Last Updated */}
                <div className="mt-4 text-center">
                  <p className="text-xs text-muted-foreground">
                    Last checked: {format(new Date(systemHealth.timestamp), 'h:mm:ss a')}
                  </p>
                </div>
              </>
            ) : (
              <p className="text-center text-muted-foreground">Unable to fetch system health</p>
            )}
          </CardContent>
        </Card>

        {/* Activity Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Activity Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTimeframe} onValueChange={(v) => setActiveTimeframe(v as any)}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="today">Today</TabsTrigger>
                <TabsTrigger value="week">This Week</TabsTrigger>
                <TabsTrigger value="month">This Month</TabsTrigger>
              </TabsList>
              
              {summaryLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : timeframeData ? (
                <div className="mt-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <p className="text-sm text-muted-foreground">BOQs Processed</p>
                      <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        {timeframeData.jobs?.total || 0}
                      </p>
                    </div>
                    <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <p className="text-sm text-muted-foreground">Completed</p>
                      <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                        {timeframeData.jobs?.completed || 0}
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total Matches</span>
                      <span className="font-medium">{timeframeData.matches || 0}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Activities</span>
                      <span className="font-medium">{timeframeData.activities || 0}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Price Items Added</span>
                      <span className="font-medium">{timeframeData.priceItemsAdded || 0}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-center text-muted-foreground mt-4">No data available</p>
              )}
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Recent Jobs & Activities */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent BOQ Processing */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent BOQ Processing</CardTitle>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => navigate('/projects')}
              className="gap-1"
            >
              View All
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {jobsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : recentJobs && recentJobs.length > 0 ? (
              <div className="space-y-3">
                {recentJobs.map((job) => (
                  <div
                    key={job._id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(job.status)}
                        <h4 className="font-medium text-sm truncate">{job.fileName}</h4>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                        <span className="truncate">{job.clientName}</span>
                        <span>{job.matchedCount}/{job.itemCount} matched</span>
                        <span>{format(new Date(job.startedAt), 'MMM d, h:mm a')}</span>
                      </div>
                    </div>
                    {job.status === 'matching' || job.status === 'parsing' ? (
                      <div className="flex items-center gap-2 ml-3">
                        <Progress value={job.progress} className="w-20" />
                        <span className="text-xs font-medium w-10 text-right">{job.progress}%</span>
                      </div>
                    ) : job.totalValue ? (
                      <span className="text-sm font-medium ml-3">{formatPrice(job.totalValue)}</span>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <FileSpreadsheet className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No recent jobs</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-3"
                  onClick={() => navigate('/projects')}
                >
                  Start New Job
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activities */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Activities</CardTitle>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => navigate('/activity')}
              className="gap-1"
            >
              View All
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {activitiesLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : recentActivities && recentActivities.length > 0 ? (
              <div className="space-y-2">
                {recentActivities.map((activity) => (
                  <div key={activity._id} className="flex items-start gap-3 p-2 rounded hover:bg-muted/50">
                    <div className="mt-0.5">
                      {activity.action.includes('create') && <Plus className="h-4 w-4 text-green-500" />}
                      {activity.action.includes('update') && <FileText className="h-4 w-4 text-blue-500" />}
                      {activity.action.includes('delete') && <XCircle className="h-4 w-4 text-red-500" />}
                      {activity.action.includes('complete') && <CheckCircle className="h-4 w-4 text-green-500" />}
                      {!activity.action.includes('create') && 
                       !activity.action.includes('update') && 
                       !activity.action.includes('delete') && 
                       !activity.action.includes('complete') && 
                       <Activity className="h-4 w-4 text-gray-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{activity.action}</p>
                      <p className="text-xs text-muted-foreground">
                        {activity.userName || 'Unknown User'} • {activity.entityType} • {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                      </p>
                      {activity.details && (
                        <p className="text-xs text-muted-foreground mt-1 truncate">{activity.details}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No recent activities</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Button
              variant="outline"
              className="h-auto py-4 flex-col gap-2"
              onClick={() => navigate('/price-matching')}
            >
              <FileSpreadsheet className="h-5 w-5" />
              <span className="text-xs">New BOQ</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-4 flex-col gap-2"
              onClick={() => navigate('/price-list')}
            >
              <Package className="h-5 w-5" />
              <span className="text-xs">Price List</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-4 flex-col gap-2"
              onClick={() => navigate('/clients')}
            >
              <Building2 className="h-5 w-5" />
              <span className="text-xs">Clients</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-4 flex-col gap-2"
              onClick={() => navigate('/projects')}
            >
              <FolderOpen className="h-5 w-5" />
              <span className="text-xs">Projects</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}