let likesTracks = [];
let hasMoreLikes = true;
let isFetchingMoreLikes = false;

let playlistsData = [];
let currentPlaylistTracks = [];

let feedTracks = [];
let hasMoreFeed = true;
let isFetchingMoreFeed = false;

let offlineTracks = [];
let activePlaylist = [];
let currentIndex = -1;
let currentTrackObj = null;
let trackToAddPlaylist = null;
let currentDuration = 0;
let isRepeat = false;
let autoNextTriggered = false;
let currentAccent = '#ff5500';
let pendingResumeSeek = 0;
let pendingResumeAutoplay = false;

let parsedLyricsLines = [];
let activeLyricIndex = -1;
let loadedLyricsForUrl = '';

let launcherSettings = {
    theme: 'obsidian',
    wallpaper: 'none',
    custom_bg_url: '',
    accent: '#ff5500',
    visualizer: true,
    ambient: true,
    compact: false,
    widget_opacity: 0.94,
    discord_rpc: true,
    eq_enabled: true,
    eq_auto: false,
    eq_preset: 'flat',
    eq_bands: [0, 0, 0, 0, 0, 0],
    zapret_enabled: true,
    zapret_bat: 'auto',
    perf_mode: 'max',
    likes_batch_size: 300,
    feed_batch_size: 300
};

const EQ_FREQS = [60, 230, 910, 3600, 8000, 14000];
const EQ_PRESETS = {
    flat:   [0, 0, 0, 0, 0, 0],
    bass:   [8, 5, 1, 0, 1, 2],
    treble: [-1, 0, 1, 4, 7, 9],
    phonk:  [9, 6, -2, 2, 5, 7],
    vocal:  [-2, -1, 3, 5, 3, 1],
    rock:   [5, 3, -1, 2, 4, 6]
};

const ORBIT_SETS = {
    none: [],
    music: ['🎵', '🎧', '🎶', '💿'],
    stars: ['✨', '⭐', '💫', '🌟'],
    snow: ['❄️', '🌨️', '✨', '❄️'],
    hearts: ['🖤', '❤️', '🔥', '💜']
};

const PROFILE_TEMPLATES = {
    minimal: { banner_anim: 'solid_dark', orbit_mode: 'none',   avatar_ring: 'subtle',  name_badge: '' },
    neon:    { banner_anim: 'wave',       orbit_mode: 'music',  avatar_ring: 'glow',    name_badge: '⚡' },
    cyber:   { banner_anim: 'grid',       orbit_mode: 'none',   avatar_ring: 'rainbow', name_badge: '💀' },
    winter:  { banner_anim: 'newyear',    orbit_mode: 'snow',   avatar_ring: 'glow',    name_badge: '❄️' },
    crimson: { banner_anim: 'crimson',    orbit_mode: 'none',   avatar_ring: 'glow',    name_badge: '🔥' },
    gold:    { banner_anim: 'gold',       orbit_mode: 'stars',  avatar_ring: 'rainbow', name_badge: '👑' }
};

const SVG_PLAY = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
const SVG_PAUSE = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';
const SVG_DL = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
const SVG_HEART_OUTLINE = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>';
const SVG_HEART_FILLED = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>';
const SVG_PLUS = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
const SVG_MUSIC = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>';
const SVG_DISC = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>';
const SC_DEFAULT_ICON = 'https://a-v2.sndcdn.com/assets/images/sc-icons/ios-a62dfc8fe7.png';

const audio = document.getElementById('audio');
const playBtn = document.getElementById('play-pause-btn');

const savedVol = localStorage.getItem('sc_vol');
audio.volume = savedVol !== null ? parseFloat(savedVol) : 0.8;
document.getElementById('volume').value = audio.volume;

function isTrackLiked(url) {
    return likesTracks.some(t => t.url === url);
}

function openDevProfile() {
    pywebview.api.open_external_url('https://funpay.com/users/6228872/');
}

function toggleFaqItem(el) {
    if (!el) return;
    el.classList.toggle('open');
}

async function quitAppCompletely() {
    showToast('Полное закрытие лаунчера...');
    await pywebview.api.quit_completely();
}

// --- РЕЖИМЫ ПРОФИЛЯ (ПРОСМОТР / НАСТРОЙКА) ---
function setProfileMode(mode) {
    const isEdit = mode === 'edit';
    document.getElementById('prof-mode-view-btn').classList.toggle('active', !isEdit);
    document.getElementById('prof-mode-edit-btn').classList.toggle('active', isEdit);
    document.getElementById('profile-customization-panel').style.display = isEdit ? 'block' : 'none';
    document.getElementById('prof-stats-row').style.display = isEdit ? 'none' : 'flex';
    updateProfileCounters();
}

function updateProfileCounters() {
    document.getElementById('prof-stat-likes').innerText = likesTracks.length;
    document.getElementById('prof-stat-playlists').innerText = playlistsData.length;
    document.getElementById('prof-stat-offline').innerText = offlineTracks.length;
    const pill = document.getElementById('likes-count-pill');
    if (pill) pill.innerText = likesTracks.length;
}

function renderOrbitItems(mode) {
    const layer = document.getElementById('tg-orbit-layer');
    const stage = document.getElementById('tg-avatar-stage');
    layer.innerHTML = '';
    const icons = ORBIT_SETS[mode] || [];
    if (icons.length === 0) {
        stage.style.width = '104px';
        stage.style.height = '100px';
        return;
    }
    stage.style.width = '156px';
    stage.style.height = '104px';
    icons.forEach((icon, i) => {
        const span = document.createElement('span');
        span.className = `tg-orbit-badge b${i + 1}`;
        span.innerText = icon;
        layer.appendChild(span);
    });
}

function applyProfileVisuals(p) {
    if (!p) return;
    document.getElementById('prof-name-view').innerText = p.nickname || p.sc_username || 'SoundCloud User';
    document.getElementById('prof-bio-view').innerText = p.bio || '';
    document.getElementById('prof-badge-view').innerText = p.name_badge || '';

    const avEl = document.getElementById('prof-avatar-view');
    if (p.avatar) avEl.src = p.avatar;
    avEl.className = 'tg-center-avatar ring-' + (p.avatar_ring || 'subtle');

    const heroEl = document.getElementById('prof-banner-view');
    const bgOverlay = document.getElementById('prof-banner-img');
    heroEl.className = 'tg-profile-hero anim-' + (p.banner_anim || 'wave');
    bgOverlay.style.backgroundImage = p.banner ? `url('${p.banner}')` : '';

    renderOrbitItems(p.orbit_mode || 'none');
}

function livePreviewProfile() {
    const p = {
        sc_username: document.getElementById('inp-sc-user').value,
        nickname: document.getElementById('inp-nick').value,
        bio: document.getElementById('inp-bio').value,
        name_badge: document.getElementById('inp-name-badge').value,
        banner_anim: document.getElementById('inp-banner-anim').value,
        orbit_mode: document.getElementById('inp-orbit-mode').value,
        avatar_ring: document.getElementById('inp-avatar-ring').value,
        avatar: document.getElementById('inp-avatar').value,
        banner: document.getElementById('inp-banner').value
    };
    applyProfileVisuals(p);
}

function applyProfileTemplate(tplKey) {
    const tpl = PROFILE_TEMPLATES[tplKey];
    if (!tpl) return;
    document.getElementById('inp-banner-anim').value = tpl.banner_anim;
    document.getElementById('inp-orbit-mode').value = tpl.orbit_mode;
    document.getElementById('inp-avatar-ring').value = tpl.avatar_ring;
    document.getElementById('inp-name-badge').value = tpl.name_badge;
    if (tplKey === 'minimal') {
        document.getElementById('inp-banner').value = '';
    }
    livePreviewProfile();
}

