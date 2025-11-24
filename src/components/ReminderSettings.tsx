import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Bell } from "lucide-react";

interface ReminderSettingsProps {
  enabled: boolean;
  minutesBefore: number;
  onEnabledChange: (enabled: boolean) => void;
  onMinutesChange: (minutes: number) => void;
}

export const ReminderSettings = ({
  enabled,
  minutesBefore,
  onEnabledChange,
  onMinutesChange,
}: ReminderSettingsProps) => {
  const reminderOptions = [
    { value: 5, label: "5 minutes before" },
    { value: 10, label: "10 minutes before" },
    { value: 15, label: "15 minutes before" },
    { value: 30, label: "30 minutes before" },
    { value: 60, label: "1 hour before" },
    { value: 120, label: "2 hours before" },
    { value: 1440, label: "1 day before" },
  ];

  return (
    <div className="space-y-4 p-4 rounded-lg border border-border/50 bg-background/50">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-primary" />
          <Label htmlFor="reminder-enabled" className="text-sm font-medium">
            Smart Reminder
          </Label>
        </div>
        <Switch
          id="reminder-enabled"
          checked={enabled}
          onCheckedChange={onEnabledChange}
        />
      </div>

      {enabled && (
        <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
          <Label htmlFor="reminder-time" className="text-sm text-muted-foreground">
            Remind me
          </Label>
          <Select
            value={minutesBefore.toString()}
            onValueChange={(value) => onMinutesChange(parseInt(value))}
          >
            <SelectTrigger id="reminder-time" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {reminderOptions.map((option) => (
                <SelectItem key={option.value} value={option.value.toString()}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            You'll get a notification before your quest starts
          </p>
        </div>
      )}
    </div>
  );
};
