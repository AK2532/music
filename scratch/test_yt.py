import yt_dlp
import json

options = {
    "format": "bestaudio/best",
    "quiet": True,
    "js_runtime": "node",
    "extractor_args": {
        "youtube": {
            "player_client": ["ios", "web", "android"],
        }
    },
}

try:
    with yt_dlp.YoutubeDL(options) as ydl:
        info = ydl.extract_info("https://www.youtube.com/watch?v=BSJa1UytM8w", download=False)
        print(json.dumps({"url": info.get("url"), "format": info.get("format")}))
except Exception as e:
    print(json.dumps({"error": str(e)}))
