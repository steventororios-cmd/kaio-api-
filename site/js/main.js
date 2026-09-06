/* ============================================================
   Aventuras Tour Medellín — Lógica del sitio
   ============================================================ */

// ---------- CONFIG ----------
const CONFIG = {
  whatsappNumber: '573104464298', // +57 310 446 4298
  whatsappDefaultMsg: 'Hola Aventuras Tour Medellín 👋, quiero información sobre los tours disponibles.',
};

function waLink(message) {
  return `https://wa.me/${CONFIG.whatsappNumber}?text=${encodeURIComponent(message)}`;
}
function money(n) {
  return '$' + Number(n).toLocaleString('es-CO');
}

const ICONS_BY_CATEGORY = {
  naturaleza: { icon: 'leaf', c1: '#5a9a2f', c2: '#7cb342' },
  cultura: { icon: 'church', c1: '#a11f2b', c2: '#c22a35' },
  aventura: { icon: 'water', c1: '#1c4a5e', c2: '#15394a' },
  rumba: { icon: 'music', c1: '#c22a35', c2: '#db3b43' },
  miradores: { icon: 'mountain', c1: '#15394a', c2: '#0f2a35' },
};

document.addEventListener('DOMContentLoaded', () => {
  wireWhatsappLinks();
  initPreloader();
  initHeader();
  initMobileNav();
  initHeroCanvas();
  initHeroSlideshow();
  buildMarquee();
  syncTourCounts();
  initCounters();
  initReveal();
  buildFilterTabs();
  buildToursGrid('todos');
  buildCalendar();
  buildGallery();
  buildTestimonials();
  buildFaq();
  populateTourSelect();
  initContactForm();
  initModal();
  initBackTop();
  initScrollProgress();
  observeReveals();
  document.getElementById('year').textContent = new Date().getFullYear();
});

// ---------- Scroll reveal (self-contained, no external dependency) ----------
let revealObserver = null;
function initReveal() {
  if (!('IntersectionObserver' in window)) {
    revealObserver = null;
    return;
  }
  revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });
}
function observeReveals(root) {
  const scope = root || document;
  const els = scope.querySelectorAll('.reveal');
  els.forEach((el) => {
    if (el.dataset.revealBound) return;
    el.dataset.revealBound = '1';
    if (revealObserver) revealObserver.observe(el);
    else el.classList.add('in-view');
  });
  // Safety net: guarantee visibility even if something goes wrong with the observer.
  setTimeout(() => {
    scope.querySelectorAll('.reveal:not(.in-view)').forEach((el) => el.classList.add('in-view'));
  }, 4000);
}

// ---------- WhatsApp wiring ----------
function wireWhatsappLinks() {
  const ids = ['headerWhatsapp', 'navWhatsapp', 'heroWhatsapp', 'ctaWhatsapp', 'floatWhatsapp', 'socialWhatsapp'];
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.href = waLink(CONFIG.whatsappDefaultMsg);
  });
}

// ---------- Preloader ----------
function initPreloader() {
  window.addEventListener('load', () => {
    setTimeout(() => {
      document.getElementById('preloader').classList.add('hide');
    }, 400);
  });
  setTimeout(() => document.getElementById('preloader').classList.add('hide'), 2500);
}

// ---------- Header scroll ----------
function initHeader() {
  const header = document.getElementById('siteHeader');
  const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 40);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
}

// ---------- Mobile nav ----------
function initMobileNav() {
  const btn = document.getElementById('hamburgerBtn');
  const nav = document.getElementById('navLinks');
  const overlay = document.getElementById('navOverlay');
  function close() {
    nav.classList.remove('open');
    overlay.classList.remove('show');
  }
  btn.addEventListener('click', () => {
    nav.classList.toggle('open');
    overlay.classList.toggle('show');
  });
  overlay.addEventListener('click', close);
  nav.querySelectorAll('a').forEach((a) => a.addEventListener('click', close));
}

