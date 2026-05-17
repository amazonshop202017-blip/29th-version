import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown, Menu, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';

const homeLinks = [
  { label: 'Home 1', path: '/' },
  { label: 'Home 2', path: '/home-2' },
  { label: 'Home 3', path: '/home-3' },
];

const mobileLinks = [
  { label: 'Home', path: '/' },
  { label: 'Features', path: '/features' },
  { label: 'Supported Brokers', path: '/supported-brokers' },
  { label: 'Pricing', path: '/pricing' },
];

export const SharedNavbar = () => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const isHomePage = ['/', '/home-2', '/home-3'].includes(location.pathname);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex justify-center px-4 pt-4">
      <div className="w-full max-w-5xl relative">
        <div
          className="w-full flex items-center justify-between px-6 py-3 rounded-[22px] border transition-all duration-500"
          style={{
            background: 'rgba(255, 255, 255, 0.65)',
            backdropFilter: 'blur(20px) saturate(180%)',
            WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            borderColor: 'rgba(255, 255, 255, 0.45)',
            boxShadow: '0 4px 30px rgba(0, 0, 0, 0.06), 0 1px 3px rgba(0, 0, 0, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.6)',
          }}
        >
          <Link to="/" className="text-lg tracking-tight" style={{ fontFamily: "'DM Sans', 'Inter', sans-serif" }}>
            <span className="font-normal" style={{ color: '#0F0F0F' }}>Trade</span>
            <span className="font-bold" style={{ color: '#0F0F0F' }}>Valley</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-8">
            <DropdownMenu>
              <DropdownMenuTrigger
                className="text-sm flex items-center gap-1 outline-none transition-colors"
                style={{ color: isHomePage ? '#0F0F0F' : '#8A8A8A', fontFamily: "'DM Sans', 'Inter', sans-serif" }}
                onMouseEnter={e => (e.currentTarget.style.color = '#0F0F0F')}
                onMouseLeave={e => { if (!isHomePage) e.currentTarget.style.color = '#8A8A8A'; }}
              >
                Home <ChevronDown className="w-3.5 h-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-[130px]">
                {homeLinks.map((link) => (
                  <DropdownMenuItem key={link.path} asChild>
                    <Link
                      to={link.path}
                      className="w-full cursor-pointer"
                      style={{ fontWeight: location.pathname === link.path ? 600 : 400 }}
                    >
                      {link.label}
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {[
              { label: 'Features', path: '/features' },
              { label: 'Supported Brokers', path: '/supported-brokers' },
              { label: 'Pricing', path: '/pricing' },
            ].map(({ label, path }) => (
              <Link
                key={label}
                to={path}
                className="text-sm transition-colors whitespace-nowrap"
                style={{ color: '#8A8A8A', fontFamily: "'DM Sans', 'Inter', sans-serif" }}
                onMouseEnter={e => (e.currentTarget.style.color = '#0F0F0F')}
                onMouseLeave={e => (e.currentTarget.style.color = '#8A8A8A')}
              >
                {label}
              </Link>
            ))}
          </div>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-2">
            <Link
              to="/entering"
              className="text-sm font-medium px-4 py-2 rounded-xl transition-colors"
              style={{ color: '#0F0F0F', fontFamily: "'DM Sans', 'Inter', sans-serif" }}
              onMouseEnter={e => (e.currentTarget.style.color = '#8A8A8A')}
              onMouseLeave={e => (e.currentTarget.style.color = '#0F0F0F')}
            >
              Sign In
            </Link>
            <Link
              to="/entering"
              className="text-sm font-semibold px-5 py-2 rounded-xl transition-colors"
              style={{ background: '#0F0F0F', color: '#FFFFFF' }}
            >
              Get Started
            </Link>
          </div>

          {/* Mobile: Sign In + Menu */}
          <div className="flex md:hidden items-center gap-2">
            <Link
              to="/entering"
              className="text-xs font-semibold px-4 py-1.5 rounded-full transition-colors"
              style={{ background: '#0F0F0F', color: '#FFFFFF', fontFamily: "'DM Sans', 'Inter', sans-serif" }}
            >
              Sign In
            </Link>
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="w-8 h-8 flex items-center justify-center rounded-full transition-colors"
              style={{ color: '#0F0F0F' }}
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile dropdown menu */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.97 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="absolute top-full left-0 right-0 mt-2 mx-0 rounded-[22px] border overflow-hidden md:hidden"
              style={{
                background: 'rgba(255, 255, 255, 0.85)',
                backdropFilter: 'blur(20px) saturate(180%)',
                WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                borderColor: 'rgba(255, 255, 255, 0.45)',
                boxShadow: '0 8px 40px rgba(0, 0, 0, 0.08), 0 2px 6px rgba(0, 0, 0, 0.04)',
              }}
            >
              <div className="flex flex-col py-3 px-2">
                {mobileLinks.map((link) => (
                  <Link
                    key={link.path}
                    to={link.path}
                    className="text-sm px-4 py-3 rounded-xl transition-colors"
                    style={{
                      color: location.pathname === link.path ? '#0F0F0F' : '#555',
                      fontWeight: location.pathname === link.path ? 600 : 400,
                      fontFamily: "'DM Sans', 'Inter', sans-serif",
                    }}
                    onClick={() => setMobileOpen(false)}
                  >
                    {link.label}
                  </Link>
                ))}
                <div className="mx-4 my-1 h-px" style={{ background: 'rgba(0,0,0,0.06)' }} />
                <Link
                  to="/entering"
                  className="text-sm font-semibold mx-2 mt-1 py-2.5 rounded-xl text-center transition-colors"
                  style={{
                    background: '#0F0F0F',
                    color: '#FFFFFF',
                    fontFamily: "'DM Sans', 'Inter', sans-serif",
                  }}
                  onClick={() => setMobileOpen(false)}
                >
                  Get Started
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </nav>
  );
};
