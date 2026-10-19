import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { usePersistentState } from './usePersistentState';

const parseNumber = (raw: string) => Number(JSON.parse(raw));

describe('usePersistentState', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('저장된 값이 있으면 그 값으로 시작한다', () => {
    localStorage.setItem('count', '7');

    const { result } = renderHook(() => usePersistentState('count', 0, parseNumber));

    expect(result.current[0]).toBe(7);
  });

  it('값을 바꾸면 JSON으로 저장한다', () => {
    const { result } = renderHook(() => usePersistentState('count', 0, parseNumber));

    act(() => result.current[1](3));

    expect(localStorage.getItem('count')).toBe('3');
  });

  it('저장소를 읽을 수 없으면 초기값으로 시작한다', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });

    const { result } = renderHook(() => usePersistentState('count', 5, parseNumber));

    expect(result.current[0]).toBe(5);
  });

  it('저장에 실패해도 화면 상태는 바뀐다', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    const { result } = renderHook(() => usePersistentState('count', 0, parseNumber));

    act(() => result.current[1](9));

    expect(result.current[0]).toBe(9);
  });
});
