"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import {
  FileText,
  Search,
  RefreshCw,
  Eye,
  Trash2,
  Heart,
  MessageSquare,
  Clock,
  Tag as TagIcon,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  ArrowLeft,
  AlertCircle,
  Image as ImageIcon,
  MessageCircle,
} from "lucide-react";
import { toast } from "sonner";

import { apiGet, apiDelete, ApiMeta } from "@/lib/api-client";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";

// ============================================================================
// Type Definitions
// ============================================================================

export interface PostAuthor {
  id: string;
  username: string;
  name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  profile_picture_url?: string | null;
}

export interface PostCommentAuthor {
  id: string;
  username: string;
  name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  profile_picture_url?: string | null;
}

export interface PostComment {
  id: string;
  content: string;
  createdAt?: string;
  created_at?: string;
  author?: PostCommentAuthor | null;
}

export interface CommunityPost {
  id: string;
  communityId?: string;
  community_id?: string;
  title?: string | null;
  content?: string | null;
  mediaUrl?: string | null;
  media_url?: string | null;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
  deletedAt?: string | null;
  deleted_at?: string | null;
  author?: PostAuthor | null;
  tags?: unknown;
  reactionCount?: number;
  reaction_count?: number;
  commentCount?: number;
  comment_count?: number;
  hasReacted?: boolean;
  has_reacted?: boolean;
  hasSaved?: boolean;
  has_saved?: boolean;
}

export interface SinglePostDetailResponse extends CommunityPost {
  community?: {
    id: string;
    name: string;
    slug: string;
  };
  comments?: PostComment[];
}

export interface PaginatedPostsResponse {
  data: CommunityPost[];
  meta?: ApiMeta;
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
// Helpers
// ============================================================================

function extractTagNames(tags: unknown): string[] {
  if (!tags) return [];
  if (!Array.isArray(tags)) return [];
  return tags
    .map((t) => {
      if (typeof t === "string") return t;
      if (t && typeof t === "object") {
        if ("name" in t && typeof (t as { name: unknown }).name === "string") {
          return (t as { name: string }).name;
        }
        if (
          "tag" in t &&
          (t as { tag?: { name?: unknown } }).tag &&
          typeof (t as { tag: { name?: unknown } }).tag.name === "string"
        ) {
          return (t as { tag: { name: string } }).tag.name;
        }
      }
      return String(t);
    })
    .filter(Boolean);
}

function getAuthorDisplayName(author?: PostAuthor | null): string {
  if (!author) return "Unknown Author";
  const fullName = `${author.first_name || ""} ${author.last_name || ""}`.trim();
  if (fullName) return fullName;
  if (author.name) return author.name;
  return author.username || "Unknown";
}

function getAuthorInitials(author?: PostAuthor | null): string {
  if (!author) return "U";
  if (author.first_name && author.last_name) {
    return `${author.first_name[0]}${author.last_name[0]}`.toUpperCase();
  }
  if (author.name) {
    const parts = author.name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  }
  if (author.username) {
    return author.username.slice(0, 2).toUpperCase();
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
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date);
  } catch {
    return dateStr;
  }
}

function getPostTitle(post: CommunityPost): string {
  if (post.title && post.title.trim()) {
    return post.title.trim();
  }
  if (post.content && post.content.trim()) {
    const snippet = post.content.trim().slice(0, 60);
    return snippet.length < post.content.trim().length ? `${snippet}...` : snippet;
  }
  if (post.mediaUrl || post.media_url) {
    return "Media Post";
  }
  return "Untitled Post";
}

// ============================================================================
// Main Page Component
// ============================================================================

