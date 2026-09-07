"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  Calendar,
  ShieldAlert,
  Settings,
  LogOut,
  Compass,
  Building2,
} from "lucide-react";
import { toast } from "sonner";

import { apiGet, apiPost } from "@/lib/api-client";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";

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

interface UserProfile {
  id: string;
  username: string;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  name?: string | null;
  profile_picture_url?: string | null;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [tokenChecked, setTokenChecked] = React.useState(false);

  // Check auth token existence on client mount
  React.useEffect(() => {
    const token = localStorage.getItem("bearer_token");
    if (!token) {
      router.replace("/login");
    } else {
      setTokenChecked(true);
    }
  }, [router]);

  // Fetch current user
  const { data: user, isLoading: isLoadingUser } = useQuery<UserProfile>({
    queryKey: ["currentUser"],
    queryFn: () => apiGet<UserProfile>("/users/me"),
    enabled: tokenChecked,
  });

  // Fetch managed communities for sidebar
  const { data: communities, isLoading: isLoadingCommunities } = useQuery<
    ManagedCommunity[]
  >({
    queryKey: ["managedCommunities"],
    queryFn: () => apiGet<ManagedCommunity[]>("/users/me/communities"),
    enabled: tokenChecked,
  });

  // Extract community context slug if path is /communities/[slug]/*
  const communityMatch = pathname.match(/^\/communities\/([^/]+)/);
  const currentSlug = communityMatch ? communityMatch[1] : null;
  const currentCommunity = React.useMemo(() => {
    if (!currentSlug || !communities) return null;
    return communities.find((c) => c.slug === currentSlug) || null;
  }, [currentSlug, communities]);

  // Handle Logout
  const handleLogout = async () => {
    try {
      await apiPost("/auth/logout");
    } catch {
      // Proceed even if network/backend logout fails
    } finally {
      localStorage.removeItem("bearer_token");
      localStorage.removeItem("auth_user");
      queryClient.clear();
      toast.success("Logged out successfully");
      router.replace("/login");
    }
  };

  // User initials for avatar fallback
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

