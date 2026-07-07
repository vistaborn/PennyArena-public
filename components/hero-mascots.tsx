"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Phase = "idle" | "charge" | "fight" | "retreat";

const CAT_SRC = "/brand/mascot-cat.png";
const DOG_SRC = "/brand/mascot-dog.png";
const WIDTH_BOOST = 1.14;
const HEIGHT_SCALE = 0.94;
const SIDE_PAD = 44;
const FIGHT_MS = 3000;
const AUTO_INTERVAL_MS = 30000;

function spriteSize(aspect: number, displayH: number) {
  const h = displayH * HEIGHT_SCALE;
  const w = aspect * h * WIDTH_BOOST;
  return { w, h };
}

function drawFightChaos(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  t: number,
) {
  const colors = ["#f79d28", "#ffe8b0", "#ffffff", "#ff5c45", "#ffd700"];
  const lines = 18;

  for (let i = 0; i < lines; i++) {
    const angle = (i / lines) * Math.PI * 2 + t * (7 + (i % 3));
    const pulse = 0.45 + 0.55 * Math.sin(t * 24 + i * 1.4);
    const dist = 36 + pulse * 72 + (i % 5) * 10;
    const segLen = 2 + Math.floor(pulse * 6);
    const px = cx + Math.cos(angle) * dist;
    const py = cy + Math.sin(angle) * dist * 0.72;

    ctx.fillStyle = colors[i % colors.length];
    for (let j = 0; j < segLen; j++) {
      const ox = Math.cos(angle) * j * 6;
      const oy = Math.sin(angle) * j * 6;
      ctx.fillRect(Math.round(px + ox), Math.round(py + oy), 5, 5);
    }
  }

  for (let i = 0; i < 8; i++) {
    const a = t * 14 + i * 0.9;
    const r = 28 + (i % 3) * 18 + Math.sin(a * 3) * 12;
    const sx = cx + Math.cos(a) * r;
    const sy = cy + Math.sin(a) * r * 0.65;
    ctx.fillStyle = i % 2 === 0 ? "#ffffff" : "#f79d28";
    ctx.fillRect(Math.round(sx) - 2, Math.round(sy) - 2, 5, 5);
    ctx.fillRect(Math.round(sx) - 6, Math.round(sy), 5, 5);
    ctx.fillRect(Math.round(sx) + 2, Math.round(sy), 5, 5);
    ctx.fillRect(Math.round(sx), Math.round(sy) - 6, 5, 5);
    ctx.fillRect(Math.round(sx), Math.round(sy) + 2, 5, 5);
  }

  if (Math.sin(t * 18) > 0.2) {
    ctx.fillStyle = "#f79d28";
    const bx = cx + Math.sin(t * 11) * 18;
    const by = cy - 48 + Math.cos(t * 9) * 8;
    for (const [dx, dy] of [
      [0, 0],
      [6, 0],
      [12, 0],
      [3, 6],
      [9, 6],
    ]) {
      ctx.fillRect(Math.round(bx + dx), Math.round(by + dy), 5, 5);
    }
  }
}

function drawAngryEmotion(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  facing: "left" | "right",
) {
  const fx = facing === "right" ? x + w * 0.68 : x + w * 0.12;
  const fy = y + h * 0.2;

  ctx.fillStyle = "#ff4444";
  ctx.fillRect(fx + (facing === "right" ? 14 : -18), fy + 4, 5, 5);
  ctx.fillRect(fx + (facing === "right" ? 18 : -22), fy + 8, 4, 4);

  ctx.fillStyle = "#1a1a20";
  if (facing === "right") {
    ctx.fillRect(fx - 6, fy - 2, 7, 3);
    ctx.fillRect(fx + 6, fy, 7, 3);
    ctx.fillRect(fx, fy + 10, 9, 4);
  } else {
    ctx.fillRect(fx - 2, fy - 2, 7, 3);
    ctx.fillRect(fx + 8, fy, 7, 3);
    ctx.fillRect(fx + 2, fy + 10, 9, 4);
  }
}

function getDisplayHeight() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const mobile = vw < 768;
  const byWidth = vw * (mobile ? 0.28 : 0.3);
  const byHeight = vh * (mobile ? 0.2 : 0.32);
  const cap = mobile ? 240 : 380;
  const floor = mobile ? 160 : 220;
  return Math.round(Math.min(cap, Math.max(floor, Math.min(byWidth, byHeight))));
}

