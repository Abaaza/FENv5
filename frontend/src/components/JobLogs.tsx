import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, Info, AlertTriangle, Terminal, Clock, Cpu, Zap, Package, Layers } from 'lucide-react';
import { format } from 'date-fns';
import { Progress } from '@/components/ui/progress';

interface JobLog {
  jobId: string;
  level: 'info' | 'success' | 'warning' | 'error';
  message: string;
  timestamp: string;
}

interface JobLogsProps {
  logs: JobLog[];
  className?: string;
  title?: string;
  jobStatus?: string;
  startTime?: number;
  matchingMethod?: string;
}

export function JobLogs({ logs, className, title = "Processing Logs", jobStatus, startTime, matchingMethod }: JobLogsProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [elapsedTime, setElapsedTime] = useState('00:00');
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);
  const isAIMethod = matchingMethod && ['COHERE', 'OPENAI', 'HYBRID', 'HYBRID_CATEGORY', 'ADVANCED'].includes(matchingMethod);

  // Parse batch progress from logs
  useEffect(() => {
    const batchLog = logs.find(log => log.message.includes('Created') && log.message.includes('batches'));
    if (batchLog) {
      const match = batchLog.message.match(/Created (\d+) batches/);
      if (match) {
        setBatchProgress({ current: 0, total: parseInt(match[1]) });
      }
    }
    
    const batchStartLog = logs.filter(log => log.message.includes('Starting AI batch') || log.message.includes('Starting batch')).pop();
    if (batchStartLog) {
      const match = batchStartLog.message.match(/Starting (?:AI )?batch (\d+)/);
      if (match) {
        setBatchProgress(prev => prev ? { ...prev, current: parseInt(match[1]) } : null);
      }
    }
  }, [logs]);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      // Find the viewport element inside ScrollArea
      const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, [logs]);

  // Timer effect
  useEffect(() => {
    if (!startTime) return;

    const isRunning = jobStatus && !['completed', 'failed', 'cancelled', 'stopped'].includes(jobStatus);
    
    const updateTimer = () => {
      const elapsed = Date.now() - startTime;
      const minutes = Math.floor(elapsed / 60000);
      const seconds = Math.floor((elapsed % 60000) / 1000);
      setElapsedTime(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    };

    updateTimer(); // Initial update

    if (isRunning) {
      const interval = setInterval(updateTimer, 1000);
      return () => clearInterval(interval);
    }
  }, [startTime, jobStatus]);

  const getLogIcon = (level: string, message: string) => {
    // Special icons based on message content
    if (message.includes('batch') || message.includes('Batch')) {
      return <Layers className="h-3 w-3" />;
    }
    if (message.includes('AI') || message.includes('embedding') || message.includes('semantic')) {
      return <Cpu className="h-3 w-3" />;
    }
    if (message.includes('LOCAL') || message.includes('fuzzy')) {
      return <Zap className="h-3 w-3" />;
    }
    if (message.includes('Processing') || message.includes('Fetching')) {
      return <Package className="h-3 w-3" />;
    }
    
    // Default icons based on level
    switch (level) {
      case 'info':
        return <Info className="h-3 w-3" />;
      case 'success':
        return <CheckCircle className="h-3 w-3" />;
      case 'warning':
        return <AlertTriangle className="h-3 w-3" />;
      case 'error':
        return <AlertCircle className="h-3 w-3" />;
      default:
        return <Terminal className="h-3 w-3" />;
    }
  };

  const getLogColor = (level: string) => {
    switch (level) {
      case 'info':
        return 'text-blue-600 dark:text-blue-400';
      case 'success':
        return 'text-green-600 dark:text-green-400';
      case 'warning':
        return 'text-yellow-600 dark:text-yellow-400';
      case 'error':
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getBadgeVariant = (level: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (level) {
      case 'error':
        return 'destructive';
      case 'warning':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  if (logs.length === 0) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Terminal className="h-4 w-4" />
              {title}
              {matchingMethod && (
                <Badge variant="outline" className="text-xs">
                  {matchingMethod}
                </Badge>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              {startTime && (
                <>
                  <span className="text-xs text-muted-foreground">Elapsed:</span>
                  <Badge 
                    variant="outline" 
                    className="text-sm flex items-center gap-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 font-mono animate-pulse px-3 py-1"
                  >
                    <Clock className="h-4 w-4" />
                    <span className="font-bold">{elapsedTime}</span>
                  </Badge>
                </>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground text-sm">
            {jobStatus === 'pending' ? (
              <>
                <div className="animate-pulse">
                  <Terminal className="h-8 w-8 mx-auto mb-2" />
                </div>
                <p className="font-medium">Initializing job...</p>
                <p className="text-xs mt-1">Your job is queued and will start processing shortly</p>
              </>
            ) : jobStatus === 'parsing' ? (
              <>
                <div className="animate-spin">
                  <Terminal className="h-8 w-8 mx-auto mb-2" />
                </div>
                <p className="font-medium">Parsing file...</p>
                <p className="text-xs mt-1">Extracting data from your Excel file</p>
              </>
            ) : (
              <>
                <Terminal className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No logs yet. Processing will begin shortly...</p>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Terminal className="h-4 w-4" />
            {title}
            {matchingMethod && (
              <Badge variant="outline" className="text-xs">
                {matchingMethod}
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            {isAIMethod && batchProgress && batchProgress.total > 0 && (
              <div className="flex items-center gap-2 mr-2">
                <span className="text-xs text-muted-foreground">Batch:</span>
                <Badge variant="outline" className="text-xs">
                  {batchProgress.current} / {batchProgress.total}
                </Badge>
                <div className="w-16">
                  <Progress 
                    value={(batchProgress.current / batchProgress.total) * 100} 
                    className="h-1.5"
                  />
                </div>
              </div>
            )}
            {startTime && (
              <>
                <span className="text-xs text-muted-foreground">Elapsed:</span>
                <Badge 
                  variant="outline" 
                  className="text-sm flex items-center gap-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 font-mono animate-pulse px-3 py-1"
                >
                  <Clock className="h-4 w-4" />
                  <span className="font-bold">{elapsedTime}</span>
                </Badge>
              </>
            )}
            <Badge variant="secondary" className="text-xs">
              {logs.length} logs
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[300px] w-full" ref={scrollAreaRef}>
          <div className="p-4 space-y-2">
            {logs.map((log, index) => {
              const isBatchLog = log.message.includes('batch') || log.message.includes('Batch');
              const isMatchLog = log.message.includes('Matched:') || log.message.includes('confidence');
              const isContextHeader = log.message.includes('Context header') || log.message.includes('context header');
              
              return (
                <div
                  key={`${log.timestamp}-${index}`}
                  className={cn(
                    "flex items-start gap-2 text-xs font-mono",
                    "p-2 rounded-lg",
                    isBatchLog && isAIMethod ? "bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800" :
                    isMatchLog ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800" :
                    isContextHeader ? "bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800" :
                    "bg-muted/50",
                    "animate-in fade-in slide-in-from-bottom-2 duration-200"
                  )}
                >
                  <span className={cn("flex-shrink-0 mt-0.5", getLogColor(log.level))}>
                    {getLogIcon(log.level, log.message)}
                  </span>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant={getBadgeVariant(log.level)} className="text-xs px-1.5 py-0">
                        {log.level.toUpperCase()}
                      </Badge>
                      <span className="text-muted-foreground">
                        {format(new Date(log.timestamp), 'HH:mm:ss.SSS')}
                      </span>
                      {isBatchLog && isAIMethod && (
                        <Badge variant="outline" className="text-xs px-1.5 py-0 bg-purple-100 dark:bg-purple-900/50">
                          BATCH
                        </Badge>
                      )}
                      {isMatchLog && (
                        <Badge variant="outline" className="text-xs px-1.5 py-0 bg-green-100 dark:bg-green-900/50">
                          MATCH
                        </Badge>
                      )}
                    </div>
                    <p className={cn(
                      "break-words leading-relaxed",
                      isMatchLog ? "text-green-700 dark:text-green-300 font-medium" :
                      isBatchLog ? "text-purple-700 dark:text-purple-300 font-medium" :
                      isContextHeader ? "text-yellow-700 dark:text-yellow-300" :
                      "text-foreground/90"
                    )}>
                      {log.message}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}