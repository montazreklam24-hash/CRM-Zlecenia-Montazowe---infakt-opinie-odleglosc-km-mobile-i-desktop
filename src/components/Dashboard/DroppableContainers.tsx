import React from 'react';
import { useDroppable, CollisionDetection, pointerWithin, rectIntersection, closestCorners } from '@dnd-kit/core';
import { JobColumnId } from '../../types';

export const cardFirstCollision: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  
  // Lista ID kolumn, aby odróżnić je od kart
  const columnIds = ['PREPARE', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN', 'COMPLETED'];
  
  const cardCollisions = pointerCollisions.filter(c => {
    const id = c.id.toString();
    // Karta ma ID w formacie "jobId-timestamp" lub zaczyna się od "card-"
    return id.includes('-') || (id.startsWith('card-') && !columnIds.includes(id));
  });
  
  if (cardCollisions.length > 0) {
    return cardCollisions;
  }

  // Jeśli nie jesteśmy bezpośrednio nad kartą, spróbujmy znaleźć najbliższą kartę
  // zamiast od razu zwracać kolumnę. To kluczowe dla przerw między kafelkami.
  const closestCardCollisions = closestCorners({
    ...args,
    droppableContainers: args.droppableContainers.filter(container => {
      const id = container.id.toString();
      return id.includes('-') || (id.startsWith('card-') && !columnIds.includes(id));
    })
  });

  if (closestCardCollisions.length > 0) {
    return closestCardCollisions;
  }
  
  const otherCollisions = pointerCollisions.filter(c => {
    const id = c.id.toString();
    return columnIds.includes(id);
  });
  
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
        background: isOver && activeId ? 'rgba(59, 130, 246, 0.1)' : 'rgba(255, 255, 255, 0.03)', 
        borderRadius: 'var(--radius-lg)'
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
        background: isOver && activeId ? 'rgba(59, 130, 246, 0.1)' : 'rgba(255, 255, 255, 0.03)', 
        borderRadius: 'var(--radius-lg)'
      }}
    >
      {children}
    </div>
  );
};

