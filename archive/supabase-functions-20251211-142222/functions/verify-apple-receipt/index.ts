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
    const receipt = body?.receipt as string | undefined;
    if (!receipt) {
      throw new Error("Receipt data required");
    }

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

    return jsonResponse(req, {
      success: true,
      environment,
      subscription: buildSubscriptionResponse(subscription),
    });
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
