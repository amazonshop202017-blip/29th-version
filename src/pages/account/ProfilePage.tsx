import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Camera, Trash2, MapPin, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from '@/hooks/use-toast';

const ProfilePage = () => {
  const { user } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState(user?.email || '');
  const [timezone, setTimezone] = useState('');
  const [localTime, setLocalTime] = useState('');
  const [profileImage, setProfileImage] = useState<string | null>(null);

  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setTimezone(tz);

    const updateTime = () => {
      setLocalTime(new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (user?.email) {
      setEmail(user.email);
      const namePart = user.email.split('@')[0];
      setUsername(namePart);
      const parts = namePart.split(/[._-]/);
      if (parts.length >= 2) {
        setFirstName(parts[0].charAt(0).toUpperCase() + parts[0].slice(1));
        setLastName(parts[1].charAt(0).toUpperCase() + parts[1].slice(1));
      } else {
        setFirstName(namePart.charAt(0).toUpperCase() + namePart.slice(1));
      }
    }
  }, [user]);

  const handleImageUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          setProfileImage(ev.target?.result as string);
          toast({ title: 'Profile image updated' });
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  const handleRemoveImage = () => {
    setProfileImage(null);
    toast({ title: 'Profile image removed' });
  };

  const handleSave = () => {
    toast({ title: 'Profile updated successfully' });
  };

  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || 'U';

  return (
    <div className="max-w-5xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-6 lg:gap-8">
          {/* Left Column - Avatar & Identity */}
          <Card className="lg:col-span-2 p-5 sm:p-8 flex flex-col items-center text-center relative overflow-hidden">
            {/* Decorative gradient blob */}
            <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-br from-primary/20 via-primary/10 to-transparent rounded-t-xl" />
            
            <div className="relative z-10 mt-4 sm:mt-8">
              <motion.div
                whileHover={{ scale: 1.05 }}
                transition={{ type: 'spring', stiffness: 300 }}
              >
                <Avatar className="w-20 h-20 sm:w-28 sm:h-28 border-4 border-background shadow-xl">
                  <AvatarImage src={profileImage || undefined} />
                  <AvatarFallback className="text-2xl sm:text-3xl font-bold bg-primary text-primary-foreground">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </motion.div>
            </div>

            <h2 className="text-xl sm:text-2xl font-bold text-foreground mt-4 sm:mt-5 relative z-10">
              {firstName} {lastName}
            </h2>
            <p className="text-sm text-muted-foreground mt-1 relative z-10">@{username}</p>
            <p className="text-xs font-mono text-muted-foreground/70 mt-0.5 relative z-10">
              User ID: {user?.userId || '—'}
            </p>

            <Separator className="my-4 sm:my-5 w-full relative z-10" />

            <div className="w-full space-y-3 relative z-10">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <MapPin className="w-4 h-4 text-primary flex-shrink-0" />
                <span className="truncate">{timezone}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Clock className="w-4 h-4 text-primary flex-shrink-0" />
                <span className="font-mono tracking-wide">{localTime}</span>
              </div>
            </div>

            <Separator className="my-4 sm:my-5 w-full relative z-10" />

            <div className="flex gap-3 w-full relative z-10">
              <Button
                onClick={handleImageUpload}
                variant="outline"
                className="flex-1 gap-2 text-xs sm:text-sm"
                size="sm"
              >
                <Camera className="w-4 h-4" />
                Update
              </Button>
              <Button
                onClick={handleRemoveImage}
                variant="outline"
                className="flex-1 gap-2 text-destructive hover:text-destructive text-xs sm:text-sm"
                size="sm"
              >
                <Trash2 className="w-4 h-4" />
                Remove
              </Button>
            </div>
          </Card>

          {/* Right Column - Profile Details */}
          <Card className="lg:col-span-3 p-5 sm:p-8">
            <h3 className="text-lg font-semibold text-foreground mb-5 sm:mb-6">Personal Information</h3>

            <div className="space-y-4 sm:space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                <div className="space-y-2">
                  <Label htmlFor="firstName" className="text-sm font-medium text-foreground">First Name</Label>
                  <Input
                    id="firstName"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="h-10 sm:h-11"
                    placeholder="Enter first name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName" className="text-sm font-medium text-foreground">Last Name</Label>
                  <Input
                    id="lastName"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="h-10 sm:h-11"
                    placeholder="Enter last name"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="username" className="text-sm font-medium text-foreground">Username</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="h-10 sm:h-11"
                  placeholder="Enter username"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-foreground">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-10 sm:h-11"
                  placeholder="Enter email"
                />
              </div>

              <Separator className="my-2" />

              <div className="flex justify-end">
                <Button onClick={handleSave} className="px-6 sm:px-8 h-10 sm:h-11">
                  Save Changes
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </motion.div>
    </div>
  );
};

export default ProfilePage;
