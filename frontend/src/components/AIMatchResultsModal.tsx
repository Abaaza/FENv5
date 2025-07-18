import React, { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import './table-scroll-styles.css';
import { 
  Loader2,
  Search,
  Save,
  X,
  Edit,
  Percent,
  Download,
  Trash2
} from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { api } from '../lib/api';
import { cn } from '../lib/utils';
import { ManualMatchModal } from './ManualMatchModal';
import { DiscountMarkupModal } from './DiscountMarkupModal';
import { useCurrency } from '../hooks/useCurrency';
import { queryKeys } from '../lib/query-config';

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
  isDeleted?: boolean;
}

interface MatchData {
  matchedDescription: string;
  matchedCode?: string;
  matchedUnit?: string;
  matchedRate: number;
  confidence: number;
  totalPrice?: number;
}

interface AIMatchResultsModalProps {
  jobId: string;
  jobMatchingMethod: 'V2' | 'V1';
  onClose?: () => void;
}

export function AIMatchResultsModal({ jobId, jobMatchingMethod, onClose }: AIMatchResultsModalProps) {
  console.log('[AIMatchResultsModal] Initializing with:', { jobId, jobMatchingMethod });
  const { formatPrice } = useCurrency();
  const [editingResultId, setEditingResultId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<MatchResult>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedResult, setSelectedResult] = useState<MatchResult | null>(null);
  const [runningLocalTests, setRunningLocalTests] = useState<{ [key: string]: boolean }>({});
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  
  // Store different match types separately - each result can have AI, LOCAL, and MANUAL versions
  const [matchDataStore, setMatchDataStore] = useState<{
    ai: { [resultId: string]: MatchData };
    local: { [resultId: string]: MatchData };
    manual: { [resultId: string]: MatchData };
  }>({
    ai: {},
    local: {},
    manual: {}
  });
  
  // Track which type is currently selected for each result
  const [selectedMatchTypes, setSelectedMatchTypes] = useState<{ [resultId: string]: 'AI' | 'LOCAL' | 'MANUAL' }>({});

  // Fetch match results
  const { data: results, isLoading: resultsLoading, refetch: refetchResults } = useQuery<MatchResult[]>({
    queryKey: queryKeys.matchResults(jobId),
    queryFn: async () => {
      const response = await api.get(`/price-matching/${jobId}/results`);
      return response.data;
    },
    enabled: !!jobId,
    staleTime: 0, // Always consider data stale
    refetchOnMount: 'always', // Always refetch when component mounts
  });

  // Initialize match data when results load
  useEffect(() => {
    console.log('[AIMatchResultsModal] Results loaded:', results?.length || 0, 'items');
    if (results && results.length > 0) {
      const initialTypes: { [key: string]: 'AI' | 'LOCAL' | 'MANUAL' } = {};
      const aiData: { [key: string]: MatchData } = {};
      const localData: { [key: string]: MatchData } = {};
      const manualData: { [key: string]: MatchData } = {};
      
      results.forEach((result: MatchResult) => {
        // Skip context headers
        if (result.matchMethod === 'CONTEXT') return;
        
        // Current match data
        const currentMatchData = result.matchedDescription ? {
          matchedDescription: result.matchedDescription || '',
          matchedCode: result.matchedCode,
          matchedUnit: result.matchedUnit,
          matchedRate: result.matchedRate || 0,
          confidence: result.confidence || 0,
          totalPrice: result.totalPrice,
        } : null;
        
        // Determine match type based on matchMethod and isManuallyEdited
        let matchType: 'AI' | 'LOCAL' | 'MANUAL';
        
        // Priority: MANUAL > LOCAL > AI
        if (result.matchMethod === 'MANUAL' || result.isManuallyEdited) {
          matchType = 'MANUAL';
        } else if (result.matchMethod === 'LOCAL') {
          matchType = 'LOCAL';
        } else {
          // Default to AI for V2, V1, or unspecified
          matchType = 'AI';
        }
        
        // Store the current match data in the appropriate store
        if (currentMatchData) {
          if (matchType === 'MANUAL') {
            manualData[result._id] = currentMatchData;
          } else if (matchType === 'LOCAL') {
            localData[result._id] = currentMatchData;
          } else {
            aiData[result._id] = currentMatchData;
          }
        }
        
        // Set the initial type
        initialTypes[result._id] = matchType;
      });
      
      console.log('[AIMatchResultsModal] Initialized match data:', {
        aiMatches: Object.keys(aiData).length,
        localMatches: Object.keys(localData).length,
        manualMatches: Object.keys(manualData).length,
        initialTypes
      });
      
      setMatchDataStore({
        ai: aiData,
        local: localData,
        manual: manualData,
      });
      setSelectedMatchTypes(initialTypes);
    }
  }, [results, jobMatchingMethod]);

  // Update result mutation
  const updateResultMutation = useMutation({
    mutationFn: async ({ resultId, updates }: { resultId: string; updates: Partial<MatchResult> }) => {
      const response = await api.patch(`/price-matching/results/${resultId}`, updates);
      return { resultId, updates, response: response.data };
    },
    onSuccess: ({ resultId, updates }) => {
      // Don't refetch results - just update local state to prevent UI reset
      if (setEditingResultId) {
        setEditingResultId(null);
        setEditValues({});
      }
      
      // Determine the match type from the updates
      let matchType: 'AI' | 'LOCAL' | 'MANUAL';
      if (updates.isManuallyEdited || updates.matchMethod === 'MANUAL') {
        matchType = 'MANUAL';
      } else if (updates.matchMethod === 'LOCAL') {
        matchType = 'LOCAL';
      } else {
        matchType = 'AI';
      }
      
      // Create the match data object
      const matchData = {
        matchedDescription: updates.matchedDescription || '',
        matchedCode: updates.matchedCode,
        matchedUnit: updates.matchedUnit,
        matchedRate: updates.matchedRate || 0,
        confidence: updates.confidence || (matchType === 'MANUAL' ? 1 : 0),
        totalPrice: updates.totalPrice,
      };
      
      // Update the appropriate store
      setMatchDataStore(prev => {
        const newStore = { ...prev };
        
        if (matchType === 'MANUAL') {
          newStore.manual = { ...prev.manual, [resultId]: matchData };
        } else if (matchType === 'LOCAL') {
          newStore.local = { ...prev.local, [resultId]: matchData };
        } else {
          newStore.ai = { ...prev.ai, [resultId]: matchData };
        }
        
        return newStore;
      });
      
      // Update the selected match type
      setSelectedMatchTypes(prev => ({ ...prev, [resultId]: matchType }));
    },
    onError: () => {
      toast.error('Failed to update result');
    },
  });

  // Local test mutation
  const runLocalTestMutation = useMutation({
    mutationFn: async ({ resultId, description }: { resultId: string; description: string }) => {
      const response = await api.post(`/price-matching/test/local`, {
        description,
      });
      return { ...response.data, resultId };
    },
    onSuccess: async (data) => {
      console.log('[AIMatchResultsModal] Local test response:', {
        resultId: data.resultId,
        hasMatches: !!data.matches,
        matchCount: data.matches?.length || 0,
        bestMatch: data.bestMatch
      });
      
      setRunningLocalTests(prev => ({ ...prev, [data.resultId]: false }));
      
      // Store local match if found
      if (data.matches && data.matches.length > 0) {
        const match = data.matches[0];
        const result = results?.find(r => r._id === data.resultId);
        if (result) {
          const totalPrice = (result.originalQuantity || 0) * (match.rate || 0);
          
          console.log('[AIMatchResultsModal] Storing local match:', {
            resultId: data.resultId,
            matchedDescription: match.description,
            matchedRate: match.rate,
            confidence: match.confidence,
            totalPrice
          });
          
          // Store the local match data AND apply it in one go
          const localMatchData = {
            matchedDescription: match.description,
            matchedCode: match.code,
            matchedUnit: match.unit,
            matchedRate: match.rate,
            confidence: match.confidence,
            totalPrice,
          };
          
          // Update state first
          setMatchDataStore(prev => ({
            ...prev,
            local: {
              ...prev.local,
              [data.resultId]: localMatchData
            }
          }));
          
          // Switch to LOCAL view
          setSelectedMatchTypes(prev => ({ ...prev, [data.resultId]: 'LOCAL' }));
          
          // Apply the match directly with the data we have
          try {
            await updateResultMutation.mutateAsync({
              resultId: data.resultId,
              updates: {
                ...localMatchData,
                isManuallyEdited: false,
                matchMethod: 'LOCAL',
              },
            });
          } catch (error) {
            console.error('[AIMatchResultsModal] Failed to apply local match:', error);
          }
          
          toast.success(`Local match found: ${match.description}`);
        }
      } else {
        console.warn('[AIMatchResultsModal] No local matches found for:', data.resultId);
        toast.error('No local matches found');
      }
    },
    onError: (error: Error & { response?: { data?: { error?: string } } }, variables) => {
      const errorMessage = error?.response?.data?.error || error?.message || 'Failed to run local test';
      console.error('Local test error:', error);
      toast.error(errorMessage);
      setRunningLocalTests(prev => ({ ...prev, [variables.resultId]: false }));
    },
  });

  const applyMatch = async (resultId: string, type: 'AI' | 'LOCAL' | 'MANUAL', skipToast = false) => {
    const matchData = matchDataStore[type.toLowerCase() as keyof typeof matchDataStore][resultId];
    console.log('[AIMatchResultsModal] Applying match:', { resultId, type, matchData });
    if (!matchData) {
      console.warn('[AIMatchResultsModal] No match data found for:', { resultId, type });
      return;
    }
    
    try {
      await updateResultMutation.mutateAsync({
        resultId,
        updates: {
          ...matchData,
          isManuallyEdited: type === 'MANUAL',
          matchMethod: type, // Always save the actual type (AI, LOCAL, or MANUAL)
        },
      });
      
      // Don't refetch - the mutation's onSuccess handler will update the local state
      // This prevents the state from being reset when making changes
      
      if (!skipToast) {
        toast.success(`Applied ${type} match`);
      }
    } catch (error) {
      console.error('[AIMatchResultsModal] Failed to apply match:', error);
      toast.error('Failed to save match selection');
    }
  };

  const handleMatchTypeChange = async (resultId: string, newType: 'AI' | 'LOCAL' | 'MANUAL') => {
    console.log('[AIMatchResultsModal] Changing match type:', { resultId, newType });
    // Update selected type
    setSelectedMatchTypes(prev => ({ ...prev, [resultId]: newType }));
    
    // Apply the match if we have data for it
    if (newType === 'AI' && matchDataStore.ai[resultId]) {
      await applyMatch(resultId, 'AI');
    } else if (newType === 'LOCAL' && matchDataStore.local[resultId]) {
      await applyMatch(resultId, 'LOCAL');
    } else if (newType === 'MANUAL' && matchDataStore.manual[resultId]) {
      await applyMatch(resultId, 'MANUAL');
    } else if (newType === 'LOCAL' && !matchDataStore.local[resultId]) {
      // Need to run local test first
      const result = results?.find(r => r._id === resultId);
      if (result) {
        handleRunLocalTest(result);
      }
    } else if (newType === 'MANUAL' && !matchDataStore.manual[resultId]) {
      // Open manual modal
      const result = results?.find(r => r._id === resultId);
      if (result) {
        setSelectedResult(result);
        setModalOpen(true);
      }
    } else if (newType === 'AI') {
      // Apply AI match if we have it
      if (matchDataStore.ai[resultId]) {
        await applyMatch(resultId, 'AI');
      }
    }
  };

  const handleRunLocalTest = (result: MatchResult) => {
    console.log('[AIMatchResultsModal] Running local test for:', {
      resultId: result._id,
      description: result.originalDescription,
      rowNumber: result.rowNumber,
      originalQuantity: result.originalQuantity,
      originalUnit: result.originalUnit
    });
    
    if (!result.originalDescription) {
      console.error('[AIMatchResultsModal] ERROR: No description for local test');
      toast.error('No description available for matching');
      return;
    }
    
    setRunningLocalTests(prev => ({ ...prev, [result._id]: true }));
    runLocalTestMutation.mutate({
      resultId: result._id,
      description: result.originalDescription
    });
  };


  const handleModalSave = async (updates: {
    matchedItemId: string;
    matchedDescription: string;
    matchedCode?: string;
    matchedUnit?: string;
    matchedRate: number;
  }) => {
    if (!selectedResult) return;
    
    const totalPrice = (selectedResult.originalQuantity || 0) * updates.matchedRate;
    const { ...updateData } = updates;
    
    // Store manual match data first
    setMatchDataStore(prev => ({
      ...prev,
      manual: {
        ...prev.manual,
        [selectedResult._id]: {
          matchedDescription: updates.matchedDescription,
          matchedCode: updates.matchedCode,
          matchedUnit: updates.matchedUnit,
          matchedRate: updates.matchedRate,
          confidence: 1,
          totalPrice,
        }
      }
    }));
    
    // Update match type to manual
    setSelectedMatchTypes(prev => ({ ...prev, [selectedResult._id]: 'MANUAL' }));
    
    // Apply the update
    await updateResultMutation.mutateAsync({
      resultId: selectedResult._id,
      updates: {
        ...updateData,
        totalPrice,
        isManuallyEdited: true,
        confidence: 1,
        matchMethod: 'MANUAL',
      },
    });
    
    // Don't refetch - the mutation's onSuccess will update the local state
    toast.success('Manual match saved successfully');
    setModalOpen(false);
  };

  const handleEdit = (result: MatchResult) => {
    setEditingResultId(result._id);
    setEditValues({
      matchedUnit: result.matchedUnit,
      matchedRate: result.matchedRate,
      originalQuantity: result.originalQuantity,
    });
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

  const handleCancelEdit = () => {
    setEditingResultId(null);
    setEditValues({});
  };

  const handleDelete = async (resultId: string) => {
    if (!confirm('Are you sure you want to delete this item? It will be excluded from the export.')) {
      return;
    }
    
    try {
      // Mark the item as deleted (confidence = 0 means no match)
      await updateResultMutation.mutateAsync({
        resultId,
        updates: {
          confidence: 0,
          matchedItemId: '',
          matchedDescription: 'Item deleted',
          matchedCode: '',
          matchedUnit: '',
          matchedRate: 0,
          totalPrice: 0,
          notes: 'Item deleted by user',
        },
      });
      toast.success('Item deleted successfully');
    } catch (error) {
      toast.error('Failed to delete item');
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600 bg-green-50';
    if (confidence >= 0.6) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  // Get the display data for a result based on selected match type
  const getDisplayMatch = (result: MatchResult): MatchData | null => {
    const type = selectedMatchTypes[result._id] || 'AI';
    const store = matchDataStore[type.toLowerCase() as keyof typeof matchDataStore];
    
    // If we have stored data for this type, return it
    if (store[result._id]) {
      return store[result._id];
    }
    
    // If no stored data and type is AI, return the current result data
    if (type === 'AI' && result.matchedDescription) {
      return {
        matchedDescription: result.matchedDescription,
        matchedCode: result.matchedCode,
        matchedUnit: result.matchedUnit,
        matchedRate: result.matchedRate || 0,
        confidence: result.confidence || 0,
        totalPrice: result.totalPrice,
      };
    }
    
    return null;
  };

  // Separate actual items from context headers
  const actualItems = results?.filter(result => 
    !result.isDeleted && result.matchMethod !== 'CONTEXT' && result.originalQuantity && result.originalQuantity > 0
  ) || [];
  
  const filteredResults = actualItems.filter(result => 
    result.originalDescription.toLowerCase().includes(searchTerm.toLowerCase()) ||
    result.matchedDescription?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    result.matchedCode?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Group results by sections
  const groupResultsBySection = () => {
    if (!results || results.length === 0) return [];
    
    const allResultsSorted = [...results].sort((a, b) => a.rowNumber - b.rowNumber);
    const groups: Array<{ header?: typeof results[0], items: typeof results }> = [];
    let currentGroup: typeof groups[0] = { items: [] };
    
    allResultsSorted.forEach((result) => {
      if (result.matchMethod === 'CONTEXT' || !result.originalQuantity || result.originalQuantity === 0) {
        if (currentGroup.items.length > 0) {
          groups.push(currentGroup);
        }
        currentGroup = { header: result, items: [] };
      } else {
        currentGroup.items.push(result);
      }
    });
    
    if (currentGroup.items.length > 0 || currentGroup.header) {
      groups.push(currentGroup);
    }
    
    return groups;
  };

  const groupedResults = groupResultsBySection();

  const handleDownloadResults = async () => {
    try {
      // Show loading toast
      const loadingToast = toast.loading('Preparing Excel export...');
      
      // First, save all currently selected matches to the database
      const savePromises = actualItems.map(async (result) => {
        const displayMatch = getDisplayMatch(result);
        const matchType = selectedMatchTypes[result._id] || 'AI';
        
        if (displayMatch) {
          try {
            // Only update if we have match data
            return await updateResultMutation.mutateAsync({
              resultId: result._id,
              updates: {
                matchedDescription: displayMatch.matchedDescription,
                matchedCode: displayMatch.matchedCode,
                matchedUnit: displayMatch.matchedUnit,
                matchedRate: displayMatch.matchedRate || 0,
                confidence: displayMatch.confidence || 0,
                totalPrice: displayMatch.totalPrice || 0,
                isManuallyEdited: matchType === 'MANUAL',
                matchMethod: matchType === 'AI' ? jobMatchingMethod : matchType,
              },
            });
          } catch (error) {
            console.error(`Failed to update result ${result._id}:`, error);
            // Continue with other updates even if one fails
            return null;
          }
        }
        return Promise.resolve();
      });
      
      // Wait for all saves to complete
      const results = await Promise.allSettled(savePromises);
      
      // Count successful updates
      const successCount = results.filter(r => r.status === 'fulfilled' && r.value !== null).length;
      const failCount = results.filter(r => r.status === 'rejected').length;
      
      if (failCount > 0) {
        console.warn(`${failCount} updates failed during export preparation`);
        // Log details of failures
        results.forEach((result, index) => {
          if (result.status === 'rejected') {
            console.error(`Failed to update item ${index}:`, result.reason);
          }
        });
      }
      
      // Dismiss loading toast
      toast.dismiss(loadingToast);
      
      // If all updates failed, don't proceed with export
      if (successCount === 0 && failCount > 0) {
        toast.error('Failed to save changes. Please try again.');
        return;
      }
      
      // Wait a bit for the database to be consistent
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Now export with the updated data
      const response = await api.get(`/price-matching/${jobId}/export`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `matched_results_${jobId}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success(`Excel file downloaded successfully${failCount > 0 ? ` (${failCount} items may not have updated)` : ''}`);
    } catch (error) {
      console.error('Export error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to download results';
      toast.error(errorMessage);
    }
  };
  
  const handleApplyDiscountMarkup = async (type: 'discount' | 'markup', percentage: number) => {
    if (!results) return;
    
    try {
      const updatePromises = actualItems.map(result => {
        const displayMatch = getDisplayMatch(result);
        const currentMatchType = selectedMatchTypes[result._id] || 'AI';
        
        if (displayMatch?.matchedRate) {
          const adjustment = (displayMatch.matchedRate * percentage) / 100;
          const newRate = type === 'discount' 
            ? displayMatch.matchedRate - adjustment 
            : displayMatch.matchedRate + adjustment;
          
          const newTotalPrice = (result.originalQuantity || 0) * newRate;
          
          // Update the match data store to preserve the current selection
          const updatedMatchData = {
            ...displayMatch,
            matchedRate: newRate,
            totalPrice: newTotalPrice,
          };
          
          // Update the appropriate store based on current selection
          setMatchDataStore(prev => ({
            ...prev,
            [currentMatchType.toLowerCase()]: {
              ...prev[currentMatchType.toLowerCase() as keyof typeof prev],
              [result._id]: updatedMatchData
            }
          }));
          
          // Send update to backend while preserving all match data
          return updateResultMutation.mutateAsync({
            resultId: result._id,
            updates: {
              matchedDescription: displayMatch.matchedDescription,
              matchedCode: displayMatch.matchedCode,
              matchedUnit: displayMatch.matchedUnit,
              matchedRate: newRate,
              totalPrice: newTotalPrice,
              confidence: displayMatch.confidence,
              matchMethod: currentMatchType === 'MANUAL' ? 'MANUAL' : result.matchMethod,
              isManuallyEdited: currentMatchType === 'MANUAL' || result.isManuallyEdited,
              notes: `${type === 'discount' ? 'Discount' : 'Markup'} of ${percentage}% applied`,
            },
          });
        }
        return Promise.resolve();
      });
      
      await Promise.all(updatePromises);
      toast.success(`${type === 'discount' ? 'Discount' : 'Markup'} of ${percentage}% applied successfully`);
      setShowDiscountModal(false);
    } catch {
      toast.error(`Failed to apply ${type}`);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-2 sm:p-4 z-50">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-[95vw] max-w-[1600px] my-4 sm:my-8 max-h-[95vh] overflow-hidden flex flex-col">
        <Card className="border-0 h-full flex flex-col">
          <CardHeader className="sticky top-0 bg-white dark:bg-gray-900 z-10 border-b p-4 flex-shrink-0">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                {jobMatchingMethod} Match Results
                <span className="text-xs sm:text-sm text-muted-foreground">({filteredResults.length} items)</span>
              </CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  onClick={handleDownloadResults}
                  className="h-8 text-xs sm:text-sm"
                >
                  <Download className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                  <span className="hidden sm:inline">Export Excel</span>
                  <span className="sm:hidden">Export</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowDiscountModal(true)}
                  className="h-8 text-xs sm:text-sm"
                >
                  <Percent className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                  <span className="hidden sm:inline">Discount/Markup</span>
                  <span className="sm:hidden">±%</span>
                </Button>
                <div className="relative flex-1 sm:flex-initial">
                  <Search className="h-3 w-3 sm:h-4 sm:w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8 sm:pl-9 w-full sm:w-64 text-sm"
                  />
                </div>
                {onClose && (
                  <Button variant="ghost" onClick={onClose} className="h-8 p-2">
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden p-2 sm:p-6 flex flex-col">
            {resultsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : groupedResults.length > 0 ? (
              <>
                {/* Desktop Table View */}
                <div className="hidden lg:block overflow-auto max-h-[calc(100vh-20rem)] scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-100">
                  <table className="border-collapse w-full" style={{ minWidth: '1400px' }}>
                    <thead>
                      <tr className="border-b bg-gray-50 dark:bg-gray-800">
                        <th className="text-left p-3 font-medium text-sm sticky left-0 bg-gray-50 dark:bg-gray-800 z-10">Row</th>
                        <th className="text-left p-3 font-medium text-sm min-w-[300px]">Original Description</th>
                        <th className="text-left p-3 font-medium text-sm min-w-[350px]">Matched Item</th>
                        <th className="text-left p-3 font-medium text-sm whitespace-nowrap">Excel Unit</th>
                        <th className="text-left p-3 font-medium text-sm whitespace-nowrap">Price List Unit</th>
                        <th className="text-left p-3 font-medium text-sm">Rate</th>
                        <th className="text-left p-3 font-medium text-sm">Quantity</th>
                        <th className="text-left p-3 font-medium text-sm">Total</th>
                        <th className="text-left p-3 font-medium text-sm">Confidence</th>
                        <th className="text-left p-3 font-medium text-sm">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                    {groupedResults.map((group, groupIndex) => (
                      <React.Fragment key={`group-${groupIndex}`}>
                        {/* Section Header Row */}
                        {group.header && (
                          <tr className="bg-gray-100 dark:bg-gray-800 border-t-2 border-gray-300 dark:border-gray-600">
                            <td className="p-3 text-sm font-medium text-gray-600 dark:text-gray-300 sticky left-0 bg-gray-100 dark:bg-gray-800 z-10">
                              {group.header.rowNumber}
                            </td>
                            <td colSpan={9} className="p-3">
                              <div className="flex items-center gap-2">
                                <div className="h-0.5 w-8 bg-gray-300 dark:bg-gray-600"></div>
                                <span className="text-sm font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wide">
                                  {group.header.originalDescription}
                                </span>
                                <div className="flex-1 h-0.5 bg-gray-300 dark:bg-gray-600"></div>
                              </div>
                            </td>
                          </tr>
                        )}
                        {/* Item Rows */}
                        {group.items.filter(item => 
                          !item.isDeleted && (
                            searchTerm === '' || 
                            item.originalDescription.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            item.matchedDescription?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            item.matchedCode?.toLowerCase().includes(searchTerm.toLowerCase())
                          )
                        ).map((result) => {
                          const displayMatch = getDisplayMatch(result);
                          const matchType = selectedMatchTypes[result._id] || 'AI';
                          const hasLocalMatch = !!matchDataStore.local[result._id];
                          const hasManualMatch = !!matchDataStore.manual[result._id];
                          
                          return (
                            <tr key={result._id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800/50">
                              <td className="p-3 text-sm sticky left-0 bg-white dark:bg-gray-900 z-10">{result.rowNumber}</td>
                              <td className="p-3 text-sm">
                                <div className="whitespace-normal break-words max-w-md">
                                  {result.originalDescription}
                                </div>
                              </td>
                              <td className="p-3">
                                <div className="space-y-2">
                                  {/* Match Type Radio Buttons */}
                                  <div className="flex gap-3 mb-2">
                                    <label className="flex items-center gap-1 cursor-pointer">
                                      <input
                                        type="radio"
                                        name={`match-type-${result._id}`}
                                        value="AI"
                                        checked={matchType === 'AI'}
                                        onChange={() => handleMatchTypeChange(result._id, 'AI')}
                                        className="text-blue-600"
                                      />
                                      <span className="text-xs">AI Match</span>
                                    </label>
                                    <label className="flex items-center gap-1 cursor-pointer">
                                      <input
                                        type="radio"
                                        name={`match-type-${result._id}`}
                                        value="LOCAL"
                                        checked={matchType === 'LOCAL'}
                                        onChange={() => handleMatchTypeChange(result._id, 'LOCAL')}
                                        className="text-green-600"
                                      />
                                      <span className="text-xs">Local{hasLocalMatch && ' ✓'}</span>
                                      {runningLocalTests[result._id] && (
                                        <Loader2 className="h-3 w-3 animate-spin text-green-600" />
                                      )}
                                    </label>
                                    <label className="flex items-center gap-1 cursor-pointer">
                                      <input
                                        type="radio"
                                        name={`match-type-${result._id}`}
                                        value="MANUAL"
                                        checked={matchType === 'MANUAL'}
                                        onChange={() => handleMatchTypeChange(result._id, 'MANUAL')}
                                        className="text-purple-600"
                                      />
                                      <span className="text-xs">Manual{hasManualMatch && ' ✓'}</span>
                                    </label>
                                  </div>
                                  
                                  {/* Matched Item Display */}
                                  <div className={cn(
                                    "rounded-lg p-3 border bg-gradient-to-r transition-all",
                                    matchType === 'LOCAL' && "from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-500",
                                    matchType === 'MANUAL' && "from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 border-purple-500",
                                    matchType === 'AI' && "from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-500",
                                    runningLocalTests[result._id] && "opacity-50"
                                  )}>
                                    {runningLocalTests[result._id] ? (
                                      <div className="flex items-center gap-2 text-sm">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Running local test...
                                      </div>
                                    ) : displayMatch ? (
                                      <div className="space-y-1">
                                        <p className="font-medium text-sm">{displayMatch.matchedDescription}</p>
                                      </div>
                                    ) : (
                                      <p className="text-sm text-muted-foreground italic">No match found</p>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="p-3 text-sm">
                                {result.originalUnit || '-'}
                              </td>
                              <td className="p-3 text-sm">
                                {editingResultId === result._id ? (
                                  <Input
                                    value={editValues.matchedUnit || ''}
                                    onChange={(e) => setEditValues({ ...editValues, matchedUnit: e.target.value })}
                                    className="h-8 w-20"
                                  />
                                ) : (
                                  displayMatch?.matchedUnit || '-'
                                )}
                              </td>
                              <td className="p-3 text-sm">
                                {editingResultId === result._id ? (
                                  <Input
                                    type="number"
                                    value={editValues.matchedRate || ''}
                                    onChange={(e) => setEditValues({ ...editValues, matchedRate: parseFloat(e.target.value) })}
                                    className="h-8 w-24"
                                  />
                                ) : (
                                  displayMatch?.matchedRate ? formatPrice(displayMatch.matchedRate) : '-'
                                )}
                              </td>
                              <td className="p-3 text-sm">
                                {editingResultId === result._id ? (
                                  <Input
                                    type="number"
                                    value={editValues.originalQuantity || ''}
                                    onChange={(e) => setEditValues({ ...editValues, originalQuantity: parseFloat(e.target.value) })}
                                    className="h-8 w-20"
                                  />
                                ) : (
                                  result.originalQuantity || '-'
                                )}
                              </td>
                              <td className="p-3 text-sm font-medium">
                                {displayMatch?.totalPrice ? formatPrice(displayMatch.totalPrice) : '-'}
                              </td>
                              <td className="p-3 text-sm">
                                <span className={cn(
                                  "px-2 py-1 rounded-full text-xs font-medium",
                                  getConfidenceColor(displayMatch?.confidence || 0)
                                )}>
                                  {((displayMatch?.confidence || 0) * 100).toFixed(0)}%
                                </span>
                              </td>
                              <td className="p-3">
                                <div className="flex items-center gap-1">
                                  {editingResultId === result._id ? (
                                    <>
                                      <Button
                                        className="h-8"
                                        variant="ghost"
                                        onClick={() => handleSaveEdit(result._id)}
                                        disabled={updateResultMutation.isPending}
                                      >
                                        <Save className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        className="h-8"
                                        variant="ghost"
                                        onClick={handleCancelEdit}
                                      >
                                        <X className="h-4 w-4" />
                                      </Button>
                                    </>
                                  ) : (
                                    <>
                                      <Button
                                        className="h-8"
                                        variant="ghost"
                                        onClick={() => handleEdit(result)}
                                        title="Edit"
                                      >
                                        <Edit className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        className="h-8"
                                        variant="ghost"
                                        onClick={() => handleDelete(result._id)}
                                        title="Delete"
                                      >
                                        <Trash2 className="h-4 w-4 text-red-500" />
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card View */}
                <div className="lg:hidden overflow-auto max-h-[calc(100vh-20rem)] space-y-4">
                  {groupedResults.map((group, groupIndex) => (
                    <div key={`mobile-group-${groupIndex}`} className="space-y-3">
                      {/* Section Header */}
                      {group.header && (
                        <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-lg">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-600 dark:text-gray-400">Row {group.header.rowNumber}</span>
                            <div className="h-0.5 w-4 bg-gray-300 dark:bg-gray-600"></div>
                            <span className="text-sm font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wide flex-1">
                              {group.header.originalDescription}
                            </span>
                          </div>
                        </div>
                      )}
                      
                      {/* Item Cards */}
                      {group.items.filter(item => 
                        !item.isDeleted && (
                          searchTerm === '' || 
                          item.originalDescription.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          item.matchedDescription?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          item.matchedCode?.toLowerCase().includes(searchTerm.toLowerCase())
                        )
                      ).map((result) => {
                        const displayMatch = getDisplayMatch(result);
                        const matchType = selectedMatchTypes[result._id] || 'AI';
                        const hasLocalMatch = !!matchDataStore.local[result._id];
                        const hasManualMatch = !!matchDataStore.manual[result._id];
                        
                        return (
                          <Card key={`mobile-${result._id}`} className="p-4 space-y-3">
                            {/* Row Number and Original Description */}
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs text-gray-500">Row {result.rowNumber}</span>
                              </div>
                              <p className="text-sm font-medium">{result.originalDescription}</p>
                            </div>
                            
                            {/* Match Type Selection */}
                            <div className="flex gap-2 flex-wrap">
                              <label className="flex items-center gap-1 cursor-pointer">
                                <input
                                  type="radio"
                                  name={`mobile-match-type-${result._id}`}
                                  value="AI"
                                  checked={matchType === 'AI'}
                                  onChange={() => handleMatchTypeChange(result._id, 'AI')}
                                  className="text-blue-600"
                                />
                                <span className="text-xs">AI</span>
                              </label>
                              <label className="flex items-center gap-1 cursor-pointer">
                                <input
                                  type="radio"
                                  name={`mobile-match-type-${result._id}`}
                                  value="LOCAL"
                                  checked={matchType === 'LOCAL'}
                                  onChange={() => handleMatchTypeChange(result._id, 'LOCAL')}
                                  className="text-green-600"
                                />
                                <span className="text-xs">Local{hasLocalMatch && ' ✓'}</span>
                                {runningLocalTests[result._id] && (
                                  <Loader2 className="h-3 w-3 animate-spin text-green-600" />
                                )}
                              </label>
                              <label className="flex items-center gap-1 cursor-pointer">
                                <input
                                  type="radio"
                                  name={`mobile-match-type-${result._id}`}
                                  value="MANUAL"
                                  checked={matchType === 'MANUAL'}
                                  onChange={() => handleMatchTypeChange(result._id, 'MANUAL')}
                                  className="text-purple-600"
                                />
                                <span className="text-xs">Manual{hasManualMatch && ' ✓'}</span>
                              </label>
                            </div>
                            
                            {/* Matched Item Display */}
                            {displayMatch && (
                              <div className="space-y-2 pt-2 border-t">
                                <div className={cn(
                                  "rounded-lg p-3 border bg-gradient-to-r transition-all",
                                  matchType === 'LOCAL' && "from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-500",
                                  matchType === 'MANUAL' && "from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 border-purple-500",
                                  matchType === 'AI' && "from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-500",
                                  runningLocalTests[result._id] && "opacity-50"
                                )}>
                                  <p className="text-xs text-gray-500 mb-1">Matched Item</p>
                                  {runningLocalTests[result._id] ? (
                                    <div className="flex items-center gap-2 text-sm">
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                      Running local test...
                                    </div>
                                  ) : (
                                    <p className="text-sm font-medium">{displayMatch.matchedDescription}</p>
                                  )}
                                </div>
                                
                                {/* Edit mode for rate and quantity */}
                                {editingResultId === result._id ? (
                                  <div className="space-y-2">
                                    <div className="grid grid-cols-2 gap-2">
                                      <div>
                                        <label className="text-xs text-gray-500">Unit</label>
                                        <Input
                                          value={editValues.matchedUnit || ''}
                                          onChange={(e) => setEditValues({...editValues, matchedUnit: e.target.value})}
                                          className="h-8 text-sm"
                                        />
                                      </div>
                                      <div>
                                        <label className="text-xs text-gray-500">Rate</label>
                                        <Input
                                          type="number"
                                          value={editValues.matchedRate || 0}
                                          onChange={(e) => setEditValues({...editValues, matchedRate: parseFloat(e.target.value) || 0})}
                                          className="h-8 text-sm"
                                        />
                                      </div>
                                    </div>
                                    <div>
                                      <label className="text-xs text-gray-500">Quantity</label>
                                      <Input
                                        type="number"
                                        value={editValues.originalQuantity || 0}
                                        onChange={(e) => setEditValues({...editValues, originalQuantity: parseFloat(e.target.value) || 0})}
                                        className="h-8 text-sm"
                                      />
                                    </div>
                                    <div className="flex gap-2">
                                      <Button
                                        onClick={() => handleSaveEdit(result._id)}
                                        className="h-8 flex-1 text-xs"
                                      >
                                        <Save className="h-3 w-3 mr-1" />
                                        Save
                                      </Button>
                                      <Button
                                        variant="outline"
                                        onClick={handleCancelEdit}
                                        className="h-8 flex-1 text-xs"
                                      >
                                        Cancel
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="grid grid-cols-2 gap-2 text-sm">
                                    <div>
                                      <p className="text-xs text-gray-500">Unit</p>
                                      <p>{displayMatch.matchedUnit || result.originalUnit || '-'}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-gray-500">Rate</p>
                                      <p>{formatPrice(displayMatch.matchedRate || 0)}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-gray-500">Quantity</p>
                                      <p>{result.originalQuantity || 0}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-gray-500">Total</p>
                                      <p className="font-semibold">{formatPrice(displayMatch.totalPrice || 0)}</p>
                                    </div>
                                  </div>
                                )}
                                
                                {/* Confidence Score */}
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-gray-500">Confidence</span>
                                  <span className={cn(
                                    "text-xs px-2 py-1 rounded-full",
                                    getConfidenceColor(displayMatch.confidence || 0)
                                  )}>
                                    {((displayMatch.confidence || 0) * 100).toFixed(0)}%
                                  </span>
                                </div>
                                
                                {/* Action Buttons */}
                                {editingResultId !== result._id && (
                                  <div className="flex gap-2">
                                    <Button
                                      variant="outline"
                                      onClick={() => handleEdit(result)}
                                      className="h-8 flex-1 text-xs"
                                    >
                                      <Edit className="h-3 w-3 mr-1" />
                                      Edit
                                    </Button>
                                    <Button
                                      variant="outline"
                                      onClick={() => handleDelete(result._id)}
                                      className="h-8 flex-1 text-xs"
                                    >
                                      <Trash2 className="h-3 w-3 mr-1 text-red-500" />
                                      Delete
                                    </Button>
                                  </div>
                                )}
                              </div>
                            )}
                          </Card>
                        );
                      })}
                    </div>
                  ))}
                </div>
                
                {/* Total Quotation Sum - Outside scrollable area */}
                {actualItems.length > 0 && (
                  <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="text-base sm:text-lg font-semibold">Total Quotation:</span>
                      <span className="text-lg sm:text-xl font-bold text-green-600 dark:text-green-400">
                        {formatPrice(actualItems.reduce((sum, result) => {
                          const displayMatch = getDisplayMatch(result);
                          return sum + (displayMatch?.totalPrice || 0);
                        }, 0))}
                      </span>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-center py-8 text-muted-foreground">No results found</p>
            )}
          </CardContent>
        </Card>
      </div>

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
      <DiscountMarkupModal
        isOpen={showDiscountModal}
        onClose={() => setShowDiscountModal(false)}
        currentTotal={actualItems.reduce((sum, result) => {
          const displayMatch = getDisplayMatch(result);
          return sum + (displayMatch?.totalPrice || 0);
        }, 0)}
        onApply={handleApplyDiscountMarkup}
      />
    </div>
  );
}
