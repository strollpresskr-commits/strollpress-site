#!/usr/bin/env python3
"""
MP3 → SRT 자막 생성기 (OpenAI Whisper 사용)
사용법: python generate_srt.py
"""

import os
import sys

def install_if_missing(package):
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", package, "-q"])

try:
    import whisper
except ImportError:
    print("whisper 설치 중...")
    install_if_missing("openai-whisper")
    import whisper

def format_timestamp(seconds: float) -> str:
    """초를 SRT 타임스탬프 형식(HH:MM:SS,mmm)으로 변환"""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int((seconds - int(seconds)) * 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"

def segments_to_srt(segments) -> str:
    lines = []
    for i, seg in enumerate(segments, start=1):
        start = format_timestamp(seg["start"])
        end = format_timestamp(seg["end"])
        text = seg["text"].strip()
        lines.append(f"{i}\n{start} --> {end}\n{text}\n")
    return "\n".join(lines)

def transcribe_to_srt(audio_path: str, model_name: str = "large-v3") -> str:
    print(f"\n[처리 중] {os.path.basename(audio_path)}")
    print(f"  모델: {model_name}")

    model = whisper.load_model(model_name)

    result = model.transcribe(
        audio_path,
        language="ko",          # 한국어 고정
        task="transcribe",
        word_timestamps=False,
        verbose=False,
        condition_on_previous_text=True,
        temperature=0.0,
    )

    return segments_to_srt(result["segments"])

def main():
    audio_files = [
        "/Volumes/T7 Shield/DaVinci_Resolve/Media/260607_브레이킹배드와 사주/1260608_브레이킹배드와사주_최종.mp3",
        "/Volumes/T7 Shield/DaVinci_Resolve/Media/260607_브레이킹배드와 사주/2260608_브레이킹배드와사주_최종.mp3",
    ]

    # 모델 선택 (정확도 순: large-v3 > medium > small > base)
    # 한국어는 large-v3 권장 (느리지만 가장 정확)
    # 빠르게 하려면 "medium" 사용
    MODEL = "large-v3"

    for audio_path in audio_files:
        if not os.path.exists(audio_path):
            print(f"[건너뜀] 파일 없음: {audio_path}")
            continue

        srt_content = transcribe_to_srt(audio_path, MODEL)

        # SRT 파일을 오디오 파일과 같은 폴더에 저장
        base = os.path.splitext(audio_path)[0]
        srt_path = base + ".srt"
        with open(srt_path, "w", encoding="utf-8") as f:
            f.write(srt_content)

        print(f"  저장 완료: {srt_path}")

    print("\n완료! Premiere Pro에서 SRT 파일을 불러오세요.")

if __name__ == "__main__":
    main()
