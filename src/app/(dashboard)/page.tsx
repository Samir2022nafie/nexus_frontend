"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Building2, ArrowRight, Users, Shield, Crown, Sparkles } from "lucide-react";
import { apiGet } from "@/lib/api-client";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface ManagedCommunity {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  bannerUrl?: string | null;
  profilePictureUrl?: string | null;
  isPrivate?: boolean;
  memberCount?: number;
  role: "owner" | "admin" | "moderator";
}

export default function DashboardHomePage() {
  const { data: communities, isLoading } = useQuery<ManagedCommunity[]>({
    queryKey: ["managedCommunities"],
    queryFn: () => apiGet<ManagedCommunity[]>("/users/me/communities"),
  });

  const getRoleBadge = (role: "owner" | "admin" | "moderator") => {
    switch (role) {
      case "owner":
        return (
          <Badge variant="default" className="gap-1 bg-amber-500/15 text-amber-600 hover:bg-amber-500/20 border-amber-500/30 dark:text-amber-400 font-mono text-[10px] uppercase font-semibold">
            <Crown className="size-3" />
            Owner
          </Badge>
        );
      case "admin":
        return (
          <Badge variant="default" className="gap-1 bg-sky-500/15 text-sky-600 hover:bg-sky-500/20 border-sky-500/30 dark:text-sky-400 font-mono text-[10px] uppercase font-semibold">
            <Shield className="size-3" />
            Admin
          </Badge>
        );
      case "moderator":
        return (
          <Badge variant="default" className="gap-1 bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/20 border-emerald-500/30 dark:text-emerald-400 font-mono text-[10px] uppercase font-semibold">
            <Shield className="size-3" />
            Moderator
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Admin Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your communities, monitor activity, review reports, and oversee community members.
          </p>
        </div>
        {communities && communities.length > 0 && (
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="px-3 py-1 text-xs font-medium">
              <Sparkles className="mr-1.5 size-3 text-primary" />
              {communities.length} {communities.length === 1 ? "Community" : "Communities"} Managed
            </Badge>
          </div>
        )}
      </div>

      {/* Communities Grid Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            My Managed Communities
          </h2>
        </div>

        {isLoading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-5 space-y-4 border-border/70">
                <div className="flex items-center gap-3">
                  <Skeleton className="size-11 rounded-xl" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                </div>
                <Skeleton className="h-10 w-full rounded-lg" />
                <div className="flex justify-between items-center pt-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-8 w-24 rounded-lg" />
                </div>
              </Card>
            ))}
          </div>
        ) : communities && communities.length > 0 ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {communities.map((community) => (
              <Card
                key={community.id}
                className="group flex flex-col justify-between border-border/70 bg-card transition-all duration-200 hover:border-border hover:shadow-xl hover:shadow-foreground/5 hover:-translate-y-0.5"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar size="lg" className="rounded-xl ring-1 ring-border/80 shrink-0">
                        {community.profilePictureUrl && (
                          <AvatarImage
                            src={community.profilePictureUrl}
                            alt={community.name}
                            className="rounded-xl object-cover"
                          />
                        )}
                        <AvatarFallback className="rounded-xl bg-primary/10 text-primary font-semibold text-base">
                          {community.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <CardTitle className="truncate text-base font-semibold text-foreground group-hover:text-primary transition-colors">
                          {community.name}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground truncate font-mono">
                          /{community.slug}
                        </p>
                      </div>
                    </div>
                    {getRoleBadge(community.role)}
                  </div>
                  <CardDescription className="line-clamp-2 mt-3 text-xs leading-relaxed text-muted-foreground">
                    {community.description || "No community description provided."}
                  </CardDescription>
                </CardHeader>

                <CardContent className="pt-2 border-t border-border/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                      <Users className="size-3.5" />
                      <span>{community.memberCount ?? 0} members</span>
                    </div>
                    <Button
                      render={<Link href={`/communities/${community.slug}`} />}
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1 rounded-lg text-xs font-medium group-hover:border-primary/50 group-hover:bg-primary group-hover:text-primary-foreground transition-all cursor-pointer"
                    >
                      <span>Manage</span>
                      <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed border-border/80 bg-card/50">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-muted/80 text-muted-foreground mb-4 ring-8 ring-muted/30">
              <Building2 className="size-7" />
            </div>
            <h3 className="text-base font-semibold text-foreground">
              You don&apos;t manage any communities yet
            </h3>
            <p className="text-xs text-muted-foreground max-w-sm mt-1.5 mb-2 leading-relaxed">
              When you create a community or get appointed as an admin or moderator, it will automatically appear here for you to manage.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
