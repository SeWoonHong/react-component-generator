import { useEffect, useState } from 'react';

/**
 * useState와 같지만 값을 localStorage에 JSON으로 저장하고, 새로고침하면 되살린다.
 * 사생활 보호 모드나 용량 초과로 저장소를 쓸 수 없어도 화면 상태는 정상 동작한다.
 * `parse`는 저장된 문자열을 검증해 T로 되돌린다 (src/utils/storage.ts의 parse* 함수).
 */
export function usePersistentState<T>(key: string, initial: T, parse: (raw: string) => T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? initial : parse(raw);
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // 저장 실패는 다음 새로고침에서 값이 사라지는 것 외에 영향이 없다.
    }
  }, [key, value]);

  return [value, setValue] as const;
}
