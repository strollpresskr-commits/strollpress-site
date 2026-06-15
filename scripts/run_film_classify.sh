#!/bin/bash
# 필름스캔 AI 분류 파이프라인 실행 스크립트
# 사용법: bash scripts/run_film_classify.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FILM_BASE="/Volumes/T7 Shield"
PYTHON="python3"

# ── 의존성 확인 / 설치 ──────────────────────────────────────────────────────
echo "📦 의존성 확인 중..."
$PYTHON -m pip install --quiet google-generativeai pillow httpx 2>/dev/null || {
  echo "❌ pip install 실패. 다음을 먼저 실행하세요:"
  echo "   python3 -m pip install google-generativeai pillow httpx"
  exit 1
}

# ── API 키 확인 ─────────────────────────────────────────────────────────────
if [ -z "$GEMINI_API_KEY" ]; then
  echo ""
  echo "GEMINI_API_KEY가 설정되지 않았습니다."
  echo -n "Google AI Studio API 키를 입력하세요 (AIza...): "
  read -r GEMINI_API_KEY
  export GEMINI_API_KEY
fi

if [ -z "$NOTION_API_KEY" ]; then
  echo ""
  echo "NOTION_API_KEY가 설정되지 않았습니다."
  echo -n "Notion Integration 토큰을 입력하세요 (secret_...): "
  read -r NOTION_API_KEY
  export NOTION_API_KEY
fi

# ── 드라이브 마운트 확인 ────────────────────────────────────────────────────
if [ ! -d "$FILM_BASE" ]; then
  echo ""
  echo "❌ '$FILM_BASE' 드라이브가 마운트되어 있지 않습니다."
  echo "   T7 Shield를 연결하고 다시 실행하세요."
  exit 1
fi

# ── 실행 ───────────────────────────────────────────────────────────────────
echo ""
echo "🎞  필름 분류 시작..."
$PYTHON "$SCRIPT_DIR/film_classify.py" \
  --base "$FILM_BASE" \
  --limit 100 \
  "$@"
