import { ReactNode, useState } from 'react';
import { AccountSidebar } from './AccountSidebar';
import { useLocation, useNavigate, NavLink } from 'react-router-dom';
import { User, Shield, CreditCard, ArrowLeft, Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

const accountMenuItems = [
  { icon: User, label: 'Profile', path: '/account/profile' },
  { icon: Shield, label: 'Security', path: '/account/security' },
  { icon: CreditCard, label: 'Subscription', path: '/account/subscription' },
];

interface AccountLayoutProps {
  children: ReactNode;
}

export const AccountLayout = ({ children }: AccountLayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar - hidden on mobile/tablet */}
      <div className="hidden lg:block">
        <AccountSidebar />
      </div>

      {/* Mobile/Tablet top bar */}
      <div className="lg:hidden sticky top-0 z-40 bg-background border-b border-border">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="h-9 w-9">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <span className="text-lg font-semibold tracking-tight">
              <span className="font-normal">Trade</span>
              <span className="font-bold">Valley</span>
            </span>
          </div>

          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-64 p-0">
              <div className="flex items-center justify-between px-4 py-4 border-b border-border">
                <span className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Account</span>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMobileOpen(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <nav className="p-3 space-y-1">
                {accountMenuItems.map((item) => {
                  const isActive = location.pathname === item.path;
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200",
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "text-foreground hover:bg-accent"
                      )}
                    >
                      <item.icon className="w-5 h-5 flex-shrink-0" />
                      <span className="font-medium text-sm">{item.label}</span>
                    </NavLink>
                  );
                })}
              </nav>
            </SheetContent>
          </Sheet>
        </div>

        {/* Tab bar for quick navigation */}
        <div className="flex border-t border-border">
          {accountMenuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors border-b-2",
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <item.icon className="w-4 h-4" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      </div>

      <main className={cn("min-h-screen flex flex-col", "lg:ml-[229px]")}>
        <div className="p-4 sm:p-6 lg:p-8 flex-1">
          {children}
        </div>
      </main>
    </div>
  );
};
