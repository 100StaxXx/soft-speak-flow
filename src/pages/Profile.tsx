import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Crown, Plus, Trash2, LogOut, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";

const Profile = () => {
  const { user, signOut } = useAuth();
  const { profile } = useProfile();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [newReminderTime, setNewReminderTime] = useState("");
  const [newReminderLabel, setNewReminderLabel] = useState("");

  const { data: reminders, isLoading: remindersLoading, refetch } = useQuery({
    queryKey: ["reminders", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reminders")
        .select("*")
        .eq("user_id", user!.id)
        .order("time_of_day", { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const handleAddReminder = async () => {
    if (!user || !newReminderTime) {
      toast({
        title: "Error",
        description: "Please set a time for the reminder",
        variant: "destructive",
      });
      return;
    }

    if (!profile?.is_premium) {
      navigate("/premium");
      return;
    }

    try {
      const { error } = await supabase.from("reminders").insert({
        user_id: user.id,
        time_of_day: newReminderTime,
        label: newReminderLabel || "Daily lil push",
        is_active: true,
      });

      if (error) throw error;

      toast({
        title: "Reminder added",
        description: "You'll get a lil push at this time",
      });

      setNewReminderTime("");
      setNewReminderLabel("");
      refetch();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleToggleReminder = async (reminderId: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from("reminders")
        .update({ is_active: !isActive })
        .eq("id", reminderId);

      if (error) throw error;
      refetch();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteReminder = async (reminderId: string) => {
    try {
      const { error } = await supabase
        .from("reminders")
        .delete()
        .eq("id", reminderId);

      if (error) throw error;

      toast({
        title: "Reminder deleted",
      });

      refetch();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-cream-glow via-petal-pink/20 to-lavender-mist/30 pb-24">
        <div className="max-w-lg mx-auto px-4 py-8">
          <div className="text-center py-12">
            <h2 className="font-display text-3xl text-warm-charcoal mb-4">
              Sign in to view your profile
            </h2>
            <Button
              onClick={() => navigate("/auth")}
              className="bg-gradient-to-r from-blush-rose to-soft-mauve hover:opacity-90 text-white font-medium px-8 py-6 rounded-3xl shadow-soft"
            >
              Sign In
            </Button>
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-cream-glow via-petal-pink/20 to-lavender-mist/30 pb-24">
      <div className="max-w-lg mx-auto px-4 py-8">
        <h1 className="font-display text-4xl text-warm-charcoal mb-2 text-center">
          Profile
        </h1>
        <p className="text-warm-charcoal/70 text-center mb-8">
          {profile?.email}
        </p>

        {/* Premium Status */}
        <Card className="p-6 mb-6 bg-gradient-to-br from-white/60 to-petal-pink/20 border-petal-pink/30">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-warm-charcoal mb-1">
                Subscription Status
              </h3>
              {profile?.is_premium ? (
                <div className="flex items-center gap-2">
                  <Crown className="h-5 w-5 text-gold-accent" />
                  <span className="text-warm-charcoal">Premium Member</span>
                </div>
              ) : (
                <p className="text-warm-charcoal/60">Free</p>
              )}
            </div>
            {!profile?.is_premium && (
              <Button
                onClick={() => navigate("/premium")}
                className="bg-gradient-to-r from-gold-accent to-soft-mauve hover:opacity-90 text-white rounded-3xl"
              >
                <Crown className="h-4 w-4 mr-2" />
                Go Premium
              </Button>
            )}
          </div>
        </Card>

        {/* Reminders Section */}
        <Card className="p-6 mb-6 bg-white/50 border-petal-pink/30">
          <h3 className="font-medium text-warm-charcoal mb-4">
            Daily Reminders
            {!profile?.is_premium && (
              <span className="text-xs text-warm-charcoal/60 ml-2">(Premium)</span>
            )}
          </h3>

          {/* Add Reminder Form */}
          <div className="space-y-3 mb-6 pb-6 border-b border-petal-pink/20">
            <div>
              <Label htmlFor="time">Time</Label>
              <Input
                id="time"
                type="time"
                value={newReminderTime}
                onChange={(e) => setNewReminderTime(e.target.value)}
                className="border-petal-pink/30 focus:border-blush-rose"
              />
            </div>
            <div>
              <Label htmlFor="label">Label (optional)</Label>
              <Input
                id="label"
                type="text"
                placeholder="Morning lil push"
                value={newReminderLabel}
                onChange={(e) => setNewReminderLabel(e.target.value)}
                className="border-petal-pink/30 focus:border-blush-rose"
              />
            </div>
            <Button
              onClick={handleAddReminder}
              className="w-full bg-blush-rose hover:opacity-90 text-white rounded-3xl"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Reminder
            </Button>
          </div>

          {/* Reminders List */}
          {remindersLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-blush-rose" />
            </div>
          ) : reminders && reminders.length > 0 ? (
            <div className="space-y-3">
              {reminders.map((reminder) => (
                <div
                  key={reminder.id}
                  className="flex items-center justify-between p-3 rounded-2xl bg-petal-pink/10"
                >
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={reminder.is_active}
                      onCheckedChange={() =>
                        handleToggleReminder(reminder.id, reminder.is_active)
                      }
                    />
                    <div>
                      <p className="font-medium text-warm-charcoal">
                        {reminder.time_of_day}
                      </p>
                      <p className="text-sm text-warm-charcoal/60">
                        {reminder.label}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteReminder(reminder.id)}
                  >
                    <Trash2 className="h-4 w-4 text-warm-charcoal/40 hover:text-blush-rose" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-warm-charcoal/60 py-6 text-sm">
              No reminders set
            </p>
          )}
        </Card>

        {/* Sign Out */}
        <Button
          onClick={handleSignOut}
          variant="outline"
          className="w-full border-2 border-blush-rose/30 text-warm-charcoal hover:bg-blush-rose/10 rounded-3xl py-6"
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sign Out
        </Button>
      </div>

      <BottomNav />
    </div>
  );
};

export default Profile;
