import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { Upload, FileSpreadsheet, Play, Download, RefreshCw, Search, StopCircle } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { api } from '../lib/api';
import { cn } from '../lib/utils';
import { JobLogs } from '../components/JobLogs';
import { useJobPolling } from '../hooks/useJobPolling';

interface UploadResponse {
  jobId: string;
  fileName: string;
  itemCount: number;
  headers: string[];
  items: any[];
  startTime?: number;
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

type MatchingMethod = 'LOCAL' | 'COHERE' | 'OPENAI';

const matchingMethods = [
  { value: 'LOCAL', label: 'Local Matching', description: 'Fast fuzzy string matching' },
  { value: 'COHERE', label: 'Cohere AI', description: 'Neural embeddings with Cohere' },
  { value: 'OPENAI', label: 'OpenAI', description: 'GPT embeddings' },
];

export default function PriceMatching() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedJob, setUploadedJob] = useState<UploadResponse | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<MatchingMethod>('LOCAL');
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const { connected, jobProgress, jobLogs, subscribeToJob, unsubscribeFromJob } = useJobPolling();

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await api.post('/price-matching/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    },
    onSuccess: (data) => {
      console.log('[PriceMatching] Upload successful:', data);
      setUploadedJob(data);
      toast.success(`File uploaded: ${data.itemCount} items found`);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Upload failed');
    },
  });

  // Start matching mutation
  const startMatchingMutation = useMutation({
    mutationFn: async ({ jobId, method }: { jobId: string; method: MatchingMethod }) => {
      const response = await api.post(`/price-matching/${jobId}/start`, {
        matchingMethod: method,
      });
      return response.data;
    },
    onSuccess: (data) => {
      console.log('[PriceMatching] Matching started successfully:', data);
      setCurrentJobId(data.jobId);
      toast.success('Matching started');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to start matching');
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

  // Job status query
  const { data: jobStatus, refetch: refetchStatus } = useQuery<JobStatus>({
    queryKey: ['job-status', currentJobId],
    queryFn: async () => {
      if (!currentJobId) throw new Error('No job ID');
      const response = await api.get(`/price-matching/${currentJobId}/status`);
      return response.data;
    },
    enabled: !!currentJobId,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.status === 'completed' || data?.status === 'failed') {
        return false;
      }
      return 1000; // Poll every second while in progress
    },
  });
  
  // Subscribe to job updates
  useEffect(() => {
    if (currentJobId && connected) {
      console.log('[PriceMatching] Subscribing to job updates:', currentJobId);
      subscribeToJob(currentJobId);
      return () => {
        console.log('[PriceMatching] Unsubscribing from job updates:', currentJobId);
        unsubscribeFromJob(currentJobId);
      };
    }
  }, [currentJobId, connected, subscribeToJob, unsubscribeFromJob]);
  
  // Get logs for current job
  const currentJobLogs = currentJobId ? jobLogs[currentJobId] || [] : [];
  const currentJobProgress = currentJobId ? jobProgress[currentJobId] : null;
  
  // Merge progress data
  const mergedJobStatus = currentJobProgress ? {
    ...jobStatus,
    ...currentJobProgress,
  } : jobStatus;

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setUploadedJob(null);
      setCurrentJobId(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    
    console.log('[PriceMatching] Starting file upload:', selectedFile.name);
    const formData = new FormData();
    formData.append('file', selectedFile);
    
    uploadMutation.mutate(formData);
  };

  const handleStartMatching = () => {
    if (!uploadedJob) return;
    
    console.log('[PriceMatching] Starting matching job:', {
      jobId: uploadedJob.jobId,
      method: selectedMethod,
      itemCount: uploadedJob.itemCount
    });
    
    startMatchingMutation.mutate({
      jobId: uploadedJob.jobId,
      method: selectedMethod,
    });
  };

  const handleDownloadResults = () => {
    if (!currentJobId) return;
    
    window.open(`${api.defaults.baseURL}/price-matching/${currentJobId}/export`, '_blank');
  };

  const handleStopJob = () => {
    if (!currentJobId || !window.confirm('Are you sure you want to stop this job?')) return;
    
    stopJobMutation.mutate(currentJobId);
  };

  const getProgressColor = (progress: number) => {
    if (progress < 30) return 'bg-red-500';
    if (progress < 60) return 'bg-yellow-500';
    if (progress < 90) return 'bg-blue-500';
    return 'bg-green-500';
  };

  return (
    <div className="space-y-6">

      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle>Upload BOQ File</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-gray-400 transition-colors"
            >
              <FileSpreadsheet className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-2 text-sm text-gray-600">
                {selectedFile ? selectedFile.name : 'Click to select Excel file (.xlsx, .xls)'}
              </p>
              <p className="text-xs text-gray-500 mt-1">Max file size: 50MB</p>
            </div>
            
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileSelect}
              className="hidden"
            />

            <Button
              onClick={handleUpload}
              disabled={!selectedFile || uploadMutation.isPending}
              className="w-full"
            >
              <Upload className="mr-2 h-4 w-4" />
              {uploadMutation.isPending ? 'Uploading...' : 'Upload File'}
            </Button>
          </div>

          {/* Upload Preview */}
          {uploadedJob && (
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium mb-2">File uploaded successfully!</h4>
              <div className="space-y-1 text-sm">
                <p><span className="font-medium">File:</span> {uploadedJob.fileName}</p>
                <p><span className="font-medium">Items found:</span> {uploadedJob.itemCount}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Matching Method Selection */}
      {uploadedJob && !currentJobId && (
        <Card>
          <CardHeader>
            <CardTitle>Select Matching Method</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {matchingMethods.map((method) => (
                <label
                  key={method.value}
                  className={cn(
                    'flex items-center p-4 border rounded-lg cursor-pointer transition-colors',
                    selectedMethod === method.value
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  )}
                >
                  <input
                    type="radio"
                    name="matchingMethod"
                    value={method.value}
                    checked={selectedMethod === method.value}
                    onChange={(e) => setSelectedMethod(e.target.value as MatchingMethod)}
                    className="mr-3"
                  />
                  <div>
                    <p className="font-medium">{method.label}</p>
                    <p className="text-sm text-gray-500">{method.description}</p>
                  </div>
                </label>
              ))}
            </div>

            <Button
              onClick={handleStartMatching}
              disabled={startMatchingMutation.isPending}
              className="w-full mt-4"
            >
              <Play className="mr-2 h-4 w-4" />
              {startMatchingMutation.isPending ? 'Starting...' : 'Start Matching'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Progress Section */}
      {currentJobId && jobStatus && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Matching Progress</span>
              <div className="flex gap-2">
                {jobStatus.status !== 'completed' && jobStatus.status !== 'failed' && (
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
                    {mergedJobStatus?.progressMessage || jobStatus.progressMessage || 'Processing...'}
                  </span>
                  <span className="text-sm font-medium">{mergedJobStatus?.progress || jobStatus.progress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className={cn(
                      'h-3 rounded-full transition-all duration-500',
                      getProgressColor(jobStatus.progress)
                    )}
                    style={{ width: `${mergedJobStatus?.progress || jobStatus.progress}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Status</p>
                  <p className="font-medium capitalize">{mergedJobStatus?.status || jobStatus.status}</p>
                </div>
                <div>
                  <p className="text-gray-500">Items Matched</p>
                  <p className="font-medium">
                    {mergedJobStatus?.matchedCount || jobStatus.matchedCount} / {mergedJobStatus?.itemCount || jobStatus.itemCount}
                  </p>
                </div>
              </div>

              {jobStatus.error && (
                <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                  {jobStatus.error}
                </div>
              )}

              {jobStatus.status === 'completed' && (
                <div className="flex gap-3">
                  <Button
                    onClick={() => window.location.href = `/projects?jobId=${currentJobId}`}
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
      {currentJobId && jobStatus && (
        <JobLogs
          logs={currentJobLogs.map(log => ({ 
            ...log, 
            jobId: currentJobId,
            timestamp: new Date(log.timestamp).toISOString() 
          }))}
          title="Processing Logs"
          jobStatus={mergedJobStatus?.status || jobStatus.status}
          startTime={jobStatus.startedAt || Date.now()}
          matchingMethod={selectedMethod}
        />
      )}
    </div>
  );
}