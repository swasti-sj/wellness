const API_BASE =
  process.env.REACT_APP_BACKEND_URL;
export const buildDocumentUrl = (url) => {
  if (!url) return "";
  if (
    url.startsWith("http://") ||
    url.startsWith("https://") ||
    url.startsWith("blob:") ||
    url.startsWith("data:")
  ) {
    return url;
  }
  return `${API_BASE}${url}`;
};

export const getDocumentName = (url, fallback = "View document") => {
  if (!url) return fallback;
  const parts = url.split("/");
  return parts[parts.length - 1] || fallback;
};