function applyProfile(p) {
    if (!p) return;
    const merged = {
        orbit_mode: 'none',
        avatar_ring: 'subtle',
        name_badge: '',
        banner_anim: 'wave',
        ...p
    };
    applyProfileVisuals(merged);
    document.getElementById('inp-sc-user').value = merged.sc_username || '';
    document.getElementById('inp-nick').value = merged.nickname || '';
    document.getElementById('inp-bio').value = merged.bio || '';
    document.getElementById('inp-name-badge').value = merged.name_badge || '';
    document.getElementById('inp-banner-anim').value = merged.banner_anim || 'wave';
    document.getElementById('inp-orbit-mode').value = merged.orbit_mode || 'none';
    document.getElementById('inp-avatar-ring').value = merged.avatar_ring || 'subtle';
    document.getElementById('inp-avatar').value = merged.avatar || '';
    document.getElementById('inp-banner').value = merged.banner || '';
}

async function saveProfileUI() {
    const p = {
        sc_username: document.getElementById('inp-sc-user').value,
        nickname: document.getElementById('inp-nick').value,
        bio: document.getElementById('inp-bio').value,
        name_badge: document.getElementById('inp-name-badge').value,
        banner_anim: document.getElementById('inp-banner-anim').value,
        orbit_mode: document.getElementById('inp-orbit-mode').value,
        avatar_ring: document.getElementById('inp-avatar-ring').value,
        avatar: document.getElementById('inp-avatar').value,
        banner: document.getElementById('inp-banner').value
    };
    const res = await pywebview.api.save_profile(p);
    applyProfile(res.profile || p);
    setProfileMode('view');
    if (res.status === 'switched') {
        likesTracks = [];
        playlistsData = [];
        feedTracks = [];
        renderLikes();
        showToast('Аккаунт изменён, загружаем треки...');
    } else {
        showToast('Профиль сохранён');
    }
}

async function syncSCProfile() {
    const rawUser = document.getElementById('inp-sc-user').value;
    showToast('Синхронизация с SoundCloud...');
    const p = await pywebview.api.sync_sc_profile(rawUser);
    applyProfile(p);
    showToast('Данные профиля обновлены');
}

// --- ПОИСК GIF НА GIPHY ---
let giphyTargetField = 'banner';

function openGiphyModal(target) {
    giphyTargetField = target || 'banner';
    document.getElementById('giphy-modal-title').innerText =
        giphyTargetField === 'avatar' ? 'Выбор GIF для аватарки (Giphy)' : 'Выбор GIF для фона профиля (Giphy)';
    document.getElementById('giphy-modal').classList.add('open');
    const inp = document.getElementById('giphy-search-input');
    inp.focus();
    if (!inp.value.trim()) {
        inp.value = 'anime aesthetic';
        runGiphySearch();
    }
}

function closeGiphyModal() {
    document.getElementById('giphy-modal').classList.remove('open');
}

function quickGiphyTag(tag) {
    document.getElementById('giphy-search-input').value = tag;
    runGiphySearch();
}

async function runGiphySearch() {
    const q = document.getElementById('giphy-search-input').value.trim();
    const grid = document.getElementById('giphy-results-grid');
    grid.innerHTML = '<div class="status-msg" style="grid-column:1/-1;">Загрузка GIF с Giphy...</div>';

    try {
        const res = await pywebview.api.search_giphy(q);
        const gifs = (res && res.gifs) || [];
        if (gifs.length === 0) {
            grid.innerHTML = '<div class="status-msg" style="grid-column:1/-1;">Ничего не найдено, попробуйте другой запрос</div>';
            return;
        }
        grid.innerHTML = '';
        gifs.forEach(g => {
            const cell = document.createElement('div');
            cell.className = 'giphy-item';
            cell.title = g.title || 'Выбрать GIF';
            cell.innerHTML = `<img src="${g.preview}" loading="lazy" decoding="async" alt="">`;
            cell.onclick = () => {
                if (giphyTargetField === 'avatar') {
                    document.getElementById('inp-avatar').value = g.url;
                } else {
                    document.getElementById('inp-banner').value = g.url;
                    document.getElementById('inp-banner-anim').value = 'none';
                }
                livePreviewProfile();
                closeGiphyModal();
                showToast('GIF применён к профилю!');
            };
            grid.appendChild(cell);
        });
    } catch (e) {
        grid.innerHTML = '<div class="status-msg" style="grid-column:1/-1;">Ошибка загрузки Giphy</div>';
    }
}

// --- ВСПЛЫВАЮЩИЕ ПРЕДЛОЖЕНИЯ МАГАЗИНА FUNPAY ---
let funpayHideTimer = null;

function closeFunpayPromo() {
    document.getElementById('funpay-promo-card').classList.remove('show');
    clearTimeout(funpayHideTimer);
}

async function triggerFunpayPromo() {
    try {
        const promo = await pywebview.api.get_funpay_promo();
        if (!promo || !promo.game) return;

        const card = document.getElementById('funpay-promo-card');
        const textEl = document.getElementById('funpay-promo-text');
        const priceEl = document.getElementById('funpay-promo-price');
        const btnEl = document.getElementById('funpay-promo-btn');

        textEl.innerHTML = `Давно хотели поиграть в «<span>${promo.game}</span>»? Тогда вам в наш магазин!`;
        priceEl.innerText = promo.price ? `Цена: ${promo.price}` : 'Выгодная цена';
        btnEl.onclick = () => {
            pywebview.api.open_external_url(promo.url || 'https://funpay.com/users/6228872/');
            closeFunpayPromo();
        };

        card.classList.add('show');
        clearTimeout(funpayHideTimer);
        funpayHideTimer = setTimeout(() => {
            card.classList.remove('show');
        }, 16000);
    } catch (e) {}
}

setTimeout(triggerFunpayPromo, 18000);
setInterval(triggerFunpayPromo, 270000);

// --- УПРАВЛЕНИЕ ZAPRET И ПИНГОМ ---
function updateZapretModeButtons(enabled) {
    document.getElementById('btn-zapret-on').classList.toggle('active', !!enabled);
    document.getElementById('btn-zapret-off').classList.toggle('active', !enabled);
}

function populateZapretBats(bats, selectedBat, statusText) {
    const sel = document.getElementById('set-zapret-bat');
    sel.innerHTML = '<option value="auto">Автоподбор (.bat)</option>';
    (bats || []).forEach(b => {
        const opt = document.createElement('option');
        opt.value = b;
        opt.innerText = b;
        sel.appendChild(opt);
    });
    sel.value = selectedBat || 'auto';
    if (statusText) {
        document.getElementById('zapret-status-label').innerText = statusText;
    }
}

function onZapretStatusUpdated(statusMsg, activeBat) {
    const lbl = document.getElementById('zapret-status-label');
    if (lbl) lbl.innerText = statusMsg;
    refreshZapretPing();
}

async function refreshZapretPing() {
    const dotsEl = document.getElementById('zapret-dots-group');
    const pingLbl = document.getElementById('zapret-ping-label');
    const statusLbl = document.getElementById('zapret-status-label');
    try {
        const res = await pywebview.api.check_zapret_ping();
        if (res.ok) {
            dotsEl.classList.remove('offline');
            dotsEl.classList.add('online');
            statusLbl.innerText = res.status || 'Обход активен';
            pingLbl.innerText = `Соединение стабильно • Пинг: ${res.ping} мс`;
        } else {
            dotsEl.classList.remove('online');
            dotsEl.classList.add('offline');
            statusLbl.innerText = res.enabled ? 'Нет ответа от SoundCloud' : 'Обход отключён';
            pingLbl.innerText = '';
        }
    } catch (e) {
        dotsEl.classList.remove('online');
        dotsEl.classList.add('offline');
        pingLbl.innerText = '';
    }
}

