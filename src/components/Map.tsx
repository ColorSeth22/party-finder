import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import { useTheme } from '@mui/material/styles';
import FavoriteIcon from '@mui/icons-material/Favorite';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import CelebrationIcon from '@mui/icons-material/Celebration';
import ScheduleIcon from '@mui/icons-material/Schedule';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import LocalBarIcon from '@mui/icons-material/LocalBar';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PlaceIcon from '@mui/icons-material/Place';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import SettingsIcon from '@mui/icons-material/Settings';
import GpsFixedIcon from '@mui/icons-material/GpsFixed';
import RefreshIcon from '@mui/icons-material/Refresh';
import SyncIcon from '@mui/icons-material/Sync';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import { defaultIcon } from '../utils/defaultIcon';
import { userIcon } from '../utils/userIcon';
import useGeolocation from '../hooks/useGeolocation';
import { getDistanceKm, formatDistance } from '../utils/distance';
import { useSettings } from '../contexts/settings/hooks';
import { useAuth } from '../contexts/auth';
import SettingsDialog from './SettingsDialog';

type Event = {
  id: string;
  title: string;
  description: string | null;
  host_type: 'fraternity' | 'house' | 'club';
  location_lat: number;
  location_lng: number;
  start_time: string;
  end_time: string | null;
  tags: string[] | null;
  theme: string | null;
  music_type: string | null;
  cover_charge: string | null;
  is_byob: boolean;
  is_active: boolean;
  checkin_count?: number;
};

type Props = {
  events: Event[];
  favoriteIds: Set<string>;
  checkedInIds: Set<string>;
  onToggleFavorite: (eventId: string) => void;
  onCheckIn: (eventId: string) => void;
  pendingFavoriteId: string | null;
  pendingCheckInId: string | null;
  onProfileClick?: () => void;
  onRefreshEvents?: () => void;
  eventsRefreshing?: boolean;
  lastEventsUpdate?: number | null;
};

const HOST_LABELS: Record<Event['host_type'], string> = {
  fraternity: 'Fraternity/Greek',
  house: 'House Party',
  club: 'Campus Club'
};

const MapUpdater = ({ coords }: { coords: { latitude: number; longitude: number } | null }) => {
  const map = useMap();

  useEffect(() => {
    if (coords) {
      map.setView([coords.latitude, coords.longitude], 15);
    }
  }, [coords, map]);

  return null;
};

