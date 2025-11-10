import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import PlaceIcon from '@mui/icons-material/Place';
import PersonIcon from '@mui/icons-material/Person';
import PeopleIcon from '@mui/icons-material/People';
import GroupsIcon from '@mui/icons-material/Groups';
import Diversity3Icon from '@mui/icons-material/Diversity3';
import CrowdIcon from '@mui/icons-material/Group';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import DirectionsIcon from '@mui/icons-material/Directions';
import AssessmentIcon from '@mui/icons-material/Assessment';
import ScheduleIcon from '@mui/icons-material/Schedule';
import useGeolocation from '../hooks/useGeolocation';
import { getDistanceKm, formatDistance } from '../utils/distance';
import { useSettings } from '../contexts/settings/hooks';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

type Location = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  tags: string[];
};

type LocationWithDistance = Location & {
  distance: number;
  occupancy?: {
    status: string;
    level: number | null;
    occupancy: string | null;
    last_updated: string | null;
    report_count: number;
  };
};

type Props = {
  locations: Location[];
};

const occupancyIcons: Record<number, React.ReactElement> = {
  1: <PersonIcon fontSize="small" />,
  2: <PeopleIcon fontSize="small" />,
  3: <GroupsIcon fontSize="small" />,
  4: <Diversity3Icon fontSize="small" />,
  5: <CrowdIcon fontSize="small" />,
};

