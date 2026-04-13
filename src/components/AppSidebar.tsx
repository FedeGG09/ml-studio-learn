import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import {
  Home, Upload, Table2, Database, BarChart3, Brain,
  TrendingUp, Code2, GitCompare, Settings, Beaker
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const mainItems = [
  { title: "Home", url: "/", icon: Home },
  { title: "Upload Dataset", url: "/upload", icon: Upload },
  { title: "Dataset Explorer", url: "/explorer", icon: Table2 },
  { title: "SQL Lab", url: "/sql-lab", icon: Database },
  { title: "Data Viz", url: "/data-viz", icon: BarChart3 },
];

const mlItems = [
  { title: "Model Lab", url: "/model-lab", icon: Brain },
  { title: "Training Results", url: "/results", icon: TrendingUp },
  { title: "Code Viewer", url: "/code-viewer", icon: Code2 },
  { title: "Comparison", url: "/comparison", icon: GitCompare },
];

const adminItems = [
  { title: "Admin / Datasets", url: "/admin", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  const renderGroup = (label: string, items: typeof mainItems) => (
    <SidebarGroup>
      <SidebarGroupLabel className="text-xs uppercase tracking-widest font-heading text-muted-foreground/60 px-3">
        {!collapsed && label}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild>
                <NavLink
                  to={item.url}
                  end={item.url === "/"}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 text-sidebar-foreground hover:bg-sidebar-accent"
                  activeClassName="nav-item-active"
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span>{item.title}</span>}
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <div className="p-4 flex items-center gap-3 border-b border-sidebar-border">
        <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
          <Beaker className="h-4 w-4 text-primary-foreground" />
        </div>
        {!collapsed && (
          <div>
            <h1 className="font-heading font-bold text-base text-foreground">ML Playground</h1>
            <p className="text-[10px] text-muted-foreground">Learning by doing</p>
          </div>
        )}
      </div>
      <SidebarContent className="py-2">
        {renderGroup("Data", mainItems)}
        {renderGroup("Machine Learning", mlItems)}
        {renderGroup("Admin", adminItems)}
      </SidebarContent>
    </Sidebar>
  );
}
