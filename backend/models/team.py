from datetime import datetime
from sqlalchemy import Index
from models.database import db


class Team(db.Model):
    __tablename__ = 'teams'
    __table_args__ = (
        Index('idx_team_tournament', 'tournament_id'),
    )

    id = db.Column(db.Integer, primary_key=True)
    tournament_id = db.Column(db.Integer, db.ForeignKey('tournaments.id'), nullable=False)
    name = db.Column(db.String(200), nullable=False)
    logo = db.Column(db.String(500))
    owner_name = db.Column(db.String(200))
    captain_name = db.Column(db.String(200))
    budget = db.Column(db.Float, nullable=False, default=0)
    remaining_budget = db.Column(db.Float, nullable=False, default=0)
    max_players = db.Column(db.Integer, default=15)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    players = db.relationship('Player', backref='sold_team', lazy='dynamic',
                              foreign_keys='Player.sold_team_id')
    bids = db.relationship('BidHistory', backref='team', lazy='dynamic')

    @property
    def player_count(self):
        return self.players.count()

    def to_dict(self, player_count_override=None):
        return {
            'id': self.id,
            'tournament_id': self.tournament_id,
            'name': self.name,
            'logo': self.logo,
            'owner_name': self.owner_name,
            'captain_name': self.captain_name,
            'budget': self.budget,
            'remaining_budget': self.remaining_budget,
            'max_players': self.max_players,
            'player_count': player_count_override if player_count_override is not None else self.player_count,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
