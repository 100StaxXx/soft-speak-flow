import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Calendar, Download, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";

export const CalendarSync = () => {
  const { toast } = useToast();
  const { user } = useAuth();

  const exportToICalendar = async () => {
    try {
      const { data: tasks } = await supabase
        .from('daily_tasks')
        .select('*')
        .eq('user_id', user!.id)
        .gte('task_date', format(new Date(), 'yyyy-MM-dd'))
        .order('task_date', { ascending: true });

      if (!tasks || tasks.length === 0) {
        toast({
          title: "No quests to export",
          description: "Add some quests first to export them",
        });
        return;
      }

      // Generate iCal format
      let ical = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//R-Evolution Quest Calendar//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:R-Evolution Quests
X-WR-TIMEZONE:UTC
`;

      tasks.forEach((task) => {
        const dtstart = task.scheduled_time 
          ? `${task.task_date.replace(/-/g, '')}T${task.scheduled_time.replace(/:/g, '')}00Z`
          : `${task.task_date.replace(/-/g, '')}`;
        
        const dtend = task.scheduled_time && task.estimated_duration
          ? (() => {
              const [hours, minutes] = task.scheduled_time.split(':').map(Number);
              const startMinutes = hours * 60 + minutes;
              const endMinutes = startMinutes + task.estimated_duration;
              const endHours = Math.floor(endMinutes / 60);
              const endMins = endMinutes % 60;
              return `${task.task_date.replace(/-/g, '')}T${String(endHours).padStart(2, '0')}${String(endMins).padStart(2, '0')}00Z`;
            })()
          : dtstart;

        ical += `BEGIN:VEVENT
UID:${task.id}@r-evolution.app
DTSTAMP:${format(new Date(), "yyyyMMdd'T'HHmmss'Z'")}
DTSTART:${dtstart}
DTEND:${dtend}
SUMMARY:${task.task_text}${task.is_main_quest ? ' 👑 Main Quest' : ''}
DESCRIPTION:XP Reward: ${task.xp_reward}${task.difficulty ? `\\nDifficulty: ${task.difficulty}` : ''}
STATUS:${task.completed ? 'COMPLETED' : 'CONFIRMED'}
`;

        if (task.reminder_enabled && task.reminder_minutes_before) {
          ical += `BEGIN:VALARM
ACTION:DISPLAY
DESCRIPTION:Quest Reminder: ${task.task_text}
TRIGGER:-PT${task.reminder_minutes_before}M
END:VALARM
`;
        }

        ical += `END:VEVENT
`;
      });

      ical += `END:VCALENDAR`;

      // Download the file
      const blob = new Blob([ical], { type: 'text/calendar' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `r-evolution-quests-${format(new Date(), 'yyyy-MM-dd')}.ics`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Calendar exported! 📅",
        description: "Import this file into Google Calendar or Apple Calendar",
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Export failed",
        description: "Could not export your quests",
        variant: "destructive",
      });
    }
  };

  const syncWithGoogleCalendar = async () => {
    try {
      // Initialize Google Calendar API
      const { data, error } = await supabase.functions.invoke('sync-google-calendar');
      
      if (error) throw error;

      toast({
        title: "Google Calendar sync initiated! 🔄",
        description: "Your quests are being synced with Google Calendar",
      });
    } catch (error) {
      console.error('Google sync error:', error);
      toast({
        title: "Sync setup needed",
        description: "Complete Google Calendar setup in settings first",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Calendar className="h-5 w-5 text-primary" />
        <h3 className="font-semibold">Calendar Sync</h3>
      </div>

      <div className="space-y-3">
        <Button
          onClick={exportToICalendar}
          variant="outline"
          className="w-full justify-start gap-2"
        >
          <Download className="h-4 w-4" />
          Export to Apple/Google Calendar (.ics)
        </Button>

        <Button
          onClick={syncWithGoogleCalendar}
          variant="outline"
          className="w-full justify-start gap-2"
        >
          <Upload className="h-4 w-4" />
          Sync with Google Calendar
        </Button>

        <p className="text-xs text-muted-foreground">
          Export creates a calendar file you can import. Sync keeps your calendars updated automatically.
        </p>
      </div>
    </Card>
  );
};
