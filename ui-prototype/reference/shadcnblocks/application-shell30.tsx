"use client";

import {
  BarChart3,
  Calendar,
  CheckSquare,
  ChevronsUpDown,
  FileText,
  FolderPlus,
  House,
  Inbox,
  LogOut,
  Menu,
  Plus,
  Settings,
  User,
  UserPlus,
} from "lucide-react";
import * as React from "react";
import { cn } from "cn";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

const person1 = {
  name: "Jack Walsh",
  firstName: "Jack",
  lastName: "Walsh",
  initials: "JW",
  email: "jack.walsh@example.com",
  username: "jackwalsh",
  role: "Product Designer",
  company: "Cartwright",
  location: "Brisbane, Australia",
  avatar: "https://cdn.shadcnblocks.com/shadcnblocks/image-set/modern/avatars/avatar1.webp",
};

type NavItem = {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
};

const navItems: NavItem[] = [
  { id: "home", title: "Home", icon: House },
  { id: "inbox", title: "Inbox", icon: Inbox, badge: "5" },
  { id: "tasks", title: "Tasks", icon: CheckSquare },
  { id: "calendar", title: "Calendar", icon: Calendar },
  { id: "reports", title: "Reports", icon: BarChart3 },
];

const tabIds = ["home", "inbox", "tasks"];

const createActions = [
  { title: "New task", icon: CheckSquare },
  { title: "New document", icon: FileText },
  { title: "New project", icon: FolderPlus },
  { title: "Invite people", icon: UserPlus },
];

const UserAvatar = ({ className }: { className?: string }) => {
  return (
    <Avatar className={cn("size-8 rounded-lg", className)}>
      <AvatarImage src={person1.avatar} alt={person1.name} />
      <AvatarFallback className="rounded-lg">{person1.initials}</AvatarFallback>
    </Avatar>
  );
};

const NavUser = () => {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-open:bg-sidebar-accent data-open:text-sidebar-accent-foreground"
            >
              <UserAvatar />
              <div className="grid flex-1 text-start text-sm leading-tight">
                <span className="truncate font-medium">{person1.name}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {person1.email}
                </span>
              </div>
              <ChevronsUpDown className="ms-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side="right"
            align="end"
            sideOffset={4}
          >
            <DropdownMenuItem>
              <User className="size-4" />
              Account
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Settings className="size-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <LogOut className="size-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
};

