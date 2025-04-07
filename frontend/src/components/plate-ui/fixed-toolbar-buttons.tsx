'use client';

import React from 'react';

import {
  BoldPlugin,
  CodePlugin,
  ItalicPlugin,
  StrikethroughPlugin,
  UnderlinePlugin,
} from '@udecode/plate-basic-marks/react';
import {
  FontColorPlugin,
} from '@udecode/plate-font/react';
import { HighlightPlugin } from '@udecode/plate-highlight/react';
import {
  ImagePlugin,
} from '@udecode/plate-media/react';
import { useEditorRef, useEditorReadOnly } from '@udecode/plate/react';
import {
  AlignCenterIcon,
  BaselineIcon,
  BoldIcon,
  Code2Icon,
  HighlighterIcon,
  ItalicIcon,
  ListIcon,
  MoreHorizontalIcon,
  PencilIcon,
  StrikethroughIcon,
  TableIcon,
  TextIcon,
  UnderlineIcon,
  WandSparklesIcon,
  PlusIcon,
  ListIcon as ListIconLucide,
  SquareIcon,
  ChevronRightIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  ImageIcon,
  Link2Icon,
  CodeIcon,
  QuoteIcon,
  MinusIcon,
  ListOrderedIcon,
  CalculatorIcon,
  TrashIcon,
} from 'lucide-react';

import { MoreDropdownMenu } from '@/components/plate-ui/more-dropdown-menu';

import { AIToolbarButton } from './ai-toolbar-button';
import { AlignDropdownMenu } from './align-dropdown-menu';
import { ColorDropdownMenu } from './color-dropdown-menu';
import { CommentToolbarButton } from './comment-toolbar-button';
import { FontSizeToolbarButton } from './font-size-toolbar-button';
import { RedoToolbarButton, UndoToolbarButton } from './history-toolbar-button';
import {
  BulletedIndentListToolbarButton,
  NumberedIndentListToolbarButton,
} from './indent-list-toolbar-button';
import { IndentTodoToolbarButton } from './indent-todo-toolbar-button';
import { IndentToolbarButton } from './indent-toolbar-button';
import { InsertDropdownMenu } from './insert-dropdown-menu';
import { LineHeightDropdownMenu } from './line-height-dropdown-menu';
import { LinkToolbarButton } from './link-toolbar-button';
import { MarkToolbarButton } from './mark-toolbar-button';
import { MediaToolbarButton } from './media-toolbar-button';
import { ModeDropdownMenu } from './mode-dropdown-menu';
import { OutdentToolbarButton } from './outdent-toolbar-button';
import { TableDropdownMenu } from './table-dropdown-menu';
import { ToggleToolbarButton } from './toggle-toolbar-button';
import { ToolbarButton, ToolbarGroup } from './toolbar';
import { TurnIntoDropdownMenu } from './turn-into-dropdown-menu';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
} from './dropdown-menu';

