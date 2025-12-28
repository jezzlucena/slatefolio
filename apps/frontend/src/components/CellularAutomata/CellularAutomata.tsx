'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import styles from './CellularAutomata.module.scss';
import useWindowScroll from '../../hooks/useWindowScroll';
import useTabActive from '../../hooks/useTabActive';

const CELL_SIZE = 8;

/**
 * Elementary Cellular Automata (Rule 110 / Rule 30 hybrid)
 * Creates beautiful cascading patterns from top to bottom
 */
export default function CellularAutomata() {
  const { scrollY } = useWindowScroll();
  const isTabActive = useTabActive();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const rowsRef = useRef<boolean[][]>([]);
  const lastUpdateRef = useRef<number>(0);
  const ruleRef = useRef<number>(110); // Famous Rule 110
  const [mousePos, setMousePos] = useState({ x: -1, y: -1 });
  const [isHovering, setIsHovering] = useState(false);

  // Get the next cell state based on elementary CA rules
  const getNextState = useCallback((left: boolean, center: boolean, right: boolean, rule: number) => {
    const pattern = (left ? 4 : 0) + (center ? 2 : 0) + (right ? 1 : 0);
    return ((rule >> pattern) & 1) === 1;
  }, []);

  // Generate next row based on previous row
  const generateNextRow = useCallback((prevRow: boolean[], rule: number): boolean[] => {
    const cols = prevRow.length;
    const nextRow: boolean[] = [];
    
    for (let i = 0; i < cols; i++) {
      const left = prevRow[(i - 1 + cols) % cols];
      const center = prevRow[i];
      const right = prevRow[(i + 1) % cols];
      nextRow.push(getNextState(left, center, right, rule));
    }
    
    return nextRow;
  }, [getNextState]);

  // Initialize with random seed row
  const initializeGrid = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const cols = Math.ceil(canvas.width / CELL_SIZE);
    const maxRows = Math.ceil(canvas.height / CELL_SIZE) + 1;

    // Create initial row with sparse random seeds
    const firstRow: boolean[] = [];
    for (let i = 0; i < cols; i++) {
      // Sparse seeding - only ~15% chance of being alive
      firstRow.push(Math.random() < 0.15);
    }

    // Pre-generate all rows
    const rows: boolean[][] = [firstRow];
    for (let r = 1; r < maxRows; r++) {
      rows.push(generateNextRow(rows[r - 1], ruleRef.current));
    }

    rowsRef.current = rows;
  }, [generateNextRow]);

  // Render to canvas
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const rows = rowsRef.current;
    if (!canvas || !ctx || !rows.length) return;

    const cols = rows[0].length;

    // Clear canvas
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw cells
    for (let y = 0; y < rows.length; y++) {
      const row = rows[y];
      for (let x = 0; x < cols; x++) {
        if (!row[x]) continue;

        const px = x * CELL_SIZE;
        const py = y * CELL_SIZE;

        // Calculate hover glow effect
        let brightness = 255;
        let glowRadius = 0;
        
        if (isHovering && mousePos.x >= 0) {
          const cellCenterX = px + CELL_SIZE / 2;
          const cellCenterY = py + CELL_SIZE / 2;
          const dist = Math.sqrt(
            (cellCenterX - mousePos.x) ** 2 + 
            (cellCenterY - mousePos.y) ** 2
          );
          const hoverInfluence = Math.max(0, 1 - dist / 120);
          glowRadius = hoverInfluence * 4;
          brightness = Math.floor(200 + hoverInfluence * 55);
        }

        // Draw glow if hovering near
        if (glowRadius > 0) {
          ctx.shadowColor = `rgba(255, 255, 255, 0.6)`;
          ctx.shadowBlur = glowRadius;
        } else {
          ctx.shadowBlur = 0;
        }

        // Draw cell as a crisp square
        ctx.fillStyle = `rgb(${brightness}, ${brightness}, ${brightness})`;
        const gap = 1;
        ctx.fillRect(px + gap, py + gap, CELL_SIZE - gap * 2, CELL_SIZE - gap * 2);
      }
    }
    
    // Reset shadow
    ctx.shadowBlur = 0;
  }, [isHovering, mousePos]);

  // Scroll the pattern and generate new rows
  const updateGrid = useCallback(() => {
    const rows = rowsRef.current;
    const canvas = canvasRef.current;
    if (!rows.length || !canvas) return;

    const maxRows = Math.ceil(canvas.height / CELL_SIZE) + 1;

    // Remove first row and add new row at bottom
    rows.shift();
    const lastRow = rows[rows.length - 1];
    rows.push(generateNextRow(lastRow, ruleRef.current));

    // Ensure we don't exceed max rows
    while (rows.length > maxRows) {
      rows.shift();
    }
  }, [generateNextRow]);

  // Animation loop
  useEffect(() => {
    if (!isTabActive || scrollY > window.innerHeight) {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      return;
    }

    const animate = (timestamp: number) => {
      // Update every 80ms for smooth scrolling effect
      if (timestamp - lastUpdateRef.current > 80) {
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
      initializeGrid();
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [initializeGrid]);

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

  // Click to change rule and reset
  const handleClick = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Get click position
    const rect = canvas.getBoundingClientRect();
    const clickX = (e.clientX - rect.left) * (canvas.width / rect.width);
    const clickY = (e.clientY - rect.top) * (canvas.height / rect.height);
    
    // Inject new cells at click position
    const rows = rowsRef.current;
    if (!rows.length) return;

    const col = Math.floor(clickX / CELL_SIZE);
    const row = Math.floor(clickY / CELL_SIZE);
    
    // Create a burst of new cells
    const radius = 5;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > radius) continue;
        
        const r = row + dy;
        const c = (col + dx + rows[0].length) % rows[0].length;
        
        if (r >= 0 && r < rows.length) {
          // Higher chance of activation near center of burst
          if (Math.random() < (1 - dist / radius) * 0.8) {
            rows[r][c] = true;
          }
        }
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