async function setZapretMode(enabled) {
    launcherSettings.zapret_enabled = enabled;
    updateZapretModeButtons(enabled);
    const batMode = document.getElementById('set-zapret-bat').value;
    document.getElementById('zapret-status-label').innerText = enabled ? 'Запуск обхода...' : 'Отключение обхода...';
    await pywebview.api.apply_zapret_settings(enabled, batMode, false);
    setTimeout(refreshZapretPing, 1400);
}

async function onZapretBatChange() {
    const batMode = document.getElementById('set-zapret-bat').value;
    launcherSettings.zapret_bat = batMode;
    launcherSettings.zapret_enabled = true;
    updateZapretModeButtons(true);
    document.getElementById('zapret-status-label').innerText = 'Применяем конфиг...';
    await pywebview.api.apply_zapret_settings(true, batMode, false);
    setTimeout(refreshZapretPing, 1400);
}

async function recheckZapret() {
    document.getElementById('set-zapret-bat').value = 'auto';
    launcherSettings.zapret_enabled = true;
    launcherSettings.zapret_bat = 'auto';
    updateZapretModeButtons(true);
    document.getElementById('zapret-status-label').innerText = 'Поиск рабочего .bat...';
    await pywebview.api.apply_zapret_settings(true, 'auto', true);
    setTimeout(refreshZapretPing, 1600);
}

// --- РЕЖИМЫ ПРОИЗВОДИТЕЛЬНОСТИ ---
async function setPerfMode(mode) {
    launcherSettings.perf_mode = mode;
    if (mode === 'low') {
        launcherSettings.likes_batch_size = 200;
        launcherSettings.feed_batch_size = 200;
        launcherSettings.visualizer = false;
    } else {
        if (launcherSettings.likes_batch_size < 300) launcherSettings.likes_batch_size = 300;
        if (launcherSettings.feed_batch_size < 300) launcherSettings.feed_batch_size = 300;
        launcherSettings.visualizer = true;
    }
    applySettings(launcherSettings);
    await pywebview.api.save_settings(launcherSettings);
    showToast(mode === 'low' ? 'Включён режим: Слабый ПК' : 'Включён режим: SoundCloud MAX');
}

async function updateBatchLimits() {
    launcherSettings.likes_batch_size = parseInt(document.getElementById('set-likes-batch').value, 10) || 300;
    launcherSettings.feed_batch_size = parseInt(document.getElementById('set-feed-batch').value, 10) || 300;
    await pywebview.api.save_settings(launcherSettings);
    showToast('Лимиты прогрузки обновлены');
}

// --- ПЕРЕЗАПУСК ---
async function restartWithTrack() {
    const snapshot = currentTrackObj ? {
        track: currentTrackObj,
        url: currentTrackObj.url,
        time: audio.currentTime || 0,
        was_playing: !audio.paused
    } : null;
    showToast('Перезапуск лаунчера...');
    await pywebview.api.restart_launcher(snapshot);
}

// --- WINDOWS 11 MEDIA SESSION ---
function setupSystemMediaSession() {
    if (!('mediaSession' in navigator)) return;
    try {
        navigator.mediaSession.setActionHandler('play', () => audio.play());
        navigator.mediaSession.setActionHandler('pause', () => audio.pause());
        navigator.mediaSession.setActionHandler('previoustrack', () => prevTrack());
        navigator.mediaSession.setActionHandler('nexttrack', () => nextTrack());
        navigator.mediaSession.setActionHandler('seekto', (details) => {
            if (details && typeof details.seekTime === 'number' && audio.duration) {
                audio.currentTime = details.seekTime;
                updateSystemMediaPosition();
            }
        });
    } catch (e) {}
}

function updateSystemMediaMetadata(track) {
    if (!('mediaSession' in navigator) || !track) return;
    const cleanArtist = (track.artist || 'SoundCloud').replace(/•.*$/, '').trim();
    const artUrl = (track.artwork && track.artwork.startsWith('http'))
        ? track.artwork.replace('large.jpg', 't500x500.jpg')
        : SC_DEFAULT_ICON;

    document.title = `${track.title} — ${cleanArtist}`;

    try {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: track.title || 'Без названия',
            artist: cleanArtist,
            album: 'SoundCloud Launcher',
            artwork: [
                { src: artUrl, sizes: '96x96', type: 'image/jpeg' },
                { src: artUrl, sizes: '256x256', type: 'image/jpeg' },
                { src: artUrl, sizes: '512x512', type: 'image/jpeg' }
            ]
        });
    } catch (e) {}
}

function updateSystemMediaPosition() {
    if (!('mediaSession' in navigator) || !('setPositionState' in navigator.mediaSession)) return;
    if (!audio.duration || isNaN(audio.duration) || !isFinite(audio.duration)) return;
    try {
        navigator.mediaSession.setPositionState({
            duration: audio.duration,
            playbackRate: audio.playbackRate || 1,
            position: Math.min(audio.currentTime || 0, audio.duration)
        });
    } catch (e) {}
}

setupSystemMediaSession();

// --- SPOTIFY-КАРАОКЕ ---
function parseLrcText(lrcRaw) {
    if (!lrcRaw) return [];
    const lines = lrcRaw.split(/\r?\n/);
    const result = [];
    const tagRegex = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g;

    for (const line of lines) {
        const matches = [...line.matchAll(tagRegex)];
        if (matches.length === 0) continue;
        const text = line.replace(tagRegex, '').trim();
        for (const m of matches) {
            const min = parseInt(m[1], 10);
            const sec = parseInt(m[2], 10);
            const msStr = (m[3] || '0').padEnd(3, '0');
            const ms = parseInt(msStr, 10);
            const timeSec = min * 60 + sec + ms / 1000.0;
            result.push({ time: timeSec, text: text || '•••' });
        }
    }
    return result.sort((a, b) => a.time - b.time);
}

async function loadLyricsForCurrentTrack(forceReload = false) {
    if (!currentTrackObj) return;
    const body = document.getElementById('lyrics-body');
    const cleanArtist = (currentTrackObj.artist || 'SoundCloud').replace(/•.*$/, '').trim();

    document.getElementById('lyrics-title').innerText = currentTrackObj.title || 'Без названия';
    document.getElementById('lyrics-artist').innerText = cleanArtist;
    const cover = document.getElementById('lyrics-cover');
    if (currentTrackObj.artwork) {
        cover.src = currentTrackObj.artwork;
        cover.style.display = 'block';
        document.getElementById('lyrics-bg-blur').style.backgroundImage = `url('${currentTrackObj.artwork}')`;
    } else {
        cover.style.display = 'none';
        document.getElementById('lyrics-bg-blur').style.backgroundImage = '';
    }

    if (!forceReload && loadedLyricsForUrl === currentTrackObj.url) {
        syncSpotifyLyricsHighlight(true);
        return;
    }

    loadedLyricsForUrl = currentTrackObj.url;
    parsedLyricsLines = [];
    activeLyricIndex = -1;
    body.innerHTML = '<div class="lyrics-placeholder">Поиск синхронизированного текста...</div>';

    const res = await pywebview.api.get_lyrics(cleanArtist, currentTrackObj.title);
    if (!currentTrackObj || loadedLyricsForUrl !== currentTrackObj.url) return;

    const syncedRaw = (res && res.synced) ? res.synced : '';
    const plainRaw = (res && res.plain) ? res.plain : 'Текст для этого трека не найден.';

    parsedLyricsLines = parseLrcText(syncedRaw);
    body.innerHTML = '';

    if (parsedLyricsLines.length > 0) {
        parsedLyricsLines.forEach((item, idx) => {
            const div = document.createElement('div');
            div.className = 'lyric-line';
            div.dataset.idx = idx;
            div.innerText = item.text;
            div.onclick = () => {
                if (audio.duration) {
                    audio.currentTime = item.time;
                    if (audio.paused) audio.play();
                    syncSpotifyLyricsHighlight(true);
                }
            };
            body.appendChild(div);
        });
        syncSpotifyLyricsHighlight(true);
    } else {
        const plainDiv = document.createElement('div');
        plainDiv.className = 'lyrics-plain-text';
        plainDiv.innerText = plainRaw;
        body.appendChild(plainDiv);
    }
}

