'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import styles from './SacredGeometry.module.scss';
import useWindowScroll from '../../hooks/useWindowScroll';
import useTabActive from '../../hooks/useTabActive';

interface Point {
  x: number;
  y: number;
}

interface Circle {
  cx: number;
  cy: number;
  r: number;
  layer: number;
}

interface Line {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * Minimalistic sacred geometry pattern - Seed of Life with Metatron's Cube
 * Only 7 circles (1 center + 6 surrounding) plus connecting lines
 */
export default function SacredGeometry() {
  const { scrollY } = useWindowScroll();
  const isTabActive = useTabActive();
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const animationRef = useRef<number | null>(null);
  const [mousePos, setMousePos] = useState<Point>({ x: 50, y: 50 });
  const [isHovering, setIsHovering] = useState(false);
  const [rainbowIntensity, setRainbowIntensity] = useState(0);
  const [clickPos, setClickPos] = useState<Point>({ x: 50, y: 50 });
  const rainbowFadeRef = useRef<number | null>(null);

  // Generate Seed of Life - just 7 circles
  const circles: Circle[] = (() => {
    const result: Circle[] = [];
    const cx = 50;
    const cy = 50;
    const r = 12;

    // Center circle
    result.push({ cx, cy, r, layer: 0 });

    // 6 surrounding circles
    for (let i = 0; i < 6; i++) {
      const angle = (i * 60 - 30) * (Math.PI / 180);
      result.push({
        cx: cx + r * Math.cos(angle),
        cy: cy + r * Math.sin(angle),
        r,
        layer: 1,
      });
    }

    return result;
  })();

  // Generate Metatron's Cube lines - connecting all circle centers
  const lines: Line[] = (() => {
    const result: Line[] = [];
    
    // Connect each outer circle to center
    for (let i = 1; i < circles.length; i++) {
      result.push({
        x1: circles[0].cx,
        y1: circles[0].cy,
        x2: circles[i].cx,
        y2: circles[i].cy,
      });
    }

    // Connect outer circles to each other (hexagram)
    for (let i = 1; i < circles.length; i++) {
      const next = i === circles.length - 1 ? 1 : i + 1;
      result.push({
        x1: circles[i].cx,
        y1: circles[i].cy,
        x2: circles[next].cx,
        y2: circles[next].cy,
      });
    }

    // Connect opposite circles through center (Star of David)
    for (let i = 1; i <= 3; i++) {
      const opposite = i + 3;
      result.push({
        x1: circles[i].cx,
        y1: circles[i].cy,
        x2: circles[opposite].cx,
        y2: circles[opposite].cy,
      });
    }

    return result;
  })();

  // Handle mouse move
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setMousePos({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    });
  }, []);

  // Handle click - trigger rainbow effect
  const handleClick = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    setClickPos({ x, y });

    if (rainbowFadeRef.current) {
      cancelAnimationFrame(rainbowFadeRef.current);
    }

    let startTime: number | null = null;
    const fadeDuration = 400;
    const holdDuration = 1500;
    const totalDuration = fadeDuration * 2 + holdDuration;

    const animateFade = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;

      let intensity: number;
      if (elapsed < fadeDuration) {
        intensity = elapsed / fadeDuration;
      } else if (elapsed < fadeDuration + holdDuration) {
        intensity = 1;
      } else if (elapsed < totalDuration) {
        intensity = 1 - (elapsed - fadeDuration - holdDuration) / fadeDuration;
      } else {
        setRainbowIntensity(0);
        return;
      }

      setRainbowIntensity(intensity);
      rainbowFadeRef.current = requestAnimationFrame(animateFade);
    };

    rainbowFadeRef.current = requestAnimationFrame(animateFade);
  }, []);

  // Animation loop - slow rotation
  useEffect(() => {
    if (!isTabActive || scrollY > window.innerHeight) {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      return;
    }

    let startTime: number | null = null;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;

      if (svgRef.current) {
        const rotation = (elapsed * 0.003) % 360;
        svgRef.current.style.setProperty('--rotation', `${rotation}deg`);
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isTabActive, scrollY]);

  // Distance calculations
  const getDistance = (x1: number, y1: number, x2: number, y2: number) => 
    Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);

  const getHoverIntensity = (cx: number, cy: number) => 
    isHovering ? Math.max(0, 1 - getDistance(cx, cy, mousePos.x, mousePos.y) / 25) : 0;

  const getRainbowIntensity = (cx: number, cy: number) => {
    if (rainbowIntensity === 0) return 0;
    const dist = getDistance(cx, cy, clickPos.x, clickPos.y);
    // Larger radius (50) for more pronounced effect, with a smoother falloff
    const falloff = Math.max(0, 1 - (dist / 50) ** 0.7);
    return falloff * rainbowIntensity;
  };

  return (
    <Link href="/">
      <div
        ref={containerRef}
        className={styles.container}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        onClick={handleClick}
      >
        <svg
          ref={svgRef}
          className={styles.svg}
          viewBox="0 0 100 100"
          preserveAspectRatio="xMidYMid slice"
        >
          <g className={styles.patternGroup}>
            {/* Metatron's Cube lines */}
            {lines.map((line, i) => {
              const midX = (line.x1 + line.x2) / 2;
              const midY = (line.y1 + line.y2) / 2;
              const hover = getHoverIntensity(midX, midY);
              const rainbow = getRainbowIntensity(midX, midY);

              return (
                <line
                  key={`line-${i}`}
                  x1={line.x1}
                  y1={line.y1}
                  x2={line.x2}
                  y2={line.y2}
                  className={styles.line}
                  style={{
                    '--hover': hover,
                    '--rainbow': rainbow,
                    '--hue': (i * 30) % 360,
                  } as React.CSSProperties}
                />
              );
            })}

            {/* Seed of Life circles */}
            {circles.map((circle, i) => {
              const hover = getHoverIntensity(circle.cx, circle.cy);
              const rainbow = getRainbowIntensity(circle.cx, circle.cy);

              return (
                <circle
                  key={`circle-${i}`}
                  cx={circle.cx}
                  cy={circle.cy}
                  r={circle.r}
                  className={`${styles.circle} ${circle.layer === 0 ? styles.center : ''}`}
                  style={{
                    '--hover': hover,
                    '--rainbow': rainbow,
                    '--hue': (i * 51) % 360,
                  } as React.CSSProperties}
                />
              );
            })}
          </g>

          {/* Center dot */}
          <circle cx="50" cy="50" r="1.5" className={styles.centerDot} />
        </svg>
      </div>
    </Link>
  );
}
