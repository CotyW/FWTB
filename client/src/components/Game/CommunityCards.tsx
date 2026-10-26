import React from 'react';
import Card from '../shared/Card';
import './CommunityCards.css';

interface CommunityCardsProps {
  cards: string[];
}

const CommunityCards: React.FC<CommunityCardsProps> = ({ cards }) => {
  return (
    <div className="community-cards">
      <h3>Community Cards</h3>
      <div className="cards-display">
        {cards.map((card, i) => (
          <Card key={i} value={card} />
        ))}
        {cards.length < 5 &&
          Array.from({ length: 5 - cards.length }).map((_, i) => (
            <div key={`empty-${i}`} className="card-placeholder">
              <div className="card-back"></div>
            </div>
          ))}
      </div>
    </div>
  );
};

export default CommunityCards;
