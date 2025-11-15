import { supabase } from "@/integrations/supabase/client";

export async function transcribePepTalk(pepTalkId: string, audioUrl: string) {
  try {
    console.log('Starting transcription for:', pepTalkId);
    
    // Call the transcribe-audio function
    const { data: transcriptData, error: transcriptError } = await supabase.functions.invoke(
      "transcribe-audio",
      {
        body: { audioUrl },
      }
    );

    if (transcriptError) throw transcriptError;

    if (transcriptData?.transcript) {
      // Update the pep talk with the transcript
      const { error: updateError } = await supabase
        .from("pep_talks")
        .update({ transcript: transcriptData.transcript })
        .eq("id", pepTalkId);

      if (updateError) throw updateError;

      console.log('Transcription complete:', transcriptData.transcript.length, 'words');
      return { success: true, transcript: transcriptData.transcript };
    }

    throw new Error('No transcript data returned');
  } catch (error) {
    console.error('Transcription error:', error);
    return { success: false, error };
  }
}
