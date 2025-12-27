'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import styles from './HolyGeometry.module.scss';
import useWindowScroll from '../../hooks/useWindowScroll';
import useTabActive from '../../hooks/useTabActive';

interface Cell {
  cx: number;
  cy: number;
  state: number;
  ring: number;
}

// Constants
const CX = 50;
const CY = 50;
const CELL_RADIUS = 8;
const RING_RADIUS = 14;
const FRAME_TIME = 1000 / 60; // 60 FPS = ~16.67ms per frame
const CA_UPDATE_INTERVAL = 150; // Cellular automata update every 150ms

// Pre-computed neighbor indices for all 19 cells
const NEIGHBOR_MAP: number[][] = [
  [1, 2, 3, 4, 5, 6], // Cell 0 (center)
  [0, 6, 2, 7, 8],    // Cell 1
  [0, 1, 3, 8, 9],    // Cell 2
  [0, 2, 4, 9, 10],   // Cell 3
  [0, 3, 5, 10, 11],  // Cell 4
  [0, 4, 6, 11, 12],  // Cell 5
  [0, 5, 1, 12, 7],   // Cell 6
  [6, 8, 1, 18],      // Cell 7
  [7, 9, 1, 2],       // Cell 8
  [8, 10, 2, 3],      // Cell 9
  [9, 11, 3, 4],      // Cell 10
  [10, 12, 4, 5],     // Cell 11
  [11, 13, 5, 6],     // Cell 12
  [12, 14, 6],        // Cell 13
  [13, 15, 6, 7],     // Cell 14
  [14, 16, 7],        // Cell 15
  [15, 17, 7, 8],     // Cell 16
  [16, 18, 8],        // Cell 17
  [17, 7, 8, 9],      // Cell 18
];

// Generate hexagon path string
const createHexPath = (hcx: number, hcy: number, r: number): string => {
  const points: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    points.push(`${hcx + r * Math.cos(angle)},${hcy + r * Math.sin(angle)}`);
  }
  return `M${points.join('L')}Z`;
};

// Initialize cells once
const initializeCells = (): Cell[] => {
  const cells: Cell[] = [];
  
  // Center cell
  cells.push({ cx: CX, cy: CY, state: 1, ring: 0 });
  
  // Inner ring - 6 cells
  for (let i = 0; i < 6; i++) {
    const angle = (i * 60 - 30) * (Math.PI / 180);
    cells.push({
      cx: CX + RING_RADIUS * Math.cos(angle),
      cy: CY + RING_RADIUS * Math.sin(angle),
      state: i % 2 === 0 ? 0.8 : 0.2,
      ring: 1,
    });
  }
  
  // Outer ring - 12 cells
  for (let i = 0; i < 12; i++) {
    const angle = (i * 30 - 15) * (Math.PI / 180);
    cells.push({
      cx: CX + RING_RADIUS * 2 * Math.cos(angle),
      cy: CY + RING_RADIUS * 2 * Math.sin(angle),
      state: i % 3 === 0 ? 0.6 : 0.1,
      ring: 2,
    });
  }
  
  return cells;
};

// Pre-compute hex paths for all cells
const createHexPaths = (cells: Cell[]): string[] => {
  return cells.map(cell => {
    const size = CELL_RADIUS * (0.8 + cell.ring * 0.1);
    return createHexPath(cell.cx, cell.cy, size);
  });
};

/**
 * Minimalistic cellular automata with 19 hexagonal cells
 * Optimized for 60fps with pre-computed geometry
 */
