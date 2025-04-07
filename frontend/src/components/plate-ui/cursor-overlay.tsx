'use client';

import React from 'react';

import { cn } from '@udecode/cn';
import { RangeApi } from '@udecode/plate';
import {
  type CursorData,
  type CursorOverlayState,
  useCursorOverlay,
} from '@udecode/plate-selection/react';

export function Cursor({
  id,
  caretPosition,
  data,
  selection,
  selectionRects,
}: CursorOverlayState<CursorData>) {
  const { style, selectionStyle = style } = data ?? ({} as CursorData);
  const isCursor = RangeApi.isCollapsed(selection);

  return (
    <>
      {selectionRects.map((position, i) => {
        return (
          <div
            key={i}
            className={cn(
              'pointer-events-none absolute z-10',
              id === 'selection' && 'bg-brand/25',
              id === 'selection' && isCursor && 'bg-primary'
            )}
            style={{
              ...selectionStyle,
              ...position,
            }}
          />
        );
      })}
      {caretPosition && (
        <div
          className={cn(
            'pointer-events-none absolute z-10 w-0.5',
            id === 'drag' && 'w-px bg-brand'
          )}
          style={{ ...caretPosition, ...style }}
        />
      )}
    </>
  );
}

export function CursorOverlay() {
  const { cursors, refresh } = useCursorOverlay({
    minSelectionWidth: 1,
    refreshOnResize: true,
  });

  return (
    <>
      {cursors.map((cursor) => {
        const { id } = cursor;

        return (
          <div key={id}>
            {cursor.selectionRects.map((rect, i) => (
              <div
                key={i}
                className="bg-blue-500/30 absolute pointer-events-none"
                style={{
                  left: rect.left,
                  top: rect.top,
                  width: rect.width,
                  height: rect.height,
                }}
              />
            ))}
          </div>
        );
      })}
    </>
  );
}
