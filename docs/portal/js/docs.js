(function () {
  const searchInput = document.getElementById('doc-search');
  const navLinks = document.querySelectorAll('.doc-nav-links a');
  const sections = document.querySelectorAll('.doc-section');
  const searchEmpty = document.getElementById('search-empty');
  const menuToggle = document.getElementById('menu-toggle');
  const sidebar = document.getElementById('sidebar');

  function normalize(text) {
    return text.toLowerCase().replace(/\s+/g, ' ').trim();
  }

  function highlightActive() {
    let current = '';
    const scrollY = window.scrollY + 100;
    sections.forEach((section) => {
      if (section.offsetTop <= scrollY) {
        current = section.getAttribute('id') || '';
      }
    });
    navLinks.forEach((link) => {
      link.classList.toggle('active', link.getAttribute('href') === `#${current}`);
    });
  }

  function runSearch() {
    const q = normalize(searchInput?.value || '');
    let visibleCount = 0;

    sections.forEach((section) => {
      const text = normalize(section.textContent || '');
      const match = !q || text.includes(q);
      section.classList.toggle('hidden', !match);
      if (match) visibleCount += 1;
    });

    navLinks.forEach((link) => {
      const id = (link.getAttribute('href') || '').slice(1);
      const section = document.getElementById(id);
      const text = normalize((link.textContent || '') + (section?.textContent || ''));
      const match = !q || text.includes(q);
      link.classList.toggle('hidden', !match);
    });

    if (searchEmpty) {
      searchEmpty.classList.toggle('visible', q.length > 0 && visibleCount === 0);
    }
  }

  searchInput?.addEventListener('input', runSearch);

  menuToggle?.addEventListener('click', () => {
    sidebar?.classList.toggle('open');
  });

  navLinks.forEach((link) => {
    link.addEventListener('click', () => {
      sidebar?.classList.remove('open');
    });
  });

  document.querySelectorAll('.doc-nav-group-title').forEach((btn) => {
    btn.addEventListener('click', () => {
      const links = btn.nextElementSibling;
      if (links) {
        links.style.display = links.style.display === 'none' ? '' : 'none';
      }
    });
  });

  window.addEventListener('scroll', highlightActive, { passive: true });
  highlightActive();
})();
