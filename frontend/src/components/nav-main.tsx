"use client"

import { ChevronRight, FilePlus, LayoutDashboard, Files, Home, Plus, type LucideIcon, FileText } from "lucide-react"
import { useState, useEffect } from 'react';
import { Document, fetchDocuments } from '@/lib/api';
import { useNavigate } from 'react-router-dom';
import { createAndOpenDocument } from '@/lib/document-utils';

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
  const [isCreating, setIsCreating] = useState(false);
  const navigate = useNavigate();

  const loadDocuments = async () => {
    try {
      const docs = await fetchDocuments();
      // Sort documents by updated_at date (most recent first) and take the 6 most recent
      const sortedDocs = docs.sort((a, b) => 
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      ).slice(0, 6);
      setRecentDocuments(sortedDocs);
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

  // New handler for document creation
  const handleCreateDocument = async (e: React.MouseEvent) => {
    e.preventDefault();
    setIsCreating(true);
    try {
      const documentId = await createAndOpenDocument();
      if (documentId) {
        // Navigate only after document is created and IDs are stored
        navigate(`/editor/${documentId}?new=true`);
      }
    } finally {
      setIsCreating(false);
    }
  };

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
            title="New document"
            onClick={handleCreateDocument}
            disabled={isCreating}
          >
            <Plus className="h-4 w-4" />
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
