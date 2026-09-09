"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { isAxiosError } from "axios";
import {
  ShieldAlert,
  AlertTriangle,
  Clock,
  Eye,
  CheckCircle2,
  XCircle,
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  User,
  FileText,
  MessageSquare,
  Calendar,
  Compass,
  ArrowLeft,
  Filter,
  History,
  UserX,
  Info,
  ShieldCheck,
  Send,
  AlertCircle,
  Copy,
} from "lucide-react";
import { toast } from "sonner";

import { apiGet, apiPatch, apiPost, ApiMeta } from "@/lib/api-client";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// ============================================================================
// Type Definitions
// ============================================================================

export type ReportStatus = "pending" | "reviewing" | "resolved" | "dismissed";
export type ReportTargetType = "user" | "post" | "comment" | "event" | "hangout" | "unknown";

export type ModerationActionType =
  | "warn"
  | "suspend"
  | "ban"
  | "unban"
  | "content_removed"
  | "content_restored";

export interface UserSummary {
  id: string;
  username: string;
  name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  profile_picture_url?: string | null;
  email?: string | null;
}

export interface CommunityReport {
  id: string;
  reporterId?: string;
  reporter_id?: string;
  reporter?: UserSummary | null;

  reportedUserId?: string | null;
  reported_user_id?: string | null;
  reportedUser?: UserSummary | null;

  reportedPostId?: string | null;
  reported_post_id?: string | null;
  post?: {
    id: string;
    title?: string | null;
    content?: string | null;
    author?: UserSummary | null;
  } | null;

  reportedCommentId?: string | null;
  reported_comment_id?: string | null;
  comment?: {
    id: string;
    content?: string | null;
    author?: UserSummary | null;
    postId?: string | null;
    post_id?: string | null;
  } | null;

  reportedEventId?: string | null;
  reported_event_id?: string | null;
  event?: {
    id: string;
    title?: string | null;
    startsAt?: string | null;
    starts_at?: string | null;
  } | null;

  reportedHangoutId?: string | null;
  reported_hangout_id?: string | null;
  hangout?: {
    id: string;
    title?: string | null;
    startsAt?: string | null;
    starts_at?: string | null;
  } | null;

  reason: string;
  status: ReportStatus;

  reviewedBy?: string | null;
  reviewed_by?: string | null;
  reviewer?: UserSummary | null;

  reviewedAt?: string | null;
  reviewed_at?: string | null;

  createdAt?: string;
  created_at?: string;
}

export interface ModerationActionRecord {
  id: string;
  moderatorId?: string;
  moderator_id?: string;
  moderator?: UserSummary | null;

  targetUserId?: string | null;
  target_user_id?: string | null;
  targetUser?: UserSummary | null;

  reportId?: string | null;
  report_id?: string | null;
  report?: CommunityReport | null;

  actionType: ModerationActionType;
  action_type?: ModerationActionType;
  notes?: string | null;

  createdAt?: string;
  created_at?: string;
}

export interface BannedUserRecord {
  id: string;
  userId?: string;
  user_id?: string;
  user?: UserSummary | null;

  bannedBy?: string | UserSummary | null;
  banned_by?: string | UserSummary | null;
  banner?: UserSummary | null;

  reason?: string | null;
  bannedAt?: string;
  banned_at?: string;

  type?: "event" | "hangout" | "community" | string;
  scope?: string;
  eventId?: string;
  event_id?: string;
  hangoutId?: string;
  hangout_id?: string;
}

export interface CommunityOverviewResponse {
  community: {
    id: string;
    name: string;
    slug: string;
    creator_id: string;
    description?: string | null;
    is_private?: boolean;
  };
  myRole: "owner" | "admin" | "moderator" | "member";
  memberCount: number;
}

// ============================================================================
// Zod Schema for Moderation Action Form
// ============================================================================

const moderationActionSchema = z.object({
  actionType: z.enum([
    "warn",
    "suspend",
    "ban",
    "unban",
    "content_removed",
    "content_restored",
  ]),
  notes: z
    .string()
    .max(500, "Notes cannot exceed 500 characters")
    .optional()
    .or(z.literal("")),
});

type ModerationActionFormValues = z.infer<typeof moderationActionSchema>;

// ============================================================================
// Helper Utilities
// ============================================================================

function extractList<T>(response: unknown): T[] {
  if (!response) return [];
  if (Array.isArray(response)) return response as T[];
  if (
    typeof response === "object" &&
    response !== null &&
    "data" in response &&
    Array.isArray((response as { data: unknown }).data)
  ) {
    return (response as { data: T[] }).data;
  }
  return [];
}

function extractMeta(response: unknown): ApiMeta | undefined {
  if (
    response &&
    typeof response === "object" &&
    "meta" in response &&
    typeof (response as { meta: unknown }).meta === "object" &&
    (response as { meta: unknown }).meta !== null
  ) {
    return (response as { meta: ApiMeta }).meta;
  }
  return undefined;
}

function getReportTargetType(report: CommunityReport): ReportTargetType {
  if (report.reportedPostId || report.reported_post_id || report.post) return "post";
  if (report.reportedCommentId || report.reported_comment_id || report.comment) return "comment";
  if (report.reportedEventId || report.reported_event_id || report.event) return "event";
  if (report.reportedHangoutId || report.reported_hangout_id || report.hangout) return "hangout";
  if (report.reportedUserId || report.reported_user_id || report.reportedUser) return "user";
  return "unknown";
}

