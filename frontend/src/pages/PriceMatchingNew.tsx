import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { FileSpreadsheet, Play, Download, RefreshCw, StopCircle, Plus, Wifi, WifiOff, Terminal } from 'lucide-react';
import { Search } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { api } from '../lib/api';
import { cn } from '../lib/utils';
import { useConvex } from 'convex/react';
import { api as convexApi } from '../../convex/_generated/api';
import { useAuthStore } from '../stores/auth.store';
import { ClientSearch } from '../components/ClientSearch';
import { Textarea } from '../components/ui/textarea';
import { useJobPolling } from '../hooks/useJobPolling';
import { useJobLogs } from '../hooks/useJobLogs';
import { JobLogs } from '../components/JobLogs';

interface UploadFormData {
  clientId: string;
  clientName: string;
  projectName: string;
  matchingMethod: MatchingMethod;
  file: File | null;
}

interface JobStatus {
  _id: string;
  status: string;
  progress: number;
  progressMessage?: string;
  itemCount: number;
  matchedCount: number;
  error?: string;
  startedAt?: number;
}

type MatchingMethod = 'LOCAL' | 'V2' | 'V1';

const matchingMethods = [
  { value: 'LOCAL', label: 'Local Matching', description: 'Fast fuzzy string matching' },
  { value: 'V2', label: 'V2', description: 'Neural semantic matching' },
  { value: 'V1', label: 'V1', description: 'GPT-powered matching' },
];

