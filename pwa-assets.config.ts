// Icon generation for the PWA manifest. Run `pnpm icons` after changing logo.svg.
// Kept import-free so it also works when the generator is executed via `pnpm dlx`.
export default {
  headLinkOptions: { preset: "2023" },
  images: ["public/logo.svg"],
  preset: {
    transparent: {
      sizes: [64, 192, 512],
      favicons: [[48, "favicon.ico"]],
    },
    maskable: {
      sizes: [512],
      padding: 0.2,
      resizeOptions: { background: "#0f766e" },
    },
    apple: {
      sizes: [180],
      padding: 0.2,
      resizeOptions: { background: "#0f766e" },
    },
  },
};
