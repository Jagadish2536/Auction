import os
import uuid
from werkzeug.utils import secure_filename
from flask import current_app

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
ALLOWED_IMPORT_EXTENSIONS = {'csv', 'xlsx', 'xls'}


def allowed_file(filename, extensions=None):
    """Check if file extension is allowed."""
    if extensions is None:
        extensions = ALLOWED_EXTENSIONS
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in extensions


def save_upload(file, subfolder='photos'):
    """Save uploaded file and return relative path."""
    if not file or not allowed_file(file.filename):
        return None

    upload_dir = os.path.join(current_app.config['UPLOAD_FOLDER'], subfolder)
    os.makedirs(upload_dir, exist_ok=True)

    ext = file.filename.rsplit('.', 1)[1].lower()
    filename = f"{uuid.uuid4().hex}.{ext}"
    filepath = os.path.join(upload_dir, filename)
    file.save(filepath)

    return f"/uploads/{subfolder}/{filename}"


def delete_upload(filepath):
    """Delete an uploaded file."""
    if filepath:
        full_path = os.path.join(os.getcwd(), filepath.lstrip('/'))
        if os.path.exists(full_path):
            os.remove(full_path)


def generate_registration_code(tournament_id):
    """Generate a tamper-proof registration code for a tournament ID."""
    import hashlib
    import base64
    SECRET_SALT = "JV_Cricket_Auction_2026"
    id_str = str(tournament_id)
    sig = hashlib.md5((id_str + SECRET_SALT).encode('utf-8')).hexdigest()[:8]
    combined = f"{id_str}:{sig}"
    return base64.urlsafe_b64encode(combined.encode('utf-8')).decode('utf-8')


def verify_registration_code(code):
    """Verify a tamper-proof registration code and return the decoded tournament ID."""
    import hashlib
    import base64
    SECRET_SALT = "JV_Cricket_Auction_2026"
    if not code:
        return None
    try:
        decoded = base64.urlsafe_b64decode(code.encode('utf-8')).decode('utf-8')
        parts = decoded.split(':')
        if len(parts) != 2:
            return None
        id_str, sig = parts
        expected_sig = hashlib.md5((id_str + SECRET_SALT).encode('utf-8')).hexdigest()[:8]
        if sig == expected_sig:
            return int(id_str)
    except Exception:
        pass
    return None
