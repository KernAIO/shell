// The app is a client-rendered SPA: it talks to the core service directly with the user's session
// cookie, so there is no server-side data loading to do and no server runtime to keep in sync.
export const ssr = false
export const prerender = false
