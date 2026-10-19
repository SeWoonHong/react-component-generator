import type { GeneratedComponent, Provider } from '../types';

export const MAX_HISTORY = 10;

// 앱 이름 접두사를 붙여 같은 origin의 다른 앱과 키가 겹치지 않게 한다.
export const STORAGE_KEYS = {
  apiKeys: 'rcg:apiKeys',
  provider: 'rcg:provider',
  history: 'rcg:promptHistory',
  components: 'rcg:components',
} as const;

// Provider 타입에 값이 추가되면 이 객체에서 타입 오류가 나서 함께 갱신하게 된다.
const EMPTY_API_KEYS: Record<Provider, string> = { anthropic: '', google: '' };
const PROVIDERS = Object.keys(EMPTY_API_KEYS) as Provider[];

// localStorage 값은 다른 버전의 앱이나 사용자가 직접 고친 값일 수 있으므로
// 깨진 JSON이나 형태가 다른 항목은 버리고 읽을 수 있는 것만 살린다.
function parseJSON(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function parseArray(raw: string): unknown[] {
  const value = parseJSON(raw);
  return Array.isArray(value) ? value : [];
}

function toComponent(item: unknown): GeneratedComponent | null {
  if (typeof item !== 'object' || item === null) return null;
  const { id, prompt, code, createdAt } = item as Record<string, unknown>;
  if (typeof id !== 'string' || typeof prompt !== 'string' || typeof code !== 'string') return null;
  if (typeof createdAt !== 'string') return null;
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return null;
  return { id, prompt, code, createdAt: date };
}

export function parseComponents(raw: string): GeneratedComponent[] {
  return parseArray(raw)
    .map(toComponent)
    .filter((c): c is GeneratedComponent => c !== null);
}

export function parseHistory(raw: string): string[] {
  return parseArray(raw).filter((item): item is string => typeof item === 'string');
}

export function addToHistory(history: string[], prompt: string): string[] {
  return [prompt, ...history.filter((item) => item !== prompt)].slice(0, MAX_HISTORY);
}

export function parseProvider(raw: string): Provider | null {
  const value = parseJSON(raw);
  return PROVIDERS.includes(value as Provider) ? (value as Provider) : null;
}

export function parseApiKeys(raw: string): Record<Provider, string> {
  const value = parseJSON(raw);
  const stored = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
  const keys = { ...EMPTY_API_KEYS };
  for (const provider of PROVIDERS) {
    if (typeof stored[provider] === 'string') keys[provider] = stored[provider];
  }
  return keys;
}
