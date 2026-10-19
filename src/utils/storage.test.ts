import { describe, it, expect } from 'vitest';
import {
  addToHistory,
  MAX_HISTORY,
  parseApiKeys,
  parseComponents,
  parseHistory,
  parseProvider,
} from './storage';

describe('parseComponents', () => {
  it('저장된 JSON을 컴포넌트 목록으로 되살리고 createdAt을 Date로 바꾼다', () => {
    const raw = JSON.stringify([
      { id: 'a', prompt: '카드', code: 'render(<A />)', createdAt: '2026-10-19T02:00:00.000Z' },
    ]);

    const [component] = parseComponents(raw);

    expect(component.id).toBe('a');
    expect(component.createdAt).toBeInstanceOf(Date);
    expect(component.createdAt.toISOString()).toBe('2026-10-19T02:00:00.000Z');
  });

  it('JSON이 깨져 있으면 빈 목록을 돌려준다', () => {
    expect(parseComponents('{not json')).toEqual([]);
  });

  it('형태가 맞지 않는 항목은 버리고 올바른 항목만 남긴다', () => {
    const raw = JSON.stringify([
      { id: 'ok', prompt: '카드', code: 'render(<A />)', createdAt: '2026-10-19T02:00:00.000Z' },
      { id: 'no-code', prompt: '카드', createdAt: '2026-10-19T02:00:00.000Z' },
      { id: 'bad-date', prompt: '카드', code: 'x', createdAt: 'yesterday' },
      'string',
      null,
    ]);

    expect(parseComponents(raw).map((c) => c.id)).toEqual(['ok']);
  });
});

describe('addToHistory', () => {
  it('새 프롬프트를 맨 앞에 추가한다', () => {
    expect(addToHistory(['이전 요청'], '새 요청')).toEqual(['새 요청', '이전 요청']);
  });

  it('이미 있는 프롬프트는 중복 없이 맨 앞으로 옮긴다', () => {
    expect(addToHistory(['A', 'B', 'C'], 'B')).toEqual(['B', 'A', 'C']);
  });

  it('최대 10개까지만 남기고 가장 오래된 것부터 버린다', () => {
    const full = Array.from({ length: MAX_HISTORY }, (_, i) => `요청 ${i}`);

    const next = addToHistory(full, '새 요청');

    expect(next).toHaveLength(MAX_HISTORY);
    expect(next[0]).toBe('새 요청');
    expect(next).not.toContain(`요청 ${MAX_HISTORY - 1}`);
  });
});

describe('parseHistory', () => {
  it('문자열 항목만 남긴다', () => {
    expect(parseHistory(JSON.stringify(['카드', 3, null, '필터 바']))).toEqual(['카드', '필터 바']);
  });

  it('JSON이 깨져 있으면 빈 목록을 돌려준다', () => {
    expect(parseHistory('[oops')).toEqual([]);
  });
});

describe('parseProvider', () => {
  it('저장된 provider를 되살린다', () => {
    expect(parseProvider(JSON.stringify('anthropic'))).toBe('anthropic');
  });

  it('알 수 없는 값이면 null을 돌려준다', () => {
    expect(parseProvider(JSON.stringify('openai'))).toBeNull();
  });
});

describe('parseApiKeys', () => {
  it('provider별 키를 되살리고 없거나 문자열이 아닌 값은 빈 문자열로 둔다', () => {
    expect(parseApiKeys(JSON.stringify({ google: 'AIza-test', anthropic: 42, openai: 'x' }))).toEqual({
      anthropic: '',
      google: 'AIza-test',
    });
  });

  it('JSON이 깨져 있으면 모든 키를 빈 문자열로 둔다', () => {
    expect(parseApiKeys('{')).toEqual({ anthropic: '', google: '' });
  });
});
