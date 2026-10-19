---
name: created-pr
description: 현재 브랜치의 변경사항(기본 브랜치 대비 커밋과 diff)을 분석해 GitHub Pull Request를 생성한다. 브랜치 푸시, 제목 작성, 템플릿 기반 본문 작성, `gh pr create`까지 한 번에 처리한다. 프로젝트 언어에 따라 한국어(kr) 또는 영어(en) 템플릿을 고른다. "PR 만들어줘", "PR 올려줘", "풀리퀘 생성", "리뷰 요청 올려줘", "create a PR", "open a pull request", "/created-pr" 같은 요청이나, 브랜치 작업을 마치고 머지·리뷰를 요청하려는 상황이면 PR이라는 단어가 없어도 사용한다. 커밋 자체가 목적이면 commit 스킬을 쓴다.
context: fork
allowed-tools: Read Glob Grep Bash
---

# created-pr

현재 브랜치가 기본 브랜치에 비해 무엇을 바꿨는지 읽고, 리뷰어가 바로 이해할 수 있는 PR을 만든다.

이 스킬은 **분리된 컨텍스트(fork)** 에서 실행된다. 호출한 대화의 내용은 보이지 않으므로, 판단에 필요한 정보는 모두 git 기록과 코드에서 직접 얻는다. 작업이 끝나면 호출자에게 돌려줄 보고(마지막 섹션)를 남긴다.

도구는 Read, Glob, Grep, Bash만 쓸 수 있다. 파일 작성이 필요하면 Bash로 임시 파일을 만든다.

## 1. 사전 점검

```bash
git rev-parse --is-inside-work-tree
gh auth status
git remote get-url origin
BASE=$(gh repo view --json defaultBranchRef -q .defaultBranchRef.name)
HEAD_BRANCH=$(git branch --show-current)
git fetch origin "$BASE" --quiet
```

아래 경우에는 PR을 만들지 않고 멈춘 뒤, 이유와 사용자가 할 일을 보고한다. 추측으로 진행하면 잘못된 브랜치를 올리거나 빈 PR을 만들게 된다.

| 상황 | 보고할 내용 |
|------|-------------|
| git 저장소가 아님 / `origin` 없음 / `gh` 미로그인 | 필요한 설정 (`git init`, `gh repo create`, `gh auth login`) |
| detached HEAD | 브랜치를 만들고 다시 실행하라는 안내 |
| 현재 브랜치가 기본 브랜치 | 작업 브랜치를 만들라는 안내. 예: `git switch -c feat/<주제>` |
| `git log origin/$BASE..HEAD`가 비어 있음 | 기본 브랜치 대비 커밋이 없어 PR을 만들 수 없음 |

이미 같은 브랜치로 열린 PR이 있으면 새로 만들지 않는다. 중복 PR은 리뷰를 쪼개 놓는다.

```bash
gh pr view "$HEAD_BRANCH" --json url,state -q 'select(.state=="OPEN") | .url'
```

URL이 나오면 그 PR을 보고하고 끝낸다.

## 2. 변경사항 분석

```bash
git log --reverse --format='%h %s%n%b' origin/$BASE..HEAD
git diff --stat origin/$BASE...HEAD
git diff origin/$BASE...HEAD
git status --short
```

- 세 점(`...`) diff를 쓴다. 기본 브랜치가 그 사이 앞서 나가도 이 브랜치가 바꾼 것만 보인다.
- diff가 크면 `--stat`으로 전체를 본 뒤, 핵심 파일만 열어 읽는다. 커밋 메시지만 보고 쓰지 말고 실제 코드로 확인한다. 커밋 메시지는 의도를, diff는 사실을 알려준다.
- 커밋되지 않은 변경(`git status`)은 PR에 포함되지 않는다. 직접 커밋하지 말고 보고에만 적는다.

분석하면서 정리할 것:

- 이 브랜치가 해결하는 문제 한 가지 (여러 개면 주된 것)
- 동작이 바뀌는 지점과 바뀌지 않는 지점
- 리뷰어가 특히 봐야 할 곳: 보안 경계, 에러 처리, 공개 API·타입 변경, 마이그레이션, 되돌리기 어려운 변경
- 커밋된 diff 안에 비밀 정보(`.env`, API 키, 토큰, 개인 키)가 있는지. 있으면 **PR을 만들지 말고 멈춘다.** 공개 저장소라면 푸시 순간 노출된다.

## 3. 검증 실행

