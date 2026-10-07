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
  MapPin,
  AlertTriangle,
  Trash2,
  CheckCircle2,
  KeyRound,
  ShieldCheck,
  ArrowRight,
  Crop,
  Eye,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";

import { ImageCropModal } from "@/components/ui/image-crop-modal";
import { CroppedImage } from "@/components/ui/cropped-image";

import { apiGet, apiPatch, apiPost, apiDelete } from "@/lib/api-client";
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
import { PhoneInput } from "@/components/ui/phone-input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LocationInput } from "@/components/ui/location-input";

interface UserProfileData {
  id: string;
  username: string;
  email?: string | null;
  phone_number?: string | null;
  phone_verified_at?: string | null;
  phone_number_verified?: boolean;
  first_name?: string | null;
  last_name?: string | null;
  name?: string | null;
  bio?: string | null;
  profile_picture_url?: string | null;
  trust_score?: number;
  created_at?: string;
  location?: {
    id?: string;
    place_name?: string;
    placeName?: string;
    name?: string;
    latitude?: number | null;
    longitude?: number | null;
  } | null;
  location_id?: string | null;
  is_location_private?: boolean;
}

function validatePhoneNumberInput(raw: string): { isValid: boolean; error?: string; formatted?: string } {
  const digits = raw.replace(/\D/g, "");
  if (!digits) {
    return { isValid: false, error: "Please enter a phone number." };
  }

  // Ethiopia (+251)
  if (digits.startsWith("251")) {
    const sub = digits.startsWith("2510") ? digits.slice(4) : digits.slice(3);
    if (sub.length < 9) {
      return { isValid: false, error: "Missing digits. Ethiopian numbers require 9 digits after +251 (e.g. +251 91 122 3344)." };
    }
    if (sub.length > 9) {
      return { isValid: false, error: "Too many digits for an Ethiopian phone number." };
    }
    if (!/^[97]/.test(sub)) {
      return { isValid: false, error: "Ethiopian mobile numbers must start with 9 or 7." };
    }
    return { isValid: true, formatted: `+251${sub}` };
  }

  // Local Ethiopian format starting with 0
  if (digits.startsWith("0")) {
    const sub = digits.slice(1);
    if (sub.length < 9) {
      return { isValid: false, error: "Missing digits. Please enter all 10 digits (e.g. 0911223344)." };
    }
    if (sub.length > 9) {
      return { isValid: false, error: "Too many digits. Please enter 10 digits (e.g. 0911223344)." };
    }
    if (!/^[97]/.test(sub)) {
      return { isValid: false, error: "Ethiopian mobile numbers must start with 09 or 07." };
    }
    return { isValid: true, formatted: `+251${sub}` };
  }

  // Local 9-digit Ethiopian subscriber format
  if (digits.length === 9 && /^[97]/.test(digits)) {
    return { isValid: true, formatted: `+251${digits}` };
  }

  if (digits.length < 8) {
    return { isValid: false, error: "Phone number is too short. Please enter a complete number." };
  }
  if (digits.length > 15) {
    return { isValid: false, error: "Phone number is too long." };
  }

  return { isValid: true, formatted: `+${digits}` };
}

