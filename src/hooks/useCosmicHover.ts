import { useState, useCallback, RefObject } from "react";

interface HoverState {
  isHovered: boolean;
  glowIntensity: number;
}

export const useCosmicHover = (ref?: RefObject<HTMLElement>) => {
  const [hoverState, setHoverState] = useState<HoverState>({
    isHovered: false,
    glowIntensity: 0,
  });

  const handleMouseEnter = useCallback(() => {
    setHoverState({ isHovered: true, glowIntensity: 1 });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHoverState({ isHovered: false, glowIntensity: 0 });
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLElement>) => {
    if (!ref?.current) return;

    const rect = ref.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Calculate distance from center (normalized 0-1)
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const distance = Math.sqrt(
      Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2)
    );
    const maxDistance = Math.sqrt(
      Math.pow(centerX, 2) + Math.pow(centerY, 2)
    );
    const normalizedDistance = Math.min(distance / maxDistance, 1);

    // Glow is stronger near the edges
    setHoverState((prev) => ({
      ...prev,
      glowIntensity: 0.3 + normalizedDistance * 0.7,
    }));
  }, [ref]);

  const cosmicHoverProps = {
    onMouseEnter: handleMouseEnter,
    onMouseLeave: handleMouseLeave,
    onMouseMove: handleMouseMove,
  };

  return {
    ...hoverState,
    cosmicHoverProps,
  };
};
