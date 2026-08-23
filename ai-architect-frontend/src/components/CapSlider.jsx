import React, { useState } from 'react';
import { Database, Network, Scale } from 'lucide-react';

export default function CapSlider({ value, onChange, disabled }) {
  // Map string values to integer positions for the range slider
  const valMap = { 'CP': 0, 'balanced': 1, 'AP': 2 };
  const revMap = { 0: 'CP', 1: 'balanced', 2: 'AP' };

  const [localVal, setLocalVal] = useState(valMap[value] || 1);

  const handleDrag = (e) => {
    setLocalVal(parseInt(e.target.value, 10));
  };

  const handleRelease = (e) => {
    const newVal = parseInt(e.target.value, 10);
    const newStr = revMap[newVal];
    if (newStr !== value) {
      onChange(newStr);
    }
  };

  // Determine the gradient/color based on the slider position
  const getSliderClass = () => {
    if (localVal === 0) return 'cap-slider-cp';
    if (localVal === 2) return 'cap-slider-ap';
    return 'cap-slider-balanced';
  };

  return (
    <div className={`cap-slider-container glass-effect ${disabled ? 'disabled' : ''}`}>
      <div className="cap-header">
        <h3 className="cap-title">CAP Theorem Constraint</h3>
        <span className={`cap-badge ${getSliderClass()}`}>
          {localVal === 0 ? 'Strict Consistency (CP)' : localVal === 2 ? 'High Availability (AP)' : 'Balanced Strategy'}
        </span>
      </div>

      <div className="cap-track-wrapper">
        <input 
          type="range" 
          min="0" 
          max="2" 
          step="1" 
          value={localVal}
          onChange={handleDrag}
          onMouseUp={handleRelease}
          onTouchEnd={handleRelease}
          disabled={disabled}
          className={`cap-range ${getSliderClass()}`}
        />
        <div className="cap-labels">
          <div className="cap-label" onClick={() => !disabled && onChange('CP')}>
            <Database size={14} className={localVal === 0 ? 'active-icon cp-color' : ''} />
            <span>Consistency<br/><small>(ACID / SQL)</small></span>
          </div>
          <div className="cap-label" onClick={() => !disabled && onChange('balanced')}>
            <Scale size={14} className={localVal === 1 ? 'active-icon' : ''} />
            <span>Balanced<br/><small>(Hybrid)</small></span>
          </div>
          <div className="cap-label" onClick={() => !disabled && onChange('AP')}>
            <Network size={14} className={localVal === 2 ? 'active-icon ap-color' : ''} />
            <span>Availability<br/><small>(NoSQL / Eventual)</small></span>
          </div>
        </div>
      </div>
    </div>
  );
}
