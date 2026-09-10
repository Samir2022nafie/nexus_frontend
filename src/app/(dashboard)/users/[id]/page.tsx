"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import {
  ArrowLeft,
  User,
  Shield,
  Calendar,
  AlertCircle,
  UserPlus,
  UserMinus,
  Ban,
  Loader2,
  ExternalLink,
  Crown,
} from "lucide-react";
import { toast } from "sonner";

import { apiGet, apiPost, apiDelete } from "@/lib/api-client";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

interface PublicUserProfile {
  id: string;
  username: string;
  first_name?: string | null;
  last_name?: string | null;
  name?: string | null;
  bio?: string | null;
  profile_picture_url?: string | null;
  trust_score?: number;
  created_at?: string;
  isFollowing?: boolean;
  isBlocked?: boolean;
}

export default function PublicUserProfilePage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const userId = params?.id as string;

  // 1. Fetch current logged-in user to check if viewing self
  const { data: currentUser } = useQuery<{ id: string }>({
    queryKey: ["currentUser"],
    queryFn: () => apiGet<{ id: string }>("/users/me"),
  });

  const isSelf = currentUser?.id === userId;

  // If viewing self, redirect to /profile
  React.useEffect(() => {
    if (isSelf) {
      router.replace("/profile");
    }
  }, [isSelf, router]);

  // 2. Fetch Public User Profile
  const {
    data: profile,
    isLoading,
    isError,
    error,
  } = useQuery<PublicUserProfile>({
    queryKey: ["userPublicProfile", userId],
    queryFn: () => apiGet<PublicUserProfile>(`/users/${userId}`),
    enabled: Boolean(userId) && !isSelf,
    retry: 1,
  });

  // 3. Follow / Unfollow Mutation
  const followMutation = useMutation({
    mutationFn: async (currentlyFollowing: boolean) => {
      if (currentlyFollowing) {
        return apiDelete(`/users/${userId}/follow`);
      } else {
        return apiPost(`/users/${userId}/follow`);
      }
    },
    onSuccess: (_, currentlyFollowing) => {
      toast.success(currentlyFollowing ? "Unfollowed user" : "Now following user!");
      queryClient.setQueryData(
        ["userPublicProfile", userId],
        (old: PublicUserProfile | undefined) => {
          if (!old) return old;
          return { ...old, isFollowing: !currentlyFollowing };
        }
      );
    },
    onError: (err) => {
      if (isAxiosError(err)) {
        const message =
          (err.response?.data as { error?: { message?: string } })?.error?.message;
        toast.error(message || err.message || "Failed to update follow status");
      } else {
        toast.error((err as Error).message || "Failed to update follow status");
      }
    },
  });

  const initials = React.useMemo(() => {
    if (profile?.first_name && profile?.last_name) {
      return `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase();
    }
    if (profile?.name) {
      const parts = profile.name.trim().split(/\s+/);
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      }
      return parts[0].slice(0, 2).toUpperCase();
    }
    if (profile?.username) {
      return profile.username.slice(0, 2).toUpperCase();
    }
    return "U";
  }, [profile]);

  const joinDate = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "Member";

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (isError || !profile) {
    const isNotFound = isAxiosError(error) && error.response?.status === 404;

    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
          className="gap-2 text-muted-foreground hover:text-foreground cursor-pointer"
        >
          <ArrowLeft className="size-4" />
          <span>Back</span>
        </Button>

        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>{isNotFound ? "User Not Found" : "Error Loading Profile"}</AlertTitle>
          <AlertDescription className="mt-1">
            {isNotFound
              ? "This user profile does not exist, has been deleted, or is currently unavailable."
              : "An unexpected error occurred while trying to load this user's profile."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Back Navigation */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.back()}
        className="gap-2 text-muted-foreground hover:text-foreground cursor-pointer -ml-2"
      >
        <ArrowLeft className="size-4" />
        <span>Back</span>
      </Button>

      {/* Main Profile Card */}
      <Card className="border-border/70 shadow-xs overflow-hidden">
        <div className="h-28 bg-gradient-to-r from-primary/15 via-primary/5 to-muted border-b border-border/50" />

        <CardContent className="relative px-6 pb-6 pt-0">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-12 mb-4">
            <Avatar size="lg" className="size-24 rounded-2xl border-4 border-card shadow-md">
              <AvatarImage
                src={profile.profile_picture_url || undefined}
                alt={profile.name || profile.username}
                className="object-cover"
              />
              <AvatarFallback className="rounded-2xl text-xl font-bold bg-primary/10 text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>

            <div className="flex items-center gap-2">
              <Button
                variant={profile.isFollowing ? "outline" : "default"}
                size="sm"
                onClick={() => followMutation.mutate(Boolean(profile.isFollowing))}
                disabled={followMutation.isPending}
                className="gap-1.5 cursor-pointer text-xs"
              >
                {followMutation.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : profile.isFollowing ? (
                  <>
                    <UserMinus className="size-3.5" />
                    <span>Unfollow</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="size-3.5" />
                    <span>Follow</span>
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-foreground">
                  {profile.name || `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || profile.username}
                </h1>
                <Badge variant="secondary" className="font-mono text-[10px] px-2 py-0">
                  <Shield className="size-3 text-primary mr-1" />
                  Trust: {profile.trust_score ?? 50}
                </Badge>
              </div>
              <p className="text-xs font-mono text-muted-foreground mt-0.5">@{profile.username}</p>
            </div>

            {profile.bio ? (
              <p className="text-sm text-muted-foreground leading-relaxed">
                {profile.bio}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground/70 italic">
                No public bio provided.
              </p>
            )}

            <div className="flex flex-wrap items-center gap-4 pt-2 text-xs text-muted-foreground border-t border-border/50">
              <div className="flex items-center gap-1.5">
                <Calendar className="size-3.5" />
                <span>Joined {joinDate}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