function SixDigitOtpBoxes({
  value,
  onChange,
  disabled,
}: {
  value: string[];
  onChange: (val: string[]) => void;
  disabled?: boolean;
}) {
  const inputRefs = React.useRef<(HTMLInputElement | null)[]>([]);

  const handleChange = (index: number, val: string) => {
    if (!/^\d*$/.test(val)) return;
    const next = [...value];
    next[index] = val.slice(-1);
    onChange(next);

    if (val && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !value[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    const next = [...value];
    for (let i = 0; i < pasted.length && i < 6; i++) {
      next[i] = pasted[i];
    }
    onChange(next);
    const nextIdx = Math.min(pasted.length, 5);
    inputRefs.current[nextIdx]?.focus();
  };

  return (
    <div className="flex justify-center gap-2 sm:gap-2.5 my-3" onPaste={handlePaste}>
      {value.map((digit, idx) => (
        <input
          key={idx}
          ref={(el) => {
            inputRefs.current[idx] = el;
          }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          onChange={(e) => handleChange(idx, e.target.value)}
          onKeyDown={(e) => handleKeyDown(idx, e)}
          disabled={disabled}
          className="h-12 w-12 rounded-lg border border-border/80 bg-background text-center text-lg font-bold outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
        />
      ))}
    </div>
  );
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
    .refine((val) => !val || val === "" || /^(https?:\/\/|data:image\/).+/i.test(val), {
      message: "Please enter a valid image URL or data URI",
    })
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
    setValue,
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

  const watchedAvatarUrl = watch("profilePictureUrl");
  const [isCropModalOpen, setIsCropModalOpen] = React.useState(false);

  // ── Phone Modal State ──
  const [isPhoneModalOpen, setIsPhoneModalOpen] = React.useState(false);
  const [phoneStep, setPhoneStep] = React.useState<"phone" | "otp">("phone");
  const [phoneNumberInput, setPhoneNumberInput] = React.useState("");
  const [phoneOtp, setPhoneOtp] = React.useState<string[]>(Array(6).fill(""));
  const [phoneError, setPhoneError] = React.useState("");
  const [phoneLoading, setPhoneLoading] = React.useState(false);

  // ── Password Modal State ──
  const [isPasswordModalOpen, setIsPasswordModalOpen] = React.useState(false);
  const [passStep, setPassStep] = React.useState<"method" | "otp" | "new-password">("method");
  const [passMethod, setPassMethod] = React.useState<"email" | "phone">("email");
  const [passIdentifier, setPassIdentifier] = React.useState("");
  const [passOtp, setPassOtp] = React.useState<string[]>(Array(6).fill(""));
  const [passTicket, setPassTicket] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [showNewPass, setShowNewPass] = React.useState(false);
  const [passLoading, setPassLoading] = React.useState(false);
  const [passError, setPassError] = React.useState("");

  // ── Delete Account Modal State ──
  const [isDeleteModalOpen, setIsDeleteModalOpen] = React.useState(false);
  const [deleteStep, setDeleteStep] = React.useState<"method" | "otp" | "confirm">("method");
  const [deleteMethod, setDeleteMethod] = React.useState<"email" | "phone">("email");
  const [deleteIdentifier, setDeleteIdentifier] = React.useState("");
  const [deleteOtp, setDeleteOtp] = React.useState<string[]>(Array(6).fill(""));
  const [deleteTicket, setDeleteTicket] = React.useState("");
  const [deleteLoading, setDeleteLoading] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState("");

  const isPhoneConnected = Boolean(
    user?.phone_number && (user?.phone_verified_at || user?.phone_number_verified)
  );

  const handleOpenPhoneModal = () => {
    setPhoneNumberInput("");
    setPhoneOtp(Array(6).fill(""));
    setPhoneError("");
    setPhoneStep("phone");
    setIsPhoneModalOpen(true);
  };

  const handleSendPhoneOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneError("");
    const validation = validatePhoneNumberInput(phoneNumberInput);
    if (!validation.isValid || !validation.formatted) {
      setPhoneError(validation.error || "Please enter a valid phone number.");
      return;
    }

    if (user?.phone_number && validation.formatted === user.phone_number) {
      setPhoneError("This phone number is already connected to your account. Please enter a different phone number.");
      return;
    }

    setPhoneLoading(true);
    try {
      await apiPost("/auth/verify-phone", {
        phoneNumber: validation.formatted,
      });
      toast.success("Verification code sent via SMS.");
      setPhoneNumberInput(validation.formatted);
      setPhoneStep("otp");
    } catch (err) {
      if (isAxiosError(err)) {
        setPhoneError(err.response?.data?.error?.message || "Failed to send verification code.");
      } else {
        setPhoneError("An unexpected error occurred.");
      }
    } finally {
      setPhoneLoading(false);
    }
  };

  const handleConfirmPhoneOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const otpCode = phoneOtp.join("");
    if (otpCode.length !== 6) {
      setPhoneError("Please enter all 6 digits of the verification code.");
      return;
    }

    setPhoneLoading(true);
    setPhoneError("");
    try {
      await apiPost("/auth/verify-phone/confirm", {
        phoneNumber: phoneNumberInput,
        otp: otpCode,
      });
      toast.success("Phone number verified and connected successfully!");
      setIsPhoneModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["currentUserProfile"] });
    } catch (err) {
      if (isAxiosError(err)) {
        setPhoneError(err.response?.data?.error?.message || "Invalid or expired verification code. Original phone number was preserved.");
      } else {
        setPhoneError("Verification failed. Original phone number was preserved.");
      }
    } finally {
      setPhoneLoading(false);
    }
  };

  const handleOpenPasswordModal = () => {
    setPassStep("method");
    const initialMethod = user?.email ? "email" : "phone";
    setPassMethod(initialMethod);
    setPassIdentifier(initialMethod === "email" ? (user?.email || "") : (user?.phone_number || ""));
    setPassOtp(Array(6).fill(""));
    setPassTicket("");
    setNewPassword("");
    setConfirmPassword("");
    setPassError("");
    setIsPasswordModalOpen(true);
  };

  const handleSendPassCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassError("");
    if (!passIdentifier.trim()) {
      setPassError(`Please enter your account ${passMethod === "email" ? "email address" : "phone number"}.`);
      return;
    }

    setPassLoading(true);
    try {
      await apiPost("/auth/security/send-code", {
        action: "change-password",
        method: passMethod,
        identifier: passIdentifier.trim(),
      });
      toast.success(`Verification code sent via ${passMethod === "email" ? "Email" : "SMS"}.`);
      setPassStep("otp");
    } catch (err) {
      if (isAxiosError(err)) {
        setPassError(err.response?.data?.error?.message || "Verification code request failed.");
      } else {
        setPassError("An unexpected error occurred.");
      }
    } finally {
      setPassLoading(false);
    }
  };

  const handleVerifyPassOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const otpCode = passOtp.join("");
    if (otpCode.length !== 6) {
      setPassError("Please enter all 6 digits of the verification code.");
      return;
    }

    setPassLoading(true);
    setPassError("");
    try {
      const res: any = await apiPost("/auth/security/verify-code", {
        action: "change-password",
        otp: otpCode,
      });
      const ticket = res?.ticket || res?.data?.ticket;
      if (ticket) {
        setPassTicket(ticket);
        setPassStep("new-password");
      } else {
        setPassError("Verification failed. Please try again.");
      }
    } catch (err) {
      if (isAxiosError(err)) {
        setPassError(err.response?.data?.error?.message || "Invalid or expired verification code.");
      } else {
        setPassError("Verification failed.");
      }
    } finally {
      setPassLoading(false);
    }
  };

  const handleSaveNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassError("");
    if (newPassword.length < 8) {
      setPassError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPassError("Passwords do not match.");
      return;
    }

    setPassLoading(true);
    try {
      await apiPost("/auth/change-password", {
        newPassword,
        ticket: passTicket,
      });
      toast.success("Password changed successfully. Logging out of all sessions...");
      setIsPasswordModalOpen(false);
      if (typeof window !== "undefined") {
        localStorage.removeItem("bearer_token");
        localStorage.removeItem("auth_user");
        setTimeout(() => {
          window.location.href = "/login";
        }, 1000);
      }
    } catch (err) {
      if (isAxiosError(err)) {
        setPassError(err.response?.data?.error?.message || "Failed to update password.");
      } else {
        setPassError("Failed to update password.");
      }
    } finally {
      setPassLoading(false);
    }
  };

  const handleOpenDeleteModal = () => {
    setDeleteStep("method");
    setDeleteMethod(user?.email ? "email" : "phone");
    setDeleteIdentifier("");
    setDeleteOtp(Array(6).fill(""));
    setDeleteTicket("");
    setDeleteError("");
    setIsDeleteModalOpen(true);
  };

  const handleSendDeleteCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeleteError("");
    if (!deleteIdentifier.trim()) {
      setDeleteError(`Please enter your account ${deleteMethod === "email" ? "email address" : "phone number"}.`);
      return;
    }

    setDeleteLoading(true);
    try {
      await apiPost("/auth/security/send-code", {
        action: "delete-account",
        method: deleteMethod,
        identifier: deleteIdentifier.trim(),
      });
      toast.success(`Verification code sent via ${deleteMethod === "email" ? "Email" : "SMS"}.`);
      setDeleteStep("otp");
    } catch (err) {
      if (isAxiosError(err)) {
        setDeleteError(err.response?.data?.error?.message || "Verification code request failed.");
      } else {
        setDeleteError("An unexpected error occurred.");
      }
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleVerifyDeleteOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const otpCode = deleteOtp.join("");
    if (otpCode.length !== 6) {
      setDeleteError("Please enter all 6 digits of the verification code.");
      return;
    }

    setDeleteLoading(true);
    setDeleteError("");
    try {
      const res: any = await apiPost("/auth/security/verify-code", {
        action: "delete-account",
        otp: otpCode,
      });
      const ticket = res?.ticket || res?.data?.ticket;
      if (ticket) {
        setDeleteTicket(ticket);
        setDeleteStep("confirm");
      } else {
        setDeleteError("Verification failed. Please try again.");
      }
    } catch (err) {
      if (isAxiosError(err)) {
        setDeleteError(err.response?.data?.error?.message || "Invalid or expired verification code.");
      } else {
        setDeleteError("Verification failed.");
      }
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleFinalDeleteAccount = async () => {
    setDeleteLoading(true);
    setDeleteError("");
    try {
      await apiDelete(`/users/me?ticket=${encodeURIComponent(deleteTicket)}`);
      localStorage.removeItem("bearer_token");
      localStorage.removeItem("auth_user");
      toast.success("Account deleted successfully.");
      router.push("/login");
    } catch (err) {
      if (isAxiosError(err)) {
        setDeleteError(err.response?.data?.error?.message || "Failed to delete account.");
      } else {
        setDeleteError("An unexpected error occurred.");
      }
    } finally {
      setDeleteLoading(false);
    }
  };

  const [locationName, setLocationName] = React.useState("");
  const [locationLat, setLocationLat] = React.useState<number | null>(null);
  const [locationLng, setLocationLng] = React.useState<number | null>(null);
  const [isLocationPrivate, setIsLocationPrivate] = React.useState(false);

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
      setLocationName(user.location?.place_name || user.location?.placeName || user.location?.name || "");
      setLocationLat(user.location?.latitude ?? null);
      setLocationLng(user.location?.longitude ?? null);
      setIsLocationPrivate(Boolean(user.is_location_private ?? user.isLocationPrivate));
    }
  }, [user, reset]);

  // Compute if location fields have changed
  const initialLocName = user?.location?.place_name || user?.location?.placeName || user?.location?.name || "";
  const initialLocLat = user?.location?.latitude ?? null;
  const initialLocLng = user?.location?.longitude ?? null;
  const initialLocPrivate = Boolean(user?.is_location_private ?? user?.isLocationPrivate);

  const isLocationDirty =
    locationName !== initialLocName ||
    locationLat !== initialLocLat ||
    locationLng !== initialLocLng ||
    isLocationPrivate !== initialLocPrivate;

  const isFormDirty = isDirty || isLocationDirty;

  // 3. Update Profile Mutation
  const updateProfileMutation = useMutation({
    mutationFn: (values: ProfileFormValues) => {
      const payload: {
        firstName?: string;
        lastName?: string;
        bio?: string;
        profilePictureUrl?: string;
        locationName?: string | null;
        latitude?: number | null;
        longitude?: number | null;
        isLocationPrivate?: boolean;
      } = {
        firstName: values.firstName?.trim() || undefined,
        lastName: values.lastName?.trim() || undefined,
        bio: values.bio?.trim() || undefined,
        profilePictureUrl: values.profilePictureUrl?.trim() || undefined,
        locationName: locationName.trim() ? locationName.trim() : null,
        latitude: locationLat ?? null,
        longitude: locationLng ?? null,
        isLocationPrivate: isLocationPrivate,
      };
      return apiPatch<UserProfileData>("/users/me", payload);
    },
    onSuccess: (updated) => {
      toast.success("Profile updated successfully!");
      queryClient.setQueryData(["currentUserProfile"], updated);
      queryClient.invalidateQueries({ queryKey: ["currentUser"] });
      try {
        const stored = localStorage.getItem("auth_user");
        if (stored) {
          const parsed = JSON.parse(stored);
          localStorage.setItem("auth_user", JSON.stringify({ ...parsed, ...updated }));
        }
      } catch {}
      reset({
        firstName: updated.first_name || "",
        lastName: updated.last_name || "",
        bio: updated.bio || "",
        profilePictureUrl: updated.profile_picture_url || "",
      });
      setLocationName(updated.location?.place_name || updated.location?.placeName || updated.location?.name || "");
      setLocationLat(updated.location?.latitude ?? null);
      setLocationLng(updated.location?.longitude ?? null);
      setIsLocationPrivate(Boolean(updated.is_location_private ?? updated.isLocationPrivate));
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

              {/* Permanent City / Location Pill */}
              {user.location && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <MapPin className="size-3.5 text-amber-500" />
                    City
                  </span>
                  <Badge variant="outline" className="font-mono text-[10px] px-2 py-0 flex items-center gap-1 border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/5">
                    {user.is_location_private && <Lock className="size-2.5 text-muted-foreground" />}
                    <span className="truncate max-w-[130px]">
                      {user.location.place_name || user.location.placeName || user.location.name}
                    </span>
                  </Badge>
                </div>
              )}

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
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] text-muted-foreground">
                      Direct link to an image (JPEG, PNG, WebP) hosted online.
                    </p>
                    {Boolean(watchedAvatarUrl?.trim()) && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-6 px-2 text-xs gap-1 cursor-pointer shrink-0"
                        onClick={() => setIsCropModalOpen(true)}
                      >
                        <Crop className="size-3" />
                        Crop Avatar
                      </Button>
                    )}
                  </div>
                </div>

                {/* Permanent City / Location */}
                <div className="space-y-1.5 pt-1">
                  <LocationInput
                    label="Current City / Location"
                    value={locationName}
                    latitude={locationLat}
                    longitude={locationLng}
                    placeholder="Search city, town or pick on map..."
                    hint="Your permanent city displayed on your profile."
                    disabled={updateProfileMutation.isPending}
                    onChangeLocation={(loc) => {
                      setLocationName(loc.name);
                      setLocationLat(loc.latitude);
                      setLocationLng(loc.longitude);
                    }}
                    showPrivacyToggle={true}
                    isPrivate={isLocationPrivate}
                    onPrivacyChange={setIsLocationPrivate}
                    privacyLabel="Keep my city private"
                    privacyHint="When turned on, your city is hidden from other members on your profile and the map."
                  />
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
                    disabled={updateProfileMutation.isPending || !isFormDirty}
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
                    Communities where you serve as Owner or Admin.
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
                              <CroppedImage
                                src={pic}
                                alt={comm.name}
                                fill
                                containerClassName="size-full rounded-none"
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
                                <span className="capitalize">
                                  {comm.role === "moderator" ? "Admin" : comm.role}
                                </span>
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

          {/* ── Account Settings: Security & Contact ──────────────────── */}
          <Card className="border-border/80 shadow-xs">
            <CardHeader className="pb-3 border-b border-border/40">
              <div className="flex items-center gap-2 text-primary">
                <Shield className="size-5" />
                <CardTitle className="text-base font-semibold text-foreground">
                  Account Settings
                </CardTitle>
              </div>
              <CardDescription className="text-xs text-muted-foreground">
                Manage phone verification, password credentials, and security settings.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              {/* Phone Setting Row */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-3.5 rounded-xl border border-border/70 bg-card hover:bg-muted/20 transition-colors">
                <div className="flex items-start sm:items-center gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary mt-0.5 sm:mt-0">
                    <Phone className="size-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-foreground">
                        {isPhoneConnected ? "Phone no Connected" : "Verify Phone"}
                      </h3>
                      {isPhoneConnected && (
                        <Badge
                          variant="secondary"
                          className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px] gap-1 font-normal py-0"
                        >
                          <CheckCircle2 className="size-2.5" />
                          Verified
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {isPhoneConnected ? "Edit Phone number" : "Add a phone number"}
                    </p>
                    {isPhoneConnected && user?.phone_number && (
                      <p className="text-xs font-mono text-foreground/80 mt-1">
                        {user.phone_number}
                      </p>
                    )}
                  </div>
                </div>

                <Button
                  type="button"
                  variant={isPhoneConnected ? "outline" : "default"}
                  size="sm"
                  onClick={handleOpenPhoneModal}
                  className="shrink-0 cursor-pointer self-start sm:self-center text-xs"
                >
                  {isPhoneConnected ? "Edit Phone number" : "Add Phone number"}
                </Button>
              </div>

              {/* Password Setting Row */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-3.5 rounded-xl border border-border/70 bg-card hover:bg-muted/20 transition-colors">
                <div className="flex items-start sm:items-center gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary mt-0.5 sm:mt-0">
                    <KeyRound className="size-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">
                      Password
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Ensure your account remains safe with an identity-verified password.
                    </p>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleOpenPasswordModal}
                  className="shrink-0 cursor-pointer self-start sm:self-center gap-1.5 text-xs"
                >
                  <Lock className="size-3.5" />
                  Change Password
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* ── Danger Zone: Delete Account ───────────────────────────── */}
          <Card className="border-destructive/30 bg-destructive/5 shadow-xs">
            <CardHeader className="pb-3 border-b border-destructive/20">
              <CardTitle className="text-base font-semibold text-destructive flex items-center gap-2">
                <AlertTriangle className="size-4" />
                Danger Zone
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Permanently delete your account and all associated data. This action cannot be undone.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleOpenDeleteModal}
                className="gap-1.5 cursor-pointer text-xs"
              >
                <Trash2 className="size-3.5" />
                Delete My Account
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Dialog 1: Phone Verification ────────────────────────────── */}
      <Dialog open={isPhoneModalOpen} onOpenChange={setIsPhoneModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-center sm:text-left">
              <Phone className="size-4 text-primary" />
              {phoneStep === "phone"
                ? isPhoneConnected
                  ? "Edit Phone Number"
                  : "Verify Phone Number"
                : "Enter Verification Code"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {phoneStep === "phone"
                ? "Enter your new phone number below. We will send a 6-digit SMS verification code."
                : `We sent a 6-digit SMS code to ${phoneNumberInput}. Enter it below to confirm.`}
            </DialogDescription>
          </DialogHeader>

          {phoneError ? (
            <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-2.5 text-xs text-destructive">
              <AlertTriangle className="size-4 shrink-0" />
              <span>{phoneError}</span>
            </div>
          ) : null}

          {phoneStep === "phone" ? (
            <form onSubmit={handleSendPhoneOtp} className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="admin-phone-input" className="text-xs font-medium">
                  Phone Number
                </Label>
                <PhoneInput
                  id="admin-phone-input"
                  value={phoneNumberInput}
                  onChange={(val) => {
                    setPhoneNumberInput(val);
                    setPhoneError("");
                  }}
                  disabled={phoneLoading}
                />
                <p className="text-[11px] text-muted-foreground">
                  Your current phone number will remain preserved unless the new number is properly verified.
                </p>
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsPhoneModalOpen(false)}
                  disabled={phoneLoading}
                  className="cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={phoneLoading || !phoneNumberInput}
                  className="gap-1.5 cursor-pointer"
                >
                  {phoneLoading ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      Sending SMS...
                    </>
                  ) : (
                    <>
                      Send Code
                      <ArrowRight className="size-3.5" />
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          ) : (
            <form onSubmit={handleConfirmPhoneOtp} className="space-y-4 py-2">
              <div className="space-y-2 text-center">
                <Label className="text-xs font-medium">
                  6-Digit Verification Code
                </Label>
                <SixDigitOtpBoxes
                  value={phoneOtp}
                  onChange={(val) => {
                    setPhoneOtp(val);
                    setPhoneError("");
                  }}
                  disabled={phoneLoading}
                />
                <div className="flex items-center justify-between text-xs pt-1 px-1">
                  <button
                    type="button"
                    onClick={() => {
                      setPhoneStep("phone");
                      setPhoneError("");
                    }}
                    disabled={phoneLoading}
                    className="text-muted-foreground hover:text-foreground underline cursor-pointer"
                  >
                    Change Number
                  </button>
                  <button
                    type="button"
                    onClick={handleSendPhoneOtp}
                    disabled={phoneLoading}
                    className="text-primary hover:underline font-medium cursor-pointer"
                  >
                    Resend Code
                  </button>
                </div>
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsPhoneModalOpen(false)}
                  disabled={phoneLoading}
                  className="cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={phoneLoading || phoneOtp.join("").length !== 6}
                  className="gap-1.5 cursor-pointer"
                >
                  {phoneLoading ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="size-3.5" />
                      Verify & Save
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Dialog 2: Change Password ───────────────────────────────── */}
      <Dialog open={isPasswordModalOpen} onOpenChange={setIsPasswordModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center font-bold text-base sm:text-lg">
              {passStep === "new-password" ? "Set New Password" : "Change Password"}
            </DialogTitle>
            <DialogDescription className="text-center text-xs">
              {passStep === "method" &&
                "For your security, verify your identity via SMS or Email before updating your password."}
              {passStep === "otp" &&
                `We sent a 6-digit security code via ${passMethod === "email" ? "Email" : "SMS"}. Enter it below.`}
              {passStep === "new-password" &&
                "Identity verified. Enter your new password below."}
            </DialogDescription>
          </DialogHeader>

          {passError ? (
            <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-2.5 text-xs text-destructive">
              <AlertTriangle className="size-4 shrink-0" />
              <span>{passError}</span>
            </div>
          ) : null}

          {passStep === "method" && (
            <form onSubmit={handleSendPassCode} className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Verification Method</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPassMethod("email");
                      setPassIdentifier(user?.email || "");
                      setPassError("");
                    }}
                    className={`flex items-center justify-center gap-2 p-2.5 rounded-lg border text-xs font-medium transition-all ${
                      passMethod === "email"
                        ? "border-primary bg-primary/10 text-primary font-semibold"
                        : "border-border hover:bg-muted/50 text-muted-foreground"
                    }`}
                  >
                    <Mail className="size-3.5" />
                    Email
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPassMethod("phone");
                      setPassIdentifier(user?.phone_number || "");
                      setPassError("");
                    }}
                    className={`flex items-center justify-center gap-2 p-2.5 rounded-lg border text-xs font-medium transition-all ${
                      passMethod === "phone"
                        ? "border-primary bg-primary/10 text-primary font-semibold"
                        : "border-border hover:bg-muted/50 text-muted-foreground"
                    }`}
                  >
                    <Phone className="size-3.5" />
                    Phone (SMS)
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pass-ident" className="text-xs font-medium">
                  {passMethod === "email" ? "Account Email Address" : "Account Phone Number"}
                </Label>
                <Input
                  id="pass-ident"
                  type={passMethod === "email" ? "email" : "tel"}
                  value={passIdentifier}
                  onChange={(e) => {
                    setPassIdentifier(e.target.value);
                    setPassError("");
                  }}
                  placeholder={
                    passMethod === "email"
                      ? "Enter your registered email"
                      : "Enter your registered phone (e.g. 0911223344)"
                  }
                  disabled={passLoading}
                  className="h-10 text-sm"
                  required
                />
                <p className="text-[11px] text-muted-foreground">
                  Confirm your registered credential to receive the security code.
                </p>
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsPasswordModalOpen(false)}
                  disabled={passLoading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={passLoading || !passIdentifier.trim()}
                  className="gap-1.5"
                >
                  {passLoading ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      Sending Code...
                    </>
                  ) : (
                    <>
                      Send Code
                      <ArrowRight className="size-3.5" />
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          )}

          {passStep === "otp" && (
            <form onSubmit={handleVerifyPassOtp} className="space-y-4 py-2">
              <div className="space-y-2 text-center">
                <Label className="text-xs font-medium">
                  6-Digit Verification Code
                </Label>
                <SixDigitOtpBoxes
                  value={passOtp}
                  onChange={(val) => {
                    setPassOtp(val);
                    setPassError("");
                  }}
                  disabled={passLoading}
                />
                <div className="flex items-center justify-between text-xs pt-1 px-1">
                  <button
                    type="button"
                    onClick={() => {
                      setPassStep("method");
                      setPassError("");
                    }}
                    disabled={passLoading}
                    className="text-muted-foreground hover:text-foreground underline cursor-pointer"
                  >
                    Change Method
                  </button>
                  <button
                    type="button"
                    onClick={handleSendPassCode}
                    disabled={passLoading}
                    className="text-primary hover:underline font-medium cursor-pointer"
                  >
                    Resend Code
                  </button>
                </div>
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsPasswordModalOpen(false)}
                  disabled={passLoading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={passLoading || passOtp.join("").length !== 6}
                  className="gap-1.5"
                >
                  {passLoading ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="size-3.5" />
                      Verify Code
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          )}

          {passStep === "new-password" && (
            <form onSubmit={handleSaveNewPassword} className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="new-pass-input" className="text-xs font-medium">
                  New Password
                </Label>
                <div className="relative">
                  <Input
                    id="new-pass-input"
                    type={showNewPass ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      setPassError("");
                    }}
                    placeholder="Minimum 8 characters"
                    disabled={passLoading}
                    className="h-10 pr-9 text-sm"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPass(!showNewPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showNewPass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirm-pass-input" className="text-xs font-medium">
                  Confirm New Password
                </Label>
                <Input
                  id="confirm-pass-input"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setPassError("");
                  }}
                  placeholder="Re-enter new password"
                  disabled={passLoading}
                  className="h-10 text-sm"
                  required
                />
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsPasswordModalOpen(false)}
                  disabled={passLoading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={passLoading || !newPassword || newPassword !== confirmPassword}
                  className="gap-1.5"
                >
                  {passLoading ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="size-3.5" />
                      Save New Password
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Dialog 3: Delete Account ────────────────────────────────── */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center font-bold text-base sm:text-lg text-destructive">
              Delete Account Verification
            </DialogTitle>
            <DialogDescription className="text-center text-xs">
              {deleteStep === "method" &&
                "For your security, identity verification is required before permanently deleting your account."}
              {deleteStep === "otp" &&
                `We sent a 6-digit confirmation code via ${deleteMethod === "email" ? "Email" : "SMS"}. Enter it below.`}
              {deleteStep === "confirm" &&
                "Final Step: Confirmation to permanently delete your account."}
            </DialogDescription>
          </DialogHeader>

          {deleteError ? (
            <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-2.5 text-xs text-destructive">
              <AlertTriangle className="size-4 shrink-0" />
              <span>{deleteError}</span>
            </div>
          ) : null}

          {deleteStep === "method" && (
            <form onSubmit={handleSendDeleteCode} className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Verification Method</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteMethod("email");
                      setDeleteIdentifier(user?.email || "");
                      setDeleteError("");
                    }}
                    className={`flex items-center justify-center gap-2 p-2.5 rounded-lg border text-xs font-medium transition-all ${
                      deleteMethod === "email"
                        ? "border-destructive bg-destructive/10 text-destructive font-semibold"
                        : "border-border hover:bg-muted/50 text-muted-foreground"
                    }`}
                  >
                    <Mail className="size-3.5" />
                    Email
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteMethod("phone");
                      setDeleteIdentifier(user?.phone_number || "");
                      setDeleteError("");
                    }}
                    className={`flex items-center justify-center gap-2 p-2.5 rounded-lg border text-xs font-medium transition-all ${
                      deleteMethod === "phone"
                        ? "border-destructive bg-destructive/10 text-destructive font-semibold"
                        : "border-border hover:bg-muted/50 text-muted-foreground"
                    }`}
                  >
                    <Phone className="size-3.5" />
                    Phone (SMS)
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="del-ident" className="text-xs font-medium">
                  {deleteMethod === "email" ? "Account Email Address" : "Account Phone Number"}
                </Label>
                <Input
                  id="del-ident"
                  type={deleteMethod === "email" ? "email" : "tel"}
                  value={deleteIdentifier}
                  onChange={(e) => {
                    setDeleteIdentifier(e.target.value);
                    setDeleteError("");
                  }}
                  placeholder={
                    deleteMethod === "email"
                      ? "Enter your registered email"
                      : "Enter your registered phone (e.g. 0911223344)"
                  }
                  disabled={deleteLoading}
                  className="h-10 text-sm"
                  required
                />
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsDeleteModalOpen(false)}
                  disabled={deleteLoading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="destructive"
                  size="sm"
                  disabled={deleteLoading || !deleteIdentifier.trim()}
                  className="gap-1.5"
                >
                  {deleteLoading ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      Sending Code...
                    </>
                  ) : (
                    <>
                      Send Code
                      <ArrowRight className="size-3.5" />
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          )}

          {deleteStep === "otp" && (
            <form onSubmit={handleVerifyDeleteOtp} className="space-y-4 py-2">
              <div className="space-y-2 text-center">
                <Label className="text-xs font-medium">
                  6-Digit Verification Code
                </Label>
                <SixDigitOtpBoxes
                  value={deleteOtp}
                  onChange={(val) => {
                    setDeleteOtp(val);
                    setDeleteError("");
                  }}
                  disabled={deleteLoading}
                />
                <div className="flex items-center justify-between text-xs pt-1 px-1">
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteStep("method");
                      setDeleteError("");
                    }}
                    disabled={deleteLoading}
                    className="text-muted-foreground hover:text-foreground underline cursor-pointer"
                  >
                    Change Method
                  </button>
                  <button
                    type="button"
                    onClick={handleSendDeleteCode}
                    disabled={deleteLoading}
                    className="text-primary hover:underline font-medium cursor-pointer"
                  >
                    Resend Code
                  </button>
                </div>
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsDeleteModalOpen(false)}
                  disabled={deleteLoading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="destructive"
                  size="sm"
                  disabled={deleteLoading || deleteOtp.join("").length !== 6}
                  className="gap-1.5"
                >
                  {deleteLoading ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="size-3.5" />
                      Verify Code
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          )}

          {deleteStep === "confirm" && (
            <div className="space-y-4 py-2">
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-xs space-y-2 text-destructive">
                <p className="font-semibold text-sm flex items-center gap-1.5">
                  <AlertTriangle className="size-4" />
                  Are you absolutely certain?
                </p>
                <p className="text-foreground/90 leading-relaxed">
                  This will permanently delete your account, wipe all your posts, revoke access to all communities you manage, and release your username.
                </p>
                <p className="font-bold text-destructive">This action cannot be undone.</p>
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsDeleteModalOpen(false)}
                  disabled={deleteLoading}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={handleFinalDeleteAccount}
                  disabled={deleteLoading}
                  className="gap-1.5"
                >
                  {deleteLoading ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      Deleting Account...
                    </>
                  ) : (
                    <>
                      <Trash2 className="size-3.5" />
                      Permanently Delete Account
                    </>
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {Boolean(watchedAvatarUrl?.trim()) && (
        <ImageCropModal
          open={isCropModalOpen}
          onOpenChange={setIsCropModalOpen}
          imageUrl={watchedAvatarUrl!.trim()}
          cropShape="circle"
          targetRatio={1}
          onConfirm={(croppedUrl) => {
            setValue("profilePictureUrl", croppedUrl, { shouldDirty: true });
            setIsCropModalOpen(false);
          }}
        />
      )}
    </div>
  );
}