export default function HolyGeometry() {
  const { scrollY } = useWindowScroll();
  const isTabActive = useTabActive();
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const cellRefs = useRef<(SVGPathElement | null)[]>([]);
  const animationRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number>(0);
  const lastCAUpdateRef = useRef<number>(0);
  const cellsRef = useRef<Cell[]>(initializeCells());
  const mousePosRef = useRef({ x: 50, y: 50 });
  const isHoveringRef = useRef(false);

  // Pre-compute hex paths (static - never changes)
  const hexPaths = useMemo(() => createHexPaths(cellsRef.current), []);

  // Update cell DOM directly (avoid React re-renders)
  const updateCellDOM = useCallback((index: number, state: number, hover: number) => {
    const el = cellRefs.current[index];
    if (el) {
      el.style.setProperty('--state', state.toString());
      el.style.setProperty('--hover', hover.toString());
    }
  }, []);

  // Cellular automata step (mutates cellsRef directly)
  const updateCellularAutomata = useCallback((timestamp: number) => {
    const cells = cellsRef.current;
    const sinValue = Math.sin(timestamp * 0.002) * 0.05;
    
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      const neighbors = NEIGHBOR_MAP[i];
      let aliveCount = 0;
      let sumState = 0;
      
      for (let j = 0; j < neighbors.length; j++) {
        const n = cells[neighbors[j]];
        if (n) {
          sumState += n.state;
          if (n.state > 0.4) aliveCount++;
        }
      }
      
      const avgState = sumState / neighbors.length;
      let newState = cell.state;
      
      if (cell.state > 0.4) {
        // Alive - check survival
        if (aliveCount < 1 || aliveCount > 4) {
          newState = cell.state * 0.85;
        } else {
          newState = Math.min(1, cell.state + sinValue);
        }
      } else {
        // Dead - check birth
        if (aliveCount === 2 || aliveCount === 3) {
          newState = Math.min(avgState + 0.15, 0.9);
        } else if (avgState > 0.3) {
          newState = avgState * 0.6;
        }
      }
      
      cell.state = Math.max(0.05, Math.min(1, newState));
    }
  }, []);

  // Animation loop - 60fps limited
  useEffect(() => {
    if (!isTabActive || scrollY > window.innerHeight) {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      return;
    }

    const animate = (timestamp: number) => {
      // Limit to 60fps
      const elapsed = timestamp - lastFrameRef.current;
      if (elapsed < FRAME_TIME) {
        animationRef.current = requestAnimationFrame(animate);
        return;
      }
      lastFrameRef.current = timestamp - (elapsed % FRAME_TIME);

      // Update cellular automata at lower frequency
      if (timestamp - lastCAUpdateRef.current > CA_UPDATE_INTERVAL) {
        lastCAUpdateRef.current = timestamp;
        updateCellularAutomata(timestamp);
      }

      // Update rotation
      if (svgRef.current) {
        const rotation = (timestamp * 0.005) % 360;
        svgRef.current.style.setProperty('--rotation', `${rotation}deg`);
      }

      // Update cell visuals directly
      const cells = cellsRef.current;
      const mouseX = mousePosRef.current.x;
      const mouseY = mousePosRef.current.y;
      const hovering = isHoveringRef.current;

      for (let i = 0; i < cells.length; i++) {
        const cell = cells[i];
        let hover = 0;
        if (hovering) {
          const dx = cell.cx - mouseX;
          const dy = cell.cy - mouseY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          hover = Math.max(0, 1 - dist / 20);
        }
        updateCellDOM(i, cell.state, hover);
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isTabActive, scrollY, updateCellularAutomata, updateCellDOM]);

  // Mouse move handler - update ref only, no state
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    mousePosRef.current = {
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    };
  }, []);

  // Click to energize cells
  const handleClick = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * 100;
    const clickY = ((e.clientY - rect.top) / rect.height) * 100;

    const cells = cellsRef.current;
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      const dx = cell.cx - clickX;
      const dy = cell.cy - clickY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 25) {
        const boost = Math.max(0, 1 - dist / 25);
        cell.state = Math.min(1, cell.state + boost * 0.8);
      }
    }
  }, []);

  return (
    <Link href="/">
      <div
        ref={containerRef}
        className={styles.container}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => { isHoveringRef.current = true; }}
        onMouseLeave={() => { isHoveringRef.current = false; }}
        onClick={handleClick}
      >
        <svg
          ref={svgRef}
          className={styles.svg}
          viewBox="0 0 100 100"
          preserveAspectRatio="xMidYMid slice"
        >
          <g className={styles.patternGroup}>
            {hexPaths.map((path, i) => (
              <path
                key={i}
                ref={el => { cellRefs.current[i] = el; }}
                d={path}
                className={styles.cell}
                style={{
                  '--state': cellsRef.current[i].state,
                  '--hover': 0,
                  '--ring': cellsRef.current[i].ring,
                } as React.CSSProperties}
              />
            ))}
          </g>
          <circle cx={CX} cy={CY} r="2" className={styles.centerDot} />
        </svg>
      </div>
    </Link>
  );
}
