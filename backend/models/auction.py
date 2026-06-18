from datetime import datetime
from models.database import db


class AuctionState(db.Model):
    __tablename__ = 'auction_states'

    id = db.Column(db.Integer, primary_key=True)
    tournament_id = db.Column(db.Integer, db.ForeignKey('tournaments.id'), nullable=False, unique=True)
    status = db.Column(db.String(20), default='not_started')
    # Status: not_started, live, paused, ended
    current_player_id = db.Column(db.Integer, db.ForeignKey('players.id'), nullable=True)
    current_bid = db.Column(db.Float, default=0)
    current_team_id = db.Column(db.Integer, db.ForeignKey('teams.id'), nullable=True)
    timer_remaining = db.Column(db.Integer, default=30)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    current_player = db.relationship('Player', foreign_keys=[current_player_id])
    current_team = db.relationship('Team', foreign_keys=[current_team_id])

    def to_dict(self):
        return {
            'id': self.id,
            'tournament_id': self.tournament_id,
            'status': self.status,
            'current_player_id': self.current_player_id,
            'current_player': self.current_player.to_dict() if self.current_player else None,
            'current_bid': self.current_bid,
            'current_team_id': self.current_team_id,
            'current_team_name': self.current_team.name if self.current_team else None,
            'timer_remaining': self.timer_remaining,
        }


class BidHistory(db.Model):
    __tablename__ = 'bid_history'

    id = db.Column(db.Integer, primary_key=True)
    player_id = db.Column(db.Integer, db.ForeignKey('players.id'), nullable=False)
    team_id = db.Column(db.Integer, db.ForeignKey('teams.id'), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    tournament_id = db.Column(db.Integer, db.ForeignKey('tournaments.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'player_id': self.player_id,
            'player_name': self.player.name if self.player else None,
            'team_id': self.team_id,
            'team_name': self.team.name if self.team else None,
            'amount': self.amount,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class Sponsor(db.Model):
    __tablename__ = 'sponsors'

    id = db.Column(db.Integer, primary_key=True)
    tournament_id = db.Column(db.Integer, db.ForeignKey('tournaments.id'), nullable=False)
    name = db.Column(db.String(200), nullable=False)
    logo = db.Column(db.String(500))
    url = db.Column(db.String(500))
    tier = db.Column(db.String(50), default='silver')  # gold, silver, bronze
    description = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'tournament_id': self.tournament_id,
            'name': self.name,
            'logo': self.logo,
            'url': self.url,
            'tier': self.tier,
            'description': self.description,
        }


class Advertisement(db.Model):
    __tablename__ = 'advertisements'

    id = db.Column(db.Integer, primary_key=True)
    tournament_id = db.Column(db.Integer, db.ForeignKey('tournaments.id'), nullable=False)
    title = db.Column(db.String(200))
    image = db.Column(db.String(500))
    url = db.Column(db.String(500))
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'tournament_id': self.tournament_id,
            'title': self.title,
            'image': self.image,
            'url': self.url,
            'is_active': self.is_active,
        }


class AuditLog(db.Model):
    __tablename__ = 'audit_logs'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    action = db.Column(db.String(200), nullable=False)
    details = db.Column(db.Text)
    ip_address = db.Column(db.String(50))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'user_name': self.user.name if self.user else 'System',
            'action': self.action,
            'details': self.details,
            'ip_address': self.ip_address,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class Setting(db.Model):
    __tablename__ = 'settings'

    id = db.Column(db.Integer, primary_key=True)
    key = db.Column(db.String(100), unique=True, nullable=False)
    value = db.Column(db.Text)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            'key': self.key,
            'value': self.value,
        }