const NearbyLocations = ({ locations }: Props) => {
  const { coords, loading: geoLoading, error: geoError, refetch } = useGeolocation();
  const { distanceUnit } = useSettings();
  const [locationsWithData, setLocationsWithData] = useState<LocationWithDistance[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<LocationWithDistance | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const handleLocationClick = (location: LocationWithDistance) => {
    setSelectedLocation(location);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedLocation(null);
  };

  const handleGetDirections = () => {
    if (selectedLocation) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${selectedLocation.lat},${selectedLocation.lng}`;
      window.open(url, '_blank');
    }
  };

  useEffect(() => {
    if (!coords) return;

    const fetchOccupancyData = async () => {
      setLoading(true);
      
      // Calculate distances and filter to nearby (within 50km)
      const nearby = locations
        .map(loc => ({
          ...loc,
          distance: getDistanceKm(coords.latitude, coords.longitude, loc.lat, loc.lng)
        }))
        .filter(loc => loc.distance <= 50); // Only show locations within 50km

      // Fetch occupancy data for all nearby locations
      const withOccupancy: LocationWithDistance[] = await Promise.all(
        nearby.map(async (loc): Promise<LocationWithDistance> => {
          try {
            const res = await fetch(`${API_BASE}/api/occupancy/${loc.id}`);
            if (res.ok) {
              const data = await res.json();
              return {
                ...loc,
                occupancy: {
                  status: data.current.status,
                  level: data.current.level,
                  occupancy: data.current.occupancy,
                  last_updated: data.current.last_updated,
                  report_count: data.current.report_count
                }
              };
            }
          } catch {
            // If fetch fails, return without occupancy data
          }
          return loc;
        })
      );

      // Sort by occupancy level (quietest first), then by distance
      const sorted = withOccupancy.sort((a, b) => {
        // Locations with no data go to the end
        if (!a.occupancy && !b.occupancy) return a.distance - b.distance;
        if (!a.occupancy) return 1;
        if (!b.occupancy) return -1;

        // If both have no current occupancy data, sort by distance
        if (a.occupancy.status === 'no_data' && b.occupancy.status === 'no_data') {
          return a.distance - b.distance;
        }
        if (a.occupancy.status === 'no_data') return 1;
        if (b.occupancy.status === 'no_data') return -1;

        // Sort by occupancy level (lower = quieter = first)
        if (a.occupancy.level !== null && b.occupancy.level !== null) {
          if (a.occupancy.level !== b.occupancy.level) {
            return a.occupancy.level - b.occupancy.level;
          }
        }

        // If same level, sort by distance
        return a.distance - b.distance;
      });

      setLocationsWithData(sorted);
      setLoading(false);
    };

    fetchOccupancyData();
  }, [coords, locations]);

  if (geoLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (geoError || !coords) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="warning" action={
          <button onClick={() => refetch()}>Retry</button>
        }>
          Unable to get your location. Please enable location services to see nearby places.
        </Alert>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>Loading nearby locations...</Typography>
      </Box>
    );
  }

  if (locationsWithData.length === 0) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="info">
          No locations found within 50km of your current location.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold', mb: 2 }}>
        Nearby Quiet Spots
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Sorted from quietest to busiest based on recent reports
      </Typography>

      <List sx={{ width: '100%' }}>
        {locationsWithData.map((loc) => (
          <Card key={loc.id} sx={{ mb: 2 }}>
            <ListItem disablePadding>
              <ListItemButton onClick={() => handleLocationClick(loc)}>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      <PlaceIcon fontSize="small" />
                      <Typography variant="h6" component="span">
                        {loc.name}
                      </Typography>
                      <Chip
                        size="small"
                        label={formatDistance(loc.distance, distanceUnit)}
                        color="primary"
                        variant="outlined"
                      />
                    </Box>
                  }
                  secondary={
                    <Box sx={{ mt: 1 }}>
                      {/* Occupancy status */}
                      {loc.occupancy ? (
                        <Stack direction="row" spacing={1} sx={{ mb: 1, flexWrap: 'wrap' }}>
                          <Chip
                            size="small"
                            icon={loc.occupancy.level !== null && loc.occupancy.level >= 1 && loc.occupancy.level <= 5 ? occupancyIcons[loc.occupancy.level] : <HelpOutlineIcon fontSize="small" />}
                            label={
                              loc.occupancy.status === 'no_data'
                                ? 'No recent data'
                                : `${loc.occupancy.status.charAt(0).toUpperCase() + loc.occupancy.status.slice(1)} (Level ${loc.occupancy.level}/5)`
                            }
                            color={
                              loc.occupancy.status === 'quiet' ? 'success'
                                : loc.occupancy.status === 'moderate' ? 'warning'
                                : loc.occupancy.status === 'busy' ? 'error'
                                : 'default'
                            }
                          />
                          {loc.occupancy.report_count > 0 && (
                            <Chip
                              size="small"
                              label={`${loc.occupancy.report_count} recent report${loc.occupancy.report_count === 1 ? '' : 's'}`}
                              variant="outlined"
                            />
                          )}
                          {loc.occupancy.last_updated && (
                            <Chip
                              size="small"
                              label={`Updated ${new Date(loc.occupancy.last_updated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                              variant="outlined"
                            />
                          )}
                        </Stack>
                      ) : (
                        <Chip
                          size="small"
                          icon={<HelpOutlineIcon fontSize="small" />}
                          label="No occupancy data"
                          variant="outlined"
                          sx={{ mb: 1 }}
                        />
                      )}

                      {/* Tags */}
                      <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                        {loc.tags.map((tag) => (
                          <Chip
                            key={tag}
                            label={tag}
                            size="small"
                            variant="outlined"
                          />
                        ))}
                      </Stack>
                    </Box>
                  }
                />
              </ListItemButton>
            </ListItem>
          </Card>
        ))}
      </List>

      {/* Location Detail Modal */}
      <Dialog
        open={modalOpen}
        onClose={handleCloseModal}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <PlaceIcon />
              {selectedLocation?.name}
            </Box>
            <IconButton onClick={handleCloseModal} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedLocation && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {/* Distance */}
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  Distance
                </Typography>
                <Chip
                  size="medium"
                  label={formatDistance(selectedLocation.distance, distanceUnit)}
                  color="primary"
                  icon={<PlaceIcon />}
                />
              </Box>

              <Divider />

              {/* Occupancy Information */}
              <Box>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Current Occupancy
                </Typography>
                {selectedLocation.occupancy ? (
                  <Stack spacing={1}>
                    <Chip
                      size="medium"
                      icon={
                        selectedLocation.occupancy.level !== null &&
                        selectedLocation.occupancy.level >= 1 &&
                        selectedLocation.occupancy.level <= 5
                          ? occupancyIcons[selectedLocation.occupancy.level]
                          : <HelpOutlineIcon />
                      }
                      label={
                        selectedLocation.occupancy.status === 'no_data'
                          ? 'No recent data available'
                          : `${selectedLocation.occupancy.status.charAt(0).toUpperCase() + selectedLocation.occupancy.status.slice(1)} - Level ${selectedLocation.occupancy.level}/5`
                      }
                      color={
                        selectedLocation.occupancy.status === 'quiet'
                          ? 'success'
                          : selectedLocation.occupancy.status === 'moderate'
                          ? 'warning'
                          : selectedLocation.occupancy.status === 'busy'
                          ? 'error'
                          : 'default'
                      }
                    />
                    {selectedLocation.occupancy.report_count > 0 && (
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        <Chip
                          size="small"
                          icon={<AssessmentIcon fontSize="small" />}
                          label={`${selectedLocation.occupancy.report_count} recent report${
                            selectedLocation.occupancy.report_count === 1 ? '' : 's'
                          } (last 30 min)`}
                          variant="outlined"
                        />
                        {selectedLocation.occupancy.last_updated && (
                          <Chip
                            size="small"
                            icon={<ScheduleIcon fontSize="small" />}
                            label={`Last updated: ${new Date(
                              selectedLocation.occupancy.last_updated
                            ).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}`}
                            variant="outlined"
                          />
                        )}
                      </Box>
                    )}
                  </Stack>
                ) : (
                  <Alert severity="info">No occupancy data available for this location</Alert>
                )}
              </Box>

              <Divider />

              {/* Tags */}
              <Box>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Tags
                </Typography>
                {selectedLocation.tags.length > 0 ? (
                  <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                    {selectedLocation.tags.map((tag) => (
                      <Chip key={tag} label={tag} size="small" variant="outlined" />
                    ))}
                  </Stack>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No tags available
                  </Typography>
                )}
              </Box>

              <Divider />

              {/* Coordinates */}
              <Box>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Coordinates
                </Typography>
                <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                  {selectedLocation.lat.toFixed(6)}, {selectedLocation.lng.toFixed(6)}
                </Typography>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseModal}>Close</Button>
          <Button
            variant="contained"
            startIcon={<DirectionsIcon />}
            onClick={handleGetDirections}
          >
            Get Directions
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default NearbyLocations;
