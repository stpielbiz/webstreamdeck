/**
 * All homepage wording lives here. Edit text, reorder items, or add/remove
 * cards without touching the page layout. `icon` names come from ICONS in
 * src/routes/index.tsx.
 */
export type HomeAction = {
  label: string;
  to: "/auth" | "/device-login" | "/tv/pair" | "/download";
  style: "primary" | "outline" | "ghost";
  /** Shown first and focused when opened on the Fire TV app. */
  tvFirst?: boolean;
};

export const HOME_HERO = {
  badge: "Bring your own playlist",
  title: "Your IPTV subscription, finally with a player worth using.",
  body: "Add your Xtream Codes login or M3U link and watch live TV, movies and shows on your Fire Stick, TV, phone or computer.",
  note: "Your first day is free. A yearly subscription activates your account after the trial.",
  disclaimer: "Stream Deck hosts no channels of its own — you use your own subscription details.",
};

export const HOME_ACTIONS: HomeAction[] = [
  { label: "Start your free 1-day trial", to: "/auth", style: "primary" },
  { label: "Sign in", to: "/auth", style: "outline" },
  { label: "Sign in this TV with a code", to: "/tv/pair", style: "outline", tvFirst: true },
  { label: "Log in another device", to: "/device-login", style: "ghost" },
  { label: "Get the Fire TV app", to: "/download", style: "ghost" },
];

export const HOME_FEATURES_TITLE = "Everything in the app";

export const HOME_FEATURES: { icon: string; title: string; body: string }[] = [
  { icon: "tv", title: "Live TV & guide", body: "Channel guide with now and next, recent channels and multi-view for up to four channels." },
  { icon: "film", title: "Movies & Shows", body: "Posters, details, seasons and episodes, grouped by year and kept tidy." },
  { icon: "layers", title: "Franchise collections", body: "Every movie and show in a franchise together, in order, with your progress." },
  { icon: "star", title: "Favourites", body: "Hold OK to favourite channels, movies, shows and even whole channel categories." },
  { icon: "search", title: "Search by title or actor", body: "Find anything by its name or by who's in it, with voice search on the remote." },
  { icon: "history", title: "Resume anywhere", body: "Pick up exactly where you stopped, on any device you sign in from." },
  { icon: "refresh", title: "Playlist sync", body: "Optionally carry your progress across all your playlists." },
  { icon: "list", title: "Several playlists", body: "Add as many as you like, and pick a different one on each device." },
  { icon: "shield", title: "Automatic recovery", body: "Dropped streams reconnect on their own so you keep watching." },
];

export const HOME_STEPS_TITLE = "How it works";

export const HOME_STEPS: { title: string; body: string }[] = [
  { title: "Add your playlist", body: "Paste your Xtream Codes login or M3U link." },
  { title: "Pick a device", body: "Install the Fire TV app or open the site anywhere." },
  { title: "Watch", body: "Live TV, movies and shows with favourites and resume." },
];

export const HOME_FOOTER = "Stream Deck is a player. You supply the playlist and are responsible for the content you access.";
