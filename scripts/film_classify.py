#!/usr/bin/env python3
"""
필름스캔 아카이브 AI 분류 파이프라인
──────────────────────────────────────
Notion '필름스캔 아카이브' DB에서 ai_tag가 템플릿 형태로 남아 있는 사진을
로컬 경로에서 읽어 Claude Vision으로 재분류하고 Notion을 업데이트합니다.

환경 변수:
  ANTHROPIC_API_KEY  — Anthropic API 키
  NOTION_API_KEY     — Notion Integration 토큰

실행:
  FILM_BASE=/Volumes/PP python3 scripts/film_classify.py
  또는 --base 옵션으로 경로 지정:
  python3 scripts/film_classify.py --base /Volumes/PP --limit 20 --dry-run
"""

import argparse
import base64
import json
import os
import sys
import time
from pathlib import Path

import anthropic
import httpx

# ── 설정 ──────────────────────────────────────────────────────────────────────
NOTION_DB_ID = "4279025c-025b-4f9e-8df9-f121b1314c27"
TEMPLATE_MARKER = "what you see (person/nature/architecture/event)"
BATCH_PAUSE = 0.5  # 초 (API rate limit 대응)

# ai_tag 포맷: 피사체/분위기/리소카테고리/태그1,태그2,...
# 리소 카테고리 기준 (Risograph 인쇄 단계):
#   리소1 — 사물·건축·자연 (인물 없음)
#   리소2 — 인물 위주 (거리·일상)
#   리소3 — 라이프스타일·이벤트·감성
#   리소4 — 다큐멘터리·공식 행사·포멀

CLASSIFY_PROMPT = """당신은 필름 사진 큐레이터입니다. 아래 이미지를 보고 정확히 다음 형식으로만 답하세요.

형식: 피사체/분위기/리소카테고리/태그1,태그2,태그3

규칙:
- 피사체: 사진에서 실제로 보이는 것 (예: "사람 3명이 해변에서 포즈", "낡은 건물 외벽", "음식 준비 중인 주방")
- 분위기: lyrical / documentary / casual / formal / ritual / daily 중 가장 적합한 것
- 리소카테고리: 아래 중 하나만
    리소1 — 사물·건축·자연 (인물 없음)
    리소2 — 인물 위주 (거리·일상)
    리소3 — 라이프스타일·이벤트·감성
    리소4 — 다큐멘터리·공식 행사·포멀
- 태그: 영어 소문자, 쉼표로 구분, 3~5개

예시:
  사람 두 명이 카페 테이블에서 대화/casual/리소3/conversation,cafe,indoor,friends,film
  낡은 목조 건물 입구/lyrical/리소1/architecture,wood,door,vintage,rural
  어르신들이 게이트볼 경기 중/documentary/리소4/seniors,sport,outdoor,community,action

형식 외 다른 말은 절대 하지 마세요."""


# ── Notion API ────────────────────────────────────────────────────────────────
def notion_headers(token: str) -> dict:
    return {
        "Authorization": f"Bearer {token}",
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
    }


