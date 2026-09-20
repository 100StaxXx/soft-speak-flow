// Isolate the live backend dependencies from app-only catalog changes.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handleProcessCompanionCinemaEvent } from "../../production-baseline/20260920-companion/supabase/functions/process-companion-cinema-event/index.ts";
export { handleProcessCompanionCinemaEvent, isCosmiqCinemaProductMode } from "../../production-baseline/20260920-companion/supabase/functions/process-companion-cinema-event/index.ts";

if (import.meta.main) serve(handleProcessCompanionCinemaEvent);
