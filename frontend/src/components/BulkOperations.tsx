import { useState } from 'react';
import { 
  Trash2, 
  Edit3, 
  CheckSquare, 
  Square, 
  AlertTriangle,
  Upload,
  Download,
  Tag,
  Package
} from 'lucide-react';
import { Button } from './ui/button';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from './ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { toast } from 'react-hot-toast';
import { api } from '../lib/api';

interface BulkOperationsProps {
  selectedItems: string[];
  onClearSelection: () => void;
  onRefresh: () => void;
  categories?: string[];
  units?: string[];
}

export function BulkOperations({
  selectedItems,
  onClearSelection,
  onRefresh,
  categories = [],
  units = []
}: BulkOperationsProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [bulkUpdate, setBulkUpdate] = useState({
    category: '',
    unit: '',
    rate_adjustment: '',
    rate_adjustment_type: 'percentage' as 'percentage' | 'fixed'
  });

  const handleBulkDelete = async () => {
    setIsProcessing(true);
    try {
      await api.delete('/price-list/bulk', {
        data: { ids: selectedItems }
      });
      
      toast.success(`Deleted ${selectedItems.length} items`);
      onClearSelection();
      onRefresh();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to delete items');
    } finally {
      setIsProcessing(false);
      setShowDeleteDialog(false);
    }
  };

  const handleBulkUpdate = async () => {
    setIsProcessing(true);
    try {
      const updates: any = {};
      
      if (bulkUpdate.category) updates.category = bulkUpdate.category;
      if (bulkUpdate.unit) updates.unit = bulkUpdate.unit;
      if (bulkUpdate.rate_adjustment) {
        updates.rate_adjustment = {
          value: parseFloat(bulkUpdate.rate_adjustment),
          type: bulkUpdate.rate_adjustment_type
        };
      }
      
      await api.patch('/price-list/bulk', {
        ids: selectedItems,
        updates
      });
      
      toast.success(`Updated ${selectedItems.length} items`);
      onClearSelection();
      onRefresh();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to update items');
    } finally {
      setIsProcessing(false);
      setShowUpdateDialog(false);
      setBulkUpdate({
        category: '',
        unit: '',
        rate_adjustment: '',
        rate_adjustment_type: 'percentage'
      });
    }
  };

  const handleBulkExport = async (format: 'csv' | 'excel') => {
    setIsProcessing(true);
    try {
      const response = await api.post('/price-list/export/selected', {
        ids: selectedItems,
        format
      }, {
        responseType: 'blob'
      });
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `selected_items.${format === 'csv' ? 'csv' : 'xlsx'}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success(`Exported ${selectedItems.length} items`);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to export items');
    } finally {
      setIsProcessing(false);
      setShowExportDialog(false);
    }
  };

  const handleGenerateEmbeddings = async () => {
    setIsProcessing(true);
    try {
      await api.post('/price-list/generate-embeddings', {
        ids: selectedItems
      });
      
      toast.success(`Generated embeddings for ${selectedItems.length} items`);
      onRefresh();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to generate embeddings');
    } finally {
      setIsProcessing(false);
    }
  };

  if (selectedItems.length === 0) {
    return null;
  }

  return (
    <>
      <div className="flex items-center gap-2 p-4 bg-muted/50 rounded-lg">
        <div className="flex items-center gap-2">
          <CheckSquare className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">
            {selectedItems.length} items selected
          </span>
        </div>
        
        <div className="flex-1" />
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowUpdateDialog(true)}
            disabled={isProcessing}
          >
            <Edit3 className="h-4 w-4 mr-1" />
            Bulk Edit
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowExportDialog(true)}
            disabled={isProcessing}
          >
            <Download className="h-4 w-4 mr-1" />
            Export
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleGenerateEmbeddings}
            disabled={isProcessing}
          >
            <Tag className="h-4 w-4 mr-1" />
            Generate AI
          </Button>
          
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setShowDeleteDialog(true)}
            disabled={isProcessing}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Delete
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearSelection}
            disabled={isProcessing}
          >
            Clear
          </Button>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Confirm Bulk Delete
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedItems.length} items? 
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleBulkDelete}
              disabled={isProcessing}
            >
              {isProcessing ? 'Deleting...' : 'Delete Items'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Update Dialog */}
      <Dialog open={showUpdateDialog} onOpenChange={setShowUpdateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Update Items</DialogTitle>
            <DialogDescription>
              Update {selectedItems.length} selected items. Leave fields empty to keep existing values.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={bulkUpdate.category}
                onValueChange={(value) => setBulkUpdate({ ...bulkUpdate, category: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="No change" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No change</SelectItem>
                  {categories.map(cat => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Unit</Label>
              <Select
                value={bulkUpdate.unit}
                onValueChange={(value) => setBulkUpdate({ ...bulkUpdate, unit: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="No change" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No change</SelectItem>
                  {units.map(unit => (
                    <SelectItem key={unit} value={unit}>
                      {unit}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Rate Adjustment</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="0"
                  value={bulkUpdate.rate_adjustment}
                  onChange={(e) => setBulkUpdate({ ...bulkUpdate, rate_adjustment: e.target.value })}
                />
                <Select
                  value={bulkUpdate.rate_adjustment_type}
                  onValueChange={(value: 'percentage' | 'fixed') => 
                    setBulkUpdate({ ...bulkUpdate, rate_adjustment_type: value })
                  }
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">%</SelectItem>
                    <SelectItem value="fixed">Fixed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">
                {bulkUpdate.rate_adjustment_type === 'percentage' 
                  ? 'Increase/decrease by percentage (use negative for decrease)'
                  : 'Add/subtract fixed amount (use negative for subtraction)'}
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowUpdateDialog(false)}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              onClick={handleBulkUpdate}
              disabled={isProcessing}
            >
              {isProcessing ? 'Updating...' : 'Update Items'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Export Dialog */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Export Selected Items</DialogTitle>
            <DialogDescription>
              Choose the format to export {selectedItems.length} selected items.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex gap-4 py-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => handleBulkExport('csv')}
              disabled={isProcessing}
            >
              <Package className="h-4 w-4 mr-2" />
              Export as CSV
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => handleBulkExport('excel')}
              disabled={isProcessing}
            >
              <Package className="h-4 w-4 mr-2" />
              Export as Excel
            </Button>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowExportDialog(false)}
              disabled={isProcessing}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}