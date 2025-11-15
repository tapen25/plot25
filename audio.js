// === 1. グローバル変数の準備 ===
const playBtn = document.getElementById('playButton');
const slider = document.getElementById('speedSlider');
const speedDisplay = document.getElementById('speedDisplay');
// RMS可視化用の要素
const rmsValueDisplay = document.getElementById('rmsValueDisplay');
const rmsBar = document.getElementById('rmsBar');

// --- ▼ 修正点: Tone.js 用の変数 ▼ ---
let player = null;      // 音源を再生するPlayer
let pitchShift = null;  // ピッチ補正エフェクト
let isInitialized = false; // Tone.js の初期化フラグ
// --- ▲ 修正点 ▲ ---

// --- ▼ 修正点: ユーザー指定の音源と速度 ▼ ---
const baseAudioFile = 'kanon_1.20x.wav'; 
const baseSpeed = 1.20; 
// --- ▲ 修正点 ▲ ---

let isPlaying = false;

// === 2. 加速度センサー用の変数 ===
// (変更なし)
const motionBuffer = [];
const DURATION = 2000;
let targetActivity = 0.0;
let currentActivity = 0.0;
const SMOOTHING = 0.05;
let motionListenerAttached = false;
const MAX_VISUAL_ACTIVITY = 12.0; // バーの最大値 (10より少し上)

// === 3. オーディオの読み込み (Tone.jsでは再生ボタンクリック時に実行) ===
// (fetch処理は不要になります)

// === 4. 再生/停止 コントロール (※Tone.js 初期化を含む) ===

playBtn.addEventListener('click', async () => { // ★ async (非同期) に変更
    
    // --- センサー許可 (変更なし) ---
    if (!motionListenerAttached) {
        requestMotionPermission();
    }

    // --- ▼ 修正点: Tone.js 初期化 (初回クリック時のみ) ▼ ---
    if (!isInitialized) {
        playBtn.disabled = true;
        playBtn.textContent = '初期化中...';

        try {
            await Tone.start(); // ユーザー操作でAudioContextを起動
            
            // 1. ピッチ補正エフェクト(PitchShift)を作成
            pitchShift = new Tone.PitchShift({
                pitch: 0, // 初期ピッチ
                windowSize: 0.1 // タイムストレッチの品質 (0.1秒)
            }).toDestination(); // スピーカーに接続

            // 2. Playerを作成
            player = new Tone.Player({
                url: baseAudioFile,
                loop: true,
                onload: () => {
                    // ロード完了
                    console.log('Tone.Player ロード完了');
                    playBtn.disabled = false;
                    slider.disabled = false;
                    playBtn.textContent = '再生';
                    isInitialized = true;
                },
                onerror: (err) => {
                    console.error('Tone.Player ロード失敗:', err);
                    playBtn.textContent = 'エラー';
                }
            }).connect(pitchShift); // PlayerをPitchShiftに接続

            slider.disabled = true; // ロード完了までスライダー無効
            
        } catch (e) {
            console.error('Tone.js 初期化失敗:', e);
            playBtn.textContent = 'エラー';
        }
        return; // ロード完了を待つ
    }
    // --- ▲ Tone.js 初期化 ▲ ---

    // --- 再生/停止の処理 ---
    if (isPlaying) {
        // 停止
        player.stop();
        isPlaying = false;
        playBtn.textContent = '再生';
    } else {
        // 再生
        if (!player || !player.loaded) return; // ロード確認

        // 初期速度とピッチを（即時）設定
        const initialSliderValue = parseFloat(slider.value);
        updateSpeedAndPitch(initialSliderValue, 0); 
        
        player.start(Tone.now()); // Tone.js の現在時刻から再生
        isPlaying = true;
        playBtn.textContent = '停止';
    }
});

// === 5. センサーの許可とリスナー登録 ===
// (変更なし)
function requestMotionPermission() {
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
        DeviceMotionEvent.requestPermission()
            .then(permissionState => {
                if (permissionState === 'granted') {
                    window.addEventListener('devicemotion', handleMotion);
                    motionListenerAttached = true;
                } else {
                    alert('加速度センサーの許可が拒否されました。');
                }
            })
            .catch(console.error);
    } else {
        window.addEventListener('devicemotion', handleMotion);
        motionListenerAttached = true;
    }
}

