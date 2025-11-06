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
import LocationOnIcon from '@mui/icons-material/LocationOn';
import TAGS from '../data/tags';
import useGeolocation from '../hooks/useGeolocation';

type Location = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  tags: string[];
  rating: number;
};

type Props = {
  onAdd: (newLocation: Location) => void;
};

type SearchResult = {
  display_name: string;
  lat: string;
  lon: string;
  class?: string;
  type?: string;
};

const AddLocationForm = ({ onAdd }: Props) => {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [rating, setRating] = useState('');
  const [searchError, setSearchError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [options, setOptions] = useState<SearchResult[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const { coords, error: geoError } = useGeolocation();

  const makeViewbox = (lat: number, lon: number, offset = 0.45) => {
    // Nominatim expects: left,top,right,bottom  => lonMin,latMax,lonMax,latMin
    const left = lon - offset;
    const right = lon + offset;
    const top = lat + offset;
    const bottom = lat - offset;
    return `${left},${top},${right},${bottom}`;
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  // Fetch top 5-10 choices as user types (debounced)
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

    const t = setTimeout(async () => {
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
            'User-Agent': 'QuietLocations/1.0'
          }
        });
        if (!res.ok) throw new Error(`Status ${res.status}`);
        let data = (await res.json()) as SearchResult[];

        // If no results and we were bounded, retry without bounds as a fallback
        if (Array.isArray(data) && data.length === 0 && coords) {
          const params2 = new URLSearchParams({
            format: 'json',
            q: term,
            limit: '10',
            addressdetails: '1',
            'accept-language': 'en'
          });
          res = await fetch(`${searchUrl}?${params2}`, {
            signal: controller.signal,
            headers: {
              Accept: 'application/json',
              'User-Agent': 'QuietLocations/1.0'
            }
          });
          if (res.ok) {
            data = (await res.json()) as SearchResult[];
          }
        }

        setOptions(Array.isArray(data) ? data : []);
      } catch (e) {
        const err = e as Error & { name?: string };
        if (err?.name === 'AbortError') return;
        // Non-fatal: show in helper text
        setOptions([]);
        setSearchError('Search failed. Try again.');
      } finally {
        setLoadingOptions(false);
      }
    }, 300);

    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [searchTerm, coords]);

  const handleGeocodeSearch = async () => {
    if (!address) return;
    setSearchError('');
    setIsGeocoding(true);

    try {
      // Build search URL with viewbox if we have user location
      const searchUrl = 'https://nominatim.openstreetmap.org/search';
      // Base search parameters
      const params = new URLSearchParams({
        format: 'json',
        q: address,
        limit: '10',
        addressdetails: '1',
        'accept-language': 'en'
      });

      // If we have user coordinates, strongly bias to their area
      if (coords) {
        // Add user's location as the search center
        params.append('lat', coords.latitude.toString());
        params.append('lon', coords.longitude.toString());
        
        // Add geographic bounds (~50km box) as a filter
        params.append('viewbox', makeViewbox(coords.latitude, coords.longitude));
        params.append('bounded', '1');
      }

      const res = await fetch(`${searchUrl}?${params}`, {
        headers: {
          'Accept': 'application/json',
          // Add a proper User-Agent as requested by Nominatim
          'User-Agent': 'QuietLocations/1.0'
        }
      });

      if (!res.ok) {
        throw new Error(`Search failed with status: ${res.status}`);
      }

      let results = await res.json();

      // Fallback: if bounded search returned nothing, retry unbounded
      if (Array.isArray(results) && results.length === 0 && coords) {
        const params2 = new URLSearchParams({
          format: 'json',
          q: address,
          limit: '10',
          addressdetails: '1',
          'accept-language': 'en'
        });
        const res2 = await fetch(`${searchUrl}?${params2}`, {
          headers: {
            Accept: 'application/json',
            'User-Agent': 'QuietLocations/1.0'
          }
        });
        if (res2.ok) {
          results = await res2.json();
        }
      }

      if (Array.isArray(results) && results.length > 0) {
        // Populate options to let the user choose
        setOptions(results);
      } else {
        setSearchError('No locations found. Try being more specific.');
      }
    } catch (err) {
      console.error('Geocoding error:', err);
      setSearchError(
        err instanceof Error 
          ? `Search failed: ${err.message}`
          : 'Failed to find location. Please try again.'
      );
    } finally {
      setIsGeocoding(false);
    }
  };

  const generateUniqueId = (name: string) => {
    // Create a base from the name (first 20 chars max)
    const nameBase = name.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 20);
    
    // Add timestamp and random string
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 6);
    
    return `${nameBase}-${timestamp}-${random}`;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const newLocation: Location = {
      id: generateUniqueId(name),
      name: name.trim(),
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      tags: selectedTags,
      rating: parseFloat(rating) || 0,
    };

    onAdd(newLocation);

    // Reset form
    setName('');
    setLat('');
    setLng('');
    setAddress('');
    setSelectedTags([]);
    setRating('');
    setSearchError('');
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ p: 2, maxWidth: 480 }}>
      <Typography variant="h6" gutterBottom>
        Add New Location
      </Typography>

      {geoError && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {geoError}. Location search might be less accurate.
        </Alert>
      )}

      <Stack spacing={2}>
        <TextField
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          fullWidth
        />

        <Stack direction="row" spacing={1} alignItems="flex-start">
          <Autocomplete
            fullWidth
            freeSolo
            filterOptions={(x) => x}
            options={options}
            loading={loadingOptions}
            getOptionLabel={(o) => (typeof o === 'string' ? o : o.display_name)}
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
              const opt = value as SearchResult | string | null;
              if (opt && typeof opt !== 'string') {
                setAddress(opt.display_name);
                setLat(opt.lat);
                setLng(opt.lon);
              }
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Address"
                placeholder="Street, city, state or place name"
                helperText={searchError || (coords ? 'Using your location to find places nearby' : '')}
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
            sx={{ mt: 1, minWidth: 100 }}
          >
            {isGeocoding ? 'Finding…' : 'Find'}
          </Button>
        </Stack>

        {(lat && lng) && (
          <Stack direction="row" spacing={2}>
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

        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Tags
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

        <TextField
          label="Rating (1–5)"
          value={rating}
          onChange={(e) => setRating(e.target.value)}
          type="number"
          inputProps={{ step: '0.1', min: 1, max: 5 }}
        />

        <Button 
          type="submit" 
          variant="contained" 
          fullWidth
          disabled={!lat || !lng || !name}
        >
          Add Location
        </Button>
      </Stack>
    </Box>
  );
};

export default AddLocationForm;
