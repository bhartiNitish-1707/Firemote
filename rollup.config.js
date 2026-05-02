import typescript from '@rollup/plugin-typescript';

export default {
  input: 'src/index.ts',
  output: {
    file: 'dist/HA-Firemote.js',
    format: 'iife',
    name: 'HAFiremoteCard',
    sourcemap: false
  },
  plugins: [
    typescript({ tsconfig: './tsconfig.json' })
  ]
};
