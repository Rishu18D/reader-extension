const esbuild = require('esbuild');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function renameNextAssetDirectory(outDir) {
  const reservedDirectory = path.join(outDir, '_next');
  const assetDirectory = path.join(outDir, 'next');
  if (!fs.existsSync(reservedDirectory)) {
    throw new Error('Next.js export is missing its _next asset directory.');
  }

  fs.rmSync(assetDirectory, { recursive: true, force: true });
  fs.renameSync(reservedDirectory, assetDirectory);

  const renamedPaths = [];
  const renameReservedPaths = (directory) => {
    fs.readdirSync(directory, { withFileTypes: true }).forEach((entry) => {
      const entryPath = path.join(directory, entry.name);
      let destinationPath = entryPath;
      if (entry.name.startsWith('_')) {
        const safeName = entry.name.replace(/^_+/, '') || 'assets';
        destinationPath = path.join(directory, safeName);
        if (fs.existsSync(destinationPath)) {
          throw new Error(`Cannot safely rename Chrome-reserved directory: ${entryPath}`);
        }
        fs.renameSync(entryPath, destinationPath);
        renamedPaths.push({
          from: path.relative(outDir, entryPath).split(path.sep).join('/'),
          to: path.relative(outDir, destinationPath).split(path.sep).join('/')
        });
      }

      if (entry.isDirectory()) {
        renameReservedPaths(destinationPath);
      }
    });
  };
  renameReservedPaths(outDir);

  const rewriteAssetPaths = (directory) => {
    fs.readdirSync(directory, { withFileTypes: true }).forEach((entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        rewriteAssetPaths(entryPath);
      } else if (/\.(html|js|css|json|txt)$/.test(entry.name)) {
        const content = fs.readFileSync(entryPath, 'utf8');
        const rewritten = renamedPaths.reduce((rewrittenContent, mapping) => {
          const oldPath = `/${mapping.from}`;
          const newPath = `/${mapping.to}`;
          return rewrittenContent.replaceAll(oldPath, newPath);
        }, content).replace(/\/_next\//g, '/next/');
        if (rewritten !== content) {
          fs.writeFileSync(entryPath, rewritten);
        }
      }
    });
  };

  rewriteAssetPaths(outDir);
  console.log('✓ Renamed Next.js assets to a Chrome-compatible directory');
}

function externalizeInlineScripts(outDir) {
  const scriptDirectory = path.join(outDir, 'extension-scripts');
  const htmlFiles = fs.readdirSync(outDir).filter((file) => file.endsWith('.html'));
  const executableScript = /<script(?<attributes>[^>]*)>(?<content>[\s\S]*?)<\/script>/gi;

  fs.rmSync(scriptDirectory, { recursive: true, force: true });
  fs.mkdirSync(scriptDirectory, { recursive: true });
  htmlFiles.forEach((file) => {
    const htmlPath = path.join(outDir, file);
    const html = fs.readFileSync(htmlPath, 'utf8');
    const externalizedHtml = html.replace(executableScript, (tag, attributes, content) => {
      if (/\bsrc\s*=/.test(attributes)) return tag;
      const type = attributes.match(/\btype\s*=\s*["']([^"']+)["']/i)?.[1];
      if (type && !/^(text|application)\/(javascript|ecmascript)$|^module$/i.test(type)) {
        return tag;
      }

      const filename = `${crypto.createHash('sha256').update(content).digest('hex')}.js`;
      fs.writeFileSync(path.join(scriptDirectory, filename), content);
      return `<script${attributes} src="/extension-scripts/${filename}"></script>`;
    });

    fs.writeFileSync(htmlPath, externalizedHtml);
    if (/<script(?![^>]*\bsrc\s*=)[^>]*>/i.test(externalizedHtml)) {
      throw new Error(`Inline executable script remains in ${file}; Chrome's MV3 CSP will block it.`);
    }
    executableScript.lastIndex = 0;
  });

  console.log('✓ Externalized inline page scripts for Chrome MV3 CSP');
}

async function build() {
  const root = path.resolve(__dirname, '..');
  const outDir = path.resolve(root, 'out');

  console.log('--- Bundling Chrome Extension artifacts into out/ ---');

  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  renameNextAssetDirectory(outDir);
  externalizeInlineScripts(outDir);

  // 1. Bundle Content Script (TreeWalker + Mozilla Readability)
  await esbuild.build({
    entryPoints: [path.resolve(root, 'extension/content/index.js')],
    bundle: true,
    minify: true,
    target: ['chrome100'],
    outfile: path.resolve(outDir, 'content.js'),
    sourcemap: false
  });
  console.log('✓ Compiled out/content.js');

  // 2. Bundle MV3 Background Service Worker
  await esbuild.build({
    entryPoints: [path.resolve(root, 'extension/background.js')],
    bundle: true,
    minify: true,
    target: ['chrome100'],
    outfile: path.resolve(outDir, 'background.js'),
    sourcemap: false
  });
  console.log('✓ Compiled out/background.js');

  // 3. Copy manifest.json to out/
  fs.copyFileSync(
    path.resolve(root, 'extension/manifest.json'),
    path.resolve(outDir, 'manifest.json')
  );
  console.log('✓ Synchronized out/manifest.json');

  // 4. Copy the icon assets to the manifest's expected paths.
  const iconNames = ['icon16.png', 'icon48.png', 'icon128.png'];
  const iconsSrc = path.resolve(root, 'public/icons');
  const missingIcons = iconNames.filter((file) => !fs.existsSync(path.join(iconsSrc, file)));
  if (missingIcons.length) {
    throw new Error(`Missing required extension icons: ${missingIcons.join(', ')}`);
  }

  const iconsDest = path.resolve(outDir, 'icons');
  fs.mkdirSync(iconsDest, { recursive: true });
  fs.rmSync(path.join(iconsDest, 'public'), { recursive: true, force: true });
  for (const file of iconNames) {
    fs.copyFileSync(path.join(iconsSrc, file), path.join(iconsDest, file));
  }
  console.log('✓ Copied icons to out/icons');

  console.log('Build completed successfully. Load the "out/" directory in chrome://extensions');
}

build().catch((err) => {
  console.error('Build execution failed:', err);
  process.exit(1);
});