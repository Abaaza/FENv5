import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { Search, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { api } from '../lib/api';
import { useCurrency } from '../hooks/useCurrency';
import { Label } from './ui/label';
import { useDebouncedCallback } from '../hooks/useDebounce';

interface MatchResult {
  _id: string;
  rowNumber: number;
  originalDescription: string;
  originalQuantity?: number;
  originalUnit?: string;
  contextHeaders?: string[];
  matchedRate?: number;
}

interface PriceItem {
  _id: string;
  id: string;
  code?: string;
  description: string;
  unit?: string;
  rate?: number;
  category?: string;
  subcategory?: string;
}

interface ManualMatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: MatchResult | null;
  onSave: (updates: {
    matchedItemId: string;
    matchedDescription: string;
    matchedCode?: string;
    matchedUnit?: string;
    matchedRate: number;
  }) => Promise<void>;
}

export function ManualMatchModal({
  isOpen,
  onClose,
  result,
  onSave,
}: ManualMatchModalProps) {
  const { formatPrice } = useCurrency();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PriceItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<PriceItem | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Guard against undefined result
  if (!result) {
    return null;
  }

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setSearchResults([]);
      setSelectedItem(null);
    }
  }, [isOpen]);

  // Search mutation
  const searchMutation = useMutation({
    mutationFn: async (query: string) => {
      const response = await api.post('/price-list/search', { 
        query, 
        limit: 20 
      });
      return response.data;
    },
    onSuccess: (data) => {
      setSearchResults(data);
      setIsSearching(false);
    },
    onError: (error) => {
      console.error('Search error:', error);
      toast.error('Failed to search price items');
      setIsSearching(false);
    },
  });

  // Debounced search function
  const debouncedSearch = useDebouncedCallback(
    (query: string) => {
      if (query.trim().length >= 2) {
        setIsSearching(true);
        searchMutation.mutate(query);
      } else {
        setSearchResults([]);
      }
    },
    150 // Reduced to 150ms for faster response
  );

  // Handle search input change
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    debouncedSearch(value);
  };

  const handleSelectItem = (item: PriceItem) => {
    setSelectedItem(item);
  };

  const handleSave = async () => {
    if (!selectedItem) {
      toast.error('Please select an item');
      return;
    }

    setIsSaving(true);
    try {
      await onSave({
        matchedItemId: selectedItem._id,
        matchedDescription: selectedItem.description,
        matchedCode: selectedItem.code,
        matchedUnit: selectedItem.unit,
        matchedRate: selectedItem.rate || 0,
      });
      onClose();
      toast.success('Match saved successfully');
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to save match');
    } finally {
      setIsSaving(false);
    }
  };

  const totalPrice = (result.originalQuantity || 0) * (selectedItem?.rate || 0);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-3xl max-h-[95vh] sm:max-h-[80vh] overflow-hidden flex flex-col p-4 sm:p-6" aria-describedby="manual-match-description">
        <DialogHeader>
          <DialogTitle>Manual Price List Search - Row {result.rowNumber}</DialogTitle>
          <p id="manual-match-description" className="sr-only">Search and select a price item to match with the BOQ item</p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          {/* Original Item Info */}
          <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
            <h4 className="font-medium mb-2">Original Item</h4>
            {result.contextHeaders && result.contextHeaders.length > 0 && (
              <div className="mb-2 px-2 py-1 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-700">
                <span className="font-medium">Section:</span> {result.contextHeaders.join(' > ')}
              </div>
            )}
            <p className="text-sm">{result.originalDescription}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 mt-2 text-sm">
              <div>
                <span className="text-muted-foreground">Quantity:</span>{' '}
                <span className="font-medium">{result.originalQuantity || '-'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Unit:</span>{' '}
                <span className="font-medium">{result.originalUnit || '-'}</span>
              </div>
            </div>
          </div>

          {/* Search Box */}
          <div className="space-y-2">
            <Label>Search Price List</Label>
            <div className="relative">
              <Input
                placeholder="Search by description, code, or category..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pr-10"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {isSearching ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : (
                  <Search className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </div>
            {searchQuery.trim().length > 0 && searchQuery.trim().length < 2 && (
              <p className="text-xs text-muted-foreground">Type at least 2 characters to search</p>
            )}
          </div>

          {/* Search Results */}
          {searchQuery.trim().length >= 2 && (
            <div className="space-y-2">
              <Label>
                {isSearching ? 'Searching...' : `Search Results (${searchResults.length})`}
              </Label>
              {searchResults.length > 0 ? (
                <div className="border rounded-lg max-h-64 overflow-y-auto">
                  {searchResults.map((item) => (
                  <button
                    key={item._id}
                    onClick={() => handleSelectItem(item)}
                    className={`w-full p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800 border-b last:border-0 transition-colors ${
                      selectedItem?._id === item._id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="font-medium text-sm">
                        {item.code && <span className="text-muted-foreground">{item.code} - </span>}
                        {item.description}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs text-muted-foreground">
                        <span>Rate: {formatPrice(item.rate || 0)}</span>
                        <span>Unit: {item.unit || '-'}</span>
                        {item.category && <span>Category: {item.category}</span>}
                      </div>
                    </div>
                  </button>
                ))}
                </div>
              ) : (
                !isSearching && (
                  <div className="text-center py-8 text-muted-foreground">
                    <p className="text-sm">No items found</p>
                    <p className="text-xs mt-1">Try different search terms</p>
                  </div>
                )
              )}
            </div>
          )}

          {/* Selected Item Preview */}
          {selectedItem && (
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg space-y-2">
              <h4 className="font-medium">Selected Item</h4>
              <div className="space-y-1 text-sm">
                <p>
                  <span className="text-muted-foreground">Description:</span>{' '}
                  <span className="font-medium">{selectedItem.description}</span>
                </p>
                {selectedItem.code && (
                  <p>
                    <span className="text-muted-foreground">Code:</span>{' '}
                    <span className="font-medium">{selectedItem.code}</span>
                  </p>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 mt-2">
                  <div>
                    <span className="text-muted-foreground">Unit:</span>{' '}
                    <span className="font-medium">{selectedItem.unit || '-'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Rate:</span>{' '}
                    <span className="font-medium">{formatPrice(selectedItem.rate || 0)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Total:</span>{' '}
                    <span className="font-medium text-green-600">{formatPrice(totalPrice)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col-reverse sm:flex-row justify-between items-stretch sm:items-center gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || !selectedItem}
            className="w-full sm:w-auto"
          >
            Apply Selection
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}