import { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";

interface AppLayoutProps {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function AppLayout({ title, actions, children }: AppLayoutProps) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <div className="flex flex-1 flex-col">
          <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-border/60 bg-background/80 px-6 backdrop-blur">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
              <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
            </div>
            {actions && <div className="flex items-center gap-2">{actions}</div>}
          </header>
          <main className="flex-1 px-6 py-6">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
