module.exports = (api) => {
  api.cache(true);
  return {
    // Resolve Expo's own declared preset under pnpm's isolated dependency layout.
    presets: [require.resolve('babel-preset-expo', { paths: [require.resolve('expo/package.json')] })],
    plugins: [
      [
        "module-resolver",
        {
          root: ["./src"],
          alias: { "@": "./src" },
          extensions: [".ts", ".tsx", ".js", ".jsx"],
        },
      ],
      "react-native-reanimated/plugin",
    ],
  };
};
