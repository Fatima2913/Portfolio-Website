/* CodePen JS pane — vanilla port of GetStartedCat (reachGeometry + swipeAnimation + loop) */

const STAGE = {
  w: 340,
  h: 150,
  center: 170,
  btnLeft: 70,
  btnRight: 270,
  btnTop: 12,
  btnW: 200,
  btnH: 44,
  btnMiddleY: 34,
  btnBottom: 56,
  pawInset: 22,
};

const MOTION = {
  sideRestOffset: 26,
  sideMaxReach: 20,
  bottomRestOffset: 20,
  bridgeT: 0.45,
  extHidden: 0.22,
  extBridge: 0.45,
};

const SWIPE_TOTAL_MS = 2000;
const SWIPE_PATS = 3;
const OUT_SEGMENTS = [320, 280, 200];
const RETRACT_SEGMENTS = [200, 280, 320];
const BASE_OUT_MS = OUT_SEGMENTS.reduce((a, b) => a + b, 0);
const BASE_RETRACT_MS = RETRACT_SEGMENTS.reduce((a, b) => a + b, 0);
const BASE_PAT_MS = 300;
const SWIPE_SCALE =
  SWIPE_TOTAL_MS / (BASE_OUT_MS + SWIPE_PATS * BASE_PAT_MS + BASE_RETRACT_MS);
const scaleMs = (ms) => Math.round(ms * SWIPE_SCALE);

const SWIPE = {
  PATS: SWIPE_PATS,
  OUT_MS: scaleMs(220),
  OUT_HIDE_MS: scaleMs(OUT_SEGMENTS[0]),
  OUT_SIDE_MS: scaleMs(OUT_SEGMENTS[1]),
  OUT_FRONT_MS: scaleMs(OUT_SEGMENTS[2]),
  PAT_MS: scaleMs(BASE_PAT_MS),
  RETRACT_FRONT_MS: scaleMs(RETRACT_SEGMENTS[0]),
  RETRACT_SIDE_MS: scaleMs(RETRACT_SEGMENTS[1]),
  RETRACT_HIDE_MS: scaleMs(RETRACT_SEGMENTS[2]),
};

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function clampPawToHover(pawX, pawY) {
  const { btnLeft, btnRight, btnTop, h, pawInset } = STAGE;
  return {
    pawX: clamp(pawX, btnLeft + pawInset, btnRight - pawInset),
    pawY: clamp(pawY, btnTop + pawInset, h - pawInset),
  };
}

function buildArmPath(rootX, rootY, pawX, pawY, elbow = 15, wrist = 12) {
  const dx = pawX - rootX;
  const dy = pawY - rootY;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const ax = rootX + nx * elbow;
  const ay = rootY + ny * elbow;
  const bx = pawX + nx * wrist;
  const by = pawY + ny * wrist;
  const cx = pawX - nx * wrist;
  const cy = pawY - ny * wrist;
  const dx2 = rootX - nx * elbow;
  const dy2 = rootY - ny * elbow;
  return (
    `M ${ax} ${ay} L ${bx} ${by} ` +
    `A ${wrist} ${wrist} 0 0 0 ${cx} ${cy} ` +
    `L ${dx2} ${dy2} ` +
    `A ${elbow} ${elbow} 0 0 0 ${ax} ${ay} Z`
  );
}

function isPawOverButton(pawX, pawY) {
  return (
    pawX > STAGE.btnLeft - 14 &&
    pawX < STAGE.btnLeft + STAGE.btnW + 14 &&
    pawY > STAGE.btnTop - 26 &&
    pawY < STAGE.btnBottom + 8
  );
}

function flapButtonMetrics(t) {
  const { btnLeft, btnTop, btnW, btnH } = STAGE;
  const lip = 5 * (1 - t * 0.5);
  const openH = btnH - 10;
  const h = btnH + (openH - btnH) * t;
  const r = Math.min(22, btnW / 2, h / 2);
  return { x: btnLeft, y: btnTop, shadowY: btnTop + lip, w: btnW, h, r };
}