function syncSpotifyLyricsHighlight(forceScroll = false) {
    const modal = document.getElementById('lyrics-modal');
    if (!modal.classList.contains('open') || parsedLyricsLines.length === 0) return;

    const cur = audio.currentTime || 0;
    let foundIdx = -1;
    for (let i = 0; i < parsedLyricsLines.length; i++) {
        if (cur >= parsedLyricsLines[i].time - 0.15) {
            foundIdx = i;
        } else {
            break;
        }
    }

    if (foundIdx === activeLyricIndex && !forceScroll) return;
    activeLyricIndex = foundIdx;

    const lineEls = document.querySelectorAll('#lyrics-body .lyric-line');
    lineEls.forEach((el, i) => {
        el.classList.toggle('active', i === foundIdx);
        el.classList.toggle('past', foundIdx >= 0 && i < foundIdx);
    });

    if (foundIdx >= 0 && lineEls[foundIdx]) {
        lineEls[foundIdx].scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

async function toggleLyrics() {
    const modal = document.getElementById('lyrics-modal');
    const btn = document.getElementById('lyrics-dock-btn');
    if (modal.classList.contains('open')) {
        modal.classList.remove('open');
        btn.classList.remove('active');
        return;
    }
    if (!currentTrackObj) {
        showToast('Сначала включи трек');
        return;
    }
    modal.classList.add('open');
    btn.classList.add('active');
    await loadLyricsForCurrentTrack(false);
}

// --- WEB AUDIO API: УМНЫЙ АВТО-ЭКВАЛАЙЗЕР + ВИЗУАЛИЗАТОР ---
let audioCtx = null;
let analyser = null;
let eqFilters = [];
let dataArray = null;
let smoothBars = new Float32Array(48);
let visRunning = false;
let eqSaveTimer = null;
const canvas = document.getElementById('visualizer');
const ctx = canvas.getContext('2d');

function initAudioGraph() {
    if (audioCtx) return;
    try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const src = audioCtx.createMediaElementSource(audio);

        eqFilters = EQ_FREQS.map((freq, idx) => {
            const filter = audioCtx.createBiquadFilter();
            if (idx === 0) filter.type = 'lowshelf';
            else if (idx === EQ_FREQS.length - 1) filter.type = 'highshelf';
            else {
                filter.type = 'peaking';
                filter.Q.value = 1.4;
            }
            filter.frequency.value = freq;
            filter.gain.value = 0;
            return filter;
        });

        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 128;
        analyser.smoothingTimeConstant = 0.82;

        let prevNode = src;
        for (const f of eqFilters) {
            prevNode.connect(f);
            prevNode = f;
        }
        prevNode.connect(analyser);
        analyser.connect(audioCtx.destination);

        dataArray = new Uint8Array(analyser.frequencyBinCount);
        applyEqGainsToAudio();
    } catch (e) {
        analyser = null;
        eqFilters = [];
    }
}

function autoDetectEqForTrack(track) {
    if (!launcherSettings.eq_auto || !track) return;
    const text = `${track.title || ''} ${track.artist || ''} ${track.tags || ''}`.toLowerCase();
    let chosen = 'flat';
    let label = 'Сбалансированный';

    if (/phonk|drift|memphis|cowbell|brazil|funk|808|sub/.test(text)) {
        chosen = 'phonk';
        label = 'Phonk / Drift';
    } else if (/bass|boost|hardstyle|dubstep|trap|club|edm|techno|house|dnb/.test(text)) {
        chosen = 'bass';
        label = 'Bass Boost';
    } else if (/rock|metal|punk|guitar|grunge|alt|indie/.test(text)) {
        chosen = 'rock';
        label = 'Рок / Гитары';
    } else if (/vocal|acoustic|piano|chill|lofi|lo-fi|ambient|pop|lyric/.test(text)) {
        chosen = 'vocal';
        label = 'Вокал / Акустика';
    }

    const curve = EQ_PRESETS[chosen] || EQ_PRESETS.flat;
    launcherSettings.eq_enabled = true;
    launcherSettings.eq_preset = chosen;
    launcherSettings.eq_bands = [...curve];
    syncEqUI();
    const st = document.getElementById('eq-auto-status');
    if (st) {
        st.style.display = 'block';
        st.innerText = `Авто-настройка по тегам трека: ${label}`;
    }
}

function toggleAutoEq() {
    launcherSettings.eq_auto = !launcherSettings.eq_auto;
    if (launcherSettings.eq_auto) {
        launcherSettings.eq_enabled = true;
        if (currentTrackObj) autoDetectEqForTrack(currentTrackObj);
    }
    syncEqUI();
    scheduleEqSave();
}

function applyEqGainsToAudio() {
    if (!eqFilters.length) return;
    const enabled = launcherSettings.eq_enabled !== false;
    const bands = launcherSettings.eq_bands || [0, 0, 0, 0, 0, 0];
    eqFilters.forEach((f, idx) => {
        f.gain.value = enabled ? (Number(bands[idx]) || 0) : 0;
    });
}

function syncEqUI() {
    const enabled = launcherSettings.eq_enabled !== false;
    const isAuto = !!launcherSettings.eq_auto;
    const preset = launcherSettings.eq_preset || 'flat';
    const bands = launcherSettings.eq_bands || [0, 0, 0, 0, 0, 0];

    document.getElementById('set-eq-enabled').checked = enabled;
    document.getElementById('eq-sliders-wrap').classList.toggle('disabled', !enabled);
    document.getElementById('eq-auto-status').style.display = isAuto ? 'block' : 'none';

    document.querySelectorAll('.eq-preset-btn').forEach(btn => {
        if (btn.dataset.preset === 'auto') {
            btn.classList.toggle('active', isAuto);
        } else {
            btn.classList.toggle('active', !isAuto && btn.dataset.preset === preset);
        }
    });

    bands.forEach((val, idx) => {
        const num = Number(val) || 0;
        const slider = document.getElementById('eq-band-' + idx);
        const label = document.getElementById('eq-val-' + idx);
        if (slider) slider.value = num;
        if (label) label.innerText = (num > 0 ? `+${num}` : `${num}`) + ' dB';
    });

    applyEqGainsToAudio();
}

function scheduleEqSave() {
    clearTimeout(eqSaveTimer);
    eqSaveTimer = setTimeout(() => {
        pywebview.api.save_settings(launcherSettings);
    }, 300);
}

function toggleEqEnabled() {
    launcherSettings.eq_enabled = document.getElementById('set-eq-enabled').checked;
    syncEqUI();
    scheduleEqSave();
}

function applyEqPreset(presetName) {
    const curve = EQ_PRESETS[presetName] || EQ_PRESETS.flat;
    launcherSettings.eq_enabled = true;
    launcherSettings.eq_auto = false;
    launcherSettings.eq_preset = presetName;
    launcherSettings.eq_bands = [...curve];
    syncEqUI();
    scheduleEqSave();
}

function onEqSliderInput(bandIdx, rawVal) {
    const val = parseInt(rawVal, 10) || 0;
    const bands = [...(launcherSettings.eq_bands || [0, 0, 0, 0, 0, 0])];
    bands[bandIdx] = val;
    launcherSettings.eq_bands = bands;
    launcherSettings.eq_auto = false;
    launcherSettings.eq_preset = 'custom';
    syncEqUI();
    scheduleEqSave();
}

// --- ВИЗУАЛИЗАТОР И РЕАКТИВНАЯ ТЕМА PULSE BEAT ---
function updatePulseBeatTheme(bassEnergy) {
    if (launcherSettings.theme !== 'pulsebeat') {
        document.documentElement.style.removeProperty('--beat-scale');
        document.documentElement.style.removeProperty('--beat-opacity');
        return;
    }
    const norm = Math.min(1, Math.max(0, bassEnergy / 255));
    const hue = Math.round((Date.now() / 45 + norm * 90) % 360);
    const dynamicColor = `hsl(${hue}, 92%, 56%)`;
    currentAccent = dynamicColor;
    document.documentElement.style.setProperty('--accent', dynamicColor);
    document.documentElement.style.setProperty('--beat-scale', (1 + norm * 0.22).toFixed(3));
    document.documentElement.style.setProperty('--beat-opacity', (0.24 + norm * 0.36).toFixed(2));
}

function drawVisualizer() {
    const needVis = launcherSettings.visualizer;
    const needBeat = launcherSettings.theme === 'pulsebeat';

    if (!visRunning || document.hidden || audio.paused || (!needVis && !needBeat)) {
        visRunning = false;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
    }
    requestAnimationFrame(drawVisualizer);

    let bassSum = 0;
    if (analyser) {
        analyser.getByteFrequencyData(dataArray);
        bassSum = (dataArray[0] + dataArray[1] + dataArray[2] + dataArray[3]) / 4;
    } else {
        bassSum = (Math.sin(Date.now() / 140) * 0.5 + 0.5) * 180;
    }

    if (needBeat) {
        updatePulseBeatTheme(bassSum);
    }

    if (!needVis) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const bars = 48;
    const gap = 5;
    const barW = (canvas.width - gap * (bars - 1)) / bars;

    const grad = ctx.createLinearGradient(0, 0, canvas.width, 0);
    grad.addColorStop(0, currentAccent);
    grad.addColorStop(0.5, '#ffffff');
    grad.addColorStop(1, currentAccent);
    ctx.fillStyle = grad;

    for (let i = 0; i < bars; i++) {
        const distFromCenter = Math.abs(i - bars / 2) / (bars / 2);
        const binIdx = Math.min(
            (dataArray ? dataArray.length - 1 : 31),
            Math.floor(distFromCenter * 26)
        );
        const rawVal = analyser
            ? dataArray[binIdx]
            : (Math.sin(Date.now() / 150 + i * 0.35) * 0.5 + 0.5) * 190;

        smoothBars[i] = smoothBars[i] * 0.68 + rawVal * 0.32;
        const h = Math.max(3, (smoothBars[i] / 255) * (canvas.height - 2));
        const x = i * (barW + gap);
        const y = (canvas.height - h) / 2;

        ctx.beginPath();
        ctx.roundRect(x, y, barW, h, 3);
        ctx.fill();
    }
}

function startVisualizer() {
    initAudioGraph();
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    if (!launcherSettings.visualizer && launcherSettings.theme !== 'pulsebeat') return;
    if (!visRunning) {
        visRunning = true;
        drawVisualizer();
    }
}

document.addEventListener('visibilitychange', () => {
    if (!document.hidden && !audio.paused) startVisualizer();
});

// --- ТЕМЫ, ОБОИ И НАСТРОЙКИ ---
function applySettings(s) {
    if (!s) return;
    launcherSettings = { ...launcherSettings, ...s };

    document.body.classList.remove(
        'theme-obsidian', 'theme-midnight', 'theme-amoled',
        'theme-newyear', 'theme-cyberpunk', 'theme-sakura', 'theme-pulsebeat',
        'wp-snow', 'wp-stars', 'wp-grid', 'wp-petals',
        'perf-low', 'perf-max'
    );
    document.body.classList.add('theme-' + (launcherSettings.theme || 'obsidian'));
    document.body.classList.add('perf-' + (launcherSettings.perf_mode || 'max'));

    if (launcherSettings.wallpaper && launcherSettings.wallpaper !== 'none') {
        document.body.classList.add('wp-' + launcherSettings.wallpaper);
    }

    const wpLayer = document.getElementById('wallpaper-layer');
    wpLayer.style.backgroundImage = launcherSettings.custom_bg_url
        ? `url('${launcherSettings.custom_bg_url}')`
        : '';

    document.body.classList.toggle('no-visualizer', !launcherSettings.visualizer);
    document.body.classList.toggle('compact-mode', !!launcherSettings.compact);

    if (launcherSettings.accent && launcherSettings.theme !== 'pulsebeat') {
        currentAccent = launcherSettings.accent;
        document.documentElement.style.setProperty('--accent', launcherSettings.accent);
    }

    const isLow = launcherSettings.perf_mode === 'low';
    document.getElementById('perf-btn-low').classList.toggle('active', isLow);
    document.getElementById('perf-btn-max').classList.toggle('active', !isLow);
    document.getElementById('set-likes-batch').value = String(launcherSettings.likes_batch_size || 300);
    document.getElementById('set-feed-batch').value = String(launcherSettings.feed_batch_size || 300);

    updateZapretModeButtons(launcherSettings.zapret_enabled !== false);
    document.getElementById('set-custom-bg').value = launcherSettings.custom_bg_url || '';
    document.getElementById('set-accent').value = launcherSettings.accent || '#ff5500';
    document.getElementById('set-visualizer').checked = !!launcherSettings.visualizer;
    document.getElementById('set-compact').checked = !!launcherSettings.compact;
    document.getElementById('set-widget-opacity').value = launcherSettings.widget_opacity || 0.94;
    document.getElementById('set-discord').checked = launcherSettings.discord_rpc !== false;

    syncEqUI();

    if ((launcherSettings.visualizer || launcherSettings.theme === 'pulsebeat') && !audio.paused) {
        startVisualizer();
    }
}

async function selectWallpaperPreset(themeName, wpEffect) {
    const accentMap = {
        pulsebeat: '#ff5500',
        newyear: '#38bdf8',
        cyberpunk: '#ec4899',
        sakura: '#f43f5e',
        midnight: '#0ea5e9',
        obsidian: '#ff5500',
        amoled: '#ff5500'
    };
    const newSet = {
        ...launcherSettings,
        theme: themeName,
        wallpaper: wpEffect,
        accent: accentMap[themeName] || launcherSettings.accent
    };
    applySettings(newSet);
    await pywebview.api.save_settings(newSet);
}

function pickAccent(hex) {
    document.getElementById('set-accent').value = hex;
    updateSettingsUI();
}

async function updateSettingsUI() {
    const newSet = {
        ...launcherSettings,
        custom_bg_url: document.getElementById('set-custom-bg').value.trim(),
        accent: document.getElementById('set-accent').value,
        visualizer: document.getElementById('set-visualizer').checked,
        compact: document.getElementById('set-compact').checked,
        widget_opacity: parseFloat(document.getElementById('set-widget-opacity').value),
        discord_rpc: document.getElementById('set-discord').checked
    };
    applySettings(newSet);
    await pywebview.api.save_settings(newSet);
}

// --- БАЗОВЫЕ ФУНКЦИИ ---
function setVolume(val) {
    audio.volume = parseFloat(val);
    localStorage.setItem('sc_vol', val);
}

function showToast(msg) {
    const t = document.getElementById('toast');
    t.innerText = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2800);
}

