"use client"

import { ChevronRight, FilePlus, LayoutDashboard, Files, type LucideIcon } from "lucide-react"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"

export function NavMain({
  items,
}: {
  items: {
    title: string
    url: string
    icon: LucideIcon
    isActive?: boolean
    items?: {
      title: string
      url: string
    }[]
  }[]
}) {
  return (
    <>
      <SidebarGroup>
        <SidebarGroupLabel>Get started</SidebarGroupLabel>
        <SidebarMenu>
          <SidebarMenuItem className="border rounded-md mx-2">
            <SidebarMenuButton asChild tooltip="New document">
              <a href="/editor" onClick={(e) => { e.preventDefault(); window.location.href = "/editor"; }}>
                <FilePlus className="h-4 w-4" />
                <span>New document</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Dashboard">
              <a href="/dashboard" onClick={(e) => { e.preventDefault(); window.location.href = "/dashboard"; }}>
                <LayoutDashboard className="h-4 w-4" />
                <span>Dashboard</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="All documents">
              <a href="/all-documents" onClick={(e) => { e.preventDefault(); window.location.href = "/all-documents"; }}>
                <Files className="h-4 w-4" />
                <span>All documents</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroup>
      
      <SidebarGroup>
        <SidebarGroupLabel>Recent documents</SidebarGroupLabel>
        <SidebarMenu>
          {/* Recent documents would be added here */}
        </SidebarMenu>
      </SidebarGroup>
    </>
  )
}
