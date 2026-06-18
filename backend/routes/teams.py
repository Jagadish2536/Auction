from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from models.database import db
from models.team import Team
from models.tournament import Tournament
from middleware import role_required, tournament_scope_required
from utils import save_upload

teams_bp = Blueprint('teams', __name__, url_prefix='/api/tournaments/<int:tournament_id>/teams')


@teams_bp.route('', methods=['GET'])
@jwt_required()
@tournament_scope_required
def get_teams(tournament_id):
    """Get all teams for a tournament."""
    teams = Team.query.filter_by(tournament_id=tournament_id).order_by(Team.name).all()
    return jsonify({'teams': [t.to_dict() for t in teams]}), 200


@teams_bp.route('/<int:team_id>', methods=['GET'])
@jwt_required()
@tournament_scope_required
def get_team(tournament_id, team_id):
    """Get a single team."""
    team = Team.query.filter_by(id=team_id, tournament_id=tournament_id).first_or_404()
    return jsonify({'team': team.to_dict()}), 200


@teams_bp.route('', methods=['POST'])
@role_required('manager', 'admin')
@tournament_scope_required
def create_team(tournament_id):
    """Create a new team."""
    tournament = Tournament.query.get_or_404(tournament_id)
    data = request.form if request.form else request.get_json()

    name = data.get('name')
    if not name:
        return jsonify({'error': 'Team name is required'}), 400

    raw_budget = data.get('budget')
    budget = float(raw_budget) if (raw_budget is not None and str(raw_budget).strip() != '') else (tournament.team_budget if tournament.team_budget is not None else 1000000.0)

    raw_max_players = data.get('max_players')
    max_players = int(raw_max_players) if (raw_max_players is not None and str(raw_max_players).strip() != '') else (tournament.players_per_team if tournament.players_per_team is not None else 15)

    team = Team(
        tournament_id=tournament_id,
        name=name,
        owner_name=data.get('owner_name'),
        captain_name=data.get('captain_name'),
        budget=budget,
        remaining_budget=budget,
        max_players=max_players
    )

    if hasattr(request, 'files') and 'logo' in request.files:
        logo_path = save_upload(request.files['logo'], 'team_logos')
        if logo_path:
            team.logo = logo_path

    db.session.add(team)
    db.session.commit()
    from app import socketio
    socketio.emit('team:change', {'action': 'created', 'tournament_id': tournament_id, 'team_id': team.id})
    return jsonify({'team': team.to_dict(), 'message': 'Team created successfully'}), 201


@teams_bp.route('/<int:team_id>', methods=['PUT'])
@role_required('manager', 'admin')
@tournament_scope_required
def update_team(tournament_id, team_id):
    """Update a team."""
    team = Team.query.filter_by(id=team_id, tournament_id=tournament_id).first_or_404()
    data = request.form if request.form else request.get_json()

    if data.get('name'):
        team.name = data['name']
    if data.get('owner_name') is not None:
        team.owner_name = data.get('owner_name')
    if data.get('captain_name') is not None:
        team.captain_name = data.get('captain_name')
    if data.get('budget') is not None:
        old_budget = team.budget
        new_budget = float(data['budget'])
        budget_diff = new_budget - old_budget
        team.budget = new_budget
        team.remaining_budget = team.remaining_budget + budget_diff
    if data.get('max_players') is not None:
        team.max_players = int(data['max_players'])

    if hasattr(request, 'files') and 'logo' in request.files:
        logo_path = save_upload(request.files['logo'], 'team_logos')
        if logo_path:
            team.logo = logo_path

    db.session.commit()
    from app import socketio
    socketio.emit('team:change', {'action': 'updated', 'tournament_id': tournament_id, 'team_id': team.id})
    return jsonify({'team': team.to_dict(), 'message': 'Team updated successfully'}), 200


@teams_bp.route('/<int:team_id>', methods=['DELETE'])
@role_required('manager', 'admin')
@tournament_scope_required
def delete_team(tournament_id, team_id):
    """Delete a team."""
    team = Team.query.filter_by(id=team_id, tournament_id=tournament_id).first_or_404()
    db.session.delete(team)
    db.session.commit()
    from app import socketio
    socketio.emit('team:change', {'action': 'deleted', 'tournament_id': tournament_id, 'team_id': team_id})
    return jsonify({'message': 'Team deleted successfully'}), 200
