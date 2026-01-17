# Agent Task: Project Foundation & Monorepo Setup

## Priority: CRITICAL - Start Immediately
## Estimated Time: 2-3 hours

## Objective
Set up the complete monorepo structure with Turborepo, initialize the React web app with degen styling, and create shared configuration packages.

## Tasks

### 1. Initialize Monorepo Root
```bash
# In /Users/firatsertgoz/conductor/workspaces/hatch-sh/valencia
pnpm init
pnpm add -D turbo typescript @types/node
```

Create `package.json`:
```json
{
  "name": "hatch-sh",
  "private": true,
  "packageManager": "pnpm@8.15.0",
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "lint": "turbo lint",
    "dev:web": "turbo dev --filter=web",
    "dev:api": "turbo dev --filter=api"
  },
  "devDependencies": {
    "turbo": "^2.0.0",
    "typescript": "^5.4.0"
  }
}
```

Create `pnpm-workspace.yaml`:
```yaml
packages:
  - "apps/*"
  - "packages/*"
  - "services/*"
```

### 2. Create Turbo Configuration
Create `turbo.json`:
```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": ["**/.env*local"],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", "!.next/cache/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^lint"]
    }
  }
}
```

### 3. Create Shared TypeScript Config
Create `packages/config/typescript/base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

### 4. Create Tailwind Preset (Degen Theme)
Create `packages/config/tailwind/preset.js`:
```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors: {
        // Degen color palette
        bg: {
          primary: '#0a0a0a',
          secondary: '#141414',
          tertiary: '#1a1a1a',
        },
        accent: {
          green: '#00ff88',
          orange: '#ff6b35',
          purple: '#a855f7',
          red: '#ef4444',
        },
        border: {
          DEFAULT: '#2a2a2a',
          hover: '#3a3a3a',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
        'slide-up': 'slide-up 0.3s ease-out',
        'glitch': 'glitch 0.3s ease-in-out',
      },
      keyframes: {
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 5px currentColor' },
          '50%': { boxShadow: '0 0 20px currentColor, 0 0 30px currentColor' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'glitch': {
          '0%, 100%': { transform: 'translate(0)' },
          '20%': { transform: 'translate(-2px, 2px)' },
          '40%': { transform: 'translate(-2px, -2px)' },
          '60%': { transform: 'translate(2px, 2px)' },
          '80%': { transform: 'translate(2px, -2px)' },
        },
      },
      boxShadow: {
        'glow-green': '0 0 10px #00ff88, 0 0 20px #00ff8840',
        'glow-orange': '0 0 10px #ff6b35, 0 0 20px #ff6b3540',
        'glow-purple': '0 0 10px #a855f7, 0 0 20px #a855f740',
      },
    },
  },
}
```

### 5. Initialize Web App (apps/web)
```bash
cd apps/web
pnpm create vite . --template react-ts
pnpm add react-router-dom @tanstack/react-query zustand framer-motion
pnpm add -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

Create `apps/web/tailwind.config.ts`:
```typescript
import type { Config } from 'tailwindcss'
import preset from '../../packages/config/tailwind/preset'

export default {
  presets: [preset],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
} satisfies Config
```

Create `apps/web/src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body {
    @apply bg-bg-primary text-white font-sans antialiased;
  }

  * {
    @apply border-border;
  }
}

@layer utilities {
  .text-gradient {
    @apply bg-gradient-to-r from-accent-green via-accent-purple to-accent-orange bg-clip-text text-transparent;
  }

  .glow-green {
    @apply shadow-glow-green;
  }

  .glow-orange {
    @apply shadow-glow-orange;
  }
}
```

### 6. Create Base Layout Component
Create `apps/web/src/App.tsx`:
```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from './components/layout/Layout'

const queryClient = new QueryClient()

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<div>IDE</div>} />
            <Route path="discover" element={<div>Discovery</div>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
```

Create `apps/web/src/components/layout/Layout.tsx`:
```tsx
import { Outlet } from 'react-router-dom'

export function Layout() {
  return (
    <div className="h-screen flex flex-col bg-bg-primary">
      {/* Header */}
      <header className="h-14 border-b flex items-center px-4 bg-bg-secondary">
        <h1 className="text-xl font-bold text-gradient">hatch.sh</h1>
        <div className="ml-auto">
          {/* Wallet button placeholder */}
          <button className="px-4 py-2 bg-accent-green/10 text-accent-green rounded-lg hover:bg-accent-green/20 transition">
            Connect
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 border-r bg-bg-secondary p-4">
          <button className="w-full py-2 px-4 bg-accent-green text-black rounded-lg font-semibold hover:shadow-glow-green transition">
            + New Project
          </button>
          <div className="mt-4 text-sm text-gray-500">
            Your projects will appear here
          </div>
        </aside>

        {/* Chat area placeholder */}
        <div className="flex-1 bg-bg-primary">
          <Outlet />
        </div>

        {/* Right panel */}
        <aside className="w-80 border-l bg-bg-secondary">
          <div className="p-4 border-b">
            <h3 className="text-sm font-semibold text-gray-400">Preview</h3>
            <div className="mt-2 aspect-video bg-bg-primary rounded-lg flex items-center justify-center text-gray-600">
              No preview
            </div>
          </div>
          <div className="p-4">
            <h3 className="text-sm font-semibold text-gray-400">Token</h3>
            <div className="mt-2 text-gray-600 text-sm">
              Deploy your app to launch a token
            </div>
          </div>
        </aside>
      </main>
    </div>
  )
}
```

### 7. Create Directory Structure
```
valencia/
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
├── .gitignore
├── apps/
│   ├── web/
│   │   ├── package.json
│   │   ├── vite.config.ts
│   │   ├── tsconfig.json
│   │   ├── tailwind.config.ts
│   │   ├── postcss.config.js
│   │   ├── index.html
│   │   └── src/
│   │       ├── main.tsx
│   │       ├── App.tsx
│   │       ├── index.css
│   │       ├── vite-env.d.ts
│   │       └── components/
│   │           └── layout/
│   │               └── Layout.tsx
│   └── .gitkeep
├── packages/
│   ├── config/
│   │   ├── package.json
│   │   ├── tailwind/
│   │   │   └── preset.js
│   │   └── typescript/
│   │       └── base.json
│   ├── ui/
│   │   └── .gitkeep
│   └── contracts/
│       └── .gitkeep
└── services/
    ├── api/
    │   └── .gitkeep
    └── deploy/
        └── .gitkeep
```

## Definition of Done
- [ ] `pnpm install` works from root
- [ ] `pnpm dev:web` starts the Vite dev server
- [ ] Web app renders with degen color theme
- [ ] 3-panel layout visible (sidebar, chat, right panel)
- [ ] Tailwind preset with degen colors working
- [ ] All directories created for other agents

## Notes for Other Agents
Once this module is complete, notify other agents that they can begin their work. The foundation includes:
- Turborepo monorepo with pnpm workspaces
- React + TypeScript + Vite web app
- TailwindCSS with degen color preset
- Basic layout component
