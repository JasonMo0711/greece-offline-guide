(function (root) {
  "use strict";
  root.createAudioGuide = function createAudioGuide(deps) {
    const $ = deps.$;
    const $$ = deps.$$;
    const state = deps.state;
    const escapeHtml = deps.escapeHtml;
    const formatTime = deps.formatTime;
    const clamp = deps.clamp;
    const playIcon = deps.playIcon;
    const showToast = deps.showToast;
    const getItem = deps.getItem;
    const getSegments = deps.getSegments;
    const AudioContextClass = root.AudioContext || root.webkitAudioContext;
    const bufferCache = new Map();
    let context = null;
    let gainNode = null;
    let source = null;
    let activeBuffer = null;
    let activeUrl = "";
    let startedAt = 0;
    let offset = 0;
    let playing = false;
    let token = 0;
    let raf = 0;
    let ttsUtterance = null;

    function ensureContext() {
      if (!context && AudioContextClass) {
        context = new AudioContextClass();
        gainNode = context.createGain();
        gainNode.gain.value = 2.2;
        gainNode.connect(context.destination);
      }
      return context;
    }

    function pickChineseVoice() {
      if (!("speechSynthesis" in root)) return null;
      const voices = root.speechSynthesis.getVoices() || [];
      return voices.find((voice) => /zh[-_]CN/i.test(voice.lang) && voice.localService) ||
        voices.find((voice) => /zh[-_]CN/i.test(voice.lang)) ||
        voices.find((voice) => /^zh/i.test(voice.lang)) || null;
    }

    async function getBuffer(url) {
      if (bufferCache.has(url)) return bufferCache.get(url);
      const ctx = ensureContext();
      if (!ctx) throw new Error("AudioContext unavailable");
      const response = await fetch(url);
      if (!response.ok) throw new Error("audio HTTP " + response.status);
      const data = await response.arrayBuffer();
      const buffer = await new Promise((resolve, reject) => {
        const promise = ctx.decodeAudioData(data, resolve, reject);
        if (promise && promise.then) promise.then(resolve).catch(reject);
      });
      bufferCache.set(url, buffer);
      return buffer;
    }

    function bindAudio(item) {
      ensureContext();
      const segments = getSegments(item);
      $("#audioSegments").innerHTML = segments.map((segment, index) => '<button class="segment-button' + (index === 0 ? " is-active" : "") + '" type="button" data-segment="' + index + '">' + escapeHtml(segment.title) + "</button>").join("");
      state.audioMode = "preloaded";
      state.audioSegment = 0;
      state.ttsSegment = 0;
      $$("[data-segment]", $("#detailView")).forEach((button) => button.addEventListener("click", () => jumpToSegment(Number(button.dataset.segment), true)));
      $$(".core-progress", $("#detailView")).forEach((input) => input.addEventListener("input", () => {
        const id = input.closest(".core-inline-player")?.dataset.corePlayer;
        const index = segments.findIndex((segment) => segment.subitemId === id);
        if (index < 0) return;
        const ratio = Number(input.value) / 100;
        if (state.audioSegment === index && activeBuffer) {
          const wasPlaying = playing;
          if (wasPlaying) pause();
          offset = activeBuffer.duration * ratio;
          syncProgress(offset, activeBuffer.duration);
          if (wasPlaying) resume();
        } else {
          offset = 0;
          loadSegment(index, false, ratio);
        }
      }));
      loadSegment(0, false);
    }

    async function loadSegment(index, autoplay, seekRatio) {
      const item = getItem();
      if (!item) return;
      const segments = getSegments(item);
      const safeIndex = clamp(Number(index), 0, segments.length - 1);
      stopSource();
      state.audioSegment = safeIndex;
      state.ttsSegment = safeIndex;
      updateButtons(safeIndex);
      const segment = segments[safeIndex];
      activeUrl = segment.audio;
      activeBuffer = null;
      offset = 0;
      const buttonLabel = segment.subitemId ? document.querySelector('[data-core-audio="' + segment.subitemId + '"] span') : null;
      if (buttonLabel && autoplay) buttonLabel.textContent = "加载中…";
      try {
        activeBuffer = await getBuffer(activeUrl);
        if (seekRatio != null) offset = activeBuffer.duration * seekRatio;
        syncProgress(offset, activeBuffer.duration);
        if (autoplay) startBuffer();
      } catch (error) {
        if (autoplay || seekRatio != null) speakSegment(safeIndex);
      }
    }

    function startBuffer() {
      if (!activeBuffer || !context || !gainNode) return;
      stopSource();
      context.resume();
      const playbackToken = ++token;
      source = context.createBufferSource();
      source.buffer = activeBuffer;
      source.connect(gainNode);
      source.onended = () => {
        if (playbackToken !== token || !playing) return;
        playing = false;
        offset = 0;
        updateButtons(state.audioSegment);
        offset = activeBuffer ? activeBuffer.duration : 0;
        syncProgress(offset, activeBuffer ? activeBuffer.duration : 0);
      };
      source.start(0, offset);
      startedAt = context.currentTime - offset;
      playing = true;
      updateButtons(state.audioSegment);
      tick();
    }

    function tick() {
      cancelAnimationFrame(raf);
      if (!playing || !activeBuffer || !context) return;
      const current = Math.min(context.currentTime - startedAt, activeBuffer.duration);
      syncProgress(current, activeBuffer.duration);
      if (current < activeBuffer.duration) raf = requestAnimationFrame(tick);
    }
    function pause() {
      if (!playing || !activeBuffer || !context) return;
      offset = Math.min(context.currentTime - startedAt, activeBuffer.duration);
      stopSource();
      playing = false;
      cancelAnimationFrame(raf);
      updateButtons(state.audioSegment);
    }

    function resume() {
      if (!activeBuffer) return;
      playing = false;
      startBuffer();
    }

    function stopSource() {
      token++;
      if (source) {
        try { source.stop(); } catch (error) {}
        source.disconnect();
        source = null;
      }
      cancelAnimationFrame(raf);
    }

    function playAudio() {
      if (!activeBuffer) loadSegment(state.audioSegment, true);
      else if (!playing) resume();
    }

    function toggleAudio() {
      if (playing) pause(); else playAudio();
    }

    function stopAudio() {
      stopSource();
      playing = false;
      offset = 0;
      if ("speechSynthesis" in root) root.speechSynthesis.cancel();
      ttsUtterance = null;
      if ($("#audioTitle")) updateButtons(state.audioSegment);
      if ($("#audioProgress")) syncProgress(0, activeBuffer ? activeBuffer.duration : 0);
    }

    function changeSegment(delta, continuePlaying) {
      const item = getItem();
      if (!item) return;
      jumpToSegment(clamp(state.audioSegment + delta, 0, getSegments(item).length - 1), continuePlaying);
    }

    function jumpToSegment(index, continuePlaying) {
      const item = getItem();
      if (!item) return;
      const segments = getSegments(item);
      const safeIndex = clamp(Number(index), 0, segments.length - 1);
      if (state.audioSegment === safeIndex && activeBuffer && !continuePlaying) {
        pause();
        return;
      }
      loadSegment(safeIndex, continuePlaying);
    }

    function speakSegment(index) {
      const item = getItem();
      if (!item || !("speechSynthesis" in root)) { showToast("音频播放失败，设备也未提供中文语音。"); return; }
      const segments = getSegments(item);
      const safeIndex = clamp(index, 0, segments.length - 1);
      root.speechSynthesis.cancel();
      state.audioSegment = safeIndex;
      state.audioMode = "tts";
      ttsUtterance = new SpeechSynthesisUtterance(segments[safeIndex].text);
      ttsUtterance.lang = "zh-CN";
      ttsUtterance.rate = .9;
      ttsUtterance.pitch = 1;
      const voice = pickChineseVoice();
      if (voice) ttsUtterance.voice = voice;
      ttsUtterance.onstart = () => { playing = true; updateButtons(safeIndex); };
      ttsUtterance.onend = () => {
        playing = false;
        updateButtons(safeIndex);
        
      };
      ttsUtterance.onerror = () => { playing = false; updateButtons(safeIndex); };
      root.speechSynthesis.speak(ttsUtterance);
    }

    function syncProgress(current, duration) {
      const ratio = duration ? current / duration : 0;
      if ($("#audioProgress")) $("#audioProgress").value = ratio * 100;
      if ($("#audioCurrent")) $("#audioCurrent").textContent = formatTime(current);
      if ($("#audioDuration")) $("#audioDuration").textContent = formatTime(duration);
      const item = getItem();
      const activeId = item ? getSegments(item)[state.audioSegment]?.subitemId : null;
      const player = activeId ? document.querySelector('[data-core-player="' + activeId + '"]') : null;
      if (player) {
        player.querySelector(".core-progress").value = ratio * 100;
        player.querySelector("[data-core-current]").textContent = formatTime(current);
        player.querySelector("[data-core-duration]").textContent = formatTime(duration);
      }
    }

    function updateButtons(index) {
      const item = getItem();
      const activeId = item ? getSegments(item)[index]?.subitemId : null;
      $$("[data-core-point]", $("#detailView")).forEach((card) => {
        const selected = card.dataset.corePoint === activeId;
        card.classList.toggle("is-current", selected);
        const button = card.querySelector(".core-audio-button");
        const label = button && button.querySelector("span");
        if (button) button.classList.toggle("is-playing", selected && playing);
        if (label) label.textContent = selected && playing ? "暂停" : "听本段";
      });
      if (item) $("#audioTitle").textContent = getSegments(item)[index]?.title || "中文语音讲解";
    }

    return {
      bindAudio,
      playAudio,
      stopAudio,
      jumpToSegment,
      changeSegment,
      toggleAudio,
      isPlaying: () => playing || Boolean(root.speechSynthesis && root.speechSynthesis.speaking)
    };
  };
})(window);

