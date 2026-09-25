"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { isAxiosError } from "axios";
import {
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Crown,
  Building2,
  Lock,
  Globe,
  Trash2,
  AlertTriangle,
  ArrowLeft,
  Check,
  RotateCcw,
  Info,
  ExternalLink,
  Image as ImageIcon,
  FileText,
  Sparkles,
  CheckCircle2,
  Layers,
  Save,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

import { apiGet, apiPatch, apiDelete } from "@/lib/api-client";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
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
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";

// ============================================================================
// Types & Contracts
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

// ============================================================================
// Form Validation Schema
// ============================================================================

const settingsSchema = z.object({
  name: z
    .string()
    .min(2, "Community name must be at least 2 characters")
    .max(100, "Community name cannot exceed 100 characters"),
  description: z
    .string()
    .max(1000, "Description cannot exceed 1000 characters")
    .optional()
    .or(z.literal("")),
  rules: z
    .string()
    .max(5000, "Community rules cannot exceed 5000 characters")
    .optional()
    .or(z.literal("")),
  bannerUrl: z
    .string()
    .trim()
    .refine((val) => !val || val === "" || /^https?:\/\/.+/i.test(val), {
      message: "Please enter a valid URL starting with http:// or https://",
    })
    .optional()
    .or(z.literal("")),
  profilePictureUrl: z
    .string()
    .trim()
    .refine((val) => !val || val === "" || /^https?:\/\/.+/i.test(val), {
      message: "Please enter a valid URL starting with http:// or https://",
    })
    .optional()
    .or(z.literal("")),
  isPrivate: z.boolean(),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

// ============================================================================
// Helpers
// ============================================================================

function formatCategoryName(name?: string | null): string {
  if (!name) return "Uncategorized";
  return name
    .split(/[_\s]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

// ============================================================================
// Component
// ============================================================================

export default function CommunitySettingsPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const slug = (params?.slug as string) || "";

  // Dialog & delete state
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = React.useState("");

  // --------------------------------------------------------------------------
  // Data Fetching: Community Details & Role Check
  // --------------------------------------------------------------------------
  const {
    data: overviewData,
    isLoading: isLoadingOverview,
    isError: isErrorOverview,
    error: errorOverview,
    refetch: refetchOverview,
  } = useQuery<CommunityOverviewResponse>({
    queryKey: ["communityAdminOverview", slug],
    queryFn: () => apiGet<CommunityOverviewResponse>(`/admin/communities/${slug}`),
    enabled: Boolean(slug),
  });

  const community = overviewData?.community;
  const myRole = overviewData?.myRole;
  const isOwner = myRole === "owner";

  // --------------------------------------------------------------------------
  // Form Initialization
  // --------------------------------------------------------------------------
  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      name: "",
      description: "",
      rules: "",
      bannerUrl: "",
      profilePictureUrl: "",
      isPrivate: false,
    },
  });

  // Populate form when data arrives or refreshes
  React.useEffect(() => {
    if (community) {
      reset({
        name: community.name || "",
        description: community.description || "",
        rules: community.rules || "",
        bannerUrl: community.banner_url || "",
        profilePictureUrl: community.profile_picture_url || "",
        isPrivate: Boolean(community.is_private),
      });
    }
  }, [community, reset]);

  // Live preview watched values
  const watchedName = watch("name");
  const watchedDescription = watch("description");
  const watchedRules = watch("rules");
  const watchedBannerUrl = watch("bannerUrl");
  const watchedProfilePictureUrl = watch("profilePictureUrl");
  const watchedIsPrivate = watch("isPrivate");

  // --------------------------------------------------------------------------
  // Mutations
  // --------------------------------------------------------------------------

  // 1. Update Community Settings Mutation
  const updateSettingsMutation = useMutation({
    mutationFn: (values: SettingsFormValues) => {
      const payload = {
        name: values.name.trim(),
        description: values.description?.trim() || null,
        rules: values.rules?.trim() || null,
        bannerUrl: values.bannerUrl?.trim() || null,
        profilePictureUrl: values.profilePictureUrl?.trim() || null,
        isPrivate: values.isPrivate,
      };
      return apiPatch<CommunityDetail>(`/communities/${slug}`, payload);
    },
    onSuccess: (updatedCommunity) => {
      toast.success("Community settings updated successfully!");
      // Reset form state with fresh values to reset isDirty
      reset({
        name: updatedCommunity.name || "",
        description: updatedCommunity.description || "",
        rules: updatedCommunity.rules || "",
        bannerUrl: updatedCommunity.banner_url || "",
        profilePictureUrl: updatedCommunity.profile_picture_url || "",
        isPrivate: Boolean(updatedCommunity.is_private),
      });
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ["communityAdminOverview", slug] });
      queryClient.invalidateQueries({ queryKey: ["managedCommunities"] });
    },
    onError: (err) => {
      if (isAxiosError(err)) {
        const errorData = err.response?.data?.error;
        if (err.response?.status === 403) {
          toast.error(errorData?.message || "Only the community owner can update settings.");
        } else if (err.response?.status === 400 && errorData?.details) {
          toast.error(
            Array.isArray(errorData.details)
              ? errorData.details.map((d: { message?: string }) => d.message).join(", ")
              : errorData.message || "Validation error"
          );
        } else {
          toast.error(errorData?.message || "Failed to update community settings.");
        }
      } else {
        toast.error("An unexpected error occurred while saving settings.");
      }
    },
  });

  // 2. Delete Community Mutation
  const deleteCommunityMutation = useMutation({
    mutationFn: () => apiDelete<{ success: boolean }>(`/communities/${slug}`),
    onSuccess: () => {
      setIsDeleteDialogOpen(false);
      toast.success("Community deleted successfully.");
      queryClient.invalidateQueries({ queryKey: ["managedCommunities"] });
      router.replace("/");
    },
    onError: (err) => {
      if (isAxiosError(err)) {
        const errorData = err.response?.data?.error;
        toast.error(errorData?.message || "Failed to delete community. Please try again.");
      } else {
        toast.error("An unexpected error occurred while deleting the community.");
      }
    },
  });

  // Form submit handler
  const onSubmit = (values: SettingsFormValues) => {
    if (!isOwner) {
      toast.error("Owner access only. You cannot modify community settings.");
      return;
    }
    updateSettingsMutation.mutate(values);
  };

  // Discard changes handler
  const handleDiscard = () => {
    if (community) {
      reset({
        name: community.name || "",
        description: community.description || "",
        rules: community.rules || "",
        bannerUrl: community.banner_url || "",
        profilePictureUrl: community.profile_picture_url || "",
        isPrivate: Boolean(community.is_private),
      });
      toast.info("Unsaved changes discarded.");
    }
  };



  // --------------------------------------------------------------------------
  // 403 Forbidden State Handling
  // --------------------------------------------------------------------------
  const is403 = isAxiosError(errorOverview) && errorOverview.response?.status === 403;

  if (is403) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center p-6 text-center">
        <Card className="max-w-md border-destructive/20 shadow-lg">
          <CardHeader className="pb-4 text-center">
            <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive shadow-xs">
              <ShieldAlert className="size-7" />
            </div>
            <CardTitle className="text-xl font-bold">Access Denied</CardTitle>
            <CardDescription className="text-sm">
              You do not have permission to view or manage settings for this community.
              Only authorized leadership roles can access administrative resources.
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex justify-center gap-2.5 pb-6">
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
  // Loading State (Skeleton)
  // --------------------------------------------------------------------------
  if (isLoadingOverview) {
    return (
      <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6 md:p-8">
        {/* Header Skeleton */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-80" />
          </div>
          <Skeleton className="h-9 w-28 rounded-lg" />
        </div>

        <Separator />

        {/* Form Card Skeletons */}
        <div className="space-y-6">
          <Card className="p-6">
            <Skeleton className="mb-4 h-6 w-48" />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <Skeleton className="mb-4 h-6 w-48" />
            <div className="space-y-4">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          </Card>

          <Card className="p-6">
            <Skeleton className="mb-4 h-6 w-48" />
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // General Error State
  // --------------------------------------------------------------------------
  if (isErrorOverview || !community) {
    const errorMsg =
      isAxiosError(errorOverview) && errorOverview.response?.data
        ? (errorOverview.response.data as { error?: { message?: string } })?.error?.message ||
          errorOverview.message
        : "Failed to load community details. Please check your network and try again.";

    return (
      <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center p-6">
        <Alert variant="destructive" className="mb-4 shadow-sm">
          <AlertTriangle className="size-4" />
          <AlertTitle className="font-semibold">Unable to Load Settings</AlertTitle>
          <AlertDescription className="mt-1 text-sm">{errorMsg}</AlertDescription>
        </Alert>
        <div className="flex gap-3">
          <Button onClick={() => refetchOverview()} variant="outline" className="gap-1.5">
            <RotateCcw className="size-4" />
            Retry
          </Button>
          <Button render={<Link href={`/communities/${slug}`} />} variant="secondary">
            Back to Overview
          </Button>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // Main Render
  // --------------------------------------------------------------------------
  const categoryName = community.category?.name || "Uncategorized";

  return (
    <TooltipProvider delay={150}>
      <div className="mx-auto max-w-4xl space-y-6">


        {/* Top Header Navigation */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Community Settings
              </h1>
              {isOwner ? (
                <Badge className="gap-1 border-amber-500/30 bg-amber-500/15 text-[11px] font-semibold text-amber-700 uppercase tracking-wider dark:text-amber-400">
                  <Crown className="size-3" />
                  Owner Access
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="gap-1 border-blue-500/30 bg-blue-500/10 text-[11px] font-semibold text-blue-700 uppercase tracking-wider dark:text-blue-400"
                >
                  <ShieldCheck className="size-3" />
                  {myRole ? `${myRole} (View Only)` : "View Only"}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Configure profile branding, privacy parameters, and governance rules for this community.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Button
              render={<Link href={`/communities/${slug}`} />}
              variant="outline"
              size="sm"
              className="gap-1.5"
            >
              <ArrowLeft className="size-3.5" />
              Overview
            </Button>
          </div>
        </div>

        {/* Non-Owner Access Banner Notice */}
        {!isOwner && (
          <Alert className="border-amber-500/40 bg-amber-500/10 text-amber-900 shadow-xs dark:text-amber-200">
            <ShieldAlert className="size-4 text-amber-600 dark:text-amber-400" />
            <AlertTitle className="font-semibold text-amber-950 dark:text-amber-100">
              Owner access only
            </AlertTitle>
            <AlertDescription className="text-sm text-amber-800 dark:text-amber-300">
              You can view community settings but cannot modify them. Only the community owner has
              permission to change settings, update privacy status, or delete the community.
            </AlertDescription>
          </Alert>
        )}

        {/* Settings Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Card 1: General Information & Permanent Identifiers */}
          <Card className="border-border/70 shadow-xs">
            <CardHeader className="border-b border-border/40 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Building2 className="size-4" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold">General Information</CardTitle>
                  <CardDescription className="text-xs">
                    Basic identification and classification details.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5 pt-5">
              {/* Community Name */}
              <div className="space-y-2">
                <Label htmlFor="name" className="text-xs font-semibold uppercase tracking-wider text-foreground/80">
                  Community Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  {...register("name")}
                  disabled={!isOwner || isSubmitting}
                  placeholder="Enter community name"
                  className={errors.name ? "border-destructive focus-visible:border-destructive" : ""}
                />
                {errors.name && (
                  <p className="text-xs text-destructive">{errors.name.message}</p>
                )}
                <p className="text-[11px] text-muted-foreground">
                  The primary public name of your community visible across search and listings.
                </p>
              </div>

              {/* Category (Read-Only with Tooltip) */}
              <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Label
                        htmlFor="category"
                        className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                      >
                        Category
                      </Label>
                      <Tooltip>
                        <TooltipTrigger>
                          <span
                            tabIndex={0}
                            role="button"
                            aria-label="Category information"
                            className="inline-flex cursor-help text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <Info className="size-3.5" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs text-xs">
                          Category cannot be changed after creation (confirmed v1 decision).
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Badge variant="outline" className="border-border text-[10px] uppercase">
                      Locked
                    </Badge>
                  </div>
                  <Input
                    id="category"
                    value={formatCategoryName(categoryName)}
                    disabled
                    readOnly
                    className="bg-muted/50 text-xs text-muted-foreground font-medium"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Determined during initial community registration and permanently locked.
                  </p>
                </div>
            </CardContent>
          </Card>

          {/* Card 2: Visuals & Branding (with Live Previews) */}
          <Card className="border-border/70 shadow-xs">
            <CardHeader className="border-b border-border/40 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <ImageIcon className="size-4" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold">Branding & Media</CardTitle>
                  <CardDescription className="text-xs">
                    Custom graphics, profile avatars, and header covers.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 pt-5">
              {/* Profile Picture / Avatar URL */}
              <div className="space-y-3">
                <Label htmlFor="profilePictureUrl" className="text-xs font-semibold uppercase tracking-wider text-foreground/80">
                  Profile Picture URL
                </Label>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <Avatar className="size-16 shrink-0 rounded-xl border border-border shadow-xs">
                    <AvatarImage
                      src={watchedProfilePictureUrl || undefined}
                      alt={watchedName || community.name}
                      className="object-cover"
                    />
                    <AvatarFallback className="rounded-xl bg-primary/10 text-base font-bold text-primary">
                      {(watchedName || community.name || "C").slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-1.5">
                    <Input
                      id="profilePictureUrl"
                      {...register("profilePictureUrl")}
                      disabled={!isOwner || isSubmitting}
                      placeholder="https://example.com/avatar.jpg"
                      className={errors.profilePictureUrl ? "border-destructive focus-visible:border-destructive" : ""}
                    />
                    {errors.profilePictureUrl && (
                      <p className="text-xs text-destructive">{errors.profilePictureUrl.message}</p>
                    )}
                    <p className="text-[11px] text-muted-foreground">
                      Direct HTTPS image link for the circular/square community avatar.
                    </p>
                  </div>
                </div>
              </div>

              <Separator className="border-border/40" />

              {/* Banner URL */}
              <div className="space-y-3">
                <Label htmlFor="bannerUrl" className="text-xs font-semibold uppercase tracking-wider text-foreground/80">
                  Banner Cover Image URL
                </Label>
                <Input
                  id="bannerUrl"
                  {...register("bannerUrl")}
                  disabled={!isOwner || isSubmitting}
                  placeholder="https://example.com/banner.jpg"
                  className={errors.bannerUrl ? "border-destructive focus-visible:border-destructive" : ""}
                />
                {errors.bannerUrl && (
                  <p className="text-xs text-destructive">{errors.bannerUrl.message}</p>
                )}
                <p className="text-[11px] text-muted-foreground">
                  Recommended resolution: 1200 × 400px. Used as the header cover on overview pages.
                </p>

                {/* Live Banner Preview Box */}
                <div className="overflow-hidden rounded-lg border border-border/70 bg-muted/30">
                  <div className="px-3 py-1.5 text-[10px] font-medium tracking-wider text-muted-foreground uppercase border-b border-border/30 bg-muted/40">
                    Live Banner Preview
                  </div>
                  <div className="relative aspect-[3/1] w-full max-h-48 overflow-hidden bg-muted flex items-center justify-center">
                    {watchedBannerUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={watchedBannerUrl}
                        alt="Banner Preview"
                        className="h-full w-full object-cover transition-opacity duration-200"
                        onError={(e) => {
                          // Fallback styling if URL fails to load
                          (e.target as HTMLElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-muted-foreground/60">
                        <ImageIcon className="size-6 stroke-[1.5]" />
                        <span className="text-xs">No banner URL provided</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 3: About & Community Guidelines */}
          <Card className="border-border/70 shadow-xs">
            <CardHeader className="border-b border-border/40 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <FileText className="size-4" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold">About & Guidelines</CardTitle>
                  <CardDescription className="text-xs">
                    Mission statement and conduct rules for participants.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5 pt-5">
              {/* Description */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="description" className="text-xs font-semibold uppercase tracking-wider text-foreground/80">
                    Community Description
                  </Label>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    {(watchedDescription || "").length}/1000
                  </span>
                </div>
                <Textarea
                  id="description"
                  {...register("description")}
                  disabled={!isOwner || isSubmitting}
                  rows={4}
                  placeholder="Describe your community's interests, values, and what members can expect..."
                  className={errors.description ? "border-destructive focus-visible:border-destructive" : ""}
                />
                {errors.description && (
                  <p className="text-xs text-destructive">{errors.description.message}</p>
                )}
                <p className="text-[11px] text-muted-foreground">
                  A concise overview highlighting the group’s focus and purpose.
                </p>
              </div>

              {/* Rules */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="rules" className="text-xs font-semibold uppercase tracking-wider text-foreground/80">
                    Community Rules & Code of Conduct
                  </Label>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    {(watchedRules || "").length}/5000
                  </span>
                </div>
                <Textarea
                  id="rules"
                  {...register("rules")}
                  disabled={!isOwner || isSubmitting}
                  rows={6}
                  placeholder={"1. Be respectful to all members\n2. No spam or unsolicited commercial messages\n3. Keep content on-topic"}
                  className={errors.rules ? "border-destructive focus-visible:border-destructive font-mono text-xs" : "font-mono text-xs"}
                />
                {errors.rules && (
                  <p className="text-xs text-destructive">{errors.rules.message}</p>
                )}
                <p className="text-[11px] text-muted-foreground">
                  Expected conduct guidelines presented to users when joining or viewing community details.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Card 4: Privacy & Visibility Settings */}
          <Card className="border-border/70 shadow-xs">
            <CardHeader className="border-b border-border/40 pb-4">
              <div className="flex items-center gap-2.5">
                <div
                  className={`flex size-8 items-center justify-center rounded-lg ${
                    watchedIsPrivate
                      ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                      : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                  }`}
                >
                  {watchedIsPrivate ? <Lock className="size-4" /> : <Globe className="size-4" />}
                </div>
                <div>
                  <CardTitle className="text-base font-semibold">Privacy & Visibility</CardTitle>
                  <CardDescription className="text-xs">
                    Choose whether this community is publicly accessible or members-only.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-border/70 bg-muted/20 p-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="isPrivate" className="text-sm font-semibold cursor-pointer">
                      Private Community
                    </Label>
                    <Badge
                      variant="outline"
                      className={`text-[10px] uppercase font-semibold ${
                        watchedIsPrivate
                          ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                          : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                      }`}
                    >
                      {watchedIsPrivate ? "Private Mode" : "Public Mode"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground max-w-xl">
                    {watchedIsPrivate
                      ? "Only accepted members can view community posts, event rosters, and participate in hangouts. Public visitors can only view basic community info and request to join."
                      : "Anyone on Nexus can view community posts, upcoming events, and participate according to open access rules."}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Controller
                    control={control}
                    name="isPrivate"
                    render={({ field }) => (
                      <Switch
                        id="isPrivate"
                        checked={field.value}
                        onCheckedChange={(checked) => field.onChange(checked)}
                        disabled={!isOwner || isSubmitting}
                      />
                    )}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Bar (Save & Discard) */}
          {isOwner && (
            <div className="sticky bottom-4 z-20 flex items-center justify-between gap-4 rounded-xl border border-border/80 bg-background/95 p-4 shadow-lg backdrop-blur-md">
              <div className="flex items-center gap-2 text-xs">
                {isDirty ? (
                  <span className="inline-flex items-center gap-1.5 font-medium text-amber-600 dark:text-amber-400">
                    <span className="size-2 rounded-full bg-amber-500 animate-pulse" />
                    You have unsaved changes
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <CheckCircle2 className="size-3.5 text-emerald-500" />
                    All changes saved
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleDiscard}
                  disabled={!isDirty || isSubmitting || updateSettingsMutation.isPending}
                  className="gap-1.5"
                >
                  <RotateCcw className="size-3.5" />
                  Discard
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={!isDirty || isSubmitting || updateSettingsMutation.isPending}
                  className="gap-1.5 min-w-[120px]"
                >
                  {updateSettingsMutation.isPending ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="size-3.5" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </form>

        {/* Danger Zone Card (Owner Only) */}
        {isOwner && (
          <Card className="border-destructive/30 bg-destructive/5 dark:bg-destructive/10 shadow-xs">
            <CardHeader className="border-b border-destructive/20 pb-4">
              <div className="flex items-center gap-2.5 text-destructive">
                <div className="flex size-8 items-center justify-center rounded-lg bg-destructive/15">
                  <AlertTriangle className="size-4" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold text-destructive">
                    Danger Zone
                  </CardTitle>
                  <CardDescription className="text-xs text-destructive/80">
                    Irreversible actions that affect the entire community lifecycle.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold text-foreground">
                    Delete this community
                  </h4>
                  <p className="text-xs text-muted-foreground max-w-xl">
                    Once deleted, this community will be soft-deleted, all active memberships will be revoked,
                    and its content will no longer be visible to members. This action cannot be undone.
                  </p>
                </div>

                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    setDeleteConfirmationText("");
                    setIsDeleteDialogOpen(true);
                  }}
                  className="shrink-0 gap-1.5"
                >
                  <Trash2 className="size-3.5" />
                  Delete Community
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Delete Confirmation Alert Dialog */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent className="max-w-md">
            <AlertDialogHeader>
              <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <AlertTriangle className="size-6" />
              </div>
              <AlertDialogTitle className="text-center text-lg font-bold">
                Delete &quot;{community.name}&quot;?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-center text-xs text-muted-foreground">
                Are you sure? This action is irreversible. The community will be soft-deleted, member
                access will be revoked immediately, and the community will be removed from all listings.
              </AlertDialogDescription>
            </AlertDialogHeader>

            {/* Extra safety confirmation */}
            <div className="space-y-2 py-2">
              <Label htmlFor="confirm-name" className="text-xs text-muted-foreground">
                Please type <span className="font-semibold text-foreground">&quot;{community.name}&quot;</span> to confirm:
              </Label>
              <Input
                id="confirm-name"
                value={deleteConfirmationText}
                onChange={(e) => setDeleteConfirmationText(e.target.value)}
                placeholder={community.name}
                className="text-xs"
              />
            </div>

            <AlertDialogFooter className="mt-2 flex gap-2">
              <AlertDialogCancel
                onClick={() => {
                  setDeleteConfirmationText("");
                  setIsDeleteDialogOpen(false);
                }}
                disabled={deleteCommunityMutation.isPending}
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={(e) => {
                  e.preventDefault();
                  if (deleteConfirmationText.trim() === community.name.trim()) {
                    deleteCommunityMutation.mutate();
                  } else {
                    toast.error("Please type the exact community name to confirm deletion.");
                  }
                }}
                disabled={
                  deleteConfirmationText.trim() !== community.name.trim() ||
                  deleteCommunityMutation.isPending
                }
                className="gap-1.5 bg-red-600 hover:bg-red-700 text-white font-medium cursor-pointer"
              >
                {deleteCommunityMutation.isPending ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="size-3.5" />
                    Permanently Delete
                  </>
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}
