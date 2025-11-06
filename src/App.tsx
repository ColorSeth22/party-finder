import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import MainMenu from './components/MainMenu';
import Map from './components/Map';
import AddLocationForm from './components/AddLocationForm';
import UpdateLocationForm from './components/UpdateLocationForm';
import { SettingsProvider } from './contexts/settings/provider';
// backend base URL (use Vite env or fallback)
const API_BASE = (import.meta.env.VITE_API_BASE_URL as string) ?? 'http://localhost:4000';

type Location = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  tags: string[];
  rating: number;
};

function App() {
  const [view, setView] = useState('welcome');
  const [locations, setLocations] = useState<Location[]>([]);

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
      const res = await fetch(`${API_BASE}/api/locations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newLoc),
      });
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
      const res = await fetch(`${API_BASE}/api/locations/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: newTags }),
      });
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
              QuietLocations
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
              />
            )}
          </Box>
        </>
      )}
      </Box>
    </SettingsProvider>
  );
}

export default App;