function switchTab(tabName, btn) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.view-section').forEach(s => s.classList.remove('active'));
    if (btn) btn.classList.add('active');
    document.getElementById('tab-' + tabName).classList.add('active');

    if (tabName === 'feed' && feedTracks.length === 0) loadFeed(false);
    if (tabName === 'offline') loadOffline();
    if (tabName === 'playlists') renderPlaylists();
    if (tabName === 'profile') updateProfileCounters();
    if (tabName === 'settings') refreshZapretPing();
}

// --- ЛАЙКИ И ПЛЕЙЛИСТЫ ---
async function handleLikeToggle(trackObj) {
    const res = await pywebview.api.toggle_like(trackObj);
    if (res.status === 'ok') {
        likesTracks = res.tracks || likesTracks;
        renderLikes();
        if (feedTracks.length) renderFeedList();
        updateDockLikeIcon();
        updateProfileCounters();
        showToast(res.liked ? `Лайк: ${res.message}` : 'Убрано из лайков');
    }
}

async function likeCurrentTrack() {
    if (!currentTrackObj || currentTrackObj.is_offline) {
        showToast('Включите онлайн-трек из SoundCloud');
        return;
    }
    await handleLikeToggle(currentTrackObj);
}

function updateDockLikeIcon() {
    const btn = document.getElementById('dock-like-btn');
    if (!currentTrackObj || currentTrackObj.is_offline) {
        btn.classList.remove('active');
        btn.innerHTML = SVG_HEART_OUTLINE;
        return;
    }
    const liked = isTrackLiked(currentTrackObj.url);
    btn.classList.toggle('active', liked);
    btn.innerHTML = liked ? SVG_HEART_FILLED : SVG_HEART_OUTLINE;
}

