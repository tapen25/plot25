// === 1. グローバル変数の準備 ===
const playBtn = document.getElementById('playButton');
const slider = document.getElementById('speedSlider');
const speedDisplay = document.getElementById('speedDisplay');

// Tone.jsのContextは自動生成されるため、明示的なnew AudioContextは一旦不要ですが
// 既存コードとの兼ね合いでTone.js経由でアクセスします。
const baseAudioFile = 'kanon_1.10x.wav'; 
const baseSpeed = 1.10; 

let player = null;
let isPlaying = false;

// === 2. 加速度センサー用の変数 ===
const motionBuffer = []; 
const DURATION = 2000; 
let targetActivity = 0.0; 
let currentActivity = 0.0; 
const SMOOTHING = 0.05; 
let motionListenerAttached = false; 

// === 3. オーディオファイルの読み込み (Tone.GrainPlayerに変更) ===

// Tone.GrainPlayerはバッファのロード機能も内包しています
player = new Tone.GrainPlayer({
    url: baseAudioFile,
    loop: true,
    // ★重要: グラニュラーシンセシスの設定
    // 音が途切れる場合はここを調整します。
    grainSize: 0.2, // デフォルトは0.2。歌声や楽器によって 0.1~0.4 で調整
    overlap: 0.1,   // デフォルトは0.1。大きくすると滑らかになるが重くなる
    onload: () => {
        playBtn.disabled = false;
        slider.disabled = false; 
        playBtn.textContent = '再生 (センサー許可)';
        console.log('Audio Loaded');
    }
}).toDestination();

// === 4. 再生/停止 コントロール ===

playBtn.addEventListener('click', async() => {
    // --- センサー許可 ---
    if (!motionListenerAttached) {
        requestMotionPermission();
    }
    
    // --- Context開始 ---
    if (Tone.context.state !== 'running') {
        await Tone.start();
    }

    // --- 再生/停止 ---
    if (isPlaying) {
        player.stop(); 
        isPlaying = false;
        playBtn.textContent = '再生 (センサー許可)';
    } else {
        if (!player.loaded) return; 

        // 初期速度の設定
        const initialSliderValue = parseFloat(slider.value);
        const initialRate = initialSliderValue / baseSpeed;
        
        // ★変更: GrainPlayerなら playbackRate を変えるだけでピッチは維持される
        player.playbackRate = initialRate;
        
        // detune（ピッチ微調整）は 0 のままでOK
        player.detune = 0; 

        player.start(); 
        isPlaying = true;
        playBtn.textContent = '停止';
    }
});

// === 5. センサー許可 (変更なし) ===
function requestMotionPermission() {
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
        DeviceMotionEvent.requestPermission()
            .then(permissionState => {
                if (permissionState === 'granted') {
                    window.addEventListener('devicemotion', handleMotion);
                    motionListenerAttached = true;
                } else {
                    alert('許可が拒否されました。');
                }
            }).catch(console.error);
    } else {
        window.addEventListener('devicemotion', handleMotion);
        motionListenerAttached = true;
    }
}

// === 6. 加速度センサー処理 (変更なし) ===
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
    targetActivity = Math.sqrt(variance);
}

// === 7. メインループ (GrainPlayer用に簡略化) ===

function mainLoop() {
    // 1. スムージング
    currentActivity += (targetActivity - currentActivity) * SMOOTHING;

    // 2. 速度マッピング
    let targetSpeed;
    if (currentActivity < 2) targetSpeed = 1.10;
    else if (currentActivity < 4) targetSpeed = 1.15;
    else if (currentActivity < 6) targetSpeed = 1.20;
    else if (currentActivity < 8) targetSpeed = 1.25;
    else if (currentActivity < 10) targetSpeed = 1.30;
    else targetSpeed = 1.35;
    
    // 3. スライダーUI更新
    const sliderVal = parseFloat(slider.value);
    if (Math.abs(sliderVal - targetSpeed) > 0.01) {
        slider.value = targetSpeed;
        speedDisplay.textContent = targetSpeed.toFixed(2);
    }
    
    // 4. GrainPlayerの速度更新
    if (isPlaying && player && player.loaded) {
        const newRate = targetSpeed / baseSpeed;
        
        // ★変更: 単純に playbackRate を代入するだけ。
        // RampToを使うとさらに滑らかになりますが、まずは直接代入で試してください。
        // ピッチ補正の計算は不要です。
        player.playbackRate = newRate; 
    }

    requestAnimationFrame(mainLoop);
}

// === 8. 手動スライダー (GrainPlayer用に簡略化) ===
slider.addEventListener('input', (e) => {
    const sliderValue = parseFloat(e.target.value);
    speedDisplay.textContent = sliderValue.toFixed(3);
    
    if (isPlaying && player && player.loaded) {
        const newRate = sliderValue / baseSpeed;
        player.playbackRate = newRate;
    }
});

mainLoop();