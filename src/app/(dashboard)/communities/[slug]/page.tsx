"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import {
  Users,
  MessageSquare,
  Calendar,
  ShieldAlert,
  Clock,
  UserPlus,
  Crown,
  ShieldCheck,
  Shield,
  Globe,
  Lock,
  ArrowLeft,
  ArrowRight,
  AlertCircle,
  RefreshCw,
  Tag,
  MapPin,
  CalendarDays,
  FileText,
  Settings,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { apiGet } from "@/lib/api-client";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

// ============================================================================
// Types
// ============================================================================

export interface CommunityCategory {
  id: string;
  name: string;
}

export interface CommunityLocation {
  id: string;
  place_name: string;
  latitude: number | string;
  longitude: number | string;
}

export interface CommunityDetail {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  rules: string | null;
  creator_id: string;
  location_id: string | null;
  category_id: string;
  banner_url: string | null;
  profile_picture_url: string | null;
  is_private: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  category?: CommunityCategory | null;
  location?: CommunityLocation | null;
}

export interface CommunityOverviewResponse {
  community: CommunityDetail;
  myRole: "owner" | "admin" | "moderator";
  memberCount: number;
}

export interface CommunityStatsResponse {
  totalMembers: number;
  totalPosts: number;
  totalEvents: number;
  pendingReports: number;
  pendingEvents: number;
  newMembersThisWeek: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatCategoryName(name?: string | null): string {
  if (!name) return "General";
  return name
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "N/A";
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(dateStr));
  } catch {
    return dateStr;
  }
}

// ============================================================================
// Main Page Component
// ============================================================================

