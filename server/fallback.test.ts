import { describe, it, expect, vi } from 'vitest';
import { withModelFallback } from './fallback';

describe('withModelFallback', () => {
  it('첫 모델이 성공하면 그 결과를 반환하고 다음 모델은 시도하지 않는다', async () => {
    const attempt = vi.fn(async (model: string) => `ok:${model}`);

    const result = await withModelFallback(['a', 'b'], attempt);

    expect(result).toBe('ok:a');
    expect(attempt).toHaveBeenCalledTimes(1);
    expect(attempt).toHaveBeenCalledWith('a');
  });

  it('첫 모델이 실패하면 다음 모델로 폴백한다', async () => {
    const attempt = vi.fn(async (model: string) => {
      if (model === 'a') throw new Error('a 실패');
      return `ok:${model}`;
    });

    const result = await withModelFallback(['a', 'b'], attempt);

    expect(result).toBe('ok:b');
    expect(attempt).toHaveBeenCalledTimes(2);
  });

  it('모든 모델이 실패하면 마지막 에러를 던진다', async () => {
    const attempt = vi.fn(async (model: string) => {
      throw new Error(`${model} 실패`);
    });

    await expect(withModelFallback(['a', 'b'], attempt)).rejects.toThrow('b 실패');
    expect(attempt).toHaveBeenCalledTimes(2);
  });

  it('모델 목록이 비어 있으면 에러를 던진다', async () => {
    const attempt = vi.fn();

    await expect(withModelFallback([], attempt)).rejects.toThrow();
    expect(attempt).not.toHaveBeenCalled();
  });
});
