import { Outlet } from 'react-router-dom'

export function Layout() {
  return (
    <div className="h-screen flex flex-col bg-bg-primary">
      {/* Header */}
      <header className="h-14 border-b flex items-center px-4 bg-bg-secondary">
        <h1 className="text-xl font-bold text-gradient">vibed.fun</h1>
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
