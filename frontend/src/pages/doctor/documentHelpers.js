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
  return `http://localhost:5000${url}`;
};

export const getDocumentName = (url, fallback = "View document") => {
  if (!url) return fallback;
  const parts = url.split("/");
  return parts[parts.length - 1] || fallback;
};