  // Compute Breadcrumb trail
  const breadcrumbs = React.useMemo(() => {
    if (pathname === "/") {
      return [{ label: "Dashboard", href: "/", isCurrent: true }];
    }

    const crumbs: Array<{ label: string; href?: string; isCurrent?: boolean }> = [
      { label: "Dashboard", href: "/" },
    ];

    if (currentSlug) {
      const communityName = currentCommunity?.name || currentSlug;
      const subpath = pathname.replace(`/communities/${currentSlug}`, "");

      if (!subpath || subpath === "") {
        crumbs.push({ label: communityName, isCurrent: true });
      } else {
        crumbs.push({
          label: communityName,
          href: `/communities/${currentSlug}`,
        });

        if (subpath.startsWith("/members")) {
          crumbs.push({ label: "Members", isCurrent: true });
        } else if (subpath.startsWith("/posts")) {
          crumbs.push({ label: "Posts", isCurrent: true });
        } else if (subpath.startsWith("/events")) {
          crumbs.push({ label: "Events", isCurrent: true });
        } else if (subpath.startsWith("/reports")) {
          crumbs.push({ label: "Reports", isCurrent: true });
        } else if (subpath.startsWith("/settings")) {
          crumbs.push({ label: "Settings", isCurrent: true });
        } else {
          const section = subpath.replace(/^\//, "");
          crumbs.push({
            label: section.charAt(0).toUpperCase() + section.slice(1),
            isCurrent: true,
          });
        }
      }
    }

    return crumbs;
  }, [pathname, currentSlug, currentCommunity]);

  if (!tokenChecked) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-background p-6">
        <div className="flex flex-col items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-4 w-40" />
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-muted/20">
        <Sidebar collapsible="icon" className="border-r border-border">
          {/* Sidebar Header */}
          <SidebarHeader className="border-b border-border px-4 py-3">
            <Link
              href="/"
              className="flex items-center gap-2.5 font-semibold transition-opacity hover:opacity-85"
            >
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
                <Compass className="size-4" />
              </div>
              <div className="flex flex-col overflow-hidden group-data-[collapsible=icon]:hidden">
                <span className="truncate text-sm font-semibold tracking-tight text-foreground">
                  HobbyHub
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  Admin Dashboard
                </span>
              </div>
            </Link>
          </SidebarHeader>

          {/* Sidebar Content */}
          <SidebarContent>
            {/* Nav Group 1: Dashboard */}
            <SidebarGroup>
              <SidebarGroupLabel>Dashboard</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      render={<Link href="/" />}
                      isActive={pathname === "/"}
                      tooltip="Dashboard Home"
                    >
                      <LayoutDashboard className="size-4" />
                      <span>Dashboard Home</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* Nav Group 2: My Communities (Dynamic) */}
            <SidebarGroup>
              <SidebarGroupLabel>My Communities</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {isLoadingCommunities ? (
                    <>
                      <SidebarMenuItem>
                        <SidebarMenuSkeleton showIcon />
                      </SidebarMenuItem>
                      <SidebarMenuItem>
                        <SidebarMenuSkeleton showIcon />
                      </SidebarMenuItem>
                      <SidebarMenuItem>
                        <SidebarMenuSkeleton showIcon />
                      </SidebarMenuItem>
                    </>
                  ) : communities && communities.length > 0 ? (
                    communities.map((community) => {
                      const isActive = currentSlug === community.slug;
                      return (
                        <SidebarMenuItem key={community.id}>
                          <SidebarMenuButton
                            render={
                              <Link href={`/communities/${community.slug}`} />
                            }
                            isActive={isActive}
                            tooltip={community.name}
                            className="justify-between"
                          >
                            <div className="flex items-center gap-2 truncate">
                              <Building2 className="size-4 shrink-0 text-muted-foreground" />
                              <span className="truncate">{community.name}</span>
                            </div>
                            <Badge
                              variant="secondary"
                              className="text-[10px] uppercase font-mono px-1.5 py-0 group-data-[collapsible=icon]:hidden"
                            >
                              {community.role}
                            </Badge>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })
                  ) : (
                    <div className="px-3 py-2 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
                      No managed communities yet.
                    </div>
                  )}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* Nav Group 3: Community Management (Contextual) */}
            {currentSlug && (
              <SidebarGroup>
                <SidebarGroupLabel className="flex items-center justify-between">
                  <span className="truncate">
                    {currentCommunity?.name || "Community"}
                  </span>
                  <span className="text-[10px] uppercase text-muted-foreground">
                    Context
                  </span>
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        render={
                          <Link href={`/communities/${currentSlug}`} />
                        }
                        isActive={pathname === `/communities/${currentSlug}`}
                        tooltip="Overview"
                      >
                        <LayoutDashboard className="size-4" />
                        <span>Overview</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>

                    <SidebarMenuItem>
                      <SidebarMenuButton
                        render={
                          <Link href={`/communities/${currentSlug}/members`} />
                        }
                        isActive={pathname.startsWith(
                          `/communities/${currentSlug}/members`
                        )}
                        tooltip="Members"
                      >
                        <Users className="size-4" />
                        <span>Members</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>

                    <SidebarMenuItem>
                      <SidebarMenuButton
                        render={
                          <Link href={`/communities/${currentSlug}/posts`} />
                        }
                        isActive={pathname.startsWith(
                          `/communities/${currentSlug}/posts`
                        )}
                        tooltip="Posts"
                      >
                        <MessageSquare className="size-4" />
                        <span>Posts</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>

                    <SidebarMenuItem>
                      <SidebarMenuButton
                        render={
                          <Link href={`/communities/${currentSlug}/events`} />
                        }
                        isActive={pathname.startsWith(
                          `/communities/${currentSlug}/events`
                        )}
                        tooltip="Events"
                      >
                        <Calendar className="size-4" />
                        <span>Events</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>

                    <SidebarMenuItem>
                      <SidebarMenuButton
                        render={
                          <Link href={`/communities/${currentSlug}/reports`} />
                        }
                        isActive={pathname.startsWith(
                          `/communities/${currentSlug}/reports`
                        )}
                        tooltip="Reports"
                      >
                        <ShieldAlert className="size-4" />
                        <span>Reports</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>

                    <SidebarMenuItem>
                      <SidebarMenuButton
                        render={
                          <Link href={`/communities/${currentSlug}/settings`} />
                        }
                        isActive={pathname.startsWith(
                          `/communities/${currentSlug}/settings`
                        )}
                        tooltip="Settings"
                      >
                        <Settings className="size-4" />
                        <span>Settings</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )}
          </SidebarContent>

