import { supabase } from "@/integrations/supabase/client";

export async function transcribePepTalk(pepTalkId: string, audioUrl: string) {
  try {
    const { data: transcriptData, error: transcriptError } = await supabase.functions.invoke(
      "transcribe-audio",
      { body: { audioUrl } }
    );

    if (transcriptError) throw transcriptError;

    if (transcriptData?.transcript) {
      const { error: updateError } = await supabase
        .from("pep_talks")
        .update({ transcript: transcriptData.transcript })
        .eq("id", pepTalkId);

      if (updateError) throw updateError;
      return { success: true, transcript: transcriptData.transcript };
    }

    throw new Error('No transcript data returned');
  } catch (error) {
    return { success: false, error };
  }
}
