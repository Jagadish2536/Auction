from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
from sqlalchemy import func
from models.database import db
from models.player import Player
from models.team import Team
from models.auction import BidHistory
from middleware import role_required, tournament_scope_required

analytics_bp = Blueprint('analytics', __name__, url_prefix='/api/analytics')


def get_cache():
    from flask import current_app
    if "cache" in current_app.extensions:
        caches = list(current_app.extensions["cache"].keys())
        if caches:
            return caches[0]
    from app import cache
    return cache


@analytics_bp.route('/dashboard/<int:tournament_id>', methods=['GET'])
@jwt_required()
@tournament_scope_required
def get_dashboard(tournament_id):
    """Get analytics dashboard data (cached 30s)."""
    cache = get_cache()
    cache_key = f'analytics_dashboard_{tournament_id}'
    cached = cache.get(cache_key)
    if cached:
        return cached
    total_players = Player.query.filter(Player.tournament_id == tournament_id, Player.status != 'pending').count()
    sold_players = Player.query.filter_by(tournament_id=tournament_id, status='sold').count()
    unsold_players = Player.query.filter_by(tournament_id=tournament_id, status='unsold').count()
    available_players = Player.query.filter_by(tournament_id=tournament_id, status='available').count()

    # Highest bid
    highest_sold = Player.query.filter_by(
        tournament_id=tournament_id, status='sold'
    ).order_by(Player.sold_price.desc()).first()

    # Average bid
    avg_bid = db.session.query(func.avg(Player.sold_price)).filter(
        Player.tournament_id == tournament_id, Player.status == 'sold'
    ).scalar() or 0

    # Total teams
    teams = Team.query.filter_by(tournament_id=tournament_id).all()
    total_teams = len(teams)

    # Total spent
    total_spent = db.session.query(func.sum(Player.sold_price)).filter(
        Player.tournament_id == tournament_id, Player.status == 'sold'
    ).scalar() or 0

    # Most active team (most players bought)
    most_active = None
    if teams:
        team_counts = [(t, t.player_count) for t in teams]
        team_counts.sort(key=lambda x: x[1], reverse=True)
        if team_counts and team_counts[0][1] > 0:
            most_active = team_counts[0][0].to_dict()

    # Completion percentage
    completion = round((sold_players + unsold_players) / total_players * 100, 1) if total_players > 0 else 0

    response = jsonify({
        'total_players': total_players,
        'sold_players': sold_players,
        'unsold_players': unsold_players,
        'available_players': available_players,
        'highest_bid': highest_sold.sold_price if highest_sold else 0,
        'highest_sold_player': highest_sold.to_dict() if highest_sold else None,
        'average_bid': round(avg_bid, 2),
        'total_teams': total_teams,
        'total_spent': total_spent,
        'most_active_team': most_active,
        'completion_percentage': completion,
        'remaining_budgets': [{'team': t.name, 'remaining': t.remaining_budget, 'budget': t.budget} for t in teams],
    })
    cache.set(cache_key, response, timeout=30)
    return response


@analytics_bp.route('/charts/<int:tournament_id>', methods=['GET'])
@jwt_required()
@tournament_scope_required
def get_charts(tournament_id):
    """Get chart data for analytics."""
    # Team spending chart
    teams = Team.query.filter_by(tournament_id=tournament_id).all()
    team_spending = [{'name': t.name, 'spent': t.budget - t.remaining_budget, 'remaining': t.remaining_budget} for t in teams]

    # Bid distribution
    sold_players = Player.query.filter_by(tournament_id=tournament_id, status='sold').all()
    bid_ranges = {'0-500': 0, '500-1000': 0, '1000-2000': 0, '2000-5000': 0, '5000+': 0}
    for p in sold_players:
        price = p.sold_price or 0
        if price < 500:
            bid_ranges['0-500'] += 1
        elif price < 1000:
            bid_ranges['500-1000'] += 1
        elif price < 2000:
            bid_ranges['1000-2000'] += 1
        elif price < 5000:
            bid_ranges['2000-5000'] += 1
        else:
            bid_ranges['5000+'] += 1

    # Players sold by style
    style_counts = db.session.query(
        Player.playing_style, func.count(Player.id)
    ).filter(
        Player.tournament_id == tournament_id, Player.status == 'sold'
    ).group_by(Player.playing_style).all()

    return jsonify({
        'team_spending': team_spending,
        'bid_distribution': [{'range': k, 'count': v} for k, v in bid_ranges.items()],
        'players_by_style': [{'style': s or 'Unknown', 'count': c} for s, c in style_counts],
    }), 200