function sidePawRestPoint(side) {
  const offset = MOTION.sideRestOffset;
  return {
    x: side === "left" ? STAGE.btnLeft - offset : STAGE.btnRight + offset,
    y: STAGE.btnMiddleY,
  };
}

function bottomPawRestPoint() {
  return { x: STAGE.center, y: STAGE.btnBottom + MOTION.bottomRestOffset };
}

function bridgePoint(rootX, rootY, targetX, targetY) {
  return {
    x: rootX + (targetX - rootX) * MOTION.bridgeT,
    y: rootY + (targetY - rootY) * MOTION.bridgeT,
  };
}

function clampSideReach(rootX, rootY, pawX, pawY) {
  const max = MOTION.sideMaxReach;
  const dx = pawX - rootX;
  const dy = pawY - rootY;
  const len = Math.hypot(dx, dy);
  if (len <= max) return { pawX, pawY };
  const k = max / len;
  return { pawX: rootX + dx * k, pawY: rootY + dy * k };
}

function computeReach(cursorX, cursorY) {
  const side = cursorX < STAGE.center ? "left" : "right";
  const zone = cursorY > STAGE.btnBottom ? "bottom" : "side";
  const rootX =
    zone === "bottom" ? STAGE.center : side === "left" ? STAGE.btnLeft : STAGE.btnRight;
  const rootY = STAGE.btnMiddleY;
  let paw = clampPawToHover(cursorX, cursorY);
  if (zone === "side") {
    paw = clampSideReach(rootX, rootY, paw.pawX, paw.pawY);
  }
  const angleDeg = (Math.atan2(paw.pawY - rootY, paw.pawX - rootX) * 180) / Math.PI;
  return { rootX, rootY, pawX: paw.pawX, pawY: paw.pawY, angleDeg, side, zone };
}

const smoothstep = (k) => (1 - Math.cos(Math.min(1, Math.max(0, k)) * Math.PI)) / 2;
const bottomFlapDuration = () => SWIPE.OUT_HIDE_MS;

function bottomFlapT(elapsed, phase, zone) {
  if (zone !== "bottom" || phase === "idle") return 0;
  if (phase === "pat") return 1;
  const flapMs = bottomFlapDuration();
  const outMs = outDuration("bottom");
  const patsEnd = patsEndMs("bottom");
  const total = swipeDuration("bottom");
  if (phase === "out") {
    if (elapsed >= flapMs) return 1;
    return smoothstep(elapsed / flapMs);
  }
  const retractMs = total - patsEnd;
  const flapStart = patsEnd + retractMs - flapMs;
  if (elapsed < flapStart) return 1;
  return 1 - smoothstep((elapsed - flapStart) / flapMs);
}

function outDuration(zone) {
  return zone === "side" || zone === "bottom"
    ? SWIPE.OUT_HIDE_MS + SWIPE.OUT_SIDE_MS + SWIPE.OUT_FRONT_MS
    : SWIPE.OUT_MS;
}

function patsEndMs(zone) {
  return outDuration(zone) + SWIPE.PATS * SWIPE.PAT_MS;
}

function swipeDuration(zone) {
  return (
    patsEndMs(zone) +
    SWIPE.RETRACT_FRONT_MS +
    SWIPE.RETRACT_SIDE_MS +
    SWIPE.RETRACT_HIDE_MS
  );
}

const ease = (from, to, k) => from + (to - from) * (1 - Math.cos(k * Math.PI)) / 2;
const segK = (elapsed, t0, ms) => ease(0, 1, Math.min(1, Math.max(0, (elapsed - t0) / ms)));
const lerp = (from, to, k) => ({
  x: from.x + (to.x - from.x) * k,
  y: from.y + (to.y - from.y) * k,
});
const pawAngle = (rootX, rootY, pawX, pawY) =>
  (Math.atan2(pawY - rootY, pawX - rootX) * 180) / Math.PI;

