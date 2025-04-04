'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { CheckIcon, Loader2, XCircle, AlertCircle } from 'lucide-react';
import { SaveState } from './plate-editor';

interface SaveIndicatorProps {
  saveState: SaveState;
  className?: string;
}

export const SaveIndicator: React.FC<SaveIndicatorProps> = ({ 
  saveState, 
  className 
}) => {
  return (
    <div className={cn(
      "flex items-center gap-1.5 rounded-md bg-white text-xs text-gray-500 px-2 py-1 shadow-sm border", 
      {
        "border-green-200 bg-green-50": saveState === SaveState.Saved,
        "border-blue-200 bg-blue-50": saveState === SaveState.Saving,
        "border-yellow-200 bg-yellow-50": saveState === SaveState.Unsaved,
        "border-red-200 bg-red-50": saveState === SaveState.Failed,
      },
      className
    )}>
      {saveState === SaveState.Saved && (
        <>
          <CheckIcon className="h-3.5 w-3.5 text-green-500" />
          <span className="text-green-700">Saved</span>
        </>
      )}
      
      {saveState === SaveState.Saving && (
        <>
          <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin" />
          <span className="text-blue-700">Saving...</span>
        </>
      )}
      
      {saveState === SaveState.Unsaved && (
        <>
          <AlertCircle className="h-3.5 w-3.5 text-yellow-500" />
          <span className="text-yellow-700">Unsaved</span>
        </>
      )}
      
      {saveState === SaveState.Failed && (
        <>
          <XCircle className="h-3.5 w-3.5 text-red-500" />
          <span className="text-red-700">Failed to save</span>
        </>
      )}
    </div>
  );
}; 