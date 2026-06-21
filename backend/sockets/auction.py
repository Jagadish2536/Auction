from datetime import datetime
from flask import request
from flask_socketio import emit, join_room, leave_room
from sqlalchemy import func
from sqlalchemy.orm import joinedload
from models.database import db
from models.auction import AuctionState, BidHistory
from models.player import Player
from models.team import Team
from models.tournament import Tournament
from utils import clear_tournament_caches


# In-memory tracking — all keyed by tournament_id for perfect isolation
active_viewers = {}       # tournament_id -> set of sids
client_tournaments = {}   # sid -> tournament_id
_timer_threads = {}       # tournament_id -> greenthread handle
auction_history = {}      # tournament_id -> list of {'message': msg, 'type': type}


def _broadcast_message(socketio, tournament_id, message, msg_type='info'):
    """Helper to add message to tournament history and broadcast it to the room."""
    payload = {'message': message, 'type': msg_type}
    hist = auction_history.setdefault(tournament_id, [])
    hist.insert(0, payload)
    if len(hist) > 100:
        auction_history[tournament_id] = hist[:100]
    socketio.emit('auction:message', payload, room=f'auction_{tournament_id}')


# ─────────────────────────────────────────────────────────
# Server-Side Timer (per tournament, isolated greenthreads)
# ─────────────────────────────────────────────────────────

def _cancel_timer(tournament_id):
    """Cancel any running server timer for a tournament."""
    t = _timer_threads.pop(tournament_id, None)
    if t:
        try:
            t.kill()
        except Exception:
            pass


def _start_server_timer(socketio, tournament_id, seconds=30):
    """
    Start an isolated server-side countdown for one tournament room.
    Each tournament gets its own greenthread — they never interfere.
    """
    import eventlet

    _cancel_timer(tournament_id)  # Cancel any previous timer for this tournament

    def _countdown():
        remaining = seconds
        room = f'auction_{tournament_id}'
        while remaining >= 0:
            socketio.emit('auction:timer', {'remaining': remaining}, room=room)
            if remaining == 0:
                # Timer expired — notify room
                _broadcast_message(socketio, tournament_id, '⏰ Time is up! Sell or mark unsold.', 'warning')
                break
            eventlet.sleep(1)
            remaining -= 1

        # Clean up our own thread reference when done
        _timer_threads.pop(tournament_id, None)

    thread = eventlet.spawn(_countdown)
    _timer_threads[tournament_id] = thread


# ─────────────────────────────────────────────────────────
# Optimized State Builder — minimal DB queries, slim payload
# ─────────────────────────────────────────────────────────

def _get_full_state(tournament_id):
    """
    Build complete auction state payload with minimal DB queries.
    Uses joined loads and grouped count queries — exactly 4 queries
    regardless of team count, scales to 100+ simultaneous tournaments.
    """
    state = AuctionState.query.filter_by(tournament_id=tournament_id).first()

    # Single query for all teams (indexed on tournament_id)
    teams = Team.query.filter_by(tournament_id=tournament_id).all()

    # Recent sold — slim payload (5 fields only, not full to_dict)
    recent_sold_rows = (
        Player.query
        .filter_by(tournament_id=tournament_id, status='sold')
        .order_by(Player.sold_at.desc())
        .with_entities(Player.id, Player.name, Player.village,
                       Player.sold_price, Player.sold_team_id, Player.photo)
        .limit(15)
        .all()
    )

    # Build team name lookup to avoid N+1 on sold players
    team_name_map = {t.id: t.name for t in teams}

    recent_sold = [
        {
            'id': r.id,
            'name': r.name,
            'village': r.village,
            'sold_price': r.sold_price,
            'sold_team_name': team_name_map.get(r.sold_team_id),
            'photo': r.photo,
        }
        for r in recent_sold_rows
    ]

    # Single grouped count query — replaces 3 separate count() calls
    status_counts = (
        db.session.query(Player.status, func.count(Player.id))
        .filter(Player.tournament_id == tournament_id, Player.status != 'pending')
        .group_by(Player.status)
        .all()
    )
    counts = {row[0]: row[1] for row in status_counts}

    # Batch player counts per team — single GROUP BY query replaces N separate COUNT(*)
    # This eliminates the N+1 query from team.player_count property
    team_player_counts_rows = (
        db.session.query(Player.sold_team_id, func.count(Player.id))
        .filter(Player.tournament_id == tournament_id, Player.status == 'sold')
        .group_by(Player.sold_team_id)
        .all()
    )
    team_player_counts = {row[0]: row[1] for row in team_player_counts_rows}

    return {
        'auction': state.to_dict() if state else None,
        'teams': [t.to_dict(player_count_override=team_player_counts.get(t.id, 0)) for t in teams],
        'recent_sold': recent_sold,
        'stats': {
            'total': sum(counts.values()),
            'available': counts.get('available', 0),
            'sold': counts.get('sold', 0),
            'unsold': counts.get('unsold', 0),
        }
    }


