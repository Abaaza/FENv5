import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { 
  Activity as ActivityIcon,
  Calendar,
  FileText,
  Plus,
  Edit,
  Trash,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  Filter,
  TrendingUp,
  TrendingDown,
  Loader2,
  Download,
  Eye,
  Building2,
  Package,
  FolderOpen,
  RefreshCw
} from 'lucide-react';
import { api } from '../lib/api';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays } from 'date-fns';
import { cn } from '../lib/utils';
import { useCurrency } from '../hooks/useCurrency';

interface ActivityLog {
  _id: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  action: string;
  entityType: string;
  entityId?: string;
  details?: string;
  timestamp: number;
  ipAddress?: string;
  userAgent?: string;
}

interface ActivityStats {
  totalActivities: number;
  todayActivities: number;
  weekActivities: number;
  monthActivities: number;
  topActions: { action: string; count: number }[];
  topEntities: { entity: string; count: number }[];
}

export default function Activity() {
  const { formatPrice } = useCurrency();
  const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month' | 'all'>('week');
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>('all');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  // Calculate date ranges
  const getDateRange = () => {
    const now = new Date();
    switch (timeRange) {
      case 'today':
        return { start: startOfDay(now), end: endOfDay(now) };
      case 'week':
        return { start: startOfWeek(now), end: endOfWeek(now) };
      case 'month':
        return { start: startOfMonth(now), end: endOfMonth(now) };
      default:
        return { start: new Date(0), end: now };
    }
  };

  const { start, end } = getDateRange();

  // Fetch activities
  const { data: activities, isLoading, refetch } = useQuery<ActivityLog[]>({
    queryKey: ['all-activities', timeRange],
    queryFn: async () => {
      const response = await api.get('/dashboard/activity', {
        params: {
          limit: 1000,
          startDate: start.getTime(),
          endDate: end.getTime()
        }
      });
      return response.data;
    },
  });

  // Fetch activity stats
  const { data: stats } = useQuery<ActivityStats>({
    queryKey: ['activity-stats'],
    queryFn: async () => {
      const response = await api.get('/dashboard/activity-stats');
      return response.data;
    },
  });

  // Filter activities
  const filteredActivities = (activities || []).filter(activity => {
    const matchesEntity = entityTypeFilter === 'all' || activity.entityType === entityTypeFilter;
    const matchesAction = actionFilter === 'all' || activity.action.includes(actionFilter);
    const matchesSearch = !searchTerm || 
      activity.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      activity.details?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      activity.entityType.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesEntity && matchesAction && matchesSearch;
  });

  // Paginate activities
  const totalPages = Math.ceil(filteredActivities.length / itemsPerPage);
  const paginatedActivities = filteredActivities.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Get unique entity types and actions for filters
  const entityTypes = [...new Set(activities?.map(a => a.entityType) || [])];
  const actionTypes = [...new Set(activities?.map(a => {
    if (a.action.includes('create')) return 'create';
    if (a.action.includes('update')) return 'update';
    if (a.action.includes('delete')) return 'delete';
    if (a.action.includes('complete')) return 'complete';
    if (a.action.includes('approve')) return 'approve';
    return 'other';
  }) || [])];

  const getActionIcon = (action: string) => {
    if (action.includes('create')) return <Plus className="h-4 w-4 text-green-500" />;
    if (action.includes('update')) return <Edit className="h-4 w-4 text-blue-500" />;
    if (action.includes('delete')) return <Trash className="h-4 w-4 text-red-500" />;
    if (action.includes('complete')) return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (action.includes('fail')) return <XCircle className="h-4 w-4 text-red-500" />;
    if (action.includes('start')) return <Clock className="h-4 w-4 text-yellow-500" />;
    if (action.includes('view')) return <Eye className="h-4 w-4 text-gray-500" />;
    return <ActivityIcon className="h-4 w-4 text-gray-500" />;
  };

  const getEntityIcon = (entityType: string) => {
    switch (entityType.toLowerCase()) {
      case 'client':
      case 'clients':
        return <Building2 className="h-4 w-4" />;
      case 'priceitems':
      case 'price_items':
        return <Package className="h-4 w-4" />;
      case 'project':
      case 'projects':
      case 'aimatchingjobs':
        return <FolderOpen className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const exportActivities = () => {
    const csvContent = [
      ['Timestamp', 'User', 'Action', 'Entity Type', 'Details', 'IP Address'].join(','),
      ...filteredActivities.map(activity => [
        format(new Date(activity.timestamp), 'yyyy-MM-dd HH:mm:ss'),
        activity.userName || 'Unknown User',
        activity.action,
        activity.entityType,
        activity.details || '',
        activity.ipAddress || ''
      ].map(field => `"${field}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `activities-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={exportActivities}
            disabled={!filteredActivities.length}
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Activities</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalActivities}</div>
              <p className="text-xs text-muted-foreground">All time</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Today</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.todayActivities}</div>
              <p className="text-xs text-muted-foreground">Since midnight</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">This Week</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.weekActivities}</div>
              <p className="text-xs text-muted-foreground">Last 7 days</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">This Month</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.monthActivities}</div>
              <p className="text-xs text-muted-foreground">Last 30 days</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Time Range</label>
              <Select value={timeRange} onValueChange={(value: any) => {
                setTimeRange(value);
                setCurrentPage(1);
              }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                  <SelectItem value="all">All Time</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Entity Type</label>
              <Select value={entityTypeFilter} onValueChange={(value) => {
                setEntityTypeFilter(value);
                setCurrentPage(1);
              }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {entityTypes.map(type => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Action</label>
              <Select value={actionFilter} onValueChange={(value) => {
                setActionFilter(value);
                setCurrentPage(1);
              }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  {actionTypes.map(type => (
                    <SelectItem key={type} value={type}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search activities..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-9"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Activities List */}
      <Card>
        <CardHeader>
          <CardTitle>
            Activities ({filteredActivities.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : paginatedActivities.length > 0 ? (
            <>
              <div className="space-y-2">
                {paginatedActivities.map((activity) => (
                  <div
                    key={activity._id}
                    className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-2 mt-0.5">
                      {getActionIcon(activity.action)}
                      {getEntityIcon(activity.entityType)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">{activity.action}</p>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(activity.timestamp), 'MMM d, yyyy h:mm a')}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        By: {activity.userName || 'Unknown User'} • {activity.entityType}
                        {activity.entityId && ` • ID: ${activity.entityId}`}
                      </p>
                      {activity.details && (
                        <p className="text-sm mt-1">{activity.details}</p>
                      )}
                      {activity.ipAddress && (
                        <p className="text-xs text-muted-foreground mt-1">
                          IP: {activity.ipAddress}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-6 flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredActivities.length)} of {filteredActivities.length} activities
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                    >
                      First
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(currentPage - 1)}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    <span className="flex items-center px-3 text-sm">
                      Page {currentPage} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage === totalPages}
                    >
                      Last
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8">
              <ActivityIcon className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No activities found</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}