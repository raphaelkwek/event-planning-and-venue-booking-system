import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

/**
 * EN-12-T12: the CloudFront configuration (gateway/cdn/terraform) caches only what the contract allows.
 * It reads the Terraform text; `terraform validate` runs in CI. No CDN is deployed.
 */

const main = readFileSync(new URL("../cdn/terraform/main.tf", import.meta.url), "utf8").replaceAll("\r\n", "\n");

/** The text of the block that opens at `start` (its first "{"), braces matched. */
function blockAt(text, start) {
  const open = text.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < text.length; i += 1) {
    if (text[i] === "{") depth += 1;
    if (text[i] === "}" && --depth === 0) return text.slice(open + 1, i);
  }
  throw new Error("unbalanced braces");
}

const blocksNamed = (text, header) => [...text.matchAll(new RegExp(`^\\s*${header}\\s*\\{`, "gm"))].map((m) => blockAt(text, m.index));
const resource = (type, name) => blockAt(main, main.indexOf(`resource "${type}" "${name}"`));
const attr = (block, name) => new RegExp(`^\\s*${name}\\s*=\\s*(.+)$`, "m").exec(block)?.[1];

test("EN-12-T12 caches only the browse API and the fingerprinted assets", () => {
  const distribution = resource("aws_cloudfront_distribution", "web");
  const ordered = blocksNamed(distribution, "ordered_cache_behavior");
  const dynamic = blocksNamed(distribution, 'dynamic "ordered_cache_behavior"');
  assert.equal(ordered.length, 2, "one explicit cached API path and the assets; the personal paths are the dynamic block");
  assert.equal(dynamic.length, 1);

  const [browse, assets] = ordered;
  assert.equal(attr(browse, "path_pattern"), '"/registration/api/v1/open-events*"');
  assert.equal(attr(browse, "cache_policy_id"), "aws_cloudfront_cache_policy.browse_api.id");
  assert.equal(attr(browse, "allowed_methods"), '["GET", "HEAD", "OPTIONS"]', "only reads are cached");
  assert.equal(attr(assets, "path_pattern"), '"/assets/*"');
  assert.equal(attr(assets, "cache_policy_id"), "aws_cloudfront_cache_policy.static_assets.id");
  assert.equal(attr(assets, "target_origin_id"), "local.spa_origin_id");

  const personal = blocksNamed(dynamic[0], "content")[0];
  assert.equal(attr(personal, "cache_policy_id"), "data.aws_cloudfront_cache_policy.caching_disabled.id");
  assert.equal(attr(personal, "target_origin_id"), "local.gateway_origin_id");
  assert.match(attr(personal, "allowed_methods"), /"POST"/, "registering and withdrawing pass through");
  assert.equal(attr(personal, "path_pattern"), '"/${ordered_cache_behavior.value}/*"');
});

test("EN-12-T12 sends every personal path to the gateway uncached, and the order puts the browse path first", () => {
  const prefixes = /personal_api_prefixes\s*=\s*\[(.*?)\]/.exec(main)[1].match(/"([a-z]+)"/g).map((s) => s.replaceAll('"', ""));
  assert.deepEqual([...prefixes].sort(), ["equipment", "event", "identity", "notification", "registration", "venue"]);
  const distribution = resource("aws_cloudfront_distribution", "web");
  assert.ok(distribution.indexOf("open-events*") < distribution.indexOf('dynamic "ordered_cache_behavior"'), "a specific path must precede the /registration/* catch-all");
  assert.ok(distribution.indexOf('dynamic "ordered_cache_behavior"') < distribution.indexOf('"/assets/*"'));
  const fallback = blocksNamed(distribution, "default_cache_behavior")[0];
  assert.equal(attr(fallback, "target_origin_id"), "local.spa_origin_id", "anything unmatched is the web app, never the API");
  assert.equal(attr(fallback, "cache_policy_id"), "aws_cloudfront_cache_policy.spa_shell.id");
});

test("EN-12-T12 keeps the browse cache short, without cookies, headers or other query strings", () => {
  const policy = resource("aws_cloudfront_cache_policy", "browse_api");
  assert.equal(attr(policy, "min_ttl"), "0");
  assert.equal(attr(policy, "max_ttl"), "5", "never longer than 5 seconds whatever the origin sends");
  assert.equal(attr(policy, "default_ttl"), "5");
  assert.equal(attr(blocksNamed(policy, "cookies_config")[0], "cookie_behavior"), '"none"');
  assert.equal(attr(blocksNamed(policy, "headers_config")[0], "header_behavior"), '"none"');
  const queries = blocksNamed(policy, "query_strings_config")[0];
  assert.equal(attr(queries, "query_string_behavior"), '"whitelist"');
  assert.equal(attr(blocksNamed(queries, "query_strings")[0], "items"), '["cursor", "limit"]');
});

test("EN-12-T12 reaches the gateway over HTTPS only and forwards the viewer's token without caching on it", () => {
  const distribution = resource("aws_cloudfront_distribution", "web");
  const custom = blocksNamed(distribution, "custom_origin_config")[0];
  assert.equal(attr(custom, "origin_protocol_policy"), '"https-only"');
  assert.match(main, /Managed-AllViewerExceptHostHeader/);
  assert.match(main, /Managed-CachingDisabled/);
  for (const behaviour of [...blocksNamed(distribution, "ordered_cache_behavior"), ...blocksNamed(distribution, "content")]) {
    assert.match(attr(behaviour, "viewer_protocol_policy"), /https-only|redirect-to-https/);
  }
});

test("EN-12-T12 serves a long life for fingerprinted assets and revalidates the entry page", () => {
  assert.equal(attr(resource("aws_cloudfront_cache_policy", "static_assets"), "max_ttl"), "31536000");
  const shell = resource("aws_cloudfront_cache_policy", "spa_shell");
  assert.equal(attr(shell, "default_ttl"), "0");
  assert.match(main, /web app routes/i);
  assert.match(readFileSync(new URL("../cdn/terraform/spa-routes.js", import.meta.url), "utf8"), /index\.html/);
});
