(function () {
  const els = {
    shell: document.querySelector(".workday-shell"),
    intro: document.querySelector("#ritualIntro"),
    stage: document.querySelector("#countdownStage"),
    trigger: document.querySelector("#ritualTrigger"),
    replayIntro: document.querySelector("#replayIntroBtn"),
    shards: document.querySelector("#slashShards"),
    dateLabel: document.querySelector("#dateLabel"),
    countdownTitle: document.querySelector("#countdownTitle"),
    hours: document.querySelector("#hoursValue"),
    minutes: document.querySelector("#minutesValue"),
    seconds: document.querySelector("#secondsValue"),
    status: document.querySelector("#statusLine"),
    orbit: document.querySelector("#progressOrbit"),
    percent: document.querySelector("#progressPercent"),
    startTime: document.querySelector("#startTimeInput"),
    offTime: document.querySelector("#offTimeInput"),
    canvas: document.querySelector("#particleCanvas"),
  };

  const storageKeys = {
    start: "lzy-workday-start",
    off: "lzy-workday-off",
  };

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const slashDelay = prefersReducedMotion ? 20 : 180;
  const underlayDelay = prefersReducedMotion ? 80 : 720;
  const revealDelay = prefersReducedMotion ? 220 : 1680;
  let introTimer = null;
  let tickTimer = null;
  let particleFrame = null;
  let particles = [];
  let introLocked = false;

  function init() {
    hydrateSchedule();
    buildShards();
    bindEvents();
    updateClock();
    startParticles();
    runIntro();
    tickTimer = window.setInterval(updateClock, 1000);
  }

  function bindEvents() {
    els.trigger.addEventListener("click", startSliceIntro);
    els.replayIntro.addEventListener("click", runIntro);

    [els.startTime, els.offTime].forEach((input) => {
      input.addEventListener("input", () => {
        const key = input === els.startTime ? storageKeys.start : storageKeys.off;
        localStorage.setItem(key, input.value);
        updateClock();
      });
    });

    window.addEventListener("resize", resizeCanvas);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) return;
      updateClock();
      resizeCanvas();
    });
  }

  function hydrateSchedule() {
    els.startTime.value = normalizeTime(localStorage.getItem(storageKeys.start), "09:00");
    els.offTime.value = normalizeTime(localStorage.getItem(storageKeys.off), "18:00");
  }

  function runIntro() {
    window.clearTimeout(introTimer);
    introLocked = false;
    els.stage.hidden = true;
    els.intro.hidden = false;
    els.shell.dataset.intro = "ready";
    els.intro.className = "ritual-intro";
    els.stage.classList.remove("stage-ready", "stage-underlay");
    els.trigger.disabled = false;
    els.trigger.blur();
    buildShards();
  }

  function startSliceIntro() {
    if (introLocked) return;
    introLocked = true;
    els.trigger.disabled = true;
    els.shell.dataset.intro = "armed";
    els.intro.classList.add("is-armed");

    const audio = primeSlashAudio();

    window.setTimeout(() => {
      if (audio) playSlashAudio(audio);
      els.shell.dataset.intro = "slicing";
      els.intro.classList.add("is-slicing");
      updateClock();
    }, slashDelay);

    window.setTimeout(() => {
      els.stage.hidden = false;
      els.stage.classList.add("stage-underlay");
      updateClock();
    }, underlayDelay);

    introTimer = window.setTimeout(finishIntro, revealDelay);
  }

  function finishIntro() {
    els.shell.dataset.intro = "complete";
    els.intro.classList.add("intro-complete");
    els.stage.hidden = false;
    els.stage.classList.remove("stage-underlay");
    els.stage.classList.add("stage-ready");
    updateClock();

    window.setTimeout(() => {
      els.intro.hidden = true;
      els.trigger.disabled = false;
    }, prefersReducedMotion ? 20 : 260);
  }

  function buildShards() {
    els.shards.textContent = "";
    const count = prefersReducedMotion ? 0 : 20;
    for (let index = 0; index < count; index += 1) {
      const shard = document.createElement("span");
      shard.style.setProperty("--x", `${-190 + Math.random() * 380}px`);
      shard.style.setProperty("--y", `${-110 + Math.random() * 220}px`);
      shard.style.setProperty("--r", `${-60 + Math.random() * 120}deg`);
      shard.style.setProperty("--delay", `${Math.random() * 90}ms`);
      shard.style.setProperty("--w", `${8 + Math.random() * 28}px`);
      shard.style.setProperty("--h", `${1 + Math.random() * 3}px`);
      els.shards.appendChild(shard);
    }
  }

  function primeSlashAudio() {
    if (prefersReducedMotion) return null;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;

    const context = new AudioContext();
    context.resume();
    return context;
  }

  function playSlashAudio(context) {
    const now = context.currentTime;
    const master = context.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(0.42, now + 0.012);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
    master.connect(context.destination);

    const whistle = context.createOscillator();
    const whistleGain = context.createGain();
    whistle.type = "sawtooth";
    whistle.frequency.setValueAtTime(4100, now);
    whistle.frequency.exponentialRampToValueAtTime(920, now + 0.2);
    whistleGain.gain.setValueAtTime(0.0001, now);
    whistleGain.gain.exponentialRampToValueAtTime(0.28, now + 0.012);
    whistleGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
    whistle.connect(whistleGain).connect(master);
    whistle.start(now);
    whistle.stop(now + 0.26);

    const hit = context.createOscillator();
    const hitGain = context.createGain();
    hit.type = "triangle";
    hit.frequency.setValueAtTime(118, now + 0.035);
    hit.frequency.exponentialRampToValueAtTime(46, now + 0.22);
    hitGain.gain.setValueAtTime(0.0001, now + 0.03);
    hitGain.gain.exponentialRampToValueAtTime(0.38, now + 0.045);
    hitGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
    hit.connect(hitGain).connect(master);
    hit.start(now + 0.03);
    hit.stop(now + 0.3);

    const bufferSize = Math.floor(context.sampleRate * 0.18);
    const buffer = context.createBuffer(1, bufferSize, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < bufferSize; index += 1) {
      data[index] = (Math.random() * 2 - 1) * (1 - index / bufferSize);
    }
    const noise = context.createBufferSource();
    const noiseFilter = context.createBiquadFilter();
    const noiseGain = context.createGain();
    noise.buffer = buffer;
    noiseFilter.type = "highpass";
    noiseFilter.frequency.setValueAtTime(2400, now);
    noiseGain.gain.setValueAtTime(0.0001, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.18, now + 0.018);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    noise.connect(noiseFilter).connect(noiseGain).connect(master);
    noise.start(now + 0.02);
    noise.stop(now + 0.2);

    window.setTimeout(() => context.close(), 700);
  }

  function updateClock() {
    const now = new Date();
    const range = getWorkRange(now);
    const remaining = Math.max(0, range.end.getTime() - now.getTime());
    const total = Math.max(1, range.end.getTime() - range.start.getTime());
    const elapsed = clamp(now.getTime() - range.start.getTime(), 0, total);
    const progress = remaining === 0 ? 1 : elapsed / total;

    els.dateLabel.textContent = formatDate(now);
    els.hours.textContent = pad(Math.floor(remaining / 3600000));
    els.minutes.textContent = pad(Math.floor((remaining % 3600000) / 60000));
    els.seconds.textContent = pad(Math.floor((remaining % 60000) / 1000));
    els.orbit.style.setProperty("--progress", `${Math.round(progress * 360)}deg`);
    els.percent.textContent = `${Math.round(progress * 100)}%`;

    if (remaining === 0) {
      els.countdownTitle.textContent = "下班时间到";
      els.status.textContent = "今天已经收工。灯可以暗一点，肩膀也可以放下来。";
      return;
    }

    els.countdownTitle.textContent = "距离下班";
    if (now < range.start) {
      els.status.textContent = `${formatDayTime(range.start, now)} 开工，${formatDayTime(range.end, now)} 下班。`;
      return;
    }

    els.status.textContent = `${formatDayTime(range.end, now)} 下班，今日进度 ${Math.round(progress * 100)}%。`;
  }

  function getWorkRange(now) {
    const startParts = parseTime(els.startTime.value, "09:00");
    const offParts = parseTime(els.offTime.value, "18:00");
    const start = dateAt(now, startParts);
    const end = dateAt(now, offParts);

    if (end <= start) {
      if (now < end) {
        start.setDate(start.getDate() - 1);
      } else {
        end.setDate(end.getDate() + 1);
      }
    } else if (now >= end) {
      start.setDate(start.getDate() + 1);
      end.setDate(end.getDate() + 1);
    }

    return { start, end };
  }

  function parseTime(value, fallback) {
    const normalized = normalizeTime(value, fallback);
    const [hours, minutes] = normalized.split(":").map(Number);
    return { hours, minutes };
  }

  function normalizeTime(value, fallback) {
    return /^\d{2}:\d{2}$/.test(value || "") ? value : fallback;
  }

  function dateAt(base, parts) {
    const date = new Date(base);
    date.setHours(parts.hours, parts.minutes, 0, 0);
    return date;
  }

  function formatDate(date) {
    return new Intl.DateTimeFormat("zh-CN", {
      weekday: "long",
      month: "long",
      day: "numeric",
    }).format(date);
  }

  function formatShortTime(date) {
    return new Intl.DateTimeFormat("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
  }

  function formatDayTime(date, now) {
    const dayOffset = dayNumber(date) - dayNumber(now);
    const prefix = dayOffset === 0 ? "" : dayOffset === 1 ? "明天 " : `${date.getMonth() + 1}月${date.getDate()}日 `;
    return `${prefix}${formatShortTime(date)}`;
  }

  function dayNumber(date) {
    return Math.floor(dateAt(date, { hours: 0, minutes: 0 }).getTime() / 86400000);
  }

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function startParticles() {
    const ctx = els.canvas.getContext("2d");
    resizeCanvas();

    if (prefersReducedMotion) {
      drawParticles(ctx);
      return;
    }

    function animate() {
      drawParticles(ctx);
      particleFrame = window.requestAnimationFrame(animate);
    }

    animate();
  }

  function resizeCanvas() {
    const ratio = window.devicePixelRatio || 1;
    const width = window.innerWidth;
    const height = window.innerHeight;
    els.canvas.width = Math.round(width * ratio);
    els.canvas.height = Math.round(height * ratio);
    els.canvas.style.width = `${width}px`;
    els.canvas.style.height = `${height}px`;
    const ctx = els.canvas.getContext("2d");
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    particles = Array.from({ length: width < 720 ? 40 : 86 }, () => makeParticle(width, height));
  }

  function makeParticle(width, height) {
    return {
      x: Math.random() * width,
      y: Math.random() * height,
      size: 0.7 + Math.random() * 2.8,
      speed: 0.14 + Math.random() * 0.64,
      drift: -0.16 + Math.random() * 0.32,
      alpha: 0.13 + Math.random() * 0.36,
    };
  }

  function drawParticles(ctx) {
    const width = window.innerWidth;
    const height = window.innerHeight;
    ctx.clearRect(0, 0, width, height);

    particles.forEach((particle) => {
      const gradient = ctx.createRadialGradient(
        particle.x,
        particle.y,
        0,
        particle.x,
        particle.y,
        particle.size * 5,
      );
      gradient.addColorStop(0, `rgba(255, 241, 208, ${particle.alpha})`);
      gradient.addColorStop(0.42, `rgba(66, 220, 210, ${particle.alpha * 0.34})`);
      gradient.addColorStop(1, "rgba(255, 241, 208, 0)");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size * 5, 0, Math.PI * 2);
      ctx.fill();

      particle.y -= particle.speed;
      particle.x += particle.drift;
      if (particle.y < -20 || particle.x < -20 || particle.x > width + 20) {
        Object.assign(particle, makeParticle(width, height), { y: height + 20 });
      }
    });
  }

  window.addEventListener("beforeunload", () => {
    window.clearInterval(tickTimer);
    window.cancelAnimationFrame(particleFrame);
  });

  init();
})();
