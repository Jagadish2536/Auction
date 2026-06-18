from flask_bcrypt import Bcrypt
from models.database import db
from models.user import User

bcrypt = Bcrypt()


def seed_manager(app):
    """Seed the default manager account on first startup."""
    with app.app_context():
        email = app.config.get('MANAGER_EMAIL', 'jagadishvarma99@gmail.com')
        password = app.config.get('MANAGER_PASSWORD', 'Jagadish223@')

        existing = User.query.filter_by(email=email).first()
        if not existing:
            manager = User(
                email=email,
                password_hash=bcrypt.generate_password_hash(password).decode('utf-8'),
                name='Jagadish Varma',
                role='manager',
                is_active=True
            )
            db.session.add(manager)
            db.session.commit()
            print(f'[SUCCESS] Manager account seeded: {email}')
        else:
            print(f'[INFO] Manager account already exists: {email}')
