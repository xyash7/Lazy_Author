
import React, { useState, useRef, useEffect, useCallback } from 'react';
import ControlPanel from './components/ControlPanel';
import type { Stroke, Point } from './types';
import {
  PEN_SIZES,
  PEN_COLORS,
  DEFAULT_SCROLL_SPEED,
  DOT_GRID_SPACING,
  DOT_GRID_RADIUS,
  MAX_SCROLL_SPEED,
} from './constants';

const App: React.FC = () => {
  const [penSize, setPenSize] = useState<number>(PEN_SIZES[1].value);
  const [penColor, setPenColor] = useState<string>(PEN_COLORS[0].value);
  const [scrollSpeed, setScrollSpeed] = useState<number>(DEFAULT_SCROLL_SPEED);
  
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrollOffsetRef = useRef<number>(0);
  const animationFrameIdRef = useRef<number>(0);
  const currentStrokeRef = useRef<Stroke | null>(null);
  const cursorPositionRef = useRef<{ x: number; y: number } | null>(null);

  const getCanvasContext = useCallback(() => {
    const canvas = canvasRef.current;
    return canvas ? canvas.getContext('2d') : null;
  }, []);

  const draw = useCallback(() => {
    const ctx = getCanvasContext();
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;

    ctx.fillStyle = '#f7fafc';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#e2e8f0';
    const scrollOffset = scrollOffsetRef.current;
    const startX = -(scrollOffset % DOT_GRID_SPACING);
    for (let x = startX; x < canvas.width; x += DOT_GRID_SPACING) {
      for (let y = 0; y < canvas.height; y += DOT_GRID_SPACING) {
        ctx.beginPath();
        ctx.arc(x, y, DOT_GRID_RADIUS, 0, 2 * Math.PI);
        ctx.fill();
      }
    }
    
    ctx.save();
    ctx.translate(-scrollOffset, 0);

    const allStrokes = [...strokes];
    if (isDrawing && currentStrokeRef.current) {
        allStrokes.push(currentStrokeRef.current);
    }
    
    allStrokes.forEach(stroke => {
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.size;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      if (stroke.points.length > 0) {
          ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      }
      stroke.points.forEach(point => {
        ctx.lineTo(point.x, point.y);
      });
      ctx.stroke();
    });
    
    ctx.restore();
  }, [strokes, isDrawing, getCanvasContext]);


  const animationLoop = useCallback(() => {
    // Always apply the base scroll speed, regardless of drawing state.
    if (scrollSpeed > 0) {
      scrollOffsetRef.current += scrollSpeed;
    }

    // Additionally, apply edge-scrolling for more control, but only when drawing.
    if (isDrawing && cursorPositionRef.current && canvasRef.current) {
      const scrollZone = 100; // px from edge
      const maxEdgeSpeed = 15; // This is an additional speed boost/brake on top of base speed
      const effectiveEdgeSpeed = (scrollSpeed / MAX_SCROLL_SPEED) * maxEdgeSpeed;

      const { x: cursorX } = cursorPositionRef.current;
      const canvasWidth = canvasRef.current.clientWidth;

      if (cursorX > canvasWidth - scrollZone) {
        const delta = cursorX - (canvasWidth - scrollZone);
        const speedFactor = Math.min(delta / scrollZone, 1);
        scrollOffsetRef.current += effectiveEdgeSpeed * speedFactor;
      } else if (cursorX < scrollZone) {
        const delta = scrollZone - cursorX;
        const speedFactor = Math.min(delta / scrollZone, 1);
        scrollOffsetRef.current -= effectiveEdgeSpeed * speedFactor;
      }
    }
    
    draw();
    animationFrameIdRef.current = requestAnimationFrame(animationLoop);
  }, [scrollSpeed, draw, isDrawing]);
  
  useEffect(() => {
    animationFrameIdRef.current = requestAnimationFrame(animationLoop);
    return () => {
      cancelAnimationFrame(animationFrameIdRef.current);
    };
  }, [animationLoop]);

  const handleResize = useCallback(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr);
      }
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      draw();
    }
  }, [draw]);

  useEffect(() => {
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [handleResize]);
  
  const getCoordsFromEvent = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent): { clientX: number, clientY: number } | null => {
    if ('clientX' in e) {
      return { clientX: e.clientX, clientY: e.clientY };
    }
    if ('touches' in e && e.touches.length > 0) {
      return { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY };
    }
    return null;
  };

  const getPointFromEvent = useCallback((e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent): Point | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    
    const coords = getCoordsFromEvent(e);
    if (!coords) return null;

    const rect = canvas.getBoundingClientRect();
    const x = (coords.clientX - rect.left) + scrollOffsetRef.current;
    const y = coords.clientY - rect.top;
    
    return { x, y };
  }, []);

  const startDrawing = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const point = getPointFromEvent(e);
    if (!point) return;

    const coords = getCoordsFromEvent(e);
    if (coords) {
        cursorPositionRef.current = { x: coords.clientX, y: coords.clientY };
    }
    
    setIsDrawing(true);

    const newStroke: Stroke = {
        points: [point],
        color: penColor,
        size: penSize
    };
    currentStrokeRef.current = newStroke;
  }, [penColor, penSize, getPointFromEvent]);

  const continueDrawing = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();

    const coords = getCoordsFromEvent(e);
    if (coords) {
        cursorPositionRef.current = { x: coords.clientX, y: coords.clientY };
    }

    const point = getPointFromEvent(e);
    if (point && currentStrokeRef.current) {
        currentStrokeRef.current.points.push(point);
    }
  }, [isDrawing, getPointFromEvent]);
  
  const stopDrawing = useCallback(() => {
    if (!isDrawing) return;

    const strokeToAdd = currentStrokeRef.current;
    
    if (strokeToAdd && strokeToAdd.points.length > 0) {
      setStrokes(prevStrokes => [...prevStrokes, strokeToAdd]);
    }
    
    currentStrokeRef.current = null;
    cursorPositionRef.current = null;
    setIsDrawing(false);
  }, [isDrawing]);
  
  useEffect(() => {
      const handleMove = (e: MouseEvent | TouchEvent) => continueDrawing(e);
      const handleUp = () => stopDrawing();
      
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('touchmove', handleMove, { passive: false });
      window.addEventListener('mouseup', handleUp);
      window.addEventListener('touchend', handleUp);
      
      return () => {
          window.removeEventListener('mousemove', handleMove);
          window.removeEventListener('touchmove', handleMove);
          window.removeEventListener('mouseup', handleUp);
          window.removeEventListener('touchend', handleUp);
      };
  }, [continueDrawing, stopDrawing]);


  const handleExport = useCallback(async () => {
    setIsExporting(true);
    await new Promise(resolve => setTimeout(resolve, 50));
    
    if (strokes.length === 0) {
      alert("Nothing to export!");
      setIsExporting(false);
      return;
    }

    let minX = Infinity;
    let maxX = -Infinity;
    strokes.forEach(stroke => {
        stroke.points.forEach(point => {
            if(point.x < minX) minX = point.x;
            if(point.x > maxX) maxX = point.x;
        });
    });

    const padding = 100;
    const exportWidth = (maxX - minX) + 2 * padding;
    const exportHeight = window.innerHeight;
    
    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = exportWidth;
    offscreenCanvas.height = exportHeight;
    const ctx = offscreenCanvas.getContext('2d');

    if (!ctx) {
      alert("Failed to create export canvas context.");
      setIsExporting(false);
      return;
    }

    ctx.fillStyle = '#f7fafc';
    ctx.fillRect(0, 0, exportWidth, exportHeight);

    ctx.fillStyle = '#e2e8f0';
    for (let x = 0; x < exportWidth; x += DOT_GRID_SPACING) {
      for (let y = 0; y < exportHeight; y += DOT_GRID_SPACING) {
        ctx.beginPath();
        ctx.arc(x, y, DOT_GRID_RADIUS, 0, 2 * Math.PI);
        ctx.fill();
      }
    }

    ctx.save();
    ctx.translate(-minX + padding, 0);
    
    strokes.forEach(stroke => {
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.size;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      if (stroke.points.length > 0) {
          ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      }
      stroke.points.forEach(point => {
        ctx.lineTo(point.x, point.y);
      });
      ctx.stroke();
    });
    ctx.restore();

    const dataUrl = offscreenCanvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = 'FlowScribe.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setIsExporting(false);
  }, [strokes]);


  return (
    <div className="w-screen h-screen bg-gray-900 overflow-hidden cursor-crosshair">
      <ControlPanel
        penSize={penSize}
        setPenSize={setPenSize}
        penColor={penColor}
        setPenColor={setPenColor}
        scrollSpeed={scrollSpeed}
        setScrollSpeed={setScrollSpeed}
        onExport={handleExport}
        isExporting={isExporting}
      />
      <canvas
        ref={canvasRef}
        onMouseDown={startDrawing}
        onTouchStart={startDrawing}
      />
    </div>
  );
};

export default App;