function getReportTargetId(report: CommunityReport): string | undefined {
  return (
    report.reportedPostId ||
    report.reported_post_id ||
    report.reportedCommentId ||
    report.reported_comment_id ||
    report.reportedEventId ||
    report.reported_event_id ||
    report.reportedHangoutId ||
    report.reported_hangout_id ||
    report.reportedUserId ||
    report.reported_user_id ||
    undefined
  );
}

function getUserDisplayName(user?: UserSummary | null, fallbackId?: string | null): string {
  if (!user) {
    return fallbackId ? `User (${fallbackId.slice(0, 8)}...)` : "Unknown User";
  }
  const fullName = `${user.first_name || ""} ${user.last_name || ""}`.trim();
  if (fullName) return fullName;
  if (user.name) return user.name;
  return user.username || fallbackId || "Unknown Member";
}

function getUserInitials(user?: UserSummary | null): string {
  if (!user) return "U";
  if (user.first_name && user.last_name) {
    return `${user.first_name[0]}${user.last_name[0]}`.toUpperCase();
  }
  if (user.username) {
    return user.username.slice(0, 2).toUpperCase();
  }
  return "U";
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "N/A";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(d);
  } catch {
    return dateStr;
  }
}

function formatRelativeTime(dateStr?: string | null): string {
  if (!dateStr) return "N/A";
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDate(dateStr);
  } catch {
    return dateStr;
  }
}

// ============================================================================
// Target Type Badge Component
// ============================================================================

function TargetTypeBadge({ type }: { type: ReportTargetType }) {
  switch (type) {
    case "post":
      return (
        <Badge
          variant="outline"
          className="gap-1.5 border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300 font-medium"
        >
          <FileText className="h-3.5 w-3.5" />
          <span>Post</span>
        </Badge>
      );
    case "comment":
      return (
        <Badge
          variant="outline"
          className="gap-1.5 border-purple-500/20 bg-purple-500/10 text-purple-700 dark:text-purple-300 font-medium"
        >
          <MessageSquare className="h-3.5 w-3.5" />
          <span>Comment</span>
        </Badge>
      );
    case "user":
      return (
        <Badge
          variant="outline"
          className="gap-1.5 border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300 font-medium"
        >
          <User className="h-3.5 w-3.5" />
          <span>User</span>
        </Badge>
      );
    case "event":
      return (
        <Badge
          variant="outline"
          className="gap-1.5 border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-medium"
        >
          <Calendar className="h-3.5 w-3.5" />
          <span>Event</span>
        </Badge>
      );
    case "hangout":
      return (
        <Badge
          variant="outline"
          className="gap-1.5 border-pink-500/20 bg-pink-500/10 text-pink-700 dark:text-pink-300 font-medium"
        >
          <Compass className="h-3.5 w-3.5" />
          <span>Hangout</span>
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="gap-1.5 font-medium text-muted-foreground">
          <AlertCircle className="h-3.5 w-3.5" />
          <span>Content</span>
        </Badge>
      );
  }
}

// ============================================================================
// Status Badge Component
// ============================================================================

