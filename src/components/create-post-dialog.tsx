"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import {
  MessageSquare,
  Loader2,
  Sparkles,
  Tag as TagIcon,
  Image as ImageIcon,
  Building2,
  X,
  Crop,
} from "lucide-react";
import { toast } from "sonner";

import { apiPost, apiGet } from "@/lib/api-client";
import { ImageCropModal } from "@/components/ui/image-crop-modal";
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
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { ManagedCommunity } from "@/app/(dashboard)/page";

const postFormSchema = z
  .object({
    communitySlug: z.string().min(1, "Please select a community to post in"),
    title: z
      .string()
      .max(150, "Title cannot exceed 150 characters")
      .optional()
      .or(z.literal("")),
    content: z
      .string()
      .max(10000, "Content cannot exceed 10,000 characters")
      .optional()
      .or(z.literal("")),
    mediaUrl: z
      .string()
      .url("Please enter a valid URL (e.g. https://...)")
      .optional()
      .or(z.literal("")),
    tags: z
      .string()
      .optional()
      .or(z.literal("")),
  })
  .refine(
    (data) =>
      Boolean(
        (data.title && data.title.trim().length > 0) ||
        (data.content && data.content.trim().length > 0) ||
        (data.mediaUrl && data.mediaUrl.trim().length > 0)
      ),
    {
      message: "Please provide at least a title, some text content, or a media image URL.",
      path: ["content"],
    }
  );

export type PostFormValues = z.infer<typeof postFormSchema>;

interface CreatePostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  communities?: ManagedCommunity[];
  defaultSlug?: string;
  onSuccess?: (slug: string) => void;
}

