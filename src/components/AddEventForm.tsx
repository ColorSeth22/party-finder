import { useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Autocomplete from '@mui/material/Autocomplete';
import MenuItem from '@mui/material/MenuItem';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import TAGS from '../data/tags';
import useGeolocation from '../hooks/useGeolocation';

type NewEventPayload = {
  title: string;
  description?: string;
  host_type: 'fraternity' | 'house' | 'club';
  location_lat: number;
  location_lng: number;
  start_time: string;
  end_time?: string;
  tags: string[];
  theme?: string;
  music_type?: string;
  cover_charge?: string;
  is_byob: boolean;
};

type Props = {
  onAdd: (payload: NewEventPayload) => void;
};

type SearchResult = {
  display_name: string;
  lat: string;
  lon: string;
};

const HOST_TYPES: Array<{ label: string; value: 'fraternity' | 'house' | 'club' }> = [
  { label: 'Fraternity/Greek', value: 'fraternity' },
  { label: 'House Party', value: 'house' },
  { label: 'Campus Club', value: 'club' }
];

const AddEventForm = ({ onAdd }: Props) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [hostType, setHostType] = useState<'fraternity' | 'house' | 'club'>('fraternity');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [theme, setTheme] = useState('');
  const [musicType, setMusicType] = useState('');
  const [coverCharge, setCoverCharge] = useState('');
  const [isByob, setIsByob] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [options, setOptions] = useState<SearchResult[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const { coords, error: geoError } = useGeolocation();

  const makeViewbox = (latitude: number, longitude: number, offset = 0.45) => {
    const left = longitude - offset;
    const right = longitude + offset;
    const top = latitude + offset;
    const bottom = latitude - offset;
    return `${left},${top},${right},${bottom}`;
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  useEffect(() => {
    const term = searchTerm.trim();
    setSearchError('');

    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }

    if (term.length < 3) {
      setOptions([]);
      setLoadingOptions(false);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setLoadingOptions(true);

    const timer = setTimeout(async () => {
      try {
        const searchUrl = 'https://nominatim.openstreetmap.org/search';
        const params = new URLSearchParams({
          format: 'json',
          q: term,
          limit: '10',
          addressdetails: '1',
          'accept-language': 'en'
        });

        if (coords) {
          params.append('viewbox', makeViewbox(coords.latitude, coords.longitude));
          params.append('bounded', '1');
        }

        let res = await fetch(`${searchUrl}?${params}`, {
          signal: controller.signal,
          headers: {
            Accept: 'application/json',
            'User-Agent': 'CampusPartyFinder/1.0'
          }
        });

        if (!res.ok) throw new Error(`Status ${res.status}`);
        let data = (await res.json()) as SearchResult[];

        if (Array.isArray(data) && data.length === 0 && coords) {
          const fallbackParams = new URLSearchParams({
            format: 'json',
            q: term,
            limit: '10',
            addressdetails: '1',
            'accept-language': 'en'
          });
          res = await fetch(`${searchUrl}?${fallbackParams}`, {
            signal: controller.signal,
            headers: {
              Accept: 'application/json',
              'User-Agent': 'CampusPartyFinder/1.0'
            }
          });
          if (res.ok) {
            data = (await res.json()) as SearchResult[];
          }
        }

        setOptions(Array.isArray(data) ? data : []);
      } catch (error) {
        if ((error as Error).name === 'AbortError') return;
        setOptions([]);
        setSearchError('Search failed. Try again.');
      } finally {
        setLoadingOptions(false);
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchTerm, coords]);

  const handleGeocodeSearch = async () => {
    if (!address) return;
    setSearchError('');
    setIsGeocoding(true);

    try {
      const searchUrl = 'https://nominatim.openstreetmap.org/search';
      const params = new URLSearchParams({
        format: 'json',
        q: address,
        limit: '10',
        addressdetails: '1',
        'accept-language': 'en'
      });

      if (coords) {
        params.append('lat', coords.latitude.toString());
        params.append('lon', coords.longitude.toString());
        params.append('viewbox', makeViewbox(coords.latitude, coords.longitude));
        params.append('bounded', '1');
      }

      const res = await fetch(`${searchUrl}?${params}`, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'CampusPartyFinder/1.0'
        }
      });

      if (!res.ok) {
        throw new Error(`Search failed with status: ${res.status}`);
      }

      let results = await res.json();

      if (Array.isArray(results) && results.length === 0 && coords) {
        const fallbackParams = new URLSearchParams({
          format: 'json',
          q: address,
          limit: '10',
          addressdetails: '1',
          'accept-language': 'en'
        });
        const res2 = await fetch(`${searchUrl}?${fallbackParams}`, {
          headers: {
            Accept: 'application/json',
            'User-Agent': 'CampusPartyFinder/1.0'
          }
        });
        if (res2.ok) {
          results = await res2.json();
        }
      }

      if (Array.isArray(results) && results.length > 0) {
        setOptions(results);
      } else {
        setSearchError('No venues found. Try a more specific search.');
      }
    } catch (error) {
      console.error('Geocoding error:', error);
      setSearchError('Failed to look up that address. Please try again.');
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);

    if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
      setSearchError('Latitude and longitude are required.');
      return;
    }

    if (!startTime) {
      setSearchError('Start time is required.');
      return;
    }

    const payload: NewEventPayload = {
      title: title.trim(),
      description: description.trim() || undefined,
      host_type: hostType,
      location_lat: latitude,
      location_lng: longitude,
      start_time: new Date(startTime).toISOString(),
      end_time: endTime ? new Date(endTime).toISOString() : undefined,
      tags: selectedTags,
      theme: theme.trim() || undefined,
      music_type: musicType.trim() || undefined,
      cover_charge: coverCharge.trim() || undefined,
      is_byob: isByob
    };

    onAdd(payload);

    setTitle('');
    setDescription('');
    setHostType('fraternity');
    setAddress('');
    setLat('');
    setLng('');
    setStartTime('');
    setEndTime('');
    setTheme('');
    setMusicType('');
    setCoverCharge('');
    setIsByob(false);
    setSelectedTags([]);
    setSearchError('');
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ p: 2, maxWidth: 640 }}>
      <Typography variant="h6" gutterBottom>
        Host a New Event
      </Typography>

      {geoError && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {geoError}. Location lookup might be less accurate without GPS.
        </Alert>
      )}

      <Stack spacing={2}>
        <TextField
          label="Event title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          fullWidth
          placeholder="Ex: Sigma Phi Friday Bash"
        />

        <TextField
          label="Event description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          fullWidth
          multiline
          minRows={3}
          placeholder="What should people expect?"
        />

        <TextField
          select
          label="Host type"
          value={hostType}
          onChange={(e) => setHostType(e.target.value as 'fraternity' | 'house' | 'club')}
          fullWidth
        >
          {HOST_TYPES.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </TextField>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="flex-start">
          <Autocomplete
            fullWidth
            freeSolo
            filterOptions={(x) => x}
            options={options}
            loading={loadingOptions}
            getOptionLabel={(option) => (typeof option === 'string' ? option : option.display_name)}
            onInputChange={(_, value) => {
              setAddress(value);
              setSearchTerm(value);
              if (!value) {
                setOptions([]);
                setLat('');
                setLng('');
              }
            }}
            onChange={(_, value) => {
              const match = value as SearchResult | string | null;
              if (match && typeof match !== 'string') {
                setAddress(match.display_name);
                setLat(match.lat);
                setLng(match.lon);
              }
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Venue search"
                placeholder="Enter an address or campus landmark"
                helperText={searchError || (coords ? 'Using your current location to bias results' : '')}
                error={!!searchError}
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {loadingOptions ? <CircularProgress size={18} sx={{ mr: 1 }} /> : null}
                      {params.InputProps.endAdornment}
                    </>
                  )
                }}
              />
            )}
          />
          <Button
            variant="contained"
            onClick={handleGeocodeSearch}
            disabled={!address || isGeocoding}
            startIcon={isGeocoding ? <CircularProgress size={20} /> : <LocationOnIcon />}
            sx={{ mt: { xs: 1, sm: 1 } }}
          >
            {isGeocoding ? 'Finding…' : 'Find'}
          </Button>
        </Stack>

        {lat && lng && (
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Latitude"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              required
              fullWidth
              type="number"
              inputProps={{ step: 'any' }}
            />
            <TextField
              label="Longitude"
              value={lng}
              onChange={(e) => setLng(e.target.value)}
              required
              fullWidth
              type="number"
              inputProps={{ step: 'any' }}
            />
          </Stack>
        )}

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            label="Start time"
            type="datetime-local"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            required
            fullWidth
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="End time"
            type="datetime-local"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            fullWidth
            InputLabelProps={{ shrink: true }}
            helperText="Optional"
          />
        </Stack>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            label="Theme"
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            fullWidth
            placeholder="Glow Night, Porch Jam, etc."
          />
          <TextField
            label="Music style"
            value={musicType}
            onChange={(e) => setMusicType(e.target.value)}
            fullWidth
            placeholder="EDM, Hip-Hop, Indie..."
          />
        </Stack>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
          <TextField
            label="Cover charge"
            value={coverCharge}
            onChange={(e) => setCoverCharge(e.target.value)}
            fullWidth
            placeholder="Ex: $5 before 10pm"
          />
          <FormControlLabel
            control={
              <Switch
                checked={isByob}
                onChange={(e) => setIsByob(e.target.checked)}
                color="primary"
              />
            }
            label="BYOB friendly"
            sx={{ flexShrink: 0 }}
          />
        </Stack>

        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Party tags
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            {TAGS.map((tag) => (
              <Chip
                key={tag}
                label={tag}
                clickable
                color={selectedTags.includes(tag) ? 'primary' : 'default'}
                onClick={() => toggleTag(tag)}
                sx={{ m: 0.5 }}
              />
            ))}
          </Stack>
        </Box>

        <Button
          type="submit"
          variant="contained"
          fullWidth
          disabled={!title || !lat || !lng || !startTime}
        >
          Publish Event
        </Button>
      </Stack>
    </Box>
  );
};

export type { NewEventPayload };
export default AddEventForm;
