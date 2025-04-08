'use client';

import React, { useEffect, useState } from 'react';

import { cn, withRef } from '@udecode/cn';
import { useDraggable } from '@udecode/plate-dnd';
import { Image, ImagePlugin, useMediaState } from '@udecode/plate-media/react';
import { ResizableProvider, useResizableValue } from '@udecode/plate-resizable';
import { PlateElement, withHOC } from '@udecode/plate/react';

import { Caption, CaptionTextarea } from './caption';
import { MediaPopover } from './media-popover';
import {
  mediaResizeHandleVariants,
  Resizable,
  ResizeHandle,
} from './resizable';

// Get the API base URL from environment or use the default
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

// Function to ensure URLs are absolutes
const ensureAbsoluteUrl = (url: string) => {
  if (url.startsWith('http')) {
    return url;
  }
  
  if (url.startsWith('/api/')) {
    return `${API_BASE_URL}${url}`;
  }
  
  return url;
};

export const ImageElement = withHOC(
  ResizableProvider,
  withRef<typeof PlateElement>(
    ({ children, className, nodeProps, ...props }, ref) => {
      const { align = 'center', focused, readOnly, selected } = useMediaState();
      const width = useResizableValue('width');
      const [imageUrl, setImageUrl] = useState(nodeProps?.url || '');
      
      useEffect(() => {
        if (nodeProps?.url) {
          setImageUrl(ensureAbsoluteUrl(nodeProps.url));
        }
      }, [nodeProps?.url]);

      const { isDragging, handleRef } = useDraggable({
        element: props.element,
      });

      return (
        <MediaPopover plugin={ImagePlugin}>
          <PlateElement
            ref={ref}
            className={cn(className, 'py-2.5')}
            {...props}
          >
            <figure className="group relative m-0" contentEditable={false}>
              <Resizable
                align={align}
                options={{
                  align,
                  readOnly,
                }}
              >
                <ResizeHandle
                  className={mediaResizeHandleVariants({ direction: 'left' })}
                  options={{ direction: 'left' }}
                />
                <Image
                  ref={handleRef}
                  className={cn(
                    'block w-full max-w-full cursor-pointer object-cover px-0',
                    'rounded-sm',
                    focused && selected && 'ring-2 ring-ring ring-offset-2',
                    isDragging && 'opacity-50'
                  )}
                  alt=""
                  {...{...nodeProps, url: imageUrl}}
                />
                <ResizeHandle
                  className={mediaResizeHandleVariants({
                    direction: 'right',
                  })}
                  options={{ direction: 'right' }}
                />
              </Resizable>

              <Caption style={{ width }} align={align}>
                <CaptionTextarea
                  readOnly={readOnly}
                  onFocus={(e) => {
                    e.preventDefault();
                  }}
                  placeholder="Write a caption..."
                />
              </Caption>
            </figure>

            {children}
          </PlateElement>
        </MediaPopover>
      );
    }
  )
);