export default function PriceMatchingNew() {
  const convex = useConvex();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuthStore();
  const { connected, jobProgress, subscribeToJob, unsubscribeFromJob } = useJobPolling();
  const { jobLogs, subscribeToJobLogs, unsubscribeFromJobLogs } = useJobLogs();
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [showNewClientDialog, setShowNewClientDialog] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [newClientData, setNewClientData] = useState({
    name: '',
    email: '',
    phone: '',
    contactPerson: '',
    notes: ''
  });
  const [formData, setFormData] = useState<UploadFormData>({
    clientId: '',
    clientName: '',
    projectName: '',
    matchingMethod: 'LOCAL',
    file: null,
  });

  // Fetch clients
  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const response = await api.get('/clients');
      return response.data;
    },
  });

  // Subscribe to job updates and logs for current job
  useEffect(() => {
    if (currentJobId) {
      subscribeToJob(currentJobId);
      subscribeToJobLogs(currentJobId);
      return () => {
        unsubscribeFromJob(currentJobId);
        unsubscribeFromJobLogs(currentJobId);
      };
    }
  }, [currentJobId, subscribeToJob, unsubscribeFromJob, subscribeToJobLogs, unsubscribeFromJobLogs]);

  // Get current job logs from the hook
  const currentJobLogs = currentJobId ? (jobLogs[currentJobId] || []) : [];

  // Create client mutation
  const createClientMutation = useMutation({
    mutationFn: async (clientData: { name: string; email?: string; phone?: string; contactPerson?: string; notes?: string }) => {
      const response = await api.post('/clients', clientData);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      setFormData(prev => ({ ...prev, clientId: data._id, clientName: data.name }));
      setShowNewClientDialog(false);
      setNewClientData({ name: '', email: '', phone: '', contactPerson: '', notes: '' });
      toast.success('Client created successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to create client');
    },
  });

  // Upload and start matching mutation
  const uploadAndMatchMutation = useMutation({
    mutationFn: async () => {
      if (!formData.file || !formData.projectName) {
        throw new Error('Please fill all required fields');
      }

      let clientId = formData.clientId;
      
      // If no clientId but we have a client name, create the client first
      if (!clientId && formData.clientName.trim()) {
        const existingClient = clients.find((c: any) => c.name.toLowerCase() === formData.clientName.toLowerCase());
        if (existingClient) {
          clientId = existingClient._id;
        } else {
          // Create new client using API
          const clientResponse = await api.post('/clients', {
            name: formData.clientName.trim(),
          });
          clientId = clientResponse.data._id;
        }
      }
      
      if (!clientId) {
        throw new Error('Please select or enter a client name');
      }

      const uploadData = new FormData();
      uploadData.append('file', formData.file);
      uploadData.append('clientId', clientId);
      uploadData.append('projectName', formData.projectName);
      uploadData.append('matchingMethod', formData.matchingMethod);
      
      const response = await api.post('/price-matching/upload-and-match', uploadData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    },
    onSuccess: (data) => {
      setCurrentJobId(data.jobId);
      setShowLogs(true); // Automatically show logs when job starts
      toast.success('Matching job started - Timer started at 00:00');
      
      // Create project in Convex
      // TODO: Fix this - convex.mutation is not working
      // convex.mutation(convexApi.projects.create, {
      //   name: formData.projectName,
      //   clientId: formData.clientId as any,
      //   description: `BOQ matching job: ${data.fileName}`,
      //   status: 'active',
      //   userId: data.userId,
      // });
    },
    onError: (error: any) => {
      toast.error(error.message || error.response?.data?.error || 'Upload failed');
    },
  });

  // Stop job mutation
  const stopJobMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const response = await api.post(`/price-matching/${jobId}/stop`);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Job stopped');
      refetchStatus();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to stop job');
    },
  });

  // Job status query with intelligent polling
  const [pollInterval, setPollInterval] = useState(3000); // Start with 3 seconds
  const [consecutiveErrors, setConsecutiveErrors] = useState(0);
  
  const { data: jobStatus, refetch: refetchStatus } = useQuery<JobStatus>({
    queryKey: ['job-status', currentJobId],
    queryFn: async () => {
      if (!currentJobId) throw new Error('No job ID');
      try {
        const response = await api.get(`/price-matching/${currentJobId}/status`);
        setConsecutiveErrors(0); // Reset error count on success
        setPollInterval(3000); // Reset to normal interval
        return response.data;
      } catch (error: any) {
        if (error.response?.status === 429) {
          // Rate limited - increase interval with exponential backoff
          setConsecutiveErrors(prev => prev + 1);
          const newInterval = Math.min(3000 * Math.pow(2, consecutiveErrors), 30000); // Max 30 seconds
          setPollInterval(newInterval);
          console.warn(`Rate limited. Backing off to ${newInterval}ms interval`);
        }
        throw error;
      }
    },
    enabled: !!currentJobId,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.status === 'completed' || data?.status === 'failed' || data?.status === 'stopped') {
        return false;
      }
      // Use WebSocket status if connected, otherwise use polling
      return connected ? false : pollInterval;
    },
    retry: (failureCount, error: any) => {
      // Don't retry on 429 errors - let the interval handle it
      if (error.response?.status === 429) return false;
      return failureCount < 3;
    },
  });

  // Activity logs
  const { data: activityLogs = [] } = useQuery({
    queryKey: ['activity-logs', currentJobId],
    queryFn: async () => {
      if (!currentJobId) return [];
      const logs = await convex.query(convexApi.activityLogs.getByEntity, {
        entityType: 'aiMatchingJobs',
        entityId: currentJobId,
      });
      return logs;
    },
    enabled: !!currentJobId,
    refetchInterval: 2000,
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      const validTypes = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'];
      if (!validTypes.includes(file.type) && !file.name.match(/\.(xlsx|xls)$/)) {
        toast.error('Please select a valid Excel file (.xlsx or .xls)');
        return;
      }
      
      // Validate file size (50MB limit)
      if (file.size > 50 * 1024 * 1024) {
        toast.error('File size must be less than 50MB');
        return;
      }
      
      setFormData(prev => ({ ...prev, file }));
    }
  };

  const handleSubmit = async () => {
    uploadAndMatchMutation.mutate();
  };

  const handleStopJob = () => {
    if (!currentJobId || !window.confirm('Are you sure you want to stop this job?')) return;
    stopJobMutation.mutate(currentJobId);
  };

  const handleDownloadResults = async () => {
    if (!currentJobId) return;
    
    try {
      const response = await api.get(`/price-matching/${currentJobId}/export`, {
        responseType: 'blob'
      });
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `matched_results_${currentJobId}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success('Excel file downloaded successfully');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to download results');
    }
  };

  const getProgressColor = (progress: number) => {
    if (progress < 30) return 'bg-red-500';
    if (progress < 60) return 'bg-yellow-500';
    if (progress < 90) return 'bg-blue-500';
    return 'bg-green-500';
  };

  return (
    <div className="space-y-6">

      {/* Upload Form */}
      <Card>
        <CardHeader>
          <CardTitle>New Price Matching Job</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Client Selection */}
            <div>
              <Label htmlFor="client">Client</Label>
              <ClientSearch
                value={formData.clientName}
                clients={clients}
                disabled={!!currentJobId && jobStatus?.status !== 'completed' && jobStatus?.status !== 'failed'}
                onSelect={(client) => {
                    if (client) {
                      setFormData(prev => ({
                        ...prev,
                        clientId: client._id,
                        clientName: client.name
                      }));
                    } else {
                      setFormData(prev => ({
                        ...prev,
                        clientId: '',
                        clientName: ''
                      }));
                    }
                  }}
                  onInputChange={(value) => {
                    setFormData(prev => ({ ...prev, clientName: value }));
                  }}
                  onCreateNew={() => {
                    setNewClientData(prev => ({ ...prev, name: formData.clientName }));
                    setShowNewClientDialog(true);
                  }}
                  placeholder="Search or create client..."
                />
              </div>

              {/* Project Name */}
              <div>
                <Label htmlFor="projectName">Project Name</Label>
                <Input
                  id="projectName"
                  value={formData.projectName}
                  onChange={(e) => setFormData(prev => ({ ...prev, projectName: e.target.value }))}
                  placeholder="Enter project name"
                  disabled={!!currentJobId && jobStatus?.status !== 'completed' && jobStatus?.status !== 'failed'}
                />
              </div>

              {/* Matching Method */}
              <div>
                <Label htmlFor="matchingMethod">Matching Method</Label>
                <Select
                  value={formData.matchingMethod}
                  onValueChange={(value) => setFormData(prev => ({ 
                    ...prev, 
                    matchingMethod: value as MatchingMethod 
                  }))}
                  disabled={!!currentJobId && jobStatus?.status !== 'completed' && jobStatus?.status !== 'failed'}
                >
                  <SelectTrigger id="matchingMethod" className="w-full">
                    <SelectValue placeholder="Select matching method" />
                  </SelectTrigger>
                  <SelectContent>
                    {matchingMethods.map((method) => (
                      <SelectItem key={method.value} value={method.value}>
                        <div className="flex flex-col">
                          <span className="font-medium">{method.label}</span>
                          <span className="text-xs text-muted-foreground">{method.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* File Upload */}
              <div>
                <Label>BOQ File</Label>
                <div
                  onClick={() => {
                    if (!currentJobId || jobStatus?.status === 'completed' || jobStatus?.status === 'failed') {
                      fileInputRef.current?.click();
                    }
                  }}
                  className={cn(
                    "mt-2 border-2 border-dashed border-gray-300 rounded-lg p-6 text-center transition-colors",
                    (!!currentJobId && jobStatus?.status !== 'completed' && jobStatus?.status !== 'failed') 
                      ? "cursor-not-allowed opacity-50" 
                      : "cursor-pointer hover:border-gray-400"
                  )}
                >
                  <FileSpreadsheet className="mx-auto h-12 w-12 text-gray-400" />
                  <p className="mt-2 text-sm text-gray-600">
                    {formData.file ? formData.file.name : 'Click to select Excel file (.xlsx, .xls)'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Max file size: 50MB</p>
                </div>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>

              <Button
                onClick={handleSubmit}
                disabled={
                  !formData.file || 
                  (!formData.clientId && !formData.clientName.trim()) || 
                  !formData.projectName || 
                  uploadAndMatchMutation.isPending ||
                  (!!currentJobId && jobStatus?.status !== 'completed' && jobStatus?.status !== 'failed')
                }
                className="w-full"
              >
                <Play className="mr-2 h-4 w-4" />
                {uploadAndMatchMutation.isPending ? 'Starting...' : 
                 (currentJobId && jobStatus?.status !== 'completed' && jobStatus?.status !== 'failed') ? 'Job in Progress...' : 
                 'Start Price Matching'}
              </Button>
            </div>
          </CardContent>
        </Card>

      {/* Progress Section */}
      {currentJobId && (jobStatus || jobProgress[currentJobId]) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                Matching Progress
                {connected ? (
                  <Wifi className="h-4 w-4 text-green-500" />
                ) : (
                  <WifiOff className="h-4 w-4 text-red-500" />
                )}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowLogs(!showLogs)}
                >
                  <Terminal className="h-4 w-4 mr-1" />
                  {showLogs ? 'Hide' : 'Show'} Logs
                </Button>
                {jobStatus?.status !== 'completed' && jobStatus?.status !== 'failed' && jobStatus?.status !== 'stopped' && 
                 jobProgress[currentJobId]?.status !== 'completed' && jobProgress[currentJobId]?.status !== 'failed' && jobProgress[currentJobId]?.status !== 'stopped' && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => refetchStatus()}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={handleStopJob}
                      disabled={stopJobMutation.isPending}
                    >
                      <StopCircle className="h-4 w-4 mr-1" />
                      Stop
                    </Button>
                  </>
                )}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium">
                    {jobProgress[currentJobId]?.progressMessage || jobStatus?.progressMessage || 'Processing...'}
                  </span>
                  <span className="text-sm font-medium">{jobProgress[currentJobId]?.progress || jobStatus?.progress || 0}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className={cn(
                      'h-3 rounded-full transition-all duration-500',
                      getProgressColor(jobProgress[currentJobId]?.progress || jobStatus?.progress || 0)
                    )}
                    style={{ width: `${jobProgress[currentJobId]?.progress || jobStatus?.progress || 0}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Status</p>
                  <p className="font-medium capitalize">{jobProgress[currentJobId]?.status || jobStatus?.status || 'pending'}</p>
                </div>
                <div>
                  <p className="text-gray-500">Items Matched</p>
                  <p className="font-medium">
                    {jobProgress[currentJobId]?.matchedCount || jobStatus?.matchedCount || 0} / {jobProgress[currentJobId]?.itemCount || jobStatus?.itemCount || 0}
                  </p>
                </div>
              </div>

              {jobStatus?.error && (
                <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                  {jobStatus.error}
                </div>
              )}

              {(jobStatus?.status === 'completed' || jobProgress[currentJobId]?.status === 'completed') && (
                <div className="flex gap-3">
                  <Button
                    onClick={() => window.location.href = `/projects#${currentJobId}`}
                    className="flex-1"
                  >
                    <Search className="mr-2 h-4 w-4" />
                    View Results
                  </Button>
                  <Button
                    onClick={handleDownloadResults}
                    variant="outline"
                    className="flex-1"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download Excel
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Job Logs */}
      {currentJobId && showLogs && (
        <JobLogs 
          logs={currentJobLogs.map((log: any) => ({
            jobId: currentJobId,
            level: log.level,
            message: log.message,
            timestamp: log.timestamp
          }))} 
          title="Processing Logs" 
          className="mt-4"
          jobStatus={jobStatus?.status || jobProgress[currentJobId]?.status}
          startTime={jobStatus?.startedAt}
          matchingMethod={formData.matchingMethod}
        />
      )}

      {/* Activity Logs */}
      {currentJobId && activityLogs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Activity Logs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {activityLogs.map((log) => (
                <div key={log._id} className="text-sm border-l-2 border-gray-200 pl-3 py-1">
                  <p className="font-medium">{log.action}</p>
                  {log.details && <p className="text-gray-500">{log.details}</p>}
                  <p className="text-xs text-gray-400">
                    {new Date(log.timestamp).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* New Client Dialog */}
      <Dialog open={showNewClientDialog} onOpenChange={setShowNewClientDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Client</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="new-client-name">Client Name *</Label>
              <Input
                id="new-client-name"
                value={newClientData.name || formData.clientName}
                onChange={(e) => setNewClientData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter client name"
              />
            </div>
            <div>
              <Label htmlFor="new-client-contact">Contact Person</Label>
              <Input
                id="new-client-contact"
                value={newClientData.contactPerson}
                onChange={(e) => setNewClientData(prev => ({ ...prev, contactPerson: e.target.value }))}
                placeholder="Enter contact person name"
              />
            </div>
            <div>
              <Label htmlFor="new-client-email">Email</Label>
              <Input
                id="new-client-email"
                type="email"
                value={newClientData.email}
                onChange={(e) => setNewClientData(prev => ({ ...prev, email: e.target.value }))}
                placeholder="Enter email address"
              />
            </div>
            <div>
              <Label htmlFor="new-client-phone">Phone</Label>
              <Input
                id="new-client-phone"
                value={newClientData.phone}
                onChange={(e) => setNewClientData(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="Enter phone number"
              />
            </div>
            <div>
              <Label htmlFor="new-client-notes">Notes</Label>
              <Textarea
                id="new-client-notes"
                value={newClientData.notes}
                onChange={(e) => setNewClientData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Additional notes"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowNewClientDialog(false);
              setNewClientData({ name: '', email: '', phone: '', contactPerson: '', notes: '' });
            }}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                const dataToSubmit = { ...newClientData };
                if (!dataToSubmit.name && formData.clientName) {
                  dataToSubmit.name = formData.clientName;
                }
                if (dataToSubmit.name) {
                  createClientMutation.mutate(dataToSubmit);
                } else {
                  toast.error('Client name is required');
                }
              }}
              disabled={createClientMutation.isPending}
            >
              Create Client
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}