프로젝트의 `AGENTS.md`, `CLAUDE.md`, `package.json` 스크립트에서 테스트·린트·빌드 명령을 찾아 실행한다. 패키지 매니저는 lockfile로 판단한다 (`bun.lock` → bun, `pnpm-lock.yaml` → pnpm 등).

- 실행한 명령과 결과(통과/실패, 실패 시 요약)를 그대로 본문의 테스트 섹션에 적는다.
- 실패해도 PR은 만들 수 있다. 다만 제목은 그대로 두고 본문 테스트 섹션에 실패를 숨기지 말고 적은 뒤, 보고에서 강조한다.
- 실행하지 않은 검증을 통과했다고 적지 않는다. 명령을 찾지 못했으면 "자동 검증 명령 없음"이라고 쓴다.

## 4. 템플릿 언어 선택

본문 템플릿은 두 가지다.

- 한국어: `references/pr-template-kr.md`
- 영어: `references/pr-template-en.md`

다음 순서로 결정하고, 먼저 걸리는 규칙을 따른다.

1. 프로젝트의 `AGENTS.md` 또는 `CLAUDE.md`에 PR 언어가 명시되어 있으면 그대로 따른다. (예: "PR 본문: 한국어 템플릿")
2. 사용자가 호출 인자로 `kr` / `en`을 줬다면 그것을 따른다.
3. 위 둘이 없으면 **영어(en)** 를 쓴다.

명시가 없는 프로젝트에 영어를 기본으로 두는 이유: 오픈소스나 외부 협업 저장소에서 가장 많은 리뷰어가 읽을 수 있는 언어이기 때문이다.

선택한 템플릿 파일을 Read로 읽고 그 구조를 그대로 따른다.

## 5. 제목과 본문 작성

### 제목

- 형식: `<type>: <요약>` (type: feat / fix / refactor / chore / docs / test)
- 요약은 선택한 템플릿 언어로 쓴다. 70자 안팎.
- 커밋이 하나면 그 커밋 제목을 출발점으로 삼되, 커밋이 여러 개면 브랜치 전체를 대표하는 요약을 새로 쓴다.
- 프로젝트에 기존 PR이 있으면 `gh pr list --state all --limit 5 --json title`로 제목 관례를 확인하고 맞춘다.

### 본문

- 템플릿의 섹션 순서와 제목을 유지한다.
- 해당 사항이 없는 **선택 섹션**은 통째로 지운다. 빈 섹션이나 "없음"만 적힌 섹션은 리뷰어의 시간을 쓴다.
- 템플릿의 HTML 주석(`<!-- -->`)은 작성 안내이므로 최종 본문에서 모두 지운다.
- 변경 목록은 파일 나열이 아니라 **동작 단위**로 쓴다. 리뷰어는 "무엇이 달라졌는지"를 알고 싶어 한다.
- 세션에서 PR 본문 서명 안내(예: `Generated with Claude Code`)가 주어졌다면 본문 맨 끝에 그대로 붙인다.

## 6. 푸시와 PR 생성

이 스킬이 호출되었다는 것 자체가 PR 생성 요청이므로 따로 묻지 않고 진행한다.

```bash
# 업스트림이 없거나 로컬이 앞서 있으면 푸시
git push -u origin "$HEAD_BRANCH"

BODY_FILE=$(mktemp -t pr-body)
cat > "$BODY_FILE" <<'EOF'
(작성한 본문)
EOF

gh pr create --base "$BASE" --head "$HEAD_BRANCH" --title "<제목>" --body-file "$BODY_FILE"
```

- 본문은 반드시 `--body-file`로 넘긴다. `--body "..."`는 백틱·달러 기호가 셸에서 해석되어 본문이 깨진다.
- 호출 인자에 `draft`가 있으면 `--draft`를 붙인다.
- 강제 푸시(`--force`, `--force-with-lease`)는 하지 않는다. 푸시가 거부되면 멈추고 원인(원격이 앞서 있음 등)을 보고한다.
- 리뷰어·라벨·담당자 지정은 인자로 명시된 경우에만 한다 (`--reviewer`, `--label`, `--assignee`).

## 7. 보고

호출자에게 아래를 돌려준다. fork에서 실행되므로 이 보고가 사용자가 결과를 확인하는 유일한 통로다.

```
PR: <URL>
제목: <제목>
브랜치: <head> → <base>
템플릿: kr | en (선택 근거)
검증: <명령> 통과 | 실패(요약) | 명령 없음
포함 커밋: <개수>개
주의: <커밋되지 않은 변경, 검증 실패, 비밀 정보 등 — 없으면 생략>
```

멈춘 경우에는 PR 대신 멈춘 이유와 사용자가 실행할 다음 명령을 적는다.
