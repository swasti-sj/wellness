import axios from "axios";

// Attach the login token to every request to our own API as an
// Authorization header. Never put the token in a URL (?token=) or request
// body — URLs end up in server logs and browser history.
function isOurApi(url) {
  try {
    const target = new URL(url, window.location.origin);
    const ourOrigins = [window.location.origin];
    if (process.env.REACT_APP_BACKEND_URL) {
      ourOrigins.push(new URL(process.env.REACT_APP_BACKEND_URL).origin);
    }
    return ourOrigins.includes(target.origin) && target.pathname.startsWith("/api/");
  } catch {
    return false;
  }
}

axios.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token && config.url && isOurApi(config.url)) {
    config.headers = config.headers || {};
    if (!config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});
