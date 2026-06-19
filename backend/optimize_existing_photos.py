import os
import io
import sys
from PIL import Image
from botocore.exceptions import ClientError

# Add current directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from models.database import db
from models.player import Player
from models.team import Team
from models.auction import Sponsor
from models.tournament import Tournament
from utils import _get_s3_client

def optimize_image_buffer(file_bytes):
    """Resize image to max 1000px and compress to optimized JPEG quality 85."""
    img = Image.open(io.BytesIO(file_bytes))
    
    # Convert to RGB
    if img.mode in ('RGBA', 'LA'):
        background = Image.new('RGB', img.size, (255, 255, 255))
        background.paste(img, mask=img.split()[3] if len(img.split()) > 3 else None)
        img = background
    elif img.mode != 'RGB':
        img = img.convert('RGB')
        
    img.thumbnail((1000, 1000), Image.Resampling.LANCZOS)
    
    buffer = io.BytesIO()
    img.save(buffer, format='JPEG', quality=85, optimize=True)
    buffer.seek(0)
    return buffer.getvalue()

def process_s3_file(s3, bucket, key):
    """Download, optimize, and overwrite a file on S3."""
    try:
        # Get original file
        obj = s3.get_object(Bucket=bucket, Key=key)
        original_bytes = obj['Body'].read()
        original_size = len(original_bytes)
        
        # Skip if already reasonably small or not an image
        if original_size < 150 * 1024: # 150 KB
            return original_size, original_size, "skipped (already small)"
            
        # Optimize
        optimized_bytes = optimize_image_buffer(original_bytes)
        optimized_size = len(optimized_bytes)
        
        # Upload back
        s3.put_object(
            Bucket=bucket,
            Key=key,
            Body=optimized_bytes,
            ContentType='image/jpeg',
            CacheControl='public, max-age=31536000'
        )
        return original_size, optimized_size, "success"
    except Exception as e:
        return 0, 0, f"failed: {str(e)}"

def process_local_file(filepath):
    """Read, optimize, and overwrite a local file."""
    try:
        if not os.path.exists(filepath):
            return 0, 0, "failed: file not found"
            
        original_size = os.path.getsize(filepath)
        
        # Skip if already reasonably small
        if original_size < 150 * 1024:
            return original_size, original_size, "skipped (already small)"
            
        with open(filepath, 'rb') as f:
            original_bytes = f.read()
            
        optimized_bytes = optimize_image_buffer(original_bytes)
        optimized_size = len(optimized_bytes)
        
        with open(filepath, 'wb') as f:
            f.write(optimized_bytes)
            
        return original_size, optimized_size, "success"
    except Exception as e:
        return 0, 0, f"failed: {str(e)}"

def main(app_instance=None):
    print("=== JV Cricket Auction Photo Optimization Script ===")
    
    if app_instance is None:
        try:
            from app import app as imported_app
            app_instance = imported_app
        except ImportError:
            print("[ERROR] Could not import Flask application 'app'")
            return

    with app_instance.app_context():
        s3, bucket = _get_s3_client()
        is_s3 = s3 is not None and bucket is not None
        
        if is_s3:
            print(f"AWS S3 Mode Detected. Bucket: {bucket}")
        else:
            print("Local Development Mode Detected. Optimizing local filesystem...")
            
        # Gather all image paths/URLs
        all_items = []
        
        # 1. Players
        players = Player.query.filter(Player.photo != None).all()
        for p in players:
            all_items.append(('player', p.id, p.name, p.photo))
            
        # 2. Teams
        teams = Team.query.filter(Team.logo_url != None).all()
        for t in teams:
            all_items.append(('team logo', t.id, t.name, t.logo_url))
            
        # 3. Sponsors
        sponsors = Sponsor.query.filter(Sponsor.logo != None).all()
        for s in sponsors:
            all_items.append(('sponsor logo', s.id, s.name, s.logo))
            
        # 4. Tournaments
        tournaments = Tournament.query.filter(Tournament.logo_url != None).all()
        for t in tournaments:
            all_items.append(('tournament logo', t.id, t.name, t.logo_url))
            
        print(f"Found {len(all_items)} total image records to scan.\n")
        
        total_original_size = 0
        total_optimized_size = 0
        optimized_count = 0
        skipped_count = 0
        failed_count = 0
        
        for item_type, item_id, name, path_or_url in all_items:
            if not path_or_url:
                continue
                
            print(f"Processing [{item_type}] {name}... ", end="", flush=True)
            
            if is_s3 and path_or_url.startswith('https://'):
                # Extract key from S3 URL
                key = path_or_url.split('.amazonaws.com/', 1)[-1]
                orig, opt, status = process_s3_file(s3, bucket, key)
            else:
                # Local filepath
                # In DB, local paths are stored as "/uploads/photos/filename.ext"
                # Strip leading slash and join with current working directory
                clean_path = path_or_url.lstrip('/')
                full_path = os.path.join(os.getcwd(), clean_path)
                orig, opt, status = process_local_file(full_path)
                
            if status == "success":
                savings = ((orig - opt) / orig) * 100 if orig > 0 else 0
                print(f"Done! {orig/1024:.1f} KB -> {opt/1024:.1f} KB (Saved {savings:.1f}%)")
                total_original_size += orig
                total_optimized_size += opt
                optimized_count += 1
            elif "skipped" in status:
                print("Skipped (already optimized/small)")
                total_original_size += orig
                total_optimized_size += opt
                skipped_count += 1
            else:
                print(f"Failed ({status})")
                failed_count += 1
                
        print("\n=== Optimization Summary ===")
        print(f"Total processed: {optimized_count}")
        print(f"Total skipped:   {skipped_count}")
        print(f"Total failed:    {failed_count}")
        if optimized_count > 0:
            total_savings = ((total_original_size - total_optimized_size) / total_original_size) * 100 if total_original_size > 0 else 0
            print(f"Original Volume:  {total_original_size/1024/1024:.2f} MB")
            print(f"Optimized Volume: {total_optimized_size/1024/1024:.2f} MB")
            print(f"Total bandwidth saved: {total_savings:.1f}%")
        print("=============================")

if __name__ == "__main__":
    main()
