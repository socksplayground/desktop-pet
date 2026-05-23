const canvas = document.querySelector("#petStage");
const ctx = canvas.getContext("2d", { alpha: true });
const DEFAULT_SPRITE_SRC = "assets/dog-sprite.png";

const sprite = new Image();

const REST_ATTENTION_RANGE = 180;

const pet = {
  windowX: 120,
  windowY: 120,
  globalX: 120,
  globalY: null,
  localX: null,
  localY: null,
  vx: 82,
  mode: "walk",
  facing: 1,
  frame: 0,
  frameTime: 0,
  modeUntil: null,
  scale: Number(localStorage.getItem("desktopPetScale") || "100") / 100,
  speed: Number(localStorage.getItem("desktopPetSpeed") || "100"),
  heartColor: localStorage.getItem("desktopPetHeartColor") || "#ff5c8a",
  sitReminderMinutes: Number(localStorage.getItem("desktopPetSitReminderMinutes") || "1"),
  sitReminderMessage: localStorage.getItem("desktopPetSitReminderMessage") || "記得喝水",
  name: localStorage.getItem("desktopPetName") || "狗狗",
  targetX: null,
  thought: "",
  thoughtTtl: 0,
  restLocked: false,
  restStartedAt: null,
  attentionMode: false,
  attentionAnchorX: null,
  attentionMinX: null,
  attentionMaxX: null,
  dragging: false,
  dragOffsetX: 0,
  dragOffsetY: 0
};

let workArea = { x: 0, y: 0, width: 1440, height: 900 };
let transparentSheet;
let frames = [];
let walkFrames = [];
let sitFrame;
let lieFrame;
let spriteMode = "green";
let customFrameCount = 0;
let spriteRightFacing = -1;
let last = performance.now();
let dpr = 1;
let loopStarted = false;
const particles = [];
let clickTimer = null;
let lastClickAt = 0;

function hasValidWorkArea(area) {
  return (
    area &&
    Number.isFinite(area.x) &&
    Number.isFinite(area.y) &&
    Number.isFinite(area.width) &&
    Number.isFinite(area.height)
  );
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
  if (spriteMode === "fixed") {
    prepareFixedSpriteSheet(img);
    return;
  }

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
        const bounds = boundsByColumn[x] || { top: y, bottom: y };
        bounds.top = Math.min(bounds.top, y);
        bounds.bottom = Math.max(bounds.bottom, y);
        boundsByColumn[x] = bounds;
      }
    }
  }
  sourceCtx.putImageData(pixels, 0, 0);

  transparentSheet = source;
  frames = findFrames(columnCounts, boundsByColumn, source.height);
  const sorted = [...frames].sort((a, b) => a.x - b.x);
  sitFrame = sorted[0] || sorted[sorted.length - 1];
  lieFrame = sorted[sorted.length - 1] || sitFrame;
  walkFrames = sorted.filter((f) => f.w > 185 && f.h < 260).slice(0, 5);

  if (walkFrames.length < 3) {
    walkFrames = sorted.slice(1, Math.max(2, sorted.length - 2));
  }
}

