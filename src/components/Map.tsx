import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { defaultIcon } from '../utils/defaultIcon';
import { userIcon } from '../utils/userIcon';
import useGeolocation from '../hooks/useGeolocation';
import { getDistanceKm, formatDistance } from '../utils/distance';
import { useSettings } from '../contexts/settings/hooks';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import PlaceIcon from '@mui/icons-material/Place';
import SettingsIcon from '@mui/icons-material/Settings';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import FilterPanel from './FilterPanel';
import SettingsDialog from './SettingsDialog';

type Location = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  tags: string[];
};

type Props = {
  locations: Location[];
};

// Component to handle map recenter when user location is available
const MapUpdater = ({ coords }: { coords: { latitude: number; longitude: number } | null }) => {
  const map = useMap();
  
  useEffect(() => {
    if (coords) {
      map.setView([coords.latitude, coords.longitude], 15);
    }
  }, [coords, map]);

  return null;
};

const Map = ({ locations }: Props) => {
  const { coords, error, loading } = useGeolocation();
  const { distanceUnit } = useSettings();
  const defaultCenter: [number, number] = [42.026, -93.648]; // Iowa State
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const handleTagToggle = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  if (loading) {
    return (
      <Box 
        display="flex" 
        alignItems="center" 
        justifyContent="center" 
        height="100%"
        width="100%"
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ position: 'relative', height: '100%', width: '100%' }}>
      {/* Filters overlay (top-left) */}
      <Box sx={{ position: 'absolute', top: 16, left: 16, zIndex: 1000 }}>
        <FilterPanel selectedTags={selectedTags} onTagToggle={handleTagToggle} />
      </Box>
      <Box 
        sx={{ 
          position: 'absolute', 
          top: 16, 
          right: 16, 
          zIndex: 1000, 
          backgroundColor: 'white',
          borderRadius: '50%',
          boxShadow: 2
        }}
      >
        <Tooltip title="Settings">
          <IconButton onClick={() => setSettingsOpen(true)} size="large">
            <SettingsIcon />
          </IconButton>
        </Tooltip>
      </Box>

      <MapContainer center={defaultCenter} zoom={15} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {(selectedTags.length ? locations.filter((l) => l.tags.some((t) => selectedTags.includes(t))) : locations).map((loc) => {
          const distance = coords
            ? getDistanceKm(coords.latitude, coords.longitude, loc.lat, loc.lng)
            : null;

          return (
            <Marker key={loc.id} position={[loc.lat, loc.lng]} icon={defaultIcon}>
              <Popup>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <PlaceIcon />
                    <strong>{loc.name}</strong>
                  </Box>
                  {distance !== null && (
                    <Chip
                      size="small"
                      label={formatDistance(distance, distanceUnit)}
                      color="primary"
                      variant="outlined"
                    />
                  )}
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {loc.tags.map((tag) => (
                      <Chip
                        key={tag}
                        label={tag}
                        size="small"
                        variant="outlined"
                      />
                    ))}
                  </Box>
                </Box>
              </Popup>
            </Marker>
          );
        })}

        {coords && (
          <Marker 
            position={[coords.latitude, coords.longitude]} 
            icon={userIcon}
          >
            <Popup>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <MyLocationIcon color="primary" />
                <span>You are here</span>
              </Box>
            </Popup>
          </Marker>
        )}

        <MapUpdater coords={coords} />
      </MapContainer>

      <Snackbar 
        open={!!error} 
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="warning" sx={{ width: '100%' }}>
          {error || 'Unable to get your location'}
        </Alert>
      </Snackbar>

      {/* Settings modal */}
      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        selectedTags={selectedTags}
        onApplyFilters={setSelectedTags}
      />
    </Box>
  );
};

export default Map;