const nameInput = document.querySelector("#nameInput");
const callBtn = document.querySelector("#callBtn");
const sitBtn = document.querySelector("#sitBtn");
const napBtn = document.querySelector("#napBtn");
const scaleRange = document.querySelector("#scaleRange");
const speedRange = document.querySelector("#speedRange");
const heartColorInput = document.querySelector("#heartColorInput");
const reminderMinutesInput = document.querySelector("#reminderMinutesInput");
const reminderMessageInput = document.querySelector("#reminderMessageInput");
const sitPhotoInput = document.querySelector("#sitPhotoInput");
const walkPhotoInput = document.querySelector("#walkPhotoInput");
const liePhotoInput = document.querySelector("#liePhotoInput");
const sitUploadStatus = document.querySelector("#sitUploadStatus");
const walkUploadStatus = document.querySelector("#walkUploadStatus");
const lieUploadStatus = document.querySelector("#lieUploadStatus");
const makePetBtn = document.querySelector("#makePetBtn");
const restorePetBtn = document.querySelector("#restorePetBtn");
const hideBtn = document.querySelector("#hideBtn");

const savedName = localStorage.getItem("desktopPetName") || "狗狗";
const savedScale = Number(localStorage.getItem("desktopPetScale") || "100");
const savedSpeed = Number(localStorage.getItem("desktopPetSpeed") || "100");
const savedHeartColor = localStorage.getItem("desktopPetHeartColor") || "#ff5c8a";
const savedReminderMinutes = Number(localStorage.getItem("desktopPetSitReminderMinutes") || "1");
const savedReminderMessage = localStorage.getItem("desktopPetSitReminderMessage") || "記得喝水";

nameInput.value = savedName;
scaleRange.value = String(savedScale);
speedRange.value = String(savedSpeed);
heartColorInput.value = savedHeartColor;
reminderMinutesInput.value = String(savedReminderMinutes);
reminderMessageInput.value = savedReminderMessage;

function send(type, value) {
  window.desktopPet.sendCommand({ type, value });
}

function flashActionButton(button) {
  button.classList.remove("is-active");
  window.requestAnimationFrame(() => {
    button.classList.add("is-active");
    window.setTimeout(() => button.classList.remove("is-active"), 520);
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", reject);
    image.src = src;
  });
}

function trimTransparentBounds(canvas) {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  const data = pixels.data;
  let minX = canvas.width;
  let minY = canvas.height;
  let maxX = 0;
  let maxY = 0;

  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      if (data[(y * canvas.width + x) * 4 + 3] > 16) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (minX > maxX || minY > maxY) {
    return canvas;
  }

  const trimmed = document.createElement("canvas");
  trimmed.width = maxX - minX + 1;
  trimmed.height = maxY - minY + 1;
  trimmed.getContext("2d").drawImage(canvas, minX, minY, trimmed.width, trimmed.height, 0, 0, trimmed.width, trimmed.height);
  return trimmed;
}

function isPngFile(file) {
  return file && (file.type === "image/png" || file.name.toLowerCase().endsWith(".png"));
}

function updateUploadStatus(input, statusElement, { min = 1, max = 1 } = {}) {
  const files = Array.from(input.files || []);
  const chip = input.closest(".file-chip");
  chip?.classList.remove("is-uploaded", "is-error");

  if (files.length === 0) {
    statusElement.textContent = "尚未上傳";
    return true;
  }

  if (!files.every(isPngFile)) {
    statusElement.textContent = "請重新上傳 PNG";
    chip?.classList.add("is-error");
    return false;
  }

  if (files.length < min || files.length > max) {
    statusElement.textContent = `請上傳 ${min === max ? min : `${min}-${max}`} 個 PNG`;
    chip?.classList.add("is-error");
    return false;
  }

  statusElement.textContent = `已成功上傳 ${files.length} 個檔案`;
  chip?.classList.add("is-uploaded");
  return true;
}

function validateUploadStatuses() {
  const sitOk = updateUploadStatus(sitPhotoInput, sitUploadStatus, { min: 1, max: 1 });
  const walkOk = updateUploadStatus(walkPhotoInput, walkUploadStatus, { min: 3, max: 5 });
  const lieOk = updateUploadStatus(liePhotoInput, lieUploadStatus, { min: 1, max: 1 });
  return sitOk && walkOk && lieOk;
}

function resetUploadFields() {
  for (const [input, status] of [
    [sitPhotoInput, sitUploadStatus],
    [walkPhotoInput, walkUploadStatus],
    [liePhotoInput, lieUploadStatus]
  ]) {
    input.value = "";
    const chip = input.closest(".file-chip");
    chip?.classList.remove("is-uploaded", "is-error");
    status.textContent = "尚未上傳";
  }
}

function imageHasTransparentBackground(image) {
  const size = 96;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(image, 0, 0, size, size);
  const data = context.getImageData(0, 0, size, size).data;
  const samples = [
    [0, 0],
    [size - 1, 0],
    [0, size - 1],
    [size - 1, size - 1],
    [Math.floor(size / 2), 0],
    [Math.floor(size / 2), size - 1]
  ];
  return samples.some(([x, y]) => data[(y * size + x) * 4 + 3] < 32);
}

