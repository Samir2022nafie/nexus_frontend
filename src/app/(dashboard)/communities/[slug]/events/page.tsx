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
  Calendar as CalendarIcon,
  Plus,
  Search,
  Filter,
  Users,
  CheckCircle,
  XCircle,
  Clock,
  Globe,
  Lock,
  Eye,
  Edit2,
  Trash2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  RefreshCw,
  X,
  ShieldAlert,
  MapPin,
  Crop,
  ArrowLeft,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { ImageCropModal } from "@/components/ui/image-crop-modal";
import { CroppedImage } from "@/components/ui/cropped-image";

import { apiGet, apiPost, apiPatch, apiDelete, ApiMeta } from "@/lib/api-client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { DateTimePicker } from "@/components/ui/datetime-picker";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { LocationInput } from "@/components/ui/location-input";

// ============================================================================
// Types
// ============================================================================

export interface EventCreator {
  id: string;
  username: string;
  name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  profile_picture_url?: string | null;
}

export interface CommunityEvent {
  id: string;
  communityId?: string;
  community_id?: string;
  title: string;
  description?: string | null;
  coverImageUrl?: string | null;
  cover_image_url?: string | null;
  startsAt: string;
  starts_at?: string;
  endsAt?: string | null;
  ends_at?: string | null;
  visibility: "public" | "community" | "subcommunity";
  approvalStatus: "proposed" | "approved" | "rejected";
  approval_status?: "proposed" | "approved" | "rejected";
  isVerified?: boolean;
  is_verified?: boolean;
  maxParticipants?: number | null;
  max_participants?: number | null;
  participantsCount?: number;
  participants_count?: number;
  creator?: EventCreator | null;
  creator_id?: string;
  isParticipant?: boolean;
  isSaved?: boolean;
  location?: { place_name?: string; name?: string; address?: string } | string | null;
  locationName?: string | null;
  created_at?: string;
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

export interface PaginatedEventsResponse {
  data: CommunityEvent[];
  meta?: ApiMeta;
}

// ============================================================================
// Form Schemas & Types
// ============================================================================

const eventFormSchema = z
  .object({
    title: z
      .string()
      .min(3, "Title must be at least 3 characters")
      .max(150, "Title cannot exceed 150 characters")
      .trim(),
    description: z
      .string()
      .max(3000, "Description cannot exceed 3000 characters")
      .optional()
      .or(z.literal("")),
    coverImageUrl: z
      .string()
      .refine(
        (val) => !val || val === "" || /^(https?:\/\/|data:image\/).+/i.test(val),
        {
          message: "Please enter a valid URL or image data URI",
        }
      )
      .optional()
      .or(z.literal("")),
    startsAt: z
      .string()
      .min(1, "Start date and time is required")
      .refine(
        (val) => !isNaN(new Date(val).getTime()),
        "Please enter a valid date and time"
      ),
    endsAt: z
      .string()
      .optional()
      .or(z.literal("")),
    visibility: z.enum(["public", "community", "subcommunity"], {
      message: "Please select a valid visibility scope",
    }),
    maxParticipants: z
      .string()
      .optional()
      .refine((val) => {
        if (!val || val.trim() === "") return true;
        const num = Number(val);
        return !isNaN(num) && num > 0 && Number.isInteger(num);
      }, "Must be a positive whole number"),
    location: z
      .string()
      .max(255, "Location cannot exceed 255 characters")
      .optional()
      .or(z.literal("")),
    latitude: z.number().nullable().optional(),
    longitude: z.number().nullable().optional(),
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

// ============================================================================
// Helper Functions
// ============================================================================

function extractEvents(response: unknown): CommunityEvent[] {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  if (
    typeof response === "object" &&
    "data" in response &&
    Array.isArray((response as { data: unknown }).data)
  ) {
    return (response as { data: CommunityEvent[] }).data;
  }
  return [];
}

function extractMeta(response: unknown): ApiMeta | undefined {
  if (
    response &&
    typeof response === "object" &&
    "meta" in response &&
    response.meta
  ) {
    return response.meta as ApiMeta;
  }
  return undefined;
}

function formatEventDate(startStr?: string | null, endStr?: string | null): string {
  if (!startStr) return "Date to be announced";
  try {
    const startDate = new Date(startStr);
    const dateFormatted = new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(startDate);
    const timeFormatted = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(startDate);

    if (!endStr) {
      return `${dateFormatted} at ${timeFormatted}`;
    }

    const endDate = new Date(endStr);
    const endTimeFormatted = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(endDate);

    const isSameDay = startDate.toDateString() === endDate.toDateString();
    if (isSameDay) {
      return `${dateFormatted}, ${timeFormatted} – ${endTimeFormatted}`;
    }

    const endDateFormatted = new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
    }).format(endDate);

    return `${dateFormatted}, ${timeFormatted} – ${endDateFormatted}, ${endTimeFormatted}`;
  } catch {
    return startStr;
  }
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

function toDatetimeLocal(isoString?: string | null, fallbackHoursOffset?: number): string {
  if (!isoString) {
    return fallbackHoursOffset !== undefined ? getDefaultDatetimeLocal(fallbackHoursOffset) : "";
  }
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return fallbackHoursOffset !== undefined ? getDefaultDatetimeLocal(fallbackHoursOffset) : "";
    const pad = (n: number) => n.toString().padStart(2, "0");
    const year = d.getFullYear();
    const month = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  } catch {
    return fallbackHoursOffset !== undefined ? getDefaultDatetimeLocal(fallbackHoursOffset) : "";
  }
}

function getCreatorName(creator?: EventCreator | null): string {
  if (!creator) return "Anonymous";
  const fullName = `${creator.first_name || ""} ${creator.last_name || ""}`.trim();
  if (fullName) return fullName;
  if (creator.name) return creator.name;
  return creator.username || "Unknown Member";
}

function getCreatorInitials(creator?: EventCreator | null): string {
  if (!creator) return "U";
  if (creator.first_name && creator.last_name) {
    return `${creator.first_name[0]}${creator.last_name[0]}`.toUpperCase();
  }
  if (creator.username) {
    return creator.username.slice(0, 2).toUpperCase();
  }
  return "U";
}

// ============================================================================
// Main Page Component
// ============================================================================

export default function CommunityEventsPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug as string;
  const router = useRouter();
  const queryClient = useQueryClient();

  // Active Tab: "upcoming" | "proposals"
  const [activeTab, setActiveTab] = React.useState<string>("upcoming");

