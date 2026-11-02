// CloudFront Function (viewer-request) for the web app's default behaviour only.
// A path with no file extension is a client-side route: serve index.html.
function handler(event) {
  var request = event.request;
  if (request.uri.indexOf(".") === -1) {
    request.uri = "/index.html";
  }
  return request;
}
