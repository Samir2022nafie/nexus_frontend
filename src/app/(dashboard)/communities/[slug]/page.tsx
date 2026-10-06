"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  Share2,
  Heart,
  Check,
  Loader2,
  Eye,
  LayoutDashboard,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { CroppedImage } from "@/components/ui/cropped-image";

import { apiGet, apiPost } from "@/lib/api-client";
import { getCategoryById } from "@/lib/taxonomy";
import { CreatePostDialog } from "@/components/create-post-dialog";
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

export interface PublicCommunityData {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  rules?: string | null;
  creator_id?: string;
  location_id?: string | null;
  category_id?: string;
  banner_url?: string | null;
  bannerUrl?: string | null;
  profile_picture_url?: string | null;
  profilePictureUrl?: string | null;
  is_private?: boolean;
  isPrivate?: boolean;
  memberCount?: number;
  member_count?: number;
  isMember?: boolean;
  myRole?: "owner" | "admin" | "moderator" | "member" | null;
  created_at?: string;
  category?: CommunityCategory | null;
  location?: CommunityLocation | null;
}

export interface CommunityStatsResponse {
  totalMembers: number;
  totalPosts: number;
  totalEvents: number;
  pendingReports: number;
  pendingEvents: number;
  newMembersThisWeek: number;
}

export interface PostAuthor {
  id: string;
  username: string;
  name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  profile_picture_url?: string | null;
}

export interface CommunityPostItem {
  id: string;
  communityId?: string;
  title: string;
  content: string;
  mediaUrl?: string | null;
  media_url?: string | null;
  createdAt?: string;
  created_at?: string;
  author: PostAuthor;
  tags?: string[];
  reactionCount?: number;
  reaction_count?: number;
  hasReacted?: boolean;
  commentCount?: number;
  comment_count?: number;
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
  const queryClient = useQueryClient();

  // Tab or view switcher for managers: "public" (community subreddit view) vs "admin" (management metrics)
  const [viewMode, setViewMode] = React.useState<"public" | "admin">("public");
  const [isCreatePostOpen, setIsCreatePostOpen] = React.useState(false);

  // 1. Fetch Public Community Details (works for anyone if public, or member if private)
  const {
    data: rawCommunityData,
    isLoading: isLoadingCommunity,
    isError: isErrorCommunity,
    error: errorCommunity,
    refetch: refetchCommunity,
  } = useQuery<PublicCommunityData>({
    queryKey: ["community", slug],
    queryFn: () => apiGet<PublicCommunityData>(`/communities/${slug}`),
    enabled: Boolean(slug),
  });

  const community = rawCommunityData;
  const myRole = community?.myRole;
  const isManager = myRole === "owner" || myRole === "admin" || myRole === "moderator";
  const isMember = Boolean(community?.isMember || isManager);
  const isPrivate = Boolean(community?.is_private ?? community?.isPrivate);

  // 2. Fetch Admin Stats only if user is a manager (owner, admin, moderator)
  const {
    data: statsData,
    isLoading: isLoadingStats,
    refetch: refetchStats,
  } = useQuery<CommunityStatsResponse>({
    queryKey: ["adminCommunityStats", slug],
    queryFn: () => apiGet<CommunityStatsResponse>(`/admin/communities/${slug}/stats`),
    enabled: Boolean(slug && isManager),
  });

  // 3. Fetch Community Posts for the public / member feed
  const {
    data: postsData,
    isLoading: isLoadingPosts,
    refetch: refetchPosts,
  } = useQuery<{ data?: CommunityPostItem[] } | CommunityPostItem[]>({
    queryKey: ["communityPosts", slug],
    queryFn: () =>
      apiGet<{ data?: CommunityPostItem[] } | CommunityPostItem[]>(
        `/communities/${slug}/posts?page=1&limit=20&sort=created_at&order=desc`
      ),
    enabled: Boolean(slug && !isErrorCommunity),
  });

  const posts: CommunityPostItem[] = React.useMemo(() => {
    if (!postsData) return [];
    if (Array.isArray(postsData)) return postsData;
    if (Array.isArray(postsData.data)) return postsData.data;
    return [];
  }, [postsData]);

