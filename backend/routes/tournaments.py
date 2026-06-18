from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from models.database import db
from models.tournament import Tournament
from models.auction import AuctionState
from middleware import role_required, get_current_user, tournament_scope_required
from utils import save_upload

tournaments_bp = Blueprint('tournaments', __name__, url_prefix='/api/tournaments')


@tournaments_bp.route('', methods=['GET'])
@jwt_required()
def get_tournaments():
    """Get all tournaments."""
    from middleware import get_current_user
    current_user = get_current_user()
    if current_user and current_user.role == 'admin' and current_user.tournament_id:
        tournaments = Tournament.query.filter_by(id=current_user.tournament_id).all()
    else:
        tournaments = Tournament.query.order_by(Tournament.created_at.desc()).all()
    return jsonify({'tournaments': [t.to_dict() for t in tournaments]}), 200


@tournaments_bp.route('/<int:tournament_id>', methods=['GET'])
@jwt_required()
@tournament_scope_required
def get_tournament(tournament_id):
    """Get single tournament."""
    tournament = Tournament.query.get_or_404(tournament_id)
    return jsonify({'tournament': tournament.to_dict()}), 200


@tournaments_bp.route('', methods=['POST'])
@role_required('manager')
def create_tournament():
    """Create a new tournament."""
    data = request.form if request.form else (request.get_json() if request.is_json else {})
    name = data.get('name')
    if not name:
        return jsonify({'error': 'Tournament name is required'}), 400

    players_per_team = data.get('players_per_team')
    bid_increment = data.get('bid_increment')
    team_budget = data.get('team_budget')
    default_base_price = data.get('default_base_price')

    tournament = Tournament(
        name=name,
        description=data.get('description'),
        venue=data.get('venue'),
        venue_address=data.get('venue_address'),
        players_per_team=int(players_per_team) if players_per_team else 15,
        bid_increment=int(bid_increment) if bid_increment else 1000,
        team_budget=float(team_budget) if team_budget else 1000000.0,
        default_base_price=float(default_base_price) if default_base_price else 1000.0,
        status='draft',
        youtube_url=data.get('youtube_url')
    )

    # Handle dates
    if data.get('start_date'):
        from datetime import datetime
        tournament.start_date = datetime.strptime(data['start_date'], '%Y-%m-%d').date()
    if data.get('end_date'):
        from datetime import datetime
        tournament.end_date = datetime.strptime(data['end_date'], '%Y-%m-%d').date()
    if data.get('auction_date'):
        from datetime import datetime
        try:
            tournament.auction_date = datetime.strptime(data['auction_date'], '%Y-%m-%dT%H:%M')
        except ValueError:
            try:
                tournament.auction_date = datetime.fromisoformat(data['auction_date'].replace('Z', '+00:00'))
            except Exception:
                pass

    # Handle logo upload
    if 'logo' in request.files:
        logo_path = save_upload(request.files['logo'], 'logos')
        if logo_path:
            tournament.logo = logo_path

    db.session.add(tournament)
    db.session.commit()

    # Create auction state
    auction_state = AuctionState(tournament_id=tournament.id)
    db.session.add(auction_state)
    db.session.commit()

    from app import socketio
    socketio.emit('tournament:change', {'action': 'created', 'tournament_id': tournament.id})

    return jsonify({'tournament': tournament.to_dict(), 'message': 'Tournament created successfully'}), 201


@tournaments_bp.route('/<int:tournament_id>', methods=['PUT'])
@role_required('manager', 'admin')
@tournament_scope_required
def update_tournament(tournament_id):
    """Update a tournament."""
    tournament = Tournament.query.get_or_404(tournament_id)
    data = request.form if request.form else (request.get_json() if request.is_json else {})

    if data.get('name'):
        tournament.name = data['name']
    if data.get('description') is not None:
        tournament.description = data.get('description')
    if data.get('venue') is not None:
        tournament.venue = data.get('venue')
    if data.get('venue_address') is not None:
      tournament.venue_address = data.get('venue_address')
    if data.get('youtube_url') is not None:
      tournament.youtube_url = data.get('youtube_url')
    if data.get('status'):
        tournament.status = data['status']
    if data.get('registration_open') is not None:
        val = data.get('registration_open')
        if str(val).lower() in ['true', '1', 'yes']:
            tournament.registration_open = True
        elif str(val).lower() in ['false', '0', 'no']:
            tournament.registration_open = False
        else:
            tournament.registration_open = bool(val)

    if data.get('players_per_team') is not None:
        tournament.players_per_team = int(data['players_per_team'])
        # Propagate to all teams in the tournament
        for team in tournament.teams:
            team.max_players = tournament.players_per_team

    if data.get('team_budget') is not None:
        tournament.team_budget = float(data['team_budget'])
        # Propagate to all teams in the tournament
        for team in tournament.teams:
            old_budget = team.budget
            team.budget = tournament.team_budget
            team.remaining_budget = team.remaining_budget + (tournament.team_budget - old_budget)

    if data.get('bid_increment') is not None:
        tournament.bid_increment = int(data['bid_increment'])

    if data.get('default_base_price') is not None:
        tournament.default_base_price = float(data['default_base_price'])
        # Propagate to all players in the tournament
        for player in tournament.players:
            player.base_price = tournament.default_base_price

    if data.get('start_date'):
        from datetime import datetime
        tournament.start_date = datetime.strptime(data['start_date'], '%Y-%m-%d').date()
    if data.get('end_date'):
        from datetime import datetime
        tournament.end_date = datetime.strptime(data['end_date'], '%Y-%m-%d').date()
    if data.get('auction_date'):
        from datetime import datetime
        try:
            tournament.auction_date = datetime.strptime(data['auction_date'], '%Y-%m-%dT%H:%M')
        except ValueError:
            try:
                tournament.auction_date = datetime.fromisoformat(data['auction_date'].replace('Z', '+00:00'))
            except Exception:
                pass

    if 'logo' in request.files:
        logo_path = save_upload(request.files['logo'], 'logos')
        if logo_path:
            tournament.logo = logo_path

    db.session.commit()
    from app import socketio
    socketio.emit('tournament:change', {'action': 'updated', 'tournament_id': tournament.id})
    return jsonify({'tournament': tournament.to_dict(), 'message': 'Tournament updated successfully'}), 200


@tournaments_bp.route('/<int:tournament_id>', methods=['DELETE'])
@role_required('manager')
@tournament_scope_required
def delete_tournament(tournament_id):
    """Delete a tournament."""
    tournament = Tournament.query.get_or_404(tournament_id)
    db.session.delete(tournament)
    db.session.commit()
    from app import socketio
    socketio.emit('tournament:change', {'action': 'deleted', 'tournament_id': tournament_id})
    return jsonify({'message': 'Tournament deleted successfully'}), 200
