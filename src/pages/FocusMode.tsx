import { useState } from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function FocusMode() {
  const navigate = useNavigate();
  const [quote] = useState("Lock in. Stay disciplined. Execute.");

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-background via-background to-accent/10 z-50 flex items-center justify-center">
      <div 
        className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-accent/20"
        style={{
          backgroundImage: 'radial-gradient(circle at 30% 30%, hsl(var(--primary) / 0.15) 0%, transparent 50%), radial-gradient(circle at 70% 70%, hsl(var(--accent) / 0.1) 0%, transparent 50%)',
        }}
      />
      
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 md:top-6 right-4 md:right-6 text-foreground/70 hover:text-foreground hover:bg-primary/10 transition-all z-10"
        onClick={() => navigate('/')}
      >
        <X className="w-6 h-6" />
      </Button>

      <div className="relative z-10 text-center space-y-6 md:space-y-8 px-4 max-w-4xl mx-auto">
        <h1 className="text-5xl md:text-7xl lg:text-8xl font-heading font-black text-foreground tracking-wider animate-pulse-once drop-shadow-lg">
          FOCUS MODE
        </h1>
        <p className="text-xl md:text-2xl lg:text-3xl text-foreground/80 font-bold max-w-2xl mx-auto leading-relaxed">
          {quote}
        </p>
        <div className="w-24 md:w-32 h-1 bg-gradient-to-r from-transparent via-primary to-transparent mx-auto animate-pulse-gold" />
        <p className="text-sm md:text-base text-muted-foreground mt-8">
          Eliminate distractions. Execute with purpose.
        </p>
      </div>
    </div>
  );
}
