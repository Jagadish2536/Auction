import os
import uuid
import boto3
from botocore.exceptions import ClientError
from werkzeug.utils import secure_filename
from flask import current_app

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
ALLOWED_IMPORT_EXTENSIONS = {'csv', 'xlsx', 'xls'}


def allowed_file(filename, extensions=None):
    """Check if file extension is allowed."""
    if extensions is None:
        extensions = ALLOWED_EXTENSIONS
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in extensions


def _get_s3_client():
    """Get boto3 S3 client if AWS credentials are configured."""
    bucket = current_app.config.get('AWS_S3_BUCKET')
    if not bucket:
        return None, None
    s3 = boto3.client(
        's3',
        region_name=current_app.config.get('AWS_REGION', 'ap-south-2'),
    )
    return s3, bucket


def save_upload(file, subfolder='photos'):
    """Save uploaded file to S3 (production) or local filesystem (development).
    Returns the URL/path to the saved file."""
    if not file or not allowed_file(file.filename):
        return None

    ext = file.filename.rsplit('.', 1)[1].lower()
    filename = f"{uuid.uuid4().hex}.{ext}"
    key = f"uploads/{subfolder}/{filename}"

    # Try to optimize/compress image if subfolder is players, team_logos, sponsors, or logos
    optimized_data = None
    if subfolder in ('players', 'team_logos', 'sponsors', 'logos'):
        try:
            from PIL import Image
            import io
            
            # Reset file stream position
            file.seek(0)
            img = Image.open(file.stream)
            
            # Convert to RGB mode (needed for saving as JPEG if source is PNG/RGBA)
            if img.mode in ('RGBA', 'LA'):
                background = Image.new('RGB', img.size, (255, 255, 255))
                background.paste(img, mask=img.split()[3] if len(img.split()) > 3 else None)
                img = background
            elif img.mode != 'RGB':
                img = img.convert('RGB')
            
            # Resize image maintaining aspect ratio (e.g. max 1000px width/height)
            img.thumbnail((1000, 1000), Image.Resampling.LANCZOS)
            
            # Save to in-memory bytes stream
            buffer = io.BytesIO()
            img.save(buffer, format='JPEG', quality=85, optimize=True)
            buffer.seek(0)
            
            optimized_data = buffer
            ext = 'jpg'
            filename = f"{uuid.uuid4().hex}.jpg"
            key = f"uploads/{subfolder}/{filename}"
        except Exception as e:
            current_app.logger.warning(f"Image optimization skipped/failed: {e}")
            file.seek(0)

    s3, bucket = _get_s3_client()

    if s3 and bucket:
        # Production: upload to S3
        try:
            upload_source = optimized_data if optimized_data else file
            content_type = 'image/jpeg' if optimized_data else (file.content_type or 'image/jpeg')
            s3.upload_fileobj(
                upload_source,
                bucket,
                key,
                ExtraArgs={
                    'ContentType': content_type,
                    'CacheControl': 'public, max-age=31536000',
                }
            )
            region = current_app.config.get('AWS_REGION', 'ap-south-2')
            return f"https://{bucket}.s3.{region}.amazonaws.com/{key}"
        except ClientError as e:
            current_app.logger.error(f"S3 upload failed: {e}")
            return None
    else:
        # Development: save locally
        upload_dir = os.path.join(current_app.config['UPLOAD_FOLDER'], subfolder)
        os.makedirs(upload_dir, exist_ok=True)
        filepath = os.path.join(upload_dir, filename)
        if optimized_data:
            with open(filepath, 'wb') as f:
                f.write(optimized_data.getvalue())
        else:
            file.save(filepath)
        return f"/uploads/{subfolder}/{filename}"


def delete_upload(filepath):
    """Delete an uploaded file from S3 or local filesystem."""
    if not filepath:
        return

    s3, bucket = _get_s3_client()

    if s3 and bucket and filepath.startswith('https://'):
        # Production: delete from S3
        try:
            # Extract key from full S3 URL
            # URL format: https://bucket.s3.region.amazonaws.com/uploads/subfolder/file.ext
            key = filepath.split('.amazonaws.com/', 1)[-1]
            s3.delete_object(Bucket=bucket, Key=key)
        except ClientError as e:
            current_app.logger.error(f"S3 delete failed: {e}")
    else:
        # Development: delete locally
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


def clear_tournament_caches(tournament_id):
    """Clear Flask-Caching keys for public pages and analytics of a tournament."""
    if not tournament_id:
        return
    try:
        from flask import current_app
        cache = None
        if "cache" in current_app.extensions:
            caches = list(current_app.extensions["cache"].keys())
            if caches:
                cache = caches[0]
        if not cache:
            # Fallback import to avoid circular dependency
            from app import cache
        if cache:
            cache.delete(f'public_players_{tournament_id}')
            cache.delete(f'live_state_{tournament_id}')
            cache.delete(f'analytics_dashboard_{tournament_id}')
            cache.delete('public_tournaments_list')
            print(f"[INFO] Cleared public/analytics cache for tournament {tournament_id}")
    except Exception as e:
        print(f"[WARNING] Failed to clear cache for tournament {tournament_id}: {e}")

