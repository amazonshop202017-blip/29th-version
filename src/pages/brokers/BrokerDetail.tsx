import { useMemo, useState } from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import { Search, ChevronRight, Lightbulb } from 'lucide-react';
import { motion } from 'framer-motion';
import { SharedNavbar } from '@/components/landing/SharedNavbar';
import { LandingFooter } from '@/components/landing/LandingFooter';

interface BrokerEntry {
  slug: string;
  name: string;
}

const brokers: BrokerEntry[] = [
  { slug: 'mt5', name: 'MetaTrader 5 (MT5)' },
  { slug: 'tradovate', name: 'Tradovate / NinjaTrader' },
  { slug: 'zerodha', name: 'Zerodha' },
];

const content: Record<string, { title: string; render: () => JSX.Element }> = {
  mt5: {
    title: 'MetaTrader 5 (MT5) — Importing Trades via File Upload',
    render: () => <MT5Content />,
  },
  tradovate: {
    title: 'Tradovate / NinjaTrader — Importing Trades via File Upload in TradeValley',
    render: () => <TradovateContent />,
  },
};

const BrokerDetail = () => {
  const { slug } = useParams<{ slug: string }>();
  const [query, setQuery] = useState('');

  const current = slug && content[slug] ? slug : null;
  const filtered = useMemo(
    () => brokers.filter((b) => b.name.toLowerCase().includes(query.trim().toLowerCase())),
    [query]
  );

  if (!current) {
    return <Navigate to="/supported-brokers" replace />;
  }

  const entry = content[current];

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "'DM Sans', 'Inter', sans-serif" }}>
      <SharedNavbar />

      <section className="pt-28 pb-16 px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-xs mb-6" style={{ color: '#8A8A8A' }}>
            <Link to="/supported-brokers" className="hover:underline">Supported Brokers</Link>
            <ChevronRight className="w-3 h-3" />
            <span style={{ color: '#0F0F0F' }}>{brokers.find((b) => b.slug === current)?.name}</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-10">
            {/* Sidebar */}
            <aside className="lg:sticky lg:top-28 self-start">
              <div
                className="rounded-2xl border p-3"
                style={{ borderColor: 'rgba(15,15,15,0.08)', background: '#FFFFFF' }}
              >
                <div className="relative mb-3">
                  <Search
                    className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2"
                    style={{ color: '#8A8A8A' }}
                  />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search brokers..."
                    className="w-full pl-8 pr-3 py-2 text-xs rounded-lg border outline-none"
                    style={{
                      borderColor: 'rgba(15,15,15,0.1)',
                      color: '#0F0F0F',
                      background: '#FAFAFA',
                    }}
                  />
                </div>

                <div
                  className="text-[10px] font-semibold tracking-[0.2em] uppercase px-2 pt-2 pb-1.5"
                  style={{ color: '#8A8A8A' }}
                >
                  All Brokers
                </div>

                <nav className="flex flex-col">
                  {filtered.length === 0 ? (
                    <div className="px-2 py-3 text-xs" style={{ color: '#8A8A8A' }}>
                      No matches
                    </div>
                  ) : (
                    filtered.map((b) => {
                      const active = b.slug === current;
                      return (
                        <Link
                          key={b.slug}
                          to={`/supported-brokers/${b.slug}`}
                          className="px-3 py-2 rounded-lg text-sm transition-colors"
                          style={{
                            background: active ? 'rgba(15,15,15,0.06)' : 'transparent',
                            color: active ? '#0F0F0F' : '#4A4A4A',
                            fontWeight: active ? 600 : 500,
                          }}
                        >
                          {b.name}
                        </Link>
                      );
                    })
                  )}
                </nav>
              </div>
            </aside>

            {/* Content */}
            <motion.article
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="min-w-0"
            >
              <h1
                className="text-3xl md:text-4xl font-bold leading-tight mb-8"
                style={{ color: '#0F0F0F' }}
              >
                {entry.title}
              </h1>

              {entry.render()}
            </motion.article>
          </div>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
};

