'use client';

import React, { useState, useEffect, useRef } from 'react';
import { cn } from '@udecode/cn';
import { createPlatePlugin } from '@udecode/plate/react';
import { 
  HEADING_KEYS
} from '@udecode/plate-heading';

// Define a simple interface for our heading elements
interface TocHeading {
  id: string;
  depth: number;
  title: string;
}

export const FloatingTocPlugin = createPlatePlugin({
  key: 'floating-toc',
  render: {
    afterEditable: FloatingToc,
  },
});

function FloatingToc() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [headingList, setHeadingList] = useState<TocHeading[]>([]);
  const tocRef = useRef<HTMLDivElement>(null);
  const positionRef = useRef({ top: 0, right: 0 });
  const chatObserverRef = useRef<MutationObserver | null>(null);
  const chatElementRef = useRef<Element | null>(null);
  const isVisibleRef = useRef<boolean>(true);
  
  // More specific selectors for the chat element
  const chatSelectors = [
    '.chat-sidebar', 
    '.chat-panel', 
    '[class*="Chat"]', 
    '[class*="chat"]', 
    '#chat', 
    '.chat-container',
    '.toolbar-container' // Include toolbar in our search
  ];
  
  // Find the chat element using various selectors
  const findChatElement = () => {
    for (const selector of chatSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        return element;
      }
    }
    return null;
  };

  // Find the toolbar element
  const findToolbarElement = () => {
    // More comprehensive selector list for the toolbar
    const toolbarSelectors = [
      '.slate-ToolbarWrapper', 
      '.fixed-toolbar', 
      '[class*="toolbar"]',
      '[class*="Toolbar"]',
      '.editor-toolbar',
      '.slate-Toolbar',
      '.toolbar',
      '.plate-toolbar',
      'div[role="toolbar"]',
      '.PlateFloatingToolbar',
      // Add more specific selectors
      'header',
      '.header',
      '.editor-header',
      '.formatting-toolbar',
      '[aria-label="Formatting"]'
    ];
    
    // Try each selector
    for (const selector of toolbarSelectors) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        // Find the one closest to the top that's visible
        let bestMatch: Element | null = null;
        let lowestTop = Infinity;
        
        // Use a traditional for loop to iterate through NodeList
        for (let i = 0; i < elements.length; i++) {
          const el = elements[i] as Element;
          const rect = el.getBoundingClientRect();
          // Only consider visible elements with some height
          if (rect.height > 0 && rect.top >= 0 && rect.top < lowestTop) {
            lowestTop = rect.top;
            bestMatch = el;
          }
        }
        
        if (bestMatch) return bestMatch;
      }
    }
    
    return null;
  };
  
  // Function to calculate proper margin below toolbar
  const getToolbarBottomMargin = (toolbarElement: Element | null) => {
    if (!toolbarElement) return 20; // Much smaller default margin
    
    const toolbarRect = toolbarElement.getBoundingClientRect();
    
    // Calculate a minimal margin based on toolbar height
    const toolbarHeight = toolbarRect.height;
    return Math.max(10, Math.min(30, toolbarHeight * 0.3)); // Keep it small and proportional
  };
  
  // Function to update the TOC position based on chat position with high precision
  const updatePosition = () => {
    // IMPORTANT: First ensure the TOC is visible before anything else
    if (tocRef.current) {
      tocRef.current.style.display = 'block';
      tocRef.current.style.opacity = '1';
    }
    
    // Use our referenced chat element if we have one, otherwise try to find it
    const chatElement = chatElementRef.current || findChatElement();
    const toolbarElement = findToolbarElement();
    
    if (chatElement) {
      // Store the reference for future updates
      chatElementRef.current = chatElement;
      
      // If we have a chat element, set up an observer if not already done
      if (!chatObserverRef.current) {
        chatObserverRef.current = new MutationObserver((mutations) => {
          // Immediately update position when chat attributes or styles change
          updatePositionFromChatElement();
          ensureTocVisibility();
        });
        
        // Observe everything that might indicate a resize/move of the chat
        chatObserverRef.current.observe(chatElement, {
          attributes: true,
          attributeFilter: ['style', 'class', 'width'],
          subtree: false
        });
      }
    }
    
    updatePositionFromChatElement();
    ensureTocVisibility();
  };

  // Make sure TOC is always visible with multiple backup checks
  const ensureTocVisibility = () => {
    if (tocRef.current) {
      tocRef.current.style.display = 'block';
      tocRef.current.style.opacity = '1';
      
      // Force a repaint to ensure visibility takes effect
      void tocRef.current.offsetHeight;
      
      // Set a backup timeout to double-check visibility
      setTimeout(() => {
        if (tocRef.current) {
          tocRef.current.style.display = 'block';
          tocRef.current.style.opacity = '1';
        }
      }, 100);
      
      isVisibleRef.current = true;
    }
  };
  
  // Separate function for updating position that can be called directly
  const updatePositionFromChatElement = () => {
    // ALWAYS ensure TOC is visible first
    ensureTocVisibility();
    
    const chatElement = chatElementRef.current || findChatElement();
    const toolbarElement = findToolbarElement();
    const editorContainer = document.querySelector('.slate-editable, [contenteditable=true], .ProseMirror, .editor-container');
    
    // Start with a default top position that's at the top of the viewport
    let newTop = 20; // Very high default position
    let newRight = 24; // Default right position
    
    // Try to position based on the toolbar first - highest priority
    if (toolbarElement) {
      const toolbarRect = toolbarElement.getBoundingClientRect();
      
      // Position just below the toolbar
      const margin = getToolbarBottomMargin(toolbarElement);
      newTop = toolbarRect.bottom + margin;
    }
    
    // Get horizontal position from chat panel if available
    if (chatElement) {
      const chatRect = chatElement.getBoundingClientRect();
      newRight = window.innerWidth - chatRect.left + 12;
    } else if (editorContainer) {
      // Fallback to editor position
      const editorRect = editorContainer.getBoundingClientRect();
      newRight = window.innerWidth - editorRect.right + 24;
    }
    
    // Safety bounds - ensure it stays in a reasonable position
    // But prioritize keeping it high on the page
    newTop = Math.max(20, Math.min(newTop, 120)); 
    newRight = Math.max(20, Math.min(newRight, window.innerWidth - 100));
    
    // Update position reference
    positionRef.current = {
      top: newTop,
      right: newRight
    };
    
    // Apply position to DOM
    if (tocRef.current) {
      tocRef.current.style.top = `${positionRef.current.top}px`;
      tocRef.current.style.right = `${positionRef.current.right}px`;
      tocRef.current.style.position = 'fixed';
      
      // Force visibility again after positioning
      tocRef.current.style.display = 'block';
      tocRef.current.style.opacity = '1';
      tocRef.current.style.zIndex = '9999'; // Ensure highest z-index
      
      // Force a reflow to ensure the changes take effect immediately
      void tocRef.current.getBoundingClientRect();
    }
  };

  // Function to get headings from DOM directly
  const updateHeadingList = () => {
    // Ensure TOC visibility when updating heading list
    ensureTocVisibility();
    
    const headings: TocHeading[] = [];
    const headingElements = document.querySelectorAll('h1, h2, h3');
    
    headingElements.forEach((element, index) => {
      const headingType = element.tagName.toLowerCase();
      let id = element.id;
      
      // If the heading doesn't have an ID, create one
      if (!id) {
        id = `heading-${headingType}-${index}`;
        element.id = id;
      }
      
      const title = element.textContent || '';
      const depth = headingType === 'h1' ? 1 : 
                   headingType === 'h2' ? 2 : 3;
      
      if (title) {
        headings.push({
          id,
          depth,
          title,
        });
      }
    });
    
    setHeadingList(headings);
  };
  
  // Update heading list when component mounts
  useEffect(() => {
    // Initial updates - ensure immediate visibility
    ensureTocVisibility();
    updateHeadingList();
    updatePosition();
    
    // Add an extra visibility check after a short delay
    const initialVisibilityCheck = setTimeout(() => {
      ensureTocVisibility();
    }, 500);
    
    // Find and set up the chat element for continued observation
    const chatElement = findChatElement();
    if (chatElement) {
      chatElementRef.current = chatElement;
      
      // Set up direct style and DOM monitoring of chat element
      chatObserverRef.current = new MutationObserver(() => {
        requestAnimationFrame(() => {
          ensureTocVisibility();
          updatePositionFromChatElement();
        });
      });
      
      chatObserverRef.current.observe(chatElement, {
        attributes: true,
        attributeFilter: ['style', 'class', 'width'],
        subtree: true
      });
    }
    
    // Set up a periodic check to ensure TOC is always visible
    const visibilityInterval = setInterval(() => {
      ensureTocVisibility();
    }, 2000);
    
    // Set up observer to watch for changes in the document
    const contentObserver = new MutationObserver(() => {
      updateHeadingList();
      ensureTocVisibility();
    });
    
    // Watch for resize events with a more responsive approach
    const resizeObserver = new ResizeObserver((entries) => {
      // Use requestAnimationFrame to sync with browser render cycle
      requestAnimationFrame(() => {
        updatePositionFromChatElement();
        ensureTocVisibility();
      });
    });
    
    // Add resize observer to chat element if found
    if (chatElement) {
      resizeObserver.observe(chatElement);
    }
    
    // Also observe the document body for layout changes
    resizeObserver.observe(document.body);
    
    // Observe changes to the editor container
    const editorContent = document.querySelector('.slate-editable, [contenteditable=true], .ProseMirror');
    if (editorContent) {
      contentObserver.observe(editorContent, { 
        childList: true, 
        subtree: true,
        characterData: true 
      });
      resizeObserver.observe(editorContent);
    }
    
    // Listen for window resize and scroll events
    const handleWindowResize = () => {
      requestAnimationFrame(() => {
        updatePositionFromChatElement();
        ensureTocVisibility();
      });
    };
    
    window.addEventListener('resize', handleWindowResize);
    
    // Note: We don't reposition on scroll - keep it fixed to toolbar/chat
    
    // Critical: Listen for selection changes and ensure TOC visibility
    const handleSelectionChange = () => {
      ensureTocVisibility();
    };
    
    // Critical: Listen for editor focus changes
    const handleEditorFocus = () => {
      ensureTocVisibility();
    };
    
    document.addEventListener('selectionchange', handleSelectionChange);
    
    // Add focus event listeners to the editor
    const editorElement = document.querySelector('[contenteditable=true]');
    if (editorElement) {
      editorElement.addEventListener('focus', handleEditorFocus);
      editorElement.addEventListener('blur', handleEditorFocus);
      editorElement.addEventListener('input', ensureTocVisibility);
    }
    
    // Try to hook into any drag events that might be used for resizing
    document.addEventListener('mousedown', function(e) {
      const handleMouseMove = () => {
        requestAnimationFrame(() => {
          updatePositionFromChatElement();
          ensureTocVisibility();
        });
      };
      
      const handleMouseUp = () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
      
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    });
    
    // Check for DOM changes that might affect layout but not trigger resize events
    const domChangeObserver = new MutationObserver((mutations) => {
      requestAnimationFrame(() => {
        updatePositionFromChatElement();
        ensureTocVisibility();
      });
    });
    
    domChangeObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class']
    });
    
    // Additional key press listening to ensure visibility during typing
    const handleKeyPress = () => {
      ensureTocVisibility();
    };
    
    document.addEventListener('keydown', handleKeyPress);
    document.addEventListener('keyup', handleKeyPress);
    
    // Clean up
    return () => {
      if (chatObserverRef.current) {
        chatObserverRef.current.disconnect();
      }
      contentObserver.disconnect();
      resizeObserver.disconnect();
      domChangeObserver.disconnect();
      window.removeEventListener('resize', handleWindowResize);
      document.removeEventListener('selectionchange', handleSelectionChange);
      document.removeEventListener('keydown', handleKeyPress);
      document.removeEventListener('keyup', handleKeyPress);
      
      clearTimeout(initialVisibilityCheck);
      clearInterval(visibilityInterval);
      
      if (editorElement) {
        editorElement.removeEventListener('focus', handleEditorFocus);
        editorElement.removeEventListener('blur', handleEditorFocus);
        editorElement.removeEventListener('input', ensureTocVisibility);
      }
    };
  }, []);
  
  const hasHeadings = headingList.length > 0;
  
  const scrollToHeading = (heading: TocHeading) => {
    // Find the heading element by its ID
    const element = document.getElementById(heading.id);
    if (element) {
      // Scroll to the element with a small offset from the top
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      
      // Force visibility after scrolling
      ensureTocVisibility();
    }
  };
  
  return (
    <div 
      ref={tocRef}
      className="fixed z-50" 
      style={{ 
        top: `${positionRef.current.top}px`,
        right: `${positionRef.current.right}px`,
        position: 'fixed',
        display: 'block', 
        opacity: '1',
        zIndex: 9999, // Ensure highest z-index
        pointerEvents: 'auto' // Make sure it can receive mouse events
      }}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      {!isExpanded ? (
        // Collapsed state - show only lines
        <div className="py-2 cursor-pointer flex flex-col items-end space-y-2 pr-1">
          {hasHeadings ? (
            headingList.map((heading) => (
              <div 
                key={heading.id}
                className={cn(
                  "bg-neutral-600 rounded-full transition-all duration-100",
                  heading.depth === 1 ? "w-5 h-0.5" : 
                  heading.depth === 2 ? "w-3 h-0.5" : 
                  "w-2 h-0.5 opacity-80"
                )}
              />
            ))
          ) : (
            // Show placeholder lines if no headings
            <>
              <div className="w-5 h-0.5 bg-neutral-600 rounded-full"></div>
              <div className="w-3 h-0.5 bg-neutral-400 rounded-full"></div>
              <div className="w-2 h-0.5 bg-neutral-300 rounded-full"></div>
            </>
          )}
        </div>
      ) : (
        // Expanded state - show full TOC
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-3 min-w-[180px] max-w-[220px] animate-in fade-in zoom-in-95 duration-150">
          <div className="text-blue-500 text-sm font-medium mb-2">Table of Contents</div>
          
          {hasHeadings ? (
            <div className="space-y-1.5">
              {headingList.map((heading) => (
                <div 
                  key={heading.id}
                  className="cursor-pointer hover:text-blue-500 transition-colors"
                  onClick={() => scrollToHeading(heading)}
                >
                  <div 
                    className={cn(
                      "text-gray-600 truncate",
                      heading.depth === 1 ? "text-sm font-medium" : 
                      heading.depth === 2 ? "text-xs pl-2" : 
                      "text-xs pl-4 opacity-90"
                    )}
                  >
                    {heading.title}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-gray-500">
              Add headings to your document to create a table of contents.
            </div>
          )}
        </div>
      )}
    </div>
  );
} 