"use client"

import { ChevronRight, FilePlus, LayoutDashboard, Files, Home, Plus, type LucideIcon, FileText } from "lucide-react"
import { useState, useEffect } from 'react';
import { Document, fetchDocuments } from '@/lib/api';

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
  const [recentDocuments, setRecentDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDocuments = async () => {
    try {
      const docs = await fetchDocuments();
      setRecentDocuments(docs.slice(0, 3)); // Get the 3 most recent documents
    } catch (error) {
      console.error('Failed to load documents:', error);
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    loadDocuments();
  }, []);

  // Refresh on focus
  useEffect(() => {
    const handleFocus = () => {
      loadDocuments();
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

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
          {loading ? (
            <SidebarMenuItem>
              <SidebarMenuButton>
                <span>Loading documents...</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ) : recentDocuments.length === 0 ? (
            <SidebarMenuItem>
              <SidebarMenuButton>
                <span>No documents yet</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ) : (
            recentDocuments.map((doc) => (
              <SidebarMenuItem key={doc.id}>
                <SidebarMenuButton asChild>
                  <a href={`/editor/${doc.id}`} onClick={(e) => { e.preventDefault(); window.location.href = `/editor/${doc.id}`; }}>
                    <FileText className="h-4 w-4" />
                    <span>{doc.title}</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))
          )}
        </SidebarMenu>
      </SidebarGroup>
    </>
  )
}
