from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from flask_bcrypt import Bcrypt
from models.database import db
from models.user import User
from middleware import role_required

bcrypt = Bcrypt()
users_bp = Blueprint('users', __name__, url_prefix='/api/users')


@users_bp.route('', methods=['GET'])
@role_required('manager')
def get_users():
    """Get all users."""
    users = User.query.order_by(User.created_at.desc()).all()
    return jsonify({'users': [u.to_dict() for u in users]}), 200


@users_bp.route('', methods=['POST'])
@role_required('manager')
def create_user():
    """Create a new user."""
    data = request.get_json()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')
    name = data.get('name', '').strip()
    role = data.get('role', 'admin')

    if not email or not password or not name:
        return jsonify({'error': 'Name, email, and password are required'}), 400

    if role not in ('manager', 'admin'):
        return jsonify({'error': 'Invalid role'}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({'error': 'Email already exists'}), 409

    user = User(
        email=email,
        password_hash=bcrypt.generate_password_hash(password).decode('utf-8'),
        name=name,
        role=role,
        tournament_id=data.get('tournament_id') if role == 'admin' else None,
        perm_teams=data.get('perm_teams', True) if role == 'admin' else True,
        perm_players=data.get('perm_players', True) if role == 'admin' else True,
        perm_auction=data.get('perm_auction', True) if role == 'admin' else True,
        perm_sponsors=data.get('perm_sponsors', True) if role == 'admin' else True,
        perm_analytics=data.get('perm_analytics', True) if role == 'admin' else True,
        perm_reports=data.get('perm_reports', True) if role == 'admin' else True
    )
    db.session.add(user)
    db.session.commit()
    return jsonify({'user': user.to_dict(), 'message': 'User created successfully'}), 201


@users_bp.route('/<int:user_id>', methods=['PUT'])
@role_required('manager')
def update_user(user_id):
    """Update a user."""
    user = User.query.get_or_404(user_id)
    data = request.get_json()

    if data.get('name'):
        user.name = data['name']
    if data.get('role') and data['role'] in ('manager', 'admin'):
        user.role = data['role']
        if user.role == 'manager':
            user.tournament_id = None
    if 'tournament_id' in data:
        user.tournament_id = data['tournament_id'] if user.role == 'admin' else None
    if data.get('is_active') is not None:
        user.is_active = data['is_active']
    if data.get('password'):
        user.password_hash = bcrypt.generate_password_hash(data['password']).decode('utf-8')

    if user.role == 'admin':
        if 'perm_teams' in data:
            user.perm_teams = data['perm_teams']
        if 'perm_players' in data:
            user.perm_players = data['perm_players']
        if 'perm_auction' in data:
            user.perm_auction = data['perm_auction']
        if 'perm_sponsors' in data:
            user.perm_sponsors = data['perm_sponsors']
        if 'perm_analytics' in data:
            user.perm_analytics = data['perm_analytics']
        if 'perm_reports' in data:
            user.perm_reports = data['perm_reports']
    else:
        user.perm_teams = True
        user.perm_players = True
        user.perm_auction = True
        user.perm_sponsors = True
        user.perm_analytics = True
        user.perm_reports = True

    db.session.commit()
    return jsonify({'user': user.to_dict(), 'message': 'User updated successfully'}), 200


@users_bp.route('/<int:user_id>', methods=['DELETE'])
@role_required('manager')
def delete_user(user_id):
    """Delete a user."""
    user = User.query.get_or_404(user_id)
    db.session.delete(user)
    db.session.commit()
    return jsonify({'message': 'User deleted successfully'}), 200