const Map = ({
  events,
  favoriteIds,
  checkedInIds,
  onToggleFavorite,
  onCheckIn,
  pendingFavoriteId,
  pendingCheckInId,
  onProfileClick,
  onRefreshEvents,
  eventsRefreshing,
  lastEventsUpdate
}: Props) => {
  const { coords, accuracy, error, loading, refetch } = useGeolocation();
  const { distanceUnit, showDistanceLabels } = useSettings();
  const { isAuthenticated } = useAuth();
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  const defaultCenter: [number, number] = [42.026, -93.648];
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const visibleEvents = useMemo(() => {
    const now = new Date();
    
    // Filter out completed events (past end_time)
    const activeEvents = events.filter((event) => {
      if (!event.end_time) return true; // No end time, always show
      const endTime = new Date(event.end_time);
      return endTime > now; // Only show if not yet ended
    });
    
    const sorted = [...activeEvents].sort(
      (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    );
    if (!selectedTags.length) return sorted;
    return sorted.filter((event) => {
      const eventTags = event.tags ?? [];
      return selectedTags.every((tag) => eventTags.includes(tag));
    });
  }, [events, selectedTags]);

  const renderDistanceChip = (event: Event) => {
    if (!coords || !showDistanceLabels) return null;
    const distance = getDistanceKm(
      coords.latitude,
      coords.longitude,
      event.location_lat,
      event.location_lng
    );
    return (
      <Chip
        size='small'
        color='primary'
        variant='outlined'
        label={formatDistance(distance, distanceUnit)}
      />
    );
  };

  if (loading) {
    return (
      <Box display='flex' alignItems='center' justifyContent='center' height='100%' width='100%'>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ position: 'relative', height: '100%', width: '100%' }}>
      {isAuthenticated && onProfileClick && (
        <Box
          sx={{
            position: 'absolute',
            top: 16,
            right: 80,
            zIndex: 1000,
            backgroundColor: isDarkMode ? 'rgba(30, 30, 30, 0.9)' : 'white',
            borderRadius: '50%',
            boxShadow: 2
          }}
        >
          <Tooltip title='Profile'>
            <IconButton onClick={onProfileClick} size='large'>
              <AccountCircleIcon />
            </IconButton>
          </Tooltip>
        </Box>
      )}

      <Box
        sx={{
          position: 'absolute',
          top: 16,
          right: 16,
          zIndex: 1000,
          backgroundColor: isDarkMode ? 'rgba(30, 30, 30, 0.9)' : 'white',
          borderRadius: '50%',
          boxShadow: 2
        }}
      >
        <Tooltip title='Settings'>
          <IconButton onClick={() => setSettingsOpen(true)} size='large'>
            <SettingsIcon />
          </IconButton>
        </Tooltip>
      </Box>

      <Box
        sx={{
          position: 'absolute',
          top: 80,
          right: 16,
          zIndex: 1000,
          backgroundColor: isDarkMode ? 'rgba(30, 30, 30, 0.9)' : 'white',
          borderRadius: '50%',
          boxShadow: 2
        }}
      >
  <Tooltip title={loading ? 'Getting location...' : 'Refresh my location'}>
          <span>
            <IconButton
              onClick={() => refetch()}
              size='large'
              disabled={loading}
              color={accuracy && accuracy > 100 ? 'warning' : 'primary'}
            >
              <RefreshIcon className={loading ? 'rotating' : ''} />
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      <Box
        sx={{
          position: 'absolute',
          top: 144,
          right: 16,
          zIndex: 1000,
          backgroundColor: isDarkMode ? 'rgba(30, 30, 30, 0.9)' : 'white',
          borderRadius: '50%',
          boxShadow: 2
        }}
      >
        <Tooltip
          title={
            eventsRefreshing
              ? 'Refreshing events...'
              : `Refresh events${
                  lastEventsUpdate ? ` (last: ${new Date(lastEventsUpdate).toLocaleTimeString()})` : ''
                }`
          }
        >
          <span>
            <IconButton
              onClick={() => onRefreshEvents && onRefreshEvents()}
              size='large'
              disabled={!!eventsRefreshing}
              color={eventsRefreshing ? 'default' : 'primary'}
            >
              <SyncIcon className={eventsRefreshing ? 'rotating' : ''} />
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      <MapContainer center={defaultCenter} zoom={15} style={{ height: '100%', width: '100%' }}>
        {isDarkMode ? (
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url='https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
          />
        ) : (
          <TileLayer
            attribution="&copy; <a href='https://www.openstreetmap.org/'>OpenStreetMap</a> contributors"
            url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
          />
        )}

        {visibleEvents.map((event) => {
          const startTime = new Date(event.start_time);
          const endTime = event.end_time ? new Date(event.end_time) : null;
          const isFavorite = favoriteIds.has(event.id);
          const hasCheckedIn = checkedInIds.has(event.id);
          const now = new Date();
          const hasStarted = now >= startTime;
          
          // Calculate distance to event (in meters)
          let distanceToEvent: number | null = null;
          let canCheckIn = false;
          
          if (coords && !hasCheckedIn) {
            const distanceKm = getDistanceKm(
              coords.latitude,
              coords.longitude,
              event.location_lat,
              event.location_lng
            );
            distanceToEvent = distanceKm * 1000; // Convert to meters
            // Allow check-in if within 100 meters (~328 feet) and event has started
            canCheckIn = hasStarted && distanceToEvent <= 100;
          }

          return (
            <Marker key={event.id} position={[event.location_lat, event.location_lng]} icon={defaultIcon}>
              <Popup>
                <Stack spacing={1.5} sx={{ minWidth: 240 }}>
                  <Stack direction='row' spacing={1} alignItems='center'>
                    <PlaceIcon fontSize='small' />
                    <Typography variant='subtitle1' sx={{ fontWeight: 600 }}>
                      {event.title}
                    </Typography>
                  </Stack>

                  <Stack direction='row' spacing={1} flexWrap='wrap' useFlexGap>
                    <Chip size='small' icon={<CelebrationIcon fontSize='small' />} label={HOST_LABELS[event.host_type]} />
                    {(event.checkin_count ?? 0) > 0 && (
                      <Chip 
                        size='small' 
                        color='success'
                        icon={<CheckCircleIcon fontSize='small' />} 
                        label={`~${event.checkin_count} ${event.checkin_count === 1 ? 'person' : 'people'} here`}
                      />
                    )}
                    <Chip
                      size='small'
                      icon={<ScheduleIcon fontSize='small' />}
                      label={startTime.toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit'
                      })}
                    />
                    {endTime && (
                      <Chip
                        size='small'
                        variant='outlined'
                        icon={<ScheduleIcon fontSize='small' />}
                        label={`Ends ${endTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`}
                      />
                    )}
                    {event.theme && (
                      <Chip
                        size='small'
                        variant='outlined'
                        icon={<CelebrationIcon fontSize='small' />}
                        label={`Theme: ${event.theme}`}
                      />
                    )}
                    {event.music_type && (
                      <Chip
                        size='small'
                        variant='outlined'
                        icon={<MusicNoteIcon fontSize='small' />}
                        label={event.music_type}
                      />
                    )}
                    {event.cover_charge && (
                      <Chip
                        size='small'
                        variant='outlined'
                        icon={<LocalBarIcon fontSize='small' />}
                        label={event.cover_charge}
                      />
                    )}
                    {event.is_byob && <Chip size='small' color='secondary' variant='outlined' label='BYOB' />}
                    {renderDistanceChip(event)}
                  </Stack>

                  {event.description && (
                    <Typography variant='body2' color='text.secondary'>
                      {event.description}
                    </Typography>
                  )}

                  {(event.tags ?? []).length > 0 && (
                    <Stack direction='row' spacing={0.5} flexWrap='wrap' useFlexGap>
                      {(event.tags ?? []).map((tag) => (
                        <Chip key={tag} size='small' variant='outlined' label={tag} />
                      ))}
                    </Stack>
                  )}

                  <Stack direction='row' spacing={1}>
                    <Button
                      size='small'
                      variant={isFavorite ? 'contained' : 'outlined'}
                      color='secondary'
                      startIcon={isFavorite ? <FavoriteIcon /> : <FavoriteBorderIcon />}
                      onClick={() => onToggleFavorite(event.id)}
                      disabled={pendingFavoriteId === event.id}
                      fullWidth
                    >
                      {pendingFavoriteId === event.id
                        ? 'Saving...'
                        : isFavorite
                        ? 'Favorited'
                        : 'Favorite'}
                    </Button>
                    <Tooltip
                      title={
                        hasCheckedIn
                          ? 'You already checked in to this party!'
                          : !hasStarted 
                          ? `Party starts ${startTime.toLocaleString()}`
                          : !coords
                          ? 'Enable location services to check in'
                          : distanceToEvent && distanceToEvent > 100
                          ? `You must be within 100m of the event (currently ${Math.round(distanceToEvent)}m away)`
                          : canCheckIn
                          ? 'Check in to this party!'
                          : ''
                      }
                      arrow
                    >
                      <span style={{ width: '100%' }}>
                        <Button
                          size='small'
                          variant={hasCheckedIn ? 'outlined' : 'contained'}
                          color='primary'
                          startIcon={<CheckCircleIcon />}
                          onClick={() => onCheckIn(event.id)}
                          disabled={hasCheckedIn || !canCheckIn || pendingCheckInId === event.id}
                          fullWidth
                        >
                          {hasCheckedIn
                            ? 'Checked in ✓'
                            : pendingCheckInId === event.id 
                            ? 'Checking in...' 
                            : !hasStarted
                            ? 'Not started'
                            : !canCheckIn && coords
                            ? 'Too far'
                            : !coords
                            ? 'Need location'
                            : 'Check in'}
                        </Button>
                      </span>
                    </Tooltip>
                  </Stack>
                </Stack>
              </Popup>
            </Marker>
          );
        })}

        {coords && (
          <>
            {accuracy && (
              <Circle
                center={[coords.latitude, coords.longitude]}
                radius={accuracy}
                pathOptions={{
                  color: '#ff4081',
                  fillColor: '#ff4081',
                  fillOpacity: 0.1,
                  weight: 2,
                  dashArray: '5, 5'
                }}
              />
            )}
            <Marker position={[coords.latitude, coords.longitude]} icon={userIcon}>
              <Popup>
                <Stack spacing={1}>
                  <Stack direction='row' spacing={1} alignItems='center'>
                    <MyLocationIcon color='primary' />
                    <Typography variant='subtitle2' sx={{ fontWeight: 600 }}>
                      You are here
                    </Typography>
                  </Stack>
                  {accuracy && (
                    <Stack direction='row' spacing={0.5} alignItems='center'>
                      <GpsFixedIcon fontSize='small' color='action' />
                      <Typography variant='caption' color='text.secondary'>
                        Accuracy +/-{Math.round(accuracy)}m
                        {accuracy > 100 && ' (try getting closer to the venue)'}
                      </Typography>
                    </Stack>
                  )}
                  <Button
                    size='small'
                    variant='outlined'
                    startIcon={<RefreshIcon />}
                    onClick={() => refetch()}
                    disabled={loading}
                  >
                    {loading ? 'Refreshing...' : 'Refresh location'}
                  </Button>
                </Stack>
              </Popup>
            </Marker>
          </>
        )}

        <MapUpdater coords={coords} />
      </MapContainer>

      <Snackbar open={!!error} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert
          severity='warning'
          sx={{ width: '100%' }}
          action={
            <Button color='inherit' size='small' onClick={() => refetch()}>
              Retry
            </Button>
          }
        >
          {error || 'Unable to access your location.'}
        </Alert>
      </Snackbar>

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