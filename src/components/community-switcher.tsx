"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  Check,
  ChevronsUpDown,
  Crown,
  LayoutDashboard,
  Plus,
  Shield,
  Sparkles,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface ManagedCommunity {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  bannerUrl?: string | null;
  banner_url?: string | null;
  profilePictureUrl?: string | null;
  profile_picture_url?: string | null;
  isPrivate?: boolean;
  is_private?: boolean;
  memberCount?: number;
  member_count?: number;
  role: "owner" | "admin" | "moderator";
}

interface CommunitySwitcherProps {
  communities?: ManagedCommunity[] | null;
  currentSlug?: string | null;
  onOpenCreate?: () => void;
}

export function CommunitySwitcher({
  communities = [],
  currentSlug,
  onOpenCreate,
}: CommunitySwitcherProps) {
  const router = useRouter();

  const currentCommunity = React.useMemo(() => {
    if (!currentSlug || !communities) return null;
    return communities.find((c) => c.slug === currentSlug) || null;
  }, [currentSlug, communities]);

  const getRoleBadge = (role: "owner" | "admin" | "moderator") => {
    switch (role) {
      case "owner":
        return (
          <Badge
            variant="default"
            className="gap-1 bg-amber-500/15 text-amber-600 border-amber-500/30 dark:text-amber-400 font-mono text-[9px] uppercase px-1 py-0"
          >
            <Crown className="size-2.5" />
            Owner
          </Badge>
        );
      case "admin":
        return (
          <Badge
            variant="default"
            className="gap-1 bg-sky-500/15 text-sky-600 border-sky-500/30 dark:text-sky-400 font-mono text-[9px] uppercase px-1 py-0"
          >
            <Shield className="size-2.5" />
            Admin
          </Badge>
        );
      case "moderator":
        return (
          <Badge
            variant="default"
            className="gap-1 bg-emerald-500/15 text-emerald-600 border-emerald-500/30 dark:text-emerald-400 font-mono text-[9px] uppercase px-1 py-0"
          >
            <Shield className="size-2.5" />
            Mod
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className="flex items-center gap-2 rounded-lg border border-border/80 bg-background/80 px-2.5 py-1.5 text-left text-xs font-medium hover:bg-muted/70 hover:border-border transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer max-w-[200px] sm:max-w-[260px]"
          />
        }
      >
        <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary border border-primary/20">
          {currentCommunity ? (
            <span className="text-[10px] font-bold uppercase">
              {currentCommunity.name.slice(0, 2)}
            </span>
          ) : (
            <Building2 className="size-3.5" />
          )}
        </div>

        <div className="flex flex-1 flex-col overflow-hidden leading-none text-left min-w-0">
          <span className="truncate text-xs font-semibold text-foreground">
            {currentCommunity ? currentCommunity.name : "All Communities"}
          </span>
          <span className="truncate text-[10px] text-muted-foreground mt-0.5 font-mono">
            {currentCommunity ? `/${currentCommunity.slug}` : "Overview"}
          </span>
        </div>

        <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" side="bottom" className="w-72">
        <DropdownMenuLabel className="flex items-center justify-between text-xs text-muted-foreground font-medium px-2 py-1.5">
          <span>Switch Community</span>
          {communities && communities.length > 0 && (
            <Badge variant="outline" className="text-[10px] font-mono py-0 px-1">
              {communities.length} {communities.length === 1 ? "managed" : "managed"}
            </Badge>
          )}
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        {/* Option 1: Dashboard Home */}
        <DropdownMenuItem
          onClick={() => router.push("/")}
          className={`flex items-center justify-between gap-2 px-2.5 py-2 cursor-pointer ${
            !currentSlug ? "bg-muted font-medium" : ""
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <LayoutDashboard className="size-3.5" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="truncate text-xs font-medium">Dashboard Overview</span>
              <span className="text-[10px] text-muted-foreground">View all managed communities</span>
            </div>
          </div>
          {!currentSlug && <Check className="size-3.5 text-primary shrink-0" />}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Managed Communities List */}
        <DropdownMenuGroup>
          {communities && communities.length > 0 ? (
            communities.map((community) => {
              const isSelected = currentSlug === community.slug;
              const profilePic =
                community.profilePictureUrl || community.profile_picture_url;
              const memberCount =
                community.memberCount ?? community.member_count ?? 0;

              return (
                <DropdownMenuItem
                  key={community.id}
                  onClick={() => router.push(`/communities/${community.slug}`)}
                  className={`flex items-center justify-between gap-2 px-2.5 py-2 cursor-pointer ${
                    isSelected ? "bg-muted font-medium" : ""
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className="relative flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary border border-border/80 overflow-hidden font-bold text-[10px] uppercase">
                      {profilePic ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={profilePic}
                          alt={community.name}
                          className="size-full object-cover"
                          onError={(e) => {
                            (e.currentTarget as HTMLElement).style.display = "none";
                          }}
                        />
                      ) : null}
                      <span>{community.name.slice(0, 2)}</span>
                    </div>

                    <div className="flex flex-col min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-xs font-medium text-foreground">
                          {community.name}
                        </span>
                      </div>
                      <span className="truncate text-[10px] text-muted-foreground font-mono">
                        {memberCount} {memberCount === 1 ? "member" : "members"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {getRoleBadge(community.role)}
                    {isSelected && <Check className="size-3.5 text-primary" />}
                  </div>
                </DropdownMenuItem>
              );
            })
          ) : (
            <div className="p-3 text-center text-xs text-muted-foreground">
              No managed communities yet.
            </div>
          )}
        </DropdownMenuGroup>

        {onOpenCreate && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onOpenCreate}
              className="flex items-center gap-2 px-2.5 py-2 text-xs font-medium text-primary hover:text-primary cursor-pointer"
            >
              <div className="flex size-5 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Plus className="size-3.5" />
              </div>
              <span>Create New Community</span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
