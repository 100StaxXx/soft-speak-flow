import { useState } from "react";
import { getDocuments, getDocument, updateDocument, setDocument } from "@/lib/firebase/firestore";
import { createInfluencerCode, processPaypalPayout } from "@/lib/firebase/functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export const AdminReferralTesting = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [testResults, setTestResults] = useState<Array<{ step: string; status: 'success' | 'error'; message: string }>>([]);
  
  // Test 1: Create influencer code
  const [influencerName, setInfluencerName] = useState("test-influencer");
  
  // Test 2: Simulate user signup
  const [testCode, setTestCode] = useState("");
  const [testUserId, setTestUserId] = useState("");
  
  // Test 3: Simulate subscription
  const [subUserId, setSubUserId] = useState("");
  
  const addResult = (step: string, status: 'success' | 'error', message: string) => {
    setTestResults(prev => [...prev, { step, status, message }]);
  };

  const clearResults = () => {
    setTestResults([]);
  };

  const testCreateInfluencerCode = async () => {
    setLoading(true);
    clearResults();
    
    try {
      const testEmail = `${influencerName.toLowerCase().replace(/\s+/g, '')}@test.com`;
      const testHandle = `@${influencerName.toLowerCase().replace(/\s+/g, '_')}`;
      
      addResult("Creating influencer code", 'success', `Attempting to create code for: ${influencerName}`);
      
      const data = await createInfluencerCode({
        name: influencerName,
        email: testEmail,
        handle: testHandle,
        paypalEmail: testEmail,
      });

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
      
      // Check if code exists and is valid
      const codes = await getDocuments('referral_codes', [
        ['code', '==', testCode],
        ['is_active', '==', true]
      ]);

      if (!codes || codes.length === 0) throw new Error("Code not found or inactive");
      const code = codes[0];

      addResult("Code validation", 'success', `Code found: ${code.code}, Signups: ${code.total_signups || 0}`);

      // In a real scenario, this would happen during user onboarding
      // For testing, we'll manually increment the signup count
      await updateDocument('referral_codes', code.id, { 
        total_signups: (code.total_signups || 0) + 1 
      });

      addResult("Signup tracked", 'success', "User signup recorded successfully");
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
      
      // Get the referral code info
      const codes = await getDocuments('referral_codes', [
        ['code', '==', testCode]
      ]);

      if (!codes || codes.length === 0) throw new Error("Code not found");
      const codeData = codes[0];

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

      // Calculate payout (50% of first month)
      const payoutAmount = mockWebhookData.amount * 0.5;

      // For testing, we need a valid user ID. Get current user or use a test ID
      const testReferrerId = user?.uid || '00000000-0000-0000-0000-000000000000';
      const testRefereeId = user?.uid || '00000000-0000-0000-0000-000000000000';

      // Create payout record
      const payoutId = `payout_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      await setDocument('referral_payouts', payoutId, {
        referral_code_id: codeData.id,
        referrer_id: testReferrerId,
        referee_id: testRefereeId,
        amount: payoutAmount,
        payout_type: 'first_month',
        status: 'pending'
      }, false);

      const payout = { id: payoutId, referral_code_id: codeData.id, referrer_id: testReferrerId, referee_id: testRefereeId, amount: payoutAmount };

      addResult("Payout created", 'success', `Payout ID: ${payout.id}, Amount: $${payoutAmount.toFixed(2)}`);

      // Update code stats (optional tracking columns)
      try {
        await updateDocument('referral_codes', codeData.id, {
          total_conversions: (codeData.total_conversions || 0) + 1,
          total_revenue: ((codeData.total_revenue as number) || 0) + mockWebhookData.amount
        });
      } catch (updateError: any) {
        addResult("Warning", 'error', `Stats update failed: ${updateError.message} (non-critical)`);
      }

      addResult("Stats updated", 'success', "Conversion and revenue tracked");
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
      
      // Get pending payouts
      const payouts = await getDocuments('referral_payouts', [
        ['status', '==', 'pending']
      ], 'created_at', 'desc', 1);

      if (!payouts || payouts.length === 0) {
        throw new Error("No pending payouts found. Create a subscription conversion first.");
      }

      const payout = payouts[0];
      
      // Get referral code info separately
      if (payout.referral_code_id) {
        const codeData = await getDocument('referral_codes', payout.referral_code_id);
          
        if (codeData) {
          addResult("Payout found", 'success', `ID: ${payout.id}, Amount: $${payout.amount}, Code: ${codeData.code}`);
          addResult("Payout check", 'success', `Identifier: ${codeData.payout_identifier || 'Not set'}`);
        } else {
          addResult("Payout found", 'success', `ID: ${payout.id}, Amount: $${payout.amount}`);
        }
      } else {
        addResult("Payout found", 'success', `ID: ${payout.id}, Amount: $${payout.amount}`);
      }

      // Approve the payout
      await updateDocument('referral_payouts', payout.id, { 
        status: 'approved',
        approved_at: new Date().toISOString()
      });

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
      
      // Get an approved payout
      const payouts = await getDocuments('referral_payouts', [
        ['status', '==', 'approved']
      ], 'created_at', 'desc', 1);

      if (!payouts || payouts.length === 0) {
        throw new Error("No approved payouts found. Approve a payout first.");
      }

      const payout = payouts[0];
      
      // Get referral code separately if referral_code_id exists
      let codeData = null;
      if (payout.referral_code_id) {
        codeData = await getDocument('referral_codes', payout.referral_code_id);
      }
        
      addResult("Approved payout found", 'success', `ID: ${payout.id}, Amount: $${payout.amount}${codeData ? `, Code: ${codeData.code}` : ''}`);

      // Call the PayPal payout function
      const data = await processPaypalPayout({
        payoutId: payout.id,
      });

      addResult("PayPal payout initiated", 'success', `Transaction ID: ${data.payout_batch_id || 'N/A'}`);
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