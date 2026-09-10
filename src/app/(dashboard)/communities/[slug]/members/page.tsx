"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import {
  Users,
  Search,
  Crown,
  ShieldCheck,
  Shield,
  User,
  UserX,
  AlertTriangle,
  Calendar,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  X,
  ShieldAlert,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

import { apiGet, apiPatch, apiDelete } from "@/lib/api-client";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  Select,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

// ============================================================================
// Types
// ============================================================================

export interface MemberUser {
  id: string;
  username: string;
  name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  profile_picture_url?: string | null;
}

export type CommunityRole = "owner" | "admin" | "moderator" | "member";

export interface CommunityMember {
  userId: string;
  role: CommunityRole;
  joinedAt: string;
  appointedAt?: string | null;
  appointedBy?: string | null;
  user: MemberUser;
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
  myRole: "owner" | "admin" | "moderator";
  memberCount: number;
}

export interface MembersApiResponse {
  data: CommunityMember[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatJoinedDate(dateStr?: string | null): string {
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

function getMemberDisplayName(user?: MemberUser | null): string {
  if (!user) return "Unknown Member";
  const fullName = `${user.first_name || ""} ${user.last_name || ""}`.trim();
  if (fullName) return fullName;
  if (user.name) return user.name;
  return user.username || "Unknown";
}

function getMemberInitials(user?: MemberUser | null): string {
  if (!user) return "U";
  if (user.first_name && user.last_name) {
    return `${user.first_name[0]}${user.last_name[0]}`.toUpperCase();
  }
  if (user.name) {
    const parts = user.name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  }
  if (user.username) {
    return user.username.slice(0, 2).toUpperCase();
  }
  return "U";
}

// ============================================================================
// Component
// ============================================================================

export default function CommunityMembersPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug as string;
  const router = useRouter();
  const queryClient = useQueryClient();

  // Filter & Pagination States
  const [page, setPage] = React.useState<number>(1);
  const limit = 20;
  const [roleFilter, setRoleFilter] = React.useState<string>("all");
  const [searchQuery, setSearchQuery] = React.useState<string>("");

  // Target member for kick confirmation modal
  const [memberToKick, setMemberToKick] = React.useState<CommunityMember | null>(null);

  // Target member undergoing role update
  const [updatingMemberId, setUpdatingMemberId] = React.useState<string | null>(null);

  // --------------------------------------------------------------------------
  // Data Queries
  // --------------------------------------------------------------------------

  // 1. Current User Profile
  const { data: currentUser } = useQuery<{ id: string; username: string }>({
    queryKey: ["currentUser"],
    queryFn: () => apiGet<{ id: string; username: string }>("/users/me"),
  });

  // 2. Community Overview (to obtain current user's role and creator_id)
  const {
    data: overviewData,
    isLoading: isLoadingOverview,
    isError: isErrorOverview,
    error: errorOverview,
  } = useQuery<CommunityOverviewResponse>({
    queryKey: ["adminCommunityOverview", slug],
    queryFn: () => apiGet<CommunityOverviewResponse>(`/admin/communities/${slug}`),
    enabled: Boolean(slug),
  });

  // 3. Community Members list
  const {
    data: membersResponse,
    isLoading: isLoadingMembers,
    isError: isErrorMembers,
    error: errorMembers,
    isFetching: isFetchingMembers,
    refetch: refetchMembers,
  } = useQuery<MembersApiResponse | CommunityMember[]>({
    queryKey: ["communityMembers", slug, page, roleFilter],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      queryParams.set("page", String(page));
      queryParams.set("limit", String(limit));
      if (roleFilter && roleFilter !== "all") {
        queryParams.set("role", roleFilter);
      }
      return apiGet<MembersApiResponse | CommunityMember[]>(
        `/communities/${slug}/members?${queryParams.toString()}`
      );
    },
    enabled: Boolean(slug),
  });

  // --------------------------------------------------------------------------
  // Role & Permission Computations
  // --------------------------------------------------------------------------
  const myRole = overviewData?.myRole;
  const creatorId = overviewData?.community?.creator_id;
  const isCurrentUserOwner = myRole === "owner";

  // Normalize members and meta
  const membersList: CommunityMember[] = React.useMemo(() => {
    if (!membersResponse) return [];
    if (Array.isArray(membersResponse)) return membersResponse;
    return membersResponse.data || [];
  }, [membersResponse]);

  const meta = React.useMemo(() => {
    if (membersResponse && !Array.isArray(membersResponse) && membersResponse.meta) {
      return membersResponse.meta;
    }
    return {
      page,
      limit,
      total: membersList.length,
      totalPages: Math.ceil(membersList.length / limit) || 1,
    };
  }, [membersResponse, membersList.length, page, limit]);

  // Client-side search filtering across username, first_name, last_name, name
  const filteredMembers = React.useMemo(() => {
    if (!searchQuery.trim()) return membersList;
    const query = searchQuery.toLowerCase().trim();
    return membersList.filter((m) => {
      const u = m.user;
      if (!u) return false;
      const usernameMatch = u.username?.toLowerCase().includes(query);
      const nameMatch = u.name?.toLowerCase().includes(query);
      const firstMatch = u.first_name?.toLowerCase().includes(query);
      const lastMatch = u.last_name?.toLowerCase().includes(query);
      const fullName = `${u.first_name || ""} ${u.last_name || ""}`.trim().toLowerCase();
      const fullNameMatch = fullName.includes(query);
      return Boolean(usernameMatch || nameMatch || firstMatch || lastMatch || fullNameMatch);
    });
  }, [membersList, searchQuery]);

  // Helper: check if a member row is the community owner
  const isOwnerRow = React.useCallback(
    (member: CommunityMember) => {
      return member.role === "owner" || (creatorId ? member.userId === creatorId : false);
    },
    [creatorId]
  );

  // Helper: check if a member row is the currently logged-in user
  const isSelfRow = React.useCallback(
    (member: CommunityMember) => {
      return Boolean(currentUser?.id && member.userId === currentUser.id);
    },
    [currentUser?.id]
  );

  // --------------------------------------------------------------------------
  // Mutations
  // --------------------------------------------------------------------------

  // 1. Update Member Role (Owner only)
  const updateRoleMutation = useMutation({
    mutationFn: async ({
      userId,
      newRole,
    }: {
      userId: string;
      newRole: "member" | "moderator" | "admin";
    }) => {
      setUpdatingMemberId(userId);
      return apiPatch(`/communities/${slug}/members/${userId}`, {
        role: newRole,
      });
    },
    onSuccess: (_, variables) => {
      toast.success(
        `Role successfully changed to ${variables.newRole.toUpperCase()}`
      );
      queryClient.invalidateQueries({ queryKey: ["communityMembers", slug] });
      queryClient.invalidateQueries({ queryKey: ["adminCommunityOverview", slug] });
    },
    onError: (err: unknown) => {
      if (isAxiosError(err)) {
        const errorData = err.response?.data as { error?: { message?: string } } | undefined;
        const msg = errorData?.error?.message || err.message || "Failed to update member role";
        toast.error(msg);
      } else {
        toast.error("Failed to update member role");
      }
    },
    onSettled: () => {
      setUpdatingMemberId(null);
    },
  });

  // 2. Kick Member (Admin / Mod / Owner)
  const kickMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiDelete(`/communities/${slug}/members/${userId}/kick`);
    },
    onSuccess: () => {
      toast.success("Member has been removed from the community");
      setMemberToKick(null);
      queryClient.invalidateQueries({ queryKey: ["communityMembers", slug] });
      queryClient.invalidateQueries({ queryKey: ["adminCommunityOverview", slug] });
    },
    onError: (err: unknown) => {
      if (isAxiosError(err)) {
        const errorData = err.response?.data as { error?: { message?: string } } | undefined;
        const msg =
          errorData?.error?.message || err.message || "Failed to kick member from community";
        toast.error(msg);
      } else {
        toast.error("Failed to kick member from community");
      }
    },
  });

  // --------------------------------------------------------------------------
  // Render Helpers
  // --------------------------------------------------------------------------

  const renderRoleBadge = (role: CommunityRole) => {
    switch (role) {
      case "owner":
        return (
          <Badge
            variant="outline"
            className="gap-1.5 border-amber-500/30 bg-amber-500/15 text-[11px] font-semibold tracking-wider text-amber-700 uppercase shadow-xs dark:text-amber-400"
          >
            <Crown className="size-3.5 text-amber-600 dark:text-amber-400" />
            Owner
          </Badge>
        );
      case "admin":
        return (
          <Badge
            variant="outline"
            className="gap-1.5 border-blue-500/30 bg-blue-500/15 text-[11px] font-semibold tracking-wider text-blue-700 uppercase shadow-xs dark:text-blue-400"
          >
            <ShieldCheck className="size-3.5 text-blue-600 dark:text-blue-400" />
            Admin
          </Badge>
        );
      case "moderator":
        return (
          <Badge
            variant="outline"
            className="gap-1.5 border-emerald-500/30 bg-emerald-500/15 text-[11px] font-semibold tracking-wider text-emerald-700 uppercase shadow-xs dark:text-emerald-400"
          >
            <Shield className="size-3.5 text-emerald-600 dark:text-emerald-400" />
            Moderator
          </Badge>
        );
      case "member":
      default:
        return (
          <Badge
            variant="secondary"
            className="gap-1.5 border-border/50 bg-muted text-[11px] font-medium tracking-wider text-muted-foreground uppercase"
          >
            <User className="size-3.5 text-muted-foreground" />
            Member
          </Badge>
        );
    }
  };

  // --------------------------------------------------------------------------
  // Authorization / 403 State Handling
  // --------------------------------------------------------------------------
  const is403 =
    (isAxiosError(errorOverview) && errorOverview.response?.status === 403) ||
    (isAxiosError(errorMembers) && errorMembers.response?.status === 403);

  if (is403) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
        <Card className="max-w-md border-destructive/20 shadow-md">
          <CardHeader className="pb-2 text-center">
            <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <ShieldAlert className="size-6" />
            </div>
            <CardTitle className="text-xl">Access Denied</CardTitle>
            <CardDescription>
              You do not have permission to view or manage members in this community.
              Only community Owners, Admins, and Moderators are authorized.
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex justify-center gap-2 pb-6">
            <Button
              render={<Link href={`/communities/${slug}`} />}
              variant="outline"
              className="gap-1.5"
            >
              <ArrowLeft className="size-4" />
              Community Overview
            </Button>
            <Button render={<Link href="/" />} variant="secondary">
              Dashboard Home
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // General Error State
  // --------------------------------------------------------------------------
  if (isErrorMembers && !membersResponse) {
    const errorMsg =
      isAxiosError(errorMembers) && errorMembers.response?.data
        ? (errorMembers.response.data as { error?: { message?: string } })?.error?.message ||
          errorMembers.message
        : "Failed to load community members. Please check your network and try again.";

    return (
      <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center p-6">
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="size-4" />
          <AlertTitle>Error loading members</AlertTitle>
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => refetchMembers()}
            className="gap-2"
          >
            <RefreshCw className="size-4" />
            Retry
          </Button>
          <Button
            render={<Link href={`/communities/${slug}`} />}
            variant="secondary"
            className="gap-2"
          >
            <ArrowLeft className="size-4" />
            Back to Overview
          </Button>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // Main Render
  // --------------------------------------------------------------------------
  return (
    <div className="space-y-6 pb-12">


      {/* Page Header */}
      <div className="flex flex-col gap-4 border-b border-border/40 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <Button
              render={<Link href={`/communities/${slug}`} />}
              variant="ghost"
              size="icon-xs"
              className="text-muted-foreground transition-colors hover:text-foreground"
              title="Back to Community Overview"
            >
              <ArrowLeft className="size-4" />
            </Button>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Community Members
            </h1>
            {isLoadingMembers ? (
              <Skeleton className="h-5 w-12 rounded-full" />
            ) : (
              <Badge variant="secondary" className="font-mono text-xs">
                {meta.total} {meta.total === 1 ? "member" : "members"}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            View, moderate, and manage roles for members of{" "}
            <span className="font-medium text-foreground">
              {overviewData?.community?.name || slug}
            </span>
            .
          </p>
        </div>

        {/* Quick link & Refresh actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchMembers()}
            disabled={isFetchingMembers}
            className="gap-1.5 shadow-xs"
            title="Refresh members list"
          >
            <RefreshCw
              className={`size-3.5 ${isFetchingMembers ? "animate-spin" : ""}`}
            />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Button
            render={<Link href={`/communities/${slug}`} />}
            variant="secondary"
            size="sm"
            className="gap-1.5 shadow-xs"
          >
            <ExternalLink className="size-3.5" />
            <span>Overview</span>
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <Card className="shadow-xs border-border/60">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            {/* Search Input */}
            <div className="relative flex-1 md:max-w-md">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name or @username..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>

            {/* Filter by Role */}
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-xs font-medium text-muted-foreground">
                Filter by Role:
              </span>
              <div className="w-36">
                <Select
                  value={roleFilter}
                  onValueChange={(val) => {
                    if (val) {
                      setRoleFilter(val as string);
                      setPage(1);
                    }
                  }}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="All Roles" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    <SelectItem value="owner">Owners</SelectItem>
                    <SelectItem value="admin">Admins</SelectItem>
                    <SelectItem value="moderator">Moderators</SelectItem>
                    <SelectItem value="member">Members</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Reset Filters button */}
              {(searchQuery !== "" || roleFilter !== "all") && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchQuery("");
                    setRoleFilter("all");
                    setPage(1);
                  }}
                  className="h-9 px-2.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5 mr-1" />
                  Reset
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Members Data Table */}
      <Card className="shadow-xs border-border/60 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="w-[300px] font-semibold text-foreground">
                Member
              </TableHead>
              <TableHead className="w-[200px] font-semibold text-foreground">
                Role
              </TableHead>
              <TableHead className="w-[180px] font-semibold text-foreground">
                Joined At
              </TableHead>
              <TableHead className="text-right font-semibold text-foreground pr-6">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* Loading State: Table Skeletons */}
            {isLoadingMembers ? (
              Array.from({ length: 6 }).map((_, index) => (
                <TableRow key={`skeleton-row-${index}`}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Skeleton className="size-9 rounded-full shrink-0" />
                      <div className="space-y-1.5 flex-1">
                        <Skeleton className="h-4 w-28" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-6 w-20 rounded-md" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell className="text-right pr-6">
                    <Skeleton className="h-8 w-16 rounded-md ml-auto" />
                  </TableCell>
                </TableRow>
              ))
            ) : filteredMembers.length > 0 ? (
              /* Populated Member Rows */
              filteredMembers.map((member) => {
                const isOwner = isOwnerRow(member);
                const isSelf = isSelfRow(member);
                const isUpdatingRole =
                  updateRoleMutation.isPending && updatingMemberId === member.userId;
                const displayName = getMemberDisplayName(member.user);
                const initials = getMemberInitials(member.user);

                return (
                  <TableRow
                    key={member.userId}
                    className="transition-colors hover:bg-muted/30"
                  >
                    {/* Column 1: Member Avatar, Display Name, Username */}
                    <TableCell>
                      <Link
                        href={isSelf ? "/profile" : `/users/${member.userId}`}
                        className="group flex items-center gap-3 transition-opacity hover:opacity-85"
                      >
                        <Avatar className="size-9 border border-border/50 shrink-0">
                          {member.user?.profile_picture_url ? (
                            <AvatarImage
                              src={member.user.profile_picture_url}
                              alt={displayName}
                            />
                          ) : null}
                          <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-foreground truncate text-sm group-hover:text-primary transition-colors">
                              {displayName}
                            </span>
                            {isSelf && (
                              <Badge
                                variant="outline"
                                className="text-[10px] px-1 py-0 font-mono text-muted-foreground"
                              >
                                You
                              </Badge>
                            )}
                          </div>
                          {member.user?.username && (
                            <span className="text-xs text-muted-foreground font-mono truncate">
                              @{member.user.username}
                            </span>
                          )}
                        </div>
                      </Link>
                    </TableCell>

                    {/* Column 2: Role (Select if Owner & not Owner Row; else Badge) */}
                    <TableCell>
                      {isOwner ? (
                        /* Owner row: ALWAYS protected read-only Crown badge */
                        renderRoleBadge("owner")
                      ) : isCurrentUserOwner ? (
                        /* Current user is owner & target is non-owner: Role Select Dropdown */
                        <div className="flex items-center gap-2">
                          <Select
                            value={member.role}
                            disabled={isUpdatingRole}
                            onValueChange={(newVal) => {
                              if (newVal && newVal !== member.role) {
                                updateRoleMutation.mutate({
                                  userId: member.userId,
                                  newRole: newVal as "member" | "moderator" | "admin",
                                });
                              }
                            }}
                          >
                            <SelectTrigger className="h-8 w-32 text-xs font-medium">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="member">
                                <div className="flex items-center gap-1.5">
                                  <User className="size-3.5 text-muted-foreground" />
                                  <span>Member</span>
                                </div>
                              </SelectItem>
                              <SelectItem value="moderator">
                                <div className="flex items-center gap-1.5">
                                  <Shield className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                                  <span>Moderator</span>
                                </div>
                              </SelectItem>
                              <SelectItem value="admin">
                                <div className="flex items-center gap-1.5">
                                  <ShieldCheck className="size-3.5 text-blue-600 dark:text-blue-400" />
                                  <span>Admin</span>
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          {isUpdatingRole && (
                            <RefreshCw className="size-3 animate-spin text-muted-foreground shrink-0" />
                          )}
                        </div>
                      ) : (
                        /* Non-owner viewer: Read-only role badge */
                        renderRoleBadge(member.role)
                      )}
                    </TableCell>

                    {/* Column 3: Joined At Date */}
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Calendar className="size-3.5 shrink-0 opacity-70" />
                        <span>{formatJoinedDate(member.joinedAt)}</span>
                      </div>
                    </TableCell>

                    {/* Column 4: Actions (Kick Button) */}
                    <TableCell className="text-right pr-6">
                      {isOwner ? (
                        /* Owner row: Kick disabled with Protected indicator */
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled
                          className="h-8 px-2.5 text-xs text-muted-foreground cursor-not-allowed opacity-60"
                          title="The community owner cannot be kicked"
                        >
                          <Crown className="size-3.5 mr-1 text-amber-500" />
                          <span>Owner</span>
                        </Button>
                      ) : isSelf ? (
                        /* Self row: Kick disabled */
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled
                          className="h-8 px-2.5 text-xs text-muted-foreground cursor-not-allowed opacity-60"
                          title="You cannot kick yourself from the management dashboard"
                        >
                          <User className="size-3.5 mr-1" />
                          <span>Self</span>
                        </Button>
                      ) : (
                        /* Standard member: Kick Button opening Confirmation Modal */
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setMemberToKick(member)}
                          className="h-8 px-2.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/20 hover:border-destructive/40 transition-colors shadow-xs"
                        >
                          <UserX className="size-3.5 mr-1" />
                          <span>Kick</span>
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              /* Empty State when no members match */
              <TableRow>
                <TableCell colSpan={4} className="h-64 text-center">
                  <div className="flex flex-col items-center justify-center gap-2.5 max-w-sm mx-auto p-4">
                    <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <Users className="size-6" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-semibold text-foreground text-base">
                        No members found
                      </h3>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {searchQuery || roleFilter !== "all"
                          ? "No community members matched your search or role filter criteria."
                          : "This community currently has no members registered."}
                      </p>
                    </div>
                    {(searchQuery || roleFilter !== "all") && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSearchQuery("");
                          setRoleFilter("all");
                          setPage(1);
                        }}
                        className="mt-2 text-xs"
                      >
                        Clear All Filters
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {/* Pagination Footer */}
        <div className="flex flex-col gap-3 border-t border-border/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between bg-muted/10">
          <span className="text-xs text-muted-foreground">
            {meta.total > 0 ? (
              <>
                Showing{" "}
                <span className="font-medium text-foreground">
                  {(meta.page - 1) * meta.limit + 1}
                </span>{" "}
                to{" "}
                <span className="font-medium text-foreground">
                  {Math.min(meta.page * meta.limit, meta.total)}
                </span>{" "}
                of{" "}
                <span className="font-medium text-foreground">{meta.total}</span>{" "}
                members
              </>
            ) : (
              "0 members"
            )}
          </span>

          {meta.totalPages > 1 && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                disabled={page <= 1 || isLoadingMembers}
                className="h-8 gap-1 px-2.5 text-xs shadow-xs"
              >
                <ChevronLeft className="size-3.5" />
                <span>Previous</span>
              </Button>

              <span className="text-xs font-medium text-muted-foreground px-1">
                Page {meta.page} of {meta.totalPages}
              </span>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((prev) => Math.min(prev + 1, meta.totalPages))}
                disabled={page >= meta.totalPages || isLoadingMembers}
                className="h-8 gap-1 px-2.5 text-xs shadow-xs"
              >
                <span>Next</span>
                <ChevronRight className="size-3.5" />
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Kick Member Confirmation Dialog */}
      <AlertDialog
        open={Boolean(memberToKick)}
        onOpenChange={(open) => {
          if (!open && !kickMemberMutation.isPending) {
            setMemberToKick(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-5" />
              <span>Kick Member from Community</span>
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 pt-1 text-sm text-muted-foreground">
              <span>
                Are you sure you want to kick{" "}
                <strong className="text-foreground">
                  {getMemberDisplayName(memberToKick?.user)}
                </strong>{" "}
                (@{memberToKick?.user?.username || "user"}) from this community?
              </span>
              <span className="block text-xs leading-relaxed text-muted-foreground/90">
                This action immediately revokes their community membership. They will lose
                access to all community discussions, events, and member privileges.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="pt-2">
            <AlertDialogCancel
              disabled={kickMemberMutation.isPending}
              onClick={() => setMemberToKick(null)}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={kickMemberMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (memberToKick) {
                  kickMemberMutation.mutate(memberToKick.userId);
                }
              }}
              className="gap-1.5"
            >
              {kickMemberMutation.isPending ? (
                <>
                  <RefreshCw className="size-3.5 animate-spin" />
                  <span>Kicking...</span>
                </>
              ) : (
                <>
                  <UserX className="size-3.5" />
                  <span>Kick Member</span>
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
