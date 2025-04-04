"use client"

import { ChevronRight, FilePlus, LayoutDashboard, Files, Home, Plus, type LucideIcon, FileText } from "lucide-react"

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
import { Button } from "@/components/ui/button"

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
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Home">
              <a href="/dashboard" onClick={(e) => { e.preventDefault(); window.location.href = "/dashboard"; }}>
                <Home className="h-4 w-4" />
                <span>Home</span>
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
        <div className="flex items-center justify-between">
          <SidebarGroupLabel>Recent documents</SidebarGroupLabel>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-5 w-5 -mt-0.5 mr-2" 
            asChild
            title="New document"
          >
            <a href="/editor" onClick={(e) => { e.preventDefault(); window.location.href = "/editor"; }}>
              <Plus className="h-4 w-4" />
            </a>
          </Button>
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <a href="/editor/1" onClick={(e) => { e.preventDefault(); window.location.href = "/editor/1"; }}>
                <FileText className="h-4 w-4" />
                <span>Web Development Fundamentals</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <a href="/editor/2" onClick={(e) => { e.preventDefault(); window.location.href = "/editor/2"; }}>
                <FileText className="h-4 w-4" />
                <span>Machine Learning Pipeline</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <a href="/editor/3" onClick={(e) => { e.preventDefault(); window.location.href = "/editor/3"; }}>
                <FileText className="h-4 w-4" />
                <span>Biology Cell Structure</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroup>
    </>
  )
}
