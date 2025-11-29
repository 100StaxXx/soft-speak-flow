import { useEffect, useState } from "react";

interface ScrollStar {
  id: number;
  x: number;
  y: number;
  driftX: number;
  startY: number;
}

export const ScrollStars = () => {
  const [stars, setStars] = useState<ScrollStar[]>([]);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [scrollVelocity, setScrollVelocity] = useState(0);

  useEffect(() => {
    let ticking = false;
    let lastTime = Date.now();

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY;
          const currentTime = Date.now();
          const timeDelta = currentTime - lastTime;

          // Calculate scroll velocity
          const velocity = Math.abs(currentScrollY - lastScrollY) / (timeDelta || 1);

          setScrollVelocity(velocity);

          // Only create stars if scrolling with significant velocity
          if (velocity > 0.5 && Math.random() > 0.7) {
            const newStar: ScrollStar = {
              id: Date.now() + Math.random(),
              x: Math.random() * window.innerWidth,
              y: currentScrollY + window.innerHeight,
              driftX: (Math.random() - 0.5) * 40,
              startY: currentScrollY + window.innerHeight,
            };

            setStars((prev) => [...prev.slice(-5), newStar]);

            // Remove star after animation completes
            setTimeout(() => {
              setStars((prev) => prev.filter((s) => s.id !== newStar.id));
            }, 2000);
          }

          setLastScrollY(currentScrollY);
          lastTime = currentTime;
          ticking = false;
        });

        ticking = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScrollY]);

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {stars.map((star) => (
        <div
          key={star.id}
          className="absolute w-1 h-1 rounded-full bg-white animate-drift-up"
          style={
            {
              left: star.x,
              top: star.startY,
              "--drift-x": `${star.driftX}px`,
              boxShadow: "0 0 4px 2px rgba(255, 255, 255, 0.6)",
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
};
