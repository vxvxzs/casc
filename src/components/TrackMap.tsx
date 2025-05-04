import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './TrackMap.css';

type ErrorPoint = {
  position: [number, number];
  description: string;
  severity: 'low' | 'medium' | 'high';
  sector?: number;
  timeLost?: string;
};

type TrackMapProps = {
  trackLine: [number, number][];
  errors: ErrorPoint[];
  onErrorSelect: (error: ErrorPoint) => void;
};

const severityColor = {
  low: '#ffd166',
  medium: '#ef476f',
  high: '#d90429'
};

const TrackMap: React.FC<TrackMapProps> = ({ trackLine, errors, onErrorSelect }) => {
  const [selectedError, setSelectedError] = useState<ErrorPoint | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  const width = 800;
  const height = 500;
  const padding = 40;

  if (!trackLine || trackLine.length < 2) {
    return (
      <div className="track-map-container">
        <div className="track-map-error">
          No valid track data available
        </div>
      </div>
    );
  }

  // Normalize track coordinates
  const allX = trackLine.map(p => p[0]);
  const allY = trackLine.map(p => p[1]);
  const minX = Math.min(...allX);
  const maxX = Math.max(...allX);
  const minY = Math.min(...allY);
  const maxY = Math.max(...allY);

  // Scale coordinates to fit the SVG viewport
  const scaleX = (x: number) => ((x - minX) / (maxX - minX)) * (width - 2 * padding) + padding;
  const scaleY = (y: number) => ((y - minY) / (maxY - minY)) * (height - 2 * padding) + padding;

  // Create track path
  const linePath = trackLine.map(([x, y], i) => 
    `${i === 0 ? 'M' : 'L'} ${scaleX(x)} ${scaleY(y)}`
  ).join(' ');

  const handleErrorHover = (e: React.MouseEvent, error: ErrorPoint) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = rect.left;
    const y = rect.top;
    setSelectedError(error);
    setTooltipPosition({ x, y });
  };

  return (
    <div className="track-map-container">
      <svg width={width} height={height} className="track-map-svg">
        {/* Track outline shadow */}
        <path 
          d={linePath} 
          fill="none" 
          stroke="rgba(255,255,255,0.1)" 
          strokeWidth={6} 
          strokeLinecap="round"
        />
        
        {/* Main track line */}
        <path 
          d={linePath} 
          fill="none" 
          stroke="#ffffff" 
          strokeWidth={2.5}
          strokeLinecap="round" 
        />

        {/* Error points */}
        {errors.map((err, idx) => (
          <motion.g key={idx}>
            {/* Pulse animation background */}
            <motion.circle
              cx={scaleX(err.position[0])}
              cy={scaleY(err.position[1])}
              r={12}
              fill={severityColor[err.severity]}
              initial={{ opacity: 0.2, scale: 1 }}
              animate={{ 
                opacity: [0.2, 0.4, 0.2],
                scale: [1, 1.2, 1],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />
            
            {/* Main error point */}
            <motion.circle
              cx={scaleX(err.position[0])}
              cy={scaleY(err.position[1])}
              r={8}
              fill={severityColor[err.severity]}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              whileHover={{ scale: 1.3 }}
              className="error-point"
              onMouseEnter={(e) => handleErrorHover(e, err)}
              onMouseLeave={() => setSelectedError(null)}
              onClick={() => onErrorSelect(err)}
            />
          </motion.g>
        ))}
      </svg>

      {/* Tooltip */}
      <AnimatePresence>
        {selectedError && (
          <motion.div 
            className="error-tooltip"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            style={{
              left: tooltipPosition.x + 20,
              top: tooltipPosition.y - 40
            }}
          >
            <strong>{selectedError.description}</strong>
            {selectedError.sector && (
              <div>Sector: {selectedError.sector}</div>
            )}
            {selectedError.timeLost && (
              <div>Time lost: {selectedError.timeLost}</div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TrackMap;