export function CreatePostDialog({
  open,
  onOpenChange,
  communities: propCommunities,
  defaultSlug,
  onSuccess,
}: CreatePostDialogProps) {
  const queryClient = useQueryClient();

  const { data: fetchedCommunities } = useQuery<ManagedCommunity[]>({
    queryKey: ["managedCommunities"],
    queryFn: () => apiGet<ManagedCommunity[]>("/users/me/communities"),
    enabled: open && (!propCommunities || propCommunities.length === 0),
  });

  const communities =
    propCommunities && propCommunities.length > 0
      ? propCommunities
      : fetchedCommunities || [];

  const [cropModalOpen, setCropModalOpen] = React.useState(false);
  const form = useForm<PostFormValues>({
    resolver: zodResolver(postFormSchema),
    defaultValues: {
      communitySlug: defaultSlug || (communities[0]?.slug ?? ""),
      title: "",
      content: "",
      mediaUrl: "",
      tags: "",
    },
  });

  // Keep communitySlug synced when defaultSlug changes or dialog opens
  React.useEffect(() => {
    if (open) {
      form.reset({
        communitySlug: defaultSlug || (communities[0]?.slug ?? ""),
        title: "",
        content: "",
        mediaUrl: "",
        tags: "",
      });
    }
  }, [open, defaultSlug, communities, form]);

  const mediaUrlValue = form.watch("mediaUrl");
  const selectedSlug = form.watch("communitySlug");

  const createPostMutation = useMutation({
    mutationFn: (values: PostFormValues) => {
      const rawTags = values.tags
        ? values.tags
            .split(",")
            .map((t) => t.trim().toLowerCase())
            .filter((t) => t.length > 0)
        : [];
      const cleanTags = Array.from(new Set(rawTags)).slice(0, 10);

      const payload = {
        title: values.title?.trim() || undefined,
        content: values.content?.trim() || undefined,
        mediaUrl: values.mediaUrl?.trim() || undefined,
        tags: cleanTags.length > 0 ? cleanTags : undefined,
      };

      return apiPost(`/communities/${values.communitySlug}/posts`, payload);
    },
    onSuccess: () => {
      toast.success("Post published successfully!");
      if (selectedSlug) {
        queryClient.invalidateQueries({ queryKey: ["communityPosts", selectedSlug] });
        queryClient.invalidateQueries({ queryKey: ["adminCommunityStats", selectedSlug] });
        queryClient.invalidateQueries({ queryKey: ["community", selectedSlug] });
      }
      onOpenChange(false);
      form.reset();
      if (onSuccess && selectedSlug) {
        onSuccess(selectedSlug);
      }
    },
    onError: (err) => {
      if (isAxiosError(err)) {
        const errorData = err.response?.data?.error;
        toast.error(errorData?.message || "Failed to publish post.");
      } else {
        toast.error("An unexpected error occurred while publishing your post.");
      }
    },
  });

  const onSubmit = (values: PostFormValues) => {
    createPostMutation.mutate(values);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-blue-500" />
            <span>Create Community Post</span>
          </DialogTitle>
          <DialogDescription>
            Author and publish an announcement, discussion thread, or media post to your community.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4 py-2">
          {/* Target Community Selector */}
          <div className="space-y-1.5">
            <Label htmlFor="post-community" className="flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Target Community</span>
              <span className="text-destructive">*</span>
            </Label>
            <Controller
              name="communitySlug"
              control={form.control}
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                >
                  <SelectTrigger id="post-community" className="w-full">
                    <SelectValue placeholder="Select community" />
                  </SelectTrigger>
                  <SelectContent>
                    {communities.map((c) => (
                      <SelectItem key={c.id} value={c.slug}>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{c.name}</span>
                          <span className="text-xs text-muted-foreground">({c.role})</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {form.formState.errors.communitySlug && (
              <p className="text-xs text-destructive">
                {form.formState.errors.communitySlug.message}
              </p>
            )}
          </div>

          {/* Post Title */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="post-title">Post Title (Optional)</Label>
              <span className="text-[11px] text-muted-foreground">
                {(form.watch("title") || "").length}/150
              </span>
            </div>
            <Input
              id="post-title"
              maxLength={150}
              {...form.register("title")}
            />
            {form.formState.errors.title && (
              <p className="text-xs text-destructive">
                {form.formState.errors.title.message}
              </p>
            )}
          </div>

          {/* Post Content */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="post-content">Discussion & Body Content</Label>
              <span className="text-[11px] text-muted-foreground">
                {(form.watch("content") || "").length}/10,000
              </span>
            </div>
            <Textarea
              id="post-content"
              rows={5}
              maxLength={10000}
              {...form.register("content")}
            />
            {form.formState.errors.content && (
              <p className="text-xs text-destructive">
                {form.formState.errors.content.message}
              </p>
            )}
          </div>

          {/* Media / Image URL */}
          <div className="space-y-1.5">
            <Label htmlFor="post-mediaUrl" className="flex items-center gap-1.5">
              <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Media / Image URL (Optional)</span>
            </Label>
            <Input
              id="post-mediaUrl"
              type="url"
              placeholder="https://images.unsplash.com/... or public image link"
              {...form.register("mediaUrl")}
            />
            {form.formState.errors.mediaUrl && (
              <p className="text-xs text-destructive">
                {form.formState.errors.mediaUrl.message}
              </p>
            )}

            {/* Live Media Thumbnail Preview */}
            {mediaUrlValue && mediaUrlValue.trim().startsWith("http") && (
              <div className="relative mt-2 rounded-lg border overflow-hidden bg-muted/30 w-full max-h-48 flex items-center justify-center group">
                <img
                  src={mediaUrlValue.trim()}
                  alt="Post preview"
                  className="w-full h-44 object-cover"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = "none";
                  }}
                />
                <button
                  type="button"
                  onClick={() => setCropModalOpen(true)}
                  className="absolute bottom-2 right-2 px-2.5 py-1 bg-neutral-900/85 hover:bg-neutral-900 text-amber-400 text-xs font-semibold rounded-md shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer border border-amber-500/30"
                  title="Crop / Adjust Image"
                >
                  <Crop className="h-3.5 w-3.5" />
                  <span>Crop / Adjust</span>
                </button>
                <button
                  type="button"
                  onClick={() => form.setValue("mediaUrl", "")}
                  className="absolute top-2 right-2 p-1.5 bg-background/80 hover:bg-background rounded-full text-muted-foreground hover:text-foreground shadow-xs transition-colors cursor-pointer"
                  title="Remove image"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <Label htmlFor="post-tags" className="flex items-center gap-1.5">
              <TagIcon className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Tags (Optional)</span>
            </Label>
            <Input
              id="post-tags"
              placeholder="announcement, discussion, updates (comma-separated, max 10)"
              {...form.register("tags")}
            />
            <p className="text-[11px] text-muted-foreground">
              Separate multiple tags with commas. e.g. <code>welcome, guide, community</code>
            </p>
          </div>

          <DialogFooter className="pt-2 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createPostMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createPostMutation.isPending}
              className="gap-2 bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
            >
              {createPostMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Publishing...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>Publish Post</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    {/* Post Image Crop Modal */}
    {mediaUrlValue && mediaUrlValue.trim().startsWith("http") && (
      <ImageCropModal
        open={cropModalOpen}
        imageUrl={mediaUrlValue.trim()}
        cropShape="rectangle"
        aspectRatio={16 / 9}
        title="Crop Post Image"
        onConfirm={(croppedUrl) => {
          form.setValue("mediaUrl", croppedUrl);
          setCropModalOpen(false);
        }}
        onClose={() => setCropModalOpen(false)}
      />
    )}
  </>
  );
}
