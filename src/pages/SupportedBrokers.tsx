import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Search, Check, Minus } from 'lucide-react';
import { motion } from 'framer-motion';
import { SharedNavbar } from '@/components/landing/SharedNavbar';
import { LandingFooter } from '@/components/landing/LandingFooter';

interface Broker {
  name: string;
  fileImport: boolean;
  autoSync: boolean;
}

const brokers: Broker[] = [
  { name: 'MT5', fileImport: true, autoSync: false },
  { name: 'Tradovate', fileImport: true, autoSync: false },
  { name: 'Zerodha', fileImport: true, autoSync: true },
];

const SupportedBrokers = () => {
  const [query, setQuery] = useState('');

  const filtered = useMemo(
    () => brokers.filter((b) => b.name.toLowerCase().includes(query.trim().toLowerCase())),
    [query]
  );

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "'DM Sans', 'Inter', sans-serif" }}>
      <SharedNavbar />

      {/* Hero */}
      <section className="pt-32 pb-12 px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span
              className="inline-block text-[11px] font-semibold tracking-[0.2em] uppercase mb-4 px-3 py-1 rounded-full"
              style={{ color: '#0F0F0F', background: 'rgba(15,15,15,0.05)' }}
            >
              Integrations
            </span>
            <h1
              className="text-4xl md:text-5xl font-bold leading-tight mb-5"
              style={{ color: '#0F0F0F' }}
            >
              Does TradeValley support your broker?
            </h1>
            <p className="text-base md:text-lg leading-relaxed" style={{ color: '#6B6B6B' }}>
              Import trades automatically via Auto Sync, or upload a file export from your broker.
              Search below to confirm your broker is supported.
            </p>
          </motion.div>

          {/* Search */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mt-8 relative max-w-xl mx-auto"
          >
            <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2" style={{ color: '#8A8A8A' }} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your broker (e.g. Zerodha, MT5...)"
              className="w-full pl-11 pr-4 py-3.5 text-sm rounded-2xl border outline-none transition-colors"
              style={{
                borderColor: 'rgba(15,15,15,0.12)',
                color: '#0F0F0F',
                background: '#FFFFFF',
              }}
            />
          </motion.div>
        </div>
      </section>

      {/* Table */}
      <section className="pb-20 px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="rounded-2xl border overflow-hidden"
            style={{ borderColor: 'rgba(15,15,15,0.08)', background: '#FFFFFF' }}
          >
            {/* Header row */}
            <div
              className="grid grid-cols-[1.5fr_1fr_1fr] px-6 py-4 text-[11px] font-semibold tracking-[0.15em] uppercase"
              style={{ background: '#FAFAFA', color: '#8A8A8A', borderBottom: '1px solid rgba(15,15,15,0.06)' }}
            >
              <div>Broker</div>
              <div className="text-center">File Import</div>
              <div className="text-center">Auto Sync</div>
            </div>

            {filtered.length === 0 ? (
              <div className="px-6 py-12 text-center text-sm" style={{ color: '#8A8A8A' }}>
                No brokers match "{query}". We're adding new integrations regularly.
              </div>
            ) : (
              filtered.map((b, i) => (
                <div
                  key={b.name}
                  className="grid grid-cols-[1.5fr_1fr_1fr] px-6 py-5 items-center text-sm transition-colors hover:bg-[rgba(15,15,15,0.02)]"
                  style={{
                    borderBottom:
                      i === filtered.length - 1 ? 'none' : '1px solid rgba(15,15,15,0.05)',
                    color: '#0F0F0F',
                  }}
                >
                  <Link
                    to={`/supported-brokers/${b.name.toLowerCase()}`}
                    className="font-medium hover:underline"
                  >
                    {b.name}
                  </Link>
                  <div className="flex justify-center">
                    <StatusIcon active={b.fileImport} />
                  </div>
                  <div className="flex justify-center">
                    <StatusIcon active={b.autoSync} />
                  </div>
                </div>
              ))
            )}
          </motion.div>

          <p className="text-xs text-center mt-6" style={{ color: '#8A8A8A' }}>
            More brokers are being added every month.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="pb-24 px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-3" style={{ color: '#0F0F0F' }}>
            Don't see your broker?
          </h2>
          <p className="mb-6 text-base" style={{ color: '#6B6B6B' }}>
            We're constantly expanding our integrations. Request yours and we'll prioritize it.
          </p>
          <Link
            to="/entering"
            className="inline-flex items-center justify-center text-sm font-semibold px-6 py-3 rounded-xl transition-colors"
            style={{ background: '#0F0F0F', color: '#FFFFFF' }}
          >
            Get Started
          </Link>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
};

const StatusIcon = ({ active }: { active: boolean }) =>
  active ? (
    <div
      className="w-6 h-6 rounded-full flex items-center justify-center"
      style={{ background: 'rgba(16,185,129,0.12)' }}
    >
      <Check className="w-3.5 h-3.5" style={{ color: '#059669' }} strokeWidth={3} />
    </div>
  ) : (
    <div
      className="w-6 h-6 rounded-full flex items-center justify-center"
      style={{ background: 'rgba(15,15,15,0.04)' }}
    >
      <Minus className="w-3.5 h-3.5" style={{ color: '#C4C4C4' }} />
    </div>
  );

export default SupportedBrokers;