// ---------- Scroll progress ----------
function initScrollProgress() {
  const bar = document.getElementById('scroll-progress');
  window.addEventListener('scroll', () => {
    const h = document.documentElement;
    const pct = (h.scrollTop / (h.scrollHeight - h.clientHeight)) * 100;
    bar.style.width = pct + '%';
  }, { passive: true });
}

// ---------- Hero canvas particles ----------
function initHeroCanvas() {
  const canvas = document.getElementById('heroCanvas');
  const ctx = canvas.getContext('2d');
  let w, h, particles;

  function resize() {
    w = canvas.width = canvas.offsetWidth;
    h = canvas.height = canvas.offsetHeight;
  }
  function makeParticles() {
    const count = Math.min(70, Math.floor((w * h) / 18000));
    particles = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() * 1.8 + 0.6,
      speed: Math.random() * 0.35 + 0.08,
      drift: Math.random() * 0.4 - 0.2,
      opacity: Math.random() * 0.5 + 0.25,
    }));
  }
  function tick() {
    ctx.clearRect(0, 0, w, h);
    particles.forEach((p) => {
      p.y -= p.speed;
      p.x += p.drift;
      if (p.y < -5) { p.y = h + 5; p.x = Math.random() * w; }
      if (p.x < -5) p.x = w + 5;
      if (p.x > w + 5) p.x = -5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(240, 205, 126, ${p.opacity})`;
      ctx.fill();
    });
    requestAnimationFrame(tick);
  }
  resize();
  makeParticles();
  tick();
  window.addEventListener('resize', () => { resize(); makeParticles(); });
}

// ---------- Hero photo slideshow ----------
function initHeroSlideshow() {
  const slides = document.querySelectorAll('#heroSlideshow .hero-slide');
  if (slides.length < 2) return;
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced) return;
  let current = 0;
  setInterval(() => {
    slides[current].classList.remove('active');
    current = (current + 1) % slides.length;
    slides[current].classList.add('active');
  }, 6000);
}

// ---------- Marquee ----------
function buildMarquee() {
  const names = TOURS.map((t) => t.name);
  const track = document.getElementById('marqueeTrack');
  const full = [...names, ...names]; // duplicate for seamless loop
  track.innerHTML = full.map((n) => `<span>${n}</span>`).join('');
}

// Keep tour-count copy (hero stat + tours section blurb) in sync with the
// actual catalog, so removing/adding a tour never leaves a stale number.
function syncTourCounts() {
  const heroStat = document.getElementById('statTourCount');
  if (heroStat) heroStat.dataset.count = String(TOURS.length);
  const blurb = document.getElementById('toursCountText');
  if (blurb) blurb.textContent = String(TOURS.length);
}

// ---------- Counters ----------
function initCounters() {
  const targets = document.querySelectorAll('.count-target');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const end = parseFloat(el.dataset.count);
      const decimals = parseInt(el.dataset.decimal || '0', 10);
      const duration = 1600;
      const start = performance.now();
      function frame(now) {
        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const val = end * eased;
        el.textContent = decimals ? val.toFixed(decimals) : Math.floor(val).toLocaleString('es-CO');
        if (progress < 1) requestAnimationFrame(frame);
        else el.textContent = decimals ? end.toFixed(decimals) : end.toLocaleString('es-CO');
      }
      requestAnimationFrame(frame);
      observer.unobserve(el);
    });
  }, { threshold: 0.5 });
  targets.forEach((t) => observer.observe(t));
}

// ---------- Tour cards ----------
function tourIcon(t) { return ICONS_BY_CATEGORY[t.category]?.icon || t.icon; }

function tourCardHTML(t) {
  const cat = ICONS_BY_CATEGORY[t.category] || { c1: '#15394a', c2: '#1c4a5e' };
  const days = t.days;
  const dayBadges = DAY_SHORT.map((d, i) => `<span class="d ${days.includes(i) ? 'on' : ''}">${d}</span>`).join('');
  const mediaBg = t.photo
    ? `background-image:linear-gradient(180deg, rgba(15,42,53,0) 55%, rgba(15,42,53,.55)), url('${t.photo}');background-size:cover;background-position:center;`
    : `background:linear-gradient(135deg, ${cat.c1}, ${cat.c2});`;
  return `
  <div class="tour-card reveal" data-category="${t.category}" data-id="${t.id}">
    <div class="tour-media" style="${mediaBg}">
      ${t.badge ? `<span class="tour-badge">${t.badge}</span>` : ''}
      ${t.photo ? '' : `<svg class="ic tour-icon-big"><use href="#ic-${tourIcon(t)}"/></svg>`}
      <div class="tour-price-tag"><small>desde</small>${money(t.price)}</div>
    </div>
    <div class="tour-body">
      <div class="tag">${t.tag}</div>
      <h3>${t.name}</h3>
      <div class="tour-meta">
        <span><svg class="ic"><use href="#ic-clock"/></svg>${t.duration}</span>
        <span><svg class="ic"><use href="#ic-users"/></svg>${t.priceUnit}</span>
      </div>
      <div class="tour-days">${dayBadges}</div>
      <div class="tour-actions">
        <button class="btn btn-ghost btn-sm view-detail" data-id="${t.id}">Ver detalle</button>
        <a href="${waLink('Hola Aventuras Tour Medellín 👋, quiero reservar el tour: ' + t.name)}" target="_blank" rel="noopener" class="btn btn-primary btn-sm"><svg class="ic"><use href="#ic-whatsapp"/></svg>Reservar</a>
      </div>
    </div>
  </div>`;
}

function buildFilterTabs() {
  const wrap = document.getElementById('filterTabs');
  wrap.innerHTML = Object.entries(CATEGORIES).map(([key, val], i) => `
    <button class="filter-tab ${i === 0 ? 'active' : ''}" data-filter="${key}">
      <svg class="ic"><use href="#ic-${val.icon}"/></svg>${val.label}
    </button>`).join('');
  wrap.querySelectorAll('.filter-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      wrap.querySelectorAll('.filter-tab').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      buildToursGrid(btn.dataset.filter);
    });
  });
}

function buildToursGrid(filter) {
  const grid = document.getElementById('toursGrid');
  const list = filter === 'todos' ? TOURS : TOURS.filter((t) => t.category === filter);
  grid.innerHTML = list.map(tourCardHTML).join('');
  grid.querySelectorAll('.view-detail').forEach((btn) => {
    btn.addEventListener('click', () => openTourModal(btn.dataset.id));
  });
  observeReveals(grid);
}

// footer quick links open modal directly
document.addEventListener('click', (e) => {
  const link = e.target.closest('[data-tourlink]');
  if (link) {
    e.preventDefault();
    document.querySelector('#tours').scrollIntoView({ behavior: 'smooth' });
    setTimeout(() => openTourModal(link.dataset.tourlink), 500);
  }
});

// ---------- Modal ----------
function initModal() {
  const overlay = document.getElementById('tourModal');
  document.getElementById('modalClose').addEventListener('click', closeTourModal);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeTourModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeTourModal(); });
}
function openTourModal(id) {
  const t = TOURS.find((x) => x.id === id);
  if (!t) return;
  const coverImg = document.getElementById('modalCoverImg');
  if (t.photo) { coverImg.src = t.photo; coverImg.alt = t.name; coverImg.style.display = 'block'; }
  else { coverImg.style.display = 'none'; coverImg.removeAttribute('src'); }
  document.getElementById('modalTag').textContent = t.tag;
  document.getElementById('modalTitle').textContent = t.name;
  document.getElementById('modalPrice').innerHTML = `${money(t.price)}<span>${t.priceUnit}</span>`;
  document.getElementById('modalSchedule').innerHTML = `<strong>${t.schedule}</strong><br>${t.pickup}`;
  document.getElementById('modalIncludes').innerHTML = t.includes.map((i) => `<li><svg class="ic"><use href="#ic-check"/></svg>${i}</li>`).join('');
  document.getElementById('modalHighlights').innerHTML = t.highlights.map((i) => `<li><svg class="ic"><use href="#ic-map-pin"/></svg>${i}</li>`).join('');
  const noteEl = document.getElementById('modalNote');
  if (t.note) { noteEl.style.display = 'block'; noteEl.textContent = t.note; }
  else { noteEl.style.display = 'none'; }
  document.getElementById('modalWhatsapp').href = waLink(`Hola Aventuras Tour Medellín 👋, quiero reservar el tour: ${t.name}`);

  const overlay = document.getElementById('tourModal');
  overlay.classList.add('show');
  document.body.classList.add('modal-open');
}
function closeTourModal() {
  document.getElementById('tourModal').classList.remove('show');
  document.body.classList.remove('modal-open');
}

// ---------- Calendar ----------
function buildCalendar() {
  const todayIdx = (new Date().getDay() + 6) % 7; // convert Sun=0 -> Mon=0 based index
  const calDays = document.getElementById('calDays');
  calDays.innerHTML = DAY_NAMES.map((name, i) => {
    const count = TOURS.filter((t) => t.days.includes(i)).length;
    return `<button class="cal-day-btn ${i === 0 ? 'active' : ''} ${i === todayIdx ? 'today' : ''}" data-day="${i}">
      <span class="dname">${name.slice(0, 3)}</span>
      <span class="dcount">${count}</span>
      <small>tours</small>
    </button>`;
  }).join('');

  calDays.querySelectorAll('.cal-day-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      calDays.querySelectorAll('.cal-day-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      renderCalList(parseInt(btn.dataset.day, 10));
    });
  });

  renderCalList(0);
}

function calItemHTML(t) {
  const cat = ICONS_BY_CATEGORY[t.category] || { c1: '#15394a', c2: '#1c4a5e', icon: 'map-pin' };
  return `
    <div class="cal-item">
      <div class="cal-ic" style="background:linear-gradient(135deg, ${cat.c1}, ${cat.c2});">
        <svg class="ic"><use href="#ic-${tourIcon(t)}"/></svg>
      </div>
      <div class="info">
        <h4>${t.name}</h4>
        <p>${t.schedule}</p>
      </div>
      <div class="price">${money(t.price)}</div>
    </div>`;
}

function renderCalList(dayIndex) {
  const list = document.getElementById('calList');
  const dayTours = TOURS.filter((t) => t.days.includes(dayIndex));
  if (!dayTours.length) {
    list.innerHTML = `<div class="cal-empty">No hay tours programados este día. ¡Escríbenos y armamos un plan a la medida!</div>`;
    return;
  }

  // Separate the tours unique to this day from the ones that run every day of
  // the week, so picking a different day actually shows what changes instead
  // of repeating the same 10-item daily list every time.
  const special = dayTours.filter((t) => t.days.length < 7);
  const daily = dayTours.filter((t) => t.days.length === 7);

  let html = '';
  if (special.length) {
    html += `<div class="cal-group-label"><svg class="ic"><use href="#ic-star"/></svg>Salidas especiales de ${DAY_NAMES[dayIndex]}</div>`;
    html += special.map(calItemHTML).join('');
  }
  if (daily.length) {
    html += `
      <button class="cal-toggle" id="calDailyToggle" aria-expanded="false">
        <svg class="ic"><use href="#ic-calendar"/></svg>
        <span id="calDailyToggleLabel">Ver ${daily.length} tours con salida diaria</span>
        <svg class="ic chev"><use href="#ic-arrow-right"/></svg>
      </button>
      <div class="cal-daily-list" id="calDailyList" hidden>${daily.map(calItemHTML).join('')}</div>`;
  }
  list.innerHTML = html;

  const toggle = document.getElementById('calDailyToggle');
  if (toggle) {
    toggle.addEventListener('click', () => {
      const dailyList = document.getElementById('calDailyList');
      const label = document.getElementById('calDailyToggleLabel');
      const isOpen = !dailyList.hidden;
      dailyList.hidden = isOpen;
      toggle.classList.toggle('open', !isOpen);
      toggle.setAttribute('aria-expanded', String(!isOpen));
      label.textContent = isOpen ? `Ver ${daily.length} tours con salida diaria` : 'Ocultar tours con salida diaria';
    });
  }
}

// ---------- Gallery ----------
// Silhouette decorations per category — hand-drawn accents that stand in for
// real photography until each tour's `photo` field points at a real image.
const CATEGORY_SILHOUETTE = {
  naturaleza: '<path d="M0 150 L40 100 L70 130 L110 70 L150 120 L180 95 L200 150 Z" fill="#fff" opacity=".16"/>',
  cultura: '<path d="M60 150 V90 L100 55 L140 90 V150 Z M92 150 V115 H108 V150 Z" fill="#fff" opacity=".16"/>',
  aventura: '<path d="M0 130c25-18 45-18 70 0s45 18 70 0 45-18 70 0v20H0Z" fill="#fff" opacity=".18"/>',
  rumba: '<circle cx="100" cy="85" r="34" fill="none" stroke="#fff" stroke-width="3" opacity=".18"/><circle cx="100" cy="85" r="52" fill="none" stroke="#fff" stroke-width="2" opacity=".1"/>',
  miradores: '<path d="M0 150 L50 90 L90 130 L120 100 L160 150 Z" fill="#fff" opacity=".16"/><circle cx="150" cy="45" r="14" fill="#fff" opacity=".14"/>',
};

// Curated spread of tours shown in the gallery — kept to a manageable count
// while covering every category. Swap `photo` on the matching tour in
// data.js (see the comment above TOURS) once a real image is available; this
// function picks it up automatically.
const GALLERY_TOUR_IDS = ['guatape', 'napoles', 'comuna13', 'santafe', 'cafe', 'rioclaro', 'escobar', 'chiva', 'jardin', 'oriente', 'lechera', 'picacho', 'octava', 'parapente', 'provenza', 'pueblos'];
const GALLERY_LARGE_IDS = ['guatape', 'napoles'];

function buildGallery() {
  const grid = document.getElementById('galleryGrid');
  const items = GALLERY_TOUR_IDS.map((id) => TOURS.find((t) => t.id === id)).filter(Boolean);

  grid.innerHTML = items.map((t, i) => {
    const cat = ICONS_BY_CATEGORY[t.category] || { c1: '#15394a', c2: '#1c4a5e' };
    const large = GALLERY_LARGE_IDS.includes(t.id) ? ' large' : '';
    const bg = t.photo
      ? `background-image:url('${t.photo}');background-size:cover;background-position:center;`
      : `background:linear-gradient(135deg, ${cat.c1}, ${cat.c2});`;
    const silhouette = t.photo ? '' : `<svg class="g-silhouette" viewBox="0 0 200 150" preserveAspectRatio="xMidYMax slice" aria-hidden="true">${CATEGORY_SILHOUETTE[t.category] || ''}</svg>`;
    return `
    <button type="button" class="g-item reveal${large}" data-id="${t.id}" style="transition-delay:${i * 60}ms;${bg}" aria-label="Ver detalle de ${t.name}">
      ${silhouette}
      ${t.photo ? '' : `<svg class="ic"><use href="#ic-${tourIcon(t)}"/></svg>`}
      <span class="g-caption"><strong>${t.name}</strong><small>${t.tag}</small></span>
    </button>`;
  }).join('');

  grid.querySelectorAll('.g-item').forEach((btn) => {
    btn.addEventListener('click', () => openTourModal(btn.dataset.id));
  });
  observeReveals(grid);
}

// ---------- Testimonials ----------
function buildTestimonials() {
  const wrapper = document.getElementById('testiWrapper');
  const palette = ['#5a9a2f', '#a11f2b', '#e7b74f', '#1c4a5e', '#c22a35'];
  wrapper.innerHTML = TESTIMONIALS.map((t, i) => `
    <div class="swiper-slide testi-slide">
      <div class="testi-card">
        <div class="testi-stars">${'<svg class="ic"><use href="#ic-star"/></svg>'.repeat(t.rating)}</div>
        <p class="quote">“${t.text}”</p>
        <div class="testi-person">
          <div class="testi-avatar" style="background:${palette[i % palette.length]}">${t.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}</div>
          <div>
            <div class="name">${t.name}</div>
            <div class="origin">${t.origin}</div>
          </div>
        </div>
      </div>
    </div>`).join('');

  if (window.Swiper) {
    new Swiper('#testiSwiper', {
      loop: true,
      autoplay: { delay: 4500, disableOnInteraction: false },
      slidesPerView: 1,
      spaceBetween: 20,
      pagination: { el: '.swiper-pagination', clickable: true },
      breakpoints: { 768: { slidesPerView: 2 }, 1100: { slidesPerView: 3 } },
    });
  }
}

// ---------- FAQ ----------
function buildFaq() {
  const list = document.getElementById('faqList');
  list.innerHTML = FAQS.map((f, i) => `
    <div class="faq-item ${i === 0 ? 'open' : ''}">
      <button class="faq-q">${f.q}<svg class="ic"><use href="#ic-plus"/></svg></button>
      <div class="faq-a"><p>${f.a}</p></div>
    </div>`).join('');
  list.querySelectorAll('.faq-item').forEach((item) => {
    item.querySelector('.faq-q').addEventListener('click', () => {
      const wasOpen = item.classList.contains('open');
      list.querySelectorAll('.faq-item').forEach((i) => i.classList.remove('open'));
      if (!wasOpen) item.classList.add('open');
    });
  });
}

// ---------- Contact form select ----------
function populateTourSelect() {
  const select = document.getElementById('fTour');
  select.innerHTML = '<option value="">Selecciona un tour (opcional)</option>' +
    TOURS.map((t) => `<option value="${t.name}">${t.name}</option>`).join('') +
    '<option value="No estoy seguro / Asesoría">No estoy seguro / Quiero asesoría</option>';
}

// ---------- Contact form submit ----------
function initContactForm() {
  const form = document.getElementById('bookingForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('formSubmit');
    submitBtn.disabled = true;

    const data = new FormData(form);
    const nombre = data.get('nombre') || '';
    const telefono = data.get('telefono') || '';
    const tour = data.get('tour') || 'sin especificar';
    const fecha = data.get('fecha') || 'sin especificar';
    const mensaje = data.get('mensaje') || '';

    try {
      await fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(data).toString(),
      });
    } catch (err) {
      // Netlify Forms endpoint only exists once deployed; ignore locally.
    }

    form.style.display = 'none';
    document.getElementById('formSuccess').classList.add('show');

    const waText = `Hola Aventuras Tour Medellín 👋, soy ${nombre}.\nTeléfono: ${telefono}\nTour de interés: ${tour}\nFecha aproximada: ${fecha}\nMensaje: ${mensaje}`;
    setTimeout(() => window.open(waLink(waText), '_blank'), 900);
    submitBtn.disabled = false;
  });
}

// ---------- Back to top ----------
function initBackTop() {
  const btn = document.getElementById('backTop');
  window.addEventListener('scroll', () => {
    btn.classList.toggle('show', window.scrollY > 500);
  }, { passive: true });
  btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}
