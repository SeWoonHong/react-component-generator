import { useState, useCallback } from 'react';
import type { GeneratedComponent, Provider } from '../types';
import { parseComponents, STORAGE_KEYS } from '../utils/storage';
import { readNdjson } from '../utils/readNdjson';
import { usePersistentState } from './usePersistentState';

type StreamEvent =
  | { type: 'delta'; text: string }
  | { type: 'done'; code: string }
  | { type: 'error'; error: string };

interface UseComponentGeneratorReturn {
  components: GeneratedComponent[];
  streaming: GeneratedComponent | null;
  isLoading: boolean;
  error: string | null;
  generate: (prompt: string, apiKey: string | undefined, provider: Provider) => Promise<void>;
  removeComponent: (id: string) => void;
  clearAll: () => void;
}

export function useComponentGenerator(): UseComponentGeneratorReturn {
  const [components, setComponents] = usePersistentState<GeneratedComponent[]>(
    STORAGE_KEYS.components,
    [],
    parseComponents,
  );
  const [streaming, setStreaming] = useState<GeneratedComponent | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async (prompt: string, apiKey: string | undefined, provider: Provider) => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, ...(apiKey && { apiKey }), provider }),
      });

      // 스트림을 열기 전 실패(키 누락, 429, 503 등)는 JSON 에러로 온다.
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to generate component');
      }

      // 완료 후에도 같은 id를 써서 화면에서 같은 카드가 이어지게 한다.
      const draft: GeneratedComponent = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        prompt,
        code: '',
        createdAt: new Date(),
      };
      setStreaming(draft);
      let code: string | null = null;
      for await (const event of readNdjson(res.body) as AsyncGenerator<StreamEvent>) {
        if (event.type === 'delta') {
          setStreaming((prev) => prev && { ...prev, code: prev.code + event.text });
        } else if (event.type === 'done') {
          code = event.code;
        } else if (event.type === 'error') {
          throw new Error(event.error);
        }
      }

      if (code === null) {
        throw new Error('응답이 중간에 끊겼습니다. 다시 시도해주세요.');
      }

      const newComponent: GeneratedComponent = { ...draft, code };

      setComponents((prev) => [newComponent, ...prev]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
    } finally {
      setStreaming(null);
      setIsLoading(false);
    }
  }, [setComponents]);

  const removeComponent = useCallback((id: string) => {
    setComponents((prev) => prev.filter((c) => c.id !== id));
  }, [setComponents]);

  const clearAll = useCallback(() => {
    setComponents([]);
  }, [setComponents]);

  return { components, streaming, isLoading, error, generate, removeComponent, clearAll };
}
