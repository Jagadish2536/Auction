from datetime import datetime
from models.database import db


class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    role = db.Column(db.String(20), nullable=False, default='admin')  # manager, admin
    is_active = db.Column(db.Boolean, default=True)
    tournament_id = db.Column(db.Integer, db.ForeignKey('tournaments.id', ondelete='SET NULL'), nullable=True)
    
    # Feature Permissions for Admins
    perm_teams = db.Column(db.Boolean, default=True, nullable=False)
    perm_players = db.Column(db.Boolean, default=True, nullable=False)
    perm_auction = db.Column(db.Boolean, default=True, nullable=False)
    perm_sponsors = db.Column(db.Boolean, default=True, nullable=False)
    perm_analytics = db.Column(db.Boolean, default=True, nullable=False)
    perm_reports = db.Column(db.Boolean, default=True, nullable=False)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    audit_logs = db.relationship('AuditLog', backref='user', lazy='dynamic')
    tournament = db.relationship('Tournament', backref=db.backref('users', lazy=True))

    def to_dict(self):
        return {
            'id': self.id,
            'email': self.email,
            'name': self.name,
            'role': self.role,
            'is_active': self.is_active,
            'tournament_id': self.tournament_id,
            'tournament_name': self.tournament.name if self.tournament else None,
            'perm_teams': self.perm_teams,
            'perm_players': self.perm_players,
            'perm_auction': self.perm_auction,
            'perm_sponsors': self.perm_sponsors,
            'perm_analytics': self.perm_analytics,
            'perm_reports': self.perm_reports,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
