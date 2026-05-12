export function buildSupabaseFunctionCallbackUrl(
  requestUrl: string,
  callbackSegment = "callback",
): string {
  const url = new URL(requestUrl);
  const normalizedPath = url.pathname.replace(/\/+$/, "");
  const callbackSuffix = `/${callbackSegment}`;

  url.pathname = normalizedPath.endsWith(callbackSuffix)
    ? normalizedPath
    : `${normalizedPath}${callbackSuffix}`;
  url.search = "";
  url.hash = "";

  return url.toString();
}
