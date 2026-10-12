import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="max-w-2xl text-center">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-6xl">
          VoucherHousingPlatform
        </h1>
        
        <p className="mt-6 text-lg leading-8 text-slate-600">
          Broker operations platform for voucher housing placements.
          Organize clients, match properties, and manage showings.
        </p>
        
        <div className="mt-10 flex items-center justify-center gap-x-6">
          <Link
            href="/auth/login"
            className="rounded-md bg-primary-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
          >
            Sign In
          </Link>
          
          <Link
            href="https://github.com/chee86j/VoucherHousingPlatform/tree/main/docs"
            className="text-sm font-semibold leading-6 text-slate-900"
          >
            Documentation <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
      
      <footer className="absolute bottom-8 text-sm text-slate-500">
        Broker operations prototype — not for real client data
      </footer>
    </main>
  );
}
