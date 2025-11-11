import { useState, useEffect, useCallback, useRef } from 'react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import MainMenu from './components/MainMenu';
import Map from './components/Map';
import AddEventForm, { type NewEventPayload } from './components/AddEventForm';
import UpdateLocationForm from './components/UpdateLocationForm';
import LoginForm from './components/LoginForm';
import RegisterForm from './components/RegisterForm';
import UserProfile from './components/UserProfile.tsx';
import NearbyLocations from './components/NearbyLocations';
import { SettingsProvider } from './contexts/settings/provider';
import { AuthProvider, useAuth } from './contexts/auth';
import { useSettings } from './contexts/settings/hooks';
import { ThemeWrapper } from './components/ThemeWrapper';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

type Event = {
  id: string;
  title: string;
  description: string | null;
  host_type: 'fraternity' | 'house' | 'club';
  location_lat: number;
  location_lng: number;
  start_time: string;
  end_time: string | null;
  tags: string[];
  theme: string | null;
  music_type: string | null;
  cover_charge: string | null;
  is_byob: boolean;
  is_active: boolean;
  created_by: string;
  created_at: string;
  checkin_count?: number;
};

type View = 'welcome' | 'map' | 'login' | 'register' | 'upcoming';

function AppContent() {
  const hasSeenWelcome = localStorage.getItem('hasSeenPartyWelcome') === 'true';
  const [view, setView] = useState<View>(hasSeenWelcome ? 'map' : 'welcome');
  const [profileOpen, setProfileOpen] = useState(false);
  const [addEventModalOpen, setAddEventModalOpen] = useState(false);
  const [manageEventsModalOpen, setManageEventsModalOpen] = useState(false);
  const [events, setEvents] = useState<Event[]>([]);
  const [eventsRefreshing, setEventsRefreshing] = useState(false);
  const [lastEventsUpdate, setLastEventsUpdate] = useState<number | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(() => new Set());
  const [checkedInIds, setCheckedInIds] = useState<Set<string>>(() => new Set());
  const [pendingFavorite, setPendingFavorite] = useState<string | null>(null);
  const [pendingCheckIn, setPendingCheckIn] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<{ message: string; severity: 'success' | 'error' } | null>(null);
  const { token, user } = useAuth();
  const { autoRefresh } = useSettings();

  const handleCloseSnackbar = () => setSnackbar(null);

  const handleGetStarted = () => {
    localStorage.setItem('hasSeenPartyWelcome', 'true');
    setView('map');
  };

  const isRefreshingRef = useRef(false);
  const fetchEvents = useCallback(async () => {
    if (isRefreshingRef.current) return;
    isRefreshingRef.current = true;
    setEventsRefreshing(true);
    try {
      const res = await fetch(`${API_BASE}/api/events`);
      if (!res.ok) {
        console.error('Failed to load events', await res.text());
        return;
      }
      const data = (await res.json()) as Event[];
      setEvents(data);
      setLastEventsUpdate(Date.now());
    } catch (error) {
      console.error('Error fetching events', error);
    } finally {
      setEventsRefreshing(false);
      isRefreshingRef.current = false;
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  useEffect(() => {
    if (!autoRefresh) return;
    
    const id = setInterval(() => {
      fetchEvents();
    }, 30_000);
    return () => clearInterval(id);
  }, [fetchEvents, autoRefresh]);

  useEffect(() => {
    const fetchFavorites = async () => {
      if (!token) {
        setFavoriteIds(new Set());
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/api/favorites`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.status === 401) {
          setFavoriteIds(new Set());
          return;
        }
        if (!res.ok) {
          console.error('Failed to load favorites', await res.text());
          return;
        }
        const favoriteEvents = (await res.json()) as Event[];
        setFavoriteIds(new Set(favoriteEvents.map((event) => event.id)));
      } catch (error) {
        console.error('Error loading favorites', error);
      }
    };

    fetchFavorites();
  }, [token]);

  useEffect(() => {
    const fetchCheckins = async () => {
      if (!token) {
        setCheckedInIds(new Set());
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/api/checkins`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.status === 401) {
          setCheckedInIds(new Set());
          return;
        }
        if (!res.ok) {
          console.error('Failed to load check-ins', await res.text());
          return;
        }
        const checkins = (await res.json()) as Array<{ event_id: string }>;
        setCheckedInIds(new Set(checkins.map((checkin) => checkin.event_id)));
      } catch (error) {
        console.error('Error loading check-ins', error);
      }
    };

    fetchCheckins();
  }, [token]);

  const handleAddEvent = async (payload: NewEventPayload) => {
    try {
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(`${API_BASE}/api/events`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      if (res.status === 401) {
        setAddEventModalOpen(false);
        setView('login');
        return;
      }

      if (!res.ok) {
        console.error('Failed to create event', await res.text());
        setSnackbar({ message: 'Could not publish event', severity: 'error' });
        return;
      }

      const created = (await res.json()) as Event;
      setEvents((prev) => [...prev, created]);
      setAddEventModalOpen(false);
      setView('map');
      setSnackbar({ message: 'Event published!', severity: 'success' });
    } catch (error) {
      console.error('Error creating event', error);
      setSnackbar({ message: 'Something went wrong while publishing.', severity: 'error' });
    }
  };

  const handleUpdateEvent = async (id: string, updates: Partial<Event>) => {
    try {
      if (!token) {
        setView('login');
        return false;
      }

      const res = await fetch(`${API_BASE}/api/events/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(updates)
      });

      if (res.status === 401) {
        setView('login');
        return false;
      }

      if (!res.ok) {
        console.error('Failed to update event', await res.text());
        setSnackbar({ message: 'Update failed.', severity: 'error' });
        return false;
      }

      const updated = (await res.json()) as Event;
      setEvents((prev) => prev.map((event) => (event.id === id ? updated : event)));
      setSnackbar({ message: 'Event updated.', severity: 'success' });
      return true;
    } catch (error) {
      console.error('Error updating event', error);
      setSnackbar({ message: 'Unable to update event.', severity: 'error' });
      return false;
    }
  };

  const handleToggleFavorite = async (eventId: string) => {
    if (!token) {
      setView('login');
      return;
    }

    const shouldFavorite = !favoriteIds.has(eventId);
    setPendingFavorite(eventId);

    try {
      const res = await fetch(`${API_BASE}/api/favorites`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ event_id: eventId, favorite: shouldFavorite })
      });

      if (res.status === 401) {
        setView('login');
        return;
      }

      if (!res.ok) {
        console.error('Failed to toggle favorite', await res.text());
        setSnackbar({ message: 'Favorite action failed.', severity: 'error' });
        return;
      }

      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (shouldFavorite) {
          next.add(eventId);
        } else {
          next.delete(eventId);
        }
        return next;
      });
    } catch (error) {
      console.error('Error toggling favorite', error);
      setSnackbar({ message: 'Favorite action failed.', severity: 'error' });
    } finally {
      setPendingFavorite(null);
    }
  };

  const handleCheckIn = async (eventId: string) => {
    if (!token) {
      setView('login');
      return;
    }

    setPendingCheckIn(eventId);
    try {
      const res = await fetch(`${API_BASE}/api/checkins`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ event_id: eventId })
      });

      if (res.status === 401) {
        setView('login');
        return;
      }

      if (!res.ok) {
        console.error('Failed to check in', await res.text());
        setSnackbar({ message: 'Check-in failed.', severity: 'error' });
        return;
      }

      // Add to checked-in events
      setCheckedInIds((prev) => {
        const next = new Set(prev);
        next.add(eventId);
        return next;
      });

      // Refresh events to get updated check-in count
      fetchEvents();

      setSnackbar({ message: 'Checked in! Have fun 🎉', severity: 'success' });
    } catch (error) {
      console.error('Error checking in', error);
      setSnackbar({ message: 'Check-in failed.', severity: 'error' });
    } finally {
      setPendingCheckIn(null);
    }
  };

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {view === 'welcome' ? (
          <Box
            component="main"
            sx={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              p: 3,
              bgcolor: 'linear-gradient(135deg, #ff9d6c 0%, #ff4d4d 100%)',
              color: '#fff',
              textAlign: 'center'
            }}
          >
            <Container maxWidth="sm">
              <Typography variant="h4" component="h1" gutterBottom>
                Campus Party Finder
              </Typography>
              <Typography variant="body1" sx={{ mb: 3 }}>
                Discover the hottest parties around campus, see who is going, and share your own events in seconds. Tap into the vibe map and never miss a good time again.
              </Typography>
              <Button
                variant="contained"
                color="secondary"
                onClick={handleGetStarted}
                sx={{ borderRadius: 3, px: 3 }}
              >
                Jump to the Map
              </Button>
            </Container>
          </Box>
        ) : (
          <>
            <MainMenu 
              currentView={view} 
              setView={setView} 
              onHostClick={() => {
                if (!token) {
                  setView('login');
                } else {
                  setAddEventModalOpen(true);
                }
              }}
              onManageClick={() => {
                if (!token) {
                  setView('login');
                } else {
                  setManageEventsModalOpen(true);
                }
              }}
            />
            <Box
              component="main"
              sx={{
                flex: 1,
                overflow: 'auto',
                height: 'calc(100vh - 64px)',
                pb: 0
              }}
            >
              {view === 'map' && (
                <Box
                  sx={{
                    height: { xs: '55vh', sm: '70vh' },
                    borderRadius: 2,
                    overflow: 'hidden',
                    boxShadow: 3,
                    m: 2
                  }}
                >
                  <Map
                    events={events}
                    favoriteIds={favoriteIds}
                    checkedInIds={checkedInIds}
                    onToggleFavorite={handleToggleFavorite}
                    onCheckIn={handleCheckIn}
                    pendingFavoriteId={pendingFavorite}
                    pendingCheckInId={pendingCheckIn}
                    onProfileClick={() => setProfileOpen(true)}
                    onRefreshEvents={fetchEvents}
                    eventsRefreshing={eventsRefreshing}
                    lastEventsUpdate={lastEventsUpdate}
                  />
                </Box>
              )}

              {view !== 'map' && (
                <Box sx={{ p: 2 }}>
                  {view === 'upcoming' && (
                    <NearbyLocations
                      events={events}
                      favoriteIds={favoriteIds}
                      onToggleFavorite={handleToggleFavorite}
                    />
                  )}
                  {view === 'login' && (
                    <LoginForm onSuccess={() => setView('map')} onSwitchToRegister={() => setView('register')} />
                  )}
                  {view === 'register' && (
                    <RegisterForm onSuccess={() => setView('map')} onSwitchToLogin={() => setView('login')} />
                  )}
                </Box>
              )}
            </Box>

            <Dialog 
              open={addEventModalOpen} 
              onClose={() => setAddEventModalOpen(false)}
              maxWidth="md"
              fullWidth
            >
              <DialogTitle>
                Host a Party
                <IconButton
                  aria-label="close"
                  onClick={() => setAddEventModalOpen(false)}
                  sx={{
                    position: 'absolute',
                    right: 8,
                    top: 8,
                    color: (theme) => theme.palette.grey[500],
                  }}
                >
                  <CloseIcon />
                </IconButton>
              </DialogTitle>
              <DialogContent>
                <AddEventForm onAdd={handleAddEvent} />
              </DialogContent>
            </Dialog>

            <Dialog 
              open={manageEventsModalOpen} 
              onClose={() => setManageEventsModalOpen(false)}
              maxWidth="md"
              fullWidth
            >
              <DialogTitle>
                Manage My Events
                <IconButton
                  aria-label="close"
                  onClick={() => setManageEventsModalOpen(false)}
                  sx={{
                    position: 'absolute',
                    right: 8,
                    top: 8,
                    color: (theme) => theme.palette.grey[500],
                  }}
                >
                  <CloseIcon />
                </IconButton>
              </DialogTitle>
              <DialogContent>
                <UpdateLocationForm
                  events={events}
                  currentUserId={user?.user_id ?? null}
                  onUpdateEvent={handleUpdateEvent}
                />
              </DialogContent>
            </Dialog>

            <UserProfile open={profileOpen} onClose={() => setProfileOpen(false)} />
          </>
        )}

        <Snackbar
          open={!!snackbar}
          autoHideDuration={4000}
          onClose={handleCloseSnackbar}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          {snackbar ? (
            <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
              {snackbar.message}
            </Alert>
          ) : undefined}
        </Snackbar>
      </Box>
  );
}

function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <ThemeWrapper>
          <AppContent />
        </ThemeWrapper>
      </SettingsProvider>
    </AuthProvider>
  );
}

export default App;