function StatusBadge({ status }: { status: ReportStatus }) {
  switch (status) {
    case "pending":
      return (
        <Badge
          variant="outline"
          className="gap-1.5 border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium"
        >
          <Clock className="h-3 w-3" />
          <span>Pending</span>
        </Badge>
      );
    case "reviewing":
      return (
        <Badge
          variant="outline"
          className="gap-1.5 border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400 font-medium"
        >
          <Eye className="h-3 w-3" />
          <span>Reviewing</span>
        </Badge>
      );
    case "resolved":
      return (
        <Badge
          variant="outline"
          className="gap-1.5 border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium"
        >
          <CheckCircle2 className="h-3 w-3" />
          <span>Resolved</span>
        </Badge>
      );
    case "dismissed":
      return (
        <Badge
          variant="outline"
          className="gap-1.5 border-muted-foreground/30 bg-muted/40 text-muted-foreground font-medium"
        >
          <XCircle className="h-3 w-3" />
          <span>Dismissed</span>
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

// ============================================================================
// Moderation Action Badge Component
// ============================================================================

function ActionTypeBadge({ actionType }: { actionType: ModerationActionType }) {
  switch (actionType) {
    case "warn":
      return (
        <Badge className="bg-amber-500/15 text-amber-700 hover:bg-amber-500/25 dark:text-amber-300 border-amber-500/30 border">
          Warning Issued
        </Badge>
      );
    case "suspend":
      return (
        <Badge className="bg-orange-500/15 text-orange-700 hover:bg-orange-500/25 dark:text-orange-300 border-orange-500/30 border">
          Suspension
        </Badge>
      );
    case "ban":
      return (
        <Badge className="bg-rose-500/15 text-rose-700 hover:bg-rose-500/25 dark:text-rose-300 border-rose-500/30 border">
          Banned
        </Badge>
      );
    case "unban":
      return (
        <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 dark:text-emerald-300 border-emerald-500/30 border">
          Ban Lifted
        </Badge>
      );
    case "content_removed":
      return (
        <Badge className="bg-red-500/15 text-red-700 hover:bg-red-500/25 dark:text-red-300 border-red-500/30 border">
          Content Removed
        </Badge>
      );
    case "content_restored":
      return (
        <Badge className="bg-blue-500/15 text-blue-700 hover:bg-blue-500/25 dark:text-blue-300 border-blue-500/30 border">
          Content Restored
        </Badge>
      );
    default:
      return <Badge variant="outline">{actionType}</Badge>;
  }
}

// ============================================================================
// Main Page Component
// ============================================================================

export default function ReportsPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug as string;
  const queryClient = useQueryClient();

  // Active Main Tab: "reports" | "actions" | "bans"
  const [activeTab, setActiveTab] = React.useState<string>("reports");

  // Filter & Pagination for Reports Queue
  const [reportsPage, setReportsPage] = React.useState<number>(1);
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [targetTypeFilter, setTargetTypeFilter] = React.useState<string>("all");
  const [reportsSearch, setReportsSearch] = React.useState<string>("");

  // Pagination & Search for Moderation Actions
  const [actionsPage, setActionsPage] = React.useState<number>(1);
  const [actionsSearch, setActionsSearch] = React.useState<string>("");

  // Search for Banned Users
  const [bansSearch, setBansSearch] = React.useState<string>("");

  // Review Dialog State
  const [selectedReport, setSelectedReport] = React.useState<CommunityReport | null>(null);
  const [dialogStatus, setDialogStatus] = React.useState<ReportStatus>("pending");

  // Moderation Action Form Setup
  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<ModerationActionFormValues>({
    resolver: zodResolver(moderationActionSchema),
    defaultValues: {
      actionType: "content_removed",
      notes: "",
    },
  });

  // Open review dialog with synchronized status and reset form
  const handleOpenReview = React.useCallback(
    (report: CommunityReport) => {
      setSelectedReport(report);
      setDialogStatus(report.status);
      reset({
        actionType: "content_removed",
        notes: "",
      });
    },
    [reset]
  );

  // --------------------------------------------------------------------------
  // Queries
  // --------------------------------------------------------------------------

  // 1. Community Overview & Access Check
  const {
    data: overviewData,
    error: overviewError,
  } = useQuery<CommunityOverviewResponse>({
    queryKey: ["adminCommunityOverview", slug],
    queryFn: () => apiGet<CommunityOverviewResponse>(`/admin/communities/${slug}`),
    enabled: Boolean(slug),
  });

  const isForbidden =
    (isAxiosError(overviewError) && overviewError.response?.status === 403) ||
    (overviewData && overviewData.myRole === "member");

  // 2. Reports List Query
  const statusParam = statusFilter !== "all" ? `&status=${statusFilter}` : "";
  const {
    data: reportsResponse,
    isLoading: isLoadingReports,
    isFetching: isFetchingReports,
    isError: isErrorReports,
    refetch: refetchReports,
  } = useQuery({
    queryKey: ["communityReports", slug, reportsPage, statusFilter],
    queryFn: () =>
      apiGet<unknown>(`/communities/${slug}/reports?page=${reportsPage}&limit=20${statusParam}`),
    enabled: Boolean(slug && !isForbidden),
  });

  // 3. Moderation Actions History Query
  const {
    data: actionsResponse,
    isLoading: isLoadingActions,
    isFetching: isFetchingActions,
    isError: isErrorActions,
    refetch: refetchActions,
  } = useQuery({
    queryKey: ["communityModerationActions", slug, actionsPage],
    queryFn: () =>
      apiGet<unknown>(`/communities/${slug}/moderation-actions?page=${actionsPage}&limit=20`),
    enabled: Boolean(slug && !isForbidden && activeTab === "actions"),
  });

  // 4. Banned Users Query
  const {
    data: bansResponse,
    isLoading: isLoadingBans,
    isFetching: isFetchingBans,
    isError: isErrorBans,
    refetch: refetchBans,
  } = useQuery({
    queryKey: ["adminBannedUsers", slug],
    queryFn: () => apiGet<unknown>(`/admin/communities/${slug}/banned-users`),
    enabled: Boolean(slug && !isForbidden && activeTab === "bans"),
  });

  // --------------------------------------------------------------------------
  // Mutations
  // --------------------------------------------------------------------------

  // 1. Update Report Status Mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ reportId, status }: { reportId: string; status: ReportStatus }) => {
      return apiPatch<unknown>(`/reports/${reportId}`, { status });
    },
    onSuccess: (_, variables) => {
      toast.success("Report status updated successfully");
      queryClient.invalidateQueries({ queryKey: ["communityReports", slug] });
      queryClient.invalidateQueries({ queryKey: ["adminCommunityStats", slug] });

      // Update selected report in dialog
      setSelectedReport((prev) => (prev ? { ...prev, status: variables.status } : null));
    },
    onError: (err) => {
      const message =
        (isAxiosError(err) &&
          (err.response?.data as { error?: { message?: string } })?.error?.message) ||
        "Failed to update report status";
      toast.error(message);
    },
  });

  // 2. Take Moderation Action Mutation
  const takeActionMutation = useMutation({
    mutationFn: async ({
      reportId,
      data,
    }: {
      reportId: string;
      data: ModerationActionFormValues;
    }) => {
      return apiPost<unknown>(`/reports/${reportId}/action`, {
        actionType: data.actionType,
        notes: data.notes ? data.notes.trim() : undefined,
      });
    },
    onSuccess: () => {
      toast.success("Moderation action applied successfully");
      queryClient.invalidateQueries({ queryKey: ["communityReports", slug] });
      queryClient.invalidateQueries({ queryKey: ["communityModerationActions", slug] });
      queryClient.invalidateQueries({ queryKey: ["adminBannedUsers", slug] });
      queryClient.invalidateQueries({ queryKey: ["adminCommunityStats", slug] });

      setSelectedReport(null);
    },
    onError: (err) => {
      const message =
        (isAxiosError(err) &&
          (err.response?.data as { error?: { message?: string } })?.error?.message) ||
        "Failed to apply moderation action";
      toast.error(message);
    },
  });

  // Form submit handler
  const onTakeActionSubmit = (data: ModerationActionFormValues) => {
    if (!selectedReport) return;
    takeActionMutation.mutate({
      reportId: selectedReport.id,
      data,
    });
  };

  // --------------------------------------------------------------------------
  // Data Extraction & Filtering
  // --------------------------------------------------------------------------

  const rawReports = extractList<CommunityReport>(reportsResponse);
  const reportsMeta = extractMeta(reportsResponse);

  // Client-side search and target type filtering
  const filteredReports = React.useMemo(() => {
    return rawReports.filter((report) => {
      const targetType = getReportTargetType(report);
      if (targetTypeFilter !== "all" && targetType !== targetTypeFilter) {
        return false;
      }

      if (reportsSearch.trim()) {
        const query = reportsSearch.toLowerCase().trim();
        const reasonMatch = report.reason.toLowerCase().includes(query);
        const reporterName = getUserDisplayName(report.reporter, report.reporterId).toLowerCase();
        const reporterMatch = reporterName.includes(query);
        const targetId = getReportTargetId(report)?.toLowerCase() || "";
        const targetMatch = targetId.includes(query);

        return reasonMatch || reporterMatch || targetMatch;
      }

      return true;
    });
  }, [rawReports, targetTypeFilter, reportsSearch]);

  // Moderation Actions extraction
  const rawActions = extractList<ModerationActionRecord>(actionsResponse);
  const actionsMeta = extractMeta(actionsResponse);

  const filteredActions = React.useMemo(() => {
    if (!actionsSearch.trim()) return rawActions;
    const query = actionsSearch.toLowerCase().trim();
    return rawActions.filter((action) => {
      const modName = getUserDisplayName(action.moderator, action.moderatorId).toLowerCase();
      const targetName = getUserDisplayName(action.targetUser, action.targetUserId).toLowerCase();
      const notes = (action.notes || "").toLowerCase();
      const actionType = (action.actionType || action.action_type || "").toLowerCase();
      return (
        modName.includes(query) ||
        targetName.includes(query) ||
        notes.includes(query) ||
        actionType.includes(query)
      );
    });
  }, [rawActions, actionsSearch]);

  // Banned Users extraction
  const rawBans = extractList<BannedUserRecord>(bansResponse);

  const filteredBans = React.useMemo(() => {
    if (!bansSearch.trim()) return rawBans;
    const query = bansSearch.toLowerCase().trim();
    return rawBans.filter((ban) => {
      const userName = getUserDisplayName(ban.user, ban.userId).toLowerCase();
      const reason = (ban.reason || "").toLowerCase();
      return userName.includes(query) || reason.includes(query);
    });
  }, [rawBans, bansSearch]);

  // --------------------------------------------------------------------------
  // Access Denied / 403 State
  // --------------------------------------------------------------------------

  if (isForbidden) {
    return (
      <div className="container mx-auto max-w-4xl py-12 px-4">
        <Card className="border-destructive/40 shadow-sm">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 text-destructive mb-3">
              <ShieldAlert className="h-8 w-8" />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight">Access Denied</CardTitle>
            <CardDescription className="text-base text-muted-foreground mt-2 max-w-md mx-auto">
              You do not have moderator or administrator permissions to review reports for this
              community.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center pb-8">
            <Button
              variant="default"
              render={<Link href={`/communities/${slug}`} />}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              <span>Back to Community Overview</span>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // Main Render
  // --------------------------------------------------------------------------

  const communityName = overviewData?.community?.name || slug;

  return (
    <div className="flex-1 space-y-6 max-w-7xl mx-auto w-full">
      {/* In-Page Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href="/" />}>Dashboard</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href={`/communities/${slug}`} />}>
              {communityName}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Reports</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header & Navigation */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2.5">
            <ShieldAlert className="h-7 w-7 text-amber-500" />
            <span>Community Moderation</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            Review member reports, handle flagged content, track moderation history, and oversee
            community safety.
          </p>
        </div>

        {/* Global actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (activeTab === "reports") refetchReports();
              else if (activeTab === "actions") refetchActions();
              else refetchBans();
              toast.info("Refreshed moderation data");
            }}
            disabled={isFetchingReports || isFetchingActions || isFetchingBans}
            className="gap-1.5"
          >
            <RefreshCw
              className={`h-4 w-4 ${
                isFetchingReports || isFetchingActions || isFetchingBans ? "animate-spin" : ""
              }`}
            />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* Tab Navigation */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => {
          setActiveTab(val);
        }}
        className="space-y-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-4">
          <TabsList className="grid grid-cols-3 w-full sm:w-[480px]">
            <TabsTrigger value="reports" className="gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-500" />
              <span>Reports</span>
              {reportsMeta?.total !== undefined && reportsMeta.total > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-1 px-1.5 py-0.2 text-[10px] font-semibold h-4 min-w-4 flex items-center justify-center rounded-full"
                >
                  {reportsMeta.total}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="actions" className="gap-2">
              <History className="h-4 w-4 text-blue-500" />
              <span>Action History</span>
            </TabsTrigger>
            <TabsTrigger value="bans" className="gap-2">
              <UserX className="h-4 w-4 text-rose-500" />
              <span>Banned Users</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ================================================================= */}
        {/* TAB 1: REPORTS QUEUE */}
        {/* ================================================================= */}
        <TabsContent value="reports" className="space-y-6 outline-none">
          {/* Filter Bar */}
          <Card className="bg-card/50 shadow-none border">
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
                {/* Search input */}
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by report reason, reporter username, target ID..."
                    value={reportsSearch}
                    onChange={(e) => setReportsSearch(e.target.value)}
                    className="pl-9 h-9"
                  />
                  {reportsSearch && (
                    <button
                      type="button"
                      onClick={() => setReportsSearch("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-2">
                  {/* Status Filter */}
                  <div className="w-[140px]">
                    <Select
                      value={statusFilter}
                      onValueChange={(val) => {
                        if (val) {
                          setStatusFilter(val);
                          setReportsPage(1);
                        }
                      }}
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <div className="flex items-center gap-1.5 truncate">
                          <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <SelectValue placeholder="Status" />
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="reviewing">Reviewing</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                        <SelectItem value="dismissed">Dismissed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Target Type Filter */}
                  <div className="w-[140px]">
                    <Select
                      value={targetTypeFilter}
                      onValueChange={(val) => {
                        if (val) {
                          setTargetTypeFilter(val);
                        }
                      }}
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder="Target Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Targets</SelectItem>
                        <SelectItem value="post">Posts</SelectItem>
                        <SelectItem value="comment">Comments</SelectItem>
                        <SelectItem value="user">Users</SelectItem>
                        <SelectItem value="event">Events</SelectItem>
                        <SelectItem value="hangout">Hangouts</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Reports Table Card */}
          <Card className="shadow-sm overflow-hidden border">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="w-[200px]">Reporter</TableHead>
                    <TableHead className="w-[140px]">Target Type</TableHead>
                    <TableHead className="min-w-[260px]">Reason</TableHead>
                    <TableHead className="w-[130px]">Status</TableHead>
                    <TableHead className="w-[150px]">Created</TableHead>
                    <TableHead className="w-[110px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingReports ? (
                    // Skeleton Loading
                    Array.from({ length: 5 }).map((_, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            <Skeleton className="h-8 w-8 rounded-full" />
                            <div className="space-y-1.5">
                              <Skeleton className="h-3.5 w-24" />
                              <Skeleton className="h-3 w-16" />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-6 w-20 rounded-full" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-full max-w-[240px]" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-6 w-20 rounded-full" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-20" />
                        </TableCell>
                        <TableCell className="text-right">
                          <Skeleton className="h-8 w-16 ml-auto rounded-md" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : isErrorReports ? (
                    // Error State
                    <TableRow>
                      <TableCell colSpan={6} className="h-32 text-center">
                        <div className="flex flex-col items-center justify-center gap-2 text-destructive">
                          <AlertTriangle className="h-6 w-6" />
                          <p className="font-medium text-sm">Failed to load reports.</p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => refetchReports()}
                            className="mt-1"
                          >
                            Try Again
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : filteredReports.length === 0 ? (
                    // Empty State
                    <TableRow>
                      <TableCell colSpan={6} className="h-40 text-center">
                        <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                          <ShieldCheck className="h-8 w-8 text-emerald-500/80 mb-1" />
                          <p className="text-base font-semibold text-foreground">
                            No reports to show
                          </p>
                          <p className="text-xs max-w-sm">
                            {reportsSearch || statusFilter !== "all" || targetTypeFilter !== "all"
                              ? "No reports match your selected filters. Try resetting your search or filter options."
                              : "Great job! There are currently no reports filed in this community."}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    // Reports Rows
                    filteredReports.map((report) => {
                      const targetType = getReportTargetType(report);
                      const targetId = getReportTargetId(report);
                      const reporterName = getUserDisplayName(report.reporter, report.reporterId);
                      const reporterInitials = getUserInitials(report.reporter);
                      const reporterAvatar = report.reporter?.profile_picture_url;
                      const createdAt = report.createdAt || report.created_at;

                      return (
                        <TableRow key={report.id} className="hover:bg-muted/30 transition-colors">
                          {/* Reporter */}
                          <TableCell>
                            <div className="flex items-center gap-2.5">
                              <Avatar className="h-8 w-8 border">
                                {reporterAvatar && <AvatarImage src={reporterAvatar} alt={reporterName} />}
                                <AvatarFallback className="text-[11px] font-semibold bg-primary/10 text-primary">
                                  {reporterInitials}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-foreground truncate max-w-[140px]">
                                  {reporterName}
                                </p>
                                {report.reporter?.username && (
                                  <p className="text-[11px] text-muted-foreground truncate max-w-[140px]">
                                    @{report.reporter.username}
                                  </p>
                                )}
                              </div>
                            </div>
                          </TableCell>

                          {/* Target Type */}
                          <TableCell>
                            <div className="flex flex-col gap-1 items-start">
                              <TargetTypeBadge type={targetType} />
                              {targetId && (
                                <span className="text-[10px] text-muted-foreground font-mono truncate max-w-[100px]">
                                  {targetId.slice(0, 8)}...
                                </span>
                              )}
                            </div>
                          </TableCell>

                          {/* Reason */}
                          <TableCell>
                            <div className="max-w-[320px]">
                              <p className="text-xs text-foreground font-normal line-clamp-2 leading-relaxed">
                                {report.reason}
                              </p>
                            </div>
                          </TableCell>

                          {/* Status */}
                          <TableCell>
                            <StatusBadge status={report.status} />
                          </TableCell>

                          {/* Created At */}
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="text-xs text-foreground font-medium">
                                {formatRelativeTime(createdAt)}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                {formatDate(createdAt)}
                              </span>
                            </div>
                          </TableCell>

                          {/* Actions */}
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenReview(report)}
                              className="h-8 px-3 text-xs gap-1.5 font-medium hover:bg-primary hover:text-primary-foreground transition-colors"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              <span>Review</span>
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination Controls */}
            {reportsMeta && reportsMeta.totalPages && reportsMeta.totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/20 text-xs">
                <div className="text-muted-foreground">
                  Showing page <span className="font-semibold text-foreground">{reportsPage}</span>{" "}
                  of <span className="font-semibold text-foreground">{reportsMeta.totalPages}</span>{" "}
                  ({reportsMeta.total || 0} total reports)
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setReportsPage((p) => Math.max(1, p - 1))}
                    disabled={reportsPage <= 1 || isFetchingReports}
                    className="h-7 px-2.5 text-xs gap-1"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    <span>Previous</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setReportsPage((p) => p + 1)}
                    disabled={
                      reportsPage >= (reportsMeta.totalPages || 1) || isFetchingReports
                    }
                    className="h-7 px-2.5 text-xs gap-1"
                  >
                    <span>Next</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* ================================================================= */}
        {/* TAB 2: MODERATION ACTION HISTORY */}
        {/* ================================================================= */}
        <TabsContent value="actions" className="space-y-6 outline-none">
          <Card className="bg-card/50 shadow-none border">
            <CardContent className="p-4 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search actions by moderator, target user, action type, notes..."
                  value={actionsSearch}
                  onChange={(e) => setActionsSearch(e.target.value)}
                  className="pl-9 h-9"
                />
                {actionsSearch && (
                  <button
                    type="button"
                    onClick={() => setActionsSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
                  >
                    Clear
                  </button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm overflow-hidden border">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="w-[180px]">Moderator</TableHead>
                    <TableHead className="w-[180px]">Target User</TableHead>
                    <TableHead className="w-[160px]">Action Taken</TableHead>
                    <TableHead className="min-w-[220px]">Notes</TableHead>
                    <TableHead className="w-[140px]">Report Ref</TableHead>
                    <TableHead className="w-[160px]">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingActions ? (
                    Array.from({ length: 5 }).map((_, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <Skeleton className="h-8 w-32" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-8 w-32" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-6 w-24 rounded-full" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-full max-w-[200px]" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-20" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-24" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : isErrorActions ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-32 text-center">
                        <div className="flex flex-col items-center justify-center gap-2 text-destructive">
                          <AlertTriangle className="h-6 w-6" />
                          <p className="font-medium text-sm">Failed to load action history.</p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => refetchActions()}
                            className="mt-1"
                          >
                            Try Again
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : filteredActions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-40 text-center">
                        <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                          <History className="h-8 w-8 text-muted-foreground/60 mb-1" />
                          <p className="text-base font-semibold text-foreground">
                            No moderation actions recorded
                          </p>
                          <p className="text-xs max-w-sm">
                            {actionsSearch
                              ? "No actions match your search keywords."
                              : "No formal moderation actions have been taken in this community yet."}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredActions.map((action) => {
                      const modName = getUserDisplayName(action.moderator, action.moderatorId);
                      const targetName = getUserDisplayName(
                        action.targetUser,
                        action.targetUserId || undefined
                      );
                      const actionType = action.actionType || action.action_type || "warn";
                      const createdAt = action.createdAt || action.created_at;
                      const reportRef = action.reportId || action.report_id;

                      return (
                        <TableRow key={action.id} className="hover:bg-muted/30">
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Avatar className="h-7 w-7 border">
                                {action.moderator?.profile_picture_url && (
                                  <AvatarImage src={action.moderator.profile_picture_url} />
                                )}
                                <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                                  {getUserInitials(action.moderator)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="truncate max-w-[130px]">
                                <p className="text-xs font-medium text-foreground truncate">
                                  {modName}
                                </p>
                              </div>
                            </div>
                          </TableCell>

                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Avatar className="h-7 w-7 border">
                                {action.targetUser?.profile_picture_url && (
                                  <AvatarImage src={action.targetUser.profile_picture_url} />
                                )}
                                <AvatarFallback className="text-[10px] bg-muted text-muted-foreground">
                                  {getUserInitials(action.targetUser)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="truncate max-w-[130px]">
                                <p className="text-xs font-medium text-foreground truncate">
                                  {targetName}
                                </p>
                              </div>
                            </div>
                          </TableCell>

                          <TableCell>
                            <ActionTypeBadge actionType={actionType} />
                          </TableCell>

                          <TableCell>
                            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                              {action.notes || <span className="italic">No notes provided</span>}
                            </p>
                          </TableCell>

                          <TableCell>
                            {reportRef ? (
                              <Badge
                                variant="outline"
                                className="font-mono text-[10px] cursor-pointer hover:bg-muted"
                                onClick={() => {
                                  navigator.clipboard.writeText(reportRef);
                                  toast.info("Copied report ID to clipboard");
                                }}
                              >
                                {reportRef.slice(0, 8)}...
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>

                          <TableCell>
                            <span className="text-xs text-muted-foreground">
                              {formatDate(createdAt)}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {actionsMeta && actionsMeta.totalPages && actionsMeta.totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/20 text-xs">
                <div className="text-muted-foreground">
                  Showing page <span className="font-semibold text-foreground">{actionsPage}</span>{" "}
                  of <span className="font-semibold text-foreground">{actionsMeta.totalPages}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setActionsPage((p) => Math.max(1, p - 1))}
                    disabled={actionsPage <= 1 || isFetchingActions}
                    className="h-7 px-2.5 text-xs"
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setActionsPage((p) => p + 1)}
                    disabled={
                      actionsPage >= (actionsMeta.totalPages || 1) || isFetchingActions
                    }
                    className="h-7 px-2.5 text-xs"
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* ================================================================= */}
        {/* TAB 3: BANNED USERS */}
        {/* ================================================================= */}
        <TabsContent value="bans" className="space-y-6 outline-none">
          <Card className="bg-card/50 shadow-none border">
            <CardContent className="p-4 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search banned members by name, username, reason..."
                  value={bansSearch}
                  onChange={(e) => setBansSearch(e.target.value)}
                  className="pl-9 h-9"
                />
                {bansSearch && (
                  <button
                    type="button"
                    onClick={() => setBansSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
                  >
                    Clear
                  </button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm overflow-hidden border">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="w-[240px]">Banned Member</TableHead>
                    <TableHead className="w-[140px]">Scope / Context</TableHead>
                    <TableHead className="min-w-[240px]">Reason</TableHead>
                    <TableHead className="w-[180px]">Banned By</TableHead>
                    <TableHead className="w-[160px]">Banned Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingBans ? (
                    Array.from({ length: 4 }).map((_, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <Skeleton className="h-9 w-40" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-6 w-20 rounded-full" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-48" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-32" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-24" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : isErrorBans ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-32 text-center">
                        <div className="flex flex-col items-center justify-center gap-2 text-destructive">
                          <AlertTriangle className="h-6 w-6" />
                          <p className="font-medium text-sm">Failed to load banned users list.</p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => refetchBans()}
                            className="mt-1"
                          >
                            Try Again
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : filteredBans.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-40 text-center">
                        <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                          <ShieldCheck className="h-8 w-8 text-emerald-500/80 mb-1" />
                          <p className="text-base font-semibold text-foreground">
                            No banned users
                          </p>
                          <p className="text-xs max-w-sm">
                            {bansSearch
                              ? "No banned members match your search criteria."
                              : "There are currently no active bans recorded in this community."}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredBans.map((ban) => {
                      const userName = getUserDisplayName(ban.user, ban.userId || ban.user_id);
                      const userInitials = getUserInitials(ban.user);
                      const userAvatar = ban.user?.profile_picture_url;
                      const bannerName =
                        typeof ban.bannedBy === "object" && ban.bannedBy !== null
                          ? getUserDisplayName(ban.bannedBy)
                          : ban.banner
                          ? getUserDisplayName(ban.banner)
                          : typeof ban.bannedBy === "string"
                          ? `Moderator (${ban.bannedBy.slice(0, 8)}...)`
                          : "Moderator";
                      const bannedAt = ban.bannedAt || ban.banned_at;
                      const scope = ban.type || ban.scope || "Events & Hangouts";

                      return (
                        <TableRow key={ban.id} className="hover:bg-muted/30">
                          <TableCell>
                            <div className="flex items-center gap-2.5">
                              <Avatar className="h-8 w-8 border">
                                {userAvatar && <AvatarImage src={userAvatar} alt={userName} />}
                                <AvatarFallback className="text-[11px] font-semibold bg-rose-500/10 text-rose-600">
                                  {userInitials}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-foreground truncate max-w-[150px]">
                                  {userName}
                                </p>
                                {ban.user?.username && (
                                  <p className="text-[11px] text-muted-foreground truncate max-w-[150px]">
                                    @{ban.user.username}
                                  </p>
                                )}
                              </div>
                            </div>
                          </TableCell>

                          <TableCell>
                            <Badge
                              variant="outline"
                              className="font-medium text-[11px] border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300"
                            >
                              {scope}
                            </Badge>
                          </TableCell>

                          <TableCell>
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {ban.reason || <span className="italic">No reason recorded</span>}
                            </p>
                          </TableCell>

                          <TableCell>
                            <span className="text-xs text-foreground font-medium">
                              {bannerName}
                            </span>
                          </TableCell>

                          <TableCell>
                            <span className="text-xs text-muted-foreground">
                              {formatDate(bannedAt)}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* =================================================================== */}
      {/* REVIEW & MODERATION ACTION DIALOG */}
      {/* =================================================================== */}
      <Dialog
        open={Boolean(selectedReport)}
        onOpenChange={(open) => {
          if (!open) setSelectedReport(null);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedReport && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between gap-2 mr-6">
                  <DialogTitle className="text-xl font-bold flex items-center gap-2">
                    <ShieldAlert className="h-5 w-5 text-amber-500" />
                    <span>Review Moderation Report</span>
                  </DialogTitle>
                  <StatusBadge status={selectedReport.status} />
                </div>
                <DialogDescription className="text-xs text-muted-foreground">
                  Report ID: <span className="font-mono">{selectedReport.id}</span> • Filed{" "}
                  {formatDate(selectedReport.createdAt || selectedReport.created_at)}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-5 py-2">
                {/* 1. Report Details Overview */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* Reporter Card */}
                  <div className="p-3 rounded-lg border bg-muted/30 space-y-2">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                      Reporter
                    </span>
                    <div className="flex items-center gap-2.5">
                      <Avatar className="h-9 w-9 border">
                        {selectedReport.reporter?.profile_picture_url && (
                          <AvatarImage src={selectedReport.reporter.profile_picture_url} />
                        )}
                        <AvatarFallback className="text-xs bg-primary/10 text-primary">
                          {getUserInitials(selectedReport.reporter)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-foreground truncate">
                          {getUserDisplayName(
                            selectedReport.reporter,
                            selectedReport.reporterId || selectedReport.reporter_id
                          )}
                        </p>
                        {selectedReport.reporter?.username && (
                          <p className="text-[11px] text-muted-foreground truncate">
                            @{selectedReport.reporter.username}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Target Entity Card */}
                  <div className="p-3 rounded-lg border bg-muted/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                        Reported Target
                      </span>
                      <TargetTypeBadge type={getReportTargetType(selectedReport)} />
                    </div>
                    <div>
                      {getReportTargetId(selectedReport) ? (
                        <div className="flex items-center gap-1.5 font-mono text-xs text-foreground">
                          <span className="truncate">
                            ID: {getReportTargetId(selectedReport)}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const tid = getReportTargetId(selectedReport);
                              if (tid) {
                                navigator.clipboard.writeText(tid);
                                toast.info("Copied Target ID to clipboard");
                              }
                            }}
                            className="text-muted-foreground hover:text-foreground p-0.5 rounded"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">Target not specified</p>
                      )}

                      {/* Snippets if available */}
                      {selectedReport.post?.title && (
                        <p className="text-xs text-muted-foreground truncate mt-1">
                          Post Title: &quot;{selectedReport.post.title}&quot;
                        </p>
                      )}
                      {selectedReport.comment?.content && (
                        <p className="text-xs text-muted-foreground line-clamp-1 mt-1">
                          Comment: &quot;{selectedReport.comment.content}&quot;
                        </p>
                      )}
                      {selectedReport.event?.title && (
                        <p className="text-xs text-muted-foreground truncate mt-1">
                          Event: &quot;{selectedReport.event.title}&quot;
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* 2. Reported Reason */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Reported Reason / Violation
                  </Label>
                  <div className="p-3.5 rounded-lg border border-amber-500/20 bg-amber-500/5 text-foreground text-xs leading-relaxed font-normal">
                    {selectedReport.reason}
                  </div>
                </div>

                {/* Reviewer audit info if already reviewed */}
                {(selectedReport.reviewedBy || selectedReport.reviewed_by) && (
                  <div className="p-2.5 rounded-md bg-muted/40 text-[11px] text-muted-foreground flex items-center gap-2">
                    <Info className="h-3.5 w-3.5 text-sky-500 shrink-0" />
                    <span>
                      Reviewed by{" "}
                      <strong className="text-foreground font-medium">
                        {getUserDisplayName(
                          selectedReport.reviewer,
                          selectedReport.reviewedBy || selectedReport.reviewed_by || undefined
                        )}
                      </strong>{" "}
                      on {formatDate(selectedReport.reviewedAt || selectedReport.reviewed_at)}
                    </span>
                  </div>
                )}

                <div className="border-t pt-4 space-y-4">
                  {/* 3. Section A: Update Status */}
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Change Report Status</Label>
                    <div className="flex items-center gap-2">
                      <Select
                        value={dialogStatus}
                        onValueChange={(val) => {
                          if (val) {
                            setDialogStatus(val as ReportStatus);
                          }
                        }}
                      >
                        <SelectTrigger className="w-[180px] h-9 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="reviewing">Reviewing</SelectItem>
                          <SelectItem value="resolved">Resolved</SelectItem>
                          <SelectItem value="dismissed">Dismissed</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={
                          dialogStatus === selectedReport.status ||
                          updateStatusMutation.isPending
                        }
                        onClick={() => {
                          updateStatusMutation.mutate({
                            reportId: selectedReport.id,
                            status: dialogStatus,
                          });
                        }}
                        className="h-9 px-3 text-xs gap-1"
                      >
                        {updateStatusMutation.isPending && (
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        )}
                        <span>Update Status</span>
                      </Button>
                    </div>
                  </div>

                  {/* 4. Section B: Moderation Action Form */}
                  <form
                    onSubmit={handleSubmit(onTakeActionSubmit)}
                    className="p-4 rounded-lg border border-primary/20 bg-primary/[0.02] space-y-3.5"
                  >
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                      <ShieldCheck className="h-4 w-4 text-primary" />
                      <span>Take Moderation Action</span>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      {/* Action Type */}
                      <div className="space-y-1.5">
                        <Label htmlFor="actionType" className="text-xs">
                          Action Type <span className="text-destructive">*</span>
                        </Label>
                        <Select
                          defaultValue="content_removed"
                          onValueChange={(val) => {
                            if (val) {
                              setValue("actionType", val as ModerationActionType);
                            }
                          }}
                        >
                          <SelectTrigger id="actionType" className="h-9 text-xs">
                            <SelectValue placeholder="Select an action" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="warn">Issue Warning</SelectItem>
                            <SelectItem value="suspend">Temporary Suspension</SelectItem>
                            <SelectItem value="ban">Community Ban</SelectItem>
                            <SelectItem value="unban">Lift Ban</SelectItem>
                            <SelectItem value="content_removed">Remove Flagged Content</SelectItem>
                            <SelectItem value="content_restored">Restore Content</SelectItem>
                          </SelectContent>
                        </Select>
                        {errors.actionType && (
                          <p className="text-[11px] text-destructive">
                            {errors.actionType.message}
                          </p>
                        )}
                      </div>

                      {/* Notes */}
                      <div className="space-y-1.5">
                        <Label htmlFor="notes" className="text-xs">
                          Moderator Notes & Context (Optional)
                        </Label>
                        <Textarea
                          id="notes"
                          placeholder="State the reason for this action, violations, or internal notes for moderation audit..."
                          {...register("notes")}
                          className="min-h-[72px] text-xs resize-none"
                        />
                        {errors.notes && (
                          <p className="text-[11px] text-destructive">{errors.notes.message}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-end pt-1">
                      <Button
                        type="submit"
                        disabled={takeActionMutation.isPending}
                        className="h-9 px-4 text-xs font-semibold gap-1.5"
                      >
                        {takeActionMutation.isPending ? (
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Send className="h-3.5 w-3.5" />
                        )}
                        <span>Apply Moderation Action</span>
                      </Button>
                    </div>
                  </form>
                </div>
              </div>

              <DialogFooter className="border-t pt-3 flex sm:justify-between items-center">
                <p className="text-[11px] text-muted-foreground">
                  Applying an action resolves the report and logs an audit record.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedReport(null)}
                  className="h-8 px-3 text-xs"
                >
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
