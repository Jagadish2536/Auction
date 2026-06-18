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
        aws_access_key_id=current_app.config.get('AWS_ACCESS_KEY_ID'),
        aws_secret_access_key=current_app.config.get('AWS_SECRET_ACCESS_KEY'),
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

    s3, bucket = _get_s3_client()

    if s3 and bucket:
        # Production: upload to S3
        try:
            s3.upload_fileobj(
                file,
                bucket,
                key,
                ExtraArgs={
                    'ContentType': file.content_type or 'image/jpeg',
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
