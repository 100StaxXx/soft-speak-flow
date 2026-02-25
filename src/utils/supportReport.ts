import { supabase } from "@/integrations/supabase/client";
import type { SupportReportPayload } from "@/types/resilience";

export async function submitSupportReport(payload: SupportReportPayload): Promise<void> {
  const { error } = await supabase.functions.invoke("submit-support-report", {
    body: payload,
  });

  if (error) throw error;
}