function normalizeTransparentPng(image) {
  const maxSide = 360;
  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(image, 0, 0, width, height);
  keepLargestOpaqueComponent(canvas);
  return trimTransparentBounds(canvas);
}

function keepLargestOpaqueComponent(canvas) {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  const data = pixels.data;
  const total = canvas.width * canvas.height;
  const labels = new Int32Array(total);
  let bestLabel = 0;
  let bestSize = 0;
  let label = 0;
  const stack = [];

  for (let start = 0; start < total; start += 1) {
    if (labels[start] !== 0 || data[start * 4 + 3] <= 24) continue;
    label += 1;
    labels[start] = label;
    stack.push(start);
    let size = 0;

    while (stack.length > 0) {
      const index = stack.pop();
      size += 1;
      const x = index % canvas.width;
      const y = Math.floor(index / canvas.width);
      const neighbors = [
        x > 0 ? index - 1 : -1,
        x < canvas.width - 1 ? index + 1 : -1,
        y > 0 ? index - canvas.width : -1,
        y < canvas.height - 1 ? index + canvas.width : -1
      ];

      for (const next of neighbors) {
        if (next < 0 || labels[next] !== 0 || data[next * 4 + 3] <= 24) continue;
        labels[next] = label;
        stack.push(next);
      }
    }

    if (size > bestSize) {
      bestSize = size;
      bestLabel = label;
    }
  }

  if (bestLabel === 0) return;

  for (let i = 0; i < total; i += 1) {
    if (labels[i] !== bestLabel) {
      data[i * 4 + 3] = 0;
    }
  }
  context.putImageData(pixels, 0, 0);
}

function estimateHeadFacing(walkCutouts) {
  let upperX = 0;
  let upperAlpha = 0;
  let allX = 0;
  let allAlpha = 0;

  for (const imageCanvas of walkCutouts) {
    const context = imageCanvas.getContext("2d", { willReadFrequently: true });
    const pixels = context.getImageData(0, 0, imageCanvas.width, imageCanvas.height);
    const data = pixels.data;
    for (let y = 0; y < imageCanvas.height; y += 1) {
      for (let x = 0; x < imageCanvas.width; x += 1) {
        const alpha = data[(y * imageCanvas.width + x) * 4 + 3];
        if (alpha < 24) continue;
        allX += x * alpha;
        allAlpha += alpha;
        if (y < imageCanvas.height * 0.62) {
          upperX += x * alpha;
          upperAlpha += alpha;
        }
      }
    }
  }

  if (!upperAlpha || !allAlpha) return "right";
  const upperCenter = upperX / upperAlpha;
  const bodyCenter = allX / allAlpha;
  return upperCenter >= bodyCenter ? "right" : "left";
}

function drawCenteredFrame(context, imageCanvas, frameX, frameY, frameWidth, frameHeight, bob = 0) {
  const scale = Math.min(frameWidth / imageCanvas.width, frameHeight / imageCanvas.height);
  const width = imageCanvas.width * scale;
  const height = imageCanvas.height * scale;
  const x = frameX + (frameWidth - width) / 2;
  const y = frameY + frameHeight - height + bob;

  context.drawImage(imageCanvas, x, y, width, height);
}

async function createCustomSpriteSheet() {
  const sitFile = sitPhotoInput.files[0];
  const walkFiles = Array.from(walkPhotoInput.files || []).slice(0, 5);
  const lieFile = liePhotoInput.files[0];

  if (!sitFile || walkFiles.length < 3 || !lieFile) {
    throw new Error("請選擇坐下、3-5 張走路、趴下 PNG");
  }
  if (walkPhotoInput.files.length > 5) {
    throw new Error("走路最多上傳 5 張 PNG");
  }
  if (![sitFile, ...walkFiles, lieFile].every(isPngFile)) {
    throw new Error("只能上傳已去背 PNG");
  }

  const [sitImage, lieImage, ...walkImages] = await Promise.all([
    readFileAsDataUrl(sitFile).then(loadImage),
    readFileAsDataUrl(lieFile).then(loadImage),
    ...walkFiles.map((file) => readFileAsDataUrl(file).then(loadImage))
  ]);
  if (![sitImage, ...walkImages, lieImage].every(imageHasTransparentBackground)) {
    throw new Error("PNG 需要是透明背景");
  }

  const sitCutout = normalizeTransparentPng(sitImage);
  const walkCutouts = walkImages.map(normalizeTransparentPng);
  const lieCutout = normalizeTransparentPng(lieImage);

  const frameWidth = 280;
  const frameHeight = 280;
  const frames = walkCutouts.length + 2;
  const facing = estimateHeadFacing(walkCutouts);
  const canvas = document.createElement("canvas");
  canvas.width = frames * frameWidth;
  canvas.height = frameHeight;
  const context = canvas.getContext("2d");

  context.clearRect(0, 0, canvas.width, canvas.height);
  drawCenteredFrame(context, sitCutout, 0, 0, frameWidth, frameHeight);

  walkCutouts.forEach((walkCutout, i) => {
    drawCenteredFrame(context, walkCutout, (i + 1) * frameWidth, 0, frameWidth, frameHeight, i % 2 === 0 ? 0 : 6);
  });

  drawCenteredFrame(context, lieCutout, (frames - 1) * frameWidth, 0, frameWidth, frameHeight);
  return {
    facing,
    frameCount: frames,
    src: canvas.toDataURL("image/png")
  };
}

