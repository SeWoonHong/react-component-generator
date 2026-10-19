#!/usr/bin/env bash
# PreToolUse(Bash) 훅: git commit 명령이면 전체 테스트를 실행하고, 실패하면 커밋을 막는다.
# 종료 코드 0 = 허용, 2 = 차단 (stderr 내용이 에이전트에게 전달됨)

set -u

command=$(jq -r '.tool_input.command // empty')

# git commit이 아니면 그냥 통과 (git -C <dir> commit, git -c k=v commit, && 연결 포함)
commit_pattern='(^|[;&|(]|[[:space:]])git([[:space:]]+(-C|-c)[[:space:]]+[^[:space:]]+|[[:space:]]+--?[^[:space:]]+)*[[:space:]]+commit([[:space:]]|$)'
if ! printf '%s' "$command" | grep -Eq "$commit_pattern"; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel)}" || {
  echo "프로젝트 디렉토리로 이동하지 못해 커밋을 차단했습니다." >&2
  exit 2
}

# bun test가 아닌 bun run test (vitest + jsdom 설정 적용)
if output=$(bun run test 2>&1); then
  exit 0
fi

{
  echo "테스트가 실패해서 커밋을 차단했습니다. 테스트를 모두 통과시킨 뒤 다시 커밋하세요."
  echo "--- bun run test 출력 (마지막 40줄) ---"
  printf '%s\n' "$output" | tail -40
} >&2
exit 2