def query_malformed_pages(token: str, limit: int) -> list[dict]:
    """ai_tag가 템플릿 형태인 페이지를 Notion DB에서 조회"""
    url = f"https://api.notion.com/v1/databases/{NOTION_DB_ID}/query"
    results = []
    cursor = None

    while True:
        body: dict = {"page_size": 100, "filter": {
            "property": "ai_tag",
            "rich_text": {"contains": TEMPLATE_MARKER},
        }}
        if cursor:
            body["start_cursor"] = cursor

        resp = httpx.post(url, headers=notion_headers(token), json=body, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        results.extend(data.get("results", []))

        if not data.get("has_more") or len(results) >= limit:
            break
        cursor = data.get("next_cursor")

    return results[:limit]


def update_ai_tag(token: str, page_id: str, ai_tag: str) -> None:
    url = f"https://api.notion.com/v1/pages/{page_id}"
    body = {"properties": {"ai_tag": {"rich_text": [{"text": {"content": ai_tag}}]}}}
    resp = httpx.patch(url, headers=notion_headers(token), json=body, timeout=30)
    resp.raise_for_status()


# ── Claude Vision ──────────────────────────────────────────────────────────────
def classify_image(client: anthropic.Anthropic, image_path: Path) -> str:
    data = image_path.read_bytes()
    b64 = base64.standard_b64encode(data).decode()
    ext = image_path.suffix.lower().lstrip(".")
    media_type = "image/jpeg" if ext in ("jpg", "jpeg") else f"image/{ext}"

    msg = client.messages.create(
        model="claude-opus-4-5",
        max_tokens=256,
        messages=[{
            "role": "user",
            "content": [
                {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": b64}},
                {"type": "text", "text": CLASSIFY_PROMPT},
            ],
        }],
    )
    return msg.content[0].text.strip()


# ── 메인 ───────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="필름스캔 AI 재분류 파이프라인")
    parser.add_argument("--base", default=os.environ.get("FILM_BASE", "/Volumes/PP"),
                        help="필름 스캔 파일 기준 경로 (기본: /Volumes/PP)")
    parser.add_argument("--limit", type=int, default=50, help="처리할 최대 사진 수")
    parser.add_argument("--dry-run", action="store_true", help="Notion 업데이트 생략 (테스트)")
    args = parser.parse_args()

    notion_token = os.environ.get("NOTION_API_KEY")
    anthropic_key = os.environ.get("ANTHROPIC_API_KEY")
    if not notion_token:
        sys.exit("❌ NOTION_API_KEY 환경 변수가 없습니다.")
    if not anthropic_key:
        sys.exit("❌ ANTHROPIC_API_KEY 환경 변수가 없습니다.")

    base = Path(args.base)
    client = anthropic.Anthropic(api_key=anthropic_key)

    print(f"\n{'='*60}")
    print(f"  📷 필름스캔 AI 분류 파이프라인")
    print(f"  기준 경로: {base}")
    print(f"  최대 처리: {args.limit}장")
    if args.dry_run:
        print("  ⚠️  DRY-RUN 모드 (Notion 업데이트 안 함)")
    print(f"{'='*60}\n")

    print("🔍 Notion에서 미완성 분류 사진 조회 중...")
    pages = query_malformed_pages(notion_token, args.limit)
    print(f"  → {len(pages)}개 발견\n")

    ok, skipped, failed = 0, 0, 0

    for i, page in enumerate(pages, 1):
        props = page.get("properties", {})
        filename = props.get("filename", {}).get("title", [{}])[0].get("plain_text", "")
        src_path_raw = ""
        for rt in props.get("src_path", {}).get("rich_text", []):
            src_path_raw += rt.get("plain_text", "")
        page_id = page["id"]

        image_path = base / src_path_raw
        print(f"[{i:03d}/{len(pages)}] {filename}")
        print(f"        경로: {image_path}")

        if not image_path.exists():
            print(f"        ⚠️  파일 없음 — 건너뜀\n")
            skipped += 1
            continue

        try:
            ai_tag = classify_image(client, image_path)
            # 기본 검증: 슬래시 3개로 구분된 형식인지 확인
            if ai_tag.count("/") < 3:
                print(f"        ⚠️  형식 오류 ({ai_tag!r}) — 건너뜀\n")
                skipped += 1
                continue

            print(f"        ✅ {ai_tag}")

            if not args.dry_run:
                update_ai_tag(notion_token, page_id, ai_tag)
                print(f"        → Notion 업데이트 완료\n")
            else:
                print(f"        → (dry-run, 업데이트 생략)\n")

            ok += 1
            time.sleep(BATCH_PAUSE)

        except Exception as e:
            print(f"        ❌ 오류: {e}\n")
            failed += 1

    print(f"\n{'='*60}")
    print(f"  완료: {ok}장 / 건너뜀: {skipped}장 / 실패: {failed}장")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    main()
