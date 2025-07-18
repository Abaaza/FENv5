import { useQuery } from '@tanstack/react-query';
import { useConvex } from 'convex/react';
import { api } from '../../convex/_generated/api';

export interface CurrencySettings {
  currency: string;
  symbol: string;
}

export function useCurrency() {
  const convex = useConvex();
  
  const { data: currencySettings } = useQuery<CurrencySettings>({
    queryKey: ['currency-settings'],
    queryFn: async () => {
      const settings = await convex.query(api.applicationSettings.getCurrencySettings);
      return settings as CurrencySettings;
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  // Default to GBP if not loaded
  const currency = currencySettings?.currency || 'GBP';
  const symbol = currencySettings?.symbol || '£';

  const formatPrice = (amount: number | undefined | null): string => {
    if (amount === undefined || amount === null) return `${symbol}0.00`;
    
    // Format number with commas
    const formatted = amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return `${symbol}${formatted}`;
  };

  return {
    currency,
    symbol,
    formatPrice,
    isLoading: !currencySettings,
  };
}