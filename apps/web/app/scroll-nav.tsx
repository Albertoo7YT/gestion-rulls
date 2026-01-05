"use client";

import { useEffect } from "react";

export default function ScrollNav() {
  useEffect(() => {
    let lastY = window.scrollY;
    let ticking = false;

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        const currentY = window.scrollY;
        const diff = currentY - lastY;
        const body = document.body;

        if (currentY <= 10) {
          body.classList.remove("nav-hidden");
        } else if (diff > 6) {
          body.classList.add("nav-hidden");
        } else if (diff < -6) {
          body.classList.remove("nav-hidden");
        }

        lastY = currentY;
        ticking = false;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return null;
}
