import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";

const INVISIBLE_SEPARATOR = "\u2063";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleCors(req);
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Authenticate user
    const authHeader = req.headers.get("Authorization") ?? "";
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));

    if (authError || !user) {
      return errorResponse(req, "Unauthorized", 401);
    }

    // Parse request body
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const productId = typeof body.product_id === "string" ? body.product_id : "graceward_plus_yearly";
    const offerId = typeof body.offer_id === "string" ? body.offer_id : "Graceward_PromoOffer_yearly";

    // Verify user has a valid offer code applied (via referred_by_code on profile)
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("referred_by_code")
      .eq("id", user.id)
      .single();

    if (profileError) {
      console.error("Profile lookup failed:", profileError);
      return errorResponse(req, "Unable to verify offer eligibility", 500);
    }

    if (!profile?.referred_by_code) {
      return errorResponse(req, "No offer code applied to this account", 403);
    }

    // Load signing credentials
    const keyId = Deno.env.get("APPLE_KEY_ID");
    const privateKeyPem = Deno.env.get("APPLE_PRIVATE_KEY");
    const bundleId = Deno.env.get("APPLE_IOS_BUNDLE_ID");

    if (!keyId || !privateKeyPem || !bundleId) {
      console.error("Missing Apple API configuration for promo offer signing");
      return errorResponse(req, "Offer signing is temporarily unavailable", 500);
    }

    // Generate nonce and timestamp
    const nonce = crypto.randomUUID();
    const timestamp = Date.now();

    // Build the signature payload per Apple's spec:
    // appBundleID + '\u2063' + keyID + '\u2063' + productID + '\u2063' + offerID
    //   + '\u2063' + appAccountToken + '\u2063' + nonce + '\u2063' + timestamp
    const appAccountToken = user.id.toLowerCase();
    const payload = [
      bundleId,
      keyId,
      productId,
      offerId,
      appAccountToken,
      nonce.toLowerCase(),
      String(timestamp),
    ].join(INVISIBLE_SEPARATOR);

    // Import the private key
    const pemLines = privateKeyPem.split("\n");
    const keyBase64 = pemLines
      .filter((line: string) => !line.startsWith("-----"))
      .join("");

    const binString = atob(keyBase64);
    const keyBuffer = new ArrayBuffer(binString.length);
    const keyView = new Uint8Array(keyBuffer);
    for (let i = 0; i < binString.length; i++) {
      keyView[i] = binString.charCodeAt(i);
    }

    const cryptoKey = await crypto.subtle.importKey(
      "pkcs8",
      keyBuffer,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["sign"],
    );

    // Sign the payload with ECDSA P-256 SHA-256
    const signatureBytes = await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      cryptoKey,
      new TextEncoder().encode(payload),
    );

    // Base64-encode the signature
    const signatureArray = new Uint8Array(signatureBytes);
    let signatureBase64 = "";
    for (let i = 0; i < signatureArray.length; i++) {
      signatureBase64 += String.fromCharCode(signatureArray[i]);
    }
    signatureBase64 = btoa(signatureBase64);

    return jsonResponse(req, {
      offerID: offerId,
      keyID: keyId,
      nonce,
      signature: signatureBase64,
      timestamp,
      appAccountToken,
    });
  } catch (error) {
    console.error("Promo offer signature generation failed:", error);
    return errorResponse(req, "Failed to generate offer signature", 500);
  }
});
