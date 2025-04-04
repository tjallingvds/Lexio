'use client';

import { Toaster } from 'sonner';
import { useState, useEffect } from 'react';
import { Document, fetchDocuments } from '@/lib/api';
import { FileText, MoreHorizontal, Star, Search, PanelLeftIcon, Home } from 'lucide-react';
import { format } from 'date-fns';

import { AppSidebar } from '@/components/app-sidebar';
import { SidebarProvider, useSidebar } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

function DocumentsHeader() {
  const { toggleSidebar, state } = useSidebar();
  
  return (
    <div className="flex items-center border-b px-4 py-2 bg-white h-[41px]">
      <div className="flex items-center gap-2">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={toggleSidebar}
          className="h-6 w-6"
          aria-label={state === 'expanded' ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          <PanelLeftIcon className="h-3.5 w-3.5" />
        </Button>
        <h3 className="font-medium">All Documents</h3>
      </div>
    </div>
  );
}

export default function Page() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [starredDocuments, setStarredDocuments] = useState<string[]>([]);

  // Load documents function
  const loadDocuments = async () => {
    setLoading(true);
    try {
      const docs = await fetchDocuments();
      setDocuments(docs);
    } catch (error) {
      console.error('Failed to load documents:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch documents on initial load
  useEffect(() => {
    loadDocuments();
  }, []);

  // Refresh documents when window gets focus (user comes back to this page)
  useEffect(() => {
    const handleFocus = () => {
      loadDocuments();
    };

    window.addEventListener('focus', handleFocus);
    
    // Also refresh when component mounts to ensure fresh data
    loadDocuments();
    
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // Toggle starred status
  const toggleStarred = (docId: string) => {
    setStarredDocuments(prev => 
      prev.includes(docId) 
        ? prev.filter(id => id !== docId)
        : [...prev, docId]
    );
  };

  // Filter documents based on search term
  const filteredDocuments = documents.filter(doc => 
    doc.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Generate random author and node count data (for demo purposes)
  const getRandomAuthor = () => {
    const authors = ['TechExpert', 'AIResearcher', 'BioTeacher', 'PMProfessional', 'PhysicsTeacher', 'CodingInstructor', 'MedStudent', 'HistoryBuff'];
    return authors[Math.floor(Math.random() * authors.length)];
  };

  const getRandomNodeCount = () => {
    return Math.floor(Math.random() * 100) + 1;
  };

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full">
        <AppSidebar className="h-full border-r border-gray-200 dark:border-gray-800" />
        <Separator orientation="vertical" className="h-full" />
        <div className="flex-1 overflow-auto flex flex-col bg-white">
          <DocumentsHeader />
          <div className="p-8">
            <div className="flex justify-end mb-6">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                  <Input 
                    className="pl-8 rounded-lg border-gray-200 w-60" 
                    placeholder="Search documents..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <Link to="/editor">
                  <Button className="rounded-lg bg-black hover:bg-gray-800">New Document</Button>
                </Link>
              </div>
            </div>

            {loading ? (
              <div className="text-center py-8">
                <p>Loading documents...</p>
              </div>
            ) : filteredDocuments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <p className="text-gray-500 mb-6">No documents found.</p>
                <Button className="rounded-lg bg-black hover:bg-gray-800" onClick={() => window.location.href = '/editor'}>
                  Create your first document
                </Button>
              </div>
            ) : (
              <div className="rounded-md border">
                <div className="grid grid-cols-[1fr_200px_150px_100px_40px] gap-2 p-4 border-b font-medium text-sm text-gray-500">
                  <div>Title</div>
                  <div>Last edited</div>
                  <div>Author</div>
                  <div>Nodes</div>
                  <div></div>
                </div>
                {filteredDocuments.map((doc) => {
                  const isStarred = starredDocuments.includes(doc.id.toString());
                  const author = getRandomAuthor();
                  const nodeCount = getRandomNodeCount();
                  
                  return (
                    <div 
                      key={doc.id}
                      className="grid grid-cols-[1fr_200px_150px_100px_40px] gap-2 items-center p-4 hover:bg-gray-50 border-b last:border-b-0"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-gray-400" />
                        <Link 
                          to={`/editor/${doc.id}`}
                          className="font-medium hover:underline"
                        >
                          {doc.title}
                        </Link>
                      </div>
                      <div className="text-sm text-gray-500">
                        Last edited {format(new Date(doc.updated_at), 'yyyy-MM-dd')}
                      </div>
                      <div className="text-sm text-gray-500">{author}</div>
                      <div className="text-sm text-gray-500">{nodeCount} nodes</div>
                      <div className="flex items-center">
                        <button 
                          onClick={() => toggleStarred(doc.id.toString())}
                          className="text-gray-400 hover:text-yellow-400"
                        >
                          <Star 
                            className={`h-5 w-5 ${isStarred ? 'fill-yellow-400 text-yellow-400' : ''}`} 
                          />
                          <span className="sr-only">Star</span>
                        </button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 ml-1">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">More</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <Link to={`/editor/${doc.id}`} className="w-full">
                                Open
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem>Rename</DropdownMenuItem>
                            <DropdownMenuItem>Duplicate</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-red-600">
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        <Toaster />
      </div>
    </SidebarProvider>
  );
} 