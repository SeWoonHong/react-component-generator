import { describe, it, expect } from 'vitest';
import { validatePromptLength } from './validatePrompt';

describe('validatePromptLength', () => {
  it('500자 이하 프롬프트는 유효하다', () => {
    expect(validatePromptLength('프로필 카드').isValid).toBe(true);
  });

  it('500자를 넘으면 유효하지 않다', () => {
    expect(validatePromptLength('가'.repeat(501)).isValid).toBe(false);
  });

  it('앞뒤 공백은 글자 수에 포함하지 않는다', () => {
    expect(validatePromptLength(`  ${'가'.repeat(500)}\n `).isValid).toBe(true);
  });

  it('이모지는 한 글자로 센다', () => {
    expect(validatePromptLength('😀'.repeat(500)).isValid).toBe(true);
  });

  it('앞뒤 공백을 제외한 글자 수를 함께 반환한다', () => {
    expect(validatePromptLength(' 카드 😀 ').length).toBe(4);
  });
});
