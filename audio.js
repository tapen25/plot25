// === 1. グローバル変数の準備 ===
const playBtn = document.getElementById('playButton');
const slider = document.getElementById('speedSlider');
const speedDisplay = document.getElementById('speedDisplay');

const audioContext = new (window.AudioContext || window.webkitAudioContext)();

const baseAudioFile = 'kanon_1.10x.wav'; 
const baseSpeed = 1.10; 

let audioBuffer = null;
let player = null;
let pitchShift = null;
let isPlaying = false;

// === 2. 加速度センサー用の変数 ===
const motionBuffer = []; 
const DURATION = 2000; 
let targetActivity = 0.0; 
let currentActivity = 0.0; 
const SMOOTHING = 0.05; 
let motionListenerAttached = false; 

// === 3. オーディオファイルの読み込み (Tone.js版) ===

fetch(baseAudioFile)
    .then(response => response.arrayBuffer())
    .then(arrayBuffer => audioContext.decodeAudioData(arrayBuffer))
    .then(decodedBuffer => {
        audioBuffer = decodedBuffer;
        
        Tone.setContext(audioContext); 

        pitchShift = new Tone.PitchShift({ pitch: 0 }).toDestination();
        player = new Tone.Player(audioBuffer).connect(pitchShift);
        player.loop = true;

        playBtn.disabled = false;
        slider.disabled = false; 
        playBtn.textContent = '再生 (センサー許可)';
    })
    .catch(err => {
        console.error('オーディオ読み込み失敗:', err);
        playBtn.textContent = 'エラー';
    });


// === 4. 再生/停止 コントロール (Tone.js版・★修正) ===

playBtn.addEventListener('click', async() => {
    // --- センサー許可の処理 ---
    if (!motionListenerAttached) {
        requestMotionPermission();
    }
    
    // --- Context開始 (iOS対応) ---
    if (Tone.context.state !== 'running') {
        await Tone.start();
        console.log('AudioContext (Tone.js) started.');
    }

    // --- 再生/停止の処理 ---
    if (isPlaying) {
        // 停止
        player?.stop(); 
        isPlaying = false;
        playBtn.textContent = '再生 (センサー許可)';
    }   else {
        // 再生
        if (!player) return; 

        const initialSliderValue = parseFloat(slider.value);
        const initialRate = initialSliderValue / baseSpeed;
        
        player.playbackRate = initialRate;

        // ★修正: .value ではなく直接代入
        const correction = -12 * Math.log2(initialRate);
        pitchShift.pitch = correction; 

        player.start(0); 
        isPlaying = true;
        playBtn.textContent = '停止';
    }
});


// === 5. センサーの許可とリスナー登録 === (変更なし)

function requestMotionPermission() {
    // 1. iOS 13+ の Safari の場合
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
        // 2. Android やその他のブラウザ
        window.addEventListener('devicemotion', handleMotion);
        motionListenerAttached = true;
    }
}

// === 6. 加速度センサーの処理 === (変更なし)

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


// === 7. メインループ (Tone.js版・★修正) ===

function mainLoop() {
    // 1. スムージング
    currentActivity += (targetActivity - currentActivity) * SMOOTHING;

    // 2. 速度マッピング
    let targetSpeed;
    if (currentActivity < 2) {
        targetSpeed = 1.10;
    } else if (currentActivity < 4) {
        targetSpeed = 1.15;
    } else if (currentActivity < 6) {
        targetSpeed = 1.20;
    } else if (currentActivity < 8) {
        targetSpeed = 1.25;
    } else if (currentActivity < 10) {
        targetSpeed = 1.30;
    } else {
        targetSpeed = 1.35; // 10以上
    }
    
    // 3. スライダーUIの更新
    const sliderVal = parseFloat(slider.value);
    if (Math.abs(sliderVal - targetSpeed) > 0.01) {
        slider.value = targetSpeed;
        speedDisplay.textContent = targetSpeed.toFixed(2);
    }
    
    // 4. オーディオの速度とピッチをシームレスに更新
    if (isPlaying && player && pitchShift) {
        const newRate = targetSpeed / baseSpeed;
        const now = Tone.now(); // (setTargetAtTime がなくても now は不要だが、害はない)

        // (1) 速度を変更 (直接代入)
        player.playbackRate = newRate; 
        
        // (2) ピッチ補正値を計算
        const correction = -12 * Math.log2(newRate);
        
        // ★修正: .setTargetAtTime ではなく直接代入
        pitchShift.pitch = correction;
    }

    // 5. 次のフレームを要求
    requestAnimationFrame(mainLoop);
}

// === 8. 手動スライダー操作の処理 (Tone.js版・★修正) ===
slider.addEventListener('input', (e) => {
    
    const sliderValue = parseFloat(e.target.value);
    speedDisplay.textContent = sliderValue.toFixed(3);
    
    const targetSpeed = sliderValue;

    if (isPlaying && player && pitchShift) {
        const newRate = targetSpeed / baseSpeed;
        const now = Tone.now(); // (setTargetAtTime がなくても now は不要だが、害はない)
        
        // (1) 速度を変更 (直接代入)
        player.playbackRate = newRate;

        // (2) ピッチ補正
        const correction = -12 * Math.log2(newRate);
        
        // ★修正: .setTargetAtTime ではなく直接代入
        pitchShift.pitch = correction;
    }
});


// === 9. アニメーションループ開始 ===
mainLoop();