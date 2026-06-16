import type { Ref, SyntheticEvent } from 'react';

import { Textarea } from '@/components/ui/textarea';

interface BodyEditorProps {
  onFocus?: () => void;
  onChange: (value: string) => void;
  onSelect?: (event: SyntheticEvent<HTMLTextAreaElement>) => void;
  textareaRef?: Ref<HTMLTextAreaElement>;
  value: string;
}

export function BodyEditor({ onChange, onFocus, onSelect, textareaRef, value }: BodyEditorProps) {
  return (
    <Textarea
      ref={textareaRef}
      data-vaul-no-drag
      placeholder="Write the body copy here..."
      value={value}
      onFocus={onFocus}
      onChange={function handleChange(event) {
        onChange(event.target.value);
      }}
      onSelect={onSelect}
      className="min-h-72 resize-y px-3 py-3 text-sm leading-6"
    />
  );
}
