import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

interface NameInputProps {
  onComplete: (name: string) => void;
  isLoading?: boolean;
}

export const NameInput = ({ onComplete, isLoading }: NameInputProps) => {
  const [name, setName] = useState<string>("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onComplete(name.trim());
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-accent/10 p-4 flex items-center justify-center">
      <Card className="max-w-md w-full p-8 space-y-6 shadow-glow animate-scale-in">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-heading font-black bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
            What's your name?
          </h1>
          <p className="text-muted-foreground">
            We'll use this to personalize your experience
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-lg font-semibold">
              Your name
            </Label>
            <Input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              className="text-lg h-12"
              maxLength={50}
              autoFocus
              disabled={isLoading}
            />
          </div>

          <Button
            type="submit"
            disabled={!name.trim() || isLoading}
            className="w-full h-12 text-lg font-semibold bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Please wait...
              </>
            ) : (
              "Continue"
            )}
          </Button>
        </form>
      </Card>
    </div>
  );
};
