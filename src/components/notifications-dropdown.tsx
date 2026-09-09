"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  CheckCheck,
  Check,
  Heart,
  MessageSquare,
  Calendar,
  Users,
  ShieldCheck,
  ShieldAlert,
  UserPlus,
  AtSign,
  ArrowRight,
  BellOff,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

import { apiGet, apiPatch, ApiMeta } from "@/lib/api-client";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";

// ============================================================================
// Types
// ============================================================================

export interface NotificationItem {
  id: string;
  userId?: string;
  user_id?: string;
  type:
    | "post_reaction"
    | "comment_reply"
    | "event_approved"
    | "event_reminder"
    | "hangout_request"
    | "hangout_approved"
    | "report_resolved"
    | "moderation_action"
    | "follow"
    | "mention"
    | string;
  title: string;
  message: string;
  relatedEntityType?: string | null;
  related_entity_type?: string | null;
  relatedEntityId?: string | null;
  related_entity_id?: string | null;
  isRead?: boolean;
  is_read?: boolean;
  createdAt?: string;
  created_at?: string;
}

export type NotificationsResponse =
  | NotificationItem[]
  | { data: NotificationItem[]; meta?: ApiMeta };

// ============================================================================
// Helpers
// ============================================================================

export function formatTimeAgo(dateStr?: string | null): string {
  if (!dateStr) return "";
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffInSeconds = Math.max(
      0,
      Math.floor((now.getTime() - date.getTime()) / 1000)
    );
    if (diffInSeconds < 60) return "just now";
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays === 1) return "yesterday";
    if (diffInDays < 7) return `${diffInDays}d ago`;
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

export function getNotificationIcon(type: string) {
  switch (type) {
    case "post_reaction":
      return <Heart className="size-4 text-rose-500" />;
    case "comment_reply":
      return <MessageSquare className="size-4 text-sky-500" />;
    case "event_approved":
    case "event_reminder":
      return <Calendar className="size-4 text-emerald-500" />;
    case "hangout_request":
    case "hangout_approved":
      return <Users className="size-4 text-violet-500" />;
    case "report_resolved":
      return <ShieldCheck className="size-4 text-amber-500" />;
    case "moderation_action":
      return <ShieldAlert className="size-4 text-destructive" />;
    case "follow":
      return <UserPlus className="size-4 text-blue-500" />;
    case "mention":
      return <AtSign className="size-4 text-purple-500" />;
    default:
      return <Bell className="size-4 text-primary" />;
  }
}

export function getNotificationBg(type: string) {
  switch (type) {
    case "post_reaction":
      return "bg-rose-500/10 border-rose-500/20";
    case "comment_reply":
      return "bg-sky-500/10 border-sky-500/20";
    case "event_approved":
    case "event_reminder":
      return "bg-emerald-500/10 border-emerald-500/20";
    case "hangout_request":
    case "hangout_approved":
      return "bg-violet-500/10 border-violet-500/20";
    case "report_resolved":
      return "bg-amber-500/10 border-amber-500/20";
    case "moderation_action":
      return "bg-destructive/10 border-destructive/20";
    case "follow":
      return "bg-blue-500/10 border-blue-500/20";
    case "mention":
      return "bg-purple-500/10 border-purple-500/20";
    default:
      return "bg-primary/10 border-primary/20";
  }
}

// ============================================================================
// Main Component
// ============================================================================

