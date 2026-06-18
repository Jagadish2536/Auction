output "server_public_ip" {
  description = "Public IP address of the EC2 server"
  value       = aws_eip.app.public_ip
}

output "route53_dns_record" {
  description = "Configured domain name record"
  value       = var.enable_dns ? aws_route53_record.app[0].fqdn : "DNS not configured - use IP: ${aws_eip.app.public_ip}"
}

output "s3_bucket_name" {
  description = "Name of S3 bucket for player photos/logos"
  value       = aws_s3_bucket.uploads.id
}

output "s3_bucket_url" {
  description = "Public URL for S3 uploads bucket"
  value       = "https://${aws_s3_bucket.uploads.bucket}.s3.${var.aws_region}.amazonaws.com"
}

output "ec2_instance_id" {
  description = "EC2 instance ID"
  value       = aws_instance.app.id
}

output "ssh_command" {
  description = "SSH command to connect to the server"
  value       = "ssh -i ${var.key_name}.pem ubuntu@${aws_eip.app.public_ip}"
}

output "app_url" {
  description = "Application URL"
  value       = var.enable_dns ? "https://${var.domain_name}" : "http://${aws_eip.app.public_ip}"
}
