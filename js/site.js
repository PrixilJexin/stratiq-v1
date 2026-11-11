/* StratIQ — shared chrome: smooth scroll, cursor, nav, magnetic buttons */
(function () {
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // ── Smooth scroll (Lenis) wired to GSAP's ticker when present ──
    if (window.Lenis && !reduced) {
        const lenis = new Lenis({ duration: 1.15, easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)), smoothWheel: true });
        window.lenis = lenis;
        if (window.gsap) {
            gsap.ticker.add(time => lenis.raf(time * 1000));
            gsap.ticker.lagSmoothing(0);
            if (window.ScrollTrigger) lenis.on('scroll', ScrollTrigger.update);
        } else {
            const raf = t => { lenis.raf(t); requestAnimationFrame(raf); };
            requestAnimationFrame(raf);
        }
        // in-page anchors
        document.querySelectorAll('a[href^="#"]').forEach(a => {
            a.addEventListener('click', e => {
                const id = a.getAttribute('href');
                if (id.length < 2) return;
                const el = document.querySelector(id);
                if (!el) return;
                e.preventDefault();
                document.body.classList.remove('nav-open');
                lenis.scrollTo(el, { offset: -10, duration: 1.6 });
            });
        });
    }

    // ── Cursor ──
    const dot = document.getElementById('cursor-dot');
    const ring = document.getElementById('cursor-ring');
    const label = document.getElementById('cursor-label');
    if (dot && ring && fine) {
        let mx = -100, my = -100, rx = -100, ry = -100;
        window.addEventListener('mousemove', e => {
            mx = e.clientX; my = e.clientY;
            dot.style.transform = `translate3d(${mx}px, ${my}px, 0)`;
        }, { passive: true });
        (function tick() {
            rx += (mx - rx) * 0.16; ry += (my - ry) * 0.16;
            ring.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
            requestAnimationFrame(tick);
        })();
        document.addEventListener('mouseover', e => {
            const t = e.target.closest('a, button, [data-cursor]');
            ring.classList.remove('is-hover', 'is-label');
            if (label) label.textContent = '';
            if (!t) return;
            if (t.dataset.cursor === 'label') {
                ring.classList.add('is-label');
                if (label) label.textContent = t.dataset.cursorLabel || 'View';
            } else {
                ring.classList.add('is-hover');
            }
        });
        document.body.style.cursor = 'none';
        document.querySelectorAll('a, button').forEach(el => el.style.cursor = 'none');
    }

    // ── Magnetic buttons ──
    if (fine) {
        document.querySelectorAll('.magnetic').forEach(el => {
            const strength = 0.28;
            el.addEventListener('mousemove', e => {
                const r = el.getBoundingClientRect();
                const x = (e.clientX - r.left - r.width / 2) * strength;
                const y = (e.clientY - r.top - r.height / 2) * strength;
                el.style.transform = `translate(${x}px, ${y}px)`;
            });
            el.addEventListener('mouseleave', () => { el.style.transform = ''; });
        });
    }

    // ── Spotlight cards ──
    document.querySelectorAll('.spot').forEach(el => {
        el.addEventListener('mousemove', e => {
            const r = el.getBoundingClientRect();
            el.style.setProperty('--mx', (e.clientX - r.left) + 'px');
            el.style.setProperty('--my', (e.clientY - r.top) + 'px');
        });
    });

    // ── Nav: hide on scroll down, glass when scrolled ──
    const nav = document.getElementById('site-nav');
    if (nav) {
        let lastY = 0;
        const onScroll = () => {
            const y = window.scrollY;
            nav.classList.toggle('is-scrolled', y > 40);
            nav.classList.toggle('is-hidden', y > lastY && y > 400 && !document.body.classList.contains('nav-open'));
            lastY = y;
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();
    }
    const burger = document.getElementById('nav-burger');
    if (burger) {
        burger.addEventListener('click', () => {
            const open = document.body.classList.toggle('nav-open');
            burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
            if (window.lenis) open ? window.lenis.stop() : window.lenis.start();
        });
        document.querySelectorAll('.mobile-menu a').forEach(a => a.addEventListener('click', () => {
            document.body.classList.remove('nav-open');
            if (window.lenis) window.lenis.start();
        }));
    }

    // ── Clock / year ──
    const clock = document.getElementById('clock');
    if (clock) {
        const fmt = () => {
            const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
            clock.textContent = [d.getHours(), d.getMinutes(), d.getSeconds()].map(n => String(n).padStart(2, '0')).join(':');
        };
        fmt(); setInterval(fmt, 1000);
    }
    const year = document.getElementById('year');
    if (year) year.textContent = new Date().getFullYear();
})();
