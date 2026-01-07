import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { SmartDayPlannerWizard } from '@/components/SmartDayPlanner/SmartDayPlannerWizard';
import { Compass, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function TestDayPlanner() {
  const [wizardOpen, setWizardOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-md mx-auto space-y-6">
        <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        
        <div className="text-center space-y-4">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <Compass className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Smart Day Planner Test</h1>
          <p className="text-muted-foreground">
            Test the 5-step wizard flow without authentication.
          </p>
        </div>

        <Button 
          onClick={() => setWizardOpen(true)} 
          className="w-full"
          size="lg"
        >
          <Compass className="h-5 w-5 mr-2" />
          Open Smart Day Planner
        </Button>

        <div className="text-sm text-muted-foreground space-y-2 p-4 bg-muted/50 rounded-lg">
          <p className="font-medium">Wizard Steps:</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Quick Start - Use defaults or customize</li>
            <li>Check In - Energy level & availability</li>
            <li>Anchors - Protect habits & milestones</li>
            <li>Shape - Design day flow</li>
            <li>Review - Finalize & save plan</li>
          </ol>
        </div>
      </div>

      <SmartDayPlannerWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        planDate={new Date()}
        onComplete={() => {
          console.log('Plan completed!');
        }}
      />
    </div>
  );
}
