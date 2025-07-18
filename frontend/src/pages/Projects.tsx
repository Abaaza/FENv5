import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { useSearchParams } from 'react-router-dom';
import { 
  FileSpreadsheet, 
  Download, 
  Edit, 
  Save, 
  X, 
  Search,
  StopCircle,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Clock,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Edit2,
  Wifi,
  WifiOff,
  Terminal,
  Percent,
  Loader2
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { api } from '../lib/api';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { ManualMatchModal } from '../components/ManualMatchModal';
import { DiscountMarkupModal } from '../components/DiscountMarkupModal';
import { AIMatchResultsModal } from '../components/AIMatchResultsModal';
import { LocalMatchResultsModal } from '../components/LocalMatchResultsModal';
import { useCurrency } from '../hooks/useCurrency';
import { queryKeys, getRefetchInterval } from '../lib/query-config';
import { useDebouncedCallback } from '../hooks/useDebounce';
import { useJobPolling } from '../hooks/useJobPolling';
import { JobLogs } from '../components/JobLogs';
import { JobStatusIndicator } from '../components/JobStatusIndicator';
import { QueuePosition } from '../components/QueuePosition';

interface Job {
  _id: string;
  fileName: string;
  status: string;
  progress: number;
  progressMessage?: string;
  itemCount: number;
  matchedCount: number;
  clientName: string;
  startedAt: number;
  completedAt?: number;
  matchingMethod: string;
  totalValue?: number;
  headers?: string[];
  sheetName?: string;
}

interface MatchResult {
  _id: string;
  jobId: string;
  rowNumber: number;
  originalDescription: string;
  originalQuantity?: number;
  originalUnit?: string;
  contextHeaders?: string[];
  matchedItemId?: string;
  matchedDescription?: string;
  matchedCode?: string;
  matchedUnit?: string;
  matchedRate?: number;
  confidence: number;
  matchMethod: string;
  isManuallyEdited: boolean;
  totalPrice?: number;
  notes?: string;
}

export default function Projects() {
  const { formatPrice } = useCurrency();
  const { connected, jobProgress, jobLogs, subscribeToJob, unsubscribeFromJob } = useJobPolling();
  const [searchParams] = useSearchParams();
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [editingResultId, setEditingResultId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<MatchResult>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedResult, setSelectedResult] = useState<MatchResult | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedMatchTypes, setSelectedMatchTypes] = useState<{ [key: string]: 'AI' | 'LOCAL' | 'MANUAL' }>({});
  const [showResultsModal, setShowResultsModal] = useState(false);
  
  // Separate match result storage for each type
  const [aiMatchResults, setAiMatchResults] = useState<{ [key: string]: {
    matchedDescription: string;
    matchedCode?: string;
    matchedUnit?: string;
    matchedRate: number;
    confidence: number;
    matchMethod: string;
    totalPrice?: number;
  } }>({});
  
  const [localMatchResults, setLocalMatchResults] = useState<{ [key: string]: {
    matchedDescription: string;
    matchedCode?: string;
    matchedUnit?: string;
    matchedRate: number;
    confidence: number;
    totalPrice?: number;
  } }>({});
  
  const [manualMatchResults, setManualMatchResults] = useState<{ [key: string]: {
    matchedDescription: string;
    matchedCode?: string;
    matchedUnit?: string;
    matchedRate: number;
    totalPrice?: number;
  } }>({});
  const [showLogs, setShowLogs] = useState(false);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [discountType, setDiscountType] = useState<'discount' | 'markup'>('discount');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [runningLocalTests, setRunningLocalTests] = useState<{ [key: string]: boolean }>({});
  const [localTestResults, setLocalTestResults] = useState<{ [key: string]: any }>({});
  const jobsPerPage = 8;
  
  // Check if we came from price-matching page with a jobId
  const urlJobId = searchParams.get('jobId');
  
  useEffect(() => {
    if (urlJobId && !selectedJobId) {
      // Opening job from URL
      setSelectedJobId(urlJobId);
      setShowResultsModal(true);
    }
  }, [urlJobId]);

  // Check URL hash for job ID on mount
  useEffect(() => {
    const hash = window.location.hash.substring(1);
    if (hash) {
      setSelectedJobId(hash);
      // Clear the hash
      window.location.hash = '';
    }
  }, []);

  // Fetch all jobs
  const { data: jobs, isLoading: jobsLoading, refetch: refetchJobs } = useQuery<Job[]>({
    queryKey: queryKeys.jobs,
    queryFn: async () => {
      const response = await api.get('/price-matching/jobs');
      return response.data;
    },
    staleTime: 30 * 1000, // 30 seconds
  });

  // Subscribe to WebSocket updates for selected job
  useEffect(() => {
    if (selectedJobId) {
      // Subscribing to job
      subscribeToJob(selectedJobId);
      return () => {
        // Unsubscribing from job
        unsubscribeFromJob(selectedJobId);
      };
    }
  }, [selectedJobId, subscribeToJob, unsubscribeFromJob]);

  // Fetch job status for selected job
  const { data: jobStatus, refetch: refetchJobStatus } = useQuery({
    queryKey: queryKeys.jobStatus(selectedJobId || ''),
    queryFn: async () => {
      if (!selectedJobId) return null;
      const response = await api.get(`/price-matching/${selectedJobId}/status`);
      return response.data;
    },
    enabled: !!selectedJobId,
    // Always poll for job status updates since we're not using WebSocket
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      // Continue polling for a bit after completion to ensure final state is captured
      if (status === 'completed' || status === 'failed') {
        // Poll for 5 more seconds after completion
        const completedAt = query.state.dataUpdatedAt;
        const now = Date.now();
        if (now - completedAt < 5000) {
          return 1000; // Continue polling for 5 seconds
        }
        return false;
      }
      return getRefetchInterval(status);
    },
    staleTime: 0, // Always fresh for active jobs
  });

  // Fetch job logs from memory (no Convex, no 429 errors!)
  const { data: logData, isLoading: logsLoading, error: logsError } = useQuery({
    queryKey: ['jobLogs', selectedJobId],
    queryFn: async () => {
      if (!selectedJobId) return { logs: [], progress: null };
      try {
        const response = await api.get(`/jobs/${selectedJobId}/logs`);
        return response.data;
      } catch (error) {
        // Silently handle log fetch errors
        return { logs: [], progress: null };
      }
    },
    enabled: !!selectedJobId,
    refetchInterval: 10000, // Poll every 10 seconds to avoid rate limits
    staleTime: 0, // Always fresh
  });

  const dbJobLogs = logData?.logs || [];
  const memoryProgress = logData?.progress;

  // Merge WebSocket progress with job status
  // Don't override completed status with polling data
  const currentJobProgress = selectedJobId ? jobProgress[selectedJobId] : null;
  const mergedJobStatus = jobStatus && jobStatus.status === 'completed' ? 
    jobStatus : // Keep the completed status from database
    (currentJobProgress ? {
      ...jobStatus,
      ...currentJobProgress,
    } : jobStatus);

  // Get the selected job to access its matching method
  const selectedJob = jobs?.find(job => job._id === selectedJobId);
  const jobMatchingMethod = selectedJob?.matchingMethod || 'LOCAL';
  const isAIJob = jobMatchingMethod === 'V2' || jobMatchingMethod === 'V1';
  const isLocalJob = jobMatchingMethod === 'LOCAL';
  const isAIDisabled = !isAIJob; // AI is disabled for LOCAL jobs

  // Fetch match results for selected job
  const { data: results, isLoading: resultsLoading, refetch: refetchResults } = useQuery<MatchResult[]>({
    queryKey: queryKeys.matchResults(selectedJobId || ''),
    queryFn: async () => {
      if (!selectedJobId) return [];
      const response = await api.get(`/price-matching/${selectedJobId}/results`);
      return response.data;
    },
    enabled: !!selectedJobId,
    staleTime: 60 * 1000, // 1 minute - results don't change often
  });

  // Delete job mutation
  const deleteJobMutation = useMutation({
    mutationFn: async (jobId: string) => {
      await api.delete(`/price-matching/${jobId}`);
    },
    onSuccess: () => {
      toast.success('Job deleted successfully');
      refetchJobs();
      if (selectedJobId === deletedJobId) {
        setSelectedJobId(null);
      }
    },
    onError: () => {
      toast.error('Failed to delete job');
    },
  });

  // Update result mutation
  const updateResultMutation = useMutation({
    mutationFn: async ({ resultId, updates }: { resultId: string; updates: Partial<MatchResult> }) => {
      const response = await api.patch(`/price-matching/results/${resultId}`, updates);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Result updated successfully');
      refetchResults();
      setEditingResultId(null);
      setEditValues({});
    },
    onError: () => {
      toast.error('Failed to update result');
    },
  });

  // Debounced autosave mutation
  const autosaveMutation = useMutation({
    mutationFn: async ({ resultId, updates }: { resultId: string; updates: Partial<MatchResult> }) => {
      const response = await api.post(`/price-matching/results/${resultId}/autosave`, updates);
      return response.data;
    },
    onError: (error) => {
      // Autosave failed silently
    },
  });

  // Debounced autosave function
  const debouncedAutosave = useDebouncedCallback(
    (resultId: string, updates: Partial<MatchResult>) => {
      if (Object.keys(updates).length > 0) {
        autosaveMutation.mutate({ resultId, updates });
      }
    },
    2000 // 2 second delay
  );

  // Track changes for autosave
  useEffect(() => {
    if (editingResultId && editValues) {
      debouncedAutosave(editingResultId, editValues);
    }
  }, [editValues, editingResultId]);

  // Subscribe to WebSocket updates for selected job
  useEffect(() => {
    if (selectedJobId && connected) {
      subscribeToJob(selectedJobId);
      return () => {
        unsubscribeFromJob(selectedJobId);
      };
    }
  }, [selectedJobId, connected, subscribeToJob, unsubscribeFromJob]);

  // Initialize match types and store results based on their type
  useEffect(() => {
    if (results && results.length > 0) {
      const initialTypes: { [key: string]: 'AI' | 'LOCAL' | 'MANUAL' } = {};
      const aiMatches: typeof aiMatchResults = {};
      const localMatches: typeof localMatchResults = {};
      const manualMatches: typeof manualMatchResults = {};
      
      results.forEach((result: MatchResult) => {
        // For AI methods (V2/V1), always store the original AI match
        if (result.matchMethod === 'V2' || result.matchMethod === 'V1') {
          // Store the original AI match
          aiMatches[result._id] = {
            matchedDescription: result.matchedDescription || '',
            matchedCode: result.matchedCode,
            matchedUnit: result.matchedUnit,
            matchedRate: result.matchedRate || 0,
            confidence: result.confidence || 0,
            matchMethod: result.matchMethod,
            totalPrice: result.totalPrice,
          };
          
          // Determine the current display type
          if (result.isManuallyEdited) {
            // If manually edited, also store in manual
            manualMatches[result._id] = {
              matchedDescription: result.matchedDescription || '',
              matchedCode: result.matchedCode,
              matchedUnit: result.matchedUnit,
              matchedRate: result.matchedRate || 0,
              totalPrice: result.totalPrice,
            };
            initialTypes[result._id] = 'MANUAL';
          } else {
            // Default to showing AI match
            initialTypes[result._id] = isAIDisabled ? 'LOCAL' : 'AI';
          }
        } else if (result.matchMethod === 'LOCAL') {
          // For LOCAL method jobs, store as LOCAL
          localMatches[result._id] = {
            matchedDescription: result.matchedDescription || '',
            matchedCode: result.matchedCode,
            matchedUnit: result.matchedUnit,
            matchedRate: result.matchedRate || 0,
            confidence: result.confidence || 0,
            totalPrice: result.totalPrice,
          };
          
          if (result.isManuallyEdited) {
            // If manually edited, also store in manual
            manualMatches[result._id] = {
              matchedDescription: result.matchedDescription || '',
              matchedCode: result.matchedCode,
              matchedUnit: result.matchedUnit,
              matchedRate: result.matchedRate || 0,
              totalPrice: result.totalPrice,
            };
            initialTypes[result._id] = 'MANUAL';
          } else {
            initialTypes[result._id] = 'LOCAL';
          }
        }
      });
      
      setSelectedMatchTypes(initialTypes);
      setAiMatchResults(aiMatches);
      setLocalMatchResults(localMatches);
      setManualMatchResults(manualMatches);
    }
  }, [results, isAIDisabled]);

  // Stop job mutation
  const stopJobMutation = useMutation({
    mutationFn: async (jobId: string) => {
      await api.post(`/price-matching/${jobId}/stop`);
    },
    onSuccess: () => {
      toast.success('Job stopped');
      refetchJobs();
      refetchJobStatus();
    },
    onError: () => {
      toast.error('Failed to stop job');
    },
  });

  // Stop all jobs mutation
  const stopAllJobsMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post('/price-matching/stop-all');
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'All jobs stopped');
      refetchJobs();
      refetchJobStatus();
      // Unsubscribe from all job updates
      if (selectedJobId) {
        unsubscribeFromJob(selectedJobId);
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to stop all jobs');
    },
  });

  const handleStopAllJobs = async () => {
    if (confirm('Are you sure you want to stop all running jobs? This action cannot be undone.')) {
      await stopAllJobsMutation.mutateAsync();
    }
  };

  // Store previous match types for error recovery
  const previousMatchTypesRef = useRef<{ [key: string]: 'AI' | 'LOCAL' | 'MANUAL' }>({});

  // Universal match application mutation
  const applyMatchMutation = useMutation({
    mutationFn: async ({ resultId, matchType, previousType }: { resultId: string; matchType: 'AI' | 'LOCAL' | 'MANUAL'; previousType?: 'AI' | 'LOCAL' | 'MANUAL' }) => {
      let matchData;
      
      // Store previous type for error recovery
      if (previousType) {
        previousMatchTypesRef.current[resultId] = previousType;
      }
      
      // Get the appropriate match data based on type
      switch (matchType) {
        case 'AI':
          matchData = aiMatchResults[resultId];
          break;
        case 'LOCAL':
          matchData = localMatchResults[resultId];
          break;
        case 'MANUAL':
          matchData = manualMatchResults[resultId];
          break;
      }
      
      if (!matchData) {
        throw new Error(`No ${matchType} match data found for result ${resultId}`);
      }
      
      // Apply the match
      // Remove matchMethod from the update as it's not in the Convex schema
      const { matchMethod, ...updateData } = matchData as any;
      const response = await api.patch(`/price-matching/results/${resultId}`, updateData);
      return response.data;
    },
    onSuccess: (data, variables) => {
      const typeLabel = variables.matchType === 'AI' ? 'AI' : variables.matchType === 'LOCAL' ? 'Local' : 'Manual';
      toast.success(`${typeLabel} match applied successfully`);
      refetchResults();
      // Clear the stored previous type on success
      delete previousMatchTypesRef.current[variables.resultId];
    },
    onError: (error, variables) => {
      // Failed to apply match silently
      toast.error(`Failed to apply ${variables.matchType} match`);
      // Revert the match type on error
      const previousType = previousMatchTypesRef.current[variables.resultId];
      if (previousType && previousType !== variables.matchType) {
        setSelectedMatchTypes(prev => ({ ...prev, [variables.resultId]: previousType }));
      }
      // Clear the stored previous type
      delete previousMatchTypesRef.current[variables.resultId];
    },
  });

  // Instant local test mutation
  const instantLocalTestMutation = useMutation({
    mutationFn: async ({ resultId, description }: { resultId: string; description: string }) => {
      const response = await api.post(`/price-matching/test/local`, {
        description,
      });
      return response.data;
    },
    onSuccess: (data, variables) => {
      setLocalTestResults(prev => ({ ...prev, [variables.resultId]: data }));
      setRunningLocalTests(prev => ({ ...prev, [variables.resultId]: false }));
      
      // Store the local match result in our separate storage
      if (data.matches && data.matches.length > 0) {
        const match = data.matches[0];
        const result = results?.find(r => r._id === variables.resultId);
        if (result) {
          const totalPrice = (result.originalQuantity || 0) * (match.rate || 0);
          setLocalMatchResults(prev => ({ 
            ...prev, 
            [variables.resultId]: {
              matchedDescription: match.description,
              matchedCode: match.code,
              matchedUnit: match.unit,
              matchedRate: match.rate,
              confidence: match.confidence,
              totalPrice,
            }
          }));
          
          // Make sure match type is set to LOCAL before applying
          setSelectedMatchTypes(prev => ({ ...prev, [variables.resultId]: 'LOCAL' }));
          
          // Auto-apply the local test result
          applyMatchMutation.mutate({
            resultId: variables.resultId,
            matchType: 'LOCAL',
            previousType: selectedMatchTypes[variables.resultId],
          });
        }
      } else {
        // No matches found, revert to previous type
        toast.error('No local matches found');
        const previousType = selectedMatchTypes[variables.resultId] === 'LOCAL' ? 'AI' : selectedMatchTypes[variables.resultId];
        setSelectedMatchTypes(prev => ({ ...prev, [variables.resultId]: previousType }));
      }
    },
    onError: (error, variables) => {
      toast.error('Failed to run local test');
      setRunningLocalTests(prev => ({ ...prev, [variables.resultId]: false }));
      // Revert to previous type on error
      const previousType = selectedMatchTypes[variables.resultId] === 'LOCAL' ? 'AI' : selectedMatchTypes[variables.resultId];
      setSelectedMatchTypes(prev => ({ ...prev, [variables.resultId]: previousType }));
    },
  });


  const handleEdit = (result: MatchResult) => {
    setEditingResultId(result._id);
    setEditValues({
      matchedCode: result.matchedCode,
      matchedUnit: result.matchedUnit,
      matchedRate: result.matchedRate,
      originalQuantity: result.originalQuantity,
      notes: result.notes,
    });
  };

  const handleCancelEdit = () => {
    setEditingResultId(null);
    setEditValues({});
  };

  const handleSaveEdit = async (resultId: string) => {
    const quantity = editValues.originalQuantity || 0;
    const rate = editValues.matchedRate || 0;
    const totalPrice = quantity * rate;
    
    await updateResultMutation.mutateAsync({
      resultId,
      updates: {
        ...editValues,
        totalPrice,
      },
    });
  };

  const [deletedJobId, setDeletedJobId] = useState<string | null>(null);

  const handleDeleteJob = async (jobId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this job? This action cannot be undone.')) {
      setDeletedJobId(jobId);
      await deleteJobMutation.mutateAsync(jobId);
    }
  };

  const handleStopJob = async (jobId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to stop this job?')) {
      await stopJobMutation.mutateAsync(jobId);
    }
  };

  const handleOpenModal = (result: MatchResult) => {
    setSelectedResult(result);
    setModalOpen(true);
  };

  const handleModalSave = async (updates: {
    matchedItemId: string;
    matchedDescription: string;
    matchedCode?: string;
    matchedUnit?: string;
    matchedRate: number;
  }) => {
    if (!selectedResult) return;
    
    // Calculate total price
    const totalPrice = (selectedResult.originalQuantity || 0) * updates.matchedRate;
    
    // Remove matchedItemId from updates as backend doesn't expect it
    const { matchedItemId, ...updateData } = updates;
    
    // Store the manual match in our separate storage
    setManualMatchResults(prev => ({
      ...prev,
      [selectedResult._id]: {
        matchedDescription: updates.matchedDescription,
        matchedCode: updates.matchedCode,
        matchedUnit: updates.matchedUnit,
        matchedRate: updates.matchedRate,
        totalPrice,
      }
    }));
    
    // Update the match type to manual
    setSelectedMatchTypes(prev => ({ ...prev, [selectedResult._id]: 'MANUAL' }));
    
    // Apply the manual match
    await updateResultMutation.mutateAsync({
      resultId: selectedResult._id,
      updates: {
        ...updateData,
        totalPrice,
        isManuallyEdited: true,
      },
    });
    
    setModalOpen(false);
  };


  const handleDownloadResults = async (jobId: string) => {
    try {
      const response = await api.get(`/price-matching/${jobId}/export`, {
        responseType: 'blob'
      });
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `matched_results_${jobId}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success('Excel file downloaded successfully');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to download results');
    }
  };

  const handleApplyDiscountMarkup = async (type: 'discount' | 'markup', percentage: number) => {
    if (!selectedJobId || !results) return;
    
    try {
      // Apply discount/markup to all results
      const updatePromises = results.map(result => {
        if (result.matchedRate) {
          const adjustment = (result.matchedRate * percentage) / 100;
          const newRate = type === 'discount' 
            ? result.matchedRate - adjustment 
            : result.matchedRate + adjustment;
          
          const newTotalPrice = (result.originalQuantity || 0) * newRate;
          
          return updateResultMutation.mutateAsync({
            resultId: result._id,
            updates: {
              matchedRate: newRate,
              totalPrice: newTotalPrice,
              notes: `${type === 'discount' ? 'Discount' : 'Markup'} of ${percentage}% applied`,
            },
          });
        }
        return Promise.resolve();
      });
      
      await Promise.all(updatePromises);
      toast.success(`${type === 'discount' ? 'Discount' : 'Markup'} of ${percentage}% applied successfully`);
      setShowDiscountModal(false);
      setDiscountValue(0);
    } catch (error) {
      toast.error(`Failed to apply ${type}`);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'failed':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Clock className="h-5 w-5 text-yellow-500" />;
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600 bg-green-50';
    if (confidence >= 0.6) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  // Separate context headers and actual items
  const contextHeaders = results?.filter(result => 
    result.matchMethod === 'CONTEXT' || !result.originalQuantity || result.originalQuantity === 0
  ) || [];
  
  const actualItems = results?.filter(result => 
    result.matchMethod !== 'CONTEXT' && result.originalQuantity && result.originalQuantity > 0
  ) || [];
  
  const filteredResults = actualItems.filter(result => 
    result.originalDescription.toLowerCase().includes(searchTerm.toLowerCase()) ||
    result.matchedDescription?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    result.matchedCode?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Group results by sections based on row numbers
  const groupResultsBySection = () => {
    if (!results || results.length === 0) return [];
    
    const allResultsSorted = [...results].sort((a, b) => a.rowNumber - b.rowNumber);
    const groups: Array<{ header?: typeof results[0], items: typeof results }> = [];
    let currentGroup: typeof groups[0] = { items: [] };
    
    allResultsSorted.forEach((result) => {
      // Check if this is a header/context row
      if (result.matchMethod === 'CONTEXT' || !result.originalQuantity || result.originalQuantity === 0) {
        // If we have items in the current group, push it
        if (currentGroup.items.length > 0) {
          groups.push(currentGroup);
        }
        // Start a new group with this header
        currentGroup = { header: result, items: [] };
      } else {
        // This is a regular item
        currentGroup.items.push(result);
      }
    });
    
    // Don't forget the last group
    if (currentGroup.items.length > 0 || currentGroup.header) {
      groups.push(currentGroup);
    }
    
    return groups;
  };
  
  const groupedResults = groupResultsBySection();

  // Pagination calculations
  const totalPages = Math.ceil((jobs?.length || 0) / jobsPerPage);
  const startIndex = (currentPage - 1) * jobsPerPage;
  const endIndex = startIndex + jobsPerPage;
  const paginatedJobs = jobs?.slice(startIndex, endIndex);


  return (
    <div className="space-y-6 overflow-x-hidden">
      {/* Matching Jobs */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <CardTitle>Projects</CardTitle>
              <div className={cn(
                "flex items-center gap-1 text-xs px-2 py-1 rounded-full",
                connected ? "text-green-600 bg-green-50" : "text-red-600 bg-red-50"
              )}>
                {connected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                {connected ? "Live" : "Offline"}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {jobs && jobs.some(job => ['pending', 'parsing', 'matching', 'processing'].includes(job.status)) && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleStopAllJobs}
                  disabled={stopAllJobsMutation.isPending}
                  className="bg-red-600 hover:bg-red-700 text-xs sm:text-sm"
                >
                  {stopAllJobsMutation.isPending ? (
                    <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1 animate-spin" />
                  ) : (
                    <StopCircle className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                  )}
                  <span className="hidden sm:inline">Stop All Jobs</span>
                  <span className="sm:hidden">Stop All</span>
                </Button>
              )}
              {jobs && jobs.length > jobsPerPage && (
                <div className="flex items-center gap-1 sm:gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="p-1 sm:p-2"
                  >
                    <ChevronLeft className="h-3 w-3 sm:h-4 sm:w-4" />
                  </Button>
                  <span className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">
                    {currentPage}/{totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="p-1 sm:p-2"
                  >
                    <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {jobsLoading ? (
            <p className="text-muted-foreground">Loading jobs...</p>
          ) : paginatedJobs && paginatedJobs.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {paginatedJobs.map((job, index) => (
                <div
                  key={job._id}
                  onClick={() => {
                    // Job selected
                    setSelectedJobId(job._id);
                  }}
                  className={cn(
                    'p-4 rounded-lg cursor-pointer transition-colors border',
                    'animate-in fade-in slide-in-from-bottom-2',
                    selectedJobId === job._id
                      ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-800 border-gray-200 dark:border-gray-700'
                  )}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex items-start justify-between mb-2 gap-2">
                    <div className="flex items-center gap-2 flex-1 overflow-hidden">
                      {getStatusIcon(job.status)}
                      <h4 className="font-medium text-sm truncate" title={job.fileName}>
                        {job.fileName}
                      </h4>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {(job.status === 'parsing' || job.status === 'matching') && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => handleStopJob(job._id, e)}
                          disabled={stopJobMutation.isPending}
                          className="h-8 w-8 p-0"
                        >
                          <StopCircle className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => handleDeleteJob(job._id, e)}
                        disabled={deleteJobMutation.isPending}
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <p className="text-xs text-muted-foreground mb-1 truncate">
                    {job.clientName}
                  </p>
                  <p className="text-xs text-muted-foreground mb-2">
                    {format(new Date(job.startedAt), 'MMM d, h:mm a')}
                  </p>
                  
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span>Progress</span>
                      <span>
                        {jobProgress[job._id]?.matchedCount || job.matchedCount}/
                        {jobProgress[job._id]?.itemCount || job.itemCount}
                      </span>
                    </div>
                    {(job.status === 'parsing' || job.status === 'matching' || jobProgress[job._id]) && (
                      <div className="w-full bg-gray-200 rounded-full h-1.5">
                        <div 
                          className="bg-blue-500 h-1.5 rounded-full transition-all"
                          style={{ width: `${jobProgress[job._id]?.progress || job.progress}%` }}
                        />
                      </div>
                    )}
                    {jobProgress[job._id]?.progressMessage && (
                      <p className="text-xs text-muted-foreground truncate">
                        {jobProgress[job._id].progressMessage}
                      </p>
                    )}
                    {(job.status === 'pending' || job.status === 'queued') && (
                      <QueuePosition 
                        jobId={job._id}
                        status={job.status}
                        createdAt={job.startedAt}
                      />
                    )}
                  </div>
                  
                  <div className="mt-2 flex items-center justify-between">
                    <JobStatusIndicator 
                      status={jobProgress[job._id]?.status || job.status}
                      progress={jobProgress[job._id]?.progress || job.progress}
                      progressMessage={jobProgress[job._id]?.progressMessage}
                      showLabel={true}
                      className="scale-90"
                    />
                    <span className="text-xs text-muted-foreground">
                      {job.matchingMethod}
                    </span>
                  </div>
                  
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">No matching jobs found</p>
          )}
        </CardContent>
      </Card>

      {/* Match Results */}
      {selectedJobId && (
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <CardTitle>Match Results</CardTitle>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full sm:w-auto">
                {(jobStatus?.status === 'completed' || mergedJobStatus?.status === 'completed') && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDownloadResults(selectedJobId)}
                      className="w-full sm:w-auto"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Export Excel
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowDiscountModal(true)}
                      className="w-full sm:w-auto"
                    >
                      <Percent className="h-4 w-4 mr-2" />
                      Apply Discount/Markup
                    </Button>
                  </>
                )}
                <div className="relative w-full sm:w-64">
                  <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search results..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </div>
            {mergedJobStatus && (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  <span>Status: {mergedJobStatus.status}</span>
                  <span>Progress: {mergedJobStatus.matchedCount}/{mergedJobStatus.itemCount}</span>
                  {mergedJobStatus.totalValue && (
                    <span>Total Value: {formatPrice(mergedJobStatus.totalValue)}</span>
                  )}
                </div>
                {mergedJobStatus.progressMessage && (
                  <div className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <div className="animate-pulse flex-shrink-0">
                      <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
                    </div>
                    <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                      {mergedJobStatus.progressMessage}
                    </span>
                  </div>
                )}
              </div>
            )}
          </CardHeader>
          <CardContent>
            {resultsLoading ? (
              <p className="text-muted-foreground">Loading results...</p>
            ) : (results && results.length > 0) ? (
              <>
                {/* Match Results Summary */}
                <div className="mb-4 flex items-center justify-between">
                  <h4 className="font-medium text-sm text-gray-700 dark:text-gray-300">
                    Match Results ({actualItems.length} items, {contextHeaders.length} sections)
                  </h4>
                  <div className="text-sm text-gray-500">
                    Total Sections: {groupedResults.length}
                  </div>
                </div>
                
                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                  <Button
                    onClick={() => {
                      // Opening results modal
                      setShowResultsModal(true);
                    }}
                    className="flex-1 text-sm"
                  >
                    <Search className="h-4 w-4 mr-2" />
                    View Results
                  </Button>
                  <Button
                    onClick={() => handleDownloadResults(selectedJobId)}
                    variant="outline"
                    className="flex-1 text-sm"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                  <Button
                    onClick={() => setShowDiscountModal(true)}
                    variant="outline"
                    className="flex-1 sm:flex-initial text-sm"
                  >
                    <Percent className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">Apply Discount/Markup</span>
                    <span className="sm:hidden">Discount</span>
                  </Button>
                </div>
                
                {/* Quick Summary */}
                {actualItems.length > 0 ? (
                  <>
                    {/* Status Message */}
                    <div className="text-center py-4">
                      <p className="text-sm text-muted-foreground">
                        Click "View Detailed Results" to see individual matches and make adjustments
                      </p>
                    </div>
                    
                    {/* Total Quotation Sum */}
                    <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div className="flex justify-between items-center">
                        <span className="text-lg font-semibold">Total Quotation:</span>
                        <span className="text-xl font-bold text-green-600 dark:text-green-400">
                          {formatPrice(actualItems.reduce((sum, result) => sum + (result.totalPrice || 0), 0))}
                        </span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No items with quantities found</p>
                    <p className="text-sm text-muted-foreground mt-2">Only header sections were found in this document</p>
                  </div>
                )}
              </>
            ) : (
              <p className="text-muted-foreground text-center py-8">
                {selectedJobId ? 'No results found' : 'Select a job to view results'}
              </p>
            )}
          </CardContent>
        </Card>
      )}


      {/* Manual Match Modal */}
      {selectedResult && (
        <ManualMatchModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          result={selectedResult}
          onSave={handleModalSave}
        />
      )}
      
      {/* Discount/Markup Modal */}
      {filteredResults && (
        <DiscountMarkupModal
          isOpen={showDiscountModal}
          onClose={() => setShowDiscountModal(false)}
          currentTotal={filteredResults.reduce((sum, result) => sum + (result.totalPrice || 0), 0)}
          onApply={handleApplyDiscountMarkup}
        />
      )}

      {/* Results Modal */}
      {showResultsModal && selectedJobId && selectedJob && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-2 sm:p-4 z-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-6xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden">
            <div className="h-full overflow-y-auto">
              {selectedJob.matchingMethod === 'LOCAL' ? (
                <LocalMatchResultsModal
                  jobId={selectedJobId}
                  onClose={() => setShowResultsModal(false)}
                />
              ) : (
                <AIMatchResultsModal
                  jobId={selectedJobId}
                  jobMatchingMethod={selectedJob.matchingMethod as 'V2' | 'V1'}
                  onClose={() => setShowResultsModal(false)}
                />
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}