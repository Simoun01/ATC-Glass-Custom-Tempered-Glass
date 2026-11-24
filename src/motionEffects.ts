import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { prefersReducedMotion } from './webglUtils';

gsap.registerPlugin(ScrollTrigger);

export function initMotionEffects(): () => void {
  const reduced = prefersReducedMotion();
  const cleanups: Array<() => void> = [];

  // 1. Top Scroll Progress Bar
  const progressBar = document.getElementById('scroll-progress-bar');
  if (progressBar) {
    const updateProgress = () => {
      const docHeight =
        document.documentElement.scrollHeight - window.innerHeight;
      const ratio = docHeight > 0 ? Math.min(1, Math.max(0, window.scrollY / docHeight)) : 0;
      progressBar.style.transform = `scaleX(${ratio})`;
    };
    updateProgress();
    window.addEventListener('scroll', updateProgress, { passive: true });
    window.addEventListener('resize', updateProgress, { passive: true });
    cleanups.push(() => {
      window.removeEventListener('scroll', updateProgress);
      window.removeEventListener('resize', updateProgress);
    });
  }

  if (reduced) {
    return () => cleanups.forEach((fn) => fn());
  }

  // 2. Hero Headline Word-by-Word Reveal
  const animateHeroWords = (immediate = false) => {
    const headline = document.getElementById('hero-headline');
    if (!headline) return;
    const rawText = (headline.textContent || '').trim();
    if (!rawText) return;

    // Split English by spaces, or Chinese cleanly by characters/phrases
    const hasSpaces = /\s/.test(rawText);
    const tokens = hasSpaces ? rawText.split(/\s+/) : Array.from(rawText);

    headline.innerHTML = tokens
      .map(
        (tok) =>
          `<span class="inline-block overflow-hidden align-bottom"><span class="hero-word inline-block will-change-transform">${tok}</span></span>`
      )
      .join(hasSpaces ? ' ' : '');

    const words = headline.querySelectorAll('.hero-word');
    gsap.fromTo(
      words,
      { yPercent: 110, opacity: 0, filter: 'blur(6px)' },
      {
        yPercent: 0,
        opacity: 1,
        filter: 'blur(0px)',
        duration: 0.72,
        stagger: hasSpaces ? 0.065 : 0.035,
        delay: immediate ? 0.02 : 0.08,
        ease: 'power3.out',
      }
    );
  };
  animateHeroWords(false);

  // 3. Staggered Fade-Up + Blur-In for Headings & Paragraphs
  const initTextReveals = () => {
    document.querySelectorAll<HTMLElement>('.gsap-blur-reveal').forEach((el) => {
      if (el.dataset.gsapBound === '1') return;
      el.dataset.gsapBound = '1';
      gsap.fromTo(
        el,
        { opacity: 0, y: 22, filter: 'blur(8px)' },
        {
          opacity: 1,
          y: 0,
          filter: 'blur(0px)',
          duration: 0.75,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: el,
            start: 'top 90%',
            once: true,
          },
        }
      );
    });
  };
  initTextReveals();

  // 4. Number Counters Count-Up
  document.querySelectorAll<HTMLElement>('[data-count-to]').forEach((el) => {
    const target = Number(el.dataset.countTo || 0);
    const suffix = el.dataset.countSuffix || '';
    const prefix = el.dataset.countPrefix || '';
    const counter = { val: 0 };

    gsap.to(counter, {
      val: target,
      duration: 1.25,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: el,
        start: 'top 92%',
        once: true,
      },
      onUpdate: () => {
        el.textContent = `${prefix}${Math.round(counter.val)}${suffix}`;
      },
    });
  });

  // 5. Thickness Matrix Rows Stagger In
  const animateSpecsRows = () => {
    const rows = document.querySelectorAll<HTMLElement>('#specs-table-body tr');
    if (!rows.length) return;
    gsap.fromTo(
      rows,
      { opacity: 0, x: -16 },
      {
        opacity: 1,
        x: 0,
        duration: 0.55,
        stagger: 0.08,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: '#specs-table-body',
          start: 'top 88%',
          once: true,
        },
      }
    );
  };
  animateSpecsRows();

  // 6. Edge-Profile SVG Cross-Sections Self-Drawing (stroke-dashoffset)
  document.querySelectorAll<SVGElement>('.edge-draw-svg').forEach((svg) => {
    const strokes = svg.querySelectorAll<SVGGeometryElement>('path, line, polygon, rect');
    strokes.forEach((shape) => {
      if (typeof shape.getTotalLength !== 'function') return;
      const len = shape.getTotalLength();
      if (!len || !Number.isFinite(len)) return;
      shape.style.strokeDasharray = `${len}`;
      shape.style.strokeDashoffset = `${len}`;
    });

    gsap.to(strokes, {
      strokeDashoffset: 0,
      duration: 1.05,
      stagger: 0.14,
      ease: 'power2.out',
      scrollTrigger: {
        trigger: svg,
        start: 'top 88%',
        once: true,
      },
    });
  });

  // 7. Gallery Items Scale/Reveal on Scroll
  const animateGalleryItems = () => {
    const items = document.querySelectorAll<HTMLElement>('#gallery-grid figure');
    if (!items.length) return;
    gsap.fromTo(
      items,
      { opacity: 0, scale: 0.94, y: 18 },
      {
        opacity: 1,
        scale: 1,
        y: 0,
        duration: 0.6,
        stagger: 0.08,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: '#gallery-grid',
          start: 'top 88%',
          once: true,
        },
      }
    );
  };
  animateGalleryItems();

  // 8. Magnetic Hover on Primary CTAs
  const bindMagneticButtons = () => {
    document.querySelectorAll<HTMLElement>('[data-magnetic]').forEach((btn) => {
      if (btn.dataset.magneticBound === '1') return;
      btn.dataset.magneticBound = '1';

      const onMove = (e: MouseEvent) => {
        const rect = btn.getBoundingClientRect();
        const dx = (e.clientX - (rect.left + rect.width / 2)) * 0.16;
        const dy = (e.clientY - (rect.top + rect.height / 2)) * 0.22;
        gsap.to(btn, {
          x: dx,
          y: dy,
          duration: 0.28,
          ease: 'power2.out',
        });
      };
      const onLeave = () => {
        gsap.to(btn, {
          x: 0,
          y: 0,
          duration: 0.45,
          ease: 'elastic.out(1, 0.5)',
        });
      };

      btn.addEventListener('mousemove', onMove);
      btn.addEventListener('mouseleave', onLeave);
      cleanups.push(() => {
        btn.removeEventListener('mousemove', onMove);
        btn.removeEventListener('mouseleave', onLeave);
      });
    });
  };
  bindMagneticButtons();

  // 9. 3D Tilt & Specular Highlight on Glass Cards
  const bindCardTilts = () => {
    document.querySelectorAll<HTMLElement>('.tilt-card').forEach((card) => {
      if (card.dataset.tiltBound === '1') return;
      card.dataset.tiltBound = '1';
      card.style.transformStyle = 'preserve-3d';

      const onMove = (e: MouseEvent) => {
        const rect = card.getBoundingClientRect();
        const px = (e.clientX - rect.left) / Math.max(rect.width, 1);
        const py = (e.clientY - rect.top) / Math.max(rect.height, 1);
        const rx = (0.5 - py) * 7;
        const ry = (px - 0.5) * 8;
        card.style.setProperty('--mx', `${(px * 100).toFixed(1)}%`);
        card.style.setProperty('--my', `${(py * 100).toFixed(1)}%`);
        card.style.transform = `perspective(900px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) translateY(-2px)`;
      };

      const onLeave = () => {
        card.style.transform = 'perspective(900px) rotateX(0deg) rotateY(0deg) translateY(0px)';
      };

      card.addEventListener('mousemove', onMove);
      card.addEventListener('mouseleave', onLeave);
    });
  };
  bindCardTilts();

  // Re-bind dynamic DOM cards & headline when language or gallery filter updates
  const onLangChange = () => {
    animateHeroWords(true);
    bindCardTilts();
    bindMagneticButtons();
    ScrollTrigger.refresh();
  };
  const onDomUpdate = () => {
    bindCardTilts();
    ScrollTrigger.refresh();
  };

  window.addEventListener('atc:langchange', onLangChange);
  window.addEventListener('atc:domupdated', onDomUpdate);

  return () => {
    window.removeEventListener('atc:langchange', onLangChange);
    window.removeEventListener('atc:domupdated', onDomUpdate);
    ScrollTrigger.getAll().forEach((st) => st.kill());
    cleanups.forEach((fn) => fn());
  };
}