function patAt(elapsed, patOffsets, zone) {
  const outMs = outDuration(zone);
  const patsEnd = patsEndMs(zone);
  if (elapsed < outMs) return { pat: patOffsets[0], scale: 1 };
  if (elapsed >= patsEnd) return { pat: patOffsets[SWIPE.PATS - 1], scale: 1 };
  const w = (elapsed - outMs) / SWIPE.PAT_MS;
  const idx = Math.min(SWIPE.PATS - 1, Math.floor(w));
  const pat = patOffsets[idx];
  const scale = 1 - pat.depth * Math.sin((w - idx) * Math.PI);
  return { pat, scale };
}

function sideLayers(pawX, pawY, behind) {
  if (behind) return { showBehind: true, showFront: false };
  const over = isPawOverButton(pawX, pawY);
  return { showBehind: !over, showFront: over };
}

function multiStageReach(elapsed, rootX, rootY, rest, target, layerMode) {
  const t1 = SWIPE.OUT_HIDE_MS;
  const t2 = t1 + SWIPE.OUT_SIDE_MS;
  const bridge = bridgePoint(rootX, rootY, target.x, target.y);

  if (elapsed < t1) {
    const k = segK(elapsed, 0, SWIPE.OUT_HIDE_MS);
    const p = lerp({ x: rootX, y: rootY }, rest, k);
    return { pawX: p.x, pawY: p.y, ext: MOTION.extHidden * k, showBehind: true, showFront: false };
  }
  if (elapsed < t2) {
    const k = segK(elapsed, t1, SWIPE.OUT_SIDE_MS);
    const p = lerp(rest, bridge, k);
    return {
      pawX: p.x,
      pawY: p.y,
      ext: MOTION.extHidden + k * (MOTION.extBridge - MOTION.extHidden),
      showBehind: true,
      showFront: false,
    };
  }
  const k = segK(elapsed, t2, SWIPE.OUT_FRONT_MS);
  const p = lerp(bridge, target, k);
  if (layerMode === "bottom") {
    return {
      pawX: p.x,
      pawY: p.y,
      ext: MOTION.extBridge + k * (1 - MOTION.extBridge),
      showBehind: true,
      showFront: false,
    };
  }
  return {
    pawX: p.x,
    pawY: p.y,
    ext: MOTION.extBridge + k * (1 - MOTION.extBridge),
    ...sideLayers(p.x, p.y, false),
  };
}

function bottomOutReach(elapsed, rootX, rootY, rest, target) {
  const flapMs = bottomFlapDuration();
  const outMs = outDuration("bottom");
  if (elapsed < flapMs) {
    return { pawX: rootX, pawY: rootY, ext: 0, showBehind: true, showFront: false };
  }
  const k = (elapsed - flapMs) / (outMs - flapMs);
  return multiStageReach(k * outMs, rootX, rootY, rest, target, "bottom");
}

function multiStageRetract(elapsed, patsEnd, rootX, rootY, rest, patTarget, layerMode) {
  const t0 = patsEnd;
  const t1 = t0 + SWIPE.RETRACT_FRONT_MS;
  const t2 = t1 + SWIPE.RETRACT_SIDE_MS;
  const bridge = bridgePoint(rootX, rootY, patTarget.x, patTarget.y);

  if (elapsed < t1) {
    const k = segK(elapsed, t0, SWIPE.RETRACT_FRONT_MS);
    const p = lerp(patTarget, bridge, k);
    return {
      pawX: p.x,
      pawY: p.y,
      ext: 1 - k * (1 - MOTION.extBridge),
      showFront: layerMode === "side",
      showBehind: layerMode === "bottom",
    };
  }
  if (elapsed < t2) {
    const k = segK(elapsed, t1, SWIPE.RETRACT_SIDE_MS);
    const p = lerp(bridge, rest, k);
    return {
      pawX: p.x,
      pawY: p.y,
      ext: MOTION.extBridge * (1 - k * 0.5),
      showBehind: true,
      showFront: false,
    };
  }
  const k = segK(elapsed, t2, SWIPE.RETRACT_HIDE_MS);
  const p = lerp(rest, { x: rootX, y: rootY }, k);
  return {
    pawX: p.x,
    pawY: p.y,
    ext: MOTION.extHidden * (1 - k),
    showBehind: true,
    showFront: false,
  };
}