  // Join Community Mutation
  const joinMutation = useMutation({
    mutationFn: () => apiPost(`/communities/${slug}/join`),
    onSuccess: () => {
      toast.success("Joined community successfully!");
      queryClient.invalidateQueries({ queryKey: ["community", slug] });
      queryClient.invalidateQueries({ queryKey: ["communityPosts", slug] });
      queryClient.invalidateQueries({ queryKey: ["managedCommunities"] });
    },
    onError: (err) => {
      if (isAxiosError(err)) {
        const msg = (err.response?.data as { error?: { message?: string } })?.error?.message;
        toast.error(msg || "Failed to join community");
      } else {
        toast.error((err as Error).message || "Failed to join community");
      }
    },
  });

  // Leave Community Mutation
  const leaveMutation = useMutation({
    mutationFn: () => apiPost(`/communities/${slug}/leave`),
    onSuccess: () => {
      toast.success("Left community");
      queryClient.invalidateQueries({ queryKey: ["community", slug] });
      queryClient.invalidateQueries({ queryKey: ["communityPosts", slug] });
      queryClient.invalidateQueries({ queryKey: ["managedCommunities"] });
    },
    onError: (err) => {
      if (isAxiosError(err)) {
        const msg = (err.response?.data as { error?: { message?: string } })?.error?.message;
        toast.error(msg || "Failed to leave community");
      } else {
        toast.error((err as Error).message || "Failed to leave community");
      }
    },
  });