export default function CommunityPostsPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug as string;
  const queryClient = useQueryClient();

  // Active Tab: "active" | "removed"
  const [activeTab, setActiveTab] = React.useState<"active" | "removed">("active");

  // Pagination & Search
  const [page, setPage] = React.useState<number>(1);
  const limit = 20;
  const [searchQuery, setSearchQuery] = React.useState<string>("");

  // Post Detail Dialog State
  const [viewingPost, setViewingPost] = React.useState<CommunityPost | null>(null);

  // Remove Post Confirmation AlertDialog State
  const [postToRemove, setPostToRemove] = React.useState<CommunityPost | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState<boolean>(false);

  // Track locally removed posts during this session
  const [removedPostIds, setRemovedPostIds] = React.useState<Set<string>>(new Set());

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

  const canManagePosts =
    overviewData &&
    ["owner", "admin", "moderator"].includes(overviewData.myRole);

  // 2. Fetch Community Posts
  const {
    data: postsResponse,
    isLoading: isLoadingPosts,
    isFetching: isFetchingPosts,
    isError: isErrorPosts,
    refetch: refetchPosts,
  } = useQuery<PaginatedPostsResponse | CommunityPost[]>({
    queryKey: ["communityPosts", slug, page],
    queryFn: () =>
      apiGet<PaginatedPostsResponse | CommunityPost[]>(
        `/communities/${slug}/posts?page=${page}&limit=${limit}&sort=created_at&order=desc`
      ),
    enabled: Boolean(slug && !isForbidden),
  });

  // 3. Fetch Single Post Details with Comments when viewing
  const viewingPostId = viewingPost?.id;
  const {
    data: postDetailsData,
    isLoading: isLoadingPostDetails,
  } = useQuery<SinglePostDetailResponse>({
    queryKey: ["singlePostDetail", viewingPostId],
    queryFn: () => apiGet<SinglePostDetailResponse>(`/posts/${viewingPostId}`),
    enabled: Boolean(viewingPostId),
  });

  // --------------------------------------------------------------------------
  // Mutations
  // --------------------------------------------------------------------------

  // Soft Delete Post Mutation
  const deleteMutation = useMutation({
    mutationFn: (postId: string) => apiDelete(`/posts/${postId}`),
    onSuccess: (_, postId) => {
      toast.success("Post removed successfully");
      setRemovedPostIds((prev) => new Set(prev).add(postId));
      setIsDeleteDialogOpen(false);
      setPostToRemove(null);

      // Invalidate posts queries so the active list refreshes
      queryClient.invalidateQueries({
        queryKey: ["communityPosts", slug],
      });

      // If the dialog was showing the deleted post, close it
      if (viewingPost?.id === postId) {
        setViewingPost(null);
      }
    },
    onError: (err: unknown) => {
      let message = "Failed to remove post. Please try again.";
      if (isAxiosError(err)) {
        if (err.response?.status === 403) {
          message = "You do not have permission to remove this post.";
        } else if (err.response?.data && typeof err.response.data === "object") {
          const body = err.response.data as {
            error?: { message?: string };
            message?: string;
          };
          if (body.error?.message) {
            message = body.error.message;
          } else if (body.message) {
            message = body.message;
          }
        }
      }
      toast.error(message);
    },
  });

  // --------------------------------------------------------------------------
  // Data Processing
  // --------------------------------------------------------------------------

  const rawPostsList: CommunityPost[] = React.useMemo(() => {
    if (!postsResponse) return [];
    if (Array.isArray(postsResponse)) return postsResponse;
    return postsResponse.data || [];
  }, [postsResponse]);

  const meta: ApiMeta = React.useMemo(() => {
    if (postsResponse && !Array.isArray(postsResponse) && postsResponse.meta) {
      return postsResponse.meta;
    }
    return {
      page,
      limit,
      total: rawPostsList.length,
      totalPages: Math.max(1, Math.ceil(rawPostsList.length / limit)),
    };
  }, [postsResponse, rawPostsList.length, page, limit]);

  // Separate Active and Removed posts
  const { activePosts, removedPosts } = React.useMemo(() => {
    const active: CommunityPost[] = [];
    const removed: CommunityPost[] = [];

    for (const post of rawPostsList) {
      const isSoftDeleted =
        Boolean(post.deletedAt || post.deleted_at) ||
        removedPostIds.has(post.id);

      if (isSoftDeleted) {
        removed.push(post);
      } else {
        active.push(post);
      }
    }

    return { activePosts: active, removedPosts: removed };
  }, [rawPostsList, removedPostIds]);

  // Current list based on active tab
  const currentTabPosts = activeTab === "active" ? activePosts : removedPosts;

  // Client-side search filtering by title, content, or author username/name
  const filteredPosts = React.useMemo(() => {
    if (!searchQuery.trim()) return currentTabPosts;
    const q = searchQuery.toLowerCase().trim();

    return currentTabPosts.filter((post) => {
      const title = (post.title || "").toLowerCase();
      const content = (post.content || "").toLowerCase();
      const authorUsername = (post.author?.username || "").toLowerCase();
      const authorName = (getAuthorDisplayName(post.author)).toLowerCase();
      const tagList = extractTagNames(post.tags).map((t) => t.toLowerCase());

      return (
        title.includes(q) ||
        content.includes(q) ||
        authorUsername.includes(q) ||
        authorName.includes(q) ||
        tagList.some((t) => t.includes(q))
      );
    });
  }, [currentTabPosts, searchQuery]);

  // --------------------------------------------------------------------------
  // Render Handlers
  // --------------------------------------------------------------------------

  const handleOpenRemoveDialog = (post: CommunityPost) => {
    setPostToRemove(post);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmRemove = () => {
    if (!postToRemove) return;
    deleteMutation.mutate(postToRemove.id);
  };

  // --------------------------------------------------------------------------
  // Access Denied (403 or non-admin member)
  // --------------------------------------------------------------------------
  if (isForbidden) {
    return (
      <div className="container mx-auto flex max-w-4xl flex-col items-center justify-center px-4 py-16 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive shadow-sm">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h1 className="mt-6 text-2xl font-bold tracking-tight text-foreground">
          Access Denied
        </h1>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          You do not have administrative or moderation permissions to manage posts
          for this community. Only community owners, admins, and moderators may access this page.
        </p>
        <div className="mt-6 flex items-center gap-3">
          <Button variant="outline" render={<Link href="/" />}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
          <Button
            variant="default"
            render={<Link href={`/communities/${slug}`} />}
          >
            Community Overview
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full">


      {/* =====================================================================
          Page Header
      ====================================================================== */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2.5">
            <MessageSquare className="h-7 w-7 text-blue-500" />
            <span>Community Posts</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage, review, and moderate discussions, media, and comments shared across your community.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchPosts()}
            disabled={isFetchingPosts}
            className="gap-1.5"
          >
            <RefreshCw
              className={`h-4 w-4 ${isFetchingPosts ? "animate-spin" : ""}`}
            />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* =====================================================================
          Tabs & Search Header
      ====================================================================== */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => {
          setActiveTab(val as "active" | "removed");
          setPage(1);
        }}
        className="w-full flex flex-col space-y-4"
      >
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <TabsList className="grid w-full grid-cols-2 sm:w-auto">
            <TabsTrigger value="active" className="gap-2">
              <MessageSquare className="h-4 w-4" />
              <span>Active</span>
              <Badge
                variant="secondary"
                className="ml-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
              >
                {activePosts.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="removed" className="gap-2">
              <Trash2 className="h-4 w-4" />
              <span>Removed</span>
              {removedPosts.length > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-1 rounded-full px-2 py-0.5 text-[11px] font-semibold text-destructive"
                >
                  {removedPosts.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Search Filter Input */}
          <div className="relative w-full sm:w-72 md:w-80">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Filter by title, content, or author..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-8"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* ===================================================================
            Tab 1: Active Posts
        ==================================================================== */}
        <TabsContent value="active" className="space-y-4">
          <Card className="border-border">
            <CardContent className="p-0">
              {isLoadingPosts ? (
                <PostsTableSkeleton />
              ) : isErrorPosts ? (
                <div className="flex flex-col items-center justify-center p-12 text-center">
                  <AlertCircle className="h-10 w-10 text-destructive mb-3" />
                  <h3 className="text-base font-semibold text-foreground">
                    Failed to load posts
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground max-w-sm">
                    There was an error communicating with the server. Please try refreshing.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refetchPosts()}
                    className="mt-4"
                  >
                    Retry
                  </Button>
                </div>
              ) : filteredPosts.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-center">
                  {searchQuery ? (
                    <>
                      <Search className="h-10 w-10 text-muted-foreground/60 mb-3" />
                      <h3 className="text-base font-semibold text-foreground">
                        No matching posts
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground max-w-sm">
                        No active posts matched &quot;{searchQuery}&quot;. Try adjusting your search term.
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSearchQuery("")}
                        className="mt-3 text-xs"
                      >
                        Clear search
                      </Button>
                    </>
                  ) : (
                    <>
                      <MessageSquare className="h-10 w-10 text-muted-foreground/60 mb-3" />
                      <h3 className="text-base font-semibold text-foreground">
                        No posts yet
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground max-w-sm">
                        When members create posts and start discussions in this community, they will appear here.
                      </p>
                    </>
                  )}
                </div>
              ) : (
                <PostsTable
                  posts={filteredPosts}
                  canManagePosts={Boolean(canManagePosts)}
                  onViewPost={(p) => setViewingPost(p)}
                  onRemovePost={handleOpenRemoveDialog}
                />
              )}
            </CardContent>
          </Card>

          {/* Pagination Controls */}
          {meta.totalPages && meta.totalPages > 1 ? (
            <div className="flex items-center justify-between px-2 py-2">
              <p className="text-xs text-muted-foreground">
                Showing page <span className="font-medium text-foreground">{meta.page || page}</span> of{" "}
                <span className="font-medium text-foreground">{meta.totalPages}</span> ({meta.total || rawPostsList.length} total posts)
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  disabled={page <= 1 || isFetchingPosts}
                  className="gap-1 text-xs"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setPage((prev) =>
                      meta.totalPages ? Math.min(meta.totalPages, prev + 1) : prev + 1
                    )
                  }
                  disabled={Boolean(meta.totalPages && page >= meta.totalPages) || isFetchingPosts}
                  className="gap-1 text-xs"
                >
                  Next
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ) : null}
        </TabsContent>

        {/* ===================================================================
            Tab 2: Removed Posts
        ==================================================================== */}
        <TabsContent value="removed" className="space-y-4">
          <Card className="border-border">
            <CardContent className="p-0">
              {isLoadingPosts ? (
                <PostsTableSkeleton />
              ) : filteredPosts.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-center">
                  <Trash2 className="h-10 w-10 text-muted-foreground/60 mb-3" />
                  <h3 className="text-base font-semibold text-foreground">
                    No removed posts
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground max-w-sm">
                    {searchQuery
                      ? `No removed posts matched "${searchQuery}".`
                      : "Soft-deleted posts are removed from community feeds by the backend. When posts are soft-deleted during this session, they appear here."}
                  </p>
                </div>
              ) : (
                <PostsTable
                  posts={filteredPosts}
                  canManagePosts={Boolean(canManagePosts)}
                  onViewPost={(p) => setViewingPost(p)}
                  onRemovePost={handleOpenRemoveDialog}
                  isRemovedTab
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* =====================================================================
          Dialog 1: View Full Post Content & Comments
      ====================================================================== */}
      <Dialog
        open={Boolean(viewingPost)}
        onOpenChange={(open) => {
          if (!open) setViewingPost(null);
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          {viewingPost && (
            <>
              <DialogHeader className="space-y-3 text-left">
                {/* Author row & date */}
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 border border-border">
                      <AvatarImage
                        src={viewingPost.author?.profile_picture_url || undefined}
                        alt={getAuthorDisplayName(viewingPost.author)}
                      />
                      <AvatarFallback className="bg-primary/10 text-primary font-medium text-xs">
                        {getAuthorInitials(viewingPost.author)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-foreground">
                        {getAuthorDisplayName(viewingPost.author)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        @{viewingPost.author?.username || "unknown"}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span>{formatRelativeTime(viewingPost.createdAt || viewingPost.created_at)}</span>
                    </div>
                    <span className="text-[11px] text-muted-foreground/70">
                      {formatDate(viewingPost.createdAt || viewingPost.created_at)}
                    </span>
                  </div>
                </div>

                <DialogTitle className="text-xl font-bold tracking-tight text-foreground">
                  {getPostTitle(viewingPost)}
                </DialogTitle>

                {/* Subtitle / Community note */}
                <DialogDescription className="sr-only">
                  Detailed view of community post
                </DialogDescription>
              </DialogHeader>

              {/* Post Content Body */}
              <div className="mt-2 space-y-4">
                {viewingPost.content && (
                  <div className="rounded-lg bg-muted/40 p-4 text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                    {viewingPost.content}
                  </div>
                )}

                {/* Media Preview if attached */}
                {(viewingPost.mediaUrl || viewingPost.media_url) && (
                  <div className="overflow-hidden rounded-lg border border-border bg-black/5 dark:bg-white/5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={(viewingPost.mediaUrl || viewingPost.media_url) || ""}
                      alt={viewingPost.title || "Post media attachment"}
                      className="max-h-80 w-full object-contain rounded-lg"
                      loading="lazy"
                    />
                  </div>
                )}

                {/* Tags List */}
                {extractTagNames(viewingPost.tags).length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <TagIcon className="h-3.5 w-3.5 text-muted-foreground mr-1" />
                    {extractTagNames(viewingPost.tags).map((tag, idx) => (
                      <Badge
                        key={idx}
                        variant="secondary"
                        className="text-xs font-normal bg-secondary/60 text-secondary-foreground"
                      >
                        #{tag}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Engagement Metrics Summary */}
                <div className="flex items-center gap-4 rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5 font-medium text-foreground">
                    <Heart className="h-4 w-4 text-rose-500 fill-rose-500/20" />
                    <span>
                      {viewingPost.reactionCount ?? viewingPost.reaction_count ?? 0} reactions
                    </span>
                  </div>
                  <Separator orientation="vertical" className="h-4" />
                  <div className="flex items-center gap-1.5 font-medium text-foreground">
                    <MessageSquare className="h-4 w-4 text-blue-500" />
                    <span>
                      {viewingPost.commentCount ?? viewingPost.comment_count ?? 0} comments
                    </span>
                  </div>
                </div>

                {/* Comments Section */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold tracking-tight text-foreground flex items-center gap-1.5">
                      <MessageCircle className="h-4 w-4 text-muted-foreground" />
                      Comments Preview
                    </h4>
                    {postDetailsData?.comments && (
                      <span className="text-xs text-muted-foreground">
                        {postDetailsData.comments.length} loaded
                      </span>
                    )}
                  </div>

                  {isLoadingPostDetails ? (
                    <div className="space-y-2 py-2">
                      <Skeleton className="h-14 w-full rounded-md" />
                      <Skeleton className="h-14 w-full rounded-md" />
                    </div>
                  ) : postDetailsData?.comments && postDetailsData.comments.length > 0 ? (
                    <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                      {postDetailsData.comments.map((comment) => (
                        <div
                          key={comment.id}
                          className="flex items-start gap-3 rounded-md border border-border/50 bg-card p-3 text-xs"
                        >
                          <Avatar className="h-7 w-7 border border-border shrink-0">
                            <AvatarImage
                              src={comment.author?.profile_picture_url || undefined}
                            />
                            <AvatarFallback className="text-[10px] bg-muted text-muted-foreground">
                              {comment.author?.username?.slice(0, 2).toUpperCase() || "U"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col gap-1 overflow-hidden w-full">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-foreground">
                                @{comment.author?.username || "anonymous"}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                {formatRelativeTime(comment.createdAt || comment.created_at)}
                              </span>
                            </div>
                            <p className="text-muted-foreground leading-normal whitespace-pre-wrap">
                              {comment.content}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-md border border-dashed border-border/80 p-4 text-center text-xs text-muted-foreground">
                      No comments on this post yet.
                    </div>
                  )}
                </div>
              </div>

              {/* Dialog Footer Actions */}
              <DialogFooter className="mt-4 flex sm:justify-between items-center gap-2">
                <div>
                  {canManagePosts && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        handleOpenRemoveDialog(viewingPost);
                      }}
                      className="gap-1.5"
                    >
                      <Trash2 className="h-4 w-4" />
                      Remove Post
                    </Button>
                  )}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setViewingPost(null)}
                >
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* =====================================================================
          Dialog 2: Remove Post Confirmation AlertDialog
      ====================================================================== */}
      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={(open) => {
          setIsDeleteDialogOpen(open);
          if (!open) setPostToRemove(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Remove Community Post?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm leading-relaxed text-muted-foreground">
              Are you sure you want to remove this post?
              {postToRemove?.title ? (
                <span className="block mt-2 font-medium text-foreground italic">
                  &ldquo;{postToRemove.title}&rdquo;
                </span>
              ) : null}
              <span className="block mt-2">
                This action performs a soft delete. The post will be hidden from the active
                community feed and member search results.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleConfirmRemove();
              }}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Removing...
                </>
              ) : (
                "Remove Post"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ============================================================================
// Posts Data Table Subcomponent
// ============================================================================

interface PostsTableProps {
  posts: CommunityPost[];
  canManagePosts: boolean;
  onViewPost: (post: CommunityPost) => void;
  onRemovePost: (post: CommunityPost) => void;
  isRemovedTab?: boolean;
}

function PostsTable({
  posts,
  canManagePosts,
  onViewPost,
  onRemovePost,
  isRemovedTab = false,
}: PostsTableProps) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-[200px]">Author</TableHead>
            <TableHead className="min-w-[220px]">Title</TableHead>
            <TableHead className="w-[140px]">Date</TableHead>
            <TableHead className="w-[100px] text-center">Reactions</TableHead>
            <TableHead className="w-[100px] text-center">Comments</TableHead>
            <TableHead className="min-w-[160px]">Tags</TableHead>
            <TableHead className="w-[120px] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {posts.map((post) => {
            const author = post.author;
            const displayName = getAuthorDisplayName(author);
            const initials = getAuthorInitials(author);
            const tags = extractTagNames(post.tags);
            const title = getPostTitle(post);
            const dateStr = post.createdAt || post.created_at;
            const hasMedia = Boolean(post.mediaUrl || post.media_url);

            return (
              <TableRow key={post.id} className="transition-colors hover:bg-muted/50">
                {/* 1. Author */}
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <Avatar className="h-8 w-8 border border-border shrink-0">
                      <AvatarImage
                        src={author?.profile_picture_url || undefined}
                        alt={displayName}
                      />
                      <AvatarFallback className="bg-primary/10 text-primary font-medium text-xs">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col min-w-0">
                      <span className="truncate text-xs font-semibold text-foreground">
                        {displayName}
                      </span>
                      <span className="truncate text-[11px] text-muted-foreground">
                        @{author?.username || "unknown"}
                      </span>
                    </div>
                  </div>
                </TableCell>

                {/* 2. Title */}
                <TableCell>
                  <div className="flex flex-col gap-1 max-w-[320px]">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-xs font-medium text-foreground">
                        {title}
                      </span>
                      {hasMedia && (
                        <Badge
                          variant="outline"
                          className="px-1.5 py-0 text-[10px] gap-1 font-normal border-blue-500/30 text-blue-600 dark:text-blue-400 bg-blue-500/10 shrink-0"
                        >
                          <ImageIcon className="h-2.5 w-2.5" />
                          Media
                        </Badge>
                      )}
                    </div>
                    {post.content && post.title && (
                      <p className="truncate text-[11px] text-muted-foreground">
                        {post.content}
                      </p>
                    )}
                  </div>
                </TableCell>

                {/* 3. Date */}
                <TableCell>
                  <div className="flex flex-col text-xs" title={formatDate(dateStr)}>
                    <span className="font-medium text-foreground">
                      {formatRelativeTime(dateStr)}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {formatDate(dateStr)}
                    </span>
                  </div>
                </TableCell>

                {/* 4. Reactions */}
                <TableCell className="text-center">
                  <Badge
                    variant="outline"
                    className="gap-1 border-rose-500/20 bg-rose-500/5 text-rose-600 dark:text-rose-400 text-xs font-normal"
                  >
                    <Heart className="h-3 w-3 fill-rose-500/20" />
                    <span>{post.reactionCount ?? post.reaction_count ?? 0}</span>
                  </Badge>
                </TableCell>

                {/* 5. Comments */}
                <TableCell className="text-center">
                  <Badge
                    variant="outline"
                    className="gap-1 border-blue-500/20 bg-blue-500/5 text-blue-600 dark:text-blue-400 text-xs font-normal"
                  >
                    <MessageSquare className="h-3 w-3" />
                    <span>{post.commentCount ?? post.comment_count ?? 0}</span>
                  </Badge>
                </TableCell>

                {/* 6. Tags */}
                <TableCell>
                  {tags.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-1 max-w-[200px]">
                      {tags.slice(0, 2).map((tag, idx) => (
                        <Badge
                          key={idx}
                          variant="secondary"
                          className="px-1.5 py-0 text-[10px] font-normal"
                        >
                          #{tag}
                        </Badge>
                      ))}
                      {tags.length > 2 && (
                        <Badge
                          variant="outline"
                          className="px-1.5 py-0 text-[10px] text-muted-foreground font-normal"
                          title={tags.slice(2).map((t) => `#${t}`).join(", ")}
                        >
                          +{tags.length - 2}
                        </Badge>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground/60">—</span>
                  )}
                </TableCell>

                {/* 7. Actions */}
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onViewPost(post)}
                      className="h-8 px-2 text-xs gap-1 hover:bg-muted"
                      title="View full post"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">View</span>
                    </Button>

                    {canManagePosts && !isRemovedTab && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onRemovePost(post)}
                        className="h-8 px-2 text-xs gap-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        title="Remove post"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Remove</span>
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

// ============================================================================
// Posts Table Skeleton Loader
// ============================================================================

function PostsTableSkeleton() {
  return (
    <div className="p-4 space-y-4">
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-between gap-4 border-b border-border/50 pb-3"
          >
            <div className="flex items-center gap-3 w-1/4">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-2.5 w-16" />
              </div>
            </div>
            <div className="w-1/3 space-y-1.5">
              <Skeleton className="h-3.5 w-4/5" />
              <Skeleton className="h-2.5 w-1/2" />
            </div>
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-6 w-12 rounded-full" />
            <Skeleton className="h-6 w-12 rounded-full" />
            <Skeleton className="h-6 w-16 rounded-md" />
            <div className="flex gap-2">
              <Skeleton className="h-8 w-14 rounded-md" />
              <Skeleton className="h-8 w-16 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
