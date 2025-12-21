import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import {
  verifyReceiptWithApple,
  extractLatestTransaction,
  resolvePlanFromProduct,
  upsertSubscription,
  buildSubscriptionResponse,
} from "../_shared/appleSubscriptions.ts";
import {
  verifyTransaction,
  AppleTransactionInfo,
} from "../_shared/appleServerAPI.ts";

/**
 * Verify Apple Receipt / Transaction
 * 
 * Supports two verification methods:
 * 1. StoreKit 2 (preferred): Pass { transactionId: "..." }
 * 2. Legacy receipts (fallback): Pass { receipt: "base64..." }
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleCors(req);
  }

  try {
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Unauthorized");
    }

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const {
      data: { user },
    } = await anonClient.auth.getUser();

    if (!user) {
      throw new Error("Unauthorized");
    }

    const body = await req.json();
    const transactionId = body?.transactionId as string | undefined;
    const receipt = body?.receipt as string | undefined;

    // Prefer StoreKit 2 transaction verification
    if (transactionId) {
      console.log(`[verify-apple-receipt] Using App Store Server API v2 for transaction: ${transactionId}`);
      
      const { transactionInfo, environment } = await verifyTransaction(transactionId);
      
      const plan = resolvePlanFromProduct(transactionInfo.productId);
      const expiresAt = transactionInfo.expiresDate 
        ? new Date(transactionInfo.expiresDate) 
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // Default 30 days if no expiry
      const purchaseDate = new Date(transactionInfo.purchaseDate);
      const cancellationDate = transactionInfo.revocationDate 
        ? new Date(transactionInfo.revocationDate) 
        : undefined;

      const subscription = await upsertSubscription(serviceClient, {
        userId: user.id,
        transactionId: transactionInfo.originalTransactionId || transactionInfo.transactionId,
        productId: transactionInfo.productId,
        plan,
        expiresAt,
        purchaseDate,
        cancellationDate,
        environment,
        source: "receipt",
      });

      console.log(`[verify-apple-receipt] Subscription verified via API v2: ${subscription?.id}`);

      return jsonResponse(req, {
        success: true,
        environment,
        verificationMethod: "app_store_server_api_v2",
        subscription: buildSubscriptionResponse(subscription),
      });
    }

    // Fallback to legacy receipt verification
    if (receipt) {
      console.log("[verify-apple-receipt] Using legacy verifyReceipt API");
      
      const { result, environment } = await verifyReceiptWithApple(receipt);
      const latestTransaction = extractLatestTransaction(result);

      if (!latestTransaction) {
        throw new Error("No subscription transaction found in receipt");
      }

      if (!latestTransaction.transactionId) {
        throw new Error("Missing transaction identifier");
      }

      const plan = resolvePlanFromProduct(latestTransaction.productId);

      const subscription = await upsertSubscription(serviceClient, {
        userId: user.id,
        transactionId: latestTransaction.transactionId,
        productId: latestTransaction.productId,
        plan,
        expiresAt: latestTransaction.expiresAt,
        purchaseDate: latestTransaction.purchaseDate,
        cancellationDate: latestTransaction.cancellationDate ?? undefined,
        environment,
        source: "receipt",
      });

      console.log(`[verify-apple-receipt] Subscription verified via legacy API: ${subscription?.id}`);

      return jsonResponse(req, {
        success: true,
        environment,
        verificationMethod: "legacy_verify_receipt",
        subscription: buildSubscriptionResponse(subscription),
      });
    }

    throw new Error("Either transactionId or receipt is required");
  } catch (error) {
    console.error("Error verifying receipt:", error);

    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    let statusCode = 500;

    if (errorMessage === "Unauthorized") {
      statusCode = 401;
    } else if (errorMessage.includes("not found")) {
      statusCode = 404;
    } else if (errorMessage.includes("invalid") || errorMessage.includes("required") || errorMessage.includes("already register")) {
      statusCode = 400;
    }

    return errorResponse(req, errorMessage, statusCode);
  }
});
