from datetime import datetime
from sqlalchemy import Index
from models.database import db


class Player(db.Model):
    __tablename__ = 'players'
    __table_args__ = (
        Index('idx_player_tournament_status', 'tournament_id', 'status'),
        Index('idx_player_tournament_name', 'tournament_id', 'name'),
        Index('idx_player_sold_team', 'sold_team_id'),
    )

    id = db.Column(db.Integer, primary_key=True)
    tournament_id = db.Column(db.Integer, db.ForeignKey('tournaments.id'), nullable=False)
    name = db.Column(db.String(200), nullable=False)
    village = db.Column(db.String(200))
    mobile = db.Column(db.String(20))
    playing_style = db.Column(db.String(50))  # Batsman, Bowler, All-Rounder, Wicket-Keeper
    age = db.Column(db.Integer)
    photo = db.Column(db.String(500))
    base_price = db.Column(db.Float, nullable=False, default=100)
    status = db.Column(db.String(20), default='available')  # available, sold, unsold
    crickheroes_url = db.Column(db.String(500), nullable=True)
    sold_team_id = db.Column(db.Integer, db.ForeignKey('teams.id'), nullable=True)
    sold_price = db.Column(db.Float, nullable=True)
    sold_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    bids = db.relationship('BidHistory', backref='player', lazy='dynamic')

    def to_dict(self):
        return {
            'id': self.id,
            'tournament_id': self.tournament_id,
            'name': self.name,
            'village': self.village,
            'mobile': self.mobile,
            'playing_style': self.playing_style,
            'age': self.age,
            'photo': self.photo,
            'base_price': self.base_price,
            'status': self.status,
            'crickheroes_url': self.crickheroes_url,
            'sold_team_id': self.sold_team_id,
            'sold_team_name': self.sold_team.name if self.sold_team else None,
            'sold_price': self.sold_price,
            'sold_at': self.sold_at.isoformat() if self.sold_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
