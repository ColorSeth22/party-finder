import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import MainMenu from './components/MainMenu';
import Map from './components/Map';
import AddLocationForm from './components/AddLocationForm';
import UpdateLocationForm from './components/UpdateLocationForm';
import LoginForm from './components/LoginForm';
import RegisterForm from './components/RegisterForm';
import UserProfile from './components/UserProfile.tsx';
import { SettingsProvider } from './contexts/settings/provider';
import { AuthProvider, useAuth } from './contexts/auth';
// backend base URL: use relative '/api' for both dev and prod (serverless functions)
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

type Location = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  tags: string[];
  rating: number;
};

function AppContent() {
  const [view, setView] = useState<'welcome' | 'map' | 'add' | 'update' | 'login' | 'register' | 'profile'>('welcome');
  const [locations, setLocations] = useState<Location[]>([]);
  const { token } = useAuth();

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/locations`);
        if (res.ok) {
          const data = await res.json();
          setLocations(data);
        } else {
          console.error('Failed to load locations', res.statusText);
        }
      } catch (err) {
        console.error('Error fetching locations', err);
      }
    };

    load();
  }, []);

  const handleAddLocation = async (newLoc: Location) => {
    try {
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await fetch(`${API_BASE}/api/locations`, {
        method: 'POST',
        headers,
        body: JSON.stringify(newLoc),
      });
      if (res.status === 401) {
        setView('login');
        return;
      }
      if (res.ok) {
        const created = await res.json();
        setLocations((prev) => [...prev, created]);
        setView('map');
      } else {
        console.error('Failed to add location', await res.text());
      }
    } catch (err) {
      console.error('Error adding location', err);
    }
  };

  const handleUpdateTags = async (id: string, newTags: string[]) => {
    try {
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await fetch(`${API_BASE}/api/locations/${id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ tags: newTags }),
      });
      if (res.status === 401) {
        setView('login');
        return;
      }
      if (res.ok) {
        const updated = await res.json();
        setLocations((prev) => prev.map((loc) => (loc.id === id ? updated : loc)));
        setView('map');
      } else {
        console.error('Failed to update tags', await res.text());
      }
    } catch (err) {
      console.error('Error updating tags', err);
    }
  };

  const handleDeleteLocation = async (id: string) => {
    try {
      const headers: HeadersInit = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await fetch(`${API_BASE}/api/locations/${id}`, {
        method: 'DELETE',
        headers,
      });
      if (res.status === 401) {
        setView('login');
        return false;
      }
      if (res.ok) {
        setLocations((prev) => prev.filter((l) => l.id !== id));
        return true;
      } else {
        console.error('Failed to delete location', await res.text());
        return false;
      }
    } catch (err) {
      console.error('Error deleting location', err);
      return false;
    }
  };

  return (
    <SettingsProvider>
      <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        {view === 'welcome' ? (
        <Box
          component="main"
          sx={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            p: 3,
            bgcolor: 'linear-gradient(135deg, #6b73ff 0%, #000dff 100%)',
            color: 'black',
            textAlign: 'center',
          }}
        >
          <Container maxWidth="sm">
            <Typography variant="h4" component="h1" gutterBottom>
              Quiet Locations
            </Typography>
            <Typography variant="body1" sx={{ mb: 3 }}>
              Find perfect quiet spots near you for studying, working, or simply
              enjoying some peace. Browse our curated list of locations or help grow
              the community by adding your own favorite quiet places.
            </Typography>
            <Button
              variant="contained"
              color="primary"
              onClick={() => setView('map')}
              sx={{ borderRadius: 3, px: 3 }}
            >
              Get Started
            </Button>
          </Container>
        </Box>
      ) : (
        <>
          <MainMenu currentView={view} setView={setView} />
          <Box component="main" sx={{ flex: 1, p: 2, pb: '80px' }}>
            {view === 'map' && (
              <Box
                sx={{
                  height: { xs: '55vh', sm: '70vh' },
                  borderRadius: 2,
                  overflow: 'hidden',
                  boxShadow: 3,
                  mb: 2,
                }}
              >
                <Map locations={locations} />
              </Box>
            )}
            {view === 'add' && <AddLocationForm onAdd={handleAddLocation} />}
            {view === 'update' && (
              <UpdateLocationForm
                locations={locations}
                onUpdateTags={handleUpdateTags}
                onDelete={handleDeleteLocation}
                onDeleted={(id) => setLocations((prev) => prev.filter((l) => l.id !== id))}
              />
            )}
            {view === 'login' && (
              <LoginForm
                onSuccess={() => setView('map')}
                onSwitchToRegister={() => setView('register')}
              />
            )}
            {view === 'register' && (
              <RegisterForm
                onSuccess={() => setView('map')}
                onSwitchToLogin={() => setView('login')}
              />
            )}
            {view === 'profile' && <UserProfile />}
          </Box>
        </>
      )}
      </Box>
    </SettingsProvider>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;