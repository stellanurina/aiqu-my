document.addEventListener('DOMContentLoaded', function () {
  // 1. Track "Minta demo singkat" / Book Demo CTA clicks
  document.querySelectorAll('a[href$="/book-a-demo"]').forEach(function (button) {
    button.addEventListener('click', function () {
      gtag('event', 'click_book_demo_cta', {
        event_category: 'Lead Generation',
        event_label: button.innerText.trim(),
        page_location: window.location.pathname
      });
    });
  });

  // 2. Track "Unggah rekaman 48 jam" / Upload footage portal clicks
  document.querySelectorAll('a[href*="demo.aiqu.my/unggah"]').forEach(function (link) {
    link.addEventListener('click', function () {
      gtag('event', 'click_upload_footage', {
        event_category: 'Engagement',
        event_label: 'Upload Portal Link',
        page_location: window.location.pathname
      });
    });
  });

  // 3. Track Mailto Inquiries
  document.querySelectorAll('a[href^="mailto:"]').forEach(function (mailLink) {
    mailLink.addEventListener('click', function () {
      gtag('event', 'click_email_inquiry', {
        event_category: 'Contact',
        event_label: mailLink.getAttribute('href'),
        page_location: window.location.pathname
      });
    });
  });

  // 4. Track Language Switching (ID <-> EN)
  document.querySelectorAll('a.lng').forEach(function (langBtn) {
    langBtn.addEventListener('click', function () {
      gtag('event', 'switch_language', {
        target_language: langBtn.getAttribute('hreflang') || 'en',
        source_page: window.location.pathname
      });
    });
  });
});
