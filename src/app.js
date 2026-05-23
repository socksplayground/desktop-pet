const canvas = document.querySelector("#stage");
const ctx = canvas.getContext("2d", { alpha: true });
const toolbar = document.querySelector("#toolbar");
const callBtn = document.querySelector("#callBtn");
const sitBtn = document.querySelector("#sitBtn");
const napBtn = document.querySelector("#napBtn");
const scaleRange = document.querySelector("#scaleRange");
const nameInput = document.querySelector("#nameInput");

const isElectron = Boolean(window.desktopPet);
if (!isElectron) document.body.classList.add("preview-mode");

const sprite = new Image();
sprite.src = "assets/dog-sprite.png";
const savedName = localStorage.getItem("desktopPetName") || "狗狗";

const pet = {
  x: 180,
  y: 260,
  vx: 82,
  mode: "walk",
  facing: 1,
  frame: 0,
  frameTime: 0,
  scale: 1,
  name: savedName,
  targetX: null,
  thought: "",
  thoughtTtl: 0,
  restLocked: false,
  dragOffsetX: 0,
  dragOffsetY: 0,
  dragging: false
};

let transparentSheet;
let frames = [];
let walkFrames = [];
let sitFrame;
let lieFrame;
let last = performance.now();
let dpr = 1;
const particles = [];
let ignoringMouse = isElectron;
if (nameInput) nameInput.value = savedName;

if (isElectron) {
  window.desktopPet.setIgnoreMouseEvents(true);
}

