/**
 * Physique de mouvement d'après « Designing Fluid Interfaces » (Apple) :
 * projection de l'élan, résistance aux bords et ressort amorti pilotés en
 * damping ratio + response plutôt qu'en masse/raideur.
 */

/** Position de repos d'un objet lâché à `velocity` px/s, comme un défilement qui décélère. */
export function project(velocity: number, decelerationRate = 0.998) {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

/** Déplacement effectif au-delà d'une borne : plus on tire, moins l'objet suit. */
export function rubberband(overshoot: number, dimension: number, constant = 0.55) {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

export type SpringOptions = {
  /** 1 = amorti critique sans rebond ; 0,8 = léger rebond, pour un geste qui avait de l'élan. */
  damping?: number;
  /** Temps caractéristique en secondes ; plus petit = plus vif. */
  response?: number;
};

export type SpringHandle = {
  /** Interrompt l'animation et rend la valeur et la vitesse (px/s) à l'écran à cet instant. */
  cancel: () => { value: number; velocity: number };
};

const SUBSTEP_S = 0.004;

export function spring(
  from: number,
  to: number,
  velocity: number,
  { damping = 1, response = 0.4 }: SpringOptions,
  onFrame: (value: number) => void,
  onSettle?: () => void,
): SpringHandle {
  const omega = (2 * Math.PI) / response;
  const stiffness = omega * omega;
  const friction = 2 * damping * omega;

  let x = from;
  let v = velocity;
  let last = performance.now();
  let raf = 0;

  const step = (now: number) => {
    const dt = Math.min(0.032, (now - last) / 1000);
    last = now;
    const n = Math.max(1, Math.ceil(dt / SUBSTEP_S));
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      const a = -stiffness * (x - to) - friction * v;
      v += a * h;
      x += v * h;
    }
    if (Math.abs(x - to) < 0.3 && Math.abs(v) < 15) {
      x = to;
      v = 0;
      onFrame(x);
      raf = 0;
      onSettle?.();
      return;
    }
    onFrame(x);
    raf = requestAnimationFrame(step);
  };

  raf = requestAnimationFrame(step);

  return {
    cancel() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      return { value: x, velocity: v };
    },
  };
}

/** Vitesse (px/s) estimée sur les derniers échantillons d'un geste. */
export function velocityFrom(samples: { y: number; t: number }[]) {
  if (samples.length < 2) return 0;
  const end = samples[samples.length - 1];
  let start = samples[0];
  for (let i = samples.length - 2; i >= 0; i--) {
    if (end.t - samples[i].t > 100) break;
    start = samples[i];
  }
  const dt = end.t - start.t;
  return dt > 0 ? ((end.y - start.y) / dt) * 1000 : 0;
}

export function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
