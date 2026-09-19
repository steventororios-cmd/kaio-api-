import Link from 'next/link';
import { logout } from '@/app/login/actions';

const NAV = [
  { href: '/inbox', label: 'Inbox', icon: '💬' },
  { href: '/pipeline', label: 'Pipeline', icon: '📊' },
  { href: '/contacts', label: 'Contactos', icon: '👤' },
  { href: '/tasks', label: 'Tareas', icon: '✅' },
  { href: '/tours', label: 'Tours', icon: '🧭' },
  { href: '/settings', label: 'Configuración', icon: '⚙️' },
];

export function Sidebar() {
  return (
    <aside className="flex h-screen w-56 shrink-0 flex-col border-r border-gray-200 bg-white">
      <div className="px-4 py-5">
        <p className="text-sm font-semibold text-gray-900">Aventuras CRM</p>
        <p className="text-xs text-gray-500">Aventuras Tour Medellín</p>
      </div>
      <nav className="flex-1 space-y-1 px-2">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
          >
            <span aria-hidden>{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>
      <form action={logout} className="border-t border-gray-200 p-2">
        <button
          type="submit"
          className="w-full rounded-md px-3 py-2 text-left text-sm text-gray-500 hover:bg-gray-100"
        >
          Cerrar sesión
        </button>
      </form>
    </aside>
  );
}