  // Share Community Link
  const handleShareLink = () => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const link = `${origin}/communities/${slug}`;
    navigator.clipboard.writeText(link);
    toast.success("Community link copied to clipboard!");
  };

  const handleRefetchAll = () => {
    refetchCommunity();
    if (isManager) refetchStats();
    refetchPosts();
  };

  // --------------------------------------------------------------------------
  // Loading State
  // --------------------------------------------------------------------------
  if (isLoadingCommunity) {
    return (
      <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
        <Card className="border-border bg-card shadow-xs overflow-hidden">
          <div className="h-32 sm:h-44 bg-muted/60 animate-pulse w-full" />
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
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-48 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // 403 Forbidden on Public Community: Private Community Notice
  // --------------------------------------------------------------------------
  const isForbiddenPrivate =
    isAxiosError(errorCommunity) && errorCommunity.response?.status === 403;

  if (isForbiddenPrivate) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 max-w-lg mx-auto w-full text-center">
        <Card className="w-full border-border bg-card shadow-md">
          <CardHeader className="flex flex-col items-center gap-3 pt-8 pb-4">
            <div className="size-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center ring-8 ring-primary/5">
              <Lock className="size-8" />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
              Private Community
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground max-w-sm mx-auto">
              This community is private. You must be an active member to view its discussions, posts, and member directory.
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-6">
            <div className="rounded-lg bg-muted/40 border border-border p-3 text-xs text-muted-foreground text-center">
              Community Slug: <span className="font-mono font-semibold text-foreground">{slug}</span>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col sm:flex-row justify-center gap-3 pb-8">
            <Button
              onClick={() => joinMutation.mutate()}
              disabled={joinMutation.isPending}
              className="w-full sm:w-auto gap-2"
            >
              {joinMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <UserPlus className="size-4" />
              )}
              <span>Join Community</span>
            </Button>
            <Button
              render={<Link href="/explore" />}
              variant="outline"
              className="w-full sm:w-auto gap-2"
            >
              <CompassIcon className="size-4" />
              <span>Explore Other Communities</span>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // 404 Not Found
  // --------------------------------------------------------------------------
  const isNotFound =
    isAxiosError(errorCommunity) && errorCommunity.response?.status === 404;

  if (isNotFound) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 max-w-md mx-auto w-full text-center">
        <Card className="w-full border-border bg-card shadow-md">
          <CardHeader className="flex flex-col items-center gap-3 pt-8 pb-4">
            <div className="size-16 rounded-2xl bg-muted text-muted-foreground flex items-center justify-center">
              <AlertCircle className="size-8" />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
              Community Not Found
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              We couldn&apos;t find a community with the identifier &quot;{slug}&quot;. It may have been deleted or the link is incorrect.
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex justify-center pb-6">
            <Button render={<Link href="/explore" />} className="gap-2">
              <ArrowLeft className="size-4" />
              Explore Communities
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // General Error State
  // --------------------------------------------------------------------------
  if (isErrorCommunity || !community) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 max-w-lg mx-auto">
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="size-4" />
          <AlertTitle>Failed to load community</AlertTitle>
          <AlertDescription>
            {errorCommunity instanceof Error
              ? errorCommunity.message
              : "Unable to retrieve community details. Please try again."}
          </AlertDescription>
        </Alert>
        <div className="flex gap-3">
          <Button variant="outline" onClick={handleRefetchAll} className="gap-2">
            <RefreshCw className="size-4" />
            Retry
          </Button>
          <Button render={<Link href="/explore" />} variant="secondary" className="gap-2">
            <ArrowLeft className="size-4" />
            Explore
          </Button>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // Data Extraction
  // --------------------------------------------------------------------------
  const memberCount = community.memberCount ?? community.member_count ?? 0;
  const bannerUrl = community.banner_url || community.bannerUrl;
  const profilePicUrl = community.profile_picture_url || community.profilePictureUrl;
  const categoryMeta = getCategoryById(community.category_id) || community.category;
  const categoryLabel = categoryMeta?.name ? formatCategoryName(categoryMeta.name) : "General";

  const communityInitials = community.name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();

  const rulesList = community.rules
    ? community.rules
        .split("\n")
        .map((r) => r.trim())
        .filter(Boolean)
    : [];

  const stats = statsData || {
    totalMembers: memberCount,
    totalPosts: 0,
    totalEvents: 0,
    pendingReports: 0,
    pendingEvents: 0,
    newMembersThisWeek: 0,
  };

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
      case "moderator":
        return (
          <Badge
            variant="outline"
            className="gap-1.5 bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30 font-semibold uppercase tracking-wider text-[11px] px-2.5 py-1 shadow-xs"
          >
            <ShieldCheck className="size-3.5 text-blue-600 dark:text-blue-400" />
            Admin
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full">
      {/* ====================================================================
          1. Hero Banner & Identity Card
      ==================================================================== */}
      <Card className="border-border bg-card shadow-xs overflow-hidden">
        {/* Banner Area */}
        <div className="relative h-32 sm:h-44 w-full bg-gradient-to-r from-primary/20 via-primary/10 to-muted border-b border-border/50">
          {bannerUrl ? (
            <CroppedImage
              src={bannerUrl}
              alt={`${community.name} banner`}
              fill
              containerClassName="size-full rounded-none"
              className="size-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-muted/40 select-none">
              <Users className="size-16 text-muted-foreground/30" />
            </div>
          )}
        </div>

        <CardContent className="relative px-5 sm:px-6 pb-6 pt-0">
          {/* Avatar and Action Controls */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-12 sm:-mt-16 mb-4">
            <div className="relative size-24 sm:size-28 rounded-2xl ring-4 ring-background shadow-md border border-border bg-muted shrink-0 overflow-hidden flex items-center justify-center">
              {profilePicUrl ? (
                <CroppedImage
                  src={profilePicUrl}
                  alt={community.name}
                  fill
                  containerClassName="size-full rounded-2xl relative z-10"
                  className="size-full object-cover rounded-2xl"
                />
              ) : null}
              <span className="absolute inset-0 flex items-center justify-center rounded-2xl bg-muted text-muted-foreground z-0">
                <Users className="size-10 sm:size-12 text-muted-foreground" />
              </span>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {/* If user is manager, allow switching between Public View and Admin Dashboard */}
              {isManager && (
                <Button
                  variant={viewMode === "admin" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setViewMode(viewMode === "admin" ? "public" : "admin")}
                  className="gap-1.5 text-xs font-medium cursor-pointer shadow-xs"
                >
                  {viewMode === "admin" ? (
                    <>
                      <Eye className="size-3.5" />
                      <span>View Public Page</span>
                    </>
                  ) : (
                    <>
                      <LayoutDashboard className="size-3.5" />
                      <span>Admin Dashboard</span>
                    </>
                  )}
                </Button>
              )}

              {/* Join / Leave for non-managers */}
              {!isManager && (
                <>
                  {isMember ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => leaveMutation.mutate()}
                      disabled={leaveMutation.isPending}
                      className="gap-1.5 text-xs text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors cursor-pointer"
                    >
                      {leaveMutation.isPending ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Check className="size-3.5 text-emerald-500" />
                      )}
                      <span>Joined (Leave)</span>
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => joinMutation.mutate()}
                      disabled={joinMutation.isPending}
                      className="gap-1.5 text-xs font-medium cursor-pointer shadow-xs"
                    >
                      {joinMutation.isPending ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <UserPlus className="size-3.5" />
                      )}
                      <span>Join Community</span>
                    </Button>
                  )}
                </>
              )}

              {/* Share Community Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleShareLink}
                className="gap-1.5 text-xs cursor-pointer shadow-xs"
                title="Copy share link"
              >
                <Share2 className="size-3.5 text-muted-foreground" />
                <span>Share</span>
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
              {myRole && (myRole === "owner" || myRole === "admin" || myRole === "moderator") && (
                renderRoleBadge(myRole)
              )}

              {/* Privacy Badge */}
              {isPrivate ? (
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

              {/* Category Badge */}
              <Badge
                variant="secondary"
                className="gap-1.5 text-xs px-2.5 py-0.5 font-medium border border-border/60"
              >
                <Tag className="size-3.5 text-muted-foreground" />
                <span>{categoryLabel}</span>
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

            {/* Meta Row: Members count, Location, Created Date */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-1 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <Users className="size-3.5 text-primary" />
                <span>
                  {memberCount} {memberCount === 1 ? "member" : "members"}
                </span>
              </div>
              {community.location?.place_name && (
                <div className="flex items-center gap-1.5">
                  <MapPin className="size-3.5 text-muted-foreground" />
                  <span>{community.location.place_name}</span>
                </div>
              )}
              {community.created_at && (
                <div className="flex items-center gap-1.5">
                  <CalendarDays className="size-3.5 text-muted-foreground" />
                  <span>Created {formatDate(community.created_at)}</span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ====================================================================
          VIEW MODE 1: ADMIN MANAGEMENT DASHBOARD (If manager and active)
      ==================================================================== */}
      {isManager && viewMode === "admin" && (
        <div className="space-y-6">
          {/* Metrics Header */}
          <div className="flex items-center justify-between px-0.5">
            <h2 className="text-base font-semibold tracking-tight text-foreground flex items-center gap-2">
              Community Administration &amp; Metrics
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

          {/* The 6 Stat Cards */}
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

            {/* Card 4: Pending Reports */}
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
                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4 font-semibold">
                          Action Needed
                        </Badge>
                      )}
                    </div>
                    <p
                      className={`text-3xl font-bold tracking-tight font-mono ${
                        stats.pendingReports > 0 ? "text-destructive" : "text-foreground"
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
                      ? `${stats.pendingReports} report${stats.pendingReports > 1 ? "s" : ""} pending`
                      : "All reports resolved"}
                  </span>
                  <span className="group-hover/stat:translate-x-0.5 transition-transform flex items-center gap-0.5 text-muted-foreground group-hover/stat:text-primary">
                    Review queue <ArrowRight className="size-3" />
                  </span>
                </div>
              </Card>
            </Link>

            {/* Card 5: Pending Events */}
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
                        stats.pendingEvents > 0 ? "text-amber-600 dark:text-amber-400" : "text-foreground"
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
                      ? `${stats.pendingEvents} event proposal${stats.pendingEvents > 1 ? "s" : ""}`
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
                      New Members
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

          {/* Quick Management Shortcuts */}
          <Card className="border-border bg-card shadow-xs">
            <CardHeader className="pb-3 border-b border-border/50">
              <CardTitle className="text-base font-semibold">Management Modules</CardTitle>
              <CardDescription>
                Quick access to community administration tools and moderation queues.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                <Link
                  href={`/communities/${slug}/members`}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border/60 hover:border-primary/40 hover:bg-muted/40 transition-colors"
                >
                  <Users className="size-4 text-primary" />
                  <div>
                    <p className="text-xs font-semibold">Members</p>
                    <p className="text-[11px] text-muted-foreground">Roles & permissions</p>
                  </div>
                </Link>

                <Link
                  href={`/communities/${slug}/posts`}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border/60 hover:border-primary/40 hover:bg-muted/40 transition-colors"
                >
                  <MessageSquare className="size-4 text-primary" />
                  <div>
                    <p className="text-xs font-semibold">Posts</p>
                    <p className="text-[11px] text-muted-foreground">Moderate discussions</p>
                  </div>
                </Link>

                <Link
                  href={`/communities/${slug}/events`}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border/60 hover:border-primary/40 hover:bg-muted/40 transition-colors"
                >
                  <Calendar className="size-4 text-primary" />
                  <div>
                    <p className="text-xs font-semibold">Events</p>
                    <p className="text-[11px] text-muted-foreground">Approve & schedule</p>
                  </div>
                </Link>

                <Link
                  href={`/communities/${slug}/reports`}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border/60 hover:border-primary/40 hover:bg-muted/40 transition-colors"
                >
                  <ShieldAlert className="size-4 text-primary" />
                  <div>
                    <p className="text-xs font-semibold">Reports</p>
                    <p className="text-[11px] text-muted-foreground">Resolve infractions</p>
                  </div>
                </Link>

                <Link
                  href={`/communities/${slug}/settings`}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border/60 hover:border-primary/40 hover:bg-muted/40 transition-colors"
                >
                  <Settings className="size-4 text-primary" />
                  <div>
                    <p className="text-xs font-semibold">Settings</p>
                    <p className="text-[11px] text-muted-foreground">Community configuration</p>
                  </div>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ====================================================================
          VIEW MODE 2: PUBLIC COMMUNITY FEED & DETAILS (Subreddit-style)
      ==================================================================== */}
      {(!isManager || viewMode === "public") && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Feed Column (Posts & Discussions) */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between pb-1 border-b border-border/40">
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                <MessageSquare className="size-4 text-primary" />
                <span>Community Posts</span>
              </h2>
              <div className="flex items-center gap-2">
                {posts.length > 0 && (
                  <span className="text-xs text-muted-foreground font-mono">
                    {posts.length} {posts.length === 1 ? "post" : "posts"}
                  </span>
                )}
                {isManager && (
                  <Button
                    onClick={() => setIsCreatePostOpen(true)}
                    size="sm"
                    className="h-7 text-xs gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Plus className="size-3.5" />
                    <span>Create Post</span>
                  </Button>
                )}
              </div>
            </div>

            {isLoadingPosts ? (
              <div className="space-y-4">
                <Skeleton className="h-40 rounded-xl" />
                <Skeleton className="h-40 rounded-xl" />
                <Skeleton className="h-40 rounded-xl" />
              </div>
            ) : posts.length > 0 ? (
              <div className="space-y-4">
                {posts.map((post) => {
                  const authorName =
                    post.author.name ||
                    `${post.author.first_name || ""} ${post.author.last_name || ""}`.trim() ||
                    post.author.username;
                  const authorInitial = authorName[0]?.toUpperCase() || "U";
                  const postDate = post.createdAt || post.created_at;
                  const media = post.mediaUrl || post.media_url;

                  return (
                    <Card
                      key={post.id}
                      className="border-border bg-card shadow-xs hover:border-border/80 transition-colors overflow-hidden"
                    >
                      <CardHeader className="pb-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <Link
                            href={`/users/${post.author.id}`}
                            className="flex items-center gap-2.5 group hover:opacity-85 transition-opacity"
                          >
                            <Avatar size="sm" className="size-8">
                              {post.author.profile_picture_url && (
                                <AvatarImage
                                  src={post.author.profile_picture_url}
                                  alt={authorName}
                                  className="object-cover"
                                />
                              )}
                              <AvatarFallback className="text-xs font-semibold" />
                            </Avatar>
                            <div>
                              <p className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                                {authorName}
                              </p>
                              <p className="text-[10px] text-muted-foreground font-mono">
                                @{post.author.username}
                              </p>
                            </div>
                          </Link>

                          {postDate && (
                            <span className="text-[11px] text-muted-foreground">
                              {formatDate(postDate)}
                            </span>
                          )}
                        </div>

                        {post.title && (
                          <CardTitle className="text-base font-semibold text-foreground pt-1">
                            {post.title}
                          </CardTitle>
                        )}
                      </CardHeader>

                      <CardContent className="space-y-3 pt-0">
                        <p className="text-xs sm:text-sm text-foreground/90 leading-relaxed whitespace-pre-line">
                          {post.content}
                        </p>

                        {media && (
                          <div className="rounded-lg overflow-hidden border border-border bg-muted/30">
                            <CroppedImage
                              src={media}
                              alt="Post media"
                              containerClassName="w-full rounded-lg"
                              className="w-full h-full object-cover rounded-lg"
                            />
                          </div>
                        )}

                        {post.tags && post.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {post.tags.map((tag, i) => (
                              <Badge
                                key={i}
                                variant="secondary"
                                className="text-[10px] px-1.5 py-0 font-normal text-muted-foreground"
                              >
                                #{tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </CardContent>

                      <CardFooter className="pt-2 pb-3 border-t border-border/40 text-xs text-muted-foreground flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <span className="flex items-center gap-1.5">
                            <Heart className="size-3.5 text-rose-500/80" />
                            <span>{post.reactionCount ?? post.reaction_count ?? 0}</span>
                          </span>
                          <span className="flex items-center gap-1.5">
                            <MessageSquare className="size-3.5" />
                            <span>{post.commentCount ?? post.comment_count ?? 0}</span>
                          </span>
                        </div>

                        {isManager && (
                          <Button
                            render={<Link href={`/communities/${slug}/posts`} />}
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs px-2 text-muted-foreground"
                          >
                            Moderate
                          </Button>
                        )}
                      </CardFooter>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed border-border/80 bg-card/40">
                <MessageSquare className="size-10 text-muted-foreground/40 mb-3" />
                <h3 className="text-sm font-semibold text-foreground">No posts yet</h3>
                <p className="text-xs text-muted-foreground max-w-sm mt-1">
                  There haven&apos;t been any posts shared in this community yet. Check back soon for discussions and updates!
                </p>
                {isManager && (
                  <Button
                    onClick={() => setIsCreatePostOpen(true)}
                    size="sm"
                    className="mt-4 gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Plus className="size-3.5" />
                    <span>Create First Post</span>
                  </Button>
                )}
              </Card>
            )}
          </div>

          {/* Right Column: About Community & Guidelines Widget */}
          <div className="space-y-6">
            {/* About Community Card */}
            <Card className="border-border bg-card shadow-xs">
              <CardHeader className="pb-3 border-b border-border/40">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <CompassIcon className="size-4 text-primary" />
                  <span>About Community</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-4 text-xs">
                <p className="text-muted-foreground leading-relaxed">
                  {community.description || "Welcome to our community! Connect with like-minded hobbyists, share progress, and participate in discussions."}
                </p>

                <Separator />

                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Category</span>
                    <span className="font-medium text-foreground">{categoryLabel}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <span className="font-medium text-foreground">
                      {isPrivate ? "Private" : "Public"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Members</span>
                    <span className="font-medium font-mono text-foreground">{memberCount}</span>
                  </div>
                  {community.created_at && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Established</span>
                      <span className="font-medium text-foreground">{formatDate(community.created_at)}</span>
                    </div>
                  )}
                </div>

                {!isMember && (
                  <>
                    <Separator />
                    <div className="pt-1">
                      <Button
                        onClick={() => joinMutation.mutate()}
                        disabled={joinMutation.isPending}
                        className="w-full text-xs gap-1.5"
                      >
                        {joinMutation.isPending ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <UserPlus className="size-3.5" />
                        )}
                        <span>Join Community</span>
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Community Rules Card */}
            <Card className="border-border bg-card shadow-xs">
              <CardHeader className="pb-3 border-b border-border/40">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <FileText className="size-4 text-primary" />
                  <span>Rules &amp; Guidelines</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 text-xs">
                {rulesList.length > 0 ? (
                  <div className="space-y-2.5">
                    {rulesList.map((rule, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-2.5 rounded-md border border-border/40 bg-muted/20 p-2.5"
                      >
                        <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary font-mono mt-0.5">
                          {idx + 1}
                        </span>
                        <p className="text-foreground/90 leading-snug">{rule}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground italic">
                    Be respectful and follow standard community guidelines.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      <CreatePostDialog
        open={isCreatePostOpen}
        onOpenChange={setIsCreatePostOpen}
        communities={
          community
            ? [
                {
                  id: community.id,
                  name: community.name,
                  slug: community.slug,
                  role: (myRole as any) || "admin",
                },
              ]
            : []
        }
        defaultSlug={slug}
        onSuccess={() => {
          refetchPosts();
          refetchStats();
        }}
      />
    </div>
  );
}

function CompassIcon({ className }: { className?: string }) {
  return <Globe className={className} />;
}
