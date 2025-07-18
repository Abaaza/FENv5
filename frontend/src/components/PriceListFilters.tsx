import { useState } from 'react';
import { 
  Filter, 
  X, 
  ChevronDown,
  Package,
  DollarSign,
  Hash,
  Layers
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from './ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from './ui/popover';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { cn } from '../lib/utils';

interface FilterOptions {
  categories: string[];
  subcategories: string[];
  units: string[];
  materialTypes: string[];
  workTypes: string[];
}

interface ActiveFilters {
  category?: string;
  subcategory?: string;
  unit?: string;
  materialType?: string;
  workType?: string;
  minRate?: number;
  maxRate?: number;
  hasCode?: boolean;
  hasEmbedding?: boolean;
  isComplete?: boolean;
}

interface PriceListFiltersProps {
  filterOptions: FilterOptions;
  activeFilters: ActiveFilters;
  onFiltersChange: (filters: ActiveFilters) => void;
  totalItems: number;
  filteredCount: number;
}

export function PriceListFilters({
  filterOptions,
  activeFilters,
  onFiltersChange,
  totalItems,
  filteredCount
}: PriceListFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [tempFilters, setTempFilters] = useState<ActiveFilters>(activeFilters);

  const activeFilterCount = Object.values(activeFilters).filter(v => 
    v !== undefined && v !== '' && v !== null
  ).length;

  const handleApplyFilters = () => {
    onFiltersChange(tempFilters);
    setIsOpen(false);
  };

  const handleClearFilters = () => {
    const cleared = {};
    setTempFilters(cleared);
    onFiltersChange(cleared);
  };

  const handleRemoveFilter = (key: keyof ActiveFilters) => {
    const updated = { ...activeFilters };
    delete updated[key];
    onFiltersChange(updated);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Filter className="h-4 w-4" />
              Filters
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {activeFilterCount}
                </Badge>
              )}
              <ChevronDown className={cn(
                "h-4 w-4 transition-transform",
                isOpen && "rotate-180"
              )} />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-96 p-4" align="start">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Advanced Filters</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearFilters}
                  className="h-8 px-2 text-xs"
                >
                  Clear all
                </Button>
              </div>

              <Separator />

              <div className="grid gap-4">
                {/* Category Filter */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-sm">
                    <Layers className="h-4 w-4" />
                    Category
                  </Label>
                  <Select
                    value={tempFilters.category || ''}
                    onValueChange={(value) => 
                      setTempFilters({ ...tempFilters, category: value || undefined })
                    }
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="All categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All categories</SelectItem>
                      {filterOptions.categories.map(cat => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Unit Filter */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-sm">
                    <Package className="h-4 w-4" />
                    Unit
                  </Label>
                  <Select
                    value={tempFilters.unit || ''}
                    onValueChange={(value) => 
                      setTempFilters({ ...tempFilters, unit: value || undefined })
                    }
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="All units" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All units</SelectItem>
                      {filterOptions.units.map(unit => (
                        <SelectItem key={unit} value={unit}>
                          {unit}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Price Range */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-sm">
                    <DollarSign className="h-4 w-4" />
                    Price Range
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="Min"
                      value={tempFilters.minRate || ''}
                      onChange={(e) => 
                        setTempFilters({ 
                          ...tempFilters, 
                          minRate: e.target.value ? Number(e.target.value) : undefined 
                        })
                      }
                      className="h-9"
                    />
                    <Input
                      type="number"
                      placeholder="Max"
                      value={tempFilters.maxRate || ''}
                      onChange={(e) => 
                        setTempFilters({ 
                          ...tempFilters, 
                          maxRate: e.target.value ? Number(e.target.value) : undefined 
                        })
                      }
                      className="h-9"
                    />
                  </div>
                </div>

                {/* Additional Filters */}
                <div className="space-y-2">
                  <Label className="text-sm">Additional Filters</Label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={tempFilters.hasCode || false}
                        onChange={(e) => 
                          setTempFilters({ 
                            ...tempFilters, 
                            hasCode: e.target.checked || undefined 
                          })
                        }
                        className="rounded border-gray-300"
                      />
                      Has item code
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={tempFilters.hasEmbedding || false}
                        onChange={(e) => 
                          setTempFilters({ 
                            ...tempFilters, 
                            hasEmbedding: e.target.checked || undefined 
                          })
                        }
                        className="rounded border-gray-300"
                      />
                      Has AI embeddings
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={tempFilters.isComplete || false}
                        onChange={(e) => 
                          setTempFilters({ 
                            ...tempFilters, 
                            isComplete: e.target.checked || undefined 
                          })
                        }
                        className="rounded border-gray-300"
                      />
                      Complete items only
                    </label>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="flex justify-between gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsOpen(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleApplyFilters}
                  className="flex-1"
                >
                  Apply Filters
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <div className="text-sm text-muted-foreground">
          Showing {filteredCount} of {totalItems} items
        </div>
      </div>

      {/* Active Filter Tags */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-2">
          {activeFilters.category && (
            <Badge variant="secondary" className="gap-1">
              Category: {activeFilters.category}
              <button
                onClick={() => handleRemoveFilter('category')}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {activeFilters.unit && (
            <Badge variant="secondary" className="gap-1">
              Unit: {activeFilters.unit}
              <button
                onClick={() => handleRemoveFilter('unit')}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {(activeFilters.minRate || activeFilters.maxRate) && (
            <Badge variant="secondary" className="gap-1">
              Price: {activeFilters.minRate || 0} - {activeFilters.maxRate || '∞'}
              <button
                onClick={() => {
                  const updated = { ...activeFilters };
                  delete updated.minRate;
                  delete updated.maxRate;
                  onFiltersChange(updated);
                }}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {activeFilters.hasCode && (
            <Badge variant="secondary" className="gap-1">
              Has Code
              <button
                onClick={() => handleRemoveFilter('hasCode')}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {activeFilters.hasEmbedding && (
            <Badge variant="secondary" className="gap-1">
              Has AI Embeddings
              <button
                onClick={() => handleRemoveFilter('hasEmbedding')}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {activeFilters.isComplete && (
            <Badge variant="secondary" className="gap-1">
              Complete Only
              <button
                onClick={() => handleRemoveFilter('isComplete')}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}