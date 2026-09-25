"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { isAxiosError } from "axios";
import { Loader2, UserCheck, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

import { apiPost } from "@/lib/api-client";
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
import { NexusLogo } from "@/components/ui/nexus-logo";

const loginSchema = z.object({
  identifier: z
    .string()
    .min(1, "Email, phone number, or username is required")
    .trim(),
  password: z
    .string()
    .min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

interface LoginResponseData {
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

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      identifier: "",
      password: "",
    },
  });

  // If already authenticated, redirect to /
  React.useEffect(() => {
    const token = localStorage.getItem("bearer_token");
    if (token) {
      router.replace("/");
    }
  }, [router]);

  const onSubmit = async (values: LoginFormValues) => {
    setIsLoading(true);
    try {
      const response = await apiPost<LoginResponseData>("/auth/login", {
        identifier: values.identifier,
        password: values.password,
      });

      if (response && response.token) {
        localStorage.setItem("bearer_token", response.token);
        if (response.user) {
          localStorage.setItem("auth_user", JSON.stringify(response.user));
        }
        toast.success("Signed in successfully!");
        router.push("/");
      } else {
        toast.error("Failed to authenticate with server");
      }
    } catch (error) {
      if (isAxiosError(error)) {
        if (error.response?.status === 401) {
          toast.error("Invalid credentials");
        } else if (error.response?.data?.error?.message) {
          toast.error(error.response.data.error.message);
        } else {
          toast.error("Sign in failed. Please check your connection.");
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

      <Card className="w-full max-w-md border-border/70 bg-card/95 shadow-2xl shadow-foreground/5 backdrop-blur-sm sm:rounded-2xl">
        <CardHeader className="space-y-3 pb-6 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20 ring-4 ring-primary/10 p-2.5">
            <NexusLogo className="w-full h-full" />
          </div>
          <div className="space-y-1">
            <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
              Nexus Admin
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              Sign in to manage your communities, events, and moderation.
            </CardDescription>
          </div>
        </CardHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            {/* Identifier Field (Email, Phone, or Username) */}
            <div className="space-y-1.5">
              <Label htmlFor="identifier" className="text-sm font-medium text-foreground">
                Email, Phone, or Username
              </Label>
              <div className="relative">
                <Input
                  id="identifier"
                  type="text"
                  autoComplete="username"
                  disabled={isLoading}
                  className="h-10 pr-10 rounded-lg border-border/80 focus-visible:ring-2 focus-visible:ring-primary/30"
                  {...register("identifier")}
                />
                <UserCheck className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
              </div>
              {errors.identifier && (
                <p className="text-xs font-medium text-destructive">
                  {errors.identifier.message}
                </p>
              )}
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm font-medium text-foreground">
                  Password
                </Label>
                <Link
                  href="/forgot-password"
                  className="text-xs font-medium text-primary hover:underline underline-offset-4"
                >
                  Forgot Password?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
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
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </Button>
            <div className="text-center text-xs text-muted-foreground">
              Don&apos;t have an account?{" "}
              <Link
                href="/register"
                className="font-medium text-primary hover:underline underline-offset-4"
              >
                Register
              </Link>
            </div>
            <p className="text-center text-[11px] text-muted-foreground/80">
              Authorized community owners, admins, and moderators only.
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