export default function CommunityOverviewPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug as string;
  const router = useRouter();

  // Fetch Community Overview
  const {
    data: overviewData,
    isLoading: isLoadingOverview,
    isError: isErrorOverview,
    error: errorOverview,
    refetch: refetchOverview,
  } = useQuery<CommunityOverviewResponse>({
    queryKey: ["adminCommunityOverview", slug],
    queryFn: () => apiGet<CommunityOverviewResponse>(`/admin/communities/${slug}`),
    enabled: Boolean(slug),
  });

  // Fetch Community Stats
  const {
    data: statsData,
    isLoading: isLoadingStats,
    isError: isErrorStats,
    error: errorStats,
    refetch: refetchStats,
  } = useQuery<CommunityStatsResponse>({
    queryKey: ["adminCommunityStats", slug],
    queryFn: () => apiGet<CommunityStatsResponse>(`/admin/communities/${slug}/stats`),
    enabled: Boolean(slug),
  });

  const isLoading = isLoadingOverview || isLoadingStats;
  const isError = isErrorOverview || isErrorStats;
  const primaryError = errorOverview || errorStats;

  const isForbidden =
    (isAxiosError(errorOverview) && errorOverview.response?.status === 403) ||
    (isAxiosError(errorStats) && errorStats.response?.status === 403);

  const isNotFound =
    (isAxiosError(errorOverview) && errorOverview.response?.status === 404) ||
    (isAxiosError(errorStats) && errorStats.response?.status === 404);

  // Handle toasts on error
  React.useEffect(() => {
    if (primaryError) {
      if (isAxiosError(primaryError)) {
        if (primaryError.response?.status === 401) {
          toast.error("Session expired. Redirecting to login...");
          router.replace("/login");
          return;
        }
        if (primaryError.response?.status === 403) {
          toast.error("Access denied. Admin or moderator permissions required.");
          return;
        }
        if (primaryError.response?.status === 404) {
          toast.error("Community not found.");
          return;
        }
        const apiMessage = (
          primaryError.response?.data as { error?: { message?: string } }
        )?.error?.message;
        toast.error(apiMessage || primaryError.message || "Failed to load community overview");
      } else {
        toast.error((primaryError as Error).message || "An unexpected error occurred");
      }
    }
  }, [primaryError, router]);

  const handleRefetchAll = () => {
    refetchOverview();
    refetchStats();
  };

  // --------------------------------------------------------------------------
  // Loading State (Skeletons)
  // --------------------------------------------------------------------------
  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
        {/* Header Skeleton */}
        <Card className="border-border bg-card shadow-sm overflow-hidden">
          <div className="h-28 sm:h-36 bg-muted/60 animate-pulse w-full" />
          <CardContent className="relative px-6 pb-6 pt-0">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-12 sm:-mt-14 mb-4">
              <Skeleton className="size-24 sm:size-28 rounded-2xl ring-4 ring-background shrink-0" />
              <div className="flex flex-wrap gap-2">
                <Skeleton className="h-9 w-28 rounded-lg" />
                <Skeleton className="h-9 w-28 rounded-lg" />
              </div>
            </div>
            <div className="space-y-3">
              <Skeleton className="h-7 w-64 rounded-md" />
              <div className="flex flex-wrap gap-2">
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-5 w-28 rounded-full" />
                <Skeleton className="h-5 w-24 rounded-full" />
              </div>
              <Skeleton className="h-4 w-full max-w-2xl rounded-md" />
              <Skeleton className="h-4 w-3/4 max-w-xl rounded-md" />
            </div>
          </CardContent>
        </Card>

        {/* 6 Stat Cards Skeleton */}
        <div>
          <div className="mb-3">
            <Skeleton className="h-5 w-36 rounded-md" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="p-4 space-y-3 border-border bg-card shadow-sm">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-28 rounded-md" />
                  <Skeleton className="size-8 rounded-lg" />
                </div>
                <Skeleton className="h-8 w-16 rounded-md" />
                <Skeleton className="h-3.5 w-36 rounded-md" />
              </Card>
            ))}
          </div>
        </div>

        {/* Bottom Details Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 p-6 space-y-4">
            <Skeleton className="h-5 w-40 rounded-md" />
            <Skeleton className="h-4 w-full rounded-md" />
            <Skeleton className="h-4 w-5/6 rounded-md" />
            <Skeleton className="h-4 w-2/3 rounded-md" />
          </Card>
          <Card className="p-6 space-y-4">
            <Skeleton className="h-5 w-32 rounded-md" />
            <div className="space-y-2">
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // 403 Forbidden State: "Access Denied"
  // --------------------------------------------------------------------------
  if (isForbidden) {
    const errorMsg =
      (errorOverview as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message ||
      (errorStats as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message ||
      "Only community administrators, moderators, and the owner can access this dashboard.";

    return (
      <div className="flex flex-col items-center justify-center min-h-[65vh] p-6 max-w-2xl mx-auto w-full text-center">
        <Card className="w-full border-destructive/30 bg-destructive/5 dark:bg-destructive/10 shadow-md">
          <CardHeader className="flex flex-col items-center gap-3 pt-8 pb-4">
            <div className="size-16 rounded-2xl bg-destructive/15 text-destructive flex items-center justify-center ring-8 ring-destructive/10">
              <ShieldAlert className="size-8" />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
              Access Denied
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground max-w-md mx-auto">
              {errorMsg}
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-6">
            <div className="rounded-lg bg-background/80 border border-border p-4 text-xs text-muted-foreground text-left max-w-md mx-auto space-y-1.5">
              <div className="font-semibold text-foreground flex items-center gap-1.5">
                <AlertCircle className="size-3.5 text-muted-foreground" />
                Community Context:
              </div>
              <p className="font-mono break-all">{slug}</p>
              <p className="text-[11px] text-muted-foreground/80 pt-1">
                You must hold the role of Owner, Administrator, or Moderator in this
                community to view aggregated stats and administrative controls.
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col sm:flex-row items-center justify-center gap-3 bg-muted/30 border-t border-border/50 py-4 px-6">
            <Button
              variant="outline"
              onClick={handleRefetchAll}
              className="w-full sm:w-auto gap-2"
            >
              <RefreshCw className="size-4" />
              Try Again
            </Button>
            <Button
              render={<Link href="/" />}
              className="w-full sm:w-auto gap-2"
            >
              <ArrowLeft className="size-4" />
              Back to Dashboard
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // 404 Not Found State
  // --------------------------------------------------------------------------
  if (isNotFound) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 max-w-lg mx-auto text-center">
        <Card className="w-full border-border shadow-sm">
          <CardHeader className="flex flex-col items-center gap-3 pt-8 pb-4">
            <div className="size-14 rounded-2xl bg-muted text-muted-foreground flex items-center justify-center">
              <AlertCircle className="size-7" />
            </div>
            <CardTitle className="text-xl font-semibold">Community Not Found</CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              We couldn&apos;t find a community with the slug &ldquo;{slug}&rdquo;. It may
              have been deleted or renamed.
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex justify-center pb-6">
            <Button render={<Link href="/" />} className="gap-2">
              <ArrowLeft className="size-4" />
              Return to Dashboard
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // General Error State
  // --------------------------------------------------------------------------
  if (isError || !overviewData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 max-w-lg mx-auto">
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="size-4" />
          <AlertTitle>Failed to load community</AlertTitle>
          <AlertDescription>
            {primaryError instanceof Error
              ? primaryError.message
              : "Unable to retrieve community overview and statistics. Please try again."}
          </AlertDescription>
        </Alert>
        <div className="flex gap-3">
          <Button variant="outline" onClick={handleRefetchAll} className="gap-2">
            <RefreshCw className="size-4" />
            Retry
          </Button>
          <Button
            render={<Link href="/" />}
            variant="secondary"
            className="gap-2"
          >
            <ArrowLeft className="size-4" />
            Dashboard Home
          </Button>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // Data extraction
  // --------------------------------------------------------------------------
  const { community, myRole } = overviewData;
  const stats = statsData || {
    totalMembers: overviewData.memberCount || 0,
    totalPosts: 0,
    totalEvents: 0,
    pendingReports: 0,
    pendingEvents: 0,
    newMembersThisWeek: 0,
  };

  // Role Badge Styling
  const renderRoleBadge = (role: "owner" | "admin" | "moderator") => {
    switch (role) {
      case "owner":
        return (
          <Badge
            variant="outline"
            className="gap-1.5 bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 font-semibold uppercase tracking-wider text-[11px] px-2.5 py-1 shadow-xs"
          >
            <Crown className="size-3.5 text-amber-600 dark:text-amber-400" />
            Owner
          </Badge>
        );
      case "admin":
        return (
          <Badge
            variant="outline"
            className="gap-1.5 bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30 font-semibold uppercase tracking-wider text-[11px] px-2.5 py-1 shadow-xs"
          >
            <ShieldCheck className="size-3.5 text-blue-600 dark:text-blue-400" />
            Admin
          </Badge>
        );
      case "moderator":
        return (
          <Badge
            variant="outline"
            className="gap-1.5 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 font-semibold uppercase tracking-wider text-[11px] px-2.5 py-1 shadow-xs"
          >
            <Shield className="size-3.5 text-emerald-600 dark:text-emerald-400" />
            Moderator
          </Badge>
        );
      default:
        return null;
    }
  };

  // Avatar Initials Fallback
  const communityInitials = community.name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();

  // Rules split
  const rulesList = community.rules
    ? community.rules
        .split("\n")
        .map((r) => r.trim())
        .filter(Boolean)
    : [];

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full">
      {/* ====================================================================
          0. In-Page Breadcrumb
      ==================================================================== */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href="/" />}>Dashboard</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{community.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* ====================================================================
          1. Community Header Card
      ==================================================================== */}
      <Card className="border-border bg-card shadow-sm overflow-hidden">
        {/* Banner Area */}
        <div className="relative h-28 sm:h-36 w-full bg-gradient-to-r from-primary/20 via-primary/10 to-muted border-b border-border/50">
          {community.banner_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={community.banner_url}
              alt={`${community.name} banner`}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-end pr-8 opacity-20 select-none">
              <Sparkles className="size-24 text-primary" />
            </div>
          )}
        </div>

        <CardContent className="relative px-5 sm:px-6 pb-6 pt-0">
          {/* Avatar and Quick Navigation */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-12 sm:-mt-14 mb-4">
            <Avatar className="size-24 sm:size-28 rounded-2xl ring-4 ring-background shadow-md border border-border bg-muted shrink-0">
              {community.profile_picture_url && (
                <AvatarImage
                  src={community.profile_picture_url}
                  alt={community.name}
                  className="object-cover"
                />
              )}
              <AvatarFallback className="rounded-2xl bg-primary text-primary-foreground text-xl sm:text-2xl font-bold tracking-tight">
                {communityInitials || "HH"}
              </AvatarFallback>
            </Avatar>

            {/* Quick Action Navigation Buttons */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button
                render={<Link href={`/communities/${slug}/members`} />}
                variant="outline"
                size="sm"
                className="gap-1.5 shadow-xs"
              >
                <Users className="size-3.5 text-muted-foreground" />
                <span>Members</span>
              </Button>
              <Button
                render={<Link href={`/communities/${slug}/posts`} />}
                variant="outline"
                size="sm"
                className="gap-1.5 shadow-xs"
              >
                <MessageSquare className="size-3.5 text-muted-foreground" />
                <span>Posts</span>
              </Button>
              <Button
                render={<Link href={`/communities/${slug}/events`} />}
                variant="outline"
                size="sm"
                className="gap-1.5 shadow-xs"
              >
                <Calendar className="size-3.5 text-muted-foreground" />
                <span>Events</span>
              </Button>
              <Button
                render={<Link href={`/communities/${slug}/reports`} />}
                variant="outline"
                size="sm"
                className="gap-1.5 shadow-xs"
              >
                <ShieldAlert className="size-3.5 text-muted-foreground" />
                <span>Reports</span>
              </Button>
              <Button
                render={<Link href={`/communities/${slug}/settings`} />}
                variant="outline"
                size="sm"
                className="gap-1.5 shadow-xs"
              >
                <Settings className="size-3.5 text-muted-foreground" />
                <span>Settings</span>
              </Button>
            </div>
          </div>

          {/* Title and Badges */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                {community.name}
              </h1>

              {/* User's Role Badge in this community */}
              {myRole && renderRoleBadge(myRole)}

              {/* Privacy Badge */}
              {community.is_private ? (
                <Badge
                  variant="outline"
                  className="gap-1.5 border-amber-500/30 text-amber-700 dark:text-amber-400 bg-amber-500/10 font-medium text-xs px-2.5 py-0.5"
                >
                  <Lock className="size-3.5" />
                  Private
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="gap-1.5 border-emerald-500/30 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 font-medium text-xs px-2.5 py-0.5"
                >
                  <Globe className="size-3.5" />
                  Public
                </Badge>
              )}

              {/* Category Badge (Locked / Read-Only) */}
              <Badge
                variant="secondary"
                className="gap-1.5 text-xs px-2.5 py-0.5 font-medium border border-border/60"
                title="Category is locked and cannot be changed after creation"
              >
                <Tag className="size-3.5 text-muted-foreground" />
                <span>{formatCategoryName(community.category?.name)}</span>
                <span className="text-[10px] text-muted-foreground uppercase ml-0.5 tracking-wider font-mono opacity-80">
                  (Locked)
                </span>
              </Badge>
            </div>

            {/* Description */}
            {community.description ? (
              <p className="text-sm text-muted-foreground leading-relaxed max-w-3xl">
                {community.description}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground/70 italic">
                No description provided for this community.
              </p>
            )}

            {/* Meta Row: Slug, Location, Created Date */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-1 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5 font-mono">
                <span className="text-muted-foreground/60">slug:</span>
                <span className="text-foreground">{community.slug}</span>
              </div>
              {community.location?.place_name && (
                <div className="flex items-center gap-1.5">
                  <MapPin className="size-3.5 text-muted-foreground" />
                  <span>{community.location.place_name}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <CalendarDays className="size-3.5 text-muted-foreground" />
                <span>Created {formatDate(community.created_at)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ====================================================================
          2. The 6 Stat Cards Grid
      ==================================================================== */}
      <div>
        <div className="flex items-center justify-between mb-3 px-0.5">
          <h2 className="text-base font-semibold tracking-tight text-foreground flex items-center gap-2">
            Community Overview &amp; Metrics
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefetchAll}
            className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className="size-3.5" />
            Refresh Stats
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Card 1: Total Members */}
          <Link
            href={`/communities/${slug}/members`}
            className="group/stat block focus-visible:outline-hidden"
          >
            <Card className="p-5 border-border bg-card shadow-xs transition-all duration-200 group-hover/stat:border-primary/50 group-hover/stat:shadow-md cursor-pointer relative overflow-hidden">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Total Members
                  </p>
                  <p className="text-3xl font-bold tracking-tight text-foreground font-mono">
                    {stats.totalMembers.toLocaleString()}
                  </p>
                </div>
                <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center group-hover/stat:bg-primary group-hover/stat:text-primary-foreground transition-colors">
                  <Users className="size-5" />
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                  <UserPlus className="size-3.5" />+{stats.newMembersThisWeek} this week
                </span>
                <span className="group-hover/stat:translate-x-0.5 transition-transform flex items-center gap-0.5 text-muted-foreground group-hover/stat:text-primary">
                  Manage members <ArrowRight className="size-3" />
                </span>
              </div>
            </Card>
          </Link>

          {/* Card 2: Total Posts */}
          <Link
            href={`/communities/${slug}/posts`}
            className="group/stat block focus-visible:outline-hidden"
          >
            <Card className="p-5 border-border bg-card shadow-xs transition-all duration-200 group-hover/stat:border-primary/50 group-hover/stat:shadow-md cursor-pointer relative overflow-hidden">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Total Posts
                  </p>
                  <p className="text-3xl font-bold tracking-tight text-foreground font-mono">
                    {stats.totalPosts.toLocaleString()}
                  </p>
                </div>
                <div className="size-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center group-hover/stat:bg-blue-600 group-hover/stat:text-white transition-colors">
                  <MessageSquare className="size-5" />
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                <span>Community discussions</span>
                <span className="group-hover/stat:translate-x-0.5 transition-transform flex items-center gap-0.5 text-muted-foreground group-hover/stat:text-primary">
                  Moderate posts <ArrowRight className="size-3" />
                </span>
              </div>
            </Card>
          </Link>

          {/* Card 3: Total Events */}
          <Link
            href={`/communities/${slug}/events`}
            className="group/stat block focus-visible:outline-hidden"
          >
            <Card className="p-5 border-border bg-card shadow-xs transition-all duration-200 group-hover/stat:border-primary/50 group-hover/stat:shadow-md cursor-pointer relative overflow-hidden">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Total Events
                  </p>
                  <p className="text-3xl font-bold tracking-tight text-foreground font-mono">
                    {stats.totalEvents.toLocaleString()}
                  </p>
                </div>
                <div className="size-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center group-hover/stat:bg-purple-600 group-hover/stat:text-white transition-colors">
                  <Calendar className="size-5" />
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                <span>Scheduled activities</span>
                <span className="group-hover/stat:translate-x-0.5 transition-transform flex items-center gap-0.5 text-muted-foreground group-hover/stat:text-primary">
                  View events <ArrowRight className="size-3" />
                </span>
              </div>
            </Card>
          </Link>

          {/* Card 4: Pending Reports (High Attention) */}
          <Link
            href={`/communities/${slug}/reports`}
            className="group/stat block focus-visible:outline-hidden"
          >
            <Card
              className={`p-5 border bg-card shadow-xs transition-all duration-200 group-hover/stat:shadow-md cursor-pointer relative overflow-hidden ${
                stats.pendingReports > 0
                  ? "border-destructive/40 bg-destructive/5 dark:bg-destructive/10 group-hover/stat:border-destructive"
                  : "border-border group-hover/stat:border-primary/50"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Pending Reports
                    </p>
                    {stats.pendingReports > 0 && (
                      <Badge
                        variant="destructive"
                        className="text-[10px] px-1.5 py-0 h-4 font-semibold"
                      >
                        Action Needed
                      </Badge>
                    )}
                  </div>
                  <p
                    className={`text-3xl font-bold tracking-tight font-mono ${
                      stats.pendingReports > 0
                        ? "text-destructive"
                        : "text-foreground"
                    }`}
                  >
                    {stats.pendingReports.toLocaleString()}
                  </p>
                </div>
                <div
                  className={`size-10 rounded-xl flex items-center justify-center transition-colors ${
                    stats.pendingReports > 0
                      ? "bg-destructive/15 text-destructive group-hover/stat:bg-destructive group-hover/stat:text-destructive-foreground"
                      : "bg-muted text-muted-foreground group-hover/stat:bg-foreground group-hover/stat:text-background"
                  }`}
                >
                  <ShieldAlert className="size-5" />
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {stats.pendingReports > 0
                    ? `${stats.pendingReports} reported item${stats.pendingReports > 1 ? "s" : ""} pending review`
                    : "All reports resolved"}
                </span>
                <span className="group-hover/stat:translate-x-0.5 transition-transform flex items-center gap-0.5 text-muted-foreground group-hover/stat:text-primary">
                  Review queue <ArrowRight className="size-3" />
                </span>
              </div>
            </Card>
          </Link>

          {/* Card 5: Pending Events (Needs Approval) */}
          <Link
            href={`/communities/${slug}/events`}
            className="group/stat block focus-visible:outline-hidden"
          >
            <Card
              className={`p-5 border bg-card shadow-xs transition-all duration-200 group-hover/stat:shadow-md cursor-pointer relative overflow-hidden ${
                stats.pendingEvents > 0
                  ? "border-amber-500/40 bg-amber-500/5 dark:bg-amber-500/10 group-hover/stat:border-amber-500"
                  : "border-border group-hover/stat:border-primary/50"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Pending Events
                    </p>
                    {stats.pendingEvents > 0 && (
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1.5 py-0 h-4 border-amber-500/40 text-amber-700 dark:text-amber-400 bg-amber-500/10 font-semibold"
                      >
                        Needs Approval
                      </Badge>
                    )}
                  </div>
                  <p
                    className={`text-3xl font-bold tracking-tight font-mono ${
                      stats.pendingEvents > 0
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-foreground"
                    }`}
                  >
                    {stats.pendingEvents.toLocaleString()}
                  </p>
                </div>
                <div
                  className={`size-10 rounded-xl flex items-center justify-center transition-colors ${
                    stats.pendingEvents > 0
                      ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 group-hover/stat:bg-amber-500 group-hover/stat:text-white"
                      : "bg-muted text-muted-foreground group-hover/stat:bg-foreground group-hover/stat:text-background"
                  }`}
                >
                  <Clock className="size-5" />
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {stats.pendingEvents > 0
                    ? `${stats.pendingEvents} proposed event${stats.pendingEvents > 1 ? "s" : ""} to approve`
                    : "No pending event proposals"}
                </span>
                <span className="group-hover/stat:translate-x-0.5 transition-transform flex items-center gap-0.5 text-muted-foreground group-hover/stat:text-primary">
                  Approve events <ArrowRight className="size-3" />
                </span>
              </div>
            </Card>
          </Link>

          {/* Card 6: New Members This Week */}
          <Link
            href={`/communities/${slug}/members`}
            className="group/stat block focus-visible:outline-hidden"
          >
            <Card className="p-5 border-border bg-card shadow-xs transition-all duration-200 group-hover/stat:border-primary/50 group-hover/stat:shadow-md cursor-pointer relative overflow-hidden">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    New Members This Week
                  </p>
                  <p className="text-3xl font-bold tracking-tight text-foreground font-mono">
                    +{stats.newMembersThisWeek.toLocaleString()}
                  </p>
                </div>
                <div className="size-10 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center group-hover/stat:bg-teal-600 group-hover/stat:text-white transition-colors">
                  <UserPlus className="size-5" />
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                <span>Joined in last 7 days</span>
                <span className="group-hover/stat:translate-x-0.5 transition-transform flex items-center gap-0.5 text-muted-foreground group-hover/stat:text-primary">
                  Member list <ArrowRight className="size-3" />
                </span>
              </div>
            </Card>
          </Link>
        </div>
      </div>

      {/* ====================================================================
          3. Details & Management Sections
      ==================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Community Rules & Information */}
        <div className="lg:col-span-2 space-y-6">
          {/* Rules Card */}
          <Card className="border-border bg-card shadow-xs">
            <CardHeader className="pb-3 border-b border-border/50">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <FileText className="size-4 text-primary" />
                  Community Rules &amp; Guidelines
                </CardTitle>
                <Button
                  render={<Link href={`/communities/${slug}/settings`} />}
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs gap-1"
                >
                  <Settings className="size-3" /> Edit in Settings
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              {rulesList.length > 0 ? (
                <div className="space-y-2.5">
                  {rulesList.map((rule, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-3 rounded-lg border border-border/40 bg-muted/20 p-3 text-sm"
                    >
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary font-mono mt-0.5">
                        {idx + 1}
                      </span>
                      <p className="text-foreground/90 leading-snug">{rule}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-6 text-center text-muted-foreground">
                  <CheckCircle2 className="size-8 text-muted-foreground/50 mb-2" />
                  <p className="text-sm font-medium">No custom rules set</p>
                  <p className="text-xs text-muted-foreground/70 max-w-sm mt-0.5">
                    Community rules help moderators manage expectations and maintain a safe,
                    engaging environment.
                  </p>
                  <Button
                    render={<Link href={`/communities/${slug}/settings`} />}
                    variant="outline"
                    size="sm"
                    className="mt-3 text-xs"
                  >
                    Add Rules
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Management Shortcuts */}
          <Card className="border-border bg-card shadow-xs">
            <CardHeader className="pb-3 border-b border-border/50">
              <CardTitle className="text-base font-semibold">
                Management Modules
              </CardTitle>
              <CardDescription>
                Quick access to community administration tools and moderation queues.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Link
                  href={`/communities/${slug}/members`}
                  className="flex items-start gap-3 p-3 rounded-lg border border-border hover:border-primary/40 hover:bg-muted/30 transition-all group"
                >
                  <div className="size-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <Users className="size-4" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors flex items-center gap-1">
                      Members Management
                      <ArrowRight className="size-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </p>
                    <p className="text-xs text-muted-foreground">
                      View roster, change roles, or kick members
                    </p>
                  </div>
                </Link>

                <Link
                  href={`/communities/${slug}/reports`}
                  className="flex items-start gap-3 p-3 rounded-lg border border-border hover:border-destructive/40 hover:bg-muted/30 transition-all group"
                >
                  <div className="size-9 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <ShieldAlert className="size-4" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium text-foreground group-hover:text-destructive transition-colors flex items-center gap-1">
                      Moderation Reports
                      <ArrowRight className="size-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Review flagged posts, comments, and members
                    </p>
                  </div>
                </Link>

                <Link
                  href={`/communities/${slug}/events`}
                  className="flex items-start gap-3 p-3 rounded-lg border border-border hover:border-primary/40 hover:bg-muted/30 transition-all group"
                >
                  <div className="size-9 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <Calendar className="size-4" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors flex items-center gap-1">
                      Events &amp; Hangouts
                      <ArrowRight className="size-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Approve member proposals or create events
                    </p>
                  </div>
                </Link>

                <Link
                  href={`/communities/${slug}/settings`}
                  className="flex items-start gap-3 p-3 rounded-lg border border-border hover:border-primary/40 hover:bg-muted/30 transition-all group"
                >
                  <div className="size-9 rounded-lg bg-muted text-muted-foreground flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <Settings className="size-4" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors flex items-center gap-1">
                      Community Settings
                      <ArrowRight className="size-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Privacy, description, rules, and danger zone
                    </p>
                  </div>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Metadata & Security Notes */}
        <div className="space-y-6">
          <Card className="border-border bg-card shadow-xs">
            <CardHeader className="pb-3 border-b border-border/50">
              <CardTitle className="text-base font-semibold">
                Community Metadata
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Category</span>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">
                    {formatCategoryName(community.category?.name)}
                  </span>
                  <Badge variant="outline" className="text-[10px] uppercase font-mono">
                    Locked
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground/80">
                  Per platform policy, category cannot be altered once created.
                </p>
              </div>

              <Separator />

              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Privacy Setting</span>
                <p className="text-sm font-medium text-foreground">
                  {community.is_private
                    ? "Private (Invitation/Approval only)"
                    : "Public (Open for all users to discover)"}
                </p>
              </div>

              <Separator />

              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Your Role</span>
                <div className="pt-0.5">{renderRoleBadge(myRole)}</div>
              </div>

              <Separator />

              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Creator ID</span>
                <p className="text-xs font-mono text-muted-foreground break-all">
                  {community.creator_id}
                </p>
              </div>

              {community.location?.place_name && (
                <>
                  <Separator />
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">Primary Location</span>
                    <p className="text-sm font-medium text-foreground">
                      {community.location.place_name}
                    </p>
                  </div>
                </>
              )}

              <Separator />

              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Registered On</span>
                <p className="text-sm font-medium text-foreground">
                  {formatDate(community.created_at)}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
