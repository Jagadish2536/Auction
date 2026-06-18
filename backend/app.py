import os
from flask import Flask, send_from_directory, make_response
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_socketio import SocketIO
from flask_compress import Compress
from flask_caching import Cache
from config import config

from models.database import db

# Initialize extensions
jwt = JWTManager()
socketio = SocketIO()
compress = Compress()
cache = Cache()


def create_app(config_name=None):
    """Application factory."""
    if config_name is None:
        config_name = os.getenv('FLASK_ENV', 'development')

    app = Flask(__name__, instance_path=os.path.join(os.path.abspath(os.path.dirname(__file__)), 'instance'))
    app.config.from_object(config[config_name])

    # --- Performance: Compression config ---
    app.config['COMPRESS_MIMETYPES'] = [
        'text/html', 'text/css', 'text/xml',
        'application/json', 'application/javascript',
        'application/xml', 'text/javascript'
    ]
    app.config['COMPRESS_LEVEL'] = 6
    app.config['COMPRESS_MIN_SIZE'] = 500

    # --- Performance: SQLAlchemy connection pool ---
    # Production pool config comes from ProductionConfig.SQLALCHEMY_ENGINE_OPTIONS
    # This is the dev fallback for SQLite
    if 'SQLALCHEMY_ENGINE_OPTIONS' not in app.config or not app.config.get('SQLALCHEMY_ENGINE_OPTIONS'):
        app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
            'pool_size': 30,
            'max_overflow': 60,
            'pool_recycle': 300,
            'pool_pre_ping': True,
        }

    # --- Performance: In-memory cache (SimpleCache, zero dependencies) ---
    app.config['CACHE_TYPE'] = 'SimpleCache'
    app.config['CACHE_DEFAULT_TIMEOUT'] = 10

    # Initialize extensions
    db.init_app(app)
    jwt.init_app(app)
    compress.init_app(app)
    cache.init_app(app)
    CORS(app, resources={r"/api/*": {"origins": app.config['FRONTEND_URL']}},
         supports_credentials=True)

    # Socket.IO: use Redis message queue in production for scalability
    redis_url = app.config.get('REDIS_URL')
    socketio_kwargs = dict(
        cors_allowed_origins=app.config['FRONTEND_URL'],
        async_mode='eventlet',
        logger=False,
        engineio_logger=False,
        ping_timeout=60,
        ping_interval=25,
        max_http_buffer_size=1_000_000,  # 1MB max message size
    )
    if redis_url:
        socketio_kwargs['message_queue'] = redis_url
    socketio.init_app(app, **socketio_kwargs)

    # Create upload directory
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

    # Serve uploaded files with aggressive browser caching (1 year)
    @app.route('/uploads/<path:filename>')
    def serve_upload(filename):
        response = make_response(
            send_from_directory(app.config['UPLOAD_FOLDER'], filename)
        )
        response.headers['Cache-Control'] = 'public, max-age=31536000, immutable'
        response.headers['Vary'] = 'Accept-Encoding'
        return response

    # Health check
    @app.route('/api/health')
    def health():
        return {'status': 'ok', 'message': 'JV Cricket Auction API is running'}

    # Register blueprints
    from routes.auth import auth_bp
    from routes.tournaments import tournaments_bp
    from routes.teams import teams_bp
    from routes.players import players_bp
    from routes.users import users_bp
    from routes.public import public_bp
    from routes.analytics import analytics_bp
    from routes.reports import reports_bp
    from routes.sponsors import sponsors_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(tournaments_bp)
    app.register_blueprint(teams_bp)
    app.register_blueprint(players_bp)
    app.register_blueprint(users_bp)
    app.register_blueprint(public_bp)
    app.register_blueprint(analytics_bp)
    app.register_blueprint(reports_bp)
    app.register_blueprint(sponsors_bp)

    # Register Socket.IO events
    from sockets.auction import register_auction_events
    register_auction_events(socketio)

    # Create database tables
    with app.app_context():
        # Import all models so they are registered
        from models.user import User
        from models.tournament import Tournament
        from models.team import Team
        from models.player import Player
        from models.auction import AuctionState, BidHistory, Sponsor, Advertisement, AuditLog, Setting

        db.create_all()

        # Check and apply migrations for tournaments table columns
        try:
            from sqlalchemy import inspect
            inspector = inspect(db.engine)
            if 'tournaments' in inspector.get_table_names():
                columns = [c['name'] for c in inspector.get_columns('tournaments')]
                with db.engine.connect() as conn:
                    if 'players_per_team' not in columns:
                        conn.execute(db.text("ALTER TABLE tournaments ADD COLUMN players_per_team INTEGER DEFAULT 15"))
                    if 'venue_address' not in columns:
                        conn.execute(db.text("ALTER TABLE tournaments ADD COLUMN venue_address VARCHAR(500)"))
                    if 'bid_increment' not in columns:
                        conn.execute(db.text("ALTER TABLE tournaments ADD COLUMN bid_increment INTEGER DEFAULT 1000"))
                    if 'team_budget' not in columns:
                        conn.execute(db.text("ALTER TABLE tournaments ADD COLUMN team_budget FLOAT DEFAULT 1000000"))
                    if 'default_base_price' not in columns:
                        conn.execute(db.text("ALTER TABLE tournaments ADD COLUMN default_base_price FLOAT DEFAULT 1000"))
                    if 'registration_open' not in columns:
                        conn.execute(db.text("ALTER TABLE tournaments ADD COLUMN registration_open BOOLEAN DEFAULT 0"))
                    conn.commit()
                    print("[INFO] Database columns migrated successfully.")

            # Check and apply migrations for users table columns
            if 'users' in inspector.get_table_names():
                columns = [c['name'] for c in inspector.get_columns('users')]
                with db.engine.connect() as conn:
                    if 'tournament_id' not in columns:
                        conn.execute(db.text("ALTER TABLE users ADD COLUMN tournament_id INTEGER REFERENCES tournaments(id) ON DELETE SET NULL"))
                        conn.commit()
                        print("[INFO] Added tournament_id column to users table.")

                    migrated_perms = False
                    for perm in ['perm_teams', 'perm_players', 'perm_auction', 'perm_sponsors', 'perm_analytics', 'perm_reports']:
                        if perm not in columns:
                            conn.execute(db.text(f"ALTER TABLE users ADD COLUMN {perm} BOOLEAN DEFAULT 1"))
                            migrated_perms = True
                    if migrated_perms:
                        conn.commit()
                        print("[INFO] Added permission columns to users table.")

            # Check and apply migrations for players table columns
            if 'players' in inspector.get_table_names():
                columns = [c['name'] for c in inspector.get_columns('players')]
                with db.engine.connect() as conn:
                    if 'crickheroes_url' not in columns:
                        conn.execute(db.text("ALTER TABLE players ADD COLUMN crickheroes_url VARCHAR(500)"))
                        conn.commit()
                        print("[INFO] Added crickheroes_url column to players table.")

            # Check and apply migrations for sponsors table columns
            if 'sponsors' in inspector.get_table_names():
                columns = [c['name'] for c in inspector.get_columns('sponsors')]
                with db.engine.connect() as conn:
                    if 'description' not in columns:
                        conn.execute(db.text("ALTER TABLE sponsors ADD COLUMN description TEXT"))
                        conn.commit()
                        print("[INFO] Added description column to sponsors table.")
        except Exception as e:
            print(f"[ERROR] Failed to run database migrations: {e}")

        # Seed manager account
        from seed import seed_manager
        seed_manager(app)

    # Optimized before_request: skip for public/static routes immediately
    @app.before_request
    def check_tournament_access():
        from flask import request, jsonify
        path = request.path
        # Fast-path: skip auth checks for public & static routes
        if path.startswith('/api/public/') or path.startswith('/uploads/') or path == '/api/health':
            return
        try:
            from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity
            from models.user import User
            verify_jwt_in_request(optional=True)
            user_id = get_jwt_identity()
            if user_id:
                user = User.query.get(user_id)
                if user and user.is_active and user.role == 'admin':
                    # Check feature permissions
                    if '/teams' in path and not user.perm_teams:
                        return jsonify({'error': 'Permission denied: Teams module is disabled'}), 403
                    elif '/players' in path and not user.perm_players:
                        return jsonify({'error': 'Permission denied: Players module is disabled'}), 403
                    elif '/sponsors' in path and not user.perm_sponsors:
                        return jsonify({'error': 'Permission denied: Sponsors module is disabled'}), 403
                    elif path.startswith('/api/analytics') and not user.perm_analytics:
                        return jsonify({'error': 'Permission denied: Analytics module is disabled'}), 403
                    elif path.startswith('/api/reports') and not user.perm_reports:
                        return jsonify({'error': 'Permission denied: Reports module is disabled'}), 403

                    # Check tournament scoping
                    if user.tournament_id and request.view_args and 'tournament_id' in request.view_args:
                        req_tid = request.view_args['tournament_id']
                        if int(req_tid) != user.tournament_id:
                            return jsonify({'error': 'Insufficient permissions for this tournament'}), 403
        except Exception:
            pass

    return app


app = create_app()

if __name__ == '__main__':
    print('[INFO] JV Cricket Auction Platform - Backend')
    print('[INFO] Server running at http://localhost:5000')
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)
