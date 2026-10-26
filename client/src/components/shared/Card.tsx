import React from 'react';
import './Card.css';

interface CardProps {
  value: string;
}

const Card: React.FC<CardProps> = ({ value }) => {
  const getRankColor = (rank: string) => {
    if (rank === '♥' || rank === '♦') return 'red';
    return 'black';
  };

  if (!value) {
    return (
      <div className="card card-empty">
        <div className="card-back"></div>
      </div>
    );
  }

  const suit = value[value.length - 1];
  const rank = value.substring(0, value.length - 1);

  return (
    <div className={`card card-${getRankColor(suit)}`}>
      <div className="card-content">
        <div className="card-rank">{rank}</div>
        <div className="card-suit">{suit}</div>
      </div>
    </div>
  );
};

export default Card;
