import { useEffect, useRef, type RefObject } from 'react'
import { usePrefersReducedMotion } from '@/lib/motion'

/*
 * How the field behaves. Written as a handful of named numbers rather than props,
 * because there is one place this is used and a knob nobody turns is a knob somebody
 * has to read past.
 */

/** One particle per this many square pixels, so a laptop and a wall screen look alike. */
const AREA_PER_PARTICLE = 4000
const MAX_PARTICLES = 420

/** How far the pointer reaches, and how hard it pulls at the centre of that reach. */
const REACH = 190
const PULL = 0.055

/** Drift. The field is never still, and never quick enough to be looked at. */
const WANDER = 0.012
const MAX_SPEED = 0.9
const DAMPING = 0.975

/*
 * Two points closer than this are joined, the line fading to nothing at the limit.
 *
 * Shorter than the field was first drawn with, because the field is twice as dense
 * now: at the old reach every point had four times the neighbours and the net stopped
 * being a net and became a haze.
 */
const LINK = 90
const LINK_ALPHA = 0.13
/** How many strengths the lines are drawn in. One stroke per strength, not per line. */
const LINK_STEPS = 8

/** While a sign in is being checked: how hard the form draws the dust in, and how fast. */
const GATHER_PULL = 0.02
const GATHER_SPEED = 1.8
/** A slow turn around the form while it waits, so the gathered dust is not a pile. */
const GATHER_SWIRL = 0.006

/** A refused password throws the dust off the form, hardest at the form's own edge. */
const SCATTER_PUSH = 7
const SCATTER_SPEED = 7

type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  /** Radius in CSS pixels. */
  r: number
  /** How bright it is when nothing is near it. */
  alpha: number
  /** 0 far from the pointer, 1 under it; eased so a glow fades rather than blinks. */
  glow: number
  /** How much of the light behind the form reaches it, worked out once a frame. */
  lit: number
}

/** The ink the application reads in, resolved to a colour the canvas can use. */
function inkOf(probe: HTMLElement) {
  return getComputedStyle(probe).color || '#ffffff'
}

/**
 * Dust in the light over the sign in screen: points that drift, join into a faint net
 * where they come close, and gather towards the pointer while it is near them.
 *
 * It also follows the form, which is the only thing on this screen that happens. While
 * a sign in is being checked ([gather]) the dust is drawn in and turns slowly around
 * the form; each time one is refused ([scatter] counts them) it is thrown off. The
 * light behind the form is a CSS layer in the view, and the dust answers to it here by
 * being brighter the nearer it is to the centre, so the points look lit rather than
 * merely printed over a gradient.
 *
 * A canvas rather than elements: every point moves on every frame, and two hundred
 * positioned elements changing every frame is two hundred layouts the compositor
 * cannot skip.
 *
 * It is the one piece of motion in the application driven from script, so it answers
 * for the things CSS would have done for it. Under reduced motion it draws the field
 * once and stops, and neither the gathering nor the scatter happens. It stops when the
 * tab is hidden rather than spending frames nobody sees. And it takes its colour from
 * the theme's ink, and again whenever the theme changes, so a switch on this very
 * screen does not leave white dust on a white page.
 */