function openCreatePlaylistModal() {
    document.getElementById('new-pl-title').value = '';
    const picker = document.getElementById('new-pl-picker');
    picker.innerHTML = '';

    if (likesTracks.length === 0) {
        picker.innerHTML = '<div style="padding:10px; color:var(--text-dim); font-size:12px;">Список лайков пуст — можно создать пустой плейлист</div>';
    } else {
        likesTracks.slice(0, 60).forEach((t, idx) => {
            const row = document.createElement('label');
            row.className = 'picker-item';
            row.innerHTML = `<input type="checkbox" value="${idx}"> <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${t.artist} — ${t.title}</span>`;
            picker.appendChild(row);
        });
    }
    document.getElementById('create-pl-modal').classList.add('open');
}

function closeCreatePlaylistModal() {
    document.getElementById('create-pl-modal').classList.remove('open');
}

async function submitCreatePlaylist() {
    const title = document.getElementById('new-pl-title').value.trim();
    if (!title) {
        document.getElementById('new-pl-title').focus();
        return;
    }
    const isPublic = document.getElementById('new-pl-public').checked;
    const checked = Array.from(document.querySelectorAll('#new-pl-picker input:checked'));
    const selectedTracks = checked.map(cb => likesTracks[parseInt(cb.value)]);

    const btn = document.getElementById('create-pl-submit');
    btn.disabled = true;
    btn.innerText = 'Сохранение...';

    const res = await pywebview.api.create_playlist(title, selectedTracks, isPublic);
    playlistsData = res.playlists || playlistsData;
    renderPlaylists();
    updateProfileCounters();
    closeCreatePlaylistModal();
    btn.disabled = false;
    btn.innerText = 'Создать и сохранить в SC';
    showToast(res.message || 'Плейлист создан');
}

function openAddToPlaylistModal(trackObj) {
    if (!trackObj || trackObj.is_offline) {
        showToast('Доступно только для онлайн-треков');
        return;
    }
    trackToAddPlaylist = trackObj;
    const list = document.getElementById('add-to-pl-list');
    list.innerHTML = '';

    if (!playlistsData || playlistsData.length === 0) {
        list.innerHTML = '<div style="color:var(--text-dim); font-size:12.5px; text-align:center; padding:12px;">У вас пока нет плейлистов. Создайте первый во вкладке «Плейлисты».</div>';
    } else {
        playlistsData.forEach(pl => {
            const btn = document.createElement('button');
            btn.className = 'pl-select-btn';
            btn.innerHTML = `<span>${pl.title}</span><span style="color:var(--text-dim); font-size:11.5px;">${pl.count} треков</span>`;
            btn.onclick = async () => {
                const res = await pywebview.api.add_to_playlist(pl.id, trackToAddPlaylist);
                playlistsData = res.playlists || playlistsData;
                closeAddToPlaylistModal();
                showToast(res.message || 'Добавлено в плейлист');
            };
            list.appendChild(btn);
        });
    }
    document.getElementById('add-to-pl-modal').classList.add('open');
}

function openAddToPlaylistForCurrent() {
    openAddToPlaylistModal(currentTrackObj);
}

function closeAddToPlaylistModal() {
    document.getElementById('add-to-pl-modal').classList.remove('open');
}

// --- АВТОРИЗАЦИЯ И ИНИЦИАЛИЗАЦИЯ ---
function onAuthSuccess(prof) {
    applyProfile(prof);
    document.getElementById('welcome-overlay').classList.remove('open');
    showToast(`Вход выполнен: ${prof.nickname || prof.sc_username}`);
}

async function submitWelcome() {
    const inp = document.getElementById('welcome-username');
    const btn = document.getElementById('welcome-btn');
    const val = inp.value.trim();
    if (!val) {
        inp.focus();
        return;
    }
    btn.disabled = true;
    btn.innerText = '...';
    const statusEl = document.getElementById('likes-status');
    if (statusEl) statusEl.innerText = 'Собираем лайки и плейлисты...';

    try {
        const prof = await pywebview.api.setup_account(val);
        applyProfile(prof);
        document.getElementById('welcome-overlay').classList.remove('open');
    } catch (e) {
        showToast('Ошибка подключения к профилю');
    } finally {
        btn.disabled = false;
        btn.innerText = 'Далее →';
    }
}

window.addEventListener('pywebviewready', async () => {
    const res = await pywebview.api.get_initial_data();
    applySettings(res.settings);
    populateZapretBats(
        res.zapret_bats,
        (res.settings && res.settings.zapret_bat) || 'auto',
        res.zapret_status
    );
    refreshZapretPing();

    if (res.is_first_run) {
        document.getElementById('welcome-overlay').classList.add('open');
    } else {
        likesTracks = res.tracks || [];
        playlistsData = res.playlists || [];
        activePlaylist = likesTracks;
        applyProfile(res.profile);
        if (likesTracks.length > 0) renderLikes();
        renderPlaylists();
    }
    loadOffline();
    updateProfileCounters();

    if (res.resume_playback && res.resume_playback.track) {
        const savedTr = res.resume_playback.track;
        pendingResumeSeek = res.resume_playback.time || 0;
        pendingResumeAutoplay = !!res.resume_playback.was_playing;

        let foundIdx = activePlaylist.findIndex(t => t.url === savedTr.url);
        if (foundIdx === -1) {
            activePlaylist = [savedTr, ...activePlaylist];
            foundIdx = 0;
        }
        playTrack(foundIdx, true);
    }
});

function onTracksUpdated(newTracks, newPlaylists, moreAvailable) {
    likesTracks = newTracks || [];
    hasMoreLikes = moreAvailable !== false;
    if (newPlaylists) playlistsData = newPlaylists;
    if (activePlaylist.length === 0) activePlaylist = likesTracks;
    renderLikes();
    renderPlaylists();
    updateDockLikeIcon();
    updateProfileCounters();
}

async function triggerRefresh() {
    await pywebview.api.refresh_tracks();
    showToast('Обновление кода, лотов и треков...');
}

