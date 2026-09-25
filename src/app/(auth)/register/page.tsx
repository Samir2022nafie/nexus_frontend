"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { isAxiosError } from "axios";
import { Loader2, Mail, Phone, Lock, User, Calendar, ChevronDown, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

import { apiPost } from "@/lib/api-client";
import { NexusLogo } from "@/components/ui/nexus-logo";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { PhoneInput } from "@/components/ui/phone-input";
import { DateTimePicker } from "@/components/ui/datetime-picker";

// ─── Date Picker Helpers ─────────────────────────────────────────────────────
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function getDaysInMonth(month: number, year: number): number {
  return new Date(year, month + 1, 0).getDate();
}

const currentYear = new Date().getFullYear();
const minYear = currentYear - 120;
const maxYear = currentYear - 13;

const registerSchema = z
  .object({
    username: z
      .string()
      .min(3, "Username must be at least 3 characters")
      .max(30, "Username cannot exceed 30 characters")
      .regex(
        /^[a-zA-Z0-9_]+$/,
        "Username can only contain letters, numbers, and underscores"
      ),
    firstName: z.string().min(1, "First name is required").trim(),
    lastName: z.string().optional().or(z.literal("")),
    authMethod: z.enum(["email", "phone"]),
    email: z.string().email("Invalid email address").optional().or(z.literal("")),
    phoneNumber: z
      .string()
      .optional()
      .or(z.literal("")),
    birthDate: z
      .string()
      .min(1, "Birth date is required")
      .refine((val) => {
        if (!val) return false;
        const birth = new Date(val);
        if (isNaN(birth.getTime())) return false;
        const today = new Date();
        const age = today.getFullYear() - birth.getFullYear();
        const monthDiff = today.getMonth() - birth.getMonth();
        const dayDiff = today.getDate() - birth.getDate();
        const calculatedAge =
          monthDiff < 0 || (monthDiff === 0 && dayDiff < 0) ? age - 1 : age;
        return calculatedAge >= 13;
      }, "You must be at least 13 years old"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .superRefine((data, ctx) => {
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Passwords do not match",
        path: ["confirmPassword"],
      });
    }

    if (data.authMethod === "email" && (!data.email || data.email.trim().length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Email is required",
        path: ["email"],
      });
    }

    if (data.authMethod === "phone" && (!data.phoneNumber || data.phoneNumber.trim().length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Phone number is required",
        path: ["phoneNumber"],
      });
    }
  });

type RegisterFormValues = z.infer<typeof registerSchema>;

interface RegisterResponseData {
  user: {
    id: string;
    username: string;
    email?: string | null;
    phone_number?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    name?: string | null;
    trust_score?: number;
  };
  token: string;
}

