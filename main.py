import os
import time
import requests
from fastapi import FastAPI, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
from openai import OpenAI

try:
    from dotenv import load_dotenv

    load_dotenv()
except Exception:
    pass

app = FastAPI()

# Mount static files
if not os.path.exists("static"):
    os.makedirs("static")
if not os.path.exists("static/audio"):
    os.makedirs("static/audio")

app.mount("/static", StaticFiles(directory="static"), name="static")

class SongRequest(BaseModel):
    song_name: str

def get_openai_client() -> OpenAI:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="未配置 OPENAI_API_KEY")
    base_url = os.getenv("OPENAI_BASE_URL", "https://api.laozhang.ai/v1")
    return OpenAI(api_key=api_key, base_url=base_url)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    return JSONResponse(status_code=500, content={"detail": "服务器内部错误", "error": str(exc)})

@app.get("/")
def read_index():
    return FileResponse("static/index.html")

@app.get("/api/health")
def health():
    return {"status": "ok", "openai_configured": bool(os.getenv("OPENAI_API_KEY"))}

@app.post("/api/request")
def request_song(req: SongRequest):
    song_name = req.song_name
    
    # 1. 搜索网易云音乐
    search_url = "http://music.163.com/api/search/get/web"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    }
    data = {
        "s": song_name,
        "type": 1,
        "limit": 10  # 增加搜索数量以筛选免费歌曲
    }
    try:
        r = requests.post(search_url, data=data, headers=headers)
        res_json = r.json()
        songs = res_json.get("result", {}).get("songs", [])
        if not songs:
            raise HTTPException(status_code=404, detail="未找到该歌曲")
        
        # 寻找免费歌曲 (fee == 0 或者是 fee == 8)
        # fee=0: 免费或无版权
        # fee=1: VIP
        # fee=4: 购买专辑
        # fee=8: 低音质免费
        free_song = None
        for song in songs:
            if song.get("fee") in [0, 8]:
                free_song = song
                break
                
        if not free_song:
            # 如果没找到完全免费的，只能退而求其次用第一首（可能会播放失败）
            free_song = songs[0]

        song_id = free_song["id"]
        song_title = free_song["name"]
        artist_name = free_song["artists"][0]["name"] if free_song.get("artists") else "未知歌手"
        music_url = f"http://music.163.com/song/media/outer/url?id={song_id}.mp3"
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"搜索音乐失败: {str(e)}")

    client = get_openai_client()

    # 2. 生成DJ串词
    try:
        from datetime import datetime
        now = datetime.now()
        date_str = now.strftime("%Y年%m月%d日")
        # 模拟一些天气和心情状态（可以扩展为真实API，此处使用随机组合让串词更生动）
        import random
        weathers = ["阳光明媚", "微风和煦", "淅淅沥沥的小雨", "阴云密布", "晚风微凉", "繁星点点"]
        moods = ["放松", "怀旧", "有些疲惫", "充满期待", "平静", "略带伤感"]
        current_weather = random.choice(weathers)
        current_mood = random.choice(moods)
        
        prompt = f"""你是一个深夜电台DJ。现在是{date_str}，外面的天气是{current_weather}。
有听众点了一首{artist_name}的《{song_title}》，听众此刻的心情是{current_mood}。
请你用充满磁性、治愈、文艺的语气，写一段较长的DJ串词（约150字到200字之间）。
在播放这首歌之前念出来。
要求：
1. 结合当前的时间、天气（{current_weather}）和心情（{current_mood}）进行情感铺垫。
2. 聊一聊关于这首歌背后的故事、情感，或者是关于人生、回忆的感悟。
3. 语速要慢，文字要像是在和老朋友交谈一样自然。
4. 不要写'欢迎收听'之类的俗套开场白，直接切入氛围。
5. 最后以引出歌曲作为结尾。"""

        response = client.chat.completions.create(
            model="gpt-4.1",
            messages=[
                {"role": "user", "content": prompt}
            ]
        )
        dj_text = response.choices[0].message.content.strip()
    except Exception as e:
        dj_text = f"这是为你点播的，{artist_name}的《{song_title}》，希望你喜欢。"

    # 3. 生成TTS语音
    try:
        tts_response = client.audio.speech.create(
            model="tts-1",
            voice="onyx",
            input=dj_text
        )
        timestamp = int(time.time())
        audio_filename = f"tts_{timestamp}.mp3"
        audio_filepath = os.path.join("static", "audio", audio_filename)
        tts_response.stream_to_file(audio_filepath)
        tts_url = f"/static/audio/{audio_filename}"
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"生成语音失败: {str(e)}")

    return {
        "song_name": song_title,
        "artist": artist_name,
        "music_url": music_url,
        "dj_text": dj_text,
        "tts_url": tts_url
    }