// --- БЕСКОНЕЧНЫЙ СКРОЛЛ С ДООБНОВЛЕНИЕМ И КНОПКОЙ ДОГРУЗКИ ---
function createTrackRowElement(t, sourceArray, isOfflineTab) {
    const isPlayingThis = currentTrackObj && currentTrackObj.url === t.url;
    const liked = !isOfflineTab && isTrackLiked(t.url);
    const item = document.createElement('div');
    item.className = 'track' + (isPlayingThis ? ' active' : '');
    item.dataset.url = t.url;

    const coverHtml = t.artwork
        ? `<img class="track-cover" src="${t.artwork}" loading="lazy" decoding="async">`
        : `<div class="track-cover">${SVG_MUSIC}</div>`;

    const actionsHtml = isOfflineTab ? '' : `
        <div class="track-actions">
            <button type="button" class="dl-btn like-btn ${liked ? 'liked' : ''}" title="${liked ? 'Убрать лайк' : 'Лайкнуть'}">${liked ? SVG_HEART_FILLED : SVG_HEART_OUTLINE}</button>
            <button type="button" class="dl-btn add-pl-btn" title="Добавить в плейлист">${SVG_PLUS}</button>
            <button type="button" class="dl-btn download-btn" title="Скачать MP3">${SVG_DL}</button>
        </div>
    `;

    item.innerHTML = `
        <div class="track-left">
            ${coverHtml}
            <div class="track-meta">
                <div class="track-title">${t.title}</div>
                <div class="track-artist">${t.artist}</div>
            </div>
        </div>
        ${actionsHtml}
    `;

    item.querySelector('.track-left').onclick = () => {
        activePlaylist = sourceArray;
        playTrack(sourceArray.indexOf(t));
    };

    if (!isOfflineTab) {
        item.querySelector('.like-btn').onclick = (e) => {
            e.stopPropagation();
            handleLikeToggle(t);
        };
        item.querySelector('.add-pl-btn').onclick = (e) => {
            e.stopPropagation();
            openAddToPlaylistModal(t);
        };
        item.querySelector('.download-btn').onclick = (e) => {
            e.stopPropagation();
            pywebview.api.download_track(t.url, t.title, t.artist);
            showToast(`Скачивание MP3: ${t.title}`);
        };
    }
    return item;
}

function buildTrackList(containerId, sourceArray, filterText = '', isOfflineTab = false, onReachBottom = null, showLoadMoreBtn = false) {
    const list = document.getElementById(containerId);
    const q = filterText.toLowerCase();
    const filtered = q
        ? sourceArray.filter(t => t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q))
        : sourceArray;

    if (filtered.length === 0) {
        list.innerHTML = `<div class="status-msg">${isOfflineTab ? 'Скачанных MP3 пока нет' : 'Треки не найдены'}</div>`;
        list.onscroll = null;
        return;
    }

    const batchSize = launcherSettings.perf_mode === 'low' ? 200 : 300;
    let renderedCount = 0;

    function updateFooterButton() {
        const oldBtn = list.querySelector('.load-more-banner');
        if (oldBtn) oldBtn.remove();
        if (!q && showLoadMoreBtn && typeof onReachBottom === 'function') {
            const btn = document.createElement('div');
            btn.className = 'load-more-banner';
            btn.innerText = '⬇ Догрузить ещё треки';
            btn.onclick = () => onReachBottom();
            list.appendChild(btn);
        }
    }

    function appendBatch() {
        const nextLimit = Math.min(filtered.length, renderedCount + batchSize);
        if (renderedCount >= nextLimit) return;
        const oldBtn = list.querySelector('.load-more-banner');
        if (oldBtn) oldBtn.remove();

        const frag = document.createDocumentFragment();
        for (let i = renderedCount; i < nextLimit; i++) {
            frag.appendChild(createTrackRowElement(filtered[i], sourceArray, isOfflineTab));
        }
        list.appendChild(frag);
        renderedCount = nextLimit;
        updateFooterButton();
    }

    list.innerHTML = '';
    appendBatch();

    list.onscroll = () => {
        if (list.scrollTop + list.clientHeight >= list.scrollHeight - 320) {
            if (renderedCount < filtered.length) {
                appendBatch();
            } else if (!q && typeof onReachBottom === 'function') {
                onReachBottom();
            }
        }
    };
}

function highlightActiveTrack() {
    document.querySelectorAll('.track').forEach(el => {
        el.classList.toggle('active', currentTrackObj && el.dataset.url === currentTrackObj.url);
    });
}

async function fetchMoreLikesOnScroll() {
    if (isFetchingMoreLikes || !hasMoreLikes) return;
    isFetchingMoreLikes = true;
    try {
        const res = await pywebview.api.load_more_likes();
        const incoming = res.tracks || [];
        hasMoreLikes = !!res.has_more;
        if (incoming.length > 0) {
            const existing = new Set(likesTracks.map(t => t.url));
            const unique = incoming.filter(t => !existing.has(t.url));
            likesTracks = [...likesTracks, ...unique];
            if (activePlaylist.length > 0 && activePlaylist[0].url === likesTracks[0].url) {
                activePlaylist = likesTracks;
            }
            renderLikes();
            updateProfileCounters();
            showToast(`Догружено треков: +${unique.length}`);
        } else {
            renderLikes();
        }
    } finally {
        isFetchingMoreLikes = false;
    }
}

function renderLikes() {
    updateProfileCounters();
    buildTrackList(
        'likes-list',
        likesTracks,
        document.getElementById('search-likes').value,
        false,
        fetchMoreLikesOnScroll,
        hasMoreLikes
    );
}

function renderPlaylists() {
    document.getElementById('pl-back-bar').style.display = 'none';
    document.getElementById('pl-top-bar').style.display = 'flex';
    const list = document.getElementById('playlists-list');
    list.onscroll = null;
    if (!playlistsData || playlistsData.length === 0) {
        list.innerHTML = '<div class="status-msg">Плейлисты не найдены. Нажмите «+ Создать плейлист».</div>';
        return;
    }
    const frag = document.createDocumentFragment();
    playlistsData.forEach(pl => {
        const item = document.createElement('div');
        item.className = 'track';
        const coverHtml = pl.artwork
            ? `<img class="track-cover" src="${pl.artwork}" loading="lazy" decoding="async">`
            : `<div class="track-cover">${SVG_DISC}</div>`;
        item.innerHTML = `
            <div class="track-left">
                ${coverHtml}
                <div class="track-meta">
                    <div class="track-title">${pl.title}</div>
                    <div class="track-artist">Треков: ${pl.count}</div>
                </div>
            </div>
        `;
        item.onclick = () => openPlaylist(pl);
        frag.appendChild(item);
    });
    list.innerHTML = '';
    list.appendChild(frag);
}

async function openPlaylist(pl) {
    document.getElementById('pl-top-bar').style.display = 'none';
    document.getElementById('pl-back-bar').style.display = 'flex';
    document.getElementById('pl-current-name').innerText = pl.title;
    const list = document.getElementById('playlists-list');
    list.innerHTML = '<div class="status-msg">Загрузка треков плейлиста...</div>';

    if (pl.tracks && pl.tracks.length >= pl.count) {
        currentPlaylistTracks = pl.tracks;
    } else {
        const res = await pywebview.api.get_playlist_tracks(pl.id);
        currentPlaylistTracks = res.tracks || pl.tracks || [];
        pl.tracks = currentPlaylistTracks;
    }
    buildTrackList('playlists-list', currentPlaylistTracks);
}

function closePlaylistView() {
    renderPlaylists();
}

function renderFeedList() {
    buildTrackList(
        'feed-list',
        feedTracks,
        '',
        false,
        () => loadFeed(true),
        hasMoreFeed
    );
}

