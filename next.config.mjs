import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Externalize exceljs and its dependencies to avoid bundling issues
  // This tells Next.js to not bundle these packages and use them as external dependencies
  serverExternalPackages: [
    'exceljs',
    'archiver',
    'archiver-utils',
    'lazystream',
    'readable-stream',
    'stream',
  ],
  // Add empty turbopack config to allow webpack config to work
  turbopack: {},
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Handle Node.js modules that are not available in the browser
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
      
      // Externalize exceljs and its dependencies to prevent bundling
      config.externals = config.externals || [];
      if (typeof config.externals === 'function') {
        const originalExternals = config.externals;
        config.externals = [
          originalExternals,
          ({ request }, callback) => {
            if (
              request === 'exceljs' ||
              request === 'archiver' ||
              request === 'archiver-utils' ||
              request === 'lazystream' ||
              request === 'readable-stream' ||
              request?.startsWith('readable-stream/')
            ) {
              return callback(null, `commonjs ${request}`);
            }
            callback();
          },
        ];
      } else if (Array.isArray(config.externals)) {
        config.externals.push({
          exceljs: 'commonjs exceljs',
          archiver: 'commonjs archiver',
          'archiver-utils': 'commonjs archiver-utils',
          lazystream: 'commonjs lazystream',
          'readable-stream': 'commonjs readable-stream',
        });
      }
      
      // Handle readable-stream subpaths for exceljs dependencies
      // lazystream requires 'readable-stream/passthrough' which doesn't exist as a subpath
      try {
        const readableStreamPath = path.dirname(require.resolve('readable-stream/package.json'));
        config.resolve.alias = {
          ...config.resolve.alias,
          'readable-stream': readableStreamPath,
          'readable-stream/passthrough': path.join(readableStreamPath, 'lib/_stream_passthrough.js'),
          'readable-stream/readable': path.join(readableStreamPath, 'lib/_stream_readable.js'),
          'readable-stream/writable': path.join(readableStreamPath, 'lib/_stream_writable.js'),
          'readable-stream/transform': path.join(readableStreamPath, 'lib/_stream_transform.js'),
          'readable-stream/duplex': path.join(readableStreamPath, 'lib/_stream_duplex.js'),
        };
      } catch (e) {
        // readable-stream might not be resolvable during build, that's okay
        console.warn('Could not resolve readable-stream path:', e);
      }
    }
    
    return config;
  },
};

export default nextConfig;
