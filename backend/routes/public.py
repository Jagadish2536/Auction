from flask import Blueprint, jsonify, request
from models.database import db
from models.tournament import Tournament
from models.team import Team
from models.player import Player
from models.auction import AuctionState, Sponsor, Advertisement

public_bp = Blueprint('public', __name__, url_prefix='/api/public')


def get_cache():
    from flask import current_app
    if "cache" in current_app.extensions:
        caches = list(current_app.extensions["cache"].keys())
        if caches:
            return caches[0]
    from app import cache
    return cache


@public_bp.route('/tournaments', methods=['GET'])
def get_public_tournaments():
    """Get all tournaments for public display."""
    cache = get_cache()
    cache_key = 'public_tournaments_list'
    cached = cache.get(cache_key)
    if cached:
        return cached
    tournaments = Tournament.query.order_by(Tournament.created_at.desc()).all()
    from flask import make_response
    response = make_response(jsonify({'tournaments': [t.to_dict() for t in tournaments]}))
    response.headers['Cache-Control'] = 'public, max-age=10, stale-while-revalidate=30'
    cache.set(cache_key, response, timeout=10)
    return response


@public_bp.route('/tournament', methods=['GET'])
def get_public_tournament():
    """Get the latest active tournament for public display."""
    tournament = Tournament.query.order_by(Tournament.created_at.desc()).first()
    if not tournament:
        return jsonify({'tournament': None}), 200

    teams = Team.query.filter_by(tournament_id=tournament.id).all()
    total_players = Player.query.filter(Player.tournament_id == tournament.id, Player.status != 'pending').count()
    sold_players = Player.query.filter_by(tournament_id=tournament.id, status='sold').count()
    unsold_players = Player.query.filter_by(tournament_id=tournament.id, status='unsold').count()

    # Get recent sold players
    recent_sold = Player.query.filter_by(
        tournament_id=tournament.id, status='sold'
    ).order_by(Player.sold_at.desc()).limit(10).all()

    # Get sponsors and ads
    sponsors = Sponsor.query.filter_by(tournament_id=tournament.id).all()
    ads = Advertisement.query.filter_by(tournament_id=tournament.id, is_active=True).all()

    # Get auction state
    auction_state = AuctionState.query.filter_by(tournament_id=tournament.id).first()

    return jsonify({
        'tournament': tournament.to_dict(),
        'stats': {
            'total_teams': len(teams),
            'total_players': total_players,
            'sold_players': sold_players,
            'unsold_players': unsold_players,
        },
        'auction_status': auction_state.status if auction_state else 'not_started',
        'recent_sold': [p.to_dict() for p in recent_sold],
        'sponsors': [s.to_dict() for s in sponsors],
        'advertisements': [a.to_dict() for a in ads],
        'teams': [t.to_dict() for t in teams],
    }), 200


@public_bp.route('/live/<int:tournament_id>', methods=['GET'])
def get_live_state(tournament_id):
    """Get live auction state for public viewers (cached 3s)."""
    cache = get_cache()
    cache_key = f'live_state_{tournament_id}'
    cached = cache.get(cache_key)
    if cached:
        return cached

    auction_state = AuctionState.query.filter_by(tournament_id=tournament_id).first()
    if not auction_state:
        return jsonify({'error': 'Auction not found'}), 404

    teams = Team.query.filter_by(tournament_id=tournament_id).all()
    recent_sold = Player.query.filter_by(
        tournament_id=tournament_id, status='sold'
    ).order_by(Player.sold_at.desc()).limit(20).all()

    sponsors = Sponsor.query.filter_by(tournament_id=tournament_id).all()

    # Batch player counts per team — avoids N+1 from team.player_count
    from sqlalchemy import func
    team_pc_rows = (
        db.session.query(Player.sold_team_id, func.count(Player.id))
        .filter(Player.tournament_id == tournament_id, Player.status == 'sold')
        .group_by(Player.sold_team_id)
        .all()
    )
    team_pc = {row[0]: row[1] for row in team_pc_rows}

    response = jsonify({
        'auction_state': auction_state.to_dict(),
        'teams': [t.to_dict(player_count_override=team_pc.get(t.id, 0)) for t in teams],
        'recent_sold': [p.to_dict() for p in recent_sold],
        'sponsors': [s.to_dict() for s in sponsors],
    })
    cache.set(cache_key, response, timeout=3)
    return response


@public_bp.route('/tournament/<int:tournament_id>/players', methods=['GET'])
def get_public_players(tournament_id):
    """Get all players of a tournament for public view (cached 10s)."""
    from sqlalchemy.orm import joinedload
    cache = get_cache()
    cache_key = f'public_players_{tournament_id}'
    cached = cache.get(cache_key)
    if cached:
        return cached
    players = Player.query.filter(Player.tournament_id == tournament_id, Player.status != 'pending').options(
        joinedload(Player.sold_team)
    ).order_by(Player.name).all()
    from flask import make_response
    response = make_response(jsonify({'players': [p.to_dict() for p in players]}))
    response.headers['Cache-Control'] = 'public, max-age=10, stale-while-revalidate=30'
    cache.set(cache_key, response, timeout=10)
    return response


