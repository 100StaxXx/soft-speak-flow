import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { AlertCircle, CheckCircle, Loader2 } from "lucide-react";

type ReferralCodeRecord = {
  id: string;
  code: string;
  is_active: boolean;
  total_signups?: number | null;
  total_conversions?: number | null;
  total_revenue?: number | null;
  payout_identifier?: string | null;
};

type ReferralPayoutRecord = {
  id: string;
  amount: number;
  status: string;
  referral_code_id?: string | null;
  referral_code?: {
    code?: string | null;
    payout_identifier?: string | null;
  } | null;
};

export const AdminReferralTesting = () => {
  const [loading, setLoading] = useState(false);
  const [testResults, setTestResults] = useState<Array<{ step: string; status: 'success' | 'error'; message: string }>>([]);
  
  // Test 1: Create influencer code
  const [influencerName, setInfluencerName] = useState("test-influencer");
  
  // Test 2: Simulate user signup
  const [testCode, setTestCode] = useState("");
  
  // Test 3: Simulate subscription
  const [subUserId, setSubUserId] = useState("");
  
  const addResult = (step: string, status: 'success' | 'error', message: string) => {
    setTestResults(prev => [...prev, { step, status, message }]);
  };

  const clearResults = () => {
    setTestResults([]);
  };

  const fetchReferralCodes = async (): Promise<ReferralCodeRecord[]> => {
    const { data, error } = await supabase.functions.invoke("manage-referral-codes", {
      body: { action: "list" },
    });

    if (error) throw error;
    return Array.isArray(data?.codes) ? data.codes : [];
  };

  const fetchReferralPayouts = async (): Promise<ReferralPayoutRecord[]> => {
    const { data, error } = await supabase.functions.invoke("manage-referral-payouts", {
      body: { action: "list" },
    });

    if (error) throw error;
    return Array.isArray(data?.payouts) ? data.payouts : [];
  };

  const testCreateInfluencerCode = async () => {
    setLoading(true);
    clearResults();
    
    try {
      const testEmail = `${influencerName.toLowerCase().replace(/\s+/g, '')}@test.com`;
      const testHandle = `@${influencerName.toLowerCase().replace(/\s+/g, '_')}`;
      
      addResult("Creating influencer code", 'success', `Attempting to create code for: ${influencerName}`);
      
      const { data, error } = await supabase.functions.invoke('create-influencer-code', {
        body: { 
          name: influencerName,
          email: testEmail,
          handle: testHandle,
          paypal_email: testEmail
        }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      addResult("Influencer code created", 'success', `Code: ${data.code}, Link: ${data.link}`);
      setTestCode(data.code);
      toast.success("Influencer code created successfully!");
    } catch (error: any) {
      addResult("Failed to create code", 'error', error.message);
      toast.error("Failed to create influencer code");
    } finally {
      setLoading(false);
    }
  };

  const testUserSignupWithCode = async () => {
    if (!testCode) {
      toast.error("Please create an influencer code first");
      return;
    }

    setLoading(true);
    try {
      addResult("Testing signup flow", 'success', `Using code: ${testCode}`);

      const codes = await fetchReferralCodes();
      const existingCode = codes.find((code) => code.code === testCode.toUpperCase() && code.is_active);

      if (!existingCode) throw new Error("Code not found or inactive");

      addResult("Code validation", 'success', `Code found: ${existingCode.code}, Signups: ${existingCode.total_signups || 0}`);

      const { data, error } = await supabase.functions.invoke("process-referral", {
        body: {
          referral_code: testCode,
          source_app: "admin-referral-testing",
        },
      });

      if (error) throw error;
      if (data?.success === false) throw new Error(data.error || "Failed to record signup");

      const refreshedCodes = await fetchReferralCodes();
      const refreshedCode = refreshedCodes.find((code) => code.code === testCode.toUpperCase());

      addResult("Signup tracked", 'success', `User signup recorded successfully. Total signups: ${refreshedCode?.total_signups || 0}`);
      toast.success("Signup test completed!");
    } catch (error: any) {
      addResult("Signup test failed", 'error', error.message);
      toast.error("Signup test failed");
    } finally {
      setLoading(false);
    }
  };

  const testSubscriptionConversion = async () => {
    if (!testCode) {
      toast.error("Please create an influencer code first");
      return;
    }

    setLoading(true);
    try {
      addResult("Simulating subscription", 'success', `Testing conversion for code: ${testCode}`);

      const codes = await fetchReferralCodes();
      const codeData = codes.find((code) => code.code === testCode.toUpperCase());

      if (!codeData) throw new Error("Code not found");

      addResult("Code fetched", 'success', `Code ID: ${codeData.id}`);

      // Simulate subscription webhook data
      const mockWebhookData = {
        referralCode: testCode,
        subscriptionType: 'monthly',
        amount: 9.99,
        currency: 'USD',
        userId: subUserId || 'test-user-' + Date.now()
      };

      addResult("Webhook simulation", 'success', `Monthly sub: $${mockWebhookData.amount}`);

      const { data, error } = await supabase.functions.invoke("manage-referral-payouts", {
        body: {
          action: "create_test_conversion",
          code: testCode,
          amount: mockWebhookData.amount,
          plan: mockWebhookData.subscriptionType,
          refereeId: subUserId || undefined,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Failed to create payout record");

      addResult("Payout created", 'success', `Payout ID: ${data.payout?.id}, Amount: $${Number(data.payout_amount || 0).toFixed(2)}`);

      const refreshedCodes = await fetchReferralCodes();
      const refreshedCode = refreshedCodes.find((code) => code.code === testCode.toUpperCase());

      addResult(
        "Stats updated",
        'success',
        `Conversion and revenue tracked. Conversions: ${refreshedCode?.total_conversions || 0}, Revenue: $${Number(refreshedCode?.total_revenue || 0).toFixed(2)}`,
      );
      toast.success("Subscription conversion test completed!");
    } catch (error: any) {
      addResult("Conversion test failed", 'error', error.message);
      toast.error("Conversion test failed");
    } finally {
      setLoading(false);
    }
  };

  const testPayoutApproval = async () => {
    setLoading(true);
    try {
      addResult("Testing payout approval", 'success', "Fetching pending payouts");

      const payouts = await fetchReferralPayouts();
      const payout = payouts.find((item) => item.status === "pending");

      if (!payout) {
        throw new Error("No pending payouts found. Create a subscription conversion first.");
      }

      addResult("Payout found", 'success', `ID: ${payout.id}, Amount: $${payout.amount}, Code: ${payout.referral_code?.code || 'Unknown'}`);
      addResult("Payout check", 'success', `Identifier: ${payout.referral_code?.payout_identifier || 'Not set'}`);

      const { error: approveError } = await supabase.functions.invoke("manage-referral-payouts", {
        body: {
          action: "approve",
          payoutId: payout.id,
        },
      });

      if (approveError) throw approveError;

      addResult("Payout approved", 'success', "Status updated to approved");
      toast.success("Payout approval test completed!");
    } catch (error: any) {
      addResult("Approval test failed", 'error', error.message);
      toast.error("Approval test failed");
    } finally {
      setLoading(false);
    }
  };

  const testPayPalPayout = async () => {
    setLoading(true);
    try {
      addResult("Testing PayPal integration", 'success', "Note: This requires valid PayPal credentials");

      const payouts = await fetchReferralPayouts();
      const payout = payouts.find((item) => item.status === "approved");

      if (!payout) {
        throw new Error("No approved payouts found. Approve a payout first.");
      }

      addResult(
        "Approved payout found",
        'success',
        `ID: ${payout.id}, Amount: $${payout.amount}${payout.referral_code?.code ? `, Code: ${payout.referral_code.code}` : ''}`,
      );

      // Call the PayPal payout function
      const { data, error } = await supabase.functions.invoke('process-paypal-payout', {
        body: { payout_id: payout.id }
      });

      if (error) throw error;

      addResult("PayPal payout initiated", 'success', `Transaction ID: ${data.payoutBatchId || 'N/A'}`);
      toast.success("PayPal payout test completed!");
    } catch (error: any) {
      addResult("PayPal test failed", 'error', error.message);
      toast.error("PayPal test failed - check credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Referral System Testing Suite</CardTitle>
          <CardDescription>
            Test the complete referral flow from code creation to payout processing
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Test 1: Create Code */}
          <div className="space-y-3">
            <h3 className="font-semibold">1. Create Influencer Code</h3>
            <div className="flex gap-2">
              <Input
                placeholder="Influencer name"
                value={influencerName}
                onChange={(e) => setInfluencerName(e.target.value)}
              />
              <Button onClick={testCreateInfluencerCode} disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Code"}
              </Button>
            </div>
          </div>

          {/* Test 2: User Signup */}
          <div className="space-y-3">
            <h3 className="font-semibold">2. Simulate User Signup</h3>
            <div className="flex gap-2">
              <Input
                placeholder="Referral code (auto-filled)"
                value={testCode}
                onChange={(e) => setTestCode(e.target.value)}
              />
              <Button onClick={testUserSignupWithCode} disabled={loading || !testCode}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Test Signup"}
              </Button>
            </div>
          </div>

          {/* Test 3: Subscription */}
          <div className="space-y-3">
            <h3 className="font-semibold">3. Simulate Subscription</h3>
            <div className="flex gap-2">
              <Input
                placeholder="User ID (optional)"
                value={subUserId}
                onChange={(e) => setSubUserId(e.target.value)}
              />
              <Button onClick={testSubscriptionConversion} disabled={loading || !testCode}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Test Conversion"}
              </Button>
            </div>
          </div>

          {/* Test 4: Approval */}
          <div className="space-y-3">
            <h3 className="font-semibold">4. Test Payout Approval</h3>
            <Button onClick={testPayoutApproval} disabled={loading} variant="secondary">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Test Approval"}
            </Button>
          </div>

          {/* Test 5: PayPal */}
          <div className="space-y-3">
            <h3 className="font-semibold">5. Test PayPal Integration</h3>
            <Button onClick={testPayPalPayout} disabled={loading} variant="secondary">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Test PayPal"}
            </Button>
            <p className="text-sm text-muted-foreground">
              Note: Requires valid PayPal API credentials configured
            </p>
          </div>

          {/* Results */}
          {testResults.length > 0 && (
            <div className="space-y-2 mt-6">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Test Results</h3>
                <Button onClick={clearResults} variant="ghost" size="sm">
                  Clear
                </Button>
              </div>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {testResults.map((result, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-lg border ${
                      result.status === 'success' 
                        ? 'bg-green-500/10 border-green-500/20' 
                        : 'bg-red-500/10 border-red-500/20'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {result.status === 'success' ? (
                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-red-500 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <p className="font-medium text-sm">{result.step}</p>
                        <p className="text-xs text-muted-foreground">{result.message}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Documentation Card */}
      <Card>
        <CardHeader>
          <CardTitle>Testing Checklist</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-muted-foreground mt-0.5" />
            <div>
              <p className="font-medium">Code Creation</p>
              <p className="text-muted-foreground">Verify influencer code is created and stored</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-muted-foreground mt-0.5" />
            <div>
              <p className="font-medium">Signup Tracking</p>
              <p className="text-muted-foreground">Confirm signups are tracked and counted</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-muted-foreground mt-0.5" />
            <div>
              <p className="font-medium">Conversion Detection</p>
              <p className="text-muted-foreground">Verify subscription creates payout record</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-muted-foreground mt-0.5" />
            <div>
              <p className="font-medium">Payout Calculation</p>
              <p className="text-muted-foreground">Confirm correct percentage (50% monthly, 20% yearly)</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-muted-foreground mt-0.5" />
            <div>
              <p className="font-medium">Admin Approval</p>
              <p className="text-muted-foreground">Test approval workflow and status updates</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-muted-foreground mt-0.5" />
            <div>
              <p className="font-medium">PayPal Integration</p>
              <p className="text-muted-foreground">Verify PayPal API credentials and payout execution</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
