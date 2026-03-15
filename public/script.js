/**
 * UNI-SERVICES Portal — script.js
 * Handles: loader, navbar, mobile nav,
 * scroll reveal, contact form (backend connected).
 */

/* ============================================================
   1. PAGE LOADER
   ============================================================ */
window.addEventListener('load', () => {
  const loader = document.getElementById('page-loader');
  if (!loader) return;

  setTimeout(() => {
    loader.classList.add('hidden');

    document.querySelectorAll('.hero-entrance').forEach((el, i) => {
      el.style.animationDelay = `${i * 0.12}s`;
      el.classList.add('animate-in');
    });
  }, 1200);
});

/* ============================================================
   2. STICKY NAVBAR
   ============================================================ */
const navbar = document.querySelector('.navbar');

if (navbar) {
  const handleNavScroll = () => {
    navbar.classList.toggle('scrolled', window.scrollY > 40);
  };

  window.addEventListener('scroll', handleNavScroll, { passive: true });
  handleNavScroll();
}

/* ============================================================
   3. ACTIVE NAV LINK
   ============================================================ */
const currentPath = window.location.pathname;

document.querySelectorAll('.nav-links a, .nav-mobile a').forEach(link => {
  const href = link.getAttribute('href');
  if (href === currentPath) {
    link.classList.add('active');
  }
});

/* ============================================================
   4. MOBILE NAV
   ============================================================ */
const hamburger = document.querySelector('.hamburger');
const navMobile = document.querySelector('.nav-mobile');

if (hamburger && navMobile) {
  hamburger.addEventListener('click', () => {
    const isOpen = hamburger.classList.toggle('open');
    navMobile.classList.toggle('open', isOpen);
    document.body.style.overflow = isOpen ? 'hidden' : '';
  });

  navMobile.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      hamburger.classList.remove('open');
      navMobile.classList.remove('open');
      document.body.style.overflow = '';
    });
  });
}

/* ============================================================
   5. SCROLL REVEAL
   ============================================================ */
const revealObserver = new IntersectionObserver(
  entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
);

document.querySelectorAll('.reveal').forEach(el => {
  revealObserver.observe(el);
});

/* ============================================================
   6. CONTACT FORM — BACKEND CONNECTED
   ============================================================ */
const contactForm = document.getElementById('contact-form');

