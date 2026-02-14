import { useState } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Send, Megaphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { 
  ShoutType, 
  ShoutMessage, 
  getShoutsByType, 
  SHOUT_TYPE_CONFIG 
} from "@/data/shoutMessages";

interface SendShoutDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipient: {
    id: string;
    name: string;
    avatarUrl?: string;
  };
  onSendShout: (shoutType: ShoutType, messageKey: string) => void;
  isSending: boolean;
}

export const SendShoutDrawer = ({
  open,
  onOpenChange,
  recipient,
  onSendShout,
  isSending,
}: SendShoutDrawerProps) => {
  const [selectedType, setSelectedType] = useState<ShoutType>('hype');
  const [selectedMessage, setSelectedMessage] = useState<string | null>(null);

  const handleSend = () => {
    if (!selectedMessage) return;
    onSendShout(selectedType, selectedMessage);
    setSelectedMessage(null);
    onOpenChange(false);
  };

  const getInitials = (name: string) => {
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange} shouldScaleBackground={false} handleOnly={true}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="text-center">
          <div className="flex items-center justify-center gap-3 mb-2">
            <Megaphone className="h-6 w-6 text-primary" />
            <DrawerTitle>Send a Shout</DrawerTitle>
          </div>
          <DrawerDescription>
            <div className="flex items-center justify-center gap-2">
              <span>To:</span>
              <Avatar className="h-6 w-6">
                <AvatarImage src={recipient.avatarUrl} />
                <AvatarFallback className="text-xs">
                  {getInitials(recipient.name)}
                </AvatarFallback>
              </Avatar>
              <span className="font-medium text-foreground">{recipient.name}</span>
            </div>
          </DrawerDescription>
        </DrawerHeader>

        <div className="px-4 pb-6 space-y-4" data-vaul-no-drag>
          {/* Shout Type Tabs */}
          <Tabs value={selectedType} onValueChange={(v) => {
            setSelectedType(v as ShoutType);
            setSelectedMessage(null);
          }}>
            <TabsList className="grid w-full grid-cols-4">
              {(Object.keys(SHOUT_TYPE_CONFIG) as ShoutType[]).map((type) => {
                const config = SHOUT_TYPE_CONFIG[type];
                return (
                  <TabsTrigger key={type} value={type} className="text-xs">
                    <span className="mr-1">{config.emoji}</span>
                    {config.label}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {(Object.keys(SHOUT_TYPE_CONFIG) as ShoutType[]).map((type) => (
              <TabsContent key={type} value={type} className="mt-4">
                <div className="grid gap-2 max-h-[40vh] overflow-y-auto" data-vaul-no-drag>
                  {getShoutsByType(type).map((message) => (
                    <MessageCard
                      key={message.key}
                      message={message}
                      isSelected={selectedMessage === message.key}
                      onSelect={() => setSelectedMessage(message.key)}
                    />
                  ))}
                </div>
              </TabsContent>
            ))}
          </Tabs>

          {/* Send Button */}
          <Button
            onClick={handleSend}
            disabled={!selectedMessage || isSending}
            className="w-full"
            size="lg"
          >
            {isSending ? (
              "Sending..."
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send Shout
              </>
            )}
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

interface MessageCardProps {
  message: ShoutMessage;
  isSelected: boolean;
  onSelect: () => void;
}

const MessageCard = ({ message, isSelected, onSelect }: MessageCardProps) => {
  return (
    <Card
      className={cn(
        "p-3 cursor-pointer transition-all",
        isSelected 
          ? "ring-2 ring-primary bg-primary/10 border-primary" 
          : "hover:bg-muted/50"
      )}
      onClick={onSelect}
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl">{message.emoji}</span>
        <p className="text-sm flex-1">{message.text}</p>
      </div>
    </Card>
  );
};
