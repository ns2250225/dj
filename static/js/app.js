document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const clockEl = document.getElementById('clock');
    const dateInfoEl = document.getElementById('date-info');
    const songInput = document.getElementById('song-input');
    const sendBtn = document.getElementById('send-btn');
    const chatContainer = document.getElementById('chat-container');
    const playPauseBtn = document.getElementById('play-pause-btn');
    const volumeSlider = document.getElementById('volume-slider');
    const playlistContainer = document.getElementById('playlist-container');
    const queueCount = document.getElementById('queue-count');
    
    // Player Elements
    const currentTrackName = document.getElementById('current-track-name');
    const currentTrackStatus = document.getElementById('current-track-status');
    const progressFill = document.getElementById('progress-fill');
    const timeCurrent = document.getElementById('time-current');
    const timeTotal = document.getElementById('time-total');
    
    // Audio Elements
    const ttsPlayer = document.getElementById('tts-player');
    const musicPlayer = document.getElementById('music-player');
    
    // Theme Elements
    const btnDark = document.querySelector('.btn-dark');
    const btnLight = document.querySelector('.btn-light');

    // State
    let isPlaying = false;
    let isTtsPlaying = false;
    let playlistHistory = [];

    // --- Theme Logic ---
    btnDark.addEventListener('click', () => {
        document.body.classList.remove('theme-light');
        btnDark.classList.add('active');
        btnLight.classList.remove('active');
    });

    btnLight.addEventListener('click', () => {
        document.body.classList.add('theme-light');
        btnLight.classList.add('active');
        btnDark.classList.remove('active');
    });

    // --- Clock Logic ---
    function updateClock() {
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        clockEl.textContent = `${hours}:${minutes}`;
        
        const days = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
        const months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
        
        const dayName = days[now.getDay()];
        const dateStr = `${now.getDate()}-${months[now.getMonth()]}-${now.getFullYear()}`;
        
        dateInfoEl.innerHTML = `<div class="day">${dayName}</div><div class="date">${dateStr}</div>`;
    }
    
    setInterval(updateClock, 1000);
    updateClock();

    // --- Audio Control Logic ---
    function setPlayState(playing) {
        isPlaying = playing;
        const icon = playPauseBtn.querySelector('i');
        if (playing) {
            icon.classList.remove('fa-play');
            icon.classList.add('fa-pause');
        } else {
            icon.classList.remove('fa-pause');
            icon.classList.add('fa-play');
        }
    }

    playPauseBtn.addEventListener('click', () => {
        if (isTtsPlaying) {
            if (isPlaying) {
                ttsPlayer.pause();
                setPlayState(false);
            } else {
                ttsPlayer.play();
                setPlayState(true);
            }
        } else if (musicPlayer.src) {
            if (isPlaying) {
                musicPlayer.pause();
                setPlayState(false);
            } else {
                musicPlayer.play();
                setPlayState(true);
            }
        }
    });

    volumeSlider.addEventListener('input', (e) => {
        const vol = e.target.value / 100;
        // TTS 音量保持最大 1.0 不受滑块影响
        ttsPlayer.volume = 1.0; 
        // 音乐音量受滑块影响，并相对调小一点
        musicPlayer.volume = vol * 0.7; 
    });

    // 初始化音量
    ttsPlayer.volume = 1.0;
    musicPlayer.volume = (volumeSlider.value / 100) * 0.7;

    // Update progress bar
    function formatTime(seconds) {
        if (isNaN(seconds)) return "0:00";
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    }

    function attachProgressEvents(audioElement) {
        audioElement.addEventListener('timeupdate', () => {
            if (!audioElement.duration) return;
            const percent = (audioElement.currentTime / audioElement.duration) * 100;
            progressFill.style.width = `${percent}%`;
            timeCurrent.textContent = formatTime(audioElement.currentTime);
        });
        
        audioElement.addEventListener('loadedmetadata', () => {
            timeTotal.textContent = formatTime(audioElement.duration);
        });
    }

    attachProgressEvents(ttsPlayer);
    attachProgressEvents(musicPlayer);

    // TTS finished -> Play music
    ttsPlayer.addEventListener('ended', () => {
        isTtsPlaying = false;
        currentTrackStatus.textContent = '播放中...';
        musicPlayer.play().then(() => {
            setPlayState(true);
        }).catch(err => {
            console.error("Auto-play prevented", err);
            setPlayState(false);
        });
    });

    musicPlayer.addEventListener('ended', () => {
        setPlayState(false);
        currentTrackStatus.textContent = '播放结束';
        progressFill.style.width = '0%';
        timeCurrent.textContent = '0:00';
    });

    // --- Playlist Logic ---
    function addToPlaylist(songData) {
        playlistHistory.push(songData);
        queueCount.textContent = playlistHistory.length;
        renderPlaylist();
    }

    function renderPlaylist() {
        playlistContainer.innerHTML = '';
        playlistHistory.forEach((song, index) => {
            const li = document.createElement('li');
            li.className = 'playlist-item';
            li.innerHTML = `
                <div class="song-info">
                    <span class="s-name">${song.song_name}</span>
                    <span class="s-artist">${song.artist}</span>
                </div>
                <i class="fas fa-play play-icon"></i>
            `;
            li.addEventListener('click', () => {
                playHistorySong(song);
            });
            playlistContainer.appendChild(li);
        });
        playlistContainer.scrollTop = playlistContainer.scrollHeight;
    }

    function playHistorySong(songData) {
        ttsPlayer.pause();
        isTtsPlaying = false;
        
        musicPlayer.src = songData.music_url;
        currentTrackName.textContent = `${songData.song_name} - ${songData.artist}`;
        currentTrackStatus.textContent = '播放记录...';
        
        musicPlayer.play().then(() => {
            setPlayState(true);
        }).catch(err => {
            console.error("Play prevented", err);
            setPlayState(false);
        });
    }

    // --- Chat & API Logic ---
    function addMessage(sender, content) {
        const now = new Date();
        const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        
        const msgDiv = document.createElement('div');
        msgDiv.className = 'chat-message';
        
        let header = sender === 'user' ? '你' : '马仔';
        
        msgDiv.innerHTML = `
            <div class="message-header">${header}</div>
            <div class="message-content">${content}</div>
            <div class="message-meta">
                <span class="msg-time">${timeStr}</span>
                ${sender === 'dj' ? '<button class="replay-btn"><i class="fas fa-play"></i> 重播</button>' : ''}
            </div>
        `;
        
        chatContainer.appendChild(msgDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    async function requestSong(songName) {
        if (!songName.trim()) return;
        
        addMessage('user', `我想听: ${songName}`);
        songInput.value = '';
        currentTrackStatus.textContent = '正在准备中...';
        
        try {
            const response = await fetch('/api/request', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ song_name: songName })
            });
            
            if (!response.ok) {
                let detail = '请求失败';
                try {
                    const err = await response.json();
                    detail = err.detail || detail;
                } catch (e) {
                    try {
                        const text = await response.text();
                        detail = text || detail;
                    } catch (e2) {
                    }
                }
                throw new Error(detail);
            }
            
            let data;
            try {
                data = await response.json();
            } catch (e) {
                const text = await response.text();
                throw new Error(text || '响应不是有效的 JSON');
            }
            
            // Add to Playlist
            addToPlaylist(data);
            
            // Add DJ Message
            addMessage('dj', data.dj_text);
            
            // Setup Audio
            currentTrackName.textContent = `${data.song_name} - ${data.artist}`;
            currentTrackStatus.textContent = '正在播报串词...';
            
            // Pause any current music
            musicPlayer.pause();
            musicPlayer.src = data.music_url;
            musicPlayer.load();
            
            ttsPlayer.src = data.tts_url;
            ttsPlayer.load();
            
            isTtsPlaying = true;
            
            // Try to play TTS
            try {
                await ttsPlayer.play();
                setPlayState(true);
            } catch (err) {
                console.error("Play prevented, user needs to interact first", err);
                setPlayState(false);
                currentTrackStatus.textContent = '点击播放按钮开始';
            }
            
        } catch (error) {
            addMessage('dj', `抱歉，出现了一些问题：${error.message}`);
            currentTrackStatus.textContent = '出现错误';
        }
    }

    sendBtn.addEventListener('click', () => {
        requestSong(songInput.value);
    });

    songInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            requestSong(songInput.value);
        }
    });
});