function opaqueBoundsInSlot(context, slotX, slotY, slotWidth, slotHeight) {
  const pixels = context.getImageData(slotX, slotY, slotWidth, slotHeight);
  const data = pixels.data;
  let minX = slotWidth;
  let minY = slotHeight;
  let maxX = 0;
  let maxY = 0;

  for (let y = 0; y < slotHeight; y += 1) {
    for (let x = 0; x < slotWidth; x += 1) {
      if (data[(y * slotWidth + x) * 4 + 3] <= 12) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (minX > maxX || minY > maxY) {
    return { x: slotX, y: slotY, w: slotWidth, h: slotHeight };
  }

  const pad = 8;
  const x = Math.max(slotX, slotX + minX - pad);
  const y = Math.max(slotY, slotY + minY - pad);
  const right = Math.min(slotX + slotWidth - 1, slotX + maxX + pad);
  const bottom = Math.min(slotY + slotHeight - 1, slotY + maxY + pad);
  return { x, y, w: right - x + 1, h: bottom - y + 1 };
}

function prepareFixedSpriteSheet(img) {
  const source = document.createElement("canvas");
  source.width = img.naturalWidth;
  source.height = img.naturalHeight;
  const sourceCtx = source.getContext("2d", { willReadFrequently: true });
  sourceCtx.clearRect(0, 0, source.width, source.height);
  sourceCtx.drawImage(img, 0, 0);

  transparentSheet = source;
  const count = Math.max(3, Math.round(customFrameCount || 0));
  const slotWidth = source.width / count;
  const slotHeight = source.height;
  frames = Array.from({ length: count }, (_, index) => {
    const slotX = Math.round(index * slotWidth);
    const nextSlotX = Math.round((index + 1) * slotWidth);
    return opaqueBoundsInSlot(sourceCtx, slotX, 0, nextSlotX - slotX, slotHeight);
  });
  sitFrame = frames[0];
  lieFrame = frames[frames.length - 1] || sitFrame;
  walkFrames = frames.slice(1, -1);
}

function loadSpriteSheet(src, options = {}) {
  transparentSheet = null;
  frames = [];
  walkFrames = [];
  sitFrame = null;
  lieFrame = null;
  spriteMode = options.mode || "green";
  customFrameCount = Number(options.frameCount || 0);
  spriteRightFacing = options.facing === "right" ? 1 : -1;
  pet.frame = 0;
  pet.frameTime = 0;
  sprite.src = src;
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
  const x = Math.max(0, frame.x - pad);
  const y = Math.max(0, frame.y - pad);
  return {
    x,
    y,
    w: Math.min(sprite.naturalWidth - x, frame.w + pad * 2),
    h: Math.min(sprite.naturalHeight - y, frame.h + pad * 2)
  };
}

function currentFrame() {
  if (pet.mode === "sit") return sitFrame;
  if (pet.mode === "lie") return lieFrame;
  return walkFrames[pet.frame % walkFrames.length] || sitFrame;
}

function petRect() {
  const f = currentFrame();
  if (!f) {
    return {
      x: Math.round(innerWidth * 0.2),
      y: Math.round(innerHeight * 0.2),
      w: Math.round(innerWidth * 0.6),
      h: Math.round(innerHeight * 0.6),
      scale: 1
    };
  }
  const scale = 0.62 * pet.scale;
  const w = f.w * scale;
  const h = f.h * scale;
  return {
    x: Math.round(pet.localX ?? (innerWidth - w) / 2),
    y: Math.round(pet.localY ?? (innerHeight - h - 28)),
    w,
    h,
    scale
  };
}

function petScreenBounds() {
  const visible = petRect();
  return {
    minX: workArea.x,
    maxX: workArea.x + workArea.width - visible.w,
    minY: workArea.y,
    maxY: workArea.y + workArea.height - visible.h - 20
  };
}

function placePetAtGlobalPosition(globalX, globalY = pet.globalY) {
  const visible = petRect();
  if (!hasValidWorkArea(workArea) || !Number.isFinite(globalX) || !Number.isFinite(visible.w) || !Number.isFinite(visible.h)) return;
  const minGlobalX = workArea.x;
  const maxGlobalX = workArea.x + workArea.width - visible.w;
  const minGlobalY = workArea.y;
  const maxGlobalY = workArea.y + workArea.height - visible.h - 20;
  pet.globalX = Math.max(minGlobalX, Math.min(maxGlobalX, globalX));
  pet.globalY = Math.max(minGlobalY, Math.min(maxGlobalY, Number.isFinite(globalY) ? globalY : maxGlobalY));
  pet.localX = pet.globalX - workArea.x;
  pet.localY = pet.globalY - workArea.y;
}

function placePetAtGlobalX(globalX) {
  placePetAtGlobalPosition(globalX, pet.globalY);
}

function drawNameTag(r) {
  ctx.save();
  ctx.font = "600 11px -apple-system, BlinkMacSystemFont, sans-serif";
  const label = pet.name.trim();
  const width = Math.min(120, Math.max(34, ctx.measureText(label).width + 16));
  const x = Math.max(10, Math.min(innerWidth - width - 10, r.x + r.w / 2 - width / 2));
  const y = Math.min(innerHeight - 20, r.y + r.h + 4);
  ctx.fillStyle = "rgba(255, 255, 255, 0.76)";
  roundRect(ctx, x, y, width, 17, 6);
  ctx.fill();
  ctx.fillStyle = "#1f2937";
  ctx.fillText(label, x + 8, y + 12);
  ctx.restore();
}

function readableTextColor(hexColor) {
  const match = /^#?([0-9a-f]{6})$/i.exec(hexColor || "");
  if (!match) return "#fff";
  const value = match[1];
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62 ? "#172033" : "#fff";
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

  if (pet.name && pet.mode !== "walk") drawNameTag(r);

  if (pet.thought && pet.thoughtTtl > 0) {
    ctx.save();
    ctx.font = "600 18px -apple-system, BlinkMacSystemFont, sans-serif";
    const width = ctx.measureText(pet.thought).width + 28;
    const x = Math.max(10, Math.min(innerWidth - width - 10, r.x + r.w / 2 - width / 2));
    const y = Math.max(36, r.y - 38);
    ctx.fillStyle = pet.heartColor;
    roundRect(ctx, x, y, width, 34, 8);
    ctx.fill();
    ctx.fillStyle = readableTextColor(pet.heartColor);
    ctx.fillText(pet.thought, x + 14, y + 23);
    ctx.restore();
  }
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
  const reminderDelayMs = Math.max(0.1, pet.sitReminderMinutes || 1) * 60000;
  if (pet.restLocked && pet.mode === "sit" && pet.restStartedAt !== null && performance.now() - pet.restStartedAt > reminderDelayMs) {
    startAttentionWalk();
  }

  if (pet.mode === "walk" && pet.frameTime > 0.11) {
    pet.frame = (pet.frame + 1) % Math.max(1, walkFrames.length);
    pet.frameTime = 0;
  }

  if (!pet.dragging && pet.mode === "walk") {
    if (pet.targetX !== null) {
      const dx = pet.targetX - pet.globalX;
      pet.vx = Math.sign(dx || pet.vx || 1) * pet.speed;
      if (Math.abs(dx) < 12) {
        pet.targetX = null;
        say("到了！");
        sit(null);
      }
    }

    pet.globalX += pet.vx * dt;
    pet.facing = pet.vx >= 0 ? spriteRightFacing : -spriteRightFacing;

    const bounds = petScreenBounds();
    const minX = pet.attentionMode ? Math.max(bounds.minX, pet.attentionMinX) : bounds.minX;
    const maxX = pet.attentionMode ? Math.min(bounds.maxX, pet.attentionMaxX) : bounds.maxX;
    if (pet.globalX < minX) {
      pet.globalX = minX;
      pet.vx = Math.abs(pet.vx);
    }
    if (pet.globalX > maxX) {
      pet.globalX = maxX;
      pet.vx = -Math.abs(pet.vx);
    }
    placePetAtGlobalX(pet.globalX);
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
    ctx.fillStyle = p.color;
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

function burst(text = "♥", color = pet.heartColor) {
  const r = petRect();
  for (let i = 0; i < 8; i += 1) {
    particles.push({
      text,
      color,
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
  pet.restStartedAt = null;
  pet.vx = pet.vx === 0 ? pet.speed : Math.sign(pet.vx) * pet.speed;
}

function sit(seconds = null) {
  pet.mode = "sit";
  pet.frameTime = 0;
  pet.modeUntil = seconds;
  pet.targetX = null;
  pet.vx = 0;
  pet.attentionMode = false;
  pet.restStartedAt = pet.restLocked && seconds === null ? performance.now() : null;
}

function nap(seconds = null) {
  pet.mode = "lie";
  pet.frameTime = 0;
  pet.modeUntil = seconds;
  pet.targetX = null;
  pet.vx = 0;
  pet.attentionMode = false;
  pet.restStartedAt = null;
  say("休息一下");
}

function startAttentionWalk() {
  const bounds = petScreenBounds();
  pet.attentionAnchorX = pet.globalX;
  pet.attentionMinX = Math.max(bounds.minX, pet.globalX - REST_ATTENTION_RANGE / 2);
  pet.attentionMaxX = Math.min(bounds.maxX, pet.globalX + REST_ATTENTION_RANGE / 2);
  pet.attentionMode = true;
  pet.restStartedAt = null;
  pet.targetX = null;
  pet.mode = "walk";
  pet.frameTime = 0;
  pet.vx = (Math.random() > 0.5 ? 1 : -1) * Math.max(40, pet.speed * 0.72);
  say(pet.sitReminderMessage || "記得喝水");
}

function singleClickPet() {
  pet.restLocked = pet.mode !== "lie";
  pet.attentionMode = false;
  pet.restStartedAt = null;
  pet.targetX = null;
  if (pet.mode === "lie") {
    say("來走走");
    walk();
    return;
  }
  burst();
  nap();
}

function doubleClickPet() {
  if (clickTimer !== null) {
    clearTimeout(clickTimer);
    clickTimer = null;
  }
  pet.restLocked = true;
  pet.attentionMode = false;
  pet.restStartedAt = null;
  say("乖乖坐好");
  burst("♥");
  sit();
}

function queuePetClick() {
  const now = performance.now();
  if (now - lastClickAt < 280) {
    lastClickAt = 0;
    doubleClickPet();
    return;
  }
  lastClickAt = now;
  clickTimer = setTimeout(() => {
    clickTimer = null;
    lastClickAt = 0;
    singleClickPet();
  }, 260);
}

function pointHitsPet(clientX, clientY) {
  const r = petRect();
  return clientX >= r.x && clientX <= r.x + r.w && clientY >= r.y && clientY <= r.y + r.h;
}

function updateMousePassthrough(clientX, clientY) {
  window.desktopPet.setMousePassthrough(!pointHitsPet(clientX, clientY));
}

function finishPetDrag(event, allowClick = true) {
  if (!pet.dragging) return;
  const moved = pet.dragMoved;
  pet.dragging = false;
  pet.dragMoved = false;
  pet.targetX = null;
  pet.attentionMode = false;

  if (event?.pointerId !== undefined) {
    try {
      if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }
    } catch {
      // Pointer capture may already be gone when macOS cancels the drag.
    }
  }

  if (!moved) {
    if (allowClick) queuePetClick();
    updateMousePassthrough(event?.clientX ?? -1, event?.clientY ?? -1);
    return;
  }

  pet.restLocked = true;
  burst();
  nap();
  updateMousePassthrough(event?.clientX ?? -1, event?.clientY ?? -1);
}

canvas.addEventListener("pointerdown", (event) => {
  if (!pointHitsPet(event.clientX, event.clientY)) return;
  pet.dragging = true;
  pet.dragMoved = false;
  pet.dragStartX = event.screenX;
  pet.dragStartY = event.screenY;
  pet.dragOffsetX = event.screenX - pet.globalX;
  pet.dragOffsetY = event.screenY - pet.globalY;
  pet.targetX = null;
  pet.attentionMode = false;
  window.desktopPet.setMousePassthrough(false);
  canvas.setPointerCapture(event.pointerId);
  event.preventDefault();
});

canvas.addEventListener("pointermove", (event) => {
  if (!pet.dragging) return;
  const movedX = Math.abs(event.screenX - pet.dragStartX);
  const movedY = Math.abs(event.screenY - pet.dragStartY);
  pet.dragMoved = pet.dragMoved || movedX > 6 || movedY > 6;
  if (!pet.dragMoved) return;
  const bounds = petScreenBounds();
  pet.globalX = Math.max(bounds.minX, Math.min(bounds.maxX, event.screenX - pet.dragOffsetX));
  pet.globalY = Math.max(bounds.minY, Math.min(bounds.maxY, event.screenY - pet.dragOffsetY));
  placePetAtGlobalPosition(pet.globalX, pet.globalY);
  event.preventDefault();
});

canvas.addEventListener("pointerup", (event) => {
  finishPetDrag(event, true);
});

canvas.addEventListener("pointercancel", (event) => {
  finishPetDrag(event, false);
});

canvas.addEventListener("lostpointercapture", (event) => {
  finishPetDrag(event, false);
});

window.addEventListener("pointerup", (event) => {
  finishPetDrag(event, true);
});

window.addEventListener("blur", () => {
  finishPetDrag(null, false);
});

canvas.addEventListener("contextmenu", (event) => {
  event.preventDefault();
  window.desktopPet.showControlPanel();
  window.desktopPet.showPetMenu({ x: event.clientX, y: event.clientY });
});

canvas.addEventListener("mousemove", (event) => {
  if (pet.dragging) return;
  updateMousePassthrough(event.clientX, event.clientY);
});

canvas.addEventListener("mouseleave", () => {
  window.desktopPet.setMousePassthrough(true);
});

window.desktopPet.onCommand((command) => {
  if (command.type === "name") {
    pet.name = command.value || "狗狗";
    localStorage.setItem("desktopPetName", pet.name);
  }
  if (command.type === "scale") {
    pet.scale = command.value || 1;
    localStorage.setItem("desktopPetScale", String(Math.round(pet.scale * 100)));
    placePetAtGlobalPosition(pet.globalX, pet.globalY);
  }
  if (command.type === "speed") {
    pet.speed = command.value || 100;
    localStorage.setItem("desktopPetSpeed", String(Math.round(pet.speed)));
    if (pet.mode === "walk") {
      pet.vx = Math.sign(pet.vx || 1) * pet.speed;
    }
  }
  if (command.type === "heartColor") {
    pet.heartColor = command.value || "#ff5c8a";
    localStorage.setItem("desktopPetHeartColor", pet.heartColor);
  }
  if (command.type === "customSprite" && command.value) {
    const payload = typeof command.value === "string" ? { src: command.value } : command.value;
    const frameCount = Number(payload.frameCount || localStorage.getItem("desktopPetCustomFrameCount") || "0");
    const facing = payload.facing || localStorage.getItem("desktopPetCustomFacing") || "right";
    const mode = frameCount >= 3 ? "fixed" : "green";
    say("新寶貝來了");
    localStorage.setItem("desktopPetCustomSpriteSheet", payload.src);
    localStorage.setItem("desktopPetCustomFrameCount", String(frameCount));
    localStorage.setItem("desktopPetCustomFacing", facing);
    loadSpriteSheet(payload.src, { mode, frameCount, facing });
  }
  if (command.type === "resetSprite") {
    say("恢復預設");
    localStorage.removeItem("desktopPetCustomSpriteSheet");
    localStorage.removeItem("desktopPetCustomFrameCount");
    localStorage.removeItem("desktopPetCustomFacing");
    localStorage.removeItem("desktopPetLibrary");
    localStorage.removeItem("desktopPetSelectedId");
    loadSpriteSheet(DEFAULT_SPRITE_SRC, { mode: "green", facing: "left" });
  }
  if (command.type === "sitReminderMinutes") {
    pet.sitReminderMinutes = Math.max(0.1, Number(command.value) || 1);
    localStorage.setItem("desktopPetSitReminderMinutes", String(pet.sitReminderMinutes));
  }
  if (command.type === "sitReminderMessage") {
    pet.sitReminderMessage = command.value || "記得喝水";
    localStorage.setItem("desktopPetSitReminderMessage", pet.sitReminderMessage);
  }
  if (command.type === "call") {
    pet.restLocked = false;
    pet.attentionMode = false;
    pet.restStartedAt = null;
    pet.targetX = workArea.x + workArea.width / 2 - petRect().w / 2;
    say(`${pet.name} 來找你`);
    walk();
  }
  if (command.type === "sit") {
    pet.restLocked = true;
    say("乖乖坐好");
    burst("♥");
    sit();
  }
  if (command.type === "nap") {
    pet.restLocked = true;
    burst("♥");
    nap();
  }
});

async function boot() {
  const nextWorkArea = await window.desktopPet.getWorkArea();
  if (hasValidWorkArea(nextWorkArea)) {
    workArea = nextWorkArea;
  }
  pet.globalX = workArea.x + 120;
  pet.globalY = null;
  resize();
}

sprite.addEventListener("load", () => {
  prepareSpriteSheet(sprite);
  pet.globalY = workArea.y + workArea.height - petRect().h - 24;
  placePetAtGlobalPosition(pet.globalX, pet.globalY);
  if (!loopStarted) {
    loopStarted = true;
    requestAnimationFrame(loop);
  }
});

window.addEventListener("resize", resize);
boot();

const savedCustomSpriteSheet = localStorage.getItem("desktopPetCustomSpriteSheet");
if (savedCustomSpriteSheet) {
  const frameCount = Number(localStorage.getItem("desktopPetCustomFrameCount") || "0");
  loadSpriteSheet(savedCustomSpriteSheet, {
    mode: frameCount >= 3 ? "fixed" : "green",
    frameCount,
    facing: localStorage.getItem("desktopPetCustomFacing") || "right"
  });
} else {
  loadSpriteSheet(DEFAULT_SPRITE_SRC, { mode: "green", facing: "left" });
}