if (contactForm) {

  const fields = {
    name:    { el: document.getElementById('f-name'),    errorId: 'err-name' },
    email:   { el: document.getElementById('f-email'),   errorId: 'err-email' },
    subject: { el: document.getElementById('f-subject'), errorId: 'err-subject' },
    message: { el: document.getElementById('f-message'), errorId: 'err-message' },
  };

  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function validateField(key, field) {
    const val = field.el.value.trim();
    const err = document.getElementById(field.errorId);
    let valid = true;
    let msg   = '';

    if (!val) {
      valid = false;
      msg = 'This field is required.';
    } else if (key === 'email' && !emailRe.test(val)) {
      valid = false;
      msg = 'Please enter a valid email address.';
    } else if (key === 'message' && val.length < 20) {
      valid = false;
      msg = 'Message must be at least 20 characters.';
    }

    field.el.classList.toggle('error', !valid);

    if (err) {
      err.textContent = msg;
      err.classList.toggle('visible', !valid);
    }

    return valid;
  }

  Object.entries(fields).forEach(([key, field]) => {
    if (field.el) {
      field.el.addEventListener('blur', () => validateField(key, field));
      field.el.addEventListener('input', () => {
        if (field.el.classList.contains('error')) {
          validateField(key, field);
        }
      });
    }
  });

  contactForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const results = Object.entries(fields).map(([key, field]) =>
      validateField(key, field)
    );

    if (!results.every(Boolean)) {
      const firstError = contactForm.querySelector('.form-control.error');
      if (firstError) {
        firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    const submitBtn = contactForm.querySelector('.btn-submit');
    submitBtn.textContent = 'Sending…';
    submitBtn.disabled = true;

    const formData = {
      name: fields.name.el.value.trim(),
      email: fields.email.el.value.trim(),
      subject: fields.subject.el.value,
      message: fields.message.el.value.trim()
    };

    try {
      const response = await fetch('/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const result = await response.json();

      if (result.success) {
        contactForm.reset();
        showPopup("Message sent successfully 🚀");
      } else {
        showPopup(result.message || "Something went wrong ❌");
      }

    } catch (error) {
      showPopup("Server error. Please try again ❌");
    }

    submitBtn.textContent = 'Send Message';
    submitBtn.disabled = false;
  });
}

/* ============================================================
   7. POPUP FUNCTIONS
   ============================================================ */
function showPopup(message) {
  const popup = document.getElementById('custom-popup');
  if (!popup) return;

  popup.querySelector('.popup-message').textContent = message;
  popup.classList.add('active');
}

function closePopup() {
  const popup = document.getElementById('custom-popup');
  if (popup) popup.classList.remove('active');
}

/* ============================================================
   8. SMOOTH SCROLL
   ============================================================ */
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', (e) => {
    const target = document.querySelector(anchor.getAttribute('href'));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

/* ============================================================
   9. CARD STAGGER
   ============================================================ */
document.querySelectorAll('.service-card').forEach((card, i) => {
  card.style.transitionDelay = `${i * 0.08}s`;
});

document.querySelectorAll('.why-card').forEach((card, i) => {
  card.style.transitionDelay = `${i * 0.07}s`;
});


/* =============================================
   THEME TOGGLE — Add inside your <script> block
   or in a separate JS file
   ============================================= */

(function () {
  const STORAGE_KEY = 'uni-theme';
  const root = document.documentElement;

  // Read saved preference, else check OS preference
  function getPreferred() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function applyTheme(theme) {
    root.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_KEY, theme);
    // Sync all checkboxes
    document.querySelectorAll('.theme-toggle input[type="checkbox"]').forEach(cb => {
      cb.checked = theme === 'dark';
    });
  }

  // Apply before paint
  applyTheme(getPreferred());

  document.addEventListener('DOMContentLoaded', function () {
    // Listen on all toggle checkboxes
    document.querySelectorAll('.theme-toggle input[type="checkbox"]').forEach(cb => {
      cb.addEventListener('change', function () {
        applyTheme(this.checked ? 'dark' : 'light');
        // Keep all checkboxes in sync
        document.querySelectorAll('.theme-toggle input[type="checkbox"]').forEach(other => {
          if (other !== this) other.checked = this.checked;
        });
      });
    });

    // OS preference change
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
      if (!localStorage.getItem(STORAGE_KEY)) {
        applyTheme(e.matches ? 'dark' : 'light');
      }
    });
  });
})();


document.addEventListener('DOMContentLoaded', function () {
  const currentPath = window.location.pathname;

  document.querySelectorAll('.nav-links a, .nav-mobile a').forEach(link => {
    link.classList.remove('active');

    const linkPath = new URL(link.href, window.location.origin).pathname;

    if (currentPath === '/' && linkPath === '/') {
      link.classList.add('active');
    } else if (linkPath !== '/' && currentPath.startsWith(linkPath)) {
      link.classList.add('active');
    }
  });
});


/* ── Cookie / Terms Consent Banner ── */
(function () {
  if (localStorage.getItem('uni-consent') === 'accepted') return;

  const banner = document.createElement('div');
  banner.id = 'consent-banner';
  banner.innerHTML = `
    <div class="consent-inner">
      <div class="consent-text">
        <strong>We value your privacy</strong>
        <p>By using UNI-SERVICES, you agree to our
          <a href="/privacy">Privacy Policy</a> and
          <a href="/terms">Terms of Service</a>.
          We use cookies to enhance your experience.
        </p>
      </div>
      <div class="consent-actions">
        <button id="consent-decline" class="consent-btn consent-btn--ghost">Decline</button>
        <button id="consent-accept"  class="consent-btn consent-btn--primary">Accept & Continue</button>
      </div>
    </div>`;
  document.body.appendChild(banner);

  /* Animate in */
  requestAnimationFrame(() => banner.classList.add('consent-visible'));

  function dismiss(accepted) {
    if (accepted) localStorage.setItem('uni-consent', 'accepted');
    else          localStorage.setItem('uni-consent', 'declined');
    banner.classList.remove('consent-visible');
    setTimeout(() => banner.remove(), 400);
  }

  document.getElementById('consent-accept') .addEventListener('click', () => dismiss(true));
  document.getElementById('consent-decline').addEventListener('click', () => dismiss(false));
})();