  // Filter & Pagination for Upcoming Events
  const [upcomingPage, setUpcomingPage] = React.useState<number>(1);
  const [upcomingSearch, setUpcomingSearch] = React.useState<string>("");
  const [visibilityFilter, setVisibilityFilter] = React.useState<string>("all");

  // Pagination for Pending Proposals
  const [proposalsPage, setProposalsPage] = React.useState<number>(1);

  // Dialog State: Create Event
  const [isCreateOpen, setIsCreateOpen] = React.useState<boolean>(false);

  // Dialog State: Edit Event
  const [eventToEdit, setEventToEdit] = React.useState<CommunityEvent | null>(null);

  // Dialog State: Delete Event
  const [eventToDelete, setEventToDelete] = React.useState<CommunityEvent | null>(null);

  // Dialog State: View Proposal Details
  const [proposalToView, setProposalToView] = React.useState<CommunityEvent | null>(null);

  // Dialog State: Reject Proposal
  const [proposalToReject, setProposalToReject] = React.useState<CommunityEvent | null>(null);
  const [rejectReason, setRejectReason] = React.useState<string>("");

  // --------------------------------------------------------------------------
  // Data Queries
  // --------------------------------------------------------------------------

  // 1. Community Overview & Access Check
  const {
    data: overviewData,
    isLoading: isLoadingOverview,
    isError: isErrorOverview,
    error: overviewError,
  } = useQuery<CommunityOverviewResponse>({
    queryKey: ["adminCommunityOverview", slug],
    queryFn: () => apiGet<CommunityOverviewResponse>(`/admin/communities/${slug}`),
    enabled: Boolean(slug),
  });

  // 2. Upcoming / Community Events
  const {
    data: eventsResponse,
    isLoading: isLoadingEvents,
    isError: isErrorEvents,
    error: eventsError,
    refetch: refetchEvents,
  } = useQuery({
    queryKey: ["communityEvents", slug, upcomingPage],
    queryFn: () =>
      apiGet<PaginatedEventsResponse | CommunityEvent[]>(
        `/communities/${slug}/events?page=${upcomingPage}&limit=20`
      ),
    enabled: Boolean(slug && !isErrorOverview),
  });

  // 3. Pending Proposals
  const {
    data: pendingResponse,
    isLoading: isLoadingPending,
    isError: isErrorPending,
    refetch: refetchPending,
  } = useQuery({
    queryKey: ["pendingEvents", slug, proposalsPage],
    queryFn: () =>
      apiGet<PaginatedEventsResponse | CommunityEvent[]>(
        `/admin/communities/${slug}/pending-events?page=${proposalsPage}&limit=20`
      ),
    enabled: Boolean(slug && !isErrorOverview),
  });

  // Extracted Data Lists
  const upcomingEvents = React.useMemo(
    () => extractEvents(eventsResponse),
    [eventsResponse]
  );
  const upcomingMeta = React.useMemo(
    () => extractMeta(eventsResponse),
    [eventsResponse]
  );

  const pendingEvents = React.useMemo(
    () => extractEvents(pendingResponse),
    [pendingResponse]
  );
  const pendingMeta = React.useMemo(
    () => extractMeta(pendingResponse),
    [pendingResponse]
  );

  // Client-side filtering on Upcoming Events (by Title and Visibility Scope)
  const filteredUpcomingEvents = React.useMemo(() => {
    return upcomingEvents.filter((event) => {
      const matchesSearch = upcomingSearch
        ? event.title.toLowerCase().includes(upcomingSearch.toLowerCase().trim()) ||
          (event.description &&
            event.description.toLowerCase().includes(upcomingSearch.toLowerCase().trim()))
        : true;

      const matchesVisibility =
        visibilityFilter === "all" ? true : event.visibility === visibilityFilter;

      return matchesSearch && matchesVisibility;
    });
  }, [upcomingEvents, upcomingSearch, visibilityFilter]);

  // --------------------------------------------------------------------------
  // Mutations
  // --------------------------------------------------------------------------

  // 1. Create Event Mutation
  const createEventMutation = useMutation({
    mutationFn: (values: EventFormValues) => {
      const maxPart =
        values.maxParticipants && values.maxParticipants.trim()
          ? parseInt(values.maxParticipants.trim(), 10)
          : undefined;

      const payload = {
        title: values.title,
        description: values.description || undefined,
        location: values.location?.trim() || undefined,
        locationName: values.location?.trim() || undefined,
        latitude: values.latitude ?? undefined,
        longitude: values.longitude ?? undefined,
        coverImageUrl: values.coverImageUrl || undefined,
        startsAt: new Date(values.startsAt).toISOString(),
        endsAt: values.endsAt ? new Date(values.endsAt).toISOString() : undefined,
        visibility: values.visibility,
        maxParticipants: maxPart,
      };
      return apiPost(`/communities/${slug}/events`, payload);
    },
    onSuccess: () => {
      toast.success("Event created successfully!");
      setIsCreateOpen(false);
      queryClient.invalidateQueries({ queryKey: ["communityEvents", slug] });
      queryClient.invalidateQueries({ queryKey: ["pendingEvents", slug] });
      queryClient.invalidateQueries({ queryKey: ["adminCommunityStats", slug] });
    },
    onError: (err) => {
      if (isAxiosError(err)) {
        const errorData = err.response?.data?.error;
        toast.error(errorData?.message || "Failed to create event. Please try again.");
      } else {
        toast.error("An unexpected error occurred while creating the event.");
      }
    },
  });

  // 2. Edit Event Mutation
  const editEventMutation = useMutation({
    mutationFn: ({
      eventId,
      values,
    }: {
      eventId: string;
      values: EventFormValues;
    }) => {
      const maxPart =
        values.maxParticipants && values.maxParticipants.trim()
          ? parseInt(values.maxParticipants.trim(), 10)
          : undefined;

      const payload = {
        title: values.title,
        description: values.description || undefined,
        location: values.location?.trim() || undefined,
        locationName: values.location?.trim() || undefined,
        latitude: values.latitude ?? undefined,
        longitude: values.longitude ?? undefined,
        coverImageUrl: values.coverImageUrl || undefined,
        startsAt: new Date(values.startsAt).toISOString(),
        endsAt: values.endsAt ? new Date(values.endsAt).toISOString() : undefined,
        visibility: values.visibility,
        maxParticipants: maxPart,
      };
      return apiPatch(`/communities/${slug}/events/${eventId}`, payload);
    },
    onSuccess: () => {
      toast.success("Event updated successfully!");
      setEventToEdit(null);
      queryClient.invalidateQueries({ queryKey: ["communityEvents", slug] });
      queryClient.invalidateQueries({ queryKey: ["pendingEvents", slug] });
    },
    onError: (err) => {
      if (isAxiosError(err)) {
        const errorData = err.response?.data?.error;
        toast.error(errorData?.message || "Failed to update event.");
      } else {
        toast.error("An unexpected error occurred while updating the event.");
      }
    },
  });

