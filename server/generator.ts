// AI 응답 텍스트를 react-live에서 실행 가능한 코드로 정규화하는 순수 함수들.
// 부수효과(Bun.serve 등)가 없어 단위 테스트가 가능하다.

/** 응답에 섞여 나온 마크다운 코드펜스(```)를 제거한다. */
export function stripCodeFences(text: string): string {
  return text
    .replace(/^```(?:jsx|tsx|javascript|typescript)?\n?/gm, '')
    .replace(/```$/gm, '')
    .trim();
}

/**
 * react-live(noInline)는 `render(...)` 호출이 있어야 미리보기를 그린다.
 * 응답에 render 호출이 없으면 첫 컴포넌트 선언을 찾아 자동으로 주입한다.
 */
export function ensureRenderCall(code: string): string {
  if (/\brender\s*\(/.test(code)) return code;

  const match = code.match(/(?:const|function)\s+([A-Z]\w+)/);
  if (match) {
    return `${code}\n\nrender(<${match[1]} />);`;
  }
  return code;
}
