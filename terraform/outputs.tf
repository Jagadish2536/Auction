output "server_public_ip" {
  description = "Public IP address of the EC2 server"
  value       = aws_eip.app.public_ip
}

output "route53_dns_record" {
  description = "Configured domain name record"
  value       = aws_route53_record.app.fqdn
}

output "s3_bucket_name" {
  description = "Name of S3 bucket for player photos/logos"
  value       = aws_s3_bucket.uploads.id
}