async function loadFeed(appendMode = false) {
    if (appendMode && (isFetchingMoreFeed || !hasMoreFeed)) return;
    const q = document.getElementById('search-feed').value;
    if (!appendMode) {
        document.getElementById('feed-list').innerHTML = '<div class="status-msg">Загрузка треков и рекомендаций...</div>';
        feedTracks = [];
        hasMoreFeed = true;
    }
    isFetchingMoreFeed = true;
    try {
        const res = await pywebview.api.search_feed(q, appendMode);
        const incoming = res.tracks || [];
        hasMoreFeed = !!res.has_more;
        if (appendMode) {
            const existing = new Set(feedTracks.map(t => t.url));
            const unique = incoming.filter(t => !existing.has(t.url));
            feedTracks = [...feedTracks, ...unique];
            if (unique.length > 0) showToast(`Догружено в ленту: +${unique.length}`);
        } else {
            feedTracks = incoming;
        }
        renderFeedList();
    } finally {
        isFetchingMoreFeed = false;
    }
}

async function loadOffline() {
    const res = await pywebview.api.get_offline_tracks();
    offlineTracks = res.tracks || [];
    updateProfileCounters();
    renderOffline();
}

function renderOffline() {
    buildTrackList('offline-list', offlineTracks, document.getElementById('search-offline').value, true);
}

// --- ВОСПРОИЗВЕДЕНИЕ ---
function syncAllStates(isPlaying, force = false) {
    if (!currentTrackObj) return;
    const dur = audio.duration || currentDuration || 0;
    const el = audio.currentTime || 0;
    pywebview.api.sync_status(
        currentTrackObj.title,
        currentTrackObj.artist,
        currentTrackObj.is_offline ? '' : currentTrackObj.url,
        currentTrackObj.artwork || '',
        dur,
        el,
        isPlaying,
        currentAccent,
        force
    );
}

async function playTrack(idx, isResuming = false) {
    if (idx < 0 || idx >= activePlaylist.length) return;
    currentIndex = idx;
    autoNextTriggered = false;
    const track = activePlaylist[idx];
    currentTrackObj = track;
    highlightActiveTrack();
    updateDockLikeIcon();
    updateSystemMediaMetadata(track);
    autoDetectEqForTrack(track);

    if (document.getElementById('lyrics-modal').classList.contains('open')) {
        loadLyricsForCurrentTrack(false);
    }

    const dockCover = document.getElementById('dock-cover');
    const titleEl = document.getElementById('now-playing-title');
    const artistEl = document.getElementById('now-playing-artist');

    const nextIdx = (idx + 1) % activePlaylist.length;
    const nextTr = activePlaylist[nextIdx];
    if (nextTr && !nextTr.is_offline) {
        pywebview.api.prefetch_track(nextTr.url, nextTr.prog_api || '');
    }

    if (track.is_offline) {
        dockCover.style.display = 'none';
        const fileUrl = await pywebview.api.get_local_file_url(track.url);
        audio.src = fileUrl;
        titleEl.innerText = track.title;
        artistEl.innerText = `${track.artist} • Offline MP3`;
        if (!isResuming || pendingResumeAutoplay) {
            initAudioGraph();
            await audio.play();
        }
        return;
    }

    titleEl.innerText = track.title;
    artistEl.innerText = track.artist;
    if (track.artwork) {
        dockCover.src = track.artwork;
        dockCover.style.display = 'block';
    } else {
        dockCover.style.display = 'none';
    }

    const res = await pywebview.api.get_stream_url(
        track.url,
        track.prog_api || '',
        track.title || '',
        track.artist || ''
    );
    if (res.url) {
        if (res.is_copy) {
            showToast('Оригинал недоступен — включена рабочая копия');
        }
        currentDuration = res.duration || track.duration || 0;
        if (res.artist) {
            track.artist = res.artist;
            artistEl.innerText = res.artist;
        }
        if (res.artwork) {
            track.artwork = res.artwork;
            dockCover.src = res.artwork;
            dockCover.style.display = 'block';
        }
        if (res.tags) {
            track.tags = res.tags;
            autoDetectEqForTrack(track);
        }
        updateSystemMediaMetadata(track);
        audio.src = res.url;
        if (!isResuming || pendingResumeAutoplay) {
            initAudioGraph();
            await audio.play();
        } else {
            syncAllStates(false, true);
        }
    } else if (!isResuming) {
        artistEl.innerText = 'Трек и копии недоступны, переключаю...';
        setTimeout(nextTrack, 700);
    }
}

audio.onloadedmetadata = () => {
    if (pendingResumeSeek > 0 && audio.duration > pendingResumeSeek) {
        audio.currentTime = pendingResumeSeek;
        pendingResumeSeek = 0;
        updateSystemMediaPosition();
    }
};

function togglePlay() {
    if (!audio.src && activePlaylist.length > 0) {
        playTrack(0);
        return;
    }
    initAudioGraph();
    if (audio.paused) audio.play();
    else audio.pause();
}

function nextTrack() {
    if (activePlaylist.length === 0) return;
    playTrack((currentIndex + 1) % activePlaylist.length);
}

function prevTrack() {
    if (activePlaylist.length === 0) return;
    playTrack((currentIndex - 1 + activePlaylist.length) % activePlaylist.length);
}

function shufflePlay() {
    if (activePlaylist.length === 0) return;
    playTrack(Math.floor(Math.random() * activePlaylist.length));
}

function toggleRepeat() {
    isRepeat = !isRepeat;
    document.getElementById('repeat-btn').classList.toggle('active', isRepeat);
}

function downloadCurrent() {
    if (!currentTrackObj || currentTrackObj.is_offline) return;
    pywebview.api.download_track(currentTrackObj.url, currentTrackObj.title, currentTrackObj.artist);
    showToast(`Скачивание MP3: ${currentTrackObj.title}`);
}

function handleTrackEnd() {
    if (autoNextTriggered) return;
    autoNextTriggered = true;
    if (isRepeat) {
        autoNextTriggered = false;
        audio.currentTime = 0;
        audio.play();
        syncAllStates(true, true);
    } else {
        nextTrack();
    }
}

audio.onplay = () => {
    document.body.classList.add('playing');
    playBtn.innerHTML = SVG_PAUSE;
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
    updateSystemMediaPosition();
    startVisualizer();
    syncAllStates(true, true);
};
audio.onpause = () => {
    document.body.classList.remove('playing');
    playBtn.innerHTML = SVG_PLAY;
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
    updateSystemMediaPosition();
    syncAllStates(false, true);
};
audio.onended = handleTrackEnd;

audio.ontimeupdate = () => {
    if (!audio.duration || isNaN(audio.duration)) return;
    const pct = (audio.currentTime / audio.duration) * 100;
    document.getElementById('progress-fill').style.width = pct + '%';
    document.getElementById('time-cur').innerText = fmtTime(audio.currentTime);
    document.getElementById('time-dur').innerText = fmtTime(audio.duration);

    syncSpotifyLyricsHighlight(false);

    if (audio.duration - audio.currentTime <= 0.35 && !audio.paused) {
        handleTrackEnd();
    }
};

function seek(e) {
    if (!audio.duration) return;
    const rect = document.getElementById('progress-bar').getBoundingClientRect();
    audio.currentTime = ((e.clientX - rect.left) / rect.width) * audio.duration;
    updateSystemMediaPosition();
    syncSpotifyLyricsHighlight(true);
    if (!audio.paused) syncAllStates(true, true);
}

function seekPercent(pct) {
    if (!audio.duration || isNaN(audio.duration)) return;
    audio.currentTime = (Math.max(0, Math.min(100, pct)) / 100) * audio.duration;
    updateSystemMediaPosition();
    syncSpotifyLyricsHighlight(true);
    if (!audio.paused) syncAllStates(true, true);
}

function fmtTime(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

document.addEventListener('keydown', (e) => {
    if (document.activeElement.tagName === 'INPUT') return;
    if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
    if (e.code === 'ArrowRight') nextTrack();
    if (e.code === 'ArrowLeft') prevTrack();
});