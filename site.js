// Mobile menu, scrollspy and contact form
document.addEventListener('DOMContentLoaded', function () {
    var toggle = document.getElementById('mobileToggle');
    var menu = document.getElementById('mobileMenu');
    var closeBtn = document.getElementById('mobileMenuClose');
    var navLinks = document.querySelectorAll('.nav-link');
    var menuLinks = document.querySelectorAll('.mobile-menu-link');

    function setMenu(open) {
        menu.classList.toggle('active', open);
        menu.setAttribute('aria-hidden', open ? 'false' : 'true');
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        document.body.style.overflow = open ? 'hidden' : '';
    }
    toggle.addEventListener('click', function () { setMenu(!menu.classList.contains('active')); });
    closeBtn.addEventListener('click', function () { setMenu(false); toggle.focus(); });
    menuLinks.forEach(function (l) { l.addEventListener('click', function () { setMenu(false); }); });
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && menu.classList.contains('active')) { setMenu(false); toggle.focus(); }
    });
    window.addEventListener('resize', function () {
        if (window.innerWidth > 1060 && menu.classList.contains('active')) setMenu(false);
    });

    // Highlight the link of the section being read
    var ids = ['about', 'projects', 'experience', 'skills', 'contact'];
    function mark(id) {
        [navLinks, menuLinks].forEach(function (list) {
            list.forEach(function (a) {
                var on = a.getAttribute('href') === '#' + id;
                a.classList.toggle('active', on);
                if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
            });
        });
    }
    if ('IntersectionObserver' in window) {
        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (en) { if (en.isIntersecting) mark(en.target.id); });
        }, { rootMargin: '-40% 0px -55% 0px' });
        ids.forEach(function (id) { var s = document.getElementById(id); if (s) io.observe(s); });
        window.addEventListener('scroll', function () {
            if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) mark('contact');
        }, { passive: true });
    }

    // Contact form: opens the visitor's email app with everything filled in
    var form = document.getElementById('contactForm');
    var note = document.getElementById('formNote');
    if (form) form.addEventListener('submit', function (e) {
        e.preventDefault();
        var d = new FormData(form);
        var body = 'From: ' + d.get('name') + ' <' + d.get('email') + '>\n\n' + d.get('message');
        window.location.href = 'mailto:fatimaq@iastate.edu?subject=' + encodeURIComponent(d.get('subject')) + '&body=' + encodeURIComponent(body);
        note.textContent = 'Opening your email app. If nothing opens, write to fatimaq@iastate.edu directly.';
    });
});