const CreateMenu = ({ children }: { children: React.ReactNode }) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent className="w-52" side="top" align="center">
        <DropdownMenuLabel>Create</DropdownMenuLabel>
        {createActions.map((action) => (
          <DropdownMenuItem key={action.title}>
            <action.icon className="size-4" />
            {action.title}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const AppSidebar = ({
  activeId,
  onNavigate,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  activeId: string;
  onNavigate: (id: string) => void;
}) => {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg">
              <div className="flex aspect-square size-8 items-center justify-center rounded-sm bg-primary">
                <img
                  src="https://deifkwefumgah.cloudfront.net/shadcnblocks/block/logos/shadcnblocks-logo.svg"
                  alt="Shadcnblocks"
                  className="size-6 invert dark:invert-0"
                />
              </div>
              <div className="grid flex-1 text-start text-sm leading-tight">
                <span className="truncate font-medium">Shadcnblocks</span>
                <span className="truncate text-xs text-muted-foreground">
                  Workspace
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <CreateMenu>
              <SidebarMenuButton
                variant="outline"
                tooltip="Create"
                className="data-open:bg-sidebar-accent"
              >
                <Plus />
                <span>Create</span>
              </SidebarMenuButton>
            </CreateMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    tooltip={item.title}
                    isActive={item.id === activeId}
                    onClick={() => onNavigate(item.id)}
                  >
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                  {item.badge && (
                    <SidebarMenuBadge>{item.badge}</SidebarMenuBadge>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton tooltip="Settings">
                  <Settings />
                  <span>Settings</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
};

const TabButton = ({
  item,
  isActive,
  onSelect,
}: {
  item: NavItem;
  isActive: boolean;
  onSelect: (id: string) => void;
}) => {
  return (
    <button
      type="button"
      aria-current={isActive ? "page" : undefined}
      onClick={() => onSelect(item.id)}
      className={cn(
        "relative flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground",
        isActive && "text-foreground",
      )}
    >
      <item.icon className="size-5" />
      {item.title}
      {item.badge && (
        <span className="absolute top-1.5 start-1/2 ms-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] text-primary-foreground">
          {item.badge}
        </span>
      )}
    </button>
  );
};

const MobileTabBar = ({
  activeId,
  onSelect,
}: {
  activeId: string;
  onSelect: (id: string) => void;
}) => {
  const tabs = navItems.filter((item) => tabIds.includes(item.id));
  const moreItems = navItems.filter((item) => !tabIds.includes(item.id));
  const moreActive = moreItems.some((item) => item.id === activeId);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 flex h-16 items-stretch border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <TabButton
        item={tabs[0]}
        isActive={activeId === tabs[0].id}
        onSelect={onSelect}
      />
      <TabButton
        item={tabs[1]}
        isActive={activeId === tabs[1].id}
        onSelect={onSelect}
      />
      <div className="flex flex-1 items-start justify-center">
        <CreateMenu>
          <Button
            size="icon"
            className="-mt-5 size-14 rounded-full shadow-lg ring-4 ring-background"
            aria-label="Create"
          >
            <Plus className="size-6" />
          </Button>
        </CreateMenu>
      </div>
      <TabButton
        item={tabs[2]}
        isActive={activeId === tabs[2].id}
        onSelect={onSelect}
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground",
              moreActive && "text-foreground",
            )}
          >
            <Menu className="size-5" />
            More
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-48" side="top" align="end">
          {moreItems.map((item) => (
            <DropdownMenuItem key={item.id} onSelect={() => onSelect(item.id)}>
              <item.icon className="size-4" />
              {item.title}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem>
            <Settings className="size-4" />
            Settings
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </nav>
  );
};

interface ApplicationShell30Props {
  className?: string;
}

export function ApplicationShell30({ className }: ApplicationShell30Props) {
  const [activeId, setActiveId] = React.useState("home");
  const activeItem = navItems.find((item) => item.id === activeId);

  return (
    <TooltipProvider delayDuration={0}>
      <SidebarProvider className={cn(className)}>
        <AppSidebar activeId={activeId} onNavigate={setActiveId} />
        <SidebarInset className="pb-16 md:pb-0">
          <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4">
            <SidebarTrigger className="-ms-1 hidden md:inline-flex" />
            <Separator
              orientation="vertical"
              className="me-2 hidden md:block data-vertical:h-4 data-vertical:self-auto"
            />
            <img
              src="https://deifkwefumgah.cloudfront.net/shadcnblocks/block/logos/shadcnblocks-logo.svg"
              alt="Shadcnblocks"
              className="size-6 md:hidden dark:invert"
            />
            <h1 className="text-base font-semibold">{activeItem?.title}</h1>
            <UserAvatar className="ms-auto size-8 rounded-full md:hidden" />
          </header>
          <div className="flex flex-1 flex-col gap-4 p-4">
            <div className="h-24 rounded-xl bg-muted/50" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 rounded-xl bg-muted/50 p-4"
                >
                  <div className="size-10 shrink-0 rounded-lg bg-muted" />
                  <div className="flex flex-1 flex-col gap-2">
                    <div className="h-3 w-2/3 rounded-full bg-muted" />
                    <div className="h-2.5 w-1/2 rounded-full bg-muted/70" />
                  </div>
                </div>
              ))}
            </div>
            <div className="min-h-64 flex-1 rounded-xl bg-muted/50" />
          </div>
        </SidebarInset>
        <MobileTabBar activeId={activeId} onSelect={setActiveId} />
      </SidebarProvider>
    </TooltipProvider>
  );
}
