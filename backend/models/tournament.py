from datetime import datetime
from models.database import db


class Tournament(db.Model):
    __tablename__ = 'tournaments'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    logo = db.Column(db.String(500))
    description = db.Column(db.Text)
    start_date = db.Column(db.Date)
    end_date = db.Column(db.Date)
    auction_date = db.Column(db.DateTime)
    venue = db.Column(db.String(300))
    venue_address = db.Column(db.String(500))
    players_per_team = db.Column(db.Integer, default=15)
    bid_increment = db.Column(db.Integer, default=1000)
    team_budget = db.Column(db.Float, default=1000000)
    default_base_price = db.Column(db.Float, default=1000)
    status = db.Column(db.String(30), default='draft')
    # Status: draft, upcoming, auction_live, auction_paused, auction_ended, completed
    registration_open = db.Column(db.Boolean, default=False)
    youtube_url = db.Column(db.String(500), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    teams = db.relationship('Team', backref='tournament', lazy='dynamic', cascade='all, delete-orphan')
    players = db.relationship('Player', backref='tournament', lazy='dynamic', cascade='all, delete-orphan')
    sponsors = db.relationship('Sponsor', backref='tournament', lazy='dynamic', cascade='all, delete-orphan')
    advertisements = db.relationship('Advertisement', backref='tournament', lazy='dynamic', cascade='all, delete-orphan')
    auction_state = db.relationship('AuctionState', backref='tournament', uselist=False, cascade='all, delete-orphan')

    def to_dict(self):
        from utils import generate_registration_code
        return {
            'id': self.id,
            'name': self.name,
            'logo': self.logo,
            'description': self.description,
            'start_date': self.start_date.isoformat() if self.start_date else None,
            'end_date': self.end_date.isoformat() if self.end_date else None,
            'auction_date': self.auction_date.isoformat() if self.auction_date else None,
            'venue': self.venue,
            'venue_address': self.venue_address,
            'players_per_team': self.players_per_team,
            'bid_increment': self.bid_increment,
            'team_budget': self.team_budget,
            'default_base_price': self.default_base_price,
            'status': self.status,
            'registration_open': bool(self.registration_open),
            'registration_code': generate_registration_code(self.id),
            'youtube_url': self.youtube_url,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'team_count': self.teams.count(),
            'player_count': self.players.count(),
        }
