"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import {
  Calendar as CalendarIcon,
  Loader2,
  Building2,
  MapPin,
  Users,
  Eye,
  ImageIcon,
} from "lucide-react";
import { toast } from "sonner";

import { apiPost, apiGet } from "@/lib/api-client";
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
import { DateTimePicker } from "@/components/ui/datetime-picker";
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

const eventFormSchema = z
  .object({
    communitySlug: z.string().min(1, "Please select a community"),
    title: z.string().min(1, "Event title is required").max(150, "Max 150 characters"),
    description: z.string().max(3000, "Max 3000 characters").optional(),
    coverImageUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
    startsAt: z.string().min(1, "Start date and time is required"),
    endsAt: z.string().optional().or(z.literal("")),
    location: z.string().max(255).optional(),
    visibility: z.enum(["public", "community", "subcommunity"]),
    maxParticipants: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.endsAt && data.startsAt) {
        return new Date(data.endsAt).getTime() > new Date(data.startsAt).getTime();
      }
      return true;
    },
    {
      message: "End time must be after start time",
      path: ["endsAt"],
    }
  );

type EventFormValues = z.infer<typeof eventFormSchema>;

interface CreateEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  communities?: ManagedCommunity[];
  defaultSlug?: string;
  onSuccess?: (slug: string) => void;
}

function getDefaultDatetimeLocal(hoursOffset = 0): string {
  const d = new Date(Date.now() + hoursOffset * 60 * 60 * 1000);
  const pad = (n: number) => n.toString().padStart(2, "0");
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function CreateEventDialog({
  open,
  onOpenChange,
  communities: propCommunities,
  defaultSlug,
  onSuccess,
}: CreateEventDialogProps) {
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

  const form = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: {
      communitySlug: defaultSlug || (communities[0]?.slug ?? ""),
      title: "",
      description: "",
      coverImageUrl: "",
      startsAt: getDefaultDatetimeLocal(0),
      endsAt: getDefaultDatetimeLocal(7),
      location: "",
      visibility: "public",
      maxParticipants: "",
    },
  });

  React.useEffect(() => {
    if (open) {
      form.reset({
        communitySlug: defaultSlug || (communities[0]?.slug ?? ""),
        title: "",
        description: "",
        coverImageUrl: "",
        startsAt: getDefaultDatetimeLocal(0),
        endsAt: getDefaultDatetimeLocal(7),
        location: "",
        visibility: "public",
        maxParticipants: "",
      });
    }
  }, [open, defaultSlug, communities, form]);

  const createEventMutation = useMutation({
    mutationFn: (values: EventFormValues) => {
      const payload: any = {
        title: values.title.trim(),
        description: values.description?.trim() || undefined,
        coverImageUrl: values.coverImageUrl?.trim() || undefined,
        startsAt: new Date(values.startsAt).toISOString(),
        endsAt: values.endsAt ? new Date(values.endsAt).toISOString() : undefined,
        location: values.location?.trim() || undefined,
        visibility: values.visibility,
        maxParticipants: values.maxParticipants && Number(values.maxParticipants) > 0
          ? Number(values.maxParticipants)
          : undefined,
      };

      return apiPost(`/communities/${values.communitySlug}/events`, payload);
    },
    onSuccess: () => {
      toast.success("Event created successfully!");
      const selectedSlug = form.getValues("communitySlug");
      if (selectedSlug) {
        queryClient.invalidateQueries({ queryKey: ["communityEvents", selectedSlug] });
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
        toast.error(errorData?.message || "Failed to create event.");
      } else {
        toast.error("An unexpected error occurred while creating your event.");
      }
    },
  });

  const onSubmit = (values: EventFormValues) => {
    createEventMutation.mutate(values);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-emerald-500" />
            <span>Create Community Event</span>
          </DialogTitle>
          <DialogDescription>
            Schedule and publish an official gathering, workshop, or hangout for your community.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4 py-2">
          {/* Target Community Selector */}
          <div className="space-y-1.5">
            <Label htmlFor="event-community" className="flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Target Community</span>
              <span className="text-destructive">*</span>
            </Label>
            <Controller
              name="communitySlug"
              control={form.control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="event-community" className="w-full">
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

          {/* Title */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="event-title">
                Event Title <span className="text-destructive">*</span>
              </Label>
              <span className="text-[11px] text-muted-foreground">
                {(form.watch("title") || "").length}/150
              </span>
            </div>
            <Input id="event-title" maxLength={150} {...form.register("title")} />
            {form.formState.errors.title && (
              <p className="text-xs text-destructive">{form.formState.errors.title.message}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="event-description">Description</Label>
            <Textarea
              id="event-description"
              rows={3}
              maxLength={3000}
              {...form.register("description")}
            />
            {form.formState.errors.description && (
              <p className="text-xs text-destructive">
                {form.formState.errors.description.message}
              </p>
            )}
          </div>

          {/* Starts At & Ends At */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="event-startsAt">
                Starts At <span className="text-destructive">*</span>
              </Label>
              <Controller
                control={form.control}
                name="startsAt"
                render={({ field }) => (
                  <DateTimePicker
                    id="event-startsAt"
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Select start date and time"
                  />
                )}
              />
              {form.formState.errors.startsAt && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.startsAt.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="event-endsAt">Ends At (Optional)</Label>
              <Controller
                control={form.control}
                name="endsAt"
                render={({ field }) => (
                  <DateTimePicker
                    id="event-endsAt"
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Select end date and time (optional)"
                  />
                )}
              />
              {form.formState.errors.endsAt && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.endsAt.message}
                </p>
              )}
            </div>
          </div>

          {/* Location */}
          <div className="space-y-1.5">
            <Label htmlFor="event-location" className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Location (Venue / Address)</span>
            </Label>
            <Input id="event-location" {...form.register("location")} />
            {form.formState.errors.location && (
              <p className="text-xs text-destructive">
                {form.formState.errors.location.message}
              </p>
            )}
          </div>

          {/* Cover Image URL */}
          <div className="space-y-1.5">
            <Label htmlFor="event-cover" className="flex items-center gap-1.5">
              <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Cover Image URL (Optional)</span>
            </Label>
            <Input id="event-cover" type="url" {...form.register("coverImageUrl")} />
            {form.formState.errors.coverImageUrl && (
              <p className="text-xs text-destructive">
                {form.formState.errors.coverImageUrl.message}
              </p>
            )}
          </div>

          {/* Visibility Scope & Max Participants */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="event-visibility" className="flex items-center gap-1.5">
                <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                <span>Visibility Scope</span>
              </Label>
              <Controller
                name="visibility"
                control={form.control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="event-visibility" className="w-full">
                      <SelectValue placeholder="Select visibility" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="public">Public (Everyone)</SelectItem>
                      <SelectItem value="community">Community Members Only</SelectItem>
                      <SelectItem value="subcommunity">Subcommunity Members</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="event-maxParticipants" className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-muted-foreground" />
                <span>Max Participants</span>
              </Label>
              <Input
                id="event-maxParticipants"
                type="number"
                min={1}
                {...form.register("maxParticipants")}
              />
            </div>
          </div>

          <DialogFooter className="pt-2 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createEventMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createEventMutation.isPending}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
            >
              {createEventMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Creating Event...</span>
                </>
              ) : (
                <span>Create Event</span>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