  // 3. Delete Event Mutation
  const deleteEventMutation = useMutation({
    mutationFn: (eventId: string) =>
      apiDelete(`/communities/${slug}/events/${eventId}`),
    onSuccess: () => {
      toast.success("Event deleted successfully.");
      setEventToDelete(null);
      queryClient.invalidateQueries({ queryKey: ["communityEvents", slug] });
      queryClient.invalidateQueries({ queryKey: ["pendingEvents", slug] });
      queryClient.invalidateQueries({ queryKey: ["adminCommunityStats", slug] });
    },
    onError: (err) => {
      if (isAxiosError(err)) {
        const errorData = err.response?.data?.error;
        toast.error(errorData?.message || "Failed to delete event.");
      } else {
        toast.error("Failed to delete event.");
      }
    },
  });

  // 4. Approve Event Proposal Mutation
  const approveEventMutation = useMutation({
    mutationFn: (eventId: string) =>
      apiPost(`/communities/${slug}/events/${eventId}/approve`),
    onSuccess: () => {
      toast.success("Event proposal approved!");
      if (proposalToView) setProposalToView(null);
      queryClient.invalidateQueries({ queryKey: ["communityEvents", slug] });
      queryClient.invalidateQueries({ queryKey: ["pendingEvents", slug] });
      queryClient.invalidateQueries({ queryKey: ["adminCommunityStats", slug] });
    },
    onError: (err) => {
      if (isAxiosError(err)) {
        const errorData = err.response?.data?.error;
        toast.error(errorData?.message || "Failed to approve event proposal.");
      } else {
        toast.error("Failed to approve event proposal.");
      }
    },
  });

