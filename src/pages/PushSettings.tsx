import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { PushNotificationSettings } from "@/components/PushNotificationSettings";
import { BottomNav } from "@/components/BottomNav";
import { ProtectedRoute } from "@/components/ProtectedRoute";

function PushSettingsContent() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="container max-w-2xl mx-auto p-4 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-heading font-black">Push Notifications</h1>
            <p className="text-sm text-muted-foreground">Manage your notification preferences</p>
          </div>
        </div>

        <PushNotificationSettings />
      </div>
      <BottomNav />
    </div>
  );
}

export default function PushSettings() {
  return (
    <ProtectedRoute>
      <PushSettingsContent />
    </ProtectedRoute>
  );
}

