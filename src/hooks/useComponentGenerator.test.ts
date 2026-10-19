import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useComponentGenerator } from './useComponentGenerator';
import { STORAGE_KEYS } from '../utils/storage';

describe('useComponentGenerator', () => {
  it('저장된 컴포넌트 목록으로 시작한다', () => {
    localStorage.setItem(
      STORAGE_KEYS.components,
      JSON.stringify([{ id: 'a', prompt: '카드', code: 'render(<A />)', createdAt: '2026-10-19T02:00:00.000Z' }]),
    );

    const { result } = renderHook(() => useComponentGenerator());

    expect(result.current.components.map((c) => c.prompt)).toEqual(['카드']);
  });
});
