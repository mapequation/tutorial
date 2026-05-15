/**
 * Get the base path for image and asset URLs.
 * Uses NEXT_PUBLIC_BASE_PATH environment variable, defaults to '/demo'
 */
export function getBasePath(): string {
    return process.env.NEXT_PUBLIC_BASE_PATH || '/map-demo';
}

/**
 * Construct a path relative to the basePath
 * @param path - The path relative to basePath (e.g., '/images/logo.png')
 * @returns Full path including basePath
 */
export function getAssetPath(path: string): string {
    const basePath = getBasePath();
    // Remove leading slash if present to avoid double slashes
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${basePath}${cleanPath}`;
}