// === 6. 加速度センサーの処理 ===
// (変更なし)
function handleMotion(event) {
    const a = event.accelerationIncludingGravity;
    if (!a) return; 
    const mag = Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
    const now = Date.now();
    motionBuffer.push({ t: now, m: mag });
    while (motionBuffer.length > 0 && motionBuffer[0].t < now - DURATION) {
        motionBuffer.shift();
    }
    if (motionBuffer.length < 10) {
        targetActivity = 0.0;
        return;
    }
    const magnitudes = motionBuffer.map(d => d.m);
    const mean = magnitudes.reduce((s, v) => s + v, 0) / magnitudes.length;
    const variance = magnitudes.reduce((s, v) => s + (v - mean) ** 2, 0) / magnitudes.length;
    const activityLevel = Math.sqrt(variance);
    targetActivity = activityLevel;
}


// === 7. メインループ (スライダーとオーディオの更新) ===
function mainLoop() {
    // 1. センサー値のスムージング (変更なし)
    currentActivity += (targetActivity - currentActivity) * SMOOTHING;

    // 1A. 可視化 (nullチェック追加)
    if (rmsValueDisplay) rmsValueDisplay.textContent = currentActivity.toFixed(2);
    if (rmsBar) {
        const percentage = Math.min(currentActivity / MAX_VISUAL_ACTIVITY, 1) * 100;
        rmsBar.style.width = percentage + '%';
    }

    // --- ▼ 修正点: 速度マッピングを 1.20 ベースに変更 ▼ ---
    let targetSpeed;
    if (currentActivity < 2) {
        targetSpeed = 1.20;
    } else if (currentActivity < 4) {
        targetSpeed = 1.25;
    } else if (currentActivity < 6) {
        targetSpeed = 1.30;
    } else if (currentActivity < 8) {
        targetSpeed = 1.35;
    } else if (currentActivity < 10) {
        targetSpeed = 1.40;
    } else {
        targetSpeed = 1.45; // 10以上
    }
    // --- ▲ 修正点 ▲ ---
    
    // 3. スライダーUIの更新 (変更なし)
    if (slider) { // nullチェック
        const sliderVal = parseFloat(slider.value);
        if (Math.abs(sliderVal - targetSpeed) > 0.01) {
            slider.value = targetSpeed;
            if (speedDisplay) speedDisplay.textContent = targetSpeed.toFixed(2);
        }
    }
    
    // --- ▼ 修正点: オーディオ更新処理を変更 ▼ ---
    if (isPlaying && player) {
        // 0.05秒 (50ms) かけて滑らかに変更
        updateSpeedAndPitch(targetSpeed, 0.05); 
    }
    // --- ▲ 修正点 ▲ ---
    
    requestAnimationFrame(mainLoop);
}

// === 8. 手動スライダー操作の処理 ===
slider.addEventListener('input', (e) => {
    const sliderValue = parseFloat(e.target.value);
    if (speedDisplay) speedDisplay.textContent = sliderValue.toFixed(3);
    
    // --- ▼ 修正点: オーディオ更新処理を変更 ▼ ---
    if (isPlaying && player) {
        // 手動操作でも速度とピッチを更新
        updateSpeedAndPitch(sliderValue, 0.05); 
    }
    // --- ▲ 修正点 ▲ ---
});

// === 9. アニメーションループ開始 ===
mainLoop();

// --- ▼ 新しい関数: 速度とピッチの更新 ▼ ---

/**
 * 速度(playbackRate)とピッチ(pitchShift)を更新する関数
 * @param {number} targetSpeed - 目的の速度 (例: 1.25)
 * @param {number} rampTime - 滑らかに変更する時間 (秒)
 */
function updateSpeedAndPitch(targetSpeed, rampTime) {
    if (!player || !pitchShift) return;

    // 1. 速度 (playbackRate) を計算
    // (例: 1.25 / 1.20 = 1.041...)
    const newRate = targetSpeed / baseSpeed;
    
    // 2. ピッチ補正値を計算 (半音単位)
    // playbackRateが1.0 (等倍) からどれだけズレたか
    const semitonesToCorrect = 12 * Math.log2(newRate);
    
    // 3. ピッチを「逆」に補正
    // (例: 速度が上がって+0.7半音されたら、-0.7半音する)
    const targetPitch = -semitonesToCorrect;

    // 4. Tone.js のパラメータを滑らかに変更
    const now = Tone.now();
    player.playbackRate.rampTo(newRate, rampTime, now);
    pitchShift.pitch.rampTo(targetPitch, rampTime, now);
}