@public_bp.route('/tournament/<int:tournament_id>', methods=['GET'])
def get_public_tournament_by_id(tournament_id):
    """Get tournament details by ID for public display."""
    tournament = Tournament.query.get_or_404(tournament_id)
    teams = Team.query.filter_by(tournament_id=tournament.id).all()
    total_players = Player.query.filter(Player.tournament_id == tournament.id, Player.status != 'pending').count()
    sold_players = Player.query.filter_by(tournament_id=tournament.id, status='sold').count()
    unsold_players = Player.query.filter_by(tournament_id=tournament.id, status='unsold').count()

    # Get recent sold players
    recent_sold = Player.query.filter_by(
        tournament_id=tournament.id, status='sold'
    ).order_by(Player.sold_at.desc()).limit(10).all()

    # Get sponsors and ads
    sponsors = Sponsor.query.filter_by(tournament_id=tournament.id).all()
    ads = Advertisement.query.filter_by(tournament_id=tournament.id, is_active=True).all()

    # Get auction state
    auction_state = AuctionState.query.filter_by(tournament_id=tournament.id).first()

    from flask import make_response
    response = make_response(jsonify({
        'tournament': tournament.to_dict(),
        'stats': {
            'total_teams': len(teams),
            'total_players': total_players,
            'sold_players': sold_players,
            'unsold_players': unsold_players,
        },
        'auction_status': auction_state.status if auction_state else 'not_started',
        'recent_sold': [p.to_dict() for p in recent_sold],
        'sponsors': [s.to_dict() for s in sponsors],
        'advertisements': [a.to_dict() for a in ads],
        'teams': [t.to_dict() for t in teams],
    }))
    response.headers['Cache-Control'] = 'public, max-age=5, stale-while-revalidate=15'
    return response


@public_bp.route('/tournament/<int:tournament_id>/register-player', methods=['POST'])
def register_player_public(tournament_id):
    """Allow players to register themselves for a tournament via shared link."""
    tournament = Tournament.query.get_or_404(tournament_id)
    if not tournament.registration_open:
        return jsonify({'error': 'Registration for this tournament is closed or expired.'}), 403

    # Check if request is JSON or form data
    data = request.form if request.form else (request.get_json() if request.is_json else {})
    
    name = data.get('name')
    village = data.get('village')
    mobile = data.get('mobile')
    playing_style = data.get('playing_style')
    age = data.get('age')
    crickheroes_url = data.get('crickheroes_url')

    if not name or not village or not mobile or not playing_style or not age or not crickheroes_url:
        return jsonify({'error': 'All fields (Name, Village, Mobile, Playing Style, Age, and CricHeroes URL) are required.'}), 400

    mobile_str = str(mobile).strip()
    if not mobile_str.isdigit() or len(mobile_str) != 10:
        return jsonify({'error': 'Mobile number must be exactly 10 digits.'}), 400

    existing_player = Player.query.filter_by(tournament_id=tournament.id, mobile=mobile_str).first()
    if existing_player:
        return jsonify({'error': 'This mobile number is already registered.'}), 400

    if 'photo' not in request.files:
        return jsonify({'error': 'Profile photo is required.'}), 400

    # Extract actual URL from CricHeroes share text
    import re
    if crickheroes_url:
        url_match = re.search(r'https?://[^\s]+', crickheroes_url)
        if url_match:
            crickheroes_url = url_match.group(0)
        elif '.' in crickheroes_url.strip() and ' ' not in crickheroes_url.strip():
            # Bare domain without protocol (e.g. chshare.link/player/xxx)
            crickheroes_url = f'https://{crickheroes_url.strip()}'

    # Create new Player
    player = Player(
        tournament_id=tournament.id,
        name=name.strip(),
        village=village.strip(),
        mobile=mobile_str,
        playing_style=playing_style.strip(),
        age=int(age) if str(age).isdigit() else None,
        crickheroes_url=crickheroes_url.strip() if crickheroes_url else None,
        base_price=tournament.default_base_price if tournament.default_base_price is not None else 1000.0,
        status='pending'
    )

    # Handle photo upload
    from utils import save_upload
    photo_path = save_upload(request.files['photo'], 'players')
    if photo_path:
        player.photo = photo_path
    else:
        return jsonify({'error': 'Failed to save profile photo.'}), 500

    db.session.add(player)
    db.session.commit()

    from app import socketio
    socketio.emit('player:change', {'action': 'registered', 'tournament_id': tournament.id, 'player_id': player.id})

    return jsonify({'message': 'Player registered successfully!', 'player': player.to_dict()}), 201


@public_bp.route('/registration-tournament', methods=['GET'])
def get_registration_tournament():
    """Get the active tournament open for player registration, optionally filtered by secure code."""
    from utils import verify_registration_code
    code = request.args.get('code')
    if code:
        t_id = verify_registration_code(code)
        if not t_id:
            return jsonify({'error': 'Invalid or expired registration link.'}), 400
        tournament = Tournament.query.get(t_id)
        if not tournament or not tournament.registration_open:
            return jsonify({'tournament': None}), 200
        return jsonify({'tournament': tournament.to_dict()}), 200

    tournament = Tournament.query.filter_by(registration_open=True).order_by(Tournament.created_at.desc()).first()
    if not tournament:
        return jsonify({'tournament': None}), 200
    return jsonify({'tournament': tournament.to_dict()}), 200


