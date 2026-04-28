import { Box } from 'lucide-react';

interface SuggestionChipsProps {
  onSelect: (text: string) => void;
}

const SUGGESTIONS = [
  'Plan travel from Trichy to Hyderabad',
  'Research the legitimacy of working for Outlier',
  'Recommend something new to learn this weekend.',
  'Chat Library'
];

export function SuggestionChips({ onSelect }: SuggestionChipsProps) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2.5 px-4">
      {SUGGESTIONS.map(suggestion => (
        <button
          key={suggestion}
          onClick={() => onSelect(suggestion)}
          className="rounded-md border border-foreground/5 bg-background px-2.5 py-1 text-[13px] text-foreground/60 shadow-sm transition-all hover:border-foreground/15 hover:text-foreground/80 active:scale-[0.97] flex items-center"
        >
          {suggestion === SUGGESTIONS[3] && <Box className="size-3.25 mr-2 self-center opacity-40" />}
          {suggestion}
        </button>
      ))}
    </div>
  );
}
