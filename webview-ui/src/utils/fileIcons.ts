/**
 * Returns an icon path (SVG) or codicon class name based on file extension or filename.
 * Uses SVGs from /public/icons/ for common languages and file types, based on actual filenames.
 * Falls back to codicon for others.
 * 
 * In production, uses window.__SVG_ICON_MAP__ to resolve the correct URI for each SVG.
 * 
 * @param filename - The name of the file (can include path or just the name)
 * @returns { type: 'svg' | 'codicon', value: string }
 */
declare global {
    interface Window {
        __SVG_ICON_MAP__?: Record<string, string>;
    }
}

export function getFileIcon(filename: string): { type: 'svg' | 'codicon', value: string } {
    const lower = filename.toLowerCase();
    const ext = lower.split('.').pop() ?? '';

    // Match specific filenames first
    const specialFiles: Record<string, string> = {
        'readme.md': 'markdown.svg',
        'license': 'license.svg',
        'dockerfile': 'docker.svg',
        '.gitignore': 'git_ignore.svg',
        'makefile': 'makefile.svg',
        'tsconfig.json': 'tsconfig.svg',
        'package.json': 'npm.svg',
        'yarn.lock': 'yarn.svg',
        'gulpfile.js': 'gulp.svg',
        'webpack.config.js': 'webpack.svg',
        'vite.config.js': 'vite.svg',
        'rollup.config.js': 'rollup.svg',
        'babel.config.js': 'babel.svg',
        'editorconfig': 'editorconfig.svg'
    };
    let svgName: string | undefined = specialFiles[lower];

    // Extension to SVG icon mapping (based on your /public/icons/ directory)
    if (!svgName) {
        const extToSvg: Record<string, string> = {
            js: 'javascript.svg',
            jsx: 'react.svg',
            ts: 'typescript.svg',
            tsx: 'react.svg',
            py: 'python.svg',
            java: 'java.svg',
            c: 'c.svg',
            cpp: 'cpp.svg',
            cc: 'cpp.svg',
            cxx: 'cpp.svg',
            go: 'go.svg',
            rb: 'ruby.svg',
            rs: 'rust.svg',
            php: 'php.svg',
            swift: 'swift.svg',
            kt: 'kotlin.svg',
            scala: 'scala.svg',
            lua: 'lua.svg',
            md: 'markdown.svg',
            markdown: 'markdown.svg',
            json: 'json.svg',
            html: 'html.svg',
            htm: 'html.svg',
            css: 'css.svg',
            scss: 'sass.svg',
            sass: 'sass.svg',
            less: 'less.svg',
            xml: 'xml.svg',
            csv: 'csv.svg',
            yml: 'yml.svg',
            yaml: 'yml.svg',
            sh: 'shell.svg',
            bash: 'shell.svg',
            zsh: 'shell.svg',
            svg: 'svg.svg',
            pdf: 'pdf.svg',
            zip: 'zip.svg',
            rar: 'zip.svg',
            png: 'image.svg',
            jpg: 'image.svg',
            jpeg: 'image.svg',
            gif: 'image.svg',
            webp: 'image.svg',
            bmp: 'image.svg',
            vue: 'vue.svg',
            svelte: 'svelte.svg',
            dart: 'dart.svg',
            elm: 'elm.svg',
            coffee: 'coffee.svg',
            txt: 'default.svg',
            log: 'default.svg',
            notebook: 'notebook.svg',
            ipynb: 'notebook.svg',
            prisma: 'prisma.svg',
            // Add more as needed based on your icons folder
        };
        svgName = extToSvg[ext];
    }

    // Try to resolve SVG path using window.__SVG_ICON_MAP__ (production) or /icons/ (dev)
    if (svgName) {
        const svgMap: Record<string, string> | undefined =
            typeof window !== "undefined" ? window.__SVG_ICON_MAP__ : undefined;
        if (svgMap && svgMap[svgName]) {
            return { type: 'svg', value: svgMap[svgName] };
        } else {
            // Dev mode: use /icons/ path
            return { type: 'svg', value: `/icons/${svgName}` };
        }
    }

    // Fallback to codicon
    const codiconMap: Record<string, string> = {
        txt: 'codicon-text',
        log: 'codicon-text',
        csv: 'codicon-csv',
        xml: 'codicon-xml',
        ipynb: 'codicon-notebook',
        pdf: 'codicon-pdf',
        zip: 'codicon-zip',
        rar: 'codicon-zip'
    };

    return { type: 'codicon', value: codiconMap[ext] ?? 'codicon-file' };
}

/**
 * Usage in React:
 * 
 * const icon = getFileIcon(filename);
 * return icon.type === 'svg'
 *   ? <img src={icon.value} alt="" style={{ width: 16, height: 16, verticalAlign: 'middle' }} />
 *   : <span className={`codicon ${icon.value}`} />;
 */
