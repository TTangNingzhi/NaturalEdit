const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

const copyWasmFiles = {
	name: "copy-wasm-files",
	setup(build) {
		build.onEnd(() => {
			const destDir = 'dist';

			// Copy web-tree-sitter runtime WASM
			const treeSitterRuntimeSrc = path.join(__dirname, "node_modules", "web-tree-sitter", "tree-sitter.wasm");
			const treeSitterRuntimeDest = path.join(__dirname, destDir, "tree-sitter.wasm");
			fs.copyFileSync(treeSitterRuntimeSrc, treeSitterRuntimeDest);

			// Copy language grammar WASMs
			const wasmSourceDir = path.join(__dirname, "node_modules", "tree-sitter-wasms", "out");
			const langs = ["python", "javascript", "typescript", "tsx"];

			for (const lang of langs) {
				const wasmFile = `tree-sitter-${lang}.wasm`;
				const src = path.join(wasmSourceDir, wasmFile);
				const dest = path.join(__dirname, destDir, wasmFile);
				fs.copyFileSync(src, dest);
			}
			console.log("✅ Copied Tree-sitter WASM files");
		});
	}
};

/**
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
	name: 'esbuild-problem-matcher',

	setup(build) {
		build.onStart(() => {
			console.log('[watch] build started');
		});
		build.onEnd((result) => {
			result.errors.forEach(({ text, location }) => {
				console.error(`✘ [ERROR] ${text}`);
				console.error(`    ${location.file}:${location.line}:${location.column}:`);
			});
			console.log('[watch] build finished');
		});
	},
};

async function main() {
	const ctx = await esbuild.context({
		entryPoints: [
			'src/extension.ts'
		],
		bundle: true,
		format: 'cjs',
		minify: production,
		sourcemap: !production,
		sourcesContent: false,
		platform: 'node',
		outfile: 'dist/extension.js',
		external: ['vscode'],
		logLevel: 'silent',
		plugins: [
			copyWasmFiles,
			esbuildProblemMatcherPlugin,
		],
	});
	if (watch) {
		await ctx.watch();
	} else {
		await ctx.rebuild();
		await ctx.dispose();
	}
}

main().catch(e => {
	console.error(e);
	process.exit(1);
});
