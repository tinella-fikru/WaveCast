import {
  precacheAndRoute,
  matchPrecache,
  cleanupOutdatedCaches,
} from "workbox-precaching";
import { registerRoute } from "workbox-routing";

registerRoute(
  ({ request, url }) =>
    request.mode === "navigate" && url.href.startsWith(self.registration.scope),
  async ({ request }) => {
    try {
      return await fetch(request);
    } catch {
      return (await matchPrecache(new URL("offline.html", self.registration.scope).href)) || Response.error();
    }
  },
);
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