function computePawFrame(elapsed, reach, patOffsets) {
  const zone = reach.zone;
  const outMs = outDuration(zone);
  const patsEnd = patsEndMs(zone);
  const { rootX, rootY, side } = reach;
  const reachTarget = clampPawToHover(reach.pawX, reach.pawY);
  const reachPoint = { x: reachTarget.pawX, y: reachTarget.pawY };
  const { pat, scale: patScale } = patAt(elapsed, patOffsets, zone);
  const patTarget = clampPawToHover(reach.pawX + pat.dx, reach.pawY + pat.dy);

  if (elapsed < outMs) {
    const rest = zone === "bottom" ? bottomPawRestPoint() : sidePawRestPoint(side);
    const seg =
      zone === "bottom"
        ? bottomOutReach(elapsed, rootX, rootY, rest, reachPoint)
        : multiStageReach(elapsed, rootX, rootY, rest, reachPoint, "side");
    return {
      phase: "out",
      angleDeg: pawAngle(rootX, rootY, seg.pawX, seg.pawY),
      scale: 1,
      flapT: bottomFlapT(elapsed, "out", zone),
      ...seg,
    };
  }
  if (elapsed < patsEnd) {
    return {
      phase: "pat",
      pawX: patTarget.pawX,
      pawY: patTarget.pawY,
      angleDeg: pawAngle(rootX, rootY, patTarget.pawX, patTarget.pawY),
      scale: patScale,
      ext: 1,
      flapT: bottomFlapT(elapsed, "pat", zone),
      showBehind: zone === "bottom",
      showFront: zone === "side",
    };
  }
  const rest = zone === "bottom" ? bottomPawRestPoint() : sidePawRestPoint(side);
  const seg = multiStageRetract(elapsed, patsEnd, rootX, rootY, rest, reachPoint, zone);
  return {
    phase: "in",
    angleDeg: pawAngle(rootX, rootY, seg.pawX, seg.pawY),
    scale: 1,
    flapT: bottomFlapT(elapsed, "in", zone),
    ...seg,
  };
}

function randomPatOffsets(count = SWIPE.PATS) {
  const rand = (min, max) => min + Math.random() * (max - min);
  return Array.from({ length: count }, (_, i) => {
    if (i === count - 1) return { dx: 0, dy: 0, depth: rand(0.18, 0.38) };
    const a = rand(0, Math.PI * 2);
    const r = rand(6, 22);
    return { dx: Math.cos(a) * r, dy: Math.sin(a) * r, depth: rand(0.18, 0.38) };
  });
}

