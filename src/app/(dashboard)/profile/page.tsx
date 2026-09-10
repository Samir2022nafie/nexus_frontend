"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { isAxiosError } from "axios";
import {
  User,
  Mail,
  Phone,
  Shield,
  Calendar,
  Building2,
  ExternalLink,
  Save,
  Loader2,
  Sparkles,
  Crown,
  Lock,
  LogOut,
} from "lucide-react";
import { toast } from "sonner";

import { apiGet, apiPatch, apiPost } from "@/lib/api-client";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";

interface UserProfileData {
  id: string;
  username: string;
  email?: string | null;
  phone_number?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  name?: string | null;
  bio?: string | null;
  profile_picture_url?: string | null;
  trust_score?: number;
  created_at?: string;
}

interface ManagedCommunityItem {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  profilePictureUrl?: string | null;
  profile_picture_url?: string | null;
  role: "owner" | "admin" | "moderator";
  memberCount?: number;
  member_count?: number;
}

const profileFormSchema = z.object({
  firstName: z.string().max(50, "First name cannot exceed 50 characters").optional(),
  lastName: z.string().max(50, "Last name cannot exceed 50 characters").optional(),
  bio: z.string().max(300, "Bio cannot exceed 300 characters").optional(),
  profilePictureUrl: z
    .string()
    .url("Please enter a valid image URL")
    .optional()
    .or(z.literal("")),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

export default function ProfilePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await apiPost("/auth/logout");
    } catch {
      // Proceed even if backend logout fails
    } finally {
      localStorage.removeItem("bearer_token");
      localStorage.removeItem("auth_user");
      queryClient.clear();
      toast.success("Logged out successfully");
      router.replace("/login");
    }
  };

  // 1. Fetch Current User
  const {
    data: user,
    isLoading: isLoadingUser,
    isError,
  } = useQuery<UserProfileData>({
    queryKey: ["currentUserProfile"],
    queryFn: () => apiGet<UserProfileData>("/users/me"),
  });

  // 2. Fetch Managed Communities
  const { data: communities, isLoading: isLoadingCommunities } = useQuery<
    ManagedCommunityItem[]
  >({
    queryKey: ["managedCommunities"],
    queryFn: () => apiGet<ManagedCommunityItem[]>("/users/me/communities"),
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isDirty },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      bio: "",
      profilePictureUrl: "",
    },
  });

  const watchedAvatar = watch("profilePictureUrl");

  // Populate form defaults when user data loads
  React.useEffect(() => {
    if (user) {
      reset({
        firstName: user.first_name || "",
        lastName: user.last_name || "",
        bio: user.bio || "",
        profilePictureUrl: user.profile_picture_url || "",
      });
    }
  }, [user, reset]);

  // 3. Update Profile Mutation
  const updateProfileMutation = useMutation({
    mutationFn: (values: ProfileFormValues) => {
      const payload: {
        firstName?: string;
        lastName?: string;
        bio?: string;
        profilePictureUrl?: string;
      } = {
        firstName: values.firstName?.trim() || undefined,
        lastName: values.lastName?.trim() || undefined,
        bio: values.bio?.trim() || undefined,
        profilePictureUrl: values.profilePictureUrl?.trim() || undefined,
      };
      return apiPatch<UserProfileData>("/users/me", payload);
    },
    onSuccess: (updated) => {
      toast.success("Profile updated successfully!");
      queryClient.setQueryData(["currentUserProfile"], updated);
      queryClient.invalidateQueries({ queryKey: ["currentUser"] });
      reset({
        firstName: updated.first_name || "",
        lastName: updated.last_name || "",
        bio: updated.bio || "",
        profilePictureUrl: updated.profile_picture_url || "",
      });
    },
    onError: (err) => {
      if (isAxiosError(err)) {
        const message =
          (err.response?.data as { error?: { message?: string } })?.error?.message;
        toast.error(message || err.message || "Failed to update profile");
      } else {
        toast.error((err as Error).message || "Failed to update profile");
      }
    },
  });

  const onSubmit = (values: ProfileFormValues) => {
    updateProfileMutation.mutate(values);
  };

  const userInitials = React.useMemo(() => {
    if (user?.first_name && user?.last_name) {
      return `${user.first_name[0]}${user.last_name[0]}`.toUpperCase();
    }
    if (user?.name) {
      const parts = user.name.trim().split(/\s+/);
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      }
      return parts[0].slice(0, 2).toUpperCase();
    }
    if (user?.username) {
      return user.username.slice(0, 2).toUpperCase();
    }
    return "U";
  }, [user]);

  const formattedDate = user?.created_at
    ? new Date(user.created_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "Member";

  if (isLoadingUser) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-96 md:col-span-2 rounded-xl" />
        </div>
      </div>
    );
  }

  if (isError || !user) {
    return (
      <div className="max-w-md mx-auto py-12 text-center space-y-4">
        <p className="text-sm text-destructive">Failed to load your profile information.</p>
        <Button onClick={() => window.location.reload()} variant="outline" size="sm">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/60">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">My Profile</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your personal account details, administrator identity, and view your communities.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive text-xs gap-2 cursor-pointer h-9 font-medium self-start sm:self-auto shrink-0"
        >
          {isLoggingOut ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <LogOut className="size-4" />
          )}
          <span>Log out</span>
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Left Column: Profile Card */}
        <Card className="border-border/70 shadow-xs h-fit">
          <CardContent className="pt-6 flex flex-col items-center text-center space-y-4">
            <Avatar size="lg" className="size-24 rounded-2xl border-2 border-primary/20 shadow-sm">
              <AvatarImage
                src={watchedAvatar || user.profile_picture_url || undefined}
                alt={user.name || user.username}
                className="object-cover"
              />
              <AvatarFallback className="rounded-2xl text-xl font-bold bg-primary/10 text-primary">
                {userInitials}
              </AvatarFallback>
            </Avatar>

            <div className="space-y-1">
              <h2 className="text-lg font-bold text-foreground">
                {user.name || `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.username}
              </h2>
              <p className="text-xs font-mono text-muted-foreground">@{user.username}</p>
            </div>

            {user.bio && (
              <p className="text-xs text-muted-foreground leading-relaxed italic px-2">
                &quot;{user.bio}&quot;
              </p>
            )}

            <div className="w-full pt-3 border-t border-border/50 space-y-2.5 text-left text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Shield className="size-3.5 text-primary" />
                  Trust Score
                </span>
                <Badge variant="secondary" className="font-mono text-[10px] px-2 py-0">
                  {user.trust_score ?? 50} / 100
                </Badge>
              </div>

              {user.email && (
                <div className="flex items-center gap-2 text-muted-foreground truncate">
                  <Mail className="size-3.5 shrink-0" />
                  <span className="truncate">{user.email}</span>
                </div>
              )}

              {user.phone_number && (
                <div className="flex items-center gap-2 text-muted-foreground font-mono">
                  <Phone className="size-3.5 shrink-0" />
                  <span>{user.phone_number}</span>
                </div>
              )}

              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="size-3.5 shrink-0" />
                <span>Joined {formattedDate}</span>
              </div>
            </div>

            {/* Logout Action in Profile Card */}
            <div className="w-full pt-4 border-t border-border/50">
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="w-full text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive text-xs gap-2 cursor-pointer h-9 font-medium"
              >
                {isLoggingOut ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <LogOut className="size-4" />
                )}
                <span>Log out</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Right Column: Edit Profile Form */}
        <div className="md:col-span-2 space-y-6">
          <Card className="border-border/70 shadow-xs">
            <CardHeader className="pb-4 border-b border-border/40">
              <CardTitle className="text-base font-semibold">Edit Personal Details</CardTitle>
              <CardDescription className="text-xs">
                Update your public name, bio, and profile picture across the platform.
              </CardDescription>
            </CardHeader>

            <CardContent className="pt-6">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="firstName" className="text-xs font-semibold">
                      First Name
                    </Label>
                    <Input
                      id="firstName"
                      placeholder="e.g. John"
                      {...register("firstName")}
                      disabled={updateProfileMutation.isPending}
                      className="text-xs"
                    />
                    {errors.firstName && (
                      <p className="text-[11px] text-destructive">{errors.firstName.message}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="lastName" className="text-xs font-semibold">
                      Last Name
                    </Label>
                    <Input
                      id="lastName"
                      placeholder="e.g. Doe"
                      {...register("lastName")}
                      disabled={updateProfileMutation.isPending}
                      className="text-xs"
                    />
                    {errors.lastName && (
                      <p className="text-[11px] text-destructive">{errors.lastName.message}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="bio" className="text-xs font-semibold">
                    Bio / About You
                  </Label>
                  <Textarea
                    id="bio"
                    rows={3}
                    placeholder="Tell other community members a bit about yourself, your interests, or what hobbies you love..."
                    {...register("bio")}
                    disabled={updateProfileMutation.isPending}
                    className="text-xs resize-none"
                  />
                  {errors.bio && (
                    <p className="text-[11px] text-destructive">{errors.bio.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="avatarUrl" className="text-xs font-semibold">
                    Profile Picture URL
                  </Label>
                  <Input
                    id="avatarUrl"
                    placeholder="https://example.com/your-avatar.jpg"
                    {...register("profilePictureUrl")}
                    disabled={updateProfileMutation.isPending}
                    className="text-xs font-mono"
                  />
                  {errors.profilePictureUrl && (
                    <p className="text-[11px] text-destructive">
                      {errors.profilePictureUrl.message}
                    </p>
                  )}
                  <p className="text-[11px] text-muted-foreground">
                    Direct link to an image (JPEG, PNG, WebP) hosted online.
                  </p>
                </div>

                <Separator />

                {/* Read-Only Account Details */}
                <div className="grid gap-4 sm:grid-cols-2 pt-1">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="username" className="text-xs font-semibold text-muted-foreground">
                        Username
                      </Label>
                      <Badge variant="outline" className="text-[10px] font-mono py-0 text-muted-foreground">
                        <Lock className="size-2.5 mr-1" />
                        Fixed
                      </Badge>
                    </div>
                    <Input
                      id="username"
                      value={`@${user.username}`}
                      disabled
                      readOnly
                      className="bg-muted/40 font-mono text-xs text-muted-foreground"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="email" className="text-xs font-semibold text-muted-foreground">
                        Email Address
                      </Label>
                      <Badge variant="outline" className="text-[10px] font-mono py-0 text-muted-foreground">
                        <Lock className="size-2.5 mr-1" />
                        Fixed
                      </Badge>
                    </div>
                    <Input
                      id="email"
                      value={user.email || "No email on file"}
                      disabled
                      readOnly
                      className="bg-muted/40 font-mono text-xs text-muted-foreground"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-3">
                  <Button
                    type="submit"
                    size="sm"
                    disabled={updateProfileMutation.isPending || !isDirty}
                    className="gap-2 cursor-pointer shadow-sm"
                  >
                    {updateProfileMutation.isPending ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Save className="size-3.5" />
                        <span>Save Changes</span>
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Managed Communities Summary */}
          <Card className="border-border/70 shadow-xs">
            <CardHeader className="pb-3 border-b border-border/40">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">My Managed Communities</CardTitle>
                  <CardDescription className="text-xs">
                    Communities where you serve as Owner, Admin, or Moderator.
                  </CardDescription>
                </div>
                {communities && communities.length > 0 && (
                  <Badge variant="secondary" className="font-mono text-xs">
                    {communities.length}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              {isLoadingCommunities ? (
                <div className="space-y-3">
                  <Skeleton className="h-14 rounded-lg" />
                  <Skeleton className="h-14 rounded-lg" />
                </div>
              ) : communities && communities.length > 0 ? (
                <div className="divide-y divide-border/50">
                  {communities.map((comm) => {
                    const pic = comm.profilePictureUrl || comm.profile_picture_url;
                    return (
                      <div
                        key={comm.id}
                        className="flex items-center justify-between py-3 gap-3 first:pt-0 last:pb-0"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="relative size-9 rounded-lg overflow-hidden bg-primary/10 text-primary border border-border/80 flex items-center justify-center shrink-0 font-bold text-xs uppercase">
                            {pic ? (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img
                                src={pic}
                                alt={comm.name}
                                className="size-full object-cover"
                              />
                            ) : (
                              comm.name.slice(0, 2)
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-xs text-foreground truncate">
                              {comm.name}
                            </p>
                            <p className="text-[11px] text-muted-foreground truncate">
                              {comm.role === "owner" ? (
                                <span className="inline-flex items-center gap-1 text-amber-600 font-semibold dark:text-amber-400">
                                  <Crown className="size-3" />
                                  Owner
                                </span>
                              ) : (
                                <span className="capitalize">{comm.role}</span>
                              )}
                            </p>
                          </div>
                        </div>

                        <Button
                          render={<Link href={`/communities/${comm.slug}`} />}
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs gap-1 cursor-pointer shrink-0"
                        >
                          <span>Manage</span>
                          <ExternalLink className="size-3" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  You do not manage any communities yet.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