          {/* Sidebar Footer */}
          <SidebarFooter className="border-t border-border p-2">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    type="button"
                    className="flex w-full items-center gap-2.5 rounded-lg p-2 text-left text-sm hover:bg-sidebar-accent hover:text-sidebar-accent-foreground outline-none transition-colors"
                  />
                }
              >
                <Avatar size="sm">
                  {user?.profile_picture_url && (
                    <AvatarImage
                      src={user.profile_picture_url}
                      alt={user.name || user.username}
                    />
                  )}
                  <AvatarFallback>{userInitials}</AvatarFallback>
                </Avatar>
                <div className="flex flex-1 flex-col overflow-hidden text-xs leading-tight group-data-[collapsible=icon]:hidden">
                  <span className="truncate font-medium text-foreground">
                    {user?.name || user?.username || "Admin User"}
                  </span>
                  <span className="truncate text-muted-foreground">
                    {user?.email || `@${user?.username || "user"}`}
                  </span>
                </div>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" side="top" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col gap-0.5">
                    <p className="text-sm font-semibold text-foreground">
                      {user?.name || user?.username || "Admin User"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {user?.email || `@${user?.username || "user"}`}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={handleLogout}
                  className="cursor-pointer"
                >
                  <LogOut className="mr-2 size-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>

          <SidebarRail />
        </Sidebar>

        {/* Main Inset Area */}
        <SidebarInset className="flex min-h-screen flex-1 flex-col bg-background">
          {/* Top Header */}
          <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur-md">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 h-4" />
              <Breadcrumb>
                <BreadcrumbList>
                  {breadcrumbs.map((crumb, index) => (
                    <React.Fragment key={crumb.label + index}>
                      {index > 0 && <BreadcrumbSeparator />}
                      <BreadcrumbItem>
                        {crumb.isCurrent || !crumb.href ? (
                          <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                        ) : (
                          <BreadcrumbLink render={<Link href={crumb.href} />}>
                            {crumb.label}
                          </BreadcrumbLink>
                        )}
                      </BreadcrumbItem>
                    </React.Fragment>
                  ))}
                </BreadcrumbList>
              </Breadcrumb>
            </div>

            {/* Header Right Actions */}
            <div className="flex items-center gap-2 sm:gap-3">
              {isLoadingUser ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <button
                          type="button"
                          className="flex items-center gap-2 rounded-full p-1 outline-none hover:bg-muted/80 transition-colors cursor-pointer"
                        />
                      }
                    >
                      <span className="hidden text-xs font-medium text-muted-foreground sm:inline-block">
                        {user?.name || user?.username}
                      </span>
                      <Avatar size="sm">
                        {user?.profile_picture_url && (
                          <AvatarImage
                            src={user.profile_picture_url}
                            alt={user.name || user.username}
                          />
                        )}
                        <AvatarFallback>{userInitials}</AvatarFallback>
                      </Avatar>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" side="bottom" className="w-56">
                      <DropdownMenuLabel>
                        <div className="flex flex-col gap-0.5">
                          <p className="text-sm font-semibold text-foreground">
                            {user?.name || user?.username || "Admin User"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {user?.email || `@${user?.username || "user"}`}
                          </p>
                        </div>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={handleLogout}
                        className="cursor-pointer"
                      >
                        <LogOut className="mr-2 size-4" />
                        <span>Log out</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <Separator orientation="vertical" className="h-4 hidden sm:block" />

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleLogout}
                    className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 text-xs gap-1.5 h-8 px-2"
                  >
                    <LogOut className="size-3.5" />
                    <span className="hidden sm:inline">Log out</span>
                  </Button>
                </>
              )}
            </div>
          </header>

          {/* Page Content */}
          <main className="flex-1 p-6">{children}</main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
