import React from 'react';
import { useDroppable, CollisionDetection, pointerWithin, rectIntersection } from '@dnd-kit/core';
import { JobColumnId } from '../../types';

export const cardFirstCollision: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  const cardCollisions = pointerCollisions.filter(c => 
    typeof c.id === 'string' && c.id.startsWith('card-')
  );
  const otherCollisions = pointerCollisions.filter(c => 
    typeof c.id !== 'string' || !c.id.startsWith('card-')
  );
  
  if (cardCollisions.length > 0) {
    return cardCollisions;
  }
  
  if (otherCollisions.length > 0) {
    return otherCollisions;
  }
  
  return rectIntersection(args);
};

interface DroppableColumnProps {
  id: JobColumnId;
  children: React.ReactNode;
  activeId?: string | null;
}

export const DroppableRow: React.FC<DroppableColumnProps> = ({ id, children, activeId }) => {
  const { setNodeRef, isOver } = useDroppable({ id });
  
  return (
    <div 
      ref={setNodeRef}
      data-column-id={id}
      className={`p-5 transition-all overflow-visible ${
        isOver && activeId ? 'ring-2 ring-blue-400 ring-offset-2' : ''
      }`}
      style={{ 
        background: isOver && activeId ? 'rgba(59, 130, 246, 0.1)' : 'var(--bg-surface)', 
        backdropFilter: 'var(--blur)', 
        WebkitBackdropFilter: 'var(--blur)'
      }}
    >
      <div 
        className="grid gap-8 min-h-[180px] items-stretch overflow-visible px-4"
        style={{ 
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gridAutoRows: 'minmax(280px, auto)' 
        }}
      >
        {children}
      </div>
    </div>
  );
};

export const DroppableColumn: React.FC<DroppableColumnProps> = ({ id, children, activeId }) => {
  const { setNodeRef, isOver } = useDroppable({ id });
  
  return (
    <div 
      ref={setNodeRef}
      className={`p-3 min-h-[400px] flex-1 transition-all flex flex-col overflow-visible ${
        isOver && activeId ? 'ring-2 ring-blue-400 ring-offset-2' : ''
      }`}
      style={{ 
        background: isOver && activeId ? 'rgba(59, 130, 246, 0.1)' : 'var(--bg-surface)', 
        backdropFilter: 'var(--blur)', 
        WebkitBackdropFilter: 'var(--blur)' 
      }}
    >
      {children}
    </div>
  );
};

