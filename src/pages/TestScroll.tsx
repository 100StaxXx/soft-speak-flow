import { useState } from 'react';
import { Pathfinder } from '@/components/Pathfinder/Pathfinder';
import { Button } from '@/components/ui/button';

const TestScroll = () => {
  const [isOpen, setIsOpen] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateEpic = (data: unknown) => {
    console.log('Epic created (mock):', data);
    setIsCreating(true);
    setTimeout(() => {
      setIsCreating(false);
      setIsOpen(false);
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-md mx-auto space-y-4">
        <h1 className="text-2xl font-bold text-foreground">Scroll Test Page</h1>
        <p className="text-muted-foreground">
          This page bypasses authentication to test Pathfinder modal scrolling on TestFlight.
        </p>
        
        <Button onClick={() => setIsOpen(true)} className="w-full">
          Open Pathfinder Modal
        </Button>
        
        <Pathfinder
          open={isOpen}
          onOpenChange={setIsOpen}
          onCreateEpic={handleCreateEpic}
          isCreating={isCreating}
        />
      </div>
    </div>
  );
};

export default TestScroll;
