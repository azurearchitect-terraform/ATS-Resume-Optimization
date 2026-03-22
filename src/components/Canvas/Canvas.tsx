import React, { useRef, useState, useEffect } from 'react';
import { Stage, Layer, Text, Rect, Transformer, Line } from 'react-konva';
import { useResumeStore } from '../../store/useResumeStore';
import { CanvasElement } from '../../types/resume';
import { ZoomIn, ZoomOut, Maximize, Grid3X3, Trash2, Plus, Type } from 'lucide-react';
import { cn } from '../../lib/utils';

interface Guide {
  line: number;
  diff: number;
  snap: number;
  offset: number;
  orientation: 'V' | 'H';
}

const SNAP_THRESHOLD = 5;

const Element = ({ 
  element, 
  isSelected, 
  onSelect, 
  onChange, 
  onDblClick,
  onDragStart,
  onDragMove,
  onDragEnd
}: { 
  element: CanvasElement; 
  isSelected: boolean; 
  onSelect: (e: any) => void; 
  onChange: (updates: Partial<CanvasElement>) => void;
  onDblClick: () => void;
  onDragStart: (e: any) => void;
  onDragMove: (e: any) => void;
  onDragEnd: (e: any) => void;
}) => {
  const shapeRef = useRef<any>(null);
  const trRef = useRef<any>(null);

  useEffect(() => {
    if (isSelected && trRef.current) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer().batchDraw();
    }
  }, [isSelected]);

  const handleTransformEnd = (e: any) => {
    const node = shapeRef.current;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();

    node.scaleX(1);
    node.scaleY(1);
    
    onChange({
      x: node.x(),
      y: node.y(),
      width: Math.max(5, node.width() * scaleX),
      height: Math.max(5, node.height() * scaleY),
    });
  };

  const getTransformedText = (text: string, transform?: string) => {
    if (!transform || transform === 'none') return text;
    if (transform === 'uppercase') return text.toUpperCase();
    if (transform === 'lowercase') return text.toLowerCase();
    if (transform === 'capitalize') {
      return text.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
    }
    return text;
  };

  if (element.type === 'text') {
    const konvaStyle = {
      ...element.style,
      align: element.style.textAlign,
      fontStyle: `${element.style.fontStyle === 'italic' ? 'italic ' : ''}${
        element.style.fontWeight === 'bold' || element.style.fontWeight === 'semibold' || element.style.fontWeight === 'medium' ? 'bold' : 'normal'
      }`.trim()
    };

    return (
      <React.Fragment>
        <Text
          ref={shapeRef}
          id={element.id}
          text={getTransformedText(element.content, element.style.textTransform)}
          x={element.x}
          y={element.y}
          width={element.width}
          height={element.height}
          visible={element.isVisible !== false}
          draggable
          {...konvaStyle}
          onClick={(e) => onSelect(e)}
          onTap={(e) => onSelect(e)}
          onDragStart={onDragStart}
          onDragMove={onDragMove}
          onDragEnd={onDragEnd}
          onTransformEnd={handleTransformEnd}
          onDblClick={onDblClick}
          onDblTap={onDblClick}
        />
        {isSelected && (
          <Transformer
            ref={trRef}
            enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right', 'middle-left', 'middle-right']}
            boundBoxFunc={(oldBox, newBox) => {
              if (newBox.width < 5 || newBox.height < 5) {
                return oldBox;
              }
              return newBox;
            }}
          />
        )}
      </React.Fragment>
    );
  }

  if (element.type === 'shape') {
    return (
      <React.Fragment>
        <Rect
          ref={shapeRef}
          id={element.id}
          x={element.x}
          y={element.y}
          width={element.width}
          height={element.height}
          visible={element.isVisible !== false}
          fill={element.style.backgroundColor || '#ccc'}
          opacity={element.style.opacity ?? 1}
          cornerRadius={element.style.borderRadius ?? 0}
          draggable
          onClick={(e) => onSelect(e)}
          onTap={(e) => onSelect(e)}
          onDragStart={onDragStart}
          onDragMove={onDragMove}
          onDragEnd={onDragEnd}
          onTransformEnd={handleTransformEnd}
        />
        {isSelected && (
          <Transformer
            ref={trRef}
            boundBoxFunc={(oldBox, newBox) => {
              if (newBox.width < 5 || newBox.height < 5) {
                return oldBox;
              }
              return newBox;
            }}
          />
        )}
      </React.Fragment>
    );
  }

  return null;
};

