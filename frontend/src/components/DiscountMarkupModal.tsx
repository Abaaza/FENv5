import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { useCurrency } from '../hooks/useCurrency';
import { Percent, TrendingUp, TrendingDown } from 'lucide-react';

interface DiscountMarkupModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTotal: number;
  onApply: (type: 'discount' | 'markup', percentage: number) => void;
}

export function DiscountMarkupModal({
  isOpen,
  onClose,
  currentTotal,
  onApply
}: DiscountMarkupModalProps) {
  const { formatPrice } = useCurrency();
  const [type, setType] = useState<'discount' | 'markup'>('discount');
  const [percentage, setPercentage] = useState<number>(0);
  
  const calculateNewTotal = () => {
    const adjustment = (currentTotal * percentage) / 100;
    if (type === 'discount') {
      return currentTotal - adjustment;
    } else {
      return currentTotal + adjustment;
    }
  };
  
  const adjustmentAmount = (currentTotal * percentage) / 100;
  const newTotal = calculateNewTotal();
  
  const handleApply = () => {
    if (percentage > 0) {
      onApply(type, percentage);
      onClose();
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md" aria-describedby="discount-markup-description">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Percent className="h-5 w-5" />
            Apply Discount or Markup
          </DialogTitle>
        </DialogHeader>
        <p id="discount-markup-description" className="sr-only">
          Apply a discount or markup percentage to the selected items total value
        </p>
        
        <div className="space-y-4">
          {/* Type Selection */}
          <div className="space-y-2">
            <Label>Type</Label>
            <RadioGroup value={type} onValueChange={(value) => setType(value as 'discount' | 'markup')}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="discount" id="discount" />
                <Label htmlFor="discount" className="flex items-center gap-2 cursor-pointer">
                  <TrendingDown className="h-4 w-4 text-red-500" />
                  Discount
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="markup" id="markup" />
                <Label htmlFor="markup" className="flex items-center gap-2 cursor-pointer">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  Markup
                </Label>
              </div>
            </RadioGroup>
          </div>
          
          {/* Percentage Input */}
          <div className="space-y-2">
            <Label htmlFor="percentage">Percentage (%)</Label>
            <Input
              id="percentage"
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={percentage}
              onChange={(e) => setPercentage(parseFloat(e.target.value) || 0)}
              placeholder="Enter percentage"
            />
          </div>
          
          {/* Preview */}
          <div className="space-y-2 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Current Total:</span>
              <span className="font-medium">{formatPrice(currentTotal)}</span>
            </div>
            {percentage > 0 && (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {type === 'discount' ? 'Discount' : 'Markup'} ({percentage}%):
                  </span>
                  <span className={type === 'discount' ? 'text-red-600' : 'text-green-600'}>
                    {type === 'discount' ? '-' : '+'}{formatPrice(adjustmentAmount)}
                  </span>
                </div>
                <div className="border-t pt-2 mt-2">
                  <div className="flex justify-between">
                    <span className="font-medium">New Total:</span>
                    <span className="font-bold text-lg">{formatPrice(newTotal)}</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleApply} 
            disabled={percentage <= 0}
          >
            Apply {type === 'discount' ? 'Discount' : 'Markup'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}