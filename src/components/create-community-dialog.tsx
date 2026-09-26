"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import {
  Building2,
  Loader2,
  Plus,
  Sparkles,
  Lock,
  Globe,
  Tag,
  FileText,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";

import { apiPost } from "@/lib/api-client";
import { SYSTEM_CATEGORIES, getCategoryById } from "@/lib/taxonomy";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { LocationInput } from "@/components/ui/location-input";

const createCommunitySchema = z.object({
  name: z
    .string()
    .min(3, "Community name must be at least 3 characters")
    .max(50, "Community name cannot exceed 50 characters")
    .trim(),
  categoryId: z.string().min(1, "Please select a community category"),
  description: z
    .string()
    .max(500, "Description cannot exceed 500 characters")
    .optional()
    .or(z.literal("")),
  locationName: z.string().optional().or(z.literal("")),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  rules: z
    .string()
    .max(1000, "Rules cannot exceed 1000 characters")
    .optional()
    .or(z.literal("")),
  bannerUrl: z
    .string()
    .url("Please enter a valid URL")
    .optional()
    .or(z.literal("")),
  profilePictureUrl: z
    .string()
    .url("Please enter a valid URL")
    .optional()
    .or(z.literal("")),
  isPrivate: z.boolean(),
});

type CreateCommunityFormValues = z.infer<typeof createCommunitySchema>;

interface CreatedCommunityResponse {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  rules?: string | null;
  creator_id: string;
  category_id: string;
  banner_url?: string | null;
  profile_picture_url?: string | null;
  is_private: boolean;
}

interface CreateCommunityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger?: React.ReactNode;
}

function generateSlug(name: string): string {
  const clean = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  const base = clean.length >= 2 ? clean.slice(0, 44) : "community";
  const suffix = Math.random().toString(36).substring(2, 6);
  return `${base}-${suffix}`;
}

