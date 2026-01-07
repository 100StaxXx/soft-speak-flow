import { useState, useEffect, useRef, memo } from "react";
import { useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, RefreshCw, Smartphone, Check, X, Copy, Trash2, RotateCcw, Settings, Loader2 } from "lucide-react";
import { useAppleSubscription } from "@/hooks/useAppleSubscription";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface LogEntry {
  timestamp: string;
  message: string;
  type: 'info' | 'error' | 'success';
}

const StatusBadge = memo(({ value, label }: { value: boolean | string; label: string }) => {
  const isBoolean = typeof value === 'boolean';
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      {isBoolean ? (
        <span className={`flex items-center gap-1 text-sm font-medium ${value ? 'text-green-500' : 'text-red-500'}`}>
          {value ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
          {value ? 'Yes' : 'No'}
        </span>
      ) : (
        <span className="text-sm font-medium text-foreground">{value}</span>
      )}
    </div>
  );
});
StatusBadge.displayName = 'StatusBadge';

const IAPTest = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [manualTransactionId, setManualTransactionId] = useState("");
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [purchasingProductId, setPurchasingProductId] = useState<string | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const {
    products,
    productsLoading,
    productError,
    handlePurchase,
    handleRestore,
    handleManageSubscriptions,
    loading,
    hasLoadedProducts,
  } = useAppleSubscription();

  // Environment info
  const platform = Capacitor.getPlatform();
  const isNative = Capacitor.isNativePlatform();
  const isIOS = platform === 'ios';

  // Add log entry
  const addLog = (message: string, type: LogEntry['type'] = 'info') => {
    const timestamp = new Date().toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
    });
    setLogs(prev => [...prev.slice(-100), { timestamp, message, type }]);
  };

  // Intercept console.log for IAP-related messages
  useEffect(() => {
    const originalLog = console.log;
    const originalError = console.error;

    console.log = (...args) => {
      originalLog(...args);
      const message = args.map(a => 
        typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)
      ).join(' ');
      if (message.includes('[IAP') || message.includes('[HOOK') || message.includes('[Apple')) {
        addLog(message, 'info');
      }
    };

    console.error = (...args) => {
      originalError(...args);
      const message = args.map(a => 
        typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)
      ).join(' ');
      if (message.includes('[IAP') || message.includes('[HOOK') || message.includes('[Apple')) {
        addLog(message, 'error');
      }
    };

    addLog('IAP Test Page initialized', 'info');
    addLog(`Platform: ${platform}, Native: ${isNative}, iOS: ${isIOS}`, 'info');

    return () => {
      console.log = originalLog;
      console.error = originalError;
    };
  }, [platform, isNative, isIOS]);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Handle purchase with logging
  const handleTestPurchase = async (productId: string) => {
    setPurchasingProductId(productId);
    addLog(`Starting purchase for: ${productId}`, 'info');
    try {
      await handlePurchase(productId);
      addLog(`Purchase completed for: ${productId}`, 'success');
    } catch (error) {
      addLog(`Purchase failed: ${error instanceof Error ? error.message : String(error)}`, 'error');
    } finally {
      setPurchasingProductId(null);
    }
  };

  // Handle restore with logging
  const handleTestRestore = async () => {
    addLog('Starting restore purchases...', 'info');
    try {
      await handleRestore();
      addLog('Restore completed', 'success');
    } catch (error) {
      addLog(`Restore failed: ${error instanceof Error ? error.message : String(error)}`, 'error');
    }
  };

  // Manual verification
  const verifyManualTransaction = async () => {
    if (!manualTransactionId.trim()) {
      toast({ title: "Error", description: "Please enter a transaction ID", variant: "destructive" });
      return;
    }

    setIsVerifying(true);
    setVerificationResult(null);
    addLog(`Verifying transaction: ${manualTransactionId}`, 'info');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const { data, error } = await supabase.functions.invoke('verify-apple-receipt', {
        body: { transactionId: manualTransactionId },
        headers: session?.access_token ? {
          Authorization: `Bearer ${session.access_token}`
        } : undefined
      });

      if (error) {
        addLog(`Verification error: ${error.message}`, 'error');
        setVerificationResult({ error: error.message });
      } else {
        addLog('Verification successful', 'success');
        setVerificationResult(data);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      addLog(`Verification exception: ${message}`, 'error');
      setVerificationResult({ error: message });
    } finally {
      setIsVerifying(false);
    }
  };

  // Copy logs to clipboard
  const copyLogs = () => {
    const logText = logs.map(l => `[${l.timestamp}] ${l.message}`).join('\n');
    navigator.clipboard.writeText(logText);
    toast({ title: "Copied", description: "Logs copied to clipboard" });
  };

  // Clear logs
  const clearLogs = () => {
    setLogs([]);
    addLog('Logs cleared', 'info');
  };

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-lg font-bold">🧪 IAP Test Page</h1>
            <p className="text-xs text-muted-foreground">Development & Debug Tools</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {/* Environment Status */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Smartphone className="h-4 w-4" />
              Environment
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <StatusBadge label="Platform" value={platform} />
            <StatusBadge label="Native" value={isNative} />
            <StatusBadge label="iOS" value={isIOS} />
            <StatusBadge label="Products Loaded" value={hasLoadedProducts} />
            <StatusBadge label="IAP Available" value={isNative && isIOS && hasLoadedProducts} />
          </CardContent>
        </Card>

        {/* Products */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">App Store Products</CardTitle>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => window.location.reload()}
                disabled={productsLoading}
              >
                <RefreshCw className={`h-4 w-4 ${productsLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            {productsLoading && (
              <div className="text-sm text-muted-foreground py-4 text-center">
                Loading products...
              </div>
            )}
            
            {productError && (
              <div className="text-sm text-red-500 py-2 px-3 bg-red-500/10 rounded-lg">
                {productError}
              </div>
            )}

            {!productsLoading && !productError && products.length === 0 && (
              <div className="text-sm text-muted-foreground py-4 text-center">
                No products available. {!isNative && "(Run on device to load)"}
              </div>
            )}

            {products.map((product) => (
              <div 
                key={product.productId} 
                className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
              >
                <div>
                  <p className="font-medium text-sm">{product.title || product.productId}</p>
                  <p className="text-xs text-muted-foreground">
                    {product.price} • {product.productId}
                  </p>
                </div>
                <Button 
                  size="sm" 
                  onClick={() => handleTestPurchase(product.productId)}
                  disabled={purchasingProductId === product.productId}
                >
                  {purchasingProductId === product.productId ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Buy'
                  )}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Manual Verification */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Manual Verification</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            <div className="space-y-2">
              <Label htmlFor="transactionId" className="text-xs">Transaction ID</Label>
              <div className="flex gap-2">
                <Input
                  id="transactionId"
                  placeholder="Enter transaction ID..."
                  value={manualTransactionId}
                  onChange={(e) => setManualTransactionId(e.target.value)}
                  className="font-mono text-sm"
                />
                <Button 
                  onClick={verifyManualTransaction} 
                  disabled={isVerifying}
                  size="sm"
                >
                  {isVerifying ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify'}
                </Button>
              </div>
            </div>

            {verificationResult && (
              <div className="mt-3">
                <Label className="text-xs">Result</Label>
                <ScrollArea className="h-32 mt-1">
                  <pre className="text-xs bg-muted/50 p-3 rounded-lg overflow-x-auto font-mono">
                    {JSON.stringify(verificationResult, null, 2)}
                  </pre>
                </ScrollArea>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Debug Console */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Debug Console</CardTitle>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={copyLogs}>
                  <Copy className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={clearLogs}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <ScrollArea className="h-48 bg-muted/30 rounded-lg">
              <div className="p-3 space-y-1 font-mono text-xs">
                {logs.length === 0 ? (
                  <div className="text-muted-foreground">No logs yet...</div>
                ) : (
                  logs.map((log, i) => (
                    <div 
                      key={i} 
                      className={`
                        ${log.type === 'error' ? 'text-red-400' : ''}
                        ${log.type === 'success' ? 'text-green-400' : ''}
                        ${log.type === 'info' ? 'text-muted-foreground' : ''}
                      `}
                    >
                      <span className="opacity-50">[{log.timestamp}]</span> {log.message}
                    </div>
                  ))
                )}
                <div ref={logsEndRef} />
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleTestRestore}
                disabled={loading}
                className="text-xs"
              >
                <RotateCcw className={`h-3 w-3 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
                Restore Purchases
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleManageSubscriptions}
                className="text-xs"
              >
                <Settings className="h-3 w-3 mr-1.5" />
                Manage Subs
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card className="border-dashed">
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground leading-relaxed">
              <strong>How to test:</strong> Build in Xcode → Run on device/simulator → 
              Use Sandbox Apple ID for purchases → Transactions appear in console above.
              Access this page by long-pressing "Command Center" on Profile.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default IAPTest;
