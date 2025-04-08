'use client';

import { type ReactNode, createContext, useContext, useState } from 'react';

import { cn } from '@udecode/cn';
import { CopilotPlugin } from '@udecode/plate-ai/react';
import { useEditorPlugin } from '@udecode/plate/react';
import {
  Check,
  ChevronsUpDown,
  ExternalLinkIcon,
  Eye,
  EyeOff,
  Settings,
  Wand2Icon,
} from 'lucide-react';

import { Button } from '@/components/plate-ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/plate-ui/command';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/plate-ui/dialog';
import { Input } from '@/components/plate-ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/plate-ui/popover';

interface Model {
  label: string;
  value: string;
}

interface SettingsContextType {
  keys: Record<string, string>;
  model: Model;
  setKey: (service: string, key: string) => void;
  setModel: (model: Model) => void;
}

const models: Model[] = [
  {
    label: 'GPT-3.5 Turbo',
    value: 'gpt-3.5-turbo',
  },
  {
    label: 'GPT-4 Turbo',
    value: 'gpt-4-turbo-preview',
  },
  {
    label: 'GPT-4o',
    value: 'gpt-4o',
  },
  {
    label: 'Claude 3 Opus',
    value: 'claude-3-opus-20240229',
  },
  {
    label: 'Claude 3 Sonnet',
    value: 'claude-3-sonnet-20240229',
  },
  {
    label: 'Claude 3 Haiku',
    value: 'claude-3-haiku-20240307',
  },
];

const SettingsContext = createContext<SettingsContextType | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [keys, setKeys] = useState<Record<string, string>>(() => {
    const storedKeys = typeof window !== 'undefined' ? localStorage.getItem('api-keys') : null;
    
    // Get environment variables
    const envOpenAI = import.meta.env.VITE_OPENAI_API_KEY as string;
    
    console.log('Environment OpenAI API key available:', !!envOpenAI);
    
    // Use local storage or fallback to environment variables
    if (storedKeys) {
      const parsed = JSON.parse(storedKeys);
      return {
        openai: parsed.openai || envOpenAI || '',
      };
    }
    
    // If no local storage, use environment variables
    return {
      openai: envOpenAI || '',
    };
  });
  const [model, setModel] = useState<Model>(models[1]);

  const setKey = (service: string, key: string) => {
    setKeys((prev) => {
      const newKeys = { ...prev, [service]: key };
      // Save to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('api-keys', JSON.stringify(newKeys));
      }
      return newKeys;
    });
  };

  return (
    <SettingsContext.Provider value={{ keys, model, setKey, setModel }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);

  return (
    context ?? {
      keys: {
        openai: '',
      },
      model: models[0],
      setKey: () => {},
      setModel: () => {},
    }
  );
}

export function SettingsDialog() {
  const { keys, model, setKey, setModel } = useSettings();
  const [tempKeys, setTempKeys] = useState(keys);
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [open, setOpen] = useState(false);
  const [openModel, setOpenModel] = useState(false);

  const { getOptions, setOption } = useEditorPlugin(CopilotPlugin);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    Object.entries(tempKeys).forEach(([service, key]) => {
      setKey(service, key);
    });
    setOpen(false);

    // Update AI options if needed
    const completeOptions = getOptions().completeOptions ?? {};
    setOption('completeOptions', {
      ...completeOptions,
      body: {
        ...completeOptions.body,
        apiKey: tempKeys.openai,
        model: model.value,
      },
    });
  };

  const toggleKeyVisibility = (key: string) => {
    setShowKey((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const renderApiKeyInput = (service: string, label: string) => (
    <div className="group relative">
      <div className="flex items-center justify-between">
        <label
          className="absolute top-1/2 block -translate-y-1/2 cursor-text px-1 text-sm text-muted-foreground/70 transition-all group-focus-within:pointer-events-none group-focus-within:top-0 group-focus-within:cursor-default group-focus-within:text-xs group-focus-within:font-medium group-focus-within:text-foreground has-[+input:not(:placeholder-shown)]:pointer-events-none has-[+input:not(:placeholder-shown)]:top-0 has-[+input:not(:placeholder-shown)]:cursor-default has-[+input:not(:placeholder-shown)]:text-xs has-[+input:not(:placeholder-shown)]:font-medium has-[+input:not(:placeholder-shown)]:text-foreground"
          htmlFor={label}
        >
          <span className="inline-flex bg-background px-2">{label}</span>
        </label>
        <Button
          asChild
          size="icon"
          variant="ghost"
          className="absolute top-0 right-[28px] h-full"
        >
          <a
            className="flex items-center"
            href="https://platform.openai.com/api-keys"
            rel="noopener noreferrer"
            target="_blank"
          >
            <ExternalLinkIcon className="size-4" />
            <span className="sr-only">Get {label}</span>
          </a>
        </Button>
      </div>

      <Input
        id={label}
        className="pr-10"
        value={tempKeys[service]}
        onChange={(e) =>
          setTempKeys((prev) => ({ ...prev, [service]: e.target.value }))
        }
        placeholder=""
        data-1p-ignore
        type={showKey[service] ? 'text' : 'password'}
      />
      <Button
        size="icon"
        variant="ghost"
        className="absolute top-0 right-0 h-full"
        onClick={() => toggleKeyVisibility(service)}
        type="button"
      >
        {showKey[service] ? (
          <EyeOff className="size-4" />
        ) : (
          <Eye className="size-4" />
        )}
        <span className="sr-only">
          {showKey[service] ? 'Hide' : 'Show'} {label}
        </span>
      </Button>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="icon"
          variant="default"
          className={cn(
            'group fixed right-4 bottom-4 z-50 size-10 overflow-hidden',
            'rounded-full shadow-md hover:shadow-lg',
            'transition-all duration-300 ease-in-out hover:w-[106px]'
          )}
          data-block-hide
        >
          <div className="flex size-full items-center justify-start gap-2">
            <Settings className="ml-1.5 size-4" />
            <span
              className={cn(
                'whitespace-nowrap opacity-0 transition-all duration-300 ease-in-out',
                'group-hover:translate-x-0 group-hover:opacity-100',
                '-translate-x-2'
              )}
            >
              Settings
            </span>
          </div>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-xl">Settings</DialogTitle>
          <DialogDescription>
            Configure your API keys and preferences.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-10" onSubmit={handleSubmit}>
          {/* AI Settings Group */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-full bg-purple-100 p-2 dark:bg-purple-900">
                <Wand2Icon className="size-4 text-purple-600 dark:text-purple-400" />
              </div>
              <h4 className="font-semibold">AI</h4>
            </div>

            <div className="space-y-4">
              {renderApiKeyInput('openai', 'OpenAI API key')}
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit">Save Changes</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