export function GravityParticles({ className, anchor, gather = false, scatter = 0 }: {
  className?: string
  /** The form. The dust gathers around it and is thrown off it. */
  anchor?: RefObject<HTMLElement | null>
  gather?: boolean
  /** A count, not a flag: every change is one throw, however quickly they come. */
  scatter?: number
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const probe = useRef<HTMLSpanElement>(null)
  const reduced = usePrefersReducedMotion()

  /*
   * What the form is doing, read by the frame loop rather than passed into the effect.
   * Passing it in would re-run the effect on every sign in, and re-running it deals a
   * new field: the dust would jump at the exact moment it is meant to be seen moving.
   */
  const live = useRef({ gather, scatter })
  useEffect(() => {
    live.current.gather = gather
    live.current.scatter = scatter
  }, [gather, scatter])

  useEffect(() => {
    const el = canvas.current
    const ink = probe.current
    const ctx = el?.getContext('2d')
    if (!el || !ink || !ctx) return

    let width = 0
    let height = 0
    let colour = inkOf(ink)
    let particles: Particle[] = []
    let frame = 0
    // Off the screen until the pointer has actually been somewhere.
    const pointer = { x: -1e4, y: -1e4, inside: false }
    // The throws already made, and how much of the last one is still in the air.
    let thrown = live.current.scatter
    let burst = 0

    const spawn = (): Particle => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      // Mostly specks, a few that catch the eye.
      r: 0.5 + Math.random() ** 3 * 1.9,
      alpha: 0.18 + Math.random() * 0.45,
      glow: 0,
      lit: 1
    })

    /** Where the form is on the canvas, and how far out its edge reaches. */
    const form = () => {
      const target = anchor?.current
      if (!target) return { x: width / 2, y: height / 2, edge: 0 }
      const box = target.getBoundingClientRect()
      const own = el.getBoundingClientRect()
      return {
        x: box.left - own.left + box.width / 2,
        y: box.top - own.top + box.height / 2,
        edge: Math.hypot(box.width, box.height) / 2
      }
    }

    /*
     * The field is sized to the screen, and re-dealt only as far as it has to be: a
     * resize keeps the particles that are still on it and adds or drops the
     * difference, rather than scattering everything the moment a window is dragged.
     */
    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      width = el.clientWidth
      height = el.clientHeight
      el.width = Math.round(width * ratio)
      el.height = Math.round(height * ratio)
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0)

      const wanted = Math.min(MAX_PARTICLES, Math.round((width * height) / AREA_PER_PARTICLE))
      particles = particles.filter((p) => p.x <= width && p.y <= height).slice(0, wanted)
      while (particles.length < wanted) particles.push(spawn())
    }

    const draw = () => {
      const centre = form()
      const falloff = Math.max(width, height) * 0.62
      for (const p of particles) {
        p.lit = 0.5 + 0.5 * (1 - Math.min(1, Math.hypot(p.x - centre.x, p.y - centre.y) / falloff))
      }

      ctx.clearRect(0, 0, width, height)
      ctx.fillStyle = colour
      ctx.strokeStyle = colour
      ctx.lineWidth = 0.6

      /*
       * The net first, so the points sit on top of the lines they join.
       *
       * Every pair, which at four hundred points is eighty thousand checks a frame and
       * still fine: the square test rejects almost all of them before a square root is
       * taken. A line is faint on its own and stronger where the pointer has lit either
       * end, which is what turns the dust around the cursor into a small constellation
       * rather than a denser patch of dots.
       *
       * The lines are gathered into a few paths by strength and stroked once each,
       * rather than stroked one at a time. A stroke is a trip to the rasteriser, and
       * at this density that was a thousand of them a frame to draw lines nobody can
       * tell apart from a neighbour one step brighter.
       */
      const MAX_LINK = 0.55
      const bands = Array.from({ length: LINK_STEPS }, () => new Path2D())
      let drawn = false
      for (let i = 0; i < particles.length; i++) {
        const a = particles[i]
        for (let j = i + 1; j < particles.length; j++) {
          const b = particles[j]
          const dx = a.x - b.x
          if (dx > LINK || dx < -LINK) continue
          const dy = a.y - b.y
          if (dy > LINK || dy < -LINK) continue
          const distance = Math.hypot(dx, dy)
          if (distance >= LINK) continue
          const strength = (1 - distance / LINK) * LINK_ALPHA * (0.6 + Math.max(a.glow, b.glow) * 1.8)
          const alpha = Math.min(MAX_LINK, strength * Math.min(a.lit, b.lit))
          const band = bands[Math.min(LINK_STEPS - 1, Math.floor((alpha / MAX_LINK) * LINK_STEPS))]
          band.moveTo(a.x, a.y)
          band.lineTo(b.x, b.y)
          drawn = true
        }
      }
      if (drawn) {
        bands.forEach((band, step) => {
          ctx.globalAlpha = ((step + 0.5) / LINK_STEPS) * MAX_LINK
          ctx.stroke(band)
        })
      }

      for (const p of particles) {
        // The halo first and wide, so the point sits in the middle of its own light.
        if (p.glow > 0.02) {
          ctx.globalAlpha = p.glow * 0.16
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.r * 5.5, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.globalAlpha = Math.min(1, (p.alpha + p.glow * 0.5) * p.lit)
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r * (1 + p.glow * 0.6), 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
    }

    const step = () => {
      const centre = form()
      const { gather: gathering, scatter: throws } = live.current

      // A refused sign in: everything is pushed away from the form once, hardest at
      // its edge, where the dust gathered while it waited.
      if (throws !== thrown) {
        thrown = throws
        burst = 1
        const reach = Math.max(width, height) * 0.8
        for (const p of particles) {
          const dx = p.x - centre.x
          const dy = p.y - centre.y
          const distance = Math.max(1, Math.hypot(dx, dy))
          const push = SCATTER_PUSH * Math.max(0.15, 1 - distance / reach) * (0.7 + Math.random() * 0.6)
          p.vx += (dx / distance) * push
          p.vy += (dy / distance) * push
        }
      }
      burst *= 0.955
      const limit = Math.max(gathering ? GATHER_SPEED : MAX_SPEED, MAX_SPEED + burst * SCATTER_SPEED)

      for (const p of particles) {
        p.vx += (Math.random() - 0.5) * WANDER
        p.vy += (Math.random() - 0.5) * WANDER

        if (gathering && centre.edge > 0) {
          const dx = centre.x - p.x
          const dy = centre.y - p.y
          const distance = Math.max(1, Math.hypot(dx, dy))
          // In from outside the form, out from under it: the dust ends up around the
          // edge, where it can be seen, rather than piled behind the card.
          const ring = centre.edge * 1.08
          const pull = distance > ring ? GATHER_PULL : -GATHER_PULL * 1.5
          p.vx += (dx / distance) * pull + (-dy / distance) * GATHER_SWIRL
          p.vy += (dy / distance) * pull + (dx / distance) * GATHER_SWIRL
        }

        let near = 0
        if (pointer.inside && !gathering) {
          const dx = pointer.x - p.x
          const dy = pointer.y - p.y
          const distance = Math.hypot(dx, dy)
          if (distance < REACH && distance > 0.5) {
            near = 1 - distance / REACH
            // Stronger the closer it is, and along the line to the pointer, so the
            // field bends towards it rather than jumping onto it.
            const force = near * near * PULL
            p.vx += (dx / distance) * force
            p.vy += (dy / distance) * force
          }
        }
        p.glow += (near - p.glow) * 0.08

        p.vx *= DAMPING
        p.vy *= DAMPING
        const speed = Math.hypot(p.vx, p.vy)
        if (speed > limit) {
          p.vx = (p.vx / speed) * limit
          p.vy = (p.vy / speed) * limit
        }
        p.x += p.vx
        p.y += p.vy

        // Out one edge, in at the other: the field never thins where the drift goes.
        if (p.x < -10) p.x = width + 10
        else if (p.x > width + 10) p.x = -10
        if (p.y < -10) p.y = height + 10
        else if (p.y > height + 10) p.y = -10
      }
    }

    const loop = () => {
      step()
      draw()
      frame = requestAnimationFrame(loop)
    }

    const start = () => {
      cancelAnimationFrame(frame)
      if (reduced) draw()
      else frame = requestAnimationFrame(loop)
    }

    // The pointer is read from the window, not the canvas: the canvas sits under the
    // card and lets clicks through, so it never receives a pointer event of its own.
    const onMove = (event: PointerEvent) => {
      const box = el.getBoundingClientRect()
      pointer.x = event.clientX - box.left
      pointer.y = event.clientY - box.top
      pointer.inside = true
    }
    const onLeave = () => {
      pointer.inside = false
    }
    const onVisibility = () => {
      if (document.hidden) cancelAnimationFrame(frame)
      else start()
    }

    // A theme switch changes the ink under this screen while it is on it.
    const themeWatch = new MutationObserver(() => {
      colour = inkOf(ink)
      if (reduced) draw()
    })
    themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })

    const sizeWatch = new ResizeObserver(() => {
      resize()
      if (reduced) draw()
    })
    sizeWatch.observe(el)

    resize()
    start()
    if (!reduced) {
      window.addEventListener('pointermove', onMove, { passive: true })
      document.documentElement.addEventListener('pointerleave', onLeave)
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelAnimationFrame(frame)
      themeWatch.disconnect()
      sizeWatch.disconnect()
      window.removeEventListener('pointermove', onMove)
      document.documentElement.removeEventListener('pointerleave', onLeave)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [reduced, anchor])

  return (
    <>
      <canvas ref={canvas} aria-hidden="true" className={className} />
      {/* Carries the theme's ink so the canvas can read it as a resolved colour. */}
      <span ref={probe} aria-hidden="true" className="hidden text-accent" />
    </>
  )
}
