import svelte from "rollup-plugin-svelte";
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import livereload from "rollup-plugin-livereload";
import replace from "@rollup/plugin-replace";
import { terser } from "rollup-plugin-terser";
import { svelteSVG } from "rollup-plugin-svelte-svg";
import css from "rollup-plugin-css-only";
import alias from '@rollup/plugin-alias';
import path from 'path';


const production = !process.env.ROLLUP_WATCH;

export default {
  input: "src/main.js",
  output: {
    sourcemap: true,
    format: "iife",
    name: "app",
    file: "public/build/bundle.js",
  },
  plugins: [
    alias({
      entries: [
        { find: '$lib', replacement: path.resolve(__dirname, 'src/lib') },
        { find: '$components', replacement: path.resolve(__dirname, 'src/components') }
      ]
    }),
    svelteSVG(),
    svelte({
      compilerOptions: {
        dev: !production,
      },
    }),

    css({ output: "bundle.css" }),

    alias({
      entries: [{ find: "jszip", replacement: "jszip/dist/jszip.js" }],
    }),

    replace({
      __dev__: !production,
    }),

    // If you have external dependencies installed from
    // npm, you'll most likely need these plugins. In
    // some cases you'll need additional configuration -
    // consult the documentation for details:
    // https://github.com/rollup/plugins/tree/master/packages/commonjs
    resolve({
      browser: true,
      dedupe: ["svelte", "jszip", "xpath"],
    }),
    commonjs(),

    // In dev mode, call `npm run start` once
    // the bundle has been generated
    !production && serve(),

    // Watch the `public` directory and refresh the
    // browser on changes when not in production
    !production && livereload("public"),

    // If we're building for production (npm run build
    // instead of npm run dev), minify
    production && terser(),
  ],
  watch: {
    clearScreen: false,
  },
};

function serve() {
  let started = false;

  return {
    writeBundle() {
      if (!started) {
        started = true;

        require("child_process").spawn("yarn", ["start", "--dev"], {
          stdio: ["ignore", "inherit", "inherit"],
          shell: true,
        });
      }
    },
  };
}