const MT5Content = () => (
  <div className="space-y-6" style={{ color: '#2E2E2E' }}>
    <p className="text-base leading-relaxed">
      Easily import your MetaTrader 5 (MT5) trades into TradeValley using the file upload method.
      Follow the steps below to export your trading history and upload it seamlessly to keep your
      journal accurate and up to date.
    </p>

    {/* Pro Tip callout */}
    <div
      className="rounded-2xl p-5 flex gap-4 items-start"
      style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.18)' }}
    >
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: 'rgba(16,185,129,0.15)' }}
      >
        <Lightbulb className="w-4.5 h-4.5" style={{ color: '#059669' }} />
      </div>
      <div>
        <div className="font-semibold text-sm mb-1 flex items-center gap-2 flex-wrap" style={{ color: '#065F46' }}>
          <span>Pro Tip: Want an easier way to import your trades?</span>
          <span
            className="text-[10px] font-bold tracking-[0.15em] uppercase px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(245,158,11,0.15)', color: '#B45309' }}
          >
            Coming Soon
          </span>
        </div>
        <p className="text-sm leading-relaxed" style={{ color: '#2E2E2E' }}>
          TradeValley will soon support direct MetaTrader 5 syncing. You'll be able to connect your
          MT5 account from the broker sync section and have your trades imported automatically — no
          manual uploads required.
        </p>
      </div>
    </div>

    <Section title="Exporting Trade Data from MT5" />

    <Step
      number={1}
      title="Open the MetaTrader 5 Desktop App"
      body="Launch the MetaTrader 5 platform on your computer."
    />

    <Step
      number={2}
      title="Open the History Tab"
      body={
        <>
          <p>In the Terminal window at the bottom of MT5, click on the <strong>History</strong> tab.</p>
          <p className="mt-2">
            If you can't find the Terminal window, use the search function in MT5 and search for
            "History" to open it.
          </p>
        </>
      }
    />

    <Step
      number={3}
      title="Select Positions and Choose a Time Period"
      body={
        <>
          <p>Right-click anywhere inside the History tab.</p>
          <p className="mt-2">Then:</p>
          <ul className="list-disc pl-5 mt-1 space-y-1">
            <li>Select <strong>Positions</strong></li>
            <li>Choose the time range you want to export</li>
          </ul>
          <p className="mt-3">Available options include:</p>
          <ul className="list-disc pl-5 mt-1 space-y-1">
            <li>All History</li>
            <li>Last 3 Months</li>
            <li>Last Month</li>
            <li>Custom Period</li>
          </ul>
        </>
      }
    />

    <Step
      number={4}
      title="Export the Report"
      body={
        <>
          <p>Right-click again inside the History tab, then select:</p>
          <p className="mt-2 inline-block px-3 py-1.5 rounded-md text-sm font-medium"
             style={{ background: 'rgba(15,15,15,0.05)', color: '#0F0F0F' }}>
            Report → HTML
          </p>
          <p className="mt-3">
            Save the file as an HTML report to your desktop or another easy-to-find location.
          </p>
          <p className="mt-2">
            Once saved, you can upload the file directly into TradeValley to import your trades
            successfully.
          </p>
        </>
      }
    />
  </div>
);

const Section = ({ title }: { title: string }) => (
  <h2
    className="text-xl md:text-2xl font-bold pt-4"
    style={{ color: '#0F0F0F' }}
  >
    {title}
  </h2>
);

const Step = ({
  number,
  title,
  body,
}: {
  number: number;
  title: string;
  body: React.ReactNode;
}) => (
  <div
    className="rounded-2xl border p-5"
    style={{ borderColor: 'rgba(15,15,15,0.08)', background: '#FFFFFF' }}
  >
    <div className="flex items-center gap-3 mb-2">
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
        style={{ background: '#0F0F0F', color: '#FFFFFF' }}
      >
        {number}
      </div>
      <h3 className="text-base font-semibold" style={{ color: '#0F0F0F' }}>
        {title}
      </h3>
    </div>
    <div className="text-sm leading-relaxed pl-10" style={{ color: '#4A4A4A' }}>
      {typeof body === 'string' ? <p>{body}</p> : body}
    </div>
  </div>
);

export default BrokerDetail;
