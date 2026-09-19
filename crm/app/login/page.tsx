import { login } from './actions';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-gray-900">Aventuras CRM</h1>
        <p className="mt-1 text-sm text-gray-500">Ingresa la contraseña del panel.</p>

        <form action={login} className="mt-6 space-y-4">
          <input type="hidden" name="next" value={params.next || '/inbox'} />
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoFocus
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          {params.error && (
            <p className="text-sm text-red-600">Contraseña incorrecta. Intenta de nuevo.</p>
          )}
          <button
            type="submit"
            className="w-full rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Entrar
          </button>
        </form>
      </div>
    </div>
  );
}
