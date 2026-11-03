locals {
  # Everything a person's own data passes through. None of it is ever cached by the CDN:
  # CachingDisabled sends every request to the gateway, which checks the token and limits the user.
  # /registration/* includes registrations, the waiting room (EN-19) and anything added later.
  personal_api_prefixes = ["registration", "identity", "event", "venue", "equipment", "notification"]

  gateway_origin_id = "gateway"
  spa_origin_id     = "spa"
}

data "aws_cloudfront_cache_policy" "caching_disabled" {
  name = "Managed-CachingDisabled"
}

# Forwards every viewer header (the Authorization token, x-correlation-id, traceparent) to the gateway
# without making them part of the cache key.
data "aws_cloudfront_origin_request_policy" "all_viewer_except_host" {
  name = "Managed-AllViewerExceptHostHeader"
}

# The attendee browse list and event page (R1): public listing data, the same for everyone, and the
# registration service says so with `Cache-Control: public, max-age=5, stale-while-revalidate=30`.
# The cache never holds longer than 5 seconds whatever the origin says, never varies by cookie or
# header, and keeps only the paging query strings. Registering always goes live (see personal paths).
resource "aws_cloudfront_cache_policy" "browse_api" {
  name        = "connectsphere-browse-api"
  comment     = "Attendee browse API: public listing data, at most 5 seconds"
  min_ttl     = 0
  default_ttl = 5
  max_ttl     = 5

  parameters_in_cache_key_and_forwarded_to_origin {
    enable_accept_encoding_gzip   = true
    enable_accept_encoding_brotli = true

    cookies_config {
      cookie_behavior = "none"
    }

    headers_config {
      header_behavior = "none"
    }

    query_strings_config {
      query_string_behavior = "whitelist"

      query_strings {
        items = ["cursor", "limit"]
      }
    }
  }
}

# Fingerprinted files under /assets: the origin sends `public, max-age=31536000, immutable`.
resource "aws_cloudfront_cache_policy" "static_assets" {
  name        = "connectsphere-static-assets"
  comment     = "Fingerprinted web app files, kept for as long as the origin says"
  min_ttl     = 1
  default_ttl = 86400
  max_ttl     = 31536000

  parameters_in_cache_key_and_forwarded_to_origin {
    enable_accept_encoding_gzip   = true
    enable_accept_encoding_brotli = true

    cookies_config {
      cookie_behavior = "none"
    }

    headers_config {
      header_behavior = "none"
    }

    query_strings_config {
      query_string_behavior = "none"
    }
  }
}

# index.html and the other unfingerprinted files: the origin sends `no-cache`, so every use is
# checked with the origin and a new release shows at once.
resource "aws_cloudfront_cache_policy" "spa_shell" {
  name        = "connectsphere-spa-shell"
  comment     = "Web app entry files: revalidated on every use"
  min_ttl     = 0
  default_ttl = 0
  max_ttl     = 86400

  parameters_in_cache_key_and_forwarded_to_origin {
    enable_accept_encoding_gzip   = true
    enable_accept_encoding_brotli = true

    cookies_config {
      cookie_behavior = "none"
    }

    headers_config {
      header_behavior = "none"
    }

    query_strings_config {
      query_string_behavior = "none"
    }
  }
}

resource "aws_cloudfront_response_headers_policy" "web_app" {
  name = "connectsphere-web-app-security-headers"

  security_headers_config {
    strict_transport_security {
      access_control_max_age_sec = 31536000
      include_subdomains         = true
      override                   = true
    }

    content_type_options {
      override = true
    }

    frame_options {
      frame_option = "DENY"
      override     = true
    }

    referrer_policy {
      referrer_policy = "strict-origin-when-cross-origin"
      override        = true
    }
  }
}

# A path with no file extension is a route of the web app, so it gets index.html. Done per behaviour
# here, because a distribution-wide custom error response would also turn the API's own 404s into HTML.
resource "aws_cloudfront_function" "spa_routes" {
  name    = "connectsphere-spa-routes"
  runtime = "cloudfront-js-2.0"
  comment = "Serve index.html for web app routes"
  publish = true
  code    = file("${path.module}/spa-routes.js")
}

resource "aws_s3_bucket" "spa" {
  bucket = var.spa_bucket_name
}

resource "aws_s3_bucket_public_access_block" "spa" {
  bucket                  = aws_s3_bucket.spa.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_cloudfront_origin_access_control" "spa" {
  name                              = "connectsphere-spa"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "web" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "ConnectSphere web app and attendee API"
  default_root_object = "index.html"
  aliases             = [var.domain_name]
  price_class         = "PriceClass_200"
  web_acl_id          = var.web_acl_arn == "" ? null : var.web_acl_arn

  origin {
    origin_id                = local.spa_origin_id
    domain_name              = aws_s3_bucket.spa.bucket_regional_domain_name
    origin_access_control_id = aws_cloudfront_origin_access_control.spa.id
  }

  origin {
    origin_id   = local.gateway_origin_id
    domain_name = var.gateway_domain

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  # 1. The browse API: the only API path the CDN caches, and only GET and HEAD.
  ordered_cache_behavior {
    path_pattern             = "/registration/api/v1/open-events*"
    target_origin_id         = local.gateway_origin_id
    allowed_methods          = ["GET", "HEAD", "OPTIONS"]
    cached_methods           = ["GET", "HEAD"]
    cache_policy_id          = aws_cloudfront_cache_policy.browse_api.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_viewer_except_host.id
    viewer_protocol_policy   = "https-only"
    compress                 = true
  }

  # 2. Every other API path: never cached, every method, straight to the gateway.
  dynamic "ordered_cache_behavior" {
    for_each = local.personal_api_prefixes

    content {
      path_pattern             = "/${ordered_cache_behavior.value}/*"
      target_origin_id         = local.gateway_origin_id
      allowed_methods          = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
      cached_methods           = ["GET", "HEAD"]
      cache_policy_id          = data.aws_cloudfront_cache_policy.caching_disabled.id
      origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_viewer_except_host.id
      viewer_protocol_policy   = "https-only"
    }
  }

  # 3. The web app's fingerprinted files.
  ordered_cache_behavior {
    path_pattern               = "/assets/*"
    target_origin_id           = local.spa_origin_id
    allowed_methods            = ["GET", "HEAD", "OPTIONS"]
    cached_methods             = ["GET", "HEAD"]
    cache_policy_id            = aws_cloudfront_cache_policy.static_assets.id
    response_headers_policy_id = aws_cloudfront_response_headers_policy.web_app.id
    viewer_protocol_policy     = "redirect-to-https"
    compress                   = true
  }

  # 4. Everything else is the web app.
  default_cache_behavior {
    target_origin_id           = local.spa_origin_id
    allowed_methods            = ["GET", "HEAD", "OPTIONS"]
    cached_methods             = ["GET", "HEAD"]
    cache_policy_id            = aws_cloudfront_cache_policy.spa_shell.id
    response_headers_policy_id = aws_cloudfront_response_headers_policy.web_app.id
    viewer_protocol_policy     = "redirect-to-https"
    compress                   = true

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.spa_routes.arn
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = var.certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }
}

data "aws_iam_policy_document" "spa_bucket" {
  statement {
    sid       = "AllowCloudFrontToRead"
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.spa.arn}/*"]

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.web.arn]
    }
  }
}

resource "aws_s3_bucket_policy" "spa" {
  bucket = aws_s3_bucket.spa.id
  policy = data.aws_iam_policy_document.spa_bucket.json
}
