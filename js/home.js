/* StratIQ — Home page motion */
(function () {
    if (!window.gsap) return;
    gsap.registerPlugin(ScrollTrigger);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const $ = (s, c = document) => c.querySelector(s);
    const $$ = (s, c = document) => [...c.querySelectorAll(s)];

    // ── Split headings into words, reveal from a mask ──
    function splitWords(el) {
        const walk = node => {
            [...node.childNodes].forEach(n => {
                if (n.nodeType === 3) {
                    const frag = document.createDocumentFragment();
                    n.textContent.split(/(\s+)/).forEach(part => {
                        if (!part) return;
                        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
                        const w = document.createElement('span'); w.className = 'w';
                        const i = document.createElement('span'); i.textContent = part;
                        w.appendChild(i); frag.appendChild(w);
                    });
                    n.replaceWith(frag);
                } else if (n.nodeType === 1 && !n.classList.contains('w')) walk(n);
            });
        };
        walk(el);
    }
    $$('.split').forEach(el => {
        splitWords(el);
        gsap.from($$('.w > span', el), {
            yPercent: 115, rotate: 6, duration: 1.2, ease: 'expo.out', stagger: 0.06,
            scrollTrigger: { trigger: el, start: 'top 85%' }
        });
    });

    // ── Manifesto: word-by-word light-up, scrubbed ──
    const mani = $('[data-words]');
    if (mani) {
        const wrap = node => {
            [...node.childNodes].forEach(n => {
                if (n.nodeType === 3) {
                    const frag = document.createDocumentFragment();
                    n.textContent.split(/(\s+)/).forEach(part => {
                        if (!part) return;
                        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
                        const s = document.createElement('span'); s.className = 'mw'; s.textContent = part; frag.appendChild(s);
                    });
                    n.replaceWith(frag);
                } else if (n.nodeType === 1) wrap(n);
            });
        };
        wrap(mani);
        const words = $$('.mw', mani);
        ScrollTrigger.create({
            trigger: mani, start: 'top 75%', end: 'bottom 45%', scrub: true,
            onUpdate: self => {
                const n = Math.round(self.progress * words.length);
                words.forEach((w, i) => w.classList.toggle('on', i < n));
            }
        });
    }

    // ── Count-ups ──
    const fmt = (v, el) => {
        const d = +(el.dataset.decimals || 0);
        let s = d ? v.toFixed(d) : Math.round(v).toString();
        if (el.dataset.sep) s = Number(s).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
        return (el.dataset.prefix || '') + s + (el.dataset.suffix || '');
    };
    $$('[data-count]').forEach(el => {
        const end = parseFloat(el.dataset.count);
        const obj = { v: 0 };
        el.textContent = fmt(0, el);
        ScrollTrigger.create({
            trigger: el, start: 'top 90%', once: true,
            onEnter: () => gsap.to(obj, {
                v: end, duration: end > 10000 ? 2.6 : 1.8, ease: 'power3.out',
                onUpdate: () => { el.textContent = fmt(obj.v, el); }
            })
        });
    });

    // ── Marquees: constant drift + scroll velocity + skew ──
    const marquees = $$('.marquee').map(m => {
        const track = $('.marquee-track', m);
        // clone until wide enough
        for (let i = 0; i < 3; i++) m.appendChild(track.cloneNode(true));
        return { m, tracks: $$('.marquee-track', m), dir: +m.dataset.speed || 1, x: 0 };
    });
    let vel = 0;
    ScrollTrigger.create({ onUpdate: self => { vel = self.getVelocity(); } });
    gsap.ticker.add((t, dt) => {
        const boost = gsap.utils.clamp(-6, 6, vel / 300);
        vel *= 0.92;
        marquees.forEach(q => {
            const w = q.tracks[0].offsetWidth;
            if (!w) return;
            q.x -= (0.6 + Math.abs(boost) * 1.8) * q.dir * (dt / 16);
            if (q.x <= -w) q.x += w;
            if (q.x > 0) q.x -= w;
            const skew = gsap.utils.clamp(-8, 8, boost * -1.6) * q.dir;
            q.tracks.forEach(tr => { tr.style.transform = `translate3d(${q.x}px,0,0) skewX(${skew}deg)`; });
        });
    });

    // ── Stat cards ──
    gsap.from('.stat-card', {
        y: 80, opacity: 0, rotateX: -12, transformOrigin: '50% 100%', duration: 1.2, ease: 'expo.out', stagger: 0.08,
        scrollTrigger: { trigger: '.stat-grid', start: 'top 80%' }
    });

    // ── Pillars: stacked cards scale back as the next arrives ──
    const pillars = $$('.pillar');
    pillars.forEach((card, i) => {
        if (i === pillars.length - 1) return;
        gsap.to(card, {
            scale: 1 - (pillars.length - 1 - i) * 0.04, filter: 'brightness(0.55)', ease: 'none',
            scrollTrigger: { trigger: pillars[i + 1], start: 'top bottom', end: 'top 30%', scrub: true }
        });
    });
    $$('.pillar-visual').forEach(v => ScrollTrigger.create({
        trigger: v, start: 'top 75%', onEnter: () => v.classList.add('is-in')
    }));

    // ── Case media clip reveal ──
    $$('.clip-reveal').forEach(el => {
        gsap.to(el, {
            clipPath: 'inset(0% 0% 0% 0% round 24px)', ease: 'none',
            scrollTrigger: { trigger: el, start: 'top 90%', end: 'top 25%', scrub: true }
        });
        const v = $('video', el);
        if (v) gsap.to(v, { scale: 1, ease: 'none', scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true } });
    });

    // ── Play videos only while visible ──
    const io = new IntersectionObserver(entries => entries.forEach(e => {
        const v = e.target;
        if (e.isIntersecting) { if (v.preload === 'none') v.preload = 'metadata'; v.play().catch(() => { }); }
        else v.pause();
    }), { threshold: 0.25 });
    $$('.case-media video, .reel-card video').forEach(v => io.observe(v));

    // ── Generic rise-in ──
    ScrollTrigger.batch('.kpi, .chart-card, .flow, .reel-card, .mini, .cc', {
        start: 'top 88%',
        onEnter: b => gsap.from(b, { y: 60, opacity: 0, duration: 1.1, ease: 'expo.out', stagger: 0.07, overwrite: true })
    });

    // ── Before / after slider ──
    const ba = $('#ba');
    if (ba) {
        let dragging = false;
        const set = x => {
            const r = ba.getBoundingClientRect();
            const p = gsap.utils.clamp(2, 98, ((x - r.left) / r.width) * 100);
            ba.style.setProperty('--pos', p + '%');
        };
        ba.addEventListener('pointerdown', e => { dragging = true; ba.setPointerCapture(e.pointerId); set(e.clientX); });
        ba.addEventListener('pointermove', e => { if (dragging) set(e.clientX); });
        ba.addEventListener('pointerup', () => { dragging = false; });
        ba.addEventListener('pointercancel', () => { dragging = false; });
        // teaser sweep on first view
        const st = { p: 50 };
        ScrollTrigger.create({
            trigger: ba, start: 'top 70%', once: true,
            onEnter: () => gsap.timeline()
                .to(st, { p: 82, duration: 1, ease: 'power2.inOut', onUpdate: () => ba.style.setProperty('--pos', st.p + '%') })
                .to(st, { p: 30, duration: 1.2, ease: 'power2.inOut', onUpdate: () => ba.style.setProperty('--pos', st.p + '%') })
                .to(st, { p: 50, duration: 0.9, ease: 'power2.inOut', onUpdate: () => ba.style.setProperty('--pos', st.p + '%') })
        });
    }

    // ── Bars, dots, age charts ──
    $$('.bar-duo, .country-bars').forEach(el => ScrollTrigger.create({ trigger: el, start: 'top 85%', once: true, onEnter: () => el.classList.add('is-in') }));
    $$('.dots').forEach(el => {
        const on = +el.dataset.on, total = +el.dataset.total;
        for (let i = 0; i < total; i++) {
            const d = document.createElement('i');
            if (i < on) d.className = 'on';
            d.style.transitionDelay = (i * 0.04) + 's';
            el.appendChild(d);
        }
        ScrollTrigger.create({ trigger: el, start: 'top 85%', once: true, onEnter: () => el.classList.add('is-in') });
    });
    $$('.age-bars').forEach(el => {
        const vals = el.dataset.values.split(',').map(Number);
        const labels = el.dataset.labels.split(',');
        const hi = (el.dataset.hi || '').split(',').map(Number);
        const max = Math.max(...vals);
        vals.forEach((v, i) => {
            const c = document.createElement('div');
            c.className = 'ab' + (hi.includes(i) ? ' hi' : '');
            c.innerHTML = `<b>${v}%</b><i></i><span>${labels[i]}</span>`;
            el.appendChild(c);
        });
        ScrollTrigger.create({
            trigger: el, start: 'top 85%', once: true,
            onEnter: () => $$('.ab', el).forEach((c, i) => {
                const bar = $('i', c);
                bar.style.transitionDelay = (i * 0.06) + 's';
                bar.style.height = Math.max(2, (vals[i] / max) * 72) + '%';
            })
        });
    });

    // ── Gender ring ──
    const ring = $('#gender-ring');
    if (ring) {
        const o = { t: 0 };
        ScrollTrigger.create({
            trigger: ring, start: 'top 85%', once: true,
            onEnter: () => gsap.to(o, { t: 1, duration: 1.6, ease: 'power3.out', onUpdate: () => ring.style.setProperty('--t', o.t) })
        });
    }

    // ── Growth curve: draw the line, pop the breakout dot ──
    const line = $('.curve-line');
    if (line) {
        const len = line.getTotalLength();
        line.style.strokeDasharray = len;
        line.style.strokeDashoffset = len;
        const tl = gsap.timeline({ scrollTrigger: { trigger: '.curve-card', start: 'top 75%' } });
        tl.to(line, { strokeDashoffset: 0, duration: 2.4, ease: 'power2.inOut' })
            .to('.curve-area', { opacity: 1, duration: 1 }, '-=1.2')
            .fromTo('.curve-dot', { opacity: 0, scale: 0 }, { opacity: 1, scale: 1, duration: 0.6, ease: 'back.out(3)' }, '-=1.4')
            .from('.curve-tag', { opacity: 0, x: 20, duration: 0.6 }, '<');
    }

    // ── Five moves: horizontal pinned scroll ──
    const track = $('#moves-track');
    if (track && !reduced) {
        const dist = () => Math.max(0, track.scrollWidth - window.innerWidth);
        gsap.to(track, {
            x: () => -dist(), ease: 'none',
            scrollTrigger: {
                trigger: '#moves', start: 'top top', end: () => '+=' + dist(),
                pin: '.moves-pin', scrub: 0.6, invalidateOnRefresh: true, anticipatePin: 1
            }
        });
        gsap.from('.move', {
            opacity: 0, y: 40, rotate: 3, stagger: 0.08, duration: 1, ease: 'expo.out',
            scrollTrigger: { trigger: '#moves', start: 'top 60%' }
        });
    }

    // ── Timeline fill ──
    const tlFill = $('#tl-fill');
    if (tlFill) {
        const weeks = $$('.week');
        const vertical = () => window.innerWidth <= 900;
        ScrollTrigger.create({
            trigger: '#timeline', start: 'top 75%', end: 'bottom 55%', scrub: true,
            onUpdate: self => {
                const p = self.progress;
                tlFill.style.transform = vertical() ? `scaleY(${p})` : `scaleX(${p})`;
                weeks.forEach((w, i) => w.classList.toggle('is-on', p >= i / weeks.length + 0.02));
            }
        });
        gsap.from('.week', { y: 50, opacity: 0, stagger: 0.1, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: '#timeline', start: 'top 80%' } });
    }

    // ── CTA title ──
    $$('.cta-title .hl-in').forEach((el, i) => {
        gsap.to(el, { y: 0, yPercent: 0, rotate: 0, duration: 1.4, ease: 'expo.out', delay: i * 0.1, scrollTrigger: { trigger: '.cta', start: 'top 60%' } });
    });
    gsap.set('.cta-title .hl-in', { yPercent: 110, rotate: 4 });

    // ── CTA dot field that bends around the cursor ──
    const cv = $('#cta-field');
    if (cv) {
        const ctx = cv.getContext('2d');
        let W, H, dpr, pts = [], mouse = { x: -9999, y: -9999 }, running = false;
        const build = () => {
            dpr = Math.min(2, window.devicePixelRatio || 1);
            W = cv.offsetWidth; H = cv.offsetHeight;
            cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            const gap = W < 700 ? 26 : 34; pts = [];
            for (let y = gap / 2; y < H; y += gap) for (let x = gap / 2; x < W; x += gap) pts.push({ x, y });
        };
        build(); window.addEventListener('resize', build);
        cv.parentElement.addEventListener('mousemove', e => { const r = cv.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; });
        cv.parentElement.addEventListener('mouseleave', () => { mouse.x = mouse.y = -9999; });
        let t0 = 0;
        const draw = t => {
            if (!running) return;
            t0 = t * 0.001;
            ctx.clearRect(0, 0, W, H);
            const cx = W / 2, cy = H / 2;
            for (const p of pts) {
                const dx = p.x - mouse.x, dy = p.y - mouse.y, d = Math.hypot(dx, dy);
                const push = Math.max(0, 1 - d / 180);
                const wave = Math.sin(Math.hypot(p.x - cx, p.y - cy) * 0.018 - t0 * 1.6) * 0.5 + 0.5;
                const x = p.x + (dx / (d || 1)) * push * 26, y = p.y + (dy / (d || 1)) * push * 26;
                const a = 0.08 + wave * 0.14 + push * 0.7;
                ctx.fillStyle = push > 0.05 ? `rgba(212,255,58,${a})` : `rgba(139,108,255,${a})`;
                const r = 1 + wave * 0.8 + push * 2.2;
                ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill();
            }
            requestAnimationFrame(draw);
        };
        ScrollTrigger.create({
            trigger: '.cta', start: 'top bottom', end: 'bottom top',
            onToggle: self => { running = self.isActive; if (running) requestAnimationFrame(draw); }
        });
    }

    window.addEventListener('load', () => ScrollTrigger.refresh());
})();