export function HeroMascots() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const catImgRef = useRef<HTMLImageElement | null>(null);
  const dogImgRef = useRef<HTMLImageElement | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [visible, setVisible] = useState(false);
  const phaseRef = useRef<Phase>("idle");
  const phaseStart = useRef(0);
  const fightStart = useRef(0);
  const fightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoFightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoFightBootedRef = useRef(false);

  const clearFightTimer = useCallback(() => {
    if (fightTimerRef.current) {
      clearTimeout(fightTimerRef.current);
      fightTimerRef.current = null;
    }
  }, []);

  const clearAutoFightTimer = useCallback(() => {
    if (autoFightTimerRef.current) {
      clearTimeout(autoFightTimerRef.current);
      autoFightTimerRef.current = null;
    }
  }, []);

  const setPhaseSafe = useCallback(
    (p: Phase) => {
      phaseRef.current = p;
      phaseStart.current = performance.now();
      if (p === "fight") {
        fightStart.current = performance.now();
        clearFightTimer();
        fightTimerRef.current = setTimeout(() => {
          if (phaseRef.current !== "fight") return;
          clearFightTimer();
          phaseRef.current = "retreat";
          phaseStart.current = performance.now();
          setPhase("retreat");
        }, FIGHT_MS);
      } else {
        clearFightTimer();
      }
      setPhase(p);
    },
    [clearFightTimer],
  );

  const scheduleAutoFight = useCallback(
    (delayMs: number) => {
      clearAutoFightTimer();
      autoFightTimerRef.current = setTimeout(() => {
        if (phaseRef.current === "idle") setPhaseSafe("charge");
        scheduleAutoFight(AUTO_INTERVAL_MS);
      }, delayMs);
    },
    [clearAutoFightTimer, setPhaseSafe],
  );

  const bootAutoFight = useCallback(() => {
    const delay = autoFightBootedRef.current ? AUTO_INTERVAL_MS : 600;
    if (!autoFightBootedRef.current) autoFightBootedRef.current = true;
    scheduleAutoFight(delay);
  }, [scheduleAutoFight]);

  const bootAutoFightRef = useRef(bootAutoFight);
  bootAutoFightRef.current = bootAutoFight;

  const startFight = useCallback(() => {
    if (phaseRef.current === "idle") setPhaseSafe("charge");
  }, [setPhaseSafe]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && phaseRef.current === "idle") {
        setPhaseSafe("charge");
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [setPhaseSafe]);

  useEffect(() => {
    const cat = new Image();
    const dog = new Image();
    cat.src = CAT_SRC;
    dog.src = DOG_SRC;
    catImgRef.current = cat;
    dogImgRef.current = dog;

    let catReady = cat.complete && cat.naturalWidth > 0;
    let dogReady = dog.complete && dog.naturalWidth > 0;
    const markReady = () => {
      if (catReady && dogReady) {
        setVisible(true);
        bootAutoFightRef.current();
      }
    };
    cat.onload = () => {
      catReady = true;
      markReady();
    };
    dog.onload = () => {
      dogReady = true;
      markReady();
    };
    cat.onerror = () => {
      cat.src = "/brand/pixel_cat.svg";
    };
    dog.onerror = () => {
      dog.src = "/brand/pixel_dog.svg";
    };
    markReady();

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    let raf = 0;
    let shown = false;
    const loop = (time: number) => {
      const catImg = catImgRef.current;
      const dogImg = dogImgRef.current;
      if (!catImg?.complete || !dogImg?.complete || catImg.naturalWidth === 0) {
        raf = requestAnimationFrame(loop);
        return;
      }

      if (!shown) {
        shown = true;
        setVisible(true);
        bootAutoFightRef.current();
      }

      const displayH = getDisplayHeight();
      const catAspect = catImg.naturalWidth / catImg.naturalHeight;
      const dogAspect = dogImg.naturalWidth / dogImg.naturalHeight;
      const cat = spriteSize(catAspect, displayH);
      const dog = spriteSize(dogAspect, displayH);
      const w = Math.round(cat.w + dog.w + SIDE_PAD * 2 + 48);
      const ch = displayH + 56;

      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== ch) canvas.height = ch;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${ch}px`;

      const idleCatX = SIDE_PAD;
      const idleDogX = w - dog.w - SIDE_PAD;
      const fightCatX = w / 2 - (cat.w + dog.w) / 2 - 8;
      const fightDogX = w / 2 - (cat.w + dog.w) / 2 + cat.w + 8;
      const catTravel = fightCatX - idleCatX;
      const dogTravel = idleDogX - fightDogX;

      const t = time / 1000;
      const ph = phaseRef.current;
      const elapsed = time - phaseStart.current;
      const bob = Math.sin(t * 2.2) * 4;

      let catX = idleCatX;
      let dogX = idleDogX;
      let isFighting = false;
      let catRot = 0;
      let dogRot = 0;
      let catShake = 0;
      let dogShake = 0;

      if (ph === "charge") {
        const p = Math.min(1, elapsed / 400);
        catX = idleCatX + p * catTravel;
        dogX = idleDogX - p * dogTravel;
        if (p >= 1 && phaseRef.current === "charge") setPhaseSafe("fight");
      } else if (ph === "fight") {
        catX = fightCatX;
        dogX = fightDogX;
        isFighting = true;
        catRot = Math.sin(t * 20) * 0.07;
        dogRot = -Math.sin(t * 20) * 0.07;
        catShake = Math.sin(t * 32) * 5;
        dogShake = Math.sin(t * 32 + 1) * 5;
      } else if (ph === "retreat") {
        const p = Math.min(1, elapsed / 480);
        catX = fightCatX - p * catTravel;
        dogX = fightDogX + p * dogTravel;
        if (p >= 1 && phaseRef.current === "retreat") setPhaseSafe("idle");
      }

      const baseY = (ch - displayH) / 2 + 10;
      const clashX = catX + cat.w + (dogX - catX - cat.w) / 2;
      const clashY = baseY + cat.h * 0.45;

      ctx.clearRect(0, 0, w, ch);
      ctx.imageSmoothingEnabled = false;

      ctx.fillStyle = "rgba(0, 58, 59, 0.45)";
      ctx.beginPath();
      ctx.ellipse(w / 2, ch - 10, w * 0.34, 18, 0, 0, Math.PI * 2);
      ctx.fill();

      if (isFighting) drawFightChaos(ctx, clashX, clashY, t);

      const drawChar = (
        img: HTMLImageElement,
        x: number,
        y: number,
        size: { w: number; h: number },
        rot: number,
        shake: number,
        facing: "left" | "right",
      ) => {
        const squash = isFighting ? 1 + Math.sin(t * 26) * 0.08 : 1;
        const stretch = isFighting ? 1 - Math.sin(t * 26) * 0.05 : 1;

        ctx.save();
        ctx.translate(x + size.w / 2 + shake, y + size.h / 2);
        ctx.rotate(rot);
        ctx.scale(squash, stretch);
        ctx.drawImage(img, -size.w / 2, -size.h / 2, size.w, size.h);
        ctx.restore();

        if (isFighting) drawAngryEmotion(ctx, x + shake, y, size.w, size.h, facing);
      };

      drawChar(catImg, catX, baseY + bob, cat, catRot, catShake, "right");
      drawChar(dogImg, dogX, baseY - bob * 0.6, dog, dogRot, dogShake, "left");

      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      clearFightTimer();
      clearAutoFightTimer();
    };
  }, [setPhaseSafe, clearFightTimer, clearAutoFightTimer]);

  return (
    <div
      className="relative mx-auto w-full min-w-0 max-w-[min(100%,22rem)] select-none overflow-visible sm:max-w-none"
      role="img"
      aria-label="Pixel cat and dog — auto battle on load and every 30 seconds"
      onMouseEnter={startFight}
      onTouchStart={startFight}
    >
      <canvas
        ref={canvasRef}
        className="mx-auto block max-h-[11rem] max-w-full cursor-crosshair sm:max-h-none"
        style={{ imageRendering: "pixelated", opacity: visible ? 1 : 0.35 }}
      />
      <p
        className="mt-2 text-center text-xs"
        style={{ color: phase === "fight" || phase === "charge" ? "#f79d28" : "#9ec5c6" }}
      >
        {phase === "fight" || phase === "charge"
          ? "⚡ Cat vs Dog — FIGHT! ⚡"
          : "Hover or wait!"}
      </p>
    </div>
  );
}