// Create a Format dropdown menu that contains text formatting options
function FormatDropdownMenu() {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <ToolbarButton tooltip="Format" isDropdown>
          <TextIcon />
        </ToolbarButton>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="min-w-[220px]">
        <DropdownMenuGroup>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <TextIcon className="mr-2 h-4 w-4" />
              <span>Text Style</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent>
                <DropdownMenuItem>
                  <MarkToolbarButton nodeType={BoldPlugin.key} tooltip="Bold">
                    <BoldIcon className="mr-2 h-4 w-4" />
                    <span>Bold</span>
                  </MarkToolbarButton>
                </DropdownMenuItem>
                
                <DropdownMenuItem>
                  <MarkToolbarButton nodeType={ItalicPlugin.key} tooltip="Italic">
                    <ItalicIcon className="mr-2 h-4 w-4" />
                    <span>Italic</span>
                  </MarkToolbarButton>
                </DropdownMenuItem>
                
                <DropdownMenuItem>
                  <MarkToolbarButton nodeType={UnderlinePlugin.key} tooltip="Underline">
                    <UnderlineIcon className="mr-2 h-4 w-4" />
                    <span>Underline</span>
                  </MarkToolbarButton>
                </DropdownMenuItem>
                
                <DropdownMenuItem>
                  <MarkToolbarButton nodeType={StrikethroughPlugin.key} tooltip="Strikethrough">
                    <StrikethroughIcon className="mr-2 h-4 w-4" />
                    <span>Strikethrough</span>
                  </MarkToolbarButton>
                </DropdownMenuItem>
                
                <DropdownMenuItem>
                  <MarkToolbarButton nodeType={HighlightPlugin.key} tooltip="Highlight">
                    <HighlighterIcon className="mr-2 h-4 w-4" />
                    <span>Highlight</span>
                  </MarkToolbarButton>
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>
          
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <BaselineIcon className="mr-2 h-4 w-4" />
              <span>Text Color</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent className="min-w-[180px]">
                <DropdownMenuItem>
                  <div className="flex items-center">
                    <div className="mr-2 h-4 w-4 rounded-sm bg-black" />
                    <span>Black</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <div className="flex items-center">
                    <div className="mr-2 h-4 w-4 rounded-sm bg-gray-500" />
                    <span>Gray</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <div className="flex items-center">
                    <div className="mr-2 h-4 w-4 rounded-sm bg-red-500" />
                    <span>Red</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <div className="flex items-center">
                    <div className="mr-2 h-4 w-4 rounded-sm bg-blue-500" />
                    <span>Blue</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <div className="flex items-center">
                    <div className="mr-2 h-4 w-4 rounded-sm bg-green-500" />
                    <span>Green</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <div className="flex items-center">
                    <div className="mr-2 h-4 w-4 rounded-sm bg-yellow-500" />
                    <span>Yellow</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <div className="flex items-center">
                    <div className="mr-2 h-4 w-4 rounded-sm bg-purple-500" />
                    <span>Purple</span>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>
        </DropdownMenuGroup>
        
        <DropdownMenuGroup>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <AlignCenterIcon className="mr-2 h-4 w-4" />
              <span>Alignment</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent>
                <DropdownMenuItem>
                  <div className="flex items-center">
                    <span className="i-heroicons-bars-3-center-left mr-2 h-4 w-4" />
                    <span>Align left</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <div className="flex items-center">
                    <AlignCenterIcon className="mr-2 h-4 w-4" />
                    <span>Align center</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <div className="flex items-center">
                    <span className="i-heroicons-bars-3-center-right mr-2 h-4 w-4" />
                    <span>Align right</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <div className="flex items-center">
                    <span className="i-heroicons-bars-3 mr-2 h-4 w-4" />
                    <span>Align justify</span>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>
        </DropdownMenuGroup>
        
        <DropdownMenuGroup>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <span className="i-heroicons-bars-3-bottom-left mr-2 h-4 w-4" />
              <span>Line Height</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent>
                <DropdownMenuItem>
                  <div className="flex items-center">
                    <span className="i-heroicons-bars-3-bottom-left-scale-1 mr-2 h-4 w-4" />
                    <span>1</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <div className="flex items-center">
                    <span className="i-heroicons-bars-3-bottom-left-scale-1.2 mr-2 h-4 w-4" />
                    <span>1.2</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <div className="flex items-center">
                    <span className="i-heroicons-bars-3-bottom-left-scale-1.5 mr-2 h-4 w-4" />
                    <span>1.5</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <div className="flex items-center">
                    <span className="i-heroicons-bars-3-bottom-left-scale-2 mr-2 h-4 w-4" />
                    <span>2</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <div className="flex items-center">
                    <span className="i-heroicons-bars-3-bottom-left-scale-3 mr-2 h-4 w-4" />
                    <span>3</span>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function FixedToolbarButtons() {
  const readOnly = useEditorReadOnly();
  const editor = useEditorRef();

  // Function to handle image insertion
  const handleImageInsert = () => {
    // Ensure editor is focused before inserting
    editor.tf.focus();
    
    // Create an image picker element
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    
    // Handle when files are selected
    input.onchange = async (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files && files.length > 0) {
        // For each file, create a temporary URL and insert it directly
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const url = URL.createObjectURL(file);
          
          // Insert the image node directly
          editor.tf.insertNodes({
            type: 'image',
            children: [{ text: '' }],
            url: url,
            width: 300, // Default width
          });
        }
      }
    };
    
    // Trigger the file selection dialog
    input.click();
  };

  return (
    <div className="flex w-full flex-wrap gap-0.5">
      {!readOnly && (
        <>
          <ToolbarGroup>
            <UndoToolbarButton />
            <RedoToolbarButton />
          </ToolbarGroup>

          <ToolbarGroup>
            <AIToolbarButton tooltip="AI commands">
              <WandSparklesIcon />
            </AIToolbarButton>
          </ToolbarGroup>
          
          <ToolbarGroup>
            <TurnIntoDropdownMenu />
          </ToolbarGroup>

          <ToolbarGroup>
            <FontSizeToolbarButton />
            <MarkToolbarButton nodeType={BoldPlugin.key} tooltip="Bold (⌘+B)">
              <BoldIcon />
            </MarkToolbarButton>
            <MarkToolbarButton
              nodeType={ItalicPlugin.key}
              tooltip="Italic (⌘+I)"
            >
              <ItalicIcon />
            </MarkToolbarButton>
          </ToolbarGroup>
          
          <ToolbarGroup>
            <FormatDropdownMenu />
            
            <ToolbarButton tooltip="Image" onClick={handleImageInsert}>
              <ImageIcon />
            </ToolbarButton>
            
            <TableDropdownMenu />
            
            <LinkToolbarButton />
            
            <OutdentToolbarButton />
            <IndentToolbarButton />
          </ToolbarGroup>
        </>
      )}

      <div className="grow" />

      <ToolbarGroup>
        <CommentToolbarButton />
      </ToolbarGroup>

      <ToolbarGroup>
        <ModeDropdownMenu />
      </ToolbarGroup>
    </div>
  );
}
