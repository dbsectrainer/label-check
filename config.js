// Label Check API configuration.
// Same-origin deployments (the Vercel site, or local `npm start`) leave this empty and call /api/extract
// on their own host. The GitHub Pages copy has no backend, so it calls the Vercel deployment instead.
// To use a different backend, set window.LABEL_CHECK_API before this script loads.
window.LABEL_CHECK_API =
  window.LABEL_CHECK_API ||
  (/\.github\.io$/.test(location.hostname)
    ? "https://label-check-puce.vercel.app"
    : "");
