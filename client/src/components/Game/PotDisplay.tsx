import React from 'react';
import './PotDisplay.css';

interface PotDisplayProps {
  pot: number;
}

const PotDisplay: React.FC<PotDisplayProps> = ({ pot }) => {
  return (
    <div className="pot-display">
      <div className="pot-label">Pot</div>
      <div className="pot-amount">${pot.toLocaleString()}</div>
    </div>
  );
};

export default PotDisplay;