# ─────────────────────────────────────────────────────────
# Tournament Ownership Validator
# ─────────────────────────────────────────────────────────

def _validate_ownership(tournament_id, player_id=None, team_id=None):
    """
    Ensure player/team actually belong to the claimed tournament.
    Prevents cross-tournament data manipulation.
    Returns (player, team, error_msg).
    """
    player = None
    team = None

    if player_id:
        player = Player.query.filter_by(
            id=player_id, tournament_id=tournament_id
        ).first()
        if not player:
            return None, None, f'Player {player_id} does not belong to tournament {tournament_id}'

    if team_id:
        team = Team.query.filter_by(
            id=team_id, tournament_id=tournament_id
        ).first()
        if not team:
            return None, None, f'Team {team_id} does not belong to tournament {tournament_id}'

    return player, team, None


# ─────────────────────────────────────────────────────────
# Socket.IO Event Registration
# ─────────────────────────────────────────────────────────

def register_auction_events(socketio):
    """Register all auction Socket.IO events."""

    @socketio.on('connect')
    def handle_connect():
        emit('connected', {'sid': request.sid})

    @socketio.on('disconnect')
    def handle_disconnect():
        sid = request.sid
        if sid in client_tournaments:
            t_id = client_tournaments.pop(sid)
            if t_id in active_viewers:
                active_viewers[t_id].discard(sid)
                count = len(active_viewers[t_id])
                socketio.emit('auction:viewer_count', {'count': count},
                              room=f'auction_{t_id}')

    @socketio.on('join_auction')
    def handle_join(data):
        tournament_id = data.get('tournament_id')
        if not tournament_id:
            return
        try:
            t_id = int(tournament_id)
        except (ValueError, TypeError):
            return

        room = f'auction_{t_id}'
        join_room(room)

        sid = request.sid
        client_tournaments[sid] = t_id
        active_viewers.setdefault(t_id, set()).add(sid)

        # Broadcast updated viewer count to this room only
        socketio.emit('auction:viewer_count',
                      {'count': len(active_viewers[t_id])}, room=room)

        # Send current state to the joining client only
        state = AuctionState.query.filter_by(tournament_id=t_id).first()
        if state:
            emit('auction:state', _get_full_state(t_id))
            emit('auction:history', {'messages': auction_history.get(t_id, [])})

    @socketio.on('leave_auction')
    def handle_leave(data):
        tournament_id = data.get('tournament_id')
        if not tournament_id:
            return
        try:
            t_id = int(tournament_id)
        except (ValueError, TypeError):
            return

        room = f'auction_{t_id}'
        leave_room(room)

        sid = request.sid
        client_tournaments.pop(sid, None)
        if t_id in active_viewers:
            active_viewers[t_id].discard(sid)
            socketio.emit('auction:viewer_count',
                          {'count': len(active_viewers[t_id])}, room=room)

    # ── Auction Lifecycle ──────────────────────────────────

    @socketio.on('auction:start')
    def handle_start(data):
        tournament_id = data.get('tournament_id')
        state = AuctionState.query.filter_by(tournament_id=tournament_id).first()
        if not state:
            emit('auction:error', {'error': 'Auction not found'})
            return
        state.status = 'live'
        tournament = Tournament.query.get(tournament_id)
        if tournament:
            tournament.status = 'auction_live'
            tournament.registration_open = False
        db.session.commit()
        clear_tournament_caches(tournament_id)
        socketio.emit('tournament:change', {'action': 'live', 'tournament_id': tournament_id})
        room = f'auction_{tournament_id}'
        socketio.emit('auction:state', _get_full_state(tournament_id), room=room)
        _broadcast_message(socketio, tournament_id, '🏏 Auction has started!', 'success')

    @socketio.on('auction:pause')
    def handle_pause(data):
        tournament_id = data.get('tournament_id')
        state = AuctionState.query.filter_by(tournament_id=tournament_id).first()
        if state:
            state.status = 'paused'
            tournament = Tournament.query.get(tournament_id)
            if tournament:
                tournament.status = 'auction_paused'
            db.session.commit()
            _cancel_timer(tournament_id)  # Stop the server timer
            clear_tournament_caches(tournament_id)
            socketio.emit('tournament:change', {'action': 'paused', 'tournament_id': tournament_id})
            room = f'auction_{tournament_id}'
            socketio.emit('auction:state', _get_full_state(tournament_id), room=room)
            _broadcast_message(socketio, tournament_id, '⏸️ Auction paused', 'warning')

    @socketio.on('auction:resume')
    def handle_resume(data):
        tournament_id = data.get('tournament_id')
        state = AuctionState.query.filter_by(tournament_id=tournament_id).first()
        if state:
            state.status = 'live'
            tournament = Tournament.query.get(tournament_id)
            if tournament:
                tournament.status = 'auction_live'
            db.session.commit()
            clear_tournament_caches(tournament_id)
            socketio.emit('tournament:change', {'action': 'live', 'tournament_id': tournament_id})
            room = f'auction_{tournament_id}'
            socketio.emit('auction:state', _get_full_state(tournament_id), room=room)
            _broadcast_message(socketio, tournament_id, '▶️ Auction resumed', 'success')
            # Restart timer if a player is currently up
            if state.current_player_id:
                _start_server_timer(socketio, tournament_id, state.timer_remaining or 30)

    @socketio.on('auction:end')
    def handle_end(data):
        tournament_id = data.get('tournament_id')
        state = AuctionState.query.filter_by(tournament_id=tournament_id).first()
        if state:
            state.status = 'ended'
            state.current_player_id = None
            state.current_bid = 0
            state.current_team_id = None
            tournament = Tournament.query.get(tournament_id)
            if tournament:
                tournament.status = 'auction_ended'
            Player.query.filter_by(
                tournament_id=tournament_id, status='available'
            ).update({Player.status: 'unsold'})
            db.session.commit()
            _cancel_timer(tournament_id)
            clear_tournament_caches(tournament_id)
            socketio.emit('player:change', {'action': 'ended', 'tournament_id': tournament_id})
            socketio.emit('tournament:change', {'action': 'ended', 'tournament_id': tournament_id})
            room = f'auction_{tournament_id}'
            socketio.emit('auction:state', _get_full_state(tournament_id), room=room)
            _broadcast_message(socketio, tournament_id, '🏁 Auction has ended! Remaining available players marked as Unsold.', 'info')

    @socketio.on('auction:reopen')
    def handle_reopen(data):
        tournament_id = data.get('tournament_id')
        state = AuctionState.query.filter_by(tournament_id=tournament_id).first()
        if state:
            state.status = 'live'
            tournament = Tournament.query.get(tournament_id)
            if tournament:
                tournament.status = 'auction_live'
            db.session.commit()
            room = f'auction_{tournament_id}'
            socketio.emit('auction:state', _get_full_state(tournament_id), room=room)
            _broadcast_message(socketio, tournament_id, '🔄 Auction reopened!', 'success')

    @socketio.on('auction:move_available_to_unsold')
    def handle_move_available_to_unsold(data):
        tournament_id = data.get('tournament_id')
        Player.query.filter_by(
            tournament_id=tournament_id, status='available'
        ).update({Player.status: 'unsold'})
        db.session.commit()
        clear_tournament_caches(tournament_id)
        socketio.emit('player:change', {'action': 'bulk_unsold', 'tournament_id': tournament_id})
        room = f'auction_{tournament_id}'
        socketio.emit('auction:state', _get_full_state(tournament_id), room=room)
        _broadcast_message(socketio, tournament_id, '⚡ All remaining available players moved to Unsold.', 'success')

    # ── Player Selection ────────────────────────────────────

    @socketio.on('auction:select_player')
    def handle_select_player(data):
        tournament_id = data.get('tournament_id')
        player_id = data.get('player_id')

        # ✅ Ownership validation — prevents cross-tournament player injection
        player, _, err = _validate_ownership(tournament_id, player_id=player_id)
        if err:
            emit('auction:error', {'error': err})
            return

        state = AuctionState.query.filter_by(tournament_id=tournament_id).first()
        if not state:
            emit('auction:error', {'error': 'Auction not found'})
            return

        state.current_player_id = player_id
        state.current_bid = player.base_price
        state.current_team_id = None
        state.timer_remaining = 30
        db.session.commit()

        room = f'auction_{tournament_id}'
        socketio.emit('auction:state', _get_full_state(tournament_id), room=room)
        _broadcast_message(socketio, tournament_id, f'🎯 {player.name} is up for auction! Base price: ₹{player.base_price:,.0f}', 'info')

        # Start server-side timer for THIS tournament only
        _start_server_timer(socketio, tournament_id, 30)

    # ── Bidding ─────────────────────────────────────────────

    @socketio.on('auction:place_bid')
    def handle_bid(data):
        tournament_id = data.get('tournament_id')
        team_id = data.get('team_id')
        amount = data.get('amount', 0)

        state = AuctionState.query.filter_by(tournament_id=tournament_id).first()
        if not state:
            emit('auction:error', {'error': 'Auction not found'})
            return

        # ✅ Ownership validation — team must belong to THIS tournament
        _, team, err = _validate_ownership(tournament_id, team_id=team_id)
        if err:
            emit('auction:error', {'error': err})
            return

        if state.status != 'live':
            emit('auction:error', {'error': 'Auction is not live'})
            return
        if not state.current_player_id:
            emit('auction:error', {'error': 'No player selected'})
            return

        tournament = Tournament.query.get(tournament_id)
        bid_incr = tournament.bid_increment if (tournament and tournament.bid_increment) else 1000

        # Bid amount validation
        if state.current_team_id is None:
            if amount < state.current_bid:
                emit('auction:error', {'error': f'First bid must be at least base price ₹{state.current_bid:,.0f}'})
                return
            if int(amount - state.current_bid) % int(bid_incr) != 0:
                emit('auction:error', {'error': f'Bid must be in increments of ₹{bid_incr:,.0f} relative to base price'})
                return
        else:
            if amount < state.current_bid + bid_incr:
                emit('auction:error', {'error': f'Bid must be at least ₹{state.current_bid + bid_incr:,.0f}'})
                return
            if int(amount - state.current_bid) % int(bid_incr) != 0:
                emit('auction:error', {'error': f'Bid must be in increments of ₹{bid_incr:,.0f} relative to current bid'})
                return

        # Calculate max bid to ensure squad can be filled
        left = max(0, team.max_players - team.player_count)
        base_price = tournament.default_base_price if (tournament and tournament.default_base_price is not None) else 1000.0
        
        if left <= 1:
            max_bid = team.remaining_budget
        else:
            max_bid = team.remaining_budget - (left - 1) * base_price
        max_bid = max(0.0, max_bid)

        if amount > max_bid:
            emit('auction:error', {'error': f'Bid ₹{amount:,.0f} exceeds maximum allowed bid (₹{max_bid:,.0f}) for {team.name} to complete squad.'})
            return

        if amount > team.remaining_budget:
            emit('auction:error', {'error': f'Insufficient budget. Remaining: ₹{team.remaining_budget:,.0f}'})
            return
        if team.player_count >= team.max_players:
            emit('auction:error', {'error': f'{team.name} has reached max players ({team.max_players})'})
            return
        if state.current_team_id == team_id:
            emit('auction:error', {'error': 'You are already the highest bidder'})
            return

        state.current_bid = amount
        state.current_team_id = team_id
        state.timer_remaining = 30

        bid = BidHistory(
            player_id=state.current_player_id,
            team_id=team_id,
            amount=amount,
            tournament_id=tournament_id
        )
        db.session.add(bid)
        db.session.commit()

        room = f'auction_{tournament_id}'
        socketio.emit('auction:state', _get_full_state(tournament_id), room=room)
        _broadcast_message(socketio, tournament_id, f'💰 {team.name} bids ₹{amount:,.0f}!', 'bid')

        # Restart server timer for this tournament (bid resets clock)
        _start_server_timer(socketio, tournament_id, 30)

    # ── Sell / Unsold ───────────────────────────────────────

    @socketio.on('auction:sell')
    def handle_sell(data):
        tournament_id = data.get('tournament_id')
        state = AuctionState.query.filter_by(tournament_id=tournament_id).first()

        if not state or not state.current_player_id or not state.current_team_id:
            emit('auction:error', {'error': 'No valid bid to confirm'})
            return

        # ✅ Ownership validation
        player, team, err = _validate_ownership(
            tournament_id,
            player_id=state.current_player_id,
            team_id=state.current_team_id
        )
        if err:
            emit('auction:error', {'error': err})
            return

        player.status = 'sold'
        player.sold_team_id = team.id
        player.sold_price = state.current_bid
        player.sold_at = datetime.utcnow()
        team.remaining_budget -= state.current_bid

        state.current_player_id = None
        state.current_bid = 0
        state.current_team_id = None
        state.timer_remaining = 30
        db.session.commit()

        _cancel_timer(tournament_id)
        clear_tournament_caches(tournament_id)
        socketio.emit('player:change', {'action': 'sold', 'tournament_id': tournament_id, 'player_id': player.id})
        socketio.emit('team:change', {'action': 'updated', 'tournament_id': tournament_id, 'team_id': team.id})

        room = f'auction_{tournament_id}'
        socketio.emit('auction:state', _get_full_state(tournament_id), room=room)
        _broadcast_message(socketio, tournament_id, f'🎉 SOLD! {player.name} → {team.name} for ₹{player.sold_price:,.0f}!', 'sold')

    @socketio.on('auction:mark_unsold')
    def handle_unsold(data):
        tournament_id = data.get('tournament_id')
        state = AuctionState.query.filter_by(tournament_id=tournament_id).first()

        if not state or not state.current_player_id:
            emit('auction:error', {'error': 'No player selected'})
            return

        # ✅ Ownership validation
        player, _, err = _validate_ownership(
            tournament_id, player_id=state.current_player_id
        )
        if err:
            emit('auction:error', {'error': err})
            return

        player.status = 'unsold'
        state.current_player_id = None
        state.current_bid = 0
        state.current_team_id = None
        state.timer_remaining = 30
        db.session.commit()

        _cancel_timer(tournament_id)
        clear_tournament_caches(tournament_id)
        socketio.emit('player:change', {'action': 'unsold', 'tournament_id': tournament_id, 'player_id': player.id})

        room = f'auction_{tournament_id}'
        socketio.emit('auction:state', _get_full_state(tournament_id), room=room)
        _broadcast_message(socketio, tournament_id, f'❌ {player.name} goes UNSOLD', 'unsold')

    # ── Undo Sale ───────────────────────────────────────────

    @socketio.on('auction:undo_sale')
    def handle_undo(data):
        tournament_id = data.get('tournament_id')
        last_sold = Player.query.filter_by(
            tournament_id=tournament_id, status='sold'
        ).order_by(Player.sold_at.desc()).first()

        if not last_sold:
            emit('auction:error', {'error': 'No sales to undo'})
            return

        # ✅ Ownership validation — ensure undo target belongs to this tournament
        if last_sold.tournament_id != int(tournament_id):
            emit('auction:error', {'error': 'Player does not belong to this tournament'})
            return

        team = Team.query.filter_by(
            id=last_sold.sold_team_id, tournament_id=tournament_id
        ).first()
        if team:
            team.remaining_budget += last_sold.sold_price

        player_name = last_sold.name
        team_name = team.name if team else 'Unknown'
        last_sold.status = 'available'
        last_sold.sold_team_id = None
        last_sold.sold_price = None
        last_sold.sold_at = None
        db.session.commit()
        clear_tournament_caches(tournament_id)
        socketio.emit('player:change', {'action': 'undone', 'tournament_id': tournament_id, 'player_id': last_sold.id})
        if team:
            socketio.emit('team:change', {'action': 'updated', 'tournament_id': tournament_id, 'team_id': team.id})

        room = f'auction_{tournament_id}'
        socketio.emit('auction:state', _get_full_state(tournament_id), room=room)
        _broadcast_message(socketio, tournament_id, f'↩️ Sale undone: {player_name} removed from {team_name}', 'warning')

    # ── Timer tick (DEPRECATED — server now drives timers) ──
    # Kept as a no-op to avoid errors from older clients that still send it
    @socketio.on('auction:timer_tick')
    def handle_timer_tick(data):
        pass  # Server-side timer handles this now
