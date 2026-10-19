# AGENTS.md

프롬프트를 받아 AI(Anthropic / Google)가 생성한 React 컴포넌트를 브라우저에서 즉시 렌더링해 보여주는 도구. 프로젝트 소개와 설치는 README.md 참고.

Stack: React 19, TypeScript 5.9, Vite 8, Bun (API 서버), react-live 4, Vitest 4 + Testing Library (jsdom)

## Operational Commands

패키지 매니저와 런타임은 `bun` 고정. npm/yarn/pnpm으로 설치하지 말 것 (`bun.lock`만 관리됨).

- 개발 실행 (API + Vite 동시): `bun run dev`
- API 서버만: `bun run server` (포트 3002, `--watch`)
- 테스트: `bun run test` — 반드시 `run`을 붙인다. `bun test`는 Bun 내장 러너를 실행해 jsdom 환경과 `src/test/setup.ts`가 적용되지 않는다 (package.json `"test": "vitest run"`).
- 단일 테스트: `bun run test src/components/PromptInput.test.tsx`
- 린트: `bun run lint`
- 프론트 타입 체크 + 빌드: `bun run build`
- 서버 타입 체크 (build에 포함되지 않음, 아래 Golden Rules 참고):
  `bunx tsc --noEmit --strict --target ES2023 --module ESNext --moduleResolution bundler --types bun --skipLibCheck server/index.ts server/generator.ts server/fallback.ts`

작업 완료 전 최소 확인: `bun run test`, `bun run lint`, `bun run build`. `server/`를 수정했다면 서버 타입 체크도 실행.

`git commit`은 PreToolUse 훅(`.claude/hooks/require-tests-pass.sh`)이 `bun run test`를 먼저 실행하고, 실패하면 커밋을 차단한다. 차단되면 훅 출력의 실패 테스트를 고친 뒤 다시 커밋한다. `--no-verify`나 훅 설정 수정으로 우회하지 않는다.

## Golden Rules

### Immutable

- API 키 값은 절대 클라이언트로 내려보내지 않는다. `/api/config`는 키 존재 여부(boolean)만 반환한다 (`server/index.ts:147-156`). 이 응답에 키 문자열이나 일부라도 추가하지 말 것.
- `.env`는 커밋하지 않는다 (`.gitignore`에 등록됨). 워크트리에는 `.worktreeinclude`로 복사되므로 별도 처리 불필요.
- 민감 파일은 읽지도 수정하지도 않는다: `.env`, `.env.*`, 이름에 `secret`/`credential`이 들어간 파일, `*.pem`·`*.key`·`*.p12`·`*.pfx`, `.npmrc`, `~/.ssh`·`~/.aws`·`~/.config/gcloud`. `.claude/settings.json`의 `permissions.deny`로 차단되어 있으며, 셸 명령(`cat`, `grep`, `source`, `printenv` 등)이나 스크립트로 우회하는 것도 금지한다. 키 값이 필요하면 사용자에게 요청하고, 존재 여부 확인은 `/api/config` 응답으로 한다.
- `permissions.deny` 목록을 축소·삭제하지 않는다. 규칙 때문에 막힌 작업이 있으면 사용자에게 알리고 판단을 맡긴다.
- 생성된 코드는 react-live `noInline` 모드로 실행된다 (`src/components/LivePreview.tsx:10`). 따라서 생성 코드는 (1) `render(<X />)` 호출을 포함하고, (2) `import` 문이 없고, (3) TypeScript 문법이 없는 순수 JS여야 한다. 이 셋 중 하나라도 깨지면 미리보기가 렌더링되지 않는다.

### Do's

- `Provider` 타입을 바꿀 때는 두 곳을 함께 수정한다: `src/types/index.ts:1`, `server/index.ts:57`. 공유 모듈이 없어 수동으로 동기화된다.
- 프롬프트 입력 버튼 문구 `컴포넌트 생성` / `생성 중...`는 테스트가 접근성 이름으로 조회한다 (`src/components/PromptInput.test.tsx:9,18,27`). 문구를 바꾸면 테스트도 함께 바꾼다.
- 빈 입력·키 누락 검증은 클라이언트와 서버 양쪽에 있다. 한쪽만 고치지 말고 양쪽을 유지한다:
  - 빈 프롬프트: `src/components/PromptInput.tsx:22,55` / `server/index.ts:176-181`
  - API 키 누락: `src/App.tsx:35-36` / `server/index.ts:169-174`
- 테스트 가능한 서버 로직은 `server/index.ts`가 아닌 부수효과 없는 별도 모듈에 둔다 (`server/generator.ts:1-2`, `server/fallback.ts`). `index.ts`는 import 시 `Bun.serve`가 실행되어 테스트에서 불러올 수 없다.

### Don'ts

- 기본 Provider가 클라이언트(`google`, `src/App.tsx:16`)와 서버(`anthropic`, `server/index.ts:161`)에서 다르다. 클라이언트는 항상 provider를 보내므로 현재 문제는 없지만, 요청 본문에서 `provider`를 빼는 변경을 하지 말 것.
- Vite 프록시 대상 포트(`vite.config.ts:11`)와 서버 포트(`server/index.ts:139`)는 3002로 맞춰져 있다. 한쪽만 바꾸지 말 것.
- `server/`는 `tsconfig.app.json`(`include: ["src"]`)과 `tsconfig.node.json`(`include: ["vite.config.ts"]`) 어디에도 포함되지 않는다. `bun run build`가 통과해도 서버 타입 오류는 잡히지 않으므로 위의 서버 타입 체크 명령을 별도로 실행한다.

## Standards

- UI 문구와 코드 주석은 한국어. 테스트 이름도 한국어 문장으로 작성한다 (`server/*.test.ts`, `src/components/PromptInput.test.tsx`).
- 스타일은 `src/App.css`의 CSS 변수(`src/index.css` `:root`)를 사용한다. 새 색상을 하드코딩하기 전에 기존 토큰을 확인할 것. UI 테마는 레트로 프린터 컨셉(본체, 출력구, 연속 용지)으로 통일되어 있다.
- 커밋: `<type>: <한국어 요약>` (type: feat / fix / refactor / chore). 상세 절차는 `.claude/skills/commit/SKILL.md`.
- PR 본문: 한국어 템플릿 (`.claude/skills/created-pr/references/pr-template-kr.md`). 제목도 `<type>: <한국어 요약>`.
- 기본 브랜치 `main`, 원격 `origin` (GitHub 비공개 저장소).

## Maintenance Policy

이 파일의 규칙(라인 번호 포함)이 실제 코드와 어긋나는 것을 발견하면 작업을 진행하면서 해당 규칙의 업데이트를 제안한다. 근거 라인이 이동했을 뿐이면 라인 번호만 갱신한다.