export function CreateCommunityDialog({
  open,
  onOpenChange,
}: CreateCommunityDialogProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    setValue,
    formState: { errors },
  } = useForm<CreateCommunityFormValues>({
    resolver: zodResolver(createCommunitySchema),
    defaultValues: {
      name: "",
      categoryId: SYSTEM_CATEGORIES[0]?.id || "",
      description: "",
      locationName: "",
      latitude: null,
      longitude: null,
      rules: "",
      bannerUrl: "",
      profilePictureUrl: "",
      isPrivate: false,
    },
  });

  const watchIsPrivate = watch("isPrivate");

  // Reset form when dialog opens/closes
  React.useEffect(() => {
    if (!open) {
      reset();
      setIsSubmitting(false);
    }
  }, [open, reset]);

  const onSubmit = async (values: CreateCommunityFormValues) => {
    setIsSubmitting(true);
    try {
      const generatedSlug = generateSlug(values.name);
      const payload: {
        name: string;
        slug: string;
        categoryId: string;
        description?: string;
        locationName?: string;
        latitude?: number;
        longitude?: number;
        rules?: string;
        bannerUrl?: string;
        profilePictureUrl?: string;
        isPrivate: boolean;
      } = {
        name: values.name.trim(),
        slug: generatedSlug,
        categoryId: values.categoryId,
        isPrivate: Boolean(values.isPrivate),
      };

      if (values.description && values.description.trim().length > 0) {
        payload.description = values.description.trim();
      }
      if (values.locationName && values.locationName.trim().length > 0) {
        payload.locationName = values.locationName.trim();
      }
      if (values.latitude != null) {
        payload.latitude = values.latitude;
      }
      if (values.longitude != null) {
        payload.longitude = values.longitude;
      }
      if (values.rules && values.rules.trim().length > 0) {
        payload.rules = values.rules.trim();
      }
      if (values.bannerUrl && values.bannerUrl.trim().length > 0) {
        payload.bannerUrl = values.bannerUrl.trim();
      }
      if (values.profilePictureUrl && values.profilePictureUrl.trim().length > 0) {
        payload.profilePictureUrl = values.profilePictureUrl.trim();
      }

      const res = await apiPost<CreatedCommunityResponse>("/communities", payload);

      toast.success(
        `Community "${res?.name || values.name}" created! You are now the Owner.`
      );

      // Invalidate queries so sidebar and lists immediately refresh
      await queryClient.invalidateQueries({ queryKey: ["managedCommunities"] });

      onOpenChange(false);

      // Navigate to the newly created community management dashboard
      const targetSlug = res?.slug || generatedSlug;
      router.push(`/communities/${targetSlug}`);
    } catch (err) {
      if (isAxiosError(err)) {
        if (err.response?.status === 409) {
          toast.error("A community with this name already exists. Please try a different name.");
        } else {
          const apiMessage =
            (err.response?.data as { error?: { message?: string } })?.error?.message;
          toast.error(apiMessage || err.message || "Failed to create community");
        }
      } else {
        toast.error((err as Error).message || "Failed to create community");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Building2 className="size-5" />
            </div>
            <DialogTitle className="text-xl font-bold">Create Community</DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground mt-1">
            As creator, you will automatically become the <strong>Owner</strong> of this
            community with full administrative control.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
          {/* Name Field */}
          <div className="space-y-1.5">
            <Label htmlFor="comm-name" className="text-xs font-semibold">
              Community Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="comm-name"
              {...register("name")}
              disabled={isSubmitting}
              className="text-sm"
            />
            {errors.name && (
              <p className="text-[11px] text-destructive font-medium">
                {errors.name.message}
              </p>
            )}
          </div>

          {/* Category Selector */}
          <div className="space-y-1.5">
            <Label htmlFor="comm-category" className="text-xs font-semibold">
              Category <span className="text-destructive">*</span>
            </Label>
            <Controller
              control={control}
              name="categoryId"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={isSubmitting}
                >
                  <SelectTrigger id="comm-category" className="w-full text-xs">
                    <SelectValue placeholder="Select a category">
                      {(value: string | null) => {
                        if (!value) return "Select a category";
                        const cat = getCategoryById(value);
                        return cat ? cat.label : value;
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {SYSTEM_CATEGORIES.map((cat) => (
                      <SelectItem
                        key={cat.id}
                        value={cat.id}
                        label={cat.label}
                        className="text-xs"
                      >
                        <div className="flex flex-col text-left">
                          <span className="font-medium text-foreground">
                            {cat.label}
                          </span>
                          {cat.description && (
                            <span className="text-[10px] text-muted-foreground truncate max-w-sm">
                              {cat.description}
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <p className="text-[11px] text-muted-foreground">
              ⚠️ <em>Category cannot be changed after creation</em> (confirmed v1 architectural rule).
            </p>
            {errors.categoryId && (
              <p className="text-[11px] text-destructive font-medium">
                {errors.categoryId.message}
              </p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="comm-desc" className="text-xs font-semibold">
              Description
            </Label>
            <Textarea
              id="comm-desc"
              rows={2}
              placeholder="What is this community about? Who should join?"
              {...register("description")}
              disabled={isSubmitting}
              className="text-xs resize-none"
            />
            {errors.description && (
              <p className="text-[11px] text-destructive font-medium">
                {errors.description.message}
              </p>
            )}
          </div>

          {/* Location */}
          <div className="space-y-1.5">
            <Controller
              control={control}
              name="locationName"
              render={({ field }) => (
                <LocationInput
                  label="Community Headquarters / City"
                  value={field.value}
                  latitude={watch("latitude")}
                  longitude={watch("longitude")}
                  placeholder="Select city, campus, or landmark..."
                  hint="Places this community on the 3D Explore Globe"
                  disabled={isSubmitting}
                  onChangeLocation={(loc) => {
                    field.onChange(loc.name);
                    setValue("latitude", loc.latitude);
                    setValue("longitude", loc.longitude);
                  }}
                />
              )}
            />
          </div>

          {/* Rules */}
          <div className="space-y-1.5">
            <Label htmlFor="comm-rules" className="text-xs font-semibold">
              Community Guidelines & Rules
            </Label>
            <Textarea
              id="comm-rules"
              rows={2}
              placeholder="1. Be respectful to fellow members&#10;2. No spam or self-promotion"
              {...register("rules")}
              disabled={isSubmitting}
              className="text-xs resize-none"
            />
            {errors.rules && (
              <p className="text-[11px] text-destructive font-medium">
                {errors.rules.message}
              </p>
            )}
          </div>

          {/* URLs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="comm-avatar" className="text-xs font-semibold">
                Profile / Icon URL
              </Label>
              <Input
                id="comm-avatar"
                placeholder="https://example.com/icon.jpg"
                {...register("profilePictureUrl")}
                disabled={isSubmitting}
                className="text-xs"
              />
              {errors.profilePictureUrl && (
                <p className="text-[11px] text-destructive font-medium">
                  {errors.profilePictureUrl.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="comm-banner" className="text-xs font-semibold">
                Banner URL
              </Label>
              <Input
                id="comm-banner"
                placeholder="https://example.com/banner.jpg"
                {...register("bannerUrl")}
                disabled={isSubmitting}
                className="text-xs"
              />
              {errors.bannerUrl && (
                <p className="text-[11px] text-destructive font-medium">
                  {errors.bannerUrl.message}
                </p>
              )}
            </div>
          </div>

          {/* Privacy Switch */}
          <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
            <div className="space-y-0.5 pr-4">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                {watchIsPrivate ? (
                  <>
                    <Lock className="size-3.5 text-amber-500" />
                    <span>Private Community</span>
                  </>
                ) : (
                  <>
                    <Globe className="size-3.5 text-sky-500" />
                    <span>Public Community</span>
                  </>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {watchIsPrivate
                  ? "Only approved members can view posts and participate."
                  : "Anyone can view community posts and join freely."}
              </p>
            </div>
            <Controller
              control={control}
              name="isPrivate"
              render={({ field }) => (
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  disabled={isSubmitting}
                />
              )}
            />
          </div>

          <DialogFooter className="pt-2 flex flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="gap-1.5 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Creating Community...</span>
                </>
              ) : (
                <>
                  <Plus className="size-3.5" />
                  <span>Create Community</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