  // 5. Reject Event Proposal Mutation
  const rejectEventMutation = useMutation({
    mutationFn: ({
      eventId,
      reason,
    }: {
      eventId: string;
      reason?: string;
    }) =>
      apiPost(`/communities/${slug}/events/${eventId}/reject`, {
        reason: reason?.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success("Event proposal rejected.");
      setProposalToReject(null);
      setRejectReason("");
      if (proposalToView) setProposalToView(null);
      queryClient.invalidateQueries({ queryKey: ["communityEvents", slug] });
      queryClient.invalidateQueries({ queryKey: ["pendingEvents", slug] });
      queryClient.invalidateQueries({ queryKey: ["adminCommunityStats", slug] });
    },
    onError: (err) => {
      if (isAxiosError(err)) {
        const errorData = err.response?.data?.error;
        toast.error(errorData?.message || "Failed to reject event proposal.");
      } else {
        toast.error("Failed to reject event proposal.");
      }
    },
  });

  // --------------------------------------------------------------------------
  // Form Instances (React Hook Form + Zod)
  // --------------------------------------------------------------------------

  // Crop Modal State
  const [cropModal, setCropModal] = React.useState<{
    open: boolean;
    imageUrl: string;
    form: "create" | "edit";
  }>({
    open: false,
    imageUrl: "",
    form: "create",
  });

  // Create Event Form
  const createForm = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: {
      title: "",
      description: "",
      location: "",
      latitude: null,
      longitude: null,
      coverImageUrl: "",
      startsAt: getDefaultDatetimeLocal(0),
      endsAt: getDefaultDatetimeLocal(7),
      visibility: "public",
      maxParticipants: "",
    },
  });

  // Reset form whenever Create Dialog opens
  React.useEffect(() => {
    if (isCreateOpen) {
      createForm.reset({
        title: "",
        description: "",
        location: "",
        latitude: null,
        longitude: null,
        coverImageUrl: "",
        startsAt: getDefaultDatetimeLocal(0),
        endsAt: getDefaultDatetimeLocal(7),
        visibility: "public",
        maxParticipants: "",
      });
    }
  }, [isCreateOpen, createForm]);

  // Edit Event Form
  const editForm = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: {
      title: "",
      description: "",
      location: "",
      latitude: null,
      longitude: null,
      coverImageUrl: "",
      startsAt: getDefaultDatetimeLocal(0),
      endsAt: getDefaultDatetimeLocal(7),
      visibility: "public",
      maxParticipants: "",
    },
  });

  // Populate Edit Form when an event is selected
  React.useEffect(() => {
    if (eventToEdit) {
      const maxPart =
        eventToEdit.maxParticipants !== null && eventToEdit.maxParticipants !== undefined
          ? String(eventToEdit.maxParticipants)
          : eventToEdit.max_participants !== null && eventToEdit.max_participants !== undefined
          ? String(eventToEdit.max_participants)
          : "";

      const loc =
        typeof eventToEdit.location === "string"
          ? eventToEdit.location
          : eventToEdit.location?.place_name || eventToEdit.location?.name || eventToEdit.locationName || "";

      const lat = typeof eventToEdit.location === "object" ? (eventToEdit.location as any)?.latitude ?? null : null;
      const lng = typeof eventToEdit.location === "object" ? (eventToEdit.location as any)?.longitude ?? null : null;

      editForm.reset({
        title: eventToEdit.title,
        description: eventToEdit.description || "",
        location: loc,
        latitude: lat,
        longitude: lng,
        coverImageUrl: eventToEdit.coverImageUrl || eventToEdit.cover_image_url || "",
        startsAt: toDatetimeLocal(eventToEdit.startsAt || eventToEdit.starts_at, 0),
        endsAt: toDatetimeLocal(eventToEdit.endsAt || eventToEdit.ends_at, 7),
        visibility: eventToEdit.visibility || "public",
        maxParticipants: maxPart,
      });
    }
  }, [eventToEdit, editForm]);

  // --------------------------------------------------------------------------
  // Authorization & Error Guards
  // --------------------------------------------------------------------------

  if (isErrorOverview) {
    const axiosError = overviewError as {
      response?: { status?: number; data?: { error?: { message?: string } } };
    };
    const isForbidden = axiosError?.response?.status === 403;

    return (
      <div className="container mx-auto max-w-4xl py-12 px-4">
        <Card className="border-destructive/40 shadow-sm">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <ShieldAlert className="h-8 w-8" />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight">
              {isForbidden ? "Access Denied" : "Unable to load events"}
            </CardTitle>
            <CardDescription className="text-base text-muted-foreground mt-2 max-w-md mx-auto">
              {isForbidden
                ? "Only community administrators, moderators, and the owner have permission to manage events in this community."
                : "An unexpected error occurred while verifying community permissions. Please try again later."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center pb-8">
            <Button
              variant="default"
              render={<Link href={`/communities/${slug}`} />}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              <span>Back to Community Overview</span>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------

  return (
    <div className="flex-1 space-y-6 max-w-7xl mx-auto w-full">
      {/* Header & Navigation */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2.5">
            <CalendarIcon className="h-7 w-7 text-primary" />
            <span>Events Management</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            Schedule community gatherings, manage approved events, and review member proposals.
          </p>
        </div>

        {/* Global actions */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => setIsCreateOpen(true)}
            size="sm"
            className="shadow-sm gap-1.5"
          >
            <Plus className="h-4 w-4" />
            <span>Create Event</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (activeTab === "upcoming") refetchEvents();
              else refetchPending();
              toast.info("Refreshed events data");
            }}
            disabled={isLoadingEvents || isLoadingPending}
            className="gap-1.5"
          >
            <RefreshCw
              className={`h-4 w-4 ${
                isLoadingEvents || isLoadingPending ? "animate-spin" : ""
              }`}
            />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* Tab Navigation */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => {
          setActiveTab(val);
        }}
        className="space-y-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-4">
          <TabsList className="grid grid-cols-2 w-full sm:w-[380px]">
            <TabsTrigger value="upcoming" className="gap-2">
              <CalendarIcon className="h-4 w-4 text-primary" />
              <span>Upcoming Events</span>
              {upcomingEvents.length > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-1 px-1.5 py-0.2 text-[10px] font-semibold h-4 min-w-4 flex items-center justify-center rounded-full"
                >
                  {upcomingEvents.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="proposals" className="gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              <span>Pending Proposals</span>
              {pendingEvents.length > 0 && (
                <Badge
                  variant="destructive"
                  className="ml-1 px-1.5 py-0.2 text-[10px] font-semibold h-4 min-w-4 flex items-center justify-center rounded-full"
                >
                  {pendingEvents.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ================================================================== */}
        {/* TAB 1: UPCOMING EVENTS                                             */}
        {/* ================================================================== */}
        <TabsContent value="upcoming" className="space-y-6 outline-none">
          {/* Filter Bar */}
          <Card className="bg-card/50 shadow-none border">
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
                {/* Search input */}
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search events by title or description..."
                    value={upcomingSearch}
                    onChange={(e) => setUpcomingSearch(e.target.value)}
                    className="pl-9 h-9"
                  />
                  {upcomingSearch && (
                    <button
                      type="button"
                      onClick={() => setUpcomingSearch("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="w-[160px]">
                    <Select
                      value={visibilityFilter}
                      onValueChange={(val) => setVisibilityFilter(val || "all")}
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <Filter className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                        <SelectValue placeholder="All Scopes" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Scopes</SelectItem>
                        <SelectItem value="public">Public</SelectItem>
                        <SelectItem value="community">Community Only</SelectItem>
                        <SelectItem value="subcommunity">Subcommunity</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Events Table Container */}
          <div className="rounded-xl border bg-card shadow-xs overflow-hidden">
            {isLoadingEvents ? (
              <div className="p-6 space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center justify-between gap-4 py-3">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-10 w-10 rounded-lg" />
                      <div className="space-y-1.5">
                        <Skeleton className="h-4 w-48" />
                        <Skeleton className="h-3 w-28" />
                      </div>
                    </div>
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-6 w-20 rounded-full" />
                    <Skeleton className="h-6 w-16" />
                    <Skeleton className="h-8 w-20" />
                  </div>
                ))}
              </div>
            ) : filteredUpcomingEvents.length === 0 ? (
              /* Empty State */
              <div className="py-16 px-4 text-center flex flex-col items-center justify-center">
                <div className="h-14 w-14 rounded-full bg-muted/60 flex items-center justify-center text-muted-foreground mb-4">
                  <CalendarIcon className="h-7 w-7" />
                </div>
                <h3 className="text-lg font-semibold tracking-tight mb-1">
                  {upcomingSearch || visibilityFilter !== "all"
                    ? "No events match your filter"
                    : "No upcoming events scheduled"}
                </h3>
                <p className="text-sm text-muted-foreground max-w-sm mb-6">
                  {upcomingSearch || visibilityFilter !== "all"
                    ? "Try clearing your search query or adjusting the visibility scope filter."
                    : "Schedule a meetup, hike, workshop, or gathering for your community members."}
                </p>
                {upcomingSearch || visibilityFilter !== "all" ? (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setUpcomingSearch("");
                      setVisibilityFilter("all");
                    }}
                  >
                    Reset Filters
                  </Button>
                ) : (
                  <Button onClick={() => setIsCreateOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create First Event
                  </Button>
                )}
              </div>
            ) : (
              /* Populated Events Table */
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[300px]">Event Title</TableHead>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>Visibility</TableHead>
                    <TableHead>Attendees</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUpcomingEvents.map((event) => {
                    const startsAt = event.startsAt || event.starts_at;
                    const endsAt = event.endsAt || event.ends_at;
                    const cover = event.coverImageUrl || event.cover_image_url;
                    const participants =
                      event.participantsCount ?? event.participants_count ?? 0;
                    const max = event.maxParticipants ?? event.max_participants;
                    const status = event.approvalStatus || event.approval_status;
                    const isVerified = event.isVerified ?? event.is_verified;

                    return (
                      <TableRow key={event.id} className="group">
                        {/* Title Column */}
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-3">
                            {cover ? (
                              <CroppedImage
                                src={cover}
                                alt={event.title}
                                fill
                                containerClassName="h-11 w-11 rounded-lg shrink-0 border"
                              />
                            ) : (
                              <div className="h-11 w-11 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                <CalendarIcon className="h-5 w-5" />
                              </div>
                            )}
                            <div className="flex flex-col min-w-0">
                              <span className="font-semibold text-foreground truncate max-w-[220px]">
                                {event.title}
                              </span>
                              {event.description && (
                                <span className="text-xs text-muted-foreground truncate max-w-[220px]">
                                  {event.description}
                                </span>
                              )}
                              {event.location ? (
                                <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 truncate max-w-[220px]">
                                  <MapPin className="h-3 w-3 shrink-0 text-primary" />
                                  <span className="truncate">
                                    {typeof event.location === "string"
                                      ? event.location
                                      : event.location.place_name || event.location.name || event.location.address}
                                  </span>
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </TableCell>

                        {/* Date Column */}
                        <TableCell>
                          <div className="flex flex-col text-sm">
                            <span className="font-medium text-foreground">
                              {formatEventDate(startsAt, endsAt)}
                            </span>
                          </div>
                        </TableCell>

                        {/* Visibility Column */}
                        <TableCell>
                          <Badge
                            variant={
                              event.visibility === "public"
                                ? "default"
                                : event.visibility === "community"
                                ? "secondary"
                                : "outline"
                            }
                            className="capitalize text-xs font-normal"
                          >
                            {event.visibility === "public" && (
                              <Globe className="mr-1 h-3 w-3" />
                            )}
                            {event.visibility === "community" && (
                              <Users className="mr-1 h-3 w-3" />
                            )}
                            {event.visibility === "subcommunity" && (
                              <Lock className="mr-1 h-3 w-3" />
                            )}
                            {event.visibility}
                          </Badge>
                        </TableCell>

                        {/* Attendees Column */}
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-sm">
                            <Users className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>
                              <strong className="text-foreground">{participants}</strong>
                              {max ? ` / ${max}` : " attendees"}
                            </span>
                          </div>
                        </TableCell>

                        {/* Status Column */}
                        <TableCell>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge
                              variant={
                                status === "approved"
                                  ? "secondary"
                                  : status === "rejected"
                                  ? "destructive"
                                  : "outline"
                              }
                              className="capitalize text-xs font-normal"
                            >
                              {status || "approved"}
                            </Badge>
                            {isVerified && (
                              <Badge
                                variant="outline"
                                className="text-xs text-primary border-primary/30 flex items-center gap-1"
                              >
                                <Sparkles className="h-2.5 w-2.5" /> Verified
                              </Badge>
                            )}
                          </div>
                        </TableCell>

                        {/* Actions Column */}
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => setEventToEdit(event)}
                              title="Edit event"
                            >
                              <Edit2 className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                              <span className="sr-only">Edit</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => setEventToDelete(event)}
                              className="text-destructive/80 hover:text-destructive hover:bg-destructive/10"
                              title="Delete event"
                            >
                              <Trash2 className="h-4 w-4" />
                              <span className="sr-only">Delete</span>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}

            {/* Pagination Controls */}
            {upcomingMeta && (upcomingMeta.totalPages ?? 1) > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/20 text-xs text-muted-foreground">
                <span>
                  Page {upcomingMeta.page ?? upcomingPage} of{" "}
                  {upcomingMeta.totalPages} ({upcomingMeta.total} total)
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={upcomingPage <= 1}
                    onClick={() => setUpcomingPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="h-3.5 w-3.5 mr-1" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={upcomingPage >= (upcomingMeta.totalPages ?? 1)}
                    onClick={() => setUpcomingPage((p) => p + 1)}
                  >
                    Next
                    <ChevronRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ================================================================== */}
        {/* TAB 2: PENDING PROPOSALS                                           */}
        {/* ================================================================== */}
        <TabsContent value="proposals" className="space-y-6 outline-none">
          <div className="rounded-xl border bg-card shadow-xs overflow-hidden">
            {isLoadingPending ? (
              <div className="p-6 space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center justify-between gap-4 py-3">
                    <div className="space-y-1.5">
                      <Skeleton className="h-4 w-52" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                    <Skeleton className="h-8 w-36 rounded-full" />
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-8 w-24" />
                  </div>
                ))}
              </div>
            ) : pendingEvents.length === 0 ? (
              /* Empty Proposals State */
              <div className="py-16 px-4 text-center flex flex-col items-center justify-center">
                <div className="h-14 w-14 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4">
                  <CheckCircle className="h-7 w-7" />
                </div>
                <h3 className="text-lg font-semibold tracking-tight mb-1">
                  All caught up!
                </h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  There are no pending event proposals submitted by community members awaiting
                  moderator review.
                </p>
              </div>
            ) : (
              /* Populated Proposals Table */
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[300px]">Proposed Event</TableHead>
                    <TableHead>Proposed By</TableHead>
                    <TableHead>Scheduled Date</TableHead>
                    <TableHead className="text-right">Review Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingEvents.map((event) => {
                    const startsAt = event.startsAt || event.starts_at;
                    const endsAt = event.endsAt || event.ends_at;
                    const creator = event.creator;
                    const creatorName = getCreatorName(creator);
                    const initials = getCreatorInitials(creator);
                    const cover = event.coverImageUrl || event.cover_image_url;

                    return (
                      <TableRow key={event.id}>
                        {/* Event Details */}
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-3">
                            {cover ? (
                              <CroppedImage
                                src={cover}
                                alt={event.title}
                                fill
                                containerClassName="h-11 w-11 rounded-lg shrink-0 border"
                              />
                            ) : (
                              <div className="h-11 w-11 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                                <Clock className="h-5 w-5" />
                              </div>
                            )}
                            <div className="flex flex-col min-w-0">
                              <span className="font-semibold text-foreground truncate max-w-[220px]">
                                {event.title}
                              </span>
                              <Badge
                                variant="outline"
                                className="w-fit text-[11px] py-0 px-1.5 mt-0.5 text-amber-600 dark:text-amber-400 border-amber-500/30"
                              >
                                Pending Review
                              </Badge>
                            </div>
                          </div>
                        </TableCell>

                        {/* Proposed By */}
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-7 w-7">
                              <AvatarImage
                                src={creator?.profile_picture_url || undefined}
                                alt={creatorName}
                              />
                              <AvatarFallback className="text-xs bg-muted font-medium" />
                            </Avatar>
                            <div className="flex flex-col">
                              <span className="text-sm font-medium text-foreground leading-none">
                                {creatorName}
                              </span>
                              {creator?.username && (
                                <span className="text-xs text-muted-foreground mt-0.5">
                                  @{creator.username}
                                </span>
                              )}
                            </div>
                          </div>
                        </TableCell>

                        {/* Date */}
                        <TableCell>
                          <span className="text-sm text-foreground">
                            {formatEventDate(startsAt, endsAt)}
                          </span>
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setProposalToView(event)}
                            >
                              <Eye className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
                              View
                            </Button>
                            <Button
                              variant="default"
                              size="sm"
                              className="bg-emerald-600 hover:bg-emerald-700 text-white"
                              disabled={approveEventMutation.isPending}
                              onClick={() => approveEventMutation.mutate(event.id)}
                            >
                              <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
                              Approve
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-destructive hover:bg-destructive/10"
                              disabled={rejectEventMutation.isPending}
                              onClick={() => {
                                setProposalToReject(event);
                                setRejectReason("");
                              }}
                            >
                              <XCircle className="mr-1.5 h-3.5 w-3.5" />
                              Reject
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}

            {/* Pagination Controls */}
            {pendingMeta && (pendingMeta.totalPages ?? 1) > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/20 text-xs text-muted-foreground">
                <span>
                  Page {pendingMeta.page ?? proposalsPage} of {pendingMeta.totalPages}{" "}
                  ({pendingMeta.total} total)
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={proposalsPage <= 1}
                    onClick={() => setProposalsPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="h-3.5 w-3.5 mr-1" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={proposalsPage >= (pendingMeta.totalPages ?? 1)}
                    onClick={() => setProposalsPage((p) => p + 1)}
                  >
                    Next
                    <ChevronRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* ==================================================================== */}
      {/* DIALOG: CREATE EVENT                                                 */}
      {/* ==================================================================== */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-primary" />
              Create Community Event
            </DialogTitle>
            <DialogDescription>
              Schedule an official community event. As an administrator, events you create are
              automatically approved and verified.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={createForm.handleSubmit((values: EventFormValues) =>
              createEventMutation.mutate(values)
            )}
            className="flex flex-col gap-4 py-2"
          >
            {/* Title */}
            <div className="space-y-1.5">
              <Label htmlFor="create-title">
                Event Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="create-title"
                {...createForm.register("title")}
              />
              {createForm.formState.errors.title && (
                <p className="text-xs text-destructive">
                  {createForm.formState.errors.title.message}
                </p>
              )}
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="create-description">Description</Label>
              <Textarea
                id="create-description"
                rows={3}
                {...createForm.register("description")}
              />
              {createForm.formState.errors.description && (
                <p className="text-xs text-destructive">
                  {createForm.formState.errors.description.message}
                </p>
              )}
            </div>

            {/* Cover Image URL */}
            <div className="space-y-1.5">
              <Label htmlFor="create-cover">Cover Image URL</Label>
              <Input
                id="create-cover"
                type="text"
                placeholder="https://example.com/photos/banner.jpg"
                {...createForm.register("coverImageUrl")}
              />
              {createForm.formState.errors.coverImageUrl && (
                <p className="text-xs text-destructive">
                  {createForm.formState.errors.coverImageUrl.message}
                </p>
              )}

              {/* Live Cover Preview */}
              {Boolean(createForm.watch("coverImageUrl")?.trim()) && (
                <div className="relative mt-2 rounded-lg border border-border overflow-hidden max-h-48 bg-muted/40 flex items-center justify-center">
                  <CroppedImage
                    src={createForm.watch("coverImageUrl")!.trim()}
                    alt="Preview"
                    fill
                    containerClassName="w-full h-36 rounded-lg"
                  />
                  <div className="absolute top-2 left-2 flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        setCropModal({
                          open: true,
                          imageUrl: createForm.watch("coverImageUrl")!.trim(),
                          form: "create",
                        })
                      }
                      className="h-7 px-2 text-xs gap-1.5 bg-background/80 hover:bg-background shadow-xs cursor-pointer"
                    >
                      <Crop className="size-3.5" />
                      Crop Cover
                    </Button>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => createForm.setValue("coverImageUrl", "")}
                    className="absolute top-2 right-2 size-7 p-0 rounded-full bg-background/80 hover:bg-background shadow-xs cursor-pointer"
                    title="Remove image"
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
              )}
            </div>

            {/* Start & End Dates */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="create-startsAt">
                  Starts At <span className="text-destructive">*</span>
                </Label>
                <Controller
                  control={createForm.control}
                  name="startsAt"
                  render={({ field }) => (
                    <DateTimePicker
                      id="create-startsAt"
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Select start date and time"
                    />
                  )}
                />
                {createForm.formState.errors.startsAt && (
                  <p className="text-xs text-destructive">
                    {createForm.formState.errors.startsAt.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="create-endsAt">Ends At (Optional)</Label>
                <Controller
                  control={createForm.control}
                  name="endsAt"
                  render={({ field }) => (
                    <DateTimePicker
                      id="create-endsAt"
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Select end date and time (optional)"
                    />
                  )}
                />
                {createForm.formState.errors.endsAt && (
                  <p className="text-xs text-destructive">
                    {createForm.formState.errors.endsAt.message}
                  </p>
                )}
              </div>
            </div>

            {/* Location */}
            <div className="space-y-1.5">
              <Controller
                control={createForm.control}
                name="location"
                render={({ field }) => (
                  <LocationInput
                    label="Location (Venue / Address)"
                    value={field.value}
                    latitude={createForm.watch("latitude")}
                    longitude={createForm.watch("longitude")}
                    placeholder="e.g. Millennium Hall, Bole Road, Addis Ababa or pick on map..."
                    onChangeLocation={(loc) => {
                      field.onChange(loc.name);
                      createForm.setValue("latitude", loc.latitude);
                      createForm.setValue("longitude", loc.longitude);
                    }}
                  />
                )}
              />
              {createForm.formState.errors.location && (
                <p className="text-xs text-destructive">
                  {createForm.formState.errors.location.message}
                </p>
              )}
            </div>

            {/* Visibility & Max Participants */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="create-visibility">Visibility Scope</Label>
                <Select
                  value={createForm.watch("visibility")}
                  onValueChange={(val) => {
                    if (val === "public" || val === "community" || val === "subcommunity") {
                      createForm.setValue("visibility", val);
                    }
                  }}
                >
                  <SelectTrigger id="create-visibility">
                    <SelectValue placeholder="Select visibility" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public (Everyone)</SelectItem>
                    <SelectItem value="community">Community Members Only</SelectItem>
                    <SelectItem value="subcommunity">Subcommunity Members</SelectItem>
                  </SelectContent>
                </Select>
                {createForm.formState.errors.visibility && (
                  <p className="text-xs text-destructive">
                    {createForm.formState.errors.visibility.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="create-maxParticipants">Max Participants</Label>
                <Input
                  id="create-maxParticipants"
                  type="number"
                  min={1}
                  placeholder="Leave empty for unlimited"
                  {...createForm.register("maxParticipants")}
                />
                {createForm.formState.errors.maxParticipants && (
                  <p className="text-xs text-destructive">
                    {createForm.formState.errors.maxParticipants.message}
                  </p>
                )}
              </div>
            </div>

            <DialogFooter className="mt-4 pt-4 border-t flex flex-row items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
                disabled={createEventMutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createEventMutation.isPending}>
                {createEventMutation.isPending ? "Creating..." : "Publish Event"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ==================================================================== */}
      {/* DIALOG: EDIT EVENT                                                   */}
      {/* ==================================================================== */}
      <Dialog
        open={Boolean(eventToEdit)}
        onOpenChange={(open) => {
          if (!open) setEventToEdit(null);
        }}
      >
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Edit2 className="h-5 w-5 text-primary" />
              Edit Event
            </DialogTitle>
            <DialogDescription>
              Update the event details, timings, or participant capacity.
            </DialogDescription>
          </DialogHeader>

          {eventToEdit && (
            <form
              onSubmit={editForm.handleSubmit((values: EventFormValues) =>
                editEventMutation.mutate({ eventId: eventToEdit.id, values })
              )}
              className="flex flex-col gap-4 py-2"
            >
              {/* Title */}
              <div className="space-y-1.5">
                <Label htmlFor="edit-title">
                  Event Title <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="edit-title"
                  {...editForm.register("title")}
                />
                {editForm.formState.errors.title && (
                  <p className="text-xs text-destructive">
                    {editForm.formState.errors.title.message}
                  </p>
                )}
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  rows={3}
                  {...editForm.register("description")}
                />
                {editForm.formState.errors.description && (
                  <p className="text-xs text-destructive">
                    {editForm.formState.errors.description.message}
                  </p>
                )}
              </div>

              {/* Cover Image URL */}
              <div className="space-y-1.5">
                <Label htmlFor="edit-cover">Cover Image URL</Label>
                <Input
                  id="edit-cover"
                  type="text"
                  placeholder="https://example.com/photos/banner.jpg"
                  {...editForm.register("coverImageUrl")}
                />
                {editForm.formState.errors.coverImageUrl && (
                  <p className="text-xs text-destructive">
                    {editForm.formState.errors.coverImageUrl.message}
                  </p>
                )}

                {/* Live Cover Preview */}
                {Boolean(editForm.watch("coverImageUrl")?.trim()) && (
                  <div className="relative mt-2 rounded-lg border border-border overflow-hidden max-h-48 bg-muted/40 flex items-center justify-center">
                    <CroppedImage
                      src={editForm.watch("coverImageUrl")!.trim()}
                      alt="Preview"
                      fill
                      containerClassName="w-full h-36 rounded-lg"
                    />
                    <div className="absolute top-2 left-2 flex items-center gap-1.5">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() =>
                          setCropModal({
                            open: true,
                            imageUrl: editForm.watch("coverImageUrl")!.trim(),
                            form: "edit",
                          })
                        }
                        className="h-7 px-2 text-xs gap-1.5 bg-background/80 hover:bg-background shadow-xs cursor-pointer"
                      >
                        <Crop className="size-3.5" />
                        Crop Cover
                      </Button>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => editForm.setValue("coverImageUrl", "")}
                      className="absolute top-2 right-2 size-7 p-0 rounded-full bg-background/80 hover:bg-background shadow-xs cursor-pointer"
                      title="Remove image"
                    >
                      <X className="size-3.5" />
                    </Button>
                  </div>
                )}
              </div>

              {/* Start & End Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-startsAt">
                    Starts At <span className="text-destructive">*</span>
                  </Label>
                  <Controller
                    control={editForm.control}
                    name="startsAt"
                    render={({ field }) => (
                      <DateTimePicker
                        id="edit-startsAt"
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Select start date and time"
                      />
                    )}
                  />
                  {editForm.formState.errors.startsAt && (
                    <p className="text-xs text-destructive">
                      {editForm.formState.errors.startsAt.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="edit-endsAt">Ends At (Optional)</Label>
                  <Controller
                    control={editForm.control}
                    name="endsAt"
                    render={({ field }) => (
                      <DateTimePicker
                        id="edit-endsAt"
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Select end date and time (optional)"
                      />
                    )}
                  />
                  {editForm.formState.errors.endsAt && (
                    <p className="text-xs text-destructive">
                      {editForm.formState.errors.endsAt.message}
                    </p>
                  )}
                </div>
              </div>

              {/* Location */}
              <div className="space-y-1.5">
                <Controller
                  control={editForm.control}
                  name="location"
                  render={({ field }) => (
                    <LocationInput
                      label="Location (Venue / Address)"
                      value={field.value}
                      latitude={editForm.watch("latitude")}
                      longitude={editForm.watch("longitude")}
                      placeholder="e.g. Millennium Hall, Bole Road, Addis Ababa or pick on map..."
                      onChangeLocation={(loc) => {
                        field.onChange(loc.name);
                        editForm.setValue("latitude", loc.latitude);
                        editForm.setValue("longitude", loc.longitude);
                      }}
                    />
                  )}
                />
                {editForm.formState.errors.location && (
                  <p className="text-xs text-destructive">
                    {editForm.formState.errors.location.message}
                  </p>
                )}
              </div>

              {/* Visibility & Max Participants */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-visibility">Visibility Scope</Label>
                  <Select
                    value={editForm.watch("visibility")}
                    onValueChange={(val) => {
                      if (val === "public" || val === "community" || val === "subcommunity") {
                        editForm.setValue("visibility", val);
                      }
                    }}
                  >
                    <SelectTrigger id="edit-visibility">
                      <SelectValue placeholder="Select visibility" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="public">Public (Everyone)</SelectItem>
                      <SelectItem value="community">Community Members Only</SelectItem>
                      <SelectItem value="subcommunity">Subcommunity Members</SelectItem>
                    </SelectContent>
                  </Select>
                  {editForm.formState.errors.visibility && (
                    <p className="text-xs text-destructive">
                      {editForm.formState.errors.visibility.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="edit-maxParticipants">Max Participants</Label>
                  <Input
                    id="edit-maxParticipants"
                    type="number"
                    min={1}
                    placeholder="Leave empty for unlimited"
                    {...editForm.register("maxParticipants")}
                  />
                  {editForm.formState.errors.maxParticipants && (
                    <p className="text-xs text-destructive">
                      {editForm.formState.errors.maxParticipants.message}
                    </p>
                  )}
                </div>
              </div>

              <DialogFooter className="mt-4 pt-4 border-t flex flex-row items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEventToEdit(null)}
                  disabled={editEventMutation.isPending}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={editEventMutation.isPending}>
                  {editEventMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ==================================================================== */}
      {/* ALERT DIALOG: CONFIRM DELETE EVENT                                  */}
      {/* ==================================================================== */}
      <AlertDialog
        open={Boolean(eventToDelete)}
        onOpenChange={(open) => {
          if (!open) setEventToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Delete Event
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &ldquo;{eventToDelete?.title}&rdquo;?
              This will remove the event from the community schedule and cancel attendee
              registrations.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteEventMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white font-medium cursor-pointer"
              disabled={deleteEventMutation.isPending}
              onClick={() => {
                if (eventToDelete) {
                  deleteEventMutation.mutate(eventToDelete.id);
                }
              }}
            >
              {deleteEventMutation.isPending ? "Deleting..." : "Delete Event"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ==================================================================== */}
      {/* DIALOG: VIEW PROPOSAL DETAILS                                        */}
      {/* ==================================================================== */}
      <Dialog
        open={Boolean(proposalToView)}
        onOpenChange={(open) => {
          if (!open) setProposalToView(null);
        }}
      >
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">Event Proposal Details</DialogTitle>
            <DialogDescription>
              Review the complete proposal details before approving or rejecting.
            </DialogDescription>
          </DialogHeader>

          {proposalToView && (
            <div className="flex flex-col gap-4 py-2">
              {/* Cover Image Preview if present */}
              {(proposalToView.coverImageUrl || proposalToView.cover_image_url) && (
                <div className="w-full h-44 rounded-xl overflow-hidden border">
                  <CroppedImage
                    src={
                      proposalToView.coverImageUrl ||
                      proposalToView.cover_image_url ||
                      ""
                    }
                    alt={proposalToView.title}
                    fill
                    containerClassName="w-full h-full rounded-xl"
                  />
                </div>
              )}

              {/* Title & Status */}
              <div>
                <h3 className="text-xl font-bold text-foreground">
                  {proposalToView.title}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-amber-600 border-amber-500/30">
                    <Clock className="h-3 w-3 mr-1" /> Pending Approval
                  </Badge>
                  <Badge variant="secondary" className="capitalize text-xs">
                    {proposalToView.visibility} Scope
                  </Badge>
                </div>
              </div>

              {/* Description */}
              <div className="rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground whitespace-pre-line">
                {proposalToView.description || "No description provided for this event."}
              </div>

              {/* Proposer Info Card */}
              <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                <Avatar className="h-10 w-10">
                  <AvatarImage
                    src={proposalToView.creator?.profile_picture_url || undefined}
                    alt={getCreatorName(proposalToView.creator)}
                  />
                  <AvatarFallback className="bg-primary/10 text-primary font-medium" />
                </Avatar>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-foreground">
                    {getCreatorName(proposalToView.creator)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    @{proposalToView.creator?.username || "member"} • Proposed Event Creator
                  </span>
                </div>
              </div>

              {/* Schedule and Capacity */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-2.5 rounded-lg border bg-muted/20 flex flex-col gap-1">
                  <span className="text-muted-foreground font-medium flex items-center gap-1">
                    <CalendarIcon className="h-3 w-3" /> Date & Time
                  </span>
                  <span className="font-semibold text-foreground">
                    {formatEventDate(
                      proposalToView.startsAt || proposalToView.starts_at,
                      proposalToView.endsAt || proposalToView.ends_at
                    )}
                  </span>
                </div>

                <div className="p-2.5 rounded-lg border bg-muted/20 flex flex-col gap-1">
                  <span className="text-muted-foreground font-medium flex items-center gap-1">
                    <Users className="h-3 w-3" /> Participant Limit
                  </span>
                  <span className="font-semibold text-foreground">
                    {proposalToView.maxParticipants ?? proposalToView.max_participants
                      ? `${
                          proposalToView.maxParticipants ??
                          proposalToView.max_participants
                        } maximum attendees`
                      : "Unlimited capacity"}
                  </span>
                </div>
              </div>

              {/* Dialog Actions */}
              <DialogFooter className="mt-4 pt-4 border-t flex flex-row items-center justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setProposalToView(null)}
                >
                  Close
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    setProposalToReject(proposalToView);
                    setProposalToView(null);
                  }}
                >
                  <XCircle className="mr-1.5 h-4 w-4" />
                  Reject
                </Button>
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  disabled={approveEventMutation.isPending}
                  onClick={() => approveEventMutation.mutate(proposalToView.id)}
                >
                  <CheckCircle className="mr-1.5 h-4 w-4" />
                  {approveEventMutation.isPending ? "Approving..." : "Approve Event"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ==================================================================== */}
      {/* DIALOG: REJECT PROPOSAL (WITH REASON)                                */}
      {/* ==================================================================== */}
      <Dialog
        open={Boolean(proposalToReject)}
        onOpenChange={(open) => {
          if (!open) {
            setProposalToReject(null);
            setRejectReason("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <XCircle className="h-5 w-5" />
              Reject Event Proposal
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to reject &ldquo;{proposalToReject?.title}&rdquo;?
              You can optionally provide a reason to notify the member.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <Label htmlFor="reject-reason">Rejection Reason (Optional)</Label>
            <Textarea
              id="reject-reason"
              placeholder="e.g. Does not meet community guidelines, duplicate date, missing safety information..."
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
          </div>

          <DialogFooter className="mt-2 pt-4 border-t flex flex-row items-center justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setProposalToReject(null);
                setRejectReason("");
              }}
              disabled={rejectEventMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={rejectEventMutation.isPending}
              onClick={() => {
                if (proposalToReject) {
                  rejectEventMutation.mutate({
                    eventId: proposalToReject.id,
                    reason: rejectReason,
                  });
                }
              }}
            >
              {rejectEventMutation.isPending ? "Rejecting..." : "Confirm Rejection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {Boolean(cropModal.imageUrl) && (
        <ImageCropModal
          open={cropModal.open}
          onOpenChange={(open: boolean) => setCropModal((prev) => ({ ...prev, open }))}
          imageUrl={cropModal.imageUrl}
          cropShape="wide-rectangle"
          targetRatio={16 / 9}
          onConfirm={(croppedUrl) => {
            if (cropModal.form === "create") {
              createForm.setValue("coverImageUrl", croppedUrl, { shouldDirty: true, shouldValidate: true });
            } else {
              editForm.setValue("coverImageUrl", croppedUrl, { shouldDirty: true, shouldValidate: true });
            }
            setCropModal((prev) => ({ ...prev, open: false }));
          }}
        />
      )}
    </div>
  );
}
