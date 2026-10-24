import React from 'react';
import { cn } from '../../utils/cn';

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'surface' | 'subtle';
  children: React.ReactNode;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  variant = 'surface',
  className,
  children,
  ...props
}) => {
  return (
    <div
      className={cn(
        'rounded-2xl transition-all duration-300',
        variant === 'surface' ? 'glass-surface' : 'glass-surface-subtle',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};
