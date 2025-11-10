import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import { defaultIcon } from '../utils/defaultIcon';
import { userIcon } from '../utils/userIcon';
import useGeolocation from '../hooks/useGeolocation';
import { getDistanceKm, formatDistance } from '../utils/distance';
import { useSettings } from '../contexts/settings/hooks';
import { useAuth } from '../contexts/auth';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import PlaceIcon from '@mui/icons-material/Place';
import SettingsIcon from '@mui/icons-material/Settings';
import GpsFixedIcon from '@mui/icons-material/GpsFixed';
import RefreshIcon from '@mui/icons-material/Refresh';
import SyncIcon from '@mui/icons-material/Sync';
import AssessmentIcon from '@mui/icons-material/Assessment';
import ScheduleIcon from '@mui/icons-material/Schedule';
import WifiIcon from '@mui/icons-material/Wifi';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import SettingsDialog from './SettingsDialog';
import OccupancyReport from './OccupancyReport';

type Location = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  tags: string[];
};

type Props = {
  locations: Location[];
  onProfileClick?: () => void;
  onRefreshLocations?: () => void;
  locationsRefreshing?: boolean;
  lastLocationsUpdate?: number | null;
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

const Map = ({ locations, onProfileClick, onRefreshLocations, locationsRefreshing, lastLocationsUpdate }: Props) => {
  const { coords, accuracy, error, loading, refetch } = useGeolocation();
  const { distanceUnit } = useSettings();
  const { isAuthenticated } = useAuth();
  const defaultCenter: [number, number] = [42.026, -93.648]; // Iowa State
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<{ id: string; name: string; lat: number; lng: number } | null>(null);

  const handleOpenReportModal = (loc: { id: string; name: string; lat: number; lng: number }) => {
    setSelectedLocation(loc);
    setReportModalOpen(true);
  };

  const handleCloseReportModal = () => {
    setReportModalOpen(false);
    setSelectedLocation(null);
  };

  // Occupancy state per location popup
  const [occupancyLoading, setOccupancyLoading] = useState<string | null>(null);
  const [occupancyData, setOccupancyData] = useState<Record<string, {
    status: string;
    level: number | null;
    occupancy: string | null;
    last_updated: string | null;
    report_count: number;
  }>>({});
  const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

  const fetchOccupancy = async (locationId: string) => {
    // Avoid refetch if we already have data refreshed in last 60s
    const existing = occupancyData[locationId];
    if (existing && existing.last_updated) {
      const age = Date.now() - new Date(existing.last_updated).getTime();
      if (age < 60_000) return; // < 1 minute old, skip
    }
    setOccupancyLoading(locationId);
    try {
      const res = await fetch(`${API_BASE}/api/occupancy/${locationId}`);
      if (res.ok) {
        const data = await res.json();
        setOccupancyData(prev => ({
          ...prev,
          [locationId]: {
            status: data.current.status,
            level: data.current.level,
            occupancy: data.current.occupancy,
            last_updated: data.current.last_updated,
            report_count: data.current.report_count
          }
        }));
      }
    } catch {
      // swallow for now, could add error state per location
    } finally {
      setOccupancyLoading(prev => (prev === locationId ? null : prev));
    }
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
      {/* Profile button - top right (only when authenticated) */}
      {isAuthenticated && onProfileClick && (
        <Box 
          sx={{ 
            position: 'absolute', 
            top: 16, 
            right: 80, // Left of settings button
            zIndex: 1000, 
            backgroundColor: 'white',
            borderRadius: '50%',
            boxShadow: 2
          }}
        >
          <Tooltip title="Profile">
            <IconButton onClick={onProfileClick} size="large">
              <AccountCircleIcon />
            </IconButton>
          </Tooltip>
        </Box>
      )}

      {/* Settings button - top right */}
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

      {/* Refresh location button - top right, below settings */}
      <Box 
        sx={{ 
          position: 'absolute', 
          top: 80, 
          right: 16, 
          zIndex: 1000, 
          backgroundColor: 'white',
          borderRadius: '50%',
          boxShadow: 2
        }}
      >
        <Tooltip title={loading ? "Getting location..." : "Refresh my location"}>
          <span>
            <IconButton 
              onClick={() => refetch()} 
              size="large"
              disabled={loading}
              color={accuracy && accuracy > 100 ? "warning" : "primary"}
            >
              <RefreshIcon className={loading ? 'rotating' : ''} />
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      {/* Refresh locations (from DB) button - below refresh my location */}
      <Box 
        sx={{ 
          position: 'absolute', 
          top: 144, 
          right: 16, 
          zIndex: 1000, 
          backgroundColor: 'white',
          borderRadius: '50%',
          boxShadow: 2
        }}
      >
        <Tooltip title={
          locationsRefreshing
            ? 'Refreshing locations...'
            : `Refresh locations${lastLocationsUpdate ? ' (last: ' + new Date(lastLocationsUpdate).toLocaleTimeString() + ')' : ''}`
        }>
          <span>
            <IconButton 
              onClick={() => onRefreshLocations && onRefreshLocations()} 
              size="large"
              disabled={!!locationsRefreshing}
              color={locationsRefreshing ? "default" : "primary"}
            >
              <SyncIcon className={locationsRefreshing ? 'rotating' : ''} />
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      <MapContainer center={defaultCenter} zoom={15} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {(selectedTags.length
          ? locations.filter((l) => selectedTags.every((t) => l.tags.includes(t)))
          : locations).map((loc) => {
          const distance = coords
            ? getDistanceKm(coords.latitude, coords.longitude, loc.lat, loc.lng)
            : null;

          return (
            <Marker key={loc.id} position={[loc.lat, loc.lng]} icon={defaultIcon}>
              <Popup
                eventHandlers={{
                  add: () => fetchOccupancy(loc.id)
                }}
              >
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <PlaceIcon />
                    <strong>{loc.name}</strong>
                  </Box>
                  {/* Occupancy status chip */}
                  {occupancyLoading === loc.id && (
                    <Chip size="small" label="Loading occupancy..." color="default" />
                  )}
                  {occupancyData[loc.id] && occupancyLoading !== loc.id && (
                    <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                      <Chip
                        size="small"
                        label={
                          occupancyData[loc.id].status === 'no_data'
                            ? 'No recent data'
                            : `${occupancyData[loc.id].status} · lvl ${occupancyData[loc.id].level}`
                        }
                        color={
                          occupancyData[loc.id].status === 'quiet' ? 'success'
                            : occupancyData[loc.id].status === 'moderate' ? 'warning'
                            : occupancyData[loc.id].status === 'busy' ? 'error'
                            : 'default'
                        }
                        variant="outlined"
                      />
                      {occupancyData[loc.id].report_count > 0 && (
                        <Chip
                          size="small"
                          label={`${occupancyData[loc.id].report_count} rpt${occupancyData[loc.id].report_count === 1 ? '' : 's'}`}
                          color="info"
                          variant="outlined"
                          icon={<WifiIcon />}
                        />
                      )}
                      {occupancyData[loc.id].last_updated && (
                        <Chip
                          size="small"
                          label={new Date(occupancyData[loc.id].last_updated!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          color="default"
                          variant="outlined"
                          icon={<ScheduleIcon />}
                        />
                      )}
                    </Box>
                  )}
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
                  
                  <Button
                    size="small"
                    variant="outlined"
                    fullWidth
                    startIcon={<AssessmentIcon />}
                    onClick={() => handleOpenReportModal({ id: loc.id, name: loc.name, lat: loc.lat, lng: loc.lng })}
                    sx={{ mt: 1 }}
                  >
                    Report How Busy
                  </Button>
                </Box>
              </Popup>
            </Marker>
          );
        })}

        {coords && (
          <>
            {/* Accuracy circle showing uncertainty radius */}
            {accuracy && (
              <Circle
                center={[coords.latitude, coords.longitude]}
                radius={accuracy}
                pathOptions={{
                  color: '#2196f3',
                  fillColor: '#2196f3',
                  fillOpacity: 0.1,
                  weight: 2,
                  dashArray: '5, 5'
                }}
              />
            )}
            <Marker 
              position={[coords.latitude, coords.longitude]} 
              icon={userIcon}
            >
              <Popup>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <MyLocationIcon color="primary" />
                    <strong>You are here</strong>
                  </Box>
                  {accuracy && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <GpsFixedIcon fontSize="small" color="action" />
                      <span style={{ fontSize: '0.85rem', color: '#666' }}>
                        Accuracy: ±{Math.round(accuracy)}m
                        {accuracy > 100 && ' (Low accuracy - move to open area)'}
                      </span>
                    </Box>
                  )}
                  <Button
                    size="small"
                    variant="outlined"
                    fullWidth
                    startIcon={<RefreshIcon />}
                    onClick={() => refetch()}
                    disabled={loading}
                    sx={{ mt: 1 }}
                  >
                    {loading ? 'Getting Location...' : 'Refresh Location'}
                  </Button>
                </Box>
              </Popup>
            </Marker>
          </>
        )}

        <MapUpdater coords={coords} />
      </MapContainer>

      <Snackbar 
        open={!!error} 
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          severity="warning" 
          sx={{ width: '100%' }}
          action={
            <Button 
              color="inherit" 
              size="small" 
              onClick={() => refetch()}
              disabled={loading}
            >
              {loading ? 'Retrying...' : 'Retry'}
            </Button>
          }
        >
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

      {/* Occupancy report modal */}
      <Dialog
        open={reportModalOpen}
        onClose={handleCloseReportModal}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Report Occupancy
          {selectedLocation && ` - ${selectedLocation.name}`}
        </DialogTitle>
        <DialogContent>
          {selectedLocation && (
            <OccupancyReport
              locationId={selectedLocation.id}
              locationName={selectedLocation.name}
              locationLat={selectedLocation.lat}
              locationLng={selectedLocation.lng}
              onReported={handleCloseReportModal}
            />
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default Map;