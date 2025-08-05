import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { 
  Search, 
  Upload, 
  Download,
  Filter,
  Package,
  AlertCircle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  Clock,
  Loader2,
  XCircle,
  Plus,
  Edit2,
  X
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { api } from '../lib/api';
import { cn } from '../lib/utils';
import { useConvex } from 'convex/react';
import { api as convexApi } from '../../convex/_generated/api';
import { useForm } from 'react-hook-form';
import { useCurrency } from '../hooks/useCurrency';
import { adaptPriceItems } from '../utils/priceItemAdapter';

interface PriceItem {
  _id: string;
  id: string;
  code?: string;
  ref?: string;
  description: string;
  // Construction-specific fields
  material_type?: string;
  material_grade?: string;
  material_size?: string;
  material_finish?: string;
  category?: string;
  subcategory?: string;
  work_type?: string;
  brand?: string;
  unit?: string;
  rate?: number;
  labor_rate?: number;
  material_rate?: number;
  wastage_percentage?: number;
  // Supplier info
  supplier?: string;
  location?: string;
  availability?: string;
  lastUpdated?: number;
  // Additional fields
  keywords?: string[];
  remark?: string;
}

type SortField = 'code' | 'description' | 'category' | 'rate' | 'unit';
type SortDirection = 'asc' | 'desc';

export default function PriceList() {
  const convex = useConvex();
  const { formatPrice } = useCurrency();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>('all');
  const [showIncompleteOnly, setShowIncompleteOnly] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importJobId, setImportJobId] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState<any>(null);
  const [importRateLimited, setImportRateLimited] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState<any>(null);
  const [deleteRateLimited, setDeleteRateLimited] = useState(false);
  const [showItemDialog, setShowItemDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<PriceItem | null>(null);
  const [sortField, setSortField] = useState<SortField>('description');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 200;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  
  const form = useForm<any>({
    defaultValues: {
      code: '',
      ref: '',
      description: '',
      category: '',
      subcategory: '',
      unit: '',
      rate: 0,
      remark: '',
      keyword1: '',
      keyword2: '',
      phrase1: '',
      phrase2: '',
    },
  });

  // Fetch price items
  const { data: priceItems, isLoading, error, refetch } = useQuery<PriceItem[]>({
    queryKey: ['price-items'],
    queryFn: async () => {
      const response = await api.get('/price-list');
      // Adapt the items to ensure all expected fields are present
      return adaptPriceItems(response.data);
    },
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  // Fetch stats including categories
  const { data: stats } = useQuery({
    queryKey: ['price-list-stats'],
    queryFn: async () => {
      const response = await api.get('/price-list/stats');
      return response.data;
    },
  });

  // Get subcategories for selected category
  const availableSubcategories = React.useMemo(() => {
    if (!priceItems || (priceItems as PriceItem[]).length === 0) return [];
    
    const subcategories = new Set<string>();
    
    (priceItems as PriceItem[]).forEach((item: PriceItem) => {
      // If category is selected, only include subcategories from that category
      if (selectedCategory !== 'all' && item.category !== selectedCategory) {
        return;
      }
      
      // Add subcategory if it exists
      if (item.subcategory && typeof item.subcategory === 'string') {
        subcategories.add(item.subcategory);
      }
    });
    
    const result = Array.from(subcategories).sort();
    console.log('[Filter Debug] Available subcategories for category', selectedCategory, ':', result.length);
    return result;
  }, [priceItems, selectedCategory]);


  // Filter and sort items
  const filteredItems = React.useMemo(() => {
    if (!priceItems || (priceItems as PriceItem[]).length === 0) return [];
    
    const filtered = (priceItems as PriceItem[]).filter((item: PriceItem) => {
      // Search filter
      if (searchTerm && searchTerm.trim() !== '') {
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch = 
          (item.description && item.description.toLowerCase().includes(searchLower)) ||
          (item.code && item.code.toLowerCase().includes(searchLower)) ||
          (item.category && item.category.toLowerCase().includes(searchLower)) ||
          (item.subcategory && item.subcategory.toLowerCase().includes(searchLower));
        
        if (!matchesSearch) return false;
      }
      
      // Category filter
      if (selectedCategory !== 'all' && item.category !== selectedCategory) {
        return false;
      }
      
      // Subcategory filter
      if (selectedSubcategory !== 'all' && item.subcategory !== selectedSubcategory) {
        return false;
      }
      
      // Incomplete filter
      if (showIncompleteOnly) {
        const isIncomplete = !item.category || !item.subcategory || !item.rate || item.rate === 0 || !item.unit || !item.description;
        if (!isIncomplete) return false;
      }
      
      return true;
    });
    
    console.log('[Filter Debug] Filtered items:', filtered.length, 'of', priceItems.length, 
      '| Category:', selectedCategory, '| Subcategory:', selectedSubcategory);
    
    return filtered;
  }, [priceItems, searchTerm, selectedCategory, selectedSubcategory, showIncompleteOnly])
    .sort((a: PriceItem, b: PriceItem) => {
      let aVal = a[sortField] || '';
      let bVal = b[sortField] || '';
      
      if (sortField === 'rate') {
        aVal = Number(aVal) || 0;
        bVal = Number(bVal) || 0;
      }
      
      if (sortDirection === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

  // Pagination
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const paginatedItems = filteredItems.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4" />;
    return sortDirection === 'asc' ? 
      <ArrowUp className="h-4 w-4" /> : 
      <ArrowDown className="h-4 w-4" />;
  };

  const handleExport = async () => {
    try {
      const response = await api.get('/price-list/export', {
        responseType: 'blob',
      });
      
      // Create a download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'price_list.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success('Export completed');
    } catch (error: any) {
      toast.error('Failed to export price list');
      console.error('Export error:', error);
    }
  };

  // Import mutation
  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await api.post('/price-list/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    },
    onSuccess: (data) => {
      if (data.jobId) {
        setImportJobId(data.jobId);
        setShowImportDialog(true);
        startPollingImportStatus(data.jobId);
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Import failed');
    },
  });

  // Poll import status with exponential backoff
  const startPollingImportStatus = (jobId: string) => {
    let pollInterval = 2000; // Start with 2 seconds
    let retryCount = 0;
    const maxInterval = 30000; // Max 30 seconds
    
    const poll = async () => {
      try {
        const response = await api.get(`/price-list/import/${jobId}`);
        const job = response.data;
        
        setImportProgress(job);
        
        // Reset retry count on successful request
        retryCount = 0;
        pollInterval = 2000;
        setImportRateLimited(false);
        
        if (job.status === 'completed' || job.status === 'failed') {
          if (job.status === 'completed' && job.results) {
            const { created, updated, skipped, errors } = job.results;
            const message = `Import completed! Created: ${created}, Updated: ${updated}, Skipped: ${skipped}`;
            
            if (errors && errors.length > 0) {
              toast.error(`${message} (${errors.length} errors)`);
            } else {
              toast.success(message);
            }
            
            queryClient.invalidateQueries({ queryKey: ['price-items'] });
            queryClient.invalidateQueries({ queryKey: ['price-list-stats'] });
          } else if (job.status === 'failed') {
            toast.error(job.error || 'Import failed');
          }
          
          setTimeout(() => {
            setShowImportDialog(false);
            setImportJobId(null);
            setImportProgress(null);
            setImportRateLimited(false);
          }, 3000);
        } else {
          // Continue polling
          setTimeout(poll, pollInterval);
        }
      } catch (error: any) {
        console.error('Error polling import status:', error);
        
        // Handle rate limiting with exponential backoff
        if (error.response?.status === 429) {
          retryCount++;
          pollInterval = Math.min(pollInterval * 2, maxInterval);
          setImportRateLimited(true);
          console.log(`Rate limited, retrying in ${pollInterval/1000} seconds...`);
          setTimeout(poll, pollInterval);
        } else {
          // For other errors, retry with normal interval
          setTimeout(poll, pollInterval);
        }
      }
    };
    
    // Start polling
    poll();
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      const validTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'text/csv'
      ];
      
      if (!validTypes.includes(file.type) && !file.name.match(/\.(xlsx|xls|csv)$/)) {
        toast.error('Please select a valid Excel or CSV file');
        return;
      }
      
      // Validate file size (50MB limit)
      if (file.size > 50 * 1024 * 1024) {
        toast.error('File size must be less than 50MB');
        return;
      }
      
      // Show confirmation
      if (window.confirm('This will import price items from the file. Continue?')) {
        importMutation.mutate(file);
      }
    }
  };

  // Create/Update mutation
  const createUpdateMutation = useMutation({
    mutationFn: async (data: Partial<PriceItem>) => {
      if (editingItem) {
        // Update existing item
        const response = await api.patch(`/price-list/${editingItem._id}`, data);
        return response.data;
      } else {
        // Create new item
        const response = await api.post('/price-list', data);
        return response.data;
      }
    },
    onSuccess: () => {
      toast.success(editingItem ? 'Item updated successfully' : 'Item created successfully');
      setShowItemDialog(false);
      setEditingItem(null);
      form.reset();
      queryClient.invalidateQueries({ queryKey: ['price-items'] });
      queryClient.invalidateQueries({ queryKey: ['price-list-stats'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Operation failed');
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (item: PriceItem) => {
      const response = await api.delete(`/price-list/${item._id}`);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Item deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['price-items'] });
      queryClient.invalidateQueries({ queryKey: ['price-list-stats'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to delete item');
    },
  });

  const handleDelete = (item: PriceItem) => {
    if (window.confirm(`Are you sure you want to delete "${item.description}"?`)) {
      deleteMutation.mutate(item);
    }
  };

  const handleEdit = (item: PriceItem) => {
    setEditingItem(item);
    const keywords = item.keywords || [];
    form.reset({
      code: item.code || '',
      ref: item.ref || '',
      description: item.description || '',
      category: item.category || '',
      subcategory: item.subcategory || '',
      unit: item.unit || '',
      rate: item.rate || 0,
      remark: item.remark || '',
      keyword1: keywords[0] || '',
      keyword2: keywords[1] || '',
      phrase1: keywords[2] || '',
      phrase2: keywords[3] || '',
    });
    setShowItemDialog(true);
  };

  const handleCreate = () => {
    setEditingItem(null);
    form.reset();
    setShowItemDialog(true);
  };

  const onSubmit = (data: any) => {
    // Prepare keywords array from individual fields
    const keywords = [];
    if (data.keyword1) keywords.push(data.keyword1);
    if (data.keyword2) keywords.push(data.keyword2);
    if (data.phrase1) keywords.push(data.phrase1);
    if (data.phrase2) keywords.push(data.phrase2);
    
    const { keyword1, keyword2, phrase1, phrase2, ...itemData } = data;
    const submitData = {
      ...itemData,
      keywords: keywords.length > 0 ? keywords : undefined,
    };
    
    createUpdateMutation.mutate(submitData);
  };

  // Delete all mutation
  const deleteAllMutation = useMutation({
    mutationFn: async () => {
      const response = await api.delete('/price-list/all');
      return response.data;
    },
    onSuccess: (data) => {
      if (data.jobId) {
        setShowDeleteDialog(true);
        startPollingDeleteStatus(data.jobId);
      } else if (data.deletedCount === 0) {
        toast('No items to delete');
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to delete items');
    },
  });

  // Poll delete status with exponential backoff
  const startPollingDeleteStatus = (jobId: string) => {
    setDeleteProgress({ status: 'processing', progress: 0 });
    
    let pollInterval = 2000; // Start with 2 seconds
    let retryCount = 0;
    const maxInterval = 30000; // Max 30 seconds
    
    const poll = async () => {
      try {
        const response = await api.get(`/price-list/import/${jobId}`);
        const job = response.data;
        
        setDeleteProgress(job);
        
        // Reset retry count on successful request
        retryCount = 0;
        pollInterval = 2000;
        setDeleteRateLimited(false);
        
        if (job.status === 'completed' || job.status === 'failed') {
          if (job.status === 'completed') {
            const deletedCount = job.totalItems - (job.results?.errors?.length || 0);
            toast.success(`Deleted ${deletedCount} items successfully`);
            
            queryClient.invalidateQueries({ queryKey: ['price-items'] });
            queryClient.invalidateQueries({ queryKey: ['price-list-stats'] });
          } else if (job.status === 'failed') {
            toast.error(job.error || 'Delete operation failed');
          }
          
          setTimeout(() => {
            setShowDeleteDialog(false);
            setDeleteProgress(null);
            setDeleteRateLimited(false);
          }, 3000);
        } else {
          // Continue polling
          setTimeout(poll, pollInterval);
        }
      } catch (error: any) {
        console.error('Error polling delete status:', error);
        
        // Handle rate limiting with exponential backoff
        if (error.response?.status === 429) {
          retryCount++;
          pollInterval = Math.min(pollInterval * 2, maxInterval);
          setDeleteRateLimited(true);
          console.log(`Rate limited, retrying in ${pollInterval/1000} seconds...`);
          setTimeout(poll, pollInterval);
        } else {
          // For other errors, retry with normal interval
          setTimeout(poll, pollInterval);
        }
      }
    };
    
    // Start polling
    poll();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Button onClick={handleCreate} className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            Add Item
          </Button>
          <Button onClick={handleExport} variant="outline" className="w-full sm:w-auto">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button 
            className="w-full sm:w-auto"
            onClick={() => fileInputRef.current?.click()}
            disabled={importMutation.isPending}
          >
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
          {priceItems && (priceItems as PriceItem[]).length > 0 && (
            <Button 
              variant="destructive" 
              className="w-full sm:w-auto"
              onClick={() => {
                if (window.confirm(`Are you sure you want to delete all ${priceItems.length} items? This action cannot be undone.`)) {
                  deleteAllMutation.mutate();
                }
              }}
              disabled={deleteAllMutation.isPending}
            >
              <X className="h-4 w-4 mr-2" />
              Delete All
            </Button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      </div>

      {/* Import Progress Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Importing Price List</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {importProgress && (
              <>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Progress</span>
                    <span>{importProgress.progress || 0}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                    <div 
                      className="bg-blue-600 h-2.5 rounded-full transition-all duration-500"
                      style={{ width: `${importProgress.progress || 0}%` }}
                    />
                  </div>
                </div>
                
                {importProgress.progressMessage && (
                  <p className="text-sm text-muted-foreground">
                    {importProgress.progressMessage}
                  </p>
                )}
                
                {importProgress.status === 'completed' && importProgress.results && (
                  <div className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle2 className="h-5 w-5" />
                      <span className="font-medium">Import Complete!</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Created:</span>
                        <p className="font-medium">{importProgress.results.created}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Updated:</span>
                        <p className="font-medium">{importProgress.results.updated}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Skipped:</span>
                        <p className="font-medium">{importProgress.results.skipped}</p>
                      </div>
                    </div>
                    {importProgress.results.errors && importProgress.results.errors.length > 0 && (
                      <div className="text-sm text-red-600">
                        {importProgress.results.errors.length} errors occurred
                      </div>
                    )}
                  </div>
                )}
                
                {importProgress.status === 'failed' && (
                  <div className="flex items-center gap-2 text-red-600">
                    <XCircle className="h-5 w-5" />
                    <span>{importProgress.error || 'Import failed'}</span>
                  </div>
                )}
                
                {importProgress.status === 'processing' && (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Processing items...</span>
                  </div>
                )}
                
                {importRateLimited && (
                  <div className="text-sm text-amber-600">
                    Rate limited - slowing down to avoid errors...
                  </div>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by code, description, category..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-9"
                />
              </div>
              <select
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  setSelectedSubcategory('all'); // Reset subcategory when category changes
                  setCurrentPage(1);
                }}
                className="px-4 py-2 border rounded-md bg-background"
              >
                <option value="all">All Categories</option>
                {stats?.categories?.map((category: string) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
              <select
                value={selectedSubcategory}
                onChange={(e) => {
                  setSelectedSubcategory(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-4 py-2 border rounded-md bg-background"
                disabled={selectedCategory === 'all' && availableSubcategories.length === 0}
              >
                <option value="all">All Subcategories</option>
                {availableSubcategories.map((subcategory) => (
                  <option key={subcategory} value={subcategory}>
                    {subcategory}
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="incomplete-only"
                  checked={showIncompleteOnly}
                  onChange={(e) => {
                    setShowIncompleteOnly(e.target.checked);
                    setCurrentPage(1);
                  }}
                  className="rounded border-gray-300"
                />
                <label htmlFor="incomplete-only" className="text-sm font-medium">
                  Incomplete only
                </label>
              </div>
            </div>
            {(selectedCategory !== 'all' || selectedSubcategory !== 'all') && (
              <div className="text-sm text-muted-foreground">
                Showing items in: 
                {selectedCategory !== 'all' && (
                  <span className="font-medium"> {selectedCategory}</span>
                )}
                {selectedCategory !== 'all' && selectedSubcategory !== 'all' && ' > '}
                {selectedSubcategory !== 'all' && (
                  <span className="font-medium">{selectedSubcategory}</span>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Items</p>
                <p className="text-2xl font-bold">{filteredItems.length}</p>
              </div>
              <Package className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Categories</p>
                <p className="text-2xl font-bold">{stats?.categories?.length || 0}</p>
              </div>
              <Filter className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Incomplete Items</p>
                <p className="text-2xl font-bold">{stats?.incompleteCount || 0}</p>
                <p className="text-xs text-muted-foreground mt-1">Missing required fields</p>
              </div>
              <AlertCircle className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Last Updated</p>
                <p className="text-lg font-medium">
                  {stats?.lastUpdated ? new Date(stats.lastUpdated).toLocaleDateString() : 'N/A'}
                </p>
              </div>
              <Upload className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Price Items List */}
      <Card>
        <CardHeader>
          <CardTitle>Price Items</CardTitle>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-4">
              <XCircle className="h-12 w-12 text-red-500" />
              <p className="text-lg font-medium">Failed to load price items</p>
              <p className="text-sm text-muted-foreground">
                {error instanceof Error ? error.message : 'Connection error occurred'}
              </p>
              <Button onClick={() => refetch()} variant="outline">
                <Loader2 className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </div>
          ) : isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-muted-foreground text-lg font-medium">Loading price items...</p>
              <p className="text-sm text-muted-foreground">This may take a moment for large datasets</p>
            </div>
          ) : filteredItems.length > 0 ? (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2 w-24">
                        <button
                          onClick={() => handleSort('code')}
                          className="flex items-center gap-1 hover:text-primary"
                        >
                          Code {getSortIcon('code')}
                        </button>
                      </th>
                      <th className="text-left p-2 min-w-[300px]">
                        <button
                          onClick={() => handleSort('description')}
                          className="flex items-center gap-1 hover:text-primary"
                        >
                          Description {getSortIcon('description')}
                        </button>
                      </th>
                      <th className="text-left p-2">
                        <button
                          onClick={() => handleSort('category')}
                          className="flex items-center gap-1 hover:text-primary"
                        >
                          Category {getSortIcon('category')}
                        </button>
                      </th>
                      <th className="text-left p-2">
                        <button
                          onClick={() => handleSort('unit')}
                          className="flex items-center gap-1 hover:text-primary"
                        >
                          Unit {getSortIcon('unit')}
                        </button>
                      </th>
                      <th className="text-left p-2">
                        <button
                          onClick={() => handleSort('rate')}
                          className="flex items-center gap-1 hover:text-primary"
                        >
                          Rate {getSortIcon('rate')}
                        </button>
                      </th>
                      <th className="text-left p-2 w-20">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedItems.map((item: PriceItem) => {
                      const isIncomplete = !item.category || !item.subcategory || !item.rate || !item.unit || !item.description;
                      
                      return (
                        <tr 
                          key={item._id} 
                          className={cn(
                            "border-b hover:bg-gray-50 dark:hover:bg-gray-800",
                            isIncomplete && "bg-orange-50 dark:bg-orange-900/10"
                          )}
                        >
                          <td className="p-2 font-medium">{item.code || '-'}</td>
                          <td className="p-2" title={item.description}>
                            <div>
                              {item.description || <span className="text-red-500">Missing</span>}
                            </div>
                          </td>
                          <td className="p-2">
                            <div>
                              <div>{item.category || <span className="text-red-500">Missing</span>}</div>
                              {item.subcategory ? (
                                <div className="text-xs text-muted-foreground">{item.subcategory}</div>
                              ) : (
                                <div className="text-xs text-red-500">Missing</div>
                              )}
                            </div>
                          </td>
                          <td className="p-2">
                            {item.unit || <span className="text-red-500">Missing</span>}
                          </td>
                          <td className="p-2 font-medium">
                            {item.rate ? 
                              formatPrice(item.rate) : 
                              <span className="text-red-500">Missing</span>
                            }
                          </td>
                          <td className="p-2">
                            <div className="flex gap-1">
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => handleEdit(item)}
                              >
                                <Edit2 className="h-3 w-3" />
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline"
                                className="text-red-600 hover:text-red-700"
                                onClick={() => handleDelete(item)}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden space-y-4">
                {paginatedItems.map((item: PriceItem) => {
                  const isIncomplete = !item.category || !item.subcategory || !item.rate || !item.unit || !item.description;
                  
                  return (
                    <div 
                      key={item._id} 
                      className={cn(
                        "border rounded-lg p-4 space-y-3",
                        isIncomplete && "border-orange-300 bg-orange-50 dark:bg-orange-900/10"
                      )}
                    >
                      {isIncomplete && (
                        <div className="flex items-center gap-2 text-orange-600 text-sm mb-2">
                          <AlertCircle className="h-4 w-4" />
                          <span>Incomplete item</span>
                        </div>
                      )}
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{item.code || 'No Code'}</p>
                          <p className="text-sm mt-1">
                            {item.description || <span className="text-red-500">No description</span>}
                          </p>
                          {(item.material_type || item.material_grade) && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {item.material_type} {item.material_grade && `- ${item.material_grade}`}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">Unit:</span>
                          <p className="font-medium">
                            {item.unit || <span className="text-red-500">Missing</span>}
                          </p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Category:</span>
                          <p className="font-medium">
                            {item.category || <span className="text-red-500">Missing</span>}
                          </p>
                          {item.subcategory ? (
                            <p className="text-xs text-muted-foreground">{item.subcategory}</p>
                          ) : (
                            <p className="text-xs text-red-500">No subcategory</p>
                          )}
                        </div>
                      </div>
                      
                      <div className="border-t pt-3">
                        <div className="flex justify-between font-bold">
                          <span>Rate:</span>
                          <span className="text-lg">
                            {item.rate ? 
                              formatPrice(item.rate) : 
                              <span className="text-red-500">Missing</span>
                            }
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="flex-1"
                          onClick={() => handleEdit(item)}
                        >
                          <Edit2 className="h-4 w-4 mr-2" />
                          Edit
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => handleDelete(item)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-sm text-muted-foreground">
                    Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredItems.length)} of {filteredItems.length} items
                  </div>
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
                    <div className="flex items-center gap-2">
                      <span className="text-sm">Page</span>
                      <Input
                        type="number"
                        value={currentPage}
                        onChange={(e) => {
                          const page = parseInt(e.target.value) || 1;
                          setCurrentPage(Math.min(Math.max(1, page), totalPages));
                        }}
                        className="w-16 h-8"
                        min="1"
                        max={totalPages}
                      />
                      <span className="text-sm">of {totalPages}</span>
                    </div>
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
            <p className="text-muted-foreground text-center py-8">
              {searchTerm ? 'No items match your search' : 'No price items available'}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={showItemDialog} onOpenChange={setShowItemDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? 'Edit Price Item' : 'Create New Price Item'}
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="code">Code</Label>
                <Input
                  id="code"
                  {...form.register('code')}
                  placeholder="Item code"
                />
              </div>
              
              <div>
                <Label htmlFor="ref">Reference</Label>
                <Input
                  id="ref"
                  {...form.register('ref')}
                  placeholder="Reference number"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                {...form.register('description', { required: true })}
                placeholder="Item description"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="category">Category *</Label>
                <Input
                  id="category"
                  {...form.register('category', { required: true })}
                  placeholder="e.g., Concrete, Steel, Electrical"
                />
              </div>
              
              <div>
                <Label htmlFor="subcategory">Subcategory *</Label>
                <Input
                  id="subcategory"
                  {...form.register('subcategory', { required: true })}
                  placeholder="Subcategory"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="unit">Unit *</Label>
                <Input
                  id="unit"
                  {...form.register('unit', { required: true })}
                  placeholder="e.g., pcs, m², kg, ton"
                />
              </div>
              
              <div>
                <Label htmlFor="rate">Rate *</Label>
                <Input
                  id="rate"
                  type="number"
                  step="0.01"
                  {...form.register('rate', { required: true, valueAsNumber: true })}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-medium text-sm">Keywords & Phrases</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="keyword1">Keyword 1</Label>
                  <Input
                    id="keyword1"
                    {...form.register('keyword1')}
                    placeholder="e.g., concrete"
                  />
                </div>
                
                <div>
                  <Label htmlFor="keyword2">Keyword 2</Label>
                  <Input
                    id="keyword2"
                    {...form.register('keyword2')}
                    placeholder="e.g., reinforced"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="phrase1">Phrase 1</Label>
                  <Input
                    id="phrase1"
                    {...form.register('phrase1')}
                    placeholder="e.g., high strength concrete"
                  />
                </div>
                
                <div>
                  <Label htmlFor="phrase2">Phrase 2</Label>
                  <Input
                    id="phrase2"
                    {...form.register('phrase2')}
                    placeholder="e.g., reinforced concrete beam"
                  />
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="remark">Remark</Label>
              <Textarea
                id="remark"
                {...form.register('remark')}
                placeholder="Additional notes or remarks"
                rows={2}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowItemDialog(false);
                  setEditingItem(null);
                  form.reset();
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createUpdateMutation.isPending}>
                {createUpdateMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                {editingItem ? 'Update' : 'Create'} Item
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Progress Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Deleting All Price Items</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {deleteProgress && (
              <>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Progress</span>
                    <span>{deleteProgress.progress || 0}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                    <div 
                      className="bg-red-600 h-2.5 rounded-full transition-all duration-500"
                      style={{ width: `${deleteProgress.progress || 0}%` }}
                    />
                  </div>
                </div>
                
                {deleteProgress.progressMessage && (
                  <p className="text-sm text-muted-foreground">
                    {deleteProgress.progressMessage}
                  </p>
                )}
                
                {deleteProgress.status === 'completed' && (
                  <div className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle2 className="h-5 w-5" />
                      <span className="font-medium">Delete Complete!</span>
                    </div>
                    {deleteProgress.totalItems && (
                      <p className="text-sm">
                        Successfully deleted {deleteProgress.totalItems - (deleteProgress.results?.errors?.length || 0)} of {deleteProgress.totalItems} items
                      </p>
                    )}
                    {deleteProgress.results?.errors && deleteProgress.results.errors.length > 0 && (
                      <div className="text-sm text-red-600">
                        {deleteProgress.results.errors.length} errors occurred
                      </div>
                    )}
                  </div>
                )}
                
                {deleteProgress.status === 'failed' && (
                  <div className="flex items-center gap-2 text-red-600">
                    <XCircle className="h-5 w-5" />
                    <span>{deleteProgress.error || 'Delete operation failed'}</span>
                  </div>
                )}
                
                {deleteProgress.status === 'processing' && (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Deleting items...</span>
                  </div>
                )}
                
                {deleteRateLimited && (
                  <div className="text-sm text-amber-600">
                    Rate limited - slowing down to avoid errors...
                  </div>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