function resize() {
  dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  canvas.width = Math.floor(innerWidth * dpr);
  canvas.height = Math.floor(innerHeight * dpr);
  canvas.style.width = `${innerWidth}px`;
  canvas.style.height = `${innerHeight}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function isGreen(r, g, b) {
  return g > 120 && g > r * 1.45 && g > b * 1.45;
}

function prepareSpriteSheet(img) {
  const source = document.createElement("canvas");
  source.width = img.naturalWidth;
  source.height = img.naturalHeight;
  const sourceCtx = source.getContext("2d", { willReadFrequently: true });
  sourceCtx.drawImage(img, 0, 0);

  const pixels = sourceCtx.getImageData(0, 0, source.width, source.height);
  const data = pixels.data;
  const columnCounts = new Array(source.width).fill(0);
  const boundsByColumn = new Array(source.width);

  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      const i = (y * source.width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (isGreen(r, g, b)) {
        data[i + 3] = 0;
      } else if (data[i + 3] > 12) {
        const greenBias = g - Math.max(r, b);
        if (greenBias > 10) {
          data[i + 1] = Math.max(0, g - greenBias * 0.82);
          data[i] = Math.min(255, r + greenBias * 0.12);
          data[i + 2] = Math.min(255, b + greenBias * 0.08);
        }
        columnCounts[x] += 1;
        const b = boundsByColumn[x] || { top: y, bottom: y };
        b.top = Math.min(b.top, y);
        b.bottom = Math.max(b.bottom, y);
        boundsByColumn[x] = b;
      }
    }
  }
  sourceCtx.putImageData(pixels, 0, 0);

  transparentSheet = source;
  frames = findFrames(columnCounts, boundsByColumn, source.height);
  const sorted = [...frames].sort((a, b) => a.x - b.x);
  sitFrame = sorted[0] || sorted[sorted.length - 1];
  lieFrame = sorted[sorted.length - 1] || sitFrame;
  walkFrames = sorted
    .filter((f) => f.w > 185 && f.h < 260)
    .slice(0, 5);

  if (walkFrames.length < 3) {
    walkFrames = sorted.slice(1, Math.max(2, sorted.length - 2));
  }
}

function findFrames(columnCounts, boundsByColumn, sheetHeight) {
  const result = [];
  let start = -1;
  const threshold = Math.max(8, Math.floor(sheetHeight * 0.018));

  for (let x = 0; x <= columnCounts.length; x += 1) {
    const active = x < columnCounts.length && columnCounts[x] > threshold;
    if (active && start === -1) start = x;
    if ((!active || x === columnCounts.length) && start !== -1) {
      const end = x - 1;
      if (end - start > 42) {
        let top = sheetHeight;
        let bottom = 0;
        for (let cx = start; cx <= end; cx += 1) {
          if (!boundsByColumn[cx]) continue;
          top = Math.min(top, boundsByColumn[cx].top);
          bottom = Math.max(bottom, boundsByColumn[cx].bottom);
        }
        result.push(padFrame({ x: start, y: top, w: end - start + 1, h: bottom - top + 1 }, 16));
      }
      start = -1;
    }
  }

  return result;
}

function padFrame(frame, pad) {
  return {
    x: Math.max(0, frame.x - pad),
    y: Math.max(0, frame.y - pad),
    w: Math.min(sprite.naturalWidth - frame.x, frame.w + pad * 2),
    h: Math.min(sprite.naturalHeight - frame.y, frame.h + pad * 2)
  };
}

function currentFrame() {
  if (pet.mode === "sit") return sitFrame;
  if (pet.mode === "lie") return lieFrame;
  return walkFrames[pet.frame % walkFrames.length] || sitFrame;
}

function petRect() {
  const f = currentFrame();
  const scale = 0.62 * pet.scale;
  return {
    x: pet.x,
    y: pet.y,
    w: f.w * scale,
    h: f.h * scale,
    scale
  };
}

function drawPet() {
  const f = currentFrame();
  const r = petRect();

  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.ellipse(r.x + r.w / 2, r.y + r.h - 10, r.w * 0.34, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(r.x + r.w / 2, r.y + r.h / 2);
  ctx.scale(pet.facing, 1);
  ctx.drawImage(transparentSheet, f.x, f.y, f.w, f.h, -r.w / 2, -r.h / 2, r.w, r.h);
  ctx.restore();

  if (pet.name && pet.mode !== "walk") {
    drawNameTag(r);
  }

  if (pet.thought && pet.thoughtTtl > 0) {
    ctx.save();
    ctx.font = "600 18px -apple-system, BlinkMacSystemFont, sans-serif";
    const width = ctx.measureText(pet.thought).width + 28;
    const x = Math.max(12, Math.min(innerWidth - width - 12, r.x + r.w / 2 - width / 2));
    const y = Math.max(52, r.y - 38);
    ctx.fillStyle = "rgba(15, 23, 42, 0.82)";
    roundRect(ctx, x, y, width, 34, 8);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.fillText(pet.thought, x + 14, y + 23);
    ctx.restore();
  }
}

function drawNameTag(r) {
  ctx.save();
  ctx.font = "600 14px -apple-system, BlinkMacSystemFont, sans-serif";
  const label = pet.name.trim();
  const width = Math.min(150, Math.max(44, ctx.measureText(label).width + 22));
  const x = Math.max(10, Math.min(innerWidth - width - 10, r.x + r.w / 2 - width / 2));
  const y = Math.max(10, r.y - 26);
  ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
  roundRect(ctx, x, y, width, 24, 8);
  ctx.fill();
  ctx.fillStyle = "#172033";
  ctx.fillText(label, x + 11, y + 17);
  ctx.restore();
}

function roundRect(context, x, y, w, h, r) {
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
}

function update(dt) {
  if (!transparentSheet || frames.length === 0) return;

  pet.frameTime += dt;
  if (pet.mode === "walk" && pet.frameTime > 0.11) {
    pet.frame = (pet.frame + 1) % Math.max(1, walkFrames.length);
    pet.frameTime = 0;
  }

  if (!pet.dragging && pet.mode === "walk") {
    const r = petRect();
    if (pet.targetX !== null) {
      const dx = pet.targetX - (pet.x + r.w / 2);
      pet.vx = Math.sign(dx || pet.vx) * 132;
      if (Math.abs(dx) < 20) {
        pet.targetX = null;
        say("到了！");
        sit(1.4);
      }
    }

    pet.x += pet.vx * dt;
    pet.facing = pet.vx >= 0 ? -1 : 1;
    pet.y += Math.sin(performance.now() / 180) * 0.2;

    if (pet.x < 10) {
      pet.x = 10;
      pet.vx = Math.abs(pet.vx);
    }
    if (pet.x + r.w > innerWidth - 10) {
      pet.x = innerWidth - r.w - 10;
      pet.vx = -Math.abs(pet.vx);
    }
  }

  pet.thoughtTtl = Math.max(0, pet.thoughtTtl - dt);
  if (pet.mode !== "walk" && pet.modeUntil !== null && pet.frameTime > pet.modeUntil) {
    walk();
  }

  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const p = particles[i];
    p.ttl -= dt;
    p.y -= p.speed * dt;
    p.x += Math.sin(p.ttl * 10) * 0.4;
    if (p.ttl <= 0) particles.splice(i, 1);
  }
}

function render() {
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  for (const p of particles) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.ttl);
    ctx.font = `${p.size}px -apple-system, BlinkMacSystemFont, sans-serif`;
    ctx.fillText(p.text, p.x, p.y);
    ctx.restore();
  }
  if (transparentSheet) drawPet();
}

function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt);
  render();
  requestAnimationFrame(loop);
}

function say(text) {
  pet.thought = text;
  pet.thoughtTtl = 1.8;
}

function burst(text = "♥") {
  const r = petRect();
  for (let i = 0; i < 8; i += 1) {
    particles.push({
      text,
      x: r.x + r.w * (0.25 + Math.random() * 0.5),
      y: r.y + r.h * 0.28,
      ttl: 0.7 + Math.random() * 0.5,
      speed: 28 + Math.random() * 42,
      size: 18 + Math.random() * 10
    });
  }
}

function walk() {
  pet.mode = "walk";
  pet.frameTime = 0;
  pet.modeUntil = null;
  pet.vx = pet.vx === 0 ? 90 : pet.vx;
}

function sit(seconds = null) {
  pet.mode = "sit";
  pet.frameTime = 0;
  pet.modeUntil = seconds;
  pet.vx = 0;
}

function nap(seconds = null) {
  pet.mode = "lie";
  pet.frameTime = 0;
  pet.modeUntil = seconds;
  pet.vx = 0;
  say("休息一下");
}

function pointHitsPet(clientX, clientY) {
  const r = petRect();
  return clientX >= r.x && clientX <= r.x + r.w && clientY >= r.y && clientY <= r.y + r.h;
}

function pointHitsToolbar(clientX, clientY) {
  if (!toolbar || toolbar.classList.contains("hidden")) return false;
  const rect = toolbar.getBoundingClientRect();
  return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
}

function updateMousePassThrough(event) {
  if (!isElectron || pet.dragging) return;
  const shouldIgnore = !pointHitsPet(event.clientX, event.clientY) && !pointHitsToolbar(event.clientX, event.clientY);
  if (shouldIgnore === ignoringMouse) return;
  ignoringMouse = shouldIgnore;
  window.desktopPet.setIgnoreMouseEvents(shouldIgnore);
}

function acceptMouseEvents() {
  if (!isElectron || !ignoringMouse) return;
  ignoringMouse = false;
  window.desktopPet.setIgnoreMouseEvents(false);
}

function ignoreMouseEvents() {
  if (!isElectron || ignoringMouse || pet.dragging) return;
  ignoringMouse = true;
  window.desktopPet.setIgnoreMouseEvents(true);
}

canvas.addEventListener("pointerdown", (event) => {
  if (!pointHitsPet(event.clientX, event.clientY)) {
    if (pet.restLocked) {
      say("休息中");
      return;
    }
    pet.targetX = event.clientX;
    walk();
    return;
  }

  const r = petRect();
  pet.dragging = true;
  acceptMouseEvents();
  pet.dragOffsetX = event.clientX - r.x;
  pet.dragOffsetY = event.clientY - r.y;
  canvas.setPointerCapture(event.pointerId);
});

canvas.addEventListener("pointermove", (event) => {
  updateMousePassThrough(event);
  if (!pet.dragging) return;
  const r = petRect();
  pet.x = Math.max(0, Math.min(innerWidth - r.w, event.clientX - pet.dragOffsetX));
  pet.y = Math.max(0, Math.min(innerHeight - r.h, event.clientY - pet.dragOffsetY));
});

canvas.addEventListener("pointerup", (event) => {
  if (!pet.dragging) return;
  pet.dragging = false;
  canvas.releasePointerCapture(event.pointerId);
  say("汪！");
  burst();
  sit(1.2);
  updateMousePassThrough(event);
});

canvas.addEventListener("dblclick", (event) => {
  if (pet.restLocked) {
    say("休息中");
    return;
  }
  pet.targetX = event.clientX;
  say("來了！");
  walk();
});

canvas.addEventListener("contextmenu", (event) => {
  event.preventDefault();
  pet.restLocked = true;
  nap();
});

callBtn.addEventListener("click", () => {
  pet.restLocked = false;
  pet.targetX = innerWidth / 2;
  say(`${pet.name} 來找你`);
  walk();
});

sitBtn.addEventListener("click", () => {
  pet.restLocked = true;
  say("乖乖坐好");
  burst("♥");
  sit();
});

napBtn.addEventListener("click", () => {
  pet.restLocked = true;
  nap();
});

scaleRange.addEventListener("input", () => {
  pet.scale = Number(scaleRange.value) / 100;
});

nameInput.addEventListener("input", () => {
  const nextName = nameInput.value.trim() || "狗狗";
  pet.name = nextName;
  localStorage.setItem("desktopPetName", nextName);
});

window.addEventListener("keydown", (event) => {
  if (event.key.toLowerCase() === "h") toolbar.classList.toggle("hidden");
  if (event.key === " ") nap();
  if (event.key.toLowerCase() === "c") {
    pet.restLocked = false;
    pet.targetX = innerWidth / 2;
    walk();
  }
});

sprite.addEventListener("load", () => {
  prepareSpriteSheet(sprite);
  const f = currentFrame();
  pet.y = Math.max(120, innerHeight - f.h * 0.62 - 70);
  resize();
  requestAnimationFrame(loop);
});

window.addEventListener("resize", resize);
window.addEventListener("mousemove", updateMousePassThrough);
window.addEventListener("mouseleave", ignoreMouseEvents);
resize();
