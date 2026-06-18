from functools import wraps
from flask import jsonify
from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request
from models.user import User


def role_required(*roles):
    """Decorator to restrict access based on user roles."""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            verify_jwt_in_request()
            user_id = get_jwt_identity()
            user = User.query.get(user_id)

            if not user:
                return jsonify({'error': 'User not found'}), 404

            if not user.is_active:
                return jsonify({'error': 'Account is deactivated'}), 403

            if user.role not in roles:
                return jsonify({'error': 'Insufficient permissions'}), 403

            return f(*args, **kwargs)
        return decorated_function
    return decorator


def get_current_user():
    """Get the current authenticated user."""
    user_id = get_jwt_identity()
    return User.query.get(user_id)


def tournament_scope_required(f):
    """Decorator to ensure admin is restricted to their assigned tournament."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        verify_jwt_in_request()
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404

        tournament_id = kwargs.get('tournament_id')
        if tournament_id is not None:
            try:
                t_id = int(tournament_id)
            except ValueError:
                t_id = tournament_id

            user_tid = user.tournament_id
            if user_tid is not None:
                try:
                    user_tid = int(user_tid)
                except ValueError:
                    pass

            if user.role == 'admin' and user_tid != t_id:
                return jsonify({'error': 'Permission denied: restricted to assigned tournament only'}), 403

        return f(*args, **kwargs)
    return decorated_function
