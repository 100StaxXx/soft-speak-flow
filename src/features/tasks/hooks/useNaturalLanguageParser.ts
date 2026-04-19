import { useCallback, useEffect, useState } from 'react';

import {
  parseNaturalLanguage,
  type ParsedTask,
} from '@/shared/naturalLanguageTaskParser';

export { parseNaturalLanguage, type ParsedTask };

export function useNaturalLanguageParser() {
  const [input, setInput] = useState('');
  const [parsed, setParsed] = useState<ParsedTask | null>(null);

  useEffect(() => {
    if (input.trim()) {
      setParsed(parseNaturalLanguage(input));
    } else {
      setParsed(null);
    }
  }, [input]);

  const reset = useCallback(() => {
    setInput('');
    setParsed(null);
  }, []);

  return { input, setInput, parsed, reset };
}
