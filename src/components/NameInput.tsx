import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface NameInputProps {
  onComplete: (name: string) => void;
  isLoading?: boolean;
}

export const NameInput = ({ onComplete, isLoading }: NameInputProps) => {
  const [name, setName] = useState<string>("");
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const trimmedName = name.trim();
    
    // Validate name
    if (!trimmedName) {
      toast({
        title: "Name required",
        description: "Please enter your name",
        variant: "destructive",
      });
      return;
    }
    
    if (trimmedName.length < 2) {
      toast({
        title: "Name too short",
        description: "Name must be at least 2 characters",
        variant: "destructive",
      });
      return;
    }
    
    if (trimmedName.length > 50) {
      toast({
        title: "Name too long",
        description: "Name must be less than 50 characters",
        variant: "destructive",
      });
      return;
    }
    
    // Check for invalid characters (allow letters, spaces, hyphens, apostrophes)
    if (!/^[a-zA-Z\s\-']+$/.test(trimmedName)) {
      toast({
        title: "Invalid characters",
        description: "Name can only contain letters, spaces, hyphens, and apostrophes",
        variant: "destructive",
      });
      return;
    }
    
    onComplete(trimmedName);
  };

  return (
    <div className="min-h-screen p-4 flex items-center justify-center relative overflow-hidden z-10">
      
      <Card className="max-w-md w-full p-8 space-y-8 shadow-glow animate-scale-in relative backdrop-blur-sm bg-card/90 border-primary/20">
        <div className="text-center space-y-4">
          <div className="flex justify-center mb-2">
            <Sparkles className="h-8 w-8 text-primary animate-pulse" />
          </div>
          
          <h1 className="text-4xl font-heading font-black bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent leading-tight animate-fade-in">
            Your journey begins here
          </h1>
          
          <p className="text-lg text-muted-foreground font-medium animate-fade-in" style={{ animationDelay: '0.1s' }}>
            What name shall we carve onto your path?
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 animate-fade-in" style={{ animationDelay: '0.2s' }}>
          <div className="space-y-3">
            <Input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name..."
              className="text-lg h-14 bg-secondary/50 border-2 border-primary/20 focus:border-primary focus:ring-2 focus:ring-primary/30 transition-all duration-300 placeholder:text-muted-foreground/50"
              maxLength={50}
              autoFocus
              disabled={isLoading}
            />
          </div>

          <Button
            type="submit"
            disabled={!name.trim() || isLoading}
            className="w-full h-14 text-lg font-bold bg-gradient-to-r from-primary to-accent hover:opacity-90 hover:scale-[1.02] transition-all duration-300 shadow-lg hover:shadow-primary/50"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Preparing your journey...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-5 w-5" />
                Begin Adventure
              </>
            )}
          </Button>
        </form>
      </Card>
    </div>
  );
};
