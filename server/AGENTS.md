# server/AGENTS.md

## Module Context

Bun 런타임에서 실행되는 AI 프록시 서버. 프론트엔드의 `/api/*` 요청(Vite 프록시 경유)을 받아 Anthropic 또는 Google API를 스트리밍으로 호출하고, 받은 텍스트를 NDJSON으로 중계한 뒤 마지막에 react-live에서 실행 가능한 코드로 정규화해 보낸다.

## Tech Stack & Constraints

- 런타임은 Bun 전용 (`Bun.serve`, `server/index.ts:131`). Node나 Express로 바꾸지 말 것.
- AI SDK 없이 `fetch`로 REST API를 직접 호출한다 (`server/index.ts:79`, `:109`). SDK 의존성을 새로 추가하지 말고 기존 패턴을 따를 것.
- 브라우저 코드(`src/`)를 import하지 않는다. 타입도 공유하지 않으므로 `Provider`는 `server/index.ts:65`에 별도 정의되어 있다.

## Implementation Patterns

- 모든 응답에 `CORS_HEADERS`를 붙인다 (`server/index.ts:59-63`). 새 엔드포인트와 에러 응답도 동일.
- `/api/generate` 응답 형식: 검증 실패와 스트림을 열기 전 실패는 JSON `{ error }` + HTTP 상태, 성공하면 `application/x-ndjson`으로 `{type:'delta',text}` 반복 → `{type:'done',code}` 또는 `{type:'error',error}` (`server/stream.ts` `toNdjsonStream`). 클라이언트(`src/hooks/useComponentGenerator.ts`)가 이 형식에 맞춰 해석하므로 함께 바꾼다.
- AI 응답 처리 순서는 `stripCodeFences` 다음 `ensureRenderCall`이며, 스트림이 끝난 뒤 `done` 이벤트에만 적용된다 (`server/index.ts:181`). `delta`는 원문 그대로 보낸다. 새 후처리는 `generator.ts`에 순수 함수로 추가하고 이 체인에 끼운다.
- 모델 폴백은 `withModelFallback(models, attempt)`를 사용한다 (`server/fallback.ts:3`). 모델 우선순위는 배열 순서 (`server/index.ts:13`). 폴백은 스트림을 여는 단계(HTTP 상태)까지만 적용된다.
- 사용자에게 보이는 에러 메시지는 한국어로 작성한다 (`server/stream.ts:34-38`). 스트리밍 도중 에러는 HTTP 상태로 전달할 수 없으므로 사용자용 문구로 바로 바꿔 `error` 이벤트로 보낸다.

## Testing Strategy

- 실행: `bun run test server` (Vitest. `bun test` 아님)
- 테스트 대상은 부수효과 없는 모듈뿐이다: `generator.ts`, `fallback.ts`, `stream.ts`. `index.ts`는 import 시 서버가 뜨므로 테스트하지 않는다.
- 로직을 추가할 때는 `index.ts`에 직접 쓰지 말고 순수 함수로 분리한 뒤 `*.test.ts`를 함께 작성한다. 비동기 의존성은 `vi.fn`으로 주입한다 (`server/fallback.test.ts` 패턴). 스트림 입력은 async generator로 흉내 낸다 (`server/stream.test.ts` 패턴).

## Local Golden Rules

### Do's

- 프로바이더 호출 함수에서 HTTP 실패 시 반드시 `` `... API error: ${response.status}` `` 형식으로 throw 한다 (`server/index.ts:96`, `:120`). 상위 catch가 메시지 문자열에 `503`/`429`가 포함되는지로 상태 코드를 분기한다 (`server/index.ts:189`, `:196`). 형식을 바꾸면 과부하·요청 제한 안내가 500으로 떨어진다. 이 검사는 스트림을 반환하기 전에 해야 한다.
- 시스템 프롬프트의 "render 호출 필수" 규칙(`server/index.ts:20`)과 `ensureRenderCall`(`server/generator.ts:16-24`)은 같은 위험을 이중으로 막는다. 모델이 규칙을 어겨도 미리보기가 동작하도록 둘 다 유지한다.
- 시스템 프롬프트의 TypeScript 금지 규칙(`server/index.ts:28`)을 지우지 말 것. react-live는 TS 문법을 실행하지 못하며 서버 측 후처리로 TS를 제거하는 장치는 없다.

### Don'ts

- Google API 키는 URL 쿼리 문자열에 들어간다 (`server/index.ts:107`). 요청 URL이나 `fetch` 인자를 로그로 남기지 말 것. 에러 메시지에도 URL을 포함하지 말 것 (현재 catch는 `message`를 그대로 클라이언트로 반환한다, `server/index.ts:203-206`. 스트리밍 도중 에러도 `error` 이벤트로 메시지를 그대로 보낸다).
- 프로바이더 간 처리가 비대칭이다. Google만 모델 폴백(`server/index.ts:128`)이 있고 Anthropic은 단일 모델·`max_tokens: 4096`이다 (`server/index.ts:88`). 잘림 감지는 양쪽 모두 있다 (Anthropic `stop_reason: max_tokens` `server/stream.ts:61-63`, Google `MAX_TOKENS` `server/stream.ts:92-94`). 한쪽 동작을 바꿀 때 다른 쪽에도 필요한지 확인하고, 의도적으로 다르게 둔다면 이유를 주석으로 남길 것.
- 클라이언트가 보낸 `apiKey`가 환경변수보다 우선한다 (`server/index.ts:72-74`). 이 우선순위를 뒤집지 말 것. UI 문구(`src/App.tsx` 키 상태 안내)가 이 동작을 전제로 한다.
