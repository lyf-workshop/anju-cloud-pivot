(() => {
  const header = document.querySelector(".site-header");
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.querySelector("#site-nav");
  if (!nav) return;

  const groups = [...nav.querySelectorAll(".nav-group")];
  const desktop = window.matchMedia("(min-width: 1081px)");

  const setNavOpen = (open) => {
    nav.classList.toggle("is-open", open);
    if (!toggle) return;
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "关闭菜单" : "打开菜单");
  };

  const closeGroups = (except = null) => {
    groups.forEach((group) => {
      if (group !== except) group.open = false;
    });
  };

  const currentPage = location.pathname.split("/").pop() || "index.html";
  nav.querySelectorAll("a[href]").forEach((link) => {
    const target = new URL(link.getAttribute("href"), location.href);
    const targetPage = target.pathname.split("/").pop() || "index.html";
    const active = target.origin === location.origin && targetPage === currentPage;
    link.classList.toggle("is-active", active);
    if (active) {
      link.setAttribute("aria-current", "page");
      link.closest(".nav-group")?.classList.add("has-active");
    } else {
      link.removeAttribute("aria-current");
    }

    link.addEventListener("click", () => {
      closeGroups();
      setNavOpen(false);
    });
  });

  toggle?.addEventListener("click", () => {
    setNavOpen(!nav.classList.contains("is-open"));
  });

  groups.forEach((group) => {
    group.addEventListener("toggle", () => {
      if (group.open) closeGroups(group);
    });
  });

  document.addEventListener("pointerdown", (event) => {
    if (!nav.contains(event.target) && !toggle?.contains(event.target)) {
      closeGroups();
      if (!desktop.matches) setNavOpen(false);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    closeGroups();
    setNavOpen(false);
    toggle?.focus();
  });

  const onViewportChange = () => {
    if (desktop.matches) setNavOpen(false);
    closeGroups();
  };
  desktop.addEventListener?.("change", onViewportChange);

  const onScroll = () => header?.classList.toggle("is-scrolled", window.scrollY > 8);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
})();
