'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import styles from './CellularAutomata.module.scss';
import useWindowScroll from '../../hooks/useWindowScroll';
import useTabActive from '../../hooks/useTabActive';

interface Cell {
  state: number; // 0-1 continuous state
  nextState: number;
}

const COLS = 40;
const ROWS = 25;

/**
 * Organic cellular automata covering the viewport
 * Smooth Game of Life variant with continuous states
 */
export default function CellularAutomata() {
  const { scrollY } = useWindowScroll();
  const isTabActive = useTabActive();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const gridRef = useRef<Cell[][]>([]);
  const lastUpdateRef = useRef<number>(0);
  const [mousePos, setMousePos] = useState({ x: -1, y: -1 });
  const [isHovering, setIsHovering] = useState(false);

  // Initialize grid with random organic pattern
  useEffect(() => {
    const grid: Cell[][] = [];
    for (let y = 0; y < ROWS; y++) {
      grid[y] = [];
      for (let x = 0; x < COLS; x++) {
        // Create organic clusters
        const centerX = COLS / 2;
        const centerY = ROWS / 2;
        const dist = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
        const noise = Math.random();
        
        // Higher chance of life near center, creating organic blob
        const probability = Math.max(0, 0.4 - dist * 0.02) + noise * 0.2;
        const state = Math.random() < probability ? 0.5 + Math.random() * 0.5 : 0;
        
        grid[y][x] = { state, nextState: state };
      }
    }
    gridRef.current = grid;
  }, []);

  // Get cell neighbors with wrapping
  const getNeighborSum = useCallback((grid: Cell[][], x: number, y: number) => {
    let sum = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = (x + dx + COLS) % COLS;
        const ny = (y + dy + ROWS) % ROWS;
        sum += grid[ny][nx].state;
      }
    }
    return sum;
  }, []);

  // Smooth Game of Life rules
  const computeNextState = useCallback((state: number, neighborSum: number) => {
    // Continuous rules inspired by SmoothLife
    const birth = neighborSum > 2.2 && neighborSum < 3.5;
    const survive = neighborSum > 1.8 && neighborSum < 4.2;
    
    if (state > 0.5) {
      // Alive
      if (survive) {
        return Math.min(1, state + 0.05); // Grow stronger
      } else {
        return state * 0.85; // Fade
      }
    } else {
      // Dead
      if (birth) {
        return Math.min(0.8, state + 0.2); // Born
      } else if (neighborSum > 0.5) {
        return Math.min(0.3, state + neighborSum * 0.02); // Slight influence
      }
      return state * 0.95; // Decay
    }
  }, []);

  // Update simulation
  const updateGrid = useCallback(() => {
    const grid = gridRef.current;
    if (!grid.length) return;

    // Compute next states
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const neighborSum = getNeighborSum(grid, x, y);
        grid[y][x].nextState = computeNextState(grid[y][x].state, neighborSum);
      }
    }

    // Apply next states
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        grid[y][x].state = grid[y][x].nextState;
      }
    }
  }, [getNeighborSum, computeNextState]);

  // Render to canvas
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const grid = gridRef.current;
    if (!canvas || !ctx || !grid.length) return;

    const cellW = canvas.width / COLS;
    const cellH = canvas.height / ROWS;

    // Clear with fade effect for trails
    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw cells
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const cell = grid[y][x];
        if (cell.state < 0.05) continue;

        const px = x * cellW;
        const py = y * cellH;

        // Hover effect
        let hoverBoost = 0;
        if (isHovering && mousePos.x >= 0) {
          const dist = Math.sqrt(
            ((x + 0.5) * cellW - mousePos.x) ** 2 + 
            ((y + 0.5) * cellH - mousePos.y) ** 2
          );
          hoverBoost = Math.max(0, 1 - dist / 80) * 0.3;
        }

        const alpha = Math.min(1, cell.state + hoverBoost);
        const brightness = Math.floor(180 + cell.state * 75 + hoverBoost * 50);
        
        ctx.fillStyle = `rgba(${brightness}, ${brightness}, ${brightness}, ${alpha})`;
        
        // Organic rounded rectangles
        const padding = 1;
        const radius = Math.min(cellW, cellH) * 0.3;
        ctx.beginPath();
        ctx.roundRect(px + padding, py + padding, cellW - padding * 2, cellH - padding * 2, radius);
        ctx.fill();
      }
    }
  }, [isHovering, mousePos]);

  // Animation loop
  useEffect(() => {
    if (!isTabActive || scrollY > window.innerHeight) {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      return;
    }

    const animate = (timestamp: number) => {
      // Update simulation every 120ms
      if (timestamp - lastUpdateRef.current > 120) {
        lastUpdateRef.current = timestamp;
        updateGrid();
      }

      render();
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isTabActive, scrollY, updateGrid, render]);

  // Handle canvas resize
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Mouse handlers
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    setMousePos({
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    });
  }, []);

  // Click to seed life
  const handleClick = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    const grid = gridRef.current;
    if (!canvas || !grid.length) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = (e.clientX - rect.left) * (canvas.width / rect.width);
    const clickY = (e.clientY - rect.top) * (canvas.height / rect.height);

    const cellW = canvas.width / COLS;
    const cellH = canvas.height / ROWS;
    const centerCol = Math.floor(clickX / cellW);
    const centerRow = Math.floor(clickY / cellH);

    // Seed a cluster of life around click point
    const radius = 4;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > radius) continue;

        const x = (centerCol + dx + COLS) % COLS;
        const y = (centerRow + dy + ROWS) % ROWS;
        const boost = (1 - dist / radius) * 0.8;
        grid[y][x].state = Math.min(1, grid[y][x].state + boost);
      }
    }
  }, []);

  return (
    <Link href="/">
      <div
        ref={containerRef}
        className={styles.container}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => {
          setIsHovering(false);
          setMousePos({ x: -1, y: -1 });
        }}
        onClick={handleClick}
      >
        <canvas ref={canvasRef} className={styles.canvas} />
      </div>
    </Link>
  );
}


