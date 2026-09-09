"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  CheckCheck,
  Check,
  Filter,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Inbox,
  Loader2,
  Tag,
  Clock,
  CalendarDays,
} from "lucide-react";
import { toast } from "sonner";

import { apiGet, apiPatch, ApiMeta } from "@/lib/api-client";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  NotificationItem,
  NotificationsResponse,
  formatTimeAgo,
  getNotificationIcon,
  getNotificationBg,
} from "@/components/notifications-dropdown";

// ============================================================================
// Helpers
// ============================================================================

function formatExactDate(dateStr?: string | null): string {
  if (!dateStr) return "";
  try {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  } catch {
    return dateStr;
  }
}

function formatEntityType(type?: string | null): string {
  if (!type) return "";
  return type
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

// ============================================================================
// Page Component
// ============================================================================

export default function NotificationsPage() {
  const queryClient = useQueryClient();

  // Page state
  const [page, setPage] = React.useState(1);
  const limit = 20;

  // Filter: "all" | "unread"
  const [filter, setFilter] = React.useState<"all" | "unread">("all");
  const unreadOnly = filter === "unread";

  // 1. Fetch Notifications with pagination and filter
  const {
    data: rawResponse,
    isLoading,
    isFetching,
    refetch,
  } = useQuery<NotificationsResponse>({
    queryKey: ["notifications", "list", { page, limit, unreadOnly }],
    queryFn: () =>
      apiGet<NotificationsResponse>(
        `/notifications?page=${page}&limit=${limit}&unreadOnly=${unreadOnly}&sort=created_at&order=desc`
      ),
    staleTime: 30000,
  });

  // Also fetch unread count for the unread filter tab badge
  const { data: unreadStatsResponse } = useQuery<NotificationsResponse>({
    queryKey: ["notifications", "unreadCount"],
    queryFn: () =>
      apiGet<NotificationsResponse>(
        "/notifications?unreadOnly=true&limit=1"
      ),
    staleTime: 30000,
  });

  // Extract notifications list & meta
  const notifications: NotificationItem[] = React.useMemo(() => {
    if (!rawResponse) return [];
    if (Array.isArray(rawResponse)) return rawResponse;
    return Array.isArray(rawResponse.data) ? rawResponse.data : [];
  }, [rawResponse]);

  const meta: ApiMeta = React.useMemo(() => {
    if (rawResponse && !Array.isArray(rawResponse) && rawResponse.meta) {
      return rawResponse.meta;
    }
    return {
      page,
      limit,
      total: notifications.length,
      totalPages: Math.max(1, Math.ceil(notifications.length / limit)),
    };
  }, [rawResponse, notifications.length, page, limit]);

  const totalUnreadBadgeCount = React.useMemo(() => {
    if (
      unreadStatsResponse &&
      !Array.isArray(unreadStatsResponse) &&
      typeof unreadStatsResponse.meta?.total === "number"
    ) {
      return unreadStatsResponse.meta.total;
    }
    return 0;
  }, [unreadStatsResponse]);

  // Mutations
  const markAsReadMutation = useMutation({
    mutationFn: (id: string) => apiPatch(`/notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("Notification marked as read");
    },
    onError: () => {
      toast.error("Failed to mark notification as read");
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const unreadItems = notifications.filter(
        (n) => !(n.isRead || n.is_read)
      );
      if (unreadItems.length === 0) return;
      await Promise.allSettled(
        unreadItems.map((item) => apiPatch(`/notifications/${item.id}/read`))
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("All visible notifications marked as read");
    },
    onError: () => {
      toast.error("Failed to mark notifications as read");
    },
  });

  // Has any unread in the current list
  const hasUnreadInCurrentList = notifications.some(
    (n) => !(n.isRead || n.is_read)
  );

  const totalPages = Number(meta.totalPages || 1);
  const totalCount = Number(meta.total || 0);

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full">
      {/* ------------------------------------------------------------------
          1. In-Page Breadcrumbs
      ------------------------------------------------------------------ */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href="/" />}>Dashboard</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Notifications</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* ------------------------------------------------------------------
          2. Page Header & Actions
      ------------------------------------------------------------------ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Bell className="size-6 text-primary" />
            <span>Notifications</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Stay updated on community activities, member proposals, reports, and
            moderation events.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="h-9 gap-1.5 shadow-xs cursor-pointer"
            title="Refresh notifications"
          >
            <RefreshCw
              className={`size-3.5 ${isFetching ? "animate-spin" : ""}`}
            />
            <span className="hidden sm:inline">Refresh</span>
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={() => markAllAsReadMutation.mutate()}
            disabled={
              !hasUnreadInCurrentList || markAllAsReadMutation.isPending
            }
            className="h-9 gap-1.5 shadow-xs cursor-pointer"
          >
            {markAllAsReadMutation.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <CheckCheck className="size-3.5" />
            )}
            <span>Mark all as read</span>
          </Button>
        </div>
      </div>

      {/* ------------------------------------------------------------------
          3. Filter Tabs Bar
      ------------------------------------------------------------------ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <Tabs
          value={filter}
          onValueChange={(val) => {
            setFilter(val as "all" | "unread");
            setPage(1);
          }}
        >
          <TabsList className="grid w-full sm:w-64 grid-cols-2">
            <TabsTrigger value="all" className="cursor-pointer">
              All
            </TabsTrigger>
            <TabsTrigger value="unread" className="cursor-pointer gap-1.5">
              <span>Unread</span>
              {totalUnreadBadgeCount > 0 && (
                <span className="flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                  {totalUnreadBadgeCount > 99
                    ? "99+"
                    : totalUnreadBadgeCount}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Total indicator */}
        <p className="text-xs text-muted-foreground">
          {totalCount} {totalCount === 1 ? "notification" : "notifications"} in
          total
        </p>
      </div>

      {/* ------------------------------------------------------------------
          4. Notifications List
      ------------------------------------------------------------------ */}
      <div className="space-y-3">
        {isLoading ? (
          /* Skeletons */
          Array.from({ length: 5 }).map((_, index) => (
            <Card key={`skeleton-${index}`} className="p-4 border-border/70">
              <div className="flex items-start gap-4">
                <Skeleton className="size-10 rounded-xl shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <Skeleton className="h-3.5 w-full" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              </div>
            </Card>
          ))
        ) : notifications.length === 0 ? (
          /* Empty State */
          <Card className="p-12 text-center border-dashed border-border/80">
            <div className="flex flex-col items-center justify-center gap-3 max-w-sm mx-auto">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                <Inbox className="size-7" />
              </div>
              <h3 className="text-base font-semibold text-foreground">
                {unreadOnly
                  ? "No unread notifications"
                  : "No notifications yet"}
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {unreadOnly
                  ? "You're all caught up! All community alerts and moderation tasks have been read."
                  : "Activity alerts, new proposals, member actions, and reports will appear here."}
              </p>
              {unreadOnly && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setFilter("all")}
                  className="mt-2 text-xs cursor-pointer"
                >
                  View all notifications
                </Button>
              )}
            </div>
          </Card>
        ) : (
          /* Notification Cards */
          notifications.map((item) => {
            const isRead = Boolean(item.isRead || item.is_read);
            const createdAt = item.createdAt || item.created_at;
            const timeAgo = formatTimeAgo(createdAt);
            const exactDate = formatExactDate(createdAt);
            const entityType =
              item.relatedEntityType || item.related_entity_type;

            return (
              <Card
                key={item.id}
                className={`transition-all duration-150 border-border/70 ${
                  !isRead
                    ? "bg-primary/5 dark:bg-primary/10 border-primary/30 shadow-xs"
                    : "bg-card hover:bg-muted/20"
                }`}
              >
                <CardContent className="p-4 sm:p-5">
                  <div className="flex items-start gap-3.5 sm:gap-4">
                    {/* Semantic Type Icon */}
                    <div
                      className={`flex size-10 shrink-0 items-center justify-center rounded-xl border ${getNotificationBg(
                        item.type
                      )}`}
                    >
                      {getNotificationIcon(item.type)}
                    </div>

                    {/* Content Column */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-semibold text-foreground">
                            {item.title}
                          </h4>
                          {!isRead && (
                            <Badge
                              variant="default"
                              className="text-[10px] px-1.5 py-0 font-medium uppercase tracking-wider"
                            >
                              New
                            </Badge>
                          )}
                          {entityType && (
                            <Badge
                              variant="outline"
                              className="text-[11px] px-1.5 py-0 text-muted-foreground border-border/60 gap-1 font-mono"
                            >
                              <Tag className="size-2.5" />
                              <span>{formatEntityType(entityType)}</span>
                            </Badge>
                          )}
                        </div>

                        {/* Relative Timestamp */}
                        <div
                          className="flex items-center gap-1 text-xs text-muted-foreground shrink-0"
                          title={exactDate}
                        >
                          <Clock className="size-3" />
                          <span>{timeAgo}</span>
                        </div>
                      </div>

                      {/* Message Body */}
                      <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                        {item.message}
                      </p>

                      {/* Footer Info & Action */}
                      <div className="flex items-center justify-between gap-2 mt-3 pt-2.5 border-t border-border/40 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1 text-[11px]">
                          <CalendarDays className="size-3" />
                          <span>{exactDate}</span>
                        </div>

                        <div>
                          {!isRead ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                markAsReadMutation.mutate(item.id)
                              }
                              disabled={markAsReadMutation.isPending}
                              className="h-7 px-2.5 text-xs text-primary hover:text-primary hover:bg-primary/10 gap-1.5 cursor-pointer"
                            >
                              <Check className="size-3" />
                              <span>Mark as read</span>
                            </Button>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                              <CheckCheck className="size-3.5 text-emerald-500" />
                              <span>Read</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* ------------------------------------------------------------------
          5. Pagination
      ------------------------------------------------------------------ */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2 pb-6 border-t border-border">
          <p className="text-xs text-muted-foreground">
            Showing {(page - 1) * limit + 1}–
            {Math.min(page * limit, totalCount)} of {totalCount} notifications
          </p>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="h-8 px-2.5 text-xs gap-1 cursor-pointer"
            >
              <ChevronLeft className="size-3.5" />
              <span>Previous</span>
            </Button>

            <span className="text-xs font-medium text-foreground px-1">
              Page {page} of {totalPages}
            </span>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="h-8 px-2.5 text-xs gap-1 cursor-pointer"
            >
              <span>Next</span>
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
