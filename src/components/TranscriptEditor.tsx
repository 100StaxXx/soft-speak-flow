import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, Save } from "lucide-react";
import { toast } from "sonner";

interface CaptionWord {
  word: string;
  start: number;
  end: number;
}

interface TranscriptEditorProps {
  transcript: CaptionWord[];
  onChange: (transcript: CaptionWord[]) => void;
  audioUrl?: string;
}

export const TranscriptEditor = ({ transcript, onChange, audioUrl }: TranscriptEditorProps) => {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const handleAddWord = () => {
    const lastWord = transcript[transcript.length - 1];
    const newWord: CaptionWord = {
      word: "",
      start: lastWord ? lastWord.end : 0,
      end: lastWord ? lastWord.end + 0.5 : 0.5,
    };
    onChange([...transcript, newWord]);
    setEditingIndex(transcript.length);
  };

  const handleUpdateWord = (index: number, field: keyof CaptionWord, value: string | number) => {
    const updated = [...transcript];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const handleDeleteWord = (index: number) => {
    const updated = transcript.filter((_, i) => i !== index);
    onChange(updated);
    toast.success("Word removed");
  };

  const handleImportText = (text: string) => {
    const words = text.trim().split(/\s+/);
    const avgDuration = 0.4; // Average word duration in seconds
    
    const newTranscript: CaptionWord[] = words.map((word, index) => ({
      word,
      start: index * avgDuration,
      end: (index + 1) * avgDuration,
    }));
    
    onChange(newTranscript);
    toast.success(`Imported ${words.length} words`);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Transcript Editor</CardTitle>
        <CardDescription>
          Manually add or edit word-by-word timestamps for synchronized captions
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Quick Import */}
        <div className="space-y-2">
          <Label>Quick Import from Text</Label>
          <div className="flex gap-2">
            <Input
              placeholder="Paste text to auto-generate timestamps..."
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                  handleImportText(e.currentTarget.value);
                  e.currentTarget.value = '';
                }
              }}
            />
            <Button
              variant="outline"
              onClick={(e) => {
                const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                if (input?.value.trim()) {
                  handleImportText(input.value);
                  input.value = '';
                }
              }}
            >
              Import
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Paste text and press Enter to auto-generate timestamps (0.4s per word)
          </p>
        </div>

        {/* Word List */}
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          <div className="flex items-center justify-between">
            <Label>Words ({transcript.length})</Label>
            <Button size="sm" variant="outline" onClick={handleAddWord}>
              <Plus className="h-4 w-4 mr-1" />
              Add Word
            </Button>
          </div>

          {transcript.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No words yet. Import text or add words manually.
            </div>
          ) : (
            <div className="space-y-2">
              {transcript.map((item, index) => (
                <div
                  key={index}
                  className="grid grid-cols-[1fr_100px_100px_40px] gap-2 items-center p-2 bg-secondary/30 rounded-lg"
                >
                  <Input
                    value={item.word}
                    onChange={(e) => handleUpdateWord(index, 'word', e.target.value)}
                    placeholder="Word"
                    className="bg-background"
                  />
                  <Input
                    type="number"
                    step="0.1"
                    value={item.start}
                    onChange={(e) => handleUpdateWord(index, 'start', parseFloat(e.target.value))}
                    placeholder="Start"
                    className="bg-background"
                  />
                  <Input
                    type="number"
                    step="0.1"
                    value={item.end}
                    onChange={(e) => handleUpdateWord(index, 'end', parseFloat(e.target.value))}
                    placeholder="End"
                    className="bg-background"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteWord(index)}
                    aria-label="Delete word"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Stats */}
        {transcript.length > 0 && (
          <div className="text-sm text-muted-foreground">
            Total duration: {transcript[transcript.length - 1]?.end.toFixed(1)}s
          </div>
        )}
      </CardContent>
    </Card>
  );
};