export default function RegisterPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = React.useState(false);
  const [authMethod, setAuthMethod] = React.useState<"email" | "phone">("email");
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);

  // Birth date picker state
  const [birthMonth, setBirthMonth] = React.useState<number>(-1);
  const [birthDay, setBirthDay] = React.useState<number>(-1);
  const [birthYear, setBirthYear] = React.useState<number>(-1);

  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      firstName: "",
      lastName: "",
      authMethod: "email",
      email: "",
      phoneNumber: "",
      birthDate: "",
      password: "",
      confirmPassword: "",
    },
  });

  // If already authenticated, redirect to /
  React.useEffect(() => {
    const token = localStorage.getItem("bearer_token");
    if (token) {
      router.replace("/");
    }
  }, [router]);

  // Sync birth date dropdowns → form value
  React.useEffect(() => {
    if (birthMonth >= 0 && birthDay > 0 && birthYear > 0) {
      const m = String(birthMonth + 1).padStart(2, "0");
      const d = String(birthDay).padStart(2, "0");
      setValue("birthDate", `${birthYear}-${m}-${d}`);
    }
  }, [birthMonth, birthDay, birthYear, setValue]);

  const daysInSelectedMonth = birthMonth >= 0 && birthYear > 0
    ? getDaysInMonth(birthMonth, birthYear)
    : 31;

  const handleMethodChange = (method: "email" | "phone") => {
    setAuthMethod(method);
    setValue("authMethod", method);
  };

  const onSubmit = async (values: RegisterFormValues) => {
    setIsLoading(true);
    try {
      const payload: {
        username: string;
        firstName: string;
        lastName?: string;
        birthDate: string;
        password: string;
        email?: string;
        phoneNumber?: string;
      } = {
        username: values.username.trim(),
        firstName: values.firstName.trim(),
        birthDate: values.birthDate,
        password: values.password,
      };

      if (values.lastName && values.lastName.trim().length > 0) {
        payload.lastName = values.lastName.trim();
      }

      if (values.authMethod === "email" && values.email) {
        payload.email = values.email.trim();
      } else if (values.authMethod === "phone" && values.phoneNumber) {
        payload.phoneNumber = values.phoneNumber.trim();
      }

      const response = await apiPost<RegisterResponseData>(
        "/auth/register",
        payload
      );

      if (response && response.token) {
        localStorage.setItem("bearer_token", response.token);
        if (response.user) {
          localStorage.setItem("auth_user", JSON.stringify(response.user));
        }

        // If registered with phone → forward to verification
        if (values.authMethod === "phone" && values.phoneNumber) {
          toast.success("Account created! Please verify your phone number.");
          router.push(`/verify-phone?phone=${encodeURIComponent(values.phoneNumber.trim())}`);
        } else {
          toast.success("Account created successfully! Welcome to Nexus.");
          router.push("/");
        }
      } else {
        toast.error("Account created, but failed to retrieve session token.");
      }
    } catch (error) {
      if (isAxiosError(error)) {
        const errorData = error.response?.data?.error;
        if (error.response?.status === 409) {
          toast.error(
            errorData?.message ||
              "An account with this username, email, or phone already exists."
          );
        } else if (errorData?.details && Array.isArray(errorData.details)) {
          const detailMsg = errorData.details
            .map((d: { message?: string }) => d.message)
            .filter(Boolean)
            .join(", ");
          toast.error(detailMsg || errorData.message || "Validation failed.");
        } else if (errorData?.message) {
          toast.error(errorData.message);
        } else {
          toast.error("Registration failed. Please check your details.");
        }
      } else {
        toast.error("An unexpected error occurred.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-background p-4 sm:p-8">
      {/* Ambient background glow */}
      <div className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center">
        <div className="h-[500px] w-[500px] rounded-full bg-primary/5 blur-[120px]" />
      </div>

      <Card className="w-full max-w-lg border-border/70 bg-card/95 shadow-2xl shadow-foreground/5 backdrop-blur-sm sm:rounded-2xl my-6">
        <CardHeader className="space-y-3 pb-6 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20 ring-4 ring-primary/10 p-2.5">
            <NexusLogo className="w-full h-full" />
          </div>
          <div className="space-y-1">
            <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
              Create an Account
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              Join Nexus to explore, manage, and engage with communities.
            </CardDescription>
          </div>
        </CardHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            {/* First & Last Name */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <Label htmlFor="firstName" className="text-sm font-medium text-foreground">
                  First Name
                </Label>
                <div className="relative">
                  <Input
                    id="firstName"
                    type="text"
                    placeholder="John"
                    disabled={isLoading}
                    className="h-10 rounded-lg border-border/80"
                    {...register("firstName")}
                  />
                  <User className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                </div>
                {errors.firstName && (
                  <p className="text-xs font-medium text-destructive">
                    {errors.firstName.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="lastName" className="text-sm font-medium text-foreground">
                  Last Name <span className="text-xs font-normal text-muted-foreground">(Optional)</span>
                </Label>
                <div className="relative">
                  <Input
                    id="lastName"
                    type="text"
                    placeholder="Doe"
                    disabled={isLoading}
                    className="h-10 rounded-lg border-border/80"
                    {...register("lastName")}
                  />
                  <User className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                </div>
                {errors.lastName && (
                  <p className="text-xs font-medium text-destructive">
                    {errors.lastName.message}
                  </p>
                )}
              </div>
            </div>

            {/* Username */}
            <div className="space-y-1.5">
              <Label htmlFor="username" className="text-sm font-medium text-foreground">
                Username
              </Label>
              <div className="relative">
                <Input
                  id="username"
                  type="text"
                  placeholder="johndoe"
                  autoComplete="username"
                  disabled={isLoading}
                  className="h-10 rounded-lg border-border/80"
                  {...register("username")}
                />
                <User className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
              </div>
              {errors.username && (
                <p className="text-xs font-medium text-destructive">
                  {errors.username.message}
                </p>
              )}
            </div>

            {/* Auth Method Toggle */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground">Contact Method</Label>
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-muted/70 rounded-xl border border-border/50">
                <button
                  type="button"
                  onClick={() => handleMethodChange("email")}
                  className={`flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-lg transition-all ${
                    authMethod === "email"
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Mail className="size-3.5" />
                  Email
                </button>
                <button
                  type="button"
                  onClick={() => handleMethodChange("phone")}
                  className={`flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-lg transition-all ${
                    authMethod === "phone"
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Phone className="size-3.5" />
                  Phone Number
                </button>
              </div>
            </div>

            {/* Email or Phone Input */}
            {authMethod === "email" ? (
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm font-medium text-foreground">
                  Email Address
                </Label>
                <div className="relative">
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    disabled={isLoading}
                    className="h-10 rounded-lg border-border/80"
                    {...register("email")}
                  />
                  <Mail className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                </div>
                {errors.email && (
                  <p className="text-xs font-medium text-destructive">
                    {errors.email.message}
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="phoneNumber" className="text-sm font-medium text-foreground">
                  Phone Number
                </Label>
                <Controller
                  name="phoneNumber"
                  control={control}
                  render={({ field }) => (
                    <PhoneInput
                      id="phoneNumber"
                      value={field.value}
                      onChange={field.onChange}
                      disabled={isLoading}
                      error={!!errors.phoneNumber}
                    />
                  )}
                />
                <p className="text-[11px] text-muted-foreground">
                  Enter your number in any format — 0911223344, 911223344, or +251911223344
                </p>
                {errors.phoneNumber && (
                  <p className="text-xs font-medium text-destructive">
                    {errors.phoneNumber.message}
                  </p>
                )}
              </div>
            )}

            {/* Birth Date — Specialized Selector with Done Button inside */}
            <div className="space-y-1.5">
              <Label htmlFor="register-birthDate" className="text-sm font-medium text-foreground">
                Date of Birth
              </Label>
              <Controller
                control={control}
                name="birthDate"
                render={({ field }) => (
                  <DateTimePicker
                    id="register-birthDate"
                    value={field.value}
                    onChange={(val) => {
                      field.onChange(val);
                      setValue("birthDate", val, { shouldValidate: true });
                    }}
                    dateOnly
                    placeholder="Select your date of birth"
                    disabled={isLoading}
                  />
                )}
              />
              <p className="text-[11px] text-muted-foreground">
                You must be at least 13 years old to use Nexus.
              </p>
              {errors.birthDate && (
                <p className="text-xs font-medium text-destructive">
                  {errors.birthDate.message}
                </p>
              )}
            </div>

            {/* Password & Confirm Password */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-sm font-medium text-foreground">
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    disabled={isLoading}
                    className="h-10 pr-10 rounded-lg border-border/80 focus-visible:ring-2 focus-visible:ring-primary/30"
                    {...register("password")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs font-medium text-destructive">
                    {errors.password.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword" className="text-sm font-medium text-foreground">
                  Confirm Password
                </Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    autoComplete="new-password"
                    disabled={isLoading}
                    className="h-10 pr-10 rounded-lg border-border/80 focus-visible:ring-2 focus-visible:ring-primary/30"
                    {...register("confirmPassword")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                  >
                    {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="text-xs font-medium text-destructive">
                    {errors.confirmPassword.message}
                  </p>
                )}
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-3.5 pt-4">
            <Button
              type="submit"
              className="h-10 w-full rounded-lg font-medium shadow-md shadow-primary/15 transition-all hover:shadow-lg hover:shadow-primary/25 cursor-pointer"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Creating account...
                </>
              ) : (
                "Create Account"
              )}
            </Button>

            <div className="text-center text-xs text-muted-foreground">
              Already have an account?{" "}
              <Link
                href="/login"
                className="font-medium text-primary hover:underline underline-offset-4"
              >
                Sign In
              </Link>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
