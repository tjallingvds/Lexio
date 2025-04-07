'use client';

import React, { useState, useEffect } from 'react';
import { FileText } from 'lucide-react';

interface DocxPasteNotificationProps {
  visible: boolean;
  onClose: () => void;
}

export const DocxPasteNotification: React.FC<DocxPasteNotificationProps> = ({
  visible,
  onClose
}) => {
  useEffect(() => {
    if (visible) {
      const timer = setTimeout(() => {
        onClose();
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [visible, onClose]);

  if (!visible) return null;

  return (
    <div className="fixed top-4 right-4 z-50 bg-green-50 border border-green-200 rounded-md shadow-md p-3 flex items-center space-x-2 transition-all duration-300 animate-in slide-in-from-right-5">
      <FileText className="text-green-500" size={20} />
      <div>
        <h3 className="font-medium text-green-700">DOCX Content Pasted</h3>
        <p className="text-xs text-green-600">Word document content has been formatted</p>
      </div>
    </div>
  );
}; 