export const Canvas = ({ stageRef: externalStageRef }: { stageRef?: React.RefObject<any> }) => {
  const { 
    elements, 
    selectedElementIds, 
    selectElement, 
    updateElement, 
    removeElement,
    addElement,
    zoom, 
    setZoom, 
    showGrid, 
    toggleGrid, 
    darkMode,
    isExporting,
    updateMultipleElements
  } = useResumeStore((state) => state);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempText, setTempText] = useState('');
  const [guides, setGuides] = useState<Guide[]>([]);
  const [dragStartPositions, setDragStartPositions] = useState<{ [id: string]: { x: number, y: number } }>({});
  const [selectionRect, setSelectionRect] = useState<{ x1: number, y1: number, x2: number, y2: number, isVisible: boolean }>({
    x1: 0, y1: 0, x2: 0, y2: 0, isVisible: false
  });
  const internalStageRef = useRef<any>(null);
  const stageRef = externalStageRef || internalStageRef;

  const handleSelect = (id: string | null, isMulti: boolean = false) => {
    selectElement(id, isMulti);
    if (id !== editingId) setEditingId(null);
  };

  const handleDblClick = (element: CanvasElement) => {
    if (element.type === 'text') {
      setEditingId(element.id);
      setTempText(element.content);
    }
  };

  const getGuides = (draggingId: string, draggingX: number, draggingY: number, draggingWidth: number, draggingHeight: number) => {
    const verticalGuides: Guide[] = [];
    const horizontalGuides: Guide[] = [];

    elements.forEach((el) => {
      if (el.id === draggingId) return;

      const elX = el.x;
      const elY = el.y;
      const elW = el.width;
      const elH = el.height;

      // Vertical guides
      [elX, elX + elW / 2, elX + elW].forEach((line) => {
        [draggingX, draggingX + draggingWidth / 2, draggingX + draggingWidth].forEach((snap) => {
          const diff = Math.abs(line - snap);
          if (diff < SNAP_THRESHOLD) {
            verticalGuides.push({ line, diff, snap, offset: line - snap, orientation: 'V' });
          }
        });
      });

      // Horizontal guides
      [elY, elY + elH / 2, elY + elH].forEach((line) => {
        [draggingY, draggingY + draggingHeight / 2, draggingY + draggingHeight].forEach((snap) => {
          const diff = Math.abs(line - snap);
          if (diff < SNAP_THRESHOLD) {
            horizontalGuides.push({ line, diff, snap, offset: line - snap, orientation: 'H' });
          }
        });
      });
    });

    const minV = verticalGuides.sort((a, b) => a.diff - b.diff)[0];
    const minH = horizontalGuides.sort((a, b) => a.diff - b.diff)[0];

    return [minV, minH].filter(Boolean) as Guide[];
  };

  const handleDragMove = (e: any, element: CanvasElement) => {
    const node = e.target;
    const isMultiDrag = selectedElementIds.length > 1 && selectedElementIds.includes(element.id);
    
    if (isMultiDrag) {
      const dx = node.x() - dragStartPositions[element.id].x;
      const dy = node.y() - dragStartPositions[element.id].y;
      
      // Update other selected elements visually
      const stage = node.getStage();
      selectedElementIds.forEach(id => {
        if (id === element.id) return;
        const otherNode = stage.findOne(`#${id}`);
        if (otherNode) {
          otherNode.x(dragStartPositions[id].x + dx);
          otherNode.y(dragStartPositions[id].y + dy);
        }
      });
      return;
    }

    const newGuides = getGuides(element.id, node.x(), node.y(), element.width, element.height);
    
    setGuides(newGuides);

    newGuides.forEach((guide) => {
      if (guide.orientation === 'V') {
        node.x(node.x() + guide.offset);
      } else {
        node.y(node.y() + guide.offset);
      }
    });
  };

  const handleDragStart = (e: any) => {
    const startPositions: { [id: string]: { x: number, y: number } } = {};
    selectedElementIds.forEach(id => {
      const el = elements.find(e => e.id === id);
      if (el) {
        startPositions[id] = { x: el.x, y: el.y };
      }
    });
    setDragStartPositions(startPositions);
  };

  const handleDragEnd = (e: any, id: string) => {
    setGuides([]);
    const node = e.target;
    const isMultiDrag = selectedElementIds.length > 1 && selectedElementIds.includes(id);

    if (isMultiDrag) {
      const dx = node.x() - dragStartPositions[id].x;
      const dy = node.y() - dragStartPositions[id].y;
      
      const updates: { [id: string]: { x: number, y: number } } = {};
      selectedElementIds.forEach(sid => {
        updates[sid] = {
          x: dragStartPositions[sid].x + dx,
          y: dragStartPositions[sid].y + dy
        };
      });

      // Batch update in store
      selectedElementIds.forEach(sid => {
        updateElement(sid, updates[sid]);
      });
    } else {
      updateElement(id, {
        x: node.x(),
        y: node.y(),
      });
    }
    setDragStartPositions({});
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setTempText(e.target.value);
  };

  const handleTextBlur = () => {
    if (editingId) {
      updateElement(editingId, { content: tempText });
      setEditingId(null);
    }
  };

  const handleMouseDown = (e: any) => {
    const clickedOnEmpty = e.target === e.target.getStage();
    if (clickedOnEmpty) {
      const pos = e.target.getStage().getPointerPosition();
      // Adjust for zoom and page position
      const stageBox = e.target.getStage().container().getBoundingClientRect();
      const x = (pos.x) / zoom;
      const y = (pos.y) / zoom;
      
      setSelectionRect({ x1: x, y1: y, x2: x, y2: y, isVisible: true });
      handleSelect(null);
    }
  };

  const handleMouseMove = (e: any) => {
    if (!selectionRect.isVisible) return;
    
    const pos = e.target.getStage().getPointerPosition();
    const x = (pos.x) / zoom;
    const y = (pos.y) / zoom;
    
    setSelectionRect(prev => ({ ...prev, x2: x, y2: y }));
  };

  const handleMouseUp = () => {
    if (!selectionRect.isVisible) return;
    
    const { x1, y1, x2, y2 } = selectionRect;
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);
    
    const selectedIds = elements
      .filter(el => {
        const elCenterX = el.x + el.width / 2;
        const elCenterY = el.y + el.height / 2;
        return elCenterX >= minX && elCenterX <= maxX && elCenterY >= minY && elCenterY <= maxY;
      })
      .map(el => el.id);
    
    if (selectedIds.length > 0) {
      selectedIds.forEach(id => selectElement(id, true));
    }
    
    setSelectionRect({ x1: 0, y1: 0, x2: 0, y2: 0, isVisible: false });
  };

  const editingElement = elements.find(el => el.id === editingId);

  return (
    <main className={cn(
      "flex-1 h-full overflow-auto relative flex flex-col items-center transition-colors duration-300",
      darkMode ? "bg-gray-950" : "bg-gray-100"
    )}>
      {/* Canvas Toolbar */}
      <div className={cn(
        "sticky top-4 z-30 flex items-center gap-2 p-2 border rounded-2xl shadow-xl mb-8 mt-4 transition-colors",
        darkMode ? "bg-gray-800/80 border-gray-700 backdrop-blur-md text-white" : "bg-white/80 border-gray-200 backdrop-blur-md text-gray-900"
      )}>
        <button 
          onClick={() => addElement('text', 'New Text Block')}
          className={cn("p-2 rounded-xl transition-colors", darkMode ? "hover:bg-gray-700" : "hover:bg-gray-100")}
          title="Add Text"
        >
          <Type size={18} />
        </button>
        <button 
          onClick={() => addElement('shape', '')}
          className={cn("p-2 rounded-xl transition-colors", darkMode ? "hover:bg-gray-700" : "hover:bg-gray-100")}
          title="Add Shape"
        >
          <Plus size={18} />
        </button>
        <div className={cn("w-px h-6 mx-1", darkMode ? "bg-gray-700" : "bg-gray-200")} />
        <button 
          onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}
          className={cn("p-2 rounded-xl transition-colors", darkMode ? "hover:bg-gray-700" : "hover:bg-gray-100")}
        >
          <ZoomOut size={18} />
        </button>
          <span className="text-xs font-bold w-12 text-center">{Math.round(zoom * 100)}%</span>
          <button 
            onClick={() => setZoom(Math.min(2, zoom + 0.1))}
            className={cn("p-2 rounded-xl transition-colors", darkMode ? "hover:bg-gray-700" : "hover:bg-gray-100")}
          >
            <ZoomIn size={18} />
          </button>
          <div className={cn("w-px h-6 mx-1", darkMode ? "bg-gray-700" : "bg-gray-200")} />
          <button 
            onClick={() => setZoom(1)}
            className={cn("p-2 rounded-xl transition-colors", darkMode ? "hover:bg-gray-700" : "hover:bg-gray-100")}
          >
            <Maximize size={18} />
          </button>
          <button 
            onClick={toggleGrid}
            className={cn(
              "p-2 rounded-xl transition-colors",
              showGrid 
                ? (darkMode ? "bg-indigo-500/20 text-indigo-400" : "bg-indigo-50 text-indigo-600") 
                : (darkMode ? "hover:bg-gray-700" : "hover:bg-gray-100")
            )}
          >
            <Grid3X3 size={18} />
          </button>
          <div className={cn("w-px h-6 mx-1", darkMode ? "bg-gray-700" : "bg-gray-200")} />
          <div className="flex items-center gap-1 px-2">
            <span className="text-[10px] font-bold uppercase text-gray-500">Pages: 2</span>
          </div>
          {selectedElementIds.length > 0 && (
          <>
            <div className={cn("w-px h-6 mx-1", darkMode ? "bg-gray-700" : "bg-gray-200")} />
            <button 
              onClick={() => {
                selectedElementIds.forEach(id => removeElement(id));
                handleSelect(null);
              }}
              className="p-2 rounded-xl hover:bg-red-500/10 text-red-400 transition-colors"
            >
              <Trash2 size={18} />
            </button>
          </>
        )}
      </div>

      {/* A4 Page Container */}
      <div 
        className="flex-1 w-full flex justify-center pb-20"
        onClick={(e) => {
            if (e.target === e.currentTarget) handleSelect(null);
        }}
      >
        <div 
          id="resume-canvas"
          className={cn(
            "bg-white shadow-2xl origin-top transition-transform duration-200 relative",
            showGrid && (darkMode 
              ? "bg-[radial-gradient(rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:20px_20px]" 
              : "bg-[radial-gradient(rgba(0,0,0,0.05)_1px,transparent_1px)] [background-size:20px_20px]")
          )}
          style={{
            width: '210mm',
            height: '594mm', // 2 A4 pages
            transform: `scale(${zoom})`,
          }}
        >
          {/* Page Break Indicator */}
          {!isExporting && (
            <div 
              className="absolute top-[297mm] left-0 w-full border-t-2 border-dashed border-indigo-400 z-50 pointer-events-none flex items-center justify-center"
            >
              <span className="bg-indigo-400 text-white text-[10px] px-2 py-0.5 rounded-full -translate-y-1/2 font-bold uppercase tracking-wider">Page 2 Start</span>
            </div>
          )}
          
          <Stage
            width={793.7} // 210mm in pixels at 96dpi
            height={2245} // 594mm in pixels at 96dpi
            ref={stageRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
          >
            <Layer>
              {elements.map((el) => (
                <Element
                  key={el.id}
                  element={el}
                  isSelected={!isExporting && selectedElementIds.includes(el.id)}
                  onSelect={(e: any) => handleSelect(el.id, e?.evt?.shiftKey || e?.evt?.ctrlKey || e?.evt?.metaKey)}
                  onChange={(updates) => updateElement(el.id, updates)}
                  onDblClick={() => handleDblClick(el)}
                  onDragStart={handleDragStart}
                  onDragMove={(e) => handleDragMove(e, el)}
                  onDragEnd={(e) => handleDragEnd(e, el.id)}
                />
              ))}
              {!isExporting && guides.map((guide, i) => (
                <React.Fragment key={i}>
                  <Line
                    points={
                      guide.orientation === 'V'
                        ? [guide.line, 0, guide.line, 2245]
                        : [0, guide.line, 793.7, guide.line]
                    }
                    stroke="#ef4444"
                    strokeWidth={1}
                    dash={[4, 4]}
                  />
                  {/* Canva-like markers at the ends of the guide lines */}
                  {guide.orientation === 'V' ? (
                    <>
                      <Rect x={guide.line - 2} y={0} width={4} height={4} fill="#ef4444" />
                      <Rect x={guide.line - 2} y={2245 - 4} width={4} height={4} fill="#ef4444" />
                    </>
                  ) : (
                    <>
                      <Rect x={0} y={guide.line - 2} width={4} height={4} fill="#ef4444" />
                      <Rect x={793.7 - 4} y={guide.line - 2} width={4} height={4} fill="#ef4444" />
                    </>
                  )}
                </React.Fragment>
              ))}
              {!isExporting && selectionRect.isVisible && (
                <Rect
                  x={Math.min(selectionRect.x1, selectionRect.x2)}
                  y={Math.min(selectionRect.y1, selectionRect.y2)}
                  width={Math.abs(selectionRect.x2 - selectionRect.x1)}
                  height={Math.abs(selectionRect.y2 - selectionRect.y1)}
                  fill="rgba(59, 130, 246, 0.1)"
                  stroke="#3b82f6"
                  strokeWidth={1}
                />
              )}
            </Layer>
          </Stage>

          {/* Text Editor Overlay */}
          {editingElement && !isExporting && (
            <textarea
              autoFocus
              value={tempText}
              onChange={handleTextChange}
              onBlur={handleTextBlur}
              style={{
                position: 'absolute',
                top: editingElement.y,
                left: editingElement.x,
                width: editingElement.width,
                height: editingElement.height,
                fontFamily: editingElement.style.fontFamily,
                fontSize: `${editingElement.style.fontSize}px`,
                fontWeight: editingElement.style.fontWeight,
                textAlign: editingElement.style.textAlign as any,
                lineHeight: editingElement.style.lineHeight,
                color: editingElement.style.color,
                background: 'white',
                border: '1px solid #3b82f6',
                outline: 'none',
                resize: 'none',
                zIndex: 1000,
                padding: 0,
                margin: 0,
                overflow: 'hidden',
              }}
            />
          )}
        </div>
      </div>
    </main>
  );
};