nameInput.addEventListener("input", () => {
  const nextName = nameInput.value.trim() || "狗狗";
  localStorage.setItem("desktopPetName", nextName);
  send("name", nextName);
});

scaleRange.addEventListener("input", () => {
  const nextScale = Number(scaleRange.value);
  localStorage.setItem("desktopPetScale", String(nextScale));
  send("scale", nextScale / 100);
});

speedRange.addEventListener("input", () => {
  const nextSpeed = Number(speedRange.value);
  localStorage.setItem("desktopPetSpeed", String(nextSpeed));
  send("speed", nextSpeed);
});

heartColorInput.addEventListener("input", () => {
  const nextColor = heartColorInput.value;
  localStorage.setItem("desktopPetHeartColor", nextColor);
  send("heartColor", nextColor);
});

sitPhotoInput.addEventListener("change", () => {
  updateUploadStatus(sitPhotoInput, sitUploadStatus, { min: 1, max: 1 });
});

walkPhotoInput.addEventListener("change", () => {
  updateUploadStatus(walkPhotoInput, walkUploadStatus, { min: 3, max: 5 });
});

liePhotoInput.addEventListener("change", () => {
  updateUploadStatus(liePhotoInput, lieUploadStatus, { min: 1, max: 1 });
});

makePetBtn.addEventListener("click", async () => {
  makePetBtn.disabled = true;
  makePetBtn.textContent = "製作中";
  try {
    if (!validateUploadStatuses()) {
      throw new Error("請重新確認 PNG 檔案");
    }
    const spriteSheet = await createCustomSpriteSheet();
    localStorage.setItem("desktopPetCustomSpriteSheet", spriteSheet.src);
    localStorage.setItem("desktopPetCustomFrameCount", String(spriteSheet.frameCount));
    localStorage.setItem("desktopPetCustomFacing", spriteSheet.facing);
    localStorage.removeItem("desktopPetLibrary");
    localStorage.removeItem("desktopPetSelectedId");
    send("customSprite", spriteSheet);
    resetUploadFields();
    makePetBtn.textContent = "已套用";
    window.setTimeout(() => {
      makePetBtn.textContent = "製作新寵物";
      makePetBtn.disabled = false;
    }, 900);
  } catch (error) {
    makePetBtn.textContent = error.message || "製作失敗";
    window.setTimeout(() => {
      makePetBtn.textContent = "製作新寵物";
      makePetBtn.disabled = false;
    }, 1600);
  }
});

restorePetBtn.addEventListener("click", () => {
  localStorage.removeItem("desktopPetCustomSpriteSheet");
  localStorage.removeItem("desktopPetCustomFrameCount");
  localStorage.removeItem("desktopPetCustomFacing");
  localStorage.removeItem("desktopPetLibrary");
  localStorage.removeItem("desktopPetSelectedId");
  send("resetSprite");
});

reminderMinutesInput.addEventListener("input", () => {
  const nextMinutes = Math.max(0.1, Number(reminderMinutesInput.value) || 1);
  localStorage.setItem("desktopPetSitReminderMinutes", String(nextMinutes));
  send("sitReminderMinutes", nextMinutes);
});

reminderMessageInput.addEventListener("input", () => {
  const nextMessage = reminderMessageInput.value.trim() || "記得喝水";
  localStorage.setItem("desktopPetSitReminderMessage", nextMessage);
  send("sitReminderMessage", nextMessage);
});

callBtn.addEventListener("click", () => {
  flashActionButton(callBtn);
  send("call");
});
sitBtn.addEventListener("click", () => {
  flashActionButton(sitBtn);
  send("sit");
});
napBtn.addEventListener("click", () => {
  flashActionButton(napBtn);
  send("nap");
});
hideBtn?.addEventListener("click", () => window.desktopPet.hideControlPanel());

send("name", savedName);
send("scale", savedScale / 100);
send("speed", savedSpeed);
send("heartColor", savedHeartColor);
send("sitReminderMinutes", savedReminderMinutes);
send("sitReminderMessage", savedReminderMessage);
const savedCustomSpriteSheet = localStorage.getItem("desktopPetCustomSpriteSheet");
if (savedCustomSpriteSheet) {
  send("customSprite", {
    src: savedCustomSpriteSheet,
    frameCount: Number(localStorage.getItem("desktopPetCustomFrameCount") || "0"),
    facing: localStorage.getItem("desktopPetCustomFacing") || "right"
  });
}
