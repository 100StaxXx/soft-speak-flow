import { memo, useCallback, useState } from "react";
import { Bell, CheckCheck, ChevronRight, Loader2, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  usePushNotificationsInbox,
  type PushNotificationInboxItem,
} from "@/hooks/usePushNotificationsInbox";
import { useRemainingTodayBadgeCount } from "@/hooks/useDailyTaskBadgeSync";
import { cn } from "@/lib/utils";
import { logger } from "@/utils/logger";
import { PRODUCT } from "@/config/product";

const formatDeliveredAt = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${formatDistanceToNow(date, { addSuffix: true })}`;
};

export const GlobalNotificationTray = memo(({ enabled = true }: { enabled?: boolean }) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const {
    items,
    unreadCount,
    isLoading,
    markOpened,
    markAllRead,
    isMarkingAllRead,
  } = usePushNotificationsInbox({ enabled });
  const { count: remainingTodayCount } = useRemainingTodayBadgeCount({ enabled });
  const remainingTodayLabel = remainingTodayCount === 1
    ? "1 item left today"
    : `${remainingTodayCount} items left today`;

  const handleOpenNotification = useCallback(async (item: PushNotificationInboxItem) => {
    try {
      await markOpened(item.id);
    } catch (error) {
      logger.warn("Failed to mark push notification opened", {
        error: error instanceof Error ? error.message : String(error),
        notificationId: item.id,
      });
    }

    setOpen(false);
    navigate(item.destinationPath);
  }, [markOpened, navigate]);

  const handleOpenRemainingToday = useCallback(() => {
    setOpen(false);
    navigate("/mentor");
  }, [navigate]);

  const handleMarkAllRead = useCallback(async () => {
    try {
      await markAllRead();
    } catch (error) {
      logger.warn("Failed to mark push notifications read", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, [markAllRead]);

  if (!enabled) return null;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="fixed right-4 top-[calc(env(safe-area-inset-top,0px)+0.75rem)] z-40 h-10 w-10 rounded-full border-border/70 bg-card/[0.82] shadow-[0_12px_28px_rgba(0,0,0,0.22)] backdrop-blur-xl"
          aria-label={remainingTodayCount > 0 ? `Open notifications, ${remainingTodayCount} remaining today` : "Open notifications"}
        >
          <Bell className="h-4 w-4" />
          {remainingTodayCount > 0 ? (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-destructive-foreground">
              {remainingTodayCount > 99 ? "99+" : remainingTodayCount}
            </span>
          ) : null}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex w-[92vw] max-w-md flex-col p-0">
        <div className="border-b border-border/70 px-5 pb-4 pt-[calc(env(safe-area-inset-top,0px)+1rem)]">
          <SheetHeader className="space-y-0 text-left">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <SheetTitle>Notifications</SheetTitle>
                {unreadCount > 0 ? (
                  <Badge variant="secondary" className="px-2 py-0 text-[11px]">
                    {unreadCount} unread
                  </Badge>
                ) : null}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleMarkAllRead}
                  disabled={unreadCount === 0 || isMarkingAllRead}
                  aria-label="Mark all notifications read"
                >
                  {isMarkingAllRead ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCheck className="h-4 w-4" />
                  )}
                  <span>Read</span>
                </Button>
                <SheetClose asChild>
                  <Button type="button" variant="ghost" size="icon" aria-label="Close notifications">
                    <X className="h-4 w-4" />
                  </Button>
                </SheetClose>
              </div>
            </div>
            <SheetDescription className="sr-only">
              Recent {PRODUCT.name} notifications
            </SheetDescription>
          </SheetHeader>
        </div>

        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-2 p-4">
            {remainingTodayCount > 0 ? (
              <button
                type="button"
                className="w-full rounded-lg border border-primary/35 bg-primary/[0.08] p-3 text-left transition-colors hover:bg-primary/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={handleOpenRemainingToday}
                aria-label={`Open remaining today, ${remainingTodayCount} remaining`}
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-8 min-w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                    {remainingTodayCount > 99 ? "99+" : remainingTodayCount}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-foreground">Remaining today</div>
                    <div className="text-xs text-muted-foreground">{remainingTodayLabel}</div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </div>
              </button>
            ) : null}
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : items.length === 0 ? (
              <div className="rounded-lg border border-border/70 bg-background/50 px-4 py-8 text-center text-sm text-muted-foreground">
                No notifications
              </div>
            ) : (
              items.map((item) => {
                const isUnread = !item.readAt;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={cn(
                      "w-full rounded-lg border p-3 text-left transition-colors hover:bg-foreground/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      isUnread
                        ? "border-primary/40 bg-primary/[0.08]"
                        : "border-border/70 bg-background/45",
                    )}
                    onClick={() => {
                      void handleOpenNotification(item);
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={cn(
                          "mt-1 h-2 w-2 shrink-0 rounded-full",
                          isUnread ? "bg-primary" : "bg-transparent",
                        )}
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-xs font-semibold text-primary">
                            {item.sourceLabel}
                          </span>
                          <span className="shrink-0 text-[11px] text-muted-foreground">
                            {formatDeliveredAt(item.deliveredAt)}
                          </span>
                        </div>
                        <div className="line-clamp-1 text-sm font-semibold text-foreground">
                          {item.title}
                        </div>
                        <div className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                          {item.body}
                        </div>
                      </div>
                      <ChevronRight className="mt-5 h-4 w-4 shrink-0 text-muted-foreground" />
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
});

GlobalNotificationTray.displayName = "GlobalNotificationTray";
