'use client';

import { withCn } from '@udecode/cn';

import { Toolbar } from './toolbar';

export const FixedToolbar = withCn(
  Toolbar,
  'sticky top-[41px] left-0 z-40 scrollbar-hide w-full justify-between overflow-x-auto rounded-none border-b border-b-border bg-white p-1 flex-wrap'
);
