import { cn } from '@/lib/utils';
import { Loader2, CheckCircle, XCircle, AlertCircle, Clock, PlayCircle } from 'lucide-react';
import { Badge } from './ui/badge';

interface JobStatusIndicatorProps {
  status: string;
  progress?: number;
  progressMessage?: string;
  className?: string;
  showLabel?: boolean;
}

export function JobStatusIndicator({ 
  status, 
  progress = 0, 
  progressMessage,
  className,
  showLabel = true 
}: JobStatusIndicatorProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'pending':
        return {
          icon: <Clock className="h-4 w-4 animate-pulse" />,
          color: 'text-yellow-600 bg-yellow-50',
          label: 'Pending',
          animate: true
        };
      case 'parsing':
        return {
          icon: <Loader2 className="h-4 w-4 animate-spin" />,
          color: 'text-blue-600 bg-blue-50',
          label: 'Parsing',
          animate: true
        };
      case 'matching':
        return {
          icon: <Loader2 className="h-4 w-4 animate-spin" />,
          color: 'text-purple-600 bg-purple-50',
          label: `Matching ${progress > 0 ? `(${progress}%)` : ''}`,
          animate: true
        };
      case 'completed':
        return {
          icon: <CheckCircle className="h-4 w-4" />,
          color: 'text-green-600 bg-green-50',
          label: 'Completed',
          animate: false
        };
      case 'failed':
        return {
          icon: <XCircle className="h-4 w-4" />,
          color: 'text-red-600 bg-red-50',
          label: 'Failed',
          animate: false
        };
      case 'cancelled':
        return {
          icon: <AlertCircle className="h-4 w-4" />,
          color: 'text-gray-600 bg-gray-50',
          label: 'Cancelled',
          animate: false
        };
      default:
        return {
          icon: <PlayCircle className="h-4 w-4" />,
          color: 'text-gray-600 bg-gray-50',
          label: 'Unknown',
          animate: false
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Badge 
        variant="secondary" 
        className={cn(
          "flex items-center gap-1.5 px-2 py-1",
          config.color,
          config.animate && "animate-pulse"
        )}
      >
        {config.icon}
        {showLabel && <span className="text-xs font-medium">{config.label}</span>}
      </Badge>
      {progressMessage && (
        <span className="text-xs text-muted-foreground">{progressMessage}</span>
      )}
    </div>
  );
}