export function NotificationsDropdown() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = React.useState(false);

  // Fetch last 5 unread notifications, polling every 30s
  const { data: rawResponse, isLoading } = useQuery<NotificationsResponse>({
    queryKey: ["notifications", "header"],
    queryFn: () =>
      apiGet<NotificationsResponse>(
        "/notifications?unreadOnly=true&limit=5&sort=created_at&order=desc"
      ),
    refetchInterval: 30000,
    staleTime: 15000,
  });

  // Extract notifications list & total unread count
  const unreadNotifications: NotificationItem[] = React.useMemo(() => {
    if (!rawResponse) return [];
    if (Array.isArray(rawResponse)) return rawResponse;
    return Array.isArray(rawResponse.data) ? rawResponse.data : [];
  }, [rawResponse]);

  const totalUnreadCount = React.useMemo(() => {
    if (
      rawResponse &&
      !Array.isArray(rawResponse) &&
      typeof rawResponse.meta?.total === "number"
    ) {
      return rawResponse.meta.total;
    }
    return unreadNotifications.filter((n) => !(n.isRead || n.is_read)).length;
  }, [rawResponse, unreadNotifications]);

  // Mark single notification as read
  const markAsReadMutation = useMutation({
    mutationFn: (id: string) => apiPatch(`/notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: () => {
      toast.error("Failed to mark notification as read");
    },
  });

  // Batch mark all currently loaded unread notifications as read
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const unreadList = unreadNotifications.filter(
        (n) => !(n.isRead || n.is_read)
      );
      if (unreadList.length === 0) return;
      await Promise.allSettled(
        unreadList.map((item) => apiPatch(`/notifications/${item.id}/read`))
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("Notifications marked as read");
    },
    onError: () => {
      toast.error("Failed to mark notifications as read");
    },
  });

  const handleNotificationClick = async (item: NotificationItem) => {
    const isAlreadyRead = item.isRead || item.is_read;
    if (!isAlreadyRead) {
      markAsReadMutation.mutate(item.id);
    }
  };

  const handleViewAll = () => {
    setIsOpen(false);
    router.push("/notifications");
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            className="relative flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
            aria-label={
              totalUnreadCount > 0
                ? `Notifications (${totalUnreadCount} unread)`
                : "Notifications"
            }
          />
        }
      >
        <Bell className="size-4" />
        {totalUnreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground shadow-xs animate-in zoom-in-50">
            {totalUnreadCount > 9 ? "9+" : totalUnreadCount}
          </span>
        )}
      </PopoverTrigger>

      <PopoverContent
        align="end"
        side="bottom"
        sideOffset={8}
        className="w-80 sm:w-96 p-0 shadow-xl border-border bg-popover rounded-xl overflow-hidden"
      >
        {/* Dropdown Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b border-border">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-sm text-foreground">
              Notifications
            </h4>
            {totalUnreadCount > 0 && (
              <Badge
                variant="secondary"
                className="text-[11px] px-1.5 py-0 font-mono"
              >
                {totalUnreadCount} unread
              </Badge>
            )}
          </div>
          {unreadNotifications.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markAllAsReadMutation.mutate()}
              disabled={markAllAsReadMutation.isPending}
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1 cursor-pointer"
            >
              {markAllAsReadMutation.isPending ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <CheckCheck className="size-3" />
              )}
              <span>Mark all read</span>
            </Button>
          )}
        </div>

        {/* Notifications List Content */}
        <div className="max-h-[340px] overflow-y-auto divide-y divide-border/60">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 3 }).map((_, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <Skeleton className="size-8 rounded-lg shrink-0" />
                  <div className="space-y-1.5 flex-1">
                    <Skeleton className="h-3.5 w-3/4" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-2.5 w-1/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : unreadNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground mb-2.5">
                <BellOff className="size-5" />
              </div>
              <p className="text-sm font-medium text-foreground">
                All caught up!
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                No unread notifications right now.
              </p>
            </div>
          ) : (
            unreadNotifications.map((item) => {
              const isRead = Boolean(item.isRead || item.is_read);
              const createdAt = item.createdAt || item.created_at;
              const timeAgo = formatTimeAgo(createdAt);

              return (
                <div
                  key={item.id}
                  onClick={() => handleNotificationClick(item)}
                  className={`group relative flex items-start gap-3 p-3.5 transition-colors cursor-pointer ${
                    !isRead
                      ? "bg-primary/5 hover:bg-primary/10 dark:bg-primary/10 dark:hover:bg-primary/15"
                      : "hover:bg-muted/40"
                  }`}
                >
                  {/* Type Icon */}
                  <div
                    className={`flex size-8 shrink-0 items-center justify-center rounded-lg border ${getNotificationBg(
                      item.type
                    )}`}
                  >
                    {getNotificationIcon(item.type)}
                  </div>

                  {/* Body */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <p className="text-xs font-semibold text-foreground truncate">
                        {item.title}
                      </p>
                      <span className="text-[11px] text-muted-foreground shrink-0">
                        {timeAgo}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {item.message}
                    </p>
                  </div>

                  {/* Unread Indicator Dot */}
                  {!isRead && (
                    <span
                      className="size-2 rounded-full bg-primary shrink-0 self-center"
                      title="Unread"
                    />
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Dropdown Footer */}
        <Separator />
        <div className="p-2 bg-muted/20">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleViewAll}
            className="w-full justify-center text-xs font-medium text-primary hover:text-primary gap-1.5 h-8 cursor-pointer"
          >
            <span>View all notifications</span>
            <ArrowRight className="size-3.5" />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
