"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import {
  Building2,
  ArrowRight,
  Users,
  Shield,
  Crown,
  Sparkles,
  AlertCircle,
  RefreshCw,
  Lock,
  Globe,
  Plus,
} from "lucide-react";
import { toast } from "sonner";

import { apiGet } from "@/lib/api-client";
import { CreateCommunityDialog } from "@/components/create-community-dialog";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

export interface ManagedCommunity {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  bannerUrl?: string | null;
  banner_url?: string | null;
  profilePictureUrl?: string | null;
  profile_picture_url?: string | null;
  isPrivate?: boolean;
  is_private?: boolean;
  memberCount?: number;
  member_count?: number;
  role: "owner" | "admin" | "moderator";
}

export default function DashboardHomePage() {
  const router = useRouter();
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);

  const {
    data: communities,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<ManagedCommunity[]>({
    queryKey: ["managedCommunities"],
    queryFn: () => apiGet<ManagedCommunity[]>("/users/me/communities"),
  });

  const isForbidden = isAxiosError(error) && error.response?.status === 403;
  const isUnauthorized = isAxiosError(error) && error.response?.status === 401;

  // Handle errors: sonner toasts + 401 redirect
  React.useEffect(() => {
    if (error) {
      if (isAxiosError(error)) {
        if (error.response?.status === 401) {
          toast.error("Session expired. Redirecting to login...");
          router.replace("/login");
          return;
        }
        if (error.response?.status === 403) {
          toast.error("Access denied. You do not have permission to view managed communities.");
          return;
        }
        const apiMessage = (error.response?.data as { error?: { message?: string } })?.error?.message;
        toast.error(apiMessage || error.message || "Failed to load managed communities");
      } else {
        toast.error((error as Error).message || "Failed to load managed communities");
      }
    }
  }, [error, router]);

  const getRoleBadge = (role: "owner" | "admin" | "moderator") => {
    switch (role) {
      case "owner":
        return (
          <Badge
            variant="default"
            className="gap-1 bg-amber-500/15 text-amber-600 hover:bg-amber-500/20 border-amber-500/30 dark:text-amber-400 font-mono text-[10px] uppercase font-semibold shrink-0"
          >
            <Crown className="size-3" />
            Owner
          </Badge>
        );
      case "admin":
        return (
          <Badge
            variant="default"
            className="gap-1 bg-sky-500/15 text-sky-600 hover:bg-sky-500/20 border-sky-500/30 dark:text-sky-400 font-mono text-[10px] uppercase font-semibold shrink-0"
          >
            <Shield className="size-3" />
            Admin
          </Badge>
        );
      case "moderator":
        return (
          <Badge
            variant="default"
            className="gap-1 bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/20 border-emerald-500/30 dark:text-emerald-400 font-mono text-[10px] uppercase font-semibold shrink-0"
          >
            <Shield className="size-3" />
            Moderator
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-[10px] uppercase font-mono shrink-0">
            {role}
          </Badge>
        );
    }
  };

  // 403 Forbidden State
  if (isForbidden) {
    return (
      <div className="space-y-8 max-w-7xl mx-auto">
        <div className="pb-2 border-b border-border/60">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            My Communities
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your communities, monitor activity, review reports, and oversee community members.
          </p>
        </div>

        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription className="mt-1">
            You do not have permission to view managed communities. Please ensure you are logged in with an account that has management privileges.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // General Error State
  if (isError && !isUnauthorized) {
    const errorMessage =
      isAxiosError(error) && (error.response?.data as { error?: { message?: string } })?.error?.message
        ? (error.response?.data as { error?: { message?: string } })?.error?.message
        : error?.message || "An unexpected error occurred while loading your communities.";

    return (
      <div className="space-y-8 max-w-7xl mx-auto">
        <div className="pb-2 border-b border-border/60">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            My Communities
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your communities, monitor activity, review reports, and oversee community members.
          </p>
        </div>

        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Failed to load communities</AlertTitle>
          <AlertDescription className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-2">
            <span>{errorMessage}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="w-fit shrink-0 cursor-pointer"
            >
              <RefreshCw className="mr-1.5 size-3.5" />
              Try Again
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            My Communities
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your communities, monitor activity, review reports, and oversee community members.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {communities && communities.length > 0 && (
            <Badge variant="secondary" className="px-3 py-1 text-xs font-medium">
              <Sparkles className="mr-1.5 size-3 text-primary" />
              {communities.length} {communities.length === 1 ? "Community" : "Communities"} Managed
            </Badge>
          )}
          <Button
            onClick={() => setIsCreateOpen(true)}
            size="sm"
            className="gap-1.5 cursor-pointer shadow-sm"
          >
            <Plus className="size-4" />
            <span>Create Community</span>
          </Button>
        </div>
      </div>

      {/* Communities Grid Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            My Managed Communities
          </h2>
        </div>

        {/* Loading State: Skeleton Grid */}
        {isLoading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="p-5 space-y-4 border-border/70">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <Skeleton className="size-12 rounded-xl shrink-0" />
                    <div className="space-y-2 flex-1 min-w-0">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                  <Skeleton className="h-5 w-16 rounded-full shrink-0" />
                </div>
                <Skeleton className="h-10 w-full rounded-lg" />
                <div className="flex justify-between items-center pt-2 border-t border-border/50">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-20 rounded-lg" />
                </div>
              </Card>
            ))}
          </div>
        ) : communities && communities.length > 0 ? (
          /* Success State: Community Cards */
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {communities.map((community) => {
              const profilePic =
                community.profilePictureUrl || community.profile_picture_url;
              const memberCount =
                community.memberCount ?? community.member_count ?? 0;
              const isPrivate =
                community.isPrivate ?? community.is_private ?? false;

              return (
                <Card
                  key={community.id}
                  className="group flex flex-col justify-between border-border/70 bg-card transition-all duration-200 hover:border-border hover:shadow-xl hover:shadow-foreground/5 hover:-translate-y-0.5"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative size-12 rounded-xl overflow-hidden bg-primary/10 border border-border/80 flex items-center justify-center shrink-0">
                          {profilePic ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={profilePic}
                              alt={community.name}
                              className="size-full object-cover relative z-10"
                              onError={(e) => {
                                (e.currentTarget as HTMLElement).style.display = "none";
                              }}
                            />
                          ) : null}
                          <span
                            className="absolute inset-0 flex items-center justify-center font-bold text-sm text-primary uppercase select-none z-0"
                            aria-hidden="true"
                          >
                            {community.name.slice(0, 2).toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <CardTitle className="truncate text-base font-semibold text-foreground group-hover:text-primary transition-colors">
                            {community.name}
                          </CardTitle>
                          <p className="text-xs text-muted-foreground truncate font-mono">
                            /{community.slug}
                          </p>
                        </div>
                      </div>
                      {getRoleBadge(community.role)}
                    </div>
                    <CardDescription className="line-clamp-2 mt-3 text-xs leading-relaxed text-muted-foreground">
                      {community.description || "No community description provided."}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="pt-2 border-t border-border/50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                          <Users className="size-3.5" />
                          <span>{memberCount} members</span>
                        </div>
                        <Badge
                          variant="outline"
                          className="h-5 px-1.5 text-[10px] font-normal gap-1 text-muted-foreground border-border/60"
                        >
                          {isPrivate ? (
                            <>
                              <Lock className="size-2.5" />
                              Private
                            </>
                          ) : (
                            <>
                              <Globe className="size-2.5" />
                              Public
                            </>
                          )}
                        </Badge>
                      </div>
                      <Button
                        render={<Link href={`/communities/${community.slug}`} />}
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1 rounded-lg text-xs font-medium group-hover:border-primary/50 group-hover:bg-primary group-hover:text-primary-foreground transition-all cursor-pointer"
                      >
                        <span>Manage</span>
                        <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          /* Empty State: You don't manage any communities yet */
          <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed border-border/80 bg-card/50">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-4 ring-8 ring-primary/5">
              <Building2 className="size-7" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">
              You don&apos;t manage any communities yet
            </h3>
            <p className="text-xs text-muted-foreground max-w-md mt-1.5 mb-5 leading-relaxed">
              Every community in HobbyHub starts with a creator who becomes its <strong>Owner</strong>.
              When you create a community or get appointed as an administrator or moderator, it will automatically appear here for you to manage.
            </p>
            <Button
              onClick={() => setIsCreateOpen(true)}
              size="default"
              className="gap-2 cursor-pointer shadow-md font-medium"
            >
              <Plus className="size-4" />
              <span>Create Your First Community</span>
            </Button>
          </Card>
        )}
      </div>

      <CreateCommunityDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
      />
    </div>
  );
}
