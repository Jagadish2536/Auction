from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from models.database import db
from models.auction import Sponsor
from middleware import role_required, tournament_scope_required
from utils import save_upload, delete_upload

sponsors_bp = Blueprint('sponsors', __name__, url_prefix='/api/tournaments/<int:tournament_id>/sponsors')


@sponsors_bp.route('', methods=['GET'])
@jwt_required()
@tournament_scope_required
def get_sponsors(tournament_id):
    """Get all sponsors for a tournament."""
    sponsors = Sponsor.query.filter_by(tournament_id=tournament_id).order_by(Sponsor.created_at.desc()).all()
    return jsonify({'sponsors': [s.to_dict() for s in sponsors]}), 200


@sponsors_bp.route('', methods=['POST'])
@role_required('manager', 'admin')
@tournament_scope_required
def create_sponsor(tournament_id):
    """Create a new sponsor."""
    data = request.form if request.form else request.get_json()

    name = data.get('name')
    if not name:
        return jsonify({'error': 'Sponsor name is required'}), 400

    sponsor = Sponsor(
        tournament_id=tournament_id,
        name=name,
        url=data.get('url'),
        tier=data.get('tier', 'silver'),
        description=data.get('description')
    )

    if hasattr(request, 'files') and 'logo' in request.files:
        logo_path = save_upload(request.files['logo'], 'sponsors')
        if logo_path:
             sponsor.logo = logo_path

    db.session.add(sponsor)
    db.session.commit()
    return jsonify({'sponsor': sponsor.to_dict(), 'message': 'Sponsor created successfully'}), 201


@sponsors_bp.route('/<int:sponsor_id>', methods=['PUT'])
@role_required('manager', 'admin')
@tournament_scope_required
def update_sponsor(tournament_id, sponsor_id):
    """Update a sponsor."""
    sponsor = Sponsor.query.filter_by(id=sponsor_id, tournament_id=tournament_id).first_or_404()
    data = request.form if request.form else request.get_json()

    if data.get('name'):
        sponsor.name = data['name']
    if data.get('url') is not None:
        sponsor.url = data.get('url')
    if data.get('tier') is not None:
        sponsor.tier = data.get('tier')
    if 'description' in data:
        sponsor.description = data['description']

    if hasattr(request, 'files') and 'logo' in request.files:
        logo_path = save_upload(request.files['logo'], 'sponsors')
        if logo_path:
            if sponsor.logo:
                try:
                    delete_upload(sponsor.logo)
                except Exception:
                    pass
            sponsor.logo = logo_path

    db.session.commit()
    return jsonify({'sponsor': sponsor.to_dict(), 'message': 'Sponsor updated successfully'}), 200


@sponsors_bp.route('/<int:sponsor_id>', methods=['DELETE'])
@role_required('manager', 'admin')
@tournament_scope_required
def delete_sponsor(tournament_id, sponsor_id):
    """Delete a sponsor."""
    sponsor = Sponsor.query.filter_by(id=sponsor_id, tournament_id=tournament_id).first_or_404()

    if sponsor.logo:
        try:
            delete_upload(sponsor.logo)
        except Exception:
            pass

    db.session.delete(sponsor)
    db.session.commit()
    return jsonify({'message': 'Sponsor deleted successfully'}), 200