const KEYBOARD_REACH = {
  ArrowLeft: () => computeReach(STAGE.btnLeft + 50, STAGE.btnMiddleY),
  ArrowRight: () => computeReach(STAGE.btnRight - 50, STAGE.btnMiddleY),
  ArrowDown: () => computeReach(STAGE.center, STAGE.btnBottom + 40),
};

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function initCatPaw(root) {
  const armBehind = root.querySelector("#arm-behind");
  const armFront = root.querySelector("#arm-front");
  const behindReach = root.querySelector("#behind-reach");
  const pawBehind = root.querySelector("#paw-behind");
  const pawFront = root.querySelector("#paw-front");
  const frontGroup = root.querySelector("#front-group");
  const buttonFace = root.querySelector("#button-face");
  const buttonShadow = root.querySelector("#button-shadow");

  const reduced = prefersReducedMotion();
  if (reduced) root.setAttribute("data-reduced-motion", "true");

  let pointerReach = null;
  let cycleTarget = null;
  let cycleStart = 0;
  let cycling = false;
  let lastDir = "";
  let patOffsets = randomPatOffsets();
  let active = false;
  let raf = null;
  let paused = false;
  let pauseAnchor = 0;
  let inView = true;

  const lastPaint = { d: "", transform: "", showBehind: false, showFront: false, flapT: -1 };
  const current = {
    rootX: STAGE.btnLeft,
    rootY: STAGE.btnMiddleY,
    pawX: STAGE.btnLeft,
    pawY: STAGE.btnMiddleY,
    angleDeg: 90,
    scale: 1,
    ext: 0,
    flapT: 0,
    phase: "idle",
    showBehind: false,
    showFront: false,
  };

  function paint() {
    const c = current;
    const { showBehind, showFront } = c;

    if (showBehind || showFront) {
      const d = buildArmPath(c.rootX, c.rootY, c.pawX, c.pawY);
      const layersChanged =
        showBehind !== lastPaint.showBehind || showFront !== lastPaint.showFront;
      if (d !== lastPaint.d || layersChanged) {
        lastPaint.d = d;
        if (showBehind) armBehind.setAttribute("d", d);
        if (showFront) armFront.setAttribute("d", d);
      }
    }

    const transform = `translate(${c.pawX} ${c.pawY}) rotate(${c.angleDeg + 90}) scale(${c.scale})`;
    const layersChanged =
      showBehind !== lastPaint.showBehind || showFront !== lastPaint.showFront;

    if (showBehind || showFront) {
      if (transform !== lastPaint.transform || layersChanged) {
        lastPaint.transform = transform;
        if (showBehind) pawBehind.setAttribute("transform", transform);
        if (showFront) pawFront.setAttribute("transform", transform);
      }
    } else if (layersChanged) {
      const tuck = `translate(${c.rootX} ${c.rootY}) rotate(${c.angleDeg + 90}) scale(1)`;
      lastPaint.transform = tuck;
      pawBehind.setAttribute("transform", tuck);
      pawFront.setAttribute("transform", tuck);
    }

    if (showBehind !== lastPaint.showBehind) {
      lastPaint.showBehind = showBehind;
      behindReach.style.opacity = showBehind ? "1" : "0";
      behindReach.style.visibility = showBehind ? "visible" : "hidden";
    }
    if (showFront !== lastPaint.showFront) {
      lastPaint.showFront = showFront;
      frontGroup.style.opacity = showFront ? "1" : "0";
      frontGroup.style.visibility = showFront ? "visible" : "hidden";
    }

    root.setAttribute("data-phase", c.phase);

    const zone = cycleTarget?.zone;
    const flapT = zone === "bottom" && c.phase !== "idle" ? c.flapT : 0;
    const setBtnRects = (t) => {
      const btn = flapButtonMetrics(t);
      const setRect = (el, y) => {
        el.setAttribute("x", String(btn.x));
        el.setAttribute("width", String(btn.w));
        el.setAttribute("height", String(btn.h));
        el.setAttribute("rx", String(btn.r));
        el.setAttribute("ry", String(btn.r));
        el.setAttribute("y", String(y));
      };
      setRect(buttonShadow, btn.shadowY);
      setRect(buttonFace, btn.y);
      root.style.setProperty("--flap", String(t));
      root.style.setProperty("--btn-h", `${(btn.h / STAGE.h) * 100}%`);
    };
    if (flapT !== lastPaint.flapT) {
      lastPaint.flapT = flapT;
      setBtnRects(flapT);
    } else if (zone !== "bottom" && lastPaint.flapT !== 0) {
      lastPaint.flapT = 0;
      setBtnRects(0);
    }
  }

  function applyFrame(frame, rootX, rootY) {
    Object.assign(current, {
      rootX,
      rootY,
      pawX: frame.pawX,
      pawY: frame.pawY,
      angleDeg: frame.angleDeg,
      scale: frame.scale,
      ext: frame.ext,
      flapT: frame.flapT,
      phase: frame.phase,
      showBehind: frame.showBehind,
      showFront: frame.showFront,
    });
  }

  function finishSwipe() {
    const t = cycleTarget;
    if (!t) return;
    cycling = false;
    Object.assign(current, {
      rootX: t.rootX,
      rootY: t.rootY,
      pawX: t.rootX,
      pawY: t.rootY,
      angleDeg: t.angleDeg,
      scale: 1,
      ext: 0,
      flapT: 0,
      phase: "idle",
      showBehind: false,
      showFront: false,
    });
    paint();
    root.setAttribute("data-swiping", "false");
    raf = null;
  }

  function tick() {
    if (paused || !inView) {
      raf = null;
      return;
    }
    if (cycling && cycleTarget) {
      const elapsed = performance.now() - cycleStart;
      const duration = swipeDuration(cycleTarget.zone);
      if (elapsed >= duration) {
        finishSwipe();
        return;
      }
      applyFrame(computePawFrame(elapsed, cycleTarget, patOffsets), cycleTarget.rootX, cycleTarget.rootY);
      paint();
      raf = requestAnimationFrame(tick);
      return;
    }
    raf = null;
  }

  function scheduleTick() {
    if (raf == null && !paused) raf = requestAnimationFrame(tick);
  }

  function startCycle() {
    if (reduced || !pointerReach) return;
    cycleTarget = { ...pointerReach };
    cycleStart = performance.now();
    cycling = true;
    patOffsets = randomPatOffsets();
    root.setAttribute("data-zone", cycleTarget.zone);
    root.setAttribute("data-swiping", "true");
    applyFrame(computePawFrame(0, cycleTarget, patOffsets), cycleTarget.rootX, cycleTarget.rootY);
    paint();
    scheduleTick();
  }

  function retract() {
    active = false;
    lastDir = "";
  }

  function localCoords(clientX, clientY) {
    const rect = root.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return null;
    return {
      x: ((clientX - rect.left) / rect.width) * STAGE.w,
      y: ((clientY - rect.top) / rect.height) * STAGE.h,
    };
  }

  function tryStartFromReach(reach) {
    pointerReach = reach;
    active = true;
    const dir = `${reach.side}-${reach.zone}`;
    if (!cycling && dir !== lastDir) {
      lastDir = dir;
      startCycle();
    }
  }

  root.addEventListener("pointermove", (event) => {
    if (reduced || event.pointerType === "touch") return;
    const local = localCoords(event.clientX, event.clientY);
    if (!local) return;
    if (local.x < STAGE.btnLeft || local.x > STAGE.btnRight) {
      if (active) retract();
      return;
    }
    tryStartFromReach(computeReach(local.x, local.y));
  });

  root.addEventListener("pointerdown", (event) => {
    if (reduced || event.pointerType !== "touch") return;
    const local = localCoords(event.clientX, event.clientY);
    if (!local || local.x < STAGE.btnLeft || local.x > STAGE.btnRight) return;
    lastDir = "";
    tryStartFromReach(computeReach(local.x, local.y));
  });

  root.addEventListener("pointerleave", retract);
  root.addEventListener("blur", retract);

  root.addEventListener("focus", (event) => {
    if (!event.currentTarget.matches(":focus-visible")) return;
    active = true;
    tryStartFromReach(KEYBOARD_REACH.ArrowLeft());
  });

  root.addEventListener("keydown", (event) => {
    const reach = KEYBOARD_REACH[event.key]?.();
    if (!reach) return;
    event.preventDefault();
    lastDir = "";
    tryStartFromReach(reach);
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      paused = true;
      pauseAnchor = performance.now();
      if (raf != null) {
        cancelAnimationFrame(raf);
        raf = null;
      }
    } else if (paused) {
      paused = false;
      if (cycling) {
        cycleStart += performance.now() - pauseAnchor;
        scheduleTick();
      }
    }
  });

  if (typeof IntersectionObserver !== "undefined") {
    const observer = new IntersectionObserver(
      ([entry]) => {
        inView = entry.isIntersecting;
        if (entry.isIntersecting && cycling) scheduleTick();
        else if (!entry.isIntersecting && raf != null) {
          cancelAnimationFrame(raf);
          raf = null;
        }
      },
      { threshold: 0 }
    );
    observer.observe(root);
  }

  paint();
}

document.addEventListener("DOMContentLoaded", () => {
  const root = document.getElementById("cat");
  if (root) initCatPaw(root);
});