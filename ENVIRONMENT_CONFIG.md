# Environment Configuration

This project uses environment variables to configure the base path for deployment to different locations.

## NEXT_PUBLIC_BASE_PATH

Controls the base URL path for the application.

**Default:** `/demo`

### Usage

Set this environment variable before building:

```bash
# Build for demo (default)
npm run build:demo

# Build for demo-test
npm run build:demo-test

# Build with custom path
NEXT_PUBLIC_BASE_PATH=/custom-path npm run build
```

### Deployment

Use the provided npm scripts for easy deployment:

```bash
# Deploy to production demo server
npm run deploy

# Deploy to test demo server
npm run deploy-test
```

### In .env.local (for development)

If you want to set a custom base path in development, create a `.env.local` file:

```
NEXT_PUBLIC_BASE_PATH=/demo-test
```

Then restart the dev server:

```bash
npm run dev
```

## Apache Configuration

The application expects Apache aliases to be configured:

```apache
Alias "/demo" "/var/www/demo"
Alias "/demo-test" "/var/www/demo-test"

<Directory /var/www/demo>
  Options Indexes FollowSymLinks
  AllowOverride All
  Require all granted
</Directory>

<Directory /var/www/demo-test>
  Options Indexes FollowSymLinks
  AllowOverride All
  Require all granted
</Directory>
```

## Where BASE_PATH is Used

The `NEXT_PUBLIC_BASE_PATH` environment variable is used in:

- `next.config.js` - Sets the Next.js basePath
- Global TypeScript definition `__BASE_PATH__` - Available in code via webpack DefinePlugin
- Image asset paths - Via `getAssetPath()` utility function
- CSS background images - Injected at runtime in `_app.tsx`
- Tailwind configuration - For background image URLs
