"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { isAxiosError } from "axios";
import { Loader2, ShieldCheck, RotateCcw } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function VerifyPhoneContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const phone = searchParams.get("phone") || "";

  const [otp, setOtp] = React.useState<string[]>(Array(6).fill(""));
  const [isLoading, setIsLoading] = React.useState(false);
  const [isResending, setIsResending] = React.useState(false);
  const [countdown, setCountdown] = React.useState(60);
  const inputRefs = React.useRef<(HTMLInputElement | null)[]>([]);

  const isDev = process.env.NODE_ENV === "development";

  // Countdown timer for resend
  React.useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  // Auto-focus first input
  React.useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  // If no phone param, redirect back
  React.useEffect(() => {
    if (!phone) {
      toast.error("No phone number provided.");
      router.replace("/register");
    }
  }, [phone, router]);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);

    // Auto-advance to next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits filled
    if (newOtp.every((d) => d.length === 1)) {
      handleVerify(newOtp.join(""));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 0) return;

    const newOtp = [...otp];
    for (let i = 0; i < pasted.length && i < 6; i++) {
      newOtp[i] = pasted[i];
    }
    setOtp(newOtp);

    const nextIndex = Math.min(pasted.length, 5);
    inputRefs.current[nextIndex]?.focus();

    if (newOtp.every((d) => d.length === 1)) {
      handleVerify(newOtp.join(""));
    }
  };

  const handleDevFill = () => {
    const devOtp = ["1", "2", "3", "4", "5", "6"];
    setOtp(devOtp);
    handleVerify("123456");
  };

  const handleVerify = async (code: string) => {
    if (isLoading) return;
    setIsLoading(true);

    try {
      const token = localStorage.getItem("bearer_token");
      await apiPost("/auth/verify-phone/confirm", {
        phoneNumber: phone,
        otp: code,
      }, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      toast.success("Phone number verified successfully!");
      router.push("/");
    } catch (error) {
      if (isAxiosError(error)) {
        const msg = error.response?.data?.error?.message || "Invalid or expired OTP code.";
        toast.error(msg);
      } else {
        toast.error("Verification failed. Please try again.");
      }
      // Clear OTP inputs
      setOtp(Array(6).fill(""));
      inputRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0 || isResending) return;
    setIsResending(true);

    try {
      await apiPost("/auth/verify-phone", { phoneNumber: phone });
      toast.success("A new OTP has been sent.");
      setCountdown(60);
      setOtp(Array(6).fill(""));
      inputRefs.current[0]?.focus();
    } catch {
      toast.error("Failed to resend OTP.");
    } finally {
      setIsResending(false);
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
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20 ring-4 ring-primary/10">
            <ShieldCheck className="size-6" />
          </div>
          <div className="space-y-1">
            <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
              Verify Your Phone
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              Enter the 6-digit code sent to{" "}
              <span className="font-mono font-medium text-foreground">{phone}</span>
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Dev Mode Quick Fill */}
          {isDev && (
            <button
              type="button"
              onClick={handleDevFill}
              className="mx-auto flex items-center gap-1.5 rounded-full bg-amber-500/15 px-4 py-1.5 text-xs font-medium text-amber-600 transition-colors hover:bg-amber-500/25"
            >
              🧑‍💻 Dev Mode — Quick Fill (123456)
            </button>
          )}

          {/* OTP Input Boxes */}
          <div className="flex justify-center gap-2.5" onPaste={handlePaste}>
            {otp.map((digit, index) => (
              <Input
                key={index}
                ref={(el) => { inputRefs.current[index] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                disabled={isLoading}
                className="h-12 w-12 rounded-lg border-border/80 text-center text-lg font-bold focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            ))}
          </div>

          {/* Resend */}
          <div className="text-center">
            {countdown > 0 ? (
              <p className="text-xs text-muted-foreground">
                Resend code in{" "}
                <span className="font-mono font-medium text-foreground">{countdown}s</span>
              </p>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleResend}
                disabled={isResending}
                className="text-xs text-primary hover:text-primary/80"
              >
                {isResending ? (
                  <>
                    <Loader2 className="mr-1.5 size-3 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <RotateCcw className="mr-1.5 size-3" />
                    Resend Code
                  </>
                )}
              </Button>
            )}
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-3.5 pt-2">
          <Button
            type="button"
            onClick={() => handleVerify(otp.join(""))}
            className="h-10 w-full rounded-lg font-medium shadow-md shadow-primary/15 transition-all hover:shadow-lg hover:shadow-primary/25 cursor-pointer"
            disabled={isLoading || otp.some((d) => d.length === 0)}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Verifying...
              </>
            ) : (
              "Verify Phone Number"
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

export default function VerifyPhonePage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen w-full flex items-center justify-center bg-background">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      }
    >
      <VerifyPhoneContent />
    </React.Suspense>
  );
}
