const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  return new Response(
    JSON.stringify({
      success: true,
      deprecated: true,
      message: "Contact reminder delivery now runs exclusively through notifications-enqueue-v2 and notifications-dispatch-v2.",
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
