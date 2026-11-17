/* ============================================================
   12358soft.com — behaviour
   Χωρίς εξαρτήσεις. Όλα τα στοιχεία ενισχύονται προοδευτικά.
   ============================================================ */
(function () {
  "use strict";

  // Κείμενα διεπαφής από το vault (ELEMENTS/ΚΕΙΜΕΝΑ ΔΙΕΠΑΦΗΣ.md)
  function T(key, fallback) {
    var ui = window.SITE_UI || {};
    return ui[key] || fallback;
  }

  var CFG = window.SITE_CONFIG || {};
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  /* ---------- theme ---------- */
  var root = document.documentElement;
  function setTheme(theme) {
    root.dataset.theme = theme;
    try { localStorage.setItem("theme", theme); } catch (e) {}
  }
  $$("[data-theme-toggle]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      setTheme(root.dataset.theme === "light" ? "dark" : "light");
    });
  });

  /* ---------- header ---------- */
  var header = $("#site-header");
  function onScroll() {
    if (header) header.classList.toggle("is-scrolled", window.scrollY > 8);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- mobile menu ---------- */
  var navToggle = $("[data-nav-toggle]");
  var mobileMenu = $("#mobile-menu");
  if (navToggle && mobileMenu) {
    var closeMenu = function () {
      mobileMenu.hidden = true;
      navToggle.setAttribute("aria-expanded", "false");
      document.body.style.overflow = "";
    };
    navToggle.addEventListener("click", function () {
      var open = navToggle.getAttribute("aria-expanded") === "true";
      if (open) { closeMenu(); return; }
      mobileMenu.hidden = false;
      navToggle.setAttribute("aria-expanded", "true");
      document.body.style.overflow = "hidden";
    });
    window.addEventListener("keydown", function (e) { if (e.key === "Escape") closeMenu(); });
    window.addEventListener("resize", function () { if (window.innerWidth > 940) closeMenu(); });
  }

  /* ---------- reveal ---------- */
  var revealTargets = $$(".f-card, .p-card, .d-card, .post-card, .step, .stat, .quote, .c-card, .buy-media, .sec-head");
  if ("IntersectionObserver" in window && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-in");
        io.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.06 });
    revealTargets.forEach(function (el, i) {
      el.classList.add("reveal");
      el.style.transitionDelay = Math.min(i % 6, 5) * 45 + "ms";
      io.observe(el);
    });
  }

  /* ---------- toast ---------- */
  var toast = $("#toast");
  var toastTimer;
  function showToast(msg) {
    if (!toast) return;
    toast.textContent = msg;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.hidden = true; }, 3400);
  }

  /* ---------- forms ---------- */
  var EMAIL = CFG.email || {};
  var PROVIDER = (CFG.provider || "").toLowerCase();
  var WEBHOOK = CFG.webhook_url || "";

  function emailReady(template) {
    return !!(EMAIL.public_key && EMAIL.service_id && template);
  }

  function isLive(kind) {
    if (PROVIDER === "webhook" && WEBHOOK) return true;
    return emailReady(kind === "download" ? EMAIL.template_download : EMAIL.template_contact);
  }

  function sendEmail(templateId, params) {
    return fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service_id: EMAIL.service_id,
        template_id: templateId,
        user_id: EMAIL.public_key,
        template_params: params
      })
    }).then(function (res) {
      if (!res.ok) throw new Error("EmailJS " + res.status + ": " + res.text());
      return { demo: false };
    });
  }

  /**
   * Στέλνει τα δεδομένα της φόρμας με τον provider που έχει ρυθμιστεί.
   * kind: "download" | "contact" | "newsletter"
   */
  function deliver(kind, params) {
    params.form_type = params.form_type || kind;
    if (PROVIDER === "webhook" && WEBHOOK) {
      // Google Apps Script / Make / Zapier: text/plain ώστε να μην γίνεται preflight.
      return fetch(WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(params),
        redirect: "follow"
      }).then(function (res) {
        if (!res.ok) throw new Error("Webhook " + res.status);
        return res.text().then(function (text) {
          var ok = true;
          try {
            var data = JSON.parse(text);
            ok = data.ok !== false;
          } catch (e) { /* κείμενο, όχι JSON — θεωρείται επιτυχία */ }
          if (!ok) throw new Error("Webhook rejected");
          return { demo: false };
        });
      });
    }
    var template = kind === "download" ? EMAIL.template_download : EMAIL.template_contact;
    if ((PROVIDER === "emailjs" || !PROVIDER) && emailReady(template)) {
      return sendEmail(template, params);
    }
    return new Promise(function (resolve) {
      setTimeout(function () { resolve({ demo: true }); }, 650);
    });
  }

  function fieldWrap(input) { return input.closest(".field") || input.parentElement; }

  function setError(input, message) {
    var wrap = fieldWrap(input);
    wrap.classList.toggle("has-error", !!message);
    var slot = $('[data-error-for="' + input.name + '"]', wrap.parentElement) ||
               $('[data-error-for="' + input.name + '"]', input.form);
    if (slot) slot.textContent = message || "";
  }

  function validate(form) {
    var ok = true;
    $$("input[required], textarea[required], select[required]", form).forEach(function (input) {
      var value = (input.value || "").trim();
      var msg = "";
      if (input.type === "checkbox") {
        if (!input.checked) msg = T("ΜΗΝΥΜΑ_ΣΥΓΚΑΤΑΘΕΣΗ", "Απαιτείται η συγκατάθεσή σας.");
      } else if (!value) {
        msg = T("ΜΗΝΥΜΑ_ΥΠΟΧΡΕΩΤΙΚΟ", "Το πεδίο είναι υποχρεωτικό.");
      } else if (input.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
        msg = T("ΜΗΝΥΜΑ_EMAIL", "Συμπληρώστε ένα έγκυρο email.");
      }
      setError(input, msg);
      if (msg) ok = false;
    });
    return ok;
  }

  function clearErrors(form) {
    $$(".has-error", form).forEach(function (el) { el.classList.remove("has-error"); });
    $$(".field-error", form).forEach(function (el) { el.textContent = ""; });
  }

  function busy(btn, on, label) {
    if (!btn) return;
    if (on) {
      btn.dataset.label = btn.textContent;
      btn.disabled = true;
      btn.textContent = label || T("ΜΗΝΥΜΑ_ΑΠΟΣΤΟΛΗ", "Αποστολή…");
    } else {
      btn.disabled = false;
      if (btn.dataset.label) btn.textContent = btn.dataset.label;
    }
  }

  function formMessage(form, msg, ok) {
    var slot = $("[data-msg]", form);
    if (!slot) return;
    slot.textContent = msg || "";
    slot.hidden = !msg;
    slot.classList.toggle("is-ok", !!ok);
  }

  function successPanel(form, text) {
    var panel = form.parentElement.querySelector("[data-success]") ||
                form.parentElement.querySelector("[data-form-success]");
    var success = panel || form.nextElementSibling;
    if (!success || !success.hasAttribute("data-success")) return null;
    form.hidden = true;
    success.hidden = false;
    var target = success.querySelector("[data-success-text]");
    if (target) target.textContent = text;
    return success;
  }

  /* ---------- download modal ---------- */
  var modal = $("#download-modal");
  var lastTrigger = null;

  function openDownload(btn) {
    if (!modal) return;
    lastTrigger = btn;
    var app = btn.getAttribute("data-app") || "την εφαρμογή";
    var version = btn.getAttribute("data-version") || "";
    var url = btn.getAttribute("data-url") || "";
    var file = btn.getAttribute("data-file") || "";
    $("#dl-title").textContent = T("ΛΗΨΗ_MODAL_TITLE", "Λήψη: {app}").replace("{app}", app);
    var verPart = version
      ? T("ΛΗΨΗ_ΜΕ_ΕΚΔΟΣΗ", " για την έκδοση {version}").replace("{version}", version)
      : "";
    $("[data-dl-lead]").textContent = T("ΛΗΨΗ_MODAL_LEAD",
      "Συμπληρώστε τα στοιχεία σας και θα λάβετε τον σύνδεσμο λήψης{version_part} στο email σας.")
      .replace("{version_part}", verPart);
    var form = $('[data-form="download"]', modal);
    form.reset();
    clearErrors(form);
    form.hidden = false;
    formMessage(form, "");
    var okPanel = $("[data-success]", modal);
    if (okPanel) okPanel.hidden = true;
    form.elements.app.value = app;
    form.elements.version.value = version;
    form.elements.file.value = file;
    form.elements.download_url.value = url;
    $$("[data-demo-note]", modal).forEach(function (n) { n.hidden = isLive("download"); });
    modal.showModal();
    document.body.style.overflow = "hidden";
    var first = form.querySelector("input[name=name]");
    if (first) setTimeout(function () { first.focus(); }, 60);
  }

  $$("[data-download]").forEach(function (btn) {
    btn.addEventListener("click", function () { openDownload(btn); });
  });

  if (modal) {
    var closeModal = function () {
      modal.close();
      document.body.style.overflow = "";
      if (lastTrigger) lastTrigger.focus();
    };
    $$("[data-modal-close]", modal).forEach(function (b) { b.addEventListener("click", closeModal); });
    modal.addEventListener("click", function (e) { if (e.target === modal) closeModal(); });
    modal.addEventListener("close", function () { document.body.style.overflow = ""; });

    var dlForm = $('[data-form="download"]', modal);
    dlForm.addEventListener("submit", function (ev) {
      ev.preventDefault();
      clearErrors(dlForm);
      if (dlForm.elements.company.value) return;              // honeypot
      if (!validate(dlForm)) { formMessage(dlForm, T("ΜΗΝΥΜΑ_ΕΛΕΓΧΟΣ", "Ελέγξτε τα πεδία που σημειώνονται.")); return; }
      var submit = $("[data-submit]", dlForm);
      busy(submit, true);
      var data = new FormData(dlForm);
      var params = {
        to_name: String(data.get("name") || "").trim(),
        to_email: String(data.get("email") || "").trim(),
        reply_to: EMAIL.reply_to || CFG.email.reply_to || "info@12358soft.com",
        app_name: String(data.get("app") || ""),
        app_version: String(data.get("version") || ""),
        file_name: String(data.get("file") || ""),
        download_url: String(data.get("download_url") || ""),
        role: String(data.get("role") || ""),
        form_type: "download",
        site: CFG.domain || "12358soft.com",
        submitted_at: new Date().toISOString()
      };
      deliver("download", params).then(function (res) {
        busy(submit, false);
        var panel = successPanel(dlForm, "");
        var msg = T("ΜΗΝΥΜΑ_ΛΗΨΗ_ΣΤΑΛΘΗΚΕ", "Στείλαμε τον σύνδεσμο λήψης για το {app} στο {email}.")
          .replace("{app}", params.app_name).replace("{email}", params.to_email);
        if (panel) {
          var t = panel.querySelector("[data-success-text]");
          if (t) t.textContent = msg;
          var link = panel.querySelector("[data-success-link]");
          $$("[data-demo-note]", panel).forEach(function (n) { n.hidden = !res.demo; });
          if (link) {
            if (res.demo && params.download_url) {
              link.href = params.download_url;
              link.hidden = false;
            } else {
              link.hidden = true;
            }
          }
        }
      }).catch(function (err) {
        busy(submit, false);
        formMessage(dlForm, T("ΜΗΝΥΜΑ_ΣΦΑΛΜΑ_EMAIL", "Κάτι πήγε στραβά. Δοκιμάστε ξανά ή γράψτε μας στο info@12358soft.com."));
        console.error(err);
      });
    });
  }

  /* ---------- contact + newsletter ---------- */
  $$('form[data-form="contact"]').forEach(function (form) {
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      clearErrors(form);
      if (form.elements.company && form.elements.company.value) return;
      if (!validate(form)) { formMessage(form, T("ΜΗΝΥΜΑ_ΕΛΕΓΧΟΣ", "Ελέγξτε τα πεδία που σημειώνονται.")); return; }
      var submit = $("[data-submit]", form);
      busy(submit, true);
      var data = new FormData(form);
      var params = {
        to_name: String(data.get("name") || ""),
        to_email: String(data.get("email") || ""),
        reply_to: String(data.get("email") || ""),
        phone: String(data.get("phone") || ""),
        subject: String(data.get("subject") || ""),
        message: String(data.get("message") || ""),
        form_type: "contact",
        site: CFG.domain || "12358soft.com",
        submitted_at: new Date().toISOString()
      };
      deliver("contact", params).then(function (res) {
        busy(submit, false);
        var panel = successPanel(form, "");
        if (panel) {
          var t = panel.querySelector("[data-success-text]");
          if (t) t.textContent = T("ΜΗΝΥΜΑ_ΕΥΧΑΡΙΣΤΩ", "Ευχαριστούμε! Θα απαντήσουμε στο {email} το συντομότερο.").replace("{email}", params.to_email);
          $$("[data-demo-note]", panel).forEach(function (n) { n.hidden = !res.demo; });
        }
      }).catch(function (err) {
        busy(submit, false);
        formMessage(form, T("ΜΗΝΥΜΑ_ΣΦΑΛΜΑ_ΤΗΛ", "Κάτι πήγε στραβά. Δοκιμάστε ξανά ή καλέστε στο 212 105 0767."));
        console.error(err);
      });
    });
  });

  $$('form[data-form="newsletter"]').forEach(function (form) {
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var input = form.querySelector("input[type=email]");
      if (!input.value || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(input.value)) {
        formMessage(form, "Συμπληρώστε ένα έγκυρο email.");
        return;
      }
      var submit = form.querySelector("button");
      busy(submit, true);
      deliver("newsletter", {
        to_email: input.value, reply_to: input.value,
        site: CFG.domain || "12358soft.com", submitted_at: new Date().toISOString()
      }).then(function (res) {
        busy(submit, false);
        formMessage(form, res.demo ? T("ΜΗΝΥΜΑ_ΕΓΓΡΑΦΗ_DEMO", "Εγγραφή (demo). Δεν στάλθηκε email.") : T("ΜΗΝΥΜΑ_ΕΓΓΡΑΦΗ_ΟΚ", "Εγγραφήκατε. Ευχαριστούμε!"), true);
        input.value = "";
      }).catch(function () {
        busy(submit, false);
        formMessage(form, "Δεν ολοκληρώθηκε η εγγραφή. Δοκιμάστε ξανά.");
      });
    });
  });

  /* ---------- filters ---------- */
  function applyFilter(bar, cat) {
    var grid = bar.parentElement.querySelector('[data-blog-grid]') ||
               bar.parentElement.querySelector(".grid") ||
               document.querySelector('[data-blog-grid]') ||
               document.querySelector(".grid");
    if (!grid) return;
    var cards = $$("[data-cat]", grid);
    var shown = 0;
    cards.forEach(function (card) {
      var match = cat === "*" || card.getAttribute("data-cat") === cat;
      card.hidden = !match;
      if (match) shown++;
    });
    var empty = document.querySelector("[data-blog-empty]");
    if (empty) empty.hidden = shown > 0;
  }

  $$("[data-filter]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var bar = btn.parentElement;
      $$("[data-filter]", bar).forEach(function (b) { b.classList.toggle("is-active", b === btn); });
      applyFilter(bar, btn.getAttribute("data-filter"));
    });
  });

  var blogSearch = $("[data-blog-search]");
  if (blogSearch) {
    blogSearch.addEventListener("input", function () {
      var q = blogSearch.value.trim().toLowerCase();
      var cards = $$("[data-search]");
      var shown = 0;
      cards.forEach(function (card) {
        var match = !q || card.getAttribute("data-search").indexOf(q) !== -1;
        card.hidden = !match;
        if (match) shown++;
      });
      var empty = document.querySelector("[data-blog-empty]");
      if (empty) empty.hidden = shown > 0;
    });
  }

  /* ---------- sticky buy ---------- */
  var buyActions = $(".buy-actions");
  var sticky = $("[data-sticky-buy]");
  if (buyActions && sticky && "IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var show = !entry.isIntersecting && window.scrollY > 300;
        sticky.classList.toggle("is-visible", show);
        document.body.classList.toggle("sticky-active", show);
      });
    }, { threshold: 0 }).observe(buyActions);
  }

  /* ---------- TOC scrollspy ---------- */
  var tocLinks = $$(".toc a");
  if (tocLinks.length && "IntersectionObserver" in window) {
    var targets = tocLinks.map(function (a) { return document.getElementById(a.getAttribute("href").slice(1)); }).filter(Boolean);
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        tocLinks.forEach(function (a) {
          a.classList.toggle("is-active", a.getAttribute("href") === "#" + entry.target.id);
        });
      });
    }, { rootMargin: "-100px 0px -70% 0px" });
    targets.forEach(function (t) { spy.observe(t); });
  }

  /* ---------- cookies ---------- */
  var CONSENT_KEY = "cookie_consent";
  var banner = $("#cookie-banner");

  function readConsent() {
    try { return JSON.parse(localStorage.getItem(CONSENT_KEY) || "null"); } catch (e) { return null; }
  }

  function loadAnalytics() {
    if (!CFG.gtm) return;
    if (window.__gtmLoaded) return;
    window.__gtmLoaded = true;
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ "gtm.start": new Date().getTime(), event: "gtm.js" });
    var s = document.createElement("script");
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtm.js?id=" + encodeURIComponent(CFG.gtm);
    document.head.appendChild(s);
  }

  function saveConsent(analytics) {
    var value = { v: 1, necessary: true, analytics: !!analytics, ts: new Date().toISOString() };
    try { localStorage.setItem(CONSENT_KEY, JSON.stringify(value)); } catch (e) {}
    if (banner) banner.hidden = true;
    if (analytics) loadAnalytics();
  }

  var consent = readConsent();
  if (!consent && banner) {
    setTimeout(function () { banner.hidden = false; }, 1200);
  } else if (consent && consent.analytics) {
    loadAnalytics();
  }
  $$("[data-cookie]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      saveConsent(btn.getAttribute("data-cookie") === "all");
      showToast(btn.getAttribute("data-cookie") === "all"
        ? T("ΜΗΝΥΜΑ_COOKIE_ΟΛΑ", "Ευχαριστούμε για τη συγκατάθεση.")
        : T("ΜΗΝΥΜΑ_COOKIE_ΜΟΝΟ", "Μόνο τα απαραίτητα cookies."));
    });
  });

  /* ---------- οριζόντιος κατάλογος προϊόντων (βέλη) ---------- */
  $$("[data-scroll]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var box = document.getElementById(btn.getAttribute("data-scroll"));
      if (!box) return;
      var card = box.firstElementChild;
      var step = card ? card.getBoundingClientRect().width + 18 : 340;
      box.scrollBy({ left: step * Number(btn.getAttribute("data-dir") || 1), behavior: "smooth" });
    });
  });

  /* ---------- external links ---------- */
  $$('a[href^="http"]').forEach(function (a) {
    if (a.hostname && a.hostname !== location.hostname && !a.getAttribute("rel")) {
      a.setAttribute("rel", "noopener");
    }
  });
})();
