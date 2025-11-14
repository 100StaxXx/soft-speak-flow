import { useState } from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function FocusMode() {
  const navigate = useNavigate();
  const [quote] = useState("Lock in. Stay disciplined. Execute.");

  return (
    <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
      <div 
        className="absolute inset-0 bg-gradient-to-br from-primary/20 to-accent/20"
        style={{
          backgroundImage: 'radial-gradient(circle at 50% 50%, hsl(var(--primary) / 0.1) 0%, transparent 50%)',
        }}
      />
      
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 right-4 text-white hover:bg-white/10"
        onClick={() => navigate('/')}
      >
        <X className="w-6 h-6" />
      </Button>

      <div className="relative z-10 text-center space-y-8 px-4">
        <h1 className="text-6xl md:text-8xl font-heading text-white tracking-wider animate-pulse-once">
          FOCUS MODE
        </h1>
        <p className="text-2xl md:text-3xl text-white/80 font-medium max-w-2xl mx-auto">
          {quote}
        </p>
        <div className="w-32 h-1 bg-primary mx-auto animate-pulse-gold" />
      </div>
    </div>
  );
}
