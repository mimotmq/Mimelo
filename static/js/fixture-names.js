export function watchFixtureNames(root) {
  let frame;
  function refresh() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      for (const name of root.querySelectorAll("[data-scroll-name]")) {
        const text = name.querySelector(".fixture-name-text");
        const distance = Math.ceil(
          text.getBoundingClientRect().width - name.clientWidth,
        );
        const clipped = name.clientWidth > 0 && distance > 1;
        name.toggleAttribute("data-name-overflow", clipped);
        if (clipped) {
          name.style.setProperty("--name-scroll", `${-distance}px`);
          name.style.setProperty(
            "--name-duration",
            `${Math.max(4, distance / 20 + 3)}s`,
          );
        }
      }
    });
  }
  const observer = new ResizeObserver(refresh);
  observer.observe(root);
  root.addEventListener("toggle", refresh, true);
  let active = true;
  document.fonts?.ready.then(() => {
    if (active) refresh();
  });
  refresh();
  return {
    refresh,
    destroy() {
      active = false;
      observer.disconnect();
      root.removeEventListener("toggle", refresh, true);
      cancelAnimationFrame(frame);
    },
  };
}
