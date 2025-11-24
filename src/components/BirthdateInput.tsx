import { useState } from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Sparkles } from "lucide-react";
import { format } from "date-fns";

interface BirthdateInputProps {
  onComplete: (birthdate: Date) => void;
}

export const BirthdateInput = ({ onComplete }: BirthdateInputProps) => {
  const [selectedDate, setSelectedDate] = useState<Date>();

  const handleContinue = () => {
    if (selectedDate) {
      onComplete(selectedDate);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-primary/5">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <Card className="p-8 bg-card/80 backdrop-blur-xl border-primary/20 shadow-2xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-center mb-8"
          >
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 mb-4">
              <Sparkles className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent mb-2">
              When Were You Born?
            </h2>
            <p className="text-muted-foreground">
              The stars have a story to tell about you
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex justify-center mb-6"
          >
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
              initialFocus
              className="rounded-lg border border-primary/20"
            />
          </motion.div>

          {selectedDate && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center mb-6"
            >
              <p className="text-sm text-muted-foreground">
                Your birthdate: <span className="text-foreground font-semibold">{format(selectedDate, "MMMM d, yyyy")}</span>
              </p>
            </motion.div>
          )}

          <Button
            onClick={handleContinue}
            disabled={!selectedDate}
            className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity"
            size="lg"
          >
            Continue to Questionnaire
          </Button>
        </Card>
      </motion.div>
    </div>
  );
};