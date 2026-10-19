export const MAX_PROMPT_LENGTH = 500;

/**
 * 프롬프트가 글자 수 제한 이내인지 검사한다.
 * 전송 시 trim()된 값이 나가므로 앞뒤 공백은 세지 않고,
 * 이모지처럼 UTF-16 두 칸을 쓰는 문자도 한 글자로 센다.
 */
export function validatePromptLength(prompt: string) {
  const length = Array.from(prompt.trim()).length;
  return { isValid: length <= MAX_PROMPT_LENGTH, length };
}
