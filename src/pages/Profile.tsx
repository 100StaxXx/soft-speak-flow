import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Crown, Plus, Trash2, LogOut, Loader2, User, Bell, Repeat } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
      const { data, error } = await supabase.from("reminders").select("*").eq("user_id", user!.id).order("time_of_day");
      if (error) throw error;
      return data;
    },
  });

  const { data: mentors } = useQuery({
    queryKey: ["mentors"],
    queryFn: async () => {
      const { data, error } = await supabase.from("mentors").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: selectedMentor } = useQuery({
    queryKey: ["selected-mentor", profile?.selected_mentor_id],
    enabled: !!profile?.selected_mentor_id,
    queryFn: async () => {
      const { data, error } = await supabase.from("mentors").select("*").eq("id", profile!.selected_mentor_id!).single();
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
      toast({ title: "Error", description: "Please set a time", variant: "destructive" });
      return;
    }
    if (!profile?.is_premium) {
      navigate("/premium");
      return;
    }
    try {
      const { error } = await supabase.from("reminders").insert({ user_id: user.id, time_of_day: newReminderTime, label: newReminderLabel || "Daily lil push", is_active: true });
      if (error) throw error;
      toast({ title: "Reminder added" });
      setNewReminderTime("");
      setNewReminderLabel("");
      refetch();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleChangeMentor = async (mentorId: string) => {
    if (!user) return;
    try {
      const { error } = await supabase.from("profiles").update({ selected_mentor_id: mentorId }).eq("id", user.id);
      if (error) throw error;
      toast({ title: "Mentor updated" });
      window.location.reload();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="max-w-lg mx-auto px-4 py-8 text-center py-12">
          <h2 className="font-display text-3xl text-foreground mb-4">Sign in to view your profile</h2>
          <Button onClick={() => navigate("/auth")} className="bg-gradient-to-r from-primary to-accent text-primary-foreground px-8 py-6 rounded-3xl">Sign In</Button>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="font-display text-4xl text-foreground mb-8">Profile</h1>
        
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <Card className="p-6 bg-card border-border shadow-soft">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="bg-accent/20 p-3 rounded-2xl"><User className="h-5 w-5 text-foreground" /></div>
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="text-foreground font-medium">{user.email}</p>
                </div>
              </div>
              {profile?.is_premium && (
                <div className="bg-gradient-to-r from-primary to-accent text-primary-foreground px-3 py-1 rounded-full flex items-center gap-1.5">
                  <Crown className="h-3.5 w-3.5" /><span className="text-xs font-medium">Premium</span>
                </div>
              )}
            </div>
            {!profile?.is_premium && <Button onClick={() => navigate("/premium")} variant="outline" size="sm" className="w-full"><Crown className="h-4 w-4 mr-2" />Upgrade</Button>}
          </Card>

          <Card className="p-6 bg-card border-border shadow-soft">
            <Label className="text-foreground mb-3 block">Your Mentor</Label>
            {selectedMentor && (
              <div className="flex items-center gap-3 mb-4 p-3 bg-accent/10 rounded-2xl">
                {selectedMentor.avatar_url && <img src={selectedMentor.avatar_url} alt={selectedMentor.name} className="w-10 h-10 rounded-full object-cover" />}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground">{selectedMentor.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{selectedMentor.tone_description}</p>
                </div>
              </div>
            )}
            <Select value={profile?.selected_mentor_id || ""} onValueChange={handleChangeMentor}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Select a mentor" /></SelectTrigger>
              <SelectContent>{mentors?.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
            </Select>
        </Card>

        {/* Mentor Options */}
        <Card className="p-6 mb-6 bg-card border-border shadow-soft">
          <h2 className="font-display text-2xl text-foreground mb-6">Mentor Options</h2>
          <div className="space-y-4">
            <Button 
              onClick={() => navigate("/mentor-selection")} 
              variant="outline"
              className="w-full"
            >
              <User className="h-4 w-4 mr-2" />
              Browse All Mentors
            </Button>
            <Button 
              onClick={() => navigate("/onboarding")} 
              variant="outline"
              className="w-full"
            >
              <Repeat className="h-4 w-4 mr-2" />
              Retake Quiz
            </Button>
          </div>
        </Card>
        </div>

        <Card className="p-6 mb-6 bg-card border-border shadow-soft">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-accent/20 p-2 rounded-xl"><Bell className="h-5 w-5 text-foreground" /></div>
            <h2 className="font-display text-2xl text-foreground">Daily Reminders</h2>
          </div>
          <p className="text-muted-foreground text-sm mb-6">Set times to receive a lil push{!profile?.is_premium && " (Premium)"}</p>
          <div className="space-y-4 mb-6">
            <div><Label htmlFor="time" className="text-foreground">Time</Label><Input id="time" type="time" value={newReminderTime} onChange={(e) => setNewReminderTime(e.target.value)} /></div>
            <div><Label htmlFor="label">Label</Label><Input id="label" placeholder="Morning motivation" value={newReminderLabel} onChange={(e) => setNewReminderLabel(e.target.value)} maxLength={50} /></div>
            <Button onClick={handleAddReminder} disabled={!newReminderTime} className="w-full bg-gradient-to-r from-primary to-accent text-primary-foreground"><Plus className="mr-2 h-4 w-4" />Add Reminder</Button>
          </div>
          {remindersLoading ? <Loader2 className="h-6 w-6 animate-spin mx-auto" /> : reminders?.length ? (
            <div className="space-y-3">{reminders.map((r) => (
              <div key={r.id} className="flex items-center justify-between p-4 bg-accent/10 rounded-2xl border border-border">
                <div className="flex-1"><p className="font-medium text-foreground">{r.time_of_day}</p>{r.label && <p className="text-sm text-muted-foreground">{r.label}</p>}</div>
                <div className="flex items-center gap-3">
                  <Switch checked={r.is_active} onCheckedChange={async () => { await supabase.from("reminders").update({ is_active: !r.is_active }).eq("id", r.id); refetch(); }} />
                  <Button variant="ghost" size="icon" onClick={async () => { await supabase.from("reminders").delete().eq("id", r.id); refetch(); }}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}</div>
          ) : <p className="text-center text-muted-foreground py-8">No reminders</p>}
        </Card>

        <Button onClick={handleSignOut} variant="outline" className="w-full"><LogOut className="mr-2 h-4 w-4" />Sign Out</Button>
      </div>
      <BottomNav />
    </div>
  );
};

export default Profile;
