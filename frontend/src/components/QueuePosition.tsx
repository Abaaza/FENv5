import { useEffect, useState } from 'react';
import { Badge } from './ui/badge';
import { Clock, Users } from 'lucide-react';

interface QueuePositionProps {
  jobId: string;
  status: string;
  createdAt: number;
}

export function QueuePosition({ jobId, status, createdAt }: QueuePositionProps) {
  const [estimatedTime, setEstimatedTime] = useState<string>('');

  useEffect(() => {
    if (status !== 'pending' && status !== 'queued') return;

    const updateEstimate = () => {
      const waitTime = Date.now() - createdAt;
      const seconds = Math.floor(waitTime / 1000);
      
      if (seconds < 5) {
        setEstimatedTime('Starting soon...');
      } else if (seconds < 30) {
        setEstimatedTime('Initializing...');
      } else if (seconds < 60) {
        setEstimatedTime('Processing queue...');
      } else {
        const minutes = Math.floor(seconds / 60);
        setEstimatedTime(`~${minutes} minute${minutes > 1 ? 's' : ''} wait`);
      }
    };

    updateEstimate();
    const interval = setInterval(updateEstimate, 1000);

    return () => clearInterval(interval);
  }, [status, createdAt]);

  if (status !== 'pending' && status !== 'queued') {
    return null;
  }

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <Badge variant="outline" className="text-xs">
        <Clock className="h-3 w-3 mr-1" />
        {estimatedTime}
      </Badge>